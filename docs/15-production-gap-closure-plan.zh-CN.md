# 生产缺口补全计划

[English](15-production-gap-closure-plan.md)

这份计划把 Aetherion 当前仓库状态转成有顺序的生产缺口补全程序。它只做计划，不扩大 V1 runtime surface，不启用真实 OAuth connector flow，不启动 GUI/mobile/IM/browser delivery，不执行 package code，也不把 projection 当成 authority。

## 原始构想对齐

本计划以这些源文档和当前实现摘要为准：

- [产品简报](00-product-brief.zh-CN.md)：Aetherion 是 local-first Agent Harness Kernel，不是 chatbot，也不是 replacement OS。V1 是 TUI-only；GUI、mobile、IM、browser extension、browser automation、MCP/OAuth/SaaS connector 和 cloud worker 都延后。
- [架构](01-architecture.zh-CN.md)：Local Supervisor 是 root authority，Event Ledger 是 fact layer，Tool Access & Action Policy Proxy 门控 sensitive reads、data egress 和 side effects。
- [用户边界层](02-user-boundary-layer.zh-CN.md)：client surface、connector、skill、generated package 和 remote channel 都不能直接授权敏感动作。
- [审计与数据合同](05-audit-and-data-contracts.zh-CN.md)：human-readable governance state 是 source truth；index、registry 和 projection 都必须是可重建 evidence view。
- [路线图](06-roadmap.zh-CN.md)：Phase 1/2 必须先证明 TUI + Rust supervisor loop，再进入 post-V1 computer、connector、proactive、GUI 或 broader surface。
- [技术策略](10-technical-strategy.zh-CN.md)：TypeScript 负责快速 contract/orchestrator iteration；Rust 负责 authority、policy、vault、ledger、sandbox 和 native execution。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：schema、fixture、projection 和 client surface 都不是 runtime authority；P0/P1 工作必须关闭 executable loops。
- [运行时闭环计划](14-runtime-loop-plan.zh-CN.md)：近期增量已经硬化 no-tools model provider evidence、只读 doctor/security/release evidence、dependency reproducibility、CI platform smoke、onboarding checks 和 supervisor failure diagnostics。

## 需求摘要

- 保持 V1 TUI-first，同时补齐 readiness evidence、lifecycle determinism、policy boundary、onboarding、release posture 和 provider safety。
- 所有 broader surface 在对应 Local Supervisor action gateway 出现前，都只能是 client/control-plane candidate。
- 支持 OpenAI Responses、OpenAI Chat Completions、Anthropic Messages 和 Gemini generateContent 的 no-tools 调用，不持久化 raw prompt、raw response、raw provider payload 或 credential。
- OAuth 作为未来 governed credential 与 connector lifecycle 处理。当前 provider support 可以接受外部提供的 bearer token，但 Aetherion 还不能运行 browser OAuth flow、持久化 refresh token 或发 connector grant。
- 每轮执行结束都要做 source-doc drift review、测试/证据、Lore-protocol commit 和 push。
- 每个实现轮最多使用两个 child/subagent lane。

## 架构缺口矩阵

