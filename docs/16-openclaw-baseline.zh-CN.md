# OpenClaw 后端运行时基线与落后审查

[English](16-openclaw-baseline.md)

本文件是 Aetherion 后端运行时补强的批判基线。它不证明 Aetherion 已经接近 OpenClaw；相反，它记录当前落后在哪里、哪些能力只是薄实现、哪些能力即使已有代码也不能算产品级运行时。

证据范围：

- Aetherion 当前仓库：`packages/harness-core/`、`packages/tui/`、`crates/supervisor/`、`docs/14-runtime-loop-plan.md`、`docs/15-production-gap-closure-plan.md`。
- 本地隔离参考：`.quarantine/openclaw/`、`.quarantine/hermes/`、`.quarantine/opencode/`。这些目录只作为研究输入，不是信任根，不复制其进程内插件模型。
- 验证快照：2026-06-23 运行 `npm test`，结果 `348` 个测试，全部通过。GC 断言和 onboarding/doctor/release evidence 的双语链接问题都已在本轮修复，基线不再保留旧的失败数。
- 编辑前工作树已有未跟踪文件：`packages/harness-core/src/vcs/gc.ts`、`packages/harness-core/test/vcs-gc.test.ts`、`packages/tui-go/ether-setup`。本基线不把这些算作本轮新增实现。

## 0. 总判定

Aetherion 目前不是一个成熟后端运行时，而是一个契约密集、测试密集、边界意识强的 seed harness。它在权威边界和非授权证据链上比 OpenClaw 更严格，但在实际运行时调度、工具治理、持久会话、插件/技能生态、输出管理和产品级 readiness 上明显落后。

最危险的假象是：仓库已经有 `agent-loop`、`shell_exec`、`web_fetch`、`agent_spawn`、VCS 分支、skills、proactive 等文件和测试，所以看起来像完整 agent runtime。实际不是。多个能力被声明给模型，但没有统一经过 Rust supervisor、策略代理、租约、输出保留、陈旧调用拒绝和持久 session runner。

当前基线结论：

- **优势但不完整：** Local Supervisor / Event Ledger / scoped lease / schema governance 是正确方向。
- **严重落后：** OpenClaw 已有多层工具策略、`before_tool_call` 总入口、Gateway 事件流、审批分发、skills 版本化懒加载、commitments 运行时和 SQLite 状态纪律；Aetherion 多数只有局部 TypeScript seed。
- **产品不可发布：** `npm test` 不是绿的，readiness/release evidence 当前被双语 docs 缺口阻塞。
- **下一步优先级：** 先收拢已声明工具的授权路径，再修复 readiness 测试，再补 OpenClaw 最低可借鉴运行时能力。不要先扩渠道、GUI、MCP、OAuth 或云端执行。

## 1. 当前 Aetherion 后端实况

