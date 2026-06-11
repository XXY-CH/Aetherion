# 审计与数据合同

[English](05-audit-and-data-contracts.md)

实现跟踪：[阶段实现复核](12-phase-implementation-review.zh-CN.md)，[运行时闭环计划](14-runtime-loop-plan.zh-CN.md)。

## 审计原则

- 日志既要人类可读，也要机器可解析。
- 每个安全相关决策、外部副作用、权限变更、记忆变更、能力变更和用户可见输出都应可重建。
- 低价值高频 observation 可按 retention policy 采样、汇总或清除。
- 每个 material action 都有 actor、reason、input、output、risk level 和 timestamp。
- 每个 memory claim 都指回 source events。
- 每个 Capability Capsule 和 capability package 都有 version history 与 rollback。
- 每个 permission change 都有 diff 与 consent record。
- 每个 proactive action 都解释 trigger。
- audit log 本身是敏感 artifact，需要 retention、redaction、encryption 和 export-sanitization policy。

## Source Of Truth

人类可读文件是 durable source of truth：

- Markdown：playbook、decision、report、human review。
- YAML：manifest、policy、migration report。
- JSONL：append-only event ledger。
- JSON Schema：contract。

SQLite、vector index、graph index 和 search index 是可重建投影，不是权威源头。

## Ledger 与 Artifact Retention

Ledger 保存 envelope、hash、provenance、redaction marker、tombstone 和 artifact ref。敏感 payload 应进入加密 artifact store，受 retention 与 erasure 控制。删除通常表现为 tombstone 和 cryptographic erasure，而不是破坏 event lineage。

## Event Record

Event Record 是事实层最小 envelope。它应包含 event id、run id、workspace id、actor、type、timestamp、payload hash/ref、parent hash 和 author。hash-chain 让 trace 可重建并能发现篡改。

## Proactive Opportunity

Proactive Opportunity 是主动行为的候选对象，不是动作许可。它应记录 source events、salience、attention budget、inhibition reason、policy gate 和 intervention ladder。

## Replay Record

Replay Record 重建历史 trace。Replay 不得执行 live side effects；它只能验证 event ordering、payload refs、policy/lease/action/observation/verification sequence 和 hash integrity。

## Agent Tool Request Proposal

Agent Tool Request Proposal 是从通过审计的模型响应中，经 operator 重新表述后记录的“提案”。它不是 `tool.requested`，不会触发 policy、lease、read/write 或副作用。把提案变成真实动作仍需进入 Tool Policy Proxy。

## Causal Reports 与 Projections

Causal reports、Why reports、Counterfactual reports 是解释和分析 artifact。它们可以指出依赖、影响和假设，但不能作为 authority 或 registry repair。

## Migration Report

Migration Report 记录导入结果：高置信映射、低置信映射、隔离项、unsupported fields、secret vault refs 和 review-required items。导入不是激活。

## Action Record

Action Record 记录副作用动作或准备执行的动作，应绑定 policy decision、scoped lease、consent、target、input/output hash、observation 和 verification。

## Permission Policy

Permission Policy 定义允许、拒绝、询问、排队或 sandbox 的规则。它必须基于 actor、scope、operation、risk、sensitivity、taint、lease 和 evidence。

## Memory Candidate

Memory Candidate 是待 review 的记忆，不是 active memory。它应指向 source events，并保留 confidence、sensitivity、review state 和 possible contradictions。

## Repository Layout Proposal

仓库布局应继续区分 schemas、examples、packages、crates、docs 和 runtime state。`.aetherion/` 是本地运行状态，默认不提交。
