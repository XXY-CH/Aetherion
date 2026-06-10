# Aetherion Computer Use Scaffold

[English](README.md)

这是 post-V1 的受治理 computer-use adapter 脚手架。

当前 package 刻意不实现真实浏览器自动化或桌面控制。它只定义未来 adapter 必须遵守的安全 control-plane 形状：

- adapter 声明能力。
- browser target 必须 current-tab scoped。
- 有结构化通道时优先于截图回退。
- 有副作用动作必须先取得 scoped policy lease。
- 有副作用 adapter 还需要 approval card。
- sensitive reads、taint 和 data egress 都必须显式。
- observation 不能授权后续动作。

本 package 的目标是保护未来 computer-use 扩展不会绕过 Local Supervisor、Event Ledger 或 Tool Policy Proxy。
