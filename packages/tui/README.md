# Ether CLI

V1 terminal surface for the local kernel loop.

Current scope:

- Run a workspace-scoped local read.
- Ask/require explicit write approval through `--approve-write`.
- Write a summary file through scoped policy.
- Route `run` through the Rust supervisor POC by default. The TypeScript seed policy path is test-only and requires `AETHERION_ALLOW_TYPESCRIPT_SEED=1`.
- Emit events to `.aetherion/events/events.jsonl`.
- Print Rust or test-seed event hash-chain status and head pointers in `run`, `replay`, and `trace` output.
- Write `.aetherion/workspace.json` and `.aetherion/runs/<run_id>.json`.
- Compose and validate risk records plus approval cards before writes.
- Verify the expected file effect.
- Reconstruct trace without live side-effect replay.
- Print replay and trace summaries through `replay` and `trace` commands.
- Persist `replay` outputs as Replay Record artifacts and registry entries with `live_side_effects.allowed=false`.
- Expose local-only Ether commands for migration dry-run, source-backed memory/context explain, checkpoint/branch/rehearsal, capsule contract inspection, causal why/counterfactual reports, hibernation records, persona/soul records, multi-agent contracts, and poisoning scan.
- Persist JSON command outputs to `.aetherion/artifacts/<command>/<topic>/<artifact-id>.json`.
- Upsert typed JSON registries such as `.aetherion/registries/memory-cards.json`, `capsules.json`, `migration-reports.json`, and `poisoning-signals.json`.
- Derive Memory Candidates from a real run ledger with `memory candidates --from-run <run_id>` before user/policy acceptance.
- Use registries for evidence-backed lifecycle transitions such as memory candidate accept/reject and hibernation wake state updates.
- Use registries for sandbox checkpoint/branch/rehearsal, causal edge/counterfactual reports, child-agent resource budgets/circuit breakers, and poisoning signal acknowledgement.
- Store checkpoint and branch event id/hash pointers so branch replay can refer to a trace head without reusing authority.
- Rehearse file writes in `.aetherion/sandboxes/<branch>/workspace/` with content hashes and a reviewable diff while leaving the real file unchanged.
- Approve rehearsals through `approve-rehearsal`, which requests a fresh Rust supervisor policy decision/lease, performs the write, verifies exact content, and appends new policy/action events without inheriting prior authority.
- Use registries for persona anchor proposal/accept/reject, persona reset records, and checkpoint-backed soul forks that never inherit live authority.

Later-phase contract commands do not connect real IM, take over webhooks, run imported skills, install capsules, or execute external side effects. They fail when required ledger or registry evidence is absent.

Rust supervisor mode:

```bash
npm run ether -- run --supervisor stdio --workspace . --input README.md --output .aetherion/SUMMARY.md --approve-write
```

This mode proves Phase 2 wiring only. Ether remains a terminal client surface; the Rust supervisor owns workspace init, event append, policy evaluation, and lease-gated file read/write for this path.

File rehearsal flow:

```bash
npm run ether -- checkpoint <run_id> --workspace .
npm run ether -- branch <checkpoint_id> --workspace .
npm run ether -- rehearse <branch_id> --workspace . --path PHASE.md --content "proposed contents"
npm run ether -- approve-rehearsal <rehearsal_id> --workspace .
```

The rehearsal command mutates only `.aetherion/sandboxes/`. Approval does not reuse checkpoint authority: Ether asks the Rust supervisor for a fresh policy decision, the write boundary reevaluates policy again, and exact file contents are verified before the live action event is recorded.

Out of scope:

- GUI.
- IM delivery.
- Browser extension.
- Browser automation.
- MCP/OAuth connectors.
- Cloud workers.
