# 产品简报

[English](00-product-brief.md)

实现跟踪：[阶段实现复核](12-phase-implementation-review.zh-CN.md)，[运行时闭环计划](14-runtime-loop-plan.zh-CN.md)。

## 名称

Aetherion 是当前项目代号。

这个名字结合了“不可见媒介”的感觉与“指挥/能动性”的含义，应该像一个可以穿过设备、工具、记忆与工作流的智能底层介质。

它还不是最终公开名称。现有研究显示，Aetherion 在 GitHub、PyPI、商标和既有平台上可能存在 AI/agent 相关冲突。因此在完成正式命名清查前，项目应保留命名风险说明。候选公开名称包括 Helmweaver、Vigil Loom、AegisForge、Northstar Runtime、Keelstone、Loomguard 和 Argos Kernel。

## 项目图标

规范项目图标是 [`assets/aetherion-icon.png`](../assets/aetherion-icon.png)。它是 1254 x 1254 PNG，不应重新着色、裁剪、叠加装饰或嵌入文字。可维护源文件是 [`assets/aetherion-icon.svg`](../assets/aetherion-icon.svg)。

图标标识当前 Aetherion 代号项目，但不替代命名清查，也不建立最终公开商标。

## 一句话

Aetherion 是本地优先的 Agent Harness Kernel，把用户的设备、数据、权限、记忆、工具和消息渠道连接成安全、可审计、自我改进的 agent runtime。

## 命令表面

V1 终端界面名为 **Ether**。面向用户的命令使用 `ether`，例如 `npm run ether -- run ...`；“TUI” 描述终端交互模型，不是命令名。

## 定位

Aetherion 不是单个聊天机器人、工作流构建器、IM bot、浏览器自动化工具、记忆应用或替代操作系统。它是 OS 风格的 harness kernel，让这些能力在统一信任边界下协作。

它应组合这些有价值的方向：

- 多渠道入口，让用户能触达 agent。
- computer-use harness，用于真实设备操作。
- 长期记忆系统，用于稳定理解用户。
- 受治理的能力演化，用于掌握重复任务。
- MCP 与 OAuth connector，用于工具和数据访问。
- 本地优先桌面 UX，用于信任、审批和审计。

但它不应继承常见失败模式：把入口、权限、记忆和执行混成一个不安全的整体。

## 目标用户

- 想让 agent 操作真实工作环境的 power user。
- 需要可审计、可扩展 harness 的开发者与 operator。
- 在浏览器应用、文档、消息、日历、仓库和文件之间工作的知识工作者。
- 需要每用户 agent 边界，而不是共享大权限 bot 的团队。

## 核心任务

1. 让用户把真实工作委托给本地应用、浏览器、文件、SaaS 工具和代码仓库。
2. 让 agent 建立可检查的长期用户模型：偏好、项目、约束和工作流。
3. 让重复成功模式变成受治理的 Capability Capsule。
4. 让 agent 生成新能力包，但不能绕过测试、policy 或用户审批。
5. 让用户从 IM、移动端、浏览器或桌面触达 agent，同时保留清晰权限边界。
6. 让重要动作都能通过日志、来源引用、决策、审批和 replay artifact 重建。

## V1 产品边界

V1 只做 TUI。第一版产品表面应是终端界面，先证明本地 kernel loop，再引入 GUI、移动端、IM、浏览器扩展或 connector。

V1 必须证明：

- 本地用户可以从 TUI 发起命令。
- run 被记录为 events。
- tool request 经过 policy。
- scoped lease 门控本地文件访问。
- approval-gated write 是显式的。
- observation 与 verification records 被发出。
- replay 可以重建 trace，而不重复真实副作用。

V1 延后：

- Tauri/React GUI。
- 移动伴侣。
- IM 投递。
- 浏览器扩展。
- 浏览器自动化。
- MCP/OAuth/SaaS connector。
- 云 worker。

## 非目标

- 纯云聊天机器人。
- 把单个共享 IM bot 当作多用户安全边界。
- 在 TUI kernel loop 被证明前，把 V1 扩散到 GUI、移动端、IM、浏览器扩展和 connector。
- 生成代码立即获得真实用户权限的不受治理 auto-plugin 系统。
- 只存 embedding、没有来源/置信度/敏感度/删除控制的记忆系统。
- 只依赖慢速视觉点击、忽略 DOM/API/connector 的 computer-use loop。
- 成为 trust root 的浏览器扩展、connector 或云 worker。

## 差异化

产品不因为能操作浏览器或终端而值得构建；这会变成基础能力。长期差异化由四部分组成：

- Capability Capsule 替代传统 Skill，成为受治理能力单元。
- Event-driven Proactive 替代 cron 式自我打断。
- Dreaming 产生可 review patch，而不是不透明内省。
- 人类可读 source of truth 加可重建索引，建立信任和可迁移性。

### Local Supervisor 与用户边界

Aetherion 的核心产品护城河是 Local Supervisor 加 User Boundary Layer：policy、vault、event-ledger 和 approval 系统共同回答谁在请求、在哪里执行、做什么、为什么做、风险是什么，以及是否改变长期记忆或能力。

桌面应用只是控制表面，不是根权限本身。

### Event Plane

Event Plane 是产品事实层。每条消息、工具调用、审批、记忆候选、能力 patch、computer action、主动机会和 policy decision 都成为 append-only ledger 中的 typed event。Memory、proactive、audit、replay 和 capability evolution 都是这个事实层上的投影。

### Memory OS

Aetherion memory 是结构化操作层：

- 原始不可变 events。
- 原子 memory cards。
- episodic task histories。
- semantic/project graphs。
- user model。
- context assembler。
- dreaming 与 simulation loops。

### 受治理能力演化

Capability Capsule 可以被提议、起草、测试、发布、评分、修补、隔离和回滚。Skill 是过程知识或导入格式；Capability Capsule 是内部治理单元，绑定 playbook、manifest、tool contract、权限需求与约束、tests、evals、policy、provenance 和 rollback。

### Capability Packages

agent 生成的脚手架会成为隔离 package，包含 manifests、schemas、tests、policies、evals、approval UI 和 deployment gates。

### Tool Policy Proxy

任何 agent、skill、connector、MCP server、IM adapter、scaffold 或生成 package 都不能直接读取敏感资源、注入上下文、导出数据或执行副作用动作。这些访问与动作都必须经过 Tool Policy Proxy。

Proxy 也门控敏感读取、observation、data egress、import/export 和 context injection。只阻止写入还不够；如果 agent 能静默读取 secret 或泄露私有上下文，边界仍然失败。
