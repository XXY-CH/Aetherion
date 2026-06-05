import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import {
  appendEvent,
  createFileReadRequest,
  createWorkspace,
  eventRecord,
  mockPolicyDecision,
  primeSchemaCache,
  readLocalFileThroughPolicy,
  reconstructTrace,
  validateAgainstSchema
} from "../src/index.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");

const schemaExamplePairs = [
  ["event.schema.json", "event.json"],
  ["tool-request.schema.json", "tool-request.json"],
  ["policy-decision.schema.json", "policy-decision.json"],
  ["action-record.schema.json", "action-record.json"],
  ["permission-policy.schema.json", "permission-policy.json"],
  ["memory-card.schema.json", "memory-card.json"],
  ["memory-candidate.schema.json", "memory-candidate.json"],
  ["capability-capsule.schema.json", "capability-capsule.json"],
  ["capability-package.schema.json", "capability-package.json"],
  ["proactive-opportunity.schema.json", "proactive-opportunity.json"],
  ["replay-record.schema.json", "replay-record.json"],
  ["migration-report.schema.json", "migration-report.json"]
] as const;

test("contract examples validate against seed JSON schemas", async () => {
  await primeSchemaCache(repoRoot);
  for (const [schemaName, exampleName] of schemaExamplePairs) {
    const example = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", exampleName), "utf8"));
    const result = await validateAgainstSchema(repoRoot, schemaName, example);
    assert.equal(result.valid, true, `${exampleName} failed ${schemaName}: ${result.errors.join("; ")}`);
  }
});

test("user request -> policy decision -> local file read -> event trace -> replay reconstruction", async () => {
  await primeSchemaCache(repoRoot);
  const root = await mkdtemp(join(tmpdir(), "aetherion-harness-"));
  const workspace = await createWorkspace(root, "ws_contract_test");
  const runId = "run_contract_test";
  const targetPath = join(root, "README.md");
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, "Aetherion contract seed\n");

  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_user_message",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "user.message",
    actor: { type: "user", id: "user_local" },
    summary: "Read the workspace README.",
    taint: { sources: ["user"], can_authorize_actions: true }
  }));

  const request = createFileReadRequest(runId, targetPath);
  const requestValidation = await validateAgainstSchema(repoRoot, "tool-request.schema.json", request);
  assert.equal(requestValidation.valid, true, requestValidation.errors.join("; "));

  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_tool_requested",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "tool.requested",
    actor: { type: "agent", id: "agent.local" },
    summary: "Requested workspace file read."
  }));

  const decision = mockPolicyDecision(root, request);
  const decisionValidation = await validateAgainstSchema(repoRoot, "policy-decision.schema.json", decision);
  assert.equal(decisionValidation.valid, true, decisionValidation.errors.join("; "));
  assert.equal(decision.decision, "allow");

  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_policy_decided",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "policy.decided",
    actor: { type: "system", id: "tool_policy_proxy" },
    summary: decision.reason
  }));

  const readResult = await readLocalFileThroughPolicy(request, decision);
  assert.equal(readResult.contents, "Aetherion contract seed\n");

  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_tool_result",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "tool.result",
    actor: { type: "system", id: "filesystem.read" },
    summary: `Read ${readResult.bytes} bytes from workspace file.`
  }));

  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_run_completed",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "run.completed",
    actor: { type: "system", id: "agent_orchestrator" },
    summary: "Run completed with trace reconstruction available."
  }));

  const trace = await reconstructTrace(workspace, runId);
  assert.equal(trace.live_side_effects_replayed, false);
  assert.deepEqual(trace.event_types, [
    "user.message",
    "tool.requested",
    "policy.decided",
    "tool.result",
    "run.completed"
  ]);
});
