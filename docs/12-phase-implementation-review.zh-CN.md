# 阶段实现复核

[English](12-phase-implementation-review.md)

本文件是阶段结束复核 ledger 的中文伴读版。英文原文是逐轮追加的完整运行记录；本文件保留最新复核逻辑和主要偏差修正点，帮助中文读者快速核对项目是否仍符合原始构想。

不变约束：V1 是 TUI-first。后续 GUI、IM、浏览器、connector 和 store surface 都只是 client surface，不能成为 trust root。

schema 增长现在由 `docs/13-schema-runtime-governance.md` 治理：P0 kernel contracts 需要 executable/replay evidence，P1 product-runtime contracts 需要 source-backed command paths，P2 innovation contracts 除非被低层 runtime loop 需要，否则应冻结。

## 当前复核快照

最近一轮重点：

- no-tools 模型 provider 边界扩展到 OpenAI Responses、OpenAI Chat Completions、Anthropic Messages 和 Gemini `generateContent`。
- provider credentials 只从 env 内存读取，不写入 artifact、ledger、fixtures 或 docs。
- OpenAI/Gemini 可以接受外部获取的 bearer token env var，但 Aetherion 不运行浏览器 OAuth、account linking、token refresh、vault storage 或 connector grant。
- Anthropic 直连 Messages API 继续使用 `ANTHROPIC_API_KEY` 与 `x-api-key`。
- 模型响应 artifact 仍是 hash-only，不持久化 raw prompt、raw response 或 raw provider payload。
- response audit 和 tool-request proposal 仍然 non-authorizing。
- 主文档新增 `.zh-CN.md` 中文伴读文件，并在英文原文中加入中文链接。

验证快照：

- `npm test`：129 个测试通过。
- `cargo test`：39 个 Rust 测试通过。
- `cargo clippy --all-targets --all-features -- -D warnings`：通过。
- `cargo fmt --check`：通过。
- `git diff --check`：通过。
- `git ls-files .aetherion target`：没有 tracked runtime/build artifacts。

## 对原始构想的一一核对

- `docs/00-product-brief.md`：本轮推进的是本地 agent runtime 的 model-evidence path，没有加入 GUI、IM、浏览器自动化、connector 或 cloud worker。
- `docs/01-architecture.md`：provider call 位于 Agent Orchestrator；Tool Access & Action Policy Proxy 仍是唯一 action choke point。
- `docs/02-user-boundary-layer.md`：provider credential、model output、audit pass 或 proposal 都不能授权读取、写入、外发、lease 或副作用。
- `docs/03-memory-os.md`：本轮没有把模型响应写成长期记忆，也没有绕过 Memory Card review。
- `docs/04-skill-and-scaffold-os.md`：没有让 provider/tool 输出生成 active Capability Capsule 或 package。
- `docs/05-audit-and-data-contracts.md`：新增 provider 行为通过 hash、payload ref 和 tests 保持可审计，不把 projection 当 source truth。
- `docs/06-roadmap.md`：仍在 TUI-first runtime loop 内；OAuth/SaaS connector 和 broader surfaces 仍 post-V1。
- `docs/07-positioning-and-naming.md`：没有把 Aetherion 当最终品牌或替代 OS 宣称。
- `docs/08-innovation-thesis.md`：Dreaming/capability/proactive 方向未被扩张成本轮真实动作。
- `docs/09-computer-use-implementation.md`：没有启用真实 browser/desktop automation。
- `docs/10-technical-strategy.md`：TypeScript 负责 provider API iteration，Rust supervisor 仍保留 policy/lease/action authority。
- `docs/11-migration-and-runtime-economics.md`：没有把 migration/import 或 connector 当 active trust root。
- `docs/13-schema-runtime-governance.md`：本轮收敛 runtime loop，没有无约束扩大 schema surface。
- `docs/14-runtime-loop-plan.md`：多 provider no-tools boundary 是已完成 increment；下一步应继续硬化 provider metadata 或把 proposal 转成 fresh supervisor policy request。

## 纠偏与剩余边界

- “支持 OAuth”被收敛为“支持外部提供 bearer token 的 provider 调用”。真实三方 OAuth flow、token refresh、vault backend、connector grant 和 account linking 仍未实现。
- 模型 provider 支持不等于 tool-use 支持。provider tool call 不会被翻译成 `tool.requested`。
- response audit pass 不等于 semantic verification、task completion 或 policy approval。
- 中文文档是帮助阅读的伴读版；英文原文和 schema/test 仍是规范来源。
- issue 与 PR templates 本轮仍保持英文；如需要双语贡献入口，可在后续单独本地化。

## 验证要求

每轮结束应至少检查：

- schema/example validation。
- harness-core/TUI 测试。
- Rust supervisor 测试。
- `git diff --check`。
- `.aetherion/`、`target/` 等 runtime/build artifact 未被提交。
- 本文件和 `docs/14-runtime-loop-plan.md` 是否说明与原始构想的偏差和修正。
