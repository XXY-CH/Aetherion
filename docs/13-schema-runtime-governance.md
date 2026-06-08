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
- For `workspace-registry`, derive workspace identity, runtime directory, and Ledger path from the resolved workspace root at load time. Registry fields must match those derived values; they cannot redirect the kernel to a different Ledger or workspace id. The Rust supervisor RPC boundary must reject caller-provided workspace ids that do not match the resolved root before creating runtime state.

### P1: Trace-Backed Product Runtime

P1 contracts support implemented but intentionally narrow local runtime slices. Changes here must cite source Ledger events or persisted registries with auditable Ledger provenance, and must not synthesize missing evidence.

- Memory OS and local prompt assembly: memory candidate, memory card, memory tombstone, memory patch, episodic timeline, user model, context pack, prompt plan preview, prompt response audit preview.
- Capability OS: capability capsule, capability package, capsule install, migration plan/report, legacy capsule.
- Sandbox and branching: checkpoint, branch, rehearsal, sandbox approval.
- Causal reports: causal edge, causal projection, why report, counterfactual report.
- Hibernation: hibernation record, wakeup trigger.
- Security/surface slices: content assessment, poisoning signal, honeypot trial, poisoning regression fixture, browser observation, IM inbox/outbox, store package.

Gate for P1 changes:

- Show the command or module path that produces the contract from real Ledger evidence, or from registry evidence whose Ledger event references pass the read-only registry provenance audit.
- Add a negative test for missing source events, inherited authority, raw secrets, or live side-effect replay where relevant.
- Keep advanced behavior report-only or sandbox-only unless Rust supervisor authority exists.
- Do not treat a registry entry as rebuildable merely because it exists. `audit registries` checks reference strength only. `audit replay-records`, `audit memory-records`, and `audit capsule-records` are scoped read-only rebuild/parity previews for Replay Records, active Memory Card/Tombstone projections, and Capsule lifecycle projections. `audit payload-refs` checks whether Ledger `payload_ref` artifacts resolve locally and schema-validates known P0 artifacts, Memory lifecycle snapshots, Dream fold snapshots, persona anchor/reset snapshots, Soul Fork snapshots, child agent contract/result/budget/circuit snapshots, Security scan/ack/trial/fixture snapshots, Surface browser/IM snapshots, Store install snapshots, and Capsule draft/test/publish/rollback snapshots, but it does not repair artifacts, rebuild registries, or make artifacts authoritative. Deterministic registry rebuild/parity for remaining registry families remains future work.
- If a registry-driven P1 path can reach a live side effect, registry provenance is not enough. The command must immediately revalidate the source Ledger events, required artifact or file evidence, and target binding before requesting Rust supervisor authority. For sandbox promotion, checkpoint, branch, and rehearsal registry rows cannot authorize `approve-rehearsal` by themselves.

### P2: Frozen Innovation Contracts

P2 contracts encode strategic direction but should not expand until a P0/P1 runtime loop needs them.

- Soul Fork and inheritance policy beyond the current authority-free local fork container.
- Persona branches and memory folds beyond the current local reviewable lifecycle.
- Multi-agent scores, deterministic budget/circuit rebuild parity, and child orchestration beyond the current document-read executor.
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

The first loop is now closed for local file reads and approval-gated traced writes through Ether and the Rust supervisor path. The next implementation work should harden or extend these loops before broadening schema surface:

1. Full action lifecycle in the Rust supervisor path. Workspace reads emit `tool.requested -> risk.composed -> policy.decided -> lease.issued -> tool.result`; approval-gated writes emit `tool.requested -> risk.composed -> policy.decided(ask) -> consent.recorded -> policy.decided(allow) -> lease.issued -> action.recorded -> observation.recorded -> verification.recorded -> run.completed`.
   Legacy policy-only RPCs, direct `file.read`, direct `file.write`, and CLI direct reads must remain disabled unless they are replaced by traced equivalents that emit the required lifecycle evidence. Generic `event.append` must not be allowed to write authority-bearing action lifecycle events such as `tool.requested`, `policy.decided`, `lease.issued`, `consent.recorded`, `action.recorded`, `observation.recorded`, or `verification.recorded`; those events must come from dedicated supervisor RPC paths that perform or deny the corresponding policy, lease, consent, action, observation, or verification step.
