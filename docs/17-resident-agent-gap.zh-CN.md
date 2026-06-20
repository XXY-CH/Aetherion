# 常驻 Agent 能力差距分析

[English](17-resident-agent-gap.md)

本文档映射 Aetherion 当前 Agent 运行时与 OpenClaw 常驻 Agent 能力之间的差距。它是所有未来 ponytail 迭代的优先级待办列表，目标是功能对齐。

---

## 差距矩阵

| # | 能力 | OpenClaw | Aetherion | 差距严重性 |
|---|---|---|---|---|
| 1 | 常驻守护进程 | 完整（launchd/systemd/schtasks，KeepAlive） | 无（CLI 一次性，设计如此） | **关键** |
| 2 | 入站渠道（约30个） | 完整（Telegram/WhatsApp/Discord/Slack/...） | 仅 TUI；IM 是仅哈希存根 | 延后（V1 = TUI） |
| 3 | 主动出站消息 | 完整（消息工具、cron 推送、心跳） | 阻塞（发件箱永不投递） | **高** |
| 4 | 定时任务/cron | 完整（at/every/cron，持久化，重试） | 仅数据模型，无监听器 | **关键** |
| 5 | 后台任务 | 完整（exec/process + 任务账本） | 无 | **高** |
| 6 | 持久化记忆 | 完整（MEMORY.md + 向量 + dreaming） | 成熟模型，不自动注入循环 | **关键** |
| 7 | 工具执行 | 100+ 工具（shell/文件/web/浏览器/媒体/MCP） | 2 个工具（读/写文件） | **关键** |
| 8 | 多 Agent/子 Agent | 完整（隔离 agent + 生成 + ACP） | 1 个硬编码读操作 | 中 |
| 9 | 通知 | 完整（APNs/web push/渠道投递） | 无 | 中 |
| 10 | 状态持久化 | 完整（SQLite + JSONL） | 证据层成熟；活跃状态零持久化 | **高** |
| 11 | 配置/人格 | 完整（SOUL.md + JSON5 + 热重载） | 成熟模型，不实时影响行为 | **高** |
| 12 | 技能/自定义命令 | 完整（57 技能 + hooks + 插件） | 胶囊 = 仅文档 | 中 |

## 优先级排序（按用户感知价值 × 可行性）

以下每项是一个 phase。排序依据：什么让 Agent 感觉「活的」而非「脚本」。

### P0 — 让 Agent 循环真正有用（工具 + 记忆）

当前被阻塞：Agent 只能读写文件，且没有记忆注入。修复这些会立刻改善每次对话。

1. **Shell 执行工具** —— `exec` 工具，运行命令并返回 stdout/stderr。策略门控（L4 风险），副作用需审批。没有这个，Agent 除了文件 I/O 什么都做不了。
2. **Web 获取工具** —— 获取 URL 并返回 markdown/文本。只读，L2 风险。没有这个，Agent 无法查询任何信息。
3. **记忆注入 Agent 循环** —— 在循环启动时将 `MemoryCard` + `UserModel` 加载到系统提示中。数据模型存在（`memory-os`），只是没接线。

### P1 — 让 Agent 持久化（守护进程 + 调度）

4. **前台守护进程模式** —— `ether daemon --workspace .` 在长生命周期进程中运行 Agent 循环（还不是系统服务；只是保持存活并接受输入的前台进程）。
5. **截止触发器监听器** —— 按间隔轮询 `hibernation` 唤醒。数据模型（`createDeadlineTrigger`）存在；只需一个监听循环。
6. **会话恢复** —— 守护进程启动时从账本 + transcript 重新加载上次对话。

### P2 — 让 Agent 主动（出站 + 通知）

7. **出站消息投递** —— 策略允许时实际投递 `ImOutboxItem`（至少投递到 TUI 作为通知）。
8. **主动机会生命周期** —— 实现带抑制的主动面（安静时段、置信度阈值、污染来源阻断）。
9. **桌面通知** —— 任务完成/审批请求时的原生 OS 通知。

### P3 — 让 Agent 可扩展（技能 + 多 Agent）

10. **技能加载** —— 惰性加载 `SKILL.md` 文件到系统提示（OpenClaw 模式：仅注入名称/描述，模型按需读取）。
11. **子 Agent 生成** —— 让 Agent 在预算下将子任务委派给子 Agent。
12. **人格注入** —— 将 `PersonaAnchor` / `SOUL.md` 加载到系统提示。

## 本文档取代什么

本文档取代 `docs/16-openclaw-baseline.md` §11 中以 TUI 功能为焦点的待办列表。基线文档的可借鉴清单（lifecycle UUID、承诺状态机等）仍是有效的微观改进，但常驻 Agent 差距是战略优先级。