| 运行时层 | 当前证据 | 批判结论 |
| --- | --- | --- |
| Agent loop | `packages/harness-core/src/agent-loop.ts` 可以多轮调用模型、处理工具调用、写模型请求/响应 artifact、追加 ledger 事件。 | 只是单进程 TypeScript loop。没有产品级 session runner、持久队列、crash recovery、stale call rejection、provider-turn durable admission。 |
| Tool registry | `createV1ToolRegistry()` 声明 `local_file_read`、`local_file_write`、`shell_exec`、`file_edit`、`search_files`、`list_files`、`web_fetch`、`agent_spawn`。 | 声明面已经大于授权面。`exec`、`fetch`、`spawn` 有各自 inline 分支，不是统一 ToolRequest/PolicyDecision/Lease/Verifier target family。 |
| Policy | `policy.ts` 有 boundary + operation 两步 seed pipeline，读 allow，写 ask。 | 和 OpenClaw 的多层 profile/provider/global/agent/group/sender policy 相比仍很薄；对 exec/network/subagent 没有等价 typed policy DSL。 |
| Lease enforcement | `local-file.ts` 对 read/write 检查 lease active、scope.tools、scope.egress、paths。 | 只覆盖文件读写。`shell_exec`、`web_fetch`、`agent_spawn` 没有等价 lease executor。 |
| Rust supervisor | `crates/supervisor/` 处理 workspace identity、hash ledger、file read/write/status/socket auth POC。 | 还不是通用 authority broker。没有管 shell、network、subagent、provider、vault、scheduler、adapter。 |
| VCS/sandbox | `vcs/branch.ts`、`tree-snapshot.ts`、rollback、subagent worktree 已存在。 | 当前 `vcs-gc.test.ts` 有失败；branch merge/checkout 仍是 seed 级本地复制，不是 OpenClaw/OpenCode 级 session publication/recovery。 |
| Skills | `skills.ts` 扫 `skills/*/SKILL.md`，抽 name/description/path 注入 prompt。 | 只学到 OpenClaw 懒加载的最小外形。没有 promptVersion、requires eligibility、source provenance、visibility policy、skill command dispatch、workspace/upstream source 区分。 |
| Proactive | `proactive.ts` 是纯函数 inhibition evaluator。 | 不是 Opportunity runtime。没有 OpenClaw commitments store/extraction/dedupe/delivery，也没有 durable queue。 |
| Provider | no-tools provider path和工具模式 artifact 已有；provider config 可存 API key。 | Vault 未落地，工具模式安全边界不完整；把 API key 明文放 `.aetherion/provider-config.json` 只能算 POC。 |
| Release/readiness | doctor/onboarding/release evidence 很丰富。 | 现在被 `docs/19` 双语 companion 缺口阻塞，说明 release gate 是真实的，但当前仓库不 ready。 |

## 2. 对 OpenClaw 的落后程度

| 能力 | OpenClaw 已有形态 | Aetherion 当前状态 | 落后等级 |
| --- | --- | --- | --- |
| 工具策略分层 | `src/agents/tool-policy-pipeline.ts`：profile、provider profile、global、agent、provider-agent、group、sender 多层过滤，并有 audit warning。 | 只有 read/write seed pipeline；agent/provider/sender/group 语义不存在。 | **L5 严重落后** |
| 工具调用总入口 | `src/agents/agent-tools.before-tool-call.ts` 集中跑 plugin hooks、trusted policies、approval、diagnostics、loop detection、skill telemetry、param adjustment。 | `agent-loop.ts` 针对不同 tool name 内联处理。没有统一 before-tool gate。 | **L5 严重落后** |
| 审批体系 | exec/plugin approval 有 allow once/always/deny、timeout、Gateway/渠道投递。 | 写文件有 consent record；exec/spawn 是 callback；fetch 无审批；没有持久 approval routing。 | **L5 严重落后** |
| 事件生命周期 | `src/infra/agent-events.ts` 有 run seq、lifecycle generation、Gateway restart stale event rejection。 | Ledger 有 hash chain 和 run manifest，但 agent loop 没有 lifecycle generation fence。 | **L4 明显落后** |
| Trace 传播 | `src/infra/diagnostic-trace-context.ts` 使用 W3C traceparent。 | Aetherion 有 replay/ledger traces，但跨 TS/Rust/工具链的标准 traceparent 不完整。 | **L3 落后** |
| Skills | `src/skills/loading/skill-contract.ts` 注入 name/description/location/version；`types.ts` 有 requires、exposure、invocation。 | 只有 name/description/path，一层目录扫描，无版本/eligibility。 | **L4 明显落后** |
| Commitments / proactive | `src/commitments/types.ts` 定义 pending/sent/dismissed/snoozed/expired，source、scope、dueWindow、dedupe、confidence。 | 只有 inhibition evaluator；没有 durable commitment records。 | **L4 明显落后** |
| 存储纪律 | `AGENTS.md` 明确 runtime 只读写 canonical SQLite，迁移放 doctor。 | Aetherion 有 JSONL ledger、registries、artifacts，但许多 runtime/projection family 仍在扩张，repair/rebuild 还未闭合。 | **L3 落后** |
| Gateway/渠道 | OpenClaw 有 loopback Gateway 与多渠道审批/消息。 | V1 正确地不做 IM/GUI/browser/cloud，但因此产品能力落后是事实。 | **故意落后，不补 V1** |
| 插件执行 | OpenClaw 进程内插件模型成熟但风险更大。 | Aetherion 正确拒绝把导入/生成代码放进 Local Supervisor。 | **不应追赶** |

