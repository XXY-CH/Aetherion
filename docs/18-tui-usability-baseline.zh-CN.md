# TUI 可用性基线 — Hermes / OpenCode / Codex 对比

[English version](18-tui-usability-baseline.md)

参考仓库（隔离于 `.quarantine/`）：
- Hermes：`.quarantine/hermes/` — Python，prompt_toolkit REPL + 可选 Ink TUI
- OpenCode：`.quarantine/opencode/` — TypeScript，OpenTUI/SolidJS，客户端/服务端分离
- Codex：`.quarantine/codex/` — Rust，ratatui，guardian 审批模型

---

## 1. 三个参考项目的优势

### 提供商连接（Ether 的 #1 阻塞点）
| 特性 | Hermes | OpenCode | Codex | Ether |
|------|--------|----------|-------|-------|
| `/model` 交互式选择器 | ✅ 从 API 获取实时模型列表 | ✅ DialogModel 带搜索 | ✅ `/model` 命令 | ❌ 仅 stub |
| `/connect` 提供商设置 | ✅ 每提供商 OAuth + API key | ✅ 插件驱动认证方法 | ✅ ChatGPT OAuth + API key | ❌ 无 |
| 多提供商同时支持 | ✅ 30+ 提供商配置 | ✅ 动态 @ai-sdk 导入 | ✅ openai/bedrock/ollama | ❌ 仅 stub |
| API key（环境变量+配置+OAuth） | ✅ 三者都支持 | ✅ 三者都支持 | ✅ 三者都支持 | ❌ 仅环境变量 |
| 模型别名 | ✅ `model_aliases` 配置 | ✅ 通过配置 | ✅ 模型目录 | ❌ 无 |

### 交互模型
| 特性 | Hermes | OpenCode | Codex | Ether |
|------|--------|----------|-------|-------|
| 流式响应 | ✅ 逐 token | ✅ 通过 SDK 事件 | ✅ StreamController | ⚠️ 批量（整段响应一次） |
| 多行输入 | ✅ TextArea 带 .md 语法 | ✅ TextareaRenderable | ✅ vim 模式 | ✅ textarea |
| 斜杠命令自动补全 | ✅ SlashCommandCompleter | ✅ 自动补全组件 | ✅ 弹窗 | ✅ 过滤列表 |
| `@` 上下文引用 | ✅ @diff @staged @file: @url: | ✅ @-mentions | ✅ /mention | ❌ 无 |
| 工具审批 UX | ✅ 内联面板 allow-once/always/deny | ✅ PermissionPrompt 弹窗带 diff | ✅ guardian 模型 + 弹窗 | ⚠️ 仅 stdin y/n |
| 编辑内联 diff | ✅ render_edit_diff_with_delta | ✅ `<diff>` 分屏/统一 | ✅ diff_render.rs 97KB | ❌ 无 |
| 轮次中转向 | ✅ /steer 轮次中注入 | ✅ session.interrupt | ✅ escape 中断 | ❌ 无 |

### 系统提示词
| 特性 | Hermes | OpenCode | Codex | Ether |
|------|--------|----------|-------|-------|
| 按模型差异化提示 | ✅ 按 api_mode | ✅ 按提供商系列 | ✅ 按模型目录 | ❌ 一个硬编码 |
| SOUL.md / AGENTS.md | ✅ SOUL.md + HERMES.md | ✅ AGENTS.md | ✅ AGENTS.md 规范 | ⚠️ AGENTS.md 存在 |
| 动态环境块 | ✅ 平台 + 工具 | ✅ cwd/git/平台/日期 | ✅ 沙箱 + 工作区 | ❌ 无 |
| 记忆注入 | ✅ volatile 层 | ✅ 通过 instructions | ✅ memories | ✅ MemoryCard（仅 daemon） |

---

## 2. Ether TUI 当前状态 — 具体问题

### P0 — 阻塞性可用性问题
1. **只有 stub 提供商可用。** 真实 LLM 提供商（OpenAI、Anthropic 等）未接入 TUI。`/connect` 无效。TUI 只能与确定性 stub 对话。
2. **无真实流式。** Agent 响应在完整生成后一次性出现，不是逐 token。
3. **工具审批仅 stdin y/n。** 无可视化 diff，无"允许始终"，无工具行为上下文。

### P1 — 缺失核心功能
4. **无 `/model` 选择器获取实时模型列表。** 无法在 TUI 中切换模型。
5. **无文件编辑内联 diff。** Agent 写文件时无可视化 diff。
6. **VCS 未接入 TUI。** Git 式 VCS（phase 16-21）存在但无斜杠命令（`/snapshot`、`/rollback`、`/branch`）。
7. **系统提示词是静态的。** 无动态环境块（cwd、git 状态、平台、日期）。
8. **无 `/compact`。** 上下文窗口填满后无压缩机制。

### P2 — 打磨
9. **无 `@` 上下文引用。**
10. **无 `/init`。**
11. **无人格系统。**
12. **无对话历史搜索。**

---

## 3. 迭代优先级

### Phase 22 — 真实提供商连接（P0-1）
将 OpenAI 和 Anthropic 接入 TUI。`/model` 选择器获取实时 API 模型列表。API key 从环境变量+配置读取。

### Phase 23 — 流式响应（P0-2）
从提供商到 TUI 的逐 token 流式，替代批量响应。

### Phase 24 — 可视化工具审批带 diff（P0-3）
用可视化审批面板替代 stdin y/n，展示工具行为，支持 allow-once / allow-always / deny。

### Phase 25 — VCS 斜杠命令（P1-6）
将 `/snapshot`、`/rollback`、`/branch` 接入 TUI 斜杠命令系统。

### Phase 26 — 动态系统提示词（P1-7）
环境块（cwd、git、平台、日期）+ 记忆 + 人格每轮注入。

### Phase 27 — 内联文件编辑 diff（P1-5）
Agent 写文件时在 transcript 中显示统一 diff。

---

## 保留事项（Harness 工作台身份）
- **三栏布局**（事件树 + transcript + 信息卡片）—— Ether 独特的工作台身份。
- **策略/租约/同意管道** —— 在信息卡片面板中可见。
- **账本可见性** —— 事件树独特，必须保留。
- **VCS 层** —— Git 式操作是核心差异化。
