# 运行时闭环计划

[English](14-runtime-loop-plan.md)

这是把 Aetherion 从 contract-backed slices 推向更强本地 runtime 的工作计划，同时避免漂移到延后的产品表面。

## Source Alignment

- `docs/06-roadmap.md` 保持 V1 TUI-first，并要求 Local Supervisor、Event Ledger、policy、scoped lease、本地文件 action、observation、verification 和 replay loop 先于 GUI、IM、browser、MCP/OAuth 或 cloud worker。
- `docs/10-technical-strategy.md` 把 authority、policy、vault、ledger 和 native execution 交给 Rust，同时把 Agent Orchestrator 原型保留在 TypeScript。
- `docs/13-schema-runtime-governance.md` 要求新工作关闭 runtime loops，而不是扩大 schema surface；runtime/projection evidence 不能因方便而变成 authority。

## Loop

运行时闭环的方向是：从 workspace identity、ledger、policy、lease、action、observation、verification、replay，逐步扩展到 memory、capability、model evidence 和 proposal path。每个 increment 都必须说明 acceptance、remaining boundary 和 next likely increment。

## 已完成增量摘要

### Production Gap Closure Plan

新增 [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md) / [Production Gap Closure Plan](15-production-gap-closure-plan.md)，把当前 OpenClaw-level 生产完整度目标拆成 architecture-layered milestones。

本轮性质是计划，不是 runtime 扩面：没有新增 GUI、mobile、IM、browser automation、真实 OAuth connector、MCP connector、package-code execution 或 cloud worker。计划明确继续保留 Local Supervisor、Event Ledger 和 Tool Access & Action Policy Proxy 的 authority/fact/action 边界，并规定后续每轮最多两个 child/subagent lane、每轮结束 source-doc drift review、verification、Lore commit 和 push。

### Runtime Lock Liveness

加固 runtime lock 生命周期，防止 stale lock 或并发写破坏 workspace state。

### Supervisor Lifecycle Preflight

在 supervisor lifecycle 前进行 workspace/status/preflight 检查，避免错误身份或 runtime state 进入 action path。

### Wakeup Eligibility Preview

让 wakeup 只预览 eligibility，不保留 authority，不直接执行。

### Resume Context Tombstone Parity

hibernation resume context 必须尊重 Memory tombstone 和 deletion exclusion。

### Child Breaker Lifecycle

child pre/post supervisor breaker lifecycle 让子 agent 预算、policy denial 和 failure 能被隔离与记录。

### Capsule Proposal From Passing Traces

从重复 passing trace 生成 capsule proposal，但不发布 active capability。

### Agent Runtime Invocation Artifact

写入 runtime invocation metadata artifact，保存 ids、hashes、refs、gates 和 stage metadata，不持久化 raw prompt text。

### Agent Runtime Binding Event

`agent.runtime.bound` 是治理 evidence，不是 model call、tool request、policy、lease 或 verification。

### Agent Model Request/Response Artifacts

定义 hash-only model request/response metadata artifact，为 provider 调用和 response audit 建证据链。

### Agent Model Request Preparation

`prompt prepare-model-request` 从已绑定 runtime invocation 派生 no-tools request metadata，不调用 provider。

### First Real Model Invocation

`prompt invoke-model` 首次调用 model provider，并写 hash-only response evidence；默认 provider 是 deterministic stub。

### Persisted Response Audit Evidence

response audit 从 stdout-only 变成独立 non-authorizing artifact 和 event，但 audit pass 仍不是 verification 或 policy approval。

### Response Audit Evidence Chain Audit

`audit response-audits` 可检查 runtime binding、model request、model response 和 response-audit artifact 是否匹配，且只读不授权。

### Proposal-Only Tool Request Bridge

`prompt propose-tool-request` 可从 passed/matched response audit 记录 operator-restated workspace file read proposal。它只发 `agent.tool.request.proposed`，不发 `tool.requested`，不执行 policy/lease/read。

### Multi-Provider No-Tools Model Boundary

`prompt invoke-model` provider 边界扩展为 `openai_responses`、`openai_chat_completions`、`anthropic` 和 `gemini`。所有 provider 都保持 no-tools、hash-only、credential-in-memory、non-authorizing。OpenAI/Gemini 仅接受外部获取 bearer token；Aetherion 不运行 OAuth flow。Anthropic 直连 API 使用 API key。

## 当前剩余边界

- 没有真实 OAuth authorization flow、vault backend、connector grant 或 provider account linking UX。
- 没有 provider tools、streaming、多模态 payload、raw provider payload persistence。
- 没有把 provider tool call 翻译成 Aetherion `tool.requested`。
- 没有让 model output、response audit 或 proposal 授权动作。

## 下一步候选

- 增加 provider capability metadata 和 per-deployment model defaults。
- 或把 review 后的 tool-request proposal 转成 fresh supervisor policy request，通过现有 file-read lifecycle 产生真实 `tool.requested -> policy -> lease -> result` 证据。

## 已完成增量：仓库 CI 质量门禁

目标：补上本地验证与仓库级自动验证之间的生产化缺口。

为什么做这一片：

