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
  ToolSettlementTracker
} from "../src/index.ts";
import { createV1ToolRegistry } from "../src/tool-registry.ts";
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
  const workspaceRoot = await mkdtemp(join(tmpdir(), `aetherion-settle-${prefix}-`));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  await writeFile(join(workspaceRoot, "README.md"), "# Workspace\n\nSettlement test target.\nSecond line.\n", "utf8");
  return { workspaceRoot };
}

// --- Tracker semantics ---

test("a registered tool call settles exactly once", () => {
  const tracker = new ToolSettlementTracker();
  tracker.register("asst_1", "call_a");
  assert.deepEqual(tracker.settle("asst_1", "call_a"), { ok: true });
  assert.ok(tracker.isSettled("call_a"));
  assert.deepEqual(tracker.settle("asst_1", "call_a"), { ok: false, reason: "already_settled" });
});

test("settling an unregistered tool call is rejected", () => {
  const tracker = new ToolSettlementTracker();
  assert.deepEqual(tracker.settle("asst_1", "ghost"), { ok: false, reason: "unknown_tool_call" });
});

test("settling against a different assistant message is rejected", () => {
  const tracker = new ToolSettlementTracker();
  tracker.register("asst_1", "call_a");
  assert.deepEqual(tracker.settle("asst_2", "call_a"), { ok: false, reason: "assistant_mismatch" });
  assert.ok(!tracker.isSettled("call_a"));
});

test("re-registering under a new assistant message rebinds the call", () => {
  const tracker = new ToolSettlementTracker();
  tracker.register("asst_1", "call_a");
  tracker.register("asst_2", "call_a");
  assert.deepEqual(tracker.settle("asst_1", "call_a"), { ok: false, reason: "assistant_mismatch" });
  assert.deepEqual(tracker.settle("asst_2", "call_a"), { ok: true });
});

// --- Loop integration ---

test("the loop settles a real tool call and records the binding", async () => {
  const { workspaceRoot } = await prepareWorkspace("loop");
  const invocation = await loadInvocationFixture();
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 5, maxOutputTokens: 256
  });
  assert.ok(state.toolSettlement, "a settlement tracker should be admitted with the state");

  const config: AgentLoopConfig = {
    repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 5, maxOutputTokens: 256
  };
  const events: LoopEvent[] = [];
  for await (const event of runAgentLoop(config, state, "please read README.md and show me the first lines", alwaysApprove)) {
    events.push(event);
  }
  assert.ok(events.some((e) => e.type === "tool_result"), "the run should execute a tool");

  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  const ledger = await readLedgerEvents(workspace);
  const settled = ledger.filter((e) => e.event_type === "tool.settled");
  assert.ok(settled.length >= 1, "the loop should record a tool.settled binding");
  assert.ok(settled.every((e) => e.summary.includes("assistant message asst_")), "each settlement should name the assistant message it bound to");
});
