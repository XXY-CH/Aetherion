# Product Brief

[中文版本](00-product-brief.zh-CN.md)

Implementation tracking: [Phase Implementation Review](12-phase-implementation-review.md), [Runtime Loop Plan](14-runtime-loop-plan.md), [Production Gap Closure Plan](15-production-gap-closure-plan.md).

Repository governance links: [Code of Conduct](../CODE_OF_CONDUCT.md) / [Chinese](../CODE_OF_CONDUCT.zh-CN.md), [Contributing](../CONTRIBUTING.md) / [Chinese](../CONTRIBUTING.zh-CN.md), [Security Policy](../SECURITY.md) / [Chinese](../SECURITY.zh-CN.md), [MIT License](../LICENSE) / [Chinese explanatory translation](../LICENSE.zh-CN.md), [issue templates](../.github/ISSUE_TEMPLATE/bug_report.yml), and [pull request template](../.github/pull_request_template.md).

Operator/readiness command hub: [README](../README.md#contract-first-workspace).

## Name

Aetherion is the current codename.

The name combines the feeling of an invisible medium with the idea of command and agency. It should feel like an intelligent substrate that can move across devices, tools, memories, and workflows.

It should not be treated as the final public name yet. Supplied research indicates possible AI/agent-related collisions across GitHub, PyPI, trademarks, and an existing platform. The project should keep a naming-risk note until a proper clearance pass is complete. Candidate public names include Helmweaver, Vigil Loom, AegisForge, Northstar Runtime, Keelstone, Loomguard, and Argos Kernel.

## Project Icon

The canonical project icon is [`assets/aetherion-icon.png`](../assets/aetherion-icon.png). It is a 1254 by 1254 PNG and should be used without recoloring, cropping, overlays, or embedded text. The maintainable source is [`assets/aetherion-icon.svg`](../assets/aetherion-icon.svg); render the PNG from that source when the display asset needs to be regenerated.

The icon identifies the current Aetherion codename project. It does not remove the naming-clearance requirement or establish a final public trademark.

## One Sentence

Aetherion is a local-first Agent Harness Kernel that connects a user's devices, data, permissions, memory, tools, and messaging channels into a safe, auditable, self-improving agent runtime.

## Command Surface

The V1 terminal interface is named **Ether**. User-facing commands use `ether` (for example, `npm run ether -- run ...`); "TUI" describes the terminal interaction model and is not the command name.

## Positioning

Aetherion is not a single chatbot, workflow builder, IM bot, browser automation tool, memory app, or replacement operating system. It is an OS-style harness kernel that makes those capabilities work together under a coherent trust boundary.

The product should combine the useful ideas of:

- Multi-channel gateways for user reachability.
- Computer-use harnesses for real device operation.
- Long-term memory systems for durable user understanding.
- Governed capability evolution for repeated task mastery.
- MCP and OAuth connectors for tool and data access.
- Local-first desktop UX for user trust, approvals, and auditability.

But Aetherion should not inherit the common failure mode of these systems: mixing entry points, permissions, memory, and execution into one unsafe blob.

## Target Users

- Power users who want an agent that can operate their real work environment.
- Developers and operators who need an auditable, extensible harness.
- Knowledge workers who live across browser apps, documents, messages, calendars, repositories, and files.
- Teams that need per-user agent boundaries rather than one shared bot with broad credentials.

## Core Jobs

1. Let the user delegate real work across local apps, browsers, files, SaaS tools, and code repositories.
2. Let the agent build an inspectable long-term model of user preferences, projects, constraints, and workflows.
3. Let the agent turn repeated successful patterns into governed Capability Capsules.
4. Let the agent generate new capability packages without bypassing tests, policy, or user approval.
5. Let the user reach the agent from IM, mobile, browser, or desktop while preserving one clear authority boundary.
6. Let every important action be reconstructed through logs, source references, decisions, approvals, and replay artifacts.

## V1 Product Boundary

V1 is TUI-only. The first product surface should be a terminal interface that proves the local kernel loop before any GUI, mobile, IM, browser extension, or connector surface is introduced.

V1 must prove:

- A local user can issue a command from the TUI.
- The run is recorded as events.
- Tool requests pass through policy.
- Scoped leases gate local file access.
- Approval-gated writes are explicit.
- Observations and verification records are emitted.
- Replay reconstructs the trace without repeating live side effects.

Deferred from V1:

- Tauri/React GUI.
- Mobile companion.
- IM delivery.
- Browser extension.
- Browser automation.
- MCP/OAuth/SaaS connectors.
- Cloud workers.

## Non-Goals

- A pure cloud chatbot.
- A single shared IM bot treated as a multi-user security boundary.
- A V1 surface that spreads across GUI, mobile, IM, browser extension, and connectors before the TUI kernel loop is proven.
- An ungoverned auto-plugin system where generated code immediately receives real user permissions.
- A memory system that only stores embeddings without source, confidence, sensitivity, or deletion controls.
- A computer-use loop that relies only on slow visual clicking when DOM, API, or connector access is available.
- A browser extension, connector, or cloud worker that becomes a trust root.

## Differentiators

The product is not worth building because it can operate a browser or terminal. That will become table stakes. The durable differentiation is four-part:

- Capability Capsule replaces traditional Skill as the governed unit of ability.
- Event-driven Proactive replaces cron-style self-interruption.
- Dreaming produces reviewable patches instead of opaque introspection.
- Human-readable source of truth plus rebuildable indexes creates trust and portability.

### Local Supervisor And User Boundary

Aetherion's central product moat is not just more tools. It is the Local Supervisor plus User Boundary Layer: a policy, vault, event-ledger, and approval system that decides who is asking, where execution happens, what is being done, why it is being done, what risk it carries, and whether it changes long-term memory or capabilities.

The desktop app is a control surface. It is not the root authority by itself.

### Event Plane

The Event Plane is the product fact layer. Every message, tool call, approval, memory candidate, capability patch, computer action, proactive opportunity, and policy decision becomes a typed event in an append-only ledger. Memory, proactive behavior, audit, replay, and capability evolution are projections over this fact layer.

### Memory OS

Aetherion memory is a structured operating layer:

- Raw immutable events.
- Atomic memory cards.
- Episodic task histories.
- Semantic and project graphs.
- User model.
- Context assembler.
- Dreaming and simulation loops.

### Governed Capability Evolution

Capability Capsules can be proposed, drafted, tested, published, scored, patched, quarantined, and rolled back. A skill is procedural knowledge or an import format; a Capability Capsule is the governed internal unit that binds playbook, manifest, tool contract, permission requirements and constraints, tests, evals, policy, provenance, and rollback.

### Capability Packages

Agent-generated scaffolds become isolated packages with manifests, schemas, tests, policies, evals, approval UI, and deployment gates.

### Tool Policy Proxy

No agent, skill, connector, MCP server, IM adapter, scaffold, or generated package can read sensitive resources, inject context, export data, or execute side-effectful actions directly. All such access and actions pass through the Tool Policy Proxy.

The proxy also gates sensitive reads, observations, data egress, imports, exports, and context injection. Preventing writes is not enough if an agent can silently read secrets or leak private context.
