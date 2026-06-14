# Runtime Loop Plan

[中文版本](14-runtime-loop-plan.zh-CN.md)

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

## Completed Increment: Production Gap Closure Plan

Target: create an architecture-layered production gap-closure plan that keeps OpenClaw-level completeness pressure inside Aetherion's current trust boundaries.

Why this slice:

- It turns the broad production-readiness target into ordered milestones without beginning GUI, mobile, IM, browser automation, real OAuth connector, MCP connector, package-code execution, or cloud-worker work.
- It maps the requested architecture stack to current evidence and remaining gaps, so future rounds can choose narrow runtime-closing slices instead of widening surfaces by impulse.
- It records the execution protocol for future rounds: at most two child/subagent lanes, source-doc drift review, verification, Lore commit, and push.

Acceptance:

- [Production Gap Closure Plan](15-production-gap-closure-plan.md) and its [Chinese companion](15-production-gap-closure-plan.zh-CN.md) exist as tracked docs.
- README and source intent documents link to the plan.
- The plan explicitly separates current provider support from future OAuth connector/account-linking work.
- The plan leaves Local Supervisor, Event Ledger, and Tool Access & Action Policy Proxy as the authority/fact/action boundaries.

Remaining boundary:

- This is a planning increment, not implementation of a release packager, remote CI attestation reader, daemon lifecycle manager, vault backend, ingress gateway, real OAuth connector, GUI, browser extension, IM delivery, mobile app, cloud worker, or package-code runtime.

Next likely increment after this one:

- Start PGC-1 from the production plan: remote CI/CodeQL evidence reader plus release manifest/readiness hardening, unless a current CI/release evidence bug appears first.

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

## Completed Increment: First Real Model Invocation

Target: make `prompt invoke-model <request_id> --content <task>` perform the first real Aetherion model call, recording hash-only `agent.model.responded` evidence and running a local response audit, without granting any runtime authority.

Why this slice:

- It closes the runtime-loop gap that every prior increment built toward: the agent loop was scaffolded all the way to `agent.model.requested` but had never invoked a model. This is the threshold that turns the governed scaffold into an agent that can actually plan with an LLM.
- It keeps the provider boundary narrow and auditable: a deterministic offline stub provider keeps the loop testable, while a real Anthropic Messages provider is selectable through `AETHERION_MODEL_PROVIDER=anthropic` with an in-memory credential.
- It preserves every authority invariant from `docs/13-schema-runtime-governance.md`: model output cannot authorize actions, no tool request or lease is emitted, and the response artifact records hashes only.

Why a re-derive-and-verify gate:

- The bound Agent Model Request artifact stores prompt hashes only, never raw prompt text. `invoke-model` re-renders the prompt from the same provenance-gated Context Pack path used by `prompt plan`, `bind-runtime`, and `prepare-model-request`, then asserts the re-rendered prompt bundle id, preview hash, and per-message hashes exactly match the bound request before any provider call. Prompt drift fails closed, so a model can never be invoked on a prompt that differs from the audited and bound one.

Acceptance:

- `prompt invoke-model <request_id> --content <task>` requires an existing Agent Model Request artifact plus matching `agent.model.requested` Ledger evidence, and refuses a request that already has a recorded response.
- The model provider is resolved at call time. Credentials are read from the environment in-memory only; they are never returned, logged, or persisted, so the response artifact keeps `credential_ref=null` and `credential_resolved=false`.
- The response artifact under `artifact://agent/model-response/<response_id>` records `model_invoked=true`, `provider_called=true`, the output-text and response-payload SHA-256 hashes, finish reason, refusal flag, tool-call flag, and usage. It records `raw_response_persisted=false`, `raw_prompt_persisted=false`, `model_output_can_authorize_actions=false`, `response_audit.required=true`, `response_audit.passed=null`, and `tool_request_events_appended=false`.
- The response is recorded in an independent single-event `agent.model.responded` run. The source run is not extended.
- The raw model output and rendered prompt text never appear in the persisted artifact; the operator sees them only on stdout.
- `audit payload-refs` resolves and schema-validates the new response event payload.
- A local response audit runs against the same prompt plan and is reported on stdout; it remains non-authorizing and is not runtime verification.

Remaining boundary:

- The default provider is the offline deterministic stub. A live Anthropic call requires `AETHERION_MODEL_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`.
- The model is invoked in no-tools mode. There is still no tool-calling loop, no supervisor-gated tool request from model output, no scoped lease from a model decision, no daemon, and no IM/browser/connector path.
- The response audit is local output linting, not runtime verification. A passing audit does not authorize actions, and the response artifact still records `may_present_as_verified_runtime_evidence=false`.
- The response artifact does not persist the raw output. A future increment that needs durable model output must define a separately governed, redaction-aware output artifact rather than widening this contract.

Next likely increment after this one:

- Add response-audit persistence as a separate reviewed artifact before any model-output-to-tool-request bridge.

## Completed Increment: Persisted Response Audit Evidence

Target: make the local response audit from `prompt invoke-model` durable as non-authorizing Ledger evidence, without mutating the hash-only Agent Model Response artifact or treating audit pass as runtime verification.

Why this slice:

- It corrects the previous boundary where the model response artifact was durable but the response-audit gate existed only on stdout.
- It advances `docs/13-schema-runtime-governance.md` by making response-side runtime evidence auditable through the same payload-ref mechanism as requests and responses.
- It avoids a drift risk from `docs/01-architecture.md` and `docs/02-user-boundary-layer.md`: audited model output may inform planning, but the Tool Access & Action Policy Proxy remains the only action choke point.

Acceptance:

- `prompt invoke-model <request_id> --content <task>` writes `artifact://agent/response-audit/<audit_id>` after recording `agent.model.responded`.
- The audit artifact records response/request/runtime refs, response hashes, required/present/missing blocks, citation checks, forbidden-claim findings, and next steps.
- The audit artifact records `audit_invoked_model=false`, `audit_requested_tools=false`, `audit_read_raw_payload_artifacts=false`, `raw_response_persisted=false`, `raw_prompt_persisted=false`, `audit_can_authorize_actions=false`, and `audit_pass_is_runtime_verification=false`.
- The audit is recorded in an independent single-event `agent.response.audit.recorded` run. The source run and response run are not extended.
- `audit payload-refs` resolves and schema-validates `agent.response.audit.recorded` payload refs.
- The raw model output and rendered prompt text never appear in the response-audit artifact.

Matched source docs and corrections:

- `docs/00-product-brief.md`: improves the auditable runtime loop instead of adding a new user surface.
- `docs/01-architecture.md`: keeps the Agent Orchestrator evidence separate from policy/tool authority.
- `docs/02-user-boundary-layer.md`: confirms model-derived content and audit output cannot authorize sensitive actions.
- `docs/05-audit-and-data-contracts.md`: records a human-readable artifact ref and keeps indexes/audits rebuildable rather than authoritative.
- `docs/13-schema-runtime-governance.md`: closes a runtime evidence gap instead of expanding speculative surfaces.

Remaining boundary:

- The audit remains output linting, not semantic verification, policy approval, or task completion proof.
- There is still no model-output-to-tool-request bridge, no scoped lease from model output, no persisted raw response, and no daemon.

Next likely increment after this one:

- Define a supervisor-gated tool-request proposal path from an audited model response, or add broader response-audit rebuild/parity once multiple response-audit producers exist.

## Completed Increment: Response Audit Evidence Chain Audit

Target: make persisted response-audit evidence checkable across Ledger events, artifacts, and run manifests before any model-output-to-tool-request bridge exists.

Why this slice:

- It hardens the boundary created by persisted response audits: having an audit artifact is not enough unless the referenced runtime binding, model request, model response, and single-event audit run all line up.
- It keeps the response-audit layer read-only and evidence-focused, so it can catch missing or contaminated audit runs without repairing state or granting authority.

Acceptance:

- `audit response-audits` scans `agent.response.audit.recorded` events and validates each response-audit artifact against `agent-response-audit.schema.json`.
- The audit verifies matching `agent.runtime.bound`, `agent.model.requested`, and `agent.model.responded` Ledger evidence for the artifact refs recorded by the response audit.
- The audit verifies the response artifact hashes match the audit artifact's recorded response hashes.
- The audit verifies the response-audit run manifest is completed and contains only the response-audit event.
- Runs contaminated with authority-bearing events such as `tool.requested`, `tool.result`, `lease.issued`, or `action.recorded` are reported as `authority_violation`.
- The audit is read-only: it does not call model providers, append events, repair artifacts, mutate registries, issue leases, or authorize actions.

Matched source docs and corrections:

- `docs/00-product-brief.md`: deepens the local auditable loop without adding broad surfaces.
- `docs/01-architecture.md`: keeps the Event Ledger as fact layer while preserving the Tool Access & Action Policy Proxy as the action choke point.
- `docs/05-audit-and-data-contracts.md`: treats artifacts and run manifests as auditable evidence, not source-of-truth authority.
- `docs/13-schema-runtime-governance.md`: enforces the non-authorizing model-response and response-audit boundary before tool proposals are introduced.

