# Audit and Data Contracts

## Audit Principles

- Logs are human-readable and machine-parseable.
- Every security-relevant decision, external side effect, permission change, memory change, capability change, and user-visible output can be reconstructed.
- Low-value high-frequency observations may be sampled, summarized, or cleared according to retention policy.
- Every material action has an actor, reason, input, output, risk level, and timestamp.
- Every memory claim points back to source events.
- Every Capability Capsule and capability package has version history and rollback.
- Every permission change has a diff and consent record.
- Every proactive action explains its trigger.
- Audit logs themselves are sensitive artifacts and need retention, redaction, encryption, and export-sanitization policies.

## Source Of Truth

Human-readable files are the durable source of truth:

- Markdown for playbooks, decisions, reports, and human review.
- YAML for manifests, policies, and migration reports.
- JSONL for append-only event streams.

SQLite, vector databases, graph indexes, and search indexes are rebuildable projections. Secrets are never stored in memory, logs, traces, or projections as raw values.

Human-readable files are the governance source of truth for events, state, memory, capability, and policy metadata. Large or sensitive payloads may be stored as encrypted artifacts referenced by human-readable manifests.

## Ledger And Artifact Retention

```yaml
event_id: evt_123
type: email.body.read
actor: agent.local
resource_ref: artifact://encrypted/email_body_abc
sha256: "..."
sensitivity: confidential
retention: 30d
redaction_status: active
```

When content is deleted or expires, the ledger appends a tombstone instead of rewriting history:

```yaml
event_id: evt_456
type: artifact.redacted
target: artifact://encrypted/email_body_abc
reason: user_delete_request
method: cryptographic_erasure
```

This preserves provenance while allowing sensitive payload destruction. Projections that depended on the artifact must either rebuild without it or mark the source as redacted.

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
event_type: user_message | tool_call | tool_result | approval | memory_candidate | capability_candidate | proactive_opportunity | policy_decision
summary: "User requested initial Aetherion documentation."
hash_version: aetherion-event-v1
parent_event_id: event_20260605_000
parent_event_hash: "sha256:..."
event_hash: "sha256:..."
payload_ref: blobs/event_20260605_001.json
sensitivity: low | medium | high
taint:
  source: user | trusted_system | connector | public_web | third_party_content
  can_authorize_actions: false
retention:
  ttl: 365d
  user_deletable: true
policy:
  can_personalize: true
  can_train: false
```

## Proactive Opportunity

```yaml
id: opp_20260605_001
source_events:
  - event_123
hypothesis: "A repeated failure pattern suggests this workflow should become a capability patch."
proposed_intervention:
  type: silent_update | inbox | digest | ask | draft | auto_act
utility: 0.72
urgency: 0.31
confidence: 0.83
interruption_cost: 0.44
reversibility: high
risk_class: L2
expires_at: "2026-06-12T00:00:00+08:00"
policy_decision: queue
inhibitors:
  user_in_meeting: false
  quiet_hours: false
  same_topic_recently_notified: true
  user_ignored_similar_opportunity: false
  confidence_below_threshold: false
  action_not_reversible: false
  source_tainted: true
  goal_not_user_confirmed: false
  channel_is_group_chat: false
```

Intervention ladder:

```text
silent memory update
-> proactive inbox
-> digest
-> low-friction notification
-> ask for permission
-> draft action
-> low-risk autonomous action
```

## Replay Record

```yaml
id: replay_123
run_id: run_abc
mode: trace | simulation | live
source_events:
  - event_123
artifact_ref: artifact://replay/run_abc/trace
live_side_effects:
  allowed: false
  approval_id: null
result:
  status: passed | failed | partial
  summary: "Trace reconstructed without live tool calls."
```

Replay defaults to trace reconstruction or sandbox simulation. Live side-effect replay is disabled unless explicitly approved.

## Causal Reports And Projections

Causal graph rows and SQLite indexes are rebuildable projections over Event Ledger facts. A projected edge must cite source events and label its inference basis. Typed event order may support a temporal dependency candidate, but it does not prove causation.

Why Reports and Counterfactual Reports must list evidence, assumptions, unknowns, confidence, and redaction status. Counterfactual output is report-only unless a separate sandbox evaluation contract is explicitly approved; it never authorizes or repeats live side effects.

## Migration Report

```yaml
id: migration_openclaw_20260605
source: openclaw
imported:
  - channels.telegram
  - models.openai
mapped_with_high_confidence:
  - allowlist
mapped_with_low_confidence:
  - group_mention_policy
quarantined:
  - plugins
  - hooks
  - tools
unsupported:
  - field_x
secrets:
  - migrated_as_vault_ref
requires_review:
  - cron_jobs
  - shell_tools
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
    event-plane/
    memory-os/
    capability-os/
    scaffold-os/
    connector-plane/
    execution-plane/
    computer-use/
  examples/
    capabilities/
    memory/
    audit/
```
