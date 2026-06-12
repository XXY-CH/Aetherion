# 阶段实现复核

[English](12-phase-implementation-review.md)

本文件是阶段结束复核 ledger 的中文伴读版。英文原文是逐轮追加的完整运行记录；本文件保留最新复核逻辑和主要偏差修正点，帮助中文读者快速核对项目是否仍符合原始构想。

不变约束：V1 是 TUI-first。后续 GUI、IM、浏览器、connector 和 store surface 都只是 client surface，不能成为 trust root。

schema 增长现在由 `docs/13-schema-runtime-governance.md` 治理：P0 kernel contracts 需要 executable/replay evidence，P1 product-runtime contracts 需要 source-backed command paths，P2 innovation contracts 除非被低层 runtime loop 需要，否则应冻结。

## 计划轮：生产缺口补全计划

与原始文档对照：

- `docs/00-product-brief.md`：计划继续把 Aetherion 定义为 local-first Agent Harness Kernel，不变成 chatbot 或 replacement OS。
- `docs/01-architecture.md`：计划按用户给定 architecture stack 建 gap matrix，并保留 Local Supervisor、Event Ledger、Tool Access & Action Policy Proxy 的 authority/fact/action 边界。
- `docs/06-roadmap.md`：计划保持 V1 TUI-first；GUI、mobile、IM、browser automation、MCP/OAuth/SaaS connector 和 cloud worker 仍等待明确 gate。
- `docs/10-technical-strategy.md`：计划保留 TypeScript 做 contract/orchestrator iteration，Rust 做 authority、policy、vault、ledger、sandbox 和 native execution。
- `docs/13-schema-runtime-governance.md`：计划继续把 schema、fixture、projection 和 client surface 视为 non-authority，并优先关闭 executable runtime loops。
- `docs/14-runtime-loop-plan.md`：计划把现有 runtime loop discipline 扩展成生产缺口补全索引和每轮 drift protocol。

本轮落地：

- 新增[生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md) / [Production Gap Closure Plan](15-production-gap-closure-plan.md)。
- README 与原始源文档的 implementation-tracking 行都链接到该计划。
- 新计划按 Client Surfaces、Ingress Gateways、Local Supervisor、Agent Orchestrator、Memory OS、Capability OS、Proactive Engine、Tool Access & Action Policy Proxy、Connector/Execution Adapters、Observations/Results/Artifacts、Event Ledger/Projections 逐层列出现状、缺口和补全方向。
- 明确区分当前 no-tools provider support 与未来 OAuth connector/account-linking：外部提供 bearer token 仍可用于支持的 provider，但 browser OAuth flow、token refresh、vault persistence 和 connector grant 仍是 future gated work。

修正与剩余边界：

- 本轮只是计划，不实现 release packaging、remote CI attestation、daemon lifecycle management、vault storage、ingress gateway、真实 OAuth connector、GUI、browser extension、IM delivery、mobile app、cloud worker execution 或 package-code runtime。
- 下一实现轮优先从 PGC-1 release/readiness evidence hardening 开始，除非当前出现更紧急的 production-readiness bug。

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

- `npm test`：143 个测试通过。
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

## Phase 47 复核：Dependency Reproducibility 与 Audit Evidence

本轮关闭严格 OpenClaw 对照和两个子智能体指出的 dependency/reproducibility evidence gap。此前根 Node surface 没有 lockfile，`npm audit` 会因 `ENOLOCK` 失败，Cargo 命令未使用 `--locked`，CI 也没有运行文档中声明的 operator readiness snapshots。

与原始文档对照：

- [产品简报](00-product-brief.zh-CN.md)：重要动作和 release posture 应能从 durable evidence 重建。
- [审计与数据合同](05-audit-and-data-contracts.zh-CN.md)：verification evidence 应通过 human-readable state 和可 review workflow config 可复现。
- [路线图](06-roadmap.zh-CN.md)：先强化 TUI/Rust loop 的生产纪律，再扩展 GUI、IM、browser、connector、cloud 或 platform matrix。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：dependency/audit result 是 repo readiness evidence，不是 runtime authority 或 policy decision。
- [运行时闭环计划](14-runtime-loop-plan.zh-CN.md)：本轮跟进 security-audit increment 后剩余的 dependency/reproducibility gap。

本轮修正：

- 新增已提交的根目录 `package-lock.json`，即使根 npm dependency 当前为 0，`npm ci --ignore-scripts` 和 `npm audit --audit-level=high --json` 也能从 repo state 可复现。
- Rust scripts/docs/CI gates 改为 `cargo test --locked` 和 `cargo clippy --all-targets --all-features --locked -- -D warnings`。
- CI 用 `--locked` 安装 pinned `cargo-audit`，运行 `cargo audit`，并把 `npm run ether -- doctor --workspace .` 与 `npm run ether -- security audit --workspace .` 作为 operator readiness snapshots。
- `doctor` 现在报告 dependency lockfile state，并要求 CI dependency/readiness gates。
- `security audit` 现在会在 lockfile 或 workflow gate 漂移时报告 dependency reproducibility 与 CI dependency/readiness guard findings。
- README、CONTRIBUTING、TUI README 和中文伴读文档记录当前 zero-root-JS-dependency 状态、lockfile policy、locked Rust commands，以及 `promo/` 不属于 release evidence。

验证：

- `npm ci --ignore-scripts` 可从 committed lockfile 成功执行。
- `npm audit --audit-level=high --json` 报告 0 vulnerabilities。
- 目标 TUI doctor/security tests 断言 dependency lockfile 与 CI dependency/readiness checks。

修正与剩余边界：

- 修正 root Node `ENOLOCK` audit gap 和 unlocked Cargo command drift，没有新增 npm runtime dependency。
- 修正文档/CI 偏差：`doctor` 和 `security audit` 已存在但此前没有作为 release evidence 运行。
- 本轮仍不增加 release packaging、artifact signing、update infrastructure、platform matrix execution、public docs deployment、dependency auto-remediation、GUI、browser automation、IM delivery、MCP/OAuth connector、package-code execution、cloud worker 或 remote marketplace。
- 剩余严格复查差距包括 install/onboarding automation、release packaging、platform/release matrix、public docs deployment 和更深入的 release artifact evidence。

## Phase 48 复核：CI Platform Smoke 与 Action Runtime Evidence

本轮修正上一轮远端绿灯后暴露的窄 CI/release-evidence 偏差：GitHub Actions 虽然成功，但给出 Node.js 20 JavaScript action-runtime deprecation annotation，而且仓库仍没有跨平台 smoke lane。这与严格 OpenClaw 对照里记录的 platform/release evidence gap 不完全对齐。

与原始文档对照：

- [产品简报](00-product-brief.zh-CN.md)：readiness claim 应继续依赖 durable、可 review evidence，而不是本地一次性成功。
- [路线图](06-roadmap.zh-CN.md)：先围绕 TUI/Rust loop 扩大生产纪律，再进入延后的 GUI、IM、browser、connector、cloud 或 marketplace surface。
- [运行时闭环计划](14-runtime-loop-plan.zh-CN.md)：本轮跟进 dependency reproducibility 后仍剩余的 platform matrix 与 release-evidence gap。
- [审计与数据合同](05-audit-and-data-contracts.zh-CN.md)：CI workflow config 是 human-readable、可 review、可重放的 evidence。

本轮修正：

