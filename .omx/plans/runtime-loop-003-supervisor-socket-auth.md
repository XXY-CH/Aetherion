# Runtime Loop 003: Optional Socket RPC Auth Gate

## Requirements Summary

This loop follows `runtime-loop-002-supervisor-socket.md` and the original runtime guidance:

- `docs/10-technical-strategy.md` keeps the Rust supervisor as the authority boundary and allows stdio/Unix socket IPC during Phase 2.
- `docs/13-schema-runtime-governance.md` says runtime work should harden existing loops before broadening schema surface.
- The pasted external assessment identified `auth token / device identity` as part of daemonization, but full device identity and vault work are not in the current implementation scope.

The next aligned step is a narrow, optional auth gate for the explicit foreground socket transport. It prevents accidental unauthenticated local socket access in testable form without claiming a production identity, pairing, or vault system.

## Scope

- Add `aetherion-supervisor socket --path <socket> --auth-token <token>` for foreground socket mode.
- Require RPC requests over that socket to include matching `auth_token`.
- Keep stdio behavior unchanged and unauthenticated because stdio is spawned per request by the local TUI client.
- Do not append auth tokens or auth failures to the Ledger.
- Add optional `authToken` support to the TS socket client helper.

Out of scope:

- No device identity.
- No user identity.
- No vault backend.
- No token generation/storage command.
- No service install/start/stop lifecycle.
- No schema changes.
- No IM, browser, OAuth, MCP, GUI, cloud worker, or connector work.

## Acceptance Criteria

- Socket mode without `--auth-token` behaves as in loop 002.
- Socket mode with `--auth-token` rejects missing or wrong `auth_token` before calling the normal RPC handler.
- Accepted authenticated socket requests still use the same RPC handler and report `transport=unix-socket`.
- Auth failures do not initialize workspace state and do not append Ledger events.
- TS socket RPC helper can include an auth token only when explicitly supplied.
- Existing stdio RPC and Ether default run behavior stay unchanged.

## Implementation Steps

1. Add optional auth token parsing to the Rust socket command.
2. Add a pre-handler socket auth check using the existing structured JSON parser.
3. Add Rust tests for missing, wrong, and matching token behavior.
4. Add TS socket helper support and a targeted integration test for authenticated status.
5. Update supervisor/TUI README language without documenting real secrets.

## Verification Steps

- `cargo fmt --check`
- `cargo test`
- `npm test`
- Re-read the docs above and confirm the final diff does not claim identity, vault, or daemon lifecycle support.

## Drift Check

This loop is aligned if it hardens the local socket transport while explicitly preserving the current POC limits: no production daemon, no reusable identity, no vault, and no new product surface.
