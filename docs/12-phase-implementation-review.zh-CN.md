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
- `store install` 现在必须用本地 trust anchor 验签，解析本地 replay evidence，校验 sandbox file hash，并检查 Capsule integrity digest。
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

## Phase 45 复核：只读 Doctor 与 Ledger-backed Evidence Gates

本轮继续按 OpenClaw 生产完整度和严格 bug/security 视角复查。Aetherion 已有较强的本地证据链，但缺少单入口只读 operator readiness surface；同时 audit 与 Store install 仍有投影状态被误当成可信证据的风险。

与原始文档对照：

- `docs/00-product-brief.md`：重要动作必须能通过 logs、source references、decisions、approvals 和 replay artifacts 重建；本轮让 readiness 与 Store install 依赖已记录证据，而不是 projection comfort。
- `docs/01-architecture.md`：Local Supervisor 仍是 root authority，Event Ledger 仍是 fact layer；client surface、Store 和 projection 不能变成 trust root。
- `docs/05-audit-and-data-contracts.md`：human-readable state 是 source of truth，SQLite、registry 和其他 index 是 rebuildable projection。
- `docs/06-roadmap.md`：继续优先强化 TUI/Rust kernel loop 的生产纪律，而不是启用 GUI、IM、browser automation、MCP/OAuth connector 或 cloud worker。
- `docs/10-technical-strategy.md`：TypeScript 仍负责 contract/TUI iteration，Rust 仍负责 authority boundary；本轮没有把 Python 或外部工具放进 authority path。
- `docs/13-schema-runtime-governance.md`：直接落实 “projection 不是 source of truth” 和 “fixture 不是 runtime evidence”。

本轮修正：

- 新增 `ether doctor --workspace <path>` 只读生产就绪报告，检查 repo governance files、双语 docs links、CI/script/artifact-guard expectations、schema/example baselines、workspace identity、Event Ledger hash-chain validity 和 run-manifest presence。
- `doctor` 输出 operator-level `ready`、`degraded` 或 `blocked`，并保留 per-check `pass`/`warn`/`fail`/`not_applicable` 细节。它不会初始化 `.aetherion`、追加 event、修改 registry、写 artifact、调用 provider、发 lease 或 repair state。
- 所有 `audit *` topic 现在会先验证 workspace Event Ledger hash chain。Ledger 被篡改时会 fail closed 并报告 `broken_at=<event_id>`，不会继续对坏 JSONL 输出 `strong` 或 `matched`。
- `store install` 不再把 `replay-records` registry row 当安装证据。它现在从 hash-chain-verified 的 `replay.recorded` Ledger events 和本地 Replay Record artifacts 解析 replay evidence，并检查 source events 后再进入 Capsule Install validation。
- README、TUI README、中文伴读文档和 command help 已把新 operator surface 链回 implementation tracking docs。

验证：

- 目标 TUI 测试：`node --test packages/tui/test/tui.test.ts` 通过 32 个测试。
- 新增测试覆盖：未初始化 workspace 上运行 `doctor` 不创建 `.aetherion`；已初始化 workspace 上运行 `doctor` 不修改 Ledger/run files；Ledger hash chain 被篡改时 audit fail closed；Store 拒绝 registry-only fake replay evidence。

修正与剩余边界：

- 修正 OpenClaw-like operator surface 差距：现在有单一 machine-readable readiness report 覆盖当前 repo/workspace invariants。
- 修正 trust-boundary 偏差：audit 与 Store install 不再依赖未验证 JSONL/projection state。
- 本轮仍不增加 GUI、browser automation、IM delivery、MCP/OAuth connector、daemon lifecycle start/stop/recover、package-code execution、cloud worker 或 remote marketplace。
- 剩余严格复查差距包括 first-class `ether security audit`、更完整的 CI artifact leakage denylist、release/install/onboarding automation、platform/release matrix、dependency/reproducibility policy，以及把 `prompt invoke-model` 默认 stdout 从 raw model output 改为 hash/metadata-only。

## Phase 46 复核：只读 Security Audit 与模型输出默认收敛

本轮关闭严格复查指出的下一组 security-readiness gap：仓库缺少一等公民只读 security audit，CI artifact guard 仍是内联且不完整的 denylist，model invocation stdout 默认暴露 raw output。

与原始文档对照：

- `docs/00-product-brief.md`：安全必须能通过可审计 evidence 检查，而不是相信 agent output。
- `docs/01-architecture.md`：Local Supervisor 仍是 root authority，Event Ledger 仍是 fact layer；新 audit 只 inspection，不授予或修复 authority。
- `docs/05-audit-and-data-contracts.md`：generated runtime files、local vault-like roots 和 artifacts 默认不应进入 tracked governance sources，除非被有意提升。
- `docs/06-roadmap.md`：继续先硬化 TUI-first V1 path，再启用 GUI、IM、browser automation、MCP/OAuth connector、cloud worker 或 package execution。
- `docs/13-schema-runtime-governance.md`：model output、audit pass、projection row 和 CI check 都不是 runtime authority。
- `docs/14-runtime-loop-plan.md`：本轮执行 planned read-only `ether security audit` increment，并把边界写回原始 runtime plan。

本轮修正：

- 新增 `ether security audit --workspace <path>` deterministic read-only JSON report，覆盖 tracked secret material、tracked runtime/build artifact roots、现有 `.aetherion` artifact raw sensitive fields、workspace Ledger hash-chain validity、CI guard wiring 和 model stdout default。
- 新增 `tools/forbidden-tracked-roots.txt` 作为 CI 与 `security audit` 的共享 denylist，把 `vault`、`memory-vault`、`local-data` 纳入 runtime/build/test/report roots 同一检查面。
- `prompt invoke-model` 默认 stdout 改为 hash/metadata-only。raw model output 只有显式 `--print-output` 才回显，仍不持久化，也不能授权 tool request 或 action。
- `doctor` 已识别共享 CI denylist；command help、README、TUI README 和 docs 都把新 surface 链回 implementation tracking docs。

验证：

- 目标 TUI 测试：`node --test --test-name-pattern "TUI help|TUI doctor|Ether security audit|TUI exposes local-only phase command surfaces" packages/tui/test/tui.test.ts` 通过 6 个测试。
- 新增/更新测试覆盖：未初始化 workspace 上运行 `security audit` 不创建 `.aetherion`；Ledger hash chain 被篡改时 security audit fail closed 并产出 report finding；shared denylist evidence 包含 sensitive local roots；默认 `prompt invoke-model` stdout 不含 `output_text`；`--print-output` 显式 opt-in 行为。

修正与剩余边界：

- 修正 OpenClaw-like security audit parity gap，但不新增 repair tool、dependency scanner、live connector probe、package sandbox、OAuth flow 或 secret vault。
- 修正 local/operator stdout 默认 raw-output 泄漏风险，同时保留显式本地 operator debugging 入口。
- 本轮仍不增加 GUI、browser automation、IM delivery、MCP/OAuth connector、daemon lifecycle start/stop/recover、package-code execution、cloud worker 或 remote marketplace。
- 剩余严格复查差距包括 install/onboarding automation、release packaging、platform/release matrix、dependency/reproducibility policy、public docs deployment 和更深入的 dependency audit evidence。

## 验证要求

每轮结束应至少检查：

- schema/example validation。
- harness-core/TUI 测试。
- Rust supervisor 测试。
- `git diff --check`。
- `.aetherion/`、`target/` 等 runtime/build artifact 未被提交。
- 本文件和 `docs/14-runtime-loop-plan.md` 是否说明与原始构想的偏差和修正。
