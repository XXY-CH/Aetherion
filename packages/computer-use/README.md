# Aetherion Computer Use Scaffold

Post-V1 scaffold for governed computer-use adapters.

This package intentionally does not implement real browser automation or desktop control yet. It defines the safe control-plane shape future adapters must follow:

- Adapter declares capabilities.
- Browser targets must be current-tab scoped.
- Structured channels are preferred before screenshot fallback.
- Side-effectful actions cannot proceed without a scoped policy lease.
- Side-effectful adapters also require an approval card before action.
- Sensitive reads, taint, and data egress are explicit.
- Observations are non-authorizing evidence for verification.
- Live replay is disabled by default.

Computer Use remains post-V1. V1 is TUI-only.
