# OpenClaw 基线对比文档

[English](16-openclaw-baseline.md)

本文档是每一轮 ponytail 迭代的对比锚点。每轮迭代开始时重读本基线，选择对齐方向，编写 phase 计划。结构刻意做成「发现 + 差距 + 结论」，以便迭代计划引用具体章节。

OpenClaw 证据来源：隔离克隆位于 `.quarantine/openclaw/`（已 gitignore，永不发布）。OpenClaw 被视为迁移/研究输入，绝非信任根，遵循 `AGENTS.md` 的导入边界规则。

---

## 1. OpenClaw 是什么

OpenClaw 是一个 TypeScript/ESM、终端优先的个人 AI 助手，以单 Node 进程本地运行，通过回环 WebSocket「Gateway」和约 25 个消息渠道对外暴露。仓库规模：约 2 万文件，`src/`（核心应用 + agent 运行时）、`packages/`（21 个内部 TS 包）、`extensions/`（约 145 个插件）、`skills/`（约 58 个技能文档）、`ui/`、`apps/`。

关键定位文档：

- `VISION.md` ——「真正能做事的 AI」，本地优先个人助手。明确反对嵌套规划器（第 122 行：manager-of-managers / 嵌套规划器树在拒绝合并清单上）。
- `AGENTS.md` ——工程策略。核心保持插件无关；插件只能通过 `openclaw/plugin-sdk/*` 桶入口进入核心。存储默认：仅 SQLite。
- `docs/refactor/database-first.md` ——事实层宪法。他们从 JSON/JSONL 文件迁移到 SQLite 作为规范运行时存储。

## 2. 概念模型对比

| 概念 | Aetherion（目标） | OpenClaw（已建成） | 结论 |
|---|---|---|---|
| 根权威 | Local Supervisor（Rust 进程边界） | 本地运行时 + 回环 Gateway 持有 `state/openclaw.sqlite` | **方向一致。** 都是本地优先，无云端 supervisor。OpenClaw 无 Rust 权威边界；其「权威」是单 Node 进程 + SQLite 锁。 |
| 事实层 | Event Ledger（追加写，SHA-256 父链，可重放重建） | 两级 SQLite（控制面 + 每 agent 数据面）；转录事件流是近似追加记录 | **方向一致，机制不同。** OpenClaw 用 SQLite 表；Aetherion 用哈希链 JSONL 账本。两者都把持久存储视为事实层，且禁止运行时使用定位符字符串。 |
| Agent 模型 | Agent Orchestrator（上下文组装 / 规划 / agent 循环 / 验证） | 每 session 单一串行 agent 循环；无 supervisor 层级 | **方向一致。** 两者都拒绝嵌套规划器。Aetherion 额外有 OpenClaw 缺少的显式 Verifier 步骤。 |
| 信任边界 | 生成/导入代码永不运行在 Local Supervisor 内 | 插件代码运行在同一 Node 进程；每次工具运行有 sandboxed 标志 + 文件系统策略 | **Aetherion 更严格。** OpenClaw 插件在进程内；Aetherion 强制独立权威进程。 |

## 3. 能力模型——核心分歧

这是最重要的架构差异。

**Aetherion——能力胶囊（Capability Capsules）：**
- 胶囊声明权限需求和约束。
- 胶囊不拥有运行时授权。
- 运行时授权是 Tool Access & Action Policy Proxy 签发的有作用域租约。
- 「声明需求」与「拥有权限」的分离是一等不变量。

**OpenClaw——扁平插件模型：**
- 插件既声明又拥有其能力（`contracts.tools`、`contracts.embeddingProviders`）。
- 插件发射的工具必须是其声明的 `contracts.tools` 的子集（`src/plugins/tool-contracts.ts`）。
- 最接近「声明需求但不拥有权限」的是技能的 `requires` 块（`src/skills/types.ts:27-33`）——但那是*可用性过滤器*（配置缺失则隐藏技能），不是租约请求。
- 唯一真正的按请求租约机制是 exec/plugin 审批（`src/infra/plugin-approvals.ts`、`src/infra/exec-approvals.ts`），允许一次/允许始终/拒绝。作用域限于 exec 命令，不覆盖一般能力委派。

**结论：** Aetherion 的胶囊/租约分离是 OpenClaw 扁平插件模型所缺乏的决定性属性。这不是通过照搬 OpenClaw 来弥合的差距——而是需要保留的差异化优势。

## 4. 工具门控对比

| 层 | Aetherion（目标） | OpenClaw（已建成） |
|---|---|---|
| 策略组合 | Tool Access & Action Policy Proxy：从动作类型、敏感度、污染、可逆性、影响范围、出口目的地组合风险 | 4 层流水线：profile → providerProfile → global → agent → group → sender（`src/agents/tool-policy-pipeline.ts:127`） |
| 按调用门控 | 同意后签发有作用域租约 | `beforeToolCall` 钩子（`src/agents/agent-tools.before-tool-call.ts`）返回 `{block:true}` 否决 |
| 人工审批 | 审批卡 → 同意 → 租约 | exec/plugin 审批，支持渠道原生投递（Telegram/Slack 内联按钮） |
| 数据出口控制 | 风险组合中的显式出口目的地 | `packages/net-policy` IP 允许/拒绝 + 敏感 URL 脱敏 |

