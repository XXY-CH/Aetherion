# Technical Strategy

[中文版本](10-technical-strategy.zh-CN.md)

Implementation tracking: [Phase Implementation Review](12-phase-implementation-review.md), [Runtime Loop Plan](14-runtime-loop-plan.md), [Production Gap Closure Plan](15-production-gap-closure-plan.md).

Repository governance links: [Code of Conduct](../CODE_OF_CONDUCT.md) / [Chinese](../CODE_OF_CONDUCT.zh-CN.md), [Contributing](../CONTRIBUTING.md) / [Chinese](../CONTRIBUTING.zh-CN.md), [Security Policy](../SECURITY.md) / [Chinese](../SECURITY.zh-CN.md), [MIT License](../LICENSE) / [Chinese explanatory translation](../LICENSE.zh-CN.md), [issue templates](../.github/ISSUE_TEMPLATE/bug_report.yml), and [pull request template](../.github/pull_request_template.md).

Operator/readiness command hub: [README](../README.md#contract-first-workspace).

## Decision

Aetherion uses a contract-first, local-first hybrid architecture.

```text
TypeScript: product velocity, contracts, agents, connectors, browser, frontend
Rust: authority, policy, vault, ledger, sandbox, native execution
Python: eval and research only
JSON Schema / YAML / JSONL / Markdown: human-readable contracts and governance metadata
SQLite: rebuildable local projections
```

The runtime starts as a modular monolith and splits only at trust boundaries.

## V1 Surface

V1 is TUI-only.

The first runnable product should not include:

- GUI desktop app.
- Mobile app.
- IM delivery.
- Browser extension.
- Browser automation.
- MCP/OAuth/SaaS connectors.
- Cloud workers.

V1 should prove the local kernel semantics:

```text
TUI command
  -> event.append
  -> tool request
  -> policy decision
  -> scoped lease
  -> local file read and traced approved write
  -> observation
  -> verification
  -> run trace
  -> trace replay reconstruction
```

This constraint prevents surface-area sprawl before the authority boundary is real.

## Language Ownership

| Layer | Primary Technology | Rationale |
| --- | --- | --- |
| Schemas | JSON Schema | Cross-language contract source |
| Contract SDK | TypeScript first, Rust later | Fast iteration, later authority-side types |
| Harness-core seed | TypeScript | Current contract seed and TUI path |
| TUI v0 | TypeScript | Fastest integration with harness-core |
| Interactive TUI reference | Charmbracelet Bubbles patterns, deferred | Useful component vocabulary for list/table/textinput/textarea/viewport/help/spinner/progress/filepicker; do not add a Go dependency until an interactive TUI implementation phase is explicit |
| Agent Orchestrator prototype | TypeScript | LLM, connector, and schema iteration speed |
| Local Supervisor | Rust | Root authority, native integration, process control |
| Event Ledger | Rust core plus JSONL | Durable audit, versioned cross-author SHA-256 parent chain, supervisor-local append lock, sync-then-rename ledger writes, and startup recovery scan; signatures later |
| Tool Policy Proxy | Rust core | Access/action choke point |
| Policy language | Typed JSON/YAML first, OPA/Rego later | Stabilize product semantics before advanced DSL |
| Secret Vault | Rust wrapper | OS keychain and encrypted artifacts |
| Browser Extension | TypeScript, deferred | MV3 ecosystem, not V1 |
| Browser Operator | TS orchestration plus Rust permission backend, deferred | DOM/CDP in TS, authority in Rust |
| GUI | Tauri + React/TypeScript + Rust backend, deferred | Good long-term local-first fit, not V1 |
| Connectors | TypeScript, deferred | OAuth/SaaS/MCP ecosystem |
| Generated capability packages | TS/WASM sandbox preferred | Never run inside Local Supervisor |
| Memory indexing | SQLite/FTS first, vector later | Keep projections simple and rebuildable |
| Eval/research | Python | Outside authority path |

## Process Boundaries

Code can live in one monorepo. Runtime boundaries follow trust boundaries.

Trusted core:

- Local Supervisor.
- Policy Engine.
- Vault.
- Event Ledger.

Semi-trusted:

- Agent Orchestrator.
- Context Assembler.
- Memory Indexer.
- Capability Registry.

Low-trust or untrusted:

- Imported MCP servers.
- Generated capability packages.
- Connector adapters.
- Browser page content.
- IM attachments.
- Cloud workers.

Generated or imported code must never run inside the Local Supervisor process.

## IPC Strategy

Phase 1:

- Direct TypeScript calls.
- JSON Schemas.
- JSONL traces.

Phase 2:

- JSON-RPC over stdio, Unix socket, or named pipe between the TypeScript TUI/orchestrator and Rust Local Supervisor. The current POC uses stdio.

Later:

- Separate artifact channels for screenshots, DOM snapshots, large logs, and encrypted payloads.
- Avoid gRPC until auditability, inspectability, and local debugging needs are clearly satisfied.

## Current Rust POC

`crates/supervisor/` is the first Rust authority-boundary proof of concept. It is intentionally small and dependency-free:

- Initialize a local workspace ledger under `.aetherion/events/events.jsonl`.
- Derive workspace identity from the resolved workspace root at the Rust RPC boundary; reject mismatched caller ids before creating runtime state.
- Append human-readable SHA-256-linked JSONL events.
- Mark new events with `hash_version: aetherion-event-v1` and hash the complete canonical event envelope, excluding only `event_hash`, identically in TypeScript and Rust.
- Keep `fixtures/event-hash-v1.json` as the shared TS/Rust golden vector for canonical envelope hashing.
- Treat the v1 canonicalization rules as immutable. Any incompatible envelope or value-normalization change requires a new hash version and explicit migration rather than silently changing old hashes.
- Serialize supervisor-authored event appends with a workspace-local lock file while computing parent pointers and event hashes. The current POC records the owner PID, treats a missing Unix owner process as stale, and keeps age-based stale recovery as a portability fallback.
- Rewrite the Ledger through a synced temporary file and atomic rename so a failed append leaves either the prior complete Ledger or the next complete Ledger.
- On workspace init, remove abandoned uncommitted Ledger temp files, verify the parent chain across all Ledger events, reject events whose workspace id does not match the active workspace, and reject any corrupt v1 event hash regardless of author before accepting the workspace. Legacy unversioned supervisor events retain their original hash verifier.
- Evaluate deterministic workspace-local read/write policy.
- Require explicit consent before workspace writes receive a scoped lease.
- Execute local file reads through traced read RPCs and approved writes through traced prepare/commit RPCs that issue the operation lease only after consent.
- Expose traced file-action RPCs for Ether's default run path so the Rust process emits `tool.requested`, `risk.composed`, `policy.decided`, `lease.issued`, `tool.result`, and `action.recorded` events for workspace file reads and approved write commits instead of requiring Ether to append each file-action event itself.
- Reject legacy policy-only and direct file read/write RPCs that would return leases or file contents without the full file-action Ledger lifecycle.
- Expose a minimal stdio RPC command used by the TypeScript Ether client by default; when Ether is pointed at an explicit socket, the client carries the same socket transport and optional auth token through every run-lifecycle RPC, including the approved `file.write.commit`. `supervisor.status` is a read-only daemon-readiness preflight that reports runtime paths, Ledger hash-chain state, and runtime-lock owner process liveness/stale state without appending events or repairing locks. Ether may derive a read-only lifecycle preflight from that status evidence, but it must not start, stop, kill, repair, grant authority, or claim a production daemon exists. The TypeScript supervisor client accepts result evidence only after exactly one non-empty response line parses as valid JSON and a JSON-RPC 2.0 envelope with no duplicate top-level envelope fields, binds to the request id, and contains exactly one of `result` or a non-blank string `error`.

This crate is not yet the production supervisor. It does not implement a vault, event signatures, a long-running RPC daemon, sandboxing, generated-code isolation, browser automation, IM, MCP, OAuth, or cloud-worker execution.

## Storage Strategy

Governance source of truth:

- JSONL Event Ledger.
- YAML/JSON manifests and policies.
- Markdown playbooks, reviews, and human-readable reports.
- Encrypted artifact manifests for large or sensitive payloads.

Rebuildable projections:

- SQLite run index.
- SQLite FTS lexical search.
- Vector index later.
- Graph projection later.

Large or sensitive raw payloads should not be forced into Markdown/YAML/JSONL. They live in encrypted artifact stores referenced by human-readable manifests.

## Policy Strategy

Start with typed policy contracts:

- `permission-policy.schema.json`
- `tool-request.schema.json`
- `policy-decision.schema.json`
- `scoped-lease.schema.json`

The first evaluator should be deterministic and small. OPA/Rego or Cedar can become adapters later after Aetherion's product policy semantics stabilize.

## Node Baseline

The current zero-dependency seed runs directly on the local Node version. Do not treat Node 25 as a permanent ecosystem baseline.

Before broader contribution or CI hardening:

- Move to a workspace manager such as pnpm.
- Add an explicit TypeScript runner or build path.
- Lower the supported Node baseline where practical.
- Keep contract validation available through one command.
