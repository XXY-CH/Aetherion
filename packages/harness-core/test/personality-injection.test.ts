import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
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

test("AETHERION_PERSONALITY env var injects personality section into system prompt", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "aetherion-personality-"));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  const invocation = await loadInvocationFixture();
  invocation.run_id = "run_personality";
  invocation.id = "agent_runtime_invocation_run_personality";

  const oldVal = process.env.AETHERION_PERSONALITY;
  process.env.AETHERION_PERSONALITY = "Be extremely concise. No pleasantries.";
  try {
    const provider = createStubProvider("stub-deterministic-v1");
    const state = await startAgentLoopState({
      repoRoot, workspaceRoot, provider,
      modelRef: "stub-deterministic-v1",
      toolRegistry: createV1ToolRegistry(),
      invocation, maxLoopDepth: 1
    });
    const systemMessage = state.conversation[0];
    assert.match(systemMessage.content, /## Personality/);
    assert.match(systemMessage.content, /Be extremely concise/);
  } finally {
    if (oldVal === undefined) delete process.env.AETHERION_PERSONALITY;
    else process.env.AETHERION_PERSONALITY = oldVal;
  }
});

test("no personality env var means no personality section", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "aetherion-no-personality-"));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  const invocation = await loadInvocationFixture();
  invocation.run_id = "run_no_personality";
  invocation.id = "agent_runtime_invocation_run_no_personality";

  const oldVal = process.env.AETHERION_PERSONALITY;
  delete process.env.AETHERION_PERSONALITY;
  try {
    const provider = createStubProvider("stub-deterministic-v1");
    const state = await startAgentLoopState({
      repoRoot, workspaceRoot, provider,
      modelRef: "stub-deterministic-v1",
      toolRegistry: createV1ToolRegistry(),
      invocation, maxLoopDepth: 1
    });
    const systemMessage = state.conversation[0];
    assert.doesNotMatch(systemMessage.content, /## Personality/);
  } finally {
    if (oldVal !== undefined) process.env.AETHERION_PERSONALITY = oldVal;
  }
});
