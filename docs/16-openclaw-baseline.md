# OpenClaw Backend Runtime Baseline And Lag Review

[中文版本](16-openclaw-baseline.zh-CN.md)

This document is the critical baseline for Aetherion backend-runtime hardening. It does not claim Aetherion is close to OpenClaw. It records where the current runtime is behind, which surfaces are only thin seed implementations, and which existing files still do not amount to a product-grade backend runtime.

Evidence scope:

- Current Aetherion repo: `packages/harness-core/`, `packages/tui/`, `crates/supervisor/`, `docs/14-runtime-loop-plan.md`, and `docs/15-production-gap-closure-plan.md`.
- Local quarantined references: `.quarantine/openclaw/`, `.quarantine/hermes/`, and `.quarantine/opencode/`. These are research inputs only, never trust roots, and their in-process plugin model is not copied into Aetherion authority.
- Verification snapshot: on 2026-06-24, `npm test` reported `354` tests and all passed. Earlier this round, `web_fetch` was narrowed to a loopback-only, lease-backed path; `search_files` and `list_files` have now been de-shellified into local Node `fs` traversal plus regex/glob filtering; and the latest execution slice is pulling `shell_exec` and `agent_spawn` into the same request/risk/policy/lease shape. That removes the obvious shell-injection hole. A lightweight shared `beforeToolCall()` preflight now exists across read/write/scan/exec/fetch/spawn, but it is still not OpenClaw's single authority root.
- Pre-document dirty state already included an unrelated untracked file, `packages/tui-go/ether-setup`. This baseline does not treat that as work created by this document refresh.

## 0. Verdict

Aetherion is not yet a mature backend runtime. It is a contract-heavy, test-heavy, boundary-aware seed harness. It is stricter than OpenClaw on authority and non-authorizing evidence, but it is clearly behind in runtime scheduling, tool governance, durable sessions, plugin/skill ecosystem, output management, and release readiness.

The most dangerous illusion is that the repo already has `agent-loop`, `shell_exec`, `web_fetch`, `agent_spawn`, VCS branches, skills, and proactive files, so it looks like a complete agent runtime. It is not. `web_fetch` has been narrowed to a loopback-only lease-backed path, and `shell_exec` / `agent_spawn` are now being pulled into the same policy/lease shape, but several capabilities still do not go through one Rust supervisor, a truly shared before-tool policy gate, managed-output, stale-call rejection, or a durable session-runner path.

Current baseline:

- **Advantage but incomplete:** Local Supervisor / Event Ledger / scoped leases / schema governance remain the right direction.
- **Severe lag:** OpenClaw already has layered tool policy, a `before_tool_call` choke point, Gateway event streams, approval routing, versioned lazy skills, a commitments runtime, and SQLite storage discipline. Aetherion mostly has local TypeScript seed slices.
- **Release evidence is green, but not decisive:** `npm test` passes, yet that only proves the current guardrails and narrow tool paths are coherent. It does not close the runtime maturity gap.
- **Next priority:** finish bringing the remaining tools under a shared before-tool gate, then borrow the smallest OpenClaw runtime primitives. Do not widen into channels, GUI, MCP, OAuth, or cloud execution first.

## 1. Current Aetherion Backend State

| Runtime layer | Current evidence | Critical conclusion |
| --- | --- | --- |
| Agent loop | `packages/harness-core/src/agent-loop.ts` can call a provider across turns, process tool calls, write model artifacts, and append ledger events. | It is still a single-process TypeScript loop. There is no product session runner, durable queue, crash recovery, stale-call rejection, or provider-turn admission model. |
| Tool registry | `createV1ToolRegistry()` declares `local_file_read`, `local_file_write`, `shell_exec`, `file_edit`, `search_files`, `list_files`, `web_fetch`, and `agent_spawn`. | The declaration surface is still larger than the authorization surface. `search_files` and `list_files` no longer shell out, which fixes an actual injection hole, but they still ride on a file-read-shaped policy seed instead of a first-class scan authority. `shell_exec` and `agent_spawn` are no longer naked inline approvals, and the default system prompt now renders its tool list from the registry, but the registry still does not prove OpenClaw-grade single authority. |
| Policy | `policy.ts` has a two-step boundary + operation seed pipeline: read allows, write asks. | It is much thinner than OpenClaw's profile/provider/global/agent/group/sender policy layers, but exec/fetch/spawn now at least share the same typed request/lease vocabulary. |
| Lease enforcement | `local-file.ts` checks active lease, `scope.tools`, `scope.egress`, and paths for read/write. | It still only covers file read/write there; `web_fetch` has its own narrow network lease executor, while `shell_exec` and `agent_spawn` now use a sibling execute-lease pattern rather than a unified executor family. |
| Rust supervisor | `crates/supervisor/` handles workspace identity, hash ledger, file read/write/status, and socket-auth POC paths. | It is not a general authority broker. It does not govern shell, network, subagents, providers, vault, scheduler, or adapters. |
| VCS/sandbox | `vcs/branch.ts`, `tree-snapshot.ts`, rollback, and subagent worktrees exist. | `vcs-gc.test.ts` now passes, but branch merge/checkout is still local-copy seed behavior, not OpenClaw/OpenCode-grade session publication/recovery. |
| Skills | `skills.ts` scans `skills/*/SKILL.md` and injects name/description/path. | This only copies the smallest shape of OpenClaw lazy loading. It lacks promptVersion, requires eligibility, source provenance, visibility policy, skill command dispatch, and source distinction. |
| Proactive | `proactive.ts` is a pure inhibition evaluator. | This is not an Opportunity runtime. It has no OpenClaw-style commitments store, extraction, dedupe, or delivery. |
| Provider | No-tools provider paths and tool-mode artifacts exist; provider config can store API keys. | Vault is not implemented and the tool-mode safety boundary is incomplete. Plaintext `.aetherion/provider-config.json` is only acceptable as a POC. |
| Release/readiness | doctor/onboarding/release evidence is rich and now green. | That only proves the guardrail suite can pass; it does not imply a product-grade runtime or a unified tool gate. |

