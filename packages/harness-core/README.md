# @aetherion/harness-core

Minimal contract-first seed for the Aetherion kernel.

Current scope:

- Create a workspace runtime directory.
- Create workspace registry and per-run manifest files.
- Derive workspace identity, runtime directory, and Ledger path from the resolved workspace root, and reject workspace registry drift instead of trusting registry path fields as authority.
- Append typed events to a JSONL event ledger.
- Create `aetherion-event-v1` hashes over the complete canonical event envelope, excluding only `event_hash`.
- Verify `parent_event_id`, `parent_event_hash`, and cross-author `event_hash` pointers from Rust supervisor events and the test-only TypeScript seed.
- Validate events and contract examples against JSON Schemas.
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
- Audit Event Ledger `payload_ref` values without mutating runtime state: `auditLedgerPayloadRefs` resolves known local `artifact://` references for Boundary Facts, Consent Records, Replay Records, Memory lifecycle artifacts, Capsule lifecycle snapshots, and generic Ether artifacts, validates known contract artifacts against their existing schemas, then reports resolved, missing, invalid JSON, unresolved, schema-valid, schema-invalid, or not-checked references.
- Feed later Memory OS context assembly by making run ledger events and manifests readable by TUI commands.

Out of scope:

- Real browser automation.
- Real IM/MCP/OAuth connectors.
- Real vault backend.
- Real memory retrieval.
- Real cloud workers.