## 3. Hermes 和 OpenCode 的校准意义

Hermes 不是本轮主目标，但它暴露 Aetherion 的产品化短板：Hermes README 声称完整 TUI、多平台 gateway、闭环记忆、cron、隔离 subagents、六种 terminal backend；`tools/approval.py` 有危险命令检测、contextvars 级 session/turn/tool correlation、gateway approval context、敏感路径规则；`managed_tool_gateway.py` 有 OAuth/token gateway 形态。Aetherion 在 V1 范围内不应该照搬这些表面，但必须承认自己的 runtime 还没有同等“活体后端”能力。

OpenCode 的校准更直接：`specs/v2/session.md` 把 prompt admission、durable inbox、context epochs、provider turn、tool settlement、stale running tool recovery、compaction 讲成可执行 runtime contract；`specs/v2/tools.md` 规定 opaque Tool Definition、input/output codecs、runner-supplied invocation context、stale registration rejection、output bounding。Aetherion 当前最缺的正是这些“工具调用不是函数调用，而是持久 session 事件”的语义。

## 4. 最尖锐的落后点

1. **工具声明先于授权。** `createV1ToolRegistry()` 已把 shell/network/subagent 暴露给模型，但 `evaluateSeedPolicy()` 仍只真正懂 read/write。OpenClaw 的每个工具调用都会经过统一 before-tool policy；Aetherion 当前是分支散落。
2. **Rust supervisor 不是运行时总门。** 文件读写可以走 Rust，其他关键能力仍在 TS 里直接执行。Local Supervisor 名义上是 root authority，但实际 coverage 不够。
3. **没有 durable session runner。** OpenCode 已把 session input、promotion、context epoch、tool settlement、interruption/recovery 写成运行时主线；Aetherion agent loop 还像一个可测试 generator。
4. **输出边界太弱。** `truncateForModel` 只能防 prompt 爆炸，不能替代 managed output retention、typed output codec、provider-facing projection 和完整结果引用。
5. **审批不是系统。** 写文件 consent 有 artifact，exec/spawn approval 是 callback，fetch 没有 policy gate。OpenClaw/Hermes 都有更完整的审批状态和投递模型。
6. **skills 只是目录扫描。** 缺版本、来源、eligibility、visibility、telemetry，不能支撑 OpenClaw 级技能生态。
7. **proactive 不是生命周期。** inhibition 函数不是 commitments store，也不是 Opportunity queue。
8. **测试不绿。** 当前 `npm test` 失败 10 项，其中 readiness/release gate 因 docs parity 失败。这不是小噪声，说明“可发布证据链”当前断了。

## 5. Aetherion 仍应保留的优势

这些不是落后项，不能为了追 OpenClaw 而丢掉：

- Capability Capsule 声明需求但不拥有权限；运行时授权必须是 policy proxy 签发的 scoped lease。
- Event Ledger 是事实层；registries、indexes、SQLite、FTS、vector 都只能是可重建投影。
- 导入插件、技能、生成包、connector adapter 不能成为 trust root。
- Dreaming 只能产出可审查补丁或候选记录，不能自动执行动作。
- V1 只做 TUI 和本地 supervisor loop，不补 IM、browser extension、GUI、mobile、cloud worker。

## 6. OpenClaw 对齐优先级

按“最小代码能消除最大误导”排序：

### P0 - 收拢已声明工具的授权路径

目标：让 `shell_exec`、`web_fetch`、`agent_spawn` 不再绕开统一策略。

最低可接受形态：

- 为 exec/fetch/spawn 建立 typed ToolRequest target family，至少进入 `risk.composed -> policy.decided`。
- 没有 lease executor 的工具不得宣称 lease-backed。
- fetch 需要 egress policy；默认只允许 loopback/明确 allowlist，外网 fetch 至少 L2 且可审计。
- exec/spawn 的 approval 必须产生持久 consent/approval artifact，而不是只靠 callback。

