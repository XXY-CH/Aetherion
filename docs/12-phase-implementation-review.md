# Phase Implementation Review

This file is the running phase-end review ledger. Each completed implementation pass must compare the plan against the architecture documents and point to concrete code evidence.

The invariant is unchanged: V1 is TUI-first. Later GUI, IM, browser, connector, and store surfaces remain client surfaces and must not become trust roots.

## Current Review Snapshot

Verification from the latest pass:

- `npm test`: 55 passing tests.
- `cargo test`: 11 passing Rust tests.
- `git diff --check`: clean.
- `git ls-files .aetherion target`: no tracked runtime/build artifacts.

## Phase Alignment Matrix

| Phase | Plan intent | Current code evidence | Verification evidence | Review status |
| --- | --- | --- | --- | --- |
| 1. TUI Kernel Loop | Prove local safe execution through workspace identity, event ledger, policy, lease, approval, file operation, verification, and replay. | Ether `run`, `replay`, and `trace`; stable path-derived workspace identity; schemas/examples for workspace registry, run manifest, risk, approval, and Replay Record; Rust and test-only TS event hash chains. | Harness and Ether tests cover approval-gated read/write, trace reconstruction, hash-chain validation, and replay records. | Runnable through the Rust supervisor by default. TypeScript authority is isolated behind `AETHERION_ALLOW_TYPESCRIPT_SEED=1` for tests. |
| 2. Rust Supervisor Boundary | Move authority proof toward Rust supervisor while keeping TS as client/orchestrator. | `crates/supervisor/src/lib.rs`, `crates/supervisor/src/main.rs`; `packages/harness-core/src/supervisor-client.ts`; `packages/harness-core/src/run-supervisor.ts`; default Ether `run`. Rust returns operation lease ids and appends SHA-256-linked events behind a workspace-local append lock. | Rust unit tests cover wrong-path, expired lease, distinct lease ids, idempotent workspace init, identity-conflict rejection, standard SHA-256 vector, schema-compatible timestamps, concurrent append serialization, and RPC JSON contents; Ether integration validates repeated runs and `chain_valid=true`. | Authority-boundary POC implemented and used by default. Long-running daemon, vault, and process sandbox remain pending. |
| 3. Memory OS MVP | Grow memory from source events, not opaque vector state. | `packages/memory-os/src/index.ts`; trace-derived candidates, episodic timeline, evidence-only user model, context pack; Ether memory/context commands and registries. | Memory OS tests require source events; Ether tests derive candidates from a real run, accept one, and select it in context explain. | MVP source-backed path implemented. Extraction and ranking remain narrow; missing evidence is not synthesized. |
| 4. Migration Dry-Run MVP | Import OpenClaw/Hermes shapes without inheriting trust or secrets. | `packages/migration/src/index.ts`; migration plan, legacy capsule, and extended migration report schemas/examples; TUI import dry-run. | Migration tests redact token-like fields and quarantine legacy material; TUI import test checks no raw token output. | Dry-run seed implemented. No real takeover by design. |
| 5. Sandbox Rehearsal and Branching | Turn audit into checkpoint, branch, isolated file rehearsal, and fresh-authority approval flow. | `packages/sandbox/src/index.ts`; checkpoint, branch, rehearsal, and sandbox-approval schemas/examples; Ether `checkpoint`, `branch`, `rehearse`, and `approve-rehearsal`; `.aetherion/sandboxes/<branch>/workspace/`; checkpoint/branch event id/hash pointers; Rust supervisor policy/write RPC. | Sandbox tests assert branch does not inherit live authority, copies checkpoint head pointers, rejects out-of-workspace/runtime-state targets, and leaves the real file unchanged; Ether integration verifies fresh Rust lease, exact live content, and new policy/action events after approval. | Local file temp-workspace rehearsal and approval implemented. Git worktree, external-system rollback, and branch-specific event streams remain pending. |
| 6. Capability Capsule MVP | Govern capabilities through lifecycle, permission diff, replay tests, sandbox trial, and legacy quarantine. | `packages/capability-os/src/index.ts`; expanded Capsule schema/example; Ether `capsule draft/list/inspect/test/publish/rollback`; Capsule, replay, approval, and version registries. | Unit tests require two distinct provenance runs, reject executable playbooks, quarantine external execution, gate permission expansion, and exercise rollback. Ether integration creates two real Rust-supervised runs, validates the Ledger prefix, runs a document sandbox trial, publishes two local versions, and rolls back. | Document-only local lifecycle implemented. Publication is explicitly unsigned and does not execute playbooks. Package signing, imported/generated code execution, external sandbox processes, and Store installation remain pending. |
| 7. Causal Memory and Counterfactual | Project evidence-linked relations and produce counterfactual reports without live actions or causal overclaiming. | `packages/causal-memory/src/index.ts`; Causal Edge, Why Report, Counterfactual Report, and Causal Projection schemas/examples; Ether `why`/`counterfactual`; rebuildable `.aetherion/projections/causal.sqlite`. | Tests cover typed dependency chains, failure/correction links, report-only downstream counterfactuals, disposable SQLite rebuild, cross-run isolation, and redacted-source confidence reduction. Ether integration rebuilds from a real Rust-supervised Ledger and a real appended redaction event. | Evidence-aware report projection implemented. It labels edges as temporal dependency candidates, not proven causes. Domain state simulation, LLM replay, and alternate-history outcome evaluation remain pending. |
| 8. Digital Hibernation and Wakeup | Serialize long task state, drop active leases, evaluate local triggers, and recheck policy before resume. | `packages/hibernation/src/index.ts`; expanded hibernation/wakeup schemas/examples; Ether `sleep`, `wake`, and `sleepers`; Rust `run.resume.evaluate`; new resume-run Ledger events. | Unit tests cover lease rejection, cursor binding, deadlines, expiry, attention budgets, file change/deletion, workspace escape, and symlink escape. Ether integration proves fresh-policy queueing with no lease or action. | Local explicit-evaluation, queue-only MVP implemented. Background daemon and resumed task executor remain pending. |
| 9. Memory Folding, Persona Anchors, Soul Fork | Control drift through source-backed fold patches, reversible persona branches, and authority-free inheritance. | `packages/soul/src/index.ts`; expanded fold/anchor/fork/inheritance contracts plus persona branch/state/reset contracts; Ether `dream`, `anchors`, `persona`, and `soul`; Rust artifact-linked governance events. | Tests cover minimum fold provenance, sensitive approval, source preservation, TTL-bound branches, business-memory retention, hash-bound checkpoint replay, sensitive-history approval, secret-memory exclusion, zero authority/budget/path scope, duplicate identity rejection, and full Ledger hash validation. | Governed local lifecycle implemented. Fork records are non-executable containers; personality simulation, legal inheritance, funded execution, and external export remain pending. |
| 10. Zero-Trust Multi-Agent and Economics | Bound child agents with contracts, budgets, circuit breakers, capsule isolation, and evidence. | `packages/multiagent/src/index.ts`; expanded contract/budget/account/breaker/result/score contracts; Ether contract creation plus a narrow document-read executor; Rust `child.file.read` authority path. | Multi-agent tests cover Capsule/path/risk/budget isolation and breaker behavior; Ether integration verifies independent child runs, Rust Ledger facts, lease evidence, accounting, taint, repeated-denial hard stop, and routing-weight reduction. | Governed local document-read slice implemented. General LLM orchestration, writes, network tools, escrow, and exact supervisor-process CPU accounting remain pending. |
| 11. Anti-Poisoning and Honeypot | Treat untrusted content as tainted, prevent it from authorizing actions, detect escalation/exfiltration attempts, contain suspicious subjects, and create regression evidence. | `packages/security/src/index.ts`; assessment/signal/trial/fixture contracts; Ether `security scan/ack/trial/fixture`; Rust `security.taint.evaluate`. | Security tests cover hash-only detection, multi-rule signals, taint authorization rejection, decoy-only trials, raw-free fixtures, Rust deny/no-lease policy, and Ledger-backed Ether lifecycle. | Deterministic local defense slice implemented. Semantic classifiers, source adapters, unknown-code process sandboxes, attribution, and active countermeasures remain pending. |
| 12. Computer Harness, IM, GUI, Capsule Store | Add broader surfaces only after kernel authority is stable, without making surfaces trust roots. | `packages/surface-os/src/index.ts`; browser/IM/store contracts/examples; Ether `surface browser-observe`, `surface im-inbox`, `surface im-outbox`, and `store install`; Rust `surface.outbox.evaluate`; existing computer-use and connector scaffolds remain non-authoritative. | Surface OS tests cover hash-only browser/IM records, one-scoped outbox approval, no delivery, and Ed25519 package verification. Ether integration proves browser taint denial, IM outbox policy, no raw content in output/Ledger, and signed Capsule declaration install. Rust tests cover outbox ask/deny policy. | Narrow control-plane slice implemented. Real GUI, browser extension, DOM/CDP action, screenshot fallback, desktop automation, webhook/IM delivery, and remote Capsule Store remain pending. |

