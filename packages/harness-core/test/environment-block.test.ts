import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { buildEnvironmentBlock } from "../src/agent-loop.ts";
import { createV1ToolRegistry } from "../src/tool-registry.ts";
import { startAgentLoopState } from "../src/agent-loop.ts";
import { createStubProvider } from "../src/model-provider.ts";
import { createWorkspace, writeWorkspaceRegistry, workspaceIdForRoot } from "../src/index.ts";
import type { AgentRuntimeInvocationArtifact } from "../src/agent-runtime.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function loadInvocationFixture(): Promise<AgentRuntimeInvocationArtifact> {
  const raw = await readFile(join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json"), "utf8");
  return JSON.parse(raw) as AgentRuntimeInvocationArtifact;
}

test("buildEnvironmentBlock includes workspace, platform, and date", async () => {
  const ws = "/tmp/test-env-block";
  const block = await buildEnvironmentBlock(ws);
  assert.match(block, /<environment>/);
  assert.match(block, /<\/environment>/);
  assert.match(block, /workspace: \/tmp\/test-env-block/);
  assert.match(block, /platform:/);
  assert.match(block, /date: \d{4}-\d{2}-\d{2}/);
});

test("buildEnvironmentBlock includes git branch when in a git repo", async () => {
  // The test runs in the project root which is a git repo.
  const block = await buildEnvironmentBlock(repoRoot);
  assert.match(block, /git_branch:|git: not a git repo/);
});

test("system prompt includes environment block by default", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "aetherion-envblock-"));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  const invocation = await loadInvocationFixture();
  invocation.run_id = "run_envblock";
  invocation.id = "agent_runtime_invocation_run_envblock";
  const provider = createStubProvider("stub-deterministic-v1");
  const state = await startAgentLoopState({
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry: createV1ToolRegistry(),
    invocation,
    maxLoopDepth: 1
  });
  const systemMessage = state.conversation[0];
  assert.equal(systemMessage.role, "system");
  assert.match(systemMessage.content, /<environment>/);
  assert.match(systemMessage.content, /platform:/);
});

test("custom system prompt still gets environment block appended", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "aetherion-envblock-custom-"));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  const invocation = await loadInvocationFixture();
  invocation.run_id = "run_envblock_custom";
  invocation.id = "agent_runtime_invocation_run_envblock_custom";
  const provider = createStubProvider("stub-deterministic-v1");
  const state = await startAgentLoopState({
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry: createV1ToolRegistry(),
    invocation,
    maxLoopDepth: 1,
    systemPrompt: "You are a custom agent."
  });
  const systemMessage = state.conversation[0];
  assert.match(systemMessage.content, /You are a custom agent\./);
  assert.match(systemMessage.content, /<environment>/);
});
