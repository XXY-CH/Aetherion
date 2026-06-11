# 迁移与运行时经济性

[English](11-migration-and-runtime-economics.md)

实现跟踪：[阶段实现复核](12-phase-implementation-review.zh-CN.md)，[运行时闭环计划](14-runtime-loop-plan.zh-CN.md)。

本文记录 post-V1 关于 OpenClaw/Hermes migration、advanced agent-system bets 和 runtime cost controls 的讨论。它不改变 V1 规则：第一版 runnable product 仍是 TUI-only，并聚焦本地 kernel loop。

## 范围边界

这些想法有价值，但大多不是 V1 deliverables。

V1 仍然是：

- TUI command surface。
- contract validation。
- local workspace identity。
- Event Ledger append。
- tool request。
- policy decision。
- scoped lease。
- local file read/write through policy。
- observation、verification 和 trace replay reconstruction。

post-V1 的迁移和运行时经济性应在这个基础上增长，而不是绕过它。

## Practicality Analysis

### OpenClaw And Hermes Migration

外部 agent 配置、skill、tool、hook 和 connector 可以作为 migration input 导入，但默认隔离。migration report 应记录 high/low confidence mappings、quarantined items、unsupported fields、secret vault refs 和 review-required items。

### Causal Memory And Counterfactual Reasoning

causal memory、why report 和 counterfactual report 能帮助解释失败和规划修复，但它们是分析 artifact，不是 proof 或 authority。

### Parallel Sandbox Branches And Resumable Execution

sandbox branch 可用于 rehearsal 和 proposal，不应直接 mutation live workspace。resume/hibernation 应丢弃 active leases，并在 wake 时重新进入 policy。

### Multi-Agent Economics And Permission Circuit Breakers

子 agent 需要预算、隔离、circuit breaker 和 taint handling。子输出不能继承父权限；重复 denial 或异常成本应触发 breaker。

### Local Observability

observability 应帮助用户理解 run、policy、memory、capability 和 replay，但 dashboard/HUD 不能成为 authority。

### Digital Hibernation And Event-Driven Wakeup

hibernation 保存 cursor、minimal context、attention budget 和 wake trigger。wake 只 queue resume，不保留 lease，不执行 action。

### Zero-Trust Agent Contracts And Token Escrow

agent contract 应把 permission、budget、lease、tool constraints 和 output authority 明确化。token/secret 应由 vault 引用，不进入 prompt、logs 或 examples。

### Memory Folding And Persona Anchors

memory folding 和 persona anchor 需要 source evidence、review、TTL 和 sensitivity control。它们不能静默覆盖业务记忆或用户事实。

### Digital Soul Fork And Inheritance

Soul Fork 是隔离身份/上下文实验，不继承 authority。inheritance policy 应禁止未审查权限迁移。

### Anti-Poisoning And Honeypots

外部内容和导入 package 需要 taint、honeypot trial、regression fixture 和 quarantine，防止污染内容授权动作。

## Capsule Store 信任边界

未来 Capsule Store 可以支持低信任 capability market，但安装必须由 package 外部的信任锚治理，例如本地 operator 登记的 publisher key。package 内自带 public key 或自报 sandbox/replay passed 不能证明 publisher authenticity 或 safety evidence。

Store install 至少应要求 manifest validation、permission diff、本地 replay-record evidence、sandbox artifact hash verification、user approval、signed version 和 rollback metadata。Store 不是 plugin free-for-all；信任单元仍是经过 review 的 Capsule lifecycle。

## Innovation Application Tracks

可探索 tracks 包括 event-driven hibernation、causal simulation、multi-agent economics、memory folding、capsule store、local HUD、serverless agent/fork/replay。它们都必须保持 Local Supervisor 与 Tool Policy Proxy 边界。

## Runtime Cost Controls

成本控制包括 event sampling/folding/compression、hibernation/lazy loading、scoped lease/resource budget、tiered replay/simulation、event priority scheduling、incremental Memory OS update、capsule execution isolation、deferred visualization/log analysis。

这些优化不能删除安全关键 trace，也不能让 projection 取代 source truth。

## Architecture Implications

长期架构需要支持 migration、hibernation、causal memory、multi-agent budget、capsule store 和 observability，但这些都应作为受治理 runtime slice 加入。

## Roadmap Placement

这些方向位于 V1 之后。当前优先级仍是关闭本地 runtime loops，而不是扩大 schema 或 surface。
