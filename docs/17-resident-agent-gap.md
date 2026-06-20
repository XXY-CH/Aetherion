# Resident Agent Capability Gap Analysis

[中文版本](17-resident-agent-gap.zh-CN.md)

This document maps the gap between Aetherion's current agent runtime and OpenClaw's resident agent capabilities. It is the prioritized backlog for all future ponytail iterations targeting functional parity.

---

## Gap Matrix

| # | Capability | OpenClaw | Aetherion | Gap Severity |
|---|---|---|---|---|
| 1 | Always-on daemon | Full (launchd/systemd/schtasks, KeepAlive) | None (CLI one-shot by design) | **Critical** |
| 2 | Inbound channels (~30) | Full (Telegram/WhatsApp/Discord/Slack/...) | TUI only; IM is hash-only stub | Deferred (V1 = TUI) |
| 3 | Outbound proactive | Full (message tool, cron announce, heartbeat) | Blocked (outbox never delivers) | **High** |
| 4 | Cron/scheduling | Full (at/every/cron, persistent, retries) | Data model only, no watcher | **Critical** |
| 5 | Background tasks | Full (exec/process + task ledger) | None | **High** |
| 6 | Persistent memory | Full (MEMORY.md + vector + dreaming) | Mature model, NOT auto-fed to loop | **Critical** |
| 7 | Tool execution | 100+ tools (shell/files/web/browser/media/MCP) | 2 tools (read/write file) | **Critical** |
| 8 | Multi-agent/subagents | Full (isolated agents + spawn + ACP) | 1 hard-coded read op | Medium |
| 9 | Notifications | Full (APNs/web push/channel delivery) | None | Medium |
| 10 | State persistence | Full (SQLite + JSONL) | Mature for evidence; zero for liveness | **High** |
| 11 | Config/persona | Full (SOUL.md + JSON5 + hot reload) | Mature model, NOT live-influencing | **High** |
| 12 | Skills/custom cmds | Full (57 skills + hooks + plugins) | Capsules = docs only | Medium |

## Priority Order (by user-perceived value × feasibility)

Each item below is a phase. Phases are ordered by what makes the agent feel "alive" vs "a script."

### P0 — Make the agent loop actually useful (tools + memory)

These are blocked right now: the agent can only read/write files and has no memory injected. Fixing these makes every conversation better immediately.

1. **Shell execution tool** — `exec` tool that runs a command and returns stdout/stderr. Policy-gated (L4 risk), approval-gated for side effects. Without this, the agent can't DO anything beyond file I/O.
2. **Web fetch tool** — fetch a URL and return markdown/text. Read-only, L2 risk. Without this, the agent can't look anything up.
3. **Memory injection into agent loop** — load `MemoryCard` + `UserModel` into the system prompt at loop start. The data model exists (`memory-os`), just not wired.

### P1 — Make the agent persistent (daemon + scheduling)

4. **Foreground daemon mode** — `ether daemon --workspace .` runs the agent loop in a long-lived process (not a system service yet; just a foreground process that stays alive and accepts input).
5. **Deadline trigger watcher** — poll `hibernation` wakeups on an interval. The data model (`createDeadlineTrigger`) exists; just needs a watcher loop.
6. **Session resume** — reload the last conversation from ledger + transcript on daemon startup.

### P2 — Make the agent proactive (outbound + notifications)

7. **Outbound message delivery** — actually deliver `ImOutboxItem` when policy allows (at minimum, to the TUI as a notification).
8. **Proactive opportunity lifecycle** — implement the inhibition-gated proactive surface (quiet hours, confidence threshold, tainted source blocking).
9. **Desktop notifications** — native OS notification on task completion / approval request.

### P3 — Make the agent extensible (skills + multi-agent)

10. **Skill loading** — lazy-load `SKILL.md` files into the system prompt (OpenClaw pattern: inject name/description only, model reads on demand).
11. **Subagent spawn** — let the agent delegate a sub-task to a child agent under a budget.
12. **Persona injection** — load `PersonaAnchor` / `SOUL.md` into the system prompt.

## What This Document Replaces

This supersedes the TUI-feature-focused backlog in `docs/16-openclaw-baseline.md` §11. The baseline doc's borrowable-ideas list (lifecycle UUID, commitment state machine, etc.) are still valid micro-improvements, but the resident-agent gap is the strategic priority.
