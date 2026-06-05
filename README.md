# Aetherion

Aetherion is a user-connected Agent Operating System: a local-first agent harness that can understand a user, operate real devices and tools, evolve skills, generate reusable capabilities, and keep every meaningful action auditable.

The product goal is not a stronger chatbot. Aetherion should become the control plane between a user, their devices, their data, and autonomous agents.

## Product Thesis

Modern agents are limited less by model intelligence than by harness quality: permission boundaries, memory fidelity, tool governance, skill evolution, and real-world execution loops. Aetherion treats these as first-class operating system concerns.

Core promise:

> Let an agent safely understand the user, operate the computer, extend its own capabilities, and improve over time, while every permission, memory, skill, and action remains inspectable, reversible, and policy-controlled.

## First Principles

- Local-first desktop app is the trust center, memory center, computer control console, and approval surface.
- Browser extension and browser operator are core execution surfaces, not optional integrations.
- OAuth, MCP, and connector layers expose user data and tools, but never bypass Aetherion's permission firewall.
- Chat, mobile, and IM channels are remote control and notification surfaces, not the root authority boundary.
- Memory is not just vector search. It is an auditable Memory OS with source events, memory cards, timelines, graphs, and context assembly.
- Skills are procedural knowledge, not unrestricted plugins. Skills may evolve, but permissions stay in the tool and execution layers.
- Scaffolded capabilities are isolated packages with manifests, tests, policies, approval UI, and rollback.

## System Shape

```text
-------------------------------------------------------------+
| User Surfaces                                               |
| Desktop App | Browser Extension | Mobile | IM | Web Console |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| User Boundary Layer                                         |
| Identity | Device Pairing | OAuth Vault | Permission Firewall|
| Consent Ledger | Approval UI | Trust Levels                  |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| Agent Harness Core                                          |
| Planner | Context Assembler | Memory Resolver | Skill Resolver|
| Tool Router | Computer Operator | Evaluator                  |
+-------------------------------------------------------------+
          |                    |                     |
          v                    v                     v
+------------------+  +------------------+  +------------------+
| Memory OS        |  | Skill OS         |  | Scaffold OS      |
| Events | Cards   |  | Manifests | Evals|  | Capability Pkgs |
| Graphs | Dreams  |  | Versions | Tests |  | Templates | Gate|
+------------------+  +------------------+  +------------------+
          |                    |                     |
          +--------------------+---------------------+
                               |
                               v
+-------------------------------------------------------------+
| Execution Plane                                             |
| Local Computer | Browser | Cloud VM | MCP | OAuth | Code     |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Logs, Audit, Replay, Rollback                               |
+-------------------------------------------------------------+
```

## Initial Documentation

- [Product Brief](docs/00-product-brief.md)
- [Architecture](docs/01-architecture.md)
- [User Boundary Layer](docs/02-user-boundary-layer.md)
- [Memory OS](docs/03-memory-os.md)
- [Skill and Scaffold OS](docs/04-skill-and-scaffold-os.md)
- [Audit and Data Contracts](docs/05-audit-and-data-contracts.md)
- [Roadmap](docs/06-roadmap.md)

## MVP Direction

The first build should prove the smallest complete loop:

1. Local desktop shell with project/workspace identity.
2. Browser operator with screenshot plus DOM-assisted actions.
3. Permission firewall with risk levels and approval records.
4. Raw event log plus memory cards.
5. Skill manifest registry with draft/test/publish states.
6. Capability package scaffold with policy and tests.
7. One IM or mobile channel for remote wakeup and approval.

