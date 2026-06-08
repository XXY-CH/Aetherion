import assert from "node:assert/strict";
import { createServer } from "node:net";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  callSupervisorRpc,
  canonicalLedgerPath,
  canonicalRuntimeDir,
  completeRunManifest,
  completeRunManifestWithEventSequence,
  createFileReadRequest,
  createFileWriteRequest,
  createRunManifest,
  createWriteConsentRecord,
  createTraceReplayRecord,
  createWorkspace,
  eventContentHash,
  eventRecord,
  KERNEL_FILE_RUN_APPROVED_EVENT_TYPES,
  loadRunManifest,
  loadWorkspaceFromRegistry,
  readEvents,
  REPLAY_RECORD_RUN_EVENT_TYPES,
  evaluateSeedPolicy,
  composeRisk,
  primeSchemaCache,
  readLocalFileThroughPolicy,
  recordRunEvent,
  reconstructTrace,
  replayRecordRunEventSequence,
  validateAgainstSchema,
  verifyEventHashChain,
  verifyFileContains,
  WAKEUP_QUEUE_RUN_EVENT_TYPES,
  wakeupQueueRunEventSequence,
  writeConsentRecordArtifact,
  writeLocalFileThroughPolicy,
  workspaceIdForRoot,
  workspaceRegistryPath,
  writeWorkspaceRegistry
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
  ["capsule-rollback.schema.json", "capsule-rollback.json"],
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

test("event hash v1 has a fixed cross-language canonical vector", async () => {
  const fixture = JSON.parse(await readFile(join(repoRoot, "fixtures", "event-hash-v1.json"), "utf8")) as {
    expected_hash: string;
    event: Parameters<typeof eventContentHash>[0];
  };
  assert.equal(fixture.event.event_hash, fixture.expected_hash);
  assert.equal(eventContentHash(fixture.event), fixture.expected_hash);
});

test("supervisor RPC client rejects mismatched response ids", async () => {
  if (process.platform === "win32") {
    return;
  }
  const socketPath = join(tmpdir(), `aeth-rpc-id-${process.pid}-${Date.now()}.sock`);
  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    socket.on("data", () => {
      socket.end("{\"jsonrpc\":\"2.0\",\"id\":\"rpc_wrong\",\"result\":{\"accepted\":true}}\n");
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  try {
    await assert.rejects(
      callSupervisorRpc(repoRoot, {
        id: "rpc_expected",
        method: "supervisor.status",
        workspace_root: "/tmp/aetherion-rpc-id-test",
        workspace_id: "ws_rpc_id_test",
        run_id: "run_rpc_id_test"
      }, { socketPath }),
      /response id mismatch: expected rpc_expected, got rpc_wrong/
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(socketPath, { force: true });
  }
});

test("supervisor socket run sends approved write commit over the supplied socket", async () => {
  if (process.platform === "win32") {
    return;
  }
  const { runSupervisorKernelLoop } = await import("../src/index.ts");
  const workspaceRoot = await mkdtemp(join(tmpdir(), "aetherion-socket-commit-transport-"));
  const workspaceId = workspaceIdForRoot(workspaceRoot);
  const runId = "run_socket_commit_transport";
  const socketPath = join(tmpdir(), `aeth-socket-commit-${process.pid}-${Date.now()}.sock`);
  await writeFile(join(workspaceRoot, "README.md"), "Socket commit transport fixture\n");
  const workspace = await createWorkspace(workspaceRoot, workspaceId);
  await writeWorkspaceRegistry(repoRoot, workspace, "rust-supervisor");
  const received: Array<{ method: string; auth_token?: string }> = [];
  const server = createServer({ allowHalfOpen: true }, (socket) => {
    socket.setEncoding("utf8");
    let requestText = "";
    let responded = false;
    socket.on("data", async (chunk) => {
      requestText += chunk;
      if (responded || !requestText.includes("\n")) {
        return;
      }
      responded = true;
      const request = JSON.parse(requestText.trim()) as {
        id: string;
        method: string;
        auth_token?: string;
        event_type?: string;
        summary?: string;
        payload_ref?: string;
      };
      received.push({ method: request.method, auth_token: request.auth_token });
      if (request.auth_token !== "commit-token") {
        socket.end(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, error: "socket RPC auth failed" })}\n`);
        return;
      }
      try {
        const result = await socketRunShimResult(workspace, request, runId);
        socket.end(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, result })}\n`);
      } catch (error) {
        socket.end(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, error: error instanceof Error ? error.message : String(error) })}\n`);
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  try {
    const result = await runSupervisorKernelLoop({
      repoRoot,
      workspaceRoot,
      runId,
      inputPath: "README.md",
      outputPath: ".aetherion/SUMMARY.md",
      approveWrite: true,
      socketPath,
      socketAuthToken: "commit-token"
    });
    assert.equal(result.supervisor, "socket");
    assert.equal(result.verification?.status, "passed");
    assert.equal(received.filter((request) => request.method === "file.write.commit").length, 1);
    assert.ok(received.every((request) => request.auth_token === "commit-token"), JSON.stringify(received));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(socketPath, { force: true });
  }
});

test("completed kernel file run manifests require the full action lifecycle sequence", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-lifecycle-guard-"));
  const workspace = await createWorkspace(root, "ws_lifecycle_guard");
  const runId = "run_lifecycle_guard";
  const manifest = await createRunManifest(repoRoot, workspace, runId, "Incomplete kernel file run");
  const started = eventRecord({
    id: "evt_lifecycle_guard_started",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "run.started",
    actor: { type: "system", id: "test" },
    summary: "Started incomplete kernel file run."
  });
  await appendEvent(repoRoot, workspace, started);
  await recordRunEvent(repoRoot, workspace, manifest, started.id);

  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "completed", KERNEL_FILE_RUN_APPROVED_EVENT_TYPES),
    /cannot complete as completed/
  );
  const persisted = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${runId}.json`), "utf8")) as { status: string; completed_at: string | null };
  assert.equal(manifest.status, "running");
  assert.equal(manifest.completed_at, null);
  assert.equal(persisted.status, "running");
  assert.equal(persisted.completed_at, null);
});

test("completed replay run manifests require a replay recorded event", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-replay-lifecycle-"));
  const workspace = await createWorkspace(root, "ws_replay_lifecycle_guard");
  const wrongRunId = "run_replay_wrong_lifecycle";
  const wrongManifest = await createRunManifest(repoRoot, workspace, wrongRunId, "Wrong replay lifecycle");
  const wrongEvent = eventRecord({
    id: "evt_replay_wrong_started",
    workspace_id: workspace.id,
    run_id: wrongRunId,
    event_type: "run.started",
    actor: { type: "system", id: "test" },
    summary: "Wrongly started replay run."
  });
  await appendEvent(repoRoot, workspace, wrongEvent);
  await recordRunEvent(repoRoot, workspace, wrongManifest, wrongEvent.id);

  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, wrongManifest, "completed", REPLAY_RECORD_RUN_EVENT_TYPES),
    /expected lifecycle replay\.recorded, got run\.started/
  );

  const wrongRefRunId = "run_replay_wrong_payload_ref";
  const wrongRefManifest = await createRunManifest(repoRoot, workspace, wrongRefRunId, "Wrong replay payload ref");
  const wrongRefEvent = eventRecord({
    id: "evt_replay_wrong_payload_ref",
    workspace_id: workspace.id,
    run_id: wrongRefRunId,
    event_type: "replay.recorded",
    actor: { type: "system", id: "test" },
    summary: "Recorded replay evidence with the wrong artifact ref.",
    payload_ref: "artifact://replay/run_other/trace"
  });
  await appendEvent(repoRoot, workspace, wrongRefEvent);
  await recordRunEvent(repoRoot, workspace, wrongRefManifest, wrongRefEvent.id);
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, wrongRefManifest, "completed", replayRecordRunEventSequence("artifact://replay/run_source/trace")),
    /expected payload_ref artifact:\/\/replay\/run_source\/trace, got artifact:\/\/replay\/run_other\/trace/
  );
  const wrongRefPersisted = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${wrongRefRunId}.json`), "utf8")) as { status: string; completed_at: string | null };
  assert.equal(wrongRefPersisted.status, "running");
  assert.equal(wrongRefPersisted.completed_at, null);

  const replayRunId = "run_replay_lifecycle_guard";
  const replayManifest = await createRunManifest(repoRoot, workspace, replayRunId, "Replay lifecycle guard");
  const replayEvent = eventRecord({
    id: "evt_replay_lifecycle_recorded",
    workspace_id: workspace.id,
    run_id: replayRunId,
    event_type: "replay.recorded",
    actor: { type: "system", id: "test" },
    summary: "Recorded replay evidence.",
    payload_ref: "artifact://replay/run_source/trace"
  });
  await appendEvent(repoRoot, workspace, replayEvent);
  await recordRunEvent(repoRoot, workspace, replayManifest, replayEvent.id);
  await completeRunManifestWithEventSequence(repoRoot, workspace, replayManifest, "completed", replayRecordRunEventSequence("artifact://replay/run_source/trace"));

  const completed = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${replayRunId}.json`), "utf8")) as { status: string; event_ids: string[] };
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.event_ids, [replayEvent.id]);
});

