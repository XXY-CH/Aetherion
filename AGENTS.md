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

# [Aetherion] recent context, 2026-06-08 1:23pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 6 obs (1,151t read) | 77,157t work | 99% savings

### Jun 8, 2026
**769** 10:38a ✅ **Updated .gitignore to reflect new ignored files**
Running git status --short --branch revealed that the .gitignore file has been modified locally, indicating changes to ignored patterns that affect which files are tracked by the repository.
~124t 🛠️ 4,039

770 " 🔵 Discovered project structure via rg --files
**771** " 🔵 **Learned project progress and risks from review**
The review of the project status shows that Aetherion has advanced beyond initial contract-first proof of concept to a local terminal user interface driven prototype encompassing multiple modules, while the primary risk has shifted from insufficient documentation to overly rapid feature expansion without adequate runtime depth.
~198t 🔍 12,061

**772** " 🔵 **Reviewed README to understand project goals and architecture**
Reading the README revealed that Aetherion aims to be a governed control plane between users, devices, data, tools, and autonomous agents, emphasizing local-first design, human-readable governance, and a split between TypeScript contracts and Rust authority. The project is structured in phases, with a working TUI and Rust supervisor already implemented and further modules providing contract-locked local prototypes.
~302t 🔍 17,908

**773** " 🔵 **Discovered package.json configuration**
Inspection of package.json shows that the project is a TypeScript monorepo with a Node version requirement of 25 or higher, and provides npm scripts for running tests (both TypeScript and Rust) and launching the Ether TUI interface via the CLI package.
~150t 🔍 18,852

**774** " ✅ **Updated .gitignore to ignore CLAUDE.md**
The .gitignore file was updated to ignore CLAUDE.md, indicating that this file (likely related to Claude AI interactions) should not be tracked in the repository.
~115t 🛠️ 17,739


Access 77k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>