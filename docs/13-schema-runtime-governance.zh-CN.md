# Schema 运行时治理

[English](13-schema-runtime-governance.md)

Aetherion 已经捕获了足够多的产品想象。新工作现在应偏向关闭 runtime loops，而不是继续扩大 schema surface。

## 原则

- schema 不是 feature。
- projection 不是 source of truth。
- fixture 不是 runtime evidence。
- client surface 不是 authority boundary。

每个 schema 都必须分配 runtime tier。tier 决定新字段、命令和 example 必须多严格地绑定 executable behavior。

## Tiers

### P0: Kernel Runtime Contracts

P0 是当前 Ether + Rust supervisor kernel loop 必需合同。变更必须包括 schema/example validation 加 runtime 或 replay tests。

包括 event、workspace-registry、run-manifest、boundary-facts、tool-request、risk-composition、policy-decision、scoped-lease、approval-card、consent-record、action-record、observation-record、verification-record、replay-record、permission-policy。

P0 gate：

- 证明真实 Ether 或 supervisor path 写入或消费该合同。
- 证明负向 policy behavior，而不只是 happy path validation。
- 证明 replay 不执行 live side effects。
- workspace-registry 必须从 resolved workspace root 派生身份、runtime dir 和 Ledger path，不能重定向 kernel。

### P1: Trace-Backed Product Runtime

P1 支持已经实现但刻意窄化的本地 runtime slices。变更必须引用 source Ledger events 或通过 provenance audit 的 persisted registry evidence，不能合成缺失 evidence。

包括 Memory OS/prompt assembly、Capability OS、Sandbox/branching、causal reports、hibernation、security/surface slices，以及 agent runtime/model request/model response/response audit/tool request proposal metadata。

P1 gate：

- 指出 command 或 module path 如何从真实 Ledger evidence 生产合同。
- 对 missing source events、inherited authority、raw secrets 或 live side-effect replay 加负向测试。
- 高级行为保持 report-only 或 sandbox-only，直到 Rust supervisor authority 存在。
- registry row 存在不等于可重建。read-only audits 只能报告，不修复、不授权。
- 如果 registry-driven path 可触达 live side effect，命令必须重新验证 source Ledger event、artifact/file evidence 和 target binding，然后才请求 Rust supervisor authority。

### P2: Frozen Innovation Contracts

P2 编码战略方向，但除非 P0/P1 runtime loop 需要，否则不应扩展。

包括 Soul Fork/Inheritance、Persona branch/Memory fold、multi-agent score/budget/circuit、computer-use action/observation、未来 GUI/browser automation/extension/connector/remote store contracts。

P2 gate：

- 优先不改 schema。
- 必须改字段时，说明哪个 P0/P1 runtime loop 强迫它。
- 不添加暗示真实 automation、delivery、vault access、connector takeover 或 package execution 的命令。

## Computer-Use Boundary

computer-use schemas 当前是 P2 contracts，带 P1 风格 validation tests。允许 contract hardening：adapter requirements、current-tab scope、non-authorizing observations、side-effect actions 的 policy/lease/approval/verifier evidence。

真实 click/type/browser/desktop automation 必须等 Local Supervisor 暴露受治理 adapter action gateway。

## Runtime Focus

本地文件读取和 approval-gated traced writes 的第一个 loop 已通过 Ether 和 Rust supervisor path 闭合。接下来的实现应先 harden 或扩展这些 loops，再扩大 schema surface。

优先方向：

1. Rust supervisor path 中的完整 action lifecycle。
2. trace-backed Memory Card lifecycle。
3. trace-backed Capability Draft lifecycle。

`prompt plan`、`prompt audit`、`prompt bind-runtime`、`prompt prepare-model-request`、`prompt invoke-model` 和 `prompt propose-tool-request` 都是 P1 Agent Orchestrator evidence path，不是权限路径。它们可以产生 metadata artifact 和 governance event，但不能请求工具、发行 lease、读 raw payload、授权动作或声称 runtime verification。

`prompt invoke-model` 当前支持 `stub`、`openai_responses`、`openai_chat_completions`、`anthropic` 和 `gemini`。live provider credential 只从 env 内存读取。Aetherion 不运行 browser OAuth flow、不创建 connector grant、不把 provider credential 当 tool authority。Anthropic direct Messages API 使用 `ANTHROPIC_API_KEY`，这里不实现 Anthropic OAuth。

## Node Baseline

当前 Node 基线是 Node.js 25+。
