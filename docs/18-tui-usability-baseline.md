# TUI Usability Baseline — Hermes / OpenCode / Codex Comparison

[中文版本](18-tui-usability-baseline.zh-CN.md)

Reference repos (quarantined at `.quarantine/`):
- Hermes: `.quarantine/hermes/` — Python, prompt_toolkit REPL + optional Ink TUI
- OpenCode: `.quarantine/opencode/` — TypeScript, OpenTUI/SolidJS, client/server split
- Codex: `.quarantine/codex/` — Rust, ratatui, guardian approval model

---

## 1. What the Three References Do Right

### Provider Connection (the #1 blocker for Ether)
| Feature | Hermes | OpenCode | Codex | Ether |
|---------|--------|----------|-------|-------|
| `/model` interactive picker | ✅ fetches live models from API | ✅ DialogModel with search | ✅ `/model` command | ❌ stub-only |
| `/connect` provider setup | ✅ per-provider OAuth + API key | ✅ plugin-driven auth methods | ✅ ChatGPT OAuth + API key | ❌ none |
| Multiple providers simultaneously | ✅ 30+ provider profiles | ✅ dynamic @ai-sdk imports | ✅ openai/bedrock/ollama | ❌ stub only |
| API key in env + config + OAuth | ✅ all three | ✅ all three | ✅ all three | ❌ env var only |
| Model aliases | ✅ `model_aliases` config | ✅ via config | ✅ model catalog | ❌ none |

### Interaction Model
| Feature | Hermes | OpenCode | Codex | Ether |
|---------|--------|----------|-------|-------|
| Streaming responses | ✅ token-by-token | ✅ via SDK events | ✅ StreamController | ⚠️ batch (whole response at once) |
| Multiline input | ✅ TextArea with .md syntax | ✅ TextareaRenderable | ✅ vim mode | ✅ textarea |
| Slash command autocomplete | ✅ SlashCommandCompleter | ✅ autocomplete component | ✅ popup | ✅ filter list |
| `@` context references | ✅ @diff @staged @file: @url: | ✅ @-mentions | ✅ /mention | ❌ none |
| Tool approval UX | ✅ inline panel with allow-once/always/deny | ✅ PermissionPrompt modal with diff | ✅ guardian model + popup | ⚠️ stdin y/n only |
| Inline diff for edits | ✅ render_edit_diff_with_delta | ✅ `<diff>` split/unified | ✅ diff_render.rs 97KB | ❌ none |
| Mid-turn steering | ✅ /steer injects mid-run | ✅ session.interrupt | ✅ escape interrupt | ❌ none |

### Slash Commands
| Feature | Hermes | OpenCode | Codex | Ether |
|---------|--------|----------|-------|-------|
| Command count | ~80 | ~140 keymap + templates | ~60 | ~12 |
| `/model` switch | ✅ | ✅ | ✅ | ✅ (stub only) |
| `/new` / `/clear` | ✅ | ✅ | ✅ | ✅ |
| `/compact` context compression | ✅ | ✅ auto-compact | ✅ | ❌ |
| `/undo` rollback | ✅ snapshot/rollback | ✅ session.undo | ✅ | ❌ (VCS exists but not wired) |
| `/personality` | ✅ 13 built-in | ✅ agent.cycle | ✅ | ❌ |
| `/init` project bootstrap | ❌ | ✅ /init template | ✅ /init | ❌ |
| `/help` | ✅ | ✅ | ✅ | ✅ |
| `/history` | ✅ SQLite session DB | ✅ session.list | ✅ /resume | ⚠️ ledger only |

### System Prompts
| Feature | Hermes | OpenCode | Codex | Ether |
|---------|--------|----------|-------|-------|
| Per-model prompts | ✅ per api_mode | ✅ per provider family | ✅ per model in catalog | ❌ one hardcoded |
| SOUL.md / AGENTS.md | ✅ SOUL.md + HERMES.md | ✅ AGENTS.md | ✅ AGENTS.md spec | ⚠️ AGENTS.md exists |
| Dynamic env block | ✅ platform + tools | ✅ cwd/git/platform/date | ✅ sandbox + workspace | ❌ none |
| Memory injection | ✅ volatile tier | ✅ via instructions | ✅ memories | ✅ MemoryCard (daemon only) |

---

## 2. Ether TUI Current State — Concrete Problems

### P0 — Blocking usability issues
1. **Only stub provider works.** Real LLM providers (OpenAI, Anthropic, etc.) are not wired into the TUI. `/connect` does nothing. The TUI can only talk to a deterministic stub.
2. **No real streaming.** Agent responses appear all at once after the full response is generated, not token-by-token.
3. **Tool approval is stdin y/n only.** No visual diff, no "allow always", no context about what the tool will do.

### P1 — Missing core features
4. **No `/model` picker with live model list.** Can't switch models in the TUI.
5. **No inline diff for file edits.** When the agent writes a file, there's no visual diff showing what changed.
6. **VCS not wired into TUI.** The Git-like VCS (phase 16-21) exists but has no slash commands (`/snapshot`, `/rollback`, `/branch`).
7. **System prompt is static.** No dynamic environment block (cwd, git status, platform, date).
8. **No `/compact`.** Context window fills up with no compression mechanism.

### P2 — Polish
9. ~~**No `@` context references.**~~ ✅ **Implemented** (phase 28): `@file:`, `@diff`, `@staged`, `@url:` references expand inline before agent loop.
10. ~~**No `/init`.**~~ ✅ **Implemented** (phase 29): `/init` bootstraps AGENTS.md.
11. ~~**No personality system.**~~ ✅ **Implemented** (phase 29-30): `/personality` sets tone, injected via `AETHERION_PERSONALITY` env var into system prompt.
12. ~~**No conversation history search.**~~ ✅ **Implemented** (phase 31): `/sessions` lists run history, `/resume <id>` loads events into transcript.

### Post-baseline additions (beyond original P0-P2)
- **Interactive `/connect` wizard** ✅ — multi-step provider/key/model setup inside TUI
- **`/model` real provider switching** ✅ — left/right cycles providers, saves config
- **Visual diff in tool approval** ✅ — write proposals auto-open diff panel
- **`/retry` `/copy` `/compact` `/diff` `/history` `/tools`** ✅ — utility commands
- Slash command count: **26** (was 12)

---

## 3. Iteration Priority

### Phase 22 — Real provider connection (P0-1)
Wire at least OpenAI and Anthropic into the TUI. `/model` picker with live API model list. API key from env + config.

### Phase 23 — Streaming responses (P0-2)
Token-by-token streaming from provider to TUI, replacing batch responses.

### Phase 24 — Visual tool approval with diff (P0-3)
Replace stdin y/n with a visual approval panel showing what the tool will do, with allow-once / allow-always / deny.

### Phase 25 — VCS slash commands (P1-6)
Wire `/snapshot`, `/rollback`, `/branch` into the TUI slash command system.

### Phase 26 — Dynamic system prompt (P1-7)
Environment block (cwd, git, platform, date) + memory + persona injected per-turn.

### Phase 27 — Inline file edit diff (P1-5)
When agent writes a file, show a unified diff in the transcript.

---

## What to Preserve (Harness Workbench identity)
- **Three-pane layout** (event tree + transcript + info cards) — this is Ether's distinctive workbench identity.
- **Policy/lease/consent pipeline** — visible in the info cards panel.
- **Ledger visibility** — the event tree is unique and must stay.
- **VCS layer** — the Git-like operations are a core differentiator.
