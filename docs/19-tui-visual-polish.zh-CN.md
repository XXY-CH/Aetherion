# TUI 视觉打磨 —— Hermes / OpenCode 差距分析

[English](19-tui-visual-polish.md)

基于代码级研究：为什么 Hermes 和 OpenCode 的 TUI 像发布产品，而 Ether 像茅草屋。研究来源是隔离仓库（Hermes = TypeScript/React+Ink，OpenCode = TypeScript/Solid+OpenTUI；**两者都不是 Go/lipgloss**，所以 Ether 要移植的是设计模式而非代码）。

Ether 的静态渲染：`NonInteractive` 模式，120×40。引用标注 `.quarantine/{hermes,opencode}/` 内的文件:行号。

---

## 1. 让 Ether 显得粗糙的五个差距

按视觉冲击排序，最便宜的修复在前。

### 差距 1 —— 对话区不渲染 markdown（影响最大）

Ether 把助手文本原样倒进对话区（`base.go` `renderTranscriptContent`）。Hermes 和 OpenCode 都自带**手写的终端 markdown 渲染器**，把助手输出变成可读文档：

- **Hermes** `.quarantine/hermes/ui-tui/src/components/markdown.tsx` —— 逐行解析器：带语言标签的代码围栏（`─ lang`）、8 种语言语法高亮（`lib/syntax.ts`）、带 3 级列宽求解器的 GFM 表格、带逐行增删背景色的 `diff` 块（`markdown.tsx:774-787`）、行内数学 → Unicode（`texToUnicode`）、`==高亮==`、引用块、任务列表、带抓取标题的自动链接。解析结果按主题 LRU 缓存（`markdown.tsx:611`）。
- **OpenCode** 用原生 `<markdown streaming={true} tableOptions={{style:"grid"}}>` 渲染器，60 个 tree-sitter 作用域 → 主题色规则（`theme/index.ts:586-1088`），斜体注释、粗斜体类型，`generateSubtleSyntax` 为推理块做 alpha 衰减。

**Ether 现状：** 扁平的 `messageBlock` 字符串拼接（`base.go:277`）。代码块、表格、粗体 —— 全无样式。这是对话区像调试日志的最大原因。

**移植计划：** 一个 Go 的 markdown→带样式字符串渲染器。从小做起：带语言标签的代码围栏 + 针对 Ether 工具实际产出的语言（ts、go、json、bash、diff）的关键词/字符串/注释 tokenizer。Diff 块用 clay/ember 染色的 `+`/`-` 行。表格和数学以后再说。

### 差距 2 —— 没有品牌色身份

Ether 用 ivory/slate 调色（`theme.go`），雅致但**匿名** —— 读起来像通用暗色主题，不像产品。

- **Hermes** `theme.ts:257` —— 刻意的金/琥珀/青铜身份（`primary #FFD700`、`accent #FFBF00`、`border #CD7F32`、文本 `#FFF8DC` cornsilk）。一眼可辨，横跨提示符、边框、状态栏、logo 渐变、双蛇杖 ASCII 启动屏一致。甚至优雅降级：`bestReadableAnsiColor` 重算 ANSI-256 回退（`theme.ts:183`）。
- **OpenCode** —— 30+ 内置 JSON 主题（catppuccin、dracula、gruvbox、nord……）外加 `generateSystem` 从终端自身 16 色调色板派生主题（`theme/index.ts:360`），尊重终端透明度。默认 `opencode` 主题用柔和的染色 diff 背景（`#20303b` 增 / `#37222c` 删）而非刺眼的红绿。

**Ether 现状：** clay 强调色是唯一的签名色。没有 logo、没有启动屏、不感知终端调色板。

**移植计划：** 保留 ivory/slate 基底但 (a) 把 clay 确立为唯一的品牌强调色（提示符 `❯`、聚焦边框、logo）处处一致，(b) 欢迎屏加一个小的 ASCII 字标启动屏，(c) 加柔和的 diff 染色。

### 差距 3 —— 工具/diff/审批只在侧栏，不在行内

