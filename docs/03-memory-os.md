# Memory OS

Aetherion memory is an auditable operating system for user understanding, not a loose embedding store.

## Goals

- Preserve source-backed long-term memory.
- Support fast context assembly for real tasks.
- Separate raw events from interpreted memories.
- Track confidence, sensitivity, TTL, and contradictions.
- Let the user inspect, edit, export, and delete memory.
- Feed skill evolution without silently rewriting user truth.
- Support event-driven dreaming and simulation for improvement.

## Layers

### 1. Event Ledger

The Event Ledger is owned by the Event Plane and acts as the immutable source of truth:

- User messages.
- Agent actions.
- Tool calls and results.
- File, page, email, issue, calendar, or message references.
- Permission state.
- Timestamp and source.
- Sensitivity.
- Whether the event may influence future personalization or automation.

### 2. Memory Cards

Atomic interpreted memories:

```yaml
id: mem_123
type: preference
subject: user
content: "User prefers direct conclusions followed by concrete evidence."
source_events:
  - event_456
confidence: 0.82
sensitivity: low
ttl: 180d
created_at: "2026-06-05T20:00:00+08:00"
last_verified_at: "2026-06-05T20:00:00+08:00"
contradicts: []
allowed_contexts:
  - planning
  - writing
blocked_contexts:
  - external_email_auto_send
```

### 3. Episodic Timeline

Task-level history:

- User intent.
- Plan.
- Steps taken.
- Tools used.
- Failures and recoveries.
- User corrections.
- Final artifact.
- Skill candidates.
- Regression cases.

### 4. Semantic and Project Graph

Long-term graph over:

- Users.
- Projects.
- Repositories.
- Documents.
- Decisions.
- Meetings.
- Tasks.
- People.
- Companies.
- Tools.
- Constraints.

### 5. User Model

User collaboration model:

```yaml
communication_style:
  prefers:
    - direct conclusions
    - concrete evidence
    - compact status updates
  dislikes:
    - generic advice
    - unverified completion claims

work_style:
  decision_pattern: "Start from architecture, then iterate through MVP loops."
  risk_tolerance: medium_high
  approval_preference: "Ask before irreversible external effects."

automation_policy:
  auto_execute:
    - summarize local documents
    - draft plans
    - run reversible tests
  require_approval:
    - send external messages
    - commit or publish changes
    - modify paid services
```

### 6. Context Assembler

The Context Assembler chooses task-relevant context under token, privacy, and permission constraints:

- Current task.
- Recent session state.
- User preferences.
- Project memory.
- Relevant skill instructions.
- Available tools.
- Active permissions.
- Uncertainty and conflicts.
- Source citations.

Current Ether MVP:

- `ether memory candidates --from-run <run_id>` derives pending candidates only from real Ledger events.
- `ether memory candidates --source-event <event_id>`, `accept`, `reject`, `block`, and `delete` persist a Memory lifecycle artifact, append a supervisor-authored Ledger event with `payload_ref`, and only then update the registry projection.
- `ether memory accept <candidate_id>` promotes a reviewed candidate into an active Memory Card.
- `ether memory inspect <memory_id>` shows whether a Memory Card is still active or has a deletion tombstone.
- `ether memory block <memory_id> --context <context>` adds a context-specific exclusion without changing source provenance.
- `ether memory delete <memory_id>` removes the active Memory Card projection and persists a `memory.deleted` tombstone that cites the original source events. It does not rewrite Ledger history or perform full artifact redaction.
- `ether context explain <run_id>`, `ether prompt plan <run_id> --content <task>`, `ether prompt audit <run_id> --content <task> --path <response-file>`, `ether memory user-model`, and hibernation resume context assembly consume Memory Card/Tombstone registries only after referenced Ledger event ids pass a provenance gate. Weak, missing, or invalid memory registry provenance fails closed.
- `ether prompt plan` is the first local Agent Orchestrator prompt-assembly slice. It renders authority, instruction hierarchy, assembly manifest, readiness, citation map, response-audit contract, run evidence, tool, capability context, context-budget, memory, taint, response-format, response-contract, planner-checklist, and verification-checklist sections from the source-backed Context Pack plus Ledger event envelopes. `ether prompt audit` reuses the same provenance-gated plan to check a workspace-local response file for required response blocks, source citations, unknown event ids, and forbidden model/tool/raw-payload/runtime-authority/completion claims. Both commands keep evidence text in the user-context message so it cannot override system or developer constraints. The assembly manifest summarizes included/excluded context, guardrails, and risk flags, but it is not persisted and does not grant authority. The readiness summary reports missing evidence, warnings, and next steps for model-preview suitability, but it is not a verification result or runtime status. The citation map records run-event and Memory Card source ids that future model outputs must cite for memory-derived claims, but it is not a new source of truth. The response format and response audit contract define required answer/plan/patch blocks, citation checks, and forbidden claims, but they are static prompt guidance and local output linting rather than executable planning or runtime verification. They do not call a model, execute a tool, authorize side effects, read raw payload artifacts, append Ledger events, or persist prompt artifacts. Context budget values are planning limits from the Context Pack, not proof of actual model token usage, and Capability Cards do not grant runtime permissions.
- `.aetherion/memory/user-model.json` is a projection-only convenience copy derived from accepted Memory Cards, not an independent source of truth.

## Event-Driven Dreaming Pipeline

Dreaming is an event-driven consolidation pipeline. It is not a fixed idle cron and should not be framed as the agent periodically waking up to think.

Semantic triggers include:

- `task.completed`
- `task.failed`
- `user.corrected_agent`
- `memory.contradiction.detected`
- `capability.used_repeatedly`
- `capability.failed_repeatedly`
- `project.state_changed`
- `context_budget_pressure`
- `memory.ttl.expired`
- `machine_idle_with_queued_consolidation`

Idle time can be an execution window, but it is not the semantic reason for dreaming.

Dreaming may:

- Compress raw episodes into memory cards.
- Detect contradictions or stale assumptions.
- Generate capability candidates.
- Replay failed tasks in simulation.
- Propose evals or regression tests.
- Recommend user-model updates.
- Generate memory patches.
- Generate capability patches.
- Generate policy suggestions.
- Generate project graph updates.

Dreaming must not:

- Execute real tools.
- Change external systems.
- Publish skills directly.
- Upgrade permissions.
- Read raw secret values.
- Directly modify active memory, active capability, or policy.
- Convert sensitive data into long-term memory without policy approval.

Dreaming produces reviewable patches, not actions. Low-risk memory patches may be policy-auto-merged only if they are reversible, source-backed, conflict-checked, and fully traceable.

Dreaming and Proactive are separate systems. Dreaming consolidates traces into patches. Proactive decides whether and how to intervene with the user. Deadline, email, CI, PR, file, meeting, focus, and blocked-goal triggers usually belong to Proactive unless they are specifically reviewing stale memory or queued consolidation.
