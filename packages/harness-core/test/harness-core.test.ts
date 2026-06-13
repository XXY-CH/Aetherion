import assert from "node:assert/strict";
import { createServer } from "node:net";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import {
  appendEvent,
  auditCapsuleRegistryRebuild,
  auditHibernationRegistryRebuild,
  agentModelRequestArtifactRef,
  agentModelResponseArtifactRef,
  agentResponseAuditArtifactRef,
  agentRuntimeInvocationArtifactRef,
  agentToolRequestProposalArtifactRef,
  auditAgentResponseAuditEvidence,
  auditLedgerPayloadRefs,
  auditMemoryRegistryRebuild,
  approveWriteWithConsent,
  auditRegistryProvenance,
  auditReplayRecordRegistryRebuild,
  auditSandboxRegistryRebuild,
  callSupervisorRpc,
  canonicalLedgerPath,
  canonicalRuntimeDir,
  browserObservationEventSequence,
  childReadCompletedEventSequence,
  childReadPolicyDeniedEventSequence,
  childReadPostSupervisorBreakerEventSequence,
  childReadPreExecutionBreakerEventSequence,
  childReadRepeatedDenialEventSequence,
  completeRunManifest,
  completeRunManifestWithEventSequence,
  createFileReadRequest,
  createFileWriteRequest,
  createAgentModelRequestArtifact,
  createAgentModelResponseArtifact,
  createAgentResponseAuditArtifact,
  createAgentToolRequestProposalArtifact,
  createRunManifest,
  createWriteConsentRecord,
  createTraceReplayRecord,
  createWorkspace,
  eventContentHash,
  eventRecord,
  imOutboxEventSequence,
  KERNEL_FILE_RUN_APPROVED_EVENT_TYPES,
  loadRunManifest,
  loadWorkspaceFromRegistry,
  readEvents,
  readAgentModelRequestArtifact,
  readAgentModelResponseArtifact,
  readAgentResponseAuditArtifact,
  readAgentRuntimeInvocationArtifact,
  readAgentToolRequestProposalArtifact,
  REPLAY_RECORD_RUN_EVENT_TYPES,
  CHILD_READ_PRE_EXECUTION_BREAKER_EVENT_TYPES,
  evaluateSeedPolicy,
  composeRisk,
  primeSchemaCache,
  readLocalFileThroughPolicy,
  recordRunEvent,
  reconstructTrace,
  replayRecordRunEventSequence,
  resolveModelProvider,
  createStubProvider,
  isModelProviderError,
  MODEL_PROVIDER_ERROR_CODES,
  ModelProviderError,
  securityScanBlockedEventSequence,
  validateAgainstSchema,
  verifyEventHashChain,
  verifyFileContains,
  BROWSER_OBSERVATION_EVENT_TYPES,
  CHILD_READ_COMPLETED_EVENT_TYPES,
  CHILD_READ_POLICY_DENIED_EVENT_TYPES,
  CHILD_READ_REPEATED_DENIAL_EVENT_TYPES,
  IM_OUTBOX_EVENT_TYPES,
  WAKEUP_QUEUE_RUN_EVENT_TYPES,
  wakeupQueueRunEventSequence,
  writeConsentRecordArtifact,
  writeAgentModelRequestArtifact,
  writeAgentModelResponseArtifact,
  writeAgentResponseAuditArtifact,
  writeAgentRuntimeInvocationArtifact,
  writeAgentToolRequestProposalArtifact,
  writeLocalFileThroughPolicy,
  workspaceIdForRoot,
  workspaceRegistryPath,
  writeWorkspaceRegistry
} from "../src/index.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");

type FetchCall = {
  url: string;
  headers: Record<string, string>;
  body: unknown;
};

async function withMockFetch(payload: unknown, run: (calls: FetchCall[]) => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    calls.push({
      url: String(input),
      headers,
      body: JSON.parse(String(init?.body ?? "{}"))
    });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withCustomFetch(mockFetch: typeof fetch, run: () => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function captureAsyncError(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  assert.fail("Expected operation to reject");
}

function captureSyncError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  assert.fail("Expected operation to throw");
}

function assertModelProviderError(error: unknown, expected: {
  code: ModelProviderError["code"];
  category: ModelProviderError["category"];
  provider_ref: string | null;
  retryable: boolean;
  http_status?: number;
}): ModelProviderError {
  assert.ok(error instanceof ModelProviderError, String(error));
  assert.equal(isModelProviderError(error), true);
  assert.equal(error.name, "ModelProviderError");
  assert.equal(error.code, expected.code);
  assert.equal(error.category, expected.category);
  assert.equal(error.provider_ref, expected.provider_ref);
  assert.equal(error.retryable, expected.retryable);
  assert.equal(error.http_status, expected.http_status);
  return error;
}

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
  ["local-ingress-readiness.schema.json", "local-ingress-readiness.json"],
  ["local-ingress-rate-limit-reservation.schema.json", "local-ingress-rate-limit-reservation.json"],
  ["local-ingress-idempotency-reservation.schema.json", "local-ingress-idempotency-reservation.json"],
  ["local-ingress-idempotency-completion.schema.json", "local-ingress-idempotency-completion.json"],
  ["vault-reference.schema.json", "vault-reference.json"],
  ["vault-policy-binding.schema.json", "vault-policy-binding.json"],
  ["model-provider-readiness.schema.json", "model-provider-readiness.json"],
  ["supervisor-lifecycle-readiness.schema.json", "supervisor-lifecycle-readiness.json"],
  ["supervisor-lifecycle-command.schema.json", "supervisor-lifecycle-command.json"],
  ["supervisor-socket-auth-boundary.schema.json", "supervisor-socket-auth-boundary.json"],
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
  ["agent-runtime-invocation.schema.json", "agent-runtime-invocation.json"],
  ["agent-model-request.schema.json", "agent-model-request.json"],
  ["agent-model-response.schema.json", "agent-model-response.json"],
  ["agent-response-audit.schema.json", "agent-response-audit.json"],
  ["agent-tool-request-proposal.schema.json", "agent-tool-request-proposal.json"],
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

test("vault references reject raw secret and implemented OAuth or connector grant claims", async () => {
  await primeSchemaCache(repoRoot);
  const valid = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "vault-reference.json"), "utf8"));

  for (const mutation of [
    (draft: typeof valid) => { draft.reference.material_kind = "raw_secret"; },
    (draft: typeof valid) => { draft.limits.raw_secret_persisted = true; },
    (draft: typeof valid) => { draft.limits.raw_secret_available_to_aetherion = true; },
    (draft: typeof valid) => { draft.limits.oauth_flow_implemented = true; },
    (draft: typeof valid) => { draft.limits.connector_grant_implemented = true; },
    (draft: typeof valid) => { draft.raw_secret_value = "sk-do-not-store"; }
  ]) {
    const draft = JSON.parse(JSON.stringify(valid));
    mutation(draft);
    const result = await validateAgainstSchema(repoRoot, "vault-reference.schema.json", draft);
    assert.equal(result.valid, false, "vault-reference schema accepted authority or raw-secret drift");
  }
});

test("vault policy bindings reject secret resolution, egress, connector grant, and authority overclaims", async () => {
  await primeSchemaCache(repoRoot);
  const valid = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "vault-policy-binding.json"), "utf8"));

  for (const mutation of [
    (draft: typeof valid) => { draft.vault_reference.material_kind = "raw_secret"; },
    (draft: typeof valid) => { draft.policy_decision_binding.fresh_policy_required = false; },
    (draft: typeof valid) => { draft.policy_decision_binding.scoped_lease_required = false; },
    (draft: typeof valid) => { draft.policy_decision_binding.may_resolve_secret = true; },
    (draft: typeof valid) => { draft.policy_decision_binding.may_copy_secret = true; },
    (draft: typeof valid) => { draft.policy_decision_binding.vault_reference_can_authorize_action = true; },
    (draft: typeof valid) => { draft.provider_boundary.current_provider_vault_resolution = true; },
    (draft: typeof valid) => { draft.provider_boundary.provider_call_authorized_by_reference = true; },
    (draft: typeof valid) => { draft.provider_boundary.connector_grant_authorized_by_reference = true; },
    (draft: typeof valid) => { draft.redaction.ledger_material = "raw_secret"; },
    (draft: typeof valid) => { draft.authority.binding_can_issue_lease = true; },
    (draft: typeof valid) => { draft.authority.binding_can_authorize_egress = true; },
    (draft: typeof valid) => { draft.authority.binding_can_create_connector_grant = true; },
    (draft: typeof valid) => { draft.limits.raw_secret_persisted = true; },
    (draft: typeof valid) => { draft.limits.secret_resolution_implemented = true; },
    (draft: typeof valid) => { draft.limits.oauth_flow_implemented = true; },
    (draft: typeof valid) => { draft.limits.token_refresh_implemented = true; },
    (draft: typeof valid) => { draft.limits.egress_allowed_by_binding = true; },
    (draft: typeof valid) => { draft.raw_secret_value = "sk-do-not-store"; }
  ]) {
    const draft = JSON.parse(JSON.stringify(valid));
    mutation(draft);
    const result = await validateAgainstSchema(repoRoot, "vault-policy-binding.schema.json", draft);
    assert.equal(result.valid, false, "vault-policy-binding schema accepted secret-resolution or authority drift");
  }
});

test("local ingress readiness rejects remote surface, auth, idempotency, and authority overclaims", async () => {
  await primeSchemaCache(repoRoot);
  const valid = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "local-ingress-readiness.json"), "utf8"));

  for (const mutation of [
    (draft: typeof valid) => { draft.supported_surfaces.public_http_api_listener = true; },
    (draft: typeof valid) => { draft.supported_surfaces.browser_extension = true; },
    (draft: typeof valid) => { draft.request_envelope.required_fields = draft.request_envelope.required_fields.filter((field: string) => field !== "idempotency_key"); },
    (draft: typeof valid) => { draft.request_envelope.raw_intent_persisted = true; },
    (draft: typeof valid) => { draft.request_envelope.raw_remote_payload_persisted = true; },
    (draft: typeof valid) => { draft.normalization.raw_payload_can_authorize_actions = true; },
    (draft: typeof valid) => { draft.authentication.unknown_or_unauthenticated_can_authorize_tools = true; },
    (draft: typeof valid) => { draft.authentication.user_identity_implemented = true; },
    (draft: typeof valid) => { draft.authentication.auth_token_persisted = true; },
    (draft: typeof valid) => { draft.rate_limit.rate_limit_enforcement_implemented = false; },
    (draft: typeof valid) => { draft.rate_limit.rate_limit_enforcement_scope = "remote_gateway_after_policy"; },
    (draft: typeof valid) => { draft.rate_limit.over_limit_can_execute_actions = true; },
    (draft: typeof valid) => { draft.idempotency.duplicate_runtime_detector_implemented = false; },
    (draft: typeof valid) => { draft.idempotency.duplicate_runtime_detector_scope = "remote_gateway_after_policy"; },
    (draft: typeof valid) => { draft.idempotency.duplicate_key_can_reuse_authority = true; },
    (draft: typeof valid) => { draft.idempotency.replay_protection_implemented = false; },
    (draft: typeof valid) => { draft.idempotency.cached_replay_scope = "remote_gateway_any_matching_key"; },
    (draft: typeof valid) => { draft.idempotency.cached_replay_requires_completed_manifest = false; },
    (draft: typeof valid) => { draft.idempotency.cached_replay_reuses_policy_or_lease = true; },
    (draft: typeof valid) => { draft.idempotency.cached_replay_performs_live_side_effects = true; },
    (draft: typeof valid) => { draft.idempotency.durable_remote_replay_implemented = true; },
    (draft: typeof valid) => { draft.policy_handoff.ingress_envelope_can_issue_lease = true; },
    (draft: typeof valid) => { draft.policy_handoff.ingress_envelope_can_authorize_side_effects = true; },
    (draft: typeof valid) => { draft.remote_surface_boundary.remote_api_gateway_implemented = true; },
    (draft: typeof valid) => { draft.remote_surface_boundary.remote_surface_can_bypass_supervisor = true; },
    (draft: typeof valid) => { draft.authority.ingress_contract_can_write_ledger = true; },
    (draft: typeof valid) => { draft.authority.ingress_contract_can_authorize_tools = true; },
    (draft: typeof valid) => { draft.limits.production_gateway_implemented = true; },
    (draft: typeof valid) => { draft.raw_remote_payload = "do-not-store"; }
  ]) {
    const draft = JSON.parse(JSON.stringify(valid));
    mutation(draft);
    const result = await validateAgainstSchema(repoRoot, "local-ingress-readiness.schema.json", draft);
    assert.equal(result.valid, false, "local-ingress-readiness schema accepted remote ingress or authority drift");
  }
});

test("local ingress idempotency completions reject raw material, authority, mismatch, and live replay claims", async () => {
  await primeSchemaCache(repoRoot);
  const valid = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "local-ingress-idempotency-completion.json"), "utf8"));

  for (const mutation of [
    (draft: typeof valid) => { draft.idempotency_key = "raw-key"; },
    (draft: typeof valid) => { draft.raw_intent = "summarize README"; },
    (draft: typeof valid) => { draft.raw_key_persisted = true; },
    (draft: typeof valid) => { draft.raw_intent_persisted = true; },
    (draft: typeof valid) => { draft.can_authorize_actions = true; },
    (draft: typeof valid) => { draft.replay_authorizes_actions = true; },
    (draft: typeof valid) => { draft.replay_requires_new_policy = true; },
    (draft: typeof valid) => { draft.replay_requires_new_lease = true; },
    (draft: typeof valid) => { draft.replay_performs_live_side_effects = true; },
    (draft: typeof valid) => { draft.live_side_effects_replayed = true; },
    (draft: typeof valid) => { draft.source_chain_valid = false; },
    (draft: typeof valid) => { draft.source_manifest_status = "blocked"; },
    (draft: typeof valid) => { draft.replay_scope = "same_key_any_intent"; },
    (draft: typeof valid) => { draft.policy_handoff = "lease_issued_by_ingress"; },
    (draft: typeof valid) => { draft.surface_id = "api"; }
  ]) {
    const draft = JSON.parse(JSON.stringify(valid));
    mutation(draft);
    const result = await validateAgainstSchema(repoRoot, "local-ingress-idempotency-completion.schema.json", draft);
    assert.equal(result.valid, false, "local-ingress-idempotency-completion schema accepted raw material, authority, mismatch, or live replay drift");
  }
});

test("local ingress rate-limit reservations reject raw material, authority, and late enforcement drift", async () => {
  await primeSchemaCache(repoRoot);
  const valid = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "local-ingress-rate-limit-reservation.json"), "utf8"));

  for (const mutation of [
    (draft: typeof valid) => { draft.rate_limit_key = "raw-key"; },
    (draft: typeof valid) => { draft.raw_intent = "summarize README"; },
    (draft: typeof valid) => { draft.raw_key_persisted = true; },
    (draft: typeof valid) => { draft.raw_intent_persisted = true; },
    (draft: typeof valid) => { draft.can_authorize_actions = true; },
    (draft: typeof valid) => { draft.issues_session = true; },
    (draft: typeof valid) => { draft.background_queue_implemented = true; },
    (draft: typeof valid) => { draft.enforcement_stage = "after_supervisor_handoff"; },
    (draft: typeof valid) => { draft.enforcer = "mutable_counter_registry"; },
    (draft: typeof valid) => { draft.rate_limit_state = "not_enforced"; },
    (draft: typeof valid) => { draft.policy_handoff = "lease_issued_by_ingress"; },
    (draft: typeof valid) => { draft.surface_id = "api"; }
  ]) {
    const draft = JSON.parse(JSON.stringify(valid));
    mutation(draft);
    const result = await validateAgainstSchema(repoRoot, "local-ingress-rate-limit-reservation.schema.json", draft);
    assert.equal(result.valid, false, "local-ingress-rate-limit-reservation schema accepted raw material, authority, or late rate-limit drift");
  }
});

