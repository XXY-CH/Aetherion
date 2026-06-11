# Ether CLI

[English](README.md)

本 package 是本地 kernel loop 的 V1 终端表面。

设计说明：未来全屏交互式 TUI 可以参考 Charmbracelet Bubbles 的组件模板；当前 package 仍是 TypeScript CLI，不在明确实现阶段前加入 Go/Bubble Tea runtime 依赖。

当前范围：

- 运行 workspace-scoped local read。
- 通过 `--approve-write` 请求/要求显式 write approval。
- 通过 scoped policy 写默认 summary；`--summary` 提供用户显式控制的 summary text，`--output` 选择输出路径。
- 默认通过 Rust supervisor POC 路由 `run`。TypeScript seed policy path 仅用于测试，并需要 `AETHERION_ALLOW_TYPESCRIPT_SEED=1`。
- 提供 trace、replay、doctor、audit、memory、context、prompt、capsule、sandbox、hibernation、surface、store 等本地命令表面。
- `doctor` 输出只读生产就绪报告，检查 repo governance/docs/CI/schema/dependency/platform-smoke baseline 以及 workspace identity、Ledger hash chain、run manifest 状态；它不初始化 workspace、不修复 state、不追加 Ledger、不写 artifact、不发 lease、不调用 provider。
- `security audit` 输出只读安全报告，检查 tracked secret material、dependency lockfile evidence、`tools/forbidden-tracked-roots.txt` 中的 runtime/build roots、现有 runtime artifacts 的 raw sensitive fields、workspace Ledger hash chain、CI dependency/platform/readiness guard wiring 和默认 model stdout 边界；它不修改 workspace state。
- 所有 `audit *` 命令先验证 workspace Event Ledger hash chain；链被篡改时 fail closed，而不是基于坏 JSONL 输出 provenance/parity。
- `prompt plan`、`prompt bind-runtime`、`prompt prepare-model-request`、`prompt invoke-model`、`prompt audit` 和 `prompt propose-tool-request` 组成 non-authorizing Agent Orchestrator evidence path。

模型 provider：

```bash
AETHERION_MODEL_PROVIDER=openai_responses OPENAI_API_KEY=... npm run ether -- prompt invoke-model <request_id> --content <task> --workspace .
AETHERION_MODEL_PROVIDER=openai_chat_completions OPENAI_API_KEY=... npm run ether -- prompt invoke-model <request_id> --content <task> --workspace .
AETHERION_MODEL_PROVIDER=anthropic ANTHROPIC_API_KEY=... npm run ether -- prompt invoke-model <request_id> --content <task> --workspace .
AETHERION_MODEL_PROVIDER=gemini GEMINI_API_KEY=... npm run ether -- prompt invoke-model <request_id> --content <task> --workspace .
npm run ether -- prompt invoke-model <request_id> --content <task> --workspace . --print-output
npm run ether -- security audit --workspace .
```

OpenAI/Gemini 可以使用外部获取的 bearer token env var；Ether 不发起 OAuth、不持久化 token、不把 provider access 当作 tool authority。Anthropic direct API 使用 `ANTHROPIC_API_KEY`。provider 返回 tool/function call 时，no-tools 模式会 fail closed，不会写 model-response 或 response-audit evidence。

`prompt invoke-model` 默认 stdout 只输出 hash/metadata。`--print-output` 只把 raw model output 显式回显给本地 operator，不会把 raw output 持久化为 artifact、Ledger event 或 registry state。

重要边界：

- TUI 是 client surface，不是 root authority。
- prompt/model/audit/proposal path 不请求工具、不发行 lease、不授权动作。
- Store install 从 hash-chain-verified 的 `replay.recorded` Ledger events 和 Replay Record artifacts 解析 replay evidence；`replay-records` registry 只是 projection，不是安装权限来源。
- runtime output under `.aetherion/` 是本地状态，不应提交。
