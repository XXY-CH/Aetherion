# OpenClaw Backend Runtime Baseline And Lag Review

[中文版本](16-openclaw-baseline.zh-CN.md)

This document is the critical baseline for Aetherion backend-runtime hardening. It does not claim Aetherion is close to OpenClaw. It records where the current runtime is behind, which surfaces are only thin seed implementations, and which existing files still do not amount to a product-grade backend runtime.

Evidence scope:

- Current Aetherion repo: `packages/harness-core/`, `packages/tui/`, `crates/supervisor/`, `docs/14-runtime-loop-plan.md`, and `docs/15-production-gap-closure-plan.md`.
- Local quarantined references: `.quarantine/openclaw/`, `.quarantine/hermes/`, and `.quarantine/opencode/`. These are research inputs only, never trust roots, and their in-process plugin model is not copied into Aetherion authority.
- Verification snapshot: on 2026-06-23, `npm test` reported `347` tests, `337` passing, and `10` failing. Failures include one `packages/harness-core/test/vcs-gc.test.ts` GC assertion and a block of onboarding/doctor/release-evidence failures caused by the missing or unlinked Chinese companion for `docs/19-tui-visual-polish.md`.
- Pre-document dirty state already included untracked files: `packages/harness-core/src/vcs/gc.ts`, `packages/harness-core/test/vcs-gc.test.ts`, and `packages/tui-go/ether-setup`. This baseline does not treat those as work created by this document refresh.

## 0. Verdict

Aetherion is not yet a mature backend runtime. It is a contract-heavy, test-heavy, boundary-aware seed harness. It is stricter than OpenClaw on authority and non-authorizing evidence, but it is clearly behind in runtime scheduling, tool governance, durable sessions, plugin/skill ecosystem, output management, and release readiness.

The most dangerous illusion is that the repo already has `agent-loop`, `shell_exec`, `web_fetch`, `agent_spawn`, VCS branches, skills, and proactive files, so it looks like a complete agent runtime. It is not. Several capabilities are declared to the model without going through one Rust supervisor, policy proxy, scoped lease, managed-output, stale-call rejection, and durable session-runner path.

Current baseline:

- **Advantage but incomplete:** Local Supervisor / Event Ledger / scoped leases / schema governance remain the right direction.
- **Severe lag:** OpenClaw already has layered tool policy, a `before_tool_call` choke point, Gateway event streams, approval routing, versioned lazy skills, a commitments runtime, and SQLite storage discipline. Aetherion mostly has local TypeScript seed slices.
- **Not release-ready:** `npm test` is not green, and readiness/release evidence is currently blocked by docs parity.
- **Next priority:** tighten authorization for already declared tools, then fix readiness tests, then borrow the smallest OpenClaw runtime primitives. Do not widen into channels, GUI, MCP, OAuth, or cloud execution first.

## 1. Current Aetherion Backend State

| Runtime layer | Current evidence | Critical conclusion |
| --- | --- | --- |
| Agent loop | `packages/harness-core/src/agent-loop.ts` can call a provider across turns, process tool calls, write model artifacts, and append ledger events. | It is still a single-process TypeScript loop. There is no product session runner, durable queue, crash recovery, stale-call rejection, or provider-turn admission model. |
| Tool registry | `createV1ToolRegistry()` declares `local_file_read`, `local_file_write`, `shell_exec`, `file_edit`, `search_files`, `list_files`, `web_fetch`, and `agent_spawn`. | The declaration surface is larger than the authorization surface. `exec`, `fetch`, and `spawn` use inline branches instead of one ToolRequest / PolicyDecision / Lease / Verifier target family. |
| Policy | `policy.ts` has a two-step boundary + operation seed pipeline: read allows, write asks. | It is much thinner than OpenClaw's profile/provider/global/agent/group/sender policy layers, and has no equivalent typed DSL for exec, network, or subagent targets. |
| Lease enforcement | `local-file.ts` checks active lease, `scope.tools`, `scope.egress`, and paths for read/write. | It only covers file read/write. `shell_exec`, `web_fetch`, and `agent_spawn` have no equivalent lease executor. |
| Rust supervisor | `crates/supervisor/` handles workspace identity, hash ledger, file read/write/status, and socket-auth POC paths. | It is not a general authority broker. It does not govern shell, network, subagents, providers, vault, scheduler, or adapters. |
| VCS/sandbox | `vcs/branch.ts`, `tree-snapshot.ts`, rollback, and subagent worktrees exist. | `vcs-gc.test.ts` currently fails; branch merge/checkout is still local-copy seed behavior, not OpenClaw/OpenCode-grade session publication/recovery. |
| Skills | `skills.ts` scans `skills/*/SKILL.md` and injects name/description/path. | This only copies the smallest shape of OpenClaw lazy loading. It lacks promptVersion, requires eligibility, source provenance, visibility policy, skill command dispatch, and source distinction. |
| Proactive | `proactive.ts` is a pure inhibition evaluator. | This is not an Opportunity runtime. It has no OpenClaw-style commitments store, extraction, dedupe, or delivery. |
| Provider | No-tools provider paths and tool-mode artifacts exist; provider config can store API keys. | Vault is not implemented and the tool-mode safety boundary is incomplete. Plaintext `.aetherion/provider-config.json` is only acceptable as a POC. |
| Release/readiness | doctor/onboarding/release evidence is rich. | It is currently blocked by the `docs/19` bilingual companion gap, so the repo is not ready. |