test("queue-only wakeup run manifests reject payload refs and lease events", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-wakeup-lifecycle-"));
  const workspace = await createWorkspace(root, "ws_wakeup_lifecycle_guard");

  const wrongPayloadRunId = "run_wakeup_wrong_payload";
  const wrongPayloadManifest = await createRunManifest(repoRoot, workspace, wrongPayloadRunId, "Wakeup lifecycle payload guard");
  const wrongPayloadPolicy = eventRecord({
    id: "evt_wakeup_wrong_payload_policy",
    workspace_id: workspace.id,
    run_id: wrongPayloadRunId,
    event_type: "policy.decided",
    actor: { type: "system", id: "test" },
    summary: "Incorrectly attached authority-shaped evidence to a queue-only wakeup.",
    payload_ref: "artifact://lease/not_allowed"
  });
  const wrongPayloadQueued = eventRecord({
    id: "evt_wakeup_wrong_payload_queued",
    workspace_id: workspace.id,
    run_id: wrongPayloadRunId,
    event_type: "wakeup.queued",
    actor: { type: "system", id: "test" },
    summary: "Queued a wakeup."
  });
  await appendEvent(repoRoot, workspace, wrongPayloadPolicy);
  await appendEvent(repoRoot, workspace, wrongPayloadQueued);
  await recordRunEvent(repoRoot, workspace, wrongPayloadManifest, wrongPayloadPolicy.id);
  await recordRunEvent(repoRoot, workspace, wrongPayloadManifest, wrongPayloadQueued.id);
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, wrongPayloadManifest, "blocked", wakeupQueueRunEventSequence()),
    /expected no payload_ref, got artifact:\/\/lease\/not_allowed/
  );

  const leaseRunId = "run_wakeup_with_lease";
  const leaseManifest = await createRunManifest(repoRoot, workspace, leaseRunId, "Wakeup lifecycle lease guard");
  for (const event of [
    eventRecord({
      id: "evt_wakeup_lease_policy",
      workspace_id: workspace.id,
      run_id: leaseRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Fresh queue-only policy."
    }),
    eventRecord({
      id: "evt_wakeup_lease_issued",
      workspace_id: workspace.id,
      run_id: leaseRunId,
      event_type: "lease.issued",
      actor: { type: "system", id: "test" },
      summary: "Lease issuance is not allowed for wakeup evaluation."
    }),
    eventRecord({
      id: "evt_wakeup_lease_queued",
      workspace_id: workspace.id,
      run_id: leaseRunId,
      event_type: "wakeup.queued",
      actor: { type: "system", id: "test" },
      summary: "Queued a wakeup."
    })
  ]) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, leaseManifest, event.id);
  }
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, leaseManifest, "blocked", wakeupQueueRunEventSequence()),
    /expected lifecycle policy\.decided -> wakeup\.queued, got policy\.decided -> lease\.issued -> wakeup\.queued/
  );

  const validRunId = "run_wakeup_lifecycle_guard";
  const validManifest = await createRunManifest(repoRoot, workspace, validRunId, "Wakeup lifecycle guard");
  const validEvents = WAKEUP_QUEUE_RUN_EVENT_TYPES.map((eventType, index) => eventRecord({
    id: `evt_wakeup_lifecycle_${index}`,
    workspace_id: workspace.id,
    run_id: validRunId,
    event_type: eventType,
    actor: { type: "system", id: "test" },
    summary: eventType === "policy.decided" ? "Fresh queue-only policy." : "Queued wakeup without action."
  }));
  for (const event of validEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, validManifest, event.id);
  }
  await completeRunManifestWithEventSequence(repoRoot, workspace, validManifest, "blocked", wakeupQueueRunEventSequence());

  const completed = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${validRunId}.json`), "utf8")) as { status: string; event_ids: string[] };
  assert.equal(completed.status, "blocked");
  assert.deepEqual(completed.event_ids, validEvents.map((event) => event.id));
});

test("run manifest event ids are recorded as the next Ledger event projection", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-run-projection-"));
  const workspace = await createWorkspace(root, "ws_run_projection");
  const runId = "run_projection_guard";
  const manifest = await createRunManifest(repoRoot, workspace, runId, "Run manifest projection guard");

  await assert.rejects(
    recordRunEvent(repoRoot, workspace, manifest, "evt_projection_missing"),
    /has no unrecorded Ledger event/
  );

  const started = eventRecord({
    id: "evt_projection_started",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "run.started",
    actor: { type: "system", id: "test" },
    summary: "Started projection-guarded run."
  });
  const requested = eventRecord({
    id: "evt_projection_requested",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "tool.requested",
    actor: { type: "agent", id: "test" },
    summary: "Requested a projection-guarded action."
  });
  await appendEvent(repoRoot, workspace, started);
  await appendEvent(repoRoot, workspace, requested);

  await assert.rejects(
    recordRunEvent(repoRoot, workspace, manifest, requested.id),
    /expected next Ledger event evt_projection_started, got evt_projection_requested/
  );

  await recordRunEvent(repoRoot, workspace, manifest, started.id);
  await assert.rejects(
    recordRunEvent(repoRoot, workspace, manifest, started.id),
    /expected next Ledger event evt_projection_requested, got evt_projection_started/
  );

  manifest.event_ids[0] = "evt_projection_tampered";
  await assert.rejects(
    recordRunEvent(repoRoot, workspace, manifest, requested.id),
    /event ids do not match Ledger prefix/
  );
});

test("terminal run manifests must project every Ledger event for the run", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-terminal-projection-"));
  const workspace = await createWorkspace(root, "ws_terminal_projection");
  const runId = "run_terminal_projection";
  const manifest = await createRunManifest(repoRoot, workspace, runId, "Terminal manifest projection guard");
  const started = eventRecord({
    id: "evt_terminal_projection_started",
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "run.started",
    actor: { type: "system", id: "test" },
    summary: "Started terminal projection-guarded run."
  });
  await appendEvent(repoRoot, workspace, started);

  await assert.rejects(
    completeRunManifest(repoRoot, workspace, manifest, "completed"),
    /event ids do not match Ledger order/
  );
  const stillRunning = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${runId}.json`), "utf8")) as { status: string; completed_at: string | null };
  assert.equal(manifest.status, "running");
  assert.equal(manifest.completed_at, null);
  assert.equal(stillRunning.status, "running");
  assert.equal(stillRunning.completed_at, null);

  await recordRunEvent(repoRoot, workspace, manifest, started.id);
  await completeRunManifest(repoRoot, workspace, manifest, "completed");
  const completed = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${runId}.json`), "utf8")) as { status: string; completed_at: string | null; event_ids: string[] };
  assert.equal(completed.status, "completed");
  assert.ok(completed.completed_at);
  assert.deepEqual(completed.event_ids, [started.id]);
});

test("run manifest creation refuses to overwrite an existing projection", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-create-manifest-guard-"));
  const workspace = await createWorkspace(root, "ws_create_manifest_guard");
  const runId = "run_create_manifest_guard";
  await createRunManifest(repoRoot, workspace, runId, "Original manifest summary");

  await assert.rejects(
    createRunManifest(repoRoot, workspace, runId, "Replacement manifest summary"),
    /Run manifest run_create_manifest_guard already exists/
  );
  const persisted = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${runId}.json`), "utf8")) as { summary: string; event_ids: string[] };
  assert.equal(persisted.summary, "Original manifest summary");
  assert.deepEqual(persisted.event_ids, []);
});

