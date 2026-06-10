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
