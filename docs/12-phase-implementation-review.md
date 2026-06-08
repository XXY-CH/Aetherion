# Phase Implementation Review

This file is the running phase-end review ledger. Each completed implementation pass must compare the plan against the architecture documents and point to concrete code evidence.

The invariant is unchanged: V1 is TUI-first. Later GUI, IM, browser, connector, and store surfaces remain client surfaces and must not become trust roots.

Schema growth is now governed by `docs/13-schema-runtime-governance.md`: P0 kernel contracts need executable/replay evidence, P1 product-runtime contracts need source-backed command paths, and P2 innovation contracts should stay frozen unless a lower-tier runtime loop requires a change.

## Current Review Snapshot

Verification from the latest pass:

- `npm test`: 83 passing tests.
- `cargo test`: 28 passing Rust tests.
- `cargo clippy --all-targets --all-features -- -D warnings`: clean.
- `cargo fmt --check`: clean.
- `git diff --check`: clean.
- `git ls-files .aetherion target`: no tracked runtime/build artifacts.

## Phase Alignment Matrix

| Phase | Plan intent | Current code evidence | Verification evidence | Review status |
| --- | --- | --- | --- | --- |
| 1. TUI Kernel Loop | Prove local safe execution through workspace identity, event ledger, policy, lease, approval, file operation, verification, and replay. | Ether `run`, `replay`, and `trace`; stable path-derived workspace identity; fail-closed workspace registry loading that derives identity/runtime/Ledger path from the resolved root; schemas/examples for workspace registry, run manifest, risk, approval, and Replay Record; versioned `aetherion-event-v1` hash chains shared by Rust and the test-only TS seed; output-safe default summaries avoid copying source file content unless the caller explicitly supplies `--summary`; P0 action lifecycle events include `tool.requested`, `risk.composed`, `policy.decided`, `lease.issued`, `consent.recorded`, `action.recorded`, `observation.recorded`, and `verification.recorded`. | Harness and Ether tests cover lease-gated reads plus approval-gated traced writes, default summary non-copying behavior for secret-like source content, explicit user-supplied summary output, complete action lifecycle trace order, trace reconstruction, cross-author hash-chain validation, fixed canonical hash vectors, replay records, workspace registry id/runtime/Ledger path drift rejection, and kernel-loop rejection of workspace ids that do not match the resolved root. | Runnable through the Rust supervisor by default. TypeScript authority is isolated behind `AETHERION_ALLOW_TYPESCRIPT_SEED=1` for tests. Workspace registries are P0 projections and cannot redirect the kernel to another Ledger path. |
| 2. Rust Supervisor Boundary | Move authority proof toward Rust supervisor while keeping TS as client/orchestrator. | `crates/supervisor/src/lib.rs`, `crates/supervisor/src/main.rs`; `packages/harness-core/src/supervisor-client.ts`; `packages/harness-core/src/run-supervisor.ts`; default Ether `run`. Rust derives workspace identity from the resolved root at the RPC boundary, returns operation lease ids only from traced action paths, rejects generic `event.append` attempts to forge authority-bearing lifecycle events before workspace init, rejects legacy weak `trace.replay`, and appends versioned SHA-256-linked events behind a workspace-local append lock and sync-then-rename Ledger rewrite; workspace init recovers abandoned temp files and verifies parent continuity, workspace id consistency, plus complete canonical v1 event hashes for every author; traced read plus write prepare/commit RPCs now emit the file-action lifecycle events inside Rust and return event ids for the Ether run manifest projection; approved write commits record consent, observation, and verification in the same supervisor RPC path that performs the write; stdio RPC input now uses the supervisor's minimal structured JSON object parser and typed field accessors. | Rust unit tests cover wrong-path, expired lease, distinct lease ids, idempotent workspace init, identity-conflict rejection, RPC workspace-id drift rejection before runtime initialization, standard SHA-256 vector, TS/Rust canonical-vector parity, TS-authored event acceptance, tamper rejection, JSON control-character/Unicode recovery, schema-compatible timestamps, concurrent append serialization, atomic rewrite behavior, startup temp cleanup, traced action lifecycle RPCs, unapproved write commit with no action, supervisor-authored post-write evidence, legacy policy-only/read/write/replay RPC rejection without runtime state or content/lease leakage, generic `event.append` authority-event forgery rejection, commit JSON contents, and fail-closed malformed/duplicate/wrong-typed RPC fields; Ether integration validates mixed TS/Rust ledgers with `chain_valid=true` and asserts write consent/observation/verification summaries come from supervisor semantics. | Authority-boundary POC implemented and used by default. Ether still owns approval-card rendering, run manifests, and Ledger-backed replay persistence; long-running daemon, vault, signatures, process sandbox, and a full JSON-RPC server remain pending. |
| 3. Memory OS MVP | Grow memory from source events, not opaque vector state. | `packages/memory-os/src/index.ts`; trace-derived candidates, episodic timeline, evidence-only user model, context pack, Memory Tombstone contract; Ether memory/context commands and registries; read-only `audit memory-records` parity preview for active Memory Cards and Tombstones. | Memory OS tests require source events, context blocking, and tombstone exclusion; Ether tests derive candidates from a real run, accept one, inspect/block/delete it, verify context explain no longer selects deleted memory, reject weak registry provenance, and report Memory projection drift without mutation. | MVP source-backed lifecycle implemented. Active card/tombstone parity preview exists; extraction, ranking, candidate parity, redaction, and full rebuild remain narrow or pending. |
| 4. Migration Dry-Run MVP | Import OpenClaw/Hermes shapes without inheriting trust or secrets. | `packages/migration/src/index.ts`; migration plan, legacy capsule, and extended migration report schemas/examples; TUI import dry-run. | Migration tests redact token-like fields and quarantine legacy material; TUI import test checks no raw token output. | Dry-run seed implemented. No real takeover by design. |
| 5. Sandbox Rehearsal and Branching | Turn audit into checkpoint, branch, isolated file rehearsal, and fresh-authority approval flow. | `packages/sandbox/src/index.ts`; checkpoint, branch, rehearsal, and sandbox-approval schemas/examples; Ether `checkpoint`, `branch`, `rehearse`, and `approve-rehearsal`; `.aetherion/sandboxes/<branch>/workspace/`; checkpoint/branch event id/hash pointers; pre-promotion Ledger/hash/path/content revalidation; independent promotion run manifests; Rust supervisor write-prepare/write-commit RPCs. | Sandbox tests assert branch does not inherit live authority, copies checkpoint head pointers, rejects out-of-workspace/runtime-state targets, and leaves the real file unchanged; Ether integration verifies fresh Rust lease, exact live content, schema-valid SandboxApproval, Rust-authored write lifecycle events in the promotion run, and no post-completion events appended to the checkpoint source run. TUI tamper tests reject non-sandbox branches, sandbox content drift, and target content drift before creating a promotion run or live write. | Local file temp-workspace rehearsal and approval implemented with preflight projection revalidation. Git worktree, deterministic checkpoint/branch/rehearsal registry rebuild, external-system rollback, and branch-specific event streams remain pending. |
| 6. Capability Capsule MVP | Govern capabilities through lifecycle, permission diff, replay tests, sandbox trial, and legacy quarantine. | `packages/capability-os/src/index.ts`; expanded Capsule schema/example; Ether `capsule draft/list/inspect/test/publish/rollback`; Capsule, replay, approval, and version registries; supervisor-appended Capsule lifecycle events with versioned `payload_ref` snapshots; read-only `audit capsule-records` parity preview for Capsule lifecycle projections. | Unit tests require two distinct provenance runs, reject executable playbooks, quarantine external execution, gate permission expansion, exercise rollback, and rebuild expected Capsule registry projections from lifecycle artifacts. Ether integration creates two real Rust-supervised runs, validates the Ledger prefix, runs a document sandbox trial, proves failed permission-expansion publish writes no publish event, records draft/test/publish/rollback lifecycle events, publishes two local versions, rolls back, and reports Capsule projection drift without mutation. | Document-only local lifecycle implemented. Publication is explicitly unsigned and does not execute playbooks. Capsule lifecycle registries have a scoped read-only parity preview; package signing, imported/generated code execution, external sandbox processes, Capsule Store registry parity, and automatic registry repair remain pending. |
| 7. Causal Memory and Counterfactual | Project evidence-linked relations and produce counterfactual reports without live actions or causal overclaiming. | `packages/causal-memory/src/index.ts`; Causal Edge, Why Report, Counterfactual Report, and Causal Projection schemas/examples; Ether `why`/`counterfactual`; rebuildable `.aetherion/projections/causal.sqlite`. | Tests cover typed dependency chains, failure/correction links, report-only downstream counterfactuals, disposable SQLite rebuild, cross-run isolation, and redacted-source confidence reduction. Ether integration rebuilds from a real Rust-supervised Ledger and a real appended redaction event. | Evidence-aware report projection implemented. It labels edges as temporal dependency candidates, not proven causes. Domain state simulation, LLM replay, and alternate-history outcome evaluation remain pending. |
| 8. Digital Hibernation and Wakeup | Serialize long task state, drop active leases, evaluate local triggers, and recheck policy before resume. | `packages/hibernation/src/index.ts`; expanded hibernation/wakeup schemas/examples; Ether `sleep`, `wake`, and `sleepers`; Rust `run.resume.evaluate`; new resume-run Ledger events. | Unit tests cover lease rejection, cursor binding, deadlines, expiry, attention budgets, file change/deletion, workspace escape, and symlink escape. Ether integration proves fresh-policy queueing with no lease or action. | Local explicit-evaluation, queue-only MVP implemented. Background daemon and resumed task executor remain pending. |
| 9. Memory Folding, Persona Anchors, Soul Fork | Control drift through source-backed fold patches, reversible persona branches, and authority-free inheritance. | `packages/soul/src/index.ts`; expanded fold/anchor/fork/inheritance contracts plus persona branch/state/reset contracts; Ether `dream`, `anchors`, `persona`, and `soul`; Rust artifact-linked governance events. | Tests cover minimum fold provenance, sensitive approval, source preservation, TTL-bound branches, business-memory retention, hash-bound checkpoint replay, sensitive-history approval, secret-memory exclusion, zero authority/budget/path scope, duplicate identity rejection, and full Ledger hash validation. | Governed local lifecycle implemented. Fork records are non-executable containers; personality simulation, legal inheritance, funded execution, and external export remain pending. |
| 10. Zero-Trust Multi-Agent and Economics | Bound child agents with contracts, budgets, circuit breakers, capsule isolation, and evidence. | `packages/multiagent/src/index.ts`; expanded contract/budget/account/breaker/result/score contracts; Ether contract creation plus a narrow document-read executor; Rust `child.file.read` authority path. | Multi-agent tests cover Capsule/path/risk/budget isolation and breaker behavior; Ether integration verifies independent child runs, Rust Ledger facts, risk and lease evidence, accounting, taint, repeated-denial hard stop, and routing-weight reduction. Rust RPC tests cover allowed child reads and denied child reads with risk evidence and no lease. | Governed local document-read slice implemented. General LLM orchestration, writes, network tools, escrow, and exact supervisor-process CPU accounting remain pending. |
| 11. Anti-Poisoning and Honeypot | Treat untrusted content as tainted, prevent it from authorizing actions, detect escalation/exfiltration attempts, contain suspicious subjects, and create regression evidence. | `packages/security/src/index.ts`; assessment/signal/trial/fixture contracts; Ether `security scan/ack/trial/fixture`; Rust `security.taint.evaluate`. | Security tests cover hash-only detection, multi-rule signals, taint authorization rejection, decoy-only trials, raw-free fixtures, Rust deny/no-lease policy, and Ledger-backed Ether lifecycle. | Deterministic local defense slice implemented. Semantic classifiers, source adapters, unknown-code process sandboxes, attribution, and active countermeasures remain pending. |
| 12. Computer Harness, IM, GUI, Capsule Store | Add broader surfaces only after kernel authority is stable, without making surfaces trust roots. | `packages/surface-os/src/index.ts`; browser/IM/store contracts/examples; `packages/computer-use/src/index.ts`; computer action/observation contracts/examples with requirements-gate and approval-key fields; Ether `surface browser-observe`, `surface im-inbox`, `surface im-outbox`, and `store install`; Rust `surface.outbox.evaluate`. | Surface OS tests cover hash-only browser/IM records, one-scoped outbox approval, no delivery, and Ed25519 package verification. Computer-use tests cover current-tab browser scope, structured-first channel selection, side-effect lease/approval requirements, requirements-only adapter gates, scoped approval keys, tainted egress denial, and non-authorizing observations. Contract tests reject user-config-enabled computer actions and duplicate approval keys. Ether integration proves browser taint denial, IM outbox policy, no raw content in output/Ledger, and signed Capsule declaration install. Rust tests cover outbox ask/deny policy. | Narrow control-plane slice implemented. Real GUI, browser extension, DOM/CDP action, screenshot fallback, desktop automation, webhook/IM delivery, and remote Capsule Store remain pending. |

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
- `StorePackage` uses Ed25519 over a canonical Capsule declaration. `store install` validates the package, verifies the signature, requires at least two passing replay tests, a passing sandbox trial, and permission-diff approval, then installs only the Capsule declaration and a Capsule Install record. `raw_code_executed=false`.
- Ether Ledger evidence is surface-specific: `browser.observation.ingested`, `im.inbox.received`, `im.outbox.queued`, and `capsule.store.installed`. Registries remain projections over artifacts and events.

