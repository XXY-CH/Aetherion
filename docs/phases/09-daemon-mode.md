# Phase 09 — Foreground Daemon Mode

Alignment: doc 17 P1-4. The agent is currently one-shot CLI. A foreground daemon keeps it alive — accepting input via stdin, running agent loops on demand, and periodically checking wakeup triggers.

OpenClaw uses launchd/systemd system services. That's out of V1 scope. The ponytail minimum: a foreground REPL loop that stays alive until Ctrl+C.

## Scope (minimum viable)

1. **New CLI command**: `ether daemon --workspace .` starts a long-lived foreground process.
2. **stdin REPL**: reads lines from stdin; each non-empty line triggers one agent loop turn (reusing the existing `runAgentLoop` infrastructure from the `model chat` path).
3. **Wakeup polling**: every 60 seconds, check `wakeups` registry for eligible triggers. If a deadline trigger is due, emit a system message into the REPL.
4. **Graceful shutdown**: SIGINT/Ctrl+C prints "shutting down" and exits cleanly.
5. **Ledger continuity**: each REPL turn appends to the workspace ledger (already handled by `runAgentLoop`).

## What this is NOT

- No system service registration (launchd/systemd/schtasks).
- No auto-restart on crash.
- No WebSocket/HTTP API.
- No multi-session support (one workspace, one conversation thread).
- No background task execution (tasks block the REPL).

## Architecture

```
ether daemon --workspace .
  → resolve workspace + provider
  → start REPL loop (readline interface on stdin)
  → spawn wakeup poller (setInterval 60s)
  → on each stdin line: runAgentLoop(state, line, approvalCallback)
  → on SIGINT: clear interval, close readline, exit 0
```

The daemon reuses the exact same `startAgentLoopState` + `runAgentLoop` path as `model chat --tools --interactive`, just wrapped in a `while(alive)` instead of a single invocation.

## Tests

1. `daemon processes a single stdin line and produces a loop event`
2. `daemon stays alive after one input (does not exit after first turn)`
3. `daemon polls wakeup triggers and emits deadline notice when due`
4. `daemon handles SIGINT gracefully`

## Exit criteria

- All new tests pass.
- `npm test` green.
- `echo "hello" | ether daemon --workspace .` runs one turn and stays alive (exits on stdin close).
- Wakeup triggers with a past deadline are surfaced.

## Out of scope

- System service installation.
- HTTP/WebSocket API.
- Multi-agent routing.
- Background/detached tasks.