- CI 使用 `actions/checkout@v5` 与 `actions/setup-node@v5`，保留 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` 作为显式 runtime baseline，并用 `package-manager-cache=false` 关闭 setup-node package-manager auto-cache。
- CI 新增覆盖 `ubuntu-latest` 与 `macos-latest` 的 `platform-smoke` job。
- platform smoke lane 运行 `npm ci --ignore-scripts`、聚焦的 contract/provider/TUI-help Node test subset、`cargo test --locked`、`npm run ether -- doctor --workspace .` 和 `npm run ether -- security audit --workspace .`。
- `doctor` 与 `security audit` 现在要求 `.github/workflows/ci.yml` 中存在 Node 24 action-runtime baseline 与 platform-smoke evidence。
- README、CONTRIBUTING、TUI README 和中文伴读文档记录 platform-smoke 与 action-runtime evidence。

验证：

- 本地 workflow YAML 解析通过。
- 目标 TUI doctor/security tests 断言 platform-smoke 与 Node 24 action-runtime evidence。
- Markdown relative-link verification 覆盖新增链接。

修正与剩余边界：

- 修正 CI/release-evidence 偏差，但不新增 release packaging、artifact signing、public docs deployment、installer/updater infrastructure 或真实 platform packages。
- macOS/Ubuntu lane 是 smoke matrix，不是完整 OpenClaw-class platform/release matrix。
- 本轮仍不启用 GUI、browser automation、IM delivery、MCP/OAuth connector、package-code execution、cloud worker 或 remote marketplace。
- 剩余严格复查差距包括 install/onboarding automation、release packaging、更深入的 release artifact evidence、public docs deployment 和更广的 platform/release matrix。

## Phase 49 复核：Provider No-Tools 硬失败边界

本轮关闭 bounded security review 指出的 no-tools provider-boundary 偏差。Aetherion 已支持 OpenAI Responses、OpenAI Chat Completions、Anthropic Messages 和 Gemini `generateContent`，但 provider tool/function-call output 之前主要作为 metadata 表达。严格 no-tools runtime 应在写入成功 model-response 或 response-audit evidence 前拒绝这些输出。

与原始文档对照：

- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：model output 不能授权 action、追加 tool request event、发 lease 或触发 side effect。
- [运行时闭环计划](14-runtime-loop-plan.zh-CN.md)：provider hardening 仍是 no-tools/hash-only，不增加 OAuth flow、connector grant、provider tool 或 side effect。
- [路线图](06-roadmap.zh-CN.md)：OAuth/MCP/SaaS connector 仍延后，同时允许 TUI model-evidence path 调用选定 provider。
- [用户边界层](02-user-boundary-layer.zh-CN.md)：untrusted/model-derived content 不能绕过 policy 进入 action authority。

本轮修正：

- live provider 映射结果一旦包含 tool/function call 或 executable-code 形态就 fail closed。
- 覆盖 OpenAI Responses call-type output、OpenAI Chat Completions `tool_calls`、Anthropic `tool_use` 和 Gemini `functionCall`/`executableCode`。
- fail-closed 检查位于 provider boundary 内，早于 `prompt invoke-model` 写 hash-only response evidence 或本地 response-audit evidence。
- 文档澄清支持的是 `openai_chat_completions` 这个 OpenAI completion-style surface，不是 legacy `/v1/completions` 实现。
- OAuth 仍仅限 provider 支持路径上的外部 bearer-token env var；Aetherion 不运行 OAuth、不持久化 token、不 refresh grant，也不创建 connector authority。

验证：

- provider unit tests 模拟四类 tool-call output family 并断言 no-tools failure。
- 既有 provider tests 继续覆盖 endpoint、header、body、credential、timeout、HTTP error 和 malformed JSON 行为。

修正与剩余边界：

- 将 no-tools 从描述性 metadata flag 修正为 live model call 的强制 provider boundary。
- 本轮仍不增加 streaming、多模态 payload、provider tool execution、browser OAuth、token refresh、vault storage、connector grant 或 live-provider CI probe。
- 剩余 provider hardening gap 包括 optional live contract probes、更细 provider refusal taxonomy，以及禁止 workflow 意外使用 `--print-output` 的显式 CI guard。

## Phase 50 复核：Release Evidence Snapshot

本轮关闭下一层窄 release-evidence gap：`doctor` 和 `security audit` 已经是 machine-readable，但 operator 仍缺少一个本地 snapshot，把 git state、CI configuration、dependency reproducibility、governance/docs posture、runtime readiness、security posture、source-doc grounding 和剩余 release gaps 汇总到一起。

与原始文档对照：

- [产品简报](00-product-brief.zh-CN.md)：release/readiness claim 应建立在 durable、可 review evidence 上，而不是一次性本地记忆。
- [审计与数据合同](05-audit-and-data-contracts.zh-CN.md)：workflow、lockfile、governance 和 Ledger state 继续是 human-readable 或可重建 evidence，不是 opaque generated authority。
- [路线图](06-roadmap.zh-CN.md)：本轮仍在 TUI-first kernel loop 内，不进入 GUI、IM、browser、MCP/OAuth connector、cloud、marketplace 或 release-packaging 范围。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：evidence aggregation 不会变成 runtime authority、lease、policy approval 或新 trust root。
- [运行时闭环计划](14-runtime-loop-plan.zh-CN.md)：本轮实现计划中的 local/configured release-evidence snapshot。

本轮修正：

- 新增 `npm run ether -- release evidence --workspace <path>`。
- 报告包含 git branch/head/dirty state、configured CI gate drift、Node 24 action-runtime evidence、Ubuntu/macOS platform-smoke configuration、dependency lockfile evidence、governance-file evidence、bilingual-doc evidence、`doctor` 摘要、`security audit` 摘要、workspace runtime/Ledger state、source-document links 和明确的剩余 release gaps。
- 报告用 `checks_remote_ci=false`、`remote_ci_checked=false`、`packaged=false`、`signed=false`、`published=false` 区分 local/configured evidence 与 remote/executed proof。
- CI 现在把 `release evidence` 与 `doctor`、`security audit` 一起运行；CI gate checks 要求三项 operator snapshots 都保留。
- README、CONTRIBUTING、TUI README 和中文伴读文档都链接了新命令和边界。

验证：

- 目标 TUI tests 覆盖 help text、空 workspace 只读行为、已初始化 workspace 不变更行为，以及既有 doctor/security snapshots。
- release report 会记录 dirty worktree state，但不把 unrelated local files 当成 remote release failure。

修正与剩余边界：

- 修正单一 release-evidence snapshot 缺口，但不新增 release packaging、artifact signing、public docs deployment、package publication、installer/updater infrastructure、remote CI querying 或 release evidence repository。
- `release evidence` 只是 local/configured source evidence；除非另行执行 external remote check，不能描述为 latest GitHub Actions 已成功的证明。
- 本轮仍不启用 GUI、browser automation、IM delivery、MCP/OAuth connector、package-code execution、cloud worker 或 remote marketplace。
- 剩余严格复查差距包括 install/onboarding automation、release packaging、artifact signing、public docs deployment、更广 platform/release matrix artifacts，以及 remote/executed release evidence。

## Phase 51 复核：From-Source Onboarding Preflight

本轮在不假装已有 installer 的前提下缩小 guided-onboarding gap。release evidence 之后，fresh clone 已能证明 repo readiness，但仍缺一个命令回答：“这台机器能不能从源码安全开始，下一步该跑什么？”

与原始文档对照：

- [产品简报](00-product-brief.zh-CN.md)：onboarding 仍是 local-first、evidence-backed，不是 account-linking 或 cloud bootstrap。
- [路线图](06-roadmap.zh-CN.md)：本轮仍在 V1 terminal/kernel path 内，不增加 GUI、IM、browser、MCP/OAuth connector、cloud worker 或 release packaging。
- [技术策略](10-technical-strategy.zh-CN.md)：TypeScript 仍是 contract/TUI iteration surface；Rust 仍保留给 supervisor authority boundary。
- [运行时闭环计划](14-runtime-loop-plan.zh-CN.md)：本轮实现 planned from-source onboarding preflight slice。

本轮修正：

- 新增 `npm run ether -- onboarding check --workspace <path>`。
- 报告区分 `toolchain_ready`、`repo_ready`、`workspace_runtime_state` 和 `next_steps_ready`。
- 检查 Node、npm、git、rustc、cargo、可选 cargo-audit、repo scripts、dependency lockfiles、CI gates、governance files、双语文档、onboarding doc links 和 workspace runtime state。
- 缺失 `.aetherion` 会被解释为 `not_initialized`，不是 broken state。
- 命令输出 next-step commands，但不执行它们。
- CI 现在把 `onboarding check` 与已有 operator snapshots 一起运行。
- README、CONTRIBUTING、TUI README 和中文伴读文档都链接了该命令和只读边界。

验证：

- 目标 TUI tests 覆盖 help text、fresh-clone onboarding、已初始化 workspace 不变更行为，以及缺失本机 toolchain 的 failure reporting。

修正与剩余边界：

- 修正 from-source onboarding preflight 缺口，但不新增 installer/updater automation、package installation、daemon lifecycle commands、provider auth wizard、connector account linking、public docs deployment、release packaging、artifact signing 或 remote CI querying。
- 本轮仍不启用 GUI、browser automation、IM delivery、MCP/OAuth connector、package-code execution、cloud worker 或 remote marketplace。
- 剩余严格复查差距包括真实 installer/updater automation、release packaging、artifact signing、public docs deployment、更广 platform/release matrix artifacts，以及 remote/executed release evidence。

## Phase 52 复核：Source Document Governance Links

本轮修正 source-document discoverability gap：治理文件已经存在，operator snapshot 也会检查它们，但原始产品/源文档还没有直接把构想文档连到贡献、行为准则、安全、许可、issue 和 PR 工作流合同。

与原始文档对照：

- [产品简报](00-product-brief.zh-CN.md)：协作表面应服务 local-first governance 和项目清晰度，但不能变成 runtime authority。
- [审计与数据合同](05-audit-and-data-contracts.zh-CN.md)：human-readable workflow docs 与 GitHub templates 是可 review 的 governance artifacts，不是 opaque generated state。
- [路线图](06-roadmap.zh-CN.md)：Phase 0 foundation docs 现在指向更宽产品表面扩张前需要的贡献与 review gates。
- [技术策略](10-technical-strategy.zh-CN.md)：本轮只是 documentation/source-link 增量，不改变 TypeScript/Rust authority ownership。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：治理 docs 与 templates 仍是 human contracts，不授予 lease、policy approval、provider credential 或 runtime authority。

本轮修正：

- README 根入口新增治理与协作章节，链接 Code of Conduct、Contributing、Security Policy、MIT License、issue templates 和 pull request template，并在存在中文伴读时链接中文版本。
- 在原始源文档及中文版本中加入匹配的 governance-link 行和 README 命令/readiness 入口链接：产品简报、审计与数据合同、路线图、技术策略、Schema 运行时治理。
- 链接保持 repo-relative Markdown references，因此本地 clone 和 GitHub 都能直接跳转。

验证：

- Markdown relative-link verification 覆盖新增 source-document links。
- operator snapshots 仍检查 governance-file presence 与 bilingual documentation posture。

修正与剩余边界：

- 本轮只修正文档导航缺口；不新增 workflow engine、issue triage bot、private security intake backend、release automation 或 runtime policy mechanism。
- 本轮仍不启用 GUI、browser automation、IM delivery、MCP/OAuth connector、package-code execution、cloud worker 或 remote marketplace。
- 剩余严格复查差距包括 installer/updater automation、release packaging、artifact signing、public docs deployment、更广 platform/release matrix artifacts，以及 remote/executed release evidence。

## Phase 53 复核：Supervisor RPC Stdin Failure Normalization

本轮修复 CI 暴露的 supervisor RPC client failure mode。process-failure test 期望非零退出的 supervisor subprocess 通过安全的 process-failure summary 报告，但 GitHub Actions 上可能先暴露 stdin `EPIPE`，早于 close handler 生成该 summary。

与原始文档对照：

- [技术策略](10-technical-strategy.zh-CN.md)：TypeScript supervisor client 必须只通过结构化 RPC 边界接收 evidence，并在 malformed 或 failed supervisor process 上 fail closed。
- [审计与数据合同](05-audit-and-data-contracts.zh-CN.md)：failure report 应可重建，但不能泄露 raw stdout payload。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：supervisor/client failure handling 是 runtime-boundary hardening，不是新 feature 或 authority path。

本轮修正：

- `callSupervisorRpc` 现在在写 request 前先挂 stdin `error` 和 `close` listener。
- 早到的 stdin write error 会被捕获，不再作为裸 stream error 泄出。
- 非零 supervisor exit 仍使用现有 sanitized process-failure summary，包括 stdout line count，但不包含 stdout contents。

验证：

- 目标 Node test 覆盖 `supervisor RPC client reports process failures without raw stdout leakage`。
- 提交前需要完整本地 verification。

修正与剩余边界：

- 修正 cross-platform/race-sensitive RPC client error-normalization gap；不改变 supervisor policy、lease、action execution、raw stdout persistence 或 socket RPC semantics。
- 本轮仍不启用 GUI、browser automation、IM delivery、MCP/OAuth connector、package-code execution、cloud worker 或 remote marketplace。

## Phase 54 复核：Remote Evidence Snapshot 与 Release Manifest Contract

本轮启动 `.omx/plans/aetherion-production-gap-closure-plan.md` 交接的 PGC-1 release/readiness evidence 工作。此前 release snapshot 只能用 `checks_remote_ci=false` 区分 local configured evidence 与 executed proof；还没有 schema-locked release manifest，也没有入口读取 operator-observed CI/CodeQL 状态。

与原始文档对照：

- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：PGC-1 要求先补 remote CI/CodeQL evidence 和 release manifest schema，再进入更深 packaging/release automation。
- [审计与数据合同](05-audit-and-data-contracts.zh-CN.md)：evidence record 必须可 review，并与 runtime authority 分离。
- [路线图](06-roadmap.zh-CN.md)：本轮留在 V1 TUI/readiness lane，不新增 GUI、IM、browser automation、MCP/OAuth connector、cloud worker 或 package-code execution。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：schema change 由真实 readiness command path 支撑，不是 speculative surface expansion。

本轮修正：

- `release evidence` 新增 `--remote-evidence <snapshot.json>`，只读取 workspace-local operator-supplied CI/CodeQL snapshot。
- 报告现在把 `remote_observed_evidence` 与 `configured_evidence` 并列输出，并增加 `remote_ci_status`、`remote_codeql_status` 和 `commit_matches_head`。
- 缺失 remote evidence 会让 release report 保持 `draft`；remote evidence 无效、CI/CodeQL 失败或 commit mismatch 会阻断 release report。
- 新增 `schemas/release-manifest.schema.json` 和 `examples/contracts/release-manifest.json`。
- README 和 TUI README 记录 optional snapshot，并明确命令不会 live 查询 remote CI。

验证：

- 目标测试通过：`node --test --test-name-pattern "release evidence|contract examples" packages/tui/test/tui.test.ts packages/harness-core/test/harness-core.test.ts`。
- 最终 help-test 文案更新后已完成完整验证：`npm test`（143 个测试通过）、focused supervisor/TUI stability loop 5/5 通过、`cargo test --locked`（39 个 Rust 测试通过）、`cargo clippy --all-targets --all-features --locked -- -D warnings`、`cargo fmt --check`、`git diff --check`、`npm audit --audit-level=high --json` 且 0 vulnerabilities、`doctor` ready、`security audit` pass、`release evidence` 因本地改动和 remote evidence 尚未提交/提供而保持 draft。

偏差复核：

- 本轮修正 PGC-1 release-evidence gap，但不新增 live GitHub client、release package、签名、public docs deployment、installer/updater 或 release evidence repository。
- 严格回看 source docs 后发现独立 scope drift：默认 CLI 已暴露很多 post-V1 contract/runtime lab 命令。它们多数仍是 non-authorizing，但下一切片应做 V1 Core Profile Gate，避免 V1 release readiness 与 post-V1 surface breadth 混淆。

修正与剩余边界：

- Remote evidence 是 operator-supplied snapshot，不是 live remote attestation。
- Release Manifest 是 contract/example baseline，不是 generated signed release artifact。
- 剩余严格复查差距包括 V1 Core Profile Gate、live remote CI/CodeQL reader、release packaging、artifact signing、public docs deployment、installer/updater automation、更广 platform/release matrix artifacts，以及更深 supervisor/vault/ingress lifecycle work。

## Phase 55 复核：V1 Core Profile Gate

本轮跟进上一轮严格 source-document drift review。仓库已经在 prose 中标注后续命令是 post-V1，但 `onboarding check` 和 `release evidence` 还没有输出 machine-readable V1 boundary，help 测试也没有证明 V1 core section 排除了 post-V1 labs。

与原始文档对照：

- [产品简报](00-product-brief.zh-CN.md)：V1 是 TUI-first，后续 GUI、IM、browser、connector、cloud 和 package-code surfaces 继续 deferred。
- [路线图](06-roadmap.zh-CN.md)：第一版 runnable product 是 local kernel loop 加 readiness evidence，不是整个 trace-backed lab surface。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：production-parity 压力不能导致 V1 surface creep。

本轮修正：

- `onboarding check` 和 `release evidence` 新增 `v1_core_profile`。
- profile 将 V1 release-critical product commands、release-supporting readiness commands 和 post-V1 contract/surface labs 分开。
- `security audit` 明确是 release-supporting evidence，不是 V1 core 产品命令。
- 如果未来改动导致 V1 release-critical commands 与 post-V1 labs 重叠，`release evidence` 会阻断。
- help 文案将后续命令块标为 “Post-V1 / experimental local contract labs (not V1 release-critical)”。
- help 测试现在按 section 切片 V1 core 段，并断言 post-V1 command families 不出现在其中。

验证：

- 目标测试通过：`node --test --test-name-pattern "help separates|onboarding check reports fresh|release evidence reports" packages/tui/test/tui.test.ts`。
- 完整验证已通过：`npm test`（143 个测试通过）、`cargo test --locked`（39 个 Rust 测试通过）、`cargo clippy --all-targets --all-features --locked -- -D warnings`、`cargo fmt --check`、`git diff --check`、`npm audit --audit-level=high --json` 且 0 vulnerabilities、`doctor` ready、`security audit` pass、`release evidence` draft 且 `v1_core_profile.status=pass`，forbidden tracked roots check 干净。

偏差复核：

- 修正已记录偏差：post-V1 contract/runtime labs 出现在默认 CLI surface 中，可能被误认为 V1 release scope。
- 这不降低 PGC-2/PGC-3 authority work 的优先级：supervisor lifecycle、vault refs 和 local ingress 仍是开放缺口。

修正与剩余边界：

- 这不是新的 runtime ability、daemon、vault、ingress gateway、packaging system、signing path 或 deployment path。
- 剩余严格复查差距包括 live remote CI/CodeQL reader、release packaging、artifact signing、public docs deployment、installer/updater automation、更广 projection parity coverage，以及更深 supervisor/vault/ingress lifecycle work。

## Phase 56 复核：Metadata-Only Vault Reference Contract

本轮启动 PGC-2 的 vault 部分，但不实现 vault backend。目标是让 credential material 先以 metadata-only 形式被引用和审计，给未来 policy/vault work 一个合同，同时避免当前报告误称已经有 raw-secret storage、OAuth、token refresh 或 connector grant。

与原始文档对照：

- [技术策略](10-technical-strategy.zh-CN.md)：vault 和 authority boundary 未来应由 Rust 拥有；本轮 TypeScript 只做 contract/readiness inspection。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：新增 schema surface 必须有 runtime tier，并对 raw secret 或 inherited authority 加负向测试。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：PGC-2 要求先做 vault/secret reference MVP，再进入真实 OAuth 或 connector 使用。
- [路线图](06-roadmap.zh-CN.md)：MCP/OAuth/SaaS connector 仍然 deferred from V1。

本轮修正：

- 新增 `schemas/vault-reference.schema.json` 和 `examples/contracts/vault-reference.json`，作为 metadata-only contract。
- 将 schema/example 加入现有 contract validation suite。
- 新增负向 schema 测试，拒绝 raw secret material、raw secret 对 Aetherion 可用、OAuth flow 已完成、connector grant 已创建，以及额外 raw-secret 字段。
- `doctor`、`onboarding check` 和 `release evidence` 现在输出 `vault_reference_contract` readiness evidence。
- README、package docs 和 schema governance docs 都说明 Vault Reference 是 metadata-only readiness evidence，不是 vault backend。

偏差复核：

- 修正潜在 schema-governance 偏差：`vault-reference` 被分到 P1 readiness/credential-boundary metadata tier。
- 修正 production-readiness gap：真实 OAuth/connector work 开始前，报告会检查 reference-only credential contract。
- 没有新增 GUI、browser automation、IM delivery、MCP/OAuth connector、cloud worker、package execution、raw secret persistence、token refresh 或 connector grant。

修正与剩余边界：

- 这不是 production vault、OS keychain integration、secret retrieval API、OAuth flow、token refresh path、connector grant lifecycle、policy lease 或 runtime authority grant。
- 剩余严格复查差距包括 supervisor lifecycle/vault binding design、local ingress、live remote CI/CodeQL observation、release packaging、artifact signing、public docs deployment、installer/updater automation 和更广 projection parity coverage。

## Phase 57 复核：Model Provider Readiness Contract

本轮跟进用户明确提出的 provider-support gap，但不扩大 connector authority。runtime code 已经有 OpenAI Responses、OpenAI Chat Completions、Anthropic Messages 和 Gemini `generateContent` 的 no-tools provider，但 release/readiness evidence 还没有把这个边界表示成 schema-checked contract。

与原始文档对照：

- [架构](01-architecture.zh-CN.md)：model provider call 留在 Agent Orchestrator evidence path；Connector Adapter 与 Tool Access & Action Policy Proxy 仍是独立 authority surface。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：readiness schema 必须对 raw payload、provider tool-call authority 和 OAuth/connector overclaiming 加负向测试。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：PGC-2 需要在真实 OAuth 或 connector grant 前锁住 credential/provider boundary。
- [路线图](06-roadmap.zh-CN.md)：OpenAI/Anthropic/Gemini provider portability 仍在 TUI-first evidence loop 内，MCP/OAuth/SaaS connector 继续 deferred from V1。

本轮修正：

- 新增 `schemas/model-provider-readiness.schema.json` 和 `examples/contracts/model-provider-readiness.json`。
- contract 命名 `openai_responses`、`openai_chat_completions`、`anthropic` 和 `gemini`，并列出当前 provider code 支持的 API-key env vars 与外部已获取 bearer-token env vars。
- contract 明确把 OAuth flow、token refresh、connector grant、streaming、多模态 payload 和 legacy OpenAI `/v1/completions` 标为未实现。
- 新增负向 schema 测试，拒绝 OAuth-flow、connector-grant、raw prompt/model payload、provider tool declaration、tool-call response persistence 和 model-output authority drift。
- `doctor`、`onboarding check` 和 `release evidence` 现在输出 `model_provider_readiness_contract` evidence，与 Vault Reference evidence 并列。
- README、TUI README、harness-core README、schema governance 和 runtime-loop docs 都澄清 OpenAI completion 支持指 Chat Completions，不是 legacy text completions。

偏差复核：

- 修正 readiness-evidence drift：provider support 已存在于 code 和 tests，但还没有 machine-readable release/readiness contract。
- 修正 “OpenAI completion” 的术语漂移风险：当前支持 surface 被命名为 OpenAI Chat Completions。
- 未实现 browser OAuth、provider auth wizard、token refresh、connector account linking、MCP/OAuth/SaaS connector、streaming、多模态 provider payload、provider tool execution 或 runtime authority grant。

修正与剩余边界：

- Model Provider Readiness 是 P1 readiness/credential-boundary metadata contract，不是 credential store、OAuth client、connector grant 或 policy lease。
- 剩余严格复查差距包括 supervisor lifecycle/vault reference binding design、local ingress、live remote CI/CodeQL observation、release packaging、artifact signing、public docs deployment、installer/updater automation、更广 projection parity coverage，以及未来在 policy 后面的 connector OAuth work。

## Phase 58 复核：Supervisor Lifecycle Readiness Contract

本轮继续推进 PGC-2，把当前 supervisor lifecycle boundary 做成可复查、可 release-check 的证据。仓库已有只读 `supervisor status` 和 `supervisor preflight`、foreground Unix socket binding、runtime-lock observation、stale-lock detection，以及这些路径不追加 Ledger event 的测试。缺口是还没有 schema-checked readiness contract 证明这并不是 production daemon lifecycle management。

与原始文档对照：

- [架构](01-architecture.zh-CN.md)：Local Supervisor 仍是 root authority，但 readiness metadata 和 runtime lock 不能授权 action。
- [技术策略](10-technical-strategy.zh-CN.md)：Rust 拥有未来 supervisor/vault/daemon authority boundary；TypeScript readiness reports 只能检查 evidence，不能成为 authority。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：readiness schema 必须分 tier，并拒绝 authority、repair、vault 和 daemon overclaim。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：PGC-2 要求在扩大 daemon behavior 前，先为 status/start/stop/recover-stale-lock 建立 typed lifecycle contracts。

本轮修正：

- 新增 `schemas/supervisor-lifecycle-readiness.schema.json` 和 `examples/contracts/supervisor-lifecycle-readiness.json`。
- contract 命名当前支持的 evidence：stdio RPC、foreground Unix socket mode、foreground workspace runtime lock、只读 `supervisor status` 和只读 `supervisor preflight`。
- contract 明确把 production daemon、service installation、background process manager、`supervisor start`、`supervisor stop`、`supervisor recover-stale-lock`、socket-auth lifecycle、vault backend、signer、process sandbox、cloud worker、stale-lock repair、runtime-lock authority、socket-token tool authority 和 supervisor lease issuance 标为未实现。
- 新增负向 schema 测试，拒绝 daemon、stale-lock repair、socket-auth persistence/vault backing、raw socket auth token 字段、raw supervisor secret availability、vault retrieval、socket-token authority、lifecycle lease authority 和 vault-backend overclaim。
- `doctor`、`onboarding check` 和 `release evidence` 现在输出 `supervisor_lifecycle_readiness_contract` evidence，与 Model Provider 和 Vault Reference readiness 并列。
- README、TUI README、harness-core README、supervisor README、schema governance 和 runtime-loop docs 都已同步中英文说明。

偏差复核：

- 修正 PGC-2 readiness drift：supervisor lifecycle behavior 已存在于 status/preflight code 和 tests，但 production reports 不能单独证明 unsupported daemon/recovery/vault boundary。
- 修正 lifecycle terminology drift 风险：foreground socket/runtime-lock evidence 可能被误认为 service installation、process management、crash recovery 或 stale-lock repair。
- 未实现 production daemon start/stop、service install、stale-lock recovery、crash recovery、socket token storage/rotation、device/user identity、vault-backed supervisor secrets、process sandboxing、cloud execution、connector grants 或 lease authority。

修正与剩余边界：

- Supervisor Lifecycle Readiness 是 P1 readiness contract，不是 daemon control、vault、auth lifecycle、recovery command 或 policy gateway。
- 剩余严格复查差距包括 vault reference binding design、显式 lifecycle command contracts、local ingress、live remote CI/CodeQL observation、release packaging、artifact signing、public docs deployment、installer/updater automation、更广 projection parity coverage，以及未来在 policy 后面的 connector OAuth work。

## Phase 59 复核：Vault Policy Binding Readiness Contract

本轮补齐第一块 vault reference binding design 缺口，但不实现 vault backend。上一轮 Vault Reference contract 证明 raw secret material 不会被存储；本轮证明下一层边界：未来 policy decision 只能以 metadata 形式引用 vault reference，且该引用不能变成 secret resolution、provider credential use、egress authority、connector grant 或 lease。

与原始文档对照：

- [架构](01-architecture.zh-CN.md)：Tool Access & Action Policy Proxy 仍是 sensitive read、data egress 和 side effect 的 choke point；vault metadata 不能绕过 policy。
- [技术策略](10-technical-strategy.zh-CN.md)：Rust 仍是未来 vault/authority owner；TypeScript 可以定义 readiness contract，但不能实现 secret access。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：P1 credential-boundary metadata 需要对 raw secret、inherited authority 和 live side-effect replay 加负向测试。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：PGC-2 要求 vault ref 可以被 policy decision 引用，但 raw secret value 不能进入 example、artifact、Ledger event、run manifest 或 docs。

本轮修正：

- 新增 `schemas/vault-policy-binding.schema.json` 和 `examples/contracts/vault-policy-binding.json`。
- contract 通过 schema 名引用 `vault-reference.schema.json`、`policy-decision.schema.json` 和 `model-provider-readiness.schema.json`，并把 `vault://` URI 与 SHA-256 fingerprint 绑定到 policy-decision metadata。
- contract 要求 fresh policy 和 scoped lease requirement，同时保持 binding 本身不能发 lease 或授权 action。
- contract 明确把 secret resolution、provider vault resolution、raw secret persistence、raw secret availability、OAuth flow、token refresh、connector grant 和 egress-by-binding 标为未实现。
- 新增负向 schema 测试，拒绝 raw-secret material、缺少 fresh-policy 或 lease requirement、secret resolution、raw secret copy、provider call authorization、connector grant authorization、raw Ledger material、egress authority、connector-grant authority 和额外 raw-secret 字段。
- `doctor`、`onboarding check` 和 `release evidence` 现在输出 `vault_policy_binding_contract` evidence。
- README、TUI README、harness-core README、schema governance 和 runtime-loop docs 都已同步中英文说明。

