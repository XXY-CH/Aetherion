# Phase Implementation Review

[中文版本](12-phase-implementation-review.zh-CN.md)

This file is the running phase-end review ledger. Each completed implementation pass must compare the plan against the architecture documents and point to concrete code evidence.

The invariant is unchanged: V1 is TUI-first. Later GUI, IM, browser, connector, and store surfaces remain client surfaces and must not become trust roots.

Schema growth is now governed by `docs/13-schema-runtime-governance.md`: P0 kernel contracts need executable/replay evidence, P1 product-runtime contracts need source-backed command paths, and P2 innovation contracts should stay frozen unless a lower-tier runtime loop requires a change.

## Planning Round: Production Gap Closure Plan

Matched source docs:

- `docs/00-product-brief.md`: the plan preserves Aetherion as a local-first Agent Harness Kernel, not a chatbot or replacement OS.
- `docs/01-architecture.md`: the plan uses the requested architecture stack as the gap matrix and keeps Local Supervisor, Event Ledger, and Tool Access & Action Policy Proxy as authority/fact/action boundaries.
- `docs/06-roadmap.md`: the plan keeps V1 TUI-first and defers GUI, mobile, IM, browser automation, MCP/OAuth/SaaS connectors, and cloud workers until explicit gates exist.
- `docs/10-technical-strategy.md`: the plan preserves TypeScript for contract/orchestrator iteration and Rust for authority, policy, vault, ledger, sandbox, and native execution.
- `docs/13-schema-runtime-governance.md`: the plan treats schema, fixture, projection, and client surface as non-authority and prioritizes executable runtime loops.
- `docs/14-runtime-loop-plan.md`: the plan extends the existing loop discipline with an explicit production-gap closure index and round-end drift protocol.

Implemented correspondence:

- Added [Production Gap Closure Plan](15-production-gap-closure-plan.md) and [Chinese companion](15-production-gap-closure-plan.zh-CN.md).
- Linked the plan from README plus the original source documents' implementation-tracking lines.
- Recorded an architecture-layered matrix covering Client Surfaces, Ingress Gateways, Local Supervisor, Agent Orchestrator, Memory OS, Capability OS, Proactive Engine, Tool Access & Action Policy Proxy, Connector/Execution Adapters, Observations/Results/Artifacts, and Event Ledger/Projections.
- Separated current no-tools provider support from future OAuth connector/account-linking work: externally supplied bearer tokens remain allowed where supported, but browser OAuth flow, token refresh, vault persistence, and connector grants remain future gated work.

Correction and remaining boundary:

- This planning round does not implement release packaging, remote CI attestation, daemon lifecycle management, vault storage, ingress gateways, real OAuth connectors, GUI, browser extension, IM delivery, mobile app, cloud worker execution, or package-code runtime.
- The next implementation round should start with PGC-1 release/readiness evidence hardening unless a current production-readiness bug takes priority.

## Current Review Snapshot

Verification from the latest pass:

- `npm test`: 143 passing tests.
- `cargo test`: 39 passing Rust tests.
- `cargo clippy --all-targets --all-features -- -D warnings`: clean.
- `cargo fmt --check`: clean.
- `git diff --check`: clean.
- `git ls-files .aetherion target`: no tracked runtime/build artifacts.

## Phase Alignment Matrix

| Phase | Plan intent | Current code evidence | Verification evidence | Review status |
| --- | --- | --- | --- | --- |
| 1. TUI Kernel Loop | Prove local safe execution through workspace identity, event ledger, policy, lease, approval, file operation, verification, and replay. | Ether `run`, `replay`, and `trace`; stable path-derived workspace identity; fail-closed workspace registry loading that derives identity/runtime/Ledger path from the resolved root; schemas/examples for workspace registry, run manifest, risk, approval, and Replay Record; versioned `aetherion-event-v1` hash chains shared by Rust and the test-only TS seed; output-safe default summaries avoid copying source file content unless the caller explicitly supplies `--summary`; P0 action lifecycle events include `tool.requested`, `risk.composed`, `policy.decided`, `lease.issued`, `consent.recorded`, `action.recorded`, `observation.recorded`, and `verification.recorded`. | Harness and Ether tests cover lease-gated reads plus approval-gated traced writes, default summary non-copying behavior for secret-like source content, explicit user-supplied summary output, complete action lifecycle trace order, trace reconstruction, cross-author hash-chain validation, fixed canonical hash vectors, replay records, workspace registry id/runtime/Ledger path drift rejection, and kernel-loop rejection of workspace ids that do not match the resolved root. | Runnable through the Rust supervisor by default. TypeScript authority is isolated behind `AETHERION_ALLOW_TYPESCRIPT_SEED=1` for tests. Workspace registries are P0 projections and cannot redirect the kernel to another Ledger path. |
| 2. Rust Supervisor Boundary | Move authority proof toward Rust supervisor while keeping TS as client/orchestrator. | `crates/supervisor/src/lib.rs`, `crates/supervisor/src/main.rs`; `packages/harness-core/src/supervisor-client.ts`; `packages/harness-core/src/run-supervisor.ts`; default Ether `run`. Rust derives workspace identity from the resolved root at the RPC boundary, returns operation lease ids only from traced action paths, rejects generic `event.append` attempts to forge authority-bearing lifecycle events before workspace init, rejects legacy weak `trace.replay`, and appends versioned SHA-256-linked events behind a workspace-local append lock and sync-then-rename Ledger rewrite; workspace init recovers abandoned temp files and verifies parent continuity, workspace id consistency, plus complete canonical v1 event hashes for every author; traced read plus write prepare/commit RPCs now emit the file-action lifecycle events inside Rust and return event ids for the Ether run manifest projection; approved write commits record consent, observation, and verification in the same supervisor RPC path that performs the write; stdio RPC input now uses the supervisor's minimal structured JSON object parser and typed field accessors; read-only supervisor status reports runtime-lock owner process liveness and stale-lock state without repairing locks; Ether derives a read-only lifecycle preflight from that status evidence. | Rust unit tests cover wrong-path, expired lease, distinct lease ids, idempotent workspace init, identity-conflict rejection, RPC workspace-id drift rejection before runtime initialization, standard SHA-256 vector, TS/Rust canonical-vector parity, TS-authored event acceptance, tamper rejection, JSON control-character/Unicode recovery, schema-compatible timestamps, concurrent append serialization, atomic rewrite behavior, startup temp cleanup, traced action lifecycle RPCs, unapproved write commit with no action, supervisor-authored post-write evidence, legacy policy-only/read/write/replay RPC rejection without runtime state or content/lease leakage, generic `event.append` authority-event forgery rejection, supervisor status live/stale runtime-lock reporting, commit JSON contents, and fail-closed malformed/duplicate/wrong-typed RPC fields; Ether integration validates mixed TS/Rust ledgers with `chain_valid=true`, asserts write consent/observation/verification summaries come from supervisor semantics, and checks TUI status plus lifecycle preflight print no-lock/live-lock/stale-lock evidence without appending Ledger events or repairing lock files. | Authority-boundary POC implemented and used by default. Ether still owns approval-card rendering, run manifests, and Ledger-backed replay persistence; long-running daemon, vault, signatures, process sandbox, start/stop commands, automatic stale runtime-lock recovery, and a full JSON-RPC server remain pending. |
| 3. Memory OS MVP | Grow memory from source events, not opaque vector state. | `packages/memory-os/src/index.ts`; trace-derived candidates, episodic timeline with explicit failure/recovery/user-correction/skill-candidate/regression-case extraction, evidence-only user model, context pack, Memory Tombstone contract; deterministic Context Pack selection that applies deletion/block/sensitivity exclusions before ranking eligible Memory Cards by confidence, source evidence, estimated prompt footprint, and stable id under the memory-token budget; Context Pack conflict projection from Memory Card `contradicts` links; Ether memory/context commands and registries; read-only `audit memory-records` parity preview for Memory Candidates, active Memory Cards, and Tombstones. | Memory OS tests require source events, context blocking, tombstone exclusion, deterministic ranking before prompt use, memory-token budget overflow exclusion, hard-exclusion precedence over budget trimming, selected-vs-selected contradiction reporting, selected-vs-excluded/missing contradiction reporting, and Episodic Timeline extraction of failures/corrections/skill candidates/regression cases from explicit event summaries; Ether and harness tests derive candidates from a real run, accept/reject/block/delete memory lifecycle records, verify context explain no longer selects deleted memory, reject weak registry provenance, and report Memory Candidate/Card/Tombstone projection drift without mutation. | MVP source-backed lifecycle implemented. Candidate/card/tombstone parity preview exists; context selection is deterministic, budget-aware, and conflict-visible. Extraction remains deterministic and narrow; semantic ranking, redaction, and full rebuild/repair remain pending. |
| 4. Migration Dry-Run MVP | Import OpenClaw/Hermes shapes without inheriting trust or secrets. | `packages/migration/src/index.ts`; migration plan, legacy capsule, and extended migration report schemas/examples; TUI import dry-run. | Migration tests redact token-like fields and quarantine legacy material; TUI import test checks no raw token output. | Dry-run seed implemented. No real takeover by design. |
| 5. Sandbox Rehearsal and Branching | Turn audit into checkpoint, branch, isolated file rehearsal, and fresh-authority approval flow. | `packages/sandbox/src/index.ts`; checkpoint, branch, rehearsal, and sandbox-approval schemas/examples; Ether `checkpoint`, `branch`, `rehearse`, and `approve-rehearsal`; `.aetherion/sandboxes/<branch>/workspace/`; checkpoint/branch event id/hash pointers; pre-promotion Ledger/hash/path/content revalidation; independent promotion run manifests; Rust supervisor write-prepare/write-commit RPCs; read-only `audit sandbox-records` parity preview for checkpoint/branch/rehearsal/approval projections. | Sandbox tests assert branch does not inherit live authority, copies checkpoint head pointers, rejects out-of-workspace/runtime-state targets, and leaves the real file unchanged; Ether integration verifies fresh Rust lease, exact live content, schema-valid SandboxApproval, Rust-authored write lifecycle events in the promotion run, and no post-completion events appended to the checkpoint source run. TUI tamper tests reject non-sandbox branches, sandbox content drift, and target content drift before creating a promotion run or live write, and `audit sandbox-records` reports projection drift from persisted command artifacts without mutation or supervisor authority. | Local file temp-workspace rehearsal and approval implemented with preflight projection revalidation. Checkpoint/branch/rehearsal/approval registries have a scoped read-only parity preview; Git worktree, external-system rollback, branch-specific event streams, and automatic registry repair remain pending. |
| 6. Capability Capsule MVP | Govern capabilities through lifecycle, permission diff, replay tests, sandbox trial, and legacy quarantine. | `packages/capability-os/src/index.ts`; expanded Capsule schema/example; Ether `capsule draft/list/inspect/test/publish/rollback`; Capsule, replay, approval, and version registries; supervisor-appended Capsule lifecycle events with versioned `payload_ref` snapshots; read-only `audit capsule-records` parity preview for Capsule lifecycle projections. | Unit tests require two distinct provenance runs, reject executable playbooks, quarantine external execution, gate permission expansion, exercise rollback, and rebuild expected Capsule registry projections from lifecycle artifacts. Ether integration creates two real Rust-supervised runs, validates the Ledger prefix, runs a document sandbox trial, proves failed permission-expansion publish writes no publish event, records draft/test/publish/rollback lifecycle events, publishes two local versions, rolls back, and reports Capsule projection drift without mutation. | Document-only local lifecycle implemented. Publication is explicitly unsigned and does not execute playbooks. Capsule lifecycle registries have a scoped read-only parity preview; package signing, imported/generated code execution, external sandbox processes, Capsule Store registry parity, and automatic registry repair remain pending. |
| 7. Causal Memory and Counterfactual | Project evidence-linked relations and produce counterfactual reports without live actions or causal overclaiming. | `packages/causal-memory/src/index.ts`; Causal Edge, Why Report, Counterfactual Report, and Causal Projection schemas/examples; Ether `why`/`counterfactual`; rebuildable `.aetherion/projections/causal.sqlite`. | Tests cover typed dependency chains, failure/correction links, report-only downstream counterfactuals, disposable SQLite rebuild, cross-run isolation, and redacted-source confidence reduction. Ether integration rebuilds from a real Rust-supervised Ledger and a real appended redaction event. | Evidence-aware report projection implemented. It labels edges as temporal dependency candidates, not proven causes. Domain state simulation, LLM replay, and alternate-history outcome evaluation remain pending. |
| 8. Digital Hibernation and Wakeup | Serialize long task state, drop active leases, evaluate local triggers, and recheck policy before resume. | `packages/hibernation/src/index.ts`; expanded hibernation/wakeup schemas/examples; Ether `sleep`, `wake`, and `sleepers`; hibernation resume Context Packs now use the same Memory Card/Tombstone provenance gate and deletion exclusions as planning context; `sleepers --check-wakeups` read-only eligibility preview; Rust `run.resume.evaluate`; new resume-run Ledger events; read-only `audit hibernation-records` parity preview for hibernation and wakeup trigger projections. | Unit tests cover lease rejection, cursor binding, deadlines, expiry, attention budgets, file change/deletion, workspace escape, symlink escape, and sleep/wake artifact parity without mutation. Ether integration proves fresh-policy queueing with no lease or action, excludes tombstoned Memory Cards from stale resume projections, fails closed on weak tombstone provenance, previews scheduled/eligible wakeups without mutating registries or Ledger, and reports hibernation/wakeup projection drift without evaluating triggers. | Local explicit-evaluation, queue-only MVP implemented. Sleep/wake registries have artifact-backed parity preview, resume Context Packs honor Memory tombstones, and a non-queueing eligibility preview exists; background daemon and resumed task executor remain pending. |
| 9. Memory Folding, Persona Anchors, Soul Fork | Control drift through source-backed fold patches, reversible persona branches, and authority-free inheritance. | `packages/soul/src/index.ts`; expanded fold/anchor/fork/inheritance contracts plus persona branch/state/reset contracts; Ether `dream`, `anchors`, `persona`, and `soul`; Rust artifact-linked governance events. | Tests cover minimum fold provenance, sensitive approval, source preservation, TTL-bound branches, business-memory retention, hash-bound checkpoint replay, sensitive-history approval, secret-memory exclusion, zero authority/budget/path scope, duplicate identity rejection, and full Ledger hash validation. | Governed local lifecycle implemented. Fork records are non-executable containers; personality simulation, legal inheritance, funded execution, and external export remain pending. |
| 10. Zero-Trust Multi-Agent and Economics | Bound child agents with contracts, budgets, circuit breakers, capsule isolation, and evidence. | `packages/multiagent/src/index.ts`; expanded contract/budget/account/breaker/result/score contracts; Ether contract creation plus a narrow document-read executor; Rust `child.file.read` authority path; explicit run-manifest lifecycle guards for child success, policy denial, repeated-denial breaker, pre-supervisor permission/budget breakers, and observed post-supervisor breakers. | Multi-agent tests cover Capsule/path/risk/budget isolation and breaker behavior; Ether integration verifies independent child runs, Rust Ledger facts, risk and lease evidence, accounting, taint, repeated-denial hard stop, pre-supervisor permission/budget breaker lifecycles, post-supervisor runtime-accounting breaker projection, and routing-weight reduction. Rust RPC tests cover allowed child reads and denied child reads with risk evidence and no lease. | Governed local document-read slice implemented. Pre-supervisor child breakers now have exact `agent.child.started -> circuit.opened` manifests, and post-supervisor breakers project any observed supervisor child-read Ledger prefix before `circuit.opened`. General LLM orchestration, writes, network tools, escrow, queue/ask exhaustion behavior, and exact supervisor-process CPU accounting remain pending. |
| 11. Anti-Poisoning and Honeypot | Treat untrusted content as tainted, prevent it from authorizing actions, detect escalation/exfiltration attempts, contain suspicious subjects, and create regression evidence. | `packages/security/src/index.ts`; assessment/signal/trial/fixture contracts; Ether `security scan/ack/trial/fixture`; Rust `security.taint.evaluate`. | Security tests cover hash-only detection, multi-rule signals, taint authorization rejection, decoy-only trials, raw-free fixtures, Rust deny/no-lease policy, and Ledger-backed Ether lifecycle. | Deterministic local defense slice implemented. Semantic classifiers, source adapters, unknown-code process sandboxes, attribution, and active countermeasures remain pending. |
| 12. Computer Harness, IM, GUI, Capsule Store | Add broader surfaces only after kernel authority is stable, without making surfaces trust roots. | `packages/surface-os/src/index.ts`; browser/IM/store contracts/examples; `packages/computer-use/src/index.ts`; computer action/observation contracts/examples with requirements-gate and approval-key fields; Ether `surface browser-observe`, `surface im-inbox`, `surface im-outbox`, `store trust-publisher`, and `store install`; Rust `surface.outbox.evaluate`. | Surface OS tests cover hash-only browser/IM records, one-scoped outbox approval, no delivery, publisher trust anchoring, Ed25519 package verification, local replay evidence resolution, and sandbox hash mismatch rejection. Computer-use tests cover current-tab browser scope, structured-first channel selection, side-effect lease/approval requirements, requirements-only adapter gates, scoped approval keys, tainted egress denial, and non-authorizing observations. Contract tests reject user-config-enabled computer actions and duplicate approval keys. Ether integration proves browser taint denial, IM outbox policy, no raw content in output/Ledger, local publisher enrollment, and trusted-publisher signed Capsule declaration install. Rust tests cover outbox ask/deny policy. | Narrow control-plane slice implemented. Real GUI, browser extension, DOM/CDP action, screenshot fallback, desktop automation, webhook/IM delivery, remote Capsule Store, revocation feeds, and package execution remain pending. |

## Agent Orchestrator Prompt Assembly Preview

Matched source docs:

- `docs/01-architecture.md`: the Agent Orchestrator owns context assembly, planning, agent loop, and verification, while the Context and Planning Plane does not persist unreviewed long-term claims directly.
- `docs/03-memory-os.md`: the Context Assembler chooses task, memory, tools, permissions, uncertainty, conflicts, and source citations under token, privacy, and permission constraints.
- `docs/10-technical-strategy.md`: the Agent Orchestrator prototype belongs in TypeScript, while Rust remains the authority boundary.
- `docs/13-schema-runtime-governance.md`: P1 runtime paths must cite Ledger evidence or registry evidence whose Ledger references pass the provenance gate.

Implemented correspondence:

- `packages/orchestrator/src/index.ts` adds `assemblePromptPlan`, a pure TypeScript prompt assembly function that accepts a task, source-backed Context Pack, and optional selected-run Ledger event envelopes, then emits ordered prompt sections for system boundary, instruction hierarchy, task, assembly manifest, readiness, taint policy, citation map, response audit, run evidence, memory context, excluded context, tool policy, capability context, context budget, response format, response contract, planner checklist, and verification checklist.
- The same module adds `auditPromptResponse`, a pure local output-audit function that checks a supplied response against the prompt plan's required blocks, required source event citations, unknown source event ids, and forbidden model/tool/raw-payload/runtime-authority/completion claims without invoking a model or mutating runtime state.
- Prompt plans also emit system/developer/user message bundles for future model-backed planning. System and developer messages carry authority and engineering constraints; task text plus run evidence and memory context stay in the user message so quoted evidence cannot override higher-priority instructions.
- Prompt plans now include a Prompt Bundle with a stable section order, system/developer/user join strategy, rendered section/message hashes, preview hash, character counts, and prompt-engineering rules. This makes prompt concatenation auditable without persisting prompt artifacts or claiming model execution.
- Prompt plans now include an `AgentRuntimeInvocation` scaffold that freezes the future runtime call shape without invoking a model: entry surface, Context Pack id, Prompt Bundle hashes, system/developer/user role boundaries, selected and excluded context, Memory source ids, Capability Card ids, active-permission ids, artifact refs, context budget, model-call placeholders, response-audit requirements, tool gateway policy, authority gates, fail-closed conditions, ordered runtime stages, next runtime steps, and a stable invocation hash.
- Dynamic task text, run evidence summaries, selected/excluded memory reasons, and Context Pack conflict strings are rendered as quoted single-line fields. Source-backed text can therefore appear as data in the user-context message without being able to forge new Markdown sections or higher-priority prompt structure.
- Prompt plans explicitly set `prompt_can_authorize_actions=false`, `local_supervisor_required=true`, and `requires_policy_for_tools=true`. Tool lists are request policy only; execution still requires Local Supervisor policy and scoped lease evidence.
- The runtime invocation scaffold explicitly keeps `model_invoked=false`, `tools_requested=false`, `raw_payload_artifacts_read=false`, `ledger_appended=false`, `prompt_artifact_persisted=false`, and `runtime_authority_granted=false`. It marks model provider, model request artifact, model response artifact, response audit, tool request, lease, observation, and verification as pending or blocked evidence rather than completed runtime facts.
- The assembly manifest summarizes included Ledger event ids, selected Memory Cards, Capability Cards, active permissions, allowed tool request names, artifact refs, excluded memories, context conflicts, forbidden tools, non-authorizing guardrails, source-event taint posture, and risk flags without reading artifacts or granting authority.
- The readiness section reports missing run evidence and source-event taint that claims authorization as model-preview blockers, surfaces warnings for absent memory, context conflicts, excluded memory, forbidden tools, unread artifact refs, and context-only permissions, and lists next steps without treating them as runtime status or verification results.
- The citation map records run-event ids, selected Memory Card source ids, source-bearing sections, and source-bearing message roles so future model output can be checked for memory-derived citations without treating the map as a new truth source.
- The response format and response audit sections define required evidence, assumptions/conflicts, plan/answer/patch, policy/lease-needs, verification-evidence blocks, citation checks, forbidden claims, and completion rules for future model-backed planning. Response audit recognizes required blocks only from response block headings outside fenced code, warns on duplicate required blocks, requires source citations outside fenced code inside the Evidence Summary block, and checks each forbidden-claim match independently so a locally negated claim cannot suppress a later affirmative claim on the same line. These checks remain static prompt guidance and local output linting, not an executable planner or runtime verifier.
- The run evidence section carries event ids, event types, summaries, payload refs, and taint posture from Ledger envelopes only. It does not dereference raw payload artifacts.
- The memory section carries selected Memory Card ids and source event ids. Excluded memory and conflicts remain visible so prompt engineering can account for blocked or sensitive context rather than silently omitting it.
- The upstream Context Pack now hard-excludes deleted, blocked, secret, and disallowed confidential memories before prompt ranking, then selects eligible memories deterministically under the memory-token budget. Prompt assembly consumes that selected/excluded context rather than reading raw Memory registries directly.
- The capability context section surfaces Context Pack Capability Card ids as candidate abilities only and explicitly states that Capability Cards do not own permissions or grant runtime authority.
- The context budget section surfaces Memory, Capability, Task, and total token budgets from the Context Pack as planning limits only. It does not claim actual model token usage.
- The planner and verification checklists require evidence mapping, assumption/conflict disclosure, Local Supervisor policy and lease gates, forbidden-tool avoidance, quoted-context handling, and explicit verification evidence before completion claims.
- Taint guidance states that child-agent output, public web content, IM content, and prompt text cannot authorize actions.
- `ether prompt plan <run_id> --content <task>` reuses the same provenance-gated Context Pack path as `context explain`, includes existing Ledger event envelopes for that run, returns a JSON preview on stdout, and deliberately calls `printRawJson` so it writes no `.aetherion/artifacts/prompt` file and appends no Ledger event.
- `ether prompt audit <run_id> --content <task> --path <response-file>` uses the same plan assembly path, reads one workspace-local response file, returns a JSON audit on stdout, and likewise writes no `.aetherion/artifacts/prompt` file and appends no Ledger event.

