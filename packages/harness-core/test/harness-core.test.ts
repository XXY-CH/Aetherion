import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import {
  appendEvent,
  auditCapsuleRegistryRebuild,
  auditLedgerPayloadRefs,
  auditMemoryRegistryRebuild,
  approveWriteWithConsent,
  auditRegistryProvenance,
  auditReplayRecordRegistryRebuild,
  createFileReadRequest,
  createFileWriteRequest,
  createWriteConsentRecord,
  createTraceReplayRecord,
  createWorkspace,
  eventContentHash,
  eventRecord,
  readEvents,
  evaluateSeedPolicy,
  composeRisk,
  primeSchemaCache,
  readLocalFileThroughPolicy,
  reconstructTrace,
  validateAgainstSchema,
  verifyEventHashChain,
  verifyFileContains,
  writeConsentRecordArtifact,
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
  ["memory-tombstone.schema.json", "memory-tombstone.json"],
  ["memory-patch.schema.json", "memory-patch.json"],
  ["context-pack.schema.json", "context-pack.json"],
  ["capability-capsule.schema.json", "capability-capsule.json"],
  ["capability-package.schema.json", "capability-package.json"],
  ["proactive-opportunity.schema.json", "proactive-opportunity.json"],
  ["replay-record.schema.json", "replay-record.json"],
  ["migration-report.schema.json", "migration-report.json"],
  ["boundary-facts.schema.json", "boundary-facts.json"],
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

  const computerAction = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "computer-action.json"), "utf8"));
  computerAction.adapter_requirements_gate.enabled_by_user_config = true;
  computerAction.approval_keys = [
    "browser-current-tab-cdp:browser:click:https://app.example.com:button.export",
    "browser-current-tab-cdp:browser:click:https://app.example.com:button.export"
  ];
  const computerActionValidation = await validateAgainstSchema(repoRoot, "computer-action.schema.json", computerAction);
  assert.equal(computerActionValidation.valid, false);
  assert.ok(computerActionValidation.errors.some((error) => error.includes("expected one of false")));
  assert.ok(computerActionValidation.errors.some((error) => error.includes("expected unique items")));
});

