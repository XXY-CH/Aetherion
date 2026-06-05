# Roadmap

## Phase 0: Foundation Documents

Goal: turn the concept into a buildable product frame.

Deliverables:

- Product brief.
- Layered architecture.
- User Boundary Layer policy.
- Memory OS model.
- Skill and Scaffold OS lifecycle.
- Audit and data contract drafts.
- MVP acceptance criteria.

Exit criteria:

- A developer can explain what belongs in each subsystem.
- A developer can identify which subsystem owns permissions, memory, skills, tools, and execution.
- A developer can start scaffolding schemas and packages without guessing product intent.

## Phase 1: TUI Kernel Plus One Real Action

Goal: create the TUI-first local kernel loop and prove one complete local run. This phase intentionally excludes GUI, mobile, IM, browser extension, browser automation, MCP/OAuth connectors, and cloud workers.

Deliverables:

- Workspace identity and local project registry.
- Local Supervisor daemon.
- Append-only Event Ledger.
- Tool Policy Proxy.
- Secret Vault references.
- Risk composition model.
- Approval card model.
- File operator.
- Minimal TUI.
- One local file/repo read action.
- One approval-gated local write action.
- One run trace.

Exit criteria:

- User can issue a local task.
- Agent can request local workspace actions.
- Agent can execute a reversible local action through policy.
- Event and action records can reconstruct the policy decision and result.
- Replay means trace reconstruction, not live side-effect repetition.

## Phase 2: Rust Supervisor POC With TUI Client

Goal: move the root authority proof toward Rust without broadening product surfaces.

Deliverables:

- Rust Local Supervisor POC.
- JSON-RPC over stdio or local socket.
- Workspace init.
- Event append JSONL.
- Simple policy evaluation.
- Workspace-scoped file read/write through scoped leases.
- TypeScript TUI client calling the supervisor.

Exit criteria:

- TUI can call Rust supervisor for the same Phase 1 loop.
- Supervisor remains the authority boundary.
- TS harness/orchestrator cannot bypass supervisor policy.
- No GUI, IM, browser extension, MCP/OAuth, or cloud worker is required.

## Phase 3: Memory OS MVP

Goal: make memory useful from real run traces without turning it into an untraceable vector dump.

Deliverables:

- Raw event log storage.
- Memory card schema.
- Memory candidate review state.
- Episodic task timeline.
- Basic user model file.
- Context assembler retrieval rules.

Exit criteria:

- Memory cards always cite source events.
- Sensitive memory can be blocked from future contexts.
- User can inspect and delete memory.
- Context assembly can show why memory was selected.

## Phase 4: Computer Harness MVP

Goal: combine browser, local computer, sandbox, and verifier loops under policy after the TUI kernel loop is proven. This is post-V1 scope.

Deliverables:

- DOM/CDP browser operator.
- Screenshot fallback path.
- Sandboxed browser runtime.
- Browser extension per-origin/current-tab permission model.
- Tainted third-party content handling.
- Verifier and replay anchors.
- Risk upgrades for credentials, secrets, external sends, installs, and destructive actions.
- Tool request and policy decision contracts.

Exit criteria:

- Browser task can use DOM when available and screenshots when needed.
- Public web content is tainted and cannot authorize actions.
- High-impact actions require approval.
- Computer-use trace can be replayed or summarized.
- Sensitive reads and data egress are policy-gated.

## Phase 5: Capability Capsule MVP

Goal: turn repeated workflows into governed capabilities.

Deliverables:

- Capability Capsule manifest schema.
- Skill importer compatibility layer.
- Capability registry.
- Draft, test, publish, deprecated states.
- Replay test harness over historical episodes.
- Capability scoring metrics.

Exit criteria:

- Agent can propose a capability patch from repeated episodes.
- Draft capability can be tested before use.
- Published capsule has version, source tasks, evals, risk, provenance, and rollback.
- Capability cannot receive tool permissions directly.

## Phase 6: Proactive Shadow Mode

Goal: make proactive behavior measurable before letting it interrupt users.

Deliverables:

- Opportunity object schema.
- Event correlation.
- Salience scoring.
- Attention budget.
- Policy gate.
- Intervention ladder.
- Shadow-mode inbox.

Exit criteria:

- Proactive suggestions cite trigger, hypothesis, risk, and expiry.
- Suggestions are queued before notifications by default.
- User can disable or scope proactive sources.
- All opportunities are auditable.

## Phase 7: Scaffold OS and Capability Packages

Goal: let the agent generate extensions while preserving engineering control.

Deliverables:

- Capability package manifest.
- Tool, workflow, connector, and UI templates.
- Permission diff engine.
- Sandbox trial runner.
- Static safety scan hook.
- Approval UI contract.
- Package signing and rollback metadata.

Exit criteria:

- Agent can generate a package draft.
- Package cannot install until schema, tests, permission diff, sandbox, and approval pass.
- Permission changes are visible between versions.

## Phase 8: Minimal User Connection

Goal: prove the harness can enter real user workflow after TUI-first authority and policy loops are stable.

Deliverables:

- One IM adapter, such as Telegram or Slack.
- Browser extension prototype in current-tab observe/read mode.
- Device and channel identity mapping.
- Local file/repo operator.
- Basic connector import quarantine path.
- Inbox/outbox model with idempotency.

Exit criteria:

- User can wake the agent remotely.
- Browser extension can send structured page context to Local Supervisor.
- IM cannot bypass Tool Policy Proxy.
- Outbound IM messages go through outbox policy.
- Imported config generates migration report and does not inherit trust.

## Phase 9: GUI and Broader Connectors

Goal: mature the user-facing product once the kernel loop is proven.

Deliverables:

- Mobile companion or lightweight approval surface.
- OAuth connector runtime for a small integration set.
- Device pairing.
- Channel identity mapping.
- GUI desktop console.
- Broader connector catalog.

Exit criteria:

- User can wake the agent remotely.
- User can approve high-risk action from another device.
- Chat channel cannot bypass Local Supervisor or Tool Policy Proxy.
- Connector authorization remains separate from agent action approval.