test("local ingress idempotency reservations reject raw key, raw intent, authority, and late detection drift", async () => {
  await primeSchemaCache(repoRoot);
  const valid = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "local-ingress-idempotency-reservation.json"), "utf8"));

  for (const mutation of [
    (draft: typeof valid) => { draft.idempotency_key = "raw-key"; },
    (draft: typeof valid) => { draft.raw_key_persisted = true; },
    (draft: typeof valid) => { draft.raw_intent_persisted = true; },
    (draft: typeof valid) => { draft.can_authorize_actions = true; },
    (draft: typeof valid) => { draft.duplicate_detection_stage = "after_supervisor_handoff"; },
    (draft: typeof valid) => { draft.duplicate_detector = "best_effort_registry_overwrite"; },
    (draft: typeof valid) => { draft.policy_handoff = "lease_issued_by_ingress"; },
    (draft: typeof valid) => { draft.rate_limit_state = "enforced"; },
    (draft: typeof valid) => { draft.surface_id = "api"; }
  ]) {
    const draft = JSON.parse(JSON.stringify(valid));
    mutation(draft);
    const result = await validateAgainstSchema(repoRoot, "local-ingress-idempotency-reservation.schema.json", draft);
    assert.equal(result.valid, false, "local-ingress-idempotency-reservation schema accepted raw material, authority, or late duplicate detection drift");
  }
});

test("model provider readiness rejects OAuth, persistence, tool-call, and authority overclaims", async () => {
  await primeSchemaCache(repoRoot);
  const valid = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "model-provider-readiness.json"), "utf8"));

  for (const mutation of [
    (draft: typeof valid) => { draft.interfaces[0].oauth_flow_implemented = true; },
    (draft: typeof valid) => { draft.interfaces[1].connector_grant_implemented = true; },
    (draft: typeof valid) => { draft.interfaces[2].no_tools_mode = false; },
    (draft: typeof valid) => { draft.interfaces[3].tool_call_outputs_rejected = false; },
    (draft: typeof valid) => { draft.credential_boundary.credential_values_persisted = true; },
    (draft: typeof valid) => { draft.no_tools_guard.declares_provider_tools = true; },
    (draft: typeof valid) => { draft.no_tools_guard.tool_choice = "auto"; },
    (draft: typeof valid) => { draft.no_tools_guard.response_written_after_tool_call = true; },
    (draft: typeof valid) => { draft.persistence.raw_prompt_persisted = true; },
    (draft: typeof valid) => { draft.persistence.raw_model_output_persisted = true; },
    (draft: typeof valid) => { draft.authority.model_output_can_authorize_actions = true; },
    (draft: typeof valid) => { draft.authority.provider_call_can_issue_lease = true; },
    (draft: typeof valid) => { draft.limits.oauth_flows_implemented = true; },
    (draft: typeof valid) => { draft.limits.token_refresh_implemented = true; },
    (draft: typeof valid) => { draft.limits.legacy_openai_text_completions_implemented = true; },
    (draft: typeof valid) => { draft.raw_provider_secret = "sk-do-not-store"; }
  ]) {
    const draft = JSON.parse(JSON.stringify(valid));
    mutation(draft);
    const result = await validateAgainstSchema(repoRoot, "model-provider-readiness.schema.json", draft);
    assert.equal(result.valid, false, "model-provider-readiness schema accepted provider authority or raw-payload drift");
  }
});

test("supervisor lifecycle readiness rejects daemon, repair, auth, vault, and authority overclaims", async () => {
  await primeSchemaCache(repoRoot);
  const valid = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "supervisor-lifecycle-readiness.json"), "utf8"));

  for (const mutation of [
    (draft: typeof valid) => { draft.supported_runtime_modes.production_daemon = true; },
    (draft: typeof valid) => { draft.lifecycle_commands.find((entry: { command: string }) => entry.command === "supervisor start").supported = true; },
    (draft: typeof valid) => { draft.lifecycle_commands.find((entry: { command: string }) => entry.command === "supervisor recover-stale-lock").repairs_state = true; },
    (draft: typeof valid) => { draft.runtime_lock.stale_lock_repaired = true; },
    (draft: typeof valid) => { draft.runtime_lock.runtime_lock_can_authorize_actions = true; },
    (draft: typeof valid) => { draft.socket_auth_boundary.token_value_persisted = true; },
    (draft: typeof valid) => { draft.socket_auth_boundary.vault_backed_token_storage = true; },
    (draft: typeof valid) => { draft.vault_boundary.raw_secret_available_to_supervisor = true; },
    (draft: typeof valid) => { draft.vault_boundary.secret_retrieval_api_implemented = true; },
    (draft: typeof valid) => { draft.authority.lifecycle_contract_can_issue_lease = true; },
    (draft: typeof valid) => { draft.authority.socket_token_can_authorize_tools = true; },
    (draft: typeof valid) => { draft.limits.vault_backend_implemented = true; },
    (draft: typeof valid) => { draft.raw_socket_auth_token = "do-not-store"; }
  ]) {
    const draft = JSON.parse(JSON.stringify(valid));
    mutation(draft);
    const result = await validateAgainstSchema(repoRoot, "supervisor-lifecycle-readiness.schema.json", draft);
    assert.equal(result.valid, false, "supervisor-lifecycle-readiness schema accepted lifecycle authority or raw-token drift");
  }
});

test("supervisor lifecycle command reports reject daemon side effects and authority", async () => {
  await primeSchemaCache(repoRoot);
  const valid = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "supervisor-lifecycle-command.json"), "utf8"));

  for (const mutation of [
    (draft: typeof valid) => { draft.status = "started"; },
    (draft: typeof valid) => { draft.implemented = true; },
    (draft: typeof valid) => { draft.fail_closed = false; },
    (draft: typeof valid) => { draft.status_observation.mutates_ledger = true; },
    (draft: typeof valid) => { draft.status_observation.repairs_state = true; },
    (draft: typeof valid) => { draft.effects.starts_daemon = true; },
    (draft: typeof valid) => { draft.effects.stops_daemon = true; },
    (draft: typeof valid) => { draft.effects.repairs_stale_lock = true; },
    (draft: typeof valid) => { draft.effects.issues_lease = true; },
    (draft: typeof valid) => { draft.effects.resolves_vault_secret = true; },
    (draft: typeof valid) => { draft.authority.can_authorize_actions = true; },
    (draft: typeof valid) => { draft.raw_socket_auth_token = "do-not-store"; }
  ]) {
    const draft = JSON.parse(JSON.stringify(valid));
    mutation(draft);
    const result = await validateAgainstSchema(repoRoot, "supervisor-lifecycle-command.schema.json", draft);
    assert.equal(result.valid, false, "supervisor-lifecycle-command schema accepted daemon side effects or authority drift");
  }
});

test("supervisor socket auth boundary rejects token persistence, remote clients, and authority", async () => {
  await primeSchemaCache(repoRoot);
  const valid = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "supervisor-socket-auth-boundary.json"), "utf8"));

  for (const mutation of [
    (draft: typeof valid) => { draft.transport_gate.public_network_listener = true; },
    (draft: typeof valid) => { draft.transport_gate.remote_client_supported = true; },
    (draft: typeof valid) => { draft.request_auth.missing_token_rejected = false; },
    (draft: typeof valid) => { draft.request_auth.wrong_token_rejected = false; },
    (draft: typeof valid) => { draft.request_auth.token_value_echoed = true; },
    (draft: typeof valid) => { draft.request_auth.token_value_persisted = true; },
    (draft: typeof valid) => { draft.request_auth.token_hash_persisted = true; },
    (draft: typeof valid) => { draft.request_auth.auth_failure_writes_ledger = true; },
    (draft: typeof valid) => { draft.workspace_binding.workspace_mismatch_rejected = false; },
    (draft: typeof valid) => { draft.workspace_binding.mismatch_initializes_other_workspace = true; },
    (draft: typeof valid) => { draft.runtime_lock_boundary.runtime_lock_can_authorize_actions = true; },
    (draft: typeof valid) => { draft.runtime_lock_boundary.stale_lock_repair_by_auth_token = true; },
    (draft: typeof valid) => { draft.vault_boundary.vault_storage_implemented = true; },
    (draft: typeof valid) => { draft.vault_boundary.token_rotation_implemented = true; },
    (draft: typeof valid) => { draft.authority.socket_token_can_authorize_tools = true; },
    (draft: typeof valid) => { draft.authority.socket_token_can_issue_lease = true; },
    (draft: typeof valid) => { draft.authority.socket_token_can_issue_session = true; },
    (draft: typeof valid) => { draft.limits.socket_auth_lifecycle_implemented = true; },
    (draft: typeof valid) => { draft.limits.device_identity_implemented = true; },
    (draft: typeof valid) => { draft.raw_socket_auth_token = "do-not-store"; }
  ]) {
    const draft = JSON.parse(JSON.stringify(valid));
    mutation(draft);
    const result = await validateAgainstSchema(repoRoot, "supervisor-socket-auth-boundary.schema.json", draft);
    assert.equal(result.valid, false, "supervisor-socket-auth-boundary schema accepted token persistence or authority drift");
  }
});

test("agent runtime invocation artifacts round-trip through local workspace storage", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-agent-runtime-artifact-"));
  const workspace = await createWorkspace(root, "ws_agent_runtime_artifact");
  const invocation = JSON.parse(
    await readFile(join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json"), "utf8")
  );

  const ref = await writeAgentRuntimeInvocationArtifact(repoRoot, workspace, invocation);
  assert.equal(ref, agentRuntimeInvocationArtifactRef(invocation.id));
  assert.equal(ref, "artifact://agent/runtime/agent_runtime_invocation_run_example");
  assert.deepEqual(await readAgentRuntimeInvocationArtifact(root, invocation.id), invocation);
  assert.equal(await readAgentRuntimeInvocationArtifact(root, "agent_runtime_invocation_missing"), null);
});

test("agent model request, response, and response-audit artifacts round-trip through local payload refs", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-agent-model-artifacts-"));
  const workspace = await createWorkspace(root, "ws_agent_model_artifacts");
  const request = JSON.parse(
    await readFile(join(repoRoot, "examples", "contracts", "agent-model-request.json"), "utf8")
  );
  const response = JSON.parse(
    await readFile(join(repoRoot, "examples", "contracts", "agent-model-response.json"), "utf8")
  );
  const responseAudit = JSON.parse(
    await readFile(join(repoRoot, "examples", "contracts", "agent-response-audit.json"), "utf8")
  );

  const requestRef = await writeAgentModelRequestArtifact(repoRoot, workspace, request);
  const responseRef = await writeAgentModelResponseArtifact(repoRoot, workspace, response);
  const responseAuditRef = await writeAgentResponseAuditArtifact(repoRoot, workspace, responseAudit);
  assert.equal(requestRef, agentModelRequestArtifactRef(request.id));
  assert.equal(responseRef, agentModelResponseArtifactRef(response.id));
  assert.equal(responseAuditRef, agentResponseAuditArtifactRef(responseAudit.id));
  assert.equal(requestRef, "artifact://agent/model-request/agent_model_request_run_example_preview");
  assert.equal(responseRef, "artifact://agent/model-response/agent_model_response_run_example_preview");
  assert.equal(responseAuditRef, "artifact://agent/response-audit/agent_response_audit_run_example_preview");
  assert.deepEqual(await readAgentModelRequestArtifact(root, request.id), request);
  assert.deepEqual(await readAgentModelResponseArtifact(root, response.id), response);
  assert.deepEqual(await readAgentResponseAuditArtifact(root, responseAudit.id), responseAudit);
  assert.equal(await readAgentModelRequestArtifact(root, "agent_model_request_missing"), null);
  assert.equal(await readAgentModelResponseArtifact(root, "agent_model_response_missing"), null);
  assert.equal(await readAgentResponseAuditArtifact(root, "agent_response_audit_missing"), null);

  const requestEvent = eventRecord({
    id: "evt_agent_model_requested",
    workspace_id: workspace.id,
    run_id: "run_agent_model_artifacts",
    event_type: "agent.model.requested",
    actor: { type: "system", id: "test" },
    summary: "Recorded no-tools model request metadata.",
    payload_ref: requestRef
  });
  const responseEvent = eventRecord({
    id: "evt_agent_model_responded",
    workspace_id: workspace.id,
    run_id: "run_agent_model_artifacts",
    event_type: "agent.model.responded",
    actor: { type: "system", id: "test" },
    summary: "Recorded model response metadata.",
    payload_ref: responseRef
  });
  const responseAuditEvent = eventRecord({
    id: "evt_agent_response_audit_recorded",
    workspace_id: workspace.id,
    run_id: "run_agent_model_artifacts",
    event_type: "agent.response.audit.recorded",
    actor: { type: "system", id: "test" },
    summary: "Recorded local response audit metadata.",
    payload_ref: responseAuditRef
  });
  await appendEvent(repoRoot, workspace, requestEvent);
  await appendEvent(repoRoot, workspace, responseEvent);
  await appendEvent(repoRoot, workspace, responseAuditEvent);

  const audit = await auditLedgerPayloadRefs(repoRoot, root, [requestEvent, responseEvent, responseAuditEvent]);
  const requestFinding = audit.findings.find((finding) => finding.event_id === requestEvent.id);
  const responseFinding = audit.findings.find((finding) => finding.event_id === responseEvent.id);
  const responseAuditFinding = audit.findings.find((finding) => finding.event_id === responseAuditEvent.id);
  assert.equal(requestFinding?.schema_name, "agent-model-request.schema.json");
  assert.equal(requestFinding?.schema_status, "valid");
  assert.deepEqual(requestFinding?.schema_errors, []);
  assert.equal(responseFinding?.schema_name, "agent-model-response.schema.json");
  assert.equal(responseFinding?.schema_status, "valid");
  assert.deepEqual(responseFinding?.schema_errors, []);
  assert.equal(responseAuditFinding?.schema_name, "agent-response-audit.schema.json");
  assert.equal(responseAuditFinding?.schema_status, "valid");
  assert.deepEqual(responseAuditFinding?.schema_errors, []);

  const requestText = await readFile(join(root, ".aetherion", "artifacts", "agent", "model-request", `${request.id}.json`), "utf8");
  const responseText = await readFile(join(root, ".aetherion", "artifacts", "agent", "model-response", `${response.id}.json`), "utf8");
  const responseAuditText = await readFile(join(root, ".aetherion", "artifacts", "agent", "response-audit", `${responseAudit.id}.json`), "utf8");
  assert.doesNotMatch(requestText, /System Boundary/);
  assert.doesNotMatch(requestText, /Draft a local implementation plan/);
  assert.doesNotMatch(responseText, /raw model answer/i);
  assert.doesNotMatch(responseAuditText, /raw model answer/i);
  assert.equal(responseAudit.scope.raw_response_persisted, false);
  assert.equal(responseAudit.scope.raw_prompt_persisted, false);
  assert.equal(responseAudit.scope.runtime_authority_granted, false);
  assert.equal(responseAudit.authority_gates.audit_can_authorize_actions, false);
  assert.equal(responseAudit.authority_gates.audit_pass_is_runtime_verification, false);
  assert.equal(request.scope.raw_prompt_persisted, false);
  assert.equal(request.scope.raw_context_persisted, false);
  assert.equal(request.scope.secrets_resolved, false);
  assert.equal(request.authority_gates.model_request_can_authorize_actions, false);
  assert.deepEqual(request.tool_gateway.declared_tools, []);
  assert.equal(request.tool_gateway.execution_without_policy_allowed, false);
  assert.equal(response.scope.raw_response_persisted, false);
  assert.equal(response.scope.tool_execution_allowed, false);
  assert.equal(response.scope.runtime_authority_granted, false);
  assert.equal(response.authority_gates.model_output_can_authorize_actions, false);
  assert.equal(response.response_audit.may_present_as_verified_runtime_evidence, false);
});

