# Computer Use 实现

[English](09-computer-use-implementation.md)

实现跟踪：[阶段实现复核](12-phase-implementation-review.zh-CN.md)，[运行时闭环计划](14-runtime-loop-plan.zh-CN.md)。

Computer Use 不是单个工具，而是覆盖浏览器、桌面、文件/仓库、代码和远程 worker 环境的受治理 action loop。实现必须保留 Aetherion kernel invariants：Local Supervisor 是 trust root，Event Ledger 是 fact layer，Tool Policy Proxy 门控敏感读取、数据外发和副作用动作。

Computer Use 属于 post-V1。V1 只做 TUI，先证明本地 kernel loop，再引入浏览器扩展、浏览器自动化、IM 投递、云 worker 或真实 connector。

## 设计目标

- 操作真实用户工作流：浏览器、本地电脑、文件、仓库、sandbox worker。
- 有结构化 API 或 DOM/CDP 时优先使用结构化方式。
- 结构缺失或不可靠时回退到 screenshot-based computer use。
- 默认把第三方内容视为 tainted。
- 每步动作后验证，而不是只在最后验证。
- 记录足够 trace 来重建决策，但不永久保留敏感 raw payload。
- 不允许浏览器扩展、connector、MCP server、生成 package 或云 worker 绕过 policy。

## 非目标

- 不受限远程桌面自动化。
- 把浏览器扩展变成全站读取器。
- 没有 policy 的点击/输入/提交表单。
- 让模型输出直接授权 computer action。
- 让 cloud worker、connector 或 generated code 成为 trust root。

## Runtime Shape

Computer-use request 应进入 Tool Policy Proxy，再经过 risk composition、sensitivity classification、taint propagation、permission diff、scoped lease、approval/denial、adapter execution、observation 和 verifier。

## Tool Request Contract

Tool request 应描述 actor、operation、target、reason、risk inputs、data egress、taint chain、expected observation 和 verification plan。真实动作前必须有 policy decision 和 lease。

## Policy Decision Contract

Policy decision 应明确 allow、deny、ask、queue 或 sandbox，并记录 rationale、risk summary、required approval、lease scope、expiry 和 denial reason。

## Browser Harness

浏览器 harness 需要组合 visual、DOM、automation 和 permission。current-tab scope、site consent、account isolation、file picker gate、upload/download gate 和 action diff 都必须显式。

## 参考实现经验

计算机操作 agent 的实际问题通常不是“能不能点击”，而是 target confidence、taint、verification、reversibility、credential exposure、egress 和 auditability。Aetherion 应先建立 governance loop，再扩大动作能力。

## Computer-Use Contracts

Computer-use action/observation 目前是 P2 合同并带 P1 风格验证。允许硬化合同，但不应启用真实浏览器/桌面自动化，直到 Local Supervisor 暴露受治理 action gateway。

## Local Computer Harness

本地电脑 harness 必须受 workspace、path、app target、file picker、approval 和 verifier 限制。shell/code/file/repo 操作不能绕过 supervisor。

## Cloud Worker And Remote VM

云 worker 和远程 VM 是 delegated worker，不是 trust root。它们只能接收 scoped work order，不能直接改 memory、capability、policy 或 vault。

## Sensitive Reads And Data Egress

敏感读取和数据外发同样重要。读取 secret、复制私有上下文、上传文件或把 DOM 文本发给 provider 都必须经过 policy。

## Data Sensitivity Classifier

分类器应区分 secret、credential、PII、private document、source code、customer data、financial/health/legal sensitive data、public content 等，并把结果进入 risk composition。

## Taint Propagation

来自网页、IM、文档、package、外部 connector 和模型输出的内容默认 tainted。tainted content 可以参与分析，但不能授权动作。

## Target Confidence

每次点击、输入、提交、文件写入或删除都应有 target confidence。低置信目标应 ask、sandbox 或拒绝。

## IM Control Surface

IM 是 remote control/notification surface，不是权限根。IM 输入应进入 identity/risk/taint/policy gate，输出投递也要排队和审批。

## Replay Semantics

replay 只重建 trace，不重复点击、发送、上传、删除、写入或其他 live side effects。

## Verifier Loop

动作后必须观察并验证。verification record 应绑定 action、observation、expected result 和 failure/correction path。

## Post-V1 MVP Scope

post-V1 可从最窄 browser observation、current-tab read、sandbox action 和 approval-gated local action 开始。真实 automation 扩展必须逐步进入 supervisor-governed path。

## 当前 Phase 12 Control-Plane Slice

当前 surface/computer-use 包只定义 control-plane 合同和测试：current-tab browser observation、IM inbox/outbox metadata、store publisher trust enrollment、store package verification 和隔离安装记录。`ether store install` 必须先有本地 operator 登记的 publisher key，再解析本地 replay-record evidence 并校验 sandbox file hash；它们不执行真实浏览器动作、IM 投递、connector 调用或 package code。
