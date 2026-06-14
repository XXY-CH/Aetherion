# Production Gap Closure Plan

[中文版本](15-production-gap-closure-plan.zh-CN.md)

This plan converts the current Aetherion repository state into an ordered gap-closure program. It is intentionally planning-only: it does not widen the V1 runtime surface, enable real OAuth connector flows, start GUI/mobile/IM/browser delivery, execute package code, or make projections authoritative.

## Source Alignment

The plan is grounded in these source documents and current implementation summaries:

- [Product Brief](00-product-brief.md): Aetherion is a local-first Agent Harness Kernel, not a chatbot or replacement OS. V1 is TUI-only; GUI, mobile, IM, browser extension, browser automation, MCP/OAuth/SaaS connectors, and cloud workers are deferred.
- [Architecture](01-architecture.md): Local Supervisor is the root authority, Event Ledger is the fact layer, and Tool Access & Action Policy Proxy gates sensitive reads, data egress, and side effects.
- [User Boundary Layer](02-user-boundary-layer.md): client surfaces, connectors, skills, generated packages, and remote channels cannot authorize sensitive actions directly.
- [Audit and Data Contracts](05-audit-and-data-contracts.md): human-readable governance state is source truth; indexes, registries, and projections must be rebuildable evidence views.
- [Roadmap](06-roadmap.md): Phase 1/2 must prove the TUI plus Rust supervisor loop before post-V1 computer, connector, proactive, GUI, or broader surface work.
- [Technical Strategy](10-technical-strategy.md): TypeScript owns fast contract/orchestrator iteration; Rust owns authority, policy, vault, ledger, sandbox, and native execution.
- [Schema Runtime Governance](13-schema-runtime-governance.md): schemas, fixtures, projections, and client surfaces are not runtime authority; P0/P1 work must close executable loops.
- [Runtime Loop Plan](14-runtime-loop-plan.md): recent increments already hardened no-tools model provider evidence, supervisor lifecycle readiness and fail-closed command evidence, read-only doctor/security/release evidence, dependency reproducibility, CI platform smoke, onboarding checks, and supervisor failure diagnostics.

## Requirements Summary

- Preserve V1 as TUI-first while closing production gaps around readiness evidence, lifecycle determinism, policy boundaries, onboarding, release posture, and provider safety.
- Keep all broader surfaces as client/control-plane candidates until Local Supervisor action gateways exist for them.
- Support OpenAI Responses, OpenAI Chat Completions, Anthropic Messages, and Gemini generateContent in no-tools mode without persisting raw prompts, raw responses, raw provider payloads, or credentials.
- Treat OAuth as a future governed credential and connector lifecycle. Current provider support may accept externally supplied bearer tokens where supported, but Aetherion must not yet run browser OAuth flows, persist refresh tokens, or issue connector grants.
- End each execution round with source-doc drift review, tests/evidence, a Lore-protocol commit, and push.
- Use at most two child/subagent lanes per implementation round.

## Architecture Gap Matrix

