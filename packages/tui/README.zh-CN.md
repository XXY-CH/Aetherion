# Ether CLI

[English](README.md)

本 package 是本地 kernel loop 的 V1 终端表面。

设计说明：未来全屏交互式 TUI 可以参考 Charmbracelet Bubbles 的组件模板；当前 package 仍是 TypeScript CLI，不在明确实现阶段前加入 Go/Bubble Tea runtime 依赖。

当前范围：

- 运行 workspace-scoped local read。
- 通过 `--approve-write` 请求/要求显式 write approval。
- 通过 scoped policy 写默认 summary；`--summary` 提供用户显式控制的 summary text，`--output` 选择输出路径。
- `run` 在进入 Rust supervisor 前会先预留 hash-only local ingress rate-limit slot 和 idempotency key；不同 normalized intent 的重复 `--idempotency-key <key>` 或已满的 local rate-limit window 会在任何新 tool request、lease 或 action run 前 fail closed。同 key、同 normalized intent 且来源 manifest 已 completed 时，会返回 cached replay evidence，不创建新的 manifest、Ledger event、policy decision、lease 或 file action。
- 默认通过 Rust supervisor POC 路由 `run`。TypeScript seed policy path 仅用于测试，并需要 `AETHERION_ALLOW_TYPESCRIPT_SEED=1`。
- 提供 trace、replay、doctor、audit、memory、context、prompt、capsule、sandbox、hibernation、surface、store 等本地命令表面。
- `supervisor status` 和 `supervisor preflight` 输出只读 lifecycle/status evidence，包括 `daemon_running=false`、runtime-lock fields、owner process status 和 stale-lock detection。`supervisor start`、`supervisor stop` 和 `supervisor recover-stale-lock` 是显式命令表面，但只会校验 Supervisor Lifecycle Command report 并以 `unsupported_fail_closed` fail closed；它们不启动/停止 daemon、不 kill process、不修 lock、不修改 Ledger、不写 artifact、不发 session/lease、不解析 vault secret，也不授权 tool。Supervisor Lifecycle Readiness 与 Supervisor Lifecycle Command contract 将该边界纳入 release-checkable evidence；它不是 production daemon 或 lock repair implementation。
- `onboarding check` 输出只读 from-source onboarding preflight，检查本机 toolchain、repo scripts、lockfiles、CI/governance/docs evidence、Supervisor Lifecycle Readiness 与 Supervisor Lifecycle Command evidence、workspace runtime state、V1 Core Profile 和下一步命令；它不安装 dependency、不运行长 verification、不启动 daemon、不修复 state、不写 artifact、不追加 event，也不初始化 `.aetherion`。
- `doctor` 输出只读生产就绪报告，检查 repo governance/docs/CI/schema/dependency/platform-smoke baseline、Local Ingress Readiness contract、Model Provider Readiness contract、Vault Policy Binding contract、Supervisor Lifecycle Readiness contract、Supervisor Lifecycle Command contract、metadata-only Vault Reference contract，以及 workspace identity、Ledger hash chain、run manifest 状态；它不初始化 workspace、不修复 state、不追加 Ledger、不写 artifact、不发 lease、不解析 secret、不持久化 secret、不实现 OAuth、不创建 connector grant、不调用 provider。
- `ingress audit` 输出只读本地入口 readiness 报告，检查 envelope、auth-state、rate-limit、idempotency 和 policy-handoff 要求，包括 TUI run 的 local atomic rate-limit 与 idempotency reservation/completion evidence；durable/session/remote idempotency replay、durable/distributed/session/remote rate limiting、durable auth/session lifecycle、public API listener、browser extension ingress、IM delivery、mobile pairing、connector OAuth ingress 和 cloud worker ingress 仍未实现。
- `security audit` 输出只读安全报告，检查 tracked secret material、dependency lockfile evidence、`tools/forbidden-tracked-roots.txt` 中的 runtime/build roots、现有 runtime artifacts 的 raw sensitive fields、workspace Ledger hash chain、CI dependency/platform/readiness guard wiring 和默认 model stdout 边界；它不修改 workspace state。
- `release evidence` 输出只读 release evidence 报告，汇总 git head/dirty、已配置 CI/action-runtime/platform-smoke evidence、可选 operator-supplied CI/CodeQL 快照、dependency lockfiles、governance/docs checks、Local Ingress Readiness、Model Provider Readiness、Vault Policy Binding、Supervisor Lifecycle Readiness、Supervisor Lifecycle Command fail-closed evidence、metadata-only Vault Reference readiness、V1 Core Profile、`doctor`、`security audit`、workspace runtime state、source-document links 和剩余 release gaps；它不 live 查询远端 CI、不打包、不签名、不发布、不部署 docs、不启动/停止 daemon、不修复 stale lock、不启动 ingress listener、不接受 remote connection、不 replay cached idempotent result、不执行 durable/distributed/session/remote rate limiting、不发 session、不解析 vault secret、不持久化 secret、不实现 OAuth、不创建 connector grant，也不修改 `.aetherion`。
- 所有 `audit *` 命令先验证 workspace Event Ledger hash chain；链被篡改时 fail closed，而不是基于坏 JSONL 输出 provenance/parity。
- `prompt plan`、`prompt bind-runtime`、`prompt prepare-model-request`、`prompt invoke-model`、`prompt audit` 和 `prompt propose-tool-request` 组成 non-authorizing Agent Orchestrator evidence path。

模型 provider：

```bash
AETHERION_MODEL_PROVIDER=openai_responses OPENAI_API_KEY=... npm run ether -- prompt invoke-model <request_id> --content <task> --workspace .
AETHERION_MODEL_PROVIDER=openai_chat_completions OPENAI_API_KEY=... npm run ether -- prompt invoke-model <request_id> --content <task> --workspace .
AETHERION_MODEL_PROVIDER=anthropic ANTHROPIC_API_KEY=... npm run ether -- prompt invoke-model <request_id> --content <task> --workspace .
AETHERION_MODEL_PROVIDER=gemini GEMINI_API_KEY=... npm run ether -- prompt invoke-model <request_id> --content <task> --workspace .
npm run ether -- prompt invoke-model <request_id> --content <task> --workspace . --print-output
npm run ether -- onboarding check --workspace .
npm run ether -- ingress audit --workspace .
npm run ether -- security audit --workspace .
npm run ether -- release evidence --workspace . [--remote-evidence <snapshot.json>]
```

Model Provider Readiness contract 会检查这些 surface：OpenAI Responses、OpenAI Chat Completions（当前支持的 completion-style surface，不是 legacy `/v1/completions`）、Anthropic Messages 和 Gemini `generateContent`。OpenAI/Gemini 可以使用外部获取的 bearer token env var；Ether 不发起 OAuth、不刷新 token、不持久化 token、不创建 connector grant，也不把 provider access 当作 tool authority。Anthropic direct API 使用 `ANTHROPIC_API_KEY`。provider 返回 tool/function call 时，no-tools 模式会 fail closed，不会写 model-response 或 response-audit evidence。

`prompt invoke-model` 默认 stdout 只输出 hash/metadata。`--print-output` 只把 raw model output 显式回显给本地 operator，不会把 raw output 持久化为 artifact、Ledger event 或 registry state。

重要边界：

- TUI 是 client surface，不是 root authority。
- prompt/model/audit/proposal path 不请求工具、不发行 lease、不授权动作。
- Store install 从 hash-chain-verified 的 `replay.recorded` Ledger events 和 Replay Record artifacts 解析 replay evidence；`replay-records` registry 只是 projection，不是安装权限来源。
- runtime output under `.aetherion/` 是本地状态，不应提交。
