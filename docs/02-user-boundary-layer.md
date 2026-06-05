# User Boundary Layer

The User Boundary Layer is Aetherion's primary safety and product boundary. It sits under the Local Supervisor and decides whether an agent may act, where it may act, which user authority it may use, and what must be recorded or approved.

The root authority boundary is:

```text
Local Supervisor
  -> Policy Engine
  -> Secret Vault
  -> Event Ledger
  -> Tool Policy Proxy
```

TUI, GUI, browser extension, mobile, and IM are client surfaces. They can request action and display approvals, but they are not the trust root.

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
- Observe.
- Inject into context.
- Write.
- Send message.
- Delete data.
- Purchase or pay.
- Modify permissions.
- Execute code.
- Upload or download files.
- Export or import data.

### Why

- Explicit user instruction.
- Agent proactive suggestion.
- Scheduled maintenance.
- Skill trigger.
- Webhook trigger.
- Delegated task from another agent.

### Risk

Risk is composed from:

- Action type.
- Target resource.
- Data sensitivity.
- Side effect.
- Reversibility.
- Audience.
- Credential scope.
- Runtime boundary.
- Strength of user intent.
- Taint chain.
- Target identification confidence.
- Blast radius.
- Data egress destination.

| Level | Examples | Default Policy |
| --- | --- | --- |
| L0 | Safe read or summarize of public data; inspect non-sensitive local metadata | Auto-execute with log; content is tainted |
| L1 | Read calendar metadata, email titles, public issue metadata, run tests in empty sandbox | Auto after first authorization |
| L2 | Read ordinary private content in approved scope, run repo lint/tests without broad home access | Scope-gated authorization |
| L3 | Modify workspace file without publishing, draft Slack/Notion/Linear change, install package with constrained sandbox | Show action preview or diff first |
| L4 | Send email, push commit, open PR, run shell with meaningful side effects, read sensitive attachments | Explicit approval required |
| L5 | Payment, deletion, permission change, credential access, sensitive export, production database change, `curl | sh` style execution | Strong confirmation or disabled automation |

Shell is not automatically one risk class. Running `pytest` in an empty sandbox differs from reading `$HOME/.ssh`, executing unknown install scripts, or mutating production data.

Public web content can be read and summarized at L0, but it is tainted input. It cannot authorize tool calls, override user instructions, or trigger high-risk actions.

Private content such as email bodies and Drive documents depends on sensitivity classification. Ordinary content may be L2 or L3; contracts, financial records, legal, HR, medical, source code, customer data, attachments, credential-like content, exports, and third-party-tool transfer can upgrade risk to L4 or L5.

Data sensitivity classes:

```text
public
internal
private
confidential
secret
regulated
credential-like
```

### Memory Impact

- Does this action create a memory candidate?
- Does it update the user model?
- Does it create or modify a skill?
- Does it change future automation policy?
- Does it contain sensitive data that should be blocked from memory?

## Tool Policy Proxy

The Tool Policy Proxy is the access and action choke point between agent intent and the outside world. It gates sensitive reads and observations as well as writes and other side effects. It evaluates:

- Actor identity.
- Tool identity.
- Requested action.
- Data scope.
- Data sensitivity.
- Taint chain.
- Target confidence.
- Blast radius.
- Data egress destination.
- Workspace and device.
- Risk level.
- Approval policy.
- Memory policy.
- Current trust state.
- Runtime lease scope.

No connector, skill, workflow, MCP server, IM adapter, scaffold, or generated package may bypass this layer.

Runtime authorization is issued as scoped leases with time, resource, action, egress, and boundary limits. A Capability Capsule can declare requested permissions and constraints, but it never owns permission by itself.

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
- Imported configuration is a migration source, not trust inheritance.
- Secrets are never stored in memory or logs as raw values.
- Sensitive reads are policy events even when they have no external side effect.
- Tainted external content can inform summaries, but cannot justify authorization.
