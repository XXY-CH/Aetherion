# Aetherion Connector SDK Scaffold

Post-V1 scaffold for external adapters.

This package intentionally does not implement real IM, MCP, OAuth, or SaaS connectors yet. It defines the registration boundary:

- Imports default to quarantine.
- Connector authorization is not agent permission.
- Every connector tool call must become a Tool Request.
- Delivery and data egress must pass through Tool Policy Proxy.
- Secrets are represented only as vault references.

Connectors remain post-V1. V1 is TUI-only.