| Architecture layer | Current repository evidence | Production gap | Closure direction |
| --- | --- | --- | --- |
| Client Surfaces | Ether TUI exists; GUI/mobile/IM/browser/API are documented as deferred; README lists governed post-V1 scaffolds. | No productized desktop/mobile/browser/IM/API clients, and no surface identity/pairing lifecycle. | Keep V1 TUI as the only runnable client. Add API/GUI/browser/IM/mobile only as post-gate clients after ingress identity and supervisor policy gateways exist. |
| Ingress Gateways | Local command invocation has workspace identity checks; Local Ingress Readiness now defines the envelope/idempotency/auth-state/rate-limit/policy-handoff boundary; TUI `run` creates hash-only local rate-limit window-slots, idempotency reservations, and same-key same-intent completion caches before supervisor handoff; IM/browser/store observations are hash-only or queue-only slices. | No durable/session/remote idempotency replay, durable/distributed/session/remote rate limiting, durable auth/session lifecycle, public API listener, IM/browser/mobile ingress gateway, or real remote-surface request execution. | Promote the local ingress contract into a runtime gateway in small steps: caller/session identity, durable or remote idempotency and rate-limit semantics, and fresh supervisor policy handoff before any real remote surface. |
| Local Supervisor | Rust POC owns workspace identity, hash-chained ledger append, traced file reads/writes, scoped leases, status/preflight, foreground socket lock observation, supervisor lifecycle readiness evidence, explicit fail-closed `start`/`stop`/`recover-stale-lock` command reports, metadata-only vault references, vault policy binding readiness evidence, and process-failure hardening. | No long-running production daemon, vault backend, signing, process sandbox, socket auth lifecycle, implemented start/stop/recover behavior, stale-lock repair, or secret retrieval path. | Promote lifecycle semantics in small steps: keep fail-closed command contracts, then add auth token boundary, vault metadata binding, signer plan, and daemon health evidence before real start/stop/recovery. |
| Agent Orchestrator | Prompt assembly, runtime binding, model request/response metadata, live no-tools invocation, response audit, and tool-request proposal are implemented as non-authorizing evidence. | No full agent loop, planner/verifier runtime, streaming, retry policy, semantic verification, tool-call translation, or durable queue integration. | Keep no-tools provider lane; then bridge operator-restated proposals into fresh supervisor policy requests before adding model-driven tool loops. |
| Memory OS | Source-backed Memory Candidate/Card/Tombstone lifecycle, context assembly, tombstone exclusion, conflict projection, and parity previews exist. | No full deterministic rebuild/repair, redaction lifecycle, semantic retrieval, vector/graph indexes, or memory quality dashboards. | Expand parity coverage and redaction/rebuild tooling before semantic/vector retrieval. |
| Capability OS | Document-only Capsule lifecycle, proposal from passing traces, local trust-publisher store install, sandbox/replay evidence checks, and rollback exist. | No remote marketplace, transparency log, revocation feed, package-code execution sandbox, route scoring, or permission-diff UX. | Finish local integrity/revocation evidence first; keep package code quarantined until a supervisor-governed execution sandbox exists. |
| Proactive Engine | Sleep/wake, wakeup eligibility preview, hibernation parity, and queue-only wake events exist. | No background scheduler, Opportunity Lifecycle UI, attention-budget policy daemon, notification ladder, or automatic resume executor. | Build opportunity records and queue projections in shadow mode only; no notification or action without explicit policy. |
| Tool Access & Action Policy Proxy | Local file reads/writes, IM outbox policy, taint denial, child reads, sandbox promotion, and action lifecycle guards are present. | Policy is deterministic and narrow; no generalized adapter policy DSL, vault-backed secrets, egress policy matrix, or connector grants. | Broaden policy through typed target families and negative tests before adding adapters. Vault references must arrive before real OAuth/connector use. |
| Connector + Execution Adapters | Computer-use and connector SDK scaffolds exist; provider adapters support no-tools OpenAI/Anthropic/Gemini calls; store packages remain declarations. | No real OAuth connector runtime, browser automation, desktop execution adapter, IM delivery, MCP adapter, cloud worker, or package execution. | Add adapter manifests and local dry-run evidence first. Real connectors/execution require ingress identity, vault refs, policy gates, and lease-bound action records. |
| Observations / Results / Artifacts | Many hash-only artifacts and payload-ref audits exist; release/security/doctor evidence is read-only. | Artifact integrity is local-only; no release artifact signing, remote CI attestation reader, docs deployment evidence, or artifact retention policy. | Add release manifest, artifact hash/signing plan, remote CI evidence reader, and docs deployment readiness without publishing automatically. |
| Event Ledger + Projections | Hash-chained JSONL, run manifests, replay records, registry audits, payload-ref audits, and scoped parity previews exist. | No event signatures, branch-specific append streams, complete projection rebuild parity, redaction/rebuild tooling, or projection repair commands. | Finish deterministic rebuild coverage, add signature and redaction plans, and keep repair explicit/operator-approved. |

