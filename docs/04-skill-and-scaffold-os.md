# Capability and Scaffold OS

## Concepts

| Concept | Meaning | Executable Code | Agent May Modify |
| --- | --- | ---: | ---: |
| Memory | Facts and interpretations about user, project, world, and task history | No | Yes, with trace |
| Skill | Procedural knowledge or imported skill document for doing a class of tasks | Usually no | Yes, with versioning |
| Tool | Callable function, API, or system capability | Yes | Not directly auto-deployed |
| Workflow | Orchestration of skills and tools | Sometimes | Yes, with tests |
| Scaffold | Template for generating tools, workflows, apps, connectors, or UI | Yes | Yes, with review |
| Capability Package | Installable isolated capability bundle | Yes | Generated, validated, approved |
| Capability Capsule | Governed internal ability unit binding playbook, manifest, tool contract, permission requirements and constraints, tests, evals, policy, provenance, and rollback | Sometimes | Yes, through patch lifecycle |

Skill is not plugin. Skill is knowledge and an import compatibility surface. Tool is power. Permission belongs to the Tool Policy Proxy and execution boundary. Capability Capsule is the internal unit Aetherion should optimize around.

A Capability Capsule does not own permissions. It declares permission requirements, allowed tool contracts, and forbidden actions. Runtime grants are issued by policy as scoped leases.

## Capability Lifecycle

```text
Observe task history
  -> Detect repeatable pattern
  -> Draft capability patch
  -> Run synthetic tests
  -> Run replay tests from historical episodes
  -> Classify risk
  -> Request policy or user approval
  -> Publish version
  -> Use in real tasks
  -> Measure success and failure
  -> Propose patch
  -> Upgrade or rollback
```

## Capability Capsule Manifest

```yaml
id: draft-investor-update
kind: capability_capsule
version: 1.2.0
description: Draft monthly investor updates from project notes, metrics, and recent decisions.
playbook:
  source: playbook.md
when_to_use:
  - user asks for investor update
  - monthly reporting task is due
inputs:
  - project_notes
  - metrics
  - recent_decisions
outputs:
  - markdown_report
permission_requirements:
  required_tools:
    - memory.search
    - docs.read
  forbidden_tools:
    - email.send
risk_level: L2
approval:
  before_external_send: required
evals:
  - investor_update_quality
  - hallucination_check
  - source_coverage
rollback:
  previous_version: 1.1.0
owner: user
created_by: agent
source_tasks:
  - task_abc
provenance:
  created_from_events:
    - event_abc
```

Skills imported from Hermes, agent skill repositories, or OpenClaw should be normalized into draft Capability Capsules and quarantined until policy checks pass.

## Capability Package

Capability packages are Aetherion's extension unit.

Generated package code must never run inside the Local Supervisor process. Capability package code runs in a separate process or sandbox with limited filesystem access, limited network access, no raw vault access, structured IPC, and resource limits. Local Supervisor owns policy, ledger, vault, and routing; it does not load untrusted dynamic code.

```text
capability/
  manifest.yaml
  README.md
  src/
    tool.ts
    schema.ts
    policy.ts
  tests/
    unit.test.ts
    replay.test.ts
    safety.test.ts
  evals/
    quality.yaml
    regression.yaml
  examples/
    happy_path.md
    failure_cases.md
  permissions/
    scopes.yaml
  ui/
    approval_card.tsx
    settings_panel.tsx
```

## Capability Manifest

```yaml
id: gmail-digest-writer
type: tool
version: 0.1.0
created_by: agent
requires:
  oauth:
    provider: google
    scopes:
      - gmail.readonly
  tools:
    - memory.write_candidate
risk:
  read: medium
  write: none
  external_effect: none
allowed_actions:
  - list_emails
  - summarize_threads
forbidden_actions:
  - send_email
  - delete_email
runtime:
  sandbox: required
  network:
    allow_domains:
      - gmail.googleapis.com
tests:
  required:
    - unit
    - replay
    - permission
approval:
  install: user_required
  upgrade: user_required_if_permissions_change
```

## Deployment Gates

Gate strength should scale with risk and permission delta.

| Change Type | Gate |
| --- | --- |
| Playbook or document-only change | Schema, diff, source trace, optional review |
| Memory patch | Source trace, confidence, conflict check, policy |
| Workflow change | Schema, replay test, diff, approval if side effects change |
| Tool code change | Full gate |
| Permission expansion | Full gate plus explicit user approval |
| Secret scope change | Full gate plus re-auth |
| External package install | Quarantine plus full gate |

Full gate before high-risk installation or upgrade:

1. Validate manifest schema.
2. Typecheck package.
3. Run unit tests.
4. Run replay tests.
5. Run permission diff.
6. Run static safety scan.
7. Run sandbox trial.
8. Generate approval card.
9. Sign package or capsule.
10. Register rollback target.

## Scoring

Skills and packages should accumulate metrics:

- Success rate.
- User correction rate.
- Tool error rate.
- Mean steps to completion.
- Permission escalation frequency.
- Safety incident count.
- Source coverage.
- Regression stability.

Scores can suggest patches, but cannot bypass lifecycle gates.
