# Phase Implementation Review

This file is the running phase-end review ledger. Each completed implementation pass must compare the plan against the architecture documents and point to concrete code evidence.

The invariant is unchanged: V1 is TUI-first. Later GUI, IM, browser, connector, and store surfaces remain client surfaces and must not become trust roots.

## Current Review Snapshot

Verification from the latest pass:

- `npm test`: 27 passing tests.
- `cargo test`: 2 passing Rust tests.
- `git diff --check`: clean.
- `git ls-files .aetherion target`: no tracked runtime/build artifacts.

## Phase Alignment Matrix

| Phase | Plan intent | Current code evidence | Verification evidence | Review status |
| --- | --- | --- | --- | --- |
| 1. TUI Kernel Loop | Prove local safe execution through workspace identity, event ledger, policy, lease, approval, file operation, verification, and replay. | `packages/harness-core/src/run-local.ts`, `workspace.ts`, `risk.ts`, `approval.ts`, `lease.ts`, `policy.ts`, `local-file.ts`, `replay.ts`; `packages/tui/src/cli.ts` commands `run`, `replay`, `trace`; schemas/examples for workspace registry, run manifest, risk, approval, Replay Record; TS seed event `parent_event_id`, `parent_event_hash`, and `event_hash`. | `packages/harness-core/test/harness-core.test.ts`; `packages/tui/test/tui.test.ts` approval-gated loop, trace tests, hash-chain validation, and replay-record artifact/registry checks. | Implemented as TypeScript seed path. Hash-chain is a seed proof, not the final Rust Event Ledger. |
| 2. Rust Supervisor Boundary | Move authority proof toward Rust supervisor while keeping TS as client/orchestrator. | `crates/supervisor/src/lib.rs`, `crates/supervisor/src/main.rs`; `packages/harness-core/src/supervisor-client.ts`; `packages/harness-core/src/run-supervisor.ts`; Ether CLI `run --supervisor stdio`. | Rust unit tests for wrong-path and expired lease rejection; Ether CLI integration test for Rust stdio Phase 1 loop. | POC implemented. Not production supervisor yet. |
| 3. Memory OS MVP | Grow memory from source events, not opaque vector state. | `packages/memory-os/src/index.ts`; `deriveMemoryCandidatesFromEvents`; `buildEpisodicTimeline`; `createBasicUserModel`; memory candidate/card/context pack/timeline/user-model schemas/examples; TUI `memory candidates --from-run`, `memory timeline`, `memory user-model`, memory accept/reject/list, and `context explain` with registries. | Memory OS tests require source events and trace-derived candidates; TUI tests derive candidates from a real run, accept one into the memory registry, and select it in context explain. | MVP trace-derived candidate path implemented. Timeline/user-model seed implemented; extraction remains narrow. |
| 4. Migration Dry-Run MVP | Import OpenClaw/Hermes shapes without inheriting trust or secrets. | `packages/migration/src/index.ts`; migration plan, legacy capsule, and extended migration report schemas/examples; TUI import dry-run. | Migration tests redact token-like fields and quarantine legacy material; TUI import test checks no raw token output. | Dry-run seed implemented. No real takeover by design. |
| 5. Sandbox Rehearsal and Branching | Turn audit into checkpoint, branch, rehearsal, and later approval flow. | `packages/sandbox/src/index.ts`; checkpoint, branch, rehearsal, and sandbox-approval schemas/examples; Ether `checkpoint`, `branch`, `rehearse`, and `approve-rehearsal`; checkpoint/branch event id/hash pointers. | Sandbox tests assert branch does not inherit live authority, copies checkpoint head pointers, and rehearsal does not mutate real workspace; Ether integration verifies fresh policy and new action events after approval. | Approval/event lifecycle seed implemented. Real temp workspace/git worktree execution pending. |
| 6. Capability Capsule MVP | Govern capabilities through lifecycle, permission diff, replay tests, sandbox trial, and legacy quarantine. | `packages/capability-os/src/index.ts`; extended capsule behavior in tests; TUI capsule list/inspect/test/publish. | Capsule tests block publish without replay tests and permission approval. | Contract seed implemented. Legacy adapter runtime pending. |
| 7. Causal Memory and Counterfactual | Build causal edges from event ledger and produce why/counterfactual reports without live actions. | `packages/causal-memory/src/index.ts`; causal edge and counterfactual schemas/examples; TUI why/counterfactual. | Tests require source event citations and forbid live side effects. | Contract seed implemented. Graph/SQLite projection pending. |
| 8. Digital Hibernation and Wakeup | Serialize long task state, drop active leases, wake via local triggers with policy recheck. | `packages/hibernation/src/index.ts`; hibernation and wakeup schemas/examples; TUI sleep/wake/sleepers-adjacent registry path. | Hibernation tests assert active leases are not retained and wake requires policy recheck. | Contract seed implemented. File/deadline trigger runner pending. |
| 9. Memory Folding, Persona Anchors, Soul Fork | Control drift through folds, anchors, reset, fork, and inheritance policy. | `packages/soul/src/index.ts`; fold, anchor, soul fork, inheritance policy schemas/examples; TUI anchors/persona/soul commands. | Soul tests require evidence-backed anchors and no inherited live authority. | Contract seed implemented. Dreaming patch pipeline pending. |
| 10. Zero-Trust Multi-Agent and Economics | Bound child agents with contracts, budgets, circuit breakers, capsule isolation, and evidence. | `packages/multiagent/src/index.ts`; agent contract, resource budget, circuit breaker schemas/examples; TUI agent command. | Multi-agent tests trigger budget breakers and isolate capsules. | Contract seed implemented. Real child run orchestration pending. |
| 11. Anti-Poisoning and Honeypot | Treat untrusted content as tainted, detect policy override/secret exfiltration attempts, quarantine suspicious signals. | `packages/security/src/index.ts`; poisoning signal schema/example; TUI security scan/ack. | Security tests create quarantined poisoning signals from override attempts. | Contract seed implemented. Honeypot capsule runtime pending. |
| 12. Computer Harness, IM, GUI, Capsule Store | Add broader surfaces only after kernel authority is stable, without making surfaces trust roots. | `packages/computer-use/README.md`, `packages/connector-sdk/README.md`, scaffold tests that keep these surfaces post-V1/local-client only. | Existing tests reject quarantined adapters and enforce policy/verifier constraints for computer-use scaffold. | Intentionally deferred from V1. No GUI/IM/store implementation yet. |

