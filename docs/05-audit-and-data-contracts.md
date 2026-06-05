# Audit and Data Contracts

## Audit Principles

- Logs are human-readable and machine-parseable.
- Every material action has an actor, reason, input, output, risk level, and timestamp.
- Every memory claim points back to source events.
- Every skill and capability package has version history and rollback.
- Every permission change has a diff and consent record.
- Every proactive action explains its trigger.

## Event Record

```yaml
id: event_20260605_001
timestamp: "2026-06-05T20:00:00+08:00"
workspace_id: ws_default
session_id: sess_123
actor:
  type: user | agent | system | external
  id: user_local
channel:
  type: desktop | browser | im | mobile | api
  id: desktop_main
event_type: user_message | tool_call | tool_result | approval | memory_candidate | skill_candidate
summary: "User requested initial Aetherion documentation."
payload_ref: blobs/event_20260605_001.json
sensitivity: low | medium | high
retention:
  ttl: 365d
  user_deletable: true
policy:
  can_personalize: true
  can_train: false
```

## Action Record

```yaml
id: action_20260605_001
timestamp: "2026-06-05T20:01:00+08:00"
requested_by: user_local
executed_by: agent
workspace_id: ws_default
intent: "Create initial project documents"
tool:
  id: filesystem.write
  version: local
risk_level: L4
approval:
  required: false
  reason: "User explicitly requested local document creation inside workspace."
inputs:
  paths:
    - README.md
    - docs/
outputs:
  artifacts:
    - README.md
    - docs/00-product-brief.md
memory_impact:
  candidate_created: false
result:
  status: success
  summary: "Initial documentation created."
```

## Permission Policy

```yaml
policy_id: default_local_workspace
subject:
  user_id: user_local
  workspace_id: ws_default
grants:
  - tool: filesystem.read
    scope:
      paths:
        - "."
    risk_max: L2
  - tool: filesystem.write
    scope:
      paths:
        - "."
    risk_max: L4
    approval: explicit_user_task
denies:
  - tool: external.email.send
    scope: "*"
  - tool: payment.execute
    scope: "*"
```

## Memory Candidate

```yaml
id: memcand_20260605_001
source_events:
  - event_20260605_001
candidate:
  type: preference
  subject: user
  content: "User wants Aetherion designed as a full Agent OS rather than a narrow chatbot."
confidence: 0.9
sensitivity: low
review:
  status: pending | accepted | rejected
  reviewer: user | policy | agent
allowed_contexts:
  - product_design
  - architecture
blocked_contexts: []
```

## Repository Layout Proposal

```text
Aetherion/
  README.md
  docs/
    00-product-brief.md
    01-architecture.md
    02-user-boundary-layer.md
    03-memory-os.md
    04-skill-and-scaffold-os.md
    05-audit-and-data-contracts.md
    06-roadmap.md
  schemas/
    event.schema.json
    memory-card.schema.json
    skill-manifest.schema.json
    capability-package.schema.json
    permission-policy.schema.json
  packages/
    desktop/
    browser-extension/
    harness-core/
    memory-os/
    skill-os/
    scaffold-os/
    execution-plane/
  examples/
    capabilities/
    memory/
    audit/
```