偏差复核：

- 修正 PGC-2 binding drift：Aetherion 已有 metadata-only Vault Reference，但 production reports 还不能证明 policy decision 如何安全引用它。
- 修正 OAuth/connector drift 风险：vault reference 现在明确不是 connector grant、token refresh path、provider vault-backed call 或 egress permission。
- 未实现 secret retrieval、OS keychain access、production vault storage、provider credential resolution from vault、OAuth flow、token refresh、connector account linking、connector grant、egress policy 或 lease issuance。

修正与剩余边界：

- Vault Policy Binding 是 P1 readiness/credential-boundary metadata contract，不是 secret use path 或 policy authority。
- 剩余严格复查差距包括显式 supervisor lifecycle command contracts、local ingress envelope/idempotency、provider error/credential-source productionization、live remote CI/CodeQL observation、release packaging、artifact signing、public docs deployment、installer/updater automation、更广 projection parity coverage，以及未来在 policy 后面的 connector OAuth work。

## Phase 60 复核：Local Ingress Readiness Contract And Audit

本轮启动 PGC-3 local ingress 路径，但不实现 production gateway。此前 architecture matrix 已经暴露 Ingress Gateway 缺口：Aetherion 有本地 TUI invocation，也有 hash-only/queue-only surface labs，但还没有 machine-checkable envelope 来说明未来 local API-like ingress 在交给 Local Supervisor 前必须证明什么。