test("agent response audit artifacts derive from hash-only response metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-agent-response-audit-derived-"));
  const workspace = await createWorkspace(root, "ws_agent_response_audit_derived");
  const request = JSON.parse(
    await readFile(join(repoRoot, "examples", "contracts", "agent-model-request.json"), "utf8")
  );
  const response = createAgentModelResponseArtifact({
    request,
    responseId: "agent_model_response_run_example_derived",
    provider_ref: "provider_local_stub",
    model_ref: "model_stub",
    output_text_sha256: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    response_payload_sha256: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    finish_reason: "stop",
    refusal_present: false,
    tool_calls_present: false,
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      total_tokens: 15,
      usage_source: "locally_estimated"
    }
  });
  const responseAudit = createAgentResponseAuditArtifact({
    response,
    auditId: "agent_response_audit_run_example_derived",
    status: "pass",
    required_block_ids: ["answer"],
    present_block_ids: ["answer"],
    missing_block_ids: [],
    required_citation_ids: ["evt_source"],
    cited_source_event_ids: ["evt_source"],
    missing_citation_ids: [],
    unknown_source_event_ids: [],
    forbidden_claims_detected: [],
    findings: [],
    next_steps: ["Response satisfies the local prompt audit contract; this is still not runtime verification."]
  });
  const responseAuditRef = await writeAgentResponseAuditArtifact(repoRoot, workspace, responseAudit);

  assert.equal(responseAuditRef, "artifact://agent/response-audit/agent_response_audit_run_example_derived");
  assert.equal(responseAudit.response_id, response.id);
  assert.equal(responseAudit.response_artifact_ref, agentModelResponseArtifactRef(response.id));
  assert.equal(responseAudit.request_id, request.id);
  assert.equal(responseAudit.request_artifact_ref, agentModelRequestArtifactRef(request.id));
  assert.equal(responseAudit.response.output_text_sha256, response.response.output_text_sha256);
  assert.equal(responseAudit.response.response_payload_sha256, response.response.response_payload_sha256);
  assert.equal(responseAudit.response.response_sha256, response.response_sha256);
  assert.equal(responseAudit.response.raw_output_persisted, false);
  assert.equal(responseAudit.scope.audit_invoked_model, false);
  assert.equal(responseAudit.scope.audit_requested_tools, false);
  assert.equal(responseAudit.scope.audit_read_raw_payload_artifacts, false);
  assert.equal(responseAudit.scope.runtime_authority_granted, false);
  assert.equal(responseAudit.authority_gates.audit_can_authorize_actions, false);
  assert.equal(responseAudit.authority_gates.audit_pass_is_runtime_verification, false);
  assert.match(responseAudit.audit_sha256, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(await readAgentResponseAuditArtifact(root, responseAudit.id), responseAudit);
});

test("agent tool request proposal artifacts derive from matched response-audit evidence without authority", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-agent-tool-proposal-"));
  const workspace = await createWorkspace(root, "ws_agent_tool_proposal");
  const responseAudit = JSON.parse(
    await readFile(join(repoRoot, "examples", "contracts", "agent-response-audit.json"), "utf8")
  );
  const proposal = createAgentToolRequestProposalArtifact({
    responseAudit,
    proposalId: "agent_tool_request_proposal_run_example_derived",
    intent: "Read README.md after reviewing the passed response audit.",
    target_uri: "workspace://README.md",
    target_label: "README.md",
    expected_effect: "Preview a possible local file read; no tool request is emitted.",
    source_evidence: {
      runtime_bound_event_id: "evt_agent_runtime_bound_example",
      model_requested_event_id: "evt_agent_model_requested_example",
      model_responded_event_id: "evt_agent_model_responded_example",
      response_audit_recorded_event_id: "evt_agent_response_audit_example"
    }
  });
  const proposalRef = await writeAgentToolRequestProposalArtifact(repoRoot, workspace, proposal);
  assert.equal(proposalRef, agentToolRequestProposalArtifactRef(proposal.id));
  assert.equal(proposalRef, "artifact://agent/tool-request-proposal/agent_tool_request_proposal_run_example_derived");
  assert.equal(proposal.response_audit_id, responseAudit.id);
  assert.equal(proposal.response_audit_artifact_ref, agentResponseAuditArtifactRef(responseAudit.id));
  assert.equal(proposal.response_id, responseAudit.response_id);
  assert.equal(proposal.request_id, responseAudit.request_id);
  assert.equal(proposal.runtime_invocation_id, responseAudit.runtime_invocation_id);
  assert.equal(proposal.scope.proposal_only, true);
  assert.equal(proposal.scope.tool_requested, false);
  assert.equal(proposal.scope.policy_decided, false);
  assert.equal(proposal.scope.lease_issued, false);
  assert.equal(proposal.scope.tool_executed, false);
  assert.equal(proposal.scope.action_recorded, false);
  assert.equal(proposal.scope.raw_response_persisted, false);
  assert.equal(proposal.scope.raw_prompt_persisted, false);
  assert.equal(proposal.scope.runtime_authority_granted, false);
  assert.equal(proposal.source_evidence.required_response_audit_status, "pass");
  assert.equal(proposal.source_evidence.response_audit_evidence_status, "matched");
  assert.deepEqual(proposal.source_evidence.source_event_ids, [
    "evt_agent_runtime_bound_example",
    "evt_agent_model_requested_example",
    "evt_agent_model_responded_example",
    "evt_agent_response_audit_example"
  ]);
  assert.equal(proposal.proposal.kind, "tool_request_preview");
  assert.equal(proposal.proposal.requested_by, "operator_restatement");
  assert.equal(proposal.proposal.operation.verb, "read");
  assert.equal(proposal.proposal.operation.target.kind, "file");
  assert.equal(proposal.proposal.operation.target.uri, "workspace://README.md");
  assert.equal(proposal.proposal.risk_inputs.side_effect, "none");
  assert.equal(proposal.proposal.risk_inputs.runtime_boundary, "local_workspace");
  assert.deepEqual(proposal.proposal.risk_inputs.taint_chain, ["user", "llm_output"]);
  assert.equal(proposal.authority_gates.proposal_can_authorize_actions, false);
  assert.equal(proposal.authority_gates.model_output_can_authorize_actions, false);
  assert.equal(proposal.authority_gates.response_audit_can_authorize_actions, false);
  assert.equal(proposal.authority_gates.requires_tool_policy_proxy, true);
  assert.equal(proposal.authority_gates.requires_fresh_policy_decision, true);
  assert.equal(proposal.authority_gates.requires_scoped_lease, true);
  assert.match(proposal.proposal_sha256, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(await readAgentToolRequestProposalArtifact(root, proposal.id), proposal);
  assert.equal(await readAgentToolRequestProposalArtifact(root, "agent_tool_request_proposal_missing"), null);

  const proposalEvent = eventRecord({
    id: "evt_agent_tool_request_proposed",
    workspace_id: workspace.id,
    run_id: "run_agent_tool_proposal",
    event_type: "agent.tool.request.proposed",
    actor: { type: "system", id: "test" },
    summary: "Recorded non-authorizing tool request proposal.",
    payload_ref: proposalRef
  });
  await appendEvent(repoRoot, workspace, proposalEvent);
  const audit = await auditLedgerPayloadRefs(repoRoot, root, [proposalEvent]);
  assert.equal(audit.summary.events_with_payload_ref, 1);
  assert.equal(audit.summary.schema_valid, 1);
  assert.equal(audit.findings[0].event_type, "agent.tool.request.proposed");
  assert.equal(audit.findings[0].schema_name, "agent-tool-request-proposal.schema.json");
  assert.equal(audit.findings[0].schema_status, "valid");
  assert.deepEqual(audit.findings[0].schema_errors, []);

  const proposalText = await readFile(join(root, ".aetherion", "artifacts", "agent", "tool-request-proposal", `${proposal.id}.json`), "utf8");
  assert.doesNotMatch(proposalText, /raw model answer/i);
  assert.doesNotMatch(proposalText, /System Boundary/);
});

test("agent response audit evidence audit matches complete non-authorizing response chains", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-agent-response-audit-evidence-"));
  const workspace = await createWorkspace(root, "ws_agent_response_audit_evidence");
  const invocation = JSON.parse(
    await readFile(join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json"), "utf8")
  );
  const request = JSON.parse(
    await readFile(join(repoRoot, "examples", "contracts", "agent-model-request.json"), "utf8")
  );
  const response = JSON.parse(
    await readFile(join(repoRoot, "examples", "contracts", "agent-model-response.json"), "utf8")
  );
  const responseAudit = JSON.parse(
    await readFile(join(repoRoot, "examples", "contracts", "agent-response-audit.json"), "utf8")
  );
  const runtimeRef = await writeAgentRuntimeInvocationArtifact(repoRoot, workspace, invocation);
  const requestRef = await writeAgentModelRequestArtifact(repoRoot, workspace, request);
  const responseRef = await writeAgentModelResponseArtifact(repoRoot, workspace, response);
  const responseAuditRef = await writeAgentResponseAuditArtifact(repoRoot, workspace, responseAudit);
  const auditRun = await createRunManifest(repoRoot, workspace, "run_response_audit_evidence", "Record response-audit evidence.");
  const runtimeEvent = eventRecord({
    id: "evt_agent_runtime_bound_for_audit_evidence",
    workspace_id: workspace.id,
    run_id: "run_runtime_binding_evidence",
    event_type: "agent.runtime.bound",
    actor: { type: "system", id: "test" },
    summary: "Bound runtime invocation for response-audit evidence.",
    payload_ref: runtimeRef
  });
  const requestEvent = eventRecord({
    id: "evt_agent_model_requested_for_audit_evidence",
    workspace_id: workspace.id,
    run_id: "run_model_request_evidence",
    event_type: "agent.model.requested",
    actor: { type: "system", id: "test" },
    summary: "Prepared model request for response-audit evidence.",
    payload_ref: requestRef
  });
  const responseEvent = eventRecord({
    id: "evt_agent_model_responded_for_audit_evidence",
    workspace_id: workspace.id,
    run_id: "run_model_response_evidence",
    event_type: "agent.model.responded",
    actor: { type: "system", id: "test" },
    summary: "Recorded model response for response-audit evidence.",
    payload_ref: responseRef
  });
  const responseAuditEvent = eventRecord({
    id: "evt_agent_response_audit_for_audit_evidence",
    workspace_id: workspace.id,
    run_id: auditRun.id,
    event_type: "agent.response.audit.recorded",
    actor: { type: "system", id: "test" },
    summary: "Recorded local response audit evidence.",
    payload_ref: responseAuditRef
  });
  await appendEvent(repoRoot, workspace, runtimeEvent);
  await appendEvent(repoRoot, workspace, requestEvent);
  await appendEvent(repoRoot, workspace, responseEvent);
  await appendEvent(repoRoot, workspace, responseAuditEvent);
  await recordRunEvent(repoRoot, workspace, auditRun, responseAuditEvent.id);
  await completeRunManifestWithEventSequence(repoRoot, workspace, auditRun, "completed", [
    { event_type: "agent.response.audit.recorded", payload_ref: responseAuditRef }
  ]);

  const evidence = await auditAgentResponseAuditEvidence(repoRoot, root, await readEvents(workspace));
  assert.equal(evidence.scope.mutates_ledger, false);
  assert.equal(evidence.scope.mutates_artifacts, false);
  assert.equal(evidence.scope.grants_runtime_authority, false);
  assert.equal(evidence.summary.audit_events, 1);
  assert.equal(evidence.summary.matched, 1);
  assert.equal(evidence.summary.missing_evidence, 0);
  assert.equal(evidence.summary.authority_violation, 0);
  assert.equal(evidence.findings[0].status, "matched");
  assert.equal(evidence.findings[0].audit_id, responseAudit.id);
  assert.equal(evidence.findings[0].source_run_id, response.run_id);
  assert.equal(evidence.findings[0].response_id, response.id);
  assert.equal(evidence.findings[0].request_id, request.id);
  assert.equal(evidence.findings[0].related_event_ids?.runtime_bound, runtimeEvent.id);
  assert.equal(evidence.findings[0].related_event_ids?.model_requested, requestEvent.id);
  assert.equal(evidence.findings[0].related_event_ids?.model_responded, responseEvent.id);
  assert.equal(evidence.findings[0].related_event_ids?.response_audit_recorded, responseAuditEvent.id);

  const missing = await auditAgentResponseAuditEvidence(repoRoot, root, [responseAuditEvent]);
  assert.equal(missing.summary.audit_events, 1);
  assert.equal(missing.summary.matched, 0);
  assert.equal(missing.summary.missing_evidence, 1);
  assert.equal(missing.findings[0].status, "missing_evidence");
  assert.match(missing.findings[0].reason ?? "", /missing agent\.model\.responded/);
  assert.match(missing.findings[0].reason ?? "", /missing agent\.model\.requested/);
  assert.match(missing.findings[0].reason ?? "", /missing agent\.runtime\.bound/);
});

