import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createV1ToolRegistry, parseToolArguments } from "../src/tool-registry.ts";
import {
  runAgentLoop,
  startAgentLoopState,
  type AgentLoopConfig,
  type AgentLoopState,
  type LoopEvent,
  type ApprovalCallback
} from "../src/agent-loop.ts";
import { createStubProvider } from "../src/model-provider.ts";
import { createWorkspace, writeWorkspaceRegistry, workspaceIdForRoot, readEvents } from "../src/index.ts";
import type { AgentRuntimeInvocationArtifact } from "../src/agent-runtime.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");
const alwaysApprove: ApprovalCallback = async () => ({ approved: true });
const alwaysDeny: ApprovalCallback = async () => ({ approved: false, reason: "test denied" });

async function freshWorkspace(prefix: string): Promise<{ workspaceRoot: string; invocation: AgentRuntimeInvocationArtifact }> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), `aetherion-spawn-${prefix}-`));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  await writeFile(join(workspaceRoot, "README.md"), "# Subagent test\n", "utf8");
  const invocation = await loadInvocationFixture();
  invocation.run_id = "run_spawn";
  invocation.id = "agent_runtime_invocation_run_spawn";
  return { workspaceRoot, invocation };
}

async function loadInvocationFixture(): Promise<AgentRuntimeInvocationArtifact> {
  const raw = await readFile(join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json"), "utf8");
  return JSON.parse(raw) as AgentRuntimeInvocationArtifact;
}

async function drainLoop(config: AgentLoopConfig, state: AgentLoopState, input: string, approval: ApprovalCallback): Promise<LoopEvent[]> {
  const events: LoopEvent[] = [];
  for await (const event of runAgentLoop(config, state, input, approval)) {
    events.push(event);
  }
  return events;
}

test("agent_spawn registry entry exists with verb=exec and task parameter", () => {
  const registry = createV1ToolRegistry();
  const spawn = registry.get("agent_spawn");
  assert.ok(spawn, "agent_spawn must be in the V1 registry");
  assert.equal(spawn!.verb, "exec");
  const params = spawn!.parameters as { properties: Record<string, { type: string }>; required: string[] };
  assert.ok(params.properties.task, "must have a task parameter");
  assert.equal(params.properties.task.type, "string");
  assert.ok(params.required.includes("task"), "task must be required");
});

test("parseToolArguments extracts task", () => {
  const args = parseToolArguments({ task: "summarize the workspace" });
  assert.equal(args.task, "summarize the workspace");
});

test("agent_spawn yields tool_proposal (approval required)", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("proposal");
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 3 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 3 };
  const events = await drainLoop(config, state, "spawn agent to summarize the workspace", alwaysApprove);
  const proposals = events.filter((e) => e.type === "tool_proposal");
  assert.ok(proposals.length > 0, "must yield tool_proposal");
  const proposal = proposals[0] as Extract<LoopEvent, { type: "tool_proposal" }>;
  assert.equal(proposal.proposal.toolName, "agent_spawn");
  assert.equal(proposal.proposal.riskLevel, "L4");
});

test("agent_spawn denial yields tool_denied", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("deny");
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 3 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 3 };
  const events = await drainLoop(config, state, "spawn agent to do something", alwaysDeny);
  const denied = events.filter((e) => e.type === "tool_denied");
  assert.ok(denied.length > 0, "must yield tool_denied when denied");
});

test("agent_spawn runs child and returns result", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("run");
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 3 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 3 };
  const events = await drainLoop(config, state, "spawn agent to summarize the workspace", alwaysApprove);
  const ledgerTypes = (await readEvents(state.workspace)).map((event) => event.event_type);
  assert.ok(ledgerTypes.includes("tool.requested"));
  assert.ok(ledgerTypes.includes("risk.composed"));
  assert.ok(ledgerTypes.includes("policy.decided"));
  assert.ok(ledgerTypes.includes("lease.issued"));
  const results = events.filter((e) => e.type === "tool_result");
  assert.ok(results.length > 0, "must yield tool_result");
  const result = results[0] as Extract<LoopEvent, { type: "tool_result" }>;
  // Child should produce some text (stub provider returns canned text).
  assert.ok(result.result.length > 0, "child should produce output");
});
