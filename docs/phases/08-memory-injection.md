# Phase 08 — Memory Injection into Agent Loop

Alignment: doc 17 P0-3. The memory data model (`memory-os`) is mature but never loaded into the agent loop. The system prompt is static — the agent has no memory of prior interactions.

## Baseline delta

`defaultSystemPrompt()` in `agent-loop.ts` is hardcoded text with no dynamic content. `startAgentLoopState` accepts an optional `systemPrompt` but the CLI caller never passes one. Memory cards exist in `.aetherion/registries/memory-cards.json` but are invisible to the loop.

## Scope (minimum viable)

1. Update `defaultSystemPrompt` to reflect all 4 tools (read/write/exec/fetch).
2. In `cli.ts`, before calling `startAgentLoopState`, load accepted `MemoryCard` entries from the registry and build a system prompt that includes known facts + user preferences.
3. If no memory cards exist, fall back to the default prompt (backward compatible).

## Tests

1. `defaultSystemPrompt mentions all four tools`
2. `agent loop uses default prompt when no memory cards exist`
3. `agent loop system prompt includes accepted memory facts when cards present`

## Out of scope
- Vector search / semantic recall.
- Causal memory injection.
- Persona/soul injection (P3).
