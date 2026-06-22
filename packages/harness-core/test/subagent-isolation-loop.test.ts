import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createV1ToolRegistry } from "../src/tool-registry.ts";
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
const alwaysApprove: ApprovalCallback = async () => ({ approved: true });

// Parent prompt that triggers wantsSpawn (no write/read/exec keywords before
// "spawn" so the stub provider routes to agent_spawn, not local_file_write).
// The extracted child task ("summarize the workspace") triggers a read inside
// the child — observable as the worktree being created with the copied files.
const SPAWN_PROMPT = "spawn agent to summarize the workspace";

async function freshWorkspace(prefix: string): Promise<{ workspaceRoot: string; invocation: AgentRuntimeInvocationArtifact }> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), `aetherion-iso-${prefix}-`));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  await writeFile(join(workspaceRoot, "README.md"), "# Subagent isolation test\n", "utf8");
  const invocation = await loadInvocationFixture();
  invocation.run_id = `run_iso_${prefix}`;
  invocation.id = `agent_runtime_invocation_run_iso_${prefix}`;
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

function findWorktreeBranches(workspaceRoot: string): string[] {
  const wtDir = join(workspaceRoot, ".aetherion", "worktrees");
  return existsSync(wtDir) ? readdirSync(wtDir) : [];
}

// Test: agent_spawn creates a worktree under .aetherion/worktrees/<name>/.
test("agent_spawn creates a physical worktree directory", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("worktree");
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4 };
  await drainLoop(config, state, SPAWN_PROMPT, alwaysApprove);
  const branches = findWorktreeBranches(workspaceRoot);
  assert.ok(branches.length > 0, `agent_spawn must create at least one worktree branch dir, got: ${JSON.stringify(branches)}`);
});

// Test: the worktree contains the copied workspace files (README.md) — proving
// the child runs in an isolated copy, not the parent.
test("worktree contains copied workspace files", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("copy");
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4 };
  await drainLoop(config, state, SPAWN_PROMPT, alwaysApprove);
  const branches = findWorktreeBranches(workspaceRoot);
  assert.ok(branches.length > 0, "worktree branch must exist");
  // The copied README.md must be in the worktree's workspace dir.
  const wtReadme = join(workspaceRoot, ".aetherion", "worktrees", branches[0], "workspace", "README.md");
  assert.ok(existsSync(wtReadme), `worktree must contain copied README.md at ${wtReadme}`);
  const copied = await readFile(wtReadme, "utf8");
  assert.equal(copied, "# Subagent isolation test\n", "worktree README must match parent's pre-spawn content");
});

// Test: the worktree has its own .aetherion (so the child's snapshots/ledger
// are isolated from the parent).
test("worktree has its own .aetherion directory", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("aetherion");
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4 };
  await drainLoop(config, state, SPAWN_PROMPT, alwaysApprove);
  const branches = findWorktreeBranches(workspaceRoot);
  assert.ok(branches.length > 0, "worktree branch must exist");
  const wtAetherion = join(workspaceRoot, ".aetherion", "worktrees", branches[0], "workspace", ".aetherion");
  assert.ok(existsSync(wtAetherion), "worktree must have its own .aetherion for isolated snapshots/ledger");
});

// Test: the parent ledger records the spawn result with a branch reference.
test("parent ledger records spawn result with branch reference", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("ledger");
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4 };
  const events = await drainLoop(config, state, SPAWN_PROMPT, alwaysApprove);
  const results = events.filter((e) => e.type === "tool_result");
  assert.ok(results.length > 0, "must yield tool_result");
  const result = results[0] as Extract<LoopEvent, { type: "tool_result" }>;
  // The result must reference the branch (so the operator can review/merge).
  assert.ok(/branch/i.test(result.result), `tool_result should mention the branch, got: ${result.result}`);
});

// Test: the parent's own files are untouched after the spawn (the child ran in
// isolation; even though the child read, the parent workspace is unchanged).
test("parent workspace files unchanged after spawn", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("untouched");
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4 };
  const beforeReadme = await readFile(join(workspaceRoot, "README.md"), "utf8");
  const beforeEntries = readdirSync(workspaceRoot).sort().join(",");
  await drainLoop(config, state, SPAWN_PROMPT, alwaysApprove);
  const afterReadme = await readFile(join(workspaceRoot, "README.md"), "utf8");
  const afterEntries = readdirSync(workspaceRoot).sort().join(",");
  assert.equal(beforeReadme, afterReadme, "parent README.md must not change due to child activity");
  assert.equal(beforeEntries, afterEntries, `parent top-level entries must not change: before=[${beforeEntries}] after=[${afterEntries}]`);
});

// Test: the child result contains real assistant text (not the "no output" fallback).
test("child result contains assistant text, not the no-output fallback", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("output");
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4 };
  const events = await drainLoop(config, state, SPAWN_PROMPT, alwaysApprove);
  const results = events.filter((e) => e.type === "tool_result");
  assert.ok(results.length > 0, "must yield tool_result");
  const result = results[0] as Extract<LoopEvent, { type: "tool_result" }>;
  assert.notEqual(result.result, "(child agent produced no text output)", "child must produce real assistant text (assistant_text.content bug fixed)");
});
