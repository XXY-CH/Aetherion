# Aetherion Supervisor POC

Rust proof-of-concept for the future Local Supervisor authority boundary.

Current scope:

- Workspace initialization.
- Append SHA-256-linked JSONL events compatible with Ether trace verification.
- Serialize event appends with a workspace-local lock, write through synced temp files and atomic rename, clean abandoned temp files on startup, and reject corrupt hash chains.
- Evaluate a tiny deterministic local file policy.
- Issue scoped leases for workspace-local reads and approval-gated writes.
- Execute workspace-scoped file read/write through leases.
- Reject expired leases and wrong-path lease reuse.
- Expose a minimal stdio JSON-RPC POC for workspace init, event append, policy evaluation, lease issuance, file read/write, and trace replay.
- Fail closed when required RPC fields are absent and return the actual operation lease id for writes.

Out of scope:

- Real vault backend.
- Event signatures, redaction, and branch-specific append streams.
- JSON-RPC server.
- Browser, IM, MCP, OAuth, or cloud worker integration.
- Loading generated or imported code.

This crate intentionally has no external dependencies in the first POC.