test("event hash v1 has a fixed cross-language canonical vector", () => {
  const hash = eventContentHash({
    id: "evt_cross_language_001",
    timestamp: "2026-06-07T10:00:00.000Z",
    workspace_id: "ws_cross_language",
    run_id: "run_cross_language",
    event_type: "user.message",
    actor: { type: "user", id: "user_local" },
    summary: "Cross-language hash\nverified",
    hash_version: "aetherion-event-v1",
    payload_ref: "artifact://cross/demo",
    sensitivity: "private",
    taint: {
      sources: ["user", "public_web"],
      can_authorize_actions: true
    },
    retention: {
      ttl: "30d",
      user_deletable: true
    },
    links: ["evt_source"]
  });
  assert.equal(hash, "sha256:d655e8b6de65915bce7c0cccb2eb03aa613fc7a864fcbfab08331499169e1afa");
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

  const readRisk = composeRisk(request);
  const readRiskValidation = await validateAgainstSchema(repoRoot, "risk-composition.schema.json", readRisk);
  assert.equal(readRiskValidation.valid, true, readRiskValidation.errors.join("; "));
  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_read_risk_composed",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "risk.composed",
    actor: { type: "system", id: "risk_composer" },
    summary: `Composed ${readRisk.risk_level} risk for workspace file read.`
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

  assert.ok(decision.lease);
  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_read_lease_issued",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "lease.issued",
    actor: { type: "system", id: "lease_manager" },
    summary: `Issued scoped read lease ${decision.lease.id}.`
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
  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_write_requested",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "tool.requested",
    actor: { type: "agent", id: "agent.local" },
    summary: "Requested workspace file write."
  }));
  const writeRisk = composeRisk(writeRequest);
  const writeRiskValidation = await validateAgainstSchema(repoRoot, "risk-composition.schema.json", writeRisk);
  assert.equal(writeRiskValidation.valid, true, writeRiskValidation.errors.join("; "));
  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_write_risk_composed",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "risk.composed",
    actor: { type: "system", id: "risk_composer" },
    summary: `Composed ${writeRisk.risk_level} risk for workspace file write.`
  }));
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

  const consent = createWriteConsentRecord({
    runId,
    workspaceId: workspace.id,
    toolRequestId: writeRequest.id,
    path: summaryPath,
    approvedAt: "2026-06-05T20:00:01.000Z"
  });
  const consentValidation = await validateAgainstSchema(repoRoot, "consent-record.schema.json", consent);
  assert.equal(consentValidation.valid, true, consentValidation.errors.join("; "));
  const consentRef = await writeConsentRecordArtifact(repoRoot, workspace, runId, consent);
  assert.equal(consentRef, `artifact://consent/${runId}/write`);
  const consentArtifact = JSON.parse(await readFile(join(root, ".aetherion", "artifacts", "consent", runId, `consent_${runId}_write.json`), "utf8"));
  assert.deepEqual(consentArtifact, consent);

  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_consent_recorded",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "consent.recorded",
    actor: { type: "user", id: "user_local" },
    summary: "User approved a workspace-scoped summary file write.",
    payload_ref: consentRef,
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

  assert.ok(writeDecision.lease);
  await appendEvent(repoRoot, workspace, eventRecord({
    id: "evt_contract_write_lease_issued",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "lease.issued",
    actor: { type: "system", id: "lease_manager" },
    summary: `Issued scoped write lease ${writeDecision.lease.id}.`
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
    "risk.composed",
    "policy.decided",
    "lease.issued",
    "tool.result",
    "tool.requested",
    "risk.composed",
    "policy.decided",
    "consent.recorded",
    "policy.decided",
    "lease.issued",
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
  assert.ok(manifest.event_ids.includes("evt_run_phase1_blocked_started"));
  assert.ok(manifest.event_ids.includes("evt_run_phase1_blocked_completed_without_write"));
  const boundaryFacts = JSON.parse(await readFile(join(root, ".aetherion", "artifacts", "boundary", "run_phase1_blocked", "boundary_run_phase1_blocked_facts.json"), "utf8")) as {
    authority: string;
    not_recorded: string[];
    evidence: { ledger_event: string };
    impact: { workspace_file_write_requested: boolean };
  };
  assert.equal(boundaryFacts.authority, "typescript-seed");
  assert.deepEqual(boundaryFacts.not_recorded, ["user_id", "device_id", "channel_id", "secret_vault"]);
  assert.equal(boundaryFacts.evidence.ledger_event, "run.started");
  assert.equal(boundaryFacts.impact.workspace_file_write_requested, true);
  const boundaryValidation = await validateAgainstSchema(repoRoot, "boundary-facts.schema.json", boundaryFacts);
  assert.equal(boundaryValidation.valid, true, boundaryValidation.errors.join("; "));
  await assert.rejects(readFile(join(root, ".aetherion", "artifacts", "consent", "run_phase1_blocked", "consent_run_phase1_blocked_write.json"), "utf8"));
});

test("default run summary does not copy source content in the test-only seed path", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-summary-safe-seed-"));
  await writeFile(join(root, "README.md"), "OPENAI_API_KEY=sk-local-secret\nnormal project note\n");
  const { runLocalKernelLoop, defaultSafeSummary } = await import("../src/index.ts");

  const result = await runLocalKernelLoop({
    repoRoot,
    workspaceRoot: root,
    inputPath: "README.md",
    outputPath: ".aetherion/SUMMARY.md",
    approveWrite: true,
    runId: "run_summary_safe_seed"
  });

  assert.equal(result.verification?.status, "passed");
  const summary = await readFile(join(root, ".aetherion", "SUMMARY.md"), "utf8");
  assert.equal(summary, defaultSafeSummary());
  assert.doesNotMatch(summary, /OPENAI_API_KEY|sk-local-secret|normal project note/);
  const consent = JSON.parse(await readFile(join(root, ".aetherion", "artifacts", "consent", "run_summary_safe_seed", "consent_run_summary_safe_seed_write.json"), "utf8"));
  const consentValidation = await validateAgainstSchema(repoRoot, "consent-record.schema.json", consent);
  assert.equal(consentValidation.valid, true, consentValidation.errors.join("; "));
  assert.equal(consent.tool_request_id, "toolreq_run_summary_safe_seed_write");
  const consentEvent = (await readEvents(result.workspace)).find((event) => event.event_type === "consent.recorded");
  assert.equal(consentEvent?.payload_ref, "artifact://consent/run_summary_safe_seed/write");
});