Remaining boundary:

- This is an evidence-chain check, not semantic verification of model output.
- There is still no model-output-to-tool-request bridge, no scoped lease from model output, no persisted raw response, and no daemon.

Next likely increment after this one:

- Define a supervisor-gated tool-request proposal path from an audited model response.

## Completed Increment: Proposal-Only Tool Request Bridge

Target: add a narrow `prompt propose-tool-request <response_audit_id>` path that can record an operator-restated workspace file read proposal from a passed, matched response audit without creating a real tool request.

Why this slice:

- It closes the next evidence-chain gap after response-audit auditing: an audited model response can now lead to a reviewable proposal artifact without becoming action authority.
- It preserves the Tool Access & Action Policy Proxy boundary from the original architecture. The proposal records intent and risk inputs, but a later read must still enter policy and receive a fresh scoped lease.
- It keeps raw model output and prompt text out of durable state. The operator must restate path and intent, and the proposal stores only ids, refs, hashes, gates, and structured preview metadata.

Acceptance:

- `agent-tool-request-proposal.schema.json` and its example validate with the existing contract examples.
- `prompt propose-tool-request <response_audit_id> --path <workspace-file> --content <intent>` requires a passed Agent Response Audit, matched response-audit evidence, and a workspace-contained target path.
- The command writes `artifact://agent/tool-request-proposal/<proposal_id>` and records an independent single-event `agent.tool.request.proposed` run.
- The proposal artifact and run record `tool_requested=false`, `policy_decided=false`, `lease_issued=false`, `tool_executed=false`, `raw_response_persisted=false`, and `runtime_authority_granted=false`.
- `audit payload-refs` resolves and schema-validates `agent.tool.request.proposed` payload refs.
- Path escapes and non-passing response audits fail before the Ledger changes.

Matched source docs and corrections:

- `docs/00-product-brief.md`: deepens the local auditable runtime loop without adding GUI, IM, browser, connector, or cloud surfaces.
- `docs/01-architecture.md`: keeps Agent Orchestrator evidence separate from the Tool Access & Action Policy Proxy authority path.
- `docs/02-user-boundary-layer.md`: confirms that model-derived content and tainted evidence cannot authorize reads or side effects.
- `docs/05-audit-and-data-contracts.md`: records human-readable, payload-ref backed evidence while preserving the Ledger as the fact layer.
- `docs/06-roadmap.md`: stays in the TUI-first kernel/orchestrator proof and does not enter post-V1 browser, IM, OAuth/MCP, or cloud scope.
- `docs/10-technical-strategy.md`: keeps TypeScript on orchestrator/prototype duties and leaves action authority with the Rust supervisor policy path.
- `docs/13-schema-runtime-governance.md`: adds a P1 runtime-evidence contract only because the implemented TUI path produces and audits it.

Remaining boundary:

- This is not a supervisor-gated execution bridge. It does not append `tool.requested`, call policy, issue a lease, execute a read, persist raw model output, or prove semantic correctness of the model response.
- Only workspace-local file read proposals are represented. Writes, egress, connectors, browser actions, and external side effects require later dedicated action paths.

Next likely increment after this one:

- Turn a reviewed proposal into an explicit policy request through the existing supervisor file-read lifecycle, or harden response-audit/proposal parity once more producers exist.

## Completed Increment: Multi-Provider No-Tools Model Boundary

Target: expand the existing hash-only `prompt invoke-model` provider boundary so the same no-tools runtime evidence path can call OpenAI Responses, OpenAI Chat Completions, Anthropic Messages, or Gemini `generateContent`.

Why this slice:

- The Agent Orchestrator must be provider-portable before tool execution is widened. Supporting multiple model APIs behind the same request/response/audit contracts avoids baking one provider into the runtime evidence model.
- It keeps provider credentials out of durable state. API keys and supported externally acquired bearer tokens are read in memory only, while response artifacts still persist only hashes, provider/model refs, usage, and non-authority flags.
- It satisfies the user request for OpenAI Responses, OpenAI completion-style chat, Anthropic, and Gemini interfaces without adding V1 OAuth connector runtime, vault grants, tool calls, or side effects.

Acceptance:

- `AETHERION_MODEL_PROVIDER=openai_responses` calls OpenAI `/v1/responses` with no tools, `store=false`, system/developer instructions, and user input.
- `AETHERION_MODEL_PROVIDER=openai_chat_completions` calls OpenAI `/v1/chat/completions` with the existing system/developer/user message array and no tools.
- `AETHERION_MODEL_PROVIDER=anthropic` continues to call Anthropic `/v1/messages` with `ANTHROPIC_API_KEY` and `x-api-key`, matching the official direct API path.
- `AETHERION_MODEL_PROVIDER=gemini` calls Gemini `models/<model>:generateContent` with `systemInstruction`, user content, and no tools.
- OpenAI and Gemini also accept externally supplied bearer-token env vars, but Aetherion does not run OAuth, persist credentials, create connector grants, or treat model access as authority. Anthropic OAuth is not implemented for this direct provider because the official Messages API uses API keys.
- Provider tests mock `fetch`, assert endpoint, headers, body shape, credential source behavior, response mapping, and missing-credential failure without network access.

Matched source docs and corrections:

- `docs/00-product-brief.md`: advances the model-backed local runtime while avoiding GUI, IM, browser, connector, and cloud surfaces.
- `docs/01-architecture.md`: keeps provider calls in the Agent Orchestrator, not in the Tool Access & Action Policy Proxy or Local Supervisor authority path.
- `docs/02-user-boundary-layer.md`: model provider access is not permission to read, write, egress, or execute tools.
- `docs/06-roadmap.md`: remains inside the TUI-first model-evidence loop; OAuth/SaaS connectors remain post-V1.
- `docs/10-technical-strategy.md`: keeps TypeScript responsible for provider/API iteration and leaves policy/lease authority outside provider code.
- `docs/13-schema-runtime-governance.md`: preserves the hash-only Agent Model Response artifact and no-tools boundary across providers.

Remaining boundary:

- This is not a real OAuth authorization flow, vault backend, connector grant, or provider account linking UX. It only consumes externally supplied bearer tokens when the provider path supports them.
- It does not declare provider tools, stream responses, persist raw provider payloads, perform multimodal I/O, or translate provider tool calls into Aetherion `tool.requested` events.

Next likely increment after this one:

- Add provider capability metadata and explicit model defaults per deployment, or turn reviewed tool-request proposals into a fresh supervisor policy request.

## Completed Increment: Repository CI Quality Gate

Target: close the immediate production-readiness gap between local verification and repository-enforced verification.

Why this slice:

- A strict OpenClaw comparison shows that production readiness is not just runtime capability; OpenClaw advertises CI/release status, guided onboarding, update/security docs, and a routed multi-platform workflow from the public repository and docs.
- Aetherion already has strong local tests and Rust checks, but they were not enforced on push or pull request.
- Adding CI improves production discipline without widening V1 runtime scope or adding deferred user surfaces.

Acceptance:

- Pushes to `main` and pull requests run TypeScript contract/TUI tests, Rust supervisor tests, Rust clippy, Rust fmt, diff whitespace checks, and tracked runtime/build artifact checks.
- README and contributing docs point contributors at the same local checks.
- The workflow is repository read-only and does not resolve secrets, call model providers, execute external connectors, or mutate runtime state.
- Supervisor process failures are diagnosable in CI without printing raw stdout payloads.

Matched source docs and corrections:

- `docs/00-product-brief.md`: improves the auditable local runtime development loop without adding broad surfaces.
- `docs/01-architecture.md`: CI is verification infrastructure, not a runtime authority boundary.
- `docs/06-roadmap.md`: strengthens Phase 1/2 kernel-loop quality before GUI, IM, browser, MCP/OAuth, or cloud worker expansion.
- `docs/10-technical-strategy.md`: preserves TypeScript/Rust ownership by running both test suites and Rust static gates.
- `docs/13-schema-runtime-governance.md`: enforces existing contract/runtime tests rather than expanding schemas.

Remaining boundary:

- This is a first CI gate, not OpenClaw-level release infrastructure. Install/onboarding automation, daemon lifecycle, packaging/release artifacts, security audit CLI, dependency-lock policy, platform matrices, and public docs deployment remain future production gaps.
- Supervisor process-failure diagnostics expose process metadata only; they must not grow into raw stdout/file-content logging.

Next likely increment after this one:

- Add release evidence/readiness artifacts beyond `ether doctor`, or add a first `ether security audit` command that mirrors the documented invariants without enabling deferred surfaces.

## Completed Increment: Store Trust Anchoring And Provider Failure Bounds

Target: close the two highest-risk production gaps from the strict review: self-authenticating Store Package signatures and unbounded/opaque live provider failures.

Why this slice:

- A Capsule Store cannot be production-grade if a package can bring its own signing key and claim any publisher id.
- Replay and sandbox results are runtime evidence only when they resolve to local records or artifacts; package-declared booleans are not enough.
- Live provider calls must not hang the CLI indefinitely or surface malformed upstream failures as raw parser/network noise.