## Ordered Gap-Closure Milestones

### PGC-0: Planning Baseline And Drift Ledger

Deliverables:

- Keep this plan and its Chinese companion as the canonical production-gap closure index.
- Add every round-end source-doc drift review to [Phase Implementation Review](12-phase-implementation-review.md) or [Runtime Loop Plan](14-runtime-loop-plan.md).
- Keep commits in the Lore protocol and push every round.

Acceptance criteria:

- README links this plan in both English and Chinese.
- Every future round names source-doc alignment, deviations corrected, verification run, commit hash, and push status.

### PGC-1: Release And Readiness Evidence Hardening

Deliverables:

- Remote CI evidence reader/report that summarizes latest CI and CodeQL status without mutating workspace state.
- Release manifest schema for source revision, dependency lockfiles, test gates, artifact hashes, governance docs, bilingual docs, and known gaps.
- Docs deployment readiness check that verifies links/build inputs without deploying.

Acceptance criteria:

- `doctor`, `security audit`, and `release evidence` can explain local configured evidence and remote observed evidence separately.
- A release candidate can be rejected for stale CI, dirty tree, missing lockfile evidence, missing bilingual doc link, missing license/governance file, or missing known-gap declaration.

Current partial status:

- `release evidence --remote-evidence <snapshot.json>` consumes a workspace-local CI/CodeQL snapshot and keeps remote observed evidence separate from configured evidence.
- `release remote-evidence --workspace <path> [--branch <name>]` now generates a stdout-only GitHub Actions snapshot through `gh run list`, keeps the latest run per workflow name, infers CodeQL status from the latest CodeQL workflow, and writes no workspace state.
- `doctor` and `release evidence` now include docs deployment readiness inputs: local Markdown entrypoints, relative link resolution, bilingual companion links, and explicit `public_docs_deployed=false` evidence.
- `release evidence` now includes a schema-aligned `release_manifest_preview` derived from current evidence, source-evidence hashes, optional remote observations, and known gaps. It is not written as a generated manifest file, signed artifact, package, release publication, or docs deployment.
- Release packaging, artifact signing, public docs deployment evidence, artifact retention policy, release evidence repository, installer/updater automation, and code-scanning alert review remain open.

### PGC-2: Supervisor Lifecycle And Vault Reference MVP

Deliverables:

- Typed lifecycle contract for `supervisor start`, `status`, `stop`, and explicit `recover-stale-lock` preflight. The first command slice exists as structured `unsupported_fail_closed` reports for `start`, `stop`, and `recover-stale-lock`.
- Socket/auth-token lifecycle boundaries for local clients. The first boundary slice exists as a `supervisor-socket-auth-boundary` contract that treats caller-supplied foreground socket tokens as local RPC dispatch gates only.
- Vault reference contract plus vault policy binding contract with metadata-only secret refs, redaction rules, policy-decision citation boundaries, and no raw secret persistence.

Acceptance criteria:

- Lifecycle commands are deterministic, idempotency-aware, and fail closed on workspace mismatch or stale lock ambiguity.
- Vault refs can be cited by policy decisions as reference-and-fingerprint metadata without storing raw secret values in examples, artifacts, Ledger events, run manifests, stdout, or docs, and without granting egress, provider calls, connector grants, or leases.

Current partial status:

- `supervisor status` and `supervisor preflight` remain read-only lifecycle evidence.
- `supervisor start`, `supervisor stop`, and `supervisor recover-stale-lock` are known command surfaces that emit schema-valid `unsupported_fail_closed` reports after read-only status observation.
- Supervisor socket auth boundary evidence now proves missing/wrong token rejection, workspace binding rejection, no token echo or persistence, and no session, lease, tool, vault, or policy authority from the socket token.
- Rust supervisor RPC responses now escape all JSON control characters in traced read content, so workspace files containing tabs or other control bytes cannot break the TypeScript client parse boundary during the TUI/Rust authority path.
- Real daemon start/stop, stale-lock repair, socket-auth lifecycle, vault backend, process sandboxing, signing, secret retrieval, session issuance, and supervisor lease authority remain open.