与原始文档对照：

- [架构](01-architecture.zh-CN.md)：Ingress Gateways 在 Local Supervisor handoff 前负责 normalize、authenticate、rate-limit 和 idempotency。
- [用户边界层](02-user-boundary-layer.zh-CN.md)：client surface 与 remote channel 不能直接授权 sensitive action。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：P1 readiness metadata 必须拒绝 inherited authority、raw payload persistence 和 live side-effect claim。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：PGC-3 要求 local ingress request envelope 和只读 ingress audit command 先于真实 API/browser/IM/mobile ingress。

本轮修正：

- 新增 `schemas/local-ingress-readiness.schema.json` 和 `examples/contracts/local-ingress-readiness.json`。
- contract 要求 caller identity placeholder、surface id、workspace id、idempotency key、normalized intent hash、auth state、rate-limit state 和 policy handoff metadata。
- contract 保持 TUI 是唯一可运行 surface，并把 local API-like ingress 标为 contract-only。
- contract 拒绝 public API listener、browser extension ingress、IM delivery、mobile pairing、connector OAuth ingress、cloud worker ingress、unauthenticated authority、duplicate-key authority reuse、raw external payload persistence、session issuance、rate-limit enforcement overclaim、supervisor bypass 和 ingress-issued lease。
- 新增负向 schema 测试，覆盖 remote surface、auth、idempotency、rate-limit、raw-payload 和 authority overclaim。
- 新增 `ingress audit` 只读报告；它不启动 listener、不接受 remote connection、不修改 workspace、不写 artifact、不追加 Ledger event、不发 session、不检测 live duplicate keys、不执行 rate limit，也不授予 authority。
- `doctor`、`onboarding check` 和 `release evidence` 现在输出 `local_ingress_readiness_contract` evidence；`release evidence` 明确 local ingress runtime 剩余缺口。
- README、TUI README、harness-core README、schema governance 和 runtime-loop docs 都已同步中英文说明。

