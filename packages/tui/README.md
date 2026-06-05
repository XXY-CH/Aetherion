# Aetherion TUI

V1 terminal surface for the local kernel loop.

Current scope:

- Run a workspace-scoped local read.
- Ask/require explicit write approval through `--approve-write`.
- Write a summary file through scoped policy.
- Emit events to `.aetherion/events/events.jsonl`.
- Verify the expected file effect.
- Reconstruct trace without live side-effect replay.

Out of scope:

- GUI.
- IM delivery.
- Browser extension.
- Browser automation.
- MCP/OAuth connectors.
- Cloud workers.
