# Memory OS

Aetherion memory is an auditable operating system for user understanding, not a loose embedding store.

## Goals

- Preserve source-backed long-term memory.
- Support fast context assembly for real tasks.
- Separate raw events from interpreted memories.
- Track confidence, sensitivity, TTL, and contradictions.
- Let the user inspect, edit, export, and delete memory.
- Feed skill evolution without silently rewriting user truth.
- Support dreaming and simulation for improvement.

## Layers

### 1. Raw Event Log

Immutable source events:

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

## Dreaming Loop

Dreaming is a controlled simulation and consolidation loop. It can run after major tasks, during idle periods, or when repeated failure patterns appear.

Dreaming may:

- Compress raw episodes into memory cards.
- Detect contradictions or stale assumptions.
- Generate skill candidates.
- Replay failed tasks in simulation.
- Propose evals or regression tests.
- Recommend user-model updates.

Dreaming must not:

- Execute real tools.
- Change external systems.
- Publish skills directly.
- Upgrade permissions.
- Convert sensitive data into long-term memory without policy approval.