Acceptance:

- `store trust-publisher` records a local operator-enrolled publisher key fingerprint before install.
- `store install` rejects unknown publishers, signing-key substitution, missing Replay Records, live-side-effect replay evidence, sandbox path/hash mismatch, and Capsule integrity mismatch.
- Capsule Install artifacts record `publisher_key_fingerprint`, `replay_record_ids`, and `sandbox_content_sha256`.
- Provider calls honor `AETHERION_MODEL_TIMEOUT_MS`, abort on timeout, wrap HTTP errors without response-body leakage, and wrap malformed JSON as provider-scoped errors.

Matched source docs and corrections:

- `docs/00-product-brief.md`: Capability Capsules remain governed and cannot self-grant trust or permissions.
- `docs/01-architecture.md`: Store and provider surfaces remain clients/orchestrator paths, not trust roots.
- `docs/04-skill-and-scaffold-os.md`: imported/generated packages remain quarantined until evidence gates pass.
- `docs/09-computer-use-implementation.md`: packages and external content remain tainted inputs, not authorization.
- `docs/11-migration-and-runtime-economics.md`: Capsule Store remains low-trust and governed rather than a plugin free-for-all.
- `docs/13-schema-runtime-governance.md`: fixtures and projections are not runtime evidence.

Remaining boundary:

- Store trust remains local-only. There is no public marketplace, publisher identity network, transparency log, revocation feed, release evidence repository, or package-code execution.
- Provider hardening remains no-tools and hash-only. It does not add OAuth flows, token refresh, vault storage, streaming, multimodal payloads, or provider tool execution.

Next likely increment after this one:

- Add release evidence/readiness artifacts comparable to OpenClaw's public release evidence, or add a read-only `ether security audit` command that checks documented invariants without enabling deferred surfaces.

## Completed Increment: Read-Only Doctor And Ledger-Backed Evidence Gates

Target: turn current repo/workspace readiness into a single read-only operator report, and remove remaining projection-as-authority drift from audit and Store install paths.

Why this slice:

- The strict OpenClaw comparison identified operator readiness and security-audit parity as production shell gaps, while Aetherion's deeper kernel evidence already existed in narrower commands.
- The strict code/security review found that audit commands could report reassuring provenance over a tampered Ledger, and Store install could still treat `replay-records` projection rows as replay evidence.
- Fixing these gaps advances production discipline without enabling GUI, IM delivery, browser automation, MCP/OAuth connectors, daemon lifecycle management, remote marketplace behavior, package-code execution, or cloud workers.

Acceptance:

- `ether doctor --workspace <path>` emits a deterministic JSON report with `ready`, `degraded`, or `blocked` status and per-check details.
- `doctor` checks repo governance files, bilingual documentation links, CI/script/artifact-guard expectations, schema/example baselines, workspace identity, Ledger hash-chain validity, and run-manifest presence.
- `doctor` remains read-only: no Ledger append, registry mutation, artifact write, provider call, lease issuance, state repair, or `.aetherion` initialization for an unstarted workspace.
- Every `audit *` topic verifies the Event Ledger hash chain before provenance or parity work and fails closed on tampering.
- `store install` resolves replay evidence from hash-chain-verified `replay.recorded` Ledger events and Replay Record artifacts, not from the `replay-records` registry projection.

Matched source docs and corrections:

- `docs/00-product-brief.md`: important actions remain reconstructable through source evidence, decisions, approvals, and replay artifacts.
- `docs/01-architecture.md`: Event Ledger stays the fact layer; stores and projections are not trust roots.
- `docs/05-audit-and-data-contracts.md`: human-readable Ledger evidence is source truth; registries are rebuildable projections.
- `docs/06-roadmap.md`: production discipline is tightened around the TUI/Rust loop before broader surfaces.
- `docs/10-technical-strategy.md`: TypeScript closes contract/TUI gaps without moving authority out of Rust.
- `docs/13-schema-runtime-governance.md`: enforces "projection is not source truth" at runtime command boundaries.

Remaining boundary:

- `doctor` is a readiness report, not a repair tool, daemon lifecycle manager, release packager, security scanner, or installer.
- After the next increment, `security audit`, the broader CI artifact leakage guard, and hash/metadata-only default model stdout are no longer open gaps. Install/onboarding automation, release packaging, platform matrix, dependency reproducibility policy, and deeper release evidence remain future production gaps.

Next likely increment after this one:

- Add `ether security audit` as a read-only findings report over secret leakage, tracked runtime artifacts, authority contamination, package execution boundaries, and live-surface violations.

## Completed Increment: Read-Only Security Audit And Hash-Only Model Stdout

Target: make security posture inspectable from the TUI without enabling deferred product surfaces, and remove the default raw model stdout leak from `prompt invoke-model`.

Acceptance:

- `ether security audit --workspace <path>` emits a deterministic read-only report with `pass`, `warn`, or `fail`, scoped checks, and findings.
- The audit checks tracked high-confidence secret material, tracked runtime/build roots from `tools/forbidden-tracked-roots.txt`, raw sensitive fields in existing runtime artifacts, workspace Ledger hash-chain validity, CI guard wiring, and the model stdout default.
- The audit remains read-only: no workspace initialization, Ledger append, registry mutation, artifact write, provider call, lease issuance, state repair, Capsule quarantine, package execution, or live probe.
- `prompt invoke-model` defaults to hash/metadata-only stdout; raw model output appears only with explicit `--print-output` and remains non-authorizing and unpersisted.
- CI uses the same forbidden-root denylist as `security audit`, including `.aetherion`, build/test/report roots, `.omx`/`.omc`, and sensitive local roots such as `vault`, `memory-vault`, and `local-data`.

Matched source docs and corrections:

- `docs/00-product-brief.md`: strengthens auditable safety evidence without changing Aetherion into a chatbot or replacement OS.
- `docs/01-architecture.md`: keeps Local Supervisor and Event Ledger as root/fact layers; the audit is inspection, not authority.
- `docs/05-audit-and-data-contracts.md`: reinforces human-readable policy and Ledger evidence while keeping generated/runtime state out of git.
- `docs/06-roadmap.md`: hardens the TUI-first V1 loop before GUI, IM, browser automation, MCP/OAuth connectors, or cloud workers.
- `docs/13-schema-runtime-governance.md`: closes a runtime/security evidence gap without expanding schema or provider authority.

Remaining boundary:

- `security audit` is not a repair command, dependency scanner, release signer, package sandbox, live connector probe, OAuth flow, or secret vault.
- Remaining production gaps are install/onboarding automation, release packaging, platform matrix, dependency/reproducibility policy, public docs deployment, and deeper dependency audit evidence.

## Completed Increment: Dependency Reproducibility And Audit Evidence

Target: turn the remaining dependency/reproducibility gap into committed lockfile evidence plus CI and operator-readiness gates, without adding runtime dependencies or widening V1 authority.

Acceptance:

- Root `package-lock.json` is committed so `npm ci --ignore-scripts` and `npm audit --audit-level=high --json` are reproducible from repo state even while the root JavaScript surface has zero npm dependencies.
- Rust verification uses the committed `Cargo.lock`: CI and docs run `cargo test --locked` and `cargo clippy --all-targets --all-features --locked -- -D warnings`.
- CI installs a pinned `cargo-audit` with `--locked`, runs `cargo audit`, and runs `doctor` plus `security audit` as operator readiness snapshots.
- `doctor` reports dependency lockfile state and requires the CI dependency/readiness gates.
- `security audit` reports dependency reproducibility and CI dependency/readiness guard findings if lockfiles or gates drift.

Matched source docs and corrections:

- [Product Brief](00-product-brief.md): important behavior remains auditable through repo evidence, not local shell memory.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): release evidence becomes reproducible through committed lockfiles and reviewable workflow configuration.
- [Roadmap](06-roadmap.md): production discipline improves inside the TUI-first V1 path before platform matrix or packaging expansion.
- [Schema Runtime Governance](13-schema-runtime-governance.md): dependency audit evidence is a repo/operator check, not runtime authority.

Remaining boundary:

- This is not release packaging, artifact signing, update infrastructure, platform matrix execution, public docs deployment, or dependency auto-remediation.
- The ignored `promo/` subtree remains a local/generated promotional experiment and is outside release evidence.
- Remaining production gaps are install/onboarding automation, release packaging, platform matrix, public docs deployment, and deeper release artifact evidence.

## Completed Increment: CI Platform Smoke And Action Runtime Evidence

Target: remove the remaining GitHub Actions Node.js 20 action-runtime warning and turn part of the platform/release-evidence gap into a checked Ubuntu/macOS smoke lane, without adding release packaging or widening runtime authority.

Acceptance:

- CI uses `actions/checkout@v5` and `actions/setup-node@v5`, with `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` as an explicit Node 24 action-runtime baseline.
- CI includes a `platform-smoke` matrix over `ubuntu-latest` and `macos-latest`.
- The smoke lane runs lockfile install, a focused contract/provider/TUI-help Node test subset, locked Rust supervisor tests, `doctor`, and `security audit`.
- `doctor` and `security audit` fail if the workflow drifts away from the action-runtime or platform-smoke evidence.

