# Runtime Loop 008: Supervisor RPC Response ID Binding

## Requirements Summary

The Ether and harness-core paths now call the Rust Supervisor over stdio and explicit foreground sockets. The shared TypeScript RPC client parses a single JSON-RPC response and fails on `error`, but it does not yet verify that the response `id` matches the request `id`. Binding responses to request ids is a small runtime-hardening step for both transports: a stale, delayed, malformed, or wrong-request response must not be accepted as evidence for the current supervisor action.

## Scope

- Validate that every parsed supervisor RPC response id equals the request id before returning success.
- Apply the check to both stdio and socket transports through `callSupervisorRpc`.
- Preserve existing error handling for supervisor-reported `error` responses.
- Add focused client tests for mismatched response ids.
- Keep all existing supervisor methods and schemas unchanged.

Out of scope:

- No batch JSON-RPC support.
- No multi-response streaming protocol.
- No daemon/session multiplexing.
- No transport encryption, token storage, user/device identity, vault, IM, browser, OAuth, MCP, GUI, cloud worker, or connector work.
- No new schemas.

## Acceptance Criteria

- A response with a non-matching `id` fails even when it contains a successful `result`.
- A matching response still succeeds for existing stdio and socket-backed calls.
- Socket-backed Ether runs remain unchanged except for the stronger response binding.
- Full test suite remains green.

## Implementation Steps

1. Add a shared response-id assertion in `packages/harness-core/src/supervisor-client.ts`.
2. Use it for parsed stdio and socket responses.
3. Add a unit/integration test that feeds a mismatched response through a lightweight local socket server.
4. Add or adjust docs to describe request/response id binding as part of the local RPC contract.
5. Run targeted and full verification.

## Verification Steps

- Targeted supervisor-client/socket test.
- `cargo fmt --check`
- `cargo test`
- `npm test`
- Re-read `docs/06-roadmap.md`, `docs/10-technical-strategy.md`, and `docs/13-schema-runtime-governance.md` for drift.

## Drift Check

This loop is aligned if it strengthens the existing Phase 2 stdio/local-socket RPC path without adding product surfaces, daemon/session multiplexing, identity, vault, or connector behavior.