2. Trace-backed Memory Card lifecycle: real run trace to candidate, review, active card, context pack, and tombstone.
3. Trace-backed Capability Draft lifecycle: repeated successful traces to draft Capsule, replay tests, sandbox trial, and staged status without production execution.

The P1 Memory lifecycle event types `memory.candidate.created`, `memory.accepted`, `memory.rejected`, and `memory.blocked` are runtime-backed extensions, not speculative schema growth. Ether writes a Memory lifecycle artifact, asks the Rust supervisor to append the corresponding Ledger event with `payload_ref`, and only then updates the registry projection. `memory.deleted` remains the tombstone event for delete review.

Memory registry reads that assemble downstream context must not treat projections as source truth. `context explain`, `prompt plan`, `prompt audit`, `memory user-model`, and hibernation resume context assembly require Memory Card/Tombstone registry entries to pass the read-only registry provenance reference gate before use. Passing this gate means referenced Ledger event ids exist; it still does not prove deterministic registry rebuild parity. After provenance passes, Context Pack assembly must apply deletion, context block, secret, and disallowed-confidential exclusions before relevance ranking. Eligible Memory Cards may be deterministically ordered by confidence, source evidence, estimated prompt footprint, and stable id, then trimmed to the Context Pack memory-token budget with overflow recorded as excluded context. Memory Card `contradicts` references may be projected into Context Pack `conflicts` when selected memory points at selected, excluded, or missing memory ids. These conflict strings are prompt-planning warnings, not semantic contradiction proof or registry repair instructions. These budget estimates are local prompt-planning limits, not measured model token usage. `.aetherion/memory/user-model.json` is a projection-only convenience copy derived from accepted Memory Cards.

`prompt plan` and `prompt audit` are P1 Agent Orchestrator previews, not authority paths. `prompt plan` may assemble a rendered prompt from a source-backed Context Pack, task text, Ledger event envelopes for the selected run, Context Pack Capability Card ids, Context Pack token budgets, tool request policy, active permissions, taint warnings, instruction hierarchy, assembly manifest, readiness summary, citation map, response-audit contract, static response format, and conservative planner/verifier checklists. It may also emit system/developer/user message bundles for future model-backed planning, but source evidence, memory context, and excluded context must stay in the user-context message and cannot override system or developer constraints. `prompt audit` may read one workspace-local response file and compare it against the same provenance-gated prompt plan for required blocks, required source event citations, unknown source event ids, and forbidden model/tool/raw-payload/runtime-authority/completion claims. The assembly manifest may summarize included/excluded context, guardrails, and risk flags, but it is audit metadata only and must not be treated as a source of authority. The readiness summary may report missing evidence, warnings, and next steps for model-preview suitability, but it is not a verification result, runtime status, or permission gate. The citation map may record run-event and Memory Card source ids that future model outputs must cite for memory-derived claims, but it is not a new source of truth and must not imply raw payload contents were read. The response format and response audit contract may define required answer/plan/patch blocks, forbidden claims, completion rules, and citation checks, but they are prompt guidance and local output linting only and must not be treated as executable planning, runtime verification, or authority. These paths must not call a model, request or execute tools, read raw payload artifacts, append Ledger events, persist prompt artifacts, or imply that prompt text can authorize an action. Capability Cards in prompt context describe candidate abilities only and cannot grant runtime permissions. Context budget values are planning limits only, not measured model usage. Any future model-backed planner must keep tool use behind Local Supervisor policy and scoped lease evidence.

`ether audit memory-records` provides the first scoped Memory parity preview. It walks Memory lifecycle Ledger events in order and reads `payload_ref` artifacts for `memory.accepted`, `memory.blocked`, and `memory.deleted` to reconstruct expected active `memory-cards` and `memory-tombstones` state. It is read-only, excludes pending/rejected candidates, does not repair registries, and does not perform artifact redaction.

`ether audit capsule-records` provides a scoped Capsule lifecycle parity preview. It walks `capsule.draft.recorded`, `capsule.test.recorded`, `capsule.publish.recorded`, and `capsule.rollback.recorded` Ledger events in order, reads their `payload_ref` artifacts, and reconstructs expected `capsules`, `capsule-drafts`, and `capsule-versions` state. It is read-only, does not publish, roll back, repair, sign, execute playbooks, or grant Capsule runtime permissions.

