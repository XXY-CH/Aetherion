# Stack Research: Aetherion

## Source Basis

This research was synthesized from repository documents, not external web research. `gsd-sdk` was unavailable in the current shell, so this file serves as a local research artifact for roadmap planning.

Primary sources:

- `docs/00-product-brief.md`
- `docs/01-architecture.md`
- `docs/05-audit-and-data-contracts.md`
- `docs/06-roadmap.md`
- `docs/09-computer-use-implementation.md`
- `docs/10-technical-strategy.md`
- `docs/11-migration-and-runtime-economics.md`

## Recommended Stack

| Layer | Choice | Confidence | Rationale |
| --- | --- | --- | --- |
| Contract source | JSON Schema plus examples | High | Cross-language, human-reviewable, already implemented. |
| V1 harness/TUI | TypeScript on Node | High | Fastest path for contract iteration and existing package tests. |
| Authority boundary | Rust Local Supervisor | High | Native process, filesystem, policy, ledger, and future sandbox authority. |
| Event ledger | JSONL first | High | Human-readable append stream; easy replay and diff. |
| Governance docs | Markdown/YAML/JSON | High | Reviewable source of truth; indexes remain rebuildable. |
| Runtime projections | SQLite/FTS later | Medium | Useful once event volume grows; not V1 hot path. |
| Memory indexes | Rebuildable vector/graph later | Medium | Post-V1; must cite source events. |
| Computer Use | TS adapter orchestration plus Rust policy backend later | Medium | DOM/CDP APIs fit TS; authority belongs in Rust. |
| GUI | Tauri + React/TypeScript later | Medium | Long-term fit for local-first desktop, explicitly not V1. |
| Eval/research | Python only outside authority path | High | Keeps experimental code out of policy boundary. |

## What Not To Use Yet

- Full GUI framework in V1 — expands surface before policy is stable.
- Real browser automation in V1 — Computer Use should remain scaffold-only until policy loop is proven.
- MCP/OAuth connector runtime in V1 — connector auth must not be confused with action approval.
- OPA/Rego/Cedar immediately — typed policy contracts should stabilize first.
- Cloud worker execution — delegated workers are not trust roots and need scoped work orders first.

## Stack Risks

- Node 25 is current local reality but should not become permanent ecosystem baseline.
- Rust supervisor and TypeScript TUI need an explicit IPC boundary before Rust can become authoritative for TUI actions.
- JSONL ledgers need retention, redaction, and compaction rules before long-running agent workloads.