### P0 - 修复 release/readiness 断链

目标：`npm test` 至少不被 docs parity 和当前 GC 测试阻塞。

最低可接受形态：

- 补齐或链接 `docs/19-tui-visual-polish.zh-CN.md` 与英文 companion，恢复 onboarding/doctor/release evidence 预期。
- 对 `vcs-gc.test.ts` 做根因处理：要么 GC 真实删除 orphan tree，要么改测试暴露当前保护策略。不能把失败留成“已知小问题”。

### P1 - 引入 OpenClaw lifecycle generation 的 Aetherion 版本

目标：长运行、restart、nested child runs 不接受陈旧事件。

最低可接受形态：

- run manifest 或 runtime lock 记录 generation。
- append/complete terminal events 时校验 generation。
- stale generation 只能 blocked/aborted，不能覆盖当前 run/session 状态。

### P1 - skills 懒加载补到可用基线

目标：从“扫目录”变成“可治理的技能索引”。

最低可接受形态：

- `promptVersion` 或内容 hash。
- `requires` 只作为 availability filter，不授予权限。
- 区分 bundled/workspace/imported/quarantined source。
- prompt 中只注入 name/description/location/version。

### P1 - 统一 before-tool gate

目标：每个工具在执行前走同一个最小 hook，而不是分散在 `processToolCall` 分支里。

最低可接受形态：

- 一个内部 `beforeToolCall()`，先只做 built-in policies、loop detection、approval requirement classification。
- 不引入 plugin hook，不引入新依赖。
- 后续再扩展成 OpenClaw 式 plugin/trusted-policy hook。

### P2 - durable session runner / context epoch

目标：把 agent loop 从 generator 提升为 session runtime。

最低可接受形态：

- durable input admission。
- model-visible context baseline hash。
- tool call settlement 绑定 assistant message id / tool call id。
- stale advertised tool registration 被拒绝。

## 7. 不要借鉴的东西

- 不借 OpenClaw 的进程内插件执行。
- 不借 OpenClaw 的 25 个消息渠道作为 V1 目标。
- 不借 heartbeat 自打断模型。
- 不借 Hermes 的“哪里都能跑”的后端表面来绕过 Aetherion 的 Local Supervisor。
- 不借 OpenCode 的 bash host authority 作为 Aetherion 默认执行模型；Aetherion 必须先有 policy/lease/supervisor gate。

## 8. 本基线后的执行规则

每个后端补强 phase 必须引用本文件的一个 P0/P1/P2 项，并在完成时更新本节。

每轮最小闭环：

1. 重读本基线和 `docs/14-runtime-loop-plan.md`。
2. 只选一个运行时缺口。
3. 先写或更新能失败的最小测试。
4. 最小实现。
5. 跑相关测试，必要时跑 `npm test`。
6. 更新本基线或 phase 日志。
7. Lore commit，只 stage 本轮文件。

## 9. Phase 日志

### Baseline Refresh - 2026-06-23

本轮只刷新基线文档。关键发现：

- 当前后端比旧基线多了 agent loop、exec/fetch/spawn、skills、proactive、VCS/subagent isolation 等运行时薄层。
- 旧基线的 `201/201` 测试绿灯已过期；当前 `npm test` 是 `337/347`，失败 10 项。
- 最大架构风险不是“缺工具”，而是“工具已声明但授权/租约/持久 settlement 没有统一”。
- 下一轮最小补强应从 P0 选：先修 release/readiness 断链，或先收拢 exec/fetch/spawn 授权路径。

### Phase 05 - VCS GC orphan tree cleanup（P0 readiness）

本轮关闭两个 P0 release/readiness 断链：`gcUnreferencedObjects` 现在删除无效或非规范 SHA-256 tree 文件，同时保留合法 tree snapshot 作为 rollback/diff 目标并继续保护其 blob；`docs/19-tui-visual-polish.zh-CN.md` 也恢复了与英文页一致的双语链接。验证：`node --test packages/harness-core/test/vcs-gc.test.ts`，7/7 通过；`node --test packages/harness-core/test/*.test.ts`，238/238 通过；`npm test`，348/348 通过。
