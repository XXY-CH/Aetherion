# 路线图

[English](06-roadmap.md)

实现跟踪：[阶段实现复核](12-phase-implementation-review.zh-CN.md)，[运行时闭环计划](14-runtime-loop-plan.zh-CN.md)。

## Phase 0: Foundation Documents

目标：把概念变成可构建的产品框架。

交付物包括 product brief、layered architecture、User Boundary Layer policy、Memory OS model、Skill/Scaffold lifecycle、audit/data contract draft 和 MVP acceptance criteria。

退出标准：开发者能解释每个子系统边界，并识别 permissions、memory、skills、tools 和 execution 分别由谁拥有。

## Phase 1: TUI Kernel Plus One Real Action

目标：证明本地命令可以进入 policy、lease、action、observation、verification 和 replay。

范围：TUI command、workspace identity、Event Ledger append、本地文件 read/write、approval-gated write、run manifest 和 replay reconstruction。

## Phase 2: Rust Supervisor POC With Ether Client

目标：把权限边界从 TypeScript seed path 推向 Rust Local Supervisor POC。

范围：workspace init、hash-chained JSONL event append/verify、local file policy、scoped lease、lease-gated read、traced write prepare/commit，以及 Ether client 对接。

## Phase 3: Memory OS MVP

目标：让 Memory 从 trace-backed candidate 进入 review、active card、context pack 和 tombstone。registry 是投影，不是 source truth。

## Phase 4: Computer Harness MVP

目标：为 browser/desktop/file/repo/code/remote worker 的 governed action loop 打基础，但真实 browser automation 仍 post-V1。

## Phase 5: Capability Capsule MVP

目标：从成功 trace 产生 capsule draft，通过 replay tests、sandbox trial、publish/quarantine/rollback 形成受治理能力生命周期。

## Phase 6: Proactive Shadow Mode

目标：记录 opportunity 与 inhibition，先 shadow mode，不实际打扰用户或执行动作。

## Phase 7: Scaffold OS and Capability Packages

目标：定义 capability package 的生成、验证、隔离、安装和 rollback gate。生成代码不能直接获得权限。

## Phase 8: Minimal User Connection

目标：探索最小用户连接 surface，但保持 Local Supervisor 为根权限。IM/mobile/browser 等仍不能成为 trust root。

## Phase 9: GUI and Broader Connectors

目标：在 TUI kernel loop 足够坚固后扩展 GUI 和 connector。OAuth/SaaS/MCP connector 都必须经过 permission firewall 和 Tool Policy Proxy。

## Future Track: Migration And Runtime Economics

目标：处理 OpenClaw/Hermes migration、runtime cost、hibernation、causal memory、multi-agent economics、store package 和 observability 等长期方向。它们不能改变 V1 TUI-first 的规则。
