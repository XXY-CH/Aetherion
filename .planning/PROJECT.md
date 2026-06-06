# Aetherion

## What This Is

Aetherion is a codename for a local-first Agent Harness Kernel: an auditable runtime that lets agents operate local files, tools, future computer-use surfaces, memory, capabilities, connectors, and proactive workflows through one governed authority boundary. It is for power users, developers, operators, and knowledge workers who want real agent delegation without turning UI surfaces, imported tools, or generated code into trust roots.

The first runnable product is TUI-only. GUI, mobile, real IM delivery, browser extension, browser automation, MCP/OAuth connectors, cloud workers, and public Capsule Store behavior are deliberately post-V1.

## Core Value

Agents can perform real local work only through an inspectable policy, lease, event, verification, and replay loop that the user can audit.

## Requirements

### Validated

- ✓ Contract schemas and examples exist for the initial kernel loop — existing
- ✓ TypeScript harness-core proves user request to policy decision to local read/write to verification to replay reconstruction — existing
- ✓ TUI seed runs the local kernel loop — existing
- ✓ Computer-use and connector SDK packages exist as quarantined post-V1 scaffolds — existing
- ✓ Rust supervisor POC exists for the future Local Supervisor authority boundary — existing

### Active

- [ ] Make the V1 TUI kernel loop the authoritative MVP path.
- [ ] Move authority decisions toward the Rust supervisor without broadening V1 surfaces.
- [ ] Keep Computer Use as a policy-gated scaffold until the local kernel loop is proven.
- [ ] Keep connector import and external capability work quarantined by default.
- [ ] Add GSD planning traceability so future implementation phases do not blur V1 scope.

### Out of Scope

- GUI desktop app — deferred until the TUI and Local Supervisor authority boundary are proven.
- Mobile app — deferred; remote approval surfaces must not become trust roots.
- Real IM delivery — deferred; IM can only arrive after policy and outbox gates exist.
- Browser extension or browser automation — deferred; Computer Use remains scaffold-only in V1.
- MCP/OAuth/SaaS connectors — deferred; connector authorization is not agent action approval.
- Cloud workers — deferred; remote execution environments are delegated workers, not trust roots.
- Public Capsule Store — deferred until manifest, policy, sandbox, scoring, signing, and rollback gates exist.
- Raw secret storage in examples, memory, logs, traces, schemas, or fixtures — permanently excluded.

## Context

Aetherion already has a contract-first monorepo seed:

- `schemas/` and `examples/contracts/` define human-readable kernel contracts.
- `packages/harness-core/` implements the TypeScript local kernel proof.
- `packages/tui/` exposes the V1 terminal surface.
- `packages/computer-use/` contains post-V1 Computer Use adapter scaffolding.
- `packages/connector-sdk/` contains post-V1 connector quarantine scaffolding.
- `crates/supervisor/` contains the dependency-free Rust authority-boundary POC.
- `docs/00-11` define product framing, architecture, memory, capability, audit, roadmap, Computer Use, technical strategy, migration, and runtime economics.

The central architectural invariants are:

- Local Supervisor is the root authority.
- Event Ledger is the fact layer.
- Tool Access & Action Policy Proxy gates sensitive reads, data egress, and side effects.
- Capability Capsules do not own permissions; runtime grants are scoped leases.
- Dreaming produces reviewable patches, not actions.
- Proactive behavior is event-driven and attention-budgeted, not cron self-interruption.
- Human-readable contracts are source of truth; indexes are rebuildable projections.

## Constraints

- **Product scope**: V1 is TUI-only — prevents surface-area sprawl before the authority boundary is real.
- **Trust boundary**: Local Supervisor owns policy, vault, event ledger, and workspace authority — UI clients and adapters cannot grant permission directly.
- **Language ownership**: TypeScript for contract iteration and TUI seed work; Rust for future Local Supervisor authority; Python only for eval/research — keeps authority code narrow.
- **Security**: Imported tools, skills, configs, MCP servers, hooks, generated packages, browser content, and connectors are quarantined by default — migration must import evidence, not authority.
- **Auditability**: Security decisions, sensitive reads, side effects, memory patches, capability patches, and proactive interventions must be reconstructable — no opaque state mutation.
- **Secrets**: Raw secrets must not appear in examples, memory, logs, traces, schemas, fixtures, or migration reports — only vault references are allowed.
- **Runtime cost**: Long-running memory, dreaming, hibernation, replay, observability, and multi-agent economics require budgets, folding, projections, and asynchronous work — avoid hot-path cost growth.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat Aetherion as codename | Naming research found possible collisions | — Pending |
| First runnable product is TUI-only | Proves local kernel semantics before adding surfaces | ✓ Good |
| Capability Capsule replaces unrestricted Skill | Binds knowledge to contracts, tests, policy, provenance, lifecycle, and rollback | — Pending |
| Dreaming produces reviewable patches | Prevents opaque self-modification and side effects | — Pending |
| Human-readable files are source of truth | Enables audit, diff, export, deletion, and rebuildable indexes | ✓ Good |
| Rust is reserved for Local Supervisor authority | Keeps the trust boundary narrow and native | — Pending |
| Computer Use and connectors are post-V1 scaffolds | Avoids giving broad external power before policy is proven | ✓ Good |
| GSD initialized from existing docs | The project already had enough concrete context; `gsd-sdk` was unavailable in shell | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-06 after GSD initialization from existing Aetherion docs*
