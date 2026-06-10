# 架构

[English](01-architecture.md)

实现跟踪：[阶段实现复核](12-phase-implementation-review.zh-CN.md)，[运行时闭环计划](14-runtime-loop-plan.zh-CN.md)。

## 正交平面

```text
Client Surfaces
  TUI / GUI / Browser Extension / IM / Mobile / API
        |
        v
Ingress Gateways
  normalize / authenticate / rate-limit / idempotency
        |
        v
Local Supervisor
  identity / policy / vault / event ledger / workspace daemon
        |
        v
Agent Orchestrator
  context assembler / planner / agent loop / verifier
        |              |                    |
        v              v                    v
Memory OS       Capability OS        Proactive Engine
        \              |                    /
         \             v                   /
          +---- Tool Access & Action Policy Proxy ----+
                         |
                         v
        Connector Adapters + Execution Adapters
                         |
                         v
        Observations / Results / Artifacts
                         |
                         v
              Event Ledger + Projections
```

这不是瀑布架构，而是一组由 Local Supervisor 和 Event Plane 协调的正交平面。Memory、Capability、Proactive、Policy、Audit 和 Verifier 服务会在 run lifecycle 中反复被调用。

V1 只使用 TUI client surface。GUI、浏览器扩展、IM、移动端、API 和真实 connector 是长期目标，不是第一版需求。

## 正交规则

每个子系统只拥有一个关注点，并通过显式合同通信。

- 用户表面收集 intent 和 approval，不直接授予工具权限。
- Local Supervisor 是根权限边界，而不是某个 UI。
- User Boundary Layer 负责身份、同意、信任和面向用户的审批 policy。
- Event Plane 是 memory、proactive、audit、replay 和 capability evolution 的事实层。
- Context and Planning Plane 负责 planning 和 routing，不直接持久化未经 review 的长期 claim。
- Memory OS 带来源和敏感度元数据存取用户/项目知识。
- Capability OS 存储受治理的 Capability Capsule。Capsule 声明权限需求与约束，但不拥有 runtime grant。
- Scaffold OS 生成并验证 capability package，但没有 deployment gate 不会安装。
- Tool Access & Action Policy Proxy 是唯一访问与动作 choke point。
- Connector Plane 适配协议与 API。MCP 和 OAuth 是连接机制，不是执行边界。
- Execution Plane 只通过已批准 tool session 和 sandbox policy 执行动作。
- Audit system 重建安全决策、副作用、权限变更、记忆变更、能力变更和用户可见输出。
- 远程执行环境是 delegated worker，不是 trust root。

## 核心请求流

```text
User or event source
  -> User Surface
  -> Local Supervisor
  -> Identity, device, and workspace resolution
  -> Event Plane typed event
  -> User Boundary risk precheck
  -> Context Assembler
  -> Planner
  -> Capability Resolver
  -> Tool Access & Action Policy Proxy
  -> Connector Adapter or Execution Adapter
  -> Observation event
  -> Evaluator and verifier
  -> Memory or capability patch candidates
  -> Audit, replay anchors, and user-visible result
```

## Event Plane

Event Ledger 不是日志便利设施，而是产品 source of truth。

重要输入与状态转移都进入 typed events：用户消息、IM/浏览器/文件/connector/webhook event、tool request/result、approval decision、memory/capability candidate、computer-use observation、proactive opportunity 和 policy decision。

低价值高频 observation 可以按 retention policy 采样、汇总或过期。安全决策、敏感读取、data egress 和副作用必须可重建。

append-only 不代表永久保留所有原始内容。ledger 存储 envelope、provenance、hash、redaction marker、deletion tombstone 和 artifact reference；敏感 payload 应在带 retention、redaction 和加密擦除策略的 artifact store 中。

## Tool Access & Action Policy Proxy

任何 agent、skill、connector、MCP server、IM adapter、scaffold 或生成 package 都不能直接读取敏感资源、注入上下文、导出数据或执行副作用动作。所有访问和动作都经过 Tool Access & Action Policy Proxy。

```text
Agent intent or capability request
  -> Tool Access & Action Policy Proxy
  -> risk composition
  -> sensitivity classification
  -> taint propagation check
  -> permission diff
  -> scoped lease issuance
  -> approval or denial
  -> adapter or execution call
  -> result event
```

proxy 从 action type、target resource、data sensitivity、side effect、reversibility、audience、credential scope、runtime boundary、user intent 强度、taint chain、target confidence、blast radius 和 data egress destination 组合风险。

## Connector 与 Execution Adapter

Connector Plane 和 Execution Plane 不是上下游，而是 Tool Access & Action Policy Proxy 后面的 adapter 家族。

Connector adapters 暴露外部服务：MCP、OAuth/SaaS、IM、Webhook。

Execution adapters 控制计算环境：Local Computer、Browser Harness、Sandbox Browser、Cloud VM worker、Code Runner、File/Repo Operator。

MCP 是协议，不是安全边界。MCP tool 可以代表任意代码路径，因此必须被 Aetherion 包裹：

```text
MCP Server
  -> Connector Adapter
  -> Tool Access & Action Policy Proxy
  -> Connector or Execution Adapter
```

## Proactive Flow

```text
Event source
  -> correlation
  -> opportunity object
  -> salience score
  -> attention budget check
  -> inhibition layer
  -> policy gate
  -> intervention ladder
  -> audit and memory impact review
```

主动行为是 Opportunity Lifecycle。Aetherion 不周期性“醒来思考”，而是响应有意义的状态变化、计算 opportunity、尊重 attention budget，并选择最不打扰的干预。

定时器可用于精确 deadline 和维护任务，但用户可见的主动性通常应来自真实事件：新消息、文件变化、日历窗口、失败任务、用户纠正、过期记忆、connector webhook、重复能力使用、重复能力失败或未完成工作流。

主动行为必须有 inhibition layer。安静时间、会议、群聊上下文、低置信度、污染来源、不可逆动作、被忽略的类似机会或未确认目标都应抑制打断。

## Browser Operator

浏览器层应组合四类能力：

- Visual：截图、元素识别、computer-use action loop。
- DOM：结构化页面树、选中文本、表单、链接、accessibility metadata。
- Automation：Playwright、CDP、extension API、上传、下载、profile。
- Permission：站点级同意、账号隔离、文件选择器 gate、action diff。

系统应优先使用结构化 DOM/API 操作，必要时回退到视觉 computer-use。

## 外部协议

Aetherion 应支持 MCP 作为主要外部工具协议。内部 manifest 可以比 MCP 更丰富，但外部能力应尽量以兼容 tool contract 暴露或包装。

OAuth connector 策略：

- MVP：快速 connector provider 加 Aetherion 自有 permission firewall。
- Production：核心集成使用代码自有 connector runtime。
- Long tail：外部 connector marketplace 提供广度。
- Security：connector authorization 不等于 agent permission。Aetherion 仍必须按用户、scope、action、risk 和 context 审批工具使用。

## 导入边界

导入配置是 migration input，不是可信 active capability。

OpenClaw、Hermes、MCP server、第三方 skill 和 connector import 应生成 migration report。tools、plugins、hooks、cron jobs、unknown fields 和 external packages 默认隔离，直到 review。secret 只应作为 vault reference 迁移，不能复制 plaintext。