- 严格对照 OpenClaw 后可以看到，生产级完整度不只是 runtime 能力；OpenClaw 在公开仓库和 docs 中展示 CI/release、guided onboarding、update/security docs 和 multi-platform workflow。
- Aetherion 已有本地测试和 Rust 检查，但 push/PR 之前没有自动门禁。
- CI 可以提高生产纪律，同时不扩大 V1 runtime scope，也不启用延后产品 surface。

验收：

- push 到 `main` 和 pull request 会运行 TypeScript contract/TUI tests、Rust supervisor tests、Rust clippy、Rust fmt、diff whitespace checks，以及 tracked runtime/build artifact guard。
- README 和贡献文档提示贡献者运行同一组本地检查。
- workflow 只读仓库，不解析 secret、不调用 model provider、不执行外部 connector、不写 runtime state。
- supervisor process failure 在 CI 中可诊断，但不会打印 raw stdout payload。

与原始文档对照：

- `docs/00-product-brief.md`：强化本地可审计 runtime 的开发闭环，不添加 GUI/IM/browser/connector/cloud surface。
- `docs/01-architecture.md`：CI 是验证基础设施，不是 runtime authority boundary。
- `docs/06-roadmap.md`：先强化 Phase 1/2 kernel loop 质量，再扩展后续 surface。
- `docs/10-technical-strategy.md`：同时运行 TypeScript 与 Rust gate，保留语言职责划分。
- `docs/13-schema-runtime-governance.md`：自动执行现有 contract/runtime tests，而不是扩张 schema。

剩余边界：

- 这只是第一道 CI gate，不是 OpenClaw 级别 release infrastructure。install/onboarding automation、daemon lifecycle、packaging/release artifacts、security audit CLI、dependency-lock policy、platform matrices 和 public docs deployment 仍是后续生产化差距。
- supervisor 进程失败诊断只暴露进程元数据，不能扩展成 raw stdout/file content logging。

## 已完成增量：Store 信任锚与 Provider 失败边界

目标：修复严格复查中最高风险的两个生产缺口：Store Package 自带 key 的 self-authentication，以及 live provider 调用无 timeout/错误边界。

为什么做这一片：

- Capsule Store 如果允许 package 自带 signing key 并声明任意 publisher id，就无法达到生产级信任边界。
- replay/sandbox 只有解析到本地 record/artifact 才是 runtime evidence；package 内自报 boolean 不够。
- live provider 调用不能无限挂住 CLI，也不能把 malformed upstream response 变成原始 parser/network 噪声。

验收：

- `store trust-publisher` 在安装前记录本地 operator 登记的 publisher key fingerprint。
- `store install` 拒绝 unknown publisher、signing-key substitution、missing Replay Record、live-side-effect replay evidence、sandbox path/hash mismatch 和 Capsule integrity mismatch。
- Capsule Install artifact 记录 `publisher_key_fingerprint`、`replay_record_ids` 和 `sandbox_content_sha256`。
- provider 调用支持 `AETHERION_MODEL_TIMEOUT_MS`，timeout 时 abort，HTTP error 不泄漏 response body，malformed JSON 变成 provider-scoped error。

与原始文档对照：

- `docs/00-product-brief.md`：Capability Capsule 仍是 governed unit，不能自授信任或权限。
- `docs/01-architecture.md`：Store 和 provider surface 仍是 client/orchestrator path，不是 trust root。
- `docs/04-skill-and-scaffold-os.md`：import/generated package 在 evidence gates 前仍隔离。
- `docs/09-computer-use-implementation.md`：package 和 external content 仍是 tainted input，不是 authorization。
- `docs/11-migration-and-runtime-economics.md`：Capsule Store 仍是低信任、受治理机制，不是 plugin free-for-all。
- `docs/13-schema-runtime-governance.md`：fixture 和 projection 不是 runtime evidence。

剩余边界：

- Store trust 仍是 local-only。没有 public marketplace、publisher identity network、transparency log、revocation feed、release evidence repository 或 package-code execution。
- provider hardening 仍是 no-tools/hash-only；没有 OAuth flow、token refresh、vault storage、streaming、多模态 payload 或 provider tool execution。

## 已完成增量：只读 Doctor 与 Ledger-backed Evidence Gates

目标：把当前 repo/workspace readiness 收束成单一只读 operator report，并清掉 audit 与 Store install 路径上残留的 projection-as-authority 偏差。

为什么做这一片：

- 严格 OpenClaw 对照指出 operator readiness 与 security-audit parity 是生产外壳差距，而 Aetherion 较深的 kernel evidence 已经分散存在于多个窄命令中。
- 严格 code/security 复查发现 audit commands 可能在 Ledger 被篡改后仍输出 reassuring provenance；Store install 也仍可能把 `replay-records` projection row 当 replay evidence。
- 修复这些点能提升生产纪律，同时不启用 GUI、IM delivery、browser automation、MCP/OAuth connector、daemon lifecycle management、remote marketplace、package-code execution 或 cloud worker。

验收：