## 2. Lag Against OpenClaw

| Capability | OpenClaw shape | Aetherion now | Lag |
| --- | --- | --- | --- |
| Layered tool policy | `src/agents/tool-policy-pipeline.ts`: profile, provider profile, global, agent, provider-agent, group, and sender filtering with audit warnings. | Read/write seed pipeline only; no agent/provider/sender/group semantics. | **L5 severe** |
| Tool-call choke point | `src/agents/agent-tools.before-tool-call.ts` centralizes plugin hooks, trusted policies, approvals, diagnostics, loop detection, skill telemetry, and param adjustment. | `agent-loop.ts` handles tool names in scattered inline branches. | **L5 severe** |
| Approval system | Exec/plugin approvals include allow once/always/deny, timeout, and Gateway/channel routing. | File writes have consent artifacts; exec/spawn use callbacks; fetch has no policy gate; approval routing is not durable. | **L5 severe** |
| Event lifecycle | `src/infra/agent-events.ts` has run seq, lifecycle generation, and stale event rejection across Gateway restarts. | Ledger has hash chain and run manifest, but the agent loop has no lifecycle-generation fence. | **L4 high** |
| Trace propagation | `src/infra/diagnostic-trace-context.ts` uses W3C traceparent. | Aetherion has replay/ledger traces, but no full standard traceparent across TS/Rust/tools. | **L3 medium** |
| Skills | `src/skills/loading/skill-contract.ts` injects name/description/location/version; `types.ts` has requires, exposure, invocation. | Name/description/path only, one-level scan, no version or eligibility. | **L4 high** |
| Commitments / proactive | `src/commitments/types.ts` defines pending/sent/dismissed/snoozed/expired with source, scope, dueWindow, dedupe, confidence. | Pure inhibition evaluator only; no durable commitment records. | **L4 high** |
| Storage discipline | `AGENTS.md` says runtime uses canonical SQLite only and migrations live in doctor. | Aetherion has JSONL ledger, registries, and artifacts, but many projection families still lack complete rebuild/repair closure. | **L3 medium** |
| Gateway/channels | OpenClaw has loopback Gateway and many channel approval/message paths. | V1 correctly avoids IM/GUI/browser/cloud, but product capability is behind. | **Intentional V1 lag** |
| Plugin execution | OpenClaw's in-process plugin model is mature but riskier. | Aetherion correctly rejects imported/generated code inside Local Supervisor. | **Do not chase** |

## 3. Hermes And OpenCode Calibration

Hermes is not the main target, but it exposes productization gaps: its README describes a full TUI, messaging gateway, closed learning loop, cron, isolated subagents, and six terminal backends. `tools/approval.py` has dangerous-command detection, contextvars for session/turn/tool correlation, gateway approval context, and sensitive-path rules. `managed_tool_gateway.py` shows OAuth/token gateway shape. Aetherion should not copy those surfaces into V1, but it must admit it does not yet have an equally live backend.

OpenCode is the more direct runtime benchmark. `specs/v2/session.md` defines prompt admission, durable inbox, context epochs, provider turns, tool settlement, stale running tool recovery, and compaction as runtime contracts. `specs/v2/tools.md` defines opaque Tool Definitions, input/output codecs, runner-supplied invocation context, stale registration rejection, and output bounding. Aetherion lacks exactly these semantics: a tool call is still too much like a function call and not enough like a durable session event.

## 4. Sharpest Gaps

1. **Tools are advertised before authority is unified.** `createV1ToolRegistry()` exposes shell/network/subagent tools, but `evaluateSeedPolicy()` really understands only read/write. OpenClaw routes every tool through a unified before-tool policy; Aetherion branches by tool name.
2. **Rust supervisor is not the runtime gate.** File read/write can use Rust. Other important capabilities still execute directly in TypeScript. Local Supervisor is the root authority in intent, not yet in coverage.
3. **No durable session runner.** OpenCode has admission, promotion, context epochs, tool settlement, and interruption/recovery. Aetherion's agent loop is still a testable generator.
4. **Output boundaries are weak.** `truncateForModel` is not managed output retention, typed output codecs, provider-facing projection, or complete output references.
5. **Approval is not a system.** File-write consent has artifacts. Exec/spawn approval is callback-based. Fetch has no policy gate. OpenClaw and Hermes both have fuller approval state and routing.
6. **Skills are only directory scanning.** There is no version, source, eligibility, visibility, or telemetry baseline.
7. **Proactive is not a lifecycle.** An inhibition function is not a commitments store and not an Opportunity queue.
8. **Tests are not green.** Current `npm test` fails 10 tests, including release-readiness gates. This is not noise; the release evidence chain is broken.