test("agent model request artifacts derive from runtime invocation metadata without raw prompt persistence", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-agent-model-request-derived-"));
  const workspace = await createWorkspace(root, "ws_agent_model_request_derived");
  const invocation = JSON.parse(
    await readFile(join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json"), "utf8")
  );
  const request = createAgentModelRequestArtifact(
    invocation,
    "agent_model_request_run_example_derived"
  );
  const requestRef = await writeAgentModelRequestArtifact(repoRoot, workspace, request);

  assert.equal(requestRef, "artifact://agent/model-request/agent_model_request_run_example_derived");
  assert.equal(request.run_id, invocation.run_id);
  assert.equal(request.runtime_invocation_id, invocation.id);
  assert.equal(request.runtime_invocation_artifact_ref, agentRuntimeInvocationArtifactRef(invocation.id));
  assert.equal(request.prompt_plan_id, invocation.prompt_plan_id);
  assert.equal(request.scope.model_invoked, false);
  assert.equal(request.scope.provider_called, false);
  assert.equal(request.scope.raw_prompt_persisted, false);
  assert.equal(request.scope.raw_context_persisted, false);
  assert.equal(request.provider.provider_configured, false);
  assert.equal(request.provider.provider_ref, null);
  assert.equal(request.provider.model_ref, null);
  assert.equal(request.provider.network_call_attempted, false);
  assert.equal(request.request.mode, "no_tools_model_preview");
  assert.equal(request.request.output_mode, invocation.entry.output_mode);
  assert.deepEqual(request.request.message_order, invocation.prompt.message_order);
  assert.equal(request.request.prompt_bundle_id, invocation.prompt.bundle_id);
  assert.equal(request.request.prompt_preview_sha256, invocation.prompt.preview_sha256);
  assert.match(request.request.request_payload_sha256, /^sha256:[a-f0-9]{64}$/);
  assert.match(request.request_sha256, /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(request.request.request_payload_sha256, request.request_sha256);
  assert.deepEqual(request.prompt_hashes, invocation.prompt.message_hashes);
  assert.deepEqual(request.context.source_event_ids, invocation.context.source_event_ids);
  assert.deepEqual(request.context.selected_memory_ids, invocation.context.selected_memory_ids);
  assert.deepEqual(request.tool_gateway.declared_tools, []);
  assert.equal(request.tool_gateway.tool_choice, "none");
  assert.equal(request.tool_gateway.tool_request_events_appended, false);
  assert.equal(request.tool_gateway.execution_without_policy_allowed, false);
  assert.equal(request.authority_gates.model_request_can_authorize_actions, false);
  assert.deepEqual(request.response_expectations.required_block_ids, invocation.response_audit.required_block_ids);
  assert.deepEqual(request.response_expectations.required_citation_ids, invocation.response_audit.required_citation_ids);

  const requestText = await readFile(join(root, ".aetherion", "artifacts", "agent", "model-request", `${request.id}.json`), "utf8");
  assert.doesNotMatch(requestText, /"preview"/);
  assert.doesNotMatch(requestText, /"messages"/);
  assert.doesNotMatch(requestText, /"sections"/);
  assert.doesNotMatch(requestText, /System Boundary/);
  assert.doesNotMatch(requestText, /Draft a local implementation plan/);
});

test("stub model provider produces a deterministic auditable response without network access", async () => {
  const provider = resolveModelProvider({ env: {} });
  assert.equal(provider.provider_ref, "provider_local_stub");
  assert.equal(provider.network_capable, false);
  const result = await provider.invoke({
    provider_ref: provider.provider_ref,
    model_ref: provider.model_ref,
    output_mode: "plan",
    messages: [
      { role: "system", content: "Authority stays with the Local Supervisor." },
      { role: "developer", content: "Follow the response contract." },
      { role: "user", content: "Draft a plan grounded in evt_source_1." }
    ],
    max_output_tokens: 512,
    response_contract: {
      required_blocks: [
        { id: "evidence_summary", title: "Evidence Summary" },
        { id: "plan", title: "Plan" }
      ],
      required_citation_ids: ["evt_source_1"]
    }
  });
  assert.equal(result.finish_reason, "stop");
  assert.equal(result.refusal_present, false);
  assert.equal(result.tool_calls_present, false);
  assert.equal(result.usage.usage_source, "locally_estimated");
  assert.ok(result.usage.input_tokens > 0);
  assert.ok(result.usage.output_tokens > 0);
  assert.equal(result.usage.total_tokens, result.usage.input_tokens + result.usage.output_tokens);
  assert.match(result.output_text, /## Evidence Summary/);
  assert.match(result.output_text, /evt_source_1/);
  assert.match(result.output_text, /## Plan/);

  // The stub is deterministic for the same request.
  const repeat = await provider.invoke({
    provider_ref: provider.provider_ref,
    model_ref: provider.model_ref,
    output_mode: "plan",
    messages: [
      { role: "system", content: "Authority stays with the Local Supervisor." },
      { role: "developer", content: "Follow the response contract." },
      { role: "user", content: "Draft a plan grounded in evt_source_1." }
    ],
    max_output_tokens: 512,
    response_contract: {
      required_blocks: [
        { id: "evidence_summary", title: "Evidence Summary" },
        { id: "plan", title: "Plan" }
      ],
      required_citation_ids: ["evt_source_1"]
    }
  });
  assert.equal(repeat.output_text, result.output_text);
});

test("resolveModelProvider rejects unknown providers and selects anthropic by env", () => {
  assert.throws(() => resolveModelProvider({ env: { AETHERION_MODEL_PROVIDER: "mystery" } }), /Unknown model provider/);
  assert.equal(resolveModelProvider({ env: { AETHERION_MODEL_PROVIDER: "openai" } }).provider_ref, "provider_openai_responses");
  assert.equal(resolveModelProvider({ env: { AETHERION_MODEL_PROVIDER: "openai_completion" } }).provider_ref, "provider_openai_chat_completions");
  assert.equal(resolveModelProvider({ env: { AETHERION_MODEL_PROVIDER: "google_gemini" } }).provider_ref, "provider_gemini");
  const anthropic = resolveModelProvider({ env: { AETHERION_MODEL_PROVIDER: "anthropic", AETHERION_MODEL_REF: "claude-test" } });
  assert.equal(anthropic.provider_ref, "provider_anthropic");
  assert.equal(anthropic.model_ref, "claude-test");
  assert.equal(anthropic.network_capable, true);
});

test("live model providers map official API surfaces without persisting credentials or raw payloads", async () => {
  const messages = [
    { role: "system" as const, content: "System guardrail." },
    { role: "developer" as const, content: "Developer guardrail." },
    { role: "user" as const, content: "Answer from source events." }
  ];

  await withMockFetch({
    status: "completed",
    output_text: "OpenAI Responses output.",
    usage: { input_tokens: 11, output_tokens: 5, total_tokens: 16 }
  }, async (calls) => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "openai_responses",
        AETHERION_MODEL_REF: "gpt-test",
        OPENAI_OAUTH_ACCESS_TOKEN: "openai-oauth-token"
      }
    });
    const result = await provider.invoke({
      provider_ref: provider.provider_ref,
      model_ref: provider.model_ref,
      output_mode: "answer",
      messages,
      max_output_tokens: 77
    });
    assert.equal(provider.provider_ref, "provider_openai_responses");
    assert.equal(calls[0].url, "https://api.openai.com/v1/responses");
    assert.equal(calls[0].headers.authorization, "Bearer openai-oauth-token");
    assert.deepEqual(calls[0].body, {
      model: "gpt-test",
      input: "Answer from source events.",
      max_output_tokens: 77,
      store: false,
      instructions: "System guardrail.\n\nDeveloper guardrail."
    });
    assert.equal(result.output_text, "OpenAI Responses output.");
    assert.equal(result.usage.total_tokens, 16);
  });

  await withMockFetch({
    choices: [{ finish_reason: "stop", message: { content: "OpenAI Chat output.", refusal: null } }],
    usage: { prompt_tokens: 9, completion_tokens: 4, total_tokens: 13 }
  }, async (calls) => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "openai_chat_completions",
        AETHERION_MODEL_REF: "gpt-chat-test",
        OPENAI_API_KEY: "openai-api-key"
      }
    });
    const result = await provider.invoke({
      provider_ref: provider.provider_ref,
      model_ref: provider.model_ref,
      output_mode: "answer",
      messages,
      max_output_tokens: 88
    });
    assert.equal(provider.provider_ref, "provider_openai_chat_completions");
    assert.equal(calls[0].url, "https://api.openai.com/v1/chat/completions");
    assert.equal(calls[0].headers.authorization, "Bearer openai-api-key");
    assert.deepEqual(calls[0].body, {
      model: "gpt-chat-test",
      messages,
      max_completion_tokens: 88,
      stream: false
    });
    assert.equal(result.output_text, "OpenAI Chat output.");
    assert.equal(result.finish_reason, "stop");
    assert.equal(result.usage.input_tokens, 9);
  });

  await withMockFetch({
    content: [{ type: "text", text: "Anthropic output." }],
    stop_reason: "end_turn",
    usage: { input_tokens: 7, output_tokens: 3 }
  }, async (calls) => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "anthropic",
        AETHERION_MODEL_REF: "claude-test",
        ANTHROPIC_API_KEY: "anthropic-api-key"
      }
    });
    const result = await provider.invoke({
      provider_ref: provider.provider_ref,
      model_ref: provider.model_ref,
      output_mode: "answer",
      messages,
      max_output_tokens: 99
    });
    assert.equal(provider.provider_ref, "provider_anthropic");
    assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
    assert.equal(calls[0].headers.authorization, undefined);
    assert.equal(calls[0].headers["x-api-key"], "anthropic-api-key");
    assert.equal(calls[0].headers["anthropic-version"], "2023-06-01");
    assert.deepEqual(calls[0].body, {
      model: "claude-test",
      max_tokens: 99,
      system: "System guardrail.\n\nDeveloper guardrail.",
      messages: [{ role: "user", content: "Answer from source events." }]
    });
    assert.equal(result.output_text, "Anthropic output.");
    assert.equal(result.usage.total_tokens, 10);
  });

  await withMockFetch({
    candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Gemini output." }] } }],
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 6, totalTokenCount: 18 }
  }, async (calls) => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "gemini",
        AETHERION_MODEL_REF: "gemini-test",
        GOOGLE_OAUTH_ACCESS_TOKEN: "gemini-oauth-token"
      }
    });
    const result = await provider.invoke({
      provider_ref: provider.provider_ref,
      model_ref: provider.model_ref,
      output_mode: "answer",
      messages,
      max_output_tokens: 111
    });
    assert.equal(provider.provider_ref, "provider_gemini");
    assert.equal(calls[0].url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");
    assert.equal(calls[0].headers.authorization, "Bearer gemini-oauth-token");
    assert.deepEqual(calls[0].body, {
      contents: [{ role: "user", parts: [{ text: "Answer from source events." }] }],
      generationConfig: { maxOutputTokens: 111 },
      systemInstruction: { parts: [{ text: "System guardrail.\n\nDeveloper guardrail." }] }
    });
    assert.equal(result.output_text, "Gemini output.");
    assert.equal(result.usage.total_tokens, 18);
  });

  const missingOpenAI = resolveModelProvider({ env: { AETHERION_MODEL_PROVIDER: "openai_responses" } });
  await assert.rejects(
    missingOpenAI.invoke({
      provider_ref: missingOpenAI.provider_ref,
      model_ref: missingOpenAI.model_ref,
      output_mode: "answer",
      messages,
      max_output_tokens: 10
    }),
    /OPENAI_API_KEY, OPENAI_OAUTH_ACCESS_TOKEN/
  );
});

test("live model providers reject tool calls in no-tools mode", async () => {
  const messages = [{ role: "user" as const, content: "Answer without tools." }];
  const request = {
    provider_ref: "provider_openai_responses",
    model_ref: "model-test",
    output_mode: "answer" as const,
    messages,
    max_output_tokens: 10
  };

  await withMockFetch({
    status: "completed",
    output: [{ type: "function_call", name: "read_file", arguments: "{}" }],
    usage: { input_tokens: 3, output_tokens: 0, total_tokens: 3 }
  }, async () => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "openai_responses",
        OPENAI_API_KEY: "openai-api-key"
      }
    });
    await assert.rejects(
      provider.invoke(request),
      /provider_openai_responses returned a tool\/function call in no-tools mode/
    );
  });

  await withMockFetch({
    choices: [{
      finish_reason: "tool_calls",
      message: { content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "read_file", arguments: "{}" } }] }
    }],
    usage: { prompt_tokens: 3, completion_tokens: 0, total_tokens: 3 }
  }, async () => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "openai_chat_completions",
        OPENAI_API_KEY: "openai-api-key"
      }
    });
    await assert.rejects(
      provider.invoke(request),
      /provider_openai_chat_completions returned a tool\/function call in no-tools mode/
    );
  });

  await withMockFetch({
    content: [{ type: "tool_use", id: "toolu_1", name: "read_file", input: {} }],
    stop_reason: "tool_use",
    usage: { input_tokens: 3, output_tokens: 0 }
  }, async () => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "anthropic-api-key"
      }
    });
    await assert.rejects(
      provider.invoke(request),
      /provider_anthropic returned a tool\/function call in no-tools mode/
    );
  });

  await withMockFetch({
    candidates: [{
      finishReason: "STOP",
      content: { parts: [{ functionCall: { name: "read_file", args: {} } }] }
    }],
    usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 0, totalTokenCount: 3 }
  }, async () => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "gemini",
        GEMINI_API_KEY: "gemini-api-key"
      }
    });
    await assert.rejects(
      provider.invoke(request),
      /provider_gemini returned a tool\/function call in no-tools mode/
    );
  });
});

test("live model providers fail closed on timeout, HTTP errors, and malformed JSON", async () => {
  const messages = [{ role: "user" as const, content: "Answer from evidence." }];
  const request = {
    provider_ref: "provider_openai_responses",
    model_ref: "gpt-test",
    output_mode: "answer" as const,
    messages,
    max_output_tokens: 10
  };

  await withCustomFetch((async () => new Response("{not json", {
    status: 200,
    headers: { "content-type": "application/json" }
  })) as typeof fetch, async () => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "openai_responses",
        OPENAI_API_KEY: "openai-api-key"
      }
    });
    await assert.rejects(
      provider.invoke(request),
      /openai_responses provider returned malformed JSON/
    );
  });

  await withCustomFetch((async () => new Response(JSON.stringify({ error: { message: "provider secret body" } }), {
    status: 500,
    headers: { "content-type": "application/json" }
  })) as typeof fetch, async () => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "openai_responses",
        OPENAI_API_KEY: "openai-api-key"
      }
    });
    await assert.rejects(
      provider.invoke(request),
      (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /openai_responses provider returned HTTP 500/);
        assert.doesNotMatch(error.message, /provider secret body/);
        return true;
      }
    );
  });

  await withCustomFetch((async (_input, init) => new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    signal?.addEventListener("abort", () => reject(new Error("aborted by signal")));
  })) as typeof fetch, async () => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "openai_responses",
        OPENAI_API_KEY: "openai-api-key",
        AETHERION_MODEL_TIMEOUT_MS: "5"
      }
    });
    await assert.rejects(
      provider.invoke(request),
      /openai_responses provider network call failed: timed out after 5ms/
    );
  });
});

test("live model provider errors expose stable taxonomy without leaking provider bodies", async () => {
  assert.deepEqual(MODEL_PROVIDER_ERROR_CODES, [
    "provider_unknown",
    "provider_missing_credential",
    "provider_invalid_timeout",
    "provider_network_failure",
    "provider_timeout",
    "provider_http_error",
    "provider_malformed_json",
    "provider_tool_call_rejected"
  ]);
  const messages = [{ role: "user" as const, content: "Answer from evidence." }];
  const request = {
    provider_ref: "provider_openai_responses",
    model_ref: "gpt-test",
    output_mode: "answer" as const,
    messages,
    max_output_tokens: 10
  };

  assertModelProviderError(captureSyncError(() => resolveModelProvider({ env: { AETHERION_MODEL_PROVIDER: "mystery" } })), {
    code: "provider_unknown",
    category: "configuration",
    provider_ref: null,
    retryable: false
  });

  const missingCredentialProvider = resolveModelProvider({ env: { AETHERION_MODEL_PROVIDER: "openai_responses" } });
  assertModelProviderError(await captureAsyncError(() => missingCredentialProvider.invoke(request)), {
    code: "provider_missing_credential",
    category: "credential",
    provider_ref: "provider_openai_responses",
    retryable: false
  });

  assertModelProviderError(captureSyncError(() => resolveModelProvider({
    env: {
      AETHERION_MODEL_PROVIDER: "openai_responses",
      AETHERION_MODEL_TIMEOUT_MS: "0"
    }
  })), {
    code: "provider_invalid_timeout",
    category: "configuration",
    provider_ref: "provider_openai_responses",
    retryable: false
  });

  await withCustomFetch((async () => new Response("{not json", {
    status: 200,
    headers: { "content-type": "application/json" }
  })) as typeof fetch, async () => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "openai_responses",
        OPENAI_API_KEY: "openai-api-key"
      }
    });
    assertModelProviderError(await captureAsyncError(() => provider.invoke(request)), {
      code: "provider_malformed_json",
      category: "upstream_payload",
      provider_ref: "provider_openai_responses",
      retryable: false
    });
  });

  await withCustomFetch((async () => new Response(JSON.stringify({ error: { message: "provider secret body" } }), {
    status: 429,
    headers: { "content-type": "application/json" }
  })) as typeof fetch, async () => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "openai_responses",
        OPENAI_API_KEY: "openai-api-key"
      }
    });
    const error = assertModelProviderError(await captureAsyncError(() => provider.invoke(request)), {
      code: "provider_http_error",
      category: "upstream_http",
      provider_ref: "provider_openai_responses",
      retryable: true,
      http_status: 429
    });
    assert.match(error.message, /openai_responses provider returned HTTP 429/);
    assert.doesNotMatch(error.message, /provider secret body/);
  });

  await withCustomFetch((async () => {
    throw new Error("socket closed");
  }) as typeof fetch, async () => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "openai_responses",
        OPENAI_API_KEY: "openai-api-key"
      }
    });
    assertModelProviderError(await captureAsyncError(() => provider.invoke(request)), {
      code: "provider_network_failure",
      category: "network",
      provider_ref: "provider_openai_responses",
      retryable: true
    });
  });

  await withCustomFetch((async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted by signal")));
  })) as typeof fetch, async () => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "openai_responses",
        OPENAI_API_KEY: "openai-api-key",
        AETHERION_MODEL_TIMEOUT_MS: "5"
      }
    });
    assertModelProviderError(await captureAsyncError(() => provider.invoke(request)), {
      code: "provider_timeout",
      category: "network",
      provider_ref: "provider_openai_responses",
      retryable: true
    });
  });

  await withMockFetch({
    status: "completed",
    output: [{ type: "function_call", name: "read_file", arguments: "{}" }],
    usage: { input_tokens: 3, output_tokens: 0, total_tokens: 3 }
  }, async () => {
    const provider = resolveModelProvider({
      env: {
        AETHERION_MODEL_PROVIDER: "openai_responses",
        OPENAI_API_KEY: "openai-api-key"
      }
    });
    assertModelProviderError(await captureAsyncError(() => provider.invoke(request)), {
      code: "provider_tool_call_rejected",
      category: "no_tools_guard",
      provider_ref: "provider_openai_responses",
      retryable: false
    });
  });
});

