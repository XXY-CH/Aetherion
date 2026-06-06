# Migration and Runtime Economics

This document captures post-V1 discussion about OpenClaw/Hermes migration, advanced agent-system bets, and runtime cost controls. It does not change the V1 rule: the first runnable product remains TUI-only and focused on the local kernel loop.

## Scope Boundary

These ideas are valuable, but most of them are not V1 deliverables.

V1 remains:

- TUI command surface.
- Contract validation.
- Local workspace identity.
- Event Ledger append.
- Tool request.
- Policy decision.
- Scoped lease.
- Local file read/write through policy.
- Observation, verification, and trace replay reconstruction.

Post-V1 and research tracks may explore:

- OpenClaw and Hermes migration.
- Legacy skill quarantine.
- Vector memory upgrade.
- Causal memory and counterfactual replay.
- Event-ledger branching and checkpointing.
- Multi-agent economics and token budgets.
- Local observability dashboards.
- Agent hibernation and event-driven wakeup.
- Zero-trust agent-to-agent contracts.
- Memory folding and persona anchors.
- Agent fork, inheritance, and replay.
- Anti-poisoning honeypots.

## Practicality Analysis

### OpenClaw And Hermes Migration

Importing OpenClaw configuration, bot tokens, webhooks, and Hermes vector memory is feasible, but migration must not imply trust inheritance.

OpenClaw risks:

- Legacy skills may depend on Python runtimes or external libraries.
- Legacy tool assumptions may bypass Aetherion policy semantics.
- Bot tokens and webhook settings must be converted into vault references, not copied into plaintext manifests.
- Imported skills should become draft Capability Capsules or quarantined Legacy Capsules.

Hermes risks:

- Large vector stores may be expensive to upgrade into event-backed memory nodes.
- Bulk embedding conversion can consume significant CPU, GPU, memory, and storage.
- Migration should support batching, resumability, deduplication, and partial failure reports.
- Imported memories must keep provenance, sensitivity, source mapping, and confidence metadata.

Design rule:

> Migration imports evidence and draft capabilities; it never imports authority.

### Causal Memory And Counterfactual Reasoning

Using the Event Ledger to build state-transition graphs is feasible because Aetherion already treats events as the fact layer.

Challenges:

- Sandbox simulation of complex event chains may require LLM replay, symbolic simulation, or domain-specific state models.
- Counterfactual reasoning needs efficient state snapshots, dependency graphs, and replay boundaries.
- Historical replay must distinguish observation reconstruction from side-effect repetition.
- Counterfactual outputs should become reviewable reports or patches, not direct actions.

The first useful version can be modest:

- Build causal links between user intent, policy decisions, tool calls, observations, failures, corrections, and final outcomes.
- Generate "what changed" and "what likely caused failure" reports.
- Defer full alternate-history simulation until there is enough real trace data.

### Parallel Sandbox Branches And Resumable Execution

Git-style branching over Event Ledger checkpoints is feasible and fits Aetherion's human-readable source-of-truth model.

Risks:

- Frequent snapshots for files, databases, drafts, and connector state can create heavy storage and I/O load.
- Branching must preserve policy context, not only data state.
- Resuming a branch cannot resurrect expired permissions or scoped leases.
- External systems are harder to roll back than local artifacts.

Design rule:

> Branches can replay decisions and artifacts; they cannot replay authority without fresh policy evaluation.

### Multi-Agent Economics And Permission Circuit Breakers

Token budgets, resource limits, permission classes, and circuit breakers can be expressed through Policy Engine decisions and scoped leases.

Challenges:

- Multi-agent collaboration needs a reliable event bus or central orchestrator.
- Token accounting can add latency for large task graphs.
- Agents must not be able to mutate each other's memory, budgets, leases, or task state without explicit contracts.
- A malicious or broken child agent must be isolated before it can poison shared context or consume shared resources.

Initial implementation should be conservative:

- Per-run token and tool budgets.
- Per-agent scoped lease limits.
- Hard stop on repeated policy denials.
- Budget exhaustion events in the ledger.
- Reviewable task handoff contracts.

### Local Observability

Aetherion can expose Thought Tree views, tool-call heatmaps, memory usage, risk levels, policy decisions, and resource consumption through a TUI first and a GUI later.

Costs:

- High-frequency event capture and rendering can become expensive.
- Long-running agents will generate large traces.
- Real-time visualization should not slow the authority path.