Verification evidence:

- Orchestrator unit tests cover source-backed run evidence and memory sections, Context Pack Capability Cards, Context Pack token budgets, deterministic tool allow/deny lists, non-authorizing authority fields, assembly manifest guardrails/risk flags/source-event taint posture, Prompt Bundle section/message ordering and hashes, `AgentRuntimeInvocation` role boundaries, context inventory, authority gates, model-call blockers, tool gateway, stage ordering, fail-closed conditions, invocation hashing, blocked readiness behavior, quoted dynamic-context rendering that prevents forged Markdown sections, readiness blockers/warnings/next steps, authorizing-taint fail-closed behavior, citation maps for run events, Memory Cards, sections, and messages, response audit contracts, response audits for passing and failing outputs, block-heading-only response audit parsing, duplicate-block warnings, Evidence Summary-scoped required citations outside fenced code, per-match forbidden-claim negation, instruction hierarchy, response-format blocks/forbidden claims, system/developer/user message assembly, planner/verifier checklists, empty-task fail-closed behavior, no-tool prompt previews, and answer/patch response-format variants. Memory OS unit tests cover the Context Pack memory ranking and budget trimming that feed those prompt sections.
- TUI integration runs a real Rust-supervised kernel run, accepts a Memory Card, assembles a prompt plan for that run, asserts the preview includes run evidence, selected memory, source event ids, event types, Boundary Facts artifact refs, assembly manifest guardrails, Prompt Bundle hashes, readiness, citation map, response audit, instruction hierarchy, response format, capability context, context budget, planner checklist, verification checklist, and role-bundled messages, audits both a passing and a failing workspace-local response file, rejects out-of-workspace response paths, and verifies the Ledger file remains byte-identical with no prompt artifact directory created.
- TUI provenance regression tampers the Memory Card registry with a missing source event id and asserts `prompt audit` fails closed through the same provenance gate before reading/auditing response claims or creating prompt artifacts.
- TUI provenance regression tampers the Memory Card registry with a missing source event id and asserts `prompt plan` fails closed with the same provenance error as `context explain`, `memory user-model`, and `sleep`.

Correction and remaining boundary:

- This is prompt engineering, prompt assembly, runtime-invocation scaffolding, and local response-output linting only. The Prompt Bundle, Agent Runtime Invocation, planner/verifier checklist, response format, response audit contract, audit result, and message bundles are static guidance or local checks, not an executable planner or runtime verifier. It does not call an LLM provider, perform model routing, run a planner loop, invoke tools, read raw payload artifacts, write memory, grant permissions, or execute actions.
- Prompt previews are not product facts and are not persisted as runtime artifacts. If a future model-backed planner needs durable planning evidence, it should introduce a separate reviewed planning artifact and event type rather than treating prompt text as authority.

## Phase 34 Agent Runtime Invocation Scaffold Review

Matched source docs:

- `docs/00-product-brief.md`: the target product is a safe, auditable, self-improving agent runtime across devices, data, permissions, memory, tools, and messaging channels, but V1 must prove the local kernel loop before adding broad surfaces.
- `docs/01-architecture.md`: the Agent Orchestrator owns context assembly, planner, agent loop, and verifier, while Tool Access & Action Policy Proxy remains the only action choke point.
- `docs/02-user-boundary-layer.md`: sensitive reads, context injection, egress, writes, deliveries, connector calls, code execution, memory impact, and approval policy must stay under Local Supervisor policy and scoped leases.
- `docs/03-memory-os.md`: the Context Assembler chooses task, memory, tools, permissions, uncertainty, conflicts, and source citations under token, privacy, and permission constraints.
- `docs/10-technical-strategy.md`: TypeScript may prototype the Agent Orchestrator, but Rust remains the authority boundary.
- `docs/11-migration-and-runtime-economics.md`: multi-agent and runtime accounting require task/tool/risk/lease budgets, completion evidence, and failure penalties rather than implicit authority.

Implemented correspondence:

- `packages/orchestrator/src/index.ts` adds `AgentRuntimeInvocation` as a deterministic scaffold embedded in every Prompt Plan. It binds a prompt plan to the Prompt Bundle hashes, rendered role boundaries, Context Pack id, selected Memory Cards, excluded Memory Cards, Memory source event ids, Capability Card ids, active permissions, artifact refs, context budget, tool request allow/deny lists, response audit requirements, ordered runtime stages, fail-closed conditions, next runtime steps, and an `invocation_sha256`.
- The scaffold is deliberately non-executing: provider refs, model refs, request artifacts, response artifacts, model invocation, tool requests, raw artifact reads, Ledger appends, prompt artifact persistence, and runtime authority are all absent or false.
- Runtime stages now name the missing evidence required for a future real loop: context assembled, prompt rendered, durable runtime binding, model invocation, model response, response audit, supervisor-gated tool request, scoped lease, observation, and verification.
- Authority gates explicitly state that prompt, context, Memory Cards, Capability Cards, and active permissions cannot authorize actions; tool requests must enter a dedicated supervisor path; tool execution requires a scoped lease; memory writes require review; side effects require policy or approval.
- Prompt readiness blockers propagate into the runtime invocation. Missing run evidence blocks the context and model stages; source-event taint that claims authorization blocks model invocation; no allowed tool request blocks the tool-request stage.

Verification evidence:

- `packages/orchestrator/test/orchestrator.test.ts` asserts the invocation scaffold for ready, missing-evidence, no-tool, and authorizing-taint plans, including role-boundary source ids, context inventory, model-call blockers, authority gates, tool gateway flags, stage status, required supervisor evidence, fail-closed conditions, next runtime steps, and stable invocation hashing.

Correction and remaining boundary:

- This closes a concrete drift from the original Agent Orchestrator concept: prompt assembly now records the future runtime call structure, not just rendered prompt text. The runtime binding and no-tools model-request metadata steps now persist schema-valid artifacts and supervisor-authored Ledger events, but they still do not implement the true agent loop. There is no model provider configuration, model response artifact, provider-backed model invocation, tool-calling loop, durable queue, daemon, vault, IM ingress, connector, or browser/computer-use runtime.

## Authority Event Append Guard Review

Matched source docs:

- `docs/01-architecture.md`: Tool Access & Action Policy Proxy is the only access and action choke point, and Event Ledger is the fact layer for policy decisions, sensitive reads, and side effects.
- `docs/02-user-boundary-layer.md`: no connector, skill, workflow, MCP server, IM adapter, scaffold, or generated package may bypass the Tool Policy Proxy; sensitive reads are policy events even without external side effects.
- `docs/10-technical-strategy.md`: Rust owns authority, policy, ledger, and native execution; V1 must prove tool request, policy decision, scoped lease, file action, observation, verification, and replay reconstruction.
- `docs/13-schema-runtime-governance.md`: P0 action lifecycle evidence must come from executable supervisor paths, not schema or projection convenience.

Implemented correspondence:

- Rust `event.append` now rejects attempts to write `tool.requested`, `risk.composed`, `policy.decided`, `lease.issued`, `consent.recorded`, `tool.result`, `action.recorded`, `observation.recorded`, or `verification.recorded`.
- The rejection happens before `init_workspace`, so a forged authority event request does not create `.aetherion` runtime state or a partial Ledger.
- Existing governance/projection events such as Memory lifecycle events remain appendable through `event.append`; the guard is scoped to authority-bearing action lifecycle evidence.

Verification evidence:

- Rust unit coverage attempts to append every blocked lifecycle event through `event.append`, asserts each request fails, asserts no runtime state is created, then appends a non-authority `memory.accepted` governance event and verifies the Ledger contains only that allowed event.

Correction and remaining boundary:

- This closes a source-doc deviation where a generic supervisor append method could make client code appear to have produced policy, lease, consent, action, observation, or verification evidence without executing the corresponding supervisor path.
- `event.append` is still a minimal governance-event helper, not a typed production RPC protocol. Future work should replace broad stringly event appends with typed RPC methods for each runtime-backed event family.

## Phase 12 Review Notes

Matched source docs:

- `docs/01-architecture.md`: TUI, GUI, browser extension, IM, mobile, and API are client surfaces. They cannot grant authority directly.
- `docs/02-user-boundary-layer.md`: external content and remote channels must not authorize sensitive actions.
- `docs/09-computer-use-implementation.md`: browser harness should prefer structured observation, keep extension current-tab by default, redact credential-like DOM, treat DOM as tainted, and require explicit approval for data egress.
- `docs/04-skill-and-scaffold-os.md`: Capsules declare requirements; installation and permission expansion must pass schema, tests, sandbox evidence, approval, and rollback.
- Original Phase 12 plan: browser extension cannot bypass Local Supervisor; IM approvals approve only one scoped action; outbound IM/email goes through outbox policy; Capsule Store installation must show permission diff and execute no malicious code.

Implemented correspondence:

- `BrowserObservation` is current-tab only, public-web tainted, non-authorizing, hash-only, and stores redaction counts rather than raw DOM. `ether surface browser-observe` requires an existing source event and Rust supervisor taint denial before appending `browser.observation.ingested`.
- `ComputerAction` and `ComputerObservation` provide the next contract layer for real computer use: structured-first channels, current-tab browser scope, source-cited requirements gates, scoped leases for side effects, approval cards and exact approval keys for side-effectful adapters, hash/redaction observations, and no live replay.
- `ImInboxItem` stores sender/message hashes, never raw text, and upgrades risk for group/public/unknown senders. Inbound IM has `can_authorize_actions=false`.
- `ImOutboxItem` stores destination/body hashes, marks `delivery_attempted=false`, and carries one-scoped approval semantics. Rust `surface.outbox.evaluate` returns `ask`/L3 for DM or group and `deny`/L5 for public sends, always with no lease and `delivery_allowed=false`.
- `StorePackage` uses Ed25519 over a canonical Capsule declaration. `store trust-publisher` records a local operator-enrolled publisher key fingerprint. `store install` validates the package against that local trust anchor, verifies the signature, resolves at least two passing replay tests from local Replay Record evidence, verifies the sandbox trial file hash, requires permission-diff approval, then installs only the Capsule declaration and a Capsule Install record. `raw_code_executed=false`.
- Ether Ledger evidence is surface-specific: `browser.observation.ingested`, `im.inbox.received`, `im.outbox.queued`, and `capsule.store.installed`. Registries remain projections over artifacts and events.

Correction and remaining boundary:

- Phase 12 is not a full computer-use implementation yet. It does not click, type, read arbitrary tabs, capture screenshots, launch a browser extension, send IM/email, start a webhook, run a GUI, or execute package code.
- The browser command currently accepts a governed observation fixture/input. Real DOM/CDP collection and screenshot fallback must be implemented behind the same Supervisor policy gates.
- Store publication is still local. There is no remote market, transparency log, revocation feed, payment, public trust network, or automatic trust inheritance from package-embedded keys.
- GUI work remains blocked on a concrete product-design target. The console must be a Local Supervisor client over these same event/registry surfaces, not a new authority path.

## Git-Like Event System Review

Matched source docs:

- `docs/01-architecture.md`: Event Ledger is the product source of truth and stores durable envelopes, provenance, hashes, redaction markers, tombstones, and artifact references.
- `docs/05-audit-and-data-contracts.md`: replay defaults to trace reconstruction or sandbox simulation; live side-effect replay is disabled unless explicitly approved.
- `docs/10-technical-strategy.md`: the durable Event Ledger belongs in Rust core plus JSONL with versioned hash-chain verification.
- `docs/11-migration-and-runtime-economics.md`: Git-style branching over Event Ledger checkpoints is feasible, but branches can replay decisions and artifacts, not authority.

Implemented correspondence:

- Rust supervisor and the test-only TS seed append `hash_version: aetherion-event-v1`, `parent_event_id`, `parent_event_hash`, and SHA-256 `event_hash`.
- Both authors hash the same canonical complete event envelope, excluding only `event_hash`, and now read the same `fixtures/event-hash-v1.json` golden vector in TS and Rust tests. Rust workspace startup verifies every v1 event regardless of actor.
- `reconstructTrace` verifies the full Ledger prefix through the selected run's last event, then projects that run. This preserves cross-run parent links while exposing `chain_valid`, `head_event_id`, and `head_event_hash` without replaying side effects.
- `ether replay` now persists a Replay Record artifact with `live_side_effects.allowed=false`, creates an independent `run_replay_*` manifest with a supervisor-authored `replay.recorded` Ledger event pointing at that artifact, updates the registry projection, then runs the same read-only `replay-records` parity check and prints matched/drift summary counts.
- `checkpoint` records the selected event id/hash; `branch` copies source/head pointers and keeps `inherits_authority=false`.
- Ether prints chain status and head pointers for both supervisor and test-only seed traces.

Correction from review:

- This is not the final production Event Ledger. Per `docs/10-technical-strategy.md`, the production hash-chain authority still belongs in the Rust Local Supervisor/Event Ledger core.
- Rust now emits the same versioned hash-chain fields consumed by trace verification, supervisor-authored event timestamps are RFC3339 UTC strings validated against `event.schema.json`, and supervisor-authored appends hold a workspace-local lock while reading the head and preparing the next event. The Ledger file is rewritten through a synced temp file and atomic rename, so an append leaves either the old complete Ledger or the new complete Ledger rather than a partial JSONL line. Workspace init removes abandoned uncommitted temp files, verifies parent continuity and workspace-id consistency across mixed TS/Rust ledgers, and verifies the complete canonical v1 event hash regardless of author. Legacy unversioned supervisor events retain compatibility verification; legacy non-supervisor migration remains explicit technical debt. The remaining ledger gaps are redaction/rebuild, signatures, branch-specific append streams, legacy migration tooling, and process-aware stale-lock recovery.
- Branching preserves checkpoint identity and hash pointers and can create an Aetherion-managed temp file workspace under `.aetherion/sandboxes/`; it does not yet create Git worktrees or branch-specific event append streams.

## Phase 5 Review Notes

Matched source docs:

- `docs/11-migration-and-runtime-economics.md`: branches may replay decisions and artifacts, but cannot replay authority without fresh policy evaluation.
- `docs/11-migration-and-runtime-economics.md`: replay/fork/wakeup paths must pass fresh policy checks before side effects.
- Original Phase 5 plan: sandbox rehearsal must not mutate the real workspace, expired leases cannot be reused, and approval creates a new action event.

Implemented correspondence:

- `rehearse --path <workspace-file>` validates the target stays inside the workspace and outside `.aetherion/`, writes proposed content only under `.aetherion/sandboxes/<branch>/workspace/`, and records a reviewable diff plus original/proposed SHA-256 values.
- The real workspace file remains unchanged until explicit approval; the rehearsal records `real_workspace_mutated=false` and `approval_required=true`.
- `approve-rehearsal` treats persisted rehearsal, branch, and checkpoint rows as projections only. Before creating a promotion run or asking the supervisor for write authority, it revalidates the checkpoint Ledger event id/hash, branch source/head event pointers, branch sandbox status, sandbox path binding, current target hash, and sandbox proposed-content hash.
- File approval creates an independent promotion run instead of appending live-operation evidence to the checkpoint source run after its `run.completed` event.
- Promotion calls Rust `file.write.prepare` and `file.write.commit`, so the supervisor records `tool.requested`, `risk.composed`, ask/allow `policy.decided`, `consent.recorded`, `lease.issued`, `action.recorded`, `observation.recorded`, and `verification.recorded` lifecycle events for the live write.
- `SandboxApproval` records `fresh_policy_evaluated=true`, `inherited_authority=false`, `promotion_run_id`, the fresh lease id, side-effect status, and verification status; the branch transitions from `sandbox` to `approved`.
- `audit sandbox-records` reconstructs expected checkpoint, branch, rehearsal, and sandbox-approval projections from persisted command artifacts. Approval artifacts are applied as branch state transitions so the expected branch projection reflects an approved rehearsal without treating the approval artifact as write authority.

Verification evidence:

- TUI regression tests tamper the branch registry to a non-sandbox status, tamper the sandbox proposed file after rehearsal, and change the real target file after rehearsal. Each case fails before writing a `run_rehearsal_*` manifest, before requesting supervisor authority, and before overwriting the live target.
- TUI integration tampers the branch registry after a real rehearsal approval and asserts `audit sandbox-records` reports mismatched and stale branch projection entries while leaving registries, artifacts, and live workspace files unchanged.

Correction and remaining boundary:

- This corrects a projection-authority drift: registry rows may help locate checkpoint/branch/rehearsal state, but they cannot authorize promotion to a live local write without immediate Ledger, path, and file-hash evidence.
- The current temp workspace is an Aetherion-owned file mirror, not a Git worktree. It proves local file isolation and promotion but not repository-level merge/conflict behavior.
- Only local file writes are implemented. Database, email, connector, and other external side effects still need target-specific rehearsal and compensating-action contracts.
- TypeScript remains the Ether orchestrator and audit client. Rust owns the policy/write boundary for approved file rehearsal, but the supervisor is still a POC rather than the production authority daemon.
- Approval records the actual operation lease returned by `file.write.commit`; the write-prepare ask decision is evidence of the approval gate, not execution authority.
- The sandbox parity preview is artifact-backed, not Ledger-lifecycle-backed. It is a visibility tool for projection drift and does not replace the immediate Ledger, path, and file-hash preflight inside `approve-rehearsal`.
- This is a preflight hardening slice, not a full deterministic rebuild/repair path for checkpoint, branch, and rehearsal registries.

## Phase 6 Review Notes

The user plan numbers this work as Phase 6. The original repository roadmap names the same Capability Capsule milestone Phase 5 because that roadmap has a different phase sequence. This review uses the user-plan number while preserving the source-document mapping.

Matched source docs:

- `docs/04-skill-and-scaffold-os.md`: Capsules bind playbook, tool contracts, permission requirements, tests, evals, provenance, and rollback; Capsules declare requirements but never own runtime permissions.
- `docs/04-skill-and-scaffold-os.md`: permission expansion requires explicit approval; imported skills and executable packages remain quarantined until stronger gates pass.
- `docs/06-roadmap.md` Phase 5: draft/test/publish/deprecated lifecycle, historical replay, scoring, source tasks, risk, provenance, rollback, and no direct tool permission ownership.
- `docs/11-migration-and-runtime-economics.md`: imported Legacy Capsules remain quarantined and do not inherit trust.

Implemented correspondence:

- `capsule draft` accepts only a workspace-local manifest whose cited source events and at least two distinct source runs exist in the Event Ledger.
- `capsule test` reconstructs two distinct cited run traces against the global hash-chain prefix. It never replays live side effects.
- The MVP sandbox trial supports document-only playbooks. It copies the playbook into `.aetherion/capsules/trials/<id>/<version>/`, computes a SHA-256 digest, and rejects shell, network, or secret-access markers.
- Draft/test state stays in `capsule-drafts`; it cannot replace the active `capsules` registry entry. Permission requirements produce a diff against the current published version. Added tools require `--approve-permissions`, which creates a schema-valid Approval Card before local publication.
- Published versions retain replay tests, sandbox evidence, source tasks/events, evals, risk, integrity digest, and rollback metadata. Multi-agent contracts accept only published Capsules with this evidence.
- `capsule rollback` resolves a previously published version from the version registry, marks the replaced version deprecated, and restores the selected version as current.
- Successful `capsule draft`, `test`, `publish`, and `rollback` transitions append supervisor-authored, hash-chained governance events whose `payload_ref` points to versioned Capsule lifecycle snapshots under `.aetherion/artifacts/capsule/<lifecycle>/`.
- External/executable Capsules are quarantined. No playbook or imported code executes in the Local Supervisor.

