# Technical Strategy

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
  -> local file read/write
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
- Append human-readable SHA-256-linked JSONL events.
- Mark new events with `hash_version: aetherion-event-v1` and hash the complete canonical event envelope, excluding only `event_hash`, identically in TypeScript and Rust.
- Treat the v1 canonicalization rules as immutable. Any incompatible envelope or value-normalization change requires a new hash version and explicit migration rather than silently changing old hashes.
- Serialize supervisor-authored event appends with a workspace-local lock file while computing parent pointers and event hashes.
- Rewrite the Ledger through a synced temporary file and atomic rename so a failed append leaves either the prior complete Ledger or the next complete Ledger.
- On workspace init, remove abandoned uncommitted Ledger temp files, verify the parent chain across all Ledger events, and reject any corrupt v1 event hash regardless of author before accepting the workspace. Legacy unversioned supervisor events retain their original hash verifier.
- Evaluate deterministic workspace-local read/write policy.
- Require explicit consent before workspace writes receive a scoped lease.
- Execute local file read/write only through an allowed scoped lease.
- Expose a minimal stdio RPC command used by the TypeScript Ether client by default.

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