| 架构层 | 当前仓库证据 | 生产缺口 | 补全方向 |
| --- | --- | --- | --- |
| Client Surfaces | 已有 Ether TUI；GUI/mobile/IM/browser/API 都标为 deferred；README 列出受治理的 post-V1 scaffold。 | 没有产品化 desktop/mobile/browser/IM/API client，也没有 surface identity/pairing lifecycle。 | 保持 V1 只有 TUI 可运行。API/GUI/browser/IM/mobile 必须等 ingress identity 和 supervisor policy gateway 后再实现。 |
| Ingress Gateways | 本地 command invocation 有 workspace identity checks；IM/browser/store observation 是 hash-only 或 queue-only slice。 | 没有给 local API、IM、browser、mobile request 使用的 normalize/authenticate/rate-limit/idempotency gateway。 | 先建 local ingress contract：request envelope、caller identity、idempotency key、replay protection、rate-limit evidence 和 policy handoff。 |
| Local Supervisor | Rust POC 已有 workspace identity、hash-chained ledger append、traced file read/write、scoped lease、status/preflight 和 process-failure hardening。 | 没有 long-running production daemon、vault backend、signing、process sandbox、socket auth lifecycle、start/stop/recover commands 或 stale-lock recovery command。 | 小步推进 lifecycle：显式 start/stop/status/recover contract、auth token boundary、vault metadata ref、signer plan 和 daemon health evidence。 |
| Agent Orchestrator | prompt assembly、runtime binding、model request/response metadata、live no-tools invocation、response audit 和 tool-request proposal 都作为 non-authorizing evidence 实现。 | 没有 full agent loop、planner/verifier runtime、streaming、retry policy、semantic verification、tool-call translation 或 durable queue integration。 | 保持 no-tools provider lane；先把 operator-restated proposal 转成 fresh supervisor policy request，再考虑 model-driven tool loop。 |
| Memory OS | 已有 source-backed Memory Candidate/Card/Tombstone lifecycle、context assembly、tombstone exclusion、conflict projection 和 parity preview。 | 没有 full deterministic rebuild/repair、redaction lifecycle、semantic retrieval、vector/graph index 或 memory quality dashboard。 | 先扩展 parity coverage 与 redaction/rebuild tooling，再做 semantic/vector retrieval。 |
| Capability OS | 已有 document-only Capsule lifecycle、passing traces proposal、local trust-publisher store install、sandbox/replay evidence checks 和 rollback。 | 没有 remote marketplace、transparency log、revocation feed、package-code execution sandbox、route scoring 或 permission-diff UX。 | 先补 local integrity/revocation evidence；package code 继续 quarantine，直到有 supervisor-governed execution sandbox。 |
| Proactive Engine | 已有 sleep/wake、wakeup eligibility preview、hibernation parity 和 queue-only wake events。 | 没有 background scheduler、Opportunity Lifecycle UI、attention-budget policy daemon、notification ladder 或 automatic resume executor。 | 只做 shadow-mode opportunity records 和 queue projection；没有显式 policy 前不通知、不动作。 |
| Tool Access & Action Policy Proxy | 已有 local file read/write、IM outbox policy、taint denial、child read、sandbox promotion 和 action lifecycle guards。 | policy 仍窄且 deterministic；没有 generalized adapter policy DSL、vault-backed secrets、egress policy matrix 或 connector grants。 | 通过 typed target families 和 negative tests 扩展 policy；真实 OAuth/connector 前必须有 vault refs。 |
| Connector + Execution Adapters | 已有 computer-use 与 connector SDK scaffold；provider adapter 支持 no-tools OpenAI/Anthropic/Gemini；store package 仍是 declaration。 | 没有真实 OAuth connector runtime、browser automation、desktop execution adapter、IM delivery、MCP adapter、cloud worker 或 package execution。 | 先做 adapter manifest 和 local dry-run evidence。真实 connector/execution 必须依赖 ingress identity、vault refs、policy gates 和 lease-bound action records。 |
| Observations / Results / Artifacts | 已有大量 hash-only artifact 与 payload-ref audit；release/security/doctor evidence 只读。 | artifact integrity 仍是 local-only；没有 release artifact signing、remote CI attestation reader、docs deployment evidence 或 artifact retention policy。 | 增加 release manifest、artifact hash/signing plan、remote CI evidence reader 和 docs deployment readiness，但不自动发布。 |
| Event Ledger + Projections | 已有 hash-chained JSONL、run manifest、replay record、registry audit、payload-ref audit 和 scoped parity preview。 | 没有 event signature、branch-specific append stream、complete projection rebuild parity、redaction/rebuild tooling 或 projection repair command。 | 完成 deterministic rebuild coverage，增加 signature/redaction plan，repair 必须显式且 operator-approved。 |

## 有序补全里程碑

### PGC-0：计划基线与偏差 Ledger

交付物：

- 将本计划及中文伴读版作为生产缺口补全索引。
- 每轮结束把 source-doc drift review 写入[阶段实现复核](12-phase-implementation-review.zh-CN.md)或[运行时闭环计划](14-runtime-loop-plan.zh-CN.md)。
- 继续使用 Lore protocol commit，并每轮 push。

验收：

- README 英文/中文都链接本计划。
- 每轮汇报 source-doc alignment、已修正偏差、verification、commit hash 和 push status。

### PGC-1：Release 与 Readiness Evidence 硬化

交付物：