偏差复核：

- 修正 PGC-3 planning drift：架构要求 ingress normalize/auth/rate-limit/idempotency，但 production report 还不能区分 future gateway contract 和已经可运行的 TUI。
- 修正 remote-surface drift 风险：API/browser/IM/mobile/cloud ingress 现在明确未实现，且不能绕过 Local Supervisor 或 Tool Access & Action Policy Proxy。
- 未实现 action run 前 duplicate idempotency detection、rate limiter、persistent auth/session lifecycle、public HTTP/API listener、browser extension、IM delivery、mobile client、connector OAuth ingress、cloud worker ingress 或基于 ingress envelope 的 supervisor policy execution。

修正与剩余边界：

- Local Ingress Readiness 是 P1 readiness/audit contract，不是 production ingress gateway 或 authority path。
- 剩余严格复查差距包括 local envelope runtime duplicate detection、显式 supervisor lifecycle command contracts、provider error/credential-source productionization、live remote CI/CodeQL observation、release packaging、artifact signing、public docs deployment、installer/updater automation、更广 projection parity coverage，以及未来在 policy 后面的 connector OAuth work。

## Phase 61 复核：TUI Run Idempotency Reservation

本轮继续推进 PGC-3，把一个 idempotency 要求从 contract-only 推进到 TUI `run` runtime path，但不添加 API listener 或 remote ingress surface。

