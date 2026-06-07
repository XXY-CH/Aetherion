# Phase Implementation Review

This file is the running phase-end review ledger. Each completed implementation pass must compare the plan against the architecture documents and point to concrete code evidence.

The invariant is unchanged: V1 is TUI-first. Later GUI, IM, browser, connector, and store surfaces remain client surfaces and must not become trust roots.

## Current Review Snapshot

Verification from the latest pass:

- `npm test`: 38 passing tests.
- `cargo test`: 5 passing Rust tests.
- `git diff --check`: clean.
- `git ls-files .aetherion target`: no tracked runtime/build artifacts.

## Phase Alignment Matrix

| Phase | Plan intent | Current code evidence | Verification evidence | Review status |
| --- | --- | --- | --- | --- |
| 1. TUI Kernel Loop | Prove local safe execution through workspace identity, event ledger, policy, lease, approval, file operation, verification, and replay. | Ether `run`, `replay`, and `trace`; stable path-derived workspace identity; schemas/examples for workspace registry, run manifest, risk, approval, and Replay Record; Rust and test-only TS event hash chains. | Harness and Ether tests cover approval-gated read/write, trace reconstruction, hash-chain validation, and replay records. | Runnable through the Rust supervisor by default. TypeScript authority is isolated behind `AETHERION_ALLOW_TYPESCRIPT_SEED=1` for tests. |
| 2. Rust Supervisor Boundary | Move authority proof toward Rust supervisor while keeping TS as client/orchestrator. | `crates/supervisor/src/lib.rs`, `crates/supervisor/src/main.rs`; `packages/harness-core/src/supervisor-client.ts`; `packages/harness-core/src/run-supervisor.ts`; default Ether `run`. Rust returns operation lease ids and appends SHA-256-linked events. | Rust unit tests cover wrong-path, expired lease, distinct lease ids, idempotent workspace init, identity-conflict rejection, standard SHA-256 vector, and RPC JSON contents; Ether integration validates repeated runs and `chain_valid=true`. | Authority-boundary POC implemented and used by default. Long-running daemon, vault, and process sandbox remain pending. |
| 3. Memory OS MVP | Grow memory from source events, not opaque vector state. | `packages/memory-os/src/index.ts`; trace-derived candidates, episodic timeline, evidence-only user model, context pack; Ether memory/context commands and registries. | Memory OS tests require source events; Ether tests derive candidates from a real run, accept one, and select it in context explain. | MVP source-backed path implemented. Extraction and ranking remain narrow; missing evidence is not synthesized. |
| 4. Migration Dry-Run MVP | Import OpenClaw/Hermes shapes without inheriting trust or secrets. | `packages/migration/src/index.ts`; migration plan, legacy capsule, and extended migration report schemas/examples; TUI import dry-run. | Migration tests redact token-like fields and quarantine legacy material; TUI import test checks no raw token output. | Dry-run seed implemented. No real takeover by design. |
| 5. Sandbox Rehearsal and Branching | Turn audit into checkpoint, branch, isolated file rehearsal, and fresh-authority approval flow. | `packages/sandbox/src/index.ts`; checkpoint, branch, rehearsal, and sandbox-approval schemas/examples; Ether `checkpoint`, `branch`, `rehearse`, and `approve-rehearsal`; `.aetherion/sandboxes/<branch>/workspace/`; checkpoint/branch event id/hash pointers; Rust supervisor policy/write RPC. | Sandbox tests assert branch does not inherit live authority, copies checkpoint head pointers, rejects out-of-workspace/runtime-state targets, and leaves the real file unchanged; Ether integration verifies fresh Rust lease, exact live content, and new policy/action events after approval. | Local file temp-workspace rehearsal and approval implemented. Git worktree, external-system rollback, and branch-specific event streams remain pending. |
| 6. Capability Capsule MVP | Govern capabilities through lifecycle, permission diff, replay tests, sandbox trial, and legacy quarantine. | `packages/capability-os/src/index.ts`; expanded Capsule schema/example; Ether `capsule draft/list/inspect/test/publish/rollback`; Capsule, replay, approval, and version registries. | Unit tests require two distinct provenance runs, reject executable playbooks, quarantine external execution, gate permission expansion, and exercise rollback. Ether integration creates two real Rust-supervised runs, validates the Ledger prefix, runs a document sandbox trial, publishes two local versions, and rolls back. | Document-only local lifecycle implemented. Publication is explicitly unsigned and does not execute playbooks. Package signing, imported/generated code execution, external sandbox processes, and Store installation remain pending. |
| 7. Causal Memory and Counterfactual | Project evidence-linked relations and produce counterfactual reports without live actions or causal overclaiming. | `packages/causal-memory/src/index.ts`; Causal Edge, Why Report, Counterfactual Report, and Causal Projection schemas/examples; Ether `why`/`counterfactual`; rebuildable `.aetherion/projections/causal.sqlite`. | Tests cover typed dependency chains, failure/correction links, report-only downstream counterfactuals, disposable SQLite rebuild, cross-run isolation, and redacted-source confidence reduction. Ether integration rebuilds from a real Rust-supervised Ledger and a real appended redaction event. | Evidence-aware report projection implemented. It labels edges as temporal dependency candidates, not proven causes. Domain state simulation, LLM replay, and alternate-history outcome evaluation remain pending. |
| 8. Digital Hibernation and Wakeup | Serialize long task state, drop active leases, wake via local triggers with policy recheck. | `packages/hibernation/src/index.ts`; hibernation and wakeup schemas/examples; Ether sleep/wake registry path. | Hibernation tests assert active leases are not retained; Ether requires an existing run and context pack and rejects missing hibernation records. | Evidence-backed record lifecycle implemented. Trigger runner and resumed execution remain pending. |
| 9. Memory Folding, Persona Anchors, Soul Fork | Control drift through folds, anchors, reset, fork, and inheritance policy. | `packages/soul/src/index.ts`; fold, anchor, soul fork, inheritance policy schemas/examples; Ether anchors/persona/soul commands. | Soul tests require evidence-backed anchors, explicit confidence, proposed-only reset/fork records, and no inherited live authority. | Proposal records implemented. Identity creation, policy materialization, inheritance export, and Dreaming patch pipeline remain pending. |
| 10. Zero-Trust Multi-Agent and Economics | Bound child agents with contracts, budgets, circuit breakers, capsule isolation, and evidence. | `packages/multiagent/src/index.ts`; agent contract, resource budget, circuit breaker schemas/examples; Ether contract creation requires an existing parent run, budget, and published capsule. | Multi-agent tests trigger budget breakers and isolate capsules; Ether test verifies contract creation does not pretend to execute or consume budget. | Contract creation only. Real child run orchestration and accounting remain pending. |
| 11. Anti-Poisoning and Honeypot | Treat untrusted content as tainted, detect policy override/secret exfiltration attempts, quarantine suspicious signals. | `packages/security/src/index.ts`; poisoning signal schema/example; TUI security scan/ack. | Security tests create quarantined poisoning signals from override attempts. | Contract seed implemented. Honeypot capsule runtime pending. |
| 12. Computer Harness, IM, GUI, Capsule Store | Add broader surfaces only after kernel authority is stable, without making surfaces trust roots. | `packages/computer-use/README.md`, `packages/connector-sdk/README.md`, scaffold tests that keep these surfaces post-V1/local-client only. | Existing tests reject quarantined adapters and enforce policy/verifier constraints for computer-use scaffold. | Intentionally deferred from V1. No GUI/IM/store implementation yet. |

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
- Rust now emits the same hash-chain fields consumed by trace verification. The remaining ledger gap is durability hardening: file locking, crash-safe append, strict timestamp format, redaction, signatures, and branch-specific append streams.
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

## Phase 2 Review Notes

Matched architecture docs:

- `docs/01-architecture.md`: Local Supervisor is the authority boundary; TUI is a client surface.
- `docs/06-roadmap.md`: Phase 2 requires Rust supervisor POC, stdio/local RPC, workspace init, event append, policy eval, scoped read/write, and TUI client.
- `docs/10-technical-strategy.md`: TypeScript stays the fast TUI/orchestrator layer; Rust owns the future authority boundary.

Implemented correspondence:

- Rust workspace init and event append: `workspace.init`, `event.append`.
- Rust policy and leases: `tool.evaluate`, `lease.issue`, `file.read`, `file.write`.
- TS client path: `callSupervisorRpc` and `runSupervisorKernelLoop`.
- Ether CLI user path: `npm run ether -- run --supervisor stdio ...`.
- Replay invariant: trace reconstruction reads ledger and reports `live_side_effects_replayed=false`.

Known gaps before Phase 2 can be called production-ready:

- The Rust stdio RPC parser is dependency-free and intentionally minimal; required fields now fail closed, but it is not a robust general JSON-RPC server.
- Rust ledger timestamps use a POC no-dependency format, not strict RFC3339 schema validation.
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
- Agent Contract creation does not consume budget or imply a child run occurred.
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