Correction and remaining boundary:

- SHA-256 proves content integrity but is not a signature. The contract therefore uses `integrity` and marks publication `local_unsigned`; package/capsule signing remains a later Store/package gate.
- Static pattern scanning is deliberately narrow and cannot establish code safety. Executable package typecheck, unit tests, process isolation, structured IPC, resource limits, and network policy remain unimplemented.
- The lifecycle does not yet auto-propose Capsules from repeated episodes. Users provide a manifest whose provenance is verified.
- Capsule registries remain lifecycle projections, but `audit capsule-records` now proves a scoped read-only Ledger-plus-artifact parity preview for `capsules`, `capsule-drafts`, and `capsule-versions`. It reports drift instead of repairing registry files.
- Scoring fields are present and updateable in the domain module, but production task routing does not yet feed outcome metrics into them.

## Phase 7 Review Notes

Matched source docs:

- `docs/05-audit-and-data-contracts.md`: JSONL Event Ledger remains authoritative; SQLite and graph indexes are rebuildable projections; redacted sources must be removed or marked.
- `docs/11-migration-and-runtime-economics.md`: the first causal-memory version should connect intent, policy, tools, observations, failures, corrections, and outcomes; counterfactuals remain reports or patches and full alternate-history simulation is deferred.
- `docs/10-technical-strategy.md`: SQLite is the first local projection technology; graph projection is later and must not enter the authority path.
- Original Phase 7 plan: every edge cites source events; missing evidence lowers confidence; counterfactuals do not execute tools; reports expose evidence, assumptions, and unknowns.

Implemented correspondence:

- The Rust/TS kernel trace now records distinct read and write `tool.requested` events, preventing write policy decisions from being projected against the earlier read request.
- `buildCausalEdges` groups by `run_id` and projects typed links for intent, request, policy, consent, tool result, action, observation, verification, failures, corrections, and run outcome.
- Every edge records event types, sequence distance, confidence, source events, redaction status, and `inference=temporal_dependency_candidate`.
- `buildWhyReport` walks backward from the recorded outcome, lists evidence/failures/corrections/assumptions/unknowns, and becomes partial or insufficient when stages are missing or ancestor evidence is redacted.
- `counterfactualFromCheckpoint` walks only recorded downstream dependencies, lists affected events, and always sets `live_side_effects_allowed=false`. It does not predict an alternate outcome.
- `rebuildCausalProjection` recreates per-run rows in `.aetherion/projections/causal.sqlite`, records the current Ledger head, and marks `source_of_truth=false`.
- Appended `event.redacted`/`artifact.redacted`/`memory.deleted` events can link affected source ids. Rebuilding marks dependent edges redacted and lowers report confidence without rewriting Ledger history.

Correction and remaining boundary:

- Typed order is evidence of recorded sequence, not proof of causation. Relation names use `context_for` and the contract explicitly labels inference as a candidate.
- SQLite is not consulted by policy, lease issuance, or live execution. Deleting it loses no authoritative state; `ether why` and `ether counterfactual` rebuild it from JSONL.
- There is no domain state model, symbolic simulator, LLM replay, or asynchronous counterfactual worker yet. Therefore the MVP reports which recorded dependencies may change, not what the alternate world would become.
- Redaction markers preserve event envelopes and provenance links. Cryptographic erasure of referenced encrypted artifacts remains a separate retention/vault capability.
- Rehearsal promotion now assigns live file promotion to an independent run manifest, so Why Reports for the checkpoint source run are no longer made partial merely because a later sandbox approval occurred. Richer domain simulation and alternate-history outcome evaluation remain pending.

## Phase 8 Review Notes

The user plan numbers Digital Hibernation as Phase 8. The original repository roadmap uses Phase 8 for remote user connection and lists hibernation under the future runtime-economics track. This review follows the user-plan number without claiming that IM, browser extension, or remote wakeup is implemented.

Matched source docs:

- `docs/01-architecture.md`: proactive behavior reacts to meaningful events, respects attention budgets, and does not periodically wake merely to think.
- `docs/03-memory-os.md`: Dreaming is event-driven consolidation and must not become an idle cron that self-authorizes actions.
- `docs/11-migration-and-runtime-economics.md`: wakeup loads minimal context, checks eligibility, policy, attention, and lease freshness, then resumes, queues, or discards; reliable background wakeup requires daemon or OS integration.
- Original Phase 8 plan: sleeping runs retain no active lease; wakeup must request fresh policy; stale triggers expire; blocked memory stays out of minimal context; high-risk actions do not auto-execute.

Implemented correspondence:

- `ether sleep` requires an existing run manifest and a hash-bound Event Ledger head. It persists that cursor, a compact resume summary, a `resume` Context Pack, trigger ids, and a bounded wake attention budget.
- The resume Context Pack is rebuilt from accepted Memory Cards. Memory Cards blocked for `resume` appear in `excluded_memories`, and `active_leases` is forcibly empty.
- Manual, deadline, and workspace-file triggers are persisted. File triggers reject `.aetherion`, lexical boundary escape, missing initial targets, and symbolic links whose real target leaves the workspace; modification or deletion makes the trigger eligible.
- `ether wake` evaluates one trigger explicitly. Ineligible, stale, exhausted, or already-consumed triggers are scheduled, expired, or discarded without creating a resume run.
- Eligible wakeups call Rust `run.resume.evaluate`. The supervisor returns queue-only policy with no lease and `auto_execute_allowed=false`.
- Ether creates a separate resume run, appends `policy.decided` and `wakeup.queued` through the Rust supervisor, and completes the manifest as `blocked`. No tool request, lease, or action event is created.
- `audit hibernation-records` reads persisted sleep and wake artifacts, reconstructs expected `hibernations` and `wakeups` projections, and reports matched, missing, mismatched, stale, or invalid projection state without evaluating triggers, calling resume policy, queueing wakeups, issuing leases, repairing registries, or resuming work.

Correction and remaining boundary:

- The previous record-only `waking` state overstated capability and had no real policy evidence. It was replaced with a queue-only lifecycle backed by a fresh supervisor decision and Ledger events.
- This implementation is not a daemon, scheduler, process unloader, file watcher, webhook listener, or resumed Agent executor. Deadline and file conditions are checked only when `ether wake` is invoked.
- A queued resume run is intentionally `blocked` until a future governed executor loads the minimal context and starts a new action lifecycle. It cannot reuse the source run's lease.
- The Rust resume policy is deliberately narrow and deterministic. Rich opportunity scoring, user-presence policy, trigger signatures, and L4/L5 approval routing remain future work.

## Phase 9 Review Notes

Matched source docs:

- `docs/03-memory-os.md`: Dreaming may compress episodes and propose memory patches, but it cannot directly modify active memory, policy, permissions, or external systems.
- `docs/11-migration-and-runtime-economics.md`: folds preserve nuance and source evidence; anchors have confidence, TTL, allowed/blocked contexts, and sensitive approval; forks receive new identity, policy, budget, and lease scopes.
- `docs/01-architecture.md`: Event Ledger remains the fact layer; Memory OS and client registries cannot become trust roots.
- Original Phase 9 plan: over-folding preserves `folded_from`; persona reset retains business memory while switching style anchors; forks inherit no old lease/vault grant and replay history without side effects.

Implemented correspondence:

- `ether dream run` requires an existing run and at least two active Memory Cards whose source events belong to that run. The caller supplies the proposed high-level content and confidence; Ether does not invent a semantic summary.
- A Memory Fold retains all source Memory Card ids and source event ids, carries a full proposed Memory Card, and sets `replaces_active_memory=false`. Only `dream accept` adds the proposed card; source cards remain addressable.
- Sensitivity propagates at the highest source level. Confidential, secret, regulated, or credential-like folds require `--approve-sensitive`.
- Persona Anchors now carry branch, kind, TTL, expiry, context boundaries, sensitivity, and review state. Accepted non-expired anchors materialize a named Persona Branch.
- `persona reset` requires an existing branch, switches active anchor references, preserves project/fact/constraint/relationship business Memory Card ids, and records `inherits_live_authority=false`.
- Soul Fork requires a hash-bound checkpoint and a valid hash-chain prefix. It persists a trace-only Replay Record with live side effects disabled.
- Each fork embeds a distinct agent identity, policy id, zero token/tool/lease budget, empty workspace path scope, and empty vault/OAuth/active-lease grants. Default inheritance includes only approved public/internal/private Memory Card ids; sensitive memory ids remain excluded.
- Governance state transitions are appended by the Rust Supervisor with stable artifact references. Ether registries are lifecycle projections over those artifact-linked events.
- The lightweight contract validator now enforces integer, maximum-array-size, and unique-item constraints, so empty fork authority collections and distinct fold sources are contract gates rather than domain-function conventions only.

Correction and remaining boundary:

- The previous `status=proposed` Soul Fork record did not create a meaningful identity boundary and could not prove replay. It was replaced with a `created` but deliberately non-executable inheritance container.
- “Digital soul” means versioned, source-linked preference/knowledge/decision-state references in this implementation. It does not claim consciousness, faithful personality emulation, legal succession, or posthumous autonomous agency.
- Fork budgets and path scopes start empty. A future user-authorized provisioning flow must create new grants; the fork cannot run merely because the record exists.
- Persona reset currently classifies preference/habit cards as style-adjacent and retains other Memory Card types as business memory. Richer memory taxonomy and conflict resolution remain future work.
- Governance event payloads point to immutable command artifacts. `audit registries` can now report whether registry entries cite existing Ledger event ids, missing event ids, no event provenance, or malformed entries. `audit replay-records`, `audit memory-records`, `audit capsule-records`, `audit hibernation-records`, and `audit sandbox-records` add scoped rebuild/parity previews for Replay Records, Memory Candidate/Card/Tombstone projections, Capsule lifecycle projections, Digital Hibernation sleep/wake projections, and Sandbox Rehearsal checkpoint/branch/rehearsal/approval projections, but deterministic rebuild/parity tooling for remaining registry families is still not implemented.

## Phase 10 Review Notes

Matched source docs:

- `docs/01-architecture.md`: child clients and orchestrators cannot become trust roots; the Rust Local Supervisor owns policy and scoped leases.
- `docs/04-skill-and-scaffold-os.md`: Capsules declare requirements and evidence but never own permissions.
- `docs/11-migration-and-runtime-economics.md`: multi-agent work needs contracts, resource budgets, circuit breakers, isolated capability scope, completion evidence, and tainted child output.
- Original Phase 10 plan: each child has an independent run id, budget, and lease scope; unauthorized Capsules and repeated policy denial stop execution; parent routing cannot treat child output as authority.

Implemented correspondence:

- `ether agent contract` requires an existing parent run, persisted stop-on-exhaustion Resource Budget, published evidence-backed Capsule, explicit workspace path, child identity, and task. Contract creation consumes nothing and records no child execution.
- `ether agent execute` creates a separate child run manifest. The current executor accepts only a published `document_only` Capsule whose sole tool requirement is `filesystem.read`.
- Capsule id, exact path, and L1 risk are checked against the contract before authority is requested. Permission violations stop the contract and open a circuit breaker.
- Rust `child.file.read` validates the existing workspace identity, creates the Tool Request, composes risk, evaluates policy, issues the scoped read lease when allowed, performs the read, and appends `tool.requested`, `risk.composed`, `policy.decided`, optional `lease.issued`, and `tool.result` to the Event Ledger in the same supervisor RPC path. Ether attaches the returned non-empty event ids to the child manifest.
- Budget Accounts decrement tool-call and lease allowances and record orchestration CPU/wall time. Token and network usage stay zero because the MVP invokes neither a model nor a network tool.
- Successful child results expose event ids, request/policy/lease ids, SHA-256, byte count, and usage totals, but not file contents. `output_taint.can_authorize_actions=false` and `parent_must_reauthorize_actions=true`.
- Three policy denials open a hard-stop breaker. Permission violations, resource exhaustion, timeout, and supervisor execution failure also stop the contract. Success/denial/violation outcomes update a bounded routing weight.

Correction and remaining boundary:

- The earlier static Agent Contract surface was not multi-agent execution and could not claim budget consumption. Phase 10 now has one real, deliberately narrow child operation.
- This is not general LLM-based agent orchestration, arbitrary Capsule execution, payment/search separation across remote agents, public escrow, or an Agent economy.
- Resource Budget contracts can represent stop/queue/ask for future orchestration, but the current executor rejects anything except `on_exhaustion=stop`; it does not pretend to queue or request approval.
- CPU measurement currently covers the Ether-side spawn/RPC interval and process CPU consumed by the orchestrator. Exact child supervisor CPU accounting requires a long-running supervisor with per-request metering.
- Tool, risk, policy, lease, and result events are Rust-authored facts. Budget Accounts, breakers, scores, and Child Results are schema-validated local projections/artifacts; future durability work must make their rebuild rules explicit.

## Phase 11 Review Notes

Matched source docs:

- `docs/01-architecture.md`: every sensitive action passes through taint propagation before lease issuance; client surfaces cannot authorize themselves.
- `docs/02-user-boundary-layer.md`: public content may inform summaries but cannot authorize tools, override user instructions, or trigger high-risk actions.
- `docs/05-audit-and-data-contracts.md`: taint and source evidence belong in durable envelopes while sensitive payloads can remain in separately governed artifacts.
- `docs/09-computer-use-implementation.md`: external DOM/content stays tainted through planning and cannot become action authority.
- `docs/11-migration-and-runtime-economics.md`: useful first steps are taint marking, privilege-escalation detection, sandbox/honeypot trials, and regression fixtures.

Implemented correspondence:

- `scanUntrustedContent` covers explicitly classified web, email, PDF, IM, GitHub issue, MCP description, and generic third-party text. Assessments retain source event id, source kind, SHA-256, matched rules, and non-authorizing taint; raw input is not persisted. Each scan receives a nonce-bearing artifact id so repeated scans cannot overwrite an earlier Ledger reference.
- Detection rules currently cover prior-instruction override, secret exfiltration, policy/approval bypass, and dangerous tool invocation. Multi-rule matches are retained and the highest-severity signal becomes primary.
- `ether security scan` requires an existing source event, creates an independent security run, and calls Rust `security.taint.evaluate`. Rust validates workspace identity, appends a deny-only `policy.decided`, returns no lease, and sets `can_authorize_actions=false`.
- Clean assessments complete the security run through the fixed `policy.decided -> security.content.assessed` lifecycle. Suspicious assessments append `poisoning.detected`, persist a quarantined signal, and end the run as blocked through `policy.decided -> security.content.assessed -> poisoning.detected`; policy events carry no artifact ref, while assessment and signal events must bind to their scan artifact refs.
- `security ack` changes review state without lifting quarantine. `security trial` creates a deterministic `decoy://` containment record with no real secret, network, or authorization path. When a Capsule is explicitly named, its lifecycle is reduced to `quarantined` without executing it.
- `security fixture` converts the signal into detector-only replay expectations by content hash and rule ids. It includes no raw hostile content and cannot replay side effects.

Correction and remaining boundary:

- The earlier Phase 11 seed was three regular expressions plus an acknowledgement field that did not conform to its own schema. It had no Rust policy evidence, honeypot record, regression fixture, or Ledger lifecycle.
- The current detector is deterministic and narrow. It does not claim semantic prompt-injection completeness, model-based intent classification, source ingestion, attacker attribution, active countermeasures, or safe execution of hostile code.
- The honeypot trial is deliberately a decoy-only containment evaluation, not a process sandbox. Unknown executable Capsule trials remain blocked until separate-process isolation, structured IPC, resource limits, and network/vault denial are implemented.
- Content hashes let regressions identify the same input without retaining it. Re-running detection requires the caller to supply governed source content again; the fixture cannot reconstruct raw input by design.

## Phase 2 Review Notes

Matched architecture docs:

- `docs/01-architecture.md`: Local Supervisor is the authority boundary; TUI is a client surface.
- `docs/06-roadmap.md`: Phase 2 requires Rust supervisor POC, stdio/local RPC, workspace init, event append, policy eval, scoped read/write, and TUI client.
- `docs/10-technical-strategy.md`: TypeScript stays the fast TUI/orchestrator layer; Rust owns the future authority boundary.

Implemented correspondence:

- Rust workspace init and event append: `workspace.init`, `event.append`.
- Rust event append serializes concurrent writers with a ledger lock file before computing parent event pointers and hashes.
- Rust event append writes through a synced temp Ledger and atomic rename, preserving complete JSONL lines even when the prior file has no trailing newline.
- Rust workspace init cleans abandoned Ledger temp files, verifies parent continuity, and rejects corrupted v1 event hashes from any author before any new run proceeds.
- Rust file actions: `file.read.traced`, `file.write.prepare`, and `file.write.commit` emit the required policy, lease, result/action, observation, and verification evidence. Legacy `tool.evaluate`, `lease.issue`, direct `file.read`, direct `file.write`, and CLI direct reads are rejected so they cannot return leases or file contents without lifecycle Ledger evidence.
- Rust replay: legacy `trace.replay` is rejected because replay evidence must read Ledger events, validate the trace, persist a Replay Record artifact, and append `replay.recorded` through Ether's replay path.
- TS client path: `callSupervisorRpc` and `runSupervisorKernelLoop`; supervisor result evidence is accepted only from one non-empty response line that parses as valid JSON and a JSON-RPC 2.0 envelope whose top-level fields are unique, whose id matches the request, and whose envelope contains exactly one of `result` or a non-blank string `error`.
- Ether CLI user path: `npm run ether -- run --supervisor stdio ...`.
- Replay invariant: Ether trace reconstruction reads the Ledger and reports `live_side_effects_replayed=false`; Ether replay additionally persists the schema-valid Replay Record artifact and independent `replay.recorded` Ledger evidence.

Known gaps before Phase 2 can be called production-ready:

- The Rust stdio RPC parser is dependency-free and intentionally minimal; malformed JSON, duplicate keys, wrong-typed required strings, wrong-typed boolean approval fields, and legacy policy/read/write/replay direct RPCs now fail closed, but it is not a robust general JSON-RPC server.
- Rust ledger timestamps now use RFC3339 UTC strings, and Ether integration validates supervisor-authored events against `event.schema.json`.
- Rust supervisor appends are serialized by a local lock and use synced temp-file rename; startup checks remove abandoned uncommitted temp files, verify parent continuity, verify workspace id consistency, and reject corrupt canonical v1 event hashes from Rust or TypeScript authors. TS and Rust canonical hash tests consume the same `fixtures/event-hash-v1.json` golden vector. Stale active lock recovery now records the owner PID, preserves live-owner locks, treats missing Unix owner processes as stale, and keeps age-based recovery as the portability fallback. Legacy unversioned non-supervisor events remain readable but need migration tooling before Rust can prove their full content hash.
- TS seed path remains test-only and is blocked unless `AETHERION_ALLOW_TYPESCRIPT_SEED=1`.
- No vault, sandbox process isolation, long-running daemon, connector runtime, or generated-code isolation is implemented.

## Truthfulness Gate

Before later phases are promoted, runtime commands must not synthesize missing evidence or report unexecuted work as successful.

Current enforced rules:

- Ether defaults to Rust supervisor authority; stale supervisor binaries are rebuilt before RPC use.
- Ether's default run summary does not copy source file content; copying user text into output requires an explicit `--summary`/`summaryText` value.
- Workspace ids are derived from the resolved workspace path instead of fixed demo ids.
- Workspace registries are loaded as projections: runtime code derives identity, runtime directory, and Ledger path from the resolved workspace root, requires `ledger_path`, and rejects registry path/id drift before reading Ledger evidence or creating run manifests.
- Memory candidates and Persona Anchors require existing source events and explicit confidence.
- Context, checkpoint, branch, rehearsal, hibernation, wakeup, Soul Fork, and Agent Contract commands fail when their referenced ledger or registry records do not exist.
- `audit registries` is read-only and does not persist audit artifacts or registry entries. It makes projection provenance debt visible, but `strong` means referenced Ledger event ids exist, not that the registry can already be regenerated from source truth.
- `audit replay-records` is also read-only and does not repair drift. It compares `.aetherion/registries/replay-records.json` with `.aetherion/artifacts/replay/**/*.json` and reports matched, missing, mismatched, stale, or invalid Replay Record projection state; `ether replay` records each replay in an independent Ledger-backed replay run and then prints the compact parity summary.
- Capsule test/publish accepts only persisted Capsule drafts, two distinct cited Ledger runs, passing hash-chain replay records, and a document sandbox trial. Permission expansion requires an Approval Card.
- Capsule publication is labeled `local_unsigned`; a SHA-256 integrity digest is not represented as a cryptographic signature.
- Agent Contract creation does not consume budget or imply a child run occurred. Only `agent execute` creates a child run and accounting records.
- Child output cannot authorize parent actions; successful results contain hash/byte evidence and require a new parent policy decision for any follow-on action.
- External-content assessments require a Rust deny/no-lease taint decision. Poisoning artifacts store hashes and rule ids rather than raw scanned text.
- Browser/IM/Store surface commands persist hash-only artifacts and require Ledger/Supervisor evidence. They do not claim browser automation, IM delivery, GUI operation, webhook takeover, remote Store publication, or package-code execution.
- Counterfactual output is low-confidence, report-only, and lists evidence, assumptions, and unknowns.
- Examples and test fixtures may use illustrative ids, but runtime code cannot fall back to them.

