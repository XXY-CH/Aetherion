# Runtime Loop 001: Supervisor Status Preflight

## Requirements Summary

This loop starts from `docs/01-architecture.md`, `docs/06-roadmap.md`, `docs/10-technical-strategy.md`, and `docs/13-schema-runtime-governance.md`.

The next aligned development step is not another schema or external surface. It is a small runtime loop that lets Ether ask the Rust supervisor to report the current workspace authority state before future daemon work.

## Scope

- Add a Rust supervisor RPC method that reports workspace identity, runtime paths, ledger health, and known supervisor mode.
- Add an Ether TUI command that prints that status for a local workspace.
- State explicitly that the current supervisor is still stdio POC / not a daemon.

Out of scope:

- No daemon install/start/stop.
- No socket server.
- No IM, browser, OAuth, MCP, GUI, or cloud worker work.
- No new schemas.

## Acceptance Criteria

- `ether supervisor status --workspace <path>` initializes/validates the workspace through Rust supervisor authority.
- Output includes `workspace_id`, `authority`, `transport`, `daemon_running`, `ledger_chain_valid`, `ledger_events`, `ledger_head_event_id`, `runtime_dir`, `ledger_path`, and `registry_path`.
- A clean workspace reports `ledger_chain_valid=true`, `ledger_events=0`, and `daemon_running=false`.
- A workspace with an existing Rust supervisor run reports the ledger head and event count without appending status events.
- A mismatched workspace id still fails before runtime initialization through the existing Rust guard.

## Implementation Steps

1. Add ledger status helpers in `crates/supervisor/src/lib.rs`.
2. Add `supervisor.status` handling in `crates/supervisor/src/main.rs`.
3. Add `supervisor status` parsing/printing in `packages/tui/src/cli.ts`.
4. Add Rust and TUI tests that prove status is read-only and truthful.

## Verification Steps

- `cargo test`
- `npm test`
- Re-read the four docs above and confirm the change stays inside V1/TUI and runtime-loop hardening.

## Drift Check

This loop is aligned if the final diff improves runtime observability without claiming daemon capability or expanding P1/P2 surfaces.