- 远端 CI evidence reader/report，只读汇总最新 CI 和 CodeQL 状态。
- Release manifest schema，覆盖 source revision、dependency lockfiles、test gates、artifact hashes、governance docs、bilingual docs 和 known gaps。
- Docs deployment readiness check，只验证链接/build inputs，不自动部署。

验收：

- `doctor`、`security audit` 和 `release evidence` 能区分 local configured evidence 与 remote observed evidence。
- release candidate 会因 stale CI、dirty tree、missing lockfile evidence、missing bilingual doc link、missing license/governance file 或 missing known-gap declaration 被拒绝。

### PGC-2：Supervisor Lifecycle 与 Vault Reference MVP

交付物：

- `supervisor start/status/stop/recover-stale-lock` 的 typed lifecycle contract。
- local client 的 socket/auth-token lifecycle boundary。
- metadata-only secret ref、redaction rules 和 no raw secret persistence 的 vault reference contract。

验收：

- lifecycle command deterministic、idempotency-aware，并在 workspace mismatch 或 stale lock ambiguity 时 fail closed。
- vault ref 可以被 policy decision 引用，但 raw secret value 不进入 example、artifact、Ledger、run manifest 或 docs。

### PGC-3：Local Ingress Gateway MVP

交付物：

- 面向 TUI/API-like input 的 local ingress request envelope：caller identity placeholder、surface id、workspace id、idempotency key、normalized intent hash、auth state、rate-limit state 和 policy handoff。
- 只读 ingress audit command，证明没有 real remote surface 绕过 Local Supervisor。

验收：

- duplicate idempotency key 在创建新 action run 前被发现。
- unauthenticated/unknown local API/browser/IM/mobile input 可以被记录成 observation 或 queued intent，但不能授权 tool 或 side effect。

### PGC-4：Provider Boundary 生产化

交付物：

- OpenAI Responses、OpenAI Chat Completions、Anthropic Messages 和 Gemini generateContent 的 provider capability metadata。
- per-provider defaults、timeout/retry/refusal metadata、usage accounting normalization 和 stable error taxonomy。
- credential-source matrix：API key、外部提供 bearer token、未来 vault refs。

验收：

- live provider call 默认仍是 no-tools 和 hash-only。
- OAuth 在 vault storage、refresh policy、revocation 和 connector grants 可测试前，只能作为未来 governed credential flow 文档化。
- tool/function-call response 继续在写 response-audit 或 tool-request proposal evidence 前 fail closed。

### PGC-5：Proposal-To-Policy Bridge

交付物：

- 将 operator-restated 的 `agent.tool.request.proposed` file-read proposal 转成 fresh supervisor `tool.requested -> policy.decided -> lease -> tool.result` path。
- model output 仍只是 non-authorizing context；operator restatement 才是 intent input。

验收：

- passed response audit + proposal 是必要但不充分条件。
- fresh policy 与 scoped lease 永远必需；缺 proposal evidence、stale response-audit evidence、path drift 或 policy denial 都 fail closed。

### PGC-6：Projection Rebuild 与 Ledger Integrity 扩展

交付物：

- 给剩余 registry family 做 deterministic rebuild/parity，尤其是 Store publisher/install records、child-agent budgets/results、security fixtures、surface records 和 prompt/model artifacts。
- 在不可逆 migration 或 repair 前先写 signature/redaction/rebuild design notes。

验收：

- `audit *` 能按 registry family 区分 missing、stale、mismatched、invalid 和 unrebuildable。
- repair 必须显式且 operator-approved；audit 保持 read-only。

### PGC-7：Adapter 与 Surface Gate Readiness

交付物：

- browser、IM、MCP、OAuth/SaaS connector、computer-use、local API 和 package execution family 的 adapter manifest 与 policy matrix。
- 每个 family 的 gate document：真实执行前至少需要哪些 identity、vault、policy、lease、observation、verification、replay 和 egress controls。

验收：

- Browser/IM/mobile/API 只能在 ingress gateway evidence 出现后作为 client surface 实现。
- 真实 OAuth connector work 不能早于 vault refs、token refresh/revocation policy、connector grant lifecycle 和 egress policy 可测试。
- 真实 browser/desktop automation 不能早于 supervisor 拥有 governed adapter action gateway。