Correction and remaining boundary:

- Phase 12 is not a full computer-use implementation yet. It does not click, type, read arbitrary tabs, capture screenshots, launch a browser extension, send IM/email, start a webhook, run a GUI, or execute package code.
- The browser command currently accepts a governed observation fixture/input. Real DOM/CDP collection and screenshot fallback must be implemented behind the same Supervisor policy gates.
- Store publication is still local. There is no remote market, transparency log, revocation feed, payment, or public trust network.
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

Verification evidence:

- TUI regression tests tamper the branch registry to a non-sandbox status, tamper the sandbox proposed file after rehearsal, and change the real target file after rehearsal. Each case fails before writing a `run_rehearsal_*` manifest, before requesting supervisor authority, and before overwriting the live target.

Correction and remaining boundary:

- This corrects a projection-authority drift: registry rows may help locate checkpoint/branch/rehearsal state, but they cannot authorize promotion to a live local write without immediate Ledger, path, and file-hash evidence.
- The current temp workspace is an Aetherion-owned file mirror, not a Git worktree. It proves local file isolation and promotion but not repository-level merge/conflict behavior.
- Only local file writes are implemented. Database, email, connector, and other external side effects still need target-specific rehearsal and compensating-action contracts.
- TypeScript remains the Ether orchestrator and audit client. Rust owns the policy/write boundary for approved file rehearsal, but the supervisor is still a POC rather than the production authority daemon.
- Approval records the actual operation lease returned by `file.write.commit`; the write-prepare ask decision is evidence of the approval gate, not execution authority.
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
- Governance event payloads point to immutable command artifacts. `audit registries` can now report whether registry entries cite existing Ledger event ids, missing event ids, no event provenance, or malformed entries. `audit replay-records`, `audit memory-records`, and `audit capsule-records` add scoped rebuild/parity previews for Replay Records, active Memory Card/Tombstone projections, and Capsule lifecycle projections, but deterministic rebuild/parity tooling for remaining registry families is still not implemented.

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
- Clean assessments complete the security run. Suspicious assessments append `poisoning.detected`, persist a quarantined signal, and end the run as blocked.
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
- TS client path: `callSupervisorRpc` and `runSupervisorKernelLoop`.
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
- `audit memory-records` walks Memory lifecycle Ledger events in order, reads the `payload_ref` artifacts for `memory.accepted`, `memory.blocked`, and `memory.deleted`, reconstructs expected active Memory Cards and Tombstones, and reports matched, missing, mismatched, stale, or invalid projection state without mutating registries.

