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
  createTraceReplayRecord,
  createWorkspace,
  eventRecord,
  readEvents,
  evaluateSeedPolicy,
  primeSchemaCache,
  readLocalFileThroughPolicy,
  reconstructTrace,
  validateAgainstSchema,
  verifyEventHashChain,
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
  ["migration-report.schema.json", "migration-report.json"],
  ["workspace-registry.schema.json", "workspace-registry.json"],
  ["run-manifest.schema.json", "run-manifest.json"],
  ["risk-composition.schema.json", "risk-composition.json"],
  ["approval-card.schema.json", "approval-card.json"],
  ["migration-plan.schema.json", "migration-plan.json"],
  ["legacy-capsule.schema.json", "legacy-capsule.json"],
  ["event-checkpoint.schema.json", "event-checkpoint.json"],
  ["ledger-branch.schema.json", "ledger-branch.json"],
  ["sandbox-rehearsal.schema.json", "sandbox-rehearsal.json"],
  ["sandbox-approval.schema.json", "sandbox-approval.json"],
  ["causal-edge.schema.json", "causal-edge.json"],
  ["why-report.schema.json", "why-report.json"],
  ["causal-projection.schema.json", "causal-projection.json"],
  ["counterfactual-report.schema.json", "counterfactual-report.json"],
  ["hibernation-record.schema.json", "hibernation-record.json"],
  ["wakeup-trigger.schema.json", "wakeup-trigger.json"],
  ["memory-fold.schema.json", "memory-fold.json"],
  ["episodic-timeline.schema.json", "episodic-timeline.json"],
  ["user-model.schema.json", "user-model.json"],
  ["persona-anchor.schema.json", "persona-anchor.json"],
  ["persona-branch.schema.json", "persona-branch.json"],
  ["persona-state.schema.json", "persona-state.json"],
  ["persona-reset.schema.json", "persona-reset.json"],
  ["soul-fork.schema.json", "soul-fork.json"],
  ["inheritance-policy.schema.json", "inheritance-policy.json"],
  ["agent-contract.schema.json", "agent-contract.json"],
  ["resource-budget.schema.json", "resource-budget.json"],
  ["budget-account.schema.json", "budget-account.json"],
  ["circuit-breaker.schema.json", "circuit-breaker.json"],
  ["child-result.schema.json", "child-result.json"],
  ["agent-score.schema.json", "agent-score.json"],
  ["content-assessment.schema.json", "content-assessment.json"],
  ["poisoning-signal.schema.json", "poisoning-signal.json"],
  ["honeypot-trial.schema.json", "honeypot-trial.json"],
  ["poisoning-regression-fixture.schema.json", "poisoning-regression-fixture.json"],
  ["browser-observation.schema.json", "browser-observation.json"],
  ["computer-action.schema.json", "computer-action.json"],
  ["computer-observation.schema.json", "computer-observation.json"],
  ["im-inbox-item.schema.json", "im-inbox-item.json"],
  ["im-outbox-item.schema.json", "im-outbox-item.json"],
  ["store-package.schema.json", "store-package.json"],
  ["capsule-install.schema.json", "capsule-install.json"]
] as const;

test("contract examples validate against seed JSON schemas", async () => {
  await primeSchemaCache(repoRoot);
  for (const [schemaName, exampleName] of schemaExamplePairs) {
    const example = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", exampleName), "utf8"));
    const result = await validateAgainstSchema(repoRoot, schemaName, example);
    assert.equal(result.valid, true, `${exampleName} failed ${schemaName}: ${result.errors.join("; ")}`);
  }
});