- `ether doctor --workspace <path>` 输出 deterministic JSON report，包含 `ready`、`degraded` 或 `blocked` 状态和 per-check details。
- `doctor` 检查 repo governance files、双语 docs links、CI/script/artifact-guard expectations、schema/example baselines、workspace identity、Ledger hash-chain validity 和 run-manifest presence。
- `doctor` 保持只读：不追加 Ledger、不修改 registry、不写 artifact、不调用 provider、不发 lease、不 repair state，也不为未启动 workspace 初始化 `.aetherion`。
- 每个 `audit *` topic 在 provenance/parity work 前先验证 Event Ledger hash chain，并在篡改时 fail closed。
- `store install` 从 hash-chain-verified 的 `replay.recorded` Ledger events 和 Replay Record artifacts 解析 replay evidence，而不是从 `replay-records` registry projection 取证。

与原始文档对照和修正：

- `docs/00-product-brief.md`：重要动作仍通过 source evidence、decisions、approvals 和 replay artifacts 可重建。
- `docs/01-architecture.md`：Event Ledger 仍是 fact layer；Store 和 projection 不是 trust root。
- `docs/05-audit-and-data-contracts.md`：human-readable Ledger evidence 是 source truth；registry 是 rebuildable projection。
- `docs/06-roadmap.md`：先强化 TUI/Rust loop 的生产纪律，再扩展 broader surfaces。
- `docs/10-technical-strategy.md`：TypeScript 关闭 contract/TUI gap，不把 authority 从 Rust 移出。
- `docs/13-schema-runtime-governance.md`：在 runtime command boundary 执行 “projection 不是 source truth”。

剩余边界：

- `doctor` 是 readiness report，不是 repair tool、daemon lifecycle manager、release packager、security scanner 或 installer。
- 下一增量后，`security audit`、更完整的 CI artifact leakage guard 和默认 hash/metadata-only model stdout 不再是开放差距。install/onboarding automation、release packaging、platform matrix、dependency reproducibility policy 和更深入的 release evidence 仍是后续生产差距。

下一步候选：

- 增加 `ether security audit`，作为只读 findings report 检查 secret leakage、tracked runtime artifacts、authority contamination、package execution boundaries 和 live-surface violations。

## 已完成增量：只读 Security Audit 与 Hash-Only Model Stdout

目标：让 TUI 能只读检查 security posture，同时不启用延后产品表面；并移除 `prompt invoke-model` 默认 raw model stdout 泄漏。

验收：

- `ether security audit --workspace <path>` 输出 deterministic read-only report，包含 `pass`/`warn`/`fail`、scoped checks 和 findings。
- audit 检查 tracked 高置信 secret material、`tools/forbidden-tracked-roots.txt` 中 runtime/build roots 是否被 tracking、现有 runtime artifact raw sensitive fields、workspace Ledger hash chain、CI guard wiring 和 model stdout default。
- audit 保持只读：不初始化 workspace、不追加 Ledger、不修改 registry、不写 artifact、不调用 provider、不发 lease、不 repair state、不 quarantine Capsule、不执行 package、不做 live probe。
- `prompt invoke-model` 默认 stdout 只输出 hash/metadata；raw model output 只有显式 `--print-output` 才回显，并且仍不授权、不持久化。
- CI 与 `security audit` 使用同一 forbidden-root denylist，覆盖 `.aetherion`、build/test/report roots、`.omx`/`.omc`，以及 `vault`、`memory-vault`、`local-data` 等 sensitive local roots。

与原始文档对照和修正：

- `docs/00-product-brief.md`：强化可审计安全证据，不把 Aetherion 改成 chatbot 或 replacement OS。
- `docs/01-architecture.md`：Local Supervisor 与 Event Ledger 仍是 root/fact layer；audit 是 inspection，不是 authority。
- `docs/05-audit-and-data-contracts.md`：强化 human-readable policy 和 Ledger evidence，同时保持 generated/runtime state 不进入 git。
- `docs/06-roadmap.md`：先硬化 TUI-first V1 loop，再扩展 GUI、IM、browser automation、MCP/OAuth connector 或 cloud worker。
- `docs/13-schema-runtime-governance.md`：关闭 runtime/security evidence gap，不扩大 schema 或 provider authority。

剩余边界：

- `security audit` 不是 repair command、dependency scanner、release signer、package sandbox、live connector probe、OAuth flow 或 secret vault。
- 剩余生产差距包括 install/onboarding automation、release packaging、platform matrix、dependency/reproducibility policy、public docs deployment 和更深入的 dependency audit evidence。

## 已完成增量：Dependency Reproducibility 与 Audit Evidence

目标：把剩余 dependency/reproducibility gap 收束为已提交 lockfile evidence、CI gate 和 operator readiness gate，同时不新增 runtime dependency，也不扩大 V1 authority。

验收：

- 根目录提交 `package-lock.json`，因此即使根 JavaScript surface 当前没有 npm dependency，`npm ci --ignore-scripts` 与 `npm audit --audit-level=high --json` 也能从 repo state 可复现执行。
- Rust verification 使用已提交 `Cargo.lock`：CI 和 docs 运行 `cargo test --locked` 与 `cargo clippy --all-targets --all-features --locked -- -D warnings`。
- CI 用 `--locked` 安装 pinned `cargo-audit`，运行 `cargo audit`，并运行 `doctor` 与 `security audit` 作为 operator readiness snapshots。
- `doctor` 报告 dependency lockfile state，并要求 CI dependency/readiness gates。
- `security audit` 在 lockfile 或 gate 漂移时报告 dependency reproducibility 与 CI dependency/readiness guard findings。

