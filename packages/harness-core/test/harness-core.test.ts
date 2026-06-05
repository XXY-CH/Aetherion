import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import {
  appendEvent,
  approveWriteWithConsent,
  createFileReadRequest,
  createFileWriteRequest,
  createWorkspace,
  eventRecord,
  mockPolicyDecision,
  primeSchemaCache,
  readLocalFileThroughPolicy,
  reconstructTrace,
  validateAgainstSchema,
  verifyFileContains,
  writeLocalFileThroughPolicy
} from "../src/index.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");

const schemaExamplePairs = [
  ["event.schema.json", "event.json"],
  ["tool-request.schema.json", "tool-request.json"],
  ["policy-decision.schema.json", "policy-decision.json"],
  ["scoped-lease.schema.json", "scoped-lease.json"],
  ["action-record.schema.json", "action-record.json"],
  ["observation-record.schema.json", "observation-record.json"],
  ["verification-record.schema.json", "verification-record.json"],
  ["consent-record.schema.json", "consent-record.json"],
  ["permission-policy.schema.json", "permission-policy.json"],
  ["memory-card.schema.json", "memory-card.json"],
  ["memory-candidate.schema.json", "memory-candidate.json"],
  ["memory-patch.schema.json", "memory-patch.json"],
  ["context-pack.schema.json", "context-pack.json"],
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

test("user request -> policy decision -> local file read/write -> verification -> replay reconstruction", async () => {
  await primeSchemaCache(repoRoot);
  const root = await mkdtemp(join(tmpdir(), "aetherion-harness-"));
  const workspace = await createWorkspace(root, "ws_contract_test");
  const runId = "run_contract_test";
  const targetPath = join(root, "README.md");
  const summaryPath = join(root, "SUMMARY.md");
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, "Aetherion contract seed\n\nThis README proves a minimal contract-first kernel loop.\n");

  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_user_message",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "user.message",
    actor: { type: "user", id: "user_local" },
    summary: "Read README and create a summary file.",
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
  assert.match(readResult.contents, /contract-first kernel loop/);

  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_tool_result",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "tool.result",
    actor: { type: "system", id: "filesystem.read" },
    summary: `Read ${readResult.bytes} bytes from workspace file.`
  }));

  const summary = "Summary: Aetherion contract seed proves a minimal contract-first kernel loop.\n";
  const writeRequest = createFileWriteRequest(runId, summaryPath);
  const writeRequestValidation = await validateAgainstSchema(repoRoot, "tool-request.schema.json", writeRequest);
  assert.equal(writeRequestValidation.valid, true, writeRequestValidation.errors.join("; "));
  const writePreDecision = mockPolicyDecision(root, writeRequest);
  assert.equal(writePreDecision.decision, "ask");

  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_write_policy_ask",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "policy.decided",
    actor: { type: "system", id: "tool_policy_proxy" },
    summary: writePreDecision.reason
  }));

  const consent = {
    id: "consent_contract_write",
    user_id: "user_local",
    workspace_id: workspace.id,
    tool_request_id: writeRequest.id,
    decision: "approved" as const,
    risk_level: "L3" as const,
    approved_at: new Date().toISOString(),
    expires_at: null,
    scope: {
      actions: ["write"],
      paths: [summaryPath]
    }
  };
  const consentValidation = await validateAgainstSchema(repoRoot, "consent-record.schema.json", consent);
  assert.equal(consentValidation.valid, true, consentValidation.errors.join("; "));

  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_consent_recorded",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "consent.recorded",
    actor: { type: "user", id: "user_local" },
    summary: "User approved a workspace-scoped summary file write.",
    taint: { sources: ["user"], can_authorize_actions: true }
  }));

  const writeDecision = approveWriteWithConsent(root, writeRequest, consent);
  const writeDecisionValidation = await validateAgainstSchema(repoRoot, "policy-decision.schema.json", writeDecision);
  assert.equal(writeDecisionValidation.valid, true, writeDecisionValidation.errors.join("; "));
  assert.equal(writeDecision.decision, "allow");

  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_write_policy_allowed",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "policy.decided",
    actor: { type: "system", id: "tool_policy_proxy" },
    summary: writeDecision.reason
  }));

  const writeResult = await writeLocalFileThroughPolicy(writeRequest, writeDecision, summary);
  assert.equal(writeResult.bytes, Buffer.byteLength(summary, "utf8"));

  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_action_recorded",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "action.recorded",
    actor: { type: "system", id: "filesystem.write" },
    summary: `Wrote ${writeResult.bytes} bytes to workspace summary file.`
  }));

  const { observation, verification } = await verifyFileContains({
    runId,
    actionId: "action_contract_write",
    path: summaryPath,
    expectedText: "minimal contract-first kernel loop"
  });
  const observationValidation = await validateAgainstSchema(repoRoot, "observation-record.schema.json", observation);
  assert.equal(observationValidation.valid, true, observationValidation.errors.join("; "));
  const verificationValidation = await validateAgainstSchema(repoRoot, "verification-record.schema.json", verification);
  assert.equal(verificationValidation.valid, true, verificationValidation.errors.join("; "));
  assert.equal(verification.status, "passed");

  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_observation_recorded",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "observation.recorded",
    actor: { type: "system", id: "verifier" },
    summary: observation.summary
  }));

  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_verification_recorded",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "verification.recorded",
    actor: { type: "system", id: "verifier" },
    summary: verification.summary
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
    "policy.decided",
    "consent.recorded",
    "policy.decided",
    "action.recorded",
    "observation.recorded",
    "verification.recorded",
    "run.completed"
  ]);
});
