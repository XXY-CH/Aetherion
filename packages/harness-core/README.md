# @aetherion/harness-core

Minimal contract-first seed for the Aetherion kernel.

Current scope:

- Create a workspace runtime directory.
- Create workspace registry and per-run manifest files.
- Append typed events to a JSONL event ledger.
- Add seed `parent_event_id`, `parent_event_hash`, and `event_hash` pointers on TypeScript-appended events.
- Validate events and contract examples against JSON Schemas.
- Create a tool request for a workspace-scoped file read.
- Compose seed risk records and deterministic seed policy decisions.
- Execute a local file read through that policy decision.
- Require explicit consent for a local file write.
- Generate an approval card before approval-gated writes.
- Execute an approval-gated local file write through a scoped lease.
- Verify the expected file effect.
- Reconstruct a run trace without replaying live side effects.
- Check trace hash-chain validity for TypeScript-appended seed events.
- Create Replay Records for trace-mode reconstruction with live side effects disabled.
- Provide a TypeScript stdio client for the Rust supervisor POC.
- Run the same seed loop through the Rust supervisor via `runSupervisorKernelLoop`.
- Provide human-readable local registry helpers for `.aetherion/registries/*.json`.
- Support registry upsert/read helpers used by Memory OS, Capsule OS, hibernation, migration, and security seed command surfaces.
- Feed later Memory OS context assembly by making run ledger events and manifests readable by TUI commands.

Out of scope:

- Real browser automation.
- Real IM/MCP/OAuth connectors.
- Real vault backend.
- Real memory retrieval.
- Real cloud workers.
