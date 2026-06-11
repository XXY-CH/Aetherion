# Schema 运行时治理

[English](13-schema-runtime-governance.md)

实现跟踪：[阶段实现复核](12-phase-implementation-review.zh-CN.md)，[运行时闭环计划](14-runtime-loop-plan.zh-CN.md)，[生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)。

仓库治理链接：[行为准则](../CODE_OF_CONDUCT.zh-CN.md) / [Code of Conduct](../CODE_OF_CONDUCT.md)、[贡献指南](../CONTRIBUTING.zh-CN.md) / [Contributing](../CONTRIBUTING.md)、[安全政策](../SECURITY.zh-CN.md) / [Security Policy](../SECURITY.md)、[MIT 许可证](../LICENSE) / [中文说明](../LICENSE.zh-CN.md)、[issue templates](../.github/ISSUE_TEMPLATE/bug_report.yml) 和 [pull request template](../.github/pull_request_template.md)。

命令与 readiness 入口：[README.zh-CN](../README.zh-CN.md#合同优先工作区)。

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

包括 Memory OS/prompt assembly、Capability OS、Sandbox/branching、causal reports、hibernation、security/surface slices、release manifest、local ingress readiness、local ingress idempotency reservation、vault reference、vault policy binding、model provider readiness、supervisor lifecycle readiness，以及 agent runtime/model request/model response/response audit/tool request proposal metadata。release manifest、local ingress readiness、local ingress idempotency reservation、vault reference、vault policy binding、model provider readiness 和 supervisor lifecycle readiness 可以被 `doctor`、`onboarding check`、`ingress audit`、`release evidence` 验证，但它们不打包 release、不签名 artifact、不持久化 raw secret、不解析 vault secret、不实现 OAuth、不刷新 token、不创建 connector grant、不授权 egress、不 streaming provider output、不处理 multimodal provider payload、不实现 legacy OpenAI text completions、不 start/stop production daemon、不修复 stale runtime lock、不配置 socket-auth lifecycle、不启动 ingress listener、不接受 remote connection、不 replay cached idempotent result、不执行 rate limit、不发 session、不暴露 supervisor secret retrieval API，也不发 lease。local idempotency reservation 仅限 TUI `run` 在 supervisor handoff 前拒绝重复 key，并且只存 hash。

对 local-ingress-readiness 的变更必须证明 envelope、caller/surface/workspace identity placeholder、idempotency key、normalized intent hash、auth state、rate-limit state 和 policy handoff 是必需 metadata，并证明 unauthenticated authority、duplicate-key authority reuse、raw idempotency key persistence、raw intent persistence、raw external payload persistence、public API/browser/IM/mobile/cloud ingress、rate-limit enforcement claim、cached-result replay claim、session issuance 和 supervisor bypass 都会被拒绝。

P1 gate：

- 指出 command 或 module path 如何从真实 Ledger evidence 生产合同。
- 对 missing source events、inherited authority、raw secrets 或 live side-effect replay 加负向测试。vault-reference 变更必须证明 raw secret material、OAuth flow 完成、connector grant 和可复用 credential authority 会被拒绝，而不是被表示成已实现 runtime behavior。vault-policy-binding 变更必须证明 policy decision 只能以 reference-and-fingerprint metadata 引用 vault reference，secret resolution、raw secret copy、provider vault-backed call、egress authorization、connector grant 和 lease issuance 都继续被拒绝。model-provider-readiness 变更必须证明 provider coverage 仍限于 `openai_responses`、`openai_chat_completions`、`anthropic` 和 `gemini`；OpenAI completion 支持指 Chat Completions 而不是 legacy `/v1/completions`；OAuth flow、token refresh、connector grant、raw provider payload persistence、provider tool call、executable-code response 和 model-output authority 都继续 fail closed。supervisor-lifecycle-readiness 变更必须证明 `supervisor status` 与 `supervisor preflight` 保持只读，foreground socket/runtime-lock evidence 不能授权 action，production daemon start/stop、stale-lock recovery、socket-auth lifecycle、vault backend、process sandbox、signer、cloud worker 和 supervisor lease authority 都仍未实现，除非对应 Rust authority path 与测试已经落地。
- 高级行为保持 report-only 或 sandbox-only，直到 Rust supervisor authority 存在。
- Store install 必须把 package signature 绑定到 package 外部的 trust anchor，解析本地 Replay Record evidence，并校验 sandbox artifact hash。package 内自带 public key、自报 replay status 或 fixture-only sandbox metadata 都不够。
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

`prompt invoke-model` 当前支持 `stub`、`openai_responses`、`openai_chat_completions`、`anthropic` 和 `gemini`。`openai_chat_completions` 是当前支持的 OpenAI completion-style surface，不是 legacy `/v1/completions`。live provider credential 只从 env 内存读取。Aetherion 不运行 browser OAuth flow、不刷新 token、不创建 connector grant、不把 provider credential 当 tool authority。Anthropic direct Messages API 使用 `ANTHROPIC_API_KEY`，这里不实现 Anthropic OAuth。默认 stdout 只输出 hash/metadata；只有本地 operator 显式传 `--print-output` 时才回显 raw model output，且该 opt-in 不持久化 raw output、不授权动作。

`ether security audit` 是只读 security findings report。它可以检查 tracked text file 中的高置信 secret material、`tools/forbidden-tracked-roots.txt` 中 forbidden root 是否被 tracking、现有 `.aetherion` artifacts 是否含 raw prompt/model/provider payload fields、workspace Ledger hash chain、CI guard wiring，以及 `prompt invoke-model` 默认 stdout 边界。它不能初始化 `.aetherion`、追加 Ledger event、修改 registry、写 artifact、调用 provider、发 lease、repair state、quarantine Capsule、运行 package code，或启用 GUI、IM、browser automation、MCP/OAuth connector、cloud worker 等延后表面。

## Node Baseline

当前 Node 基线是 Node.js 25+。
