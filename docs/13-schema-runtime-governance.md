# Schema Runtime Governance

Aetherion has enough product imagination captured in contracts. New work should now bias toward closing runtime loops rather than expanding schema surface area.

## Principle

- A schema is not a feature.
- A projection is not a source of truth.
- A fixture is not runtime evidence.
- A client surface is not an authority boundary.

Every schema must be assigned a runtime tier. The tier decides how strictly new fields, commands, and examples must be tied to executable behavior.

## Tiers

### P0: Kernel Runtime Contracts

P0 contracts are required for the current Ether + Rust supervisor kernel loop. Changes here must include schema/example validation plus runtime or replay tests.

- `event`
- `workspace-registry`
- `run-manifest`
- `tool-request`
- `risk-composition`
- `policy-decision`
- `scoped-lease`
- `approval-card`
- `consent-record`
- `action-record`
- `observation-record`
- `verification-record`
- `replay-record`
- `permission-policy`

Gate for P0 changes:

- Prove a real Ether or supervisor path writes or consumes the contract.
- Prove negative policy behavior, not only happy path validation.
- Prove replay does not execute live side effects.

### P1: Trace-Backed Product Runtime

P1 contracts support implemented but intentionally narrow local runtime slices. Changes here must cite source Ledger events or persisted registries and must not synthesize missing evidence.

- Memory OS: memory candidate, memory card, memory tombstone, memory patch, episodic timeline, user model, context pack.
- Capability OS: capability capsule, capability package, capsule install, migration plan/report, legacy capsule.
- Sandbox and branching: checkpoint, branch, rehearsal, sandbox approval.
- Causal reports: causal edge, causal projection, why report, counterfactual report.
- Hibernation: hibernation record, wakeup trigger.
- Security/surface slices: content assessment, poisoning signal, honeypot trial, poisoning regression fixture, browser observation, IM inbox/outbox, store package.

Gate for P1 changes:

- Show the command or module path that produces the contract from real Ledger or registry evidence.
- Add a negative test for missing source events, inherited authority, raw secrets, or live side-effect replay where relevant.
- Keep advanced behavior report-only or sandbox-only unless Rust supervisor authority exists.

### P2: Frozen Innovation Contracts

P2 contracts encode strategic direction but should not expand until a P0/P1 runtime loop needs them.

- Soul Fork and inheritance policy.
- Persona anchors, persona branches, persona reset, and memory folds beyond current local lifecycle.
- Multi-agent contracts, budgets, accounts, circuit breakers, child results, scores beyond the current document-read executor.
- Computer-use action/observation beyond governed contract planning.
- Future GUI, browser automation, extension, connector, and remote Store contracts.

Gate for P2 changes:

- Prefer no schema changes.
- If a field must change, explain which P0/P1 runtime loop forced it.
- Do not add commands that imply real automation, delivery, vault access, connector takeover, or package execution.

## Computer-Use Boundary

Computer-use schemas are currently P2 contracts with P1-style validation tests. The allowed work is contract hardening only:

- Adapter manifests must be requirements-gated and source-event-backed.
- Browser targets remain current-tab scoped.
- Observations remain non-authorizing.
- Side-effect actions require policy, scoped lease, approval card, exact approval keys, and verifier evidence.

Real click/type/browser/desktop automation must wait until the Local Supervisor exposes a governed action gateway for that adapter family.

## Runtime Focus

The next implementation work should close three loops before broadening schema surface:

1. Full action lifecycle in the Rust supervisor path: `tool.requested -> risk.composed -> policy.decided -> consent.recorded -> lease.issued -> action.recorded -> observation.recorded -> verification.recorded -> run.completed`.
2. Trace-backed Memory Card lifecycle: real run trace to candidate, review, active card, context pack, and tombstone.
3. Trace-backed Capability Draft lifecycle: repeated successful traces to draft Capsule, replay tests, sandbox trial, and staged status without production execution.

## Node Baseline

The package currently requires Node `>=25` because the test runner executes TypeScript files directly with `node --test`. Lowering the baseline to Node `>=22` is desirable for contributor ergonomics, but it should happen together with an explicit TypeScript runner or build step. Do not change the engine field alone unless the full test suite is verified on the lower baseline.
