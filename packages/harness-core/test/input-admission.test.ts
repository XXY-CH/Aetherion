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
  admitInput,
  loadAdmittedInputs,
  admissionInputId
} from "../src/index.ts";
import { createV1ToolRegistry } from "../src/tool-registry.ts";
import { runAgentLoop, startAgentLoopState, type AgentLoopConfig, type ApprovalCallback } from "../src/agent-loop.ts";
import type { AgentRuntimeInvocationArtifact } from "../src/agent-runtime.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");
const alwaysApprove: ApprovalCallback = async () => ({ approved: true });

async function tmpWorkspace(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `aetherion-admit-${prefix}-`));
}

async function loadInvocationFixture(): Promise<AgentRuntimeInvocationArtifact> {
  const raw = await readFile(join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json"), "utf8");
  const invocation = JSON.parse(raw) as AgentRuntimeInvocationArtifact;
  invocation.run_id = "run_example";
  invocation.id = "agent_runtime_invocation_run_example";
  return invocation;
}

async function prepareWorkspace(prefix: string): Promise<string> {
  const workspaceRoot = await tmpWorkspace(prefix);
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  await writeFile(join(workspaceRoot, "README.md"), "# Workspace\n\nAdmission test.\n", "utf8");
  return workspaceRoot;
}

// --- Store semantics ---

test("admitInput records an input and is idempotent on replay", async () => {
  const ws = await tmpWorkspace("idem");
  const first = await admitInput(ws, "run_x", "hello world");
  assert.equal(first.admitted, true);
  assert.equal(first.record.input_id, admissionInputId("run_x", 1));

  const replay = await admitInput(ws, "run_x", "hello world");
  assert.equal(replay.admitted, false, "re-admitting the same input id must be a no-op");
  assert.equal(replay.record.admitted_at, first.record.admitted_at, "the original record must be preserved");

  const all = await loadAdmittedInputs(ws, "run_x");
  assert.equal(all.length, 1, "an idempotent replay must not duplicate the record");
});

test("distinct sequences and runs are admitted independently", async () => {
  const ws = await tmpWorkspace("multi");
  await admitInput(ws, "run_a", "first", 1);
  await admitInput(ws, "run_a", "second", 2);
  const runA = await loadAdmittedInputs(ws, "run_a");
  assert.deepEqual(runA.map((a) => a.sequence).sort(), [1, 2]);

  const runB = await loadAdmittedInputs(ws, "run_b");
  assert.equal(runB.length, 0, "admissions are scoped per run id");
});

test("loadAdmittedInputs returns empty when nothing was admitted", async () => {
  const ws = await tmpWorkspace("empty");
  assert.deepEqual(await loadAdmittedInputs(ws, "run_none"), []);
});

// --- Loop integration ---

test("the loop durably admits its input and records the admission", async () => {
  const workspaceRoot = await prepareWorkspace("loop");
  const invocation = await loadInvocationFixture();
  const provider = createStubProvider("stub-deterministic-v1");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4, maxOutputTokens: 256
  });
  const config: AgentLoopConfig = {
    repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 4, maxOutputTokens: 256
  };
  for await (const _event of runAgentLoop(config, state, "just say hi", alwaysApprove)) { /* drain */ }

  const admitted = await loadAdmittedInputs(workspaceRoot, state.runId);
  assert.equal(admitted.length, 1, "the run's input should be durably admitted");
  assert.equal(admitted[0].input_id, admissionInputId(state.runId, 1));

  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  const ledger = await readLedgerEvents(workspace);
  assert.ok(ledger.some((e) => e.event_type === "input.admitted"), "admission should be durable ledger evidence");
});