test("registry provenance audit reports event-reference strength without claiming rebuild parity", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-registry-audit-"));
  await mkdir(join(root, ".aetherion", "registries"), { recursive: true });
  await mkdir(join(root, ".aetherion", "artifacts", "memory", "accept"), { recursive: true });
  await writeFile(join(root, ".aetherion", "artifacts", "memory", "accept", "mem_strong.json"), `${JSON.stringify({ id: "mem_strong" }, null, 2)}\n`);
  await writeFile(join(root, ".aetherion", "registries", "memory-cards.json"), `${JSON.stringify([
    {
      id: "mem_strong",
      source_events: ["evt_source"],
      artifact_ref: "artifact://memory/accept/mem_strong"
    },
    {
      id: "mem_weak",
      completion_evidence: { source_event_ids: ["evt_source", "evt_missing"] }
    },
    {
      id: "mem_missing",
      content: "No event provenance"
    },
    {
      content: "Malformed registry entry without id"
    }
  ], null, 2)}\n`);
  await writeFile(join(root, ".aetherion", "registries", "broken.json"), "{not json");

  const audit = auditRegistryProvenance(root, ["evt_source"]);
  assert.equal(audit.scope.mode, "heuristic_reference_check");
  assert.equal(audit.scope.rebuild_parity_checked, false);
  assert.deepEqual(audit.summary, { registry_count: 2, item_count: 5, strong: 1, weak: 1, missing: 1, invalid: 2 });

  const strong = audit.findings.find((finding) => finding.item_id === "mem_strong");
  assert.equal(strong?.status, "strong");
  assert.deepEqual(strong?.event_ids, ["evt_source"]);
  assert.equal(strong?.artifact_refs[0]?.exists, true);
  assert.equal(strong?.artifact_refs[0]?.item_id_matches, true);

  const weak = audit.findings.find((finding) => finding.item_id === "mem_weak");
  assert.equal(weak?.status, "weak");
  assert.deepEqual(weak?.missing_event_ids, ["evt_missing"]);

  const missing = audit.findings.find((finding) => finding.item_id === "mem_missing");
  assert.equal(missing?.status, "missing");
  assert.deepEqual(missing?.event_ids, []);

  const invalid = audit.findings.find((finding) => finding.item_id === "invalid_entry_3");
  assert.equal(invalid?.status, "invalid");
  assert.equal(invalid?.reason, "registry entry is not an object with a string id");
  const invalidJson = audit.findings.find((finding) => finding.registry === "broken");
  assert.equal(invalidJson?.item_id, "invalid_registry_json");
  assert.equal(invalidJson?.status, "invalid");
});

test("replay registry rebuild audit compares replay artifacts to registry without mutating", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-replay-rebuild-"));
  const artifactDir = join(root, ".aetherion", "artifacts", "replay");
  const registryDir = join(root, ".aetherion", "registries");
  await mkdir(join(artifactDir, "run_matched"), { recursive: true });
  await mkdir(join(artifactDir, "run_missing"), { recursive: true });
  await mkdir(join(artifactDir, "run_mismatch"), { recursive: true });
  await mkdir(join(artifactDir, "run_broken"), { recursive: true });
  await mkdir(registryDir, { recursive: true });

  const matched = replayRecord("replay_run_matched_trace", "run_matched", "matched");
  const missing = replayRecord("replay_run_missing_trace", "run_missing", "missing");
  const mismatchArtifact = replayRecord("replay_run_mismatch_trace", "run_mismatch", "artifact summary");
  const mismatchRegistry = replayRecord("replay_run_mismatch_trace", "run_mismatch", "registry summary");
  const stale = replayRecord("replay_run_stale_trace", "run_stale", "stale");
  await writeFile(join(artifactDir, "run_matched", "replay_run_matched_trace.json"), `${JSON.stringify(matched, null, 2)}\n`);
  await writeFile(join(artifactDir, "run_missing", "replay_run_missing_trace.json"), `${JSON.stringify(missing, null, 2)}\n`);
  await writeFile(join(artifactDir, "run_mismatch", "replay_run_mismatch_trace.json"), `${JSON.stringify(mismatchArtifact, null, 2)}\n`);
  await writeFile(join(artifactDir, "run_broken", "broken.json"), "{not json");
  await writeFile(join(registryDir, "replay-records.json"), `${JSON.stringify([
    matched,
    mismatchRegistry,
    stale,
    { id: "replay_invalid_registry", run_id: "run_invalid" }
  ], null, 2)}\n`);

  const beforeRegistry = await readFile(join(registryDir, "replay-records.json"), "utf8");
  const audit = auditReplayRecordRegistryRebuild(root);
  const byId = new Map(audit.findings.map((finding) => [finding.item_id, finding]));
  assert.equal(audit.scope.mode, "read_only_artifact_rebuild_parity");
  assert.equal(audit.scope.mutates_registry, false);
  assert.deepEqual(audit.summary, {
    expected: 3,
    actual: 3,
    matched: 1,
    missing_registry: 1,
    mismatched: 1,
    stale_registry: 1,
    invalid_artifact: 1,
    invalid_registry: 1
  });
  assert.equal(byId.get("replay_run_matched_trace")?.status, "matched");
  assert.equal(byId.get("replay_run_missing_trace")?.status, "missing_registry");
  assert.equal(byId.get("replay_run_mismatch_trace")?.status, "mismatched");
  assert.equal(byId.get("replay_run_stale_trace")?.status, "stale_registry");
  assert.equal(byId.get("broken")?.status, "invalid_artifact");
  assert.equal(byId.get("replay_invalid_registry")?.status, "invalid_registry");
  assert.deepEqual(audit.expected_items.map((item) => item.id), [
    "replay_run_matched_trace",
    "replay_run_mismatch_trace",
    "replay_run_missing_trace"
  ]);
  assert.equal(await readFile(join(registryDir, "replay-records.json"), "utf8"), beforeRegistry);
});

