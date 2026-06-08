# Runtime Loop 004: Workspace-Bound Socket Runtime Lock

## Requirements Summary

This loop follows the pushed supervisor status, socket transport, and optional socket auth gate work.

The original docs keep Phase 2 focused on a Rust supervisor POC over stdio/local RPC while naming a future daemon. The pasted runtime assessment lists `runtime lock`, health, and crash recovery as daemonization prerequisites. Full service lifecycle and crash recovery are still out of scope, but a foreground socket process can truthfully prove a smaller invariant: it is bound to one workspace runtime directory and refuses cross-workspace requests.

## Scope

- Add optional `aetherion-supervisor socket --path <socket> --workspace-root <root>`.
- Derive the bound workspace id from the resolved root.
- Create a runtime lock file under `<root>/.aetherion/supervisor.lock` while the foreground socket process is active.
- Include owner PID, socket path, transport, and workspace id in the lock file.
- Refuse socket RPC requests whose `workspace_root` or `workspace_id` does not match the bound workspace before the normal RPC handler runs.
- Remove the lock file on normal server shutdown/drop.

Out of scope:

- No background daemon lifecycle.
- No stale lock recovery beyond existing Ledger lock behavior.
- No crash recovery guarantee.
- No launchd/systemd/Windows service integration.
- No vault, user identity, device identity, IM, browser, OAuth, MCP, GUI, cloud worker, or connector work.
- No new schemas.

## Acceptance Criteria

- Socket mode without `--workspace-root` behaves as before.
- Socket mode with `--workspace-root` creates `.aetherion/supervisor.lock` for that workspace.
- Bound socket `supervisor.status` reports the expected workspace and leaves the lock file present while serving.
- Requests for a different workspace root/id are rejected before `.aetherion` is created in that other workspace.
- The lock file is removed when the foreground socket server handle is dropped in tests.
- Existing stdio RPC and Ether default run behavior stay unchanged.

## Implementation Steps

1. Extend socket option parsing with `--workspace-root`.
2. Add a small runtime lock type in `crates/supervisor/src/main.rs`.
3. Add pre-handler bound workspace checks for socket requests.
4. Add Rust tests for lock lifecycle and cross-workspace rejection.
5. Add TS integration coverage for bound socket status and rejection.
6. Update README language without claiming production daemon behavior.

## Verification Steps

- `cargo fmt --check`
- `cargo test`
- `npm test`
- Re-read `docs/06-roadmap.md`, `docs/10-technical-strategy.md`, and `docs/13-schema-runtime-governance.md` for drift.

## Drift Check

This loop is aligned if it adds a truthful runtime lock and workspace binding for explicit foreground socket mode while preserving the POC boundary: no service lifecycle, no crash recovery claim, no identity/vault claims, and no new product surface.