Sandbox promotion is the current P1 live-side-effect exception and therefore has a stricter preflight. `approve-rehearsal` may use checkpoint, branch, and rehearsal registries to locate candidate state, but before creating a promotion run it must revalidate the checkpoint Ledger event id/hash, branch source/head pointers, branch sandbox status, sandbox path binding, current target content hash, and proposed sandbox content hash. Drift fails before any `run_rehearsal_*` manifest, supervisor write authority request, or live file write.

For the action lifecycle, the default Ether supervisor path now writes a `run.started` event with a Boundary Facts `payload_ref` before the file-action lifecycle. That artifact records only the facts the kernel can prove today (`run_id`, `workspace_id`, `entry_surface`, and authority) and explicitly keeps `user_id`, `device_id`, `channel_id`, and `secret_vault` as `not_recorded`. It is not a full identity, pairing, channel, or vault system.

The default Ether supervisor path now uses Rust traced file-action RPCs for read, write prepare, and write commit. Those RPCs create the file-action Ledger events and return event ids for the run manifest projection. Ether still creates the user-intent event, approval card, and run manifest status; approved write consent, observation, and verification evidence now come from the Rust `file.write.commit` RPC. Ether builds and schema-validates the Consent Record JSON, then passes it with `artifact://consent/<run_id>/write`; Rust validates that the consent record binds to the run, workspace, and write request, writes the artifact under `.aetherion/artifacts/consent/<run_id>/`, and only then attaches the existing `consent.recorded` event to that `payload_ref`. When the run is invoked through an explicit supervisor socket, Ether must keep that same socket transport and optional auth token for every supervisor RPC in the lifecycle, including the approved write commit; it must not silently fall back to the default stdio path for late lifecycle steps. Future work should keep moving authority-bearing lifecycle logic into Rust RPC methods before adding new action families.

Run manifest `event_ids` are a Ledger projection, not an independent event list. Runtime code may only create a run manifest when no manifest already exists for that run id, may only record the next unrecorded Ledger event for the manifest run, and the manifest workspace id plus every projected event workspace id must match the active workspace before projection or completion can proceed. Loading a run manifest must reject files whose embedded run id does not match the requested run id or whose workspace id does not match the active workspace. A run manifest may enter a terminal status only after its `event_ids` exactly match the current Ledger event order for that run; terminal status must not hide unprojected Ledger evidence.

V1 `run`, `trace`, and `replay` output must expose the run manifest projection and Ledger artifact evidence directly: `manifest_status`, `manifest_events`, `manifest_event_ids`, `artifact_refs`, and `artifact_ref_count`. `replay` must persist its Replay Record through an independent `run_replay_*` manifest and supervisor-authored `replay.recorded` Ledger event, then print the replay run id, replay event id, and Replay Record artifact ref. These are visibility outputs only; they do not make manifests, registries, or artifacts authoritative. Missing manifests may be reported as `missing` for Ledger-only trace reconstruction, but tampered manifests must fail closed instead of being downgraded to missing.

Replay paths must not expose a weak success response that only says no live side effects were replayed. The legacy Rust `trace.replay` RPC remains disabled unless it is replaced by a Ledger-backed path that reads source events, validates the hash chain, persists a schema-valid Replay Record artifact, appends `replay.recorded`, and projects the independent replay run manifest.

