# Runtime Loop 005: Read-Only Supervisor Runtime Lock Status

## Requirements Summary

This loop follows the foreground socket workspace binding and runtime lock work. The original docs still keep Aetherion in Phase 2: a Rust Supervisor POC over stdio/local socket, not a production daemon. The next truthful step is observability: `supervisor.status` should report whether a workspace runtime lock exists and what it claims, without treating the lock as authority or adding service lifecycle behavior.

## Scope

- Extend read-only `supervisor.status` with runtime-lock fields derived from `<workspace>/.aetherion/supervisor.lock`.
- Report lock presence, path, PID, transport, workspace id, socket path, and whether those claims match the active workspace/status request.
- Keep `daemon_running=false`; a lock is evidence about a foreground runtime object, not a daemon proof.
- Preserve status as read-only with respect to the Ledger.
- Do not recover, delete, trust, or repair runtime lock files from status.

Out of scope:

- No daemon lifecycle, service management, or background process supervisor.
- No stale runtime-lock recovery.
- No process liveness validation beyond parsing the lock fields.
- No vault, user identity, device identity, IM, browser, OAuth, MCP, GUI, cloud worker, or connector work.
- No new schemas.

## Acceptance Criteria

- Status without a runtime lock reports `runtime_lock_present=false` and still initializes/validates the workspace registry and Ledger without appending events.
- Status with a matching foreground bound socket lock reports `runtime_lock_present=true`, the lock path, PID, transport, workspace id, socket path, and `runtime_lock_workspace_match=true`.
- Status with a malformed or mismatched lock reports the mismatch through read-only fields rather than deleting or trusting the lock.
- Existing stdio RPC, unbound socket RPC, bound socket RPC, and Ether default run behavior stay unchanged.

## Implementation Steps

1. Add a small runtime-lock parser/report helper in `crates/supervisor/src/main.rs`.
2. Include the lock report in `supervisor.status` responses.
3. Add Rust tests for absent, matching, and mismatched/malformed lock status.
4. Print the lock status fields through `ether supervisor status`.
5. Add TUI integration coverage for status output while a bound foreground socket is live.
6. Update README language without claiming daemon behavior.

## Verification Steps

- `cargo fmt --check`
- `cargo test`
- targeted TUI supervisor/socket tests
- `npm test`
- Re-read `docs/06-roadmap.md`, `docs/10-technical-strategy.md`, and `docs/13-schema-runtime-governance.md` for drift.

## Drift Check

This loop is aligned if it improves read-only observability of the foreground socket runtime lock while preserving the POC boundary: no service lifecycle, no crash or stale-lock recovery claim, no identity/vault claim, and no new product surface.
