# Architecture

## Layered System

```text
User Surfaces
  - TUI
  - GUI
  - Browser Extension
  - Mobile Companion
  - Chat Gateways
  - Web Console

Local Supervisor
  - Workspace Daemon
  - Policy Engine
  - Secret Vault
  - Event Ledger

User Boundary Layer
  - Identity
  - Device Pairing
  - Consent Ledger
  - Approval UI
  - Trust Level Resolver
  - Data Sensitivity Classifier

Event Plane
  - Typed Event Ingestion
  - Append-only Ledger
  - Taint Tracking
  - Retention Policy
  - Redaction Policy
  - Replay Anchors

Context and Planning Plane
  - Planner
  - Context Assembler
  - Memory Resolver
  - Capability Resolver
  - Evaluator

Memory OS
  - Memory Cards
  - Episodic Timeline
  - Semantic Graph
  - Project Graph
  - User Model
  - Retrieval and Compression
  - Dreaming Patch Pipeline

Capability OS
  - Capability Capsule
  - Skill Importer
  - Capsule Drafting
  - Capsule Testing
  - Capsule Versioning
  - Capsule Evaluation
  - Capsule Rollback
  - Capsule Marketplace

Scaffold OS
  - Capability Package Template
  - Tool Template
  - Connector Template
  - Workflow Template
  - Test Harness
  - Security Policy
  - Deployment Gate

Tool Policy Proxy
  - Risk Composition
  - Permission Diff
  - Policy Decision
  - Approval Routing
  - Quarantine

Connector Plane
  - MCP Client and Adapter
  - OAuth Connector Runtime
  - IM Adapters
  - SaaS API Adapters

Execution Plane
  - Local Computer Use
  - Local Browser
  - Sandboxed Browser
  - Cloud VM
  - Code Runner
  - File and Repo Operator
```

## Orthogonality Rules

Each subsystem owns one concern and communicates through explicit contracts.

- User surfaces collect intent and approvals. They do not grant tool permissions directly.
- Local Supervisor is the root authority boundary, not any specific UI.
- User Boundary Layer owns identity, consent, trust, and user-facing approval policy.
- Event Plane is the fact layer for memory, proactive behavior, audit, replay, and capability evolution.
- Context and Planning Plane plans and routes. It does not persist unreviewed long-term claims directly.
- Memory OS stores and retrieves user/project knowledge with sources and sensitivity metadata.
- Capability OS stores governed Capability Capsules. Skills remain procedural knowledge and import formats.
- Scaffold OS generates and validates capability packages. It does not install them without deployment gates.
- Tool Policy Proxy is the only side-effectful execution choke point.
- Connector Plane adapts protocols and APIs. MCP and OAuth are connection mechanisms, not execution boundaries.
- Execution Plane performs actions only through approved tool sessions and sandbox policies.
- Audit system reconstructs security decisions, side effects, permission changes, memory changes, capability changes, and user-visible outputs.

## Core Request Flow

```text
User or event source
  -> User Surface
  -> Local Supervisor
  -> Identity, device, and workspace resolution
  -> Event Plane typed event
  -> User Boundary risk precheck
  -> Context Assembler
  -> Planner
  -> Capability Resolver
  -> Tool Policy Proxy
  -> Connector or Execution Plane
  -> Observation event
  -> Evaluator and verifier
  -> Memory or capability patch candidates
  -> Audit, replay anchors, and user-visible result
```

## Event Plane

The Event Ledger is not a logging convenience. It is the source of truth for the product.

All important inputs and transitions enter as typed events:

- User messages.
- IM, browser, file, connector, and webhook events.
- Tool requests and results.
- Approval decisions.
- Memory candidates and patches.
- Capability candidates and patches.
- Computer-use observations.
- Proactive opportunities.
- Policy decisions.

Low-value high-frequency observations may be sampled, summarized, or expired according to retention policy. Security decisions and side effects must remain reconstructable.

## Tool Policy Proxy

No agent, skill, connector, MCP server, IM adapter, scaffold, or generated package can execute side-effectful actions directly. All such actions pass through Tool Policy Proxy.

```text
Agent intent or capability request
  -> Tool Policy Proxy
  -> risk composition
  -> sensitivity classification
  -> permission diff
  -> approval or denial
  -> adapter or execution call
  -> result event
```

The proxy composes risk from action type, target resource, data sensitivity, side effect, reversibility, audience, credential scope, runtime boundary, and strength of user intent.

## Connector Plane

MCP, OAuth, IM, and SaaS adapters live in the Connector Plane.

MCP is a protocol, not a security boundary. MCP tools can represent arbitrary code paths, so Aetherion must wrap them:

```text
MCP Server
  -> Connector Adapter
  -> Tool Policy Proxy
  -> Execution Plane
```

## Proactive Flow

```text
Event source
  -> correlation
  -> opportunity object
  -> salience score
  -> attention budget check
  -> policy gate
  -> intervention ladder
  -> audit and memory impact review
```

Proactive behavior is an Opportunity Lifecycle. Aetherion does not wake up periodically to think. It reacts to meaningful state changes, scores opportunities, respects attention budgets, and chooses the least intrusive intervention.

Timers are acceptable for exact deadlines and maintenance jobs, but product-visible initiative should usually originate from real events: new message, changed file, calendar window, failed task, user correction, stale memory, connector webhook, repeated capability use, repeated capability failure, or incomplete workflow.

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

## Import Boundaries

Imported configurations are migration inputs, not trusted active capabilities.

OpenClaw, Hermes, MCP server, third-party skill, and connector imports should generate a migration report. Tools, plugins, hooks, cron jobs, unknown fields, and external packages default to quarantine until reviewed. Secrets should migrate only as vault references, never as copied plaintext.