test("loaded run manifests must match the requested run and workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-load-manifest-guard-"));
  const workspace = await createWorkspace(root, "ws_load_manifest_guard");
  const runId = "run_load_manifest_guard";
  const manifest = await createRunManifest(repoRoot, workspace, runId, "Load manifest guard");
  const manifestPath = join(root, ".aetherion", "runs", `${runId}.json`);

  await writeFile(manifestPath, `${JSON.stringify({ ...manifest, id: "run_other_manifest" }, null, 2)}\n`);
  await assert.rejects(
    loadRunManifest(workspace, runId),
    /Run manifest file run_load_manifest_guard contains manifest run_other_manifest/
  );

  await writeFile(manifestPath, `${JSON.stringify({ ...manifest, workspace_id: "ws_other_workspace" }, null, 2)}\n`);
  await assert.rejects(
    loadRunManifest(workspace, runId),
    /Run manifest run_load_manifest_guard belongs to workspace ws_other_workspace, not ws_load_manifest_guard/
  );
});

test("workspace registry load rejects identity and path drift", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-workspace-registry-guard-"));
  const workspace = await createWorkspace(root, workspaceIdForRoot(root));
  const registry = await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  const registryPath = workspaceRegistryPath(workspace);

  const loaded = await loadWorkspaceFromRegistry(root);
  assert.equal(loaded.workspace.id, workspaceIdForRoot(root));
  assert.equal(loaded.workspace.runtimeDir, canonicalRuntimeDir(root));
  assert.equal(loaded.workspace.ledgerPath, canonicalLedgerPath(root));

  const withoutLedgerPath = { ...registry } as Partial<typeof registry>;
  delete withoutLedgerPath.ledger_path;
  const missingLedgerValidation = await validateAgainstSchema(repoRoot, "workspace-registry.schema.json", withoutLedgerPath);
  assert.equal(missingLedgerValidation.valid, false);
  assert.ok(missingLedgerValidation.errors.some((error) => error.includes("$.ledger_path: missing required property")));

  for (const tamper of [
    {
      value: { ...registry, id: "ws_tampered" },
      message: /Workspace registry id mismatch: ws_tampered/
    },
    {
      value: { ...registry, runtime_dir: join(root, ".aetherion-other") },
      message: /Workspace registry runtime_dir mismatch:/
    },
    {
      value: { ...registry, ledger_path: join(root, ".aetherion-other", "events.jsonl") },
      message: /Workspace registry ledger_path mismatch:/
    },
    {
      value: withoutLedgerPath,
      message: /Workspace registry ledger_path missing or invalid/
    }
  ]) {
    await writeFile(registryPath, `${JSON.stringify(tamper.value, null, 2)}\n`);
    await assert.rejects(loadWorkspaceFromRegistry(root), tamper.message);
  }
});

test("kernel loops reject workspace ids that do not match the resolved root", async () => {
  const { runLocalKernelLoop, runSupervisorKernelLoop } = await import("../src/index.ts");
  const localRoot = await mkdtemp(join(tmpdir(), "aetherion-local-identity-guard-"));
  const supervisorRoot = await mkdtemp(join(tmpdir(), "aetherion-supervisor-identity-guard-"));

  await assert.rejects(
    runLocalKernelLoop({
      repoRoot,
      workspaceRoot: localRoot,
      workspaceId: "ws_wrong",
      inputPath: "README.md",
      outputPath: ".aetherion/SUMMARY.md",
      approveWrite: false,
      runId: "run_wrong_local_workspace"
    }),
    /Workspace id ws_wrong does not match resolved root identity ws_/
  );

  await assert.rejects(
    runSupervisorKernelLoop({
      repoRoot,
      workspaceRoot: supervisorRoot,
      workspaceId: "ws_wrong",
      inputPath: "README.md",
      outputPath: ".aetherion/SUMMARY.md",
      approveWrite: false,
      runId: "run_wrong_supervisor_workspace"
    }),
    /Workspace id ws_wrong does not match resolved root identity ws_/
  );

  await assert.rejects(readFile(join(localRoot, ".aetherion", "workspace.json"), "utf8"));
  await assert.rejects(readFile(join(supervisorRoot, ".aetherion", "workspace.json"), "utf8"));
});