## Phase 20 Review Notes

Matched architecture docs:

- `docs/02-user-boundary-layer.md`: every material action should answer who, where, what, why, risk, and memory/permission impact questions.
- `docs/01-architecture.md`: user surfaces display approvals and audit state, but do not grant authority directly.
- `docs/05-audit-and-data-contracts.md`: every material action should be reconstructable from actor, reason, input/output, risk, timestamp, policy, consent, and trace evidence.

Implemented correspondence:

- `ether boundary <run_id>` is a read-only TUI view over the workspace registry, run manifest, JSONL Event Ledger, and reconstructed trace. It writes no artifact, mutates no registry, and performs no policy action.
- The command surfaces who/where/what/why/risk/consent/lease/proof fields from recorded facts: actor ids, workspace id/root, entry surface, authority, event types, request/policy/consent/lease/action counts, risk levels, policy summaries, event ids, hash-chain status, manifest status, Ledger path, and `live_side_effects_replayed=false`.
- Missing identity and vault facts are explicit. Phase 22 now records a `run.started` Boundary Facts payload for current Ether kernel runs, but that payload still marks first-class `user_id`, `device_id`, `channel_id`, and `secret_vault` as `not_recorded` rather than synthesizing them.
- `ether help` now separates V1 core commands, trace-backed local runtime slices, post-V1 contract surfaces, and read-only audits. Surface/Store examples are labeled as no-delivery/no-automation/no-package-code-execution contract surfaces.

Correction and remaining boundary:

- This is a visibility pass, not a production User Boundary Layer. Device identity, channel identity, vault policy, memory impact diffs, consent record schemas with full scopes, and per-action boundary cards still need Ledger-first facts before they can be rendered as complete authority evidence.
- The command intentionally reads current run and trace evidence only. It does not repair registries, rebuild projections, infer missing users, or normalize old runs into new boundary records.

## Phase 21 Review Notes

Matched architecture docs:

- `docs/01-architecture.md`: Event Ledger is the fact layer for capability evolution; client registries and surfaces cannot become trust roots.
- `docs/04-skill-and-scaffold-os.md`: Capability Capsules declare permission requirements and constraints, but do not own runtime grants.
- `docs/06-roadmap.md` Phase 5: Capsule draft/test/publish/deprecated lifecycle needs replay tests, risk, provenance, source tasks, scoring, and rollback.
- `docs/13-schema-runtime-governance.md`: P1 Capability OS changes must cite real Ledger evidence and must not treat registries as rebuildable merely because they exist.

Implemented correspondence:

- `schemas/event.schema.json` now includes `capsule.draft.recorded`, `capsule.test.recorded`, `capsule.publish.recorded`, and `capsule.rollback.recorded`.
- `ether capsule draft/test/publish/rollback` writes versioned lifecycle snapshots under `.aetherion/artifacts/capsule/<lifecycle>/...` and asks the Rust supervisor to append a hash-chained governance event whose `payload_ref` points to that snapshot.
- The lifecycle events are appended only after successful state transitions. The Ether integration test proves a failed permission-expansion publish without `--approve-permissions` adds no `capsule.publish.recorded` event.
- The integration test verifies two draft events, two test events, two publish events, one rollback event, schema-valid supervisor-authored lifecycle events, expected `payload_ref` values, and the corresponding versioned artifacts.
- Publish summaries explicitly state that the Capsule still owns no runtime permissions, test summaries state that evidence was captured without live side effects, and rollback summaries state that no live tool authority changed.

Correction and remaining boundary:

- This is not a Rust-native Capsule lifecycle state machine. The current improvement is supervisor-appended, hash-chained governance facts over an Ether-managed document-only lifecycle.
- `payload_ref` is the existing Event contract field for lifecycle artifacts; no generic `artifact_ref` field was added to the Event schema.
- Capsule registries remain local lifecycle projections, but `audit capsule-records` now previews deterministic rebuild parity for the document-only lifecycle registries from supervisor-appended lifecycle events and their payload artifacts. It still does not repair registries, execute playbooks, sign packages, or grant Capsule permissions.

## Phase 22 Review Notes

Matched architecture docs:

- `docs/02-user-boundary-layer.md`: every material action should make the current who/where/what/why/risk and memory/permission-impact evidence visible, while missing identity, device, channel, and vault facts must not be invented.
- `docs/01-architecture.md`: Local Supervisor and Event Plane are the authority/fact boundary; TUI is a client surface.
- `docs/13-schema-runtime-governance.md`: P0 runtime contracts need executable evidence and should close the kernel loop rather than broadening into full identity or connector systems.

Implemented correspondence:

- `schemas/boundary-facts.schema.json` and `examples/contracts/boundary-facts.json` define the first Ledger-attached Boundary Facts payload.
- `packages/harness-core/src/boundary.ts` creates schema-valid facts and writes `.aetherion/artifacts/boundary/<run_id>/boundary_<run_id>_facts.json`.
- The default Rust supervisor path and test-only TypeScript seed path append `run.started` with `payload_ref=artifact://boundary/<run_id>/facts` before the file-action lifecycle.
- Boundary Facts record only current proven facts: `run_id`, `workspace_id`, `entry_surface`, and authority. They explicitly keep `user_id`, `device_id`, `channel_id`, and `secret_vault` as `not_recorded`.
- `ether boundary <run_id>` remains read-only. It reads the Boundary Facts artifact plus Ledger, manifest, workspace registry, and trace evidence, then prints known facts, missing facts, current limits, and impact flags without writing artifacts or registries.
- Tests validate the schema/example pair, the `run.started.payload_ref`, the artifact contents, and the TUI output for `boundary_known_facts`, `boundary_not_recorded`, limits, and impact fields.

Correction and remaining boundary:

- This is boundary initialization evidence, not a full User Boundary Layer. It does not implement mature user identity, device pairing, channel identity, vault policy, or per-action boundary cards.
- No new `boundary.*` event type was added. `run.started` carries the artifact reference so the existing event lifecycle remains the fact layer.
- The Boundary Facts artifact is not an authority source and grants no permission. It is supporting evidence for audit and TUI rendering.
- The TypeScript seed path remains test-only behind `AETHERION_ALLOW_TYPESCRIPT_SEED=1`; the user-facing Ether path uses the Rust supervisor by default.

## Phase 23 Review Notes

Matched architecture docs:

- `docs/02-user-boundary-layer.md`: every material action should answer who, where, what, why, risk, and memory/permission-impact questions.
- `docs/01-architecture.md`: TUI is a client surface; Event Ledger and Local Supervisor remain the fact and authority layers.
- `docs/13-schema-runtime-governance.md`: harden the existing action lifecycle before broadening schema surface.

Implemented correspondence:

- `ether boundary <run_id>` now derives a read-only action matrix from existing Ledger events, anchored by `tool.requested` rows and enriched by subsequent `risk.composed`, `policy.decided`, `consent.recorded`, `lease.issued`, `tool.result`, `action.recorded`, `observation.recorded`, and `verification.recorded` events.
- The matrix prints per-action operation, actor, where, why, risk, policy, consent, lease, result, proof, memory impact, permission impact, and source event ids.
- The TUI test verifies a Rust-supervised local run produces two material actions (`filesystem.read` and `filesystem.write`), that both rows cite existing event ids, and that the write row records consent, scoped lease, side effect, and verification proof.
- The same test snapshots the Ledger, replay registry, and Boundary Facts artifact before running `boundary`, then asserts all three are unchanged afterward.

Correction and remaining boundary:

- This is still a read-only projection, not a persisted per-action Boundary Card and not a new source of authority.
- No schema, `boundary.*` event type, artifact, registry, identity, device, channel, or vault fact was added.
- Missing memory impact remains `not_recorded`; the matrix only marks it recorded when a relevant memory lifecycle event exists in the run.

## Phase 24 Review Notes

Matched architecture docs:

- `docs/02-user-boundary-layer.md`: approvals should be durable, inspectable consent records, and every material action should expose recorded consent evidence without inventing identity, device, channel, or vault facts.
- `docs/05-audit-and-data-contracts.md`: every permission change has a consent record, and Event records can carry artifact references through `payload_ref`.
- `docs/13-schema-runtime-governance.md`: P0 kernel contracts should harden the existing action lifecycle before broadening schema or authority surface.

Implemented correspondence:

- `packages/harness-core/src/consent.ts` creates, validates, writes, and reads schema-valid Consent Record artifacts for approved local writes under `.aetherion/artifacts/consent/<run_id>/`.
- The test-only TypeScript seed path writes the Consent Record artifact and attaches `payload_ref=artifact://consent/<run_id>/write` to the existing `consent.recorded` event.
- The default Rust supervisor path creates the Consent Record data in Ether, passes the schema-valid JSON plus stable artifact ref to `file.write.commit`, and the Rust supervisor writes the artifact before appending `consent.recorded`.
- Rust `file.write.commit` accepts optional `consent_payload_ref` and attaches it to `consent.recorded` only when approval is present, policy allows the write, and matching consent artifact evidence has been written. Unapproved writes create no consent event and no consent artifact.
- `ether boundary <run_id>` now prints `consent_payload_refs` from recorded consent events, keeping the User Boundary card read-only and Ledger-derived.

Verification evidence:

- Harness tests validate the Consent Record helper against `consent-record.schema.json`, assert the artifact contents, assert `consent.recorded.payload_ref`, and assert blocked test-seed writes do not create a consent artifact.
- TUI tests assert the Rust-supervised run writes a schema-valid Consent Record artifact, `consent.recorded.payload_ref=artifact://consent/<run_id>/write`, boundary output includes the consent payload ref, and an unapproved Ether run creates no consent artifact.
- Rust RPC tests assert approved write commits write the Consent Record artifact before attaching the consent payload ref to the Ledger, and that unapproved, missing-consent, or mismatched-consent write commits do not append `consent.recorded`.

Correction and remaining boundary:

- No new event type or Event schema field was added. Consent evidence uses the existing `consent.recorded` event and `payload_ref`.
- Consent Records prove one approved local write request. They do not implement full user identity, device pairing, channel identity, vault policy, reusable authority, or a general consent ledger UI.
- The artifact is supporting audit evidence only; scoped leases and policy decisions remain the runtime authority boundary.

## Phase 25 Review Notes

Matched architecture docs:

- `docs/01-architecture.md`: Event Ledger entries may reference artifacts, but those references must remain durable evidence rather than authority.
- `docs/02-user-boundary-layer.md`: consent evidence must be durable and inspectable for material actions.
- `docs/13-schema-runtime-governance.md`: P0 kernel contracts should harden existing runtime loops before broadening schema surface.

Implemented correspondence:

- `runSupervisorKernelLoop` now builds and schema-validates the approved-write Consent Record JSON before calling Rust `file.write.commit`, then passes both `consent_record_json` and `consent_payload_ref`.
- Rust `file.write.commit` requires matching consent JSON before an approved write can append `consent.recorded`; it validates the expected consent id, workspace id, tool request id, decision, and risk level.
- Rust writes `.aetherion/artifacts/consent/<run_id>/consent_<run_id>_write.json` before appending the `consent.recorded` event with `payload_ref=artifact://consent/<run_id>/write`.
- Missing or mismatched consent evidence fails before any target file write, consent event, or consent payload ref reaches the Ledger.

Verification evidence:

- Rust RPC tests cover the successful supervisor-authored artifact/event path and the missing/mismatched consent negative paths.
- Existing TUI integration tests continue to validate that the Rust-supervised run produces a schema-valid Consent Record artifact and `consent.recorded.payload_ref`.

Correction and remaining boundary:

- This removes the earlier dangling-ref window where Rust could append a `consent.recorded.payload_ref` before Ether wrote the referenced artifact.
- The Consent Record schema remains intentionally narrow. It still proves only one approved local write request and does not establish identity, device, channel, vault, or reusable consent authority.

## Phase 26 Review Notes

Matched architecture docs:

- `docs/01-architecture.md`: Event Ledger is the product fact layer, and durable envelopes may reference artifacts without making artifacts authority.
- `docs/05-audit-and-data-contracts.md`: replay/audit should reconstruct or inspect evidence without replaying live side effects or mutating runtime state.
- `docs/13-schema-runtime-governance.md`: hardening should close existing runtime loops and keep projections/read-only audits distinct from source-of-truth state.

Implemented correspondence:

- `packages/harness-core/src/registry.ts` now exports `auditLedgerPayloadRefs`, a read-only audit over Event Ledger records with `payload_ref`.
- The audit resolves known local `artifact://` shapes for Boundary Facts (`artifact://boundary/<run_id>/facts`), Consent Records (`artifact://consent/<run_id>/write`), Replay Records (`artifact://replay/<run_id>/trace`), and generic Ether artifacts under `.aetherion/artifacts/<...>.json`.
- Findings classify references as `resolved`, `missing`, `invalid_json`, or `unresolved`, and include event id, run id, event type, payload ref, resolved path, and reason when relevant.
- `ether audit payload-refs --workspace <path>` reads the workspace Ledger and prints the audit JSON to stdout. It appends no Ledger events, writes no artifacts, mutates no registries, and performs no repair.
- The shared artifact resolver now maps Boundary Facts and Consent Record refs to their actual filenames (`boundary_<run_id>_facts.json` and `consent_<run_id>_write.json`) instead of the older generic `<leaf>.json` convention.

Verification evidence:

- Harness tests cover `resolved`, `missing`, `invalid_json`, and `unresolved` Ledger payload-ref findings and assert the audit leaves artifact files unchanged.
- TUI integration runs a real Rust-supervised Ether kernel loop and verifies `audit payload-refs` resolves both `run.started` Boundary Facts and `consent.recorded` Consent Record refs while leaving the Ledger, replay registry, and Boundary Facts artifact unchanged.
- TUI help now lists `audit payload-refs`, keeping the command surfaced as a read-only audit alongside registry provenance and replay-record parity.

Correction and remaining boundary:

- This is not a registry rebuild or artifact repair tool. It reports drift and broken references only.
- Artifacts remain supporting evidence. Policy decisions and scoped leases remain the runtime authority boundary.
- Unsupported or non-local reference shapes are reported as `unresolved` rather than guessed, so future encrypted, remote, or vault-backed payload stores can define their own resolver without inheriting false local semantics.

## Phase 27 Review Notes

Matched architecture docs:

- `docs/01-architecture.md`: typed events and artifact references are part of the Event Ledger fact layer, while artifacts remain evidence rather than authority.
- `docs/05-audit-and-data-contracts.md`: audit/replay tooling should inspect persisted evidence without replaying live side effects or mutating source-of-truth state.
- `docs/13-schema-runtime-governance.md`: P0 contracts should be tied to executable/runtime evidence and schema/example validation, while read-only audits must not become repair or authority paths.

Implemented correspondence:

- `auditLedgerPayloadRefs` now schema-validates parsed local Boundary Facts, Consent Record, Replay Record, Memory lifecycle, Security lifecycle, Surface/Store lifecycle, and Capsule draft/test/publish artifacts against `boundary-facts.schema.json`, `consent-record.schema.json`, `replay-record.schema.json`, `memory-candidate.schema.json`, `memory-card.schema.json`, `memory-tombstone.schema.json`, `content-assessment.schema.json`, `poisoning-signal.schema.json`, `honeypot-trial.schema.json`, `poisoning-regression-fixture.schema.json`, `browser-observation.schema.json`, `im-inbox-item.schema.json`, `im-outbox-item.schema.json`, `capsule-install.schema.json`, and `capability-capsule.schema.json`.
- Findings now include `schema_name`, `schema_status`, and `schema_errors`; summaries now include `schema_valid`, `schema_invalid`, and `schema_not_checked`.
- Generic local Ether artifacts still resolve by path and JSON parse only, with `schema_status=not_checked`.
- Missing files, unresolved schemes, and invalid JSON remain not checked. The audit still writes nothing, repairs nothing, and appends no Ledger events.

Verification evidence:

- Harness tests cover valid Boundary Facts, Consent Record, Memory Candidate/Card/Tombstone, Security Assessment/Signal/Trial/Fixture, Surface Browser/IM, Store Install, and Capsule payloads; invalid Boundary Facts, Memory Card, Content Assessment, and IM Outbox artifacts with schema errors; generic not-checked artifacts; missing artifacts; invalid JSON; and unresolved refs.
- TUI integration verifies a real Rust-supervised run reports the `run.started` Boundary Facts payload, `consent.recorded` Consent Record payload, and the Ledger-backed `replay.recorded` Replay Record payload from an independent replay run as schema-valid while leaving the Ledger, registry, and artifact files unchanged during the audit. Local phase integrations also verify Security scan/ack/trial/fixture payload refs report the Content Assessment, Poisoning Signal, Honeypot Trial, and Poisoning Regression Fixture schemas as valid, and Surface/Store payload refs report Browser Observation, IM Inbox/Outbox, and Capsule Install schemas as valid.

Correction and remaining boundary:

- No schema was expanded for this phase. The audit uses existing contracts only.
- Schema-valid payload artifacts are still supporting evidence. Policy decisions, scoped leases, and supervisor-authored action events remain the runtime authority boundary.
- Capsule draft/test/publish/rollback artifacts are schema-checked because the Capsule lifecycle has an explicit rebuild/parity path. Memory lifecycle, Security scan/ack/trial/fixture, Surface browser/IM, and Store install artifacts are now schema-checked through their existing contracts. Other generic lifecycle artifacts remain not checked until each family has a dedicated schema/audit path.

## Phase 28 Review Notes

Matched architecture docs:

- `docs/01-architecture.md`: the Event Ledger is the product fact layer, while registries and indexes are rebuildable projections.
- `docs/03-memory-os.md`: memory must stay source-backed, inspectable, context-bounded, and deletable without silently rewriting user truth.
- `docs/05-audit-and-data-contracts.md`: replay and audit surfaces inspect recorded evidence and must not replay live side effects or mutate authority state.
- `docs/13-schema-runtime-governance.md`: P1 product-runtime contracts must cite Ledger evidence or registry evidence whose Ledger references pass provenance checks.

Implemented correspondence:

- `memory candidates --from-run` and `memory candidates --source-event` now persist Memory Candidate artifacts under `.aetherion/artifacts/memory/candidates/`, append supervisor-authored `memory.candidate.created` events with `payload_ref`, and only then upsert `memory-candidates`.
- `memory accept`, `memory reject`, `memory block`, and `memory delete` follow the same artifact-first, supervisor-Ledger-event, registry-projection order for `memory.accepted`, `memory.rejected`, `memory.blocked`, and `memory.deleted`.
- `context explain`, `memory user-model`, and Digital Hibernation resume context assembly now require Memory Card/Tombstone registry entries to pass the registry provenance reference gate before those projections can feed downstream context.
- Weak, missing, or invalid Memory registry provenance fails closed. Tampered Memory Card projections with stale `source_events` cannot enter `context explain` or generate `user-model.json`.
- `.aetherion/memory/user-model.json` remains a projection-only convenience copy derived from accepted Memory Cards; it is not read as an independent source of truth.
- `audit memory-records` walks Memory lifecycle Ledger events in order, reads the `payload_ref` artifacts for `memory.candidate.created`, `memory.accepted`, `memory.rejected`, `memory.blocked`, and `memory.deleted`, reconstructs expected Memory Candidates, active Memory Cards, and Tombstones, and reports matched, missing, mismatched, stale, or invalid projection state without mutating registries.

Verification evidence:

- TUI integration asserts Memory lifecycle events are supervisor-authored, include `artifact://memory/...` payload refs, and have matching artifacts for candidate creation, accept, reject, block, and delete.
- TUI regression tests tamper `memory-cards.json` with a missing Ledger event id and assert `context explain`, `memory user-model`, and `sleep` all reject the projection instead of consuming it.
- Harness and TUI tests tamper Memory Candidate/Card registries and assert `audit memory-records` reports matched, mismatched, stale, and invalid projection state while preserving the registry file unchanged.

Correction and remaining boundary:

- This is not the full Memory OS. Candidate extraction remains deterministic and narrow, focused on `run.completed` and `verification.recorded`; rich ranking, TTL expiry, encrypted redaction, and automated registry repair remain future work.
- The registry provenance gate proves referenced Ledger event ids exist. `audit memory-records` goes further for candidates, active cards, and tombstones by previewing Ledger-plus-artifact rebuild parity, but it is read-only and does not make registry files authoritative.
- `packages/tui/src/cli.ts` is still carrying too much cross-plane orchestration. It remains a client/orchestration surface because authority-bearing writes go through the Rust supervisor, but future phases should split command adapters by plane before adding more runtime behavior.

## Phase 29 Review Notes

Matched architecture docs:

- `docs/01-architecture.md`: Event Ledger is the fact layer; run manifests are projections over recorded facts.
- `docs/05-audit-and-data-contracts.md`: material actions should be reconstructable from request, policy, consent, lease, action, observation, verification, and trace evidence.
- `docs/13-schema-runtime-governance.md`: P0 kernel work should harden the existing action lifecycle before broadening schema or authority surface.

Implemented correspondence:

- `packages/harness-core/src/workspace.ts` now exposes fixed event expectations for approved P0 file runs, blocked unapproved file runs, approved sandbox promotion runs, and single-event replay persistence runs; Ether's `run_governance_*` helper also completes through the same sequence guard using the exact event type and payload ref it just appended.
- `createRunManifest` now refuses to overwrite an existing manifest for the same run id, keeping later projection updates on the guarded `recordRunEvent` and completion paths.
- `completeRunManifestWithEventSequence` reads the Ledger, verifies the manifest event ids match Ledger order for that run, checks selected critical `payload_ref` bindings when supplied, and only then delegates to `completeRunManifest`.
- `recordRunEvent` now treats run manifest `event_ids` as a Ledger projection: it only records the next unrecorded Ledger event for that run, rejects missing, repeated, skipped, or tampered ids, and checks workspace membership before projection.
- `completeRunManifest` now applies the same Ledger-order projection check before any run manifest can enter a terminal status, so completed/blocked/failed manifests cannot hide unprojected Ledger events for their run.
- `loadRunManifest` now rejects manifest files whose embedded run id does not match the requested run or whose workspace id does not match the active workspace.
- `runLocalKernelLoop` and `runSupervisorKernelLoop` now use the sequence guard before marking approved runs `completed` or unapproved-write runs `blocked`.
- `approve-rehearsal` now writes Boundary Facts for the independent promotion run and uses the promotion sequence guard before marking that run `completed`.
- V1 `run`, `trace`, and `replay` stdout now expose manifest status, manifest event count, manifest event ids, and Ledger `payload_ref` artifact refs; `replay` also prints the independent replay run id, replay event id, and Replay Record artifact ref.

Verification evidence:

- Harness tests assert an incomplete kernel file run with only `run.started` cannot be marked `completed` and that the persisted manifest remains `running`.
- Harness tests assert a replay persistence run cannot complete with `run.started` standing in for `replay.recorded`, rejects a correct `replay.recorded` event with the wrong replay artifact ref, and confirms the valid replay lifecycle completes with exactly one `replay.recorded` event.
- TUI integration asserts governance helper runs for memory fold, persona anchor/reset, and Soul Fork events complete as single-event manifests whose only Ledger event is the recorded governance event type.
- Harness tests assert duplicate run manifest creation fails closed and leaves the original projection unchanged.
- Harness tests assert run manifest projection rejects missing Ledger events, out-of-order event ids, repeated ids, tampered manifest prefixes, and workspace-mismatched Ledger entries.
- Harness tests assert a generic run manifest cannot enter a terminal status until it has projected every Ledger event for that run.
- Harness tests assert tampered manifest files are rejected on load, and TUI tests assert `trace`/`replay` fail closed on tampered manifests while preserving the missing-manifest visibility path.
- Existing Ether and TUI tests continue to assert the full approved run lifecycle and sandbox promotion lifecycle event order. The sandbox promotion integration also asserts the promotion `run.started` and `consent.recorded` events point to the expected Boundary Facts and Consent Record artifacts.
- TUI tests assert `run`, `trace`, and `replay` stdout include manifest event ids, Boundary/Consent artifact refs, artifact ref count, and the replay artifact ref.

Correction and remaining boundary:

- This did not impose one lifecycle on all run families at the time. Later passes added explicit lifecycle contracts for hibernation, security scan, browser-observe, outbox, and the main child-read success/policy-denial paths; any remaining run families still need their own contracts before their terminal manifests can make stronger sequence claims.
- The generic creation, terminal, and load guards verify single-create behavior, manifest/Ledger membership, Ledger order, requested run id, and workspace membership. The sequence guard adds event-type order checks only for local-file kernel, sandbox promotion, replay persistence, and single-event governance helper runs. It now validates selected critical `payload_ref` bindings for Boundary Facts, Consent Records, Replay Records, and single-event governance helper artifacts; full artifact JSON semantics remain covered by existing schema validation and source-specific contract tests rather than by the manifest projection itself.
- The CLI evidence output currently covers the V1 core `run`, `trace`, and `replay` commands; it is not yet a universal output contract for every later-phase Ether command.

## Phase 30 Review Notes

Matched architecture docs:

- `docs/03-memory-os.md`: Dreaming produces reviewable patches, not actions, and memory consolidation must stay source-backed.
- `docs/11-migration-and-runtime-economics.md`: persona anchors and Soul Fork inheritance must preserve evidence references without inheriting live authority.
- `docs/09-computer-use-implementation.md`: child agents receive separate contracts, budgets, leases, and tainted completion evidence rather than inherited parent authority.
- `docs/13-schema-runtime-governance.md`: read-only audits may inspect artifacts but must not repair artifacts, mutate registries, or make artifacts authoritative.

Implemented correspondence:

- `auditLedgerPayloadRefs` now schema-validates Dream fold payload refs (`artifact://dream/run|accept|reject/<fold_id>`) as `memory-fold.schema.json`.
- Persona anchor payload refs (`artifact://anchors/propose|accept|reject/<anchor_id>`) now validate as `persona-anchor.schema.json`, and persona reset payload refs validate as `persona-reset.schema.json`.
- Soul Fork payload refs (`artifact://soul/fork/<fork_id>`) now validate as `soul-fork.schema.json`, preserving the no-live-authority inheritance contract at the audit layer.
- Child agent contract/start payload refs (`artifact://agent/contract/<contract_id>`) now validate as `agent-contract.schema.json`, and completed child result payload refs (`artifact://agent/execute/<child_result_id>`) validate as `child-result.schema.json`.
- The audit remains read-only and still reports unsupported generic artifacts as `schema_status=not_checked`.

Verification evidence:

- Harness payload-ref audit tests now cover valid Memory Fold, Persona Anchor, Persona Reset, Soul Fork, Agent Contract, and Child Result artifacts plus an invalid Persona Reset schema failure.
- TUI integration now runs `audit payload-refs` after real Dream fold, persona anchor/reset, Soul Fork, agent contract, child start, and child completion commands and asserts the relevant findings are schema-valid.

Correction and remaining boundary:

- This closes an audit coverage drift against the original Dreaming/persona/Soul/child-agent designs. It does not add any new runtime authority, background Dreaming loop, persona automation, Soul Fork execution, or general child-agent executor.
- Policy-denial and circuit-breaker payload refs needed a separate event/artifact binding pass; Phase 31 below closes that gap without broadening child-agent authority.

## Phase 31 Review Notes

Matched architecture docs:

- `docs/11-migration-and-runtime-economics.md`: exhaustion or violation should emit events and trigger circuit breakers.
- `docs/09-computer-use-implementation.md`: child runs receive separate budgets and leases, and child output or failure state remains evidence rather than authority.
- `docs/13-schema-runtime-governance.md`: `payload_ref` audit may inspect schema-backed evidence but must not repair artifacts or mutate registries.

Implemented correspondence:

- `agent.child.policy_denied` now writes a per-child-run Budget Account snapshot artifact under `.aetherion/artifacts/agent/execute/` and attaches that artifact through `payload_ref`.
- Repeated policy denial now appends an explicit `circuit.opened` Ledger event before blocking the child run, matching the other breaker paths for permission violation, budget exhaustion, timeout, and execution failure.
- `circuit.opened` events now point to deterministic Circuit Breaker artifact ids instead of the child run id, so the referenced artifact can be resolved and schema-validated.
- Agent contract, child result, policy-denial Budget Account, and Circuit Breaker evidence are now written explicitly to the matching `artifact://agent/...` paths instead of relying on command output persistence, and failure accounting/breaker objects no longer pollute the `child-results` projection.
- `auditLedgerPayloadRefs` now maps `agent.child.policy_denied` account refs to `budget-account.schema.json` and `circuit.opened` breaker refs to `circuit-breaker.schema.json`.

Verification evidence:

- Harness payload-ref audit tests now cover valid Budget Account and Circuit Breaker artifacts plus an invalid Circuit Breaker schema failure.
- TUI integration drives three real child policy denials, verifies all denial payload refs resolve as schema-valid Budget Account snapshots, verifies the hard-stop breaker event resolves as a schema-valid Circuit Breaker artifact, and checks `child-results` contains only the completed Child Result projection.

Correction and remaining boundary:

- This fixes dangling/misleading child-agent failure payload refs. It does not add queue/ask exhaustion behavior, general child-agent orchestration, automatic registry repair, or deterministic rebuild parity for Budget Account/Circuit Breaker registries.

## Phase 32 Review Notes

Matched architecture docs:

- `docs/05-audit-and-data-contracts.md`: replay records must identify the replay mode and remain trace/sandbox evidence rather than live side-effect replay.
- `docs/11-migration-and-runtime-economics.md`: Soul Fork inherits history references and approved memory, not live authority, and lifecycle artifacts keep JSON registries rebuildable.
- `docs/13-schema-runtime-governance.md`: registry entries and artifact refs are projections/evidence; existence alone must not be treated as authority.

Implemented correspondence:

- Soul Fork checkpoint replay records now set `artifact_ref` to the actual safe replay artifact path written under `.aetherion/artifacts/replay/<run_id>/`, instead of pointing at the checkpoint id while writing a differently named Replay Record artifact.
- The fork still remains non-executable and authority-free; this only tightens the evidence pointer used by registry provenance checks.

Verification evidence:

- TUI Soul Fork integration now reads the generated replay record, verifies its `artifact_ref` uses the replay artifact namespace, runs `audit registries`, and asserts the replay-record artifact ref exists and contains the matching item id.

Correction and remaining boundary:

- This closes a registry-artifact reference drift in the fork replay evidence path. It does not add deterministic replay-record repair, live replay, executable forks, or broader inheritance behavior.

## Phase 33 Review Notes

Matched architecture docs:

- `docs/11-migration-and-runtime-economics.md`: the first hibernation implementation should stop at deterministic eligibility and queueing, request a fresh Local Supervisor policy decision, append the policy decision and queue event, issue no lease, and execute no task action during wakeup evaluation.
- `docs/13-schema-runtime-governance.md`: P1 hibernation contracts must cite runtime evidence, and run manifest terminal status must not hide unprojected Ledger evidence.
- `docs/01-architecture.md`: proactive/resume behavior must preserve the Local Supervisor authority boundary rather than allowing triggers or projections to become authority.

Implemented correspondence:

- `wakeupQueueRunEventSequence()` now defines the explicit queue-only resume lifecycle as `policy.decided -> wakeup.queued`.
- The lifecycle requires both wakeup events to have no `payload_ref`, keeping hibernation queue evidence from masquerading as an artifact-backed authority grant.
- `ether wake` now completes its independent `run_resume_*` manifest through this explicit sequence guard and leaves the manifest `blocked`, matching the no-lease/no-action queue-only model.
- `docs/13-schema-runtime-governance.md` now moves queue-only hibernation resume runs out of the generic "own completion semantics" bucket and records the exact lifecycle contract.

Verification evidence:

- Harness tests reject wakeup manifests that attach a payload ref to `policy.decided`, reject wakeup manifests that include a `lease.issued` event, and accept the exact queue-only lifecycle as a blocked run.
- TUI integration asserts a real Rust-supervised `wake` run records only `policy.decided` and `wakeup.queued`, that both events omit `payload_ref`, and that no `lease.issued` event appears for the resume run.
- Harness and TUI tests tamper hibernation/wakeup registries and assert `audit hibernation-records` reports matched, mismatched, stale, invalid, and missing projection state from sleep/wake artifacts while preserving registry files unchanged and avoiding trigger evaluation.

Correction and remaining boundary:

- This closes the hibernation run-manifest lifecycle drift without adding a daemon, automatic file/deadline observation, live resume execution, or lease issuance.
- Hibernation records and wakeup triggers remain registries/projections, but they now have a scoped artifact-backed parity preview. Resume Context Pack deterministic rebuild/parity and automated registry repair remain future work.
- Later run families still need explicit lifecycle contracts before their terminal manifests can make stronger sequence claims; security scan, browser-observe, outbox, and the main child-read success/policy-denial lifecycle contracts are covered by later review notes.

## Phase 34 Review Notes

Matched architecture docs:

- `docs/01-architecture.md`: browser extension and browser operator surfaces are clients behind the Local Supervisor boundary, not authority roots.
- `docs/09-computer-use-implementation.md`: browser observations stay current-tab scoped, hash-only, tainted, and non-authorizing; real DOM/CDP collection and screenshot fallback remain future adapter work.
- `docs/13-schema-runtime-governance.md`: P1 surface contracts need source-backed runtime evidence, and terminal run manifests must not hide unprojected Ledger evidence.

Implemented correspondence:

- `browserObservationEventSequence()` now defines the explicit surface observation lifecycle as `policy.decided -> browser.observation.ingested`.
- The lifecycle requires the policy event to omit `payload_ref`, keeping the taint denial from masquerading as artifact-backed authority.
- The `browser.observation.ingested` event must bind to the observation artifact ref under `artifact://surface/browser-observe/<observation_id>`.
- `ether surface browser-observe` now completes its `run_surface_browser_*` manifest through this explicit sequence guard instead of generic manifest completion.

Verification evidence:

- Harness tests reject browser-observe manifests whose policy event has a `payload_ref`, whose observation event points at the wrong artifact ref, or whose lifecycle includes `lease.issued`.
- Harness tests accept only the exact `policy.decided -> browser.observation.ingested` sequence as a completed browser observation run.
- TUI integration asserts a real `surface browser-observe` command records exactly those two events, omits policy `payload_ref`, binds the observation artifact, issues no lease, and persists a completed manifest with matching Ledger event ids.

Correction and remaining boundary:

- This closes the browser-observe run-manifest lifecycle drift without adding real browser automation, extension capture, DOM/CDP access, screenshot fallback, data egress, or action authority.
- Browser observation artifacts remain evidence for audit and inspection only. They cannot authorize tool use or side effects.
- Other later run families still need explicit lifecycle contracts before their terminal manifests can make stronger sequence claims.

## Phase 35 Review Notes

Matched architecture docs:

- `docs/01-architecture.md`: IM is a client surface and cannot grant authority directly.
- `docs/02-user-boundary-layer.md`: remote channels and external content must not authorize sensitive actions or bypass the Tool Policy Proxy.
- `docs/13-schema-runtime-governance.md`: P1 surface contracts need source-backed runtime evidence, and terminal run manifests must not hide unprojected Ledger evidence.

Implemented correspondence:

- `imOutboxEventSequence()` now defines the explicit outbox lifecycle as `policy.decided -> im.outbox.queued`.
- The lifecycle requires the policy event to omit `payload_ref`, preserving the supervisor policy decision as no-lease/no-delivery evidence rather than artifact-backed authority.
- The `im.outbox.queued` event must bind to the outbox artifact ref under `artifact://surface/im-outbox/<item_id>`.
- `ether surface im-outbox` now completes its `run_surface_outbox_*` manifest through this explicit sequence guard. DM/group queued items still complete `blocked`; public sends blocked by policy still complete `completed`.

Verification evidence:

- Harness tests reject outbox manifests whose policy event has a `payload_ref`, whose queued event points at the wrong artifact ref, or whose lifecycle includes `lease.issued`.
- Harness tests accept only the exact `policy.decided -> im.outbox.queued` sequence, with `blocked` status for queued DM/group outbox records and `completed` status for policy-blocked public outbox records.
- TUI integration asserts real DM and public `surface im-outbox` commands record exactly those two events, omit policy `payload_ref`, bind outbox artifacts, issue no lease, and persist terminal manifests whose event ids match the Ledger.

Correction and remaining boundary:

- This closes the outbox run-manifest lifecycle drift without adding IM/email delivery, reusable approval, webhook handling, remote channel identity, or connector authority.
- Outbox artifacts remain queue/review evidence only. They do not send messages, grant a reusable permission, or authorize later side effects by themselves.
- Other later run families still need explicit lifecycle contracts before their terminal manifests can make stronger sequence claims.

## Phase 36 Review Notes

Matched architecture docs:

- `docs/01-architecture.md`: child clients and orchestrators cannot become trust roots; the Rust Local Supervisor owns policy and scoped leases.
- `docs/11-migration-and-runtime-economics.md`: child work needs independent run ids, budgets, circuit breakers, and completion evidence.
- `docs/13-schema-runtime-governance.md`: terminal run manifests must not hide unprojected Ledger evidence, and evidence artifacts must be bound at the projection boundary.

Implemented correspondence:

- `childReadCompletedEventSequence()` now defines the successful child document-read lifecycle as `agent.child.started -> tool.requested -> risk.composed -> policy.decided -> lease.issued -> tool.result -> agent.child.completed`.
- `childReadPolicyDeniedEventSequence()` now defines the denied child-read lifecycle as `agent.child.started -> tool.requested -> risk.composed -> policy.decided -> tool.result -> agent.child.policy_denied`, explicitly without `lease.issued`.
- `childReadRepeatedDenialEventSequence()` extends the denied lifecycle with `circuit.opened` for the third repeated policy denial.
- `childReadPreExecutionBreakerEventSequence()` defines permission-violation and execution-budget-exhausted breaker runs that fail before supervisor read execution as `agent.child.started -> circuit.opened`.
- The start event must bind to the Agent Contract artifact, successful completion must bind to the Child Result artifact, policy denial must bind to a Budget Account artifact snapshot, and repeated-denial or pre-supervisor breaker opening must bind to a Circuit Breaker artifact.
- `ether agent execute` now completes successful child reads, ordinary policy denials, repeated-denial breaker runs, and pre-supervisor permission/budget breaker runs through those explicit sequence guards. Timeout and supervisor execution-failure breaker paths kept their existing completion semantics at this point; Phase 37 adds an explicit observed-prefix lifecycle for those post-supervisor breaker cases.

Verification evidence:

- Harness tests reject successful child-read manifests missing `lease.issued`, reject child results with mismatched artifact refs, reject denied child-read manifests that include a lease, reject pre-supervisor breaker manifests with the wrong breaker artifact ref, and accept the exact success, policy-denial, repeated-denial, and pre-supervisor breaker lifecycles.
- TUI integration asserts a real successful `agent execute` child run records the exact success event sequence, binds the Agent Contract and Child Result artifacts, and leaves the supervisor-authored request/risk/policy/lease/result events payload-free.
- TUI integration asserts three real denied `agent execute` runs complete as blocked manifests, record the exact no-lease denial sequence, bind Budget Account artifacts, and add a Circuit Breaker artifact only on the repeated-denial run.
- TUI integration asserts real permission-violation and exhausted-budget child executions fail before supervisor read execution with blocked `agent.child.started -> circuit.opened` manifests, no tool request, no policy event, no lease, and no tool result.

Correction and remaining boundary:

- This closes the main child-read run-manifest lifecycle drift and the pre-supervisor breaker drift without adding general LLM orchestration, arbitrary Capsule execution, child writes, network tools, queue/ask exhaustion behavior, or exact supervisor-process CPU accounting.
- Child outputs remain tainted evidence and cannot authorize parent actions.
- Remaining child failure families that can occur after entering supervisor read execution, such as timeout and supervisor execution failure, still needed explicit lifecycle contracts before their terminal manifests could make stronger sequence claims; Phase 37 closes that specific observed-prefix projection gap.

## Phase 37 Review Notes

Matched architecture docs:

- `docs/09-computer-use-implementation.md`: child runs remain isolated work orders whose failures are evidence, not authority.
- `docs/11-migration-and-runtime-economics.md`: exhaustion and execution failure should emit circuit-breaker evidence with independent budgets.
- `docs/13-schema-runtime-governance.md`: terminal run manifests must not hide unprojected Ledger evidence, and runtime/projection evidence must not become authority by convenience.

Implemented correspondence:

- `childReadPostSupervisorBreakerEventSequence()` now defines post-supervisor breaker runs as `agent.child.started -> <observed supervisor child-read prefix> -> circuit.opened`.
- The observed supervisor prefix is constrained to valid child-read lifecycle prefixes: empty, request-only, request/risk, request/risk/policy, request/risk/policy/lease, full allowed read, or full denied read.
- `ether agent execute` now records any already-appended supervisor Ledger events for the child run before appending `circuit.opened` on timeout, supervisor execution failure, or runtime-accounting exhaustion.
- Runtime-accounting exhaustion after a successful supervisor read no longer leaves the supervisor-authored request/risk/policy/lease/result events unprojected when the child manifest is blocked by a breaker.

Verification evidence:

- Harness tests accept a blocked post-supervisor breaker manifest with a partial supervisor prefix and reject an invalid supervisor prefix.
- TUI integration uses a real Rust-supervised child read with a tight CPU budget to trigger a post-supervisor runtime-accounting breaker, then verifies the blocked manifest contains `agent.child.started -> tool.requested -> risk.composed -> policy.decided -> lease.issued -> tool.result -> circuit.opened`, with the start and breaker events bound to the Agent Contract and Circuit Breaker artifacts.

Correction and remaining boundary:

- This closes the post-supervisor child breaker manifest projection gap without adding a daemon, general LLM orchestration, arbitrary Capsule execution, child writes, network tools, queue/ask exhaustion behavior, or new schemas.
- Failed RPC responses still do not expose structured partial event ids; Ether reconstructs only events already durably present in the Ledger for that child run before opening the breaker.

## Phase 38 Review Notes

This pass implements the first real model invocation. Every prior phase scaffolded the Agent Orchestrator up to `agent.model.requested` without ever calling a model; this closes that gap while preserving the authority boundary.

Matched source docs:

- `docs/00-product-brief.md`: the target is a safe, auditable, self-improving agent runtime; V1 must prove the local loop before broad surfaces.
- `docs/01-architecture.md`: the Agent Orchestrator owns context assembly, planner, agent loop, and verifier; the Tool Access & Action Policy Proxy remains the only action choke point.
- `docs/02-user-boundary-layer.md`: external and model-derived content cannot authorize sensitive actions or bypass the Tool Policy Proxy.
- `docs/10-technical-strategy.md`: TypeScript may prototype the Agent Orchestrator while Rust remains the authority boundary; the model call is an orchestrator concern, not an authority grant.
- `docs/13-schema-runtime-governance.md`: model request/response artifacts record hashes only, keep credentials unresolved/unpersisted, and never let model output authorize actions.