Matched source docs and corrections:

- [Product Brief](00-product-brief.md): readiness evidence is committed and replayable from CI configuration.
- [Roadmap](06-roadmap.md): platform discipline improves inside the TUI-first scope before broader release packaging or app surfaces.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): workflow configuration remains a human-readable contract for release evidence.
- [Phase Implementation Review](12-phase-implementation-review.md): this follows the remaining platform/release gap identified by the OpenClaw comparison.

Remaining boundary:

- This is a smoke matrix, not a full release matrix, package build, installer, updater, or artifact-signing pipeline.
- Real OAuth, MCP connectors, browser automation, IM delivery, GUI apps, package-code execution, cloud workers, and public docs deployment remain deferred.
- Remaining production gaps are install/onboarding automation, release packaging, deeper release artifact evidence, public docs deployment, and broader platform/release matrix coverage.

## Completed Increment: Provider Tool-Call Refusal

Target: make the multi-provider `prompt invoke-model` path enforce no-tools semantics when live providers return tool/function-call response shapes, without adding provider tool execution or OAuth connector runtime.

Acceptance:

- OpenAI Responses call-type output fails before response evidence is persisted.
- OpenAI Chat Completions `tool_calls` output fails before response evidence is persisted.
- Anthropic `tool_use` output fails before response evidence is persisted.
- Gemini `functionCall` and executable-code parts fail before response evidence is persisted.
- Provider failures remain local errors; no `tool.requested`, policy decision, lease, action, observation, or verification event is synthesized.

Matched source docs and corrections:

- [Schema Runtime Governance](13-schema-runtime-governance.md): no-tools mode is now enforced at the provider boundary, not only recorded as response metadata.
- [Roadmap](06-roadmap.md): model provider portability remains inside the TUI-first evidence loop while OAuth/MCP/SaaS connectors stay deferred.
- [User Boundary Layer](02-user-boundary-layer.md): provider output is untrusted data and cannot cross into action authority without policy.
- [Phase Implementation Review](12-phase-implementation-review.md): this follows the strict security review finding that provider tool-call outputs must fail closed.

Remaining boundary:

- This is not provider tool execution, a tool-call proposal parser, streaming support, multimodal support, browser OAuth, token refresh, vault storage, connector grants, or live-provider CI probing.
- OpenAI support remains OpenAI Responses and OpenAI Chat Completions; legacy `/v1/completions` is not implemented.
- OAuth remains limited to externally acquired bearer-token env vars for provider paths that support them.

## Completed Increment: Release Evidence Snapshot

Target: turn the existing `doctor`, `security audit`, CI, dependency-lock, platform-smoke, and governance evidence into one read-only local release-evidence report without adding release packaging, signing, publishing, public docs deployment, or remote CI queries.

Acceptance:

- `release evidence --workspace <path>` prints a single JSON report with git head/dirty state, configured CI gate status, Node 24 action-runtime evidence, Ubuntu/macOS platform-smoke configuration, dependency lockfile evidence, governance file checks, bilingual-doc checks, `doctor` summary, `security audit` summary, workspace runtime/Ledger status, source-document links, and remaining release gaps.
- The report now also carries docs deployment readiness inputs from local Markdown entrypoints, relative link resolution, and source-document links, while `public_docs_deployed` remains `false`.
- The report now also carries a schema-aligned `release_manifest_preview` derived from existing local and optional remote evidence. The preview is stdout-only; it does not write a generated manifest file, sign artifacts, package releases, publish releases, or deploy docs.
- The command is strictly read-only: it does not initialize `.aetherion`, append Ledger events, mutate registries, write artifacts, call providers, issue leases, repair state, package artifacts, sign releases, publish releases, deploy docs, or query GitHub/remote CI.
- CI runs the report alongside `doctor` and `security audit`; `doctor`, `security audit`, and `release evidence` all detect drift if the workflow stops running the configured release-evidence snapshot.
- Empty-workspace and initialized-workspace tests prove the command does not create runtime state or mutate Ledger/run evidence.

Matched source docs and corrections:

- [Product Brief](00-product-brief.md): release posture remains grounded in durable, reviewable evidence rather than an operator's local memory.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): the report treats human-readable governance docs and committed workflow/lockfile state as evidence, while keeping indexes and runtime projections rebuildable.
- [Roadmap](06-roadmap.md): this strengthens the V1 TUI/Rust kernel loop before GUI, IM, browser automation, MCP/OAuth connectors, cloud workers, or broader release packaging.
- [Schema Runtime Governance](13-schema-runtime-governance.md): the report is evidence aggregation only; it grants no runtime authority and introduces no new trust root.
- [Phase Implementation Review](12-phase-implementation-review.md): this closes the previously recorded "deeper release artifact evidence" gap only for local/configured source snapshots.

Remaining boundary:

- This is a local/configured source snapshot, not executed remote CI proof, release packaging, artifact signing, installer/updater infrastructure, public docs deployment, package registry publication, or a release evidence repository.
- Docs deployment readiness is a read-only input check, not a publishing pipeline.
- The release manifest preview is derived evidence only, not the signed release manifest artifact or release repository that PGC-1 still calls for later.
- A dirty worktree is reported as `draft`; it does not block local inspection because unrelated operator files may be present, but it is not a clean release claim.
- Remaining production gaps are install/onboarding automation, release packaging, artifact signing, public docs deployment, broader platform/release matrix artifacts, and remote/executed release evidence.

## Completed Increment: From-Source Onboarding Preflight

Target: reduce the guided-onboarding gap with a read-only preflight that tells a fresh clone whether the local toolchain, repo evidence, and workspace runtime state are ready to begin from-source work, without adding an installer, updater, daemon manager, or release packaging.

Acceptance:

- `onboarding check --workspace <path>` prints a single JSON report with `toolchain_ready`, `repo_ready`, `workspace_runtime_state`, and `next_steps_ready` layers.
- Fresh clones with no `.aetherion` runtime state are treated as onboardable `not_initialized` workspaces, not damaged workspaces.
- The command checks Node, npm, git, rustc, cargo, optional cargo-audit, repo scripts, lockfiles, CI gates, governance docs, bilingual docs, onboarding doc links, and workspace Ledger state when it exists.
- The command is strictly read-only: it does not install dependencies, run the verification suite, initialize `.aetherion`, start or stop daemons, repair state, write artifacts, append Ledger events, call providers, issue leases, query remote CI, or enable deferred product surfaces.
- CI runs the preflight with the existing operator snapshots so docs and workflow stay aligned.

Matched source docs and corrections:

- [Product Brief](00-product-brief.md): onboarding remains local-first and evidence-oriented rather than a cloud account or connector bootstrap.
- [Roadmap](06-roadmap.md): the increment strengthens the V1 TUI path before GUI, IM, browser, MCP/OAuth, cloud, installer, or release-packaging work.
- [Technical Strategy](10-technical-strategy.md): TypeScript remains the contract/TUI iteration surface; Rust remains the supervisor boundary.
- [Phase Implementation Review](12-phase-implementation-review.md): this addresses the recorded install/onboarding gap only at the from-source preflight layer.

Remaining boundary:

- This is not an installer, updater, package manager, daemon lifecycle manager, public docs deployment, release package, artifact signer, provider-auth wizard, or connector account-linking flow.
- It reports missing tools and next steps; it does not install or repair them.
- Remaining production gaps are installer/updater automation, release packaging, artifact signing, public docs deployment, broader platform/release matrix artifacts, and remote/executed release evidence.

## Completed Increment: Source Document Governance Links

Target: connect the original source documents to the repository governance and collaboration contracts so maintainers can move from product intent to contribution, conduct, security, licensing, issue, and pull-request workflow requirements without relying on memory.

Acceptance:

- Root README and README.zh-CN expose Code of Conduct, Contributing, Security Policy, MIT License, issue templates, and pull request template links.
- Product Brief, Audit and Data Contracts, Roadmap, Technical Strategy, and Schema Runtime Governance link the same governance surface plus the README operator/readiness command hub from both English and Chinese source documents.
- Links are repo-relative Markdown references and do not introduce runtime behavior.

Matched source docs and corrections:

- [Product Brief](00-product-brief.md): repository collaboration remains a governance surface, not a new product client surface.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): contribution/security/license/template files are human-readable workflow evidence, not runtime state or authority.
- [Roadmap](06-roadmap.md): foundation docs now point to review and contribution gates before product-surface expansion.
- [Technical Strategy](10-technical-strategy.md): the increment stays in documentation and does not change language ownership or trust boundaries.
- [Schema Runtime Governance](13-schema-runtime-governance.md): source links do not grant policy decisions, leases, provider access, connector grants, or verification claims.

Remaining boundary:

- This is not a private vulnerability-reporting backend, release automation, documentation deployment, issue triage automation, or maintainer workflow bot.
- It does not enable GUI, browser automation, IM delivery, MCP/OAuth connectors, package-code execution, cloud workers, or a remote marketplace.

