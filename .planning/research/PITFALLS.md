# Pitfalls Research: Aetherion

## Pitfall: Surface Sprawl Before Authority

Warning signs:

- Adding GUI, IM, browser extension, browser automation, or connectors before TUI kernel proof.
- Treating a client surface as permission authority.

Prevention:

- Keep Phase 1 and Phase 2 TUI/Rust-boundary focused.
- Maintain explicit out-of-scope lists in requirements and roadmap.

## Pitfall: Migration Imports Authority

Warning signs:

- OpenClaw/Hermes tokens copied into plaintext.
- Legacy skills activated directly.
- Unknown plugin hooks treated as safe.

Prevention:

- Use migration reports.
- Convert secrets to vault references.
- Import skills as draft/quarantined capsules.

## Pitfall: Replay Repeats Side Effects

Warning signs:

- Tests or replay commands perform live writes, sends, or external calls.
- Trace replay lacks side-effect mode markers.

Prevention:

- Replay defaults to reconstruction or sandbox simulation.
- Live side-effect replay requires explicit approval.

## Pitfall: Capability Capsules Become Plugins

Warning signs:

- Capsule owns permissions directly.
- Generated code runs in Local Supervisor.
- Permission changes lack diff and approval.

Prevention:

- Capsules declare requirements; policy issues scoped leases.
- Generated code runs in sandbox/separate process.
- Permission expansion goes through full gate.

## Pitfall: Memory Becomes Opaque Vector Search

Warning signs:

- Memory cards lack source events.
- User cannot inspect or delete memory.
- Sensitive data enters indexes without policy.

Prevention:

- Keep Event Ledger as source.
- Require source-backed Memory Candidates and reviewable patches.
- Treat vector/graph/search indexes as rebuildable projections.

## Pitfall: Observability Becomes Hot-Path Cost

Warning signs:

- Dashboard rendering slows policy decisions.
- High-frequency event streams are kept raw forever.

Prevention:

- Build dashboards from projections.
- Add sampling, folding, compression, and async analysis.
