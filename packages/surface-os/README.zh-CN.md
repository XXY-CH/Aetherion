# Surface OS

[English](README.md)

Phase 12 的 browser、IM 和 Capsule Store surface control-plane package。

当前范围：

- Browser current-tab observation records。
- IM inbox metadata records。
- IM outbox policy queue records。
- trusted-publisher signed Capsule Store package verification。
- local declaration install records。

非目标：

- 不做真实浏览器自动化。
- 不做真实 IM 投递。
- 不让 Capsule Store package 直接执行。
- 不把 surface、connector 或 store 变成 trust root。

Store package 安装必须先登记本地 publisher key，再用该 trust anchor 校验签名，并解析本地 replay/sandbox evidence；package code 仍不会执行。

这些 surface 只记录和验证 control-plane evidence，实际读取、投递、安装或执行仍需要 Local Supervisor 和 Tool Policy Proxy。
