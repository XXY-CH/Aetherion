# Aetherion Connector SDK Scaffold

[English](README.md)

这是 post-V1 的外部 adapter 脚手架。

当前 package 刻意不实现真实 IM、MCP、OAuth 或 SaaS connector。它只定义注册边界：

- import 默认 quarantine。
- connector authorization 不是 agent permission。
- 每个 connector tool call 都必须变成 Tool Request。
- delivery 和 data egress 必须经过 Tool Policy Proxy。
- secret 只能表示为 vault reference。

换言之，connector 是连接机制，不是 trust root，也不是绕过 Aetherion policy 的捷径。