### PGC-3: Local Ingress Gateway MVP

Deliverables:

- Local ingress request envelope for TUI/API-like inputs: caller identity placeholder, surface id, workspace id, idempotency key, normalized intent hash, auth state, rate-limit state, and policy handoff. The readiness contract and read-only audit command now exist as `local_ingress_readiness_contract` evidence.
- Runtime duplicate/idempotency detector, local rate-limit enforcement, and replay protection before any new action run. TUI `run` now has local atomic rate-limit window-slot, duplicate-key reservation, and same-key same-intent cached replay before supervisor handoff.
- Read-only ingress audit command that proves no real remote surface bypasses Local Supervisor.

Acceptance criteria:

- Duplicate idempotency keys with different normalized intents and over-limit local TUI run windows are detected before new action runs; same-key same-intent completed TUI runs replay cached evidence without live side effects.
- Unauthenticated or unknown local API/browser/IM/mobile inputs can be recorded as observations or queued intents, but cannot authorize tools or side effects.

Current partial status:

- The contract, `ingress audit` surface, and TUI `run` local atomic rate-limit, duplicate-key reservation, and same-intent cached replay are in place. Durable/session/remote idempotency replay, durable/distributed/session/remote rate limiting, auth/session lifecycle, public API listener, browser extension ingress, IM delivery, mobile pairing, connector OAuth ingress, and cloud worker ingress remain open.

### PGC-4: Provider Boundary Productionization

Deliverables:

- Provider capability metadata for OpenAI Responses, OpenAI Chat Completions, Anthropic Messages, and Gemini generateContent.
- Per-provider defaults, timeout/retry/refusal metadata, usage accounting normalization, and stable error taxonomy.
- Explicit credential-source matrix covering API keys, externally supplied bearer tokens, and future vault refs.

Acceptance criteria:

- Live provider calls remain no-tools and hash-only by default.
- OAuth remains documented as future governed credential flow until vault storage, refresh policy, revocation, and connector grants exist.
- Tool/function-call responses still fail closed before response-audit or tool-request proposal evidence is written.

Current partial status:

- Provider capability metadata and credential-source readiness exist for OpenAI Responses, OpenAI Chat Completions, Anthropic Messages, and Gemini `generateContent`.
- Live provider calls use the no-tools/hash-only path, in-memory API keys or externally supplied bearer tokens where supported, timeout/HTTP/malformed-JSON fail-closed handling, usage normalization, tool-call rejection, and `ModelProviderError` stable codes/categories/retryability/HTTP-status metadata.
- Future vault-backed provider credential resolution, browser OAuth flows, token refresh/revocation, connector grants, streaming, multimodal payloads, live CI provider probes, richer refusal taxonomy, and provider-tool execution remain open.

### PGC-5: Proposal-To-Policy Bridge

Deliverables:

- Convert an operator-restated `agent.tool.request.proposed` file-read proposal into a fresh supervisor `tool.requested -> policy.decided -> lease -> tool.result` path.
- Preserve model output as non-authorizing context; the operator restatement is the intent input.

Acceptance criteria:

- Passed response audit plus proposal is necessary but not sufficient for execution.
- Fresh policy and scoped lease are always required; missing proposal evidence, stale response-audit evidence, path drift, or policy denial fails closed.

### PGC-6: Projection Rebuild And Ledger Integrity Expansion

Deliverables:

- Deterministic rebuild/parity for remaining registry families and projections, especially remaining security projections; Store publisher/install records, child-agent budgets/results, and surface records now have read-only previews. Prompt/model and security fixture artifacts need artifact-chain evidence, signing/redaction, and explicit repair coverage rather than registry projection authority.
- Signature/redaction/rebuild design notes before implementing irreversible migration or repair.

