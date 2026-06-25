import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
  createStubProvider,
  createWorkspace,
  writeWorkspaceRegistry,
  workspaceIdForRoot,
  readEvents as readLedgerEvents,
  computeContextEpoch,
  toolRegistryDigest
} from "../src/index.ts";
import { createV1ToolRegistry, createToolRegistry } from "../src/tool-registry.ts";
import { runAgentLoop, startAgentLoopState, type AgentLoopConfig, type AgentLoopState, type LoopEvent, type ApprovalCallback } from "../src/agent-loop.ts";
import type { AgentRuntimeInvocationArtifact } from "../src/agent-runtime.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");
const alwaysApprove: ApprovalCallback = async () => ({ approved: true });

async function loadInvocationFixture(): Promise<AgentRuntimeInvocationArtifact> {
  const raw = await readFile(join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json"), "utf8");
  const invocation = JSON.parse(raw) as AgentRuntimeInvocationArtifact;
  invocation.run_id = "run_example";
  invocation.id = "agent_runtime_invocation_run_example";
  return invocation;
}

async function prepareWorkspace(prefix: string): Promise<{ workspaceRoot: string }> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), `aetherion-epoch-${prefix}-`));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  await writeFile(join(workspaceRoot, "README.md"), "# Workspace\n\nEpoch test.\n", "utf8");
  return { workspaceRoot };
}

async function drainLoop(config: AgentLoopConfig, state: AgentLoopState, input: string): Promise<LoopEvent[]> {
  const events: LoopEvent[] = [];
  for await (const event of runAgentLoop(config, state, input, alwaysApprove)) {
    events.push(event);
  }
  return events;
}

// --- Pure hashing properties ---

test("computeContextEpoch is deterministic for the same prompt and tools", () => {
  const tools = createV1ToolRegistry().tools;
  const a = computeContextEpoch("system prompt", tools);
  const b = computeContextEpoch("system prompt", tools);
  assert.deepEqual(a, b);
  assert.equal(a.tool_count, tools.length);
});

test("toolRegistryDigest is order-independent but content-sensitive", () => {
  const tools = createV1ToolRegistry().tools;
  const reversed = [...tools].reverse();
  assert.equal(toolRegistryDigest(tools), toolRegistryDigest(reversed));

  const dropped = tools.slice(1);
  assert.notEqual(toolRegistryDigest(tools), toolRegistryDigest(dropped));
});

test("context hash changes when the system prompt changes", () => {
  const tools = createV1ToolRegistry().tools;
  const a = computeContextEpoch("prompt A", tools);
  const b = computeContextEpoch("prompt B", tools);
  assert.notEqual(a.context_hash, b.context_hash);
  assert.equal(a.tools_hash, b.tools_hash);
});

// --- Loop integration ---

test("startAgentLoopState captures a context epoch and the loop records it", async () => {
  const { workspaceRoot } = await prepareWorkspace("record");
  const invocation = await loadInvocationFixture();
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4, maxOutputTokens: 256
  });
  assert.ok(state.contextEpoch, "epoch should be captured at admission");
  assert.equal(state.contextEpoch?.tool_count, toolRegistry.tools.length);

  const config: AgentLoopConfig = {
    repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4, maxOutputTokens: 256
  };
  const events = await drainLoop(config, state, "just say hi");
  assert.ok(events.some((e) => e.type === "loop_complete"));
  assert.ok(!events.some((e) => e.type === "error"));

  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  const ledger = await readLedgerEvents(workspace);
  assert.ok(ledger.some((e) => e.event_type === "context.epoch.recorded"), "epoch should be durable ledger evidence");
});

test("the loop rejects a tool surface that drifted from the admitted epoch", async () => {
  const { workspaceRoot } = await prepareWorkspace("drift");
  const invocation = await loadInvocationFixture();
  const provider = createStubProvider("stub-deterministic-v1");
  const admittedRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry: admittedRegistry, invocation, maxLoopDepth: 4, maxOutputTokens: 256
  });

  // The config advertises a narrower tool surface than what was admitted.
  const driftedRegistry = createToolRegistry([admittedRegistry.tools[0]]);
  const config: AgentLoopConfig = {
    repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry: driftedRegistry, invocation, maxLoopDepth: 4, maxOutputTokens: 256
  };
  const events = await drainLoop(config, state, "just say hi");

  const err = events.find((e) => e.type === "error") as Extract<LoopEvent, { type: "error" }> | undefined;
  assert.ok(err, "a drifted tool surface must surface an error event");
  assert.equal(err?.code, "context_epoch_violation");
  assert.ok(!events.some((e) => e.type === "loop_complete"), "a fenced turn must not complete the loop");
});
