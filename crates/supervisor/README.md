# Aetherion Supervisor POC

Rust proof-of-concept for the future Local Supervisor authority boundary.

Current scope:

- Workspace initialization.
- Append SHA-256-linked JSONL events compatible with Ether trace verification.
- Evaluate a tiny deterministic local file policy.
- Issue scoped leases for workspace-local reads and approval-gated writes.
- Execute workspace-scoped file read/write through leases.
- Reject expired leases and wrong-path lease reuse.
- Expose a minimal stdio JSON-RPC POC for workspace init, event append, policy evaluation, lease issuance, file read/write, and trace replay.
- Fail closed when required RPC fields are absent and return the actual operation lease id for writes.

Out of scope:

- Real vault backend.
- Crash-safe concurrent ledger append, signatures, and redaction.
- JSON-RPC server.
- Browser, IM, MCP, OAuth, or cloud worker integration.
- Loading generated or imported code.

This crate intentionally has no external dependencies in the first POC.
