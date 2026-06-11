# @aetherion/harness-core

[中文版本](README.zh-CN.md)

Minimal contract-first seed for the Aetherion kernel.

Current scope:

- Create a workspace runtime directory.
- Create workspace registry and per-run manifest files.
- Derive workspace identity, runtime directory, and Ledger path from the resolved workspace root, and reject workspace registry drift instead of trusting registry path fields as authority.
- Append typed events to a JSONL event ledger.
- Create `aetherion-event-v1` hashes over the complete canonical event envelope, excluding only `event_hash`.
- Verify `parent_event_id`, `parent_event_hash`, and cross-author `event_hash` pointers from Rust supervisor events and the test-only TypeScript seed.
- Validate events and contract examples against JSON Schemas.
- Validate the metadata-only Vault Reference, Model Provider Readiness, and Supervisor Lifecycle Readiness contracts, rejecting raw secret, raw prompt/model payload, OAuth-flow, token-refresh, connector-grant, provider tool-call, model-output authority, production-daemon, stale-lock repair, socket-auth authority, vault-backend, and supervisor lease-authority claims in schema tests.
- Create a tool request for a workspace-scoped file read.
- Compose seed risk records and deterministic seed policy decisions.
- Execute a local file read through that policy decision.
- Require explicit consent for a local file write.
- Generate an approval card before approval-gated writes.
- Execute an approval-gated local file write through a scoped lease.
- Verify the expected file effect.
- Reconstruct a run trace without replaying live side effects.
- Check trace hash-chain validity for Rust supervisor and test-only seed events.
- Create Replay Records for trace-mode reconstruction with live side effects disabled.
- Provide a TypeScript stdio client for the Rust supervisor POC.
- Run the default Ether kernel loop through the Rust supervisor via `runSupervisorKernelLoop`, using Rust traced file-action RPCs for read/write lifecycle events. Approved write commits now return supervisor-authored consent, observation, and verification event ids for Ether's run-manifest projection.
- Create and validate Consent Records for approved local writes through `createWriteConsentRecord`; the test-only TypeScript seed writes its own artifact, while the default Rust supervisor path validates the consent JSON and writes the final artifact inside `file.write.commit`.
- Attach approved-write Consent Records to the existing `consent.recorded` event with `payload_ref=artifact://consent/<run_id>/write`; blocked/unapproved writes create no Consent Record artifact.
- Create and validate Boundary Facts artifacts for kernel runs through `createBoundaryFacts` and `writeBoundaryFactsArtifact`.
- Attach the Boundary Facts artifact to the run's `run.started` event with `payload_ref=artifact://boundary/<run_id>/facts`.
- Record only the boundary facts the kernel can prove today: `run_id`, `workspace_id`, `entry_surface`, and authority. `user_id`, `device_id`, `channel_id`, and `secret_vault` stay explicit `not_recorded` markers until real identity, device, channel, and vault sources exist.
- Generate a fixed default run summary that does not copy source file content; callers can still provide explicit `summaryText` when they intentionally want user-controlled output.
- Provide human-readable local registry helpers for `.aetherion/registries/*.json`.
- Support registry upsert/read helpers used by Memory OS, Capsule OS, hibernation, migration, and security contract surfaces.
- Audit registry provenance references without mutating runtime state: `auditRegistryProvenance` classifies entries by whether their Ledger event references are present, missing, absent, or malformed, while explicitly not claiming deterministic rebuild parity.
- Preview rebuild parity for the `replay-records` registry without mutating runtime state: `auditReplayRecordRegistryRebuild` recomputes expected registry entries from persisted Replay Record artifacts and reports matched, missing, mismatched, stale, or invalid projection state.
- Preview rebuild parity for Memory Card/Tombstone registries without mutating runtime state: `auditMemoryRegistryRebuild` replays Memory lifecycle Ledger events and their `payload_ref` artifacts to compute expected active Memory Cards and Tombstones.
- Preview rebuild parity for Capsule lifecycle registries without mutating runtime state: `auditCapsuleRegistryRebuild` replays Capsule lifecycle Ledger events and their `payload_ref` artifacts to compute expected `capsules`, `capsule-drafts`, and `capsule-versions` projections.
- Audit Event Ledger `payload_ref` values without mutating runtime state: `auditLedgerPayloadRefs` resolves known local `artifact://` references for Boundary Facts, Consent Records, Replay Records, Memory lifecycle artifacts, Dream fold artifacts, persona anchor/reset artifacts, Soul Fork artifacts, Agent runtime/model request/model response/response-audit/tool-request-proposal artifacts, child agent contract/result/budget/circuit artifacts, Security scan/ack/trial/fixture artifacts, Surface browser/IM artifacts, Store install artifacts, Capsule lifecycle snapshots, and generic Ether artifacts, validates known contract artifacts including Capsule rollback snapshots against their existing schemas, then reports resolved, missing, invalid JSON, unresolved, schema-valid, schema-invalid, or not-checked references.
- Create and validate Agent Runtime Invocation, Agent Model Request, and Agent Model Response metadata artifacts through local workspace helpers. Agent Model Request artifacts can now be derived from a bound runtime invocation as no-tools request metadata. These helpers persist only schema-valid ids, refs, hashes, gates, usage, and audit state; they do not persist raw prompt/model text, request tools, issue leases, or grant authority.
- Resolve no-tools live model providers behind the existing hash-only response boundary: `openai_responses`, `openai_chat_completions`, `anthropic`, and `gemini`. `openai_chat_completions` is the supported OpenAI completion-style surface; legacy OpenAI `/v1/completions` is not implemented. Provider credentials are read only in memory from API-key env vars or supported externally supplied bearer-token env vars; the provider layer does not run OAuth flows, refresh tokens, persist credentials, configure connectors, or grant runtime authority. Direct Anthropic Messages API OAuth is not implemented because the official API path uses `x-api-key`.
- Create and validate Agent Tool Request Proposal artifacts derived from a passed, matched Agent Response Audit. These artifacts record an operator-restated workspace file read preview and explicitly record that no tool request, policy decision, lease, action, observation, verification, raw prompt/model output persistence, or runtime authority was created.
- Audit Event Ledger `payload_ref` values for `agent.model.requested`, `agent.model.responded`, `agent.response.audit.recorded`, and `agent.tool.request.proposed` events by resolving `artifact://agent/model-request/<id>`, `artifact://agent/model-response/<id>`, `artifact://agent/response-audit/<id>`, and `artifact://agent/tool-request-proposal/<id>` and validating them against the request/response/audit/proposal metadata schemas.
- Audit response-audit evidence chains without mutating runtime state: `auditAgentResponseAuditEvidence` verifies that response-audit artifacts point at matching runtime binding, model request, and model response Ledger evidence, and that each audit run manifest is a completed single-event, non-authorizing projection.
- Feed later Memory OS context assembly by making run ledger events and manifests readable by TUI commands.

Out of scope:

- Real browser automation.
- Real IM/MCP/OAuth connectors.
- Real vault backend.
- Real memory retrieval.
- Real cloud workers.