**结论：** OpenClaw 的门控成熟且经受过实战检验（4 层策略流水线 + beforeToolCall + 审批 + net-policy）。Aetherion 的策略代理是契约优先但实现较薄。**对齐方向：借鉴分层策略流水线的形态，而非进程内执行模型。** 保持租约是有作用域令牌，而非是/否审批。

## 5. 事件/轨迹/账本对比

OpenClaw 有三个独立的记录系统，而 Aetherion 有一个统一账本：

| 系统 | OpenClaw | Aetherion 对应 |
|---|---|---|
| 内存事件总线 | `src/infra/agent-events.ts`——按运行单调 `seq`，lifecycle generation UUID 用于在重启后拒绝陈旧运行事件。非持久。 | Event Ledger 信封（持久） |
| 诊断轨迹 | 通过 `AsyncLocalStorage` 的 W3C traceparent（`src/infra/diagnostic-trace-context.ts`）；诊断事件馈入时间线 | 轨迹重放重建（`packages/harness-core/src/replay.ts`） |
| 持久转录 | 树状 JSONL/SQLite session 转录（`packages/agent-core/src/harness/session/jsonl-storage.ts`） | 带 SHA-256 父链的 Event Ledger |

**结论：** OpenClaw 的 lifecycle-generation UUID（拒绝来自在 Gateway 重启中死去的运行的事件）是一个具体、可借鉴的想法——它解决了 Aetherion 在有长时间运行后即将面临的陈旧运行事件问题。W3C traceparent 传播也值得采纳，用于在 Aetherion 的 Rust supervisor 与 TS orchestrator 跨进程通信时关联轨迹。

## 6. 记忆对比

| 方面 | Aetherion（目标） | OpenClaw（已建成） |
|---|---|---|
| 规范记忆 | Memory OS 存储带来源 + 敏感度元数据的知识 | `MEMORY.md` 人类可读文件是规范的；SQLite 是派生索引 |
| 向量索引 |「稍后的向量」——可重建投影 | sqlite-vec 嵌入覆盖记忆文件（`packages/memory-host-sdk/src/host/memory-schema.ts`） |
| 整合 | Dreaming 产出可审查补丁，而非动作 | 带 light/deep/REM 阶段的 Dreaming（`docs/concepts/dreaming.md`）；写入 `memory/.dreams/` + `DREAMS.md` |
| 溯源 | 每条记忆条目带来源 + 敏感度 | 承诺上的 `source_message_id`/`source_run_id`；转录谱系 |

**结论：** OpenClaw 的 dreaming 系统是 Aetherion「dreaming 产出可审查补丁」不变量的最成熟对应物。Aetherion 的约束（补丁，非动作）比 OpenClaw 的（deep 阶段写入 `MEMORY.md`）更严格。**对齐方向：研究 OpenClaw 的 light/deep/REM 阶段结构作为形态，保留可审查补丁约束。**

## 7. 主动行为对比

| 机制 | OpenClaw | Aetherion 不变量 |
|---|---|---|
| 心跳 | 周期性 30 分钟主 session agent 轮次，读取 `HEARTBEAT.md`；回复 `HEARTBEAT_OK` 或浮出告警 |「Aetherion 不会周期性醒来思考」——心跳违反此条 |
| 定时任务 | `cron_jobs` 表中的分离调度作业 |「定时器用于精确截止和维护作业是可接受的」——对齐 |
| Dreaming | 每夜记忆整合 | 对齐（补丁，非动作） |
| 承诺 | 机会生命周期：`pending → sent → snoozed → expired`，来源为 `inferred_user_context`/`agent_promise` | 与 Aetherion 带抑制的机会生命周期最匹配 |
| 抑制 | 心跳/任务上的 `activeHours` 窗口 | Aetherion 要求完整抑制层（安静时段、会议、污染来源、低置信度……） |

**结论：** OpenClaw 的承诺系统（`src/commitments/types.ts`）是 Aetherion 机会生命周期的最直接匹配。**对齐方向：借鉴承诺状态机形态（`pending/sent/dismissed/snoozed/expired`）和 `agent_promise` 与 `inferred_user_context` 来源区分。** 拒绝心跳模型——它正是 Aetherion 不变量禁止的「cron 自打断」。

## 8. 技能对比

| 方面 | Aetherion | OpenClaw |
|---|---|---|
| 技能格式 | 过程性知识 + 导入格式；技能不授予权限 | YAML frontmatter + markdown 正文；`SKILL.md` + 可选 `scripts/` |
| 加载 | 待定（能力 OS 管理胶囊；技能分离） | 惰性：仅注入名称/描述/位置到提示；模型按需读取 `SKILL.md`（`src/skills/loading/skill-contract.ts:34-58`） |
| 需求 | 胶囊声明需求；技能是过程性的 | `requires: {bins, anyBins, env, config}` 是可用性过滤器，非租约 |
| 调用 | 通过受管工具 session | 模型读取文件；可选脚本通过普通 shell 工具运行（相同 exec 门控） |

