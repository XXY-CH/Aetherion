# Phase 05 — Transcript Persistence

Alignment: baseline doc §8 — OpenClaw persists sessions and resumes them. Ether's `/new` only clears in-memory state; closing the TUI loses the conversation. This is the most directly felt gap.

OpenClaw's session system (gateway-protocol + session-key routing + backend RPC) is far too heavy for Ether V1 (TUI-first, no gateway). The ponytail minimum: one transcript file per workspace, loaded on startup, saved on every update.

## Baseline delta

Current state (`packages/tui-go/setupapp/model.go:181`): `NewModel` hardcodes `transcript: [{Role: "intro", Text: "Aetherion"}]`. No load, no save.

`loadTreeNodes` already reads the ledger — but that's event metadata, not the rendered conversation. The transcript (user prompts + assistant responses + tool results) is ephemeral.

## Scope (minimum viable)

1. **Load on startup**: `NewModel` reads `.aetherion/transcript.json` if it exists. If not, use the default intro entry.
2. **Save on update**: after every transcript append (user prompt, assistant text, tool result, slash command), write the file.
3. **`/new` clears the file**: creates a fresh transcript and saves it.
4. **`/clear` keeps the file**: clears the current view but preserves history on disk (matches current `/clear` semantics).

## What this is NOT

- No session list / session switching.
- No session-key routing.
- No gateway RPC.
- No per-session config.
- No transcript encryption (the transcript is workspace-local, same trust as the ledger).

## File format

```json
[
  {"role":"user","text":"hello","meta":"stub / default"},
  {"role":"assistant","text":"Hi! ...","meta":"assistant · 42 tok"}
]
```

Plain JSON array of `transcriptEntry`. Location: `<workspaceRoot>/.aetherion/transcript.json`.

## Tests (TDD — written first)

1. `SaveTranscript writes valid JSON array to .aetherion/transcript.json`
2. `LoadTranscript returns saved entries from disk`
3. `LoadTranscript returns empty slice when file does not exist`
4. `LoadTranscript skips malformed entries without aborting`
5. `NewModel loads transcript from disk when file exists`
6. `NewModel uses default intro when file does not exist`
7. `/new saves an empty transcript (just intro) to disk`

## Exit criteria

- All new tests pass.
- `npm run test:go-tui` green.
- Transcript survives TUI restart.
- No regression in existing Go tests.

## Out of scope

- Multiple sessions.
- Transcript branching/forking.
- Transcript search.
- Configurable transcript path.
