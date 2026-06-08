# Runtime Loop 002: Explicit Local Socket RPC

## Requirements Summary

This loop follows `runtime-loop-001-supervisor-status.md` and the original docs:

- `docs/06-roadmap.md` names a future Local Supervisor daemon.
- `docs/10-technical-strategy.md` allows JSON-RPC over stdio, Unix socket, or named pipe during Phase 2, while stating the current crate is not yet a production daemon.
- `docs/13-schema-runtime-governance.md` says new work should harden or extend runtime loops before broadening schema surface.

The next aligned step is to add an explicit local Unix socket RPC mode to the Rust supervisor. This narrows the gap from one-shot stdio POC toward a local service boundary without claiming install/start/stop daemon support.

## Scope

- Add `aetherion-supervisor socket --path <socket>` as an explicit foreground server.
- Accept one JSON-RPC request per connection, using the same `handle_rpc_line` path as stdio.
- Keep request validation, workspace identity checks, policy checks, and Ledger writes centralized in the existing RPC handler.
- Add an Ether client helper for a single socket RPC call.
- Add tests for status over socket and for socket use not appending Ledger events.

Out of scope:

- No daemon install/start/stop/status lifecycle.
- No background process supervision.
- No launchd/systemd/Windows service integration.
- No auth token or device pairing yet.
- No IM, browser, OAuth, MCP, GUI, cloud worker, or connector work.
- No new schemas.

## Acceptance Criteria

- A foreground `aetherion-supervisor socket --path <socket>` process accepts local socket requests.
- A `supervisor.status` request over the socket returns the same truthful fields as stdio: `transport=unix-socket`, `daemon_running=false`, Ledger validity, event count, head pointers, and runtime paths.
- Socket status initializes or validates the workspace registry and Ledger file but appends no status Ledger events.
- Wrong workspace ids still fail before runtime initialization through the existing RPC handler.
- Existing stdio RPC and Ether default run behavior stay unchanged.

## Implementation Steps

1. Refactor the Rust RPC response path so stdio and socket share `handle_rpc_line`.
2. Add Unix-only `socket` command and tests in `crates/supervisor/src/main.rs`.
3. Add optional socket client support in `packages/harness-core/src/supervisor-client.ts`.
4. Add a targeted TS integration test only if the local platform exposes Unix sockets through Node.

## Verification Steps

- `cargo fmt --check`
- `cargo test`
- `npm test`
- Re-read the docs above and confirm the final diff does not claim production daemon capability.

## Drift Check

This loop is aligned if it moves the supervisor from one-shot stdio toward an explicit local service transport while preserving the Local Supervisor as authority and keeping all non-V1 surfaces out of scope.
