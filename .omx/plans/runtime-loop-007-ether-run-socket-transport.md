# Runtime Loop 007: Ether Kernel Run Over Explicit Socket Transport

## Requirements Summary

The Rust Supervisor POC supports JSON-RPC over stdio and explicit foreground Unix sockets. Ether can now use the socket for `supervisor status`, but the full Phase 1 kernel run still only calls the supervisor through stdio. This loop makes the complete local read/write lifecycle runnable through an explicit socket transport while preserving the same authority boundary, event lifecycle, and stdio default.

## Scope

- Add `ether run --supervisor socket --socket-path <socket>` support.
- Add optional `--socket-auth-token <token>` for auth-gated sockets.
- Reuse the existing supervisor RPC client for every run RPC: workspace init, governance event append, traced read, write prepare, write commit, and run completion.
- Preserve `--supervisor stdio` as the default Rust path.
- Preserve `typescript-seed` as explicit test-only behavior guarded by `AETHERION_ALLOW_TYPESCRIPT_SEED=1`.
- Keep run manifest event projection and Ledger lifecycle expectations unchanged.

Out of scope:

- No automatic socket discovery.
- No daemon lifecycle, service install/start/stop, or background process management.
- No socket path discovery from runtime locks.
- No token storage, vault, user/device identity, IM, browser, OAuth, MCP, GUI, cloud worker, or connector work.
- No new schemas.

## Acceptance Criteria

- `ether run --supervisor stdio` remains unchanged.
- `ether run --supervisor socket --socket-path <socket>` completes the approved local read/write lifecycle through a foreground socket and prints `supervisor=socket`.
- Auth-gated sockets reject runs without `--socket-auth-token` before runtime mutation.
- Auth-gated sockets complete runs when the correct token is supplied.
- Workspace-bound sockets complete matching workspace runs and keep runtime lock fields observable through status.
- Cross-workspace socket binding remains rejected before the normal RPC handler.

## Implementation Steps

1. Extend `SupervisorKernelRunInput` with socket transport options.
2. Route every supervisor RPC in `runSupervisorKernelLoop` through a shared options object.
3. Extend CLI `--supervisor` to accept `socket` and require `--socket-path` for that mode.
4. Print `supervisor=socket` for socket-backed runs.
5. Add TUI integration coverage for socket run, auth-gated socket run, and bound socket run.
6. Update README/help docs with explicit socket run syntax and non-daemon caveats.

## Verification Steps

- Targeted TUI run/socket tests.
- `cargo fmt --check`
- `cargo test`
- `npm test`
- Re-read `docs/06-roadmap.md`, `docs/10-technical-strategy.md`, and `docs/13-schema-runtime-governance.md` for drift.

## Drift Check

This loop is aligned if it makes the documented Phase 2 local socket IPC path capable of running the same Phase 1 local kernel loop, while preserving explicit user-provided socket details, stdio default behavior, full Ledger lifecycle evidence, and the no-daemon/no-identity/no-vault/no-connector boundary.