Design rule:

> Observability is built from projections; it is not allowed to become the source of truth or a runtime dependency for policy.

### Digital Hibernation And Event-Driven Wakeup

Serializing agent state, hibernating, and waking on events is feasible and aligns with event-driven proactive behavior.

Challenges:

- Reliable wakeup requires a local daemon, OS integration, webhook relay, or paired device.
- Long event chains can make replay expensive unless checkpoints and summaries are available.
- Wakeup must re-evaluate policy, freshness, user attention, and lease validity.

The lowest-cost model:

```text
event arrives
-> append event
-> evaluate whether a sleeping run is eligible
-> load minimal context pack
-> re-check policy and attention budget
-> resume, queue, or discard
```

### Zero-Trust Agent Contracts And Token Escrow

Scoped leases, Capability Capsules, and signed task contracts can support zero-trust collaboration between agents.

Risks:

- Escrow and settlement can add delay.
- Real-time domains such as trading, bidding, incident response, or high-frequency operations need stricter latency models.
- Contracts must prevent hidden permission escalation through tool indirection.

The near-term version should be internal accounting, not a public economy:

- Task budget.
- Tool budget.
- Risk budget.
- Lease budget.
- Completion evidence.
- Failure penalties as local scoring signals.

### Memory Folding And Persona Anchors

Long-running agents will produce many Memory Candidates. Folding low-value candidates into higher-level memory cards, persona anchors, and project anchors is feasible.

Risks:

- Over-folding can erase useful nuance.
- Persona anchors can become stale or overfit.
- Prompt injection risk increases if untrusted content becomes high-priority memory.

Rules:

- Persona anchors cite source events.
- Anchors have confidence, TTL, allowed contexts, and blocked contexts.
- Dreaming may propose anchors, but active anchor changes remain patch-based and reviewable.
- Sensitive anchors require explicit policy approval.

### Digital Soul Fork And Inheritance

Forking an agent from Event Ledger history is feasible if state is represented as source events plus rebuildable projections.

Risks:

- Copying event nodes naively can consume significant storage.
- Secrets, OAuth grants, and sensitive memory cannot be inherited by default.
- Forked agents must receive new identity, policy, budget, and lease scopes.

Design rule:

> A fork inherits history references and approved memory, not live authority.

### Anti-Poisoning And Honeypots

Sandbox execution and event monitoring can support anti-poisoning probes and honeypot workflows.

Costs:

- Sandboxing unknown inputs consumes CPU and memory.
- Honeypot logic can produce noisy signals.
- False positives can degrade user trust.

Useful first steps:

- Mark untrusted third-party content as tainted.
- Track instructions that attempt privilege escalation.
- Run suspicious Capsule or connector behavior in sandbox trial.
- Convert poisoning attempts into regression fixtures.

## Innovation Application Tracks

### Event-Driven Agent Hibernation

Aetherion can become a low-cost local serverless agent runtime:

- Sleep when no meaningful event exists.
- Wake on user intent, file changes, connector events, deadlines, or device signals.
- Load only the minimal context pack needed for the opportunity.
- Unload after completion, failure, or queueing.

This can later support desktop, mobile, and cloud agents sharing ledger references while preserving local authority.

### Counterfactual Simulation And Causal Memory

Potential applications:

- Business decision simulation.
- Supply-chain scenario planning.
- User-behavior forecasting.
- "Virtual trial" workflows where multiple strategies are simulated and only the chosen plan is approved for real execution.

Outputs should be reports, evals, or patch proposals until the policy model is mature.

### Multi-Agent Economics

Aetherion can use internal economics to coordinate agents:

- Reward agents that complete tasks with strong evidence.
- Penalize wasted tool calls, repeated failures, or policy violations.
- Route tasks to agents with better historical scores.
- Create a future Capsule Store with trust, scoring, versioning, leasing, and rollback.

This should start as local metrics and only later become a marketplace-like model.

### Memory Folding And Persona Anchoring

Possible applications:

- User-defined persona branches.
- A/B tests for agent collaboration style.
- Project-specific behavior anchors.
- Visual controls for high-weight anchors.

Persona evolution must remain inspectable and reversible.

### Capsule Store

Aetherion can support a low-trust capability market if Capsule installation is governed by:

- Manifest validation.
- Permission diff.
- Source provenance.
- Replay tests.
- Static safety scan.
- Sandbox trial.
- User approval.
- Signed version and rollback metadata.

