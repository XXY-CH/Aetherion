# User Boundary Layer

The User Boundary Layer is Aetherion's primary safety and product boundary. It decides whether an agent may act, where it may act, which user authority it may use, and what must be recorded or approved.

## Boundary Questions

Every material action must answer six questions.

### Who

- User ID.
- Device ID.
- Channel ID.
- Current session.
- Current workspace.
- Current trust level.

### Where

- Local computer.
- Local browser.
- Sandboxed browser.
- Cloud browser.
- Cloud VM.
- User SaaS API.
- Team shared environment.

### What

- Read.
- Write.
- Send message.
- Delete data.
- Purchase or pay.
- Modify permissions.
- Execute code.
- Upload or download files.

### Why

- Explicit user instruction.
- Agent proactive suggestion.
- Scheduled maintenance.
- Skill trigger.
- Webhook trigger.
- Delegated task from another agent.

### Risk

| Level | Examples | Default Policy |
| --- | --- | --- |
| L0 | Search public web, summarize public page, inspect local non-sensitive metadata | Auto-execute with log |
| L1 | Read calendar metadata, read email titles, list repository issues | Auto after first authorization |
| L2 | Read email body, read Drive document, inspect private repository content | Scope-gated authorization |
| L3 | Send Slack message, create Linear issue, edit Notion draft | Show action preview or diff first |
| L4 | Send email, submit PR, run shell, modify files | Explicit approval required |
| L5 | Payment, data deletion, permission changes, sensitive export | Strong confirmation or disabled automation |

### Memory Impact

- Does this action create a memory candidate?
- Does it update the user model?
- Does it create or modify a skill?
- Does it change future automation policy?
- Does it contain sensitive data that should be blocked from memory?

## Permission Firewall

The Permission Firewall sits between agent intent and execution. It evaluates:

- Actor identity.
- Tool identity.
- Requested action.
- Data scope.
- Workspace and device.
- Risk level.
- Approval policy.
- Memory policy.
- Current trust state.

No connector, skill, workflow, or generated package may bypass this layer.

## Consent Ledger

Approvals should be recorded as durable, inspectable records:

```yaml
id: consent_20260605_001
user_id: user_local
workspace_id: ws_default
action_id: act_123
requested_by: agent
reason: "User asked Aetherion to create a project document"
risk_level: L4
scope:
  filesystem:
    paths:
      - "/Users/xiexingyu/Documents/项目/Aetherion"
decision: approved
approved_at: "2026-06-05T20:00:00+08:00"
expires_at: null
memory_impact: none
```

## Default Safety Rules

- A chat channel can request action, but cannot become the root authority boundary.
- Each user should have an isolated runtime boundary.
- Agent-generated skills and packages start with no real user permissions.
- A permission upgrade requires a visible diff.
- High-risk actions must produce a readable preview before execution.
- Memory writes should be policy-gated separately from tool execution.
- Revocation should be granular by user, device, channel, connector, tool, skill, and package.