与原始文档对照和修正：

- [产品简报](00-product-brief.zh-CN.md)：重要行为继续通过 repo evidence 可审计，而不是依赖本地 shell 记忆。
- [审计与数据合同](05-audit-and-data-contracts.zh-CN.md)：release evidence 通过已提交 lockfiles 和可 review workflow config 变得可复现。
- [路线图](06-roadmap.zh-CN.md)：先在 TUI-first V1 path 内强化生产纪律，再扩展 platform matrix 或 packaging。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：dependency audit evidence 是 repo/operator check，不是 runtime authority。

剩余边界：

- 本轮不是 release packaging、artifact signing、update infrastructure、platform matrix execution、public docs deployment 或 dependency auto-remediation。
- 被 ignore 的 `promo/` 子树仍是 local/generated promotional experiment，不属于 release evidence。
- 剩余生产差距包括 install/onboarding automation、release packaging、platform matrix、public docs deployment 和更深入的 release artifact evidence。

## 已完成增量：CI Platform Smoke 与 Action Runtime Evidence

目标：清除剩余 GitHub Actions Node.js 20 action-runtime warning，并把部分 platform/release-evidence gap 收束成已检查的 Ubuntu/macOS smoke lane，同时不新增 release packaging，也不扩大 runtime authority。

验收：