## Git-Like Event System Review

Matched source docs:

- `docs/01-architecture.md`: Event Ledger is the product source of truth and stores durable envelopes, provenance, hashes, redaction markers, tombstones, and artifact references.
- `docs/05-audit-and-data-contracts.md`: replay defaults to trace reconstruction or sandbox simulation; live side-effect replay is disabled unless explicitly approved.
- `docs/10-technical-strategy.md`: the durable Event Ledger belongs in Rust core plus JSONL; hash chain is called out as later work.
- `docs/11-migration-and-runtime-economics.md`: Git-style branching over Event Ledger checkpoints is feasible, but branches can replay decisions and artifacts, not authority.

Implemented correspondence:

- TS seed event append enriches events with `parent_event_id`, `parent_event_hash`, and `event_hash`.
- `reconstructTrace` exposes `chain_valid`, `head_event_id`, and `head_event_hash` without replaying side effects.
- `ether replay` now persists a Replay Record artifact and registry entry with `live_side_effects.allowed=false`.
- `checkpoint` records the selected event id/hash; `branch` copies source/head pointers and keeps `inherits_authority=false`.
- The TUI prints chain status and head pointers for the TypeScript seed path.

Correction from review:

- This is not the final production Event Ledger. Per `docs/10-technical-strategy.md`, the production hash-chain authority still belongs in the Rust Local Supervisor/Event Ledger core.
- Current Rust supervisor stdio POC appends auditable JSONL events, but it does not yet emit the same hash-chain fields. Treat that as a Phase 2 hardening gap, not a completed Git-like event system.
- Branching currently preserves checkpoint identity and hash pointers only; it does not yet create temp workspace/git worktree rehearsals or branch-specific event append streams.

## Phase 5 Review Notes

Matched source docs:

- `docs/11-migration-and-runtime-economics.md`: branches may replay decisions and artifacts, but cannot replay authority without fresh policy evaluation.
- `docs/11-migration-and-runtime-economics.md`: replay/fork/wakeup paths must pass fresh policy checks before side effects.
- Original Phase 5 plan: sandbox rehearsal must not mutate the real workspace, expired leases cannot be reused, and approval creates a new action event.

Implemented correspondence:

- `rehearse` produces a preview with `real_workspace_mutated=false` and `approval_required=true`.
- `approve-rehearsal` resolves the persisted rehearsal, branch, and checkpoint before proceeding.
- Approval appends a fresh `policy.decided` event and a separate new `action.recorded` event to the source run.
- `SandboxApproval` records `fresh_policy_evaluated=true` and `inherited_authority=false`; the branch transitions from `sandbox` to `approved`.

Correction and remaining boundary:

- The current action event records promotion of an approved rehearsal; it does not yet execute a real file diff in a temp workspace or git worktree.
- A production implementation must perform fresh Local Supervisor policy evaluation and issue a new scoped lease immediately before the real operation.
- The current TypeScript seed proves lifecycle/audit semantics only; it must not be treated as authority-bearing execution.

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

- The Rust stdio RPC parser is dependency-free and intentionally minimal; it is not a robust JSON-RPC server.
- Rust ledger timestamps use a POC no-dependency format, not strict RFC3339 schema validation.
- TS seed path still exists for Phase 1 compatibility and tests; production authority removal must wait for a dedicated supervisor-hardening phase.
- No vault, hash-chain ledger, sandbox process isolation, long-running daemon, connector runtime, or generated-code isolation is implemented.

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

Known gaps before Phase 3 is production-ready:

- Candidate generation is deterministic and narrow; it does not yet extract user corrections, failures, skill candidates, or regression cases.
- There is no durable episodic timeline file or basic user model file yet.
- Context ranking is rule-based only; there is no token-aware scoring beyond the seed budget fields.
- Memory delete is represented as a tombstone artifact, but a full redaction/rebuild flow is not implemented.
