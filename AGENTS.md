# AGENTS.md

## Project Intent

Aetherion is a codename for a local-first Agent Harness Kernel. It is not a chatbot, not a replacement operating system, and not an unrestricted plugin host.

Preserve these invariants:

- Local Supervisor is the root authority.
- Event Ledger is the fact layer.
- Tool Access & Action Policy Proxy gates sensitive reads, data egress, and side effects.
- Capability Capsules do not own permissions. They declare requirements and constraints; runtime grants are scoped leases.
- Connector adapters and execution adapters are sibling target families behind policy.
- Dreaming produces reviewable patches, not actions.
- Proactive behavior is an Opportunity Lifecycle with inhibition, not cron self-interruption.
- Human-readable contracts are governance source of truth; indexes are rebuildable projections.

## V1 Hard Scope

V1 is TUI-first. Do not add GUI, mobile, real IM delivery, browser extension, browser automation, MCP/OAuth connectors, or cloud workers to the first runnable product.

V1 should prove:

- TUI command surface.
- Contract validation.
- Local workspace identity.
- Event ledger append.
- Tool request.
- Policy decision.
- Scoped lease.
- Local file read/write through policy.
- Observation and verification.
- Trace replay reconstruction.

## Editing Rules

- Do not describe Aetherion as a replacement OS.
- Treat Aetherion as a codename until naming clearance.
- Keep imported tools, skills, configs, MCP servers, hooks, and generated packages quarantined by default.
- Prefer contract-first implementation: schema, example, fixture, minimal harness, then runtime expansion.
- Use TypeScript for contract iteration and TUI seed work.
- Reserve Rust for the future Local Supervisor authority boundary.
- Keep Python in eval/research only; do not put Python in the authority path.
- Do not let browser extension, IM, connector, cloud worker, generated package, or replay become a trust root.
- Do not store raw secrets in examples, memory, logs, traces, schemas, or test fixtures.

## Current Implementation Scope

The repository is transitioning from design docs to contract-first scaffolding.

Allowed early implementation:

- JSON Schemas for kernel contracts.
- Example JSON documents for every schema.
- Minimal harness-core package proving:
  user request -> policy decision -> local file read -> approval-gated local write -> verification -> event trace -> replay reconstruction.

Out of scope until explicit implementation phase:

- Real browser automation.
- Real IM delivery.
- GUI desktop app.
- Mobile app.
- Real MCP/OAuth connectors.
- Real memory retrieval or vector indexes.
- Real vault/secret backend.
- Real cloud worker execution.

## Verification

Before claiming completion:

- Run schema/example validation tests.
- Run the minimal harness-core test.
- Check that generated/local runtime state remains ignored.
- Report any untracked files intentionally left out of commits.


<claude-mem-context>
# Memory Context

# claude-mem status

This project has no memory yet. The current session will seed it; subsequent sessions will receive auto-injected context for relevant past work.

Memory injection starts on your second session in a project.

`/learn-codebase` is available if the user wants to front-load the entire repo into memory in a single pass (~5 minutes on a typical repo, optional). Otherwise memory builds passively as work happens.

Live activity: http://localhost:37777
How it works: `/how-it-works`

This message disappears once the first observation lands.
</claude-mem-context>