# Memory OS

[English](03-memory-os.md)

实现跟踪：[阶段实现复核](12-phase-implementation-review.zh-CN.md)，[运行时闭环计划](14-runtime-loop-plan.zh-CN.md)。

Aetherion memory 是用于理解用户的可审计 operating system，不是松散 embedding store。

## 目标

- 保留有来源的长期记忆。
- 为真实任务快速组装上下文。
- 分离 raw events 与 interpreted memories。
- 跟踪 confidence、sensitivity、TTL 和 contradiction。
- 让用户 inspect、edit、export、delete memory。
- 支持 skill evolution，但不静默改写用户事实。
- 支持 event-driven dreaming 与 simulation。

## 层次

### 1. Event Ledger

Event Ledger 由 Event Plane 拥有，是不可变 source of truth。它记录消息、审批、tool result、失败、纠正、memory candidate 和 capability patch 等 typed events。Memory Card 必须能追溯到 source events。

### 2. Memory Cards

Memory Card 是原子长期记忆单元，应包含 claim、source event refs、confidence、sensitivity、TTL、owner/workspace、contradicts links、deletion/review state。它不是 embedding；embedding 和索引只是投影。

### 3. Episodic Timeline

Episodic Timeline 记录任务片段、失败与恢复、用户纠正、重复模式和 regression case。它帮助 agent 理解“发生过什么”，但不能自动变成事实记忆。

### 4. Semantic 与 Project Graph

图层连接用户、项目、文件、任务、约束、工具和决策。图是可重建投影，不能绕过 source event 或 deletion tombstone。

### 5. User Model

User Model 聚合稳定偏好、边界、风格、工作习惯和长期目标。它应来自被接受 Memory Card，而不是直接从一次 prompt 输出生成。敏感 persona anchor 需要明确 approval。

### 6. Context Assembler

Context Assembler 为当前任务选择 memory。它必须在排序前应用 deletion、blocked、secret、sensitivity 和 budget 规则；记录 excluded reasons；暴露 contradiction，而不是默默压平冲突。

## Event-Driven Dreaming Pipeline

Dreaming 是离线改进循环，不是未授权行动。它可以从 event trace 中提出 memory patch、capability candidate、test 或 documentation update，但输出应是 reviewable patch。任何实际写入、安装、执行或权限扩展仍必须经过 policy、approval 和 ledger evidence。