**结论：** OpenClaw 的惰性技能加载（仅注入名称/描述/位置，让模型按需读取）是经验证的模式，能保持系统提示小巧。**对齐方向：采用惰性技能加载作为默认。** 不要采用技能即权限声明——那会坍塌 Aetherion 要求的胶囊/技能区分。

## 9. 存储纪律对比

| 方面 | Aetherion | OpenClaw |
|---|---|---|
| 运行时事实 | JSONL Event Ledger（哈希链） | SQLite（控制面 + 数据面） |
| 配置 | YAML/JSON 清单 + Markdown | `openclaw.json`（JSON5 文件）——刻意置于 DB 外 |
| 投影 | SQLite 运行索引、FTS、向量（均可重建） | sqlite-vec 嵌入（可从 `MEMORY.md` 重建） |
| 迁移 | 导入生成迁移报告；条目默认隔离 | `openclaw doctor --fix` 拥有文件到 DB 的迁移；运行时从不读取遗留形态 |

**结论：** OpenClaw 对配置（文件）与运行时事实（SQLite）的硬分离与 Aetherion 的治理-投影分离一致。「运行时只读取当前规范配置；遗留形态由 doctor 命令处理，而非运行时垫片」这条规则（`AGENTS.md`）值得逐字采纳用于 Aetherion 自身的配置演进。

## 10. Aetherion 不应借鉴什么

1. **进程内插件执行。** OpenClaw 插件运行在同一 Node 进程。Aetherion「生成/导入代码永不运行在 Local Supervisor 内」的不变量不可协商。
2. **心跳轮询。** 它正是 Aetherion 明确禁止的「cron 自打断」。主动行为必须是事件驱动 + 抑制。
3. **扁平插件对能力的拥有。** 胶囊声明；代理授权。不要让技能或连接器拥有权限。
4. **25 个消息渠道。** V1 仅 TUI。IM 投递在明确阶段前不在范围内。
5. **嵌套规划器树。** 两个项目在此一致——不要加 manager-of-managers。

## 11. Aetherion 应该借鉴什么

按价值/努力比排序：

1. **运行事件的 lifecycle-generation UUID**（`src/infra/agent-events.ts:184`）。拒绝来自在重启中死去的运行的陈旧事件。低努力，高价值。
2. **承诺状态机**（`src/commitments/types.ts`）。`pending → sent → dismissed → snoozed → expired`，`agent_promise` 与 `inferred_user_context` 来源。直接契合机会生命周期。
3. **分层工具策略流水线形态**（`src/agents/tool-policy-pipeline.ts:127`）。profile → providerProfile → global → agent → group → sender。Aetherion 的代理可采纳分层而不采纳进程内执行。
4. **惰性技能加载**（`src/skills/loading/skill-contract.ts:34-58`）。仅注入名称/描述/位置；模型按需读取。保持系统提示小巧。
5. **W3C traceparent 传播**（`src/infra/diagnostic-trace-context.ts`）。用于关联 TS orchestrator ↔ Rust supervisor 边界的轨迹。
6. **Dreaming light/deep/REM 阶段结构**（`docs/concepts/dreaming.md:30-34`）。作为 Aetherion 可审查补丁 dreaming 的形态。
7. **配置与事实分离规则**（OpenClaw `AGENTS.md:76-83`）。运行时只读当前规范配置；遗留迁移是 doctor 命令，非运行时垫片。

## 12. Aetherion 当前实现状态（基线快照）

截至本基线：

- **174 测试，173 通过，1 失败。** 失败测试（`tui.test.ts:744`——npm 包预演）是 OpenClaw 克隆泄漏到 `npm pack` 引发的 maxBuffer 问题；已通过将 `.quarantine/` 加入 `.npmignore` 修复。
- `packages/harness-core/`——TypeScript 种子，证明 V1 循环：schema、consent、lease、verify、workspace、risk、approval、local-file、replay、policy、ledger、registry、supervisor-client、run-local、run-supervisor、boundary、agent-runtime、model-provider、output-summary。
- `crates/supervisor/`——Rust 权威边界 POC：工作区账本初始化、SHA-256 父链、工作区身份、带轨迹的文件动作 RPC、供 TS 客户端使用的 stdio RPC。
- `packages/tui-go/`——Go 操作设置 TUI（Bubble Tea），非授权客户端面。
- `schemas/`——80+ JSON Schema 契约。
- `docs/`——15 个编号设计文档（00–15），覆盖从产品简报到生产差距闭环计划。

这是每轮未来迭代对比的基准。

---

## 迭代协议

每轮 ponytail 迭代遵循：

1. **对比本基线**——重读第 3–11 节，记录变化。
2. **选择对齐方向**——从第 11 节选一项（或工作中发现的新差距）。
3. **编写 phase 计划文档**（`docs/phases/NN-<slug>.md`）——范围、契约、测试、退出标准。不进 Plan 模式；写文档即推进。
4. **TDD 开发**——测试先行，然后最小实现（ponytail 第 5 级仅在穷尽第 1–4 级后）。
5. **测试 + 文档进度 + git 提交**——留下痕迹。
