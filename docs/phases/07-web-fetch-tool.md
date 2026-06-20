# Phase 07 — Web Fetch Tool

Alignment: doc 17 P0-2. Without web access the agent cannot look anything up. A web fetch tool is the second highest-value capability after shell exec.

## Scope (minimum viable)

1. **Registry**: declare `web_fetch` with `verb: "read"` (read-only network fetch), `url` parameter.
2. **Execution**: use Node built-in `fetch()`, return response text (truncated to 10KB), capture status code.
3. **Agent loop**: reuse the existing read branch pattern — web_fetch goes through a simplified policy check (L2 risk, allow) without file-system lease.
4. **Stub provider**: recognize 'fetch'/'url'/'http' intent and emit web_fetch tool calls.

## Tests

1. `web_fetch registry entry exists with verb=read and url parameter`
2. `parseToolArguments extracts url`
3. `stub provider emits web_fetch on fetch/url intent`
4. `web_fetch returns page content (stubbed)`

## Out of scope
- JS rendering, headless browser.
- Auth/cookies.
- Rate limiting.
- Caching.
