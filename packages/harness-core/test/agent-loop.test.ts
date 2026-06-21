import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import {
  createStubProvider,
  reconstructTrace,
  resolveModelProvider,
  verifyEventHashChain,
  readEvents,
  createWorkspace,
  writeWorkspaceRegistry,
  workspaceIdForRoot,
  readEvents as readLedgerEvents
} from "../src/index.ts";
import { createV1ToolRegistry, parseToolArguments } from "../src/tool-registry.ts";
import { runAgentLoop, startAgentLoopState, type AgentLoopConfig, type AgentLoopState, type LoopEvent, type ToolCallProposal } from "../src/agent-loop.ts";
import type { AgentRuntimeInvocationArtifact } from "../src/agent-runtime.ts";
import type { ApprovalCallback } from "../src/agent-loop.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");

// Loads the canonical invocation fixture and rewrites its run_id-derived fields
// to match the workspace under test.
async function loadInvocationFixture(): Promise<AgentRuntimeInvocationArtifact> {
  const raw = await readFile(join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json"), "utf8");
  return JSON.parse(raw) as AgentRuntimeInvocationArtifact;
}

// Drains a loop generator into an event array. The approval callback can be
// swapped per test to exercise approve/deny paths.
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

async function freshWorkspace(prefix: string): Promise<{ repoRoot: string; workspaceRoot: string }> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), `aetherion-loop-${prefix}-`));
  return { repoRoot, workspaceRoot };
}

async function prepareWorkspace(workspaceRoot: string, invocation: AgentRuntimeInvocationArtifact): Promise<void> {
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  // Seed a README the read tool can target.
  await writeFile(join(workspaceRoot, "README.md"), "# Workspace\n\nAgent loop test target.\nSecond line.\n", "utf8");
  invocation.run_id = "run_example";
  invocation.id = "agent_runtime_invocation_run_example";
}

test("tool registry registers local_file_read, local_file_write, shell_exec, web_fetch, agent_spawn, and file_edit and converts to provider formats", () => {
  const registry = createV1ToolRegistry();
  assert.equal(registry.tools.length, 6);
  assert.ok(registry.has("local_file_read"));
  assert.ok(registry.has("local_file_write"));
  assert.ok(registry.has("shell_exec"));
  assert.ok(registry.has("web_fetch"));
  assert.ok(registry.has("agent_spawn"));

  const openai = registry.toProviderFormat("openai_chat_completions");
  assert.deepEqual(Object.keys(openai[0] as object).sort(), ["function", "type"]);
  assert.equal((openai[0] as { function: { name: string } }).function.name, "local_file_read");

  const anthropic = registry.toProviderFormat("anthropic");
  assert.equal((anthropic[0] as { name: string }).name, "local_file_read");
  assert.ok("input_schema" in (anthropic[0] as object));

  const gemini = registry.toProviderFormat("gemini");
  const decls = (gemini[0] as { functionDeclarations: Array<{ name: string }> }).functionDeclarations;
  assert.equal(decls[0].name, "local_file_read");

  assert.equal(registry.get("nonexistent"), undefined);
});

test("parseToolArguments decodes JSON strings, objects, and rejects malformed input", () => {
  assert.deepEqual(parseToolArguments('{"path":"README.md"}'), { path: "README.md" });
  assert.deepEqual(parseToolArguments({ path: "a.txt", content: "hi" }), { path: "a.txt", content: "hi" });
  assert.deepEqual(parseToolArguments("not json"), {});
  assert.deepEqual(parseToolArguments(undefined), {});
  assert.deepEqual(parseToolArguments('{"path":123}'), {});
});

test("agent loop completes with a plain answer when no tool intent is detected", async () => {
  const { repoRoot, workspaceRoot } = await freshWorkspace("plain");
  const invocation = await loadInvocationFixture();
  await prepareWorkspace(workspaceRoot, invocation);
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry,
    invocation,
    maxLoopDepth: 4,
    maxOutputTokens: 256
  });
  const config: AgentLoopConfig = {
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry,
    invocation,
    maxLoopDepth: 4,
    maxOutputTokens: 256
  };

  const events = await drainLoop(config, state, "hello there, just say hi", alwaysApprove);
  const types = events.map((event) => event.type);
  assert.ok(types.includes("loop_started"));
  assert.ok(types.includes("loop_complete"));
  assert.ok(!types.includes("tool_proposal"));
  const complete = events.find((event) => event.type === "loop_complete") as Extract<LoopEvent, { type: "loop_complete" }>;
  assert.equal(complete.totalToolCalls, 0);
});

