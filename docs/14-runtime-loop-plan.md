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
