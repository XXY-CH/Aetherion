# @aetherion/harness-core

[English](README.md)

Aetherion kernel 的最小 contract-first seed。

当前范围：

- 创建 workspace runtime directory。
- 创建 workspace registry 和 per-run manifest。
- 从 resolved workspace root 派生 workspace identity、runtime directory 和 Ledger path，并拒绝 registry drift。
- 向 JSONL Event Ledger append typed events。
- 用完整 canonical event envelope 生成 `aetherion-event-v1` hash，只排除 `event_hash` 本身。
- 验证 Rust supervisor events 和 TypeScript test seed 的 parent pointers 与 cross-author hash pointers。
- 运行本地文件 read/write、policy、scoped lease、approval、observation、verification 和 replay 的最小 harness。
- 读写 Agent Runtime Invocation、Agent Model Request、Agent Model Response、Agent Response Audit 和 Agent Tool Request Proposal metadata artifacts。
- 在 no-tools、hash-only response boundary 下解析 `stub`、`openai_responses`、`openai_chat_completions`、`anthropic` 和 `gemini` model provider；`openai_chat_completions` 是当前支持的 OpenAI completion-style surface，不是 legacy `/v1/completions`。
- provider credential 只从 env 内存读取；provider layer 不运行 OAuth、不刷新 token、不持久化 credential、不配置 connector、不授予 runtime authority。provider failure 使用 `ModelProviderError` code/category/retryable/HTTP status metadata，不用自由文本作为唯一分类；raw upstream error body 和 credential 不进入 durable evidence。
- 验证 Local Ingress Readiness、Local Ingress Rate Limit Reservation、Local Ingress Idempotency Reservation、Local Ingress Idempotency Completion、metadata-only Vault Reference、Vault Policy Binding、Model Provider Readiness、Supervisor Lifecycle Readiness 与 Supervisor Lifecycle Command contract，并用 schema 测试拒绝 remote-surface ingress overclaim、unauthenticated authority、rate-limit authority/session/queue overclaim、idempotency authority reuse、raw rate-limit 或 idempotency key/intent persistence、late rate-limit enforcement、late duplicate detection、mismatched 或 live idempotency replay claim、raw external payload storage、raw secret、secret resolution、egress、raw prompt/model payload、OAuth flow、token refresh、connector grant、provider tool call、model-output authority、production daemon、stale-lock repair、socket-auth authority、vault backend、supervisor lifecycle side effect、unsupported-command authority 和 supervisor lease authority 已实现的声明。

重要边界：

- registry 是 projection，不是 source truth。
- model output、response audit pass 和 proposal 都不是 tool authority。
- raw prompt、raw model output、raw provider payload、secret 和 token 不应进入 durable artifacts。
