# Aetherion Computer Use Scaffold

Post-V1 scaffold for governed computer-use adapters.

This package intentionally does not implement real browser automation or desktop control yet. It defines the safe shape future adapters must follow:

- Adapter declares capabilities.
- Adapter cannot execute without a policy lease.
- Sensitive reads and data egress are explicit.
- Observations and verification records are required.
- Live replay is disabled by default.

Computer Use remains post-V1. V1 is TUI-only.
