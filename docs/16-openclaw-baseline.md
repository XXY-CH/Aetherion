# OpenClaw Baseline Comparison

[中文版本](16-openclaw-baseline.zh-CN.md)

This document is the comparison anchor for every ponytail iteration. Each iteration begins by re-reading this baseline, choosing an alignment direction, and writing a phase plan. It is deliberately structured as findings + gaps + verdicts so iteration plans can cite specific lines.

Source of OpenClaw evidence: the quarantined clone at `.quarantine/openclaw/` (gitignored, never shipped). OpenClaw is treated as a migration/research input, never a trust root, per `AGENTS.md` import-boundary rule.

---

## 1. What OpenClaw Is

OpenClaw is a TypeScript/ESM, terminal-first personal AI assistant that runs locally as a single Node process and exposes itself over a loopback WebSocket "Gateway" plus ~25 messaging channels. Repo scale: ~20k files, `src/` (core app + agent runtime), `packages/` (21 internal TS packages), `extensions/` (~145 plugins), `skills/` (~58 skill docs), `ui/`, `apps/`.

Key positioning documents:

- `VISION.md` — "the AI that actually does things," local-first personal assistant. Explicitly anti-nested-planner (line 122: manager-of-managers / nested planner trees are on the will-not-merge list).
- `AGENTS.md` — engineering policy. Core stays plugin-agnostic; plugins cross into core only via `openclaw/plugin-sdk/*` barrels. Storage default: SQLite only.
- `docs/refactor/database-first.md` — the fact-layer constitution. They migrated away from JSON/JSONL files to SQLite as the canonical runtime store.

## 2. Conceptual Model Comparison

| Concept | Aetherion (target) | OpenClaw (as-built) | Verdict |
|---|---|---|---|
| Root authority | Local Supervisor (Rust process boundary) | Local runtime + loopback Gateway owning `state/openclaw.sqlite` | **Shared direction.** Both are local-first, no cloud supervisor. OpenClaw has no Rust authority boundary; its "authority" is a single Node process + SQLite locks. |
| Fact layer | Event Ledger (append-only, SHA-256 parent chain, replay-reconstructable) | Two-level SQLite (control-plane + per-agent data-plane); transcript event stream is the append-ish record | **Shared direction, different mechanism.** OpenClaw uses SQLite tables; Aetherion uses a hash-chained JSONL ledger. Both treat the durable store as the fact layer and ban locator strings from runtime. |
| Agent model | Agent Orchestrator (context assembler / planner / agent loop / verifier) | Single serialized agent loop per session; no supervisor hierarchy | **Shared direction.** Both reject nested planners. Aetherion adds an explicit Verifier step OpenClaw lacks. |
| Trust boundary | Generated/imported code never runs inside Local Supervisor | Plugin code runs in the same Node process; sandboxed flag + fs policy per tool-run | **Aetherion stricter.** OpenClaw plugins are in-process; Aetherion mandates a separate authority process. |

## 3. Capability Model — The Core Divergence

This is the single most important architectural difference.

**Aetherion — Capability Capsules:**
- Capsules declare permission requirements and constraints.
- Capsules do NOT own runtime grants.
- Runtime grants are scoped leases issued by Tool Access & Action Policy Proxy.
- Separation between "declares requirement" and "owns permission" is a first-class invariant (`docs/01-architecture.md:55`, `AGENTS.md`).

**OpenClaw — Flat plugin model:**
- Plugins both declare AND own their capabilities (`contracts.tools`, `contracts.embeddingProviders`).
- A plugin's emitted tools must be a subset of its declared `contracts.tools` (`src/plugins/tool-contracts.ts`).
- The closest analog to "declaring requirements without owning permissions" is a skill's `requires` block (`src/skills/types.ts:27-33`) — but that is an *availability filter* (hide the skill if the config is absent), not a lease request.
- The only true per-request lease-like mechanism is exec/plugin approval (`src/infra/plugin-approvals.ts`, `src/infra/exec-approvals.ts`) with allow-once / allow-always / deny. It is scoped to exec commands, not general capability delegation.

**Verdict:** Aetherion's capsule/lease split is the defining property OpenClaw's flat plugin model lacks. This is not a gap to close by copying OpenClaw — it is a differentiator to preserve.

## 4. Tool Gating Comparison

| Layer | Aetherion (target) | OpenClaw (as-built) |
|---|---|---|
| Policy composition | Tool Access & Action Policy Proxy: risk from action type, sensitivity, taint, reversibility, blast radius, egress destination | 4-layer pipeline: profile → providerProfile → global → agent → group → sender (`src/agents/tool-policy-pipeline.ts:127`) |
| Per-call gate | Scoped lease issuance after consent | `beforeToolCall` hook (`src/agents/agent-tools.before-tool-call.ts`) returning `{block:true}` to veto |
| Human approval | Approval card → consent → lease | Exec/plugin approvals with channel-native delivery (Telegram/Slack inline buttons) |
| Data egress control | Explicit egress destination in risk composition | `packages/net-policy` IP allow/deny + sensitive-URL redaction |

