# Ether CLI

V1 terminal surface for the local kernel loop.

Current scope:

- Run a workspace-scoped local read.
- Ask/require explicit write approval through `--approve-write`.
- Write a summary file through scoped policy.
- Optionally route `run --supervisor stdio` through the Rust supervisor POC instead of the TypeScript seed policy path.
- Emit events to `.aetherion/events/events.jsonl`.
- Print seed event hash-chain status and head pointers in `run`, `replay`, and `trace` output.
- Write `.aetherion/workspace.json` and `.aetherion/runs/<run_id>.json`.
- Compose and validate risk records plus approval cards before writes.
- Verify the expected file effect.
- Reconstruct trace without live side-effect replay.
- Print replay and trace summaries through `replay` and `trace` commands.
- Persist `replay` outputs as Replay Record artifacts and registry entries with `live_side_effects.allowed=false`.
- Expose local-only seed commands for later phases: migration dry-run, memory/context explain, checkpoint/branch/rehearsal, capsule lifecycle, causal why/counterfactual reports, hibernation wakeup, persona/soul fork, multi-agent budget contract, and poisoning scan.
- Persist JSON command outputs to `.aetherion/artifacts/<command>/<topic>/<artifact-id>.json`.
- Upsert typed JSON registries such as `.aetherion/registries/memory-cards.json`, `capsules.json`, `migration-reports.json`, and `poisoning-signals.json`.
- Derive Memory Candidates from a real run ledger with `memory candidates --from-run <run_id>` before user/policy acceptance.
- Use registries for seed lifecycle transitions: memory candidate accept/reject, capsule test/publish, and hibernation wake state updates.
- Use registries for sandbox checkpoint/branch/rehearsal, causal edge/counterfactual reports, child-agent resource budgets/circuit breakers, and poisoning signal acknowledgement.
- Store checkpoint and branch event id/hash pointers so branch replay can refer to a trace head without reusing authority.
- Approve rehearsals through `approve-rehearsal`, which appends a fresh policy decision and new action record without inheriting prior authority.
- Use registries for persona anchor proposal/accept/reject, persona reset records, and checkpoint-backed soul forks that never inherit live authority.

These later-phase commands are intentionally local seed surfaces. They do not connect real IM, take over webhooks, run imported skills, install capsules, or execute external side effects.

Rust supervisor mode:

```bash
npm run ether -- run --supervisor stdio --workspace . --input README.md --output .aetherion/SUMMARY.md --approve-write
```

This mode proves Phase 2 wiring only. Ether remains a terminal client surface; the Rust supervisor owns workspace init, event append, policy evaluation, and lease-gated file read/write for this path.

Out of scope:

- GUI.
- IM delivery.
- Browser extension.
- Browser automation.
- MCP/OAuth connectors.
- Cloud workers.