test("memory registry rebuild audit derives active memory from ledger artifacts without mutating", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-memory-rebuild-"));
  const artifactRoot = join(root, ".aetherion", "artifacts", "memory");
  const registryDir = join(root, ".aetherion", "registries");
  await mkdir(join(artifactRoot, "accept"), { recursive: true });
  await mkdir(join(artifactRoot, "block"), { recursive: true });
  await mkdir(join(artifactRoot, "delete"), { recursive: true });
  await mkdir(registryDir, { recursive: true });

  const accepted = memoryCard("mem_keep", "initial");
  const blocked = { ...accepted, blocked_contexts: ["external_send"] };
  const missing = memoryCard("mem_missing", "missing registry");
  const stale = memoryCard("mem_stale", "stale registry");
  const deleted = memoryCard("mem_deleted", "deleted memory");
  const tombstone = memoryTombstone("tombstone_mem_deleted", "mem_deleted");
  const staleTombstone = memoryTombstone("tombstone_mem_stale", "mem_stale");

  await writeFile(join(artifactRoot, "accept", "mem_keep.json"), `${JSON.stringify(accepted, null, 2)}\n`);
  await writeFile(join(artifactRoot, "block", "mem_keep.json"), `${JSON.stringify(blocked, null, 2)}\n`);
  await writeFile(join(artifactRoot, "accept", "mem_missing.json"), `${JSON.stringify(missing, null, 2)}\n`);
  await writeFile(join(artifactRoot, "accept", "mem_deleted.json"), `${JSON.stringify(deleted, null, 2)}\n`);
  await writeFile(join(artifactRoot, "delete", "tombstone_mem_deleted.json"), `${JSON.stringify(tombstone, null, 2)}\n`);
  await writeFile(join(artifactRoot, "accept", "broken.json"), "{not json");

  await writeFile(join(registryDir, "memory-cards.json"), `${JSON.stringify([
    blocked,
    { ...missing, content: "tampered registry projection" },
    stale,
    { id: "mem_invalid_registry", content: "no source events" }
  ], null, 2)}\n`);
  await writeFile(join(registryDir, "memory-tombstones.json"), `${JSON.stringify([
    tombstone,
    staleTombstone
  ], null, 2)}\n`);

  const beforeCards = await readFile(join(registryDir, "memory-cards.json"), "utf8");
  const events = [
    payloadEvent("evt_mem_accept_keep", "run_mem", "memory.accepted", "artifact://memory/accept/mem_keep"),
    payloadEvent("evt_mem_block_keep", "run_mem", "memory.blocked", "artifact://memory/block/mem_keep"),
    payloadEvent("evt_mem_accept_missing", "run_mem", "memory.accepted", "artifact://memory/accept/mem_missing"),
    payloadEvent("evt_mem_accept_deleted", "run_mem", "memory.accepted", "artifact://memory/accept/mem_deleted"),
    payloadEvent("evt_mem_delete_deleted", "run_mem", "memory.deleted", "artifact://memory/delete/tombstone_mem_deleted"),
    payloadEvent("evt_mem_broken", "run_mem", "memory.accepted", "artifact://memory/accept/broken"),
    payloadEvent("evt_mem_missing_artifact", "run_mem", "memory.accepted", "artifact://memory/accept/mem_no_artifact")
  ];

  const audit = auditMemoryRegistryRebuild(root, events);
  const finding = (itemId: string, status: string) => audit.findings.find((entry) => entry.item_id === itemId && entry.status === status);
  assert.equal(audit.id, "memory_registry_rebuild_audit");
  assert.equal(audit.scope.mode, "read_only_ledger_artifact_rebuild_parity");
  assert.equal(audit.scope.mutates_registry, false);
  assert.deepEqual(audit.summary, {
    expected_memory_cards: 2,
    expected_memory_tombstones: 1,
    actual_memory_cards: 3,
    actual_memory_tombstones: 2,
    matched: 2,
    missing_registry: 0,
    mismatched: 1,
    stale_registry: 2,
    invalid_artifact: 2,
    invalid_registry: 1
  });
  assert.ok(finding("mem_keep", "matched"));
  assert.ok(finding("mem_missing", "mismatched"));
  assert.ok(finding("tombstone_mem_deleted", "matched"));
  assert.ok(finding("mem_stale", "stale_registry"));
  assert.ok(finding("tombstone_mem_stale", "stale_registry"));
  assert.ok(finding("broken", "invalid_artifact"));
  assert.ok(audit.findings.some((entry) => entry.event_id === "evt_mem_missing_artifact" && entry.status === "invalid_artifact"));
  assert.ok(finding("mem_invalid_registry", "invalid_registry"));
  assert.deepEqual(audit.expected_memory_cards.map((item) => item.id), ["mem_keep", "mem_missing"]);
  assert.deepEqual(audit.expected_memory_tombstones.map((item) => item.id), ["tombstone_mem_deleted"]);
  assert.equal(await readFile(join(registryDir, "memory-cards.json"), "utf8"), beforeCards);
});

