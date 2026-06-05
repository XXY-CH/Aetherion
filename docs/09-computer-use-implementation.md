# Computer Use Implementation

Computer Use is not a single tool. It is a governed action loop over browser, desktop, file/repo, code, and remote worker environments. Its implementation must preserve the Aetherion kernel invariants: Local Supervisor remains the trust root, Event Ledger remains the fact layer, and Tool Policy Proxy gates sensitive reads, data egress, and side-effectful actions.

## Design Goals

- Operate real user workflows across browser, local computer, files, repos, and sandboxed workers.
- Prefer structured APIs and DOM/CDP access when available.
- Fall back to screenshot-based computer use when structure is missing or unreliable.
- Treat third-party content as tainted by default.
- Verify after each action, not only at the end.
- Record enough trace to reconstruct decisions without retaining sensitive raw payloads forever.
- Never let browser extension, connector, MCP server, generated package, or cloud worker bypass policy.

## Non-Goals

- Unrestricted remote desktop automation.
- Browser extension as an all-sites reader.
- Raw secret access by the agent.
- Live replay of external side effects by default.
- Running generated capability code inside Local Supervisor.

## Runtime Shape

```text
User / IM / Browser / TUI request
  -> Ingress Gateway
  -> Local Supervisor
  -> Event Ledger: run.started
  -> Agent Orchestrator
  -> Context Assembler
  -> Plan step
  -> Tool Access & Action Policy Proxy
  -> Adapter family
       - Browser Harness
       - Local Computer Harness
       - File / Repo Operator
       - Code Runner
       - Connector Adapter
       - Cloud Worker
  -> Observation / artifact
  -> Verifier
  -> Event Ledger
  -> Next step or final response
```

The run loop is iterative. Policy, memory, capability registry, verifier, and audit are consulted repeatedly.

## Tool Request Contract

```yaml
id: toolreq_123
run_id: run_abc
requested_by: agent
capability_ref: cap_browser_research@0.1.0
intent: "Click the export button on the current dashboard"
operation:
  verb: click
  target:
    kind: browser_element
    origin: "https://app.example.com"
    selector_ref: obs_456#button.export
    human_label: "Export"
  expected_effect: "Open export dialog"
risk_inputs:
  action_type: click
  target_resource: browser_tab
  data_sensitivity: private
  side_effect: possible
  reversibility: medium
  audience: local_user
  credential_scope: current_browser_profile
  runtime_boundary: local_browser
  user_intent_strength: explicit
  taint_chain:
    - public_web
  target_confidence: 0.91
  blast_radius: current_page
  data_egress_destination: none
approval:
  policy: preview_if_export
```

## Policy Decision Contract

```yaml
id: policy_123
tool_request_id: toolreq_123
decision: allow | deny | ask | sandbox_only | redact_then_allow
risk_level: L3
reason: "Export click may expose private dashboard data."
lease:
  id: lease_123
  expires_at: "2026-06-05T21:00:00+08:00"
  scope:
    origins:
      - "https://app.example.com"
    actions:
      - click
      - read_dom
    egress:
      allowed:
        - local_artifact_store
      denied:
        - external_email
        - public_web
redactions:
  - credential_fields
  - hidden_inputs
```

## Browser Harness

The browser harness combines four channels:

- DOM and accessibility tree inspection.
- CDP or Playwright automation.
- Screenshot observation and visual grounding.
- Extension-mediated current-tab context.

Preferred order:

1. Use structured DOM/accessibility data for target discovery.
2. Use CDP/Playwright for deterministic action.
3. Use screenshots to verify visual state and recover when DOM is insufficient.
4. Use raw visual click only when target confidence is high enough or user approves.

Browser extension constraints:

- Per-origin permissions.
- Current-tab mode by default.
- Incognito disabled by default.
- DOM snapshots are tainted.
- Redact credentials, tokens, hidden inputs, password fields, and likely secrets before ledger storage.
- Form fill and submit require policy checks.
- Upload, download, payment, permission changes, and external sends require explicit approval.
- Site allowlist and denylist must be enforced by Local Supervisor, not the extension.

## Local Computer Harness

Local computer actions include windows, keyboard, mouse, files, terminal, local apps, and OS automation.

Rules:

- File access is scoped by workspace unless the user grants a lease.
- `$HOME`, `.ssh`, `.env`, keychains, browser profiles, password stores, and system settings default to deny or L5.
- Shell risk is contextual. `pytest` in an empty sandbox differs from unknown network install scripts or production mutations.
- `curl | sh`, credential reads, destructive commands, and production database writes default to L5.
- Every command records cwd, argv, environment redaction policy, expected effect, stdout/stderr artifact refs, and exit status.
- Long-running actions emit progress events and can be cancelled.