Verification evidence:

- TUI integration asserts Memory lifecycle events are supervisor-authored, include `artifact://memory/...` payload refs, and have matching artifacts for candidate creation, accept, reject, block, and delete.
- TUI regression tests tamper `memory-cards.json` with a missing Ledger event id and assert `context explain`, `memory user-model`, and `sleep` all reject the projection instead of consuming it.
- Harness and TUI tests tamper active Memory Card registries and assert `audit memory-records` reports mismatched/stale projection state while preserving the registry file unchanged.

Correction and remaining boundary:

- This is not the full Memory OS. Candidate extraction remains deterministic and narrow, focused on `run.completed` and `verification.recorded`; failures, corrections, contradictions, rich ranking, TTL expiry, encrypted redaction, pending/rejected candidate parity, and automated registry repair remain future work.
- The registry provenance gate proves referenced Ledger event ids exist. `audit memory-records` goes further for active cards and tombstones by previewing Ledger-plus-artifact rebuild parity, but it is read-only and does not make registry files authoritative.
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

- This does not impose one lifecycle on all run families. Hibernation, child-read, security, browser-observe, and outbox runs retain their existing completion semantics until they get explicit lifecycle contracts.
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

## Phase 3 Review Notes

Matched architecture docs:

- `docs/03-memory-os.md`: memories must retain source citations and context assembly must explain selection, exclusion, conflicts, and privacy boundaries.
- `docs/06-roadmap.md`: Phase 3 requires memory candidates, review state, memory cards, and context assembler retrieval rules from real run traces.
- `docs/11-migration-and-runtime-economics.md`: later vector or graph projections must remain rebuildable from event truth.