与原始文档对照：

- [架构](01-architecture.zh-CN.md)：Ingress Gateways 必须在 Local Supervisor handoff 前提供 idempotency。
- [用户边界层](02-user-boundary-layer.zh-CN.md)：client surface 可以请求 action，但不能成为 trust root。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：local ingress metadata 必须拒绝 raw material persistence 和 inherited authority。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：PGC-3 要求 duplicate idempotency key 在创建新 action run 前被发现。

本轮修正：

- 新增 `schemas/local-ingress-idempotency-reservation.schema.json` 和 `examples/contracts/local-ingress-idempotency-reservation.json`。
- `run` 现在会派生或接受 idempotency key，只保存 `sha256:` key hash 和 normalized-intent hash，并在调用 Rust supervisor 或 TypeScript test seed 前用 atomic `wx` 写入 local reservation file。
- 重复使用同一个 `--idempotency-key` 会在任何新 run manifest、Ledger append、tool request、policy decision、lease 或 file action 前 fail closed。
- `local-ingress-readiness` 现在记录 duplicate detector 仅限 TUI run local atomic reservation before supervisor handoff。
- 新增 schema 测试，拒绝 raw idempotency key persistence、raw intent persistence、authority 和 late duplicate detection drift。
- 新增 TUI 回归测试，证明 duplicate key rejection 不改变 Ledger 和 run manifest。
- `ingress audit`、`doctor` 和 `release evidence` 现在区分已实现的 TUI duplicate-key reservation，以及仍未实现的 cached idempotent replay、rate limit、auth/session lifecycle 和 remote ingress。

偏差复核：

- 修正 Phase 60 仍把 runtime duplicate detection 完全列为未实现的偏差。
- 保持更大架构边界：这只是 TUI run preflight state，不是 public gateway、session issuer、rate limiter、policy authority 或 lease issuer。
- 未实现 prior idempotent result cached replay、remote envelope replay protection、durable session/auth lifecycle、rate-limit enforcement、public HTTP/API listener、browser extension ingress、IM/mobile ingress、connector OAuth ingress、cloud worker ingress 或基于 ingress envelope 的 supervisor policy execution。