## Completed Increment: Supervisor RPC Stdin Failure Normalization

Target: make supervisor process failures deterministic across CI platforms by capturing early stdin write errors and still reporting non-zero subprocess exits through the sanitized supervisor process-failure summary.

Acceptance:

- `callSupervisorRpc` installs stdin error/close listeners before writing the JSON-RPC request.
- Early `EPIPE` or equivalent stdin write failures do not bypass the supervisor process-failure formatter.
- Non-zero supervisor exits continue to report exit code, command, stderr, and stdout line count without leaking stdout contents.

Matched source docs and corrections:

- [Technical Strategy](10-technical-strategy.md): TypeScript remains the client/orchestrator surface, but the supervisor RPC boundary must fail closed and avoid accepting ambiguous process evidence.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): stdout can be counted for diagnostics but raw payloads must not enter failure messages.
- [Schema Runtime Governance](13-schema-runtime-governance.md): this hardens an existing P0/P1 runtime boundary and grants no new authority.

Remaining boundary:

- This is not a supervisor daemon lifecycle feature, repair command, socket protocol change, policy change, or new runtime action family.

## Completed Increment: Remote Evidence Snapshot And Release Manifest Contract

Target: start PGC-1 by separating local configured release evidence from operator-supplied remote CI/CodeQL observations, and by adding a schema-valid Release Manifest contract.

Acceptance:

- `release evidence --workspace <path>` now reports `remote_observed_evidence` separately from `configured_evidence`.
- `release evidence --remote-evidence <snapshot.json>` reads a workspace-local CI/CodeQL snapshot without live-querying GitHub, resolving credentials, writing artifacts, appending Ledger events, or mutating `.aetherion`.
- Missing remote evidence keeps the report in `draft`; invalid remote evidence, failed remote CI/CodeQL, or commit mismatch blocks the release report.
- `release-manifest.schema.json` and its example validate with the existing contract example suite.

Matched source docs and corrections:

- [Production Gap Closure Plan](15-production-gap-closure-plan.md): this starts PGC-1 remote CI/CodeQL evidence and release manifest hardening without adding release packaging, signing, deployment, or live remote API calls.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): remote observations are evidence records supplied for review; they are not authority and do not mutate projections.
- [Roadmap](06-roadmap.md): the slice stays inside the TUI-first V1 release-readiness lane and does not enable GUI, IM, browser automation, MCP/OAuth connectors, cloud workers, or package-code execution.
- [Schema Runtime Governance](13-schema-runtime-governance.md): the new schema is tied to release-readiness evidence, not to runtime authority.

Drift review:

- No replacement-OS/chatbot drift.
- Local Supervisor, Event Ledger, and Tool Policy Proxy remain the authority/fact/action boundaries.
- A strict docs comparison found that the default CLI surface has grown far beyond the narrow V1 product shape, even though those later surfaces are mostly non-authorizing. The next implementation slice should add a V1 Core Profile Gate so post-V1 contract/runtime labs cannot be mistaken for V1 release-critical product surface.

Remaining boundary:

- This is not a live GitHub API reader, release packager, artifact signer, installer/updater, public docs deployment, or release evidence repository.
- Remote evidence is accepted only as a workspace-local operator-supplied snapshot; live remote observation remains a future PGC-1 sub-slice.

## Completed Increment: V1 Core Profile Gate

Target: make the V1 product boundary machine-readable in onboarding and release evidence, so post-V1 contract/runtime labs cannot be mistaken for V1 release-critical surface area.

Acceptance:

- `onboarding check` and `release evidence` include `v1_core_profile`.
- The profile lists V1 release-critical commands separately from readiness support commands and post-V1 labs.
- `security audit` remains release-supporting evidence, not a V1 core product command.
- `release evidence` blocks if V1 release-critical commands overlap with post-V1 lab commands.
- `help` section tests slice the V1 core section and assert post-V1 command families do not appear there.

Matched source docs and corrections:

- [Product Brief](00-product-brief.md): V1 remains TUI-first and does not absorb GUI, IM, browser automation, MCP/OAuth connectors, cloud workers, or package-code execution.
- [Roadmap](06-roadmap.md): Phase 1/2 kernel/readiness commands are separated from later trace-backed labs.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): this directly addresses the documented risk that production-parity pressure could cause V1 surface creep.

Remaining boundary:

- This is a profile gate and release-readiness boundary, not a supervisor lifecycle, vault, ingress, packaging, signing, or deployment feature.
- The next high-value runtime slice remains supervisor lifecycle/vault refs/local ingress, unless a release-evidence or CI blocker appears first.

## Completed Increment: Metadata-Only Vault Reference Contract

Target: start the PGC-2 vault path with a schema-valid reference contract and readiness checks that prove Aetherion can name credential material without storing or using raw secrets.

Acceptance:

- `vault-reference.schema.json` and its example validate with the existing contract example suite.
- The schema rejects raw secret material, completed OAuth-flow claims, connector grants, and raw-secret availability to Aetherion.
- `doctor`, `onboarding check`, and `release evidence` surface `vault_reference_contract` readiness evidence.
- Release evidence keeps the remaining gap explicit: metadata-only vault references exist, but no production vault backend, token refresh, or connector grant lifecycle is implemented.

Matched source docs and corrections:

- [Technical Strategy](10-technical-strategy.md): vault belongs in the Rust authority boundary later; this slice only defines metadata that current TypeScript readiness reports can inspect.
- [Schema Runtime Governance](13-schema-runtime-governance.md): the new contract is assigned to the P1 readiness/credential-boundary metadata tier and has negative tests for raw secrets and OAuth/connector overclaiming.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): this starts PGC-2 without enabling real OAuth connectors, token persistence, or connector grants.

Remaining boundary:

- This is not a production vault backend, OS keychain integration, token refresh system, OAuth authorization flow, connector grant lifecycle, secret retrieval API, policy lease, or runtime authority grant.
- The next slice can either continue PGC-2 with supervisor lifecycle/vault reference binding design or return to PGC-1 live remote observation if release evidence becomes the higher risk.

## Completed Increment: Model Provider Readiness Contract

Target: make the existing no-tools provider support release-checkable without expanding OAuth or connector scope.

Acceptance:

- `model-provider-readiness.schema.json` and its example validate with the existing contract example suite.
- The schema locks the supported API surfaces to OpenAI Responses, OpenAI Chat Completions, Anthropic Messages, and Gemini `generateContent`.
- The schema rejects OAuth-flow, token-refresh, connector-grant, raw prompt/model/provider payload, provider tool-call persistence, and model-output authority overclaims.
- `doctor`, `onboarding check`, and `release evidence` surface `model_provider_readiness_contract` evidence.
- Release evidence keeps remaining provider gaps explicit: OAuth flows, token refresh, connector grants, streaming, multimodal payloads, and legacy OpenAI `/v1/completions` are still unimplemented.

Matched source docs and corrections:

- [Architecture](01-architecture.md): model provider invocation remains Agent Orchestrator evidence; Tool Access & Action Policy Proxy still gates actions.
- [Schema Runtime Governance](13-schema-runtime-governance.md): provider readiness is P1 metadata with negative tests for raw payloads, provider tool calls, and OAuth/connector overclaiming.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): this continues PGC-2 by naming provider/credential boundaries before true OAuth or connector grants.
- [Roadmap](06-roadmap.md): provider portability stays inside TUI-first readiness; MCP/OAuth/SaaS connectors remain deferred.

Remaining boundary:

- This is not an OAuth client, provider-auth wizard, token refresh system, connector grant lifecycle, streaming/multimodal provider path, provider tool executor, or runtime authority grant.
- The next high-value PGC-2 slice is still supervisor lifecycle/vault reference binding design, unless release evidence or CI becomes the sharper blocker.

## Completed Increment: Supervisor Lifecycle Readiness Contract

Target: continue PGC-2 by making the current supervisor lifecycle boundary release-checkable without pretending that foreground status/preflight is a production daemon lifecycle.

Acceptance:

- `supervisor-lifecycle-readiness.schema.json` and its example validate with the existing contract example suite.
- The schema locks supported lifecycle evidence to read-only `supervisor status` and `supervisor preflight`, plus stdio/foreground Unix socket/runtime-lock observation.
- The schema rejects production daemon, start/stop, stale-lock repair, socket-auth lifecycle, vault backend, process sandbox, signer, cloud worker, socket-token tool authority, runtime-lock authority, and supervisor lease-authority overclaims.
- `doctor`, `onboarding check`, and `release evidence` surface `supervisor_lifecycle_readiness_contract` evidence.
- Release evidence keeps the remaining lifecycle gap explicit: status/preflight and foreground socket locks exist, but production daemon start/stop, socket-auth lifecycle, stale-lock recovery, process sandboxing, and vault-backed supervisor secrets are still unimplemented.

Matched source docs and corrections:

- [Architecture](01-architecture.md): Local Supervisor stays the authority boundary, while lifecycle readiness metadata cannot itself grant authority or leases.
- [Technical Strategy](10-technical-strategy.md): Rust remains the future owner for authority/vault/daemon boundaries; this pass only records current status/preflight evidence and unsupported lifecycle claims.
- [Schema Runtime Governance](13-schema-runtime-governance.md): supervisor lifecycle readiness is P1 metadata with negative tests for daemon, repair, vault, socket-auth, and lease-authority overclaiming.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): this continues PGC-2 by typing lifecycle readiness before implementing start/stop/recover-stale-lock behavior.

Remaining boundary:

- This is not a production daemon, service installer, daemon manager, stale-lock recovery command, crash-recovery system, socket-auth lifecycle, device/user identity layer, vault backend, signer, process sandbox, cloud worker, or policy lease.
- The next high-value PGC-2 slice is vault reference binding design or the first explicit lifecycle command contract, unless local ingress or release evidence becomes the sharper blocker.

## Completed Increment: Vault Policy Binding Readiness Contract

Target: close the next PGC-2 credential-boundary gap by proving how a future policy decision may cite a Vault Reference without turning the reference into secret access, egress authority, or provider credential resolution.

Acceptance:

- `vault-policy-binding.schema.json` and its example validate with the existing contract example suite.
- The schema binds `vault-reference`, `policy-decision`, and `model-provider-readiness` by reference names only.
- The schema permits policy decisions to cite `vault://` references as reference-and-fingerprint metadata only.
- The schema rejects secret resolution, raw secret copying, provider vault-backed calls, egress authorization, connector grants, token refresh, OAuth flow, and lease issuance by the binding itself.
- `doctor`, `onboarding check`, and `release evidence` surface `vault_policy_binding_contract` evidence.

Matched source docs and corrections:

- [Architecture](01-architecture.md): Tool Access & Action Policy Proxy remains the action/egress choke point; vault metadata cannot bypass it.
- [Technical Strategy](10-technical-strategy.md): Rust remains the future owner of vault/authority behavior; this pass keeps TypeScript to contract/readiness evidence.
- [Schema Runtime Governance](13-schema-runtime-governance.md): vault policy binding is P1 readiness metadata with negative tests for secret resolution, egress, connector grants, and lease authority.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): this advances PGC-2 acceptance that vault refs can be cited by policy decisions without storing raw secret values.

Remaining boundary:

- This is not a production vault backend, secret retrieval API, provider vault-backed invocation path, OAuth flow, token refresh system, connector grant lifecycle, egress policy implementation, or policy lease.
- The next high-value slices are explicit lifecycle command contracts, local ingress envelope/idempotency, or provider error/credential-source productionization.

## Completed Increment: Local Ingress Readiness Contract And Audit

Target: start PGC-3 without widening V1 beyond the TUI by making the future ingress gateway envelope, idempotency, auth-state, rate-limit-state, and policy-handoff requirements machine-checkable.

Acceptance:

- `local-ingress-readiness.schema.json` and its example validate with the existing contract example suite.
- The schema requires caller identity placeholder, surface id, workspace id, idempotency key, normalized intent hash, auth state, rate-limit state, and policy handoff metadata.
- The schema rejects public API/browser/IM/mobile/cloud ingress overclaims, unauthenticated authority, duplicate-key authority reuse, raw external payload persistence, session issuance, durable/distributed/session/remote rate-limit claims, and supervisor bypass.
- `doctor`, `onboarding check`, `ingress audit`, and `release evidence` surface `local_ingress_readiness_contract` evidence.
- `ingress audit` is read-only and reports the current gap: TUI run rate-limit and duplicate-key reservations exist, but cached idempotent result replay, durable/distributed/session/remote rate limiting, durable auth/session lifecycle, public API listener, browser extension ingress, IM delivery, mobile pairing, connector OAuth ingress, and cloud worker ingress remain missing.

Matched source docs and corrections:

- [Architecture](01-architecture.md): Ingress Gateways must normalize, authenticate, rate-limit, and provide idempotency before Local Supervisor handoff.
- [User Boundary Layer](02-user-boundary-layer.md): client surfaces and remote channels cannot authorize sensitive actions directly.
- [Schema Runtime Governance](13-schema-runtime-governance.md): local ingress readiness is P1 metadata and must reject inherited authority or live side-effect claims.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): this starts PGC-3 by adding the local ingress request envelope and read-only audit command.

Remaining boundary:

- This is not a production ingress gateway, public API listener, browser extension, IM delivery path, mobile pairing system, connector OAuth ingress, cloud worker, session manager, cached idempotent replay system, durable or remote rate limiter, policy lease, or side-effect authorization path.
- The next high-value slices are either cached/replay-safe idempotency semantics, explicit supervisor lifecycle command contracts, or provider error/credential-source productionization.

## Completed Increment: TUI Run Idempotency Reservation

Target: make the PGC-3 duplicate-key requirement executable for the current TUI `run` surface before any Local Supervisor handoff or file action.

Acceptance:

- `local-ingress-idempotency-reservation.schema.json` and its example validate with the contract example suite.
- `run` accepts `--idempotency-key <key>` and otherwise derives a generated local key; raw keys and raw intent text are not persisted.
- The idempotency reservation records `idempotency_key_hash`, `normalized_intent_hash`, `surface_id=tui`, `auth_state=local_operator`, `rate_limit_state=enforced_allow`, and `policy_handoff=pending_fresh_policy_and_scoped_lease`.
- Reservation uses atomic create (`wx`) before supervisor handoff, so a repeated key fails closed before a new run manifest, Ledger event, tool request, policy decision, lease, or action is created.
- `ingress audit`, `doctor`, and `release evidence` report the TUI duplicate-key reservation while keeping cached idempotent replay, durable/distributed/session/remote rate limiting, durable auth/session lifecycle, public API listener, browser extension ingress, IM delivery, mobile pairing, connector OAuth ingress, and cloud worker ingress open.

Matched source docs and corrections:

- [Architecture](01-architecture.md): idempotency is part of the ingress gateway boundary before Local Supervisor.
- [User Boundary Layer](02-user-boundary-layer.md): the client surface requests action but does not grant authority.
- [Schema Runtime Governance](13-schema-runtime-governance.md): idempotency reservation is hash-only metadata and rejects raw material or authority claims.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): duplicate idempotency keys are now detected for TUI `run` before new action runs.

Remaining boundary:

- This is not a production ingress gateway, public API listener, remote replay-protection system, cached idempotent response replay, durable or remote rate limiter, session manager, auth lifecycle, policy lease, or side-effect authorization path.
- The next high-value slices are cached/replay-safe idempotency semantics, explicit supervisor lifecycle command contracts, or provider error/credential-source productionization.

## Completed Increment: TUI Run Rate Limit Reservation

Target: make the PGC-3 rate-limit requirement executable for the current TUI `run` surface before Local Supervisor handoff, without adding a production gateway or remote ingress surface.

Acceptance:

- `local-ingress-rate-limit-reservation.schema.json` and its example validate with the contract example suite.
- `run` creates a hash-only local atomic window-slot reservation before idempotency reservation, supervisor handoff, run manifest creation, Ledger append, tool request, policy decision, lease, or file action.
- The reservation records `rate_limit_key_hash`, `normalized_intent_hash`, `surface_id=tui`, `auth_state=local_operator`, `rate_limit_state=enforced_allow`, `enforcement_stage=before_supervisor_handoff`, and `policy_handoff=pending_fresh_policy_and_scoped_lease`.
- The schema rejects raw key or raw intent persistence, ingress-issued authority, session issuance, background queues, mutable counter registries, late enforcement, and non-TUI surfaces.
- `ingress audit`, `doctor`, and `release evidence` now distinguish implemented TUI local rate-limit enforcement from still-missing cached idempotent replay, durable/distributed/session/remote rate limiting, auth/session lifecycle, public API listener, browser extension ingress, IM delivery, mobile pairing, connector OAuth ingress, and cloud worker ingress.

Matched source docs and corrections:

- [Architecture](01-architecture.md): rate limiting is part of the ingress gateway boundary before Local Supervisor handoff.
- [User Boundary Layer](02-user-boundary-layer.md): client surfaces can request action but cannot grant permissions, issue sessions, or become the trust root.
- [Schema Runtime Governance](13-schema-runtime-governance.md): local ingress reservation metadata must remain hash-only and must reject raw material, authority, session, and background-queue claims.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): PGC-3 requires rate-limit state enforcement before broader ingress surfaces.

Remaining boundary:

- This is not a production ingress gateway, public API listener, browser extension ingress, IM/mobile ingress, connector OAuth ingress, cloud worker ingress, session manager, durable distributed limiter, cached idempotent result replay, policy lease, or side-effect authorization path.
- The next high-value slices are cached/replay-safe idempotency semantics, explicit supervisor lifecycle command contracts, provider error/credential-source productionization, or remote CI/release hardening.

## Completed Increment: TUI Run Cached Idempotency Replay

Target: close the narrow PGC-3 replay-protection gap for the current TUI `run` surface without creating a production ingress gateway, remote idempotency service, or new authority path.