test("agent model response artifact records hashes only and never claims audit passed", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-agent-model-response-derived-"));
  const workspace = await createWorkspace(root, "ws_agent_model_response_derived");
  const invocation = JSON.parse(
    await readFile(join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json"), "utf8")
  );
  const request = createAgentModelRequestArtifact(invocation, "agent_model_request_run_example_for_response");
  const stub = createStubProvider("stub-deterministic-v1");
  const result = await stub.invoke({
    provider_ref: stub.provider_ref,
    model_ref: stub.model_ref,
    output_mode: request.request.output_mode,
    messages: [{ role: "user", content: "Plan the task." }],
    max_output_tokens: 256
  });
  const response = createAgentModelResponseArtifact({
    request,
    responseId: "agent_model_response_run_example_for_response",
    provider_ref: stub.provider_ref,
    model_ref: stub.model_ref,
    output_text_sha256: "sha256:" + "a".repeat(64),
    response_payload_sha256: "sha256:" + "b".repeat(64),
    finish_reason: result.finish_reason,
    refusal_present: result.refusal_present,
    tool_calls_present: result.tool_calls_present,
    usage: result.usage
  });

  const responseRef = await writeAgentModelResponseArtifact(repoRoot, workspace, response);
  assert.equal(responseRef, agentModelResponseArtifactRef(response.id));
  assert.equal(response.request_id, request.id);
  assert.equal(response.request_artifact_ref, agentModelRequestArtifactRef(request.id));
  assert.equal(response.run_id, request.run_id);
  assert.equal(response.runtime_invocation_id, request.runtime_invocation_id);
  assert.equal(response.scope.model_invoked, true);
  assert.equal(response.scope.provider_called, true);
  assert.equal(response.scope.raw_response_persisted, false);
  assert.equal(response.scope.runtime_authority_granted, false);
  assert.equal(response.provider.credential_resolved, false);
  assert.equal(response.provider.credential_ref, null);
  assert.equal(response.response.raw_response_payload_persisted, false);
  assert.equal(response.response.output_artifact_ref, null);
  assert.equal(response.authority_gates.model_output_can_authorize_actions, false);
  assert.equal(response.response_audit.required, true);
  assert.equal(response.response_audit.passed, null);
  assert.equal(response.response_audit.audit_artifact_ref, null);
  assert.equal(response.response_audit.may_present_as_verified_runtime_evidence, false);
  assert.match(response.response_sha256, /^sha256:[a-f0-9]{64}$/);
  assert.equal(response.usage.usage_source, "locally_estimated");

  // The persisted artifact must round-trip and validate against the schema.
  const validation = await validateAgainstSchema(repoRoot, "agent-model-response.schema.json", response);
  assert.equal(validation.valid, true, validation.errors.join("; "));
  assert.deepEqual(await readAgentModelResponseArtifact(root, response.id), response);
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

  const modelRequest = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "agent-model-request.json"), "utf8"));
  modelRequest.scope.raw_prompt_persisted = true;
  modelRequest.tool_gateway.declared_tools = ["filesystem.read"];
  modelRequest.authority_gates.model_request_can_authorize_actions = true;
  const modelRequestValidation = await validateAgainstSchema(repoRoot, "agent-model-request.schema.json", modelRequest);
  assert.equal(modelRequestValidation.valid, false);
  assert.ok(modelRequestValidation.errors.some((error) => error.includes("expected one of false")));
  assert.ok(modelRequestValidation.errors.some((error) => error.includes("expected at most 0 items")));

  const modelRequestRoleOrder = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "agent-model-request.json"), "utf8"));
  modelRequestRoleOrder.prompt_hashes = [
    modelRequestRoleOrder.prompt_hashes[1],
    modelRequestRoleOrder.prompt_hashes[0],
    modelRequestRoleOrder.prompt_hashes[2]
  ];
  const modelRequestRoleOrderValidation = await validateAgainstSchema(repoRoot, "agent-model-request.schema.json", modelRequestRoleOrder);
  assert.equal(modelRequestRoleOrderValidation.valid, false);
  assert.ok(modelRequestRoleOrderValidation.errors.some((error) => error.includes("expected one of system")));
  assert.ok(modelRequestRoleOrderValidation.errors.some((error) => error.includes("expected one of developer")));

  const modelResponse = JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "agent-model-response.json"), "utf8"));
  modelResponse.scope.tool_execution_allowed = true;
  modelResponse.authority_gates.model_output_can_authorize_actions = true;
  modelResponse.response_audit.may_present_as_verified_runtime_evidence = true;
  const modelResponseValidation = await validateAgainstSchema(repoRoot, "agent-model-response.schema.json", modelResponse);
  assert.equal(modelResponseValidation.valid, false);
  assert.ok(modelResponseValidation.errors.some((error) => error.includes("expected one of false")));

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
  await assert.rejects(
    callSupervisorRpcWithSocketResponse("{\"jsonrpc\":\"2.0\",\"id\":\"rpc_wrong\",\"result\":{\"accepted\":true}}\n"),
    /response id mismatch: expected rpc_expected, got rpc_wrong/
  );
});

test("supervisor RPC client rejects malformed response envelopes", async () => {
  if (process.platform === "win32") {
    return;
  }
  await assert.rejects(
    callSupervisorRpcWithSocketResponse("{\"jsonrpc\":\"2.0\",\"id\":\"rpc_expected\",\"result\":{\"accepted\":true}\n"),
    /response rpc_expected returned invalid JSON/
  );
  await assert.rejects(
    callSupervisorRpcWithSocketResponse("{\"jsonrpc\":\"1.0\",\"id\":\"rpc_expected\",\"result\":{\"accepted\":true}}\n"),
    /returned invalid jsonrpc version/
  );
  await assert.rejects(
    callSupervisorRpcWithSocketResponse("{\"jsonrpc\":\"2.0\",\"id\":\"rpc_expected\"}\n"),
    /included neither result nor error/
  );
  await assert.rejects(
    callSupervisorRpcWithSocketResponse("{\"jsonrpc\":\"2.0\",\"id\":\"rpc_expected\",\"error\":{\"message\":\"bad\"}}\n"),
    /included an invalid error/
  );
  await assert.rejects(
    callSupervisorRpcWithSocketResponse("{\"jsonrpc\":\"2.0\",\"id\":\"rpc_expected\",\"error\":\"\"}\n"),
    /included an invalid error/
  );
  await assert.rejects(
    callSupervisorRpcWithSocketResponse("{\"jsonrpc\":\"2.0\",\"id\":\"rpc_expected\",\"error\":\"   \"}\n"),
    /included an invalid error/
  );
  await assert.rejects(
    callSupervisorRpcWithSocketResponse("{\"jsonrpc\":\"2.0\",\"id\":\"rpc_expected\",\"result\":{\"accepted\":true},\"error\":\"ambiguous\"}\n"),
    /included both result and error/
  );
});

test("supervisor RPC client rejects duplicate response envelope fields", async () => {
  if (process.platform === "win32") {
    return;
  }
  await assert.rejects(
    callSupervisorRpcWithSocketResponse("{\"jsonrpc\":\"2.0\",\"id\":\"rpc_shadow\",\"id\":\"rpc_expected\",\"result\":{\"accepted\":true}}\n"),
    /included duplicate envelope field id/
  );
  await assert.rejects(
    callSupervisorRpcWithSocketResponse("{\"jsonrpc\":\"2.0\",\"id\":\"rpc_expected\",\"result\":{\"accepted\":false},\"result\":{\"accepted\":true}}\n"),
    /included duplicate envelope field result/
  );
});

test("supervisor RPC client rejects multiple response lines", async () => {
  if (process.platform === "win32") {
    return;
  }
  await assert.rejects(
    callSupervisorRpcWithSocketResponse([
      "{\"jsonrpc\":\"2.0\",\"id\":\"rpc_expected\",\"result\":{\"accepted\":true}}",
      "{\"jsonrpc\":\"2.0\",\"id\":\"rpc_expected\",\"result\":{\"accepted\":false}}",
      ""
    ].join("\n")),
    /returned multiple response lines/
  );
});

test("supervisor RPC client reports process failures without raw stdout leakage", async () => {
  if (process.platform === "win32") {
    return;
  }
  const root = await mkdtemp(join(tmpdir(), "aetherion-supervisor-failure-"));
  await mkdir(join(root, "target", "debug"), { recursive: true });
  await mkdir(join(root, "crates", "supervisor", "src"), { recursive: true });
  await writeFile(join(root, "crates", "supervisor", "Cargo.toml"), "[package]\nname = \"fake\"\n");
  await writeFile(join(root, "crates", "supervisor", "src", "lib.rs"), "");
  await writeFile(join(root, "crates", "supervisor", "src", "main.rs"), "");
  const supervisor = join(root, "target", "debug", "aetherion-supervisor");
  await writeFile(supervisor, "#!/bin/sh\necho '{\"result\":\"private file contents\"}'\nexit 1\n");
  await chmod(supervisor, 0o755);

  await assert.rejects(
    callSupervisorRpc(root, {
      id: "rpc_expected",
      method: "workspace.init",
      workspace_root: root,
      workspace_id: "ws_fake_failure",
      run_id: "run_fake_failure"
    }),
    (error) => {
      const message = String((error as Error).message);
      assert.match(message, /supervisor rpc workspace\.init failed/);
      assert.match(message, /exit_code=1/);
      assert.match(message, /stdout_lines=1/);
      assert.match(message, /stderr=<empty>/);
      assert.doesNotMatch(message, /private file contents/);
      return true;
    }
  );
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

test("security scan run manifests require taint policy and scan artifact refs", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-security-lifecycle-"));
  const workspace = await createWorkspace(root, "ws_security_lifecycle_guard");
  const assessmentRef = "artifact://security/scan/assessment_guard";
  const signalRef = "artifact://security/scan/poison_guard";

  const wrongPayloadRunId = "run_security_wrong_payload";
  const wrongPayloadManifest = await createRunManifest(repoRoot, workspace, wrongPayloadRunId, "Security lifecycle payload guard");
  const wrongPayloadEvents = [
    eventRecord({
      id: "evt_security_wrong_policy",
      workspace_id: workspace.id,
      run_id: wrongPayloadRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Denied tainted content without lease."
    }),
    eventRecord({
      id: "evt_security_wrong_assessment",
      workspace_id: workspace.id,
      run_id: wrongPayloadRunId,
      event_type: "security.content.assessed",
      actor: { type: "system", id: "test" },
      summary: "Recorded mismatched assessment.",
      payload_ref: "artifact://security/scan/assessment_other"
    }),
    eventRecord({
      id: "evt_security_wrong_signal",
      workspace_id: workspace.id,
      run_id: wrongPayloadRunId,
      event_type: "poisoning.detected",
      actor: { type: "system", id: "test" },
      summary: "Recorded poisoning signal.",
      payload_ref: signalRef
    })
  ];
  for (const event of wrongPayloadEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, wrongPayloadManifest, event.id);
  }
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, wrongPayloadManifest, "blocked", securityScanBlockedEventSequence(assessmentRef, signalRef)),
    /expected payload_ref artifact:\/\/security\/scan\/assessment_guard/
  );

  const leaseRunId = "run_security_with_lease";
  const leaseManifest = await createRunManifest(repoRoot, workspace, leaseRunId, "Security lifecycle lease guard");
  const leaseEvents = [
    eventRecord({
      id: "evt_security_lease_policy",
      workspace_id: workspace.id,
      run_id: leaseRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Denied tainted content without lease."
    }),
    eventRecord({
      id: "evt_security_lease_issued",
      workspace_id: workspace.id,
      run_id: leaseRunId,
      event_type: "lease.issued",
      actor: { type: "system", id: "test" },
      summary: "Invalid lease for security scan."
    }),
    eventRecord({
      id: "evt_security_lease_assessment",
      workspace_id: workspace.id,
      run_id: leaseRunId,
      event_type: "security.content.assessed",
      actor: { type: "system", id: "test" },
      summary: "Recorded assessment.",
      payload_ref: assessmentRef
    }),
    eventRecord({
      id: "evt_security_lease_signal",
      workspace_id: workspace.id,
      run_id: leaseRunId,
      event_type: "poisoning.detected",
      actor: { type: "system", id: "test" },
      summary: "Recorded poisoning signal.",
      payload_ref: signalRef
    })
  ];
  for (const event of leaseEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, leaseManifest, event.id);
  }
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, leaseManifest, "blocked", securityScanBlockedEventSequence(assessmentRef, signalRef)),
    /expected lifecycle policy\.decided -> security\.content\.assessed -> poisoning\.detected, got policy\.decided -> lease\.issued -> security\.content\.assessed -> poisoning\.detected/
  );

  const validRunId = "run_security_lifecycle_guard";
  const validManifest = await createRunManifest(repoRoot, workspace, validRunId, "Security lifecycle guard");
  const validEvents = [
    eventRecord({
      id: "evt_security_valid_policy",
      workspace_id: workspace.id,
      run_id: validRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Denied tainted content without lease."
    }),
    eventRecord({
      id: "evt_security_valid_assessment",
      workspace_id: workspace.id,
      run_id: validRunId,
      event_type: "security.content.assessed",
      actor: { type: "system", id: "test" },
      summary: "Recorded assessment.",
      payload_ref: assessmentRef
    }),
    eventRecord({
      id: "evt_security_valid_signal",
      workspace_id: workspace.id,
      run_id: validRunId,
      event_type: "poisoning.detected",
      actor: { type: "system", id: "test" },
      summary: "Recorded poisoning signal.",
      payload_ref: signalRef
    })
  ];
  for (const event of validEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, validManifest, event.id);
  }
  await completeRunManifestWithEventSequence(repoRoot, workspace, validManifest, "blocked", securityScanBlockedEventSequence(assessmentRef, signalRef));

  const completed = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${validRunId}.json`), "utf8")) as { status: string; event_ids: string[] };
  assert.equal(completed.status, "blocked");
  assert.deepEqual(completed.event_ids, validEvents.map((event) => event.id));
});

test("browser observation run manifests require taint policy and observation artifact refs", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-browser-lifecycle-"));
  const workspace = await createWorkspace(root, "ws_browser_lifecycle_guard");
  const observationRef = "artifact://surface/browser-observe/browser_obs_guard";

  const wrongPolicyPayloadRunId = "run_browser_wrong_policy_payload";
  const wrongPolicyPayloadManifest = await createRunManifest(repoRoot, workspace, wrongPolicyPayloadRunId, "Browser observation policy payload guard");
  const wrongPolicyPayloadEvents = [
    eventRecord({
      id: "evt_browser_wrong_policy_payload",
      workspace_id: workspace.id,
      run_id: wrongPolicyPayloadRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Denied tainted browser content without authority.",
      payload_ref: "artifact://surface/browser-observe/not_policy_evidence"
    }),
    eventRecord({
      id: "evt_browser_wrong_policy_observation",
      workspace_id: workspace.id,
      run_id: wrongPolicyPayloadRunId,
      event_type: "browser.observation.ingested",
      actor: { type: "system", id: "test" },
      summary: "Recorded hash-only browser observation.",
      payload_ref: observationRef
    })
  ];
  for (const event of wrongPolicyPayloadEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, wrongPolicyPayloadManifest, event.id);
  }
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, wrongPolicyPayloadManifest, "completed", browserObservationEventSequence(observationRef)),
    /expected no payload_ref, got artifact:\/\/surface\/browser-observe\/not_policy_evidence/
  );

  const wrongObservationPayloadRunId = "run_browser_wrong_observation_payload";
  const wrongObservationPayloadManifest = await createRunManifest(repoRoot, workspace, wrongObservationPayloadRunId, "Browser observation artifact guard");
  const wrongObservationPayloadEvents = [
    eventRecord({
      id: "evt_browser_wrong_observation_policy",
      workspace_id: workspace.id,
      run_id: wrongObservationPayloadRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Denied tainted browser content without authority."
    }),
    eventRecord({
      id: "evt_browser_wrong_observation_payload",
      workspace_id: workspace.id,
      run_id: wrongObservationPayloadRunId,
      event_type: "browser.observation.ingested",
      actor: { type: "system", id: "test" },
      summary: "Recorded mismatched browser observation.",
      payload_ref: "artifact://surface/browser-observe/browser_obs_other"
    })
  ];
  for (const event of wrongObservationPayloadEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, wrongObservationPayloadManifest, event.id);
  }
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, wrongObservationPayloadManifest, "completed", browserObservationEventSequence(observationRef)),
    /expected payload_ref artifact:\/\/surface\/browser-observe\/browser_obs_guard/
  );

  const leaseRunId = "run_browser_with_lease";
  const leaseManifest = await createRunManifest(repoRoot, workspace, leaseRunId, "Browser observation lifecycle lease guard");
  const leaseEvents = [
    eventRecord({
      id: "evt_browser_lease_policy",
      workspace_id: workspace.id,
      run_id: leaseRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Denied tainted browser content without authority."
    }),
    eventRecord({
      id: "evt_browser_lease_issued",
      workspace_id: workspace.id,
      run_id: leaseRunId,
      event_type: "lease.issued",
      actor: { type: "system", id: "test" },
      summary: "Invalid lease for browser observation."
    }),
    eventRecord({
      id: "evt_browser_lease_observation",
      workspace_id: workspace.id,
      run_id: leaseRunId,
      event_type: "browser.observation.ingested",
      actor: { type: "system", id: "test" },
      summary: "Recorded hash-only browser observation.",
      payload_ref: observationRef
    })
  ];
  for (const event of leaseEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, leaseManifest, event.id);
  }
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, leaseManifest, "completed", browserObservationEventSequence(observationRef)),
    /expected lifecycle policy\.decided -> browser\.observation\.ingested, got policy\.decided -> lease\.issued -> browser\.observation\.ingested/
  );

  const validRunId = "run_browser_lifecycle_guard";
  const validManifest = await createRunManifest(repoRoot, workspace, validRunId, "Browser observation lifecycle guard");
  const validEvents = [
    eventRecord({
      id: "evt_browser_lifecycle_0",
      workspace_id: workspace.id,
      run_id: validRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Denied tainted browser content without authority."
    }),
    eventRecord({
      id: "evt_browser_lifecycle_1",
      workspace_id: workspace.id,
      run_id: validRunId,
      event_type: "browser.observation.ingested",
      actor: { type: "system", id: "test" },
      summary: "Recorded hash-only browser observation.",
      payload_ref: observationRef
    })
  ];
  assert.deepEqual(validEvents.map((event) => event.event_type), [...BROWSER_OBSERVATION_EVENT_TYPES]);
  for (const event of validEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, validManifest, event.id);
  }
  await completeRunManifestWithEventSequence(repoRoot, workspace, validManifest, "completed", browserObservationEventSequence(observationRef));

  const completed = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${validRunId}.json`), "utf8")) as { status: string; event_ids: string[] };
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.event_ids, validEvents.map((event) => event.id));
});

