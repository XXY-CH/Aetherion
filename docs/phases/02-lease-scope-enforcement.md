# Phase 02 — Lease Scope Enforcement at Execution

Alignment: baseline doc §4 — "keep leases as scoped tokens, not yes/no approvals." OpenClaw's `beforeToolCall` hook re-validates at execution time (defense in depth). Aetherion's policy proxy checks egress at *decision* time but the execution layer in `local-file.ts` only checks `scope.paths`, ignoring `scope.tools` and `scope.egress`.

## Baseline delta

Current state (`packages/harness-core/src/local-file.ts:16-22, 37-43`): `readLocalFileThroughPolicy` and `writeLocalFileThroughPolicy` verify only:
- `decision.decision === "allow"`
- lease not expired
- `scope.paths` array present and contains target path

Missing (the gap):
- `scope.tools` is declared in the lease (`["filesystem.read"]` / `["filesystem.write"]`) but never checked against the operation verb at execution time.
- `scope.egress` is declared (`["local_response"]` / `["local_artifact_store"]`) but never checked against `request.risk_inputs.data_egress_destination`.

A hand-constructed request or a future bug could bypass the policy pipeline and still execute because the lease's own declared constraints are not enforced by the executor.

## Scope (minimum viable)

Add two checks to the execution layer:
1. **tool match**: the operation verb must correspond to a tool in `scope.tools`.
2. **egress match**: `request.risk_inputs.data_egress_destination` must be in `scope.egress`.

No new schemas. No new types. No policy changes. Pure execution-layer enforcement of constraints the lease already declares.

## What this is NOT

- Not adding new lease fields.
- Not changing the policy pipeline (phase 01).
- Not adding a new event type.
- Not changing the lease schema or canonicalization.

## Verb-to-tool mapping

The lease `scope.tools` uses identifiers like `filesystem.read` / `filesystem.write`. The request `operation.verb` uses `read` / `write`. Map:
- `read` → `filesystem.read`
- `write` → `filesystem.write`

If the verb has no known mapping, deny (fail closed).

## Tests (TDD — written first)

1. `read execution succeeds when lease scope tools and egress match`
2. `read execution rejects when lease tools does not include filesystem.read`
3. `read execution rejects when lease egress does not include request egress destination`
4. `write execution succeeds when lease scope tools and egress match`
5. `write execution rejects when lease tools does not include filesystem.write`
6. `write execution rejects when lease egress does not include request egress destination`
7. `execution rejects unknown verb (fail closed)` — lease has no matching tool
8. `existing harness-core suite still passes unchanged` (no behavior change for valid leases)

## Exit criteria

- All new tests pass.
- `npm test` 184/184 green (existing tests use well-formed leases, so no regression).
- `local-file.ts` enforces `scope.tools` and `scope.egress` in addition to `scope.paths`.

## Out of scope

- Lease scope for non-file tools (browser, IM, etc.).
- Dynamically revocable leases.
- Lease audit trail changes.