## 5. Advantages To Preserve

These are not lag items and must not be sacrificed to chase OpenClaw:

- Capability Capsules declare requirements but do not own permissions; runtime grants must be scoped leases issued by the policy proxy.
- Event Ledger is the fact layer; registries, indexes, SQLite, FTS, and vectors are rebuildable projections only.
- Imported plugins, skills, generated packages, and connector adapters must not become trust roots.
- Dreaming can produce reviewable patches or candidates, not automatic actions.
- V1 remains TUI plus local supervisor loop only. No IM, browser extension, GUI, mobile, or cloud worker.

## 6. OpenClaw Alignment Priorities

Ranked by the smallest change that removes the biggest runtime lie:

### P0 - Pull Declared Tools Back Under Authorization

Goal: make `shell_exec`, `web_fetch`, and `agent_spawn` stop bypassing unified policy.

Minimum acceptable shape:

- Add typed ToolRequest target families for exec/fetch/spawn, at least entering `risk.composed -> policy.decided`.
- Tools without a lease executor must not claim lease-backed execution.
- Fetch needs egress policy. Default should allow only loopback or an explicit allowlist; external fetch is at least L2 and audited.
- Exec/spawn approval must produce durable consent/approval artifacts, not only a callback result.

### P0 - Repair Release/Readiness Breakage

Goal: `npm test` should not be blocked by docs parity or the current GC test.

Minimum acceptable shape:

- Add or link `docs/19-tui-visual-polish.zh-CN.md` with its English companion so onboarding/doctor/release evidence expectations recover.
- Fix the root cause of `vcs-gc.test.ts`: either GC deletes orphan trees, or the test is corrected to expose the actual preservation rule. Do not leave the failure as a "known small issue."

### P1 - Add An Aetherion Version Of OpenClaw Lifecycle Generation

Goal: long-running, restarted, or nested child runs must reject stale events.

Minimum acceptable shape:

- Record generation in the run manifest or runtime lock.
- Validate generation when appending or completing terminal events.
- Stale generation can only block/abort; it cannot overwrite current run/session state.

### P1 - Raise Lazy Skills To A Governable Baseline

Goal: move from "scan directory" to "governable skill index."

Minimum acceptable shape:

- `promptVersion` or content hash.
- `requires` works only as an availability filter, never a grant.
- Distinguish bundled, workspace, imported, and quarantined sources.
- Prompt injection includes only name, description, location, and version.

### P1 - Create One Internal beforeToolCall Gate

Goal: every tool passes one minimal hook before execution instead of living in scattered branches.

Minimum acceptable shape:

- One internal `beforeToolCall()` that initially handles built-in policies, loop detection, and approval classification.
- No plugin hook and no new dependency yet.
- Later expansion can borrow OpenClaw's plugin/trusted-policy hook model.

### P2 - Durable Session Runner / Context Epoch

Goal: lift the agent loop from generator to session runtime.

Minimum acceptable shape:

- Durable input admission.
- Hash of model-visible context baseline.
- Tool settlement bound to assistant message id and tool call id.
- Stale advertised tool registration is rejected.

## 7. Do Not Borrow

- Do not borrow OpenClaw's in-process plugin execution.
- Do not make OpenClaw's many messaging channels a V1 target.
- Do not borrow heartbeat self-interruption.
- Do not use Hermes "runs anywhere" surfaces to bypass Local Supervisor.
- Do not adopt OpenCode's host-authority bash as Aetherion's default execution model. Aetherion needs policy, lease, and supervisor gates first.

## 8. Execution Rule After This Baseline

Every backend-hardening phase must cite one P0/P1/P2 item from this file and update this section when complete.

Minimum loop:

1. Re-read this baseline and `docs/14-runtime-loop-plan.md`.
2. Pick exactly one runtime gap.
3. Write or update the smallest failing test first.
4. Implement the smallest fix.
5. Run targeted tests and `npm test` when appropriate.
6. Update this baseline or the phase log.
7. Make a Lore commit and stage only this round's files.

## 9. Phase Log

### Baseline Refresh - 2026-06-23

This round refreshes the baseline document only. Findings:

- Current backend has more runtime-thin layers than the old baseline recorded: agent loop, exec/fetch/spawn, skills, proactive, VCS/subagent isolation.
- The old `201/201` green-test snapshot is stale; current `npm test` is `337/347`, with 10 failures.
- The largest architecture risk is not missing tools; it is that tools are already declared while authorization, leases, and durable settlement are not unified.
- The next minimal hardening should pick one P0 item: either repair release/readiness breakage or pull exec/fetch/spawn under one authorization path.

### Phase 05 - VCS GC Orphan Tree Cleanup (P0 readiness)

This round closes one existing P0 release/readiness failure: `gcUnreferencedObjects` now deletes invalid or non-canonical SHA-256 tree files while preserving valid tree snapshots as rollback/diff targets and continuing to protect their blobs. Verification: `node --test packages/harness-core/test/vcs-gc.test.ts`, 7/7 passing; `node --test packages/harness-core/test/*.test.ts`, 238/238 passing.