Completed P0 local-file run manifests must match the expected Ledger event sequence before they can leave `running`. Approved kernel runs require the full read plus write lifecycle through `verification.recorded -> run.completed`; blocked unapproved writes require the read lifecycle plus write-prepare ask and `run.completed`. Approved sandbox promotion runs use their own fixed write-prepare/write-commit sequence. Replay persistence runs must contain exactly one `replay.recorded` event. Queue-only hibernation resume runs must contain exactly `policy.decided -> wakeup.queued`, both without `payload_ref`, and must complete `blocked` because no lease, task action, or automatic resume is executed. Security scan runs must contain `policy.decided -> security.content.assessed` for clean assessments or `policy.decided -> security.content.assessed -> poisoning.detected` for suspicious assessments; the policy event must have no `payload_ref`, the assessment and signal events must bind to their scan artifact refs, and suspicious scans complete `blocked`. Browser observation runs must contain exactly `policy.decided -> browser.observation.ingested`; the policy event must have no `payload_ref`, the observation event must bind to `artifact://surface/browser-observe/<observation_id>`, and the run completes `completed` because it records a hash-only current-tab observation without issuing a lease or executing browser automation. IM outbox runs must contain exactly `policy.decided -> im.outbox.queued`; the policy event must have no `payload_ref`, the queued item event must bind to `artifact://surface/im-outbox/<item_id>`, DM/group queued items complete `blocked`, and public blocked items complete `completed`; neither path issues a lease or attempts delivery. Child-read success runs must contain exactly `agent.child.started -> tool.requested -> risk.composed -> policy.decided -> lease.issued -> tool.result -> agent.child.completed`, with the start event bound to the Agent Contract artifact and the completion event bound to the Child Result artifact. Child-read policy-denial runs must contain exactly `agent.child.started -> tool.requested -> risk.composed -> policy.decided -> tool.result -> agent.child.policy_denied`, with no `lease.issued`, the start event bound to the Agent Contract artifact, and the denial event bound to a Budget Account artifact. Repeated policy denial adds one terminal `circuit.opened` event bound to the Circuit Breaker artifact. Ether `run_governance_*` helper runs must contain exactly one supervisor-authored governance event, and that event type must match the helper call. Any remaining run families keep using their own completion semantics until they have similarly explicit lifecycle contracts.

Where a fixed lifecycle has a critical evidence artifact, manifest completion must also bind the event to the expected `payload_ref`: `run.started` to `artifact://boundary/<run_id>/facts`, `consent.recorded` to `artifact://consent/<run_id>/write`, replay persistence to `artifact://replay/<source_run_id>/trace`, browser observation ingestion to `artifact://surface/browser-observe/<observation_id>`, IM outbox queueing to `artifact://surface/im-outbox/<item_id>`, child-read start to `artifact://agent/contract/<contract_id>`, child-read success to `artifact://agent/execute/<child_result_id>`, child-read policy denial to `artifact://agent/execute/<budget_account_snapshot_id>`, repeated-denial breaker opening to `artifact://agent/execute/<circuit_breaker_id>`, and single-event governance helpers to the artifact ref passed by the helper. This validates evidence binding at the projection boundary. It does not make the artifact authoritative, and it does not replace schema validation or source-specific checks of the artifact JSON.

Consent Record artifacts prove one approved local write request. They do not establish full user identity, device pairing, remote channel identity, a vault backend, or any reusable authority grant. Unapproved writes must not create a Consent Record artifact or a `consent.recorded` event.

`ether boundary <run_id>` may derive a read-only action matrix from those existing lifecycle events for TUI inspection. That matrix is a projection only: it must not add schema fields, append `boundary.*` events, write artifacts, mutate registries, or claim to be a durable per-action boundary card.

`ether audit payload-refs` may inspect Ledger `payload_ref` values and resolve known local `artifact://` paths for Boundary Facts, Consent Records, Replay Records, Memory lifecycle snapshots, Dream fold snapshots, persona anchor/reset snapshots, Soul Fork snapshots, child agent contract/result/budget/circuit snapshots, Security scan/ack/trial/fixture snapshots, Surface browser/IM snapshots, Store install snapshots, Capsule lifecycle snapshots, and generic Ether artifacts. It may schema-validate Boundary Facts, Consent Records, Replay Records, Memory Candidate/Card/Tombstone snapshots, Memory Fold, Persona Anchor, Persona Reset, Soul Fork, Agent Contract, Child Result, Budget Account, Circuit Breaker, Content Assessment, Poisoning Signal, Honeypot Trial, Poisoning Regression Fixture, Browser Observation, IM Inbox Item, IM Outbox Item, Capsule Install, and Capsule draft/test/publish/rollback snapshots using the existing contracts; unsupported or generic artifacts remain `not_checked`. It is a read-only visibility pass: it must not append events, write or repair artifacts, mutate registries, lift quarantine, deliver IM, execute package code, or imply that referenced artifacts grant authority.

## Node Baseline

The package currently requires Node `>=25` because the test runner executes TypeScript files directly with `node --test`. Lowering the baseline to Node `>=22` is desirable for contributor ergonomics, but it should happen together with an explicit TypeScript runner or build step. Do not change the engine field alone unless the full test suite is verified on the lower baseline.
