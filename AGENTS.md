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

# [Aetherion] recent context, 2026-06-16 10:34pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 24 obs (5,165t read) | 207,299t work | 98% savings

### Jun 8, 2026
769 10:38a ✅ Updated .gitignore to reflect new ignored files
770 " 🔵 Discovered project structure via rg --files
771 " 🔵 Learned project progress and risks from review
772 " 🔵 Reviewed README to understand project goals and architecture
773 " 🔵 Discovered package.json configuration
774 " ✅ Updated .gitignore to ignore CLAUDE.md
### Jun 9, 2026
775 8:56a 🟣 Added test helper functions for child read event sequences
### Jun 11, 2026
783 8:27a 🔵 Verified presence of core Aetherion documentation files
782 " 🔵 Working directory shows local modifications
784 " 🔵 AGENTS.md modified with 9 insertions and 7 deletions
781 8:28a 🔵 Audit initiated for Aetherion codebase
785 8:31a 🔵 Identified core security audit rule categories for Aetherion
786 " 🔵 No changes observed in the session
787 8:32a 🔵 Verified presence and content of core Aetherion documentation files
### Jun 12, 2026
S204 Implement OpenAI completion and response interfaces, Anthropic interface, Gemini interface, and add OAuth support for all three providers (Jun 12 at 8:09 PM)
797 8:09p ✅ AGENTS.md modified in working directory
798 10:49p 🔵 Initial inspection scope defined for Aetherion production readiness
### Jun 15, 2026
822 8:19p ⚖️ Untitled
823 " 🔵 AGENTS.md shows local modifications
824 " 🔵 Discovered release evidence reporting implementation
**826** " 🔵 **Discovered bilingual documentation verification implementation**
While examining lines 3380-3455 of packages/tui/src/cli.ts, the user discovered the implementation of bilingual documentation verification and governance file checks. These functions are used by the doctor's repository health checks to ensure primary documentation has corresponding companion files with reciprocal language links and that all required governance files are present. This directly supports the current step of reviewing docs readiness acceptance criteria and informs the pending implementation of read-only docs deployment readiness checks.
~285t 🔍 20,928

**825** 8:32p 🔵 **Discovered bilingual documentation doctor check**
While examining the doctor checks implementation in packages/tui/src/cli.ts (lines 2040-2165), the user discovered an existing bilingual documentation verification check. This check ensures primary documentation files have corresponding companion files in the other language (English/Chinese), which directly relates to the current step of reviewing docs readiness acceptance criteria and informs the pending implementation of read-only docs deployment readiness checks.
~254t 🔍 19,066

### Jun 16, 2026
**834** 5:50p 🔵 **Hermes TUI source files not found in Aetherion repository**
The user ran a recursive glob search to locate the Hermes TUI implementation files for comparison with the existing Go TUI app.go. The search only returned the Go TUI file and the repository's package.json, indicating that the Hermes TUI source files are absent from the current Aetherion repository (or not located under the searched paths). This discovery informs the subsequent analysis that a direct file‑by‑file comparison cannot be performed; instead, the review must rely on the described Hermes TUI structure from documentation or memory.
~297t 🔍 2,962

**835** " 🔵 **Searched Hermes agent source for TUI-related patterns**
The user needed to benchmark Hermes TUI without modifying Aetherion. They cloned the Hermes agent repository into a temporary location and searched for TUI-related keywords to locate relevant source files, such as transcript/history, composer, status/overlay/queue, sidebar/panes, slash commands, history navigation, streaming/status, overlay/queue interactions.
~195t 🔍 3,888

**843** 5:53p 🔵 **Documentation files identified for alignment check**
The user requested a read-only inspection of specific documentation files to align with the current demand for a real Go Bubble Tea TUI for ether, onboarding/settings/chat/model workflow, no fake daemon, real provider integration, and V1 TUI-only scope. The executed command listed all matching documentation files in both English and Chinese, confirming their presence for further review.
~247t 🔍 5,113


Access 207k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>