**Verdict:** OpenClaw's gating is mature and battle-tested (4-layer policy pipeline + beforeToolCall + approvals + net-policy). Aetherion's policy proxy is contract-first but thinner in implementation. **Alignment direction: borrow the layered-policy-pipeline shape, not the in-process execution model.** Keep leases as scoped tokens, not yes/no approvals.

## 5. Event / Trace / Ledger Comparison

OpenClaw has three distinct recording systems where Aetherion has one unified ledger:

| System | OpenClaw | Aetherion equivalent |
|---|---|---|
| In-memory event bus | `src/infra/agent-events.ts` — per-run monotonic `seq`, lifecycle generation UUID to reject stale-run events after restart. Not durable. | Event Ledger envelopes (durable) |
| Diagnostic trace | W3C traceparent via `AsyncLocalStorage` (`src/infra/diagnostic-trace-context.ts`); diagnostic events feed a timeline | Trace replay reconstruction (`packages/harness-core/src/replay.ts`) |
| Durable transcript | Tree-structured JSONL/SQLite session transcript (`packages/agent-core/src/harness/session/jsonl-storage.ts`) | Event Ledger with SHA-256 parent chain |

**Verdict:** OpenClaw's lifecycle-generation UUID (reject events from a run that died in a gateway restart) is a concrete, borrowable idea for Aetherion's ledger — it solves the stale-run-event problem Aetherion will face once it has long-running runs. The W3C traceparent propagation is also worth adopting for cross-process trace correlation once Aetherion has the Rust supervisor talking to the TS orchestrator.

## 6. Memory Comparison

| Aspect | Aetherion (target) | OpenClaw (as-built) |
|---|---|---|
| Canonical memory | Memory OS stores knowledge with sources + sensitivity metadata | `MEMORY.md` human-readable file is canonical; SQLite is derived index |
| Vector index | "Vector later" — rebuildable projection | sqlite-vec embeddings over memory files (`packages/memory-host-sdk/src/host/memory-schema.ts`) |
| Consolidation | Dreaming produces reviewable patches, not actions | Dreaming with light/deep/REM phases (`docs/concepts/dreaming.md`); writes to `memory/.dreams/` + `DREAMS.md` |
| Provenance | Sources + sensitivity on every memory entry | `source_message_id` / `source_run_id` on commitments; transcript lineage |

**Verdict:** OpenClaw's dreaming system is the most developed analog to Aetherion's "dreaming produces reviewable patches" invariant. Aetherion's constraint (patches, not actions) is stricter than OpenClaw's (deep phase writes to `MEMORY.md`). **Alignment direction: study OpenClaw's light/deep/REM phase structure as the shape, keep the reviewable-patch constraint.**

## 7. Proactive Behavior Comparison

| Mechanism | OpenClaw | Aetherion invariant |
|---|---|---|
| Heartbeat | Periodic 30m main-session turn reading `HEARTBEAT.md`; replies `HEARTBEAT_OK` or surfaces alert | "Aetherion does not wake up periodically to think" — heartbeat violates this |
| Cron | Detached scheduled jobs in `cron_jobs` table | "Timers acceptable for exact deadlines and maintenance jobs" — aligned |
| Dreaming | Nightly memory consolidation | Aligned (patches, not actions) |
| Commitments | Opportunity lifecycle: `pending → sent → snoozed → expired` with `inferred_user_context` / `agent_promise` sources | Closest match to Aetherion's Opportunity Lifecycle with inhibition |
| Inhibition | `activeHours` windows on heartbeat/tasks | Aetherion requires a full inhibition layer (quiet hours, meetings, tainted sources, low confidence...) |

**Verdict:** OpenClaw's Commitments system (`src/commitments/types.ts`) is the most direct match for Aetherion's Opportunity Lifecycle. **Alignment direction: borrow the commitment state machine shape (`pending/sent/dismissed/snoozed/expired`) and the `agent_promise` vs `inferred_user_context` source distinction.** Reject the heartbeat model — it is exactly the "cron self-interruption" Aetherion's invariant forbids.

## 8. Skills Comparison

| Aspect | Aetherion | OpenClaw |
|---|---|---|
| Skill format | Procedural knowledge + import format; skills do not grant permissions | YAML frontmatter + markdown body; `SKILL.md` + optional `scripts/` |
| Loading | TBD (Capability OS governs capsules; skills are separate) | Lazy: only name/description/location injected into prompt; model reads `SKILL.md` on demand (`src/skills/loading/skill-contract.ts:34-58`) |
| Requirements | Capsules declare requirements; skills are procedural | `requires: {bins, anyBins, env, config}` is an availability filter, not a lease |
| Invocation | Through governed tool sessions | Model reads the file; optional scripts run via normal shell tool (same exec gating) |

