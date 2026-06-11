# Aetherion Supervisor POC

[English](README.md)

这是未来 Local Supervisor 权限边界的 Rust proof-of-concept。

当前范围：

- workspace initialization。
- 从 resolved workspace root 派生 workspace identity，并在 runtime initialization 前拒绝 mismatched RPC workspace id。
- append 与 Ether trace verification 兼容的 `aetherion-event-v1` SHA-256 linked JSONL events。
- 与 TypeScript 一致地 canonicalize 完整 v1 event envelope，并在启动时验证所有 v1 authors。
- 使用 workspace-local lock 串行化 event append，并处理 stale lock、temp file、atomic rename 和 corrupt hash chain。
- 拒绝 workspace id 与 active workspace 不匹配的 Ledger event。
- 评估最小 deterministic local file policy。
- 颁发 scoped lease。
- 用 lease-gated read 和 traced write prepare/commit 证明本地文件 action lifecycle。
- 仓库级 Supervisor Lifecycle Readiness contract 只把 status/preflight 作为 observable readiness evidence；它不声明 production daemon start/stop、socket-auth lifecycle、stale-lock recovery、vault-backed supervisor secret 或 lease authority 已实现。

重要边界：

- supervisor 是 authority path 的 POC，不是完整生产 daemon。
- 它不实现真实 vault、browser automation、connector、IM delivery 或 cloud worker。
- caller 不能通过 RPC 提供伪造 workspace id 或直接 append authority-bearing lifecycle events。
