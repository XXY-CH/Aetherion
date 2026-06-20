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
import { createWorkspace, writeWorkspaceRegistry, workspaceIdForRoot } from "../src/index.ts";
import type { AgentRuntimeInvocationArtifact } from "../src/agent-runtime.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function loadInvocationFixture(): Promise<AgentRuntimeInvocationArtifact> {
  const raw = await readFile(join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json"), "utf8");
  return JSON.parse(raw) as AgentRuntimeInvocationArtifact;
}

async function drainLoop(
  config: AgentLoopConfig,
  state: AgentLoopState,
  userInput: string,
  approval: ApprovalCallback
): Promise<LoopEvent[]> {
  const events: LoopEvent[] = [];
  for await (const event of runAgentLoop(config, state, userInput, approval)) {
    events.push(event);
  }
  return events;
}

const alwaysApprove: ApprovalCallback = async () => ({ approved: true });
const alwaysDeny: ApprovalCallback = async () => ({ approved: false, reason: "test denied" });

async function freshExecWorkspace(prefix: string): Promise<{ workspaceRoot: string; invocation: AgentRuntimeInvocationArtifact }> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), `aetherion-exec-${prefix}-`));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  await writeFile(join(workspaceRoot, "README.md"), "# Workspace\n\nexec test target.\n", "utf8");
  const invocation = await loadInvocationFixture();
  invocation.run_id = "run_exec";
  invocation.id = "agent_runtime_invocation_run_exec";
  return { workspaceRoot, invocation };
}

// ── Registry + argument parsing ──────────────────────────────────────────

test("shell_exec registry entry exists with verb=exec and command parameter", () => {
  const registry = createV1ToolRegistry();
  const exec = registry.get("shell_exec");
  assert.ok(exec, "shell_exec must be in the V1 registry");
  assert.equal(exec!.verb, "exec");
  const params = exec!.parameters as { properties: Record<string, { type: string }>; required: string[] };
  assert.ok(params.properties.command, "must have a command parameter");
  assert.equal(params.properties.command.type, "string");
  assert.ok(params.required.includes("command"), "command must be required");
});

test("parseToolArguments extracts command and timeout_ms", () => {
  const args = parseToolArguments({ command: "echo hello", timeout_ms: 5000 });
  assert.equal(args.command, "echo hello");
  assert.equal(args.timeout_ms, 5000);
});

test("parseToolArguments returns empty when no command", () => {
  const args = parseToolArguments({ path: "/tmp/x" });
  assert.equal(args.command, undefined);
});

// ── Agent loop integration ───────────────────────────────────────────────

test("processToolCall for shell_exec yields tool_proposal (approval required)", async () => {
  const { workspaceRoot, invocation } = await freshExecWorkspace("proposal");
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 2 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 2 };
  const events = await drainLoop(config, state, "run echo hello_from_exec", alwaysApprove);
  const proposals = events.filter((e) => e.type === "tool_proposal");
  assert.ok(proposals.length > 0, "shell_exec must yield a tool_proposal for approval");
  const proposal = proposals[0] as Extract<LoopEvent, { type: "tool_proposal" }>;
  assert.equal(proposal.proposal.toolName, "shell_exec");
  assert.equal(proposal.proposal.verb, "exec");
  assert.equal(proposal.proposal.riskLevel, "L4");
});

test("processToolCall for shell_exec runs echo and returns stdout", async () => {
  const { workspaceRoot, invocation } = await freshExecWorkspace("echo");
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 2 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 2 };
  const events = await drainLoop(config, state, "run echo hello_from_exec", alwaysApprove);
  const results = events.filter((e) => e.type === "tool_result");
  assert.ok(results.length > 0, "must yield a tool_result");
  const result = results[0] as Extract<LoopEvent, { type: "tool_result" }>;
  assert.ok(result.success, "echo should succeed");
  assert.match(result.result, /hello_from_exec/);
});

test("shell_exec denial by user yields tool_denied event", async () => {
  const { workspaceRoot, invocation } = await freshExecWorkspace("deny");
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 2 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 2 };
  const events = await drainLoop(config, state, "run echo denied_test", alwaysDeny);
  const denied = events.filter((e) => e.type === "tool_denied");
  assert.ok(denied.length > 0, "must yield tool_denied when user denies");
});

test("shell_exec captures non-zero exit code", async () => {
  const { workspaceRoot, invocation } = await freshExecWorkspace("exitcode");
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 2 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 2 };
  const events = await drainLoop(config, state, "run false", alwaysApprove);
  const results = events.filter((e) => e.type === "tool_result");
  assert.ok(results.length > 0);
  const result = results[0] as Extract<LoopEvent, { type: "tool_result" }>;
  assert.equal(result.success, false, "false command should fail");
  assert.match(result.result, /exit|error|fail/i);
});
