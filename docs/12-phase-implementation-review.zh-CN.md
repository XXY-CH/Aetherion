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
- Store install 从“包内公钥自证明”收敛为“本地 publisher trust registry + Ed25519 signature + 本地 replay/sandbox evidence”。
- live provider 调用新增 timeout、HTTP error 和 malformed JSON 的稳定失败边界。

验证快照：

- `npm test`：131 个测试通过。
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

## Phase 43 复核：CI 生产化门禁

本轮用最严格 OpenClaw 对照发现：Aetherion 已有本地验证命令，但没有仓库级 push/PR CI 门禁；这会让生产级验收无法依赖自动化证据。

OpenClaw 一手对照证据（2026-06-11 抓取）：

- OpenClaw README 首页展示 CI、release、install/onboarding、update、security、channels、apps/nodes 和 docs 入口：`https://github.com/openclaw/openclaw`。
- OpenClaw CI workflow 是大型 routed matrix，包含 preflight、platform lanes、docs routing、channel/plugin shards、build artifact lanes 和 concurrency cancellation：`https://raw.githubusercontent.com/openclaw/openclaw/main/.github/workflows/ci.yml`。
- OpenClaw getting-started/onboarding docs 覆盖 installer、daemon、gateway health、dashboard、first message、locale、provider auth、workspace、channels、daemon、skills：`https://docs.openclaw.ai/start/getting-started` 与 `https://docs.openclaw.ai/start/wizard`。
- OpenClaw security docs 覆盖 trust model、`openclaw security audit`、incident response、secret scanning、dependency lock 和 file-operation hardening：`https://docs.openclaw.ai/gateway/security`。

本轮修正：

- 新增 `.github/workflows/ci.yml`，在 push/PR 运行 `npm test`、`cargo test`、Rust clippy、Rust fmt、`git diff --check` 和 tracked `.aetherion`/`target` artifact guard。
- README/README.zh-CN 增加 CI badge。
- CONTRIBUTING/CONTRIBUTING.zh-CN 增加与 CI 对齐的本地检查说明。
- 加固 `callSupervisorRpc` 的进程失败诊断：非零退出会报告 exit code、command、stdout line count 和 stderr 状态，但不会把 raw stdout payload 泄漏进错误消息。

验证：

- workflow YAML 已用 Ruby YAML loader 解析通过。
- `npm test`：130 个测试通过。
- `cargo test`：39 个 Rust 测试通过。
- `cargo clippy --all-targets --all-features -- -D warnings`：通过。
- `cargo fmt --check`：通过。
- `git diff --check`：通过。
- `git ls-files .aetherion target`：没有 tracked runtime/build artifacts。
- 新增回归测试证明 supervisor process failure 不再产生空白 `supervisor rpc failed:`，且不会泄漏 raw stdout。

与原始构想对照：

- 不改变 V1 TUI-first 范围。
- 不启用 GUI、IM、browser automation、MCP/OAuth connector 或 cloud worker。
- 不改变 Local Supervisor、Tool Policy Proxy、Event Ledger 权限语义。
- 强化的是验证和 review discipline，而不是扩大 runtime surface。

剩余差距：

- 仍缺 OpenClaw 级别的 install/onboarding automation、daemon lifecycle commands、release packaging、channel/connector runtime、security audit command parity、dependency-lock/release reproducibility policy、platform matrices 和 public docs deployment。

## Phase 44 复核：Store 信任锚与 Provider 失败边界

本轮两个子智能体以 OpenClaw 生产完整度和严格 bug/security 视角复查后指出两个高风险问题：

- Store Package 之前携带自己的 `public_key_pem`，签名验证只证明“包由包内 key 签过”，不能证明 publisher authenticity。
- Store install 之前只读取 package 内 `replay_tests[*].status` 和 `sandbox_trial.status`，没有解析本地 Replay Record 或 sandbox artifact。
- provider adapter 没有 timeout/abort，且 malformed JSON/HTTP error 覆盖不足。

本轮修正：

- 新增 `store trust-publisher`，把本地 operator 审核过的 publisher key 写入 `store-publishers` projection，并记录 key fingerprint。
- `store install` 现在必须用本地 trust anchor 验签，解析本地 `replay-records`，校验 sandbox file hash，并检查 Capsule integrity digest。
- Capsule Install artifact 新增 `publisher_key_fingerprint`、`replay_record_ids` 和 `sandbox_content_sha256`。
- provider 调用新增 `AETHERION_MODEL_TIMEOUT_MS`、`AbortController`、provider-scoped timeout/HTTP/malformed-JSON 错误，同时继续不回显 raw provider body。
- README、package docs、原始 docs、schema governance 和中文伴读文档都同步了新的 trust/evidence 表述，并在关键原始 docs 中加了 implementation tracking links。

与原始构想对照：

- `docs/00-product-brief.md`：Capability Capsule 仍是 governed unit，不允许 generated/imported package 绕过测试、policy 或 approval。
- `docs/01-architecture.md`：Store/client surface 不是 trust root；Local Supervisor 与 Event Ledger 仍是 authority/fact layer。
- `docs/04-skill-and-scaffold-os.md`：外部/生成 package 仍保持隔离，不能靠 package 自带声明获得权限。
- `docs/09-computer-use-implementation.md`：package、网页、IM、模型输出都属于 tainted/client-side input，不能授权动作。
- `docs/11-migration-and-runtime-economics.md`：未来 Capsule Store 是低信任市场，不是 plugin free-for-all。
- `docs/13-schema-runtime-governance.md`：fixture、projection row 和 schema validity 不是 runtime evidence。

验证：

- `node --test packages/surface-os/test/surface-os.test.ts packages/harness-core/test/harness-core.test.ts packages/tui/test/tui.test.ts`：80 个测试通过。
- 新增/更新测试覆盖 unregistered publisher、package key substitution、missing replay evidence、sandbox hash mismatch、provider malformed JSON、HTTP body 不泄漏、provider timeout。
- 全量 gate 通过：`npm test`（131 个测试）、`cargo test`（39 个 Rust tests）、`cargo clippy --all-targets --all-features -- -D warnings`、`cargo fmt --check`、workflow YAML 解析、`git diff --check`、`git ls-files .aetherion target` 和本地 Markdown link existence check。

剩余边界：

- Store trust 仍是 local-only。还没有 remote Capsule marketplace、transparency log、revocation feed、public publisher identity、release evidence repository 或 package-code execution。
- provider hardening 仍是 no-tools/no-streaming/hash-only；没有 OAuth flow、token refresh、vault storage 或 connector grant。

## 验证要求

每轮结束应至少检查：

- schema/example validation。
- harness-core/TUI 测试。
- Rust supervisor 测试。
- `git diff --check`。
- `.aetherion/`、`target/` 等 runtime/build artifact 未被提交。
- 本文件和 `docs/14-runtime-loop-plan.md` 是否说明与原始构想的偏差和修正。
