# 安全政策

[English](SECURITY.md)

Aetherion 是早期本地优先 runtime 原型。我们欢迎安全报告，尤其是涉及权限边界、policy bypass、event integrity、scoped lease、secret handling、tainted input 或非预期副作用的问题。

## 支持版本

当前还没有稳定公开 release。安全审查目标是默认分支，以及维护者明确命名的活动 release 分支。

| Version | Supported |
| --- | --- |
| `main` / active development branch | Yes |
| Older snapshots, forks, and local experiments | No |

## 报告漏洞

请私下报告漏洞。不要在公开 issue 中包含 exploit 细节、secret、credential、私有 trace、原始用户数据或可能伤害用户的 proof-of-concept payload。

首选路径：

1. 如果仓库启用了 GitHub private vulnerability reporting 或 security advisory flow，请使用它。
2. 如果不可用，请私下联系维护者，先确认安全报告渠道，再分享敏感细节。

在安全可行时，请包含：

- 影响的简要说明。
- 受影响文件、命令、schema、crate 或 package。
- 使用脱敏或合成数据的复现步骤。
- 是否可以绕过 Local Supervisor、Tool Policy Proxy、scoped lease、consent、Event Ledger verification、quarantine 或 replay checks。
- 建议修复或缓解方式。

## 关注范围

高优先级报告包括：

- 绕过 policy 的读取、写入、导入、导出、connector call 或生成代码路径。
- Ledger hash-chain、replay、artifact reference 或 projection integrity 失败。
- 原始 secret、credential、prompt、模型输出、私有 payload 或敏感 trace 持久化。
- 被污染的浏览器、IM、文档、web、package 或第三方内容授权动作。
- Capability Capsule、store package、sandbox 或 migration flow 未经审查继承信任。
- Rust supervisor RPC 接受畸形 envelope、错配 workspace identity、过期 lease、错误路径，或绕过 trace lifecycle 直接执行文件动作。

当前不属于本仓库安全流程范围：

- 针对未实现生产系统的攻击，例如真实 IM 投递、OAuth connector、浏览器自动化、云 worker 或 vault backend。
- 项目 runtime 之外的本地开发机器拒绝服务。
- 需要提交真实 credential 或私有用户数据才能证明影响的问题。

## 维护者响应

维护者会尽量及时确认有效私有报告、评估影响、协调修复并记录解决结果。项目尚处 pre-release，时间线可能变化，但安全敏感问题应在缓解方案可用前保持私密。

## 安全研究规则

- 使用合成 workspace 和脱敏 fixture。
- 不要外传数据或运行破坏性动作。
- 不要尝试在本地测试 workspace 之外持久化。
- 在维护者有合理处理时间前，不要公开 exploit 细节。
