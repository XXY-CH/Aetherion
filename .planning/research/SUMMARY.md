# Research Summary: Aetherion

## Stack

Aetherion should continue as a contract-first monorepo:

- TypeScript for schemas, examples, harness-core, TUI, Computer Use scaffolds, and connector scaffolds.
- Rust for Local Supervisor authority, policy, vault, ledger, and native execution boundaries.
- Markdown/YAML/JSONL/JSON Schema as human-readable source of truth.
- SQLite/FTS/vector/graph indexes only as rebuildable projections later.

## Table Stakes

The first release must prove the TUI local kernel loop:

```text
TUI command
-> event append
-> tool request
-> policy decision
-> scoped lease
-> local file read/write
-> observation
-> verification
-> trace replay reconstruction
```

## Differentiators

- Governed Capability Capsules.
- Event-driven proactive opportunities.
- Dreaming as reviewable patches.
- Human-readable source of truth with rebuildable projections.
- Rust Local Supervisor authority boundary.
- Migration imports evidence, not authority.

## Watch Outs

- Do not add GUI, IM, browser automation, MCP/OAuth connectors, or cloud workers to V1.
- Do not treat imported OpenClaw/Hermes configs, tools, or skills as trusted.
- Do not let generated packages run inside the supervisor process.
- Do not store raw secrets in examples, memory, logs, traces, schemas, or fixtures.
- Do not let replay repeat live side effects by default.

## Roadmap Guidance

Plan around five near-term tracks:

1. Preserve and harden the contract/TUI MVP.
2. Move the same kernel loop through Rust supervisor IPC.
3. Add TUI trace observability and replay inspection.
4. Expand policy-gated Computer Use and connector scaffolds without real external power.
5. Add Memory/Capability/Proactive contracts from real trace data after the kernel is reliable.
