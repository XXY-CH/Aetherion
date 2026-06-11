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
