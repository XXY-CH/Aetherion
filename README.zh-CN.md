# Aetherion

[![CI](https://github.com/XXY-CH/Aetherion/actions/workflows/ci.yml/badge.svg)](https://github.com/XXY-CH/Aetherion/actions/workflows/ci.yml)

[English](README.md)

> **我们正在寻找志同道合的开发者和维护者一起构建 Aetherion。** 如果你关心 local-first agent runtime、可审计权限边界、受治理的工具使用和更安全的自主系统，欢迎参与。

Aetherion 是一个本地优先的 Agent Harness Kernel 代号：它为 agent 执行、记忆、权限、能力、脚手架、主动行为和用户连接工作流提供可审计运行时。

它的产品目标不是“更强的聊天机器人”，也不是替代操作系统。Aetherion 目标是成为用户、设备、数据、工具和自主 agent 之间的受治理控制平面。

公开命名尚未最终确定。“Aetherion” 可能在 GitHub、包名、商标和平台命名上存在冲突，因此在完成命名清查前应继续作为代号使用。

## 产品论点

现代 agent 的瓶颈不只在模型智能，而在 harness 质量：权限边界、事件保真度、记忆溯源、工具治理、能力演化和真实执行闭环。Aetherion 把这些当作 kernel 级运行时问题处理。

目标承诺：

> 让 agent 在同一个人类治理、可审计边界内安全操作计算机、工具、记忆、消息和自演化能力。

当前实现刻意更窄：先证明 TUI 加 Rust 监督的本地 kernel loop，再加入带 trace 的本地合同切片；不做真实浏览器自动化、IM 投递、connector 接管、vault 访问、云 worker 或包代码执行。

项目图标源文件在 `assets/aetherion-icon.svg`，README 使用的 PNG 是渲染资产。

## 第一原则

- Local Supervisor、Policy Engine、Secret Vault 和 Event Ledger 是根权限边界。
- TUI、GUI、浏览器扩展、移动端和 IM 都只是客户端表面，不能直接授予权限。
- V1 只做 TUI。GUI、移动端、IM、浏览器扩展、浏览器自动化和真实 connector 都延后。
- Event Plane 是事实层。消息、审批、工具调用、记忆候选、能力变更和主动机会都进入 append-only ledger。
- OAuth、MCP 和 connector 暴露用户数据与工具，但永远不能绕过 Tool Policy Proxy。
- Connector adapter 与 execution adapter 是 policy 后面的同级目标族，不是简单上下游。
- Memory OS 不是向量检索，而是有来源、置信度、敏感度和删除控制的可审计记忆层。
- Capability Capsule 是受治理的内部能力单元。Skill 是过程知识和导入格式，不是不受限插件。
- Dreaming 产生可审查 patch，不产生外部动作。
- Proactive behavior 是 Opportunity Lifecycle，不是 cron 式自我打断。
- Markdown、YAML、JSONL 等人类可读文件是治理源头；SQLite、向量、图和搜索索引是可重建投影。

## 初始文档

- [产品简报](docs/00-product-brief.zh-CN.md) / [Product Brief](docs/00-product-brief.md)
- [架构](docs/01-architecture.zh-CN.md) / [Architecture](docs/01-architecture.md)
- [用户边界层](docs/02-user-boundary-layer.zh-CN.md) / [User Boundary Layer](docs/02-user-boundary-layer.md)
- [Memory OS](docs/03-memory-os.zh-CN.md) / [Memory OS](docs/03-memory-os.md)
- [Capability and Scaffold OS](docs/04-skill-and-scaffold-os.zh-CN.md) / [Capability and Scaffold OS](docs/04-skill-and-scaffold-os.md)
- [审计与数据合同](docs/05-audit-and-data-contracts.zh-CN.md) / [Audit and Data Contracts](docs/05-audit-and-data-contracts.md)
- [路线图](docs/06-roadmap.zh-CN.md) / [Roadmap](docs/06-roadmap.md)
- [定位与命名风险](docs/07-positioning-and-naming.zh-CN.md) / [Positioning and Naming Risk](docs/07-positioning-and-naming.md)
- [创新论点](docs/08-innovation-thesis.zh-CN.md) / [Innovation Thesis](docs/08-innovation-thesis.md)
- [Computer Use 实现](docs/09-computer-use-implementation.zh-CN.md) / [Computer Use Implementation](docs/09-computer-use-implementation.md)
- [技术策略](docs/10-technical-strategy.zh-CN.md) / [Technical Strategy](docs/10-technical-strategy.md)
- [迁移与运行时经济性](docs/11-migration-and-runtime-economics.zh-CN.md) / [Migration and Runtime Economics](docs/11-migration-and-runtime-economics.md)
- [阶段实现复核](docs/12-phase-implementation-review.zh-CN.md) / [Phase Implementation Review](docs/12-phase-implementation-review.md)
- [Schema 运行时治理](docs/13-schema-runtime-governance.zh-CN.md) / [Schema Runtime Governance](docs/13-schema-runtime-governance.md)
- [运行时闭环计划](docs/14-runtime-loop-plan.zh-CN.md) / [Runtime Loop Plan](docs/14-runtime-loop-plan.md)
- [生产缺口补全计划](docs/15-production-gap-closure-plan.zh-CN.md) / [Production Gap Closure Plan](docs/15-production-gap-closure-plan.md)

## 治理与协作

- [行为准则](CODE_OF_CONDUCT.zh-CN.md) / [Code of Conduct](CODE_OF_CONDUCT.md)
- [贡献指南](CONTRIBUTING.zh-CN.md) / [Contributing](CONTRIBUTING.md)
- [安全政策](SECURITY.zh-CN.md) / [Security Policy](SECURITY.md)
- [MIT 许可证](LICENSE) / [中文说明](LICENSE.zh-CN.md)
- Issue templates：[bug report](.github/ISSUE_TEMPLATE/bug_report.yml)、[contract change](.github/ISSUE_TEMPLATE/contract_change.yml)、[feature request](.github/ISSUE_TEMPLATE/feature_request.yml)、[security hardening](.github/ISSUE_TEMPLATE/security_hardening.yml)
- [Pull request template](.github/pull_request_template.md)

## MVP 方向

第一版只做 TUI，证明最小完整本地 kernel loop：

1. TUI 命令表面和项目/工作区身份。
2. schema 与 examples 的合同验证。
3. Event Ledger append。
4. 工具请求与 policy decision。
5. scoped lease 颁发。
6. 通过 policy 的本地文件读取与审批门控写入。
7. observation、verification 和 trace replay 重建。

明确不属于 V1：

- GUI 桌面应用。
- 移动端。
- IM 投递。
- 浏览器扩展或浏览器自动化。
- MCP/OAuth/SaaS connector。
- 云 worker。

## 合同优先工作区

- `schemas/`：Event、Tool Request、Policy Decision、Scoped Lease、Action Record、Observation Record、Verification Record、Consent Record、Permission Policy、Memory、Agent Runtime、Model Request/Response、Response Audit、Tool Request Proposal、Capability、Replay、Release Manifest、Local Ingress Readiness、Local Ingress Idempotency Reservation、metadata-only Vault Reference、Vault Policy Binding、Model Provider Readiness 和 Supervisor Lifecycle Readiness 等 JSON Schema。
- `examples/contracts/`：每个 schema 的有效 JSON 示例。
- `packages/harness-core/`：TypeScript 合同、replay、registry 和测试用 seed policy path。
- `packages/tui/`：V1 终端表面 Ether。
- `packages/computer-use/`：post-V1 的 policy-gated computer-use adapter 脚手架。
- `packages/connector-sdk/`：post-V1 的隔离 connector 导入与 policy-gated tool call 脚手架。
- `crates/supervisor/`：Rust Local Supervisor POC，负责工作区身份、hash-chained JSONL ledger、policy、scoped lease、lease-gated read 和 traced write prepare/commit。

验证：

```sh
cargo install cargo-audit --locked --version 0.22.1
npm ci --ignore-scripts
npm audit --audit-level=high --json
npm test
cargo audit
cargo test --locked
cargo clippy --all-targets --all-features --locked -- -D warnings
cargo fmt --check
git diff --check
xargs git ls-files < tools/forbidden-tracked-roots.txt
npm run ether -- onboarding check --workspace .
npm run ether -- doctor --workspace .
npm run ether -- ingress audit --workspace .
npm run ether -- security audit --workspace .
npm run ether -- release evidence --workspace .
```

pull request 和 push 到 `main` 会通过 GitHub Actions CI 运行同一组检查；tracked artifact guard 读取共享 denylist：`tools/forbidden-tracked-roots.txt`。CI 也会把 GitHub JavaScript actions opt in 到 Node 24 runtime，并运行 Ubuntu/macOS platform-smoke job，覆盖 contract/provider/help 子集、locked Rust tests、`onboarding check`、`doctor`、`ingress audit`、`security audit` 和 `release evidence`。根 JavaScript surface 当前没有 npm dependency，但已提交 `package-lock.json`，所以第一项 dependency 加入前 `npm ci` 和 `npm audit` 已经可复现。`Cargo.lock` 已提交，Rust verification 使用 `--locked`；完整本地 dependency audit 需要 `cargo-audit`。被 ignore 的 `promo/` 子树是 local/generated promotional experiment，不属于 release evidence。

如需只读 from-source onboarding preflight，运行 `npm run ether -- onboarding check --workspace .`。报告会检查本机 toolchain（`node`、`npm`、`git`、`rustc`、`cargo`、可选 `cargo-audit`）、repo scripts、lockfiles、CI gates、governance files、双语文档、Local Ingress Readiness、workspace runtime state、onboarding doc links 和 V1 Core Profile，然后输出下一步命令。它不安装 dependency、不运行整套 verification suite、不初始化 `.aetherion`、不启动或修复 daemon、不写 artifact、不调用 provider、不查询远端 CI、不启动 listener、不接受 remote connection，也不会启用 GUI/IM/browser/MCP/OAuth/cloud/package-code 等延后表面。

如需只读生产就绪快照，运行 `npm run ether -- doctor --workspace .`。报告会检查仓库治理文件、双语文档链接、CI/script/artifact/dependency-audit/platform-smoke guard 预期、dependency lockfiles、schema/example baseline、Local Ingress Readiness、Model Provider Readiness、Vault Policy Binding、Supervisor Lifecycle Readiness、metadata-only Vault Reference contract、workspace identity、Ledger hash chain 和 run manifest 状态；它不会初始化尚未运行过 Ether 的 workspace，也不会修复 runtime state。本轮增量记录在[阶段实现复核](docs/12-phase-implementation-review.zh-CN.md)和[运行时闭环计划](docs/14-runtime-loop-plan.zh-CN.md)。

如需只读 ingress 边界快照，运行 `npm run ether -- ingress audit --workspace .`。报告会检查 local ingress envelope/idempotency readiness contract，并明确当前唯一可运行 ingress surface 仍是 TUI。`run` 现在会在 supervisor handoff 前创建 hash-only local idempotency reservation；传入 `--idempotency-key <key>` 后，重复 local envelope 会在任何新 action run 前 fail closed。rate-limit enforcement、cached idempotent result replay、durable auth/session lifecycle、public API listener、browser extension ingress、IM delivery、mobile pairing、connector OAuth ingress 和 cloud worker ingress 仍未实现。audit command 不启动 listener、不接受 remote connection、不初始化 workspace、不写 artifact、不追加 Ledger event、不发 session、不发 lease，也不能授权 tool 或 side effect。

如需只读安全快照，运行 `npm run ether -- security audit --workspace .`。报告会检查 tracked text file 中的高置信 secret material、dependency lockfile evidence、共享 denylist 下的 tracked runtime/build roots、现有 `.aetherion` artifact 中的 raw prompt/model/provider payload fields、workspace Ledger hash chain、CI dependency/platform/readiness guard wiring，以及 `prompt invoke-model` stdout 边界。它不初始化 workspace、不 repair state、不追加 event、不写 artifact、不调用 provider、不发 lease，也不会启用 GUI/IM/browser/MCP/OAuth/cloud/package-code 等延后表面。

如需只读 release-evidence 快照，运行 `npm run ether -- release evidence --workspace .`；如果已有 operator 提供的 workspace-local CI/CodeQL 观测快照，可加 `--remote-evidence <snapshot.json>`。报告会汇总 git head/dirty 状态、已配置 CI gates、可选 remote observed evidence、Node 24 action-runtime evidence、Ubuntu/macOS smoke config、dependency lockfile evidence、governance 与双语文档检查、Local Ingress Readiness、Model Provider Readiness、Vault Policy Binding、Supervisor Lifecycle Readiness、metadata-only Vault Reference readiness、V1 Core Profile evidence、`doctor` 摘要、`security audit` 摘要、workspace runtime/Ledger 状态、source-document links 和明确的剩余 release gaps。它不会 live 查询远端 CI、不打包、不签名、不发布 release、不部署 docs、不初始化 workspace、不启动或停止 production daemon、不修复 stale lock、不启动 ingress listener、不接受 remote connection、不 replay cached idempotent result、不执行 rate limit、不发 session、不解析 vault secret、不通过 vault ref 调用 provider、不发 lease、不持久化 raw secret、不实现 OAuth、不创建 connector grant，也不会启用 GUI/IM/browser/MCP/OAuth/cloud/package-code 等延后表面。

## 当前实现状态

当前仓库已经超过纯文档阶段，包含可运行的本地终端原型。核心已包括合同验证、Rust supervisor POC、hash-chained Event Ledger、本地读写 policy/lease/approval 流、Memory/Capability/Sandbox/Hibernation/Surface 等 trace-backed 合同切片，以及 no-tools 模型调用的 hash-only 证据链。

`prompt invoke-model` 支持以下 provider：

- `stub`：默认离线确定性 provider。
- `openai_responses`：OpenAI Responses API。
- `openai_chat_completions`：OpenAI Chat Completions API。
- `anthropic`：Anthropic Messages API。
- `gemini`：Gemini `generateContent` API。

provider 凭据只从环境变量内存读取。Aetherion 不运行浏览器 OAuth 流、不持久化 token、不创建 connector grant，也不把模型访问当作工具权限。

`schemas/model-provider-readiness.schema.json` 与 `examples/contracts/model-provider-readiness.json` 将上述 provider list 固化为 readiness evidence：OpenAI 的 completion 支持指 `openai_chat_completions`，不是 legacy `/v1/completions`；OpenAI/Gemini 只接受外部已获取 bearer token env var；三家的 OAuth flow、token refresh、connector grant、streaming、多模态 payload 和 legacy OpenAI text completions 都仍未实现。

如果 live provider 返回 tool/function call（OpenAI `tool_calls`、Responses call-type output、Anthropic `tool_use`、Gemini `functionCall` 或 executable code），no-tools 路径会在写入 model response 或 response-audit evidence 前 fail closed。

`prompt invoke-model` 默认 stdout 只输出 hash/metadata。只有显式传 `--print-output` 时才会把 raw model output 回显给本地 operator；即便如此，raw output 仍不会写入 artifact、Ledger、registry 或日志。

`doctor` 是只读 operator surface，输出 `ready`、`degraded` 或 `blocked`，并保留每个检查的 `pass`/`warn`/`fail`/`not_applicable` 细节。它不追加 Ledger、不修改 registry、不写 artifact、不调用 provider、不发 lease、不 repair state，也不会为未初始化 workspace 创建 `.aetherion`。

所有 `audit *` 命令现在都会先验证 workspace Event Ledger hash chain。若链被篡改，audit 会 fail closed，并报告 broken event id，而不是基于被篡改 JSONL 输出看似正常的 provenance/parity。

`security audit` 是只读安全检查 surface，覆盖 secret leakage、tracked runtime/build artifact roots、runtime raw payload fields、Ledger hash-chain integrity、CI guard wiring 和 model stdout default。它不是 repair tool，也不是 connector、OAuth、package execution 或 cloud worker 启用路径。

`store trust-publisher` 现在会把本地 operator 审核过的 publisher public key 登记到 `store-publishers` projection；`store install` 必须用该本地信任锚验证签名，并从 hash-chain-verified 的 `replay.recorded` Ledger events 及其 Replay Record artifacts 解析 replay evidence，再校验 sandbox file hash 后才安装 Capsule declaration。`replay-records` registry 仍是 projection，不是 Store install authority。Store package code 仍不会执行。

## 许可证

本项目采用 MIT License。英文 [LICENSE](LICENSE) 是规范文本；[中文译文](LICENSE.zh-CN.md) 仅供理解。