## 2. Lag Against OpenClaw

| Capability | OpenClaw shape | Aetherion now | Lag |
| --- | --- | --- | --- |
| Layered tool policy | `src/agents/tool-policy-pipeline.ts`: profile, provider profile, global, agent, provider-agent, group, and sender filtering with audit warnings. | Read/write seed pipeline only; no agent/provider/sender/group semantics. | **L5 severe** |
| Tool-call choke point | `src/agents/agent-tools.before-tool-call.ts` centralizes plugin hooks, trusted policies, approvals, diagnostics, loop detection, skill telemetry, and param adjustment. | `agent-loop.ts` now routes declared tools through one internal `beforeToolCall()` preflight, but it is still a local seed hook with no plugin hooks, no trusted-policy layering, and no durable policy engine. | **L4 high** |
| Approval system | Exec/plugin approvals include allow once/always/deny, timeout, and Gateway/channel routing. | File writes have consent artifacts; exec/spawn use callbacks; fetch is policy-gated but still has no human approval route; approval routing is not durable. | **L5 severe** |
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

1. **Tools are advertised before authority is unified.** `createV1ToolRegistry()` exposes shell/network/subagent tools, `search_files` and `list_files` are now local traversal helpers instead of shell wrappers, and `web_fetch` has only been narrowed to a loopback lease. `shell_exec` and `agent_spawn` now pass through the same request/risk/policy/lease shape, and there is a lightweight shared `beforeToolCall()` hook, but the hook is still too thin to count as OpenClaw's single authority root.
2. **Rust supervisor is not the runtime gate.** File read/write can use Rust. Other important capabilities still execute directly in TypeScript. Local Supervisor is the root authority in intent, not yet in coverage.
3. **No durable session runner.** OpenCode has admission, promotion, context epochs, tool settlement, and interruption/recovery. Aetherion's agent loop is still a testable generator.
4. **Output boundaries are weak.** `truncateForModel` is not managed output retention, typed output codecs, provider-facing projection, or complete output references.
5. **Approval is not a system.** File-write consent has artifacts. Exec/spawn approval is callback-based. Fetch is policy-gated but still has no human approval route or durable approval routing. OpenClaw and Hermes both have fuller approval state and routing.
6. **Skills are only directory scanning.** There is no version, source, eligibility, visibility, or telemetry baseline.
7. **Proactive is not a lifecycle.** An inhibition function is not a commitments store and not an Opportunity queue.
8. **Tests are green, but the runtime gap remains.** Current `npm test` now passes, which removes one red flag and confirms the latest narrow tool-gating slice. That does not fix the architectural gap: the advertised tool surface is still not governed by one shared before-tool path.

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

Goal: make `shell_exec` and `agent_spawn` stop bypassing unified policy, and fold `web_fetch` into the same shared before-tool gate instead of leaving it on a separate loopback-only path.

Minimum acceptable shape:

- Add typed ToolRequest target families for exec/spawn, while preserving the narrow loopback fetch path until it shares the same gate.
- Tools without a lease executor must not claim lease-backed execution.
- Fetch egress policy must stay loopback-only until a shared allowlist policy exists; external fetch is still at least L2 and audited.
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

### P1 - Evolve The Existing beforeToolCall Preflight Into A Real Authority Root

Goal: every tool passes one shared hook before execution, and that hook becomes the only place where tool-family policy, approval classification, and lease issuance are decided.

Minimum acceptable shape:

- One internal `beforeToolCall()` that now covers built-in policies, loop detection, approval classification, and shared request/lease shaping across all declared tools.
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

