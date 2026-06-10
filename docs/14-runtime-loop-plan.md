# Runtime Loop Plan

This is the working loop for moving Aetherion from contract-backed slices toward a stronger local runtime without drifting into deferred product surfaces.

## Source Alignment

- `docs/06-roadmap.md` keeps V1 TUI-first and expects the Local Supervisor, Event Ledger, policy, scoped lease, local file action, observation, verification, and replay loop before GUI, IM, browser, MCP/OAuth, or cloud workers.
- `docs/10-technical-strategy.md` assigns authority, policy, vault, ledger, and native execution to Rust while keeping the Agent Orchestrator prototype in TypeScript.
- `docs/13-schema-runtime-governance.md` says new work should close runtime loops before expanding schema surface, and that runtime/projection evidence must not become authority by convenience.
- `crates/supervisor/README.md` still marks production daemon lifecycle and stale runtime-lock recovery as out of scope.

## Loop

1. Plan against the current docs and code evidence before selecting a development slice.
2. Implement one runtime-closing slice that can be tested without expanding V1 surfaces.
3. Verify with the smallest test set that proves the slice plus the broader guardrails.
4. Review the result against the source docs and record any remaining boundary.

## Completed Increment: Runtime Lock Liveness

Target: supervisor runtime status should expose whether a foreground supervisor runtime lock points at a live, missing, unknown, or invalid owner process.

Why this slice:

- It advances the daemon-readiness path without claiming a production daemon exists.
- It reuses the existing Rust PID liveness check already used for Ledger append locks.
- It is read-only: status must not append Ledger events, repair lock files, remove stale locks, or grant authority.

Acceptance:

- `supervisor.status` returns process liveness and stale status for `.aetherion/supervisor.lock`.
- TUI `supervisor status` prints the new fields.
- Existing no-lock and live-lock status paths remain read-only.
- A stale lock is reported as evidence for operators, not repaired automatically.

Next likely increment after this one:

- Choose between typed supervisor lifecycle commands (`supervisor start/status/stop` preflight semantics) or a small durable queue/wake runtime slice, based on the same docs review.

## Completed Increment: Supervisor Lifecycle Preflight

Target: add a read-only `ether supervisor preflight` surface that classifies supervisor lifecycle readiness from the existing status evidence.

Why this slice:

- It is the next typed lifecycle step after raw runtime-lock status.
- It gives operators a stable state and next-step summary before any future start/stop/recover command exists.
- It avoids pretending Aetherion has a production daemon, service manager, process killer, or lock repair path.

Acceptance:

- `supervisor preflight` calls the existing status RPC and appends no Ledger events.
- The output classifies no lock, live foreground socket, stale lock, unknown lock, invalid/mismatched lock, and malformed lock states.
- The command reports that daemon start, stop, and lock repair are unsupported in this POC.
- Docs state that preflight is visibility only and cannot grant authority or mutate runtime state.

## Completed Increment: Wakeup Eligibility Preview

Target: add a read-only `ether sleepers --check-wakeups` preview that evaluates persisted hibernation triggers without queueing or mutating runtime state.

Why this slice:

- It is the next queue-runtime step after explicit `wake <trigger>` because operators need to see which sleepers are eligible before asking the supervisor for queue policy.
- It reuses the existing deterministic `evaluateWakeup` rules instead of adding a daemon or scheduler.
- It keeps trigger evaluation separate from queueing: preflight can observe, but only `wake` may request fresh policy and append `wakeup.queued`.

Acceptance:

- `sleepers --check-wakeups` reports hibernation count, trigger count, per-trigger evaluated status, and eligible trigger ids.
- The command does not update hibernation/wakeup registries, append Ledger events, call `run.resume.evaluate`, issue leases, or resume task actions.
- Docs state that the preview is an operator planning surface, not a scheduler or queue.

Next likely increment after this one:

- Re-read `docs/13-schema-runtime-governance.md` and choose between resume Context Pack parity, trace-backed Memory lifecycle hardening, or trace-backed Capability Draft lifecycle hardening.

## Completed Increment: Resume Context Tombstone Parity

Target: make `ether sleep` assemble its minimal resume Context Pack through the same Memory Card/Tombstone provenance and deletion-exclusion path used by `context explain` and `prompt plan`.