Ether 把工具调用渲染成扁平的对话行（`messageBlock`），审批是独立的 3 行栏（`renderApprovalBar`）。Hermes 和 OpenCode 把这些**行内渲染**在对话流里，是丰富、可扫读的块：

- **Hermes** `thinking.tsx:689` —— 可折叠的**制表符树**，`├─ `/`└─ ` 导轨，每个在途工具一个 spinner + 实时计时器（`● edit_file src/app.ts (2.3s)`），热点子 Agent 分支的热力图色杆（`heatColor` `thinking.tsx:268`），`Σ ~2.0k total` token 汇总，箭头章节头。Diff 片段穿插在叙述里，带 `diffAdded`/`diffRemoved` 背景色。
- **OpenCode** `session/index.tsx:1833-2030` —— 两种范式：`InlineTool`（单行，固定宽图标列：`→` 读、`←` 写、`$` shell）和 `BlockTool`（左侧竖 `┃` 边框、染色面板、`# 标题`、点击展开）。Diff 用原生 `<diff>`，12 种独立可主题化的颜色，120 列自动切换 split/unified。审批是行内框，`theme.warning` 左边框、diff 预览、选项药丸。

**Ether 现状：** `🔧 local_file_read(...)` 扁平行。审批栏（`base.go:525`）脱离对话，行内不显示 diff。

**移植计划：** 一个行内 `toolBlock` 渲染器，运行时显示调用 + spinner，完成后折叠成带结果的一行摘要。写操作时，行内渲染染色的 unified diff（我们已有 `approval_diff.go` 的 diff 逻辑 —— 在对话区复用，不只是审批栏）。

### 差距 4 —— 没有流式 / spinner 反馈

Ether 批量显示助手响应（整段文本在循环完成后一次出现）。两个参考都是 token 逐个流式，带实时光标。

- **Hermes** —— `streamingMarkdown.tsx` 在最后稳定块边界拆分，只有飞行中的尾部按 delta 重新解析；420ms 闪烁的 `▍` 光标（`StreamCursor` `thinking.tsx:194`）。
- **OpenCode** —— 原生 `<markdown streaming={true}>` + Knight-Rider 扫描 spinner（`■`/`⬝` 拖尾，从 Agent 色派生的 alpha 衰减渐变，`ui/spinner.ts:272`）。

**Ether 现状：** `chatBusy` 切换一个 `● run N/M` 状态文本（`base.go:166`）。没有 token 流式、没有光标。这让 UI 在长轮次里感觉冻住。

**移植计划：** daemon 已经在 JSONL 事件流上发 `assistant_text` 块（`agent-loop.ts:371` `yield {type:"assistant_text", content}`）。Go TUI 的 `applyLoopEvent`（`chat.go`）已经累积 `assistantBuffer`。把渲染接上：`chatBusy` 时显示带闪烁 `▍` 光标的 buffer，`assistant_text_done` 时落定为真实对话条目。

### 差距 5 —— 密度高但没有层次

Ether 塞了 6 个常驻侧栏卡 + 树侧槽 + 3 行审批区，让对话区感觉像附属品。两个参考都把**对话流当主角**，其他东西要么进单行状态栏，要么进可切换的浮层。

- **Hermes** —— 单列：对话流（flex-grow）+ 输入框 + 1 行状态栏。其他一切（模型选择、会话、Agent 树）是输入框上方的浮动浮层。渐进披露：状态栏随宽度增长添加段（`statusBarSegments` `appChrome.tsx:256`），窄时先让出 cwd。
- **OpenCode** —— 单列 + **可选**右侧栏（宽 42，`wide()` 时或切换显示）。侧栏放插件面板（文件、todo、lsp、mcp）。对话流 `flexGrow`，输入框固定，状态在 1 行 footer。

**Ether 现状：** 常驻三栏（侧槽 + 对话 + 6 卡侧栏）。侧栏和树侧槽信息重复（LEDGER 事件两边都出现）。

