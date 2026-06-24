import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createV1ToolRegistry } from "../src/tool-registry.ts";
import {
  startAgentLoopState,
  type AgentLoopConfig,
  type AgentLoopState
} from "../src/agent-loop.ts";
import { createStubProvider } from "../src/model-provider.ts";
import { createWorkspace, writeWorkspaceRegistry, workspaceIdForRoot } from "../src/index.ts";
import type { AgentRuntimeInvocationArtifact } from "../src/agent-runtime.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function loadInvocationFixture(): Promise<AgentRuntimeInvocationArtifact> {
  const raw = await readFile(join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json"), "utf8");
  return JSON.parse(raw) as AgentRuntimeInvocationArtifact;
}

test("default system prompt mirrors the current tool registry when no custom prompt provided", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "aetherion-mem-default-"));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  const invocation = await loadInvocationFixture();
  invocation.run_id = "run_mem_default";
  invocation.id = "agent_runtime_invocation_run_mem_default";
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry,
    invocation,
    maxLoopDepth: 1
  });
  const systemMessage = state.conversation[0];
  assert.equal(systemMessage.role, "system");
  const prompt = systemMessage.content;
  assert.match(prompt, new RegExp(`You have ${toolRegistry.tools.length} tools:`));
  for (const tool of toolRegistry.tools) {
    assert.match(prompt, new RegExp(`^- ${tool.name}: ${escapeRegExp(tool.description)}`, "m"));
  }
});

test("custom system prompt with memory facts is passed through", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "aetherion-mem-custom-"));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  const invocation = await loadInvocationFixture();
  invocation.run_id = "run_mem_custom";
  invocation.id = "agent_runtime_invocation_run_mem_custom";
  const provider = createStubProvider("stub-deterministic-v1");
  const memoryPrompt = [
    "You are Aetherion.",
    "",
    "## Persistent Memory",
    "- User prefers TypeScript over JavaScript",
    "- Project uses SQLite for all state",
    "",
    "When you have enough information, answer directly."
  ].join("\n");
  const state = await startAgentLoopState({
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: "stub-deterministic-v1",
    toolRegistry: createV1ToolRegistry(),
    invocation,
    maxLoopDepth: 1,
    systemPrompt: memoryPrompt
  });
  const systemMessage = state.conversation[0];
  assert.equal(systemMessage.role, "system");
  assert.match(systemMessage.content, /User prefers TypeScript/);
  assert.match(systemMessage.content, /SQLite for all state/);
});

test("system prompt without memory section when no custom prompt and no facts", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "aetherion-mem-empty-"));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  const invocation = await loadInvocationFixture();
  invocation.run_id = "run_mem_empty";
  invocation.id = "agent_runtime_invocation_run_mem_empty";
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
  // Default prompt should NOT contain a Persistent Memory section.
  assert.doesNotMatch(systemMessage.content, /## Persistent Memory/);
});

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