test("IM outbox run manifests require policy and outbox artifact refs", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-outbox-lifecycle-"));
  const workspace = await createWorkspace(root, "ws_outbox_lifecycle_guard");
  const outboxRef = "artifact://surface/im-outbox/outbox_guard";

  const wrongPolicyPayloadRunId = "run_outbox_wrong_policy_payload";
  const wrongPolicyPayloadManifest = await createRunManifest(repoRoot, workspace, wrongPolicyPayloadRunId, "Outbox policy payload guard");
  const wrongPolicyPayloadEvents = [
    eventRecord({
      id: "evt_outbox_wrong_policy_payload",
      workspace_id: workspace.id,
      run_id: wrongPolicyPayloadRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Queued outbox item without delivery or lease.",
      payload_ref: "artifact://surface/im-outbox/not_policy_evidence"
    }),
    eventRecord({
      id: "evt_outbox_wrong_policy_queued",
      workspace_id: workspace.id,
      run_id: wrongPolicyPayloadRunId,
      event_type: "im.outbox.queued",
      actor: { type: "system", id: "test" },
      summary: "Recorded hash-only outbox item.",
      payload_ref: outboxRef
    })
  ];
  for (const event of wrongPolicyPayloadEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, wrongPolicyPayloadManifest, event.id);
  }
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, wrongPolicyPayloadManifest, "blocked", imOutboxEventSequence(outboxRef)),
    /expected no payload_ref, got artifact:\/\/surface\/im-outbox\/not_policy_evidence/
  );

  const wrongOutboxPayloadRunId = "run_outbox_wrong_payload";
  const wrongOutboxPayloadManifest = await createRunManifest(repoRoot, workspace, wrongOutboxPayloadRunId, "Outbox artifact guard");
  const wrongOutboxPayloadEvents = [
    eventRecord({
      id: "evt_outbox_wrong_payload_policy",
      workspace_id: workspace.id,
      run_id: wrongOutboxPayloadRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Queued outbox item without delivery or lease."
    }),
    eventRecord({
      id: "evt_outbox_wrong_payload_queued",
      workspace_id: workspace.id,
      run_id: wrongOutboxPayloadRunId,
      event_type: "im.outbox.queued",
      actor: { type: "system", id: "test" },
      summary: "Recorded mismatched outbox item.",
      payload_ref: "artifact://surface/im-outbox/outbox_other"
    })
  ];
  for (const event of wrongOutboxPayloadEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, wrongOutboxPayloadManifest, event.id);
  }
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, wrongOutboxPayloadManifest, "blocked", imOutboxEventSequence(outboxRef)),
    /expected payload_ref artifact:\/\/surface\/im-outbox\/outbox_guard/
  );

  const leaseRunId = "run_outbox_with_lease";
  const leaseManifest = await createRunManifest(repoRoot, workspace, leaseRunId, "Outbox lifecycle lease guard");
  const leaseEvents = [
    eventRecord({
      id: "evt_outbox_lease_policy",
      workspace_id: workspace.id,
      run_id: leaseRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Queued outbox item without delivery or lease."
    }),
    eventRecord({
      id: "evt_outbox_lease_issued",
      workspace_id: workspace.id,
      run_id: leaseRunId,
      event_type: "lease.issued",
      actor: { type: "system", id: "test" },
      summary: "Invalid lease for queued outbox item."
    }),
    eventRecord({
      id: "evt_outbox_lease_queued",
      workspace_id: workspace.id,
      run_id: leaseRunId,
      event_type: "im.outbox.queued",
      actor: { type: "system", id: "test" },
      summary: "Recorded hash-only outbox item.",
      payload_ref: outboxRef
    })
  ];
  for (const event of leaseEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, leaseManifest, event.id);
  }
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, leaseManifest, "blocked", imOutboxEventSequence(outboxRef)),
    /expected lifecycle policy\.decided -> im\.outbox\.queued, got policy\.decided -> lease\.issued -> im\.outbox\.queued/
  );

  const queuedRunId = "run_outbox_queued_lifecycle_guard";
  const queuedManifest = await createRunManifest(repoRoot, workspace, queuedRunId, "Queued outbox lifecycle guard");
  const queuedEvents = [
    eventRecord({
      id: "evt_outbox_queued_lifecycle_0",
      workspace_id: workspace.id,
      run_id: queuedRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Queued outbox item for one scoped approval without lease."
    }),
    eventRecord({
      id: "evt_outbox_queued_lifecycle_1",
      workspace_id: workspace.id,
      run_id: queuedRunId,
      event_type: "im.outbox.queued",
      actor: { type: "system", id: "test" },
      summary: "Recorded hash-only queued outbox item.",
      payload_ref: outboxRef
    })
  ];
  assert.deepEqual(queuedEvents.map((event) => event.event_type), [...IM_OUTBOX_EVENT_TYPES]);
  for (const event of queuedEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, queuedManifest, event.id);
  }
  await completeRunManifestWithEventSequence(repoRoot, workspace, queuedManifest, "blocked", imOutboxEventSequence(outboxRef));
  const queuedCompleted = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${queuedRunId}.json`), "utf8")) as { status: string; event_ids: string[] };
  assert.equal(queuedCompleted.status, "blocked");
  assert.deepEqual(queuedCompleted.event_ids, queuedEvents.map((event) => event.id));

  const publicBlockedRef = "artifact://surface/im-outbox/outbox_public_guard";
  const publicBlockedRunId = "run_outbox_public_blocked_lifecycle_guard";
  const publicBlockedManifest = await createRunManifest(repoRoot, workspace, publicBlockedRunId, "Public blocked outbox lifecycle guard");
  const publicBlockedEvents = [
    eventRecord({
      id: "evt_outbox_public_blocked_lifecycle_0",
      workspace_id: workspace.id,
      run_id: publicBlockedRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Denied public outbox item without delivery or lease."
    }),
    eventRecord({
      id: "evt_outbox_public_blocked_lifecycle_1",
      workspace_id: workspace.id,
      run_id: publicBlockedRunId,
      event_type: "im.outbox.queued",
      actor: { type: "system", id: "test" },
      summary: "Recorded hash-only blocked public outbox item.",
      payload_ref: publicBlockedRef
    })
  ];
  assert.deepEqual(publicBlockedEvents.map((event) => event.event_type), [...IM_OUTBOX_EVENT_TYPES]);
  for (const event of publicBlockedEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, publicBlockedManifest, event.id);
  }
  await completeRunManifestWithEventSequence(repoRoot, workspace, publicBlockedManifest, "completed", imOutboxEventSequence(publicBlockedRef));
  const publicBlockedCompleted = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${publicBlockedRunId}.json`), "utf8")) as { status: string; event_ids: string[] };
  assert.equal(publicBlockedCompleted.status, "completed");
  assert.deepEqual(publicBlockedCompleted.event_ids, publicBlockedEvents.map((event) => event.id));
});

