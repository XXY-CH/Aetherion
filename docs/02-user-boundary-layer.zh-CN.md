# 用户边界层

[English](02-user-boundary-layer.md)

实现跟踪：[阶段实现复核](12-phase-implementation-review.zh-CN.md)，[运行时闭环计划](14-runtime-loop-plan.zh-CN.md)。

User Boundary Layer 是 Aetherion 的主要安全与产品边界。它位于 Local Supervisor 之下，决定 agent 是否可以行动、在哪里行动、使用哪种用户权限，以及必须记录或审批什么。

根权限边界是：

```text
Local Supervisor
  -> Policy Engine
  -> Secret Vault
  -> Event Ledger
  -> Tool Policy Proxy
```

TUI、GUI、浏览器扩展、移动端和 IM 都是 client surface。它们可以请求动作、展示审批，但不是 trust root。

## 边界问题

每个重要动作都必须回答六个问题。

### Who

谁在请求动作：用户、agent、capability capsule、proactive engine、remote surface、connector event，还是 imported scaffold？不同 actor 的默认信任级别不同。

### Where

动作在哪里执行：本地设备、浏览器 profile、sandbox、cloud worker、connector provider，还是外部 SaaS？执行地点决定可观察性、credential exposure 和 rollback 能力。

### What

动作具体做什么：读取、写入、发送、删除、导出、导入、运行代码、点击、提交表单、安装 capability，还是改变记忆？

### Why

动作为什么被请求：直接用户命令、计划步骤、自动恢复、proactive opportunity、capability test，还是 migration/import？原因必须可审计。

### Risk

风险来自 sensitivity、side effect、audience、reversibility、credential scope、taint chain、confidence、blast radius 和 egress destination。risk composition 应产生可解释 policy decision。

### Memory Impact

动作是否会写入长期记忆、删除记忆、改变 persona anchor、生成 skill candidate 或更新 capability score？记忆变更需要自己的 evidence 和 review。

## Tool Policy Proxy

Tool Policy Proxy 是所有敏感读取、数据外发和副作用动作的统一 gate。它不只阻止写入，也要阻止静默读取 secret、泄露私有上下文或把污染内容注入 prompt。

典型 policy input 包括：

- actor 与 workspace identity。
- target resource 与 operation。
- data sensitivity 与 taint status。
- user intent strength。
- reversibility 与 side-effect scope。
- credential scope。
- required approval。
- active lease 与 expiration。
- evidence refs 与 event lineage。

输出应明确 allow、deny、ask、queue 或 sandbox，并写入 Event Ledger。

## Consent Ledger

用户同意不是 UI 状态，而是 ledger evidence。审批记录应包含请求、风险摘要、变更 diff、scope、expiry、actor、workspace、用户选择和后续 action refs。

同意不能无限复用。长期授权应被拆为 scoped lease、policy rule 或 capsule permission requirement，并可审计、撤销、过期。

## 默认安全规则

- 默认拒绝未知 actor、未知 workspace、路径逃逸、secret plaintext、未审查 import 和未绑定 connector。
- direct connector authorization 不等于 agent permission。
- 被污染输入不能授权动作。
- model output、audit pass、memory projection 和 registry row 都不能自动授权 side effect。
- sensitive read、context injection、data egress 和 write/delete/send/install/execute 都必须显式进 policy。
- replay 只能重建历史，不能重复 live side effects。
- capability capsule 声明需求和约束，不拥有权限；runtime grant 是 scoped lease。