- CI 使用 `actions/checkout@v5` 和 `actions/setup-node@v5`，并保留 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` 作为显式 Node 24 action-runtime baseline。
- CI 包含覆盖 `ubuntu-latest` 与 `macos-latest` 的 `platform-smoke` matrix。
- smoke lane 运行 lockfile install、聚焦的 contract/provider/TUI-help Node test subset、locked Rust supervisor tests、`doctor` 和 `security audit`。
- `doctor` 与 `security audit` 会在 workflow 漂离 action-runtime 或 platform-smoke evidence 时 fail/warn。

与原始文档对照和修正：

- [产品简报](00-product-brief.zh-CN.md)：readiness evidence 由已提交 CI config 提供，可 review、可重放。
- [路线图](06-roadmap.zh-CN.md)：先在 TUI-first 范围内强化 platform discipline，再扩展 release packaging 或 app surface。
- [审计与数据合同](05-audit-and-data-contracts.zh-CN.md)：workflow configuration 继续作为 release evidence 的 human-readable contract。
- [阶段实现复核](12-phase-implementation-review.zh-CN.md)：本轮跟进 OpenClaw 对照指出的剩余 platform/release gap。

剩余边界：

- 这是 smoke matrix，不是完整 release matrix、package build、installer、updater 或 artifact-signing pipeline。
- 真实 OAuth、MCP connector、browser automation、IM delivery、GUI app、package-code execution、cloud worker 和 public docs deployment 仍然延后。
- 剩余生产差距包括 install/onboarding automation、release packaging、更深入的 release artifact evidence、public docs deployment 和更广的 platform/release matrix coverage。

## 已完成增量：Provider Tool-Call Refusal

目标：当 live provider 返回 tool/function-call response shape 时，让 multi-provider `prompt invoke-model` path 强制执行 no-tools 语义，同时不新增 provider tool execution 或 OAuth connector runtime。

验收：

- OpenAI Responses call-type output 在 response evidence 持久化前失败。
- OpenAI Chat Completions `tool_calls` output 在 response evidence 持久化前失败。
- Anthropic `tool_use` output 在 response evidence 持久化前失败。
- Gemini `functionCall` 和 executable-code parts 在 response evidence 持久化前失败。
- provider failure 仍是本地 error；不会合成 `tool.requested`、policy decision、lease、action、observation 或 verification event。

与原始文档对照和修正：

- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：no-tools mode 现在在 provider boundary 强制执行，而不只是记录 response metadata。
- [路线图](06-roadmap.zh-CN.md)：model provider portability 仍在 TUI-first evidence loop 内，OAuth/MCP/SaaS connector 继续延后。
- [用户边界层](02-user-boundary-layer.zh-CN.md)：provider output 是 untrusted data，不能不经过 policy 进入 action authority。
- [阶段实现复核](12-phase-implementation-review.zh-CN.md)：本轮跟进严格 security review 指出的 provider tool-call output 必须 fail closed。

剩余边界：

- 本轮不是 provider tool execution、tool-call proposal parser、streaming support、多模态 support、browser OAuth、token refresh、vault storage、connector grant 或 live-provider CI probing。
- OpenAI support 仍是 OpenAI Responses 和 OpenAI Chat Completions；未实现 legacy `/v1/completions`。
- OAuth 仍仅限 provider 支持路径上的外部 bearer-token env var。

## 已完成增量：Release Evidence Snapshot

目标：把已有 `doctor`、`security audit`、CI、dependency lock、platform-smoke 和 governance evidence 收束成一个只读本地 release-evidence 报告，同时不新增 release packaging、签名、发布、public docs deployment 或远端 CI 查询。

验收：

- `release evidence --workspace <path>` 输出单个 JSON 报告，包含 git head/dirty state、已配置 CI gate 状态、Node 24 action-runtime evidence、Ubuntu/macOS platform-smoke configuration、dependency lockfile evidence、governance file checks、双语文档 checks、`doctor` 摘要、`security audit` 摘要、workspace runtime/Ledger 状态、source-document links 和剩余 release gaps。
- 命令严格只读：不初始化 `.aetherion`、不追加 Ledger event、不修改 registry、不写 artifact、不调用 provider、不发 lease、不 repair state、不打包、不签名、不发布 release、不部署 docs，也不查询 GitHub/remote CI。
- CI 将该报告与 `doctor`、`security audit` 一起运行；如果 workflow 不再运行 configured release-evidence snapshot，`doctor`、`security audit` 和 `release evidence` 都会暴露漂移。
- 空 workspace 与已初始化 workspace tests 证明该命令不会创建 runtime state，也不会修改 Ledger/run evidence。

与原始文档对照和修正：

- [产品简报](00-product-brief.zh-CN.md)：release posture 继续建立在 durable、可 review evidence 上，而不是 operator 的本地记忆。
- [审计与数据合同](05-audit-and-data-contracts.zh-CN.md)：报告把 human-readable governance docs 与已提交 workflow/lockfile state 作为 evidence，同时保持 indexes 与 runtime projections 可重建。
- [路线图](06-roadmap.zh-CN.md)：先强化 V1 TUI/Rust kernel loop，再进入 GUI、IM、browser automation、MCP/OAuth connector、cloud worker 或更广 release packaging。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：报告只是 evidence aggregation，不授予 runtime authority，也不新增 trust root。
- [阶段实现复核](12-phase-implementation-review.zh-CN.md)：本轮只把此前记录的 “deeper release artifact evidence” gap 关闭到 local/configured source snapshot 这一层。

剩余边界：

- 这是 local/configured source snapshot，不是 executed remote CI proof、release packaging、artifact signing、installer/updater infrastructure、public docs deployment、package registry publication 或 release evidence repository。
- dirty worktree 会报告为 `draft`；它不阻止本地检查，因为可能存在 unrelated operator files，但它不是 clean release claim。
- 剩余生产差距包括 install/onboarding automation、release packaging、artifact signing、public docs deployment、更广 platform/release matrix artifacts，以及 remote/executed release evidence。

## 已完成增量：From-Source Onboarding Preflight

目标：用只读 preflight 缩小 guided-onboarding gap，让 fresh clone 能判断本机 toolchain、repo evidence 和 workspace runtime state 是否足以开始 from-source 工作，同时不新增 installer、updater、daemon manager 或 release packaging。

验收：

- `onboarding check --workspace <path>` 输出单个 JSON 报告，分出 `toolchain_ready`、`repo_ready`、`workspace_runtime_state` 和 `next_steps_ready` 四层。
- fresh clone 没有 `.aetherion` runtime state 时被解释为可引导的 `not_initialized` workspace，而不是损坏 workspace。
- 命令检查 Node、npm、git、rustc、cargo、可选 cargo-audit、repo scripts、lockfiles、CI gates、governance docs、双语文档、onboarding doc links，以及已存在 workspace 的 Ledger state。
- 命令严格只读：不安装 dependency、不运行整套 verification suite、不初始化 `.aetherion`、不启动或停止 daemon、不 repair state、不写 artifact、不追加 Ledger event、不调用 provider、不发 lease、不查询远端 CI，也不启用延后产品表面。
- CI 将该 preflight 与已有 operator snapshots 一起运行，避免 docs 与 workflow 分叉。

与原始文档对照和修正：

- [产品简报](00-product-brief.zh-CN.md)：onboarding 仍是 local-first、evidence-oriented，而不是 cloud account 或 connector bootstrap。
- [路线图](06-roadmap.zh-CN.md)：先强化 V1 TUI path，再进入 GUI、IM、browser、MCP/OAuth、cloud、installer 或 release-packaging。
- [技术策略](10-technical-strategy.zh-CN.md)：TypeScript 仍是 contract/TUI iteration surface；Rust 仍是 supervisor boundary。
- [阶段实现复核](12-phase-implementation-review.zh-CN.md)：本轮只把记录中的 install/onboarding gap 缩小到 from-source preflight 层。

剩余边界：

- 这不是 installer、updater、package manager、daemon lifecycle manager、public docs deployment、release package、artifact signer、provider-auth wizard 或 connector account-linking flow。
- 它报告缺失工具和下一步命令，但不安装或修复它们。
- 剩余生产差距包括 installer/updater automation、release packaging、artifact signing、public docs deployment、更广 platform/release matrix artifacts，以及 remote/executed release evidence。

## 已完成增量：Source Document Governance Links

目标：把原始源文档连到仓库治理与协作合同，让 maintainer 能从产品意图直接跳到贡献、行为准则、安全、许可、issue 和 PR 工作流要求，而不是依赖记忆。

验收：

- 根 README 和 README.zh-CN 暴露 Code of Conduct、Contributing、Security Policy、MIT License、issue templates 和 pull request template 链接。
- 产品简报、审计与数据合同、路线图、技术策略、Schema 运行时治理在英文与中文源文档中都链接同一组治理表面和 README 命令/readiness 入口。
- 链接是 repo-relative Markdown references，不引入 runtime behavior。

与原始文档对照和修正：

- [产品简报](00-product-brief.zh-CN.md)：仓库协作仍是治理表面，不是新的产品 client surface。
- [审计与数据合同](05-audit-and-data-contracts.zh-CN.md)：贡献、安全、许可、模板文件是 human-readable workflow evidence，不是 runtime state 或 authority。
- [路线图](06-roadmap.zh-CN.md)：foundation docs 现在指向产品表面扩张前的 review 与 contribution gates。
- [技术策略](10-technical-strategy.zh-CN.md)：本轮停留在 documentation，不改变 language ownership 或 trust boundary。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：source links 不授予 policy decision、lease、provider access、connector grant 或 verification claim。

剩余边界：

- 这不是 private vulnerability-reporting backend、release automation、documentation deployment、issue triage automation 或 maintainer workflow bot。
- 它不启用 GUI、browser automation、IM delivery、MCP/OAuth connectors、package-code execution、cloud workers 或 remote marketplace。

## 已完成增量：Supervisor RPC Stdin Failure Normalization

目标：捕获早到的 stdin write error，让 supervisor process failure 在 CI 平台间保持确定性，并继续通过 sanitized supervisor process-failure summary 报告非零 subprocess exit。

验收：

- `callSupervisorRpc` 在写 JSON-RPC request 前先安装 stdin error/close listeners。
- 早到的 `EPIPE` 或同类 stdin write failure 不会绕过 supervisor process-failure formatter。
- 非零 supervisor exit 继续报告 exit code、command、stderr 和 stdout line count，但不泄露 stdout contents。

与原始文档对照和修正：

- [技术策略](10-technical-strategy.zh-CN.md)：TypeScript 仍是 client/orchestrator surface，但 supervisor RPC boundary 必须 fail closed，并避免接受 ambiguous process evidence。
- [审计与数据合同](05-audit-and-data-contracts.zh-CN.md)：stdout 可被计数用于诊断，但 raw payload 不能进入 failure message。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：本轮 harden 既有 P0/P1 runtime boundary，不授予新 authority。

剩余边界：

- 这不是 supervisor daemon lifecycle feature、repair command、socket protocol change、policy change 或新的 runtime action family。

## 已完成增量：Remote Evidence Snapshot 与 Release Manifest Contract

目标：启动 PGC-1，把 local configured release evidence 与 operator-supplied remote CI/CodeQL observation 明确分开，并新增 schema-valid Release Manifest 合同。

验收：

- `release evidence --workspace <path>` 现在把 `remote_observed_evidence` 与 `configured_evidence` 分开报告。
- `release evidence --remote-evidence <snapshot.json>` 读取 workspace-local CI/CodeQL 快照，但不 live 查询 GitHub、不解析凭据、不写 artifact、不追加 Ledger event，也不修改 `.aetherion`。
- 缺失 remote evidence 会让报告保持 `draft`；remote evidence 无效、远端 CI/CodeQL 失败或 commit mismatch 会阻断 release report。
- `release-manifest.schema.json` 及其 example 通过现有 contract example suite。

与原始文档对照和修正：

- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：本轮启动 PGC-1 的 remote CI/CodeQL evidence 与 release manifest hardening，但不新增 release packaging、签名、部署或 live remote API call。
- [审计与数据合同](05-audit-and-data-contracts.zh-CN.md)：remote observation 是可 review evidence record，不是 authority，也不修改 projection。
- [路线图](06-roadmap.zh-CN.md)：本轮仍在 TUI-first V1 release-readiness lane 内，不启用 GUI、IM、browser automation、MCP/OAuth connector、cloud worker 或 package-code execution。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：新增 schema 绑定 release-readiness evidence，不授予 runtime authority。

偏差复核：

- 没有 replacement-OS/chatbot 漂移。
- Local Supervisor、Event Ledger、Tool Policy Proxy 仍是 authority/fact/action 边界。
- 严格回看 docs 后确认：默认 CLI surface 已明显超出窄 V1 产品形态，虽然后续 surface 多数仍是 non-authorizing。下一实现切片应做 V1 Core Profile Gate，避免 post-V1 contract/runtime labs 被误认为 V1 release-critical 产品面。

剩余边界：

- 这不是 live GitHub API reader、release packager、artifact signer、installer/updater、public docs deployment 或 release evidence repository。
- Remote evidence 只接受 workspace-local operator-supplied snapshot；live remote observation 仍是未来 PGC-1 子切片。

## 已完成增量：V1 Core Profile Gate

目标：把 V1 产品边界做成 onboarding 和 release evidence 中的 machine-readable profile，避免 post-V1 contract/runtime labs 被误认为 V1 release-critical surface。

验收：

- `onboarding check` 和 `release evidence` 输出 `v1_core_profile`。
- profile 将 V1 release-critical commands、readiness support commands 和 post-V1 labs 分开列出。
- `security audit` 保持 release-supporting evidence，而不是 V1 core 产品命令。
- 如果 V1 release-critical commands 与 post-V1 lab commands 重叠，`release evidence` 会阻断。
- `help` 测试按 section 切片 V1 core 段，并断言 post-V1 command families 不出现在其中。

与原始文档对照和修正：

- [产品简报](00-product-brief.zh-CN.md)：V1 继续 TUI-first，不吸收 GUI、IM、browser automation、MCP/OAuth connector、cloud worker 或 package-code execution。
- [路线图](06-roadmap.zh-CN.md)：Phase 1/2 kernel/readiness commands 与后续 trace-backed labs 分开。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：本轮直接处理 production-parity 压力导致 V1 surface creep 的风险。

剩余边界：

- 这是 profile gate 和 release-readiness boundary，不是 supervisor lifecycle、vault、ingress、packaging、signing 或 deployment feature。
- 下一高价值 runtime 切片仍是 supervisor lifecycle/vault refs/local ingress，除非先出现 release-evidence 或 CI blocker。

## 已完成增量：Metadata-Only Vault Reference Contract

目标：启动 PGC-2 vault path，用 schema-valid reference contract 和 readiness checks 证明 Aetherion 现在只能命名 credential material，不能存储或使用 raw secret。

验收：

- `vault-reference.schema.json` 及其 example 通过现有 contract example suite。
- schema 拒绝 raw secret material、OAuth flow 已完成声明、connector grant 和 raw secret 对 Aetherion 可用的声明。
- `doctor`、`onboarding check` 和 `release evidence` 输出 `vault_reference_contract` readiness evidence。
- release evidence 继续明确剩余缺口：metadata-only vault reference 已存在，但没有 production vault backend、token refresh 或 connector grant lifecycle。

与原始文档对照和修正：

- [技术策略](10-technical-strategy.zh-CN.md)：vault 未来属于 Rust authority boundary；本轮只定义当前 TypeScript readiness reports 可检查的 metadata。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：新合同被分到 P1 readiness/credential-boundary metadata tier，并有 raw secret 与 OAuth/connector overclaiming 的负向测试。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：本轮启动 PGC-2，但不启用真实 OAuth connector、token persistence 或 connector grant。

剩余边界：

- 这不是 production vault backend、OS keychain integration、token refresh system、OAuth authorization flow、connector grant lifecycle、secret retrieval API、policy lease 或 runtime authority grant。
- 下一切片可以继续 PGC-2 supervisor lifecycle/vault reference binding design，或在 release evidence 风险更高时回到 PGC-1 live remote observation。

## 已完成增量：Model Provider Readiness Contract

目标：把已有 no-tools provider support 变成 release-checkable evidence，同时不扩大 OAuth 或 connector 范围。

验收：

- `model-provider-readiness.schema.json` 及其 example 通过现有 contract example suite。
- schema 将支持的 API surface 锁定为 OpenAI Responses、OpenAI Chat Completions、Anthropic Messages 和 Gemini `generateContent`。
- schema 拒绝 OAuth-flow、token-refresh、connector-grant、raw prompt/model/provider payload、provider tool-call persistence 和 model-output authority overclaim。
- `doctor`、`onboarding check` 和 `release evidence` 输出 `model_provider_readiness_contract` evidence。
- release evidence 继续明确 provider 剩余缺口：OAuth flows、token refresh、connector grants、streaming、多模态 payload 和 legacy OpenAI `/v1/completions` 仍未实现。

与原始文档对照和修正：

- [架构](01-architecture.zh-CN.md)：model provider invocation 仍是 Agent Orchestrator evidence；Tool Access & Action Policy Proxy 继续 gate actions。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：provider readiness 是 P1 metadata，并用负向测试覆盖 raw payload、provider tool call 和 OAuth/connector overclaiming。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：本轮继续 PGC-2，在真实 OAuth 或 connector grant 前命名 provider/credential boundary。
- [路线图](06-roadmap.zh-CN.md)：provider portability 仍在 TUI-first readiness 内；MCP/OAuth/SaaS connector 继续 deferred。

剩余边界：

- 这不是 OAuth client、provider-auth wizard、token refresh system、connector grant lifecycle、streaming/multimodal provider path、provider tool executor 或 runtime authority grant。
- 下一高价值 PGC-2 切片仍是 supervisor lifecycle/vault reference binding design，除非 release evidence 或 CI 先成为更尖锐 blocker。

## 已完成增量：Supervisor Lifecycle Readiness Contract

目标：继续推进 PGC-2，把当前 supervisor lifecycle boundary 做成 release-checkable evidence，同时不把 foreground status/preflight 误称为 production daemon lifecycle。

验收：

- `supervisor-lifecycle-readiness.schema.json` 及其 example 通过现有 contract example suite。
- schema 将已支持 lifecycle evidence 锁定为只读 `supervisor status`、`supervisor preflight`，以及 stdio/foreground Unix socket/runtime-lock observation。
- schema 拒绝 production daemon、start/stop、stale-lock repair、socket-auth lifecycle、vault backend、process sandbox、signer、cloud worker、socket-token tool authority、runtime-lock authority 和 supervisor lease-authority overclaim。
- `doctor`、`onboarding check` 和 `release evidence` 输出 `supervisor_lifecycle_readiness_contract` evidence。
- release evidence 继续明确 lifecycle 剩余缺口：status/preflight 与 foreground socket lock 已存在，但 production daemon start/stop、socket-auth lifecycle、stale-lock recovery、process sandboxing 和 vault-backed supervisor secrets 仍未实现。

与原始文档对照和修正：

- [架构](01-architecture.zh-CN.md)：Local Supervisor 仍是 authority boundary；lifecycle readiness metadata 本身不能授予 authority 或 lease。
- [技术策略](10-technical-strategy.zh-CN.md)：Rust 仍是未来 authority/vault/daemon boundary 的 owner；本轮只记录当前 status/preflight evidence 和 unsupported lifecycle claims。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：supervisor lifecycle readiness 是 P1 metadata，并用负向测试覆盖 daemon、repair、vault、socket-auth 和 lease-authority overclaiming。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：本轮继续 PGC-2，在实现 start/stop/recover-stale-lock behavior 之前先 typed lifecycle readiness。

剩余边界：

- 这不是 production daemon、service installer、daemon manager、stale-lock recovery command、crash-recovery system、socket-auth lifecycle、device/user identity layer、vault backend、signer、process sandbox、cloud worker 或 policy lease。
- 下一高价值 PGC-2 切片是 vault reference binding design 或第一个显式 lifecycle command contract，除非 local ingress 或 release evidence 先成为更尖锐 blocker。

## 已完成增量：Vault Policy Binding Readiness Contract

目标：补齐下一块 PGC-2 credential-boundary 缺口，证明未来 policy decision 可以引用 Vault Reference，但这个引用不会变成 secret access、egress authority 或 provider credential resolution。

验收：

- `vault-policy-binding.schema.json` 及其 example 通过现有 contract example suite。
- schema 只用 reference 名称绑定 `vault-reference`、`policy-decision` 和 `model-provider-readiness`。
- schema 允许 policy decision 以 reference-and-fingerprint metadata 形式引用 `vault://` reference。
- schema 拒绝 secret resolution、raw secret copy、provider vault-backed call、egress authorization、connector grant、token refresh、OAuth flow，以及 binding 自己发 lease。
- `doctor`、`onboarding check` 和 `release evidence` 输出 `vault_policy_binding_contract` evidence。

