# Runtime Loop 006: Ether Supervisor Status Over Explicit Socket

## Requirements Summary

The Rust supervisor now supports foreground Unix socket RPC, optional socket auth, workspace binding, and read-only runtime-lock status. The Ether CLI still exposes `supervisor status` only through the default stdio RPC path. This loop makes the existing local socket transport reachable from the TUI status command without changing the default run path or adding daemon lifecycle behavior.

## Scope

- Add explicit `ether supervisor status --socket-path <socket>` support.
- Add optional `--socket-auth-token <token>` for the existing socket auth gate.
- Keep stdio as the default when no socket path is provided.
- Reuse the existing supervisor RPC client and flat status output.
- Show socket transport and runtime-lock fields through the existing `supervisor status` output.

Out of scope:

- No automatic daemon discovery.
- No service start/stop/restart lifecycle.
- No socket path discovery from runtime locks.
- No secret storage, token persistence, user/device identity, vault, IM, browser, OAuth, MCP, GUI, cloud worker, or connector work.
- No new schemas.

## Acceptance Criteria

- `ether supervisor status --workspace <root>` still uses stdio and reports `transport=stdio`.
- `ether supervisor status --workspace <root> --socket-path <socket>` uses the foreground Unix socket and reports `transport=unix-socket`.
- A socket with `--auth-token` rejects status without `--socket-auth-token` and succeeds with it.
- A workspace-bound socket reports matching runtime lock fields through the Ether CLI.
- All status paths remain read-only with respect to the Ledger.

## Implementation Steps

1. Extend TUI CLI options with `socketPath` and `socketAuthToken`.
2. Parse `--socket-path` and `--socket-auth-token`.
3. Pass those options into `callSupervisorRpc` only for `supervisor status`.
4. Add TUI integration tests for unbound socket, auth-gated socket, and bound socket lock output via the CLI.
5. Update README/help docs while keeping stdio default and non-daemon caveats.

## Verification Steps

- Targeted TUI supervisor/socket tests.
- `cargo fmt --check`
- `cargo test`
- `npm test`
- Re-read `docs/06-roadmap.md`, `docs/10-technical-strategy.md`, and `docs/13-schema-runtime-governance.md` for drift.

## Drift Check

This loop is aligned if it exposes the already-implemented local socket transport to the TUI status command with explicit user-provided socket details, while preserving the Phase 2 POC boundary: no daemon discovery, no service lifecycle, no token storage, no identity/vault claims, and no new product surface beyond the existing `supervisor status` preflight.
