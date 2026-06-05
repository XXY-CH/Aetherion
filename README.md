# Aetherion

Aetherion is the current project codename for a local-first Agent Harness Kernel: an auditable runtime for agent execution, memory, permissions, capabilities, scaffolds, proactive behavior, and user-connected workflows.

The product goal is not a stronger chatbot and not a replacement operating system. Aetherion should become the governed control plane between a user, their devices, their data, their tools, and autonomous agents.

Public naming is not final. Supplied research indicates "Aetherion" has possible GitHub, package, trademark, and platform collisions in the AI/agent space, so it should remain a codename until a naming clearance pass is complete.

## Product Thesis

Modern agents are limited less by model intelligence than by harness quality: permission boundaries, event fidelity, memory provenance, tool governance, capability evolution, and real-world execution loops. Aetherion treats these as kernel-level runtime concerns.

Core promise:

> Let agents safely operate computers, tools, memory, messaging, and self-evolving capabilities under one human-governed, auditable boundary.

## First Principles

- Local Supervisor plus Policy Engine, Secret Vault, and Event Ledger is the root authority boundary.
- TUI, GUI, browser extension, mobile, and IM are client surfaces. They do not grant authority directly.
- Event Plane is the fact layer. Messages, approvals, tool calls, memory candidates, capability changes, and proactive opportunities become typed events in an append-only ledger.
- Browser extension and browser operator are core execution surfaces, not optional integrations.
- OAuth, MCP, and connector layers expose user data and tools, but never bypass the Tool Policy Proxy.
- Chat, mobile, and IM channels are remote control and notification surfaces, not the root authority boundary.
- Memory is not just vector search. It is an auditable Memory OS with source events, memory cards, timelines, graphs, and context assembly.
- Capability Capsules are the governed internal ability unit. Skills are procedural knowledge and import formats, not unrestricted plugins.
- Dreaming produces reviewable patches, not external actions.
- Proactive behavior is an Opportunity Lifecycle, not an agent periodically deciding to interrupt the user.
- Human-readable Markdown, YAML, and JSONL are source of truth. SQLite, vector, and graph stores are rebuildable projections.

## System Shape

```text
-------------------------------------------------------------+
| User Surfaces                                               |
| TUI | GUI | Browser Extension | Mobile | IM | Web Console |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| Local Supervisor                                            |
| Policy Engine | Secret Vault | Event Ledger | Workspace Daemon|
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| Event Plane / Append-only Ledger                            |
| Typed Events | Taint | Retention | Redaction | Replay Anchors |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| Context + Planning Plane                                    |
| Planner | Context Assembler | Memory/Capability Resolver     |
+-------------------------------------------------------------+
          |                    |                     |
          v                    v                     v
+------------------+  +------------------+  +------------------+
| Memory OS        |  | Capability OS    |  | Scaffold OS      |
| Cards | Graphs   |  | Capsules | Evals |  | Templates | Gate|
| Dreams | Patches |  | Versions | Tests |  | Packages | Policy|
+------------------+  +------------------+  +------------------+
          |                    |                     |
          +--------------------+---------------------+
                               |
                               v
+-------------------------------------------------------------+
| Tool Policy Proxy                                           |
| Risk | Sensitivity | Permission Diff | Approval | Quarantine |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Connector + Execution Planes                                |
| MCP/OAuth/IM Adapters | Local Computer | Browser | VM | Code  |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Verifier + Audit + Replay                                   |
+-------------------------------------------------------------+
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

## MVP Direction

The first build should prove the smallest complete loop:

1. Local desktop shell with project/workspace identity.
2. Local Supervisor with Event Ledger and Tool Policy Proxy.
3. One minimal IM channel and browser extension prototype.
4. Browser operator with screenshot plus DOM-assisted actions.
5. Raw event log plus memory cards.
6. Capability Capsule registry with draft/test/publish states.
7. Capability package scaffold with policy and tests.
