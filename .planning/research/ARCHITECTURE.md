# Architecture Research: Aetherion

## Component Boundaries

```text
TUI
  -> harness-core seed
  -> Local Supervisor boundary
  -> Event Ledger
  -> Tool Policy Proxy
  -> scoped lease
  -> file operator / future adapters
  -> observation
  -> verification
  -> replay reconstruction
```

V1 can keep TypeScript direct calls for speed, but the roadmap should move the authority boundary to Rust through JSON-RPC over stdio, Unix socket, or named pipe.

## Trusted Core

- Local Supervisor.
- Policy Engine.
- Vault.
- Event Ledger.

These components cannot load generated packages, imported skills, connectors, browser content, MCP servers, or cloud-worker code.

## Semi-Trusted Components

- Agent Orchestrator.
- Context Assembler.
- Memory Indexer.
- Capability Registry.
- TUI client.

These components request authority; they do not own it.

## Low-Trust Components

- Imported MCP servers.
- Generated capability packages.
- Connector adapters.
- Browser page content.
- IM attachments.
- Cloud workers.
- Legacy OpenClaw/Hermes imports.

All low-trust components communicate through structured IPC/contracts and scoped leases.

## Data Flow Implications

- Event Ledger is the fact layer.
- Memory, proactive behavior, audit, replay, dashboards, vector stores, graph indexes, and economic scores are projections.
- Sensitive payloads live in encrypted artifact stores referenced by manifests.
- Deletion/redaction appends tombstones and rebuilds projections.

## Suggested Build Order

1. Lock current TUI kernel loop and contract validation.
2. Make Rust supervisor callable by TUI for the same loop.
3. Add resource budgets and stronger scoped lease semantics.
4. Add TUI trace observability.
5. Expand Memory OS from real traces.
6. Keep Computer Use and connectors scaffolded until policy/replay are strong.
