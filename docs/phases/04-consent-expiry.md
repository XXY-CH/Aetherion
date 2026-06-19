# Phase 04 — Consent Expiry Enforcement

Alignment: baseline doc §4 — OpenClaw's approval has a timeout (`DEFAULT_PLUGIN_APPROVAL_TIMEOUT_MS = 120_000`). Aetherion's `ConsentRecord.expires_at` is hardcoded to `null` (never expires) and `approveWriteWithConsent` never checks it.

## Baseline delta

Current state (`packages/harness-core/src/consent.ts:23`): `createWriteConsentRecord` sets `expires_at: null`. Current state (`packages/harness-core/src/policy.ts:168-198`): `approveWriteWithConsent` checks consent `tool_request_id` and `decision` but never checks `expires_at`.

The one-time `tool_request_id` binding currently prevents replay, but the architecture gap is real: a consent with no expiry is a standing authorization that violates the scoped-lease principle. If a future change loosens the request_id binding (e.g., "allow-always" pattern like OpenClaw), an expired consent would still be honored.

## Scope (minimum viable)

1. `createWriteConsentRecord` accepts an optional `ttlSeconds` (default: 300, matching the lease and approval card TTL). Sets `expires_at` to `approvedAt + ttlSeconds`.
2. `approveWriteWithConsent` rejects consents where `expires_at` is non-null and in the past.
3. `expires_at: null` still means "no expiry" (backward compatible for existing tests/fixtures that set null explicitly).

## What this is NOT

- Not changing the ConsentRecord schema (expires_at already exists).
- Not adding "allow-always" semantics.
- Not revoking consents retroactively.
- Not changing the lease expiry (already enforced in lease.ts).

## Tests (TDD — written first)

1. `createWriteConsentRecord sets expires_at to approvedAt + ttlSeconds`
2. `createWriteConsentRecord defaults ttlSeconds to 300`
3. `createWriteConsentRecord with ttlSeconds=0 sets expires_at to approvedAt`
4. `approveWriteWithConsent rejects expired consent`
5. `approveWriteWithConsent accepts consent with null expires_at (backward compat)`
6. `approveWriteWithConsent accepts consent with future expires_at`
7. `existing harness-core suite still passes (consents created in run-local.ts use default TTL)`

## Exit criteria

- All new tests pass.
- `npm test` green.
- Consents have a real expiry by default.
- `approveWriteWithConsent` enforces expiry.

## Out of scope

- Consent revocation.
- "Allow-always" consent patterns.
- Consent renewal flow.