## Phase 12 Review Notes

Matched source docs:

- `docs/01-architecture.md`: TUI, GUI, browser extension, IM, mobile, and API are client surfaces. They cannot grant authority directly.
- `docs/02-user-boundary-layer.md`: external content and remote channels must not authorize sensitive actions.
- `docs/09-computer-use-implementation.md`: browser harness should prefer structured observation, keep extension current-tab by default, redact credential-like DOM, treat DOM as tainted, and require explicit approval for data egress.
- `docs/04-skill-and-scaffold-os.md`: Capsules declare requirements; installation and permission expansion must pass schema, tests, sandbox evidence, approval, and rollback.
- Original Phase 12 plan: browser extension cannot bypass Local Supervisor; IM approvals approve only one scoped action; outbound IM/email goes through outbox policy; Capsule Store installation must show permission diff and execute no malicious code.

Implemented correspondence:

- `BrowserObservation` is current-tab only, public-web tainted, non-authorizing, hash-only, and stores redaction counts rather than raw DOM. `ether surface browser-observe` requires an existing source event and Rust supervisor taint denial before appending `browser.observation.ingested`.
- `ImInboxItem` stores sender/message hashes, never raw text, and upgrades risk for group/public/unknown senders. Inbound IM has `can_authorize_actions=false`.
- `ImOutboxItem` stores destination/body hashes, marks `delivery_attempted=false`, and carries one-scoped approval semantics. Rust `surface.outbox.evaluate` returns `ask`/L3 for DM or group and `deny`/L5 for public sends, always with no lease and `delivery_allowed=false`.
- `StorePackage` uses Ed25519 over a canonical Capsule declaration. `store install` validates the package, verifies the signature, requires at least two passing replay tests, a passing sandbox trial, and permission-diff approval, then installs only the Capsule declaration and a Capsule Install record. `raw_code_executed=false`.
- Ether Ledger evidence is surface-specific: `browser.observation.ingested`, `im.inbox.received`, `im.outbox.queued`, and `capsule.store.installed`. Registries remain projections over artifacts and events.