Acceptance criteria:

- `audit *` distinguishes missing, stale, mismatched, invalid, and unrebuildable states per registry family.
- Repair remains explicit and operator-approved; audits stay read-only.

Current partial status:

- `store install` already avoids treating the `replay-records` registry projection as authority by resolving replay evidence from hash-chain-verified `replay.recorded` Ledger events and Replay Record artifacts.
- Store install now also rejects package replay-test claims whose declared `replay_record_id`, `run_id`, or `source_events` do not match the local Replay Record evidence.
- `audit store-records` now provides a read-only Ledger-plus-artifact parity preview for `store-publishers` and `capsule-installs`; it reports matched, missing, mismatched, stale, invalid-artifact, and invalid-registry states without mutating registries, executing package code, or trusting Store projections as authority.
- `audit child-records` now provides a read-only Ledger-plus-artifact parity preview for Agent Contracts, Child Results, policy-denial Budget Account snapshots, and Circuit Breakers; it reports matched, missing, mismatched, stale, invalid-artifact, invalid-registry, and unrebuildable states without executing child agents, requesting supervisor authority, mutating registries, or trusting child-agent projections as authority.
- `audit surface-records` now provides a read-only Ledger-plus-artifact parity preview for Browser Observation, IM Inbox, and IM Outbox projections; it reports matched, missing, mismatched, stale, invalid-artifact, and invalid-registry states without opening a browser, delivering messages, requesting supervisor authority, mutating registries, or trusting surface projections as authority.
- `audit prompt-model-artifacts` now provides a read-only artifact evidence-chain preview for runtime binding, model request, model response, response audit, and operator-restated tool-request proposal events; it reports matched, missing-evidence, invalid-artifact, invalid-run-manifest, and authority-violation states without rebuilding registries, calling model providers, reading raw prompt/model output, mutating state, issuing leases, or trusting prompt/model artifacts as authority.
- `audit security-fixtures` now provides a read-only artifact evidence-chain preview for content assessment, poisoning signal, acknowledgement, decoy-only honeypot trial, and detector-only regression fixture events; it reports matched, missing-evidence, invalid-artifact, invalid-run-manifest, and authority-violation states without reading raw content, executing honeypot subjects, lifting quarantine, mutating state, issuing leases, or trusting security artifacts as authority.
- Budget Account success-path registry rows without a current payload-ref artifact source are surfaced as `unrebuildable` in this preview. This is an explicit remaining rebuild gap, not automatic repair.
- Remaining security projection rebuild/parity, event signatures, redaction, explicit repair, and stronger prompt/model plus security artifact signing/redaction/repair remain open. Store, surface, and child-agent projection repair also remain explicit and operator-approved rather than automatic.

### PGC-7: Adapter And Surface Gate Readiness

Deliverables:

- Adapter manifest and policy matrix for browser, IM, MCP, OAuth/SaaS connector, computer-use, local API, and package execution families.
- Per-family gate document: minimum identity, vault, policy, lease, observation, verification, replay, and egress controls before real execution.

Acceptance criteria:

- Browser/IM/mobile/API can be implemented as client surfaces only after ingress gateway evidence exists.
- Real OAuth connector work cannot start until vault refs, token refresh/revocation policy, connector grant lifecycle, and egress policy are testable.
- Real browser/desktop automation cannot start until the supervisor owns a governed adapter action gateway.

### PGC-8: Production Bug And Quality Sweep

Deliverables:

- Open issue/bug inventory, flaky-test budget, security review checklist, dependency audit cadence, release blocker list, and public known-gaps page.
- Regression tests for every production-blocking bug fixed during the sweep.

Acceptance criteria:

- CI, CodeQL, dependency audit, doctor, security audit, release evidence, markdown links, and docs parity checks are green before release-candidate labeling.
- Known gaps are explicit, non-authorizing, and mapped to deferred surfaces or tracked blockers.

