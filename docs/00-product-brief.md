# Product Brief

## Name

Aetherion is the current codename.

The name combines the feeling of an invisible medium with the idea of command and agency. It should feel like an intelligent substrate that can move across devices, tools, memories, and workflows.

It should not be treated as the final public name yet. Supplied research indicates possible AI/agent-related collisions across GitHub, PyPI, trademarks, and an existing platform. The project should keep a naming-risk note until a proper clearance pass is complete. Candidate public names include Helmweaver, Vigil Loom, AegisForge, Northstar Runtime, Keelstone, Loomguard, and Argos Kernel.

## One Sentence

Aetherion is a local-first Agent Harness Kernel that connects a user's devices, data, permissions, memory, tools, and messaging channels into a safe, auditable, self-improving agent runtime.

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

## Non-Goals

- A pure cloud chatbot.
- A single shared IM bot treated as a multi-user security boundary.
- An ungoverned auto-plugin system where generated code immediately receives real user permissions.
- A memory system that only stores embeddings without source, confidence, sensitivity, or deletion controls.
- A computer-use loop that relies only on slow visual clicking when DOM, API, or connector access is available.

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

Capability Capsules can be proposed, drafted, tested, published, scored, patched, quarantined, and rolled back. A skill is procedural knowledge or an import format; a Capability Capsule is the governed internal unit that binds playbook, manifest, tool contract, permissions, tests, evals, policy, provenance, and rollback.

### Capability Packages

Agent-generated scaffolds become isolated packages with manifests, schemas, tests, policies, evals, approval UI, and deployment gates.

### Tool Policy Proxy

No agent, skill, connector, MCP server, IM adapter, scaffold, or generated package can execute side-effectful actions directly. All such actions pass through the Tool Policy Proxy.