test("capsule registry rebuild audit derives active capsule projections from lifecycle artifacts without mutating", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-capsule-registry-audit-"));
  const artifactDir = join(root, ".aetherion", "artifacts", "capsule");
  const registryDir = join(root, ".aetherion", "registries");
  await mkdir(join(artifactDir, "draft"), { recursive: true });
  await mkdir(join(artifactDir, "test"), { recursive: true });
  await mkdir(join(artifactDir, "publish"), { recursive: true });
  await mkdir(join(artifactDir, "rollback"), { recursive: true });
  await mkdir(registryDir, { recursive: true });

  const draft010 = capsuleRecord("cap_reader", "0.1.0", "draft");
  const tested010 = capsuleRecord("cap_reader", "0.1.0", "tested");
  const published010 = capsuleRecord("cap_reader", "0.1.0", "published");
  const draft020 = capsuleRecord("cap_reader", "0.2.0", "draft");
  const tested020 = capsuleRecord("cap_reader", "0.2.0", "tested");
  const published020 = capsuleRecord("cap_reader", "0.2.0", "published");
  const activeAfterRollback = {
    ...published010,
    rollback: { previous_version: "0.2.0" }
  };
  const deprecatedAfterRollback = {
    ...published020,
    lifecycle: "deprecated",
    rollback: { previous_version: "0.1.0" }
  };
  await writeFile(join(artifactDir, "draft", "cap_reader_0.1.0.json"), `${JSON.stringify(draft010, null, 2)}\n`);
  await writeFile(join(artifactDir, "test", "cap_reader_0.1.0.json"), `${JSON.stringify(tested010, null, 2)}\n`);
  await writeFile(join(artifactDir, "publish", "cap_reader_0.1.0.json"), `${JSON.stringify(published010, null, 2)}\n`);
  await writeFile(join(artifactDir, "draft", "cap_reader_0.2.0.json"), `${JSON.stringify(draft020, null, 2)}\n`);
  await writeFile(join(artifactDir, "test", "cap_reader_0.2.0.json"), `${JSON.stringify(tested020, null, 2)}\n`);
  await writeFile(join(artifactDir, "publish", "cap_reader_0.2.0.json"), `${JSON.stringify(published020, null, 2)}\n`);
  await writeFile(join(artifactDir, "rollback", "cap_reader_0.2.0_to_0.1.0.json"), `${JSON.stringify({ active: activeAfterRollback, deprecated: deprecatedAfterRollback }, null, 2)}\n`);
  await writeFile(join(artifactDir, "draft", "broken.json"), "{not json");

  const staleDraft = capsuleRecord("cap_stale", "9.9.9", "draft");
  const tamperedDeprecated = {
    ...deprecatedAfterRollback,
    description: "tampered deprecated projection"
  };
  await writeFile(join(registryDir, "capsules.json"), `${JSON.stringify([activeAfterRollback, { id: "cap_invalid" }], null, 2)}\n`);
  await writeFile(join(registryDir, "capsule-drafts.json"), `${JSON.stringify([staleDraft], null, 2)}\n`);
  await writeFile(join(registryDir, "capsule-versions.json"), `${JSON.stringify([
    { id: "capver_cap_reader_0.1.0", capsule: activeAfterRollback },
    { id: "capver_cap_reader_0.2.0", capsule: tamperedDeprecated }
  ], null, 2)}\n`);
  const beforeDrafts = await readFile(join(registryDir, "capsule-drafts.json"), "utf8");
  const events = [
    payloadEvent("evt_cap_draft_010", "run_cap", "capsule.draft.recorded", "artifact://capsule/draft/cap_reader_0.1.0"),
    payloadEvent("evt_cap_test_010", "run_cap", "capsule.test.recorded", "artifact://capsule/test/cap_reader_0.1.0"),
    payloadEvent("evt_cap_publish_010", "run_cap", "capsule.publish.recorded", "artifact://capsule/publish/cap_reader_0.1.0"),
    payloadEvent("evt_cap_draft_020", "run_cap", "capsule.draft.recorded", "artifact://capsule/draft/cap_reader_0.2.0"),
    payloadEvent("evt_cap_test_020", "run_cap", "capsule.test.recorded", "artifact://capsule/test/cap_reader_0.2.0"),
    payloadEvent("evt_cap_publish_020", "run_cap", "capsule.publish.recorded", "artifact://capsule/publish/cap_reader_0.2.0"),
    payloadEvent("evt_cap_rollback", "run_cap", "capsule.rollback.recorded", "artifact://capsule/rollback/cap_reader_0.2.0_to_0.1.0"),
    payloadEvent("evt_cap_broken", "run_cap", "capsule.draft.recorded", "artifact://capsule/draft/broken")
  ];

  const audit = auditCapsuleRegistryRebuild(root, events);
  const finding = (itemId: string, status: string) => audit.findings.find((entry) => entry.item_id === itemId && entry.status === status);
  assert.equal(audit.id, "capsule_registry_rebuild_audit");
  assert.equal(audit.scope.mode, "read_only_ledger_artifact_rebuild_parity");
  assert.equal(audit.scope.mutates_registry, false);
  assert.deepEqual(audit.summary, {
    expected_capsules: 1,
    expected_capsule_drafts: 0,
    expected_capsule_versions: 2,
    actual_capsules: 1,
    actual_capsule_drafts: 1,
    actual_capsule_versions: 2,
    matched: 2,
    missing_registry: 0,
    mismatched: 1,
    stale_registry: 1,
    invalid_artifact: 1,
    invalid_registry: 1
  });
  assert.ok(finding("cap_reader", "matched"));
  assert.ok(finding("capver_cap_reader_0.1.0", "matched"));
  assert.ok(finding("capver_cap_reader_0.2.0", "mismatched"));
  assert.ok(finding("cap_stale", "stale_registry"));
  assert.ok(finding("broken", "invalid_artifact"));
  assert.ok(finding("cap_invalid", "invalid_registry"));
  assert.deepEqual(audit.expected_capsules.map((item) => item.id), ["cap_reader"]);
  assert.deepEqual(audit.expected_capsule_drafts, []);
  assert.deepEqual(audit.expected_capsule_versions.map((item) => item.id), ["capver_cap_reader_0.1.0", "capver_cap_reader_0.2.0"]);
  assert.equal(await readFile(join(registryDir, "capsule-drafts.json"), "utf8"), beforeDrafts);
});

