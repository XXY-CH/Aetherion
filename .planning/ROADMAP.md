# Roadmap: Aetherion

**Created:** 2026-06-06
**Granularity:** Coarse
**Execution:** Parallel where independent

## Phase Summary

| Phase | Name | Goal | Requirements |
|-------|------|------|--------------|
| 1 | TUI Contract Kernel | Lock the TypeScript contract/TUI MVP loop as the first runnable path. | CONT-01, CONT-02, CONT-03, TUI-01, TUI-02, TUI-03, TUI-04, TUI-05, TUI-06 |
| 2 | Rust Supervisor Authority | Move policy and local file authority toward Rust without adding new user surfaces. | POL-01, POL-02, POL-03, POL-04, POL-05 |
| 3 | Audit Replay Hardening | Strengthen event trace, replay, ignored state, and verification gates. | AUD-01, AUD-02, AUD-03, AUD-04 |
| 4 | Post-V1 Adapter Scaffolds | Keep Computer Use and connector packages useful but quarantined behind policy. | CUSE-01, CUSE-02, CUSE-03, CONN-01, CONN-02, CONN-03 |
| 5 | Planning And Governance Closure | Keep docs, GSD state, roadmap, and commit lore aligned with the real scope. | DOC-01, DOC-02, DOC-03, DOC-04 |

## Phase 1: TUI Contract Kernel

Goal: Lock the TypeScript contract-first MVP loop as the authoritative V1 path.

Requirements: CONT-01, CONT-02, CONT-03, TUI-01, TUI-02, TUI-03, TUI-04, TUI-05, TUI-06

Success criteria:

1. `npm test` validates contract examples and the harness-core/TUI local kernel loop.
2. A user can run the TUI against a local workspace input file and produce an approval-gated output.
3. The run creates inspectable event, policy, observation, verification, and replay records.
4. README and package docs identify TUI as V1 and keep GUI/IM/browser/connectors out of the first runtime.

Notes:

- **UI hint**: yes, but terminal-only.
- Do not add a GUI or browser app in this phase.

## Phase 2: Rust Supervisor Authority

Goal: Move the same local authority semantics into the Rust supervisor POC and prepare TypeScript-to-Rust IPC.

Requirements: POL-01, POL-02, POL-03, POL-04, POL-05

Success criteria:

1. `cargo test` proves workspace init, JSONL event append, policy evaluation, scoped lease issuance, and lease-gated local read/write.
2. Policy denies outside-workspace paths and unsupported operations.
3. The design for JSON-RPC over stdio/socket/named pipe is documented before TUI calls Rust.
4. No generated package, connector, browser automation, or imported skill runs inside the supervisor process.

Notes:

- **UI hint**: no.
- The TypeScript TUI may continue using harness-core until IPC is explicitly implemented.

## Phase 3: Audit Replay Hardening

Goal: Make completion claims reconstructable through event traces and verification gates.

Requirements: AUD-01, AUD-02, AUD-03, AUD-04

Success criteria:

1. Replay remains trace reconstruction by default, not live side-effect repetition.
2. Runtime state directories remain ignored by git and do not pollute commits.
3. `npm run test:all` covers TypeScript and Rust test lines.
4. Event and replay artifacts remain human-readable and machine-parseable.

Notes:

- **UI hint**: maybe, TUI trace display only.

## Phase 4: Post-V1 Adapter Scaffolds

Goal: Preserve useful Computer Use and connector scaffolds without enabling real external power in V1.

Requirements: CUSE-01, CUSE-02, CUSE-03, CONN-01, CONN-02, CONN-03

Success criteria:

1. Computer Use package documents adapter families, taint handling, verifier requirements, and post-V1 scope.
2. Connector SDK documents quarantine, vault references, migration reports, and policy-gated calls.
3. Tests reject quarantined adapters and raw secret references.
4. No real IM, MCP/OAuth, browser automation, or SaaS connector runtime is introduced.

Notes:

- **UI hint**: no.

## Phase 5: Planning And Governance Closure

Goal: Keep project documents, GSD artifacts, and commit history aligned with the real Aetherion scope.

Requirements: DOC-01, DOC-02, DOC-03, DOC-04

Success criteria:

1. README links all product docs and `.planning/` points to the current roadmap.
2. `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, and `.planning/research/` exist.
3. Requirements traceability maps every v1 requirement to exactly one phase.
4. Commits use the Lore commit protocol and avoid unrelated local files.

Notes:

- **UI hint**: no.

## Requirement Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONT-01 | Phase 1 | Pending |
| CONT-02 | Phase 1 | Pending |
| CONT-03 | Phase 1 | Pending |
| TUI-01 | Phase 1 | Pending |
| TUI-02 | Phase 1 | Pending |
| TUI-03 | Phase 1 | Pending |
| TUI-04 | Phase 1 | Pending |
| TUI-05 | Phase 1 | Pending |
| TUI-06 | Phase 1 | Pending |
| POL-01 | Phase 2 | Pending |
| POL-02 | Phase 2 | Pending |
| POL-03 | Phase 2 | Pending |
| POL-04 | Phase 2 | Pending |
| POL-05 | Phase 2 | Pending |
| AUD-01 | Phase 3 | Pending |
| AUD-02 | Phase 3 | Pending |
| AUD-03 | Phase 3 | Pending |
| AUD-04 | Phase 3 | Pending |
| CUSE-01 | Phase 4 | Pending |
| CUSE-02 | Phase 4 | Pending |
| CUSE-03 | Phase 4 | Pending |
| CONN-01 | Phase 4 | Pending |
| CONN-02 | Phase 4 | Pending |
| CONN-03 | Phase 4 | Pending |
| DOC-01 | Phase 5 | Pending |
| DOC-02 | Phase 5 | Pending |
| DOC-03 | Phase 5 | Pending |
| DOC-04 | Phase 5 | Pending |

Coverage: 28 / 28 v1 requirements mapped.

## Next Command

Run:

```sh
$gsd-discuss-phase 1
```
