# Architecture

## Layered System

```text
User Surfaces
  - Desktop App
  - Browser Extension
  - Mobile Companion
  - Chat Gateways
  - Web Console

User Boundary Layer
  - Identity
  - Device Pairing
  - OAuth Vault
  - Permission Firewall
  - Consent Ledger
  - Approval UI
  - Trust Level Resolver

Agent Harness Core
  - Planner
  - Context Assembler
  - Memory Resolver
  - Skill Resolver
  - Tool Router
  - Computer Operator
  - Evaluator

Memory OS
  - Raw Event Log
  - Memory Cards
  - Episodic Timeline
  - Semantic Graph
  - Project Graph
  - User Model
  - Retrieval and Compression
  - Dreaming Loop

Skill OS
  - Skill Manifest
  - Skill Drafting
  - Skill Testing
  - Skill Versioning
  - Skill Evaluation
  - Skill Rollback
  - Skill Marketplace

Scaffold OS
  - Capability Package Template
  - Tool Template
  - Connector Template
  - Workflow Template
  - Test Harness
  - Security Policy
  - Deployment Gate

Execution Plane
  - Local Computer Use
  - Local Browser
  - Sandboxed Browser
  - Cloud VM
  - MCP Tools
  - OAuth Connectors
  - Code Runner
  - File and Repo Operator
```

## Orthogonality Rules

Each subsystem owns one concern and communicates through explicit contracts.

- User surfaces collect intent and approvals. They do not grant tool permissions directly.
- User Boundary Layer owns identity, consent, trust, and risk policy.
- Agent Harness Core plans and routes. It does not persist unreviewed long-term claims directly.
- Memory OS stores and retrieves user/project knowledge with sources and sensitivity metadata.
- Skill OS stores procedural knowledge. It does not execute privileged tools by itself.
- Scaffold OS generates and validates capability packages. It does not install them without deployment gates.
- Execution Plane performs actions only through approved tool sessions and sandbox policies.
- Audit system records every material action across layers.

## Core Request Flow

```text
User or event source
  -> User Surface
  -> Identity and device resolution
  -> Permission Firewall risk precheck
  -> Context Assembler
  -> Planner
  -> Skill Resolver
  -> Tool Router
  -> Execution Plane
  -> Observation
  -> Evaluator
  -> Memory candidate extraction
  -> Audit log and user-visible result
```

## Proactive Flow

```text
External event, memory signal, task state, or IM message
  -> Event normalizer
  -> Proactive policy check
  -> User model relevance check
  -> Risk classification
  -> Suggest, ask approval, or execute
  -> Audit record
  -> Memory impact review
```

Proactive behavior should be event-driven rather than timer-driven where possible. Timers are acceptable for maintenance jobs, but product-visible initiative should usually originate from real events: new message, changed file, calendar window, failed task, stale memory, connector webhook, or incomplete workflow.

## Browser Operator

The browser layer should combine four capabilities:

- Visual: screenshots, element recognition, computer-use action loops.
- DOM: structured page tree, selected text, forms, links, accessibility metadata.
- Automation: Playwright, CDP, extension APIs, uploads, downloads, profiles.
- Permission: site-level consent, account isolation, file picker gates, action diffs.

The system should prefer structured DOM/API operations when available and fall back to visual computer-use when needed.

## External Protocols

Aetherion should support MCP as the main external tool protocol. Internal manifests can be richer than MCP, but external capabilities should be exposed or wrapped in compatible tool contracts where practical.

OAuth connector strategy:

- MVP: fast connector provider plus Aetherion-owned permission firewall.
- Production: code-owned connector runtime for core integrations.
- Long tail: external connector marketplaces for breadth.
- Security: connector authorization never equals agent permission. Aetherion must still approve tool use per user, scope, action, risk, and context.