test("child read run manifests require explicit success and denial lifecycles", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-child-read-lifecycle-"));
  const workspace = await createWorkspace(root, "ws_child_read_lifecycle_guard");
  const contractRef = "artifact://agent/contract/contract_guard";
  const childResultRef = "artifact://agent/execute/child_result_run_child_guard";
  const denialRef = "artifact://agent/execute/account_denial_guard";
  const breakerRef = "artifact://agent/execute/breaker_denial_guard";

  const missingLeaseRunId = "run_child_missing_lease";
  const missingLeaseManifest = await createRunManifest(repoRoot, workspace, missingLeaseRunId, "Child read missing lease guard");
  const missingLeaseEvents = [
    eventRecord({
      id: "evt_child_missing_lease_started",
      workspace_id: workspace.id,
      run_id: missingLeaseRunId,
      event_type: "agent.child.started",
      actor: { type: "system", id: "test" },
      summary: "Started child read.",
      payload_ref: contractRef
    }),
    eventRecord({
      id: "evt_child_missing_lease_requested",
      workspace_id: workspace.id,
      run_id: missingLeaseRunId,
      event_type: "tool.requested",
      actor: { type: "agent", id: "test" },
      summary: "Requested child read."
    }),
    eventRecord({
      id: "evt_child_missing_lease_risk",
      workspace_id: workspace.id,
      run_id: missingLeaseRunId,
      event_type: "risk.composed",
      actor: { type: "system", id: "test" },
      summary: "Composed child read risk."
    }),
    eventRecord({
      id: "evt_child_missing_lease_policy",
      workspace_id: workspace.id,
      run_id: missingLeaseRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Allowed child read."
    }),
    eventRecord({
      id: "evt_child_missing_lease_result",
      workspace_id: workspace.id,
      run_id: missingLeaseRunId,
      event_type: "tool.result",
      actor: { type: "system", id: "test" },
      summary: "Read completed."
    }),
    eventRecord({
      id: "evt_child_missing_lease_completed",
      workspace_id: workspace.id,
      run_id: missingLeaseRunId,
      event_type: "agent.child.completed",
      actor: { type: "system", id: "test" },
      summary: "Completed child read.",
      payload_ref: childResultRef
    })
  ];
  for (const event of missingLeaseEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, missingLeaseManifest, event.id);
  }
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, missingLeaseManifest, "completed", childReadCompletedEventSequence(contractRef, childResultRef)),
    /expected lifecycle agent\.child\.started -> tool\.requested -> risk\.composed -> policy\.decided -> lease\.issued -> tool\.result -> agent\.child\.completed/
  );

  const wrongResultRefRunId = "run_child_wrong_result_ref";
  const wrongResultRefManifest = await createRunManifest(repoRoot, workspace, wrongResultRefRunId, "Child read result artifact guard");
  const wrongResultRefEvents = childReadEvents({
    workspaceId: workspace.id,
    runId: wrongResultRefRunId,
    prefix: "evt_child_wrong_result_ref",
    contractRef,
    childResultRef: "artifact://agent/execute/child_result_other"
  });
  for (const event of wrongResultRefEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, wrongResultRefManifest, event.id);
  }
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, wrongResultRefManifest, "completed", childReadCompletedEventSequence(contractRef, childResultRef)),
    /expected payload_ref artifact:\/\/agent\/execute\/child_result_run_child_guard/
  );

  const validRunId = "run_child_lifecycle_guard";
  const validManifest = await createRunManifest(repoRoot, workspace, validRunId, "Child read lifecycle guard");
  const validEvents = childReadEvents({
    workspaceId: workspace.id,
    runId: validRunId,
    prefix: "evt_child_valid",
    contractRef,
    childResultRef
  });
  assert.deepEqual(validEvents.map((event) => event.event_type), [...CHILD_READ_COMPLETED_EVENT_TYPES]);
  for (const event of validEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, validManifest, event.id);
  }
  await completeRunManifestWithEventSequence(repoRoot, workspace, validManifest, "completed", childReadCompletedEventSequence(contractRef, childResultRef));
  const completed = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${validRunId}.json`), "utf8")) as { status: string; event_ids: string[] };
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.event_ids, validEvents.map((event) => event.id));

  const denialWithLeaseRunId = "run_child_denial_with_lease";
  const denialWithLeaseManifest = await createRunManifest(repoRoot, workspace, denialWithLeaseRunId, "Child read denial lease guard");
  const denialWithLeaseEvents = [
    ...childReadPolicyDeniedEvents({
      workspaceId: workspace.id,
      runId: denialWithLeaseRunId,
      prefix: "evt_child_denial_with_lease",
      contractRef,
      denialRef
    }).slice(0, 4),
    eventRecord({
      id: "evt_child_denial_with_lease_lease",
      workspace_id: workspace.id,
      run_id: denialWithLeaseRunId,
      event_type: "lease.issued",
      actor: { type: "system", id: "test" },
      summary: "Invalid lease for denied child read."
    }),
    ...childReadPolicyDeniedEvents({
      workspaceId: workspace.id,
      runId: denialWithLeaseRunId,
      prefix: "evt_child_denial_with_lease_tail",
      contractRef,
      denialRef
    }).slice(4)
  ];
  for (const event of denialWithLeaseEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, denialWithLeaseManifest, event.id);
  }
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, denialWithLeaseManifest, "blocked", childReadPolicyDeniedEventSequence(contractRef, denialRef)),
    /expected lifecycle agent\.child\.started -> tool\.requested -> risk\.composed -> policy\.decided -> tool\.result -> agent\.child\.policy_denied/
  );

  const denialRunId = "run_child_policy_denied_lifecycle_guard";
  const denialManifest = await createRunManifest(repoRoot, workspace, denialRunId, "Child read policy denial lifecycle guard");
  const denialEvents = childReadPolicyDeniedEvents({
    workspaceId: workspace.id,
    runId: denialRunId,
    prefix: "evt_child_denial_valid",
    contractRef,
    denialRef
  });
  assert.deepEqual(denialEvents.map((event) => event.event_type), [...CHILD_READ_POLICY_DENIED_EVENT_TYPES]);
  for (const event of denialEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, denialManifest, event.id);
  }
  await completeRunManifestWithEventSequence(repoRoot, workspace, denialManifest, "blocked", childReadPolicyDeniedEventSequence(contractRef, denialRef));
  const denialCompleted = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${denialRunId}.json`), "utf8")) as { status: string; event_ids: string[] };
  assert.equal(denialCompleted.status, "blocked");
  assert.deepEqual(denialCompleted.event_ids, denialEvents.map((event) => event.id));

  const repeatedDenialRunId = "run_child_repeated_denial_lifecycle_guard";
  const repeatedDenialManifest = await createRunManifest(repoRoot, workspace, repeatedDenialRunId, "Child read repeated denial lifecycle guard");
  const repeatedDenialEvents = [
    ...childReadPolicyDeniedEvents({
      workspaceId: workspace.id,
      runId: repeatedDenialRunId,
      prefix: "evt_child_repeated_denial",
      contractRef,
      denialRef
    }),
    eventRecord({
      id: "evt_child_repeated_denial_breaker",
      workspace_id: workspace.id,
      run_id: repeatedDenialRunId,
      event_type: "circuit.opened",
      actor: { type: "system", id: "test" },
      summary: "Opened repeated-denial breaker.",
      payload_ref: breakerRef
    })
  ];
  assert.deepEqual(repeatedDenialEvents.map((event) => event.event_type), [...CHILD_READ_REPEATED_DENIAL_EVENT_TYPES]);
  for (const event of repeatedDenialEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, repeatedDenialManifest, event.id);
  }
  await completeRunManifestWithEventSequence(repoRoot, workspace, repeatedDenialManifest, "blocked", childReadRepeatedDenialEventSequence(contractRef, denialRef, breakerRef));
  const repeatedDenialCompleted = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${repeatedDenialRunId}.json`), "utf8")) as { status: string; event_ids: string[] };
  assert.equal(repeatedDenialCompleted.status, "blocked");
  assert.deepEqual(repeatedDenialCompleted.event_ids, repeatedDenialEvents.map((event) => event.id));

  const preExecutionBreakerRunId = "run_child_pre_execution_breaker_guard";
  const preExecutionBreakerManifest = await createRunManifest(repoRoot, workspace, preExecutionBreakerRunId, "Child pre-execution breaker lifecycle guard");
  const preExecutionBreakerEvents = [
    eventRecord({
      id: "evt_child_pre_execution_started",
      workspace_id: workspace.id,
      run_id: preExecutionBreakerRunId,
      event_type: "agent.child.started",
      actor: { type: "system", id: "test" },
      summary: "Started child pre-execution guard.",
      payload_ref: contractRef
    }),
    eventRecord({
      id: "evt_child_pre_execution_breaker",
      workspace_id: workspace.id,
      run_id: preExecutionBreakerRunId,
      event_type: "circuit.opened",
      actor: { type: "system", id: "test" },
      summary: "Opened pre-execution breaker.",
      payload_ref: breakerRef
    })
  ];
  assert.deepEqual(preExecutionBreakerEvents.map((event) => event.event_type), [...CHILD_READ_PRE_EXECUTION_BREAKER_EVENT_TYPES]);
  for (const event of preExecutionBreakerEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, preExecutionBreakerManifest, event.id);
  }
  await completeRunManifestWithEventSequence(repoRoot, workspace, preExecutionBreakerManifest, "blocked", childReadPreExecutionBreakerEventSequence(contractRef, breakerRef));
  const preExecutionCompleted = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${preExecutionBreakerRunId}.json`), "utf8")) as { status: string; event_ids: string[] };
  assert.equal(preExecutionCompleted.status, "blocked");
  assert.deepEqual(preExecutionCompleted.event_ids, preExecutionBreakerEvents.map((event) => event.id));

  const wrongBreakerRefRunId = "run_child_pre_execution_wrong_breaker_ref";
  const wrongBreakerRefManifest = await createRunManifest(repoRoot, workspace, wrongBreakerRefRunId, "Child pre-execution breaker artifact guard");
  const wrongBreakerRefEvents = preExecutionBreakerEvents.map((event) => ({
    ...event,
    id: event.id.replace("pre_execution", "wrong_breaker_ref"),
    run_id: wrongBreakerRefRunId,
    payload_ref: event.event_type === "circuit.opened" ? "artifact://agent/execute/breaker_other" : event.payload_ref
  }));
  for (const event of wrongBreakerRefEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, wrongBreakerRefManifest, event.id);
  }
  await assert.rejects(
    completeRunManifestWithEventSequence(repoRoot, workspace, wrongBreakerRefManifest, "blocked", childReadPreExecutionBreakerEventSequence(contractRef, breakerRef)),
    /expected payload_ref artifact:\/\/agent\/execute\/breaker_denial_guard/
  );

  const postSupervisorBreakerRunId = "run_child_post_supervisor_breaker_guard";
  const postSupervisorBreakerManifest = await createRunManifest(repoRoot, workspace, postSupervisorBreakerRunId, "Child post-supervisor breaker lifecycle guard");
  const postSupervisorBreakerEvents = [
    eventRecord({
      id: "evt_child_post_supervisor_started",
      workspace_id: workspace.id,
      run_id: postSupervisorBreakerRunId,
      event_type: "agent.child.started",
      actor: { type: "system", id: "test" },
      summary: "Started child post-supervisor guard.",
      payload_ref: contractRef
    }),
    eventRecord({
      id: "evt_child_post_supervisor_requested",
      workspace_id: workspace.id,
      run_id: postSupervisorBreakerRunId,
      event_type: "tool.requested",
      actor: { type: "agent", id: "test" },
      summary: "Requested child read before supervisor failure."
    }),
    eventRecord({
      id: "evt_child_post_supervisor_risk",
      workspace_id: workspace.id,
      run_id: postSupervisorBreakerRunId,
      event_type: "risk.composed",
      actor: { type: "system", id: "test" },
      summary: "Composed child read risk before supervisor failure."
    }),
    eventRecord({
      id: "evt_child_post_supervisor_policy",
      workspace_id: workspace.id,
      run_id: postSupervisorBreakerRunId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Recorded child policy before supervisor failure."
    }),
    eventRecord({
      id: "evt_child_post_supervisor_breaker",
      workspace_id: workspace.id,
      run_id: postSupervisorBreakerRunId,
      event_type: "circuit.opened",
      actor: { type: "system", id: "test" },
      summary: "Opened post-supervisor breaker.",
      payload_ref: breakerRef
    })
  ];
  for (const event of postSupervisorBreakerEvents) {
    await appendEvent(repoRoot, workspace, event);
    await recordRunEvent(repoRoot, workspace, postSupervisorBreakerManifest, event.id);
  }
  await completeRunManifestWithEventSequence(
    repoRoot,
    workspace,
    postSupervisorBreakerManifest,
    "blocked",
    childReadPostSupervisorBreakerEventSequence(contractRef, breakerRef, ["tool.requested", "risk.composed", "policy.decided"])
  );
  const postSupervisorCompleted = JSON.parse(await readFile(join(root, ".aetherion", "runs", `${postSupervisorBreakerRunId}.json`), "utf8")) as { status: string; event_ids: string[] };
  assert.equal(postSupervisorCompleted.status, "blocked");
  assert.deepEqual(postSupervisorCompleted.event_ids, postSupervisorBreakerEvents.map((event) => event.id));

  assert.throws(
    () => childReadPostSupervisorBreakerEventSequence(contractRef, breakerRef, ["tool.requested", "tool.result"]),
    /Invalid child read supervisor breaker lifecycle prefix/
  );
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
  await mkdir(join(artifactRoot, "candidates"), { recursive: true });
  await mkdir(join(artifactRoot, "accept"), { recursive: true });
  await mkdir(join(artifactRoot, "reject"), { recursive: true });
  await mkdir(join(artifactRoot, "block"), { recursive: true });
  await mkdir(join(artifactRoot, "delete"), { recursive: true });
  await mkdir(registryDir, { recursive: true });

  const pendingCandidate = memoryCandidate("memcand_pending", "pending");
  const acceptedCandidate = memoryCandidate("memcand_keep", "pending");
  const rejectedCandidate = memoryCandidate("memcand_reject", "rejected");
  const staleCandidate = memoryCandidate("memcand_stale", "pending");
  const accepted = memoryCard("mem_keep", "initial");
  const blocked = { ...accepted, blocked_contexts: ["external_send"] };
  const missing = memoryCard("mem_missing", "missing registry");
  const stale = memoryCard("mem_stale", "stale registry");
  const deleted = memoryCard("mem_deleted", "deleted memory");
  const tombstone = memoryTombstone("tombstone_mem_deleted", "mem_deleted");
  const staleTombstone = memoryTombstone("tombstone_mem_stale", "mem_stale");

  await writeFile(join(artifactRoot, "candidates", "memcand_pending.json"), `${JSON.stringify(pendingCandidate, null, 2)}\n`);
  await writeFile(join(artifactRoot, "candidates", "memcand_keep.json"), `${JSON.stringify(acceptedCandidate, null, 2)}\n`);
  await writeFile(join(artifactRoot, "reject", "memcand_reject.json"), `${JSON.stringify(rejectedCandidate, null, 2)}\n`);
  await writeFile(join(artifactRoot, "accept", "mem_keep.json"), `${JSON.stringify(accepted, null, 2)}\n`);
  await writeFile(join(artifactRoot, "block", "mem_keep.json"), `${JSON.stringify(blocked, null, 2)}\n`);
  await writeFile(join(artifactRoot, "accept", "mem_missing.json"), `${JSON.stringify(missing, null, 2)}\n`);
  await writeFile(join(artifactRoot, "accept", "mem_deleted.json"), `${JSON.stringify(deleted, null, 2)}\n`);
  await writeFile(join(artifactRoot, "delete", "tombstone_mem_deleted.json"), `${JSON.stringify(tombstone, null, 2)}\n`);
  await writeFile(join(artifactRoot, "accept", "broken.json"), "{not json");

  await writeFile(join(registryDir, "memory-candidates.json"), `${JSON.stringify([
    pendingCandidate,
    { ...acceptedCandidate, review: { status: "pending" } },
    rejectedCandidate,
    staleCandidate,
    { id: "memcand_invalid_registry", candidate: {}, review: {} }
  ], null, 2)}\n`);
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
    payloadEvent("evt_mem_candidate_pending", "run_mem", "memory.candidate.created", "artifact://memory/candidates/memcand_pending"),
    payloadEvent("evt_mem_candidate_keep", "run_mem", "memory.candidate.created", "artifact://memory/candidates/memcand_keep"),
    payloadEvent("evt_mem_accept_keep", "run_mem", "memory.accepted", "artifact://memory/accept/mem_keep"),
    payloadEvent("evt_mem_reject", "run_mem", "memory.rejected", "artifact://memory/reject/memcand_reject"),
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
    expected_memory_candidates: 3,
    expected_memory_cards: 2,
    expected_memory_tombstones: 1,
    actual_memory_candidates: 4,
    actual_memory_cards: 3,
    actual_memory_tombstones: 2,
    matched: 4,
    missing_registry: 0,
    mismatched: 2,
    stale_registry: 3,
    invalid_artifact: 2,
    invalid_registry: 2
  });
  assert.ok(finding("memcand_pending", "matched"));
  assert.ok(finding("memcand_keep", "mismatched"));
  assert.ok(finding("memcand_reject", "matched"));
  assert.ok(finding("memcand_stale", "stale_registry"));
  assert.ok(finding("memcand_invalid_registry", "invalid_registry"));
  assert.ok(finding("mem_keep", "matched"));
  assert.ok(finding("mem_missing", "mismatched"));
  assert.ok(finding("tombstone_mem_deleted", "matched"));
  assert.ok(finding("mem_stale", "stale_registry"));
  assert.ok(finding("tombstone_mem_stale", "stale_registry"));
  assert.ok(finding("broken", "invalid_artifact"));
  assert.ok(audit.findings.some((entry) => entry.event_id === "evt_mem_missing_artifact" && entry.status === "invalid_artifact"));
  assert.ok(finding("mem_invalid_registry", "invalid_registry"));
  assert.deepEqual(audit.expected_memory_candidates.map((item) => item.id), ["memcand_keep", "memcand_pending", "memcand_reject"]);
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

test("sandbox registry rebuild audit compares checkpoint rehearsal artifacts without mutating", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-sandbox-registry-audit-"));
  const artifactRoot = join(root, ".aetherion", "artifacts");
  const registryDir = join(root, ".aetherion", "registries");
  await mkdir(join(artifactRoot, "checkpoint", "run_source"), { recursive: true });
  await mkdir(join(artifactRoot, "branch", "checkpoint_source"), { recursive: true });
  await mkdir(join(artifactRoot, "rehearse", "branch_source"), { recursive: true });
  await mkdir(join(artifactRoot, "approve-rehearsal", "rehearsal_source"), { recursive: true });
  await mkdir(registryDir, { recursive: true });

  const checkpoint = {
    id: "checkpoint_source",
    run_id: "run_source",
    event_id: "evt_source",
    event_hash: `sha256:${"1".repeat(64)}`,
    created_at: "2026-06-07T10:00:00.000Z",
    replay_mode: "simulation",
    active_leases_reusable: false
  };
  const branch = {
    id: "branch_source",
    checkpoint_id: checkpoint.id,
    source_event_id: checkpoint.event_id,
    source_event_hash: checkpoint.event_hash,
    head_event_id: checkpoint.event_id,
    head_event_hash: checkpoint.event_hash,
    created_at: "2026-06-07T10:01:00.000Z",
    inherits_authority: false,
    status: "sandbox"
  };
  const rehearsal = {
    id: "rehearsal_source",
    branch_id: branch.id,
    mode: "diff",
    real_workspace_mutated: false,
    result: "--- a/PHASE.md\n+++ b/PHASE.md\n@@ sandbox rehearsal @@\n-old\n+new",
    approval_required: true,
    operation: "file.write",
    target_path: "PHASE.md",
    sandbox_path: ".aetherion/sandboxes/branch_source/workspace/PHASE.md",
    original_sha256: `sha256:${"2".repeat(64)}`,
    proposed_sha256: `sha256:${"3".repeat(64)}`
  };
  const approval = {
    id: "sandbox_approval_rehearsal_source",
    rehearsal_id: rehearsal.id,
    branch_id: branch.id,
    fresh_policy_evaluated: true,
    inherited_authority: false,
    policy_event_id: "evt_policy",
    live_action_event_id: "evt_action",
    status: "approved",
    promotion_run_id: "run_rehearsal_source",
    target_path: "PHASE.md",
    new_lease_id: "lease_source_write",
    real_side_effect_executed: true,
    verification_status: "passed"
  };
  const staleBranch = {
    ...branch,
    id: "branch_stale_projection",
    checkpoint_id: "checkpoint_stale_projection"
  };
  await writeFile(join(artifactRoot, "checkpoint", "run_source", "checkpoint_source.json"), `${JSON.stringify(checkpoint, null, 2)}\n`);
  await writeFile(join(artifactRoot, "branch", "checkpoint_source", "branch_source.json"), `${JSON.stringify(branch, null, 2)}\n`);
  await writeFile(join(artifactRoot, "rehearse", "branch_source", "rehearsal_source.json"), `${JSON.stringify(rehearsal, null, 2)}\n`);
  await writeFile(join(artifactRoot, "approve-rehearsal", "rehearsal_source", "sandbox_approval_rehearsal_source.json"), `${JSON.stringify(approval, null, 2)}\n`);
  await writeFile(join(artifactRoot, "branch", "checkpoint_source", "broken.json"), "{not json");
  await writeFile(join(registryDir, "checkpoints.json"), `${JSON.stringify([checkpoint], null, 2)}\n`);
  await writeFile(join(registryDir, "branches.json"), `${JSON.stringify([
    branch,
    staleBranch,
    { id: "branch_invalid_registry", checkpoint_id: "checkpoint_invalid" }
  ], null, 2)}\n`);
  await writeFile(join(registryDir, "rehearsals.json"), `${JSON.stringify([rehearsal], null, 2)}\n`);
  await writeFile(join(registryDir, "sandbox-approvals.json"), `${JSON.stringify([approval], null, 2)}\n`);
  const beforeBranches = await readFile(join(registryDir, "branches.json"), "utf8");

  const audit = auditSandboxRegistryRebuild(root);
  const finding = (registry: string, itemId: string, status: string) =>
    audit.findings.find((entry) => entry.registry === registry && entry.item_id === itemId && entry.status === status);
  assert.equal(audit.id, "sandbox_registry_rebuild_audit");
  assert.equal(audit.scope.mode, "read_only_artifact_rebuild_parity");
  assert.equal(audit.scope.mutates_registry, false);
  assert.equal(audit.scope.requests_supervisor_authority, false);
  assert.equal(audit.scope.promotes_rehearsals, false);
  assert.deepEqual(audit.summary, {
    expected_checkpoints: 1,
    expected_branches: 1,
    expected_rehearsals: 1,
    expected_sandbox_approvals: 1,
    actual_checkpoints: 1,
    actual_branches: 2,
    actual_rehearsals: 1,
    actual_sandbox_approvals: 1,
    matched: 3,
    missing_registry: 0,
    mismatched: 1,
    stale_registry: 1,
    invalid_artifact: 1,
    invalid_registry: 1
  });
  assert.ok(finding("checkpoints", checkpoint.id, "matched"));
  assert.ok(finding("branches", branch.id, "mismatched"));
  assert.ok(finding("branches", "branch_stale_projection", "stale_registry"));
  assert.ok(finding("branches", "branch_invalid_registry", "invalid_registry"));
  assert.ok(finding("branches", "broken", "invalid_artifact"));
  assert.ok(finding("rehearsals", rehearsal.id, "matched"));
  assert.ok(finding("sandbox-approvals", approval.id, "matched"));
  assert.equal(audit.expected_branches[0].status, "approved");
  assert.equal(await readFile(join(registryDir, "branches.json"), "utf8"), beforeBranches);
});