**移植计划（已批准方向）：** 保留三栏工作台身份（见 `docs/18`「保留什么」），但侧栏可切换，精简到 3 卡（合并 STATUS + LEDGER + RISK），TOKENS/AUTHORITY/LEASES 移到已有的 `/usage` `/policy` `/lease` 浮窗。侧槽默认折叠成图标栏。

---

## 2. 可参考的代码位置（要移植的模式，不是复制）

由于两个参考都不是 Go/lipgloss，这些是要重新实现的设计模式，不是导入。

| 模式 | Hermes | OpenCode | Ether 移植目标 |
|------|--------|----------|---------------|
| Markdown 渲染器 | `hermes/ui-tui/src/components/markdown.tsx` | `opencode/packages/tui/src/theme/index.ts:586`（语法规则） | 新建 `packages/tui-go/setupapp/markdown.go` |
| Diff 染色 | `markdown.tsx:774` | `session/index.tsx:2336`（`<diff>`） | 把 `approval_diff.go` 扩展成对话 `diffBlock` |
| 主题/调色 | `theme.ts:257`、`bestReadableAnsiColor:183` | `theme/index.ts:360` `generateSystem` | 扩展 `theme.go`，加 diff 染色 + 字标 |
| 行内工具树 | `thinking.tsx:689`（导轨 + spinner + 热力图） | `session/index.tsx:1833`（InlineTool/BlockTool） | 新建 `tool_block.go` 渲染器 |
| 流式光标 | `streamingMarkdown.tsx`、`StreamCursor:194` | `ui/spinner.ts:272`（扫描器） | 把 `chat.go` 的 `assistantBuffer` 接到 `▍` 光标 |
| 状态栏（1 行，渐进） | `appChrome.tsx:405` `StatusRule` | `routes/session/footer.tsx` | 精简 `renderFooter` + 把侧栏移成可切换 |
| 可折叠章节（箭头） | `thinking.tsx` `SessionPanel`、`TodoPanel` | `sidebar.tsx` files/todo 插件 | 复用浮窗管理器（`wm.go`） |
| 欢迎启动屏 | `branding.tsx:85` `Banner` + 双蛇杖 | `routes/home.tsx` + 动画 `logo.tsx` | 把扁平的 `renderWelcome` 换成字标 |

---

## 3. Ether 已经有、值得保留的东西

工作台身份（`docs/18`「保留什么」）是真正的差异化 —— Hermes 和 OpenCode 都是单列聊天客户端，没有常驻事件可见性。Ether 的 **git-tree 侧槽**（带 checkpoint/branch/HEAD 节点的事件主干）和 **policy/lease/consent 流水线卡**是独有的。修复不是放弃它们，而是别让它们和对话区抢空间。

保留：
- 三栏布局（树 + 对话 + 侧栏）作为工作台身份。
- Policy/lease/consent 在侧栏可见。
- 通过树侧槽的账本可见性。
- VCS 层（git 式操作）。

改变：
- 对话优先比例（已完成：上一提交的 64%）。
- 行内 markdown + 工具块，让对话区配得上它的空间。
- 可切换/精简侧栏，密度变成可选。
- 流式 + spinner，让对话区感觉活着。

---

## 4. 建议的修复顺序

1. **行内 markdown 渲染器**（差距 1）—— 最大视觉收益，自包含，可用 fixture 字符串测试。起点：代码围栏 + diff 染色。
2. **流式光标**（差距 4）—— 事件管线已存在；这是 `chat.go` 的小渲染改动，「感觉活着」收益大。
3. **行内工具/diff 块**（差距 3）—— 在对话区复用 `approval_diff.go` 逻辑；把扁平 `🔧` 行折叠成丰富块。
4. **品牌字标 + diff 染色**（差距 2）—— 小的 `theme.go` + 欢迎屏改动；低风险。
5. **侧栏精简 + 侧槽图标模式**（差距 5）—— 等对话区能独立后做的布局改动；把卡片移到已有的浮窗。

每一项都可独立发布和测试。
