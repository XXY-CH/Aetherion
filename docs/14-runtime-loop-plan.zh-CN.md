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
