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
- Expose local-only Ether commands for migration dry-run, source-backed memory/context explain, checkpoint/branch/rehearsal, document-only Capsule lifecycle, causal why/counterfactual reports, queue-only hibernation, governed folding/persona/Soul Fork, multi-agent contracts, and poisoning scan.
- Persist JSON command outputs to `.aetherion/artifacts/<command>/<topic>/<artifact-id>.json`.
- Upsert typed JSON registries such as `.aetherion/registries/memory-cards.json`, `capsules.json`, `migration-reports.json`, and `poisoning-signals.json`.
- Derive Memory Candidates from a real run ledger with `memory candidates --from-run <run_id>` before user/policy acceptance.
- Use registries for evidence-backed lifecycle transitions such as memory candidate accept/reject and hibernation trigger evaluation.
- Use registries for sandbox checkpoint/branch/rehearsal, causal projection/Why/Counterfactual reports, child-agent resource budgets/circuit breakers, and poisoning signal acknowledgement.
- Store checkpoint and branch event id/hash pointers so branch replay can refer to a trace head without reusing authority.
- Rehearse file writes in `.aetherion/sandboxes/<branch>/workspace/` with content hashes and a reviewable diff while leaving the real file unchanged.
- Approve rehearsals through `approve-rehearsal`, which requests a fresh Rust supervisor policy decision/lease, performs the write, verifies exact content, and appends new policy/action events without inheriting prior authority.
- Draft, replay-test, locally publish, inspect, and roll back document-only Capsules. Capsule tests require two distinct source runs from the real hash-chained Ledger and a playbook sandbox trial; permission expansion requires an Approval Card. Local publication is unsigned and does not execute the playbook.
- Use `dream` for reviewable Memory Fold patches. It requires two real Memory Cards, retains `folded_from` and source events, and requires explicit approval before a sensitive fold becomes active.
- Use named, TTL-bound persona anchor branches. `persona reset` applies only a branch containing accepted, non-expired anchors and retains business Memory Card references.
- Build checkpoint-backed Soul Fork records with a new identity, zero initial budget, empty path scope, no vault/OAuth/lease grants, reference-only inheritance, and `live_side_effects_allowed=false`.
- Record Phase 9 lifecycle changes through Rust Supervisor events whose `payload_ref` points to the persisted Ether artifact; registries remain projections, not the only fact source.
- Rebuild `.aetherion/projections/causal.sqlite` from Ledger events for `why` and `counterfactual`. The SQLite file is explicitly a disposable projection; typed edges are temporal dependency candidates, not proof of causation, and redacted source links lower report confidence.
- Persist Digital Hibernation records with a hash-bound Ledger cursor, minimal `resume` Context Pack, no active leases, bounded wake attention, and manual/deadline/file triggers. `wake` evaluates a trigger only when invoked, requests a fresh Rust supervisor queue decision, and appends `policy.decided` plus `wakeup.queued` to a new blocked resume run. It does not run a daemon, issue a lease, or resume task actions.

Later-phase contract commands do not connect real IM, take over webhooks, run imported skills, install executable packages, or execute external side effects. They fail when required ledger or registry evidence is absent.

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

Document-only Capsule flow:

```bash
npm run ether -- capsule draft --path capsule.json --workspace .
npm run ether -- capsule test <capsule_id> --replay-run <run_id_1> --replay-run <run_id_2> --workspace .
npm run ether -- capsule publish <capsule_id> --approve-permissions --workspace .
npm run ether -- capsule rollback <capsule_id> --version <published_version> --workspace .
```

This flow never runs imported or generated code. It produces replay records, a static-scanned playbook copy, an integrity digest, permission diff, optional Approval Card, version registry, and rollback target. Package signing and external sandbox execution remain later-phase work.

Digital Hibernation flow:

```bash
npm run ether -- sleep <run_id> --deadline <iso-date> --watch-file README.md --workspace .
npm run ether -- wake <trigger_or_hibernation_id> --workspace .
npm run ether -- sleepers --workspace .
```

Deadline and file conditions are checked when `wake` is explicitly invoked. Reliable background wakeup still requires a future local daemon or OS integration.

Out of scope:

- GUI.
- IM delivery.
- Browser extension.
- Browser automation.
- MCP/OAuth connectors.
- Cloud workers.
