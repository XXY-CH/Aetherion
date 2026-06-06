# Requirements: Aetherion

**Defined:** 2026-06-06
**Core Value:** Agents can perform real local work only through an inspectable policy, lease, event, verification, and replay loop that the user can audit.

## v1 Requirements

### Contracts

- [ ] **CONT-01**: Developer can validate every contract example against its JSON Schema with one command.
- [ ] **CONT-02**: Kernel loop contracts cover Event, Tool Request, Policy Decision, Scoped Lease, Action Record, Observation Record, Verification Record, Consent Record, Permission Policy, and Replay Record.
- [ ] **CONT-03**: Capability, Memory, Proactive, Context, and Migration contracts remain human-readable and example-backed.

### TUI Kernel

- [ ] **TUI-01**: User can run a TUI command against a local workspace and input file.
- [ ] **TUI-02**: TUI run creates or uses local workspace identity without requiring GUI, IM, browser, connector, or cloud setup.
- [ ] **TUI-03**: TUI run appends typed events for run start, tool request, policy decision, observation, verification, and run completion.
- [ ] **TUI-04**: TUI run performs a local file read through policy and scoped lease.
- [ ] **TUI-05**: TUI run performs a local file write only when explicit approval is provided.
- [ ] **TUI-06**: TUI run emits replay data that reconstructs the trace without repeating live side effects.

### Policy And Authority

- [ ] **POL-01**: Policy denies requests outside the active workspace boundary.
- [ ] **POL-02**: Policy distinguishes allowed reads, approval-gated writes, and denied unsupported actions.
- [ ] **POL-03**: Scoped leases bind allowed actions to paths, run identity, expiry or lifecycle, and denied action classes.
- [ ] **POL-04**: Local Supervisor POC can initialize workspace ledger, evaluate deterministic file policy, issue scoped leases, and gate local read/write.
- [ ] **POL-05**: TypeScript TUI cannot bypass supervisor policy once Rust IPC integration is introduced.

### Replay And Audit

- [ ] **AUD-01**: Event traces are human-readable and machine-parseable.
- [ ] **AUD-02**: Replay reconstructs policy decisions, actions, observations, verification, and results.
- [ ] **AUD-03**: Runtime state such as `.aetherion/`, `.omc/`, and `target/` remains ignored from git.
- [ ] **AUD-04**: Verification commands cover TypeScript contracts/TUI scaffolds and Rust supervisor tests.

### Computer Use Scaffold

- [ ] **CUSE-01**: Computer Use package models adapters as post-V1 execution targets behind policy.
- [ ] **CUSE-02**: Computer Use scaffold rejects quarantined adapters and requires verifier involvement before execution.
- [ ] **CUSE-03**: Computer Use documentation states real browser automation is out of V1 scope.

### Connector Scaffold

- [ ] **CONN-01**: Connector SDK models imported connectors as quarantined by default.
- [ ] **CONN-02**: Connector SDK rejects raw secret references and requires vault references.
- [ ] **CONN-03**: Connector documentation states MCP/OAuth/SaaS connectors are out of V1 runtime scope.

### Documentation And Planning

- [ ] **DOC-01**: README links the product, architecture, roadmap, Computer Use, technical strategy, migration, and runtime-economics documents.
- [ ] **DOC-02**: Roadmap preserves the V1 TUI-only boundary.
- [ ] **DOC-03**: GSD planning artifacts exist under `.planning/` and map requirements to phases.
- [ ] **DOC-04**: Commit history records planning and implementation decisions using the Lore commit protocol.

## v2 Requirements

### Memory OS

- **MEM-01**: Memory Cards cite source events and carry confidence, sensitivity, TTL, allowed contexts, and blocked contexts.
- **MEM-02**: Dreaming proposes memory/capability/eval/policy patches without direct external actions.
- **MEM-03**: Context assembler explains why memory was selected.

### Capability OS

- **CAP-01**: Capability Capsules include playbook, manifest, tool contract, permission requirements, tests, evals, policy, provenance, lifecycle, and rollback.
- **CAP-02**: Draft capsules are replay-tested before activation.
- **CAP-03**: Permission expansion requires visible diff and explicit approval.

### Proactive

- **PRO-01**: Proactive opportunities cite trigger, hypothesis, risk, confidence, expiry, and inhibitors.
- **PRO-02**: Shadow-mode proactive inbox exists before notifications are enabled.

### Migration And Runtime Economics

- **MIG-01**: OpenClaw/Hermes imports generate migration reports.
- **MIG-02**: Legacy skills become draft or quarantined capsules.
- **MIG-03**: Runtime budgets cover CPU, token, tool-call, path, network, connector, and lease TTL.

## Out of Scope

| Feature | Reason |
|---------|--------|
| GUI desktop app in V1 | TUI must prove the authority loop first. |
| Mobile app in V1 | Remote surfaces cannot become trust roots. |
| Real IM delivery in V1 | Outbox, identity, and policy gates are not mature yet. |
| Browser extension or real browser automation in V1 | Computer Use remains scaffold-only until policy/replay are proven. |
| MCP/OAuth/SaaS connectors in V1 | Connector authorization must not equal agent permission. |
| Cloud workers in V1 | Remote execution needs scoped work orders and policy isolation first. |
| Raw secret storage | Secrets must use vault references, never plaintext examples/logs/traces. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONT-01 | Phase 1 | Pending |
| CONT-02 | Phase 1 | Pending |
| CONT-03 | Phase 1 | Pending |
| TUI-01 | Phase 1 | Pending |
| TUI-02 | Phase 1 | Pending |
| TUI-03 | Phase 1 | Pending |
| TUI-04 | Phase 1 | Pending |
| TUI-05 | Phase 1 | Pending |
| TUI-06 | Phase 1 | Pending |
| POL-01 | Phase 2 | Pending |
| POL-02 | Phase 2 | Pending |
| POL-03 | Phase 2 | Pending |
| POL-04 | Phase 2 | Pending |
| POL-05 | Phase 2 | Pending |
| AUD-01 | Phase 3 | Pending |
| AUD-02 | Phase 3 | Pending |
| AUD-03 | Phase 3 | Pending |
| AUD-04 | Phase 3 | Pending |
| CUSE-01 | Phase 4 | Pending |
| CUSE-02 | Phase 4 | Pending |
| CUSE-03 | Phase 4 | Pending |
| CONN-01 | Phase 4 | Pending |
| CONN-02 | Phase 4 | Pending |
| CONN-03 | Phase 4 | Pending |
| DOC-01 | Phase 5 | Pending |
| DOC-02 | Phase 5 | Pending |
| DOC-03 | Phase 5 | Pending |
| DOC-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-06-06*
*Last updated: 2026-06-06 after GSD initialization*