Acceptance:

- `local-ingress-idempotency-completion.schema.json` and its example validate with the contract example suite.
- A completed first `run` writes a hash-only idempotency completion cache that cites the reservation, source run id, completed manifest event ids, artifact refs, trace head, and `live_side_effects_replayed=false`.
- Reusing the same `--idempotency-key` with the same normalized intent returns cached manifest/Ledger/artifact evidence and does not create a new run manifest, append Ledger events, request policy, issue leases, or rewrite the output file.
- Reusing the same key with a different normalized intent still fails closed before any new action run.
- The completion schema rejects raw key/intent persistence, broad or mismatched replay scope, live side-effect replay, policy/lease reuse, and replay authority claims.
- `ingress audit`, `doctor`, and `release evidence` distinguish implemented TUI same-intent cached replay from still-missing durable/session/remote idempotency replay, durable/distributed/session/remote rate limiting, auth/session lifecycle, public API listener, browser extension ingress, IM/mobile ingress, connector OAuth ingress, and cloud worker ingress.

Matched source docs and corrections:

- [Architecture](01-architecture.md): idempotency belongs in the ingress boundary before Local Supervisor handoff, while Tool Access & Action Policy Proxy remains the only action choke point.
- [User Boundary Layer](02-user-boundary-layer.md): client surfaces cannot reuse prior authority; the cached path is evidence-only and issues no policy or lease.
- [Schema Runtime Governance](13-schema-runtime-governance.md): P1 ingress metadata can be runtime-backed only when it rejects raw material, inherited authority, and live side-effect replay claims.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): PGC-3 now has replay-safe duplicate handling for the TUI slice, while durable/session/remote replay remains a later gateway problem.

Remaining boundary:

- This is not a production ingress gateway, public API listener, browser extension ingress, IM/mobile ingress, connector OAuth ingress, cloud worker ingress, durable idempotency store, session manager, distributed limiter, policy lease, or side-effect authorization path.
- The next high-value slices are explicit supervisor lifecycle command contracts, provider error/credential-source productionization, durable/session ingress identity, or remote CI/release hardening.

## Completed Increment: Provider Stable Error Taxonomy

Target: continue PGC-4 by making no-tools provider failures machine-classifiable without persisting raw provider error bodies or widening provider authority.

Acceptance:

- `ModelProviderError` is the single provider-boundary error type for unknown provider, missing credential, invalid timeout, network failure, timeout, HTTP error, malformed JSON, and provider tool-call rejection.
- Errors expose stable code/category/retryability metadata and HTTP status when applicable.
- HTTP error handling still avoids reading or echoing upstream error bodies; credential values remain in memory only.
- Model Provider Readiness now includes the error taxonomy and rejects raw provider error body, credential, or tool-call output persistence on failure.
- `doctor`, `onboarding check`, and `release evidence` require the error taxonomy evidence.

Matched source docs and corrections:

- [Architecture](01-architecture.md): provider calls remain evidence inside the Agent Orchestrator, not a Connector Adapter grant or Tool Policy Proxy bypass.
- [Schema Runtime Governance](13-schema-runtime-governance.md): provider readiness metadata now has executable negative tests for failure-path raw payload persistence.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): this closes the stable error taxonomy part of PGC-4 while leaving future vault/OAuth/connector work behind policy.

Remaining boundary:

- This is not browser OAuth, token refresh, vault-backed provider credential resolution, connector account linking, a retry executor, provider tool execution, streaming, multimodal payload support, or live-provider CI probing.
- The next high-value slices are explicit supervisor lifecycle command contracts, durable/session ingress identity, richer refusal taxonomy, or remote CI/release hardening.

## Completed Increment: Supervisor Lifecycle Command Fail-Closed Contracts

Target: continue PGC-2 by making `supervisor start`, `supervisor stop`, and `supervisor recover-stale-lock` explicit callable surfaces while still failing closed until the Rust supervisor owns real daemon lifecycle and recovery semantics.

Acceptance:

- `supervisor-lifecycle-command.schema.json` and its example validate with the contract example suite.
- `ether supervisor start`, `ether supervisor stop`, and `ether supervisor recover-stale-lock` call `supervisor.status` for read-only observation, validate a structured report, print `unsupported_fail_closed`, and exit with code 2.
- The command report proves the command surface is known while `implemented=false`, `fail_closed=true`, and all lifecycle side effects, authority grants, session issuance, lease issuance, artifact writes, Ledger mutation, and vault-secret resolution remain false.
- `recover-stale-lock` reports stale-lock observation when present but leaves the lock file untouched.
- `doctor`, `onboarding check`, and `release evidence` require both the Supervisor Lifecycle Readiness contract and the Supervisor Lifecycle Command schema/example.

Matched source docs and corrections:

- [Architecture](01-architecture.md): Local Supervisor remains root authority; a command surface cannot become authority by being recognized.
- [Technical Strategy](10-technical-strategy.md): Rust still owns future daemon/vault/authority behavior; this slice only adds TypeScript command reporting around current status evidence.
- [Schema Runtime Governance](13-schema-runtime-governance.md): supervisor lifecycle command is P1 readiness metadata and must reject daemon, stale-lock repair, vault, lease, and tool-authority overclaims.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): this advances PGC-2's typed lifecycle contract while leaving real production daemon lifecycle, socket-auth lifecycle, vault backend, and stale-lock recovery open.

Remaining boundary:

- This is not a production daemon manager, service installer, crash-recovery system, stale-lock repair implementation, socket-auth lifecycle, process sandbox, signer, vault backend, secret retrieval path, policy gateway, session issuer, or lease issuer.
- The next high-value slices are durable/session ingress identity, richer refusal taxonomy, live remote CI/CodeQL observation, or the next vault/supervisor authority contract.

## Completed Increment: Supervisor Socket Auth Boundary Contract

Target: continue PGC-2 by turning the existing foreground Unix socket auth-token behavior into a release-checkable boundary contract without implementing a socket-auth lifecycle, user/device identity, vault-backed token storage, sessions, leases, or remote clients.

Acceptance:

- `supervisor-socket-auth-boundary.schema.json` and its example validate with the contract example suite.
- The schema rejects public network listeners, remote clients, token echo/persistence, auth-failure Ledger/artifact writes, workspace-mismatch initialization, runtime-lock authority, stale-lock repair by token, vault-backed token storage, token rotation/refresh, session issuance, lease issuance, tool authorization, policy override, and real socket-auth lifecycle claims.
- `doctor`, `onboarding check`, and `release evidence` report `supervisor_socket_auth_boundary_contract` separately from the broader Supervisor Lifecycle Readiness check.
- Existing TUI/Rust tests continue to prove that missing or wrong socket tokens fail closed, correct tokens allow local `supervisor.status` dispatch, and workspace-root binding mismatches fail closed without initializing the wrong workspace.

Matched source docs and corrections:

- [Architecture](01-architecture.md): Local Supervisor remains root authority; a socket token gates local transport dispatch only and cannot become action authority.
- [Technical Strategy](10-technical-strategy.md): Rust owns future vault/authority behavior; this slice adds TypeScript readiness evidence around the current Rust foreground socket gate.
- [Schema Runtime Governance](13-schema-runtime-governance.md): supervisor socket auth boundary is P1 readiness metadata and must reject token persistence, identity, vault, session, lease, tool, remote-client, and policy-overclaim drift.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): this advances PGC-2's local client socket/auth-token boundary while leaving real socket-auth lifecycle and vault-backed storage open.

Remaining boundary:

- This is not device identity, user identity, pairing, token rotation, vault storage, remote API ingress, public listener, connector OAuth, cloud worker, policy gateway, session issuer, lease issuer, or stale-lock repair.
- The next high-value slices are durable/session ingress identity, live remote CI/CodeQL observation, release packaging/signing readiness, broader projection parity, or the next vault/supervisor authority contract.

## Completed Increment: GitHub Remote Evidence Reader

Target: continue PGC-1 by adding a stdout-only remote CI/CodeQL snapshot reader that operators can review and feed into `release evidence --remote-evidence` without making release evidence itself live-query GitHub.

Acceptance:

- `release remote-evidence --workspace <path> [--branch <name>]` calls `gh run list` for the selected branch and prints an `aetherion_remote_ci_evidence_snapshot` JSON object to stdout.
- The snapshot keeps only the latest observed run per workflow name, reports CI summary counts, infers CodeQL status from the latest CodeQL workflow run, records the local git commit, and remains compatible with `release evidence --remote-evidence`.
- The command does not initialize `.aetherion`, append Ledger events, mutate registries, write artifacts, package releases, sign artifacts, publish releases, deploy docs, start daemons, query code-scanning alerts, or create connector/OAuth grants.
- `release evidence` remains a local report builder that consumes a workspace-local snapshot; it does not implicitly query remote CI.

Matched source docs and corrections:

- [Production Gap Closure Plan](15-production-gap-closure-plan.md): this advances PGC-1's remote CI/CodeQL evidence reader/report while leaving packaging, signing, docs deployment, and release repositories open.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): remote CI observations are reviewable evidence inputs, not authority or rebuildable projections.
- [Roadmap](06-roadmap.md): the slice stays inside V1 release-readiness evidence and does not enable GUI, IM, browser automation, MCP/OAuth connectors, cloud workers, or package-code execution.
- [Schema Runtime Governance](13-schema-runtime-governance.md): the remote snapshot is readiness metadata only; it cannot authorize actions, sessions, leases, provider calls, or connector grants.

Remaining boundary:

- This is not release packaging, artifact signing, public docs deployment, installer/updater automation, GitHub code-scanning alert triage, release repository publication, or a long-running CI monitor.
- The operator still reviews and stores the snapshot path explicitly before `release evidence --remote-evidence` includes it.

## Completed Increment: Release Manifest Preview In Release Evidence

Target: continue PGC-1 by making the existing Release Manifest contract visible in the read-only `release evidence` report without generating a signed manifest artifact, package, or release repository.

Acceptance:

- `release evidence --workspace <path>` now includes `release_manifest_preview`, a schema-aligned object shaped like `schemas/release-manifest.schema.json`.
- The preview is derived from existing evidence only: git revision, configured lockfile/test/governance/doc checks, source evidence hashes, optional operator-supplied remote CI/CodeQL observations, and known release gaps.
- Test gate entries are explicitly configured evidence. They do not claim that `release evidence` executed the test suite.
- The command remains read-only and stdout-only for this preview: no manifest file is written, no package is built, no artifact is signed, no release is published, no docs are deployed, and no live remote CI query is added.

Matched source docs and corrections:

- [Production Gap Closure Plan](15-production-gap-closure-plan.md): advances PGC-1 release manifest/readiness hardening while leaving packaging, signing, docs deployment, artifact retention, and release repository publication open.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): keeps the manifest preview as reviewable evidence metadata, not the Event Ledger fact layer or a new authority source.
- [Schema Runtime Governance](13-schema-runtime-governance.md): reuses the existing schema/example contract rather than inventing a separate report shape.
- [Roadmap](06-roadmap.md): stays inside V1 TUI release-readiness evidence and does not enable GUI, IM, browser automation, MCP/OAuth connectors, cloud workers, or package-code execution.

Remaining boundary:

- This is not release packaging, artifact signing, public docs deployment, installer/updater automation, release artifact retention, release repository publication, or a generated manifest file.
- Candidate readiness still depends on a clean worktree plus operator-supplied remote evidence; dirty or missing remote evidence keeps the preview in `draft`.

## Completed Increment: Supervisor RPC JSON Control-Character Escaping

Target: continue PGC-2 supervisor boundary hardening by ensuring traced read RPC responses remain valid JSON even when workspace files contain tabs or other control characters.

Acceptance:

- The Rust supervisor JSON response escape helper handles quotes, backslashes, newline, carriage return, tab, backspace, form feed, and every remaining U+0000 through U+001F control character.
- `file.read.traced` returns a parseable JSON-RPC envelope when the read file contains a tab, bell control character, newline, and quote.
- The TUI Rust supervisor path can complete a normal `run` against such a file, proving the TypeScript client can parse the supervisor response without falling back to the test-only TypeScript authority path.

Matched source docs and corrections:

- [Architecture](01-architecture.md): Local Supervisor remains the root authority; authority evidence must cross the JSON-RPC boundary without malformed response ambiguity.
- [Technical Strategy](10-technical-strategy.md): Rust owns the authority path, so response serialization bugs in Rust must be fixed at that boundary rather than hidden in the client.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): advances PGC-2 lifecycle determinism and supervisor boundary hardening without implementing daemon lifecycle or vault behavior.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): workspace file contents can be observed as tool-result evidence without corrupting the JSON evidence envelope.

Remaining boundary:

- This is not a new daemon lifecycle feature, socket-auth lifecycle, vault backend, stale-lock repair, process sandbox, signer, session issuer, lease authority expansion, connector OAuth, cloud worker, or broader adapter execution surface.

## Completed Increment: Store Replay Evidence Claim Binding

Target: continue Capability OS and projection-integrity hardening by ensuring Store Package replay-test claims bind to local Ledger-backed Replay Record evidence, not package-declared metadata alone.

Acceptance:

- Store install rejects a signed, integrity-valid package when a replay test cites an existing `replay_record_id` and matching `run_id` but declares `source_events` that are absent from that local Replay Record.
- The package replay-test claim structure is shared inside Surface OS so `run_id`, `replay_record_id`, `status`, and `source_events` do not drift between install prechecks and evidence resolution.
- README, Surface OS docs, and PGC docs state that `replay_record_id`, `run_id`, and `source_events` must bind to local Ledger-backed Replay Record evidence.

Matched source docs and corrections:

- [Architecture](01-architecture.md): Store inputs remain control-plane data; Event Ledger and Local Supervisor evidence remain the fact boundary.
- [Capability and Scaffold OS](04-skill-and-scaffold-os.md): package installation still requires evidence gates and cannot self-authorize trust, tests, or permissions.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): Replay Records are evidence artifacts tied to Ledger events; registries remain rebuildable projections.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): advances PGC-6 Store evidence/parity work while keeping package-code execution behind future supervisor-governed sandboxing.

Remaining boundary:

- This is not a remote marketplace, transparency log, revocation feed, Store registry rebuild/repair implementation, package execution sandbox, route scorer, permission-diff UX, connector OAuth, cloud worker, or broader adapter action gateway.

## Completed Increment: Child Registry Rebuild Preview

Target: continue PGC-6 projection-integrity work by exposing child-agent registry parity evidence for Agent Contracts, Child Results, policy-denial Budget Account snapshots, and Circuit Breakers.

Acceptance:

- `ether audit child-records --workspace <path>` reads only the verified Ledger plus local payload-ref artifacts, then reports expected and actual child-agent registry rows.
- Findings distinguish `matched`, `missing_registry`, `mismatched`, `stale_registry`, `invalid_artifact`, `invalid_registry`, and `unrebuildable` without mutating registries.
- The audit explicitly does not execute child agents, request supervisor authority, trust registry rows as authority, repair projections, issue leases, or change run manifests.
- Budget Account registry rows that lack a current artifact-backed Ledger source are surfaced as `unrebuildable` rather than silently treated as trusted or repaired.

Matched source docs and corrections:

- [Audit and Data Contracts](05-audit-and-data-contracts.md): child-agent registries are treated as rebuildable evidence views, not source truth.
- [Schema Runtime Governance](13-schema-runtime-governance.md): scoped parity previews now include `audit child-records`; the docs no longer imply this family is wholly future work.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): advances PGC-6 child-agent budgets/results parity while keeping repair explicit and operator-approved.
- [Roadmap](06-roadmap.md): stays inside TUI-first local evidence work and does not add GUI, IM, browser automation, MCP/OAuth connectors, cloud workers, or broader child-agent execution.

Remaining boundary:

- This is not automatic registry repair, budget-account success-path artifacting, event signing, redaction tooling, semantic verification, general LLM child orchestration, child writes, network tools, package execution, connector OAuth, cloud worker execution, or a new supervisor action family.

## Completed Increment: Surface Registry Rebuild Preview

Target: continue PGC-6 projection-integrity work by exposing Browser Observation, IM Inbox, and IM Outbox registry parity evidence without making post-V1 surfaces authoritative.

Acceptance:

- `ether audit surface-records --workspace <path>` reads only the verified Ledger plus local payload-ref artifacts, then reports expected and actual surface registry rows.
- Findings distinguish `matched`, `missing_registry`, `mismatched`, `stale_registry`, `invalid_artifact`, and `invalid_registry` without mutating registries.
- The audit explicitly does not open a browser, execute browser automation, deliver messages, request supervisor authority, trust registry rows as authority, repair projections, issue leases, or change run manifests.
- Real TUI surface/store integration covers browser, inbox, and two outbox records, tampers registries, and proves the audit reports mismatch/stale states while leaving the registry files byte-identical.

Matched source docs and corrections:

- [Product Brief](00-product-brief.md): stays inside local-first auditability and does not add GUI, IM delivery, browser extension, browser automation, connector, or cloud-worker surfaces.
- [Roadmap](06-roadmap.md): respects the V1 TUI-first boundary; Phase 8/9 surfaces remain post-gate.
- [Technical Strategy](10-technical-strategy.md): treats TypeScript surface scaffolds as contract/control-plane evidence while Rust remains the future authority path.
- [Schema Runtime Governance](13-schema-runtime-governance.md): scoped parity previews now include `audit surface-records`; the docs no longer imply Browser Observation, IM Inbox, and IM Outbox projection parity are wholly future work.
- [Production Gap Closure Plan](15-production-gap-closure-plan.md): advances PGC-6 surface records parity while keeping repair explicit and operator-approved.

Remaining boundary:

- This is not automatic registry repair, browser extension capture, browser/desktop automation, IM/email delivery, reusable outbox approval, remote channel identity, connector OAuth, package execution, event signing, redaction tooling, or a new supervisor action family.