## Cloud Worker And Remote VM

Local-first does not forbid remote execution. It defines trust direction.

Remote execution environments are delegated workers, not trust roots:

- Local Supervisor signs a scoped work order.
- Worker receives only scoped context.
- Secrets are never sent raw.
- Vault issues short-lived scoped leases only when absolutely needed.
- Worker cannot directly mutate memory, capability, policy, or vault state.
- Results return as observations and artifacts.
- Network, filesystem, CPU, memory, and lifetime limits are explicit.

```yaml
work_order:
  id: wo_123
  signed_by: local_supervisor
  task: "Run browser replay fixture"
  allowed_inputs:
    - artifact://fixture_abc
  denied_inputs:
    - raw_vault_secret
  allowed_outputs:
    - artifact://worker_result/*
  expires_at: "2026-06-05T21:00:00+08:00"
```

## Sensitive Reads And Data Egress

Tool Policy Proxy gates reads, not just writes.

Examples requiring policy:

- Email body.
- Slack DM history.
- Private Drive document.
- Browser cookies.
- DOM from authenticated SaaS pages.
- `.env`, private keys, tokens, password fields.
- Contract, finance, legal, HR, medical, source code, customer data.

Data egress is a separate risk dimension. Reading private data locally is different from sending it to a model provider, MCP server, Slack group, external email, or public issue.

## Data Sensitivity Classifier

Sensitivity classification must not depend only on an LLM.

Use a layered classifier:

- Deterministic scanners for API keys, private keys, passwords, tokens, SSNs, IDs, credit cards, and credential-like strings.
- Source rules for Gmail private thread, Drive restricted document, repo `.env`, browser password field, Slack DM, and internal SaaS pages.
- LLM classifier for semantic and contextual sensitivity.
- Conservative fallback: unknown sensitivity upgrades risk.

Credential-like content is scanner-first and should bypass ordinary summarization flows.

## Taint Propagation

External content is tainted by default:

- Web pages.
- Emails.
- PDFs.
- IM group chats.
- GitHub issues and PR comments.
- MCP tool descriptions.
- Connector results.
- LLM-generated output.

Taint propagates:

```text
tainted webpage
  -> summary
  -> plan
  -> proposed tool-call justification
```

The final plan remains tainted and cannot authorize actions. Only user instruction, policy, and approved leases can authorize actions.

## Target Confidence

Computer-use actions must estimate whether the intended target is actually identified:

- Correct window.
- Correct browser tab.
- Correct origin.
- Correct account.
- Correct repo, branch, and file.
- Correct UI control.
- Correct form field.

Low target confidence upgrades risk or requires clarification. This is especially important for visual click actions.

## IM Control Surface

IM is a control surface, not an authority root.

Inbound:

```text
incoming message
  -> inbox event
  -> identity and channel trust
  -> session router
  -> run
```

Outbound:

```text
outgoing message draft
  -> outbox item
  -> Tool Policy Proxy
  -> delivery adapter
```

Outbox fields:

```yaml
id: outbox_123
idempotency_key: "run_abc:message_1"
destination: "telegram:user_123"
visibility: dm | group | public
thread_id: "..."
risk_level: L3
approval_required: true
delivery_status: queued | sent | failed | cancelled
retry_count: 0
```

Trust defaults:

- Paired owner DM: higher trust.
- Group mention: limited trust.
- Group non-mention: observe or ignore.
- Unknown user: pairing required.
- Attachments: quarantine.
- Group commands: stricter approval.

An IM approval approves one scoped action. It does not create broad or permanent authority.

## Replay Semantics

Replay does not mean repeating live side effects.

| Replay Type | Meaning | Default |
| --- | --- | --- |
| Trace replay | Reconstruct events, plans, policy decisions, observations, and tool results | Allowed |
| Simulation replay | Re-run capability in sandbox or fixture | Allowed |
| Live replay | Re-call real external API, real browser, or real computer side effect | Disabled unless explicitly approved |

All replay records must identify which mode was used.

## Verifier Loop

Verifier is part of the action loop, not just the final step.

After each action:

1. Capture observation.
2. Compare expected effect with observed state.
3. Detect sensitive exposure or unexpected side effect.
4. Decide continue, retry, rollback, ask, or stop.
5. Emit verification event.

## MVP Scope

Computer Use MVP should prove:

- One local file/repo read action.
- One approval-gated local write action.
- One browser current-tab observation.
- One DOM/CDP browser action.
- One screenshot fallback verification.
- One sandboxed command.
- One IM outbox approval.
- One trace replay and one simulation replay.

Exit criterion:

```text
user request
-> policy
-> action
-> verifier
-> event trace
-> reconstructable result
```