Implemented correspondence:

- Event Ledger to Memory Candidate: `deriveMemoryCandidatesFromEvents(events, runId)` creates pending candidates from `run.completed` and `verification.recorded`.
- Review gate: `memory accept <id>` converts pending candidates to Memory Cards; candidates do not become active memory automatically.
- Inspect/block/delete: `memory inspect <memory_id>` reports active/tombstoned state, `memory block <memory_id> --context <context>` adds a context exclusion while preserving provenance, and `memory delete <memory_id>` removes the active Memory Card projection while persisting a schema-valid `memory.deleted` tombstone.
- Context assembly: `context explain <run_id>` reads accepted Memory Cards and Memory Tombstones from `.aetherion/registries/`, then explains selected/excluded records.
- Privacy guard: trace-derived candidates default to `blocked_contexts: ["external_send"]`.
- User-model fields are derived only from accepted memories; missing evidence remains `unknown` or an empty list.
- Episodic timelines and the basic user model persist from source-backed records. Timelines use artifact references only when present and do not manufacture regression cases.

Known gaps before Phase 3 is production-ready:

- Candidate generation is deterministic and narrow; it does not yet extract user corrections, failures, skill candidates, or regression cases.
- Context ranking is rule-based only; there is no token-aware scoring beyond the seed budget fields.
- Memory delete removes the active projection and records a tombstone, but a full artifact redaction, encrypted-payload erasure, and projection rebuild workflow is not implemented.