修正与剩余边界：

- Local idempotency reservation 是 duplicate-action guard，不是 authorization source of truth；Local Supervisor 和 Tool Access & Action Policy Proxy 仍负责 gate read/write。
- 剩余严格复查差距包括 cached/replay-safe idempotency semantics、rate limiting、显式 supervisor lifecycle command contracts、provider error/credential-source productionization、live remote CI/CodeQL observation、release packaging、artifact signing、public docs deployment、installer/updater automation、更广 projection parity coverage，以及未来在 policy 后面的 connector OAuth work。

## Phase 62 复核：TUI Run Rate Limit Reservation

本轮继续推进 PGC-3，把 rate-limit 要求从 contract-only readiness 推进到 TUI `run` runtime path，但仍不添加 public API listener、browser/IM/mobile ingress、cloud worker 或 connector OAuth flow。

与原始文档对照：

- [架构](01-architecture.zh-CN.md)：Ingress Gateways 必须在 Local Supervisor handoff 前负责 normalize、authenticate、rate-limit 和 idempotency。
- [用户边界层](02-user-boundary-layer.zh-CN.md)：client surface 可以请求 action，但不能成为 trust root、发 session 或授予 permission。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：local ingress metadata 必须保持 hash-only，并拒绝 raw material、authority、session 和 background-queue claim。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：PGC-3 要求 broader ingress surface 前先有 rate-limit state enforcement。

本轮修正：

- 新增 `schemas/local-ingress-rate-limit-reservation.schema.json` 和 `examples/contracts/local-ingress-rate-limit-reservation.json`。
- `run` 现在会在 idempotency reservation、supervisor handoff、run manifest、Ledger append、tool request、policy decision、lease 或 file action 前预留 local atomic rate-limit slot。
- reservation 只保存 `sha256:` rate-limit key 和 normalized intent hash，并记录 `surface_id=tui`、`auth_state=local_operator`、`rate_limit_state=enforced_allow` 和 `enforcement_stage=before_supervisor_handoff`。
- 超出限制时 fail closed，不创建新的 run manifest、Ledger event、idempotency reservation、tool request、lease 或 output file。
- 新增 schema 测试，拒绝 raw key/intent persistence、authority、session issuance、background queue、mutable counter、late enforcement 和 non-TUI surface。
- 新增 TUI 回归测试，证明 local rate-limit overflow 不改变 Ledger 和 run manifest。
- `ingress audit`、`doctor` 和 `release evidence` 现在区分已实现的 TUI local rate-limit enforcement，以及仍未实现的 cached idempotent replay、durable/distributed/session/remote rate limiting、auth/session lifecycle、public API listener、browser extension ingress、IM/mobile ingress、connector OAuth ingress 和 cloud worker ingress。

偏差复核：

- 修正 Phase 61 仍把 rate limiting 完全列为未实现的偏差。
- 修正 readiness 偏差：`local-ingress-readiness` 的 rate-limit scope 从未实现 enforcement 改为 `tui_run_local_atomic_window_before_supervisor_handoff`。
- 保持 V1 surface discipline：这只是 TUI run preflight state，不是 production gateway、session issuer、policy authority、distributed limiter 或 lease issuer。
- 未实现 prior idempotent result cached replay、remote envelope replay protection、durable session/auth lifecycle、durable 或 remote rate limiting、public HTTP/API listener、browser extension ingress、IM/mobile ingress、connector OAuth ingress、cloud worker ingress 或基于 ingress envelope 的 supervisor policy execution。

修正与剩余边界：

- Local rate-limit reservation 只是 ingress guard；Local Supervisor 和 Tool Access & Action Policy Proxy 仍负责 gate 所有 read、write、lease 和 side effect。
- 剩余严格复查差距包括 cached/replay-safe idempotency semantics、显式 supervisor lifecycle command contracts、provider error/credential-source productionization、live remote CI/CodeQL observation、release packaging、artifact signing、public docs deployment、installer/updater automation、更广 projection parity coverage，以及未来在 policy 后面的 connector OAuth work。

## Phase 63 复核：TUI Run Cached Idempotency Replay

本轮继续推进 PGC-3，为 completed 且同 intent 的 TUI `run` envelope 增加 cached/replay-safe idempotency，但不添加 public ingress gateway 或 remote idempotency service。

与原始文档对照：

- [架构](01-architecture.zh-CN.md)：idempotency 属于 Local Supervisor handoff 前；action 仍必须经过 Tool Access & Action Policy Proxy authority。
- [用户边界层](02-user-boundary-layer.zh-CN.md)：client surface 不能复用或创造 permission；cached replay 只是 evidence-only。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：P1 ingress contract 必须拒绝 raw material、inherited authority 和 live side-effect replay claim。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：PGC-3 要求任何新 action run 前具备 replay protection。

本轮修正：

- 新增 `schemas/local-ingress-idempotency-completion.schema.json` 和 `examples/contracts/local-ingress-idempotency-completion.json`。
- completed TUI `run` 现在会在 run manifest completed 后写入 hash-only idempotency completion cache。
- 同 key 加同 normalized intent 会返回 cached manifest/Ledger/artifact evidence，不创建新的 run manifest、不追加 Ledger event、不请求 policy、不发 lease、不重写 output file。
- 同 key 加不同 normalized intent 仍会在新 action run 前 fail closed。
- 新增 schema 测试，拒绝 raw key/intent persistence、mismatched replay scope、live side-effect replay、policy/lease reuse 和 replay authority claim。
- 新增 TUI 回归测试，证明 cached replay 不改变 Ledger、run manifest、completion evidence 或 output content。
- `ingress audit`、`doctor` 和 `release evidence` 现在区分已实现的 TUI same-intent cached replay，以及 durable/session/remote idempotency replay、durable/distributed/session/remote rate limiting、auth/session lifecycle 和延后 surfaces。

偏差复核：

- 修正 Phase 62 仍把 cached idempotent replay 完全列为未实现的偏差。
- 保持架构边界：cached replay 重新校验旧 evidence，不复用 policy、lease 或 side-effect authority。
- 未实现 durable/session/remote idempotency replay、durable/distributed/session/remote rate limiting、auth/session lifecycle、public API listener、browser extension ingress、IM/mobile ingress、connector OAuth ingress、cloud worker ingress 或基于 ingress envelope 的 supervisor policy execution。

修正与剩余边界：

- Local idempotency completion 是 replay-safe evidence cache，不是 authorization source。
- 剩余严格复查差距包括显式 supervisor lifecycle command contracts、provider error/credential-source productionization、durable/session ingress identity、live remote CI/CodeQL observation、release packaging、artifact signing、public docs deployment、installer/updater automation、更广 projection parity coverage，以及未来在 policy 后面的 connector OAuth work。

## Phase 64 复核：Provider Stable Error Taxonomy

本轮推进 PGC-4，把 provider failure 从自由文本错误推进为稳定的 no-tools provider error taxonomy，但不添加 provider tools、OAuth flow、connector grant 或 vault-backed credential resolution。

与原始文档对照：

- [架构](01-architecture.zh-CN.md)：provider call 仍是 Agent Orchestrator evidence；Tool Access & Action Policy Proxy 仍负责 gate action 和 egress。
- [用户边界层](02-user-boundary-layer.zh-CN.md)：provider credential 和 model/provider error 都不能授权 read、write、lease、export 或 side effect。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：Model Provider Readiness 仍是 P1 metadata，现在除 raw prompt/model/provider payload overclaim 外，也拒绝 raw provider error body persistence。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：PGC-4 明确要求 stable error taxonomy、retry/refusal metadata 和 credential-source clarity，同时 OAuth 仍是未来 governed flow。