### PGC-8：Production Bug 与 Quality Sweep

交付物：

- open issue/bug inventory、flaky-test budget、security review checklist、dependency audit cadence、release blocker list 和 public known-gaps page。
- 每个 production-blocking bug 都配 regression test。

验收：

- release-candidate label 前，CI、CodeQL、dependency audit、doctor、security audit、release evidence、markdown links 和 docs parity checks 都 green。
- known gaps 必须显式、non-authorizing，并映射到 deferred surface 或 tracked blocker。

## 执行协议

- 每个实现轮最多两个 child/subagent lane。
- 默认 lane：一个 `executor` 做实现，一个 `verifier` 或 `critic` 做证据复核；纯文档轮可以 solo。
- 每轮结束至少重读 Product Brief、Roadmap、Technical Strategy、Schema Runtime Governance 和 Runtime Loop Plan，对照刚完成的 slice 是否漂移。
- 每个偏差记录为：no drift、corrected docs、corrected code、deferred with explicit boundary 或 blocker。
- 只 stage 目标文件；不 stage local runtime state 或无关用户改动。
- 按 Lore protocol commit 并 push。

## 验证步骤

文档/计划轮：

```sh
git diff --check
npm run ether -- onboarding check --workspace .
npm run ether -- doctor --workspace .
npm run ether -- security audit --workspace .
npm run ether -- release evidence --workspace .
```

实现轮：

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

release/readiness 代码变化落地后，push 之后还要看远端 CI/CodeQL 状态。

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 生产级对齐压力导致 V1 surface creep。 | 每个 milestone 都绑定源文档；GUI/mobile/IM/browser/connectors/cloud 在对应 supervisor gateway 出现前保持 post-gate。 |
| “OAuth 支持”被误解为 connector account linking。 | 当前 provider auth 只限 env/API-key/external bearer token；真实 OAuth 需要 vault refs、refresh/revocation 和 connector grants。 |
| model output 变成隐式 authority。 | response audit 与 proposal 保持 non-authorizing；必须 operator restatement + fresh policy + scoped lease。 |
| projection 被当成方便的 truth。 | 扩展 read-only rebuild/parity；live side effect 前必须立即重验 Ledger/artifact/path。 |
| 文档比 runtime 跑得快。 | 每个 milestone 先写 executable acceptance criteria 和 negative tests。 |
| release evidence 过度宣称 production readiness。 | 在 release report 中分开 local configured evidence、remote observed evidence、signed artifacts 和 known gaps。 |

## ADR

决策：按架构层顺序关闭生产缺口，先做 evidence、lifecycle、ingress、provider boundary 和 proposal-to-policy，再做真实 deferred surface。

驱动因素：

- Local Supervisor 必须继续是 root authority。
- Event Ledger 必须继续是 fact layer。
- Client surface 和 projection 不能成为 authority。
- OpenAI/Anthropic/Gemini provider support 必须保持 no-tools 与 non-authorizing，直到 Tool Policy Proxy 拥有 action bridge。
- 生产 readiness 必须由 tests、CI、release reports、docs 和 explicit known gaps 证明。

已考虑但拒绝的替代方案：

- 先做 GUI/browser/IM/mobile/API。拒绝原因：会在 ingress identity、vault 和 supervisor action gateway 前扩大 client surface。
- 立即实现真实 OAuth connector。拒绝原因：仓库还没有 production vault、token refresh/revocation、connector grant lifecycle 和 egress policy matrix。
- 让 model tool call 直接变成 tool request。拒绝原因：model output 不能授权动作；必须 operator restatement 和 fresh policy。
- audit 自动 repair projection。拒绝原因：audit command 设计为 read-only，repair 必须显式。

后果：

- 接下来几轮会更像 infrastructure/evidence hardening，而不是表面功能扩张。
- provider support 可以继续变强，但必须留在 no-tools/hash-only 边界内，直到 policy bridge 被证明。
- deferred surface 会获得更清晰 gate，后续实现会更快、更安全。

后续：

- 除非当前出现 CI/release evidence bug，否则从 PGC-1 开始。
- README 和 round-end review docs 持续链接本计划。
- 当 issue management 纳入 workflow 后，为 PGC milestone 增加 label 或 tracked backlog。