test("agent loop executes a single file read and then answers", async () => {
  const { repoRoot, workspaceRoot } = await freshWorkspace("read");
  const invocation = await loadInvocationFixture();
  await prepareWorkspace(workspaceRoot, invocation);
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry,
    invocation,
    maxLoopDepth: 5,
    maxOutputTokens: 256
  });
  const config: AgentLoopConfig = {
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry,
    invocation,
    maxLoopDepth: 5,
    maxOutputTokens: 256
  };

  const events = await drainLoop(config, state, "please read README.md and show me the first lines", alwaysApprove);
  const types = events.map((event) => event.type);

  // The stub emits a read tool call on turn 1, the loop executes it, then turn 2
  // has no further intent so the model answers and the loop completes.
  assert.ok(types.includes("tool_result"));
  assert.ok(types.includes("loop_complete"));
  const result = events.find((event) => event.type === "tool_result") as Extract<LoopEvent, { type: "tool_result" }>;
  assert.equal(result.toolName, "local_file_read");
  assert.equal(result.success, true);
  assert.match(result.result, /Agent loop test target/);
  const complete = events.find((event) => event.type === "loop_complete") as Extract<LoopEvent, { type: "loop_complete" }>;
  assert.ok(complete.totalToolCalls >= 1);
});

test("agent loop write requires approval and records a consent-backed lease", async () => {
  const { repoRoot, workspaceRoot } = await freshWorkspace("write");
  const invocation = await loadInvocationFixture();
  await prepareWorkspace(workspaceRoot, invocation);
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry,
    invocation,
    maxLoopDepth: 5,
    maxOutputTokens: 256
  });
  const config: AgentLoopConfig = {
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry,
    invocation,
    maxLoopDepth: 5,
    maxOutputTokens: 256
  };

  const seenProposals: ToolCallProposal[] = [];
  const approveOnce: ApprovalCallback = async (proposal) => {
    seenProposals.push(proposal);
    return { approved: true };
  };

  const events = await drainLoop(config, state, "please write SUMMARY.md with a short note", approveOnce);
  const types = events.map((event) => event.type);
  assert.ok(types.includes("tool_proposal"));
  assert.ok(types.includes("tool_approved"));
  assert.ok(types.includes("tool_result"));
  assert.equal(seenProposals.length, 1);
  assert.equal(seenProposals[0].toolName, "local_file_write");
  // The file was actually written under the lease.
  const written = await readFile(join(workspaceRoot, "SUMMARY.md"), "utf8");
  assert.ok(written.length > 0);
});

test("agent loop respects a denied write approval and informs the model", async () => {
  const { repoRoot, workspaceRoot } = await freshWorkspace("deny");
  const invocation = await loadInvocationFixture();
  await prepareWorkspace(workspaceRoot, invocation);
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry,
    invocation,
    maxLoopDepth: 5,
    maxOutputTokens: 256
  });
  const config: AgentLoopConfig = {
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry,
    invocation,
    maxLoopDepth: 5,
    maxOutputTokens: 256
  };

  const events = await drainLoop(config, state, "please write DENIED.md with content", alwaysDeny);
  const types = events.map((event) => event.type);
  assert.ok(types.includes("tool_denied"));
  // The loop still completes (the model is told the write was denied).
  assert.ok(types.includes("loop_complete"));
});

test("agent loop policy-denies a read outside the workspace boundary", async () => {
  const { repoRoot, workspaceRoot } = await freshWorkspace("policy");
  const invocation = await loadInvocationFixture();
  await prepareWorkspace(workspaceRoot, invocation);
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry,
    invocation,
    maxLoopDepth: 5,
    maxOutputTokens: 256
  });
  const config: AgentLoopConfig = {
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry,
    invocation,
    maxLoopDepth: 5,
    maxOutputTokens: 256
  };

  // An absolute path that resolves outside the workspace root.
  const outside = join(tmpdir(), "aetherion-outside-target.txt");
  const events = await drainLoop(config, state, `please read ${outside}`, alwaysApprove);
  const types = events.map((event) => event.type);
  assert.ok(types.includes("policy_denied"), `expected policy_denied in ${JSON.stringify(types)}`);
});

test("agent loop records a hash-chain-intact ledger across all turns", async () => {
  const { repoRoot, workspaceRoot } = await freshWorkspace("ledger");
  const invocation = await loadInvocationFixture();
  await prepareWorkspace(workspaceRoot, invocation);
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry,
    invocation,
    maxLoopDepth: 5,
    maxOutputTokens: 256
  });
  const config: AgentLoopConfig = {
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry,
    invocation,
    maxLoopDepth: 5,
    maxOutputTokens: 256
  };

  await drainLoop(config, state, "please read README.md and show me the first lines", alwaysApprove);

  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  const events = await readLedgerEvents(workspace);
  assert.ok(events.length > 0, "ledger should contain agent loop events");
  const chain = verifyEventHashChain(events);
  assert.equal(chain.valid, true, `ledger hash chain broken at ${chain.broken_at ?? "unknown"}`);
  // The loop should have appended at least the core event types.
  const eventTypes = new Set(events.map((event) => event.event_type));
  assert.ok(eventTypes.has("tool.requested"));
  assert.ok(eventTypes.has("policy.decided"));
  assert.ok(eventTypes.has("tool.result"));
});
