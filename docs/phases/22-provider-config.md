# Phase 22 — Provider Configuration

The real providers (OpenAI, Anthropic, Gemini) are already implemented in
model-provider.ts. The problem is there's no way to configure them from
the TUI — users have to know about env vars or CLI flags.

## Scope

1. `.aetherion/provider-config.json` — stores provider name, model ref, and API key (plaintext, 0600 perms, same trust as Hermes/OpenCode/Codex).
2. `ether provider set` — interactive command to pick provider, enter API key, select model.
3. `ether provider show` — show current config (key redacted).
4. `resolveModelProvider` reads `.aetherion/provider-config.json` as fallback when env vars are absent.
5. TUI startup banner shows provider + model from config.

## Tests
1. `provider-config.json is written with correct format`
2. `provider set stores provider + model + key`
3. `provider show displays config with redacted key`
4. `resolveModelProvider falls back to config file when env absent`
5. `config file has 0600 permissions`
