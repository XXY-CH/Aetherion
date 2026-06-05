# Aetherion

Aetherion is the current project codename for a local-first Agent Harness Kernel: an auditable runtime for agent execution, memory, permissions, capabilities, scaffolds, proactive behavior, and user-connected workflows.

The product goal is not a stronger chatbot and not a replacement operating system. Aetherion should become the governed control plane between a user, their devices, their data, their tools, and autonomous agents.

Public naming is not final. Supplied research indicates "Aetherion" has possible GitHub, package, trademark, and platform collisions in the AI/agent space, so it should remain a codename until a naming clearance pass is complete.

## Product Thesis

Modern agents are limited less by model intelligence than by harness quality: permission boundaries, event fidelity, memory provenance, tool governance, capability evolution, and real-world execution loops. Aetherion treats these as kernel-level runtime concerns.

Core promise:

> Let agents safely operate computers, tools, memory, messaging, and self-evolving capabilities under one human-governed, auditable boundary.

The best product bet is not "another agent that can use a computer." Aetherion's distinctive bets are governed Capability Capsules, event-driven proactive behavior, Dreaming as reviewable patches, and human-readable source of truth with rebuildable indexes.

## First Principles

- Local Supervisor plus Policy Engine, Secret Vault, and Event Ledger is the root authority boundary.
- TUI, GUI, browser extension, mobile, and IM are client surfaces. They do not grant authority directly.
- Event Plane is the fact layer. Messages, approvals, tool calls, memory candidates, capability changes, and proactive opportunities become typed events in an append-only ledger.
- Browser extension and browser operator are core execution surfaces, not optional integrations.
- OAuth, MCP, and connector layers expose user data and tools, but never bypass the Tool Policy Proxy.
- Connector and execution adapters are sibling target families behind policy, not a simple upstream/downstream chain.
- Chat, mobile, and IM channels are remote control and notification surfaces, not the root authority boundary.
- Memory is not just vector search. It is an auditable Memory OS with source events, memory cards, timelines, graphs, and context assembly.
- Capability Capsules are the governed internal ability unit. Skills are procedural knowledge and import formats, not unrestricted plugins.
- Dreaming produces reviewable patches, not external actions.
- Proactive behavior is an Opportunity Lifecycle, not an agent periodically deciding to interrupt the user.
- Human-readable Markdown, YAML, and JSONL are source of truth. SQLite, vector, and graph stores are rebuildable projections.

## System Shape

```text
Client Surfaces
  TUI / GUI / Browser Extension / IM / Mobile / API
        |
        v
Ingress Gateways
  normalize / authenticate / rate-limit / idempotency
        |
        v
Local Supervisor
  identity / policy / vault / event ledger / workspace daemon
        |
        v
Agent Orchestrator
  context assembler / planner / agent loop / verifier
        |              |                    |
        v              v                    v
Memory OS       Capability OS        Proactive Engine
        \              |                    /
         \             v                   /
          +---- Tool Access & Action Policy Proxy ----+
                         |
                         v
        Connector Adapters + Execution Adapters
                         |
                         v
        Observations / Results / Artifacts
                         |
                         v
              Event Ledger + Projections
```

## Initial Documentation

- [Product Brief](docs/00-product-brief.md)
- [Architecture](docs/01-architecture.md)
- [User Boundary Layer](docs/02-user-boundary-layer.md)
- [Memory OS](docs/03-memory-os.md)
- [Capability and Scaffold OS](docs/04-skill-and-scaffold-os.md)
- [Audit and Data Contracts](docs/05-audit-and-data-contracts.md)
- [Roadmap](docs/06-roadmap.md)
- [Positioning and Naming Risk](docs/07-positioning-and-naming.md)
- [Innovation Thesis](docs/08-innovation-thesis.md)
- [Computer Use Implementation](docs/09-computer-use-implementation.md)

## MVP Direction

The first build should prove the smallest complete loop:

1. Local desktop shell with project/workspace identity.
2. Local Supervisor with Event Ledger and Tool Policy Proxy.
3. One minimal IM channel and browser extension prototype.
4. Browser operator with screenshot plus DOM-assisted actions.
5. Raw event log plus memory cards.
6. Capability Capsule registry with draft/test/publish states.
7. Capability package scaffold with policy and tests.

## Contract Seed

The repository now includes the first contract-first scaffold:

- `schemas/`: JSON Schemas for Event, Tool Request, Policy Decision, Action Record, Permission Policy, Memory Card, Memory Candidate, Capability Capsule, Capability Package, Proactive Opportunity, Replay Record, and Migration Report.
- `examples/contracts/`: valid example JSON for every schema.
- `packages/harness-core/`: a zero-dependency TypeScript seed that proves `user request -> policy decision -> local file read -> event trace -> replay reconstruction`.

Run verification:

```sh
npm test
```
