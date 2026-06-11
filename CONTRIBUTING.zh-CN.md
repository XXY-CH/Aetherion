# 贡献指南

[English](CONTRIBUTING.md)

感谢你帮助构建 Aetherion。Aetherion 是本地优先 Agent Harness Kernel 的代号。贡献应增强受治理运行时，而不是过早扩大产品表面。

## 项目边界

Aetherion 不是聊天机器人、替代操作系统、不受限插件宿主或泛 connector 市场。当前构建仍以 V1 为目标，并且 TUI-first。

适合早期贡献的方向：

- JSON Schema 和匹配 examples。
- 合同验证与 fixtures。
- Ether 终端命令表面。
- Rust Local Supervisor 权限检查。
- Event Ledger append、verification、replay 和 projection audit。
- Tool request、policy decision、scoped lease、本地文件 action、observation 和 verification 流。
- 澄清权限、policy、memory、capability 或 audit 边界的文档。

除非有明确实现阶段要求，请避免过早加入真实 GUI、移动端、IM 投递、浏览器自动化、MCP/OAuth connector、云 worker、secret backend、生成包执行或不受限插件行为。

## 开发设置

要求：

- Node.js 25 或更新版本。
- Rust 和 Cargo。
- full dependency-audit gate 需要 `cargo-audit`（`cargo install cargo-audit --locked --version 0.22.1`）。

常用命令：

```sh
npm ci --ignore-scripts
npm audit --audit-level=high --json
npm test
cargo audit
cargo test --locked
npm run test:all
cargo clippy --all-targets --all-features --locked -- -D warnings
cargo fmt --check
git diff --check
npm run ether -- doctor --workspace .
npm run ether -- security audit --workspace .
npm run ether -- run --workspace . --input README.md --output .aetherion/SUMMARY.md --approve-write
```

`.aetherion/` 下的运行时输出是本地状态，不应提交。
pull request 和 push 到 `main` 会通过 GitHub Actions 运行 lockfile install、dependency audit、TypeScript 测试、locked Rust 测试、Rust lint/format、whitespace diff check、runtime/build artifact tracked guard、operator readiness snapshots、Node 24 JavaScript action-runtime opt-in，以及 Ubuntu/macOS platform-smoke job。

根 JavaScript surface 当前没有 npm dependency，但 `package-lock.json` 已提交；未来任何 dependency 增加都必须在同一变更中更新 lockfile。`Cargo.lock` 已提交，Rust verification 应使用 `--locked`。被 ignore 的 `promo/` 子树是 local/generated promotional material，不属于 release evidence。

## 贡献流程

1. 改行为前先读相关文档，尤其是 `docs/00-product-brief.md`、`docs/01-architecture.md`、`docs/06-roadmap.md` 和 `docs/10-technical-strategy.md`。
2. 保持变更小、可 review、可回滚。
3. 合同类改动应同步更新 schema、example、fixture、最小 runtime path 和测试。
4. cleanup/refactor 先写清理计划，并先用测试保护现有行为。
5. 添加抽象前先复用现有 helper 和模式。
6. 没有 issue 或维护者明确要求时，不新增依赖。
7. 不要在 examples、fixtures、logs、schemas、docs 或 tests 中存储原始 secret、token、私有数据、原始 prompt、原始模型输出或敏感 trace。
8. 先运行最窄的有用测试，实用时在请求 review 前运行 `npm run test:all`。

## 合同优先清单

新增 kernel contract 或 lifecycle transition 时，应包含：

- `schemas/` 中的 JSON Schema。
- `examples/contracts/` 中的有效示例。
- 数据进入 harness 时的 runtime validation。
- 对缺失、畸形或绕过权限数据的负向测试。
- 证据性数据需要 Ledger 或 artifact references。
- 语义改变时更新文档。

## Pull Request

PR 应说明 intent、触碰的权限边界、已运行测试和已知缺口。如果变更影响 runtime safety、policy、ledger semantics、replay、memory、capability lifecycle 或外部表面隔离，请明确指出。

Commit message 应尽量遵循仓库的 Lore protocol。至少第一行要写“为什么改”，而不是机械描述 diff。

## 许可证

贡献即表示你同意贡献以 [MIT License](LICENSE) 授权。
