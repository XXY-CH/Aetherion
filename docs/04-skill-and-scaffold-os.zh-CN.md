# Capability and Scaffold OS

[English](04-skill-and-scaffold-os.md)

实现跟踪：[阶段实现复核](12-phase-implementation-review.zh-CN.md)，[运行时闭环计划](14-runtime-loop-plan.zh-CN.md)。

## 概念

| Concept | 含义 | 可执行代码 | Agent 可修改 |
| --- | --- | ---: | ---: |
| Memory | 关于用户、项目、世界和任务历史的事实/解释 | 否 | 是，但需 trace |
| Skill | 做一类任务的过程知识或导入 skill 文档 | 通常否 | 是，需版本化 |
| Tool | 可调用函数、API 或系统能力 | 是 | 不能直接自动部署 |
| Workflow | skill 与 tool 的编排 | 有时 | 是，需测试 |
| Scaffold | 生成 tool、workflow、app、connector 或 UI 的模板 | 是 | 是，需 review |
| Capability Package | 可安装的隔离能力包 | 是 | 生成、验证、审批 |
| Capability Capsule | 受治理内部能力单元，绑定 playbook、manifest、tool contract、permission requirements/constraints、tests、evals、policy、provenance 和 rollback | 有时 | 通过 patch lifecycle 修改 |

Skill 不是 plugin。Skill 是知识和导入兼容表面；Tool 是 power；Permission 属于 Tool Policy Proxy 和执行边界。Capability Capsule 是 Aetherion 应围绕优化的内部单元。

Capability Capsule 不拥有权限。它声明权限需求、允许 tool contract 和 forbidden actions；runtime grant 由 policy 作为 scoped lease 颁发。

## Capability Lifecycle

Capability 应经过 proposal、draft、test、publish、score、patch、quarantine、rollback。每一步都应有 event evidence、manifest、tests/evals 和 policy constraints。成功 trace 可以提出 draft，但不能直接发布生产能力。

## Capability Capsule Manifest

Capsule manifest 应描述：

- capsule identity、version、status。
- playbook 与 source provenance。
- allowed tool contracts 与 forbidden actions。
- permission requirements 与 constraints。
- test/eval requirements。
- risk posture 与 rollback path。
- scoring、owner、review state。

manifest 是治理合同，不是权限授予。

## Capability Package

Capability Package 是可安装隔离 bundle，可能包含 manifest、schema、tests、policy、evals、approval UI 和 generated code。导入 package 默认隔离；安装与权限扩展必须通过 deployment gates。

## Capability Manifest

Capability Manifest 应可读、可 diff、可审计。它应记录权限 diff、依赖、target surfaces、egress、secret refs 和 review requirements。secret 只能作为 vault reference，不能明文进入 manifest。

## Deployment Gates

安装或启用能力前必须通过：

- schema/example validation。
- static scan 与 quarantine checks。
- tests/evals。
- permission diff。
- approval record。
- scoped lease 或 policy rule。
- rollback plan。

## Scoring

Capability score 应来自真实 trace、test result、user correction 和 failure recovery。score 是 routing signal，不是权限授权。
