# Surface OS

[中文版本](README.zh-CN.md)

Phase 12 control-plane package for browser, IM, and Capsule Store surfaces.

Current scope:

- Browser current-tab observation records.
- IM inbox metadata records.
- IM outbox policy queue records.
- Signed Capsule Store package verification and local declaration install records.

Non-goals in this package:

- Clicking, typing, or driving a browser.
- Reading arbitrary tabs or browser profiles.
- Sending Telegram, Slack, email, or webhook messages.
- Running a GUI.
- Executing Store package code.
- Granting permissions to Capsules.

The package exists so future strong Computer Use can start from the right invariants:

- Surface inputs are client observations, not authority.
- External content stays tainted and cannot authorize actions.
- Browser DOM and IM bodies are stored as hashes plus metadata, not raw payloads.
- Outbound IM is an outbox item that needs one scoped approval and a Supervisor policy event before any future delivery adapter can run.
- Store packages install declarations only after schema validation, Ed25519 signature verification, replay evidence, sandbox evidence, and permission-diff approval.

The authoritative facts must still be written through Ether and the Rust Local Supervisor into the Event Ledger.