本轮修正：

- 在 `packages/harness-core/src/model-provider.ts` 新增 `ModelProviderError`、`ModelProviderErrorCode`、`ModelProviderErrorCategory`、`MODEL_PROVIDER_ERROR_CODES` 和 `isModelProviderError`。
- 固化 unknown provider、missing credential、invalid timeout、network failure、timeout、HTTP error、malformed JSON 和 no-tools tool-call rejection 的 provider error code。
- error instance 现在携带 provider ref、category、retryability，以及适用时的 HTTP status metadata；HTTP error handling 仍不读取或回显 upstream response body。
- 扩展 `schemas/model-provider-readiness.schema.json` 与 `examples/contracts/model-provider-readiness.json`，加入 error taxonomy，并明确 failure 时不会持久化 raw provider error body、credential 或 tool-call output。
- `doctor`、`onboarding check` 和 `release evidence` 的 readiness check 现在要求 error taxonomy 和对应测试存在。
- 新增 harness 测试，覆盖 unknown provider、missing credential、invalid timeout、malformed JSON、HTTP 429、network failure、timeout 和 tool-call rejection 的稳定 taxonomy metadata。

偏差复核：

- 修正 Phase 63 剩余差距中 provider error productionization 仍未完成的部分。
- 修正 readiness 偏差：Model Provider Readiness 现在不仅证明 provider list 和 credential-source boundary，也证明 error classification。
- 保持 provider support 在 no-tools/hash-only runtime path 内；provider error 不写 model-response 或 response-audit artifact，也不会成为 policy approval。
- 未实现 vault-backed provider credential resolution、browser OAuth、token refresh/revocation、connector grant、streaming、多模态 payload、provider tool execution 或 live-provider CI probe。

修正与剩余边界：

- Provider error taxonomy 只是 diagnostic evidence；它不是 retry executor、OAuth account-linking system、vault resolver、connector grant、egress permission、policy decision 或 lease。
- 剩余严格复查差距包括显式 supervisor lifecycle command contracts、durable/session ingress identity、更细 refusal taxonomy、live remote CI/CodeQL observation、release packaging、artifact signing、public docs deployment、installer/updater automation、更广 projection parity coverage，以及未来在 policy 后面的 connector OAuth work。

## Phase 65 复核：Supervisor Lifecycle Command Fail-Closed Contracts

本轮回到 PGC-2，把缺失的 supervisor lifecycle command surface 显式化，但不实现 daemon lifecycle management。

与原始文档对照：

- [产品简报](00-product-brief.zh-CN.md)：V1 仍是 TUI-only，必须先证明本地 kernel loop，再进入 GUI/mobile/IM/browser/connector。
- [架构](01-architecture.zh-CN.md)：Local Supervisor 仍是 root authority；命令被识别、status report 和 runtime-lock observation 都不能授权 tool 或 side effect。
- [路线图](06-roadmap.zh-CN.md)：Phase 1/2 可以 harden TUI/Rust supervisor semantics，但真实 daemon lifecycle、vault、socket auth 和 broader connector surface 仍是独立实现步骤。
- [Schema 运行时治理](13-schema-runtime-governance.zh-CN.md)：P1 readiness metadata 必须拒绝 lifecycle side effect、stale-lock repair、vault secret resolution、lease issuance 和 authority overclaim。
- [生产缺口补全计划](15-production-gap-closure-plan.zh-CN.md)：PGC-2 要求在 production daemon behavior 前先有 typed lifecycle contract。

本轮修正：

- 新增 `schemas/supervisor-lifecycle-command.schema.json` 和 `examples/contracts/supervisor-lifecycle-command.json`。
- `supervisor start`、`supervisor stop` 和 `supervisor recover-stale-lock` 现在是已识别 command surface，不再是普通 unknown command。
- 这些命令会先调用 `supervisor.status` 做只读 workspace/runtime-lock observation，再校验 structured `supervisor-lifecycle-command` report，输出 `unsupported_fail_closed`，并以 exit code 2 退出。
- report 记录 `implemented=false`、`fail_closed=true`、不启动/停止 daemon、不 kill process、不修 stale lock、不改 Ledger、不写 artifact、不发 session、不发 lease、不解析 vault secret、不覆盖 policy。
- `recover-stale-lock` 可以报告 `runtime_lock_stale=true`，但保持既有 lock file 不变。
- `doctor`、`onboarding check` 和 `release evidence` 现在要求 lifecycle readiness contract 以及 command schema/example evidence。
- README、TUI README、harness-core README、schema governance、runtime-loop plan 和 production-gap plan 都已同步中英文说明。

偏差复核：

- 修正 Phase 64 剩余缺口里“显式 supervisor lifecycle command contracts 完全未完成”的状态。
- 修正 operator UX 偏差：`start`/`stop`/`recover-stale-lock` 现在是有 machine-classifiable unsupported report 的已知命令，不是含糊的 CLI 错误。
- 保持原始 authority boundary：command report 是 diagnostic evidence，不是 daemon manager、stale-lock repair path、vault、session issuer、lease issuer 或 tool authority。
- 未实现 production daemon start/stop、stale-lock recovery、socket-auth lifecycle、vault backend、process sandbox、signer、cloud worker、secret retrieval、connector grant 或 lifecycle command 发起 policy execution。

修正与剩余边界：

- Supervisor Lifecycle Command 是 fail-closed command contract。它比完整 PGC-2 验收项更窄，因为 daemon lifecycle 和 recovery 的真实 Rust authority path 仍刻意不存在。
- 剩余严格复查差距包括 durable/session ingress identity、更细 refusal taxonomy、live remote CI/CodeQL observation、release packaging、artifact signing、public docs deployment、installer/updater automation、更广 projection parity coverage，以及未来在 policy 后面的 connector OAuth work。

## Phase 65.1 复核：Node 24.9 Verified Baseline

验证时，`doctor` 和 `release evidence` 正确地因为本地 Node runtime 阻塞：仓库仍要求 Node `>=25`，但当前完整验证环境是 Node 24.9.0。与此同时，完整 `npm test` 已经在 Node 24.9.0 上通过，CI evidence model 也已经记录 Node 24 JavaScript action-runtime baseline。

本轮修正：

- 将 package engine 和 lockfile root engine 从 `>=25` 降到 `>=24.9.0`。
- 将 readiness check 从只看 Node 25 major version 改成显式 `>=24.9.0` 比较。
- 更新中英文 Node baseline 文档，说明 Node 24.9 是已验证最低基线；继续下探必须先有完整测试或明确 TypeScript runner/build path 证据。

偏差复核：

- 修正 local reproducible verification 已通过但 readiness report 仍因过时 engine floor 阻塞的偏差。
- 不声称支持 Node 22/23，不新增 dependency，也不改变 test runner 或 authority path。

## 验证要求

每轮结束应至少检查：

- schema/example validation。
- harness-core/TUI 测试。
- Rust supervisor 测试。
- `git diff --check`。
- `.aetherion/`、`target/` 等 runtime/build artifact 未被提交。
- 本文件和 `docs/14-runtime-loop-plan.md` 是否说明与原始构想的偏差和修正。
