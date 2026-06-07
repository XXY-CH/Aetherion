# Computer Use Implementation

Computer Use is not a single tool. It is a governed action loop over browser, desktop, file/repo, code, and remote worker environments. Its implementation must preserve the Aetherion kernel invariants: Local Supervisor remains the trust root, Event Ledger remains the fact layer, and Tool Policy Proxy gates sensitive reads, data egress, and side-effectful actions.

Computer Use is post-V1 scope. V1 is TUI-only and should prove the local kernel loop before browser extension, browser automation, IM delivery, cloud workers, or real connectors are introduced.

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

## Reference Implementation Lessons

The 2026-06-07 reference scan looked at the public OpenAI Codex repository (`openai/codex`, commit `b89ce9a2bcedcfddf3a48f387b7912d602d6d87c`) and Claude Code public documentation. The useful lessons are architectural, not code-copy targets.

Concrete Codex source points reviewed:

- `codex-rs/features/src/lib.rs`: desktop/browser/computer-use capabilities are requirements-only feature gates, not casual user-config switches.
- `codex-rs/core/src/hook_runtime.rs`: `PreToolUse`, `PermissionRequest`, and `PostToolUse` are stable hook contracts with adapted tool inputs rather than raw internal tool state.
- `codex-rs/core/src/tools/sandboxing.rs`: approval decisions are keyed and can be cached for a session, but sandbox restrictions such as denied reads must not be silently dropped.
- `codex-rs/execpolicy/README.md`: executable policy rules include human-readable justification plus match/not-match examples that act like rule tests.
- `codex-rs/tui/src/bottom_pane/app_link_view.rs`: external browser/app flows validate HTTPS URLs, separate auth/external-action suggestions, and route completion back through elicitation instead of granting authority directly.

- Codex exposes sandbox and approval state as explicit protocol objects. Aetherion should do the same for every GUI, browser, IM, and app-server surface, but the protocol object is only a view over Supervisor policy and Ledger evidence.
- Codex records session/rollout streams separately from projections. Aetherion should preserve this split: Event Ledger remains the source of truth; indexes, GUI timelines, and computer-use observations are rebuildable.
- Codex has separate command approval, file-change approval, permission profiles, network context, and guardian-style review payloads. Aetherion should model browser/desktop/shell actions with similarly precise action kinds, but bind every approval to a scoped lease and source event.
- Codex's requirements-only feature gates map directly to Aetherion adapter manifests: browser/desktop/computer-use adapters must cite source events proving the capability was enabled by product requirements, not by a user-config escape hatch.
- Codex's approval-key pattern maps to Aetherion scoped leases: session-level convenience may be cached per exact adapter/action/target key, but the cached approval is not a permission and cannot cross origin, tab, file path, window, or child-agent boundary.
- Claude Code's permission evaluation order is useful: hooks/guards, deny rules, permission mode, allow rules, then runtime approval. Aetherion should keep the deny-first property, but should not implement a global `bypassPermissions` equivalent. The closest concept is a scoped, expiring lease for one action surface.
- Claude Code's tool taxonomy separates read, write, shell, web fetch/search, subagents, monitor, worktree, checkpoint, and scheduled wakeups. Aetherion should keep tool families explicit because browser DOM reads, screenshot observations, shell commands, and outbound sends have different taint and egress risk.
- Claude Code warns that inherited subagent permissions are dangerous. Aetherion's multi-agent model should never inherit browser, desktop, vault, network, or shell authority. Child runs receive separate budgets and separate leases.

The key difference is that Aetherion treats observations as evidence, not authority. A DOM snapshot, screenshot, tool output, or subagent result can support a verifier, but it cannot authorize the next side effect.

## Computer-Use Contracts

The control-plane contracts are:

- `computer-action`: a policy-linked action request. It records source events, adapter, adapter requirements gate evidence, channel, target, confidence, taint, egress destination, policy decision, optional lease, optional approval card, exact approval keys, expected effect, and the invariant that live replay is disabled.
- `computer-observation`: post-action or observe-only evidence. It stores artifact hashes, redaction counts, taint, observed effect, and verifier status while explicitly marking raw payload persistence and authorization as false.

Channel preference is part of the contract:

1. Browser observe/read: DOM/accessibility first, then CDP, then screenshot.
2. Browser action: CDP/structured action first, screenshot only as verifier or high-confidence fallback.
3. Desktop action: accessibility APIs first, screenshot fallback only with high confidence.
4. Shell/file/sandbox: structured argv/path/workspace descriptors, not free-form opaque strings as authority.

Any side-effectful computer action requires a policy decision plus a scoped lease. If the adapter can create side effects, it also requires an approval card. Tainted observations cannot be routed to external egress destinations.

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

## Post-V1 MVP Scope

Computer Use MVP should prove after the TUI kernel loop is stable:

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

## Current Phase 12 Control-Plane Slice

The current implementation does not yet drive the browser or desktop. It implements the first trustworthy control-plane slice needed before real computer-use actions:

- `ether surface browser-observe` ingests a caller-supplied current-tab observation. It requires a source Event Ledger id, asks the Rust supervisor for `security.taint.evaluate` on `public_web`, persists only the DOM SHA-256 plus redaction counts, and appends `browser.observation.ingested`. Raw DOM is not persisted and cannot authorize actions.
- `packages/computer-use` now defines the next control-plane contracts for governed computer actions and observations. It enforces current-tab browser scope, structured-first channel selection, scoped leases for side effects, approval cards for side-effectful adapters, non-authorizing taint, and no live replay. It still does not click, type, or drive the desktop.
- `ether surface im-inbox` persists inbound IM metadata as sender/message hashes. Unknown/group/public inputs are risk-upgraded and cannot authorize actions.
- `ether surface im-outbox` validates the source run, asks Rust `surface.outbox.evaluate`, queues DM/group messages for one scoped approval, blocks public sends, stores only destination/body hashes, and attempts no delivery.
- `ether store install` validates a Store Package, verifies Ed25519 over the canonical Capsule declaration, requires passing replay tests, sandbox trial, and permission-diff approval, then installs only the Capsule declaration. Package code is not executed.

This deliberately follows the lessons from mature computer-use surfaces: prefer structured observation before screenshots, observe after action, treat external content as untrusted, require scoped approval for risky UI/egress operations, and make runtime failures auditable. The actual DOM/CDP action channel, screenshot fallback, OS automation, browser extension, IM delivery adapter, and GUI console remain future work.
