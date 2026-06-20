# Phase 06 — Shell Execution Tool

Alignment: doc 17 P0-1. The agent can currently only read/write files. A shell exec tool is the single highest-value capability to make the agent useful — it unlocks code compilation, test running, git operations, system inspection, etc.

## Baseline delta

Current state: `createV1ToolRegistry()` declares exactly 2 tools (`local_file_read`, `local_file_write`). `processToolCall` in `agent-loop.ts:403-420` has a hardcoded read/write branch. There is no concept of a non-file operation.

OpenClaw has `exec` and `process` tools (`src/agents/bash-tools/exec.ts`) — full shell execution with auto-backgrounding, env control, working directory, timeout, and notification on exit.

## Scope (minimum viable)

Add a `shell_exec` tool that runs a single command in the workspace directory and returns stdout/stderr/exit code. The minimum:

1. **Registry**: declare `shell_exec` in `createV1ToolRegistry()` with `verb: "write"` (it has side effects) and a `command` parameter.
2. **Policy**: shell exec maps to a new risk level (L4 — irreversible side effects possible). The policy pipeline returns `ask` (needs approval).
3. **Execution**: run the command via `child_process.execFileSync` with a 30s timeout in the workspace directory. Capture stdout/stderr/exit code.
4. **Agent loop**: add an exec branch in `processToolCall` that handles the `shell_exec` tool name.
5. **Argument parsing**: extend `parseToolArguments` to extract `command` and optional `timeout_ms`.

## What this is NOT

- No background/detached processes (foreground only, blocks the loop).
- No env var injection (inherit current process env).
- No shell features like pipes/redirection by default (use `execSync` with shell for command string).
- No process management (kill/poll/write to stdin).
- No auto-backgrounding on long runs.

## Security model

- **Working directory**: locked to `workspaceRoot`. Cannot cd outside.
- **Timeout**: hard 30s default, max 60s. Kills the process on timeout.
- **Approval**: L4 risk → always `ask`. The user sees the exact command before it runs.
- **No secrets in output**: output is truncated to 10KB for the model context.
- **Ledger**: every exec appends `tool.requested` → `risk.composed` → `policy.decided` → `tool.result` events.

## Tests (TDD — written first)

1. `shell_exec registry entry exists with verb=write and command parameter`
2. `parseToolArguments extracts command and timeout_ms`
3. `processToolCall for shell_exec yields tool_proposal (approval required)`
4. `processToolCall for shell_exec runs echo and returns stdout`
5. `shell_exec respects timeout (kills long-running command)`
6. `shell_exec captures non-zero exit code`
7. `shell_exec output is truncated for model context`
8. `shell_exec denial by user yields tool_denied event`

## Exit criteria

- All new tests pass.
- `npm test` green.
- The agent can run `echo hello` and get `hello` back.
- The agent cannot run a command without user approval.

## Out of scope

- Background processes.
- Process management API.
- Sandbox/container isolation.
- Network egress control for commands.
- Custom env vars.
