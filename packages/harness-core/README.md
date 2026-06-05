# @aetherion/harness-core

Minimal contract-first seed for the Aetherion kernel.

Current scope:

- Create a workspace runtime directory.
- Append typed events to a JSONL event ledger.
- Validate events and contract examples against JSON Schemas.
- Create a tool request for a workspace-scoped file read.
- Produce a mock policy decision.
- Execute a local file read through that policy decision.
- Reconstruct a run trace without replaying live side effects.

Out of scope:

- Real browser automation.
- Real IM/MCP/OAuth connectors.
- Real vault backend.
- Real memory retrieval.
- Real cloud workers.