### Baseline Refresh - 2026-06-24

This round refreshes the baseline document only. Findings:

- Current backend has more runtime-thin layers than the old baseline recorded: agent loop, exec/fetch/spawn, skills, proactive, VCS/subagent isolation, and now shell-free local search/list traversal plus the narrow loopback-only fetch lease path.
- The old `337/347` snapshot is stale; current `npm test` is `354/354`.
- The largest architecture risk is not missing tools; it is that the advertised tool surface now has a lightweight shared `beforeToolCall()` preflight, and the system prompt now renders from the registry, but that preflight is still not the single authority root OpenClaw already has.
- The next minimal hardening should pick one P0 item: thicken the existing shared preflight into a true authority root, then move the execute-family approval and lease issuance behind that shared hook.

### Phase 05 - VCS GC Orphan Tree Cleanup (P0 readiness)

This round closes two existing P0 release/readiness failures: `gcUnreferencedObjects` now deletes invalid or non-canonical SHA-256 tree files while preserving valid tree snapshots as rollback/diff targets and continuing to protect their blobs, and `docs/19-tui-visual-polish.zh-CN.md` now links back to the English page in the same form as the other bilingual docs. Verification: `node --test packages/harness-core/test/vcs-gc.test.ts`, 7/7 passing; `node --test packages/harness-core/test/*.test.ts`, 238/238 passing; `npm test`, 348/348 passing.

### Phase 06 - Run-Manifest Generation Fence And Completion Propagation (P1 event lifecycle, section 2 row "Event lifecycle")

This round lands a first lifecycle-generation fence at the run-manifest layer and repairs a regression it introduced. `RunManifest` gains a monotonic `generation` field (schema + contract example), every projection update now runs under a `withRunManifestLock` mkdir lock, and `recordRunEventFromCurrentState` / `completeRunManifest` reload the on-disk manifest, verify the caller's `generation` still matches, then write with an expected-generation guard so stale writers are rejected instead of clobbering newer state. The regression: `completeRunManifestWithEventSequence` completed a freshly-loaded copy and discarded it, leaving the caller's manifest reference at `status: "running"`; that silently made the TUI run skip its idempotency completion artifact (`ingress_idempotency_replay=not_available`) and broke same-intent cached replay. Fixed by assigning the completed projection back onto the caller's manifest. Verification: `node --test --test-name-pattern='approval-gated local kernel loop|same-intent idempotency keys' packages/tui/test/tui.test.ts`, 2/2 passing; `npm test`, 355/355 passing.

### Phase 07 - Provider Transient-Failure Retry With Backoff (P0/P1 production runtime, section 5 "Provider has no retry")

This round consumes the previously-dead `ModelProviderError.retryable` flag (grep had shown zero consumers). `postJson` and `postStream` are split into single-attempt `*Once` helpers wrapped by `withProviderRetry`, which retries transient failures - network errors, timeouts, and retryable upstream statuses (408/409/425/429/5xx) - with bounded full-jitter exponential backoff and honors a server `Retry-After` header. Retry happens only before any SSE body is consumed, so streamed deltas are never replayed. Knobs: `AETHERION_MODEL_MAX_RETRIES` (default 2), `AETHERION_MODEL_RETRY_BASE_MS` (default 500), `AETHERION_MODEL_RETRY_MAX_MS` (default 8000); `AETHERION_MODEL_MAX_RETRIES=0` disables. Verification: new `packages/harness-core/test/provider-retry.test.ts`, 5/5 passing (retry-then-succeed, network-retry, non-retryable 400 not retried, persistent 429 exhausts at maxRetries+1, disabled-by-env); `npm test`, 360/360 passing.

### Phase 08 - TUI Mid-Turn Interrupt (P1 TUI/runtime control)

This round makes a running agent turn cancellable. Previously `ctrl+c` while `chatBusy` only printed "press ctrl+c again to quit" and never terminated the streaming subprocess, so a runaway or wedged turn could not be stopped without killing the whole TUI - and the second `ctrl+c` never actually quit either. The agent-loop subprocess is now started in its own process group (`SysProcAttr.Setpgid`), and `ctrl+c` while busy calls `interruptChat`, which signals the whole group (`syscall.Kill(-pid, SIGTERM)`, falling back to the lone process) so synchronous child shells the loop spawned are torn down too. Killing the process closes its stdout, which ends the scanner goroutine and lets the normal `chatStreamDoneMsg` teardown clear `chatBusy`; an `interrupting` flag suppresses the resulting `Wait` signal error so the interrupt reads as "turn interrupted by user" rather than a failure, and the busy footer hint now advertises "ctrl+c interrupt". Verification: new `packages/tui-go/setupapp/interrupt_test.go`, 4/4 passing (terminates a real grouped subprocess, idle no-op, ctrl+c-while-busy path, interrupt-state teardown without a surfaced error); `go test ./packages/tui-go/...` all passing.