Correction and remaining boundary:

- Phase 12 is not a full computer-use implementation yet. It does not click, type, read arbitrary tabs, use screenshots, launch a browser extension, send IM/email, start a webhook, run a GUI, or execute package code.
- The browser command currently accepts a governed observation fixture/input. Real DOM/CDP collection and screenshot fallback must be implemented behind the same Supervisor policy gates.
- Store publication is still local. There is no remote market, transparency log, revocation feed, payment, or public trust network.
- GUI work remains blocked on a concrete product-design target. The console must be a Local Supervisor client over these same event/registry surfaces, not a new authority path.

## Git-Like Event System Review

Matched source docs:

- `docs/01-architecture.md`: Event Ledger is the product source of truth and stores durable envelopes, provenance, hashes, redaction markers, tombstones, and artifact references.
- `docs/05-audit-and-data-contracts.md`: replay defaults to trace reconstruction or sandbox simulation; live side-effect replay is disabled unless explicitly approved.
- `docs/10-technical-strategy.md`: the durable Event Ledger belongs in Rust core plus JSONL; hash chain is called out as later work.
- `docs/11-migration-and-runtime-economics.md`: Git-style branching over Event Ledger checkpoints is feasible, but branches can replay decisions and artifacts, not authority.

Implemented correspondence:

- Rust supervisor and the test-only TS seed append `parent_event_id`, `parent_event_hash`, and SHA-256 `event_hash`.
- `reconstructTrace` verifies the full Ledger prefix through the selected run's last event, then projects that run. This preserves cross-run parent links while exposing `chain_valid`, `head_event_id`, and `head_event_hash` without replaying side effects.
- `ether replay` now persists a Replay Record artifact and registry entry with `live_side_effects.allowed=false`.
- `checkpoint` records the selected event id/hash; `branch` copies source/head pointers and keeps `inherits_authority=false`.
- Ether prints chain status and head pointers for both supervisor and test-only seed traces.

Correction from review:

- This is not the final production Event Ledger. Per `docs/10-technical-strategy.md`, the production hash-chain authority still belongs in the Rust Local Supervisor/Event Ledger core.
- Rust now emits the same hash-chain fields consumed by trace verification, supervisor-authored event timestamps are RFC3339 UTC strings validated against `event.schema.json`, and supervisor-authored appends hold a workspace-local lock while reading the head and writing the next event. The remaining ledger gap is durability hardening: crash-safe append/recovery, redaction, signatures, and branch-specific append streams.
- Branching preserves checkpoint identity and hash pointers and can create an Aetherion-managed temp file workspace under `.aetherion/sandboxes/`; it does not yet create Git worktrees or branch-specific event append streams.