Implemented correspondence:

- `packages/harness-core/src/model-provider.ts` adds a narrow model provider boundary with a deterministic offline stub (`provider_local_stub`, no network) and a real Anthropic Messages provider (`provider_anthropic`). `resolveModelProvider` selects by `AETHERION_MODEL_PROVIDER` (default stub) and reads `ANTHROPIC_API_KEY` only at call time, never returning or persisting it.
- `packages/harness-core/src/agent-runtime.ts` adds `createAgentModelResponseArtifact`, which builds a schema-valid `AgentModelResponseArtifact` recording hashes and usage only, with `model_invoked=true`, `provider_called=true`, `credential_resolved=false`, `raw_response_persisted=false`, `model_output_can_authorize_actions=false`, and `response_audit.passed=null`.
- `prompt invoke-model <request_id> --content <task>` re-renders the prompt through the same provenance-gated Context Pack path used by `prompt plan`/`bind-runtime`/`prepare-model-request`, asserts the re-rendered prompt bundle id, preview hash, and per-message hashes exactly match the bound Agent Model Request, then invokes the provider in-memory. Prompt drift, a missing request artifact, missing `agent.model.requested` Ledger evidence, and an already-recorded response all fail closed.
- The command persists only response hashes, records `agent.model.responded` in an independent single-event run bound to `artifact://agent/model-response/<response_id>`, leaves the source run unextended, prints the raw output on stdout, and appends no tool request, lease, or authority event.
- The local response audit is now persisted separately as `artifact://agent/response-audit/<audit_id>` and recorded in an independent `agent.response.audit.recorded` run. It stores response/request/runtime refs, response hashes, block/citation/forbidden-claim checks, findings, and next steps, while recording `audit_can_authorize_actions=false` and `audit_pass_is_runtime_verification=false`.
- `audit payload-refs` resolves and schema-validates both the response payload via `agent.model.responded -> agent-model-response.schema.json` and the response-audit payload via `agent.response.audit.recorded -> agent-response-audit.schema.json`.

Verification evidence:

- Harness tests cover the deterministic stub provider output and usage, `resolveModelProvider` env selection and unknown-provider rejection, the response artifact recording hashes only with `response_audit.passed=null`, response-audit artifact derivation from hash-only response metadata, schema validation, and payload-ref resolution for request/response/audit events.
- TUI integration drives the full `bind-runtime -> prepare-model-request -> invoke-model` chain with the stub provider, asserting hash-only response persistence (no raw output or prompt text in the artifact), the independent single-event `agent.model.responded` run, an independent single-event `agent.response.audit.recorded` run, an unextended source run, a passing persisted local response audit, schema-valid payload-ref resolution, prompt-drift fail-closed, and duplicate-response fail-closed.
- `npm test` (126 tests) and `cargo test` (39 tests, Rust unchanged) pass; clippy and fmt remain clean.

Correction and remaining boundary:

- This is a no-tools model invocation. Model output cannot authorize actions; turning an audited response into a `tool.requested` event still requires a dedicated supervisor path with policy and a scoped lease.
- The default provider is the offline stub. A live Anthropic call requires explicit opt-in via `AETHERION_MODEL_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`.
- The response audit is local output linting and is now persisted as its own governance artifact, but it is still not runtime verification, not policy approval, and not an authority grant. The response artifact still records `may_present_as_verified_runtime_evidence=false`.
- Raw model output is intentionally not persisted. A future increment needing durable output must define a separately governed, redaction-aware artifact rather than widening this contract.

## Phase 39 Review Notes

This pass persists the response-audit evidence that Phase 38 left on stdout. It is a runtime-evidence correction, not a new product surface.

Matched source docs:

- `docs/00-product-brief.md`: the project should deepen the auditable local runtime rather than add GUI, IM, browser, connector, or cloud surfaces.
- `docs/01-architecture.md`: Agent Orchestrator evidence remains separate from the Tool Access & Action Policy Proxy authority path.
- `docs/02-user-boundary-layer.md`: model-derived content and audit output cannot authorize sensitive reads, writes, egress, or side effects.
- `docs/05-audit-and-data-contracts.md`: durable evidence should be human-readable, payload-ref backed, and auditable without making projections the source of truth.
- `docs/13-schema-runtime-governance.md`: P1 runtime paths should close executable evidence gaps before widening schema/product surfaces.

Implemented correspondence:

- Added `agent-response-audit.schema.json` and an example contract for local response-audit records.
- Added `AgentResponseAuditArtifact` helpers in `packages/harness-core/src/agent-runtime.ts`, plus payload-ref schema mapping for `agent.response.audit.recorded`.
- Extended `prompt invoke-model` so the response audit becomes an independent single-event governance run after `agent.model.responded`.
- Kept the response artifact immutable and hash-only; the audit artifact references response hashes and stores audit checks, not raw model output or rendered prompt text.
- Added `audit response-audits` as a read-only evidence-chain audit for `agent.response.audit.recorded` events. It verifies matching runtime binding, model request, model response, response-audit artifact, response hashes, and completed single-event audit run manifests while reporting missing evidence, invalid artifacts, invalid manifests, or authority contamination.

Correction and remaining boundary:

- Corrects the Phase 38 drift where response audit was observable only on stdout while the runtime plan expected reviewable evidence.
- The audit still cannot authorize actions, cannot satisfy policy, cannot issue leases, and cannot be presented as runtime verification.
- No model-output-to-tool-request bridge exists yet; that next step must still enter a dedicated supervisor path.
- The response-audit evidence-chain audit is still a structural check, not semantic verification of model output or proof of task completion.

## Phase 40 Review Notes

This pass adds the first proposal-only bridge from audited model evidence toward a possible tool request. It intentionally stops before policy, lease, or execution.

Matched source docs:

- `docs/00-product-brief.md`: strengthens the auditable local runtime loop while staying away from deferred GUI, IM, browser, connector, and cloud surfaces.
- `docs/01-architecture.md`: preserves the split between Agent Orchestrator evidence and the Tool Access & Action Policy Proxy authority path.
- `docs/02-user-boundary-layer.md`: model-derived content and response audits cannot authorize sensitive reads, writes, egress, or side effects.
- `docs/05-audit-and-data-contracts.md`: durable proposal evidence is payload-ref backed and human-readable, but artifacts and projections are not authority.
- `docs/06-roadmap.md`: remains a TUI-first local kernel/orchestrator increment rather than a post-V1 connector or computer-use surface.
- `docs/10-technical-strategy.md`: keeps the bridge in TypeScript orchestration metadata; real action authority still belongs behind Rust supervisor policy and scoped leases.
- `docs/13-schema-runtime-governance.md`: closes a P1 runtime-evidence gap with tests instead of expanding speculative schemas.
- `docs/14-runtime-loop-plan.md`: follows the prior next step, defining a proposal path from audited model response evidence.

Implemented correspondence:

- Added `agent-tool-request-proposal.schema.json` plus an example contract. The proposal is limited to an operator-restated workspace file read preview.
- Added `agent.tool.request.proposed` to the Event schema and mapped `artifact://agent/tool-request-proposal/<proposal_id>` payload refs into `audit payload-refs` schema validation.
- Added harness helpers for proposal artifact ref creation, schema-validated write/read, and hash-bound proposal artifact creation from a passed response audit.
- Added `prompt propose-tool-request <response_audit_id> --path <workspace-file> --content <intent>`. It requires a passed Agent Response Audit, matched response-audit evidence, and a target path inside the workspace.
- The command records an independent single-event proposal run and keeps the source run, response run, and response-audit run unextended.

Verification evidence:

- Harness tests cover schema/example validation, proposal artifact derivation, explicit non-authority flags, read/write helpers, payload-ref schema validation, and absence of raw prompt/model text in the proposal artifact.
- TUI integration drives the full response-audit-to-proposal path and asserts path-escape rejection, `needs_revision` rejection, matched evidence requirements, a single `agent.tool.request.proposed` event, proposal manifest completion, schema-valid `audit payload-refs`, and no `tool.requested`, `policy.decided`, `lease.issued`, `tool.result`, action, observation, or verification event in the proposal run.

Correction and remaining boundary:

- Corrects the Phase 39 gap where the next step was only described as "model-output-to-tool-request bridge"; the implemented bridge is deliberately proposal-only and operator-restated.
- A proposal cannot authorize actions, satisfy policy, issue a lease, prove model output correctness, or reuse raw model output as a target. Turning it into a real read still requires a fresh Tool Policy Proxy path.
- Writes, external egress, connectors, browser actions, and side-effectful operations remain outside this proposal contract.

## Phase 41 Review Notes

This pass broadens the no-tools model provider boundary. It supports the requested OpenAI Responses, OpenAI completion-style chat, Anthropic, and Gemini API surfaces without changing the hash-only response artifact or creating OAuth connector authority.

Matched source docs:

- `docs/00-product-brief.md`: improves the local agent runtime instead of adding deferred GUI, IM, browser, connector, or cloud surfaces.
- `docs/01-architecture.md`: model provider calls stay in the Agent Orchestrator; Tool Access & Action Policy Proxy remains the only action choke point.
- `docs/02-user-boundary-layer.md`: provider credentials and model output cannot authorize reads, writes, egress, leases, or side effects.
- `docs/06-roadmap.md`: keeps OAuth/MCP/SaaS connectors deferred while allowing the TUI model-evidence path to call selected providers.
- `docs/10-technical-strategy.md`: TypeScript owns provider API iteration; Rust remains the authority boundary for policy, leases, and action evidence.
- `docs/13-schema-runtime-governance.md`: response metadata still records hashes and non-authority flags only, regardless of provider.

Implemented correspondence:

- `resolveModelProvider` now accepts `openai_responses`, `openai_chat_completions`, `anthropic`, and `gemini` plus conservative aliases such as `openai`, `openai_completion`, and `google_gemini`.
- Added OpenAI Responses support for `POST /v1/responses` with system/developer instructions, user input, `max_output_tokens`, `store=false`, and no tool declarations.
- Added OpenAI Chat Completions support for `POST /v1/chat/completions` with the existing role-ordered message array and `max_completion_tokens`.
- Kept Anthropic Messages support on the official direct API key path using `ANTHROPIC_API_KEY` and `x-api-key`.
- Added Gemini `generateContent` support with `systemInstruction`, user content, `generationConfig.maxOutputTokens`, API-key auth, and externally supplied Google/Gemini bearer-token auth.
- Updated TUI/help and README docs to list provider names and credential env vars while stating that Aetherion does not run OAuth flows or persist tokens. OpenAI and Gemini can consume externally supplied bearer tokens; Anthropic direct API remains API-key only.

Verification evidence:

- Harness tests mock `fetch` for all live providers and assert endpoint URLs, headers, request bodies, response mapping, provider aliases, and missing OpenAI credential failure without making network calls.
- The provider tests confirm supported externally supplied bearer tokens can be consumed without being written into artifacts, and that Anthropic uses `x-api-key` instead of a bearer token.

Correction and remaining boundary:

- Corrects the previous single-live-provider drift from the target Agent Orchestrator shape by making provider API choice an adapter concern.
- The OAuth part is deliberately limited: Aetherion accepts externally acquired bearer tokens only for provider paths that can use them, and does not implement three browser OAuth flows, account linking, token refresh, vault storage, or connector grants. Anthropic direct API OAuth is left out until there is an official API path to bind to.
- No provider tools, streaming, multimodal payloads, raw response persistence, or provider tool-call-to-action bridge exists yet.

## Phase 42 Review Notes

This pass adds Simplified Chinese companion documentation and language-switch links across the main documentation set without changing the English files' role as canonical governance sources.

Matched source docs:

- `README.md` and `docs/00-product-brief.md`: makes the product thesis and V1 boundary accessible in Chinese while preserving the "codename, not replacement OS" framing.
- `docs/01-architecture.md`: repeats that Local Supervisor and Tool Access & Action Policy Proxy remain the authority boundaries; translated docs do not introduce alternate architecture.
- `docs/05-audit-and-data-contracts.md`: keeps human-readable documentation as reviewable governance material, while making clear that indexes/projections remain rebuildable and non-authoritative.
- `docs/06-roadmap.md`: preserves TUI-first V1 scope and keeps GUI, IM, browser automation, MCP/OAuth connectors, and cloud workers deferred.
- `docs/12-phase-implementation-review.md`: records this pass as a documentation/governance accessibility increment rather than a runtime behavior change.
- `docs/13-schema-runtime-governance.md`: translated schema guidance repeats that schema, projection, fixture, client surface, model output, audit pass, and proposal artifacts are not authority.

Implemented correspondence:

- Added `.zh-CN.md` companion files for the root project docs, all `docs/00` through `docs/14` main design/review docs, package READMEs, and the Rust supervisor README.
- Added top-of-file language-switch links from each English original to its Chinese companion and from each Chinese companion back to the English original.
- Kept the MIT `LICENSE` English text as canonical while adding a clearly marked unofficial Chinese translation.
- Localized provider documentation without promising in-product OAuth flows, token storage, connector grants, or model-output authority.

Verification evidence:

- Checked that every English original in the localized set has a Chinese link in its opening lines.
- Checked that every `.zh-CN.md` companion has an English back-link in its opening lines.
- `git diff --check` remains clean after the documentation additions.

Correction and remaining boundary:

- Corrects the accessibility gap for Chinese-speaking contributors without changing source-of-truth precedence.
- The Chinese files are companion documentation, not independent governance forks. Future semantic changes should update the English canonical docs first or in parallel, then refresh the Chinese companions.
- Issue and PR templates remain English-only in this pass; they can be localized later if the project wants bilingual contribution intake forms.

## Phase 43 Review Notes

This pass closes a production-readiness gap exposed by a strict OpenClaw comparison: the repository had local verification commands but no repository-level CI gate proving them on push or pull request.

OpenClaw comparison evidence:

- OpenClaw's README advertises CI, releases, install/onboarding, update, security, channel, app/node, and docs entry points from the project front page (`https://github.com/openclaw/openclaw`, fetched 2026-06-11).
- OpenClaw's public CI workflow is a large routed matrix with preflight, platform lanes, docs-only routing, channel/plugin shards, build artifact lanes, and concurrency cancellation (`https://raw.githubusercontent.com/openclaw/openclaw/main/.github/workflows/ci.yml`, fetched 2026-06-11).
- OpenClaw's getting-started/onboarding docs present installer, daemon setup, gateway health, dashboard, first message, locale, provider auth, workspace, channel, daemon, and skills setup (`https://docs.openclaw.ai/start/getting-started`, `https://docs.openclaw.ai/start/wizard`, fetched 2026-06-11).
- OpenClaw's security docs include explicit trust-model scope, `openclaw security audit`, incident response, secret scanning, dependency lock, and file-operation hardening guidance (`https://docs.openclaw.ai/gateway/security`, fetched 2026-06-11).

Matched source docs:

- `docs/00-product-brief.md`: CI hardens the local-first auditable runtime path without adding deferred GUI, IM, browser, connector, or cloud worker execution.
- `docs/01-architecture.md`: repository CI is a verification surface, not an authority boundary; Local Supervisor and Tool Policy Proxy semantics are unchanged.
- `docs/05-audit-and-data-contracts.md`: keeps verification evidence reproducible through commands and reviewable workflow configuration.
- `docs/06-roadmap.md`: advances Phase 1/2 production discipline around the TUI/Rust kernel loop before broader surfaces.
- `docs/10-technical-strategy.md`: runs both TypeScript and Rust gates, preserving the TypeScript/Rust ownership split.
- `docs/13-schema-runtime-governance.md`: proves existing P0/P1 tests in automation instead of expanding schema surface area.

Implemented correspondence:

- Added `.github/workflows/ci.yml` with push/PR gates for `npm test`, `cargo test`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo fmt --check`, `git diff --check`, and a tracked `.aetherion`/`target` artifact guard.
- Added a CI badge to the English and Chinese READMEs.
- Updated English and Chinese contributing docs to tell contributors which local checks mirror CI.
- Hardened `callSupervisorRpc` process-failure diagnostics so a non-zero supervisor exit reports exit code, command, stdout line count, and empty/non-empty stderr state without echoing raw stdout payloads.

Verification evidence:

- Parsed the workflow YAML locally with Ruby's YAML loader.
- Re-ran the full local gate: `npm test` (130 passing), `cargo test` (39 Rust tests passing), `cargo clippy --all-targets --all-features -- -D warnings`, `cargo fmt --check`, `git diff --check`, and `git ls-files .aetherion target`.
- Added a regression test proving process failures no longer produce an empty `supervisor rpc failed:` message and do not leak raw stdout content into the thrown error.

Correction and remaining boundary:

- Corrects a repository-readiness drift: tests existed, but production review could not rely on automatic PR/push enforcement.
- Corrects an observed debugging gap where an intermittent supervisor process failure produced an empty stderr-only message, making CI failures hard to diagnose.
- This is still intentionally smaller than OpenClaw's CI/release system. Remaining production gaps include install/onboarding automation, daemon lifecycle commands, release packaging, channel/connector runtime, security audit command parity, dependency-lock/release reproducibility policy, platform matrices, and public docs deployment.
- CI does not grant runtime authority, execute external integrations, or make post-V1 surfaces active.

## Phase 44 Review Notes

This pass responds to the strict production-readiness review from two bounded subagents. The highest-risk findings were that Store Package signatures were self-authenticating because packages carried their own public key, Store install accepted self-reported replay/sandbox status, and live provider adapters had weak timeout and malformed-response boundaries.

Matched source docs:

- `docs/00-product-brief.md`: Capability Capsules are governed units of ability; generated or imported packages must not bypass tests, policy, or approval.
- `docs/01-architecture.md`: client surfaces and stores cannot become trust roots; Local Supervisor and Event Ledger remain the authority/fact layers.
- `docs/04-skill-and-scaffold-os.md`: generated package code and imported skills remain quarantined until policy, tests, sandbox, approval, and rollback gates pass.
- `docs/09-computer-use-implementation.md`: external content, packages, and surface observations are tainted/client-side inputs, not authorization.
- `docs/11-migration-and-runtime-economics.md`: future Capsule Store trust must be low-trust and governed, not a plugin free-for-all.
- `docs/13-schema-runtime-governance.md`: fixture data, projection rows, and schema validity are not runtime evidence.

Implemented correspondence:

- Added `StoreTrustedPublisher` records and `store trust-publisher`, so install signatures must bind to a locally enrolled publisher key fingerprint outside the package.
- `createCapsuleInstallRecord` now rejects unknown publishers, package signing keys that do not match the enrolled key, missing or mismatched Replay Records, live-side-effect replay evidence, sandbox path/hash mismatches, and Capsule integrity mismatches.
- `store install` now resolves replay claims from the local `replay-records` registry and reads the declared sandbox file to verify its SHA-256 before writing install projections.
- Capsule Install records now include `publisher_key_fingerprint`, `replay_record_ids`, and `sandbox_content_sha256`, making the install artifact evidence-bearing rather than boolean-only.
- Provider calls now use `AETHERION_MODEL_TIMEOUT_MS` with `AbortController`, fail with stable provider-scoped timeout/HTTP/malformed-JSON errors, and still avoid echoing raw provider response bodies.
- README, package docs, original source docs, schema governance, and Chinese companions were updated to link implementation tracking and describe trust-anchored Store install.

Verification evidence:

- Targeted related test run: `node --test packages/surface-os/test/surface-os.test.ts packages/harness-core/test/harness-core.test.ts packages/tui/test/tui.test.ts` passed 80 tests.
- New/updated tests reject unregistered Store publishers, package key substitution, missing replay evidence, sandbox hash mismatch, malformed provider JSON, HTTP error body leakage, and provider timeout.
- Full local gate passed after the changes: `npm test` (131 passing), `cargo test` (39 Rust tests passing), `cargo clippy --all-targets --all-features -- -D warnings`, `cargo fmt --check`, workflow YAML parsing, `git diff --check`, `git ls-files .aetherion target`, and a local Markdown link existence check.

Correction and remaining boundary:

- Corrects a real security drift from the Capsule Store idea: self-signed packages no longer prove publisher authenticity, and package-declared replay/sandbox status no longer substitutes for local evidence.
- Corrects provider operational risk without adding streaming, tool calls, connector grants, browser OAuth, token refresh, or vault storage.
- Store trust remains local-only. There is still no remote Capsule marketplace, transparency log, revocation feed, public publisher identity system, release evidence repository, or package-code execution path.

## Phase 45 Review Notes

This pass responds to the next strict production-readiness review: Aetherion had strong local evidence chains, but no single read-only operator readiness surface, and two projection paths still risked reporting or accepting reassuring state without first proving the Event Ledger fact layer.

Matched source docs:

- `docs/00-product-brief.md`: important actions must be reconstructable through logs, source references, decisions, approvals, and replay artifacts; this pass makes readiness and Store install depend on recorded evidence rather than projection comfort.
- `docs/01-architecture.md`: Local Supervisor remains root authority and Event Ledger remains the fact layer; client surfaces, stores, and projections cannot become trust roots.
- `docs/05-audit-and-data-contracts.md`: human-readable state is source of truth, while SQLite, registries, and other indexes are rebuildable projections.
- `docs/06-roadmap.md`: advances the TUI/Rust kernel loop toward production discipline before GUI, IM, browser automation, MCP/OAuth connectors, or cloud workers.
- `docs/10-technical-strategy.md`: keeps TypeScript on contract/TUI iteration and Rust on authority boundaries; this pass does not move Python or external tools into the authority path.
- `docs/13-schema-runtime-governance.md`: directly enforces "a projection is not a source of truth" and "a fixture is not runtime evidence."

Implemented correspondence:

- Added `ether doctor --workspace <path>` as a read-only production-readiness report. It checks repo governance files, bilingual docs links, CI/script/artifact-guard expectations, schema/example baselines, workspace identity, Event Ledger hash-chain validity, and run-manifest presence.
- `doctor` reports operator-level `ready`, `degraded`, or `blocked` plus per-check `pass`/`warn`/`fail`/`not_applicable` details. It does not initialize `.aetherion`, append events, mutate registries, write artifacts, call providers, issue leases, or repair state.
- All `audit *` topics now verify the workspace Event Ledger hash chain before provenance/parity work. A tampered Ledger fails closed with `broken_at=<event_id>` instead of allowing `strong` or `matched` reports over corrupted JSONL.
- `store install` no longer accepts `replay-records` registry rows as install evidence. It now resolves replay evidence from hash-chain-verified `replay.recorded` Ledger events and local Replay Record artifacts, then checks source events before passing evidence into Capsule Install validation.
- README, TUI README, Chinese companions, and command help now link the new operator surface back to the implementation tracking docs.

Verification evidence:

- Targeted TUI run: `node --test packages/tui/test/tui.test.ts` passed 32 tests.
- New tests cover `doctor` on an uninitialized workspace without creating `.aetherion`, `doctor` on an initialized workspace without mutating Ledger/run files, audit fail-closed behavior on a tampered Ledger hash chain, and Store rejection of registry-only fake replay evidence.

Corrections and remaining boundary:

- Corrects a production-readiness drift against OpenClaw-like operator surfaces: there is now a single machine-readable readiness report for current repo/workspace invariants.
- Corrects a trust-boundary drift where read-only audits and Store install could lean on unverified JSONL/projection state.
- This still does not add GUI, browser automation, IM delivery, MCP/OAuth connectors, daemon lifecycle start/stop/recover, package-code execution, cloud workers, or a remote marketplace.
- Remaining strict-review gaps include a first-class `ether security audit`, broader CI artifact leakage denylist, release/install/onboarding automation, platform/release matrix, dependency/reproducibility policy, and changing `prompt invoke-model` default stdout behavior away from raw model output.

## Phase 46 Review Notes

This pass closes the next security-readiness slice identified by the strict review: the repo needed a first-class read-only security audit, the CI artifact guard still used an inline partial denylist, and model invocation stdout exposed raw output by default.

Matched source docs:

- `docs/00-product-brief.md`: safety must be inspectable through auditable evidence, not through trust in agent output.
- `docs/01-architecture.md`: Local Supervisor remains root authority and Event Ledger remains the fact layer; the new audit inspects but does not grant or repair authority.
- `docs/05-audit-and-data-contracts.md`: generated runtime files, local vault-like roots, and artifacts must remain outside tracked governance sources unless intentionally promoted.
- `docs/06-roadmap.md`: this hardens the TUI-first V1 path before GUI, IM, browser automation, MCP/OAuth connectors, cloud workers, or package execution.
- `docs/13-schema-runtime-governance.md`: model output, audit pass, projection rows, and CI checks are not runtime authority.
- `docs/14-runtime-loop-plan.md`: this follows the planned read-only `ether security audit` increment and records the boundary in the original runtime plan.

Implemented correspondence:

- Added `ether security audit --workspace <path>` as a deterministic read-only JSON report over tracked secret material, tracked runtime/build artifact roots, raw sensitive fields in existing `.aetherion` artifacts, workspace Ledger hash-chain validity, CI guard wiring, and the model stdout default.
- Added `tools/forbidden-tracked-roots.txt` as the shared denylist for CI and `security audit`, extending coverage to `vault`, `memory-vault`, and `local-data` in addition to runtime/build/test/report roots.
- Changed `prompt invoke-model` default stdout to hash/metadata-only. Raw model output is available only through explicit `--print-output`, remains unpersisted, and cannot authorize tool requests or actions.
- Updated `doctor` to recognize the shared CI denylist, updated command help, and linked README/TUI/docs descriptions back to the implementation tracking docs.

Verification evidence:

- Targeted TUI run: `node --test --test-name-pattern "TUI help|TUI doctor|Ether security audit|TUI exposes local-only phase command surfaces" packages/tui/test/tui.test.ts` passed 6 tests.
- New/updated tests cover `security audit` on an uninitialized workspace without creating `.aetherion`, fail-closed audit reporting on a tampered Ledger hash chain, shared denylist evidence including sensitive local roots, default `prompt invoke-model` stdout omitting `output_text`, and `--print-output` opt-in behavior.

Corrections and remaining boundary:

- Corrects the OpenClaw-like security audit parity gap without adding a repair tool, dependency scanner, live connector probe, package sandbox, OAuth flow, or secret vault.
- Corrects a raw-output leakage risk in local/operator stdout defaults while preserving explicit local operator access for debugging.
- This still does not add GUI, browser automation, IM delivery, MCP/OAuth connectors, daemon lifecycle start/stop/recover, package-code execution, cloud workers, or a remote marketplace.
- Remaining strict-review gaps include install/onboarding automation, release packaging, platform/release matrix, dependency/reproducibility policy, public docs deployment, and deeper dependency audit evidence.

## Phase 47 Review Notes

This pass closes the dependency/reproducibility evidence gap raised by the strict OpenClaw comparison and the two bounded subagent reviews. Before this pass, the root Node surface had no lockfile, `npm audit` failed with `ENOLOCK`, Cargo commands did not use `--locked`, and CI did not exercise the operator readiness snapshots it documented.

Matched source docs:

- [Product Brief](00-product-brief.md): important actions and release posture should be reconstructable from durable evidence.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): verification evidence should be reproducible through human-readable state and reviewable workflow configuration.
- [Roadmap](06-roadmap.md): production discipline must improve around the TUI/Rust loop before broader GUI, IM, browser, connector, cloud, or platform-matrix surfaces.
- [Schema Runtime Governance](13-schema-runtime-governance.md): dependency/audit results are repo readiness evidence, not runtime authority or policy decisions.
- [Runtime Loop Plan](14-runtime-loop-plan.md): this follows the remaining dependency/reproducibility gap after the security-audit increment.

Implemented correspondence:

- Added a committed root `package-lock.json`, making `npm ci --ignore-scripts` and `npm audit --audit-level=high --json` reproducible from the repository even with zero root npm dependencies.
- Changed Rust scripts/docs/CI gates to use `cargo test --locked` and `cargo clippy --all-targets --all-features --locked -- -D warnings`.
- CI now installs pinned `cargo-audit` with `--locked`, runs `cargo audit`, and runs `npm run ether -- doctor --workspace .` plus `npm run ether -- security audit --workspace .` as operator readiness snapshots.
- `doctor` now reports dependency lockfile state and requires the CI dependency/readiness gates.
- `security audit` now reports dependency reproducibility and CI dependency/readiness guard findings if lockfiles or workflow gates drift.
- README, CONTRIBUTING, TUI README, and Chinese companions document the current zero-root-JS-dependency state, lockfile policy, locked Rust commands, and `promo/` release-evidence exclusion.

Verification evidence:

- `npm ci --ignore-scripts` succeeds from the committed lockfile.
- `npm audit --audit-level=high --json` reports 0 vulnerabilities.
- Targeted TUI doctor/security tests assert the dependency lockfile and CI dependency/readiness checks.

Corrections and remaining boundary:

- Corrects the root Node `ENOLOCK` audit gap and the unlocked Cargo command drift without adding npm runtime dependencies.
- Corrects the documentation/CI gap where `doctor` and `security audit` existed but were not run as release evidence.
- This still does not add release packaging, artifact signing, update infrastructure, platform matrix execution, public docs deployment, dependency auto-remediation, GUI, browser automation, IM delivery, MCP/OAuth connectors, package-code execution, cloud workers, or a remote marketplace.
- Remaining strict-review gaps include install/onboarding automation, release packaging, platform/release matrix, public docs deployment, and deeper release artifact evidence.

## Phase 48 Review Notes

This pass closes a narrow CI/release-evidence drift exposed by the previous green remote run: GitHub Actions completed, but emitted a Node.js 20 JavaScript action-runtime deprecation annotation, and the repo still had no cross-platform smoke lane. That left Aetherion short of the platform/release evidence called out in the strict OpenClaw comparison.

Matched source docs:

- [Product Brief](00-product-brief.md): readiness claims should remain grounded in durable, reviewable evidence rather than local-only success.
- [Roadmap](06-roadmap.md): production discipline should expand around the TUI/Rust loop before deferred GUI, IM, browser, connector, cloud, or marketplace surfaces.
- [Runtime Loop Plan](14-runtime-loop-plan.md): this follows the remaining platform matrix and release-evidence gap after dependency reproducibility was closed.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): CI workflow configuration is human-readable evidence that can be reviewed and replayed.

Implemented correspondence:

- CI uses `actions/checkout@v5` and `actions/setup-node@v5`, keeps `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` as an explicit runtime baseline, and disables setup-node package-manager auto-cache with `package-manager-cache=false`.
- CI adds a `platform-smoke` job over `ubuntu-latest` and `macos-latest`.
- The platform smoke lane runs `npm ci --ignore-scripts`, a focused contract/provider/TUI-help Node test subset, `cargo test --locked`, `npm run ether -- doctor --workspace .`, and `npm run ether -- security audit --workspace .`.
- `doctor` and `security audit` now require the Node 24 action-runtime baseline and platform-smoke evidence in `.github/workflows/ci.yml`.
- README, CONTRIBUTING, TUI README, and Chinese companions describe the platform-smoke and action-runtime evidence.

Verification evidence:

- Workflow YAML parses locally.
- Targeted TUI doctor/security tests assert platform-smoke and Node 24 action-runtime evidence.
- Markdown relative-link verification covers the new links.

Corrections and remaining boundary:

- Corrects the CI/release-evidence drift without adding release packaging, artifact signing, public docs deployment, installer/updater infrastructure, or real platform packages.
- The macOS/Ubuntu lane is a smoke matrix, not a full OpenClaw-class platform/release matrix.
- This still does not enable GUI, browser automation, IM delivery, MCP/OAuth connectors, package-code execution, cloud workers, or a remote marketplace.
- Remaining strict-review gaps include install/onboarding automation, release packaging, deeper release artifact evidence, public docs deployment, and a broader platform/release matrix.

## Phase 49 Review Notes

This pass closes a no-tools provider-boundary drift raised by the bounded security review. Aetherion already supported OpenAI Responses, OpenAI Chat Completions, Anthropic Messages, and Gemini `generateContent`, but provider tool/function-call outputs were only represented as metadata. A strict no-tools runtime should reject those outputs before writing successful model-response or response-audit evidence.

Matched source docs:

- [Schema Runtime Governance](13-schema-runtime-governance.md): model output cannot authorize actions, append tool request events, issue leases, or trigger side effects.
- [Runtime Loop Plan](14-runtime-loop-plan.md): provider hardening remains no-tools and hash-only, without OAuth flows, connector grants, provider tools, or side effects.
- [Roadmap](06-roadmap.md): keeps OAuth/MCP/SaaS connectors deferred while allowing the TUI model-evidence path to call selected providers.
- [User Boundary Layer](02-user-boundary-layer.md): untrusted/model-derived content must not cross into action authority without policy.

Implemented correspondence:

- Live providers now fail closed if mapped output contains a tool/function call or executable-code shape.
- Covered shapes include OpenAI Responses call-type output, OpenAI Chat Completions `tool_calls`, Anthropic `tool_use`, and Gemini `functionCall`/`executableCode`.
- The fail-closed check occurs inside the provider boundary, before `prompt invoke-model` can write hash-only response evidence or local response-audit evidence.
- Docs clarify that `openai_chat_completions` is the supported OpenAI completion-style surface, not a legacy `/v1/completions` implementation.
- OAuth remains limited to externally acquired bearer-token env vars for provider paths that support them; Aetherion still does not run OAuth, persist tokens, refresh grants, or create connector authority.

Verification evidence:

- Provider unit tests simulate all four tool-call output families and assert no-tools failure.
- Existing provider tests still verify endpoint, header, body, credential, timeout, HTTP error, and malformed JSON behavior.

Corrections and remaining boundary:

- Corrects no-tools from a descriptive metadata flag into an enforced provider boundary for live model calls.
- This still does not add streaming, multimodal payloads, provider tool execution, browser OAuth, token refresh, vault storage, connector grants, or live-provider CI probes.
- Remaining provider hardening gaps include optional live contract probes, richer provider refusal taxonomy, and explicit CI guards against accidental `--print-output` use in workflows.

## Phase 50 Review Notes

This pass closes the next narrow release-evidence gap: `doctor` and `security audit` were already machine-readable, but operators still lacked one local snapshot that showed git state, CI configuration, dependency reproducibility, governance/docs posture, runtime readiness, security posture, source-doc grounding, and remaining release gaps together.

Matched source docs:

- [Product Brief](00-product-brief.md): release/readiness claims should be grounded in durable, reviewable evidence instead of one-off local memory.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): workflow, lockfile, governance, and Ledger state remain human-readable or rebuildable evidence, not opaque generated authority.
- [Roadmap](06-roadmap.md): the increment stays inside the TUI-first kernel loop and does not enter GUI, IM, browser, MCP/OAuth connector, cloud, marketplace, or release-packaging scope.
- [Schema Runtime Governance](13-schema-runtime-governance.md): evidence aggregation does not become runtime authority, a lease, policy approval, or a new trust root.
- [Runtime Loop Plan](14-runtime-loop-plan.md): this implements the planned local/configured release-evidence snapshot.

Implemented correspondence:

- Added `npm run ether -- release evidence --workspace <path>`.
- The report includes git branch/head/dirty state, configured CI gate drift, Node 24 action-runtime evidence, Ubuntu/macOS platform-smoke configuration, dependency lockfile evidence, governance-file evidence, bilingual-doc evidence, `doctor` summary, `security audit` summary, workspace runtime/Ledger state, source-document links, and explicit remaining release gaps.
- The report distinguishes local/configured evidence from remote/executed proof with `checks_remote_ci=false`, `remote_ci_checked=false`, `packaged=false`, `signed=false`, and `published=false`.
- CI now runs `release evidence` beside `doctor` and `security audit`; the CI gate checks require all three operator snapshots.
- README, CONTRIBUTING, TUI README, and Chinese companions link the new command and its boundaries.

Verification evidence:

- Targeted TUI tests cover help text, empty-workspace read-only behavior, initialized-workspace no-mutation behavior, and existing doctor/security snapshots.
- The release report records dirty worktree state without treating unrelated local files as a remote release failure.

Corrections and remaining boundary:

- Corrects the single-snapshot release-evidence gap without adding release packaging, artifact signing, public docs deployment, package publication, installer/updater infrastructure, remote CI querying, or a release evidence repository.
- `release evidence` is local/configured source evidence only; it must not be described as proof that the latest GitHub Actions run succeeded unless an external remote check is separately performed.
- This still does not enable GUI, browser automation, IM delivery, MCP/OAuth connectors, package-code execution, cloud workers, or a remote marketplace.
- Remaining strict-review gaps include install/onboarding automation, release packaging, artifact signing, public docs deployment, broader platform/release matrix artifacts, and remote/executed release evidence.

## Phase 51 Review Notes

This pass reduces the next guided-onboarding gap without pretending Aetherion has an installer. After release evidence, a fresh clone could prove repo readiness but still lacked a single command that answered: "Can this local machine start from source safely, and what should I run next?"

Matched source docs:

- [Product Brief](00-product-brief.md): onboarding remains local-first and evidence-backed, not an account-linking or cloud bootstrap.
- [Roadmap](06-roadmap.md): the work stays in the V1 terminal/kernel path and does not add GUI, IM, browser, MCP/OAuth connectors, cloud workers, or release packaging.
- [Technical Strategy](10-technical-strategy.md): TypeScript remains the right surface for contract/TUI iteration; Rust remains reserved for supervisor authority boundaries.
- [Runtime Loop Plan](14-runtime-loop-plan.md): this implements the planned from-source onboarding preflight slice.

Implemented correspondence:

- Added `npm run ether -- onboarding check --workspace <path>`.
- The report distinguishes `toolchain_ready`, `repo_ready`, `workspace_runtime_state`, and `next_steps_ready`.
- It checks Node, npm, git, rustc, cargo, optional cargo-audit, repo scripts, dependency lockfiles, CI gates, governance files, bilingual docs, onboarding doc links, and workspace runtime state.
- A missing `.aetherion` directory is treated as `not_initialized`, not as broken state.
- The command prints next-step commands but does not run them.
- CI now runs `onboarding check` with the existing operator snapshots.
- README, CONTRIBUTING, TUI README, and Chinese companions link the command and its read-only boundary.

Verification evidence:

- Targeted TUI tests cover help text, fresh-clone onboarding, initialized workspace no-mutation behavior, and missing local toolchain failure reporting.

Corrections and remaining boundary:

- Corrects the from-source onboarding preflight gap without adding installer/updater automation, package installation, daemon lifecycle commands, provider auth wizard, connector account linking, public docs deployment, release packaging, artifact signing, or remote CI querying.
- This still does not enable GUI, browser automation, IM delivery, MCP/OAuth connectors, package-code execution, cloud workers, or a remote marketplace.
- Remaining strict-review gaps include real installer/updater automation, release packaging, artifact signing, public docs deployment, broader platform/release matrix artifacts, and remote/executed release evidence.

## Phase 52 Review Notes

This pass closes a source-document discoverability gap: the governance files existed and operator snapshots checked for them, but the original product/source documents did not yet give maintainers a direct path from concept docs to contribution, conduct, security, licensing, issue, and pull-request workflow contracts.

Matched source docs:

- [Product Brief](00-product-brief.md): collaboration surfaces should support local-first governance and project clarity without becoming runtime authority.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): human-readable workflow documents and GitHub templates are reviewable governance artifacts, not opaque generated state.
- [Roadmap](06-roadmap.md): Phase 0 foundation documents now point to the contribution and review gates needed before broader product surfaces expand.
- [Technical Strategy](10-technical-strategy.md): this is a documentation/source-link increment only; it does not alter TypeScript/Rust authority ownership.
- [Schema Runtime Governance](13-schema-runtime-governance.md): governance docs and templates remain human contracts; they do not grant leases, policy approval, provider credentials, or runtime authority.

Implemented correspondence:

- Added a root README governance section linking Code of Conduct, Contributing, Security Policy, MIT License, issue templates, and the pull request template, with Chinese companions where they exist.
- Added matching governance-link rows and README operator/readiness hub links to the original source documents and their Chinese versions: product brief, audit/data contracts, roadmap, technical strategy, and schema runtime governance.
- Kept links as repo-relative Markdown references so they are visible in local clones and on GitHub.

Verification evidence:

- Markdown relative-link verification covers the new source-document links.
- Operator snapshots still check governance-file presence and bilingual documentation posture.

Corrections and remaining boundary:

- Corrects a documentation navigation gap only; it does not add a new workflow engine, issue triage bot, private security intake backend, release automation, or runtime policy mechanism.
- This still does not enable GUI, browser automation, IM delivery, MCP/OAuth connectors, package-code execution, cloud workers, or a remote marketplace.
- Remaining strict-review gaps include installer/updater automation, release packaging, artifact signing, public docs deployment, broader platform/release matrix artifacts, and remote/executed release evidence.

## Phase 53 Review Notes

This pass fixes a CI-discovered supervisor RPC client failure mode. The process-failure test expected a non-zero supervisor subprocess exit to be reported through the safe process-failure summary, but GitHub Actions could surface an early stdin `EPIPE` before the close handler produced that summary.

Matched source docs:

- [Technical Strategy](10-technical-strategy.md): the TypeScript supervisor client must accept evidence only through the structured RPC boundary and fail closed on malformed or failed supervisor processes.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): failure reports must remain reconstructable without leaking raw stdout payloads.
- [Schema Runtime Governance](13-schema-runtime-governance.md): supervisor/client failure handling is runtime-boundary hardening, not a new feature or authority path.

Implemented correspondence:

- `callSupervisorRpc` now attaches stdin `error` and `close` listeners before writing the request.
- Early stdin write errors are captured instead of escaping as raw stream errors.
- Non-zero supervisor exits still use the existing sanitized process-failure summary, including stdout line count but not stdout contents.

Verification evidence:

- Targeted Node test covers `supervisor RPC client reports process failures without raw stdout leakage`.
- Full local verification is required before committing this fix.

Corrections and remaining boundary:

- Corrects a cross-platform/race-sensitive RPC client error-normalization gap; it does not change supervisor policy, leases, action execution, raw stdout persistence, or socket RPC semantics.
- This still does not enable GUI, browser automation, IM delivery, MCP/OAuth connectors, package-code execution, cloud workers, or a remote marketplace.

## Phase 54 Review Notes

This pass starts the PGC-1 release/readiness evidence work from the local `$plan` handoff in `.omx/plans/aetherion-production-gap-closure-plan.md`. The prior release snapshot separated local configured evidence from executed proof only by saying `checks_remote_ci=false`; it had no schema-locked release manifest and no place to ingest operator-observed CI/CodeQL status.

Matched source docs:

- [Production Gap Closure Plan](15-production-gap-closure-plan.md): PGC-1 calls for remote CI/CodeQL evidence and a release manifest schema before deeper packaging/release automation.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): evidence records must remain reviewable and separate from runtime authority.
- [Roadmap](06-roadmap.md): the work stays in the V1 TUI/readiness lane and does not add GUI, IM, browser automation, MCP/OAuth connectors, cloud workers, or package-code execution.
- [Schema Runtime Governance](13-schema-runtime-governance.md): schema changes are justified by a runtime/readiness command path, not by speculative surface expansion.

Implemented correspondence:

- `release evidence` now accepts `--remote-evidence <snapshot.json>` and reads only a workspace-local operator-supplied CI/CodeQL snapshot.
- The report now includes `remote_observed_evidence` next to `configured_evidence`, plus `remote_ci_status`, `remote_codeql_status`, and `commit_matches_head`.
- Missing remote evidence makes the release report `draft`; invalid remote evidence, failed CI/CodeQL, or commit mismatch blocks the release report.
- Added `schemas/release-manifest.schema.json` and `examples/contracts/release-manifest.json`.
- README and TUI README now document the optional snapshot and state that the command never live-queries remote CI.

Verification evidence:

- Focused tests passed: `node --test --test-name-pattern "release evidence|contract examples" packages/tui/test/tui.test.ts packages/harness-core/test/harness-core.test.ts`.
- Full verification passed after the final help-test wording update: `npm test` (143 passing), focused supervisor/TUI stability loop 5/5 passing, `cargo test --locked` (39 Rust tests passing), `cargo clippy --all-targets --all-features --locked -- -D warnings`, `cargo fmt --check`, `git diff --check`, `npm audit --audit-level=high --json` with 0 vulnerabilities, `doctor` ready, `security audit` pass, and `release evidence` draft because local changes and remote evidence are intentionally not yet committed/provided.

Drift review:

- Corrects the PGC-1 release-evidence gap without adding a live GitHub client, release package, signature, public docs deployment, installer/updater, or release evidence repository.
- A strict source-doc review found a separate scope drift: the default CLI already exposes many post-V1 contract/runtime lab commands. They remain mostly non-authorizing, but the next slice should add a V1 Core Profile Gate so V1 release readiness cannot be confused with post-V1 surface breadth.

Corrections and remaining boundary:

- Remote evidence is an operator-supplied snapshot, not live remote attestation.
- Release Manifest is a contract/example baseline, not a generated signed release artifact.
- Remaining strict-review gaps include V1 Core Profile Gate, live remote CI/CodeQL reader, release packaging, artifact signing, public docs deployment, installer/updater automation, broader platform/release matrix artifacts, and deeper supervisor/vault/ingress lifecycle work.

## Phase 55 Review Notes

This pass follows the strict source-document drift review from the previous round. The repo already labeled later commands as post-V1 in prose, but `onboarding check` and `release evidence` did not expose a machine-readable V1 boundary, and help tests did not prove that the V1 core section excluded post-V1 labs.

Matched source docs:

- [Product Brief](00-product-brief.md): V1 is TUI-first and later GUI, IM, browser, connector, cloud, and package-code surfaces remain deferred.
- [Roadmap](06-roadmap.md): the first runnable product is the local kernel loop plus readiness evidence, not the whole trace-backed lab surface.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): production-parity pressure must not cause V1 surface creep.

Implemented correspondence:

- Added `v1_core_profile` to `onboarding check` and `release evidence`.
- The profile separates V1 release-critical product commands from release-supporting readiness commands and post-V1 contract/surface labs.
- `security audit` is explicitly release-supporting evidence, not a V1 core product command.
- `release evidence` blocks if a future edit causes V1 release-critical commands to overlap post-V1 labs.
- Help text now labels the later command block as "Post-V1 / experimental local contract labs (not V1 release-critical)".
- Help tests now slice the V1 core section and assert post-V1 command families are absent from that section.

Verification evidence:

- Focused test passed: `node --test --test-name-pattern "help separates|onboarding check reports fresh|release evidence reports" packages/tui/test/tui.test.ts`.
- Full verification passed: `npm test` (143 passing), `cargo test --locked` (39 Rust tests passing), `cargo clippy --all-targets --all-features --locked -- -D warnings`, `cargo fmt --check`, `git diff --check`, `npm audit --audit-level=high --json` with 0 vulnerabilities, `doctor` ready, `security audit` pass, `release evidence` draft with `v1_core_profile.status=pass`, and forbidden tracked roots check clean.

Drift review:

- Corrects the documented drift where post-V1 contract/runtime labs were visible in the default CLI surface and could be mistaken for V1 release scope.
- Does not reduce the importance of the deeper PGC-2/PGC-3 authority work: supervisor lifecycle, vault refs, and local ingress remain open.

Corrections and remaining boundary:

- This is not a new runtime ability, daemon, vault, ingress gateway, packaging system, signing path, or deployment path.
- Remaining strict-review gaps include live remote CI/CodeQL reader, release packaging, artifact signing, public docs deployment, installer/updater automation, broader projection parity coverage, and deeper supervisor/vault/ingress lifecycle work.

## Phase 56 Review Notes

This pass starts the vault portion of PGC-2 without implementing a vault backend. The goal is to make credential material referenceable and auditable as metadata only, so future policy/vault work has a contract while current reports cannot imply raw-secret storage, OAuth, token refresh, or connector grants exist.

Matched source docs:

- [Technical Strategy](10-technical-strategy.md): Rust should eventually own vault and authority boundaries; this pass keeps TypeScript limited to contract/readiness inspection.
- [Schema Runtime Governance](13-schema-runtime-governance.md): new schema surface must have a runtime tier and negative tests for raw secrets or inherited authority.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): PGC-2 calls for vault/secret reference MVP before real OAuth or connector use.
- [Roadmap](06-roadmap.md): MCP/OAuth/SaaS connectors remain deferred from V1.

Implemented correspondence:

- Added `schemas/vault-reference.schema.json` and `examples/contracts/vault-reference.json` as a metadata-only contract.
- Added the schema/example to the existing contract validation suite.
- Added a negative schema test that rejects raw secret material, raw-secret availability to Aetherion, completed OAuth-flow claims, connector-grant claims, and extra raw-secret fields.
- `doctor`, `onboarding check`, and `release evidence` now include `vault_reference_contract` readiness evidence.
- README, package docs, and schema governance docs now describe Vault Reference as metadata-only readiness evidence, not a vault backend.

Drift review:

- Corrects a potential schema-governance drift by assigning `vault-reference` to the P1 readiness/credential-boundary metadata tier.
- Corrects a production-readiness gap by making reports check for a reference-only credential contract before real OAuth/connector work starts.
- No GUI, browser automation, IM delivery, MCP/OAuth connector, cloud worker, package execution, raw secret persistence, token refresh, or connector grant was added.

Corrections and remaining boundary:

- This is not a production vault, OS keychain integration, secret retrieval API, OAuth flow, token refresh path, connector grant lifecycle, policy lease, or runtime authority grant.
- Remaining strict-review gaps include supervisor lifecycle/vault binding design, local ingress, live remote CI/CodeQL observation, release packaging, artifact signing, public docs deployment, installer/updater automation, and broader projection parity coverage.

## Phase 57 Review Notes

This pass follows the user-requested provider-support gap without expanding connector authority. The runtime code already had no-tools providers for OpenAI Responses, OpenAI Chat Completions, Anthropic Messages, and Gemini `generateContent`, but release/readiness evidence did not yet expose that boundary as a schema-checked contract.

Matched source docs:

- [Architecture](01-architecture.md): model provider calls stay inside the Agent Orchestrator evidence path; Connector Adapters and the Tool Access & Action Policy Proxy remain separate authority surfaces.
- [Schema Runtime Governance](13-schema-runtime-governance.md): readiness schemas must have negative tests for raw payloads, provider tool-call authority, and OAuth/connector overclaiming.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): PGC-2 needs credential/provider boundaries before real OAuth or connector grants.
- [Roadmap](06-roadmap.md): OpenAI/Anthropic/Gemini provider portability stays in the TUI-first evidence loop; MCP/OAuth/SaaS connectors remain deferred from V1.

Implemented correspondence:

- Added `schemas/model-provider-readiness.schema.json` and `examples/contracts/model-provider-readiness.json`.
- The contract names `openai_responses`, `openai_chat_completions`, `anthropic`, and `gemini`, including allowed API-key env vars and externally supplied bearer-token env vars where current provider code supports them.
- The contract explicitly marks OAuth flows, token refresh, connector grants, streaming, multimodal payloads, and legacy OpenAI `/v1/completions` as unimplemented.
- Added a negative schema test rejecting OAuth-flow, connector-grant, raw prompt/model payload, provider tool declaration, tool-call response persistence, and model-output authority drift.
- `doctor`, `onboarding check`, and `release evidence` now include `model_provider_readiness_contract` evidence alongside Vault Reference evidence.
- README, TUI README, harness-core README, schema governance, and runtime-loop docs now clarify that OpenAI completion support means Chat Completions, not legacy text completions.

Drift review:

- Corrects a readiness-evidence drift: provider support was implemented in code and tests but not represented as a machine-readable release/readiness contract.
- Corrects a terminology drift risk from "OpenAI completion" by naming the supported surface as OpenAI Chat Completions.
- Does not implement browser OAuth, provider auth wizards, token refresh, connector account linking, MCP/OAuth/SaaS connectors, streaming, multimodal provider payloads, provider tool execution, or runtime authority grants.

Corrections and remaining boundary:

- Model Provider Readiness is a P1 readiness/credential-boundary metadata contract, not a credential store, OAuth client, connector grant, or policy lease.
- Remaining strict-review gaps include supervisor lifecycle/vault reference binding design, local ingress, live remote CI/CodeQL observation, release packaging, artifact signing, public docs deployment, installer/updater automation, broader projection parity coverage, and future connector OAuth work behind policy.

## Phase 58 Review Notes

This pass continues PGC-2 by making the current supervisor lifecycle boundary reviewable and release-checkable. The repo already had read-only `supervisor status` and `supervisor preflight`, foreground Unix socket binding, runtime-lock observation, stale-lock detection, and tests that these paths do not append Ledger events. The missing piece was a schema-checked readiness contract proving that this is not yet production daemon lifecycle management.

Matched source docs:

- [Architecture](01-architecture.md): Local Supervisor remains the root authority, but readiness metadata and runtime locks cannot authorize actions.
- [Technical Strategy](10-technical-strategy.md): Rust owns the future supervisor/vault/daemon authority boundary; TypeScript readiness reports should inspect evidence without becoming authority.
- [Schema Runtime Governance](13-schema-runtime-governance.md): readiness schemas must be tiered and must reject authority, repair, vault, and daemon overclaims.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): PGC-2 calls for typed lifecycle contracts for status/start/stop/recover-stale-lock before broadening daemon behavior.

Implemented correspondence:

- Added `schemas/supervisor-lifecycle-readiness.schema.json` and `examples/contracts/supervisor-lifecycle-readiness.json`.
- The contract names current supported evidence: stdio RPC, foreground Unix socket mode, foreground workspace runtime lock, read-only `supervisor status`, and read-only `supervisor preflight`.
- The contract explicitly marks production daemon, service installation, background process manager, `supervisor start`, `supervisor stop`, `supervisor recover-stale-lock`, socket-auth lifecycle, vault backend, signer, process sandbox, cloud worker, stale-lock repair, runtime-lock authority, socket-token tool authority, and supervisor lease issuance as unimplemented.
- Added a negative schema test rejecting daemon, stale-lock repair, socket-auth persistence/vault backing, raw socket auth token fields, raw supervisor secret availability, vault retrieval, socket-token authority, lifecycle lease authority, and vault-backend overclaims.
- `doctor`, `onboarding check`, and `release evidence` now include `supervisor_lifecycle_readiness_contract` evidence alongside Model Provider and Vault Reference readiness.
- README, TUI README, harness-core README, supervisor README, schema governance, and runtime-loop docs were updated in English and Chinese.

Drift review:

- Corrects a PGC-2 readiness drift: supervisor lifecycle behavior existed as status/preflight code and tests, but production reports could not separately prove the unsupported daemon/recovery/vault boundary.
- Corrects a lifecycle terminology drift risk where foreground socket/runtime-lock evidence could be mistaken for service installation, process management, crash recovery, or stale-lock repair.
- Does not implement production daemon start/stop, service install, stale-lock recovery, crash recovery, socket token storage/rotation, device/user identity, vault-backed supervisor secrets, process sandboxing, cloud execution, connector grants, or lease authority.

Corrections and remaining boundary:

- Supervisor Lifecycle Readiness is a P1 readiness contract, not daemon control, a vault, an auth lifecycle, a recovery command, or a policy gateway.
- Remaining strict-review gaps include vault reference binding design, explicit lifecycle command contracts, local ingress, live remote CI/CodeQL observation, release packaging, artifact signing, public docs deployment, installer/updater automation, broader projection parity coverage, and future connector OAuth work behind policy.

## Phase 59 Review Notes

This pass closes the first vault reference binding design gap without implementing a vault backend. The previous Vault Reference contract proved that raw secret material is not stored; this pass proves the next boundary: a future policy decision may cite a vault reference only as metadata, and that citation cannot become secret resolution, provider credential use, egress authority, a connector grant, or a lease.

Matched source docs:

- [Architecture](01-architecture.md): the Tool Access & Action Policy Proxy remains the choke point for sensitive reads, data egress, and side effects; vault metadata cannot bypass policy.
- [Technical Strategy](10-technical-strategy.md): Rust remains the future vault/authority owner; TypeScript can define readiness contracts but not implement secret access.
- [Schema Runtime Governance](13-schema-runtime-governance.md): P1 credential-boundary metadata needs negative tests for raw secrets, inherited authority, and live side-effect replay.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): PGC-2 requires vault refs to be citeable by policy decisions without storing raw secret values in examples, artifacts, Ledger events, run manifests, or docs.

Implemented correspondence:

- Added `schemas/vault-policy-binding.schema.json` and `examples/contracts/vault-policy-binding.json`.
- The contract references `vault-reference.schema.json`, `policy-decision.schema.json`, and `model-provider-readiness.schema.json` by schema name and binds a `vault://` URI plus SHA-256 fingerprint into policy-decision metadata.
- The contract requires fresh policy and scoped lease requirements while keeping the binding itself unable to issue leases or authorize actions.
- The contract explicitly marks secret resolution, provider vault resolution, raw secret persistence, raw secret availability, OAuth flow, token refresh, connector grants, and egress-by-binding as unimplemented.
- Added a negative schema test rejecting raw-secret material, missing fresh-policy or lease requirements, secret resolution, raw secret copy, provider call authorization, connector grant authorization, raw Ledger material, egress authority, connector-grant authority, and extra raw-secret fields.
- `doctor`, `onboarding check`, and `release evidence` now include `vault_policy_binding_contract` evidence.
- README, TUI README, harness-core README, schema governance, and runtime-loop docs were updated in English and Chinese.