### Phase 09 - TUI Prompt Queue Drain (P1 TUI/runtime control)

This round fixes a dead queue: prompts entered while a turn was running (and `/retry`) were appended to `m.queue` but nothing ever dequeued them, so they were silently never sent. The `chatStreamDoneMsg` teardown now calls `startNextQueued`, which pops the oldest queued prompt FIFO and begins it once a turn finishes normally. An interrupt deliberately leaves the queue intact so cancelling the current turn does not auto-kick the next prompt. Verification: new `packages/tui-go/setupapp/queue_test.go`, 4/4 passing (one prompt drains per completion preserving FIFO order, empty queue returns to idle, interrupt leaves the queue intact, empty `startNextQueued` no-op); `go test ./packages/tui-go/...` all passing.

### Phase 10 - Rich Approval With Durable Allow-Always Grant (P1 TUI + backend authorization, section 5 "approval is not a system")

This round upgrades the binary y/n approval into the OpenClaw/Hermes-style three-way choice - allow once / allow always / deny - and makes "allow always" durable. The stdin decision protocol gains an optional `scope` field (`"once"` default | `"always"`); the Go TUI sends it (`a` key = allow-always, footer and proposal text updated) and the TS `model chat` loop honors it. A new `packages/harness-core/src/approval-grants.ts` persists standing grants to `<workspace>/.aetherion/approvals/always-grants.json`, keyed coarsely by `toolName:verb` (matching the coarse "allow always" affordance, distinct from the TTL-scoped per-run `ConsentRecord`). The loop seeds an in-memory grant set from disk at startup; a matching proposal is auto-approved (`reason: "allow-always grant"`) without emitting a prompt, and an `always` decision is recorded both in memory and on disk so it survives across turns and sessions. Verification: new `packages/harness-core/test/approval-grants.test.ts`, 5/5 (empty load, durable record+reload, idempotent no-refresh, multi-key accumulation, malformed-file tolerance); new `packages/tui-go/setupapp/approval_test.go`, 4/4 (always encodes scope, empty scope normalizes to once, deny clears pending, `a` key sends always + status); `npm test` 365/365, `go test ./packages/tui-go/...` all passing.

### Phase 11 - Durable Consent Artifacts For Execute-Family Tools (P1 backend authorization, section 5 "approval is not a system")

Approved writes already synthesize a schema-validated `ConsentRecord` artifact under `.aetherion/artifacts/consent/<runId>/`, but `shell_exec` and `agent_spawn` only appended a free-text `consent.recorded` ledger event - there was no durable, schema-backed authorization artifact for the highest-risk tools. This round adds `createExecConsentRecord` to `consent.ts`, which builds a TTL-bounded, schema-valid consent (id `consent_<runId>_<exec|spawn>_<depth>`, scope `{actions:["exec"],commands:[…]}` or `{actions:["spawn"],tasks:[…]}`). The agent loop now writes that artifact via `writeConsentRecordArtifact` on exec/spawn approval before issuing the scoped lease, so every execute-family action leaves the same durable evidence trail writes do. The id is disambiguated by loop depth because execute calls recur within a run (unlike the single per-run write consent). Verification: new `packages/harness-core/test/consent-exec.test.ts`, 3/3 (command consent validates against `consent-record.schema.json` with correct id/ttl/scope, task consent validates for agent_spawn, distinct depths yield distinct ids); `npm test` 368/368, `go test ./packages/tui-go/...` all passing.

### Phase 12 - TUI Streaming Lifecycle Generation Fence (P1 TUI/runtime control)

The TUI consumes the agent-loop subprocess as a stream of `loopEventMsg`s drained one at a time, re-arming the drain after each. Two stale-event hazards existed: (a) after a mid-turn interrupt, events already buffered in the channel kept being applied to the transcript after the user cancelled; (b) a superseded turn's late completion could clear a freshly started turn's busy state. This round adds a monotonic `streamGen` stamped onto every `loopEventMsg`/`chatStreamDoneMsg`. `runStreamingChatCommand` opens a new generation per subprocess; `drainStreamEvents` captures the channel, command handle and generation at creation (instead of dereferencing a shared `*Model` later) so a re-armed drain stays bound to its own turn. The update loop drops any event/completion whose generation differs from the live one, and while `interrupting` is set it stops applying the current turn's buffered events but keeps re-arming the drain so the channel close still reaches teardown. Verification: new `packages/tui-go/setupapp/gen_fence_test.go`, 4/4 (stale event dropped, current event applied + drain re-armed, stale completion ignored, interrupting drops buffered events but keeps draining); existing interrupt/queue tests still green; `go test ./packages/tui-go/...` all passing, `npm test` 368/368.