test("run manifest event projection rejects workspace-mismatched Ledger entries", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-run-workspace-guard-"));
  const workspace = await createWorkspace(root, "ws_run_workspace_guard");
  const runId = "run_workspace_guard";
  const manifest = await createRunManifest(repoRoot, workspace, runId, "Run workspace guard");
  const mismatchedWorkspaceEvent = eventRecord({
    id: "evt_workspace_guard_started",
    workspace_id: "ws_other_workspace",
    run_id: runId,
    event_type: "run.started",
    actor: { type: "system", id: "test" },
    summary: "Started run under a mismatched workspace id."
  });
  await appendEvent(repoRoot, workspace, mismatchedWorkspaceEvent);

  await assert.rejects(
    recordRunEvent(repoRoot, workspace, manifest, mismatchedWorkspaceEvent.id),
    /belongs to workspace ws_other_workspace, not ws_run_workspace_guard/
  );

  manifest.event_ids.push(mismatchedWorkspaceEvent.id);
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "completed", ["run.started"]),
    /event evt_workspace_guard_started belongs to workspace ws_other_workspace, not ws_run_workspace_guard/
  );

  manifest.workspace_id = "ws_other_workspace";
  await assert.rejects(
    recordRunEvent(repoRoot, workspace, manifest, mismatchedWorkspaceEvent.id),
    /Run manifest run_workspace_guard belongs to workspace ws_other_workspace, not ws_run_workspace_guard/
  );
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
  const memoryCandidatesDir = join(root, ".aetherion", "artifacts", "memory", "candidates");
  const memoryAcceptDir = join(root, ".aetherion", "artifacts", "memory", "accept");
  const memoryRejectDir = join(root, ".aetherion", "artifacts", "memory", "reject");
  const memoryBlockDir = join(root, ".aetherion", "artifacts", "memory", "block");
  const memoryDeleteDir = join(root, ".aetherion", "artifacts", "memory", "delete");
  const securityScanDir = join(root, ".aetherion", "artifacts", "security", "scan");
  const securityAckDir = join(root, ".aetherion", "artifacts", "security", "ack");
  const securityTrialDir = join(root, ".aetherion", "artifacts", "security", "trial");
  const securityFixtureDir = join(root, ".aetherion", "artifacts", "security", "fixture");
  const surfaceBrowserDir = join(root, ".aetherion", "artifacts", "surface", "browser-observe");
  const surfaceInboxDir = join(root, ".aetherion", "artifacts", "surface", "im-inbox");
  const surfaceOutboxDir = join(root, ".aetherion", "artifacts", "surface", "im-outbox");
  const storeInstallDir = join(root, ".aetherion", "artifacts", "store", "install");
  const capsuleRollbackDir = join(root, ".aetherion", "artifacts", "capsule", "rollback");
  const dreamRunDir = join(root, ".aetherion", "artifacts", "dream", "run");
  const dreamAcceptDir = join(root, ".aetherion", "artifacts", "dream", "accept");
  const anchorsProposeDir = join(root, ".aetherion", "artifacts", "anchors", "propose");
  const anchorsAcceptDir = join(root, ".aetherion", "artifacts", "anchors", "accept");
  const personaResetDir = join(root, ".aetherion", "artifacts", "persona", "reset");
  const soulForkDir = join(root, ".aetherion", "artifacts", "soul", "fork");
  const agentContractDir = join(root, ".aetherion", "artifacts", "agent", "contract");
  const agentExecuteDir = join(root, ".aetherion", "artifacts", "agent", "execute");
  await mkdir(boundaryDir, { recursive: true });
  await mkdir(invalidSchemaBoundaryDir, { recursive: true });
  await mkdir(consentDir, { recursive: true });
  await mkdir(genericDir, { recursive: true });
  await mkdir(invalidDir, { recursive: true });
  await mkdir(memoryCandidatesDir, { recursive: true });
  await mkdir(memoryAcceptDir, { recursive: true });
  await mkdir(memoryRejectDir, { recursive: true });
  await mkdir(memoryBlockDir, { recursive: true });
  await mkdir(memoryDeleteDir, { recursive: true });
  await mkdir(securityScanDir, { recursive: true });
  await mkdir(securityAckDir, { recursive: true });
  await mkdir(securityTrialDir, { recursive: true });
  await mkdir(securityFixtureDir, { recursive: true });
  await mkdir(surfaceBrowserDir, { recursive: true });
  await mkdir(surfaceInboxDir, { recursive: true });
  await mkdir(surfaceOutboxDir, { recursive: true });
  await mkdir(storeInstallDir, { recursive: true });
  await mkdir(capsuleRollbackDir, { recursive: true });
  await mkdir(dreamRunDir, { recursive: true });
  await mkdir(dreamAcceptDir, { recursive: true });
  await mkdir(anchorsProposeDir, { recursive: true });
  await mkdir(anchorsAcceptDir, { recursive: true });
  await mkdir(personaResetDir, { recursive: true });
  await mkdir(soulForkDir, { recursive: true });
  await mkdir(agentContractDir, { recursive: true });
  await mkdir(agentExecuteDir, { recursive: true });
  await writeFile(join(boundaryDir, "boundary_run_payload_resolved_facts.json"), `${JSON.stringify(boundaryFactsFixture("run_payload_resolved"), null, 2)}\n`);
  await writeFile(join(invalidSchemaBoundaryDir, "boundary_run_payload_schema_invalid_facts.json"), `${JSON.stringify({ id: "boundary_run_payload_schema_invalid_facts" }, null, 2)}\n`);
  await writeFile(join(consentDir, "consent_run_payload_resolved_write.json"), `${JSON.stringify(consentRecordFixture("run_payload_resolved"), null, 2)}\n`);
  await writeFile(join(genericDir, "capsule_a.json"), `${JSON.stringify(capsuleRecord("cap_payload", "0.1.0", "draft"), null, 2)}\n`);
  await writeFile(join(invalidDir, "broken.json"), "{not json");
  await writeFile(join(memoryCandidatesDir, "memcand_payload.json"), `${JSON.stringify(memoryCandidate("memcand_payload", "pending"), null, 2)}\n`);
  await writeFile(join(memoryRejectDir, "memcand_payload_rejected.json"), `${JSON.stringify(memoryCandidate("memcand_payload_rejected", "rejected"), null, 2)}\n`);
  await writeFile(join(memoryAcceptDir, "mem_payload.json"), `${JSON.stringify(memoryCard("mem_payload", "accepted memory"), null, 2)}\n`);
  await writeFile(join(memoryBlockDir, "mem_payload_blocked.json"), `${JSON.stringify({ ...memoryCard("mem_payload_blocked", "blocked memory"), blocked_contexts: ["external_send"] }, null, 2)}\n`);
  await writeFile(join(memoryDeleteDir, "tombstone_mem_payload.json"), `${JSON.stringify(memoryTombstone("tombstone_mem_payload", "mem_payload"), null, 2)}\n`);
  await writeFile(join(memoryAcceptDir, "mem_payload_invalid.json"), `${JSON.stringify({ id: "mem_payload_invalid" }, null, 2)}\n`);
  await writeFile(join(securityScanDir, "assessment_payload.json"), `${JSON.stringify(contentAssessment("assessment_payload"), null, 2)}\n`);
  await writeFile(join(securityScanDir, "poison_payload.json"), `${JSON.stringify(poisoningSignal("poison_payload", "detected"), null, 2)}\n`);
  await writeFile(join(securityAckDir, "poison_payload_ack.json"), `${JSON.stringify(poisoningSignal("poison_payload_ack", "acknowledged"), null, 2)}\n`);
  await writeFile(join(securityTrialDir, "honeypot_payload.json"), `${JSON.stringify(honeypotTrial("honeypot_payload"), null, 2)}\n`);
  await writeFile(join(securityFixtureDir, "poison_fixture_payload.json"), `${JSON.stringify(poisoningFixture("poison_fixture_payload"), null, 2)}\n`);
  await writeFile(join(securityScanDir, "assessment_invalid.json"), `${JSON.stringify({ id: "assessment_invalid" }, null, 2)}\n`);
  await writeFile(join(surfaceBrowserDir, "browser_obs_payload.json"), `${JSON.stringify(browserObservation("browser_obs_payload"), null, 2)}\n`);
  await writeFile(join(surfaceInboxDir, "inbox_payload.json"), `${JSON.stringify(imInboxItem("inbox_payload"), null, 2)}\n`);
  await writeFile(join(surfaceOutboxDir, "outbox_payload.json"), `${JSON.stringify(imOutboxItem("outbox_payload"), null, 2)}\n`);
  await writeFile(join(storeInstallDir, "install_payload.json"), `${JSON.stringify(capsuleInstall("install_payload"), null, 2)}\n`);
  await writeFile(join(surfaceOutboxDir, "outbox_invalid.json"), `${JSON.stringify({ id: "outbox_invalid" }, null, 2)}\n`);
  await writeFile(join(capsuleRollbackDir, "cap_payload_0.2.0_to_0.1.0.json"), `${JSON.stringify({
    active: { ...capsuleRecord("cap_payload", "0.1.0", "published"), rollback: { previous_version: "0.2.0" } },
    deprecated: { ...capsuleRecord("cap_payload", "0.2.0", "deprecated"), rollback: { previous_version: "0.1.0" } }
  }, null, 2)}\n`);
  await writeFile(join(capsuleRollbackDir, "cap_payload_invalid.json"), `${JSON.stringify({ active: { id: "cap_payload_invalid" } }, null, 2)}\n`);
  await writeFile(join(dreamRunDir, "fold_payload.json"), `${JSON.stringify(memoryFold("fold_payload", "pending"), null, 2)}\n`);
  await writeFile(join(dreamAcceptDir, "fold_payload_accepted.json"), `${JSON.stringify(memoryFold("fold_payload_accepted", "accepted"), null, 2)}\n`);
  await writeFile(join(anchorsProposeDir, "anchor_payload.json"), `${JSON.stringify(personaAnchor("anchor_payload", "pending"), null, 2)}\n`);
  await writeFile(join(anchorsAcceptDir, "anchor_payload_accepted.json"), `${JSON.stringify(personaAnchor("anchor_payload_accepted", "accepted"), null, 2)}\n`);
  await writeFile(join(personaResetDir, "persona_reset_payload.json"), `${JSON.stringify(personaReset("persona_reset_payload"), null, 2)}\n`);
  await writeFile(join(personaResetDir, "persona_reset_invalid.json"), `${JSON.stringify({ id: "persona_reset_invalid" }, null, 2)}\n`);
  await writeFile(join(soulForkDir, "soulfork_payload.json"), `${JSON.stringify(soulFork("soulfork_payload"), null, 2)}\n`);
  await writeFile(join(agentContractDir, "contract_payload.json"), `${JSON.stringify(agentContract("contract_payload", "draft"), null, 2)}\n`);
  await writeFile(join(agentContractDir, "contract_payload_active.json"), `${JSON.stringify(agentContract("contract_payload_active", "active"), null, 2)}\n`);
  await writeFile(join(agentExecuteDir, "child_result_run_child_payload.json"), `${JSON.stringify(childResult("child_result_run_child_payload"), null, 2)}\n`);
  await writeFile(join(agentExecuteDir, "account_payload_denial.json"), `${JSON.stringify(budgetAccount("account_payload_denial"), null, 2)}\n`);
  await writeFile(join(agentExecuteDir, "breaker_payload_denial.json"), `${JSON.stringify(circuitBreaker("breaker_payload_denial"), null, 2)}\n`);
  await writeFile(join(agentExecuteDir, "breaker_payload_invalid.json"), `${JSON.stringify({ id: "breaker_payload_invalid" }, null, 2)}\n`);

  const beforeBoundary = await readFile(join(boundaryDir, "boundary_run_payload_resolved_facts.json"), "utf8");
  const events = [
    payloadEvent("evt_payload_boundary", "run_payload_resolved", "run.started", "artifact://boundary/run_payload_resolved/facts"),
    payloadEvent("evt_payload_consent", "run_payload_resolved", "consent.recorded", "artifact://consent/run_payload_resolved/write"),
    payloadEvent("evt_payload_generic", "run_payload_resolved", "capsule.draft.recorded", "artifact://capsule/draft/capsule_a"),
    payloadEvent("evt_payload_memory_candidate", "run_payload_resolved", "memory.candidate.created", "artifact://memory/candidates/memcand_payload"),
    payloadEvent("evt_payload_memory_reject", "run_payload_resolved", "memory.rejected", "artifact://memory/reject/memcand_payload_rejected"),
    payloadEvent("evt_payload_memory_accept", "run_payload_resolved", "memory.accepted", "artifact://memory/accept/mem_payload"),
    payloadEvent("evt_payload_memory_block", "run_payload_resolved", "memory.blocked", "artifact://memory/block/mem_payload_blocked"),
    payloadEvent("evt_payload_memory_delete", "run_payload_resolved", "memory.deleted", "artifact://memory/delete/tombstone_mem_payload"),
    payloadEvent("evt_payload_memory_invalid", "run_payload_schema_invalid", "memory.accepted", "artifact://memory/accept/mem_payload_invalid"),
    payloadEvent("evt_payload_security_assessment", "run_payload_resolved", "security.content.assessed", "artifact://security/scan/assessment_payload"),
    payloadEvent("evt_payload_security_signal", "run_payload_resolved", "poisoning.detected", "artifact://security/scan/poison_payload"),
    payloadEvent("evt_payload_security_ack", "run_payload_resolved", "poisoning.acknowledged", "artifact://security/ack/poison_payload_ack"),
    payloadEvent("evt_payload_security_trial", "run_payload_resolved", "honeypot.trial.completed", "artifact://security/trial/honeypot_payload"),
    payloadEvent("evt_payload_security_fixture", "run_payload_resolved", "poisoning.regression.created", "artifact://security/fixture/poison_fixture_payload"),
    payloadEvent("evt_payload_security_invalid", "run_payload_schema_invalid", "security.content.assessed", "artifact://security/scan/assessment_invalid"),
    payloadEvent("evt_payload_surface_browser", "run_payload_resolved", "browser.observation.ingested", "artifact://surface/browser-observe/browser_obs_payload"),
    payloadEvent("evt_payload_surface_inbox", "run_payload_resolved", "im.inbox.received", "artifact://surface/im-inbox/inbox_payload"),
    payloadEvent("evt_payload_surface_outbox", "run_payload_resolved", "im.outbox.queued", "artifact://surface/im-outbox/outbox_payload"),
    payloadEvent("evt_payload_store_install", "run_payload_resolved", "capsule.store.installed", "artifact://store/install/install_payload"),
    payloadEvent("evt_payload_surface_invalid", "run_payload_schema_invalid", "im.outbox.queued", "artifact://surface/im-outbox/outbox_invalid"),
    payloadEvent("evt_payload_capsule_rollback", "run_payload_resolved", "capsule.rollback.recorded", "artifact://capsule/rollback/cap_payload_0.2.0_to_0.1.0"),
    payloadEvent("evt_payload_capsule_rollback_invalid", "run_payload_schema_invalid", "capsule.rollback.recorded", "artifact://capsule/rollback/cap_payload_invalid"),
    payloadEvent("evt_payload_dream_run", "run_payload_resolved", "memory.fold.proposed", "artifact://dream/run/fold_payload"),
    payloadEvent("evt_payload_dream_accept", "run_payload_resolved", "memory.fold.accepted", "artifact://dream/accept/fold_payload_accepted"),
    payloadEvent("evt_payload_anchor_propose", "run_payload_resolved", "persona.anchor.proposed", "artifact://anchors/propose/anchor_payload"),
    payloadEvent("evt_payload_anchor_accept", "run_payload_resolved", "persona.anchor.accepted", "artifact://anchors/accept/anchor_payload_accepted"),
    payloadEvent("evt_payload_persona_reset", "run_payload_resolved", "persona.reset.applied", "artifact://persona/reset/persona_reset_payload"),
    payloadEvent("evt_payload_persona_reset_invalid", "run_payload_schema_invalid", "persona.reset.applied", "artifact://persona/reset/persona_reset_invalid"),
    payloadEvent("evt_payload_soul_fork", "run_payload_resolved", "soul.fork.created", "artifact://soul/fork/soulfork_payload"),
    payloadEvent("evt_payload_agent_contract", "run_payload_resolved", "agent.contract.created", "artifact://agent/contract/contract_payload"),
    payloadEvent("evt_payload_agent_started", "run_payload_resolved", "agent.child.started", "artifact://agent/contract/contract_payload_active"),
    payloadEvent("evt_payload_agent_completed", "run_payload_resolved", "agent.child.completed", "artifact://agent/execute/child_result_run_child_payload"),
    payloadEvent("evt_payload_agent_policy_denied", "run_payload_resolved", "agent.child.policy_denied", "artifact://agent/execute/account_payload_denial"),
    payloadEvent("evt_payload_agent_circuit", "run_payload_resolved", "circuit.opened", "artifact://agent/execute/breaker_payload_denial"),
    payloadEvent("evt_payload_agent_circuit_invalid", "run_payload_schema_invalid", "circuit.opened", "artifact://agent/execute/breaker_payload_invalid"),
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
    events_with_payload_ref: 39,
    resolved: 36,
    missing: 1,
    invalid_json: 1,
    unresolved: 1,
    schema_valid: 29,
    schema_invalid: 7,
    schema_not_checked: 3
  });
  assert.equal(byId.get("evt_payload_boundary")?.status, "resolved");
  assert.equal(byId.get("evt_payload_boundary")?.resolved_path, join(boundaryDir, "boundary_run_payload_resolved_facts.json"));
  assert.equal(byId.get("evt_payload_boundary")?.schema_name, "boundary-facts.schema.json");
  assert.equal(byId.get("evt_payload_boundary")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_consent")?.status, "resolved");
  assert.equal(byId.get("evt_payload_consent")?.schema_name, "consent-record.schema.json");
  assert.equal(byId.get("evt_payload_consent")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_generic")?.status, "resolved");
  assert.equal(byId.get("evt_payload_generic")?.schema_name, "capability-capsule.schema.json");
  assert.equal(byId.get("evt_payload_generic")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_memory_candidate")?.schema_name, "memory-candidate.schema.json");
  assert.equal(byId.get("evt_payload_memory_candidate")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_memory_reject")?.schema_name, "memory-candidate.schema.json");
  assert.equal(byId.get("evt_payload_memory_reject")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_memory_accept")?.schema_name, "memory-card.schema.json");
  assert.equal(byId.get("evt_payload_memory_accept")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_memory_block")?.schema_name, "memory-card.schema.json");
  assert.equal(byId.get("evt_payload_memory_block")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_memory_delete")?.schema_name, "memory-tombstone.schema.json");
  assert.equal(byId.get("evt_payload_memory_delete")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_memory_invalid")?.schema_name, "memory-card.schema.json");
  assert.equal(byId.get("evt_payload_memory_invalid")?.schema_status, "invalid");
  assert.ok(byId.get("evt_payload_memory_invalid")?.schema_errors.some((error) => error.includes("missing required property")));
  assert.equal(byId.get("evt_payload_security_assessment")?.schema_name, "content-assessment.schema.json");
  assert.equal(byId.get("evt_payload_security_assessment")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_security_signal")?.schema_name, "poisoning-signal.schema.json");
  assert.equal(byId.get("evt_payload_security_signal")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_security_ack")?.schema_name, "poisoning-signal.schema.json");
  assert.equal(byId.get("evt_payload_security_ack")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_security_trial")?.schema_name, "honeypot-trial.schema.json");
  assert.equal(byId.get("evt_payload_security_trial")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_security_fixture")?.schema_name, "poisoning-regression-fixture.schema.json");
  assert.equal(byId.get("evt_payload_security_fixture")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_security_invalid")?.schema_name, "content-assessment.schema.json");
  assert.equal(byId.get("evt_payload_security_invalid")?.schema_status, "invalid");
  assert.ok(byId.get("evt_payload_security_invalid")?.schema_errors.some((error) => error.includes("missing required property")));
  assert.equal(byId.get("evt_payload_surface_browser")?.schema_name, "browser-observation.schema.json");
  assert.equal(byId.get("evt_payload_surface_browser")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_surface_inbox")?.schema_name, "im-inbox-item.schema.json");
  assert.equal(byId.get("evt_payload_surface_inbox")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_surface_outbox")?.schema_name, "im-outbox-item.schema.json");
  assert.equal(byId.get("evt_payload_surface_outbox")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_store_install")?.schema_name, "capsule-install.schema.json");
  assert.equal(byId.get("evt_payload_store_install")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_surface_invalid")?.schema_name, "im-outbox-item.schema.json");
  assert.equal(byId.get("evt_payload_surface_invalid")?.schema_status, "invalid");
  assert.ok(byId.get("evt_payload_surface_invalid")?.schema_errors.some((error) => error.includes("missing required property")));
  assert.equal(byId.get("evt_payload_capsule_rollback")?.schema_name, "capsule-rollback.schema.json");
  assert.equal(byId.get("evt_payload_capsule_rollback")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_capsule_rollback_invalid")?.schema_name, "capsule-rollback.schema.json");
  assert.equal(byId.get("evt_payload_capsule_rollback_invalid")?.schema_status, "invalid");
  assert.ok(byId.get("evt_payload_capsule_rollback_invalid")?.schema_errors.some((error) => error.includes("missing required property")));
  assert.equal(byId.get("evt_payload_dream_run")?.schema_name, "memory-fold.schema.json");
  assert.equal(byId.get("evt_payload_dream_run")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_dream_accept")?.schema_name, "memory-fold.schema.json");
  assert.equal(byId.get("evt_payload_dream_accept")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_anchor_propose")?.schema_name, "persona-anchor.schema.json");
  assert.equal(byId.get("evt_payload_anchor_propose")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_anchor_accept")?.schema_name, "persona-anchor.schema.json");
  assert.equal(byId.get("evt_payload_anchor_accept")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_persona_reset")?.schema_name, "persona-reset.schema.json");
  assert.equal(byId.get("evt_payload_persona_reset")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_persona_reset_invalid")?.schema_name, "persona-reset.schema.json");
  assert.equal(byId.get("evt_payload_persona_reset_invalid")?.schema_status, "invalid");
  assert.ok(byId.get("evt_payload_persona_reset_invalid")?.schema_errors.some((error) => error.includes("missing required property")));
  assert.equal(byId.get("evt_payload_soul_fork")?.schema_name, "soul-fork.schema.json");
  assert.equal(byId.get("evt_payload_soul_fork")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_agent_contract")?.schema_name, "agent-contract.schema.json");
  assert.equal(byId.get("evt_payload_agent_contract")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_agent_started")?.schema_name, "agent-contract.schema.json");
  assert.equal(byId.get("evt_payload_agent_started")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_agent_completed")?.schema_name, "child-result.schema.json");
  assert.equal(byId.get("evt_payload_agent_completed")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_agent_policy_denied")?.schema_name, "budget-account.schema.json");
  assert.equal(byId.get("evt_payload_agent_policy_denied")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_agent_circuit")?.schema_name, "circuit-breaker.schema.json");
  assert.equal(byId.get("evt_payload_agent_circuit")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_agent_circuit_invalid")?.schema_name, "circuit-breaker.schema.json");
  assert.equal(byId.get("evt_payload_agent_circuit_invalid")?.schema_status, "invalid");
  assert.ok(byId.get("evt_payload_agent_circuit_invalid")?.schema_errors.some((error) => error.includes("missing required property")));
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

function memoryCandidate(id: string, status: "pending" | "accepted" | "rejected") {
  return {
    id,
    source_events: [`evt_source_${id}`],
    candidate: memoryCard(`mem_${id.replace(/^memcand_/, "")}`, `candidate ${id}`),
    confidence: 0.8,
    review: { status }
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

function memoryFold(id: string, reviewStatus: "pending" | "accepted" | "rejected") {
  const acceptedMemoryId = reviewStatus === "accepted" ? `mem_${id}` : null;
  return {
    id,
    source_run_id: "run_payload_resolved",
    folded_from: ["mem_fold_source_a", "mem_fold_source_b"],
    source_events: [`evt_source_${id}_a`, `evt_source_${id}_b`],
    proposed_memory: {
      id: `mem_${id}`,
      type: "project",
      subject: "run_payload_resolved",
      content: `folded memory ${id}`,
      source_events: [`evt_source_${id}_a`, `evt_source_${id}_b`],
      confidence: 0.82,
      sensitivity: "private",
      blocked_contexts: ["external_send"]
    },
    confidence: 0.82,
    created_at: "2026-06-07T12:00:00.000Z",
    review_status: reviewStatus,
    accepted_memory_id: acceptedMemoryId,
    replaces_active_memory: false,
    sensitive_approval_required: false,
    sensitive_approved: false
  };
}

function personaAnchor(id: string, reviewStatus: "pending" | "accepted" | "rejected") {
  return {
    id,
    branch: "direct",
    kind: "style",
    content: `persona anchor ${id}`,
    source_events: [`evt_source_${id}`],
    confidence: 0.86,
    ttl: "180d",
    created_at: "2026-06-07T12:01:00.000Z",
    expires_at: "2026-12-04T12:01:00.000Z",
    allowed_contexts: ["planning", "coding"],
    blocked_contexts: ["external_auto_send"],
    review_status: reviewStatus,
    sensitivity: "private",
    sensitive_approval_required: false,
    sensitive_approved: false
  };
}

function personaReset(id: string) {
  return {
    id,
    from_branch: null,
    to_branch: "direct",
    status: "applied",
    retained_business_memory_ids: ["mem_business"],
    activated_anchor_ids: ["anchor_payload_accepted"],
    deactivated_anchor_ids: [],
    inherits_live_authority: false,
    created_at: "2026-06-07T12:02:00.000Z"
  };
}

function soulFork(id: string) {
  return {
    id,
    source_checkpoint_id: "checkpoint_payload",
    source_run_id: "run_payload_resolved",
    source_event_id: "evt_payload_boundary",
    source_event_hash: `sha256:${"c".repeat(64)}`,
    replay_record_id: "replay_payload_trace",
    new_agent_id: "agent_payload_fork",
    created_at: "2026-06-07T12:03:00.000Z",
    identity: {
      id: "agent_payload_fork",
      parent_agent_id: "agent_local"
    },
    policy: {
      id: "policy_payload_inheritance",
      max_auto_risk: "L2",
      vault_grants: [],
      oauth_grants: [],
      active_leases: []
    },
    budget: {
      id: "budget_payload_fork",
      token_budget: 0,
      tool_call_budget: 0,
      cpu_ms_budget: 0,
      network_call_budget: 0,
      wall_time_ms_budget: 0,
      risk_budget: "L2",
      lease_budget: 0,
      on_exhaustion: "ask"
    },
    workspace_scope: {
      workspace_id: "ws_payload_ref_audit",
      allowed_paths: []
    },
    inheritance_policy_id: "inheritance_policy_payload",
    inherited_history_refs: ["evt_payload_boundary"],
    inherited_memory_ids: ["mem_business"],
    excluded_memory_ids: ["mem_secret"],
    sensitive_history_approved: false,
    inherits_live_authority: false,
    live_side_effects_allowed: false,
    status: "created"
  };
}

function resourceBudget(id: string) {
  return {
    id,
    token_budget: 1000,
    tool_call_budget: 2,
    cpu_ms_budget: 10000,
    network_call_budget: 0,
    wall_time_ms_budget: 30000,
    risk_budget: "L2",
    lease_budget: 1,
    on_exhaustion: "stop"
  };
}

function budgetAccount(id: string) {
  return {
    id,
    contract_id: "contract_payload_active",
    remaining: {
      ...resourceBudget("budget_payload"),
      tool_call_budget: 1,
      lease_budget: 0
    },
    tool_calls_used: 1,
    leases_used: 1,
    policy_denials: 3,
    token_used: 0,
    cpu_ms_used: 1,
    network_calls_used: 0,
    wall_time_ms_used: 5,
    status: "stopped"
  };
}

function circuitBreaker(id: string) {
  return {
    id,
    contract_id: "contract_payload_active",
    child_run_id: "run_child_payload",
    trigger: "repeated_policy_denial",
    status: "open",
    action: "stop",
    event_id: "evt_payload_agent_circuit",
    reason: "Three supervisor policy denials",
    created_at: "2026-06-07T12:05:00.000Z"
  };
}

function agentContract(id: string, status: "draft" | "active" | "completed" | "stopped") {
  return {
    id,
    parent_run_id: "run_payload_resolved",
    child_agent_id: "agent_payload_child",
    task: "Read local documentation",
    resource_budget_id: "budget_payload",
    budget_snapshot: resourceBudget("budget_payload"),
    allowed_capsules: ["cap_payload"],
    allowed_paths: ["README.md"],
    completion_evidence_required: true,
    output_taint: {
      sources: ["child_agent"],
      can_authorize_actions: false
    },
    status,
    created_at: "2026-06-07T12:04:00.000Z"
  };
}

function childResult(id: string) {
  return {
    id,
    contract_id: "contract_payload_active",
    child_run_id: "run_child_payload",
    child_agent_id: "agent_payload_child",
    capsule_id: "cap_payload",
    status: "completed",
    completion_evidence: {
      source_event_ids: ["evt_payload_agent_started", "evt_payload_agent_completed"],
      request_id: "toolreq_child_payload",
      policy_decision_id: "policy_child_payload",
      lease_id: "lease_child_payload",
      artifact_sha256: `sha256:${"d".repeat(64)}`,
      byte_count: 27,
      usage: {
        token_used: 0,
        cpu_ms_used: 1,
        network_calls_used: 0,
        wall_time_ms_used: 5
      }
    },
    output_taint: {
      sources: ["child_agent"],
      can_authorize_actions: false
    },
    parent_must_reauthorize_actions: true
  };
}

const securityContentHash = `sha256:${"a".repeat(64)}`;
const securitySourceEventId = "evt_source_security_payload";
const securityMatchedRules = ["rule_prompt_ignore_prior"];

function contentAssessment(id: string) {
  return {
    id,
    source_event_id: securitySourceEventId,
    source_kind: "public_web",
    content_sha256: securityContentHash,
    status: "suspicious",
    matched_rules: securityMatchedRules,
    taint: {
      sources: ["public_web"],
      can_authorize_actions: false
    },
    raw_content_persisted: false,
    created_at: "2026-06-07T10:00:00.000Z"
  };
}

function poisoningSignal(id: string, status: "detected" | "acknowledged") {
  return {
    id,
    assessment_id: "assessment_payload",
    source_event_id: securitySourceEventId,
    source_kind: "public_web",
    content_sha256: securityContentHash,
    signal_type: "prompt_injection",
    severity: "high",
    matched_rules: securityMatchedRules,
    status,
    quarantined: true,
    sandbox_required: true,
    can_authorize_actions: false,
    acknowledged_at: status === "acknowledged" ? "2026-06-07T10:01:00.000Z" : null,
    regression_fixture_id: null,
    created_at: "2026-06-07T10:00:00.000Z"
  };
}

function honeypotTrial(id: string) {
  return {
    id,
    signal_id: "poison_payload",
    source_event_ids: [securitySourceEventId],
    subject: {
      kind: "content",
      id: "assessment_payload"
    },
    mode: "deterministic_decoy_trial",
    decoy_secret_refs: ["decoy://honeypot/poison_payload/credential"],
    real_secret_accessed: false,
    network_accessed: false,
    authorization_issued: false,
    observed_attempts: ["prompt_injection"],
    outcome: "contained",
    quarantine_recommended: true,
    capsule_quarantined: false,
    created_at: "2026-06-07T10:02:00.000Z"
  };
}

function poisoningFixture(id: string) {
  return {
    id,
    signal_id: "poison_payload",
    source_event_ids: [securitySourceEventId],
    input_sha256: securityContentHash,
    replay_mode: "detector_only",
    expected_signal_type: "prompt_injection",
    expected_matched_rules: securityMatchedRules,
    expected_authorization_blocked: true,
    raw_content_included: false,
    created_at: "2026-06-07T10:03:00.000Z"
  };
}

const surfaceContentHash = `sha256:${"b".repeat(64)}`;

function browserObservation(id: string) {
  return {
    id,
    origin: "https://example.com/account",
    title: "Account",
    mode: "current_tab_observe",
    current_tab_only: true,
    dom_sha256: surfaceContentHash,
    raw_dom_persisted: false,
    redactions: {
      password_fields: 1,
      hidden_inputs: 1,
      credential_like_matches: 1
    },
    taint: {
      sources: ["public_web"],
      can_authorize_actions: false
    },
    can_create_side_effects: false,
    policy_decision_id: "policy_surface_payload_deny",
    source_event_ids: ["evt_surface_source"],
    captured_at: "2026-06-07T11:00:00.000Z"
  };
}

function imInboxItem(id: string) {
  return {
    id,
    adapter: "local_fixture",
    external_message_id: "msg_payload",
    sender_hash: surfaceContentHash,
    sender_role: "unknown",
    visibility: "group",
    mentioned: true,
    message_sha256: surfaceContentHash,
    raw_message_persisted: false,
    risk_level: "L5",
    disposition: "pairing_required",
    can_authorize_actions: false,
    taint: {
      sources: ["im"],
      can_authorize_actions: false
    },
    created_at: "2026-06-07T11:01:00.000Z"
  };
}

function imOutboxItem(id: string) {
  return {
    id,
    source_run_id: "run_surface_payload",
    adapter: "local_fixture",
    destination_hash: surfaceContentHash,
    visibility: "dm",
    body_sha256: surfaceContentHash,
    raw_body_persisted: false,
    risk_level: "L3",
    approval_required: true,
    delivery_status: "queued",
    delivery_attempted: false,
    approval_scope: {
      one_scoped_action: true,
      may_reuse_for_future_messages: false
    },
    policy_decision_id: "policy_surface_outbox_ask",
    policy_event_id: "evt_surface_outbox_policy",
    created_at: "2026-06-07T11:02:00.000Z"
  };
}

function capsuleInstall(id: string) {
  return {
    id,
    package_id: "pkg_payload",
    capsule_id: "cap_payload",
    capsule_version: "1.0.0",
    publisher_id: "pub_payload",
    package_digest: surfaceContentHash,
    signature_verified: true,
    permission_diff_reviewed: true,
    replay_tests_passed: true,
    sandbox_trial_passed: true,
    approval_card_id: null,
    rollback_target: null,
    installed_registry: "capsules",
    raw_code_executed: false,
    status: "installed",
    created_at: "2026-06-07T11:03:00.000Z"
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
      content_sha256: `sha256:${"a".repeat(64)}`,
      forbidden_pattern_matches: []
    },
    approval: {
      required: true,
      status: lifecycle === "published" || lifecycle === "deprecated" ? "approved" : "pending",
      approval_card_id: lifecycle === "published" || lifecycle === "deprecated" ? `approval_${id}_${version}` : null
    },
    integrity: lifecycle === "draft" ? null : {
      algorithm: "sha256",
      digest: `sha256:${"b".repeat(64)}`
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

type SocketRunShimRequest = {
  id: string;
  method: string;
  event_type?: string;
  summary?: string;
  payload_ref?: string;
  contents?: string;
  consent_payload_ref?: string;
};

async function socketRunShimResult(
  workspace: Awaited<ReturnType<typeof createWorkspace>>,
  request: SocketRunShimRequest,
  runId: string
): Promise<Record<string, unknown>> {
  switch (request.method) {
    case "workspace.init":
      return { workspace_id: workspace.id, authority: "rust-supervisor" };
    case "event.append": {
      assert.ok(request.event_type);
      assert.ok(request.summary);
      const eventId = await appendShimEvent(workspace, runId, request.event_type, request.summary, request.payload_ref);
      return { event_id: eventId };
    }
    case "file.read.traced": {
      const requestEventId = await appendShimEvent(workspace, runId, "tool.requested", "Shim supervisor requested workspace read.");
      const riskEventId = await appendShimEvent(workspace, runId, "risk.composed", "Shim supervisor composed L1 read risk.");
      const policyEventId = await appendShimEvent(workspace, runId, "policy.decided", "Shim supervisor allowed workspace read.");
      const leaseEventId = await appendShimEvent(workspace, runId, "lease.issued", "Shim supervisor issued read lease.");
      const resultEventId = await appendShimEvent(workspace, runId, "tool.result", "Shim supervisor returned workspace read contents.");
      return {
        contents: "Socket commit transport fixture\n",
        request_id: `toolreq_${runId}_read`,
        request_event_id: requestEventId,
        risk_event_id: riskEventId,
        policy_decision_id: `policy_${runId}_allow_read`,
        policy_event_id: policyEventId,
        lease_event_id: leaseEventId,
        result_event_id: resultEventId,
        decision: "allow",
        risk_level: "L1",
        lease_id: `lease_${runId}_read`
      };
    }
    case "file.write.prepare": {
      const requestEventId = await appendShimEvent(workspace, runId, "tool.requested", "Shim supervisor requested workspace write.");
      const riskEventId = await appendShimEvent(workspace, runId, "risk.composed", "Shim supervisor composed L3 write risk.");
      const policyEventId = await appendShimEvent(workspace, runId, "policy.decided", "Shim supervisor asked for write consent.");
      return {
        request_id: `toolreq_${runId}_write`,
        request_event_id: requestEventId,
        risk_event_id: riskEventId,
        policy_decision_id: `policy_${runId}_ask_write`,
        policy_event_id: policyEventId,
        decision: "ask",
        risk_level: "L3",
        lease_id: ""
      };
    }
    case "file.write.commit": {
      const consentEventId = await appendShimEvent(workspace, runId, "consent.recorded", "Shim supervisor recorded write consent.", request.consent_payload_ref);
      const policyEventId = await appendShimEvent(workspace, runId, "policy.decided", "Shim supervisor allowed write commit.");
      const leaseEventId = await appendShimEvent(workspace, runId, "lease.issued", "Shim supervisor issued write lease.");
      const actionEventId = await appendShimEvent(workspace, runId, "action.recorded", "Shim supervisor wrote workspace file.");
      const observationEventId = await appendShimEvent(workspace, runId, "observation.recorded", "Shim supervisor observed expected workspace file state.");
      const verificationEventId = await appendShimEvent(workspace, runId, "verification.recorded", "Shim supervisor verified exact workspace file contents.");
      return {
        written: true,
        request_id: `toolreq_${runId}_write`,
        consent_event_id: consentEventId,
        policy_decision_id: `policy_${runId}_allow_write`,
        policy_event_id: policyEventId,
        lease_event_id: leaseEventId,
        action_id: `action_${runId}_write`,
        action_event_id: actionEventId,
        observation_id: `obs_${runId}_file`,
        observation_event_id: observationEventId,
        observation_summary: "Shim supervisor observed expected workspace file state.",
        verification_id: `verify_${runId}_file`,
        verification_event_id: verificationEventId,
        verification_status: "passed",
        verification_summary: "Shim supervisor verified exact workspace file contents.",
        decision: "allow",
        risk_level: "L3",
        lease_id: `lease_${runId}_write`
      };
    }
    default:
      throw new Error(`unsupported shim method ${request.method}`);
  }
}

async function appendShimEvent(
  workspace: Awaited<ReturnType<typeof createWorkspace>>,
  runId: string,
  eventType: string,
  summary: string,
  payloadRef?: string
): Promise<string> {
  const index = (await readEvents(workspace)).filter((event) => event.run_id === runId).length + 1;
  const eventId = `evt_${runId}_${String(index).padStart(2, "0")}_${eventType.replaceAll(".", "_")}`;
  const event = eventRecord({
    id: eventId,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: eventType,
    actor: { type: "system", id: "socket_transport_shim" },
    summary
  });
  if (payloadRef) {
    event.payload_ref = payloadRef;
  }
  await appendEvent(repoRoot, workspace, event);
  return eventId;
}
