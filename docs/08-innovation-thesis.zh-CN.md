# 创新论点

[English](08-innovation-thesis.md)

实现跟踪：[阶段实现复核](12-phase-implementation-review.zh-CN.md)，[运行时闭环计划](14-runtime-loop-plan.zh-CN.md)。

Aetherion 最有价值之处不是“又一个能操作电脑的 agent”。Computer use 会成为基础能力。高杠杆赌注是一个受治理的 harness kernel，让 agent 行动可信、可演化、可检查、可迁移。

下面四个创新赌注应指导架构、产品范围和 MVP 顺序。

## 1. Capability Capsule 替代传统 Skill

传统 agent skill 通常是知识包：指令、例子、触发条件，也许带一些 helper 文件。

Aetherion 应把这只当作一层。内部一等单元是 Capability Capsule：

```text
Capability Capsule =
  playbook
  manifest
  tool contract
  permission requirements and constraints
  tests
  evals
  policy
  provenance
  rollback
```

Capsule 不拥有权限。它声明需求与约束；runtime grant 来自 policy 颁发的 scoped lease。这样能力可以被提出、测试、发布、评分、隔离和回滚，而不是变成不受限插件。

## 2. Event-Driven Proactive，而不是 Cron Proactive

主动行为不应是 agent 定时醒来打断用户。它应从真实事件出发：消息、文件变化、失败任务、用户纠正、过期记忆、connector webhook、重复能力使用或未完成工作流。

Proactive flow 应产生 opportunity object，计算 salience，检查 attention budget 和 inhibition layer，再决定是否提示、排队、shadow 或静默。Quiet hours、会议、低置信度、污染来源、不可逆动作和未确认目标都应抑制打断。

## 3. Dreaming 是 Reviewable Patches

Dreaming 不应是 opaque introspection，也不应直接执行外部动作。它应该从 event ledger 和 replay 中找出改进机会，提出 memory patch、capability patch、test、eval 或 doc update。

输出必须可 review、可 diff、可回滚。任何实际安装、写入、执行、发送或权限扩展仍需 policy、approval 和 ledger evidence。

## 4. 人类可读 Source Of Truth 加可重建索引

治理源头应是 Markdown、YAML、JSON Schema 和 JSONL。数据库、向量索引、图索引和搜索索引是 projection，可以从 source of truth 重建。

这种设计让用户和维护者可以审查权限、记忆、能力、policy 和 replay。它也让 migration、backup、diff、review 和 security audit 更自然。

## 产品赌注总结

Aetherion 的长期优势来自四个组合：

- Capability Capsule 让能力演化可治理。
- Event-driven proactive 让主动性可解释且可抑制。
- Dreaming as patches 让自改进可 review。
- Human-readable truth plus rebuildable indexes 让系统可信、可迁移、可审计。
