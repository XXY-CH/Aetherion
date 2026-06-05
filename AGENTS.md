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

## Editing Rules

- Do not describe Aetherion as a replacement OS.
- Treat Aetherion as a codename until naming clearance.
- Keep imported tools, skills, configs, MCP servers, hooks, and generated packages quarantined by default.
- Prefer contract-first implementation: schema, example, fixture, minimal harness, then runtime expansion.
- Do not let browser extension, IM, connector, cloud worker, generated package, or replay become a trust root.
- Do not store raw secrets in examples, memory, logs, traces, schemas, or test fixtures.

## Current Implementation Scope

The repository is transitioning from design docs to contract-first scaffolding.

Allowed early implementation:

- JSON Schemas for kernel contracts.
- Example JSON documents for every schema.
- Minimal harness-core package proving:
  user request -> policy decision -> local file read -> event trace -> replay reconstruction.

Out of scope until explicit implementation phase:

- Real browser automation.
- Real IM delivery.
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
