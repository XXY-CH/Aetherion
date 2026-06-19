# Phase 03 — Replay Integrity Verification

Alignment: baseline doc §5 — OpenClaw's lifecycle-generation UUID rejects stale/corrupt run events. Aetherion cannot add fields to EventRecord without a new hash version (AGENTS.md invariant). The lightweight equivalent: verify run manifest event_ids against the ledger during replay reconstruction.

## Baseline delta

Current state (`packages/harness-core/src/replay.ts:30-44`): `reconstructTrace` filters ledger events by `run_id` and returns `event_count`, `event_types`, `head_event_id`, `head_event_hash`, `chain_valid`. It does NOT cross-check against the run manifest's `event_ids` list. If ledger events are deleted or corrupted after the run completed, the reconstruction silently reports a shorter trace without flagging the discrepancy.

The run manifest (`packages/harness-core/src/workspace.ts:16-25`) stores the authoritative `event_ids` array recorded at completion time. This is the "what should be there" list. The ledger is the "what is actually there" list. A gap between them is a tamper/corruption signal.

## Scope (minimum viable)

Add a `manifest_event_ids` field and `missing_event_ids` field to `ReconstructedTrace`:
- `manifest_event_ids`: the event IDs from the run manifest (if a manifest exists).
- `missing_event_ids`: manifest event IDs NOT found in the ledger.

Add an optional `manifest` parameter to `reconstructTrace` so callers can pass the run manifest for integrity cross-check. When no manifest is provided, these fields are empty arrays (backward compatible).

## What this is NOT

- Not changing EventRecord or its hash.
- Not adding lifecycle-generation to events.
- Not changing the ledger format.
- Not changing the run manifest schema.
- Not auto-repairing anything.

## Tests (TDD — written first)

1. `reconstructTrace without manifest returns empty manifest_event_ids and missing_event_ids (backward compat)`
2. `reconstructTrace with matching manifest reports no missing events`
3. `reconstructTrace with manifest reports missing_event_ids when ledger is short`
4. `missing_event_ids is sorted and contains only manifest ids absent from ledger`
5. `existing harness-core suite still passes unchanged`

## Exit criteria

- All new tests pass.
- `npm test` green.
- `ReconstructedTrace` has `manifest_event_ids` and `missing_event_ids` fields.
- Callers that don't pass a manifest see no behavior change.

## Out of scope

- Manifest schema changes.
- Corruption repair.
- Cross-run integrity (e.g., parent-child run verification).