test("hibernation registry rebuild audit compares sleep and wake artifacts without mutating", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-hibernation-registry-audit-"));
  const sleepDir = join(root, ".aetherion", "artifacts", "sleep", "run_sleep");
  const wakeDir = join(root, ".aetherion", "artifacts", "wake", "hibernate_run_sleep");
  const registryDir = join(root, ".aetherion", "registries");
  await mkdir(sleepDir, { recursive: true });
  await mkdir(wakeDir, { recursive: true });
  await mkdir(registryDir, { recursive: true });

  const matchedHibernation = hibernationRecord("hibernate_run_sleep", "run_sleep", "wake_hibernate_run_sleep_manual");
  const missingHibernation = hibernationRecord("hibernate_run_missing", "run_missing", "wake_hibernate_run_missing_manual");
  const mismatchArtifact = hibernationRecord("hibernate_run_mismatch", "run_mismatch", "wake_hibernate_run_mismatch_manual");
  const mismatchRegistry = { ...mismatchArtifact, resume_summary: "tampered registry projection" };
  const staleHibernation = hibernationRecord("hibernate_run_stale", "run_stale", "wake_hibernate_run_stale_manual");
  const matchedWake = wakeupTrigger("wake_hibernate_run_sleep_manual", "hibernate_run_sleep", "eligible");
  const mismatchWakeArtifact = wakeupTrigger("wake_hibernate_run_mismatch_manual", "hibernate_run_mismatch", "queued");
  const mismatchWakeRegistry = { ...mismatchWakeArtifact, reason: "tampered trigger projection" };
  const staleWake = wakeupTrigger("wake_hibernate_run_stale_manual", "hibernate_run_stale", "eligible");

  await writeFile(join(sleepDir, "hibernate_run_sleep.json"), `${JSON.stringify(matchedHibernation, null, 2)}\n`);
  await writeFile(join(sleepDir, "hibernate_run_missing.json"), `${JSON.stringify(missingHibernation, null, 2)}\n`);
  await writeFile(join(sleepDir, "hibernate_run_mismatch.json"), `${JSON.stringify(mismatchArtifact, null, 2)}\n`);
  await writeFile(join(sleepDir, "broken.json"), "{not json");
  await writeFile(join(wakeDir, "wake_hibernate_run_sleep_manual.json"), `${JSON.stringify(matchedWake, null, 2)}\n`);
  await writeFile(join(wakeDir, "wake_hibernate_run_mismatch_manual.json"), `${JSON.stringify(mismatchWakeArtifact, null, 2)}\n`);
  await writeFile(join(wakeDir, "invalid_wake.json"), `${JSON.stringify({ id: "wake_invalid_artifact", auto_execute_allowed: true }, null, 2)}\n`);
  await writeFile(join(registryDir, "hibernations.json"), `${JSON.stringify([
    matchedHibernation,
    mismatchRegistry,
    staleHibernation,
    { id: "hibernate_invalid_registry", active_leases_retained: true }
  ], null, 2)}\n`);
  await writeFile(join(registryDir, "wakeups.json"), `${JSON.stringify([
    matchedWake,
    mismatchWakeRegistry,
    staleWake,
    { id: "wake_invalid_registry", auto_execute_allowed: true }
  ], null, 2)}\n`);

  const beforeHibernations = await readFile(join(registryDir, "hibernations.json"), "utf8");
  const audit = auditHibernationRegistryRebuild(root);
  const finding = (itemId: string, status: string) => audit.findings.find((entry) => entry.item_id === itemId && entry.status === status);
  assert.equal(audit.id, "hibernation_registry_rebuild_audit");
  assert.equal(audit.scope.mode, "read_only_artifact_rebuild_parity");
  assert.equal(audit.scope.mutates_registry, false);
  assert.equal(audit.scope.evaluates_triggers, false);
  assert.equal(audit.scope.queues_wakeups, false);
  assert.deepEqual(audit.summary, {
    expected_hibernations: 3,
    expected_wakeups: 2,
    actual_hibernations: 3,
    actual_wakeups: 3,
    matched: 2,
    missing_registry: 1,
    mismatched: 2,
    stale_registry: 2,
    invalid_artifact: 2,
    invalid_registry: 2
  });
  assert.ok(finding("hibernate_run_sleep", "matched"));
  assert.ok(finding("hibernate_run_missing", "missing_registry"));
  assert.ok(finding("hibernate_run_mismatch", "mismatched"));
  assert.ok(finding("hibernate_run_stale", "stale_registry"));
  assert.ok(finding("hibernate_invalid_registry", "invalid_registry"));
  assert.ok(finding("wake_hibernate_run_sleep_manual", "matched"));
  assert.ok(finding("wake_hibernate_run_mismatch_manual", "mismatched"));
  assert.ok(finding("wake_hibernate_run_stale_manual", "stale_registry"));
  assert.ok(finding("wake_invalid_artifact", "invalid_artifact"));
  assert.ok(finding("wake_invalid_registry", "invalid_registry"));
  assert.ok(finding("broken", "invalid_artifact"));
  assert.deepEqual(audit.expected_hibernations.map((item) => item.id), ["hibernate_run_mismatch", "hibernate_run_missing", "hibernate_run_sleep"]);
  assert.deepEqual(audit.expected_wakeups.map((item) => item.id), ["wake_hibernate_run_mismatch_manual", "wake_hibernate_run_sleep_manual"]);
  assert.equal(await readFile(join(registryDir, "hibernations.json"), "utf8"), beforeHibernations);
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
  const agentRuntimeDir = join(root, ".aetherion", "artifacts", "agent", "runtime");
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
  await mkdir(agentRuntimeDir, { recursive: true });
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
  const runtimeInvocation = {
    ...JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json"), "utf8")),
    id: "agent_runtime_invocation_run_payload",
    run_id: "run_payload_resolved",
    prompt_plan_id: "prompt_run_payload_resolved",
    entry: {
      surface: "tui",
      output_mode: "plan",
      context_pack_id: "ctx_run_payload_resolved"
    },
    prompt: {
      ...JSON.parse(await readFile(join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json"), "utf8")).prompt,
      bundle_id: "prompt_bundle_run_payload_resolved"
    }
  };
  await writeFile(join(agentRuntimeDir, "agent_runtime_invocation_run_payload.json"), `${JSON.stringify(runtimeInvocation, null, 2)}\n`);
  await writeFile(join(agentRuntimeDir, "agent_runtime_invocation_run_payload_invalid.json"), `${JSON.stringify({
    ...runtimeInvocation,
    id: "agent_runtime_invocation_run_payload_invalid",
    preview: "Task request: this raw prompt text must not be durable runtime metadata."
  }, null, 2)}\n`);
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
    payloadEvent("evt_payload_agent_runtime", "run_payload_resolved", "agent.runtime.bound", "artifact://agent/runtime/agent_runtime_invocation_run_payload"),
    payloadEvent("evt_payload_agent_runtime_invalid", "run_payload_schema_invalid", "agent.runtime.bound", "artifact://agent/runtime/agent_runtime_invocation_run_payload_invalid"),
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
    events_with_payload_ref: 41,
    resolved: 38,
    missing: 1,
    invalid_json: 1,
    unresolved: 1,
    schema_valid: 30,
    schema_invalid: 8,
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
  assert.equal(byId.get("evt_payload_agent_runtime")?.schema_name, "agent-runtime-invocation.schema.json");
  assert.equal(byId.get("evt_payload_agent_runtime")?.schema_status, "valid");
  assert.equal(byId.get("evt_payload_agent_runtime_invalid")?.schema_name, "agent-runtime-invocation.schema.json");
  assert.equal(byId.get("evt_payload_agent_runtime_invalid")?.schema_status, "invalid");
  assert.ok(byId.get("evt_payload_agent_runtime_invalid")?.schema_errors.some((error) => error.includes("additional property not allowed")));
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

function childReadEvents(input: {
  workspaceId: string;
  runId: string;
  prefix: string;
  contractRef: string;
  childResultRef: string;
}) {
  return [
    eventRecord({
      id: `${input.prefix}_started`,
      workspace_id: input.workspaceId,
      run_id: input.runId,
      event_type: "agent.child.started",
      actor: { type: "system", id: "test" },
      summary: "Started child read.",
      payload_ref: input.contractRef
    }),
    eventRecord({
      id: `${input.prefix}_requested`,
      workspace_id: input.workspaceId,
      run_id: input.runId,
      event_type: "tool.requested",
      actor: { type: "agent", id: "test" },
      summary: "Requested child read."
    }),
    eventRecord({
      id: `${input.prefix}_risk`,
      workspace_id: input.workspaceId,
      run_id: input.runId,
      event_type: "risk.composed",
      actor: { type: "system", id: "test" },
      summary: "Composed child read risk."
    }),
    eventRecord({
      id: `${input.prefix}_policy`,
      workspace_id: input.workspaceId,
      run_id: input.runId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Allowed child read."
    }),
    eventRecord({
      id: `${input.prefix}_lease`,
      workspace_id: input.workspaceId,
      run_id: input.runId,
      event_type: "lease.issued",
      actor: { type: "system", id: "test" },
      summary: "Issued scoped child read lease."
    }),
    eventRecord({
      id: `${input.prefix}_result`,
      workspace_id: input.workspaceId,
      run_id: input.runId,
      event_type: "tool.result",
      actor: { type: "system", id: "test" },
      summary: "Read completed."
    }),
    eventRecord({
      id: `${input.prefix}_completed`,
      workspace_id: input.workspaceId,
      run_id: input.runId,
      event_type: "agent.child.completed",
      actor: { type: "system", id: "test" },
      summary: "Completed child read.",
      payload_ref: input.childResultRef
    })
  ];
}

function childReadPolicyDeniedEvents(input: {
  workspaceId: string;
  runId: string;
  prefix: string;
  contractRef: string;
  denialRef: string;
}) {
  return [
    eventRecord({
      id: `${input.prefix}_started`,
      workspace_id: input.workspaceId,
      run_id: input.runId,
      event_type: "agent.child.started",
      actor: { type: "system", id: "test" },
      summary: "Started child read.",
      payload_ref: input.contractRef
    }),
    eventRecord({
      id: `${input.prefix}_requested`,
      workspace_id: input.workspaceId,
      run_id: input.runId,
      event_type: "tool.requested",
      actor: { type: "agent", id: "test" },
      summary: "Requested child read."
    }),
    eventRecord({
      id: `${input.prefix}_risk`,
      workspace_id: input.workspaceId,
      run_id: input.runId,
      event_type: "risk.composed",
      actor: { type: "system", id: "test" },
      summary: "Composed denied child read risk."
    }),
    eventRecord({
      id: `${input.prefix}_policy`,
      workspace_id: input.workspaceId,
      run_id: input.runId,
      event_type: "policy.decided",
      actor: { type: "system", id: "test" },
      summary: "Denied child read."
    }),
    eventRecord({
      id: `${input.prefix}_result`,
      workspace_id: input.workspaceId,
      run_id: input.runId,
      event_type: "tool.result",
      actor: { type: "system", id: "test" },
      summary: "Read denied."
    }),
    eventRecord({
      id: `${input.prefix}_policy_denied`,
      workspace_id: input.workspaceId,
      run_id: input.runId,
      event_type: "agent.child.policy_denied",
      actor: { type: "system", id: "test" },
      summary: "Recorded child policy denial.",
      payload_ref: input.denialRef
    })
  ];
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
    publisher_key_fingerprint: `sha256:${"5".repeat(64)}`,
    package_digest: surfaceContentHash,
    signature_verified: true,
    permission_diff_reviewed: true,
    replay_tests_passed: true,
    replay_record_ids: ["replay_a", "replay_b"],
    sandbox_trial_passed: true,
    sandbox_content_sha256: `sha256:${"a".repeat(64)}`,
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

function hibernationRecord(id: string, runId: string, triggerId: string) {
  return {
    id,
    run_id: runId,
    status: "sleeping",
    created_at: "2026-06-07T10:00:00.000Z",
    expires_at: null,
    active_leases_retained: false,
    minimal_context_pack_id: `ctx_resume_${runId}`,
    ledger_cursor: {
      event_id: `evt_${runId}_completed`,
      event_hash: `sha256:${"1".repeat(64)}`,
      event_count: 3
    },
    resume_summary: `Resume ${runId} after an explicit wake trigger.`,
    trigger_ids: [triggerId],
    attention_budget: {
      max_wakeups: 3,
      used_wakeups: 0
    },
    max_auto_risk: "L2"
  };
}

function wakeupTrigger(id: string, hibernationId: string, status: "eligible" | "queued") {
  return {
    id,
    hibernation_id: hibernationId,
    source: "manual",
    status,
    created_at: "2026-06-07T10:00:00.000Z",
    expires_at: null,
    condition: {
      deadline_at: null,
      file_path: null,
      baseline_sha256: null
    },
    observed_at: status === "queued" ? "2026-06-07T10:01:00.000Z" : null,
    policy_recheck_required: true,
    fresh_policy_decision_id: status === "queued" ? "policy_resume_queue" : null,
    resume_run_id: status === "queued" ? "run_resume_fixture" : null,
    auto_execute_allowed: false,
    reason: status === "queued"
      ? "Manual wakeup requested. Fresh policy allowed queueing only; no action or lease was issued."
      : "Manual wakeup is immediately eligible."
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

async function callSupervisorRpcWithSocketResponse(responseLine: string): Promise<unknown> {
  const socketPath = join("/tmp", `aeth-env-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.sock`);
  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    socket.on("data", () => {
      socket.end(responseLine);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  try {
    return await callSupervisorRpc(repoRoot, {
      id: "rpc_expected",
      method: "supervisor.status",
      workspace_root: "/tmp/aetherion-rpc-envelope-test",
      workspace_id: "ws_rpc_envelope_test",
      run_id: "run_rpc_envelope_test"
    }, { socketPath });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(socketPath, { force: true });
  }
}

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
