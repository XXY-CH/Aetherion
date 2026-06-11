# 技术策略

[English](10-technical-strategy.md)

实现跟踪：[阶段实现复核](12-phase-implementation-review.zh-CN.md)，[运行时闭环计划](14-runtime-loop-plan.zh-CN.md)。

仓库治理链接：[行为准则](../CODE_OF_CONDUCT.zh-CN.md) / [Code of Conduct](../CODE_OF_CONDUCT.md)、[贡献指南](../CONTRIBUTING.zh-CN.md) / [Contributing](../CONTRIBUTING.md)、[安全政策](../SECURITY.zh-CN.md) / [Security Policy](../SECURITY.md)、[MIT 许可证](../LICENSE) / [中文说明](../LICENSE.zh-CN.md)、[issue templates](../.github/ISSUE_TEMPLATE/bug_report.yml) 和 [pull request template](../.github/pull_request_template.md)。

命令与 readiness 入口：[README.zh-CN](../README.zh-CN.md#合同优先工作区)。

## 决策

Aetherion 使用 contract-first、local-first 的混合架构。

```text
TypeScript: product velocity, contracts, agents, connectors, browser, frontend
Rust: authority, policy, vault, ledger, sandbox, native execution
Python: eval and research only
JSON Schema / YAML / JSONL / Markdown: human-readable contracts and governance metadata
SQLite: rebuildable local projections
```

runtime 从模块化 monolith 开始，只在 trust boundary 处分裂。

## V1 Surface

V1 只做 TUI。GUI、移动端、IM、浏览器扩展、浏览器自动化、真实 MCP/OAuth connector 和 cloud worker 都延后。

TUI 应证明 command surface、workspace identity、contract validation、event ledger append、tool request、policy decision、scoped lease、本地文件 read/write、observation、verification 和 replay。

## Language Ownership

- TypeScript：schema iteration、contract validation、TUI seed work、Agent Orchestrator 原型、connector/browser/frontend 速度层。
- Rust：Local Supervisor 权限边界、policy/vault/ledger/sandbox/native execution。
- Python：eval/research only，不进入 authority path。

Rust 不是为了重写一切，而是为了把权限、lease、ledger 和 native action 的根边界做硬。

## Process Boundaries

最初可以是模块化 monolith，但 authority boundary 应逐步迁到 Rust supervisor。client、orchestrator、memory/capability/proactive plane 可以保持 TypeScript 速度，但不能绕过 supervisor action path。

## IPC Strategy

IPC 应使用显式 envelope、workspace identity、request id、auth/binding、version、schema validation 和错误分类。RPC 不能允许 caller 提供伪造 workspace id 或直接 append authority-bearing lifecycle events。

## Current Rust POC

当前 Rust POC 负责 workspace init、path-derived identity、hash-chained JSONL ledger、cross-author verification、deterministic local file policy、scoped lease、lease-gated read 和 traced write prepare/commit。

## Storage Strategy

人类可读合同与 ledger 是 source of truth。`.aetherion/` 是本地 runtime state。SQLite/vector/graph/search 是可重建 projection。secret 不进入 examples、fixtures、logs、schemas、docs 或 tests。

## Policy Strategy

Policy 应先证明少量本地文件动作，再扩展到 browser、connector、IM、cloud 和 generated package。所有敏感读取、context injection、egress、write/delete/send/install/execute 都必须经过 Tool Policy Proxy。

## Node Baseline

当前 TypeScript 测试和 CLI 以 Node.js 25+ 为基线。