Why this slice:

- It closes the hibernation resume-context parity gap called out by `docs/13-schema-runtime-governance.md` without adding a daemon, scheduler, or automatic resume executor.
- It keeps Memory tombstones as first-class context-exclusion evidence, so stale Memory Card projections cannot re-enter a suspended run's resume packet.
- It hardens the queue/runtime path that follows `sleepers --check-wakeups`: wake eligibility and queueing stay separate, while the stored resume context is now safer.

Acceptance:

- `sleep` requires both `memory-cards` and `memory-tombstones` registry entries to pass the read-only Ledger provenance reference gate before context assembly.
- `sleep` passes tombstones into `assembleContextPack`, so deleted Memory Cards are recorded as excluded context instead of selected resume memory.
- Weak or missing tombstone source events fail closed before hibernation records, wakeup records, Ledger events, leases, or resume actions are created.
- Docs continue to state that resume Context Packs are projection evidence only and cannot authorize task continuation.

Next likely increment after this one:

- Choose between deeper trace-backed Memory lifecycle hardening, trace-backed Capability Draft lifecycle hardening, or explicit lifecycle contracts for one remaining run family.

## Completed Increment: Child Pre-Execution Breaker Lifecycle

Target: make `ether agent execute` complete permission-violation and execution-budget-exhausted child runs through an explicit pre-supervisor breaker lifecycle.

Why this slice:

- It closes one of the remaining run-family lifecycle gaps documented in `docs/13-schema-runtime-governance.md` and `docs/12-phase-implementation-review.md`.
- These failures happen before the child read asks the Rust supervisor for `tool.requested`, policy, lease, or result evidence, so the correct minimal lifecycle is smaller than success or policy-denial child reads.
- It strengthens terminal manifest evidence without adding general LLM orchestration, child writes, network tools, or new schemas.

Acceptance:

- Pre-supervisor child breakers must complete only as `agent.child.started -> circuit.opened`.
- The start event must bind to the Agent Contract artifact and the breaker event must bind to the Circuit Breaker artifact.
- The lifecycle must contain no `tool.requested`, `risk.composed`, `policy.decided`, `lease.issued`, `tool.result`, or child completion/denial event.
- Real TUI permission-violation and exhausted-budget executions produce blocked manifests with exactly this sequence.

Remaining boundary:

- Timeout and supervisor-failure child breakers can occur after an RPC has partially emitted supervisor events. The next increment below closes the observed-prefix manifest lifecycle for those cases.

Next likely increment after this one:

- Choose between timeout/supervisor-failure child breaker lifecycle contracts, trace-backed Capability Draft lifecycle hardening, or deeper Memory lifecycle hardening.

## Completed Increment: Child Post-Supervisor Breaker Lifecycle

Target: make `ether agent execute` complete timeout, supervisor-failure, and runtime-accounting child breakers through an explicit lifecycle that preserves any supervisor Ledger facts already written for the child run.

Why this slice:

- It closes the remaining child breaker lifecycle gap called out by `docs/13-schema-runtime-governance.md` and the Phase 36 review notes.
- These failures happen after Ether attempts the Rust supervisor child-read RPC, so the correct lifecycle must not erase supervisor-authored request/risk/policy/lease/result facts that may already exist in the Ledger.
- It strengthens terminal manifest evidence without adding a daemon, general LLM orchestration, child writes, network tools, or new schemas.

Acceptance:

- Post-supervisor child breakers complete as `agent.child.started -> <observed supervisor child-read prefix> -> circuit.opened`.
- The observed prefix must be a valid child-read lifecycle prefix: empty, request-only, request/risk, request/risk/policy, request/risk/policy/lease, full allowed read, or full denied read.
- The start event must bind to the Agent Contract artifact and the breaker event must bind to the Circuit Breaker artifact.
- Real TUI runtime-accounting exhaustion after a Rust-supervised child read produces a blocked manifest with the full supervisor read prefix before `circuit.opened`.

Remaining boundary:

- Failed RPC responses still do not return structured partial event ids. Ether can only reconstruct supervisor events that are already durably present in the Ledger for that child run before it appends the breaker.
- This does not add queue/ask exhaustion behavior, exact supervisor-process CPU accounting, child writes, network tools, or general child-agent orchestration.