test("contract validation rejects inherited Soul Fork authority and duplicate fold sources", async () => {
  await primeSchemaCache(repoRoot);
  const event = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "event.json"), "utf8"));
  event.timestamp = "unix-ms-1700000000000";
  const eventValidation = await validateAgainstSchema(repoRoot, "event.schema.json", event);
  assert.equal(eventValidation.valid, false);
  assert.ok(eventValidation.errors.some((error) => error.includes("date-time format")));

  const fork = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "soul-fork.json"), "utf8"));
  fork.policy.active_leases = ["lease_inherited"];
  fork.workspace_scope.allowed_paths = ["."];
  const forkResult = await validateAgainstSchema(repoRoot, "soul-fork.schema.json", fork);
  assert.equal(forkResult.valid, false);
  assert.ok(forkResult.errors.some((error) => error.includes("expected at most 0 items")));

  const fold = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "memory-fold.json"), "utf8"));
  fold.folded_from = ["mem_style_a", "mem_style_a"];
  const foldResult = await validateAgainstSchema(repoRoot, "memory-fold.schema.json", fold);
  assert.equal(foldResult.valid, false);
  assert.ok(foldResult.errors.some((error) => error.includes("expected unique items")));

  const childResult = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "child-result.json"), "utf8"));
  childResult.output_taint.can_authorize_actions = true;
  const childResultValidation = await validateAgainstSchema(repoRoot, "child-result.schema.json", childResult);
  assert.equal(childResultValidation.valid, false);
  assert.ok(childResultValidation.errors.some((error) => error.includes("expected one of false")));
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

  const decision = evaluateSeedPolicy(root, request);
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
  const writePreDecision = evaluateSeedPolicy(root, writeRequest);
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
  assert.equal(trace.chain_valid, true);
  assert.equal(trace.head_event_id, "evt_contract_run_completed");
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
  const events = await readEvents(workspace);
  assert.ok(events[0].event_hash?.startsWith("sha256:"));
  assert.equal(events[1].parent_event_id, events[0].id);
  assert.equal(events[1].parent_event_hash, events[0].event_hash);
  assert.equal(verifyEventHashChain(events).valid, true);

  const replayRecord = await createTraceReplayRecord(workspace, runId);
  assert.equal(replayRecord.mode, "trace");
  assert.equal(replayRecord.live_side_effects.allowed, false);
  assert.equal(replayRecord.live_side_effects.approval_id, null);
  assert.equal(replayRecord.result.status, "passed");
  assert.equal(replayRecord.source_events.at(-1), "evt_contract_run_completed");
  const replayValidation = await validateAgainstSchema(repoRoot, "replay-record.schema.json", replayRecord);
  assert.equal(replayValidation.valid, true, replayValidation.errors.join("; "));
});

test("phase 1 run creates workspace registry, run manifest, approval card, and blocks unapproved write", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-phase1-"));
  await writeFile(join(root, "README.md"), "Phase 1 fixture\n");
  const { runLocalKernelLoop, loadRunManifest, workspaceRegistryPath } = await import("../src/index.ts");

  const result = await runLocalKernelLoop({
    repoRoot,
    workspaceRoot: root,
    inputPath: "README.md",
    outputPath: ".aetherion/SUMMARY.md",
    approveWrite: false,
    runId: "run_phase1_blocked"
  });

  assert.equal(result.writePreDecision.decision, "ask");
  assert.equal(result.approvalCard.risk_level, "L3");
  assert.equal(result.trace.live_side_effects_replayed, false);
  assert.equal((await readFile(workspaceRegistryPath(result.workspace), "utf8")).includes("typescript-seed"), true);
  const manifest = await loadRunManifest(result.workspace, "run_phase1_blocked");
  assert.equal(manifest.status, "blocked");
  assert.ok(manifest.event_ids.includes("evt_run_phase1_blocked_completed_without_write"));
});

test("workspace boundary denies paths outside the workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-boundary-"));
  const outsideRoot = await mkdtemp(join(tmpdir(), "aetherion-outside-"));
  const outsidePath = join(outsideRoot, "secret.txt");
  await writeFile(outsidePath, "secret\n");

  const request = createFileReadRequest("run_outside", outsidePath);
  const decision = evaluateSeedPolicy(root, request);
  assert.equal(decision.decision, "deny");
});

test("expired scoped leases are rejected before file writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-expired-"));
  const path = join(root, "SUMMARY.md");
  const request = createFileWriteRequest("run_expired", path);
  const decision = {
    id: "policy_run_expired_allow_write",
    tool_request_id: request.id,
    decision: "allow" as const,
    risk_level: "L3" as const,
    reason: "expired lease fixture",
    lease: {
      id: "lease_expired",
      expires_at: "2000-01-01T00:00:00.000Z",
      scope: { paths: [path] }
    }
  };
  await assert.rejects(() => writeLocalFileThroughPolicy(request, decision, "nope"), /expired scoped lease/);
});
