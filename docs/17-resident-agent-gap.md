# Resident Agent Capability Gap Analysis

[中文版本](17-resident-agent-gap.zh-CN.md)

This document maps the gap between Aetherion's current agent runtime and OpenClaw's resident agent capabilities. It is the prioritized backlog for all future ponytail iterations targeting functional parity.

---

## Gap Matrix

| # | Capability | OpenClaw | Aetherion | Gap Severity |
|---|---|---|---|---|
| 1 | Always-on daemon | Full (launchd/systemd/schtasks, KeepAlive) | Foreground daemon mode (`ether daemon`) with REPL + wakeup polling + session resume | **Medium** (was Critical) |
| 2 | Inbound channels (~30) | Full (Telegram/WhatsApp/Discord/Slack/...) | TUI + daemon stdin; IM is hash-only stub | Deferred (V1 = TUI) |
| 3 | Outbound proactive | Full (message tool, cron announce, heartbeat) | Wakeup triggers poll in daemon; outbox delivery still blocked | **High** |
| 4 | Cron/scheduling | Full (at/every/cron, persistent, retries) | Wakeup trigger polling (deadline/file) in daemon; no full cron | **High** (was Critical) |
| 5 | Background tasks | Full (exec/process + task ledger) | None | **High** |
| 6 | Persistent memory | Full (MEMORY.md + vector + dreaming) | Model auto-injected into loop (cards + prefs); no vector search | **High** (was Critical) |
| 7 | Tool execution | 100+ tools (shell/files/web/browser/media/MCP) | 4 tools (read/write file, shell exec, web fetch) | **High** (was Critical) |
| 8 | Multi-agent/subagents | Full (isolated agents + spawn + ACP) | `agent_spawn` tool (nested child loop, budget-constrained, approval-gated) | **Low** (was Medium) |
| 9 | Notifications | Full (APNs/web push/channel delivery) | Cross-platform desktop notifications in daemon | **Low** (was Medium) |
| 10 | State persistence | Full (SQLite + JSONL) | Ledger (evidence) + transcript.json + daemon session resume | **Low** (was High) |
| 11 | Config/persona | Full (SOUL.md + JSON5 + hot reload) | SOUL.md + IDENTITY.md + PersonaAnchors injected into prompt | **Low** (was High) |
| 12 | Skills/custom cmds | Full (57 skills + hooks + plugins) | Lazy SKILL.md loader injected into prompt | **Low** (was Medium) |

## Priority Order (by user-perceived value × feasibility)

Each item below is a phase. Phases are ordered by what makes the agent feel "alive" vs "a script."

### P0 — Make the agent loop actually useful (tools + memory) ✅ COMPLETE

These were the highest-value gaps. All three are now implemented:

1. ✅ **Shell execution tool** (phase 06) — `shell_exec` tool, L4 risk, approval-gated, 30s timeout, runs in workspace dir.
2. ✅ **Web fetch tool** (phase 07) — `web_fetch` tool, read-only network fetch, 15s timeout, truncated output.
3. ✅ **Memory injection into agent loop** (phase 08) — accepted `MemoryCard` entries + `UserModel` preferences loaded into system prompt. Falls back to default when empty.

### P1 — Make the agent persistent (daemon + scheduling) ✅ COMPLETE

4. ✅ **Foreground daemon mode** (phase 09) — `ether daemon --workspace .` runs a REPL that stays alive across multiple inputs. Auto-approve L0-L2, L3+ prompts. SIGINT = graceful shutdown.
5. ✅ **Deadline trigger watcher** (phase 09, integrated) — daemon polls wakeup triggers every 60s. Deadline and file-change triggers from the hibernation registry are surfaced when eligible.
6. ✅ **Session resume** (phase 10) — daemon loads the last 20 ledger events on startup and injects them as "Recent Session" context. Shows "session resumed" banner.

### P2 — Make the agent proactive (outbound + notifications)

7. **Outbound message delivery** — actually deliver `ImOutboxItem` when policy allows (at minimum, to the TUI as a notification).
8. **Proactive opportunity lifecycle** — implement the inhibition-gated proactive surface (quiet hours, confidence threshold, tainted source blocking).
9. **Desktop notifications** — native OS notification on task completion / approval request.

### P3 — Make the agent extensible (skills + multi-agent) ✅ COMPLETE

10. ✅ **Skill loading** (phase 13) — `scanSkills()` scans workspace `skills/` for `SKILL.md`, injects name + description + path into prompt. Model reads full content on demand via `local_file_read`.
11. ✅ **Subagent spawn** (phase 15) — `agent_spawn` tool delegates a sub-task to a nested child agent loop. Budget-constrained (maxLoopDepth=5, 512 output tokens), approval-gated (L4). Returns child's final text.
12. ✅ **Persona injection** (phase 14) — `loadPersonaFiles()` reads `SOUL.md` + `IDENTITY.md` from workspace. Accepted `PersonaAnchor` entries loaded from registry. All injected into daemon system prompt.

## What This Document Replaces

This supersedes the TUI-feature-focused backlog in `docs/16-openclaw-baseline.md` §11. The baseline doc's borrowable-ideas list (lifecycle UUID, commitment state machine, etc.) are still valid micro-improvements, but the resident-agent gap is the strategic priority.
