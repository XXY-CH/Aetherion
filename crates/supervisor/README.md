# Aetherion Supervisor POC

Rust proof-of-concept for the future Local Supervisor authority boundary.

Current scope:

- Workspace initialization.
- Derive workspace identity from the resolved workspace root and reject mismatched RPC workspace ids before runtime initialization.
- Append `aetherion-event-v1` SHA-256-linked JSONL events compatible with Ether trace verification.
- Canonicalize complete v1 event envelopes identically with TypeScript, verify all v1 authors on startup, and preserve compatibility verification for legacy supervisor events.
- Serialize event appends with a workspace-local lock, recover stale locks with Unix owner-PID checks plus age fallback, write through synced temp files and atomic rename, clean abandoned temp files on startup, reject corrupt hash chains, and reject Ledger events whose workspace id does not match the active workspace.
- Evaluate a tiny deterministic local file policy.
- Issue scoped leases for workspace-local reads and approval-gated writes.
- Execute workspace-scoped file reads through leases and writes through traced prepare/commit RPCs that issue the operation lease only after approval.
- Emit traced file-action lifecycle events from Rust RPC methods for workspace reads, child workspace reads, write preparation, and approved write commits.
- Validate the approved write Consent Record binding, persist the Consent Record artifact, and then attach its `payload_ref` to approved `consent.recorded` events without creating consent events for unapproved writes.
- Reject expired leases and wrong-path lease reuse.
- Expose a minimal stdio JSON-RPC POC for workspace init, event append, policy evaluation, lease issuance, file reads, traced write prepare/commit, and trace replay.
- Parse stdio RPC input with a dependency-free structured JSON object parser, fail closed on malformed JSON, duplicate keys, wrong-typed required string fields, and wrong-typed boolean approval fields, reject the legacy direct `file.write` RPC, and return the actual operation lease id for approved write commits.

Out of scope:

- Real vault backend.
- Event signatures, redaction, and branch-specific append streams.
- JSON-RPC server.
- Browser, IM, MCP, OAuth, or cloud worker integration.
- Loading generated or imported code.

This crate intentionally has no external dependencies in the first POC.
