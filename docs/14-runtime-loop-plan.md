# Runtime Loop Plan

This is the working loop for moving Aetherion from contract-backed slices toward a stronger local runtime without drifting into deferred product surfaces.

## Source Alignment

- `docs/06-roadmap.md` keeps V1 TUI-first and expects the Local Supervisor, Event Ledger, policy, scoped lease, local file action, observation, verification, and replay loop before GUI, IM, browser, MCP/OAuth, or cloud workers.
- `docs/10-technical-strategy.md` assigns authority, policy, vault, ledger, and native execution to Rust while keeping the Agent Orchestrator prototype in TypeScript.
- `docs/13-schema-runtime-governance.md` says new work should close runtime loops before expanding schema surface, and that runtime/projection evidence must not become authority by convenience.
- `crates/supervisor/README.md` still marks production daemon lifecycle and stale runtime-lock recovery as out of scope.

## Loop

1. Plan against the current docs and code evidence before selecting a development slice.
2. Implement one runtime-closing slice that can be tested without expanding V1 surfaces.
3. Verify with the smallest test set that proves the slice plus the broader guardrails.
4. Review the result against the source docs and record any remaining boundary.

## Completed Increment: Runtime Lock Liveness

Target: supervisor runtime status should expose whether a foreground supervisor runtime lock points at a live, missing, unknown, or invalid owner process.

Why this slice:

- It advances the daemon-readiness path without claiming a production daemon exists.
- It reuses the existing Rust PID liveness check already used for Ledger append locks.
- It is read-only: status must not append Ledger events, repair lock files, remove stale locks, or grant authority.

Acceptance:

- `supervisor.status` returns process liveness and stale status for `.aetherion/supervisor.lock`.
- TUI `supervisor status` prints the new fields.
- Existing no-lock and live-lock status paths remain read-only.
- A stale lock is reported as evidence for operators, not repaired automatically.

Next likely increment after this one:

- Choose between typed supervisor lifecycle commands (`supervisor start/status/stop` preflight semantics) or a small durable queue/wake runtime slice, based on the same docs review.

## Completed Increment: Supervisor Lifecycle Preflight

Target: add a read-only `ether supervisor preflight` surface that classifies supervisor lifecycle readiness from the existing status evidence.

Why this slice:

- It is the next typed lifecycle step after raw runtime-lock status.
- It gives operators a stable state and next-step summary before any future start/stop/recover command exists.
- It avoids pretending Aetherion has a production daemon, service manager, process killer, or lock repair path.

Acceptance:

- `supervisor preflight` calls the existing status RPC and appends no Ledger events.
- The output classifies no lock, live foreground socket, stale lock, unknown lock, invalid/mismatched lock, and malformed lock states.
- The command reports that daemon start, stop, and lock repair are unsupported in this POC.
- Docs state that preflight is visibility only and cannot grant authority or mutate runtime state.

## Completed Increment: Wakeup Eligibility Preview

Target: add a read-only `ether sleepers --check-wakeups` preview that evaluates persisted hibernation triggers without queueing or mutating runtime state.

Why this slice:

- It is the next queue-runtime step after explicit `wake <trigger>` because operators need to see which sleepers are eligible before asking the supervisor for queue policy.
- It reuses the existing deterministic `evaluateWakeup` rules instead of adding a daemon or scheduler.
- It keeps trigger evaluation separate from queueing: preflight can observe, but only `wake` may request fresh policy and append `wakeup.queued`.

Acceptance:

- `sleepers --check-wakeups` reports hibernation count, trigger count, per-trigger evaluated status, and eligible trigger ids.
- The command does not update hibernation/wakeup registries, append Ledger events, call `run.resume.evaluate`, issue leases, or resume task actions.
- Docs state that the preview is an operator planning surface, not a scheduler or queue.

Next likely increment after this one:

- Re-read `docs/13-schema-runtime-governance.md` and choose between resume Context Pack parity, trace-backed Memory lifecycle hardening, or trace-backed Capability Draft lifecycle hardening.