test("ledger payload-ref audit resolves local artifact refs without mutating", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-payload-ref-audit-"));
  const boundaryDir = join(root, ".aetherion", "artifacts", "boundary", "run_payload_resolved");
  const invalidSchemaBoundaryDir = join(root, ".aetherion", "artifacts", "boundary", "run_payload_schema_invalid");
  const consentDir = join(root, ".aetherion", "artifacts", "consent", "run_payload_resolved");
  const genericDir = join(root, ".aetherion", "artifacts", "capsule", "draft");
  const invalidDir = join(root, ".aetherion", "artifacts", "capsule", "test");
  await mkdir(boundaryDir, { recursive: true });
  await mkdir(invalidSchemaBoundaryDir, { recursive: true });
  await mkdir(consentDir, { recursive: true });
  await mkdir(genericDir, { recursive: true });
  await mkdir(invalidDir, { recursive: true });
  await writeFile(join(boundaryDir, "boundary_run_payload_resolved_facts.json"), `${JSON.stringify(boundaryFactsFixture("run_payload_resolved"), null, 2)}\n`);
  await writeFile(join(invalidSchemaBoundaryDir, "boundary_run_payload_schema_invalid_facts.json"), `${JSON.stringify({ id: "boundary_run_payload_schema_invalid_facts" }, null, 2)}\n`);
  await writeFile(join(consentDir, "consent_run_payload_resolved_write.json"), `${JSON.stringify(consentRecordFixture("run_payload_resolved"), null, 2)}\n`);
  await writeFile(join(genericDir, "capsule_a.json"), `${JSON.stringify({ id: "capsule_a" }, null, 2)}\n`);
  await writeFile(join(invalidDir, "broken.json"), "{not json");

  const beforeBoundary = await readFile(join(boundaryDir, "boundary_run_payload_resolved_facts.json"), "utf8");
  const events = [
    payloadEvent("evt_payload_boundary", "run_payload_resolved", "run.started", "artifact://boundary/run_payload_resolved/facts"),
    payloadEvent("evt_payload_consent", "run_payload_resolved", "consent.recorded", "artifact://consent/run_payload_resolved/write"),
    payloadEvent("evt_payload_generic", "run_payload_resolved", "capsule.draft.recorded", "artifact://capsule/draft/capsule_a"),
    payloadEvent("evt_payload_schema_invalid", "run_payload_schema_invalid", "run.started", "artifact://boundary/run_payload_schema_invalid/facts"),
    payloadEvent("evt_payload_missing", "run_payload_missing", "consent.recorded", "artifact://consent/run_payload_missing/write"),
    payloadEvent("evt_payload_invalid", "run_payload_invalid", "capsule.test.recorded", "artifact://capsule/test/broken"),
    payloadEvent("evt_payload_unresolved", "run_payload_external", "artifact.recorded", "vault://external/payload")
  ];

  const audit = await auditLedgerPayloadRefs(repoRoot, root, events);
  const byId = new Map(audit.findings.map((finding) => [finding.event_id, finding]));
  assert.equal(audit.scope.mode, "read_only_ledger_payload_ref_resolution");
  assert.equal(audit.scope.mutates_ledger, false);
  assert.equal(audit.scope.mutates_artifacts, false);
  assert.deepEqual(audit.summary, {
    events_with_payload_ref: 7,
    resolved: 4,
    missing: 1,
    invalid_json: 1,
    unresolved: 1,
    schema_valid: 2,
    schema_invalid: 1,
    schema_not_checked: 4
  });
  assert.equal(byId.get("evt_payload_boundary")?.status, "resolved");
  assert.equal(byId.get("evt_payload_boundary")?.resolved_path, join(boundaryDir, "boundary_run_payload_resolved_facts.json"));
  assert.equal(byId.get("evt_payload_boundary")?.schema_name, "boundary-facts.schema.json");
  assert.equal(byId.get("evt_payload_boundary")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_consent")?.status, "resolved");
  assert.equal(byId.get("evt_payload_consent")?.schema_name, "consent-record.schema.json");
  assert.equal(byId.get("evt_payload_consent")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_generic")?.status, "resolved");
  assert.equal(byId.get("evt_payload_generic")?.schema_status, "not_checked");
  assert.equal(byId.get("evt_payload_schema_invalid")?.status, "resolved");
  assert.equal(byId.get("evt_payload_schema_invalid")?.schema_status, "invalid");
  assert.ok(byId.get("evt_payload_schema_invalid")?.schema_errors.some((error) => error.includes("missing required property")));
  assert.equal(byId.get("evt_payload_missing")?.status, "missing");
  assert.equal(byId.get("evt_payload_invalid")?.status, "invalid_json");
  assert.equal(byId.get("evt_payload_unresolved")?.status, "unresolved");
  assert.equal(await readFile(join(boundaryDir, "boundary_run_payload_resolved_facts.json"), "utf8"), beforeBoundary);
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

function replayRecord(id: string, runId: string, summary: string) {
  return {
    id,
    run_id: runId,
    mode: "trace" as const,
    source_events: [`evt_${runId}`],
    artifact_ref: `artifact://replay/${runId}/trace`,
    live_side_effects: {
      allowed: false,
      approval_id: null
    },
    result: {
      status: "passed" as const,
      summary
    }
  };
}

function memoryCard(id: string, content: string) {
  return {
    id,
    type: "project",
    subject: "run_mem",
    content,
    source_events: [`evt_source_${id}`],
    confidence: 0.9,
    sensitivity: "private",
    blocked_contexts: []
  };
}

function memoryTombstone(id: string, targetMemoryId: string) {
  return {
    id,
    event_type: "memory.deleted" as const,
    target_memory_id: targetMemoryId,
    source_events: [`evt_source_${targetMemoryId}`],
    reason: "test_delete",
    created_at: "2026-06-07T10:00:00.000Z",
    active_memory_removed: true,
    history_rewritten: false,
    redaction_status: "tombstone_only"
  };
}

function capsuleRecord(id: string, version: string, lifecycle: string) {
  return {
    id,
    version,
    description: `Capsule ${id}@${version}`,
    playbook: "playbooks/local-read.md",
    execution_mode: "document_only",
    permission_requirements: {
      required_tools: ["filesystem.read"],
      forbidden_tools: ["filesystem.write"]
    },
    tool_contracts: ["tool-request.schema.json"],
    risk_level: "L1",
    lifecycle,
    sandbox_required: true,
    permissions_inherited: false,
    permission_diff: {
      added_tools: ["filesystem.read"],
      removed_tools: [],
      requires_approval: true
    },
    replay_tests: lifecycle === "draft" ? [] : [
      {
        run_id: "run_cap_source_a",
        replay_record_id: "replay_a",
        status: "passed",
        source_events: ["evt_cap_source_a"]
      },
      {
        run_id: "run_cap_source_b",
        replay_record_id: "replay_b",
        status: "passed",
        source_events: ["evt_cap_source_b"]
      }
    ],
    sandbox_trial: lifecycle === "draft" ? null : {
      status: "passed",
      sandbox_path: `.aetherion/capsules/trials/${id}/${version}/playbook.md`,
      content_sha256: "sha256-demo",
      forbidden_pattern_matches: []
    },
    approval: {
      required: true,
      status: lifecycle === "published" || lifecycle === "deprecated" ? "approved" : "pending",
      approval_card_id: lifecycle === "published" || lifecycle === "deprecated" ? `approval_${id}_${version}` : null
    },
    integrity: lifecycle === "draft" ? null : {
      algorithm: "sha256",
      digest: `digest-${id}-${version}`
    },
    publication_scope: lifecycle === "published" || lifecycle === "deprecated" ? "local_unsigned" : "not_published",
    rollback: {
      previous_version: null
    },
    provenance: {
      source_events: ["evt_cap_source_a", "evt_cap_source_b"],
      source_tasks: ["run_cap_source_a", "run_cap_source_b"]
    },
    legacy_source: null,
    evals: ["trace_replay"],
    scoring_summary: {
      success: 0,
      correction: 0,
      tool_error: 0,
      policy_denial: 0
    }
  };
}

function payloadEvent(id: string, runId: string, eventType: string, payloadRef: string) {
  return eventRecord({
    id,
    workspace_id: "ws_payload_ref_audit",
    run_id: runId,
    event_type: eventType,
    actor: { type: "system", id: "payload_ref_auditor_fixture" },
    summary: `Payload ref fixture ${payloadRef}.`,
    payload_ref: payloadRef
  });
}

function boundaryFactsFixture(runId: string) {
  return {
    id: `boundary_${runId}_facts`,
    run_id: runId,
    workspace_id: "ws_payload_ref_audit",
    recorded_at: "2026-06-07T10:00:00.000Z",
    entry_surface: "tui",
    authority: "rust-supervisor",
    known_facts: ["run_id", "workspace_id", "entry_surface", "authority"],
    not_recorded: ["user_id", "device_id", "channel_id", "secret_vault"],
    limits: {
      full_user_identity: false,
      device_pairing: false,
      remote_channel_identity: false,
      secret_vault_backend: false
    },
    impact: {
      memory_candidate_created: false,
      user_model_updated: false,
      capability_changed: false,
      runtime_permissions_changed: false,
      external_delivery_attempted: false,
      browser_automation_attempted: false,
      connector_called: false,
      package_code_executed: false,
      workspace_file_write_requested: true
    },
    evidence: {
      run_manifest: "recorded",
      workspace_registry: "recorded",
      ledger_event: "run.started"
    }
  };
}

function consentRecordFixture(runId: string) {
  return {
    id: `consent_${runId}_write`,
    user_id: "user_local",
    workspace_id: "ws_payload_ref_audit",
    tool_request_id: `toolreq_${runId}_write`,
    decision: "approved",
    risk_level: "L3",
    approved_at: "2026-06-07T10:00:00.000Z",
    expires_at: null,
    scope: {
      actions: ["write"],
      paths: ["README.md"]
    }
  };
}