## Phase 5 Review Notes

Matched source docs:

- `docs/11-migration-and-runtime-economics.md`: branches may replay decisions and artifacts, but cannot replay authority without fresh policy evaluation.
- `docs/11-migration-and-runtime-economics.md`: replay/fork/wakeup paths must pass fresh policy checks before side effects.
- Original Phase 5 plan: sandbox rehearsal must not mutate the real workspace, expired leases cannot be reused, and approval creates a new action event.

Implemented correspondence:

- `rehearse --path <workspace-file>` validates the target stays inside the workspace and outside `.aetherion/`, writes proposed content only under `.aetherion/sandboxes/<branch>/workspace/`, and records a reviewable diff plus original/proposed SHA-256 values.
- The real workspace file remains unchanged until explicit approval; the rehearsal records `real_workspace_mutated=false` and `approval_required=true`.
- `approve-rehearsal` resolves the persisted rehearsal, branch, and checkpoint before proceeding.
- File approval asks the Rust supervisor for a fresh write policy decision and nonce-bearing lease; the Rust `file.write` boundary reevaluates policy and performs the live operation.
- Ether verifies exact live file contents before appending the separate new `action.recorded` event.
- `SandboxApproval` records `fresh_policy_evaluated=true`, `inherited_authority=false`, the fresh lease id, side-effect status, and verification status; the branch transitions from `sandbox` to `approved`.

Correction and remaining boundary:

- The current temp workspace is an Aetherion-owned file mirror, not a Git worktree. It proves local file isolation and promotion but not repository-level merge/conflict behavior.
- Only local file writes are implemented. Database, email, connector, and other external side effects still need target-specific rehearsal and compensating-action contracts.
- TypeScript remains the Ether orchestrator and audit client. Rust owns the policy/write boundary for approved file rehearsal, but the supervisor is still a POC rather than the production authority daemon.
- Approval records the actual operation lease returned by `file.write`; the separate preflight lease is not represented as execution authority.

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
- External/executable Capsules are quarantined. No playbook or imported code executes in the Local Supervisor.

Correction and remaining boundary:

- SHA-256 proves content integrity but is not a signature. The contract therefore uses `integrity` and marks publication `local_unsigned`; package/capsule signing remains a later Store/package gate.
- Static pattern scanning is deliberately narrow and cannot establish code safety. Executable package typecheck, unit tests, process isolation, structured IPC, resource limits, and network policy remain unimplemented.
- The lifecycle does not yet auto-propose Capsules from repeated episodes. Users provide a manifest whose provenance is verified.
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
- Existing rehearsal promotion appends policy/action evidence to the checkpoint's original run after its `run.completed` event. Why Reports detect this and become partial; a later Phase 5 hardening pass should assign promoted work an independent run manifest instead of extending a completed run.

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
- Governance event payloads point to immutable command artifacts, but registry rebuild tooling from those artifacts is not yet implemented.

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
- Rust `child.file.read` validates the existing workspace identity, creates the Tool Request, evaluates policy, issues the scoped read lease, performs the read, and appends `tool.requested`, `policy.decided`, and `tool.result` to the Event Ledger in the same supervisor RPC path. Ether only attaches returned event ids to the child manifest.
- Budget Accounts decrement tool-call and lease allowances and record orchestration CPU/wall time. Token and network usage stay zero because the MVP invokes neither a model nor a network tool.
- Successful child results expose event ids, request/policy/lease ids, SHA-256, byte count, and usage totals, but not file contents. `output_taint.can_authorize_actions=false` and `parent_must_reauthorize_actions=true`.
- Three policy denials open a hard-stop breaker. Permission violations, resource exhaustion, timeout, and supervisor execution failure also stop the contract. Success/denial/violation outcomes update a bounded routing weight.

Correction and remaining boundary:

- The earlier static Agent Contract surface was not multi-agent execution and could not claim budget consumption. Phase 10 now has one real, deliberately narrow child operation.
- This is not general LLM-based agent orchestration, arbitrary Capsule execution, payment/search separation across remote agents, public escrow, or an Agent economy.
- Resource Budget contracts can represent stop/queue/ask for future orchestration, but the current executor rejects anything except `on_exhaustion=stop`; it does not pretend to queue or request approval.
- CPU measurement currently covers the Ether-side spawn/RPC interval and process CPU consumed by the orchestrator. Exact child supervisor CPU accounting requires a long-running supervisor with per-request metering.
- Tool, policy, and result events are Rust-authored facts. Budget Accounts, breakers, scores, and Child Results are schema-validated local projections/artifacts; future durability work must make their rebuild rules explicit.

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
- Rust policy and leases: `tool.evaluate`, `lease.issue`, `file.read`, `file.write`.
- TS client path: `callSupervisorRpc` and `runSupervisorKernelLoop`.
- Ether CLI user path: `npm run ether -- run --supervisor stdio ...`.
- Replay invariant: trace reconstruction reads ledger and reports `live_side_effects_replayed=false`.

Known gaps before Phase 2 can be called production-ready:

- The Rust stdio RPC parser is dependency-free and intentionally minimal; required fields now fail closed, but it is not a robust general JSON-RPC server.
- Rust ledger timestamps now use RFC3339 UTC strings, and Ether integration validates supervisor-authored events against `event.schema.json`.
- Rust supervisor appends are serialized by a local lock, but crash-safe recovery and fsync/rename hardening are still not implemented.
- TS seed path remains test-only and is blocked unless `AETHERION_ALLOW_TYPESCRIPT_SEED=1`.
- No vault, sandbox process isolation, long-running daemon, connector runtime, or generated-code isolation is implemented.

## Truthfulness Gate

Before later phases are promoted, runtime commands must not synthesize missing evidence or report unexecuted work as successful.

Current enforced rules:

- Ether defaults to Rust supervisor authority; stale supervisor binaries are rebuilt before RPC use.
- Workspace ids are derived from the resolved workspace path instead of fixed demo ids.
- Memory candidates and Persona Anchors require existing source events and explicit confidence.
- Context, checkpoint, branch, rehearsal, hibernation, wakeup, Soul Fork, and Agent Contract commands fail when their referenced ledger or registry records do not exist.
- Capsule test/publish accepts only persisted Capsule drafts, two distinct cited Ledger runs, passing hash-chain replay records, and a document sandbox trial. Permission expansion requires an Approval Card.
- Capsule publication is labeled `local_unsigned`; a SHA-256 integrity digest is not represented as a cryptographic signature.
- Agent Contract creation does not consume budget or imply a child run occurred. Only `agent execute` creates a child run and accounting records.
- Child output cannot authorize parent actions; successful results contain hash/byte evidence and require a new parent policy decision for any follow-on action.
- External-content assessments require a Rust deny/no-lease taint decision. Poisoning artifacts store hashes and rule ids rather than raw scanned text.
- Browser/IM/Store surface commands persist hash-only artifacts and require Ledger/Supervisor evidence. They do not claim browser automation, IM delivery, GUI operation, webhook takeover, remote Store publication, or package-code execution.
- Counterfactual output is low-confidence, report-only, and lists evidence, assumptions, and unknowns.
- Examples and test fixtures may use illustrative ids, but runtime code cannot fall back to them.

## Phase 3 Review Notes

Matched architecture docs:

- `docs/03-memory-os.md`: memories must retain source citations and context assembly must explain selection, exclusion, conflicts, and privacy boundaries.
- `docs/06-roadmap.md`: Phase 3 requires memory candidates, review state, memory cards, and context assembler retrieval rules from real run traces.
- `docs/11-migration-and-runtime-economics.md`: later vector or graph projections must remain rebuildable from event truth.

Implemented correspondence:

- Event Ledger to Memory Candidate: `deriveMemoryCandidatesFromEvents(events, runId)` creates pending candidates from `run.completed` and `verification.recorded`.
- Review gate: `memory accept <id>` converts pending candidates to Memory Cards; candidates do not become active memory automatically.
- Context assembly: `context explain <run_id>` reads accepted Memory Cards from `.aetherion/registries/memory-cards.json` and explains selected/excluded records.
- Privacy guard: trace-derived candidates default to `blocked_contexts: ["external_send"]`.
- User-model fields are derived only from accepted memories; missing evidence remains `unknown` or an empty list.
- Episodic timelines use artifact references only when present and do not manufacture regression cases.

Known gaps before Phase 3 is production-ready:

- Candidate generation is deterministic and narrow; it does not yet extract user corrections, failures, skill candidates, or regression cases.
- There is no durable episodic timeline file or basic user model file yet.
- Context ranking is rule-based only; there is no token-aware scoring beyond the seed budget fields.
- Memory delete is represented as a tombstone artifact, but a full redaction/rebuild flow is not implemented.
