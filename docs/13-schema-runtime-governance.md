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
- `boundary-facts`
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

P1 contracts support implemented but intentionally narrow local runtime slices. Changes here must cite source Ledger events or persisted registries with auditable Ledger provenance, and must not synthesize missing evidence.

- Memory OS: memory candidate, memory card, memory tombstone, memory patch, episodic timeline, user model, context pack.
- Capability OS: capability capsule, capability package, capsule install, migration plan/report, legacy capsule.
- Sandbox and branching: checkpoint, branch, rehearsal, sandbox approval.
- Causal reports: causal edge, causal projection, why report, counterfactual report.
- Hibernation: hibernation record, wakeup trigger.
- Security/surface slices: content assessment, poisoning signal, honeypot trial, poisoning regression fixture, browser observation, IM inbox/outbox, store package.

Gate for P1 changes:

- Show the command or module path that produces the contract from real Ledger evidence, or from registry evidence whose Ledger event references pass the read-only registry provenance audit.
- Add a negative test for missing source events, inherited authority, raw secrets, or live side-effect replay where relevant.
- Keep advanced behavior report-only or sandbox-only unless Rust supervisor authority exists.
- Do not treat a registry entry as rebuildable merely because it exists. `audit registries` checks reference strength only. `audit replay-records` and `audit memory-records` are scoped read-only rebuild/parity previews for Replay Records and active Memory Card/Tombstone projections. `audit payload-refs` checks whether Ledger `payload_ref` artifacts resolve locally and schema-validates known P0 artifact contracts, but it does not repair artifacts, rebuild registries, or make artifacts authoritative. Deterministic registry rebuild/parity for other registries remains future work.

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

The first loop is now closed for local file read/write through Ether and the Rust supervisor path. The next implementation work should harden or extend these loops before broadening schema surface:

1. Full action lifecycle in the Rust supervisor path. Workspace reads emit `tool.requested -> risk.composed -> policy.decided -> lease.issued -> tool.result`; approval-gated writes emit `tool.requested -> risk.composed -> policy.decided(ask) -> consent.recorded -> policy.decided(allow) -> lease.issued -> action.recorded -> observation.recorded -> verification.recorded -> run.completed`.
2. Trace-backed Memory Card lifecycle: real run trace to candidate, review, active card, context pack, and tombstone.
3. Trace-backed Capability Draft lifecycle: repeated successful traces to draft Capsule, replay tests, sandbox trial, and staged status without production execution.

The P1 Memory lifecycle event types `memory.candidate.created`, `memory.accepted`, `memory.rejected`, and `memory.blocked` are runtime-backed extensions, not speculative schema growth. Ether writes a Memory lifecycle artifact, asks the Rust supervisor to append the corresponding Ledger event with `payload_ref`, and only then updates the registry projection. `memory.deleted` remains the tombstone event for delete review.

Memory registry reads that assemble downstream context must not treat projections as source truth. `context explain`, `memory user-model`, and hibernation resume context assembly require Memory Card/Tombstone registry entries to pass the read-only registry provenance reference gate before use. Passing this gate means referenced Ledger event ids exist; it still does not prove deterministic registry rebuild parity. `.aetherion/memory/user-model.json` is a projection-only convenience copy derived from accepted Memory Cards.

`ether audit memory-records` provides the first scoped Memory parity preview. It walks Memory lifecycle Ledger events in order and reads `payload_ref` artifacts for `memory.accepted`, `memory.blocked`, and `memory.deleted` to reconstruct expected active `memory-cards` and `memory-tombstones` state. It is read-only, excludes pending/rejected candidates, does not repair registries, and does not perform artifact redaction.

For the action lifecycle, the default Ether supervisor path now writes a `run.started` event with a Boundary Facts `payload_ref` before the file-action lifecycle. That artifact records only the facts the kernel can prove today (`run_id`, `workspace_id`, `entry_surface`, and authority) and explicitly keeps `user_id`, `device_id`, `channel_id`, and `secret_vault` as `not_recorded`. It is not a full identity, pairing, channel, or vault system.

The default Ether supervisor path now uses Rust traced file-action RPCs for read, write prepare, and write commit. Those RPCs create the file-action Ledger events and return event ids for the run manifest projection. Ether still creates the user-intent event, approval card, and run manifest status; approved write consent, observation, and verification evidence now come from the Rust `file.write.commit` RPC. Ether builds and schema-validates the Consent Record JSON, then passes it with `artifact://consent/<run_id>/write`; Rust validates that the consent record binds to the run, workspace, and write request, writes the artifact under `.aetherion/artifacts/consent/<run_id>/`, and only then attaches the existing `consent.recorded` event to that `payload_ref`. Future work should keep moving authority-bearing lifecycle logic into Rust RPC methods before adding new action families.

Consent Record artifacts prove one approved local write request. They do not establish full user identity, device pairing, remote channel identity, a vault backend, or any reusable authority grant. Unapproved writes must not create a Consent Record artifact or a `consent.recorded` event.

`ether boundary <run_id>` may derive a read-only action matrix from those existing lifecycle events for TUI inspection. That matrix is a projection only: it must not add schema fields, append `boundary.*` events, write artifacts, mutate registries, or claim to be a durable per-action boundary card.

`ether audit payload-refs` may inspect Ledger `payload_ref` values and resolve known local `artifact://` paths for Boundary Facts, Consent Records, Replay Records, and generic Ether artifacts. It may schema-validate Boundary Facts, Consent Records, and Replay Records using the existing contracts; unsupported or generic artifacts remain `not_checked`. It is a read-only visibility pass: it must not append events, write or repair artifacts, mutate registries, or imply that referenced artifacts grant authority.

## Node Baseline

The package currently requires Node `>=25` because the test runner executes TypeScript files directly with `node --test`. Lowering the baseline to Node `>=22` is desirable for contributor ergonomics, but it should happen together with an explicit TypeScript runner or build step. Do not change the engine field alone unless the full test suite is verified on the lower baseline.