Next likely increment after this one:

- Choose between trace-backed Capability Draft lifecycle hardening, deeper Memory lifecycle hardening, or a narrow durable queue/runtime slice, based on a fresh docs/code review.

## Completed Increment: Capsule Proposal From Passing Traces

Target: add a proposal-only `ether capsule propose` surface that derives a document-only Capsule draft manifest from at least two passing trace replay previews.

Why this slice:

- It advances the trace-backed Capability Draft lifecycle called out in `docs/13-schema-runtime-governance.md` without turning repeated behavior into an active Capsule automatically.
- It keeps the proposal before the existing draft/test/publish lifecycle, so repeated traces can suggest a reviewable manifest while `capsule draft` still owns Ledger-backed lifecycle recording.
- It gives operators a narrow bridge from real run evidence to governed Capsule review without executing the playbook, granting permissions, or mutating Capsule registries.

Acceptance:

- `capsule propose` requires two distinct successful replay records derived from existing Ledger events.
- The command writes only a workspace-local manifest outside `.aetherion`, and it appends no Ledger events, writes no registries, persists no replay artifacts, and executes no playbook.
- The generated manifest remains `document_only`, requires `filesystem.read`, forbids `filesystem.write`, cites source runs/events, and can then pass through the existing `capsule draft -> test -> publish` gates.
- Path escape attempts, runtime-state output paths, missing playbook input, missing repeated provenance, and failed/partial replay records fail closed before any proposal file is written.

Remaining boundary:

- Proposal generation still uses deterministic defaults for document-only Capsules. It does not infer arbitrary tool contracts, risk levels, permission expansions, or executable Capsule behavior from traces.

Next likely increment after this one:

- Choose between deeper Capsule proposal typing, trace-backed Memory lifecycle hardening, or a narrow durable queue/runtime slice after another docs/code review.

## Completed Increment: Agent Runtime Invocation Artifact

Target: turn the existing Agent Runtime Invocation scaffold into a schema-valid local artifact shape for future runtime binding evidence.

Why this slice:

- It closes the first Agent Orchestrator runtime-contract gap without calling a model, requesting tools, appending Ledger events, or introducing a daemon.
- It gives future `agent.runtime.bound` work a durable metadata contract for ids, hashes, context refs, authority gates, tool gateway limits, response-audit requirements, fail-closed conditions, and missing-evidence stages.
- It keeps prompt text and raw memory prose out of durable runtime metadata while still making prompt assembly auditable by hash.

Acceptance:

- `agent-runtime-invocation.schema.json` and its example validate with the existing contract examples.
- Harness artifact helpers write/read `.aetherion/artifacts/agent/runtime/<invocation_id>.json` and return `artifact://agent/runtime/<invocation_id>`.
- `audit payload-refs` resolves `agent.runtime.bound` refs and schema-validates Agent Runtime Invocation artifacts without mutating Ledger, artifacts, or registries.
- Orchestrator artifact creation deep-copies runtime metadata and does not serialize prompt previews, messages, sections, task text, run summaries, memory reasons, or excluded-context reasons.

Remaining boundary:

- The artifact is not a model request, model response, runtime status, verification result, permission gate, or authority grant.

Next likely increment after this one:

- Bind this artifact through a supervisor-authored Ledger event before adding any provider or model request path.

## Completed Increment: Agent Runtime Binding Event

Target: make Agent Runtime Invocation metadata bindable through the TUI and Event Ledger without invoking a model, requesting tools, or granting authority.

Why this slice:

- It closes the first Agent Orchestrator runtime-binding evidence gap while staying inside V1 TUI-first boundaries.
- It lets the Ledger point at a schema-valid runtime metadata artifact through `agent.runtime.bound` instead of leaving the binding step as prose.
- It keeps the source run immutable by recording binding evidence in an independent single-event governance run.

Acceptance:

- `prompt bind-runtime <run_id> --content <task>` reuses the same Memory provenance gate and prompt assembly path as `prompt plan` and `prompt audit`.
- The command writes `.aetherion/artifacts/agent/runtime/<invocation_id>.json`, returns `artifact://agent/runtime/<invocation_id>`, and appends a supervisor-authored `agent.runtime.bound` event with that `payload_ref`.
- The binding run manifest completes with only the `agent.runtime.bound` event; the source run is not extended after completion.
- TUI tests assert the artifact contains only ids, hashes, refs, budgets, gates, and stage metadata, with no rendered prompt preview, messages, sections, task prose, run summary, or memory prose.
- `audit payload-refs` resolves the binding event payload and schema-validates the Agent Runtime Invocation artifact.

Remaining boundary:

- The binding event is not a model request, model response, runtime status, verification result, permission gate, policy decision, lease, or authority grant.
- No provider config, model invocation loop, tool proposal loop, daemon, IM/browser connector, OAuth/MCP connector, or vault path exists yet.

Next likely increment after this one:

- Define a no-tools provider preview loop behind the existing runtime binding and model metadata artifacts, or harden trace-backed Memory lifecycle parity before widening runtime behavior.

## Completed Increment: Agent Model Request/Response Artifacts

Target: define schema-valid metadata artifacts for future model request and response evidence without calling a provider or widening tool authority.

Why this slice:

- It adds the next Agent runtime contract directly behind `agent.runtime.bound`, where the real loop will need auditable request and response evidence.
- It keeps raw prompt text, raw context prose, raw provider payloads, raw model output, credentials, and tool execution out of durable metadata.
- It lets `audit payload-refs` validate `agent.model.requested` events and future `agent.model.responded` events before any provider loop exists.

Acceptance:

- `agent-model-request.schema.json` and `agent-model-response.schema.json` plus their examples validate with the existing contract examples.
- Harness artifact helpers write/read `.aetherion/artifacts/agent/model-request/<request_id>.json` and `.aetherion/artifacts/agent/model-response/<response_id>.json`.
- `audit payload-refs` resolves `artifact://agent/model-request/<request_id>` for `agent.model.requested` and `artifact://agent/model-response/<response_id>` for `agent.model.responded`, then schema-validates the artifacts.
- Tests reject request/response artifacts that persist raw prompt/response authority flags, declare tools, allow tool execution, treat model output as authorization, or present unaudited response output as verified runtime evidence.

Remaining boundary:

- These artifacts do not configure providers, resolve vault credentials, perform network calls, invoke models, append tool requests, issue leases, execute tools, pass response audit, or grant runtime authority.

Next likely increment after this one:

- Produce no-tools model-request metadata behind `prompt bind-runtime`, then choose between response-side evidence handling and trace-backed Memory lifecycle parity.

## Completed Increment: Agent Model Request Preparation

Target: make `prompt prepare-model-request <invocation_id>` create no-tools Agent Model Request metadata only after a runtime invocation has already been bound through `agent.runtime.bound`.

Why this slice:

- It advances the runtime evidence chain behind `prompt bind-runtime` without calling a provider, configuring credentials, invoking a model, or persisting raw prompt text.
- It turns `agent.model.requested` from a future payload-ref audit shape into a TUI-produced supervisor-authored Ledger event.
- It keeps the response side honest: the current response schema represents a real provider/model response, so this increment does not create `agent.model.responded` events or response artifacts.

Acceptance:

- `prompt prepare-model-request <invocation_id>` requires an existing Agent Runtime Invocation artifact plus matching `agent.runtime.bound` Ledger evidence.
- The command writes a schema-valid request artifact under `artifact://agent/model-request/<request_id>` and records an independent single-event `agent.model.requested` run.
- The request artifact records prompt/message hashes, context refs, response expectations, no-tools mode, and authority gates only; it records `provider_called=false`, `network_call_attempted=false`, `tools_requested=false`, and no raw prompt/context payload.
- `audit payload-refs` resolves and schema-validates the new request event payload.

Remaining boundary:

- No provider is configured, no model is invoked, no credential is resolved, no network call is attempted, no tool request or lease is emitted, and no Agent Model Response artifact is created.

Next likely increment after this one:

- Add a real provider-call preparation gate plus response-audit handling, or harden trace-backed Memory lifecycle parity if runtime evidence gaps should stay ahead of provider wiring.