**Verdict:** OpenClaw's lazy skill loading (inject only name/description/location, let the model read on demand) is a proven pattern that keeps the system prompt small. **Alignment direction: adopt lazy skill loading as the default.** Do NOT adopt skills-as-permission-declarations — that collapses the capsule/skill distinction Aetherion requires.

## 9. Storage Discipline Comparison

| Aspect | Aetherion | OpenClaw |
|---|---|---|
| Runtime facts | JSONL Event Ledger (hash-chained) | SQLite (control-plane + data-plane) |
| Config | YAML/JSON manifests + Markdown | `openclaw.json` (JSON5 file) — deliberately outside DB |
| Projections | SQLite run index, FTS, vector (all rebuildable) | sqlite-vec embeddings (rebuildable from `MEMORY.md`) |
| Migration | Import generates a migration report; items default to quarantine | `openclaw doctor --fix` owns file-to-DB migration; runtime never reads legacy shapes |

**Verdict:** OpenClaw's hard separation of config (file) vs runtime facts (SQLite) is aligned with Aetherion's governance-vs-projection split. The "runtime reads only current canonical config; legacy shapes handled by a doctor command, never runtime shims" rule (`AGENTS.md`) is worth adopting verbatim for Aetherion's own config evolution.

## 10. What Aetherion Should NOT Borrow

1. **In-process plugin execution.** OpenClaw plugins run in the same Node process. Aetherion's invariant that generated/imported code never runs inside the Local Supervisor is non-negotiable.
2. **Heartbeat polling.** It is the "cron self-interruption" Aetherion explicitly forbids. Proactive behavior must be event-driven with inhibition.
3. **Flat plugin ownership of capabilities.** Capsules declare; the proxy grants. Do not let skills or connectors own permissions.
4. **25 messaging channels.** V1 is TUI-only. IM delivery is out of scope until an explicit phase.
5. **Nested planner trees.** Both projects agree here — do not add a manager-of-managers.

## 11. What Aetherion SHOULD Borrow

Ranked by value-to-effort:

1. **Lifecycle-generation UUID for run events** (`src/infra/agent-events.ts:184`). Rejects stale events from a run that died in a restart. Low effort, high value once Aetherion has long-running runs.
2. **Commitment state machine** (`src/commitments/types.ts`). `pending → sent → dismissed → snoozed → expired` with `agent_promise` vs `inferred_user_context` sources. Direct fit for the Opportunity Lifecycle.
3. **Layered tool-policy pipeline shape** (`src/agents/tool-policy-pipeline.ts:127`). profile → providerProfile → global → agent → group → sender. Aetherion's proxy can adopt the layering without adopting in-process execution.
4. **Lazy skill loading** (`src/skills/loading/skill-contract.ts:34-58`). Inject name/description/location only; model reads on demand. Keeps the system prompt small.
5. **W3C traceparent propagation** (`src/infra/diagnostic-trace-context.ts`). For correlating traces across the TS orchestrator ↔ Rust supervisor boundary.
6. **Dreaming light/deep/REM phase structure** (`docs/concepts/dreaming.md:30-34`). As the shape for Aetherion's reviewable-patch dreaming.
7. **Config-vs-facts separation rule** (OpenClaw `AGENTS.md:76-83`). Runtime reads only current canonical config; legacy migration is a doctor command, not a runtime shim.

## 12. Current Aetherion Implementation State (Baseline Snapshot)

As of this baseline:

- **174 tests, 173 pass, 1 fail.** The failing test (`tui.test.ts:744` — npm package dry-run) is a maxBuffer issue surfaced by the OpenClaw clone leaking into `npm pack`; fixed by adding `.quarantine/` to `.npmignore`.
- `packages/harness-core/` — TypeScript seed proving the V1 loop: schema, consent, lease, verify, workspace, risk, approval, local-file, replay, policy, ledger, registry, supervisor-client, run-local, run-supervisor, boundary, agent-runtime, model-provider, output-summary.
- `crates/supervisor/` — Rust authority-boundary POC: workspace ledger init, SHA-256 parent chain, workspace identity, traced file-action RPCs, stdio RPC for the TS client.
- `packages/tui-go/` — Go operator setup TUI (Bubble Tea), non-authorizing client surface.
- `schemas/` — 80+ JSON Schema contracts.
- `docs/` — 15 numbered design docs (00–15) covering product brief through production gap closure plan.

This is the state every future iteration compares against.

---

## Iteration Protocol

Every ponytail iteration follows:

1. **Compare against this baseline** — re-read sections 3–11, note what has changed.
2. **Choose an alignment direction** — pick one item from section 11 (or a new gap discovered during work).
3. **Write a phase plan document** (`docs/phases/NN-<slug>.md`) — scope, contracts, tests, exit criteria. No Plan mode; write the doc and proceed.
4. **TDD development** — test first, then minimum implementation (ponytail rung 5 only after rungs 1–4 are exhausted).
5. **Test + document progress + git commit** — leave a trace.
