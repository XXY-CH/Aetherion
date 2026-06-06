# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aetherion is a local-first Agent Operating System. It connects a user's devices, data, permissions, memory, and tools into a safe, auditable, self-improving agent harness. The central product moat is the **User Boundary Layer** — a permission and trust layer that governs every agent action across risk levels L0–L5.

**Current state**: Phase 0 (Foundation Documents). The repo contains design specs only — no runtime code yet. All decisions should align with the existing docs before code is written.

## Architecture

The system is a strict layered stack. Each layer owns one concern and communicates through explicit contracts. No layer may bypass another.

```
User Surfaces → User Boundary Layer → Agent Harness Core
                                        ↓
                    Memory OS | Skill OS | Scaffold OS
                                        ↓
                   Execution Plane → Audit / Replay / Rollback
```

**Orthogonality rules** (from `docs/01-architecture.md`):
- User surfaces collect intent and approvals — they never grant tool permissions directly.
- Agent Harness plans and routes — it never persists unreviewed long-term claims.
- Memory OS stores with source events and sensitivity — not a loose embedding dump.
- Skill OS holds procedural knowledge — skills own no tool permissions.
- Scaffold OS generates packages — they don't install without deployment gates.
- Execution Plane acts only through approved tool sessions and sandbox policies.

## Key Design Documents

| Doc | Purpose |
|-----|---------|
| `docs/00-product-brief.md` | What Aetherion is, target users, core jobs, non-goals |
| `docs/01-architecture.md` | Layered system, request flow, proactive flow, browser operator strategy |
| `docs/02-user-boundary-layer.md` | Permission firewall (L0–L5 risk levels), consent ledger, default safety rules |
| `docs/03-memory-os.md` | 6-layer memory model (events → cards → timeline → graph → user model → context), dreaming loop |
| `docs/04-skill-and-scaffold-os.md` | Skill lifecycle, manifests, capability packages, deployment gate (10-step), scoring |
| `docs/05-audit-and-data-contracts.md` | Event/action/memory schemas, permission policy schema, **planned repo layout** |
| `docs/06-roadmap.md` | Phase 0–6 milestones and exit criteria |

## Planned Repository Layout

Defined in `docs/05-audit-and-data-contracts.md`. When scaffolding begins, follow this structure:

```
packages/
  desktop/          # Local-first desktop app (trust center)
  browser-extension/# Browser operator + consent surface
  harness-core/     # Planner, context assembler, memory/skill resolver, tool router
  memory-os/        # Events, cards, timeline, graphs, dreaming
  skill-os/         # Skill manifests, lifecycle, registry, evaluation
  scaffold-os/      # Capability package templates, deployment gates
  execution-plane/  # Computer use, browser, MCP, OAuth, code runner
schemas/            # JSON schemas for all data contracts
examples/           # Sample capabilities, memory, audit records
```

## Critical Design Principles

These must hold in any code written for this project:

1. **Every material action answers 6 questions**: Who, Where, What, Why, Risk, Memory Impact.
2. **Permission firewall is never bypassed** — not by skills, connectors, workflows, or generated packages.
3. **Memory cards always cite source events** — no untraceable memory writes.
4. **Skills ≠ plugins** — skills are procedural knowledge and do not inherit tool permissions.
5. **Capability packages pass a 10-step deployment gate** before installation (schema → typecheck → unit/replay/permission tests → safety scan → sandbox → approval → signing → rollback registration).
6. **Chat/IM channels are remote control surfaces**, not root authority boundaries.
7. **Proactive behavior is event-driven**, not timer-driven (timers only for maintenance jobs).

## Technology Stack (Planned)

The `.gitignore` indicates planned support for TypeScript/Node.js (desktop + extensions), Python (ML/data), Rust (native helpers), and Go (helpers). Bun is the primary JS runtime based on the environment.