与原始文档对照和修正：

- [架构](01-architecture.zh-CN.md)：Tool Access & Action Policy Proxy 仍是 action/egress choke point；vault metadata 不能绕过它。
- [技术策略](10-technical-strategy.zh-CN.md)：Rust 仍是未来 vault/authority behavior 的 owner；本轮 TypeScript 只做 contract/readiness evidence。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：vault policy binding 是 P1 readiness metadata，并用负向测试覆盖 secret resolution、egress、connector grant 和 lease authority。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：本轮推进 PGC-2 中“vault ref 可被 policy decision 引用但不存储 raw secret value”的验收项。

剩余边界：

- 这不是 production vault backend、secret retrieval API、provider vault-backed invocation path、OAuth flow、token refresh system、connector grant lifecycle、egress policy implementation 或 policy lease。
- 下一高价值切片是显式 lifecycle command contracts、local ingress envelope/idempotency，或 provider error/credential-source productionization。

## 已完成增量：Local Ingress Readiness Contract And Audit

目标：在不把 V1 扩大到 TUI 之外的前提下启动 PGC-3，把未来 ingress gateway 的 envelope、idempotency、auth-state、rate-limit-state 和 policy-handoff 要求变成 machine-checkable evidence。

验收：

- `local-ingress-readiness.schema.json` 及其 example 进入现有 contract example validation suite。
- schema 要求 caller identity placeholder、surface id、workspace id、idempotency key、normalized intent hash、auth state、rate-limit state 和 policy handoff metadata。
- schema 拒绝 public API/browser/IM/mobile/cloud ingress overclaim、unauthenticated authority、duplicate-key authority reuse、raw external payload persistence、session issuance、rate-limit enforcement claim 和 supervisor bypass。
- `doctor`、`onboarding check`、`ingress audit` 和 `release evidence` 输出 `local_ingress_readiness_contract` evidence。
- `ingress audit` 保持只读，并报告当前缺口：没有 runtime duplicate detector、rate-limit enforcement、durable auth/session lifecycle、public API listener、browser extension ingress、IM delivery、mobile pairing、connector OAuth ingress 或 cloud worker ingress。

匹配源文档与修正：

- [架构](01-architecture.zh-CN.md)：Ingress Gateways 必须在 Local Supervisor handoff 前负责 normalize、authenticate、rate-limit 和 idempotency。
- [用户边界层](02-user-boundary-layer.zh-CN.md)：client surfaces 与 remote channels 不能直接授权 sensitive action。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：local ingress readiness 是 P1 metadata，必须拒绝 inherited authority 或 live side-effect claim。
- [生产缺口关闭计划](15-production-gap-closure-plan.zh-CN.md)：本轮通过 local ingress request envelope 和只读 audit command 启动 PGC-3。

剩余边界：

- 这不是 production ingress gateway、public API listener、browser extension、IM delivery path、mobile pairing system、connector OAuth ingress、cloud worker、session manager、runtime duplicate detector、rate limiter、policy lease 或 side-effect authorization path。
- 下一高价值切片是 local command envelope 的 runtime idempotency/duplicate detection、显式 supervisor lifecycle command contracts，或 provider error/credential-source productionization。