The store should not be treated as a plugin free-for-all. The unit of trust is the reviewed Capsule lifecycle.

### Local HUD And Observability Dashboard

Future interfaces can show:

- Event chain.
- Risk level.
- Active leases.
- Resource usage.
- Memory and tool-call heatmaps.
- Policy denials.
- Future task conflicts.
- Predicted risk windows.

V1 should express this through TUI trace output and replay summaries before a GUI exists.

### Serverless Agent, Hibernation, Fork, And Replay

Long-term uses:

- Competitive intelligence monitoring.
- Investment or market-watch workflows.
- IoT and smart-home coordination.
- Long-running research tasks.
- Agent backup and restore.
- Historical agent version resurrection.

All wakeup, fork, and replay behavior must pass fresh policy checks before side effects.

## Runtime Cost Controls

### Event Sampling, Folding, And Compression

Controls:

- Delta compression for old ledger segments.
- Episode folding into higher-level events.
- Memory Candidate folding into reviewed Memory Cards.
- Retention policy by sensitivity, value, and audit requirements.
- Rebuildable projections for expensive indexes.

Do not compress away the minimum evidence needed to reconstruct policy decisions and user approvals.

### Hibernation And Lazy Loading

Controls:

- Fully sleep agents when no event or opportunity is active.
- Load only required Capsule, memory, and connector modules.
- Unload after task completion.
- Keep large projections cold until queried.
- Prefer event-driven triggers over low-value polling.

### Scoped Leases And Resource Budgets

Every non-trivial run should have bounded authority:

- CPU budget.
- Token budget.
- Tool-call budget.
- File/path scope.
- Network/domain scope.
- Connector scope.
- Time-to-live.
- Denied action list.

Exhaustion or violation should emit events and trigger circuit breakers.

### Tiered Replay And Simulation

Controls:

- Start with lightweight replay reconstruction.
- Use summarized trace simulation before full replay.
- Queue expensive counterfactual jobs asynchronously.
- Run high-cost simulations in sandbox or batch mode.
- Cache intermediate state snapshots where policy permits.

### Event Priority Scheduling

Controls:

- High-value or high-risk events receive immediate policy evaluation.
- Low-value events can be batched.
- Low-risk observations can be summarized later.
- Repeated noisy events should be deduplicated.
- User attention budget influences proactive delivery timing.

### Incremental Memory OS Updates

Controls:

- Update Memory Cards only from source-backed high-confidence candidates.
- Archive inactive memory.
- Fold duplicate candidates.
- Delay low-confidence memory until more evidence arrives.
- Keep context assembly explainable.

### Capsule Execution Isolation

Controls:

- Run generated or imported code outside the Local Supervisor.
- Limit CPU, memory, filesystem, network, and process access.
- Deny raw vault access.
- Use structured IPC.
- Require tests and sandbox trials before activation.

### Deferred Visualization And Log Analysis

Controls:

- Keep real-time UI rendering optional.
- Use projections for dashboards.
- Batch historical log analysis.
- Avoid adding visualization work to the policy decision hot path.
- Let users request deep trace analysis on demand.

## Architecture Implications

These discussions reinforce existing Aetherion invariants:

- Event Ledger remains the fact layer.
- Local Supervisor remains the root authority.
- Scoped leases are the runtime authority currency.
- Capability Capsules replace unrestricted skills.
- Dreaming produces reviewable patches.
- Proactive behavior is event-driven and attention-budgeted.
- Human-readable source of truth remains authoritative.
- Indexes, dashboards, vector stores, graphs, and economic scores are rebuildable projections.

## Roadmap Placement

Near-term:

- Keep Phase 1 and Phase 2 focused on the TUI kernel and Rust supervisor POC.
- Add migration report schemas only where they support contract-first design.
- Keep OpenClaw/Hermes importers as design docs or test fixtures until the policy loop is real.

Mid-term:

- Implement quarantined Legacy Capsule import.
- Implement Memory Candidate folding from real trace data.
- Add resource budgets to scoped leases.
- Add TUI observability over event traces.

Long-term:

- Add event-ledger branching.
- Add causal graph projections.
- Add hibernation and event-driven wakeup.
- Add Capsule Store primitives.
- Add zero-trust multi-agent contracts.
- Add GUI/HUD only after the TUI and authority boundary are proven.