## Execution Protocol

- Use no more than two child/subagent lanes in a single implementation round.
- Default lanes: one `executor` for implementation and one `verifier` or `critic` for evidence review when the scope warrants it. Documentation-only rounds can remain solo.
- End each round by re-reading at least Product Brief, Roadmap, Technical Strategy, Schema Runtime Governance, and Runtime Loop Plan for drift against the completed slice.
- Record any drift as one of: no drift, corrected docs, corrected code, deferred with explicit boundary, or blocker.
- Stage only intended files; do not stage local runtime state or unrelated user edits.
- Commit with the Lore protocol and push.

## Verification Steps

For documentation-only planning rounds:

```sh
git diff --check
npm run ether -- onboarding check --workspace .
npm run ether -- doctor --workspace .
npm run ether -- security audit --workspace .
npm run ether -- release evidence --workspace .
```

For implementation rounds:

```sh
npm ci --ignore-scripts
npm audit --audit-level=high --json
npm test
cargo test --locked
cargo clippy --all-targets --all-features --locked -- -D warnings
cargo fmt --check
git diff --check
xargs git ls-files < tools/forbidden-tracked-roots.txt
npm run ether -- onboarding check --workspace .
npm run ether -- doctor --workspace .
npm run ether -- security audit --workspace .
npm run ether -- release evidence --workspace .
```

When release/readiness code changes land, also check remote CI/CodeQL status after push.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Production-parity pressure causes V1 surface creep. | Keep every milestone tied to source docs and mark GUI/mobile/IM/browser/connectors/cloud as post-gate unless the relevant supervisor gateway exists. |
| OAuth support is interpreted as connector account linking. | Keep current provider auth to env/API-key/external bearer token only; require vault refs, refresh/revocation, and connector grants before real OAuth. |
| Model output becomes implicit authority. | Keep response audits and proposals non-authorizing; require operator restatement plus fresh policy and scoped lease. |
| Projections become convenience truth. | Expand read-only rebuild/parity and require immediate Ledger/artifact/path revalidation before live side effects. |
| Documentation grows faster than runtime. | Each milestone must name executable acceptance criteria and negative tests before implementation. |
| Release evidence overclaims production readiness. | Separate local configured evidence, remote observed evidence, signed artifacts, and known gaps in release reports. |

## ADR

Decision: close production gaps in architecture-layer order, starting with evidence, lifecycle, ingress, provider boundary, and proposal-to-policy work before real deferred surfaces.

Drivers:

- Local Supervisor must remain root authority.
- Event Ledger must remain the fact layer.
- Client surfaces and projections must not become authority.
- OpenAI/Anthropic/Gemini provider support must remain no-tools and non-authorizing until the Tool Policy Proxy owns the action bridge.
- Production readiness must be evidenced through tests, CI, release reports, docs, and explicit known gaps.

Alternatives considered:

- Build GUI/browser/IM/mobile/API first. Rejected because it would widen client surfaces before ingress identity, vault, and supervisor action gateways are ready.
- Implement real OAuth connectors immediately. Rejected because the repository lacks a production vault, token refresh/revocation, connector grant lifecycle, and egress policy matrix.
- Let model tool calls directly become tool requests. Rejected because model output cannot authorize actions; operator restatement and fresh policy are required.
- Repair projections automatically during audits. Rejected because audit commands are read-only by design and repair must be explicit.

Consequences:

- The next several rounds will look like infrastructure and evidence hardening rather than flashy surface expansion.
- Provider support can improve, but only inside no-tools/hash-only boundaries until policy bridges are proven.
- Deferred surfaces get clearer gates, making later implementation faster and safer.

Follow-ups:

- Start with PGC-1 unless a current CI/release evidence bug appears first.
- Keep this plan linked from README and round-end review docs.
- Add issue/PR labels or a tracked backlog for PGC milestones once issue management becomes part of the workflow.
