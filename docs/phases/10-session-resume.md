# Phase 10 — Session Resume in Daemon Mode

Alignment: doc 17 P1-6. The daemon starts blank every time — no memory of the previous session. It should load recent ledger events as conversation context on startup.

## Scope (minimum viable)

1. On daemon startup, read the last 20 events from the workspace ledger.
2. Filter to user/tool/assistant-relevant events (skip pure system bookkeeping).
3. Format them as a "## Recent Session" section appended to the system prompt.
4. If no events exist, skip silently (fresh start).

## Tests

1. `daemon with prior ledger events includes them in the system prompt`
2. `daemon without prior events starts fresh (no crash)`
3. `daemon truncates to last 20 events`

## Out of scope
- Full transcript replay into the model conversation array.
- Branching/forking sessions.
- Multi-session selection.