Drift review:

- Corrects a PGC-2 binding drift: Aetherion had a metadata-only Vault Reference, but production reports could not yet prove how a policy decision may cite it safely.
- Corrects an OAuth/connector drift risk: a vault reference is now explicitly not a connector grant, token refresh path, provider vault-backed call, or egress permission.
- Does not implement secret retrieval, OS keychain access, production vault storage, provider credential resolution from vault, OAuth flow, token refresh, connector account linking, connector grants, egress policy, or lease issuance.

Corrections and remaining boundary:

- Vault Policy Binding is a P1 readiness/credential-boundary metadata contract, not a secret use path or policy authority.
- Remaining strict-review gaps include explicit supervisor lifecycle command contracts, local ingress envelope/idempotency, provider error/credential-source productionization, live remote CI/CodeQL observation, release packaging, artifact signing, public docs deployment, installer/updater automation, broader projection parity coverage, and future connector OAuth work behind policy.

## Phase 60 Review Notes

This pass starts the PGC-3 local ingress path without implementing a production gateway. The previous architecture matrix had a visible Ingress Gateway gap: Aetherion had local TUI invocation and hash-only/queue-only surface labs, but no machine-checkable envelope describing what future local API-like ingress must prove before handing anything to the Local Supervisor.

Matched source docs:

- [Architecture](01-architecture.md): Ingress Gateways normalize, authenticate, rate-limit, and provide idempotency before Local Supervisor handoff.
- [User Boundary Layer](02-user-boundary-layer.md): client surfaces and remote channels cannot authorize sensitive actions directly.
- [Schema Runtime Governance](13-schema-runtime-governance.md): P1 readiness metadata must reject inherited authority, raw payload persistence, and live side-effect claims.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): PGC-3 requires a local ingress request envelope plus a read-only ingress audit command before real API/browser/IM/mobile ingress.

Implemented correspondence:

- Added `schemas/local-ingress-readiness.schema.json` and `examples/contracts/local-ingress-readiness.json`.
- The contract requires caller identity placeholder, surface id, workspace id, idempotency key, normalized intent hash, auth state, rate-limit state, and policy handoff metadata.
- The contract keeps the TUI as the only runnable surface and marks local API-like ingress as contract-only.
- The contract rejects public API listeners, browser extension ingress, IM delivery, mobile pairing, connector OAuth ingress, cloud worker ingress, unauthenticated authority, duplicate-key authority reuse, raw external payload persistence, session issuance, rate-limit enforcement overclaims, supervisor bypass, and ingress-issued leases.
- Added a negative schema test for remote surface, auth, idempotency, rate-limit, raw-payload, and authority overclaims.
- Added `ingress audit`, a read-only report that starts no listener, accepts no remote connection, mutates no workspace, writes no artifact, appends no Ledger event, issues no session, detects no live duplicate keys, enforces no rate limits, and grants no authority.
- `doctor`, `onboarding check`, and `release evidence` now include `local_ingress_readiness_contract` evidence; `release evidence` names the remaining local ingress runtime gaps.
- README, TUI README, harness-core README, schema governance, and runtime-loop docs were updated in English and Chinese.

Drift review:

- Corrects the PGC-3 planning drift: the architecture required ingress normalize/auth/rate-limit/idempotency, but production reports could not yet distinguish a future gateway contract from the already runnable TUI.
- Corrects a remote-surface drift risk: API/browser/IM/mobile/cloud ingress is now explicitly not implemented and cannot bypass Local Supervisor or Tool Access & Action Policy Proxy.
- Does not implement duplicate idempotency detection before action runs, a rate limiter, a persistent auth/session lifecycle, public HTTP/API listener, browser extension, IM delivery, mobile client, connector OAuth ingress, cloud worker ingress, or supervisor policy execution from ingress envelopes.

Corrections and remaining boundary:

- Local Ingress Readiness is a P1 readiness/audit contract, not a production ingress gateway or authority path.
- Remaining strict-review gaps include runtime duplicate detection for local envelopes, explicit supervisor lifecycle command contracts, provider error/credential-source productionization, live remote CI/CodeQL observation, release packaging, artifact signing, public docs deployment, installer/updater automation, broader projection parity coverage, and future connector OAuth work behind policy.

## Phase 3 Review Notes

Matched architecture docs:

- `docs/03-memory-os.md`: memories must retain source citations and context assembly must explain selection, exclusion, conflicts, and privacy boundaries.
- `docs/06-roadmap.md`: Phase 3 requires memory candidates, review state, memory cards, and context assembler retrieval rules from real run traces.
- `docs/11-migration-and-runtime-economics.md`: later vector or graph projections must remain rebuildable from event truth.

Implemented correspondence:

- Event Ledger to Memory Candidate: `deriveMemoryCandidatesFromEvents(events, runId)` creates pending candidates from `run.completed` and `verification.recorded`.
- Review gate: `memory accept <id>` converts pending candidates to Memory Cards; candidates do not become active memory automatically.
- Inspect/block/delete: `memory inspect <memory_id>` reports active/tombstoned state, `memory block <memory_id> --context <context>` adds a context exclusion while preserving provenance, and `memory delete <memory_id>` removes the active Memory Card projection while persisting a schema-valid `memory.deleted` tombstone.
- Context assembly: `context explain <run_id>` reads accepted Memory Cards and Memory Tombstones from `.aetherion/registries/`, then explains selected/excluded records plus Context Pack conflicts projected from selected Memory Card `contradicts` references.
- Privacy guard: trace-derived candidates default to `blocked_contexts: ["external_send"]`.
- User-model fields are derived only from accepted memories; missing evidence remains `unknown` or an empty list.
- Episodic timelines and the basic user model persist from source-backed records. Timelines use artifact references only when present and extract failure, recovery, user-correction, skill-candidate, and regression-case review signals only from explicit event summaries.
- `audit memory-records` rebuilds expected Memory Candidate, active Memory Card, and Memory Tombstone registry projections from supervisor-appended Memory lifecycle events and their payload artifacts without mutating registries.

Known gaps before Phase 3 is production-ready:

- Candidate generation is deterministic and narrow; it still focuses on `run.completed` and `verification.recorded` and does not promote timeline learning signals into active Memory Cards or Capability Capsules automatically.
- Episodic Timeline extraction is deterministic and summary-based; it is not semantic learning, automatic test generation, or skill publication.
- Context ranking and conflict projection are deterministic and rule-based; they are not semantic retrieval, semantic contradiction detection, or learned relevance scoring.
- Memory delete removes the active projection and records a tombstone, but full artifact redaction, encrypted-payload erasure, and automatic projection repair are not implemented.
