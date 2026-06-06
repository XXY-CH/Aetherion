# Phase Implementation Review

This file is the running phase-end review ledger. Each completed implementation pass must compare the plan against the architecture documents and point to concrete code evidence.

The invariant is unchanged: V1 is TUI-first. Later GUI, IM, browser, connector, and store surfaces remain client surfaces and must not become trust roots.

## Current Review Snapshot

Verification from the latest pass:

- `npm test`: 29 passing tests.
- `cargo test`: 4 passing Rust tests.
- `git diff --check`: clean.
- `git ls-files .aetherion target`: no tracked runtime/build artifacts.

## Phase Alignment Matrix

| Phase | Plan intent | Current code evidence | Verification evidence | Review status |
| --- | --- | --- | --- | --- |
| 1. TUI Kernel Loop | Prove local safe execution through workspace identity, event ledger, policy, lease, approval, file operation, verification, and replay. | Ether `run`, `replay`, and `trace`; stable path-derived workspace identity; schemas/examples for workspace registry, run manifest, risk, approval, and Replay Record; Rust and test-only TS event hash chains. | Harness and Ether tests cover approval-gated read/write, trace reconstruction, hash-chain validation, and replay records. | Runnable through the Rust supervisor by default. TypeScript authority is isolated behind `AETHERION_ALLOW_TYPESCRIPT_SEED=1` for tests. |
| 2. Rust Supervisor Boundary | Move authority proof toward Rust supervisor while keeping TS as client/orchestrator. | `crates/supervisor/src/lib.rs`, `crates/supervisor/src/main.rs`; `packages/harness-core/src/supervisor-client.ts`; `packages/harness-core/src/run-supervisor.ts`; default Ether `run`. Rust returns operation lease ids and appends SHA-256-linked events. | Rust unit tests cover wrong-path, expired lease, distinct lease ids, standard SHA-256 vector, and RPC JSON contents; Ether integration validates `chain_valid=true`. | Authority-boundary POC implemented and used by default. Long-running daemon, vault, and process sandbox remain pending. |
| 3. Memory OS MVP | Grow memory from source events, not opaque vector state. | `packages/memory-os/src/index.ts`; trace-derived candidates, episodic timeline, evidence-only user model, context pack; Ether memory/context commands and registries. | Memory OS tests require source events; Ether tests derive candidates from a real run, accept one, and select it in context explain. | MVP source-backed path implemented. Extraction and ranking remain narrow; missing evidence is not synthesized. |
| 4. Migration Dry-Run MVP | Import OpenClaw/Hermes shapes without inheriting trust or secrets. | `packages/migration/src/index.ts`; migration plan, legacy capsule, and extended migration report schemas/examples; TUI import dry-run. | Migration tests redact token-like fields and quarantine legacy material; TUI import test checks no raw token output. | Dry-run seed implemented. No real takeover by design. |
| 5. Sandbox Rehearsal and Branching | Turn audit into checkpoint, branch, isolated file rehearsal, and fresh-authority approval flow. | `packages/sandbox/src/index.ts`; checkpoint, branch, rehearsal, and sandbox-approval schemas/examples; Ether `checkpoint`, `branch`, `rehearse`, and `approve-rehearsal`; `.aetherion/sandboxes/<branch>/workspace/`; checkpoint/branch event id/hash pointers; Rust supervisor policy/write RPC. | Sandbox tests assert branch does not inherit live authority, copies checkpoint head pointers, rejects out-of-workspace/runtime-state targets, and leaves the real file unchanged; Ether integration verifies fresh Rust lease, exact live content, and new policy/action events after approval. | Local file temp-workspace rehearsal and approval implemented. Git worktree, external-system rollback, and branch-specific event streams remain pending. |
| 6. Capability Capsule MVP | Govern capabilities through lifecycle, permission diff, replay tests, sandbox trial, and legacy quarantine. | `packages/capability-os/src/index.ts`; Ether `capsule list/inspect`. | Capsule tests block publish without replay evidence and permission approval; Ether rejects test/publish because no real runner exists. | Contract inspection only. Replay runner, sandbox trial, and publish executor remain pending. |
| 7. Causal Memory and Counterfactual | Project evidence-linked relations and produce counterfactual reports without live actions or causal overclaiming. | `packages/causal-memory/src/index.ts`; causal edge and counterfactual schemas/examples; Ether why/counterfactual. | Tests require source-event citations, typed projection basis, explicit unknowns, and no live side effects. | Low-confidence typed event-sequence projection implemented. It does not claim proven causality; graph/SQLite projection remains pending. |
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
- `reconstructTrace` exposes `chain_valid`, `head_event_id`, and `head_event_hash` without replaying side effects.
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
- Capsule test/publish commands are unavailable until real replay and sandbox trial runners exist.
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
