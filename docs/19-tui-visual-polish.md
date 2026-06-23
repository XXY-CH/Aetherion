# TUI Visual Polish — Hermes / OpenCode Gap Analysis

[中文版本](19-tui-visual-polish.zh-CN.md)

A code-level study of what makes the Hermes and OpenCode TUIs feel like
shipped products, and the concrete gaps that make Ether read as a "straw hut."
Built from the quarantined reference repos (Hermes = TypeScript/React+Ink,
OpenCode = TypeScript/Solid+OpenTUI; **neither is Go/lipgloss**, so the
patterns — not the code — are what Ether should port).

Static render captured for Ether: `NonInteractive` mode, 120×40.
Reference findings cite file:line inside `.quarantine/{hermes,opencode}/`.

---

## 1. The Five Gaps That Make Ether Feel Crude

Ranked by visual impact, cheapest-fix first.

### Gap 1 — No markdown rendering in the transcript (highest impact)

Ether dumps raw assistant text into the conversation pane (`base.go`
`renderTranscriptContent`). Hermes and OpenCode both ship **hand-rolled
terminal markdown renderers** that turn assistant output into a readable
document:

- **Hermes** `.quarantine/hermes/ui-tui/src/components/markdown.tsx` —
  line-based parser: fenced code with language label (`─ lang`), 8-language
  syntax highlighting (`lib/syntax.ts`), GFM tables with a 3-tier column-width
  solver, `diff` blocks with per-line add/remove background tints
  (`markdown.tsx:774-787`), inline math → Unicode via `texToUnicode`,
  `==highlight==`, blockquotes, task lists, autolinks with fetched page titles.
  Parsed output is LRU-cached per theme (`markdown.tsx:611`).
- **OpenCode** uses a native `<markdown streaming={true} tableOptions={{style:"grid"}}>`
  renderable with 60 tree-sitter scope → theme-color rules
  (`theme/index.ts:586-1088`), italic comments, bold-italic types, and a
  `generateSubtleSyntax` that alpha-multiplies foregrounds for reasoning blocks.

**Ether today:** flat `messageBlock` string join (`base.go:277`). Code blocks,
tables, bold — all unstyled. This is the single biggest reason the transcript
looks like a debug log.

**Port plan:** a Go markdown→styled-string renderer. Start small: fenced code
blocks with a language label + a keyword/string/comment tokenizer for the
languages Ether's tools actually emit (ts, go, json, bash, diff). Diff blocks
get clay/ember tinted `+`/`-` lines. Tables and math can come later.

### Gap 2 — No branded color identity

Ether uses an ivory/slate palette (`theme.go`) that is tasteful but
**anonymous** — it reads like a generic dark theme, not a product.

- **Hermes** `theme.ts:257` — a deliberate gold/amber/bronze identity
  (`primary #FFD700`, `accent #FFBF00`, `border #CD7F32`, text `#FFF8DC`
  cornsilk). Instantly recognizable, consistent across prompt glyph, borders,
  status rule, logo gradient, and the caduceus ASCII splash. It even degrades
  gracefully: `bestReadableAnsiColor` re-derives ANSI-256 fallbacks
  (`theme.ts:183`).
- **OpenCode** — 30+ bundled JSON themes (catppuccin, dracula, gruvbox, nord…)
  PLUS a `generateSystem` that derives a theme from the terminal's own
  16-color palette (`theme/index.ts:360`), respecting terminal opacity. The
  default `opencode` theme uses muted tinted diff backgrounds (`#20303b`
  added / `#37222c` removed) rather than loud reds/greens.

**Ether today:** clay accent is the only signature color. There's no logo, no
splash, no terminal-palette awareness.

**Port plan:** keep the ivory/slate base but (a) commit clay as the single
brand accent everywhere (prompt `❯`, borders on focus, logo), (b) add a small
ASCII wordmark splash on the welcome screen, (c) add muted diff tints.

### Gap 3 — Tools/diffs/approvals are side-panel-only, not inline

Ether renders tool calls as flat transcript rows (`messageBlock`) and approvals
as a separate 3-row bar (`renderApprovalBar`). Hermes and OpenCode render
these **inline in the conversation flow** as rich, scannable blocks:

- **Hermes** `thinking.tsx:689` — a collapsible **box-drawing tree** with
  `├─ `/`└─ ` rails, a spinner + live timer per in-flight tool
  (`● edit_file src/app.ts (2.3s)`), a heatmap-colored stem for hot subagent
  branches (`heatColor` `thinking.tsx:268`), `Σ ~2.0k total` token summaries,
  and chevron section headers. Diff segments are interleaved with narration and
  get `diffAdded`/`diffRemoved` background tints.
- **OpenCode** `session/index.tsx:1833-2030` — two idioms: `InlineTool`
  (single-line, fixed-width icon column: `→` read, `←` write, `$` shell) and
  `BlockTool` (left vertical `┃` border, tinted panel, `# title`, click to
  expand). Diffs use a native `<diff>` with 12 separately-themeable colors and
  auto-switch split/unified at 120 cols. Approvals are inline boxes with
  `theme.warning` left border, diff preview, and option pills.

**Ether today:** `🔧 local_file_read(...)` flat rows. The approval bar
(`base.go:525`) is detached from the conversation and shows no diff inline.

**Port plan:** an inline `toolBlock` renderer that shows the call + a spinner
while running, then collapses to a one-line summary with the result. For
writes, render a tinted unified diff inline (we already have `approval_diff.go`'s
diff logic — reuse it inside the transcript, not just the approval bar).

### Gap 4 — No streaming / spinner affordance

Ether shows the assistant response as a batch (the whole text appears at once
after the loop completes). Both references stream token-by-token with a live
cursor.

- **Hermes** — `streamingMarkdown.tsx` splits at the last stable block
  boundary so only the in-flight tail re-parses per delta; a blinking `▍`
  cursor at 420ms (`StreamCursor` `thinking.tsx:194`).
- **OpenCode** — native `<markdown streaming={true}>` + a Knight-Rider scanner
  spinner (`■`/`⬝` trail, alpha-falloff gradient from the agent color,
  `ui/spinner.ts:272`).

**Ether today:** `chatBusy` toggles a `● run N/M` status text
(`base.go:166`). No token streaming, no cursor. This makes the UI feel frozen
during a long turn.

**Port plan:** the daemon already emits `assistant_text` chunks over the JSONL
event stream (`agent-loop.ts:371` `yield {type:"assistant_text", content}`). The
Go TUI's `applyLoopEvent` (`chat.go`) already accumulates `assistantBuffer`.
Wire the render to show the buffer with a blinking `▍` cursor while
`chatBusy`, flushing to a real transcript entry on `assistant_text_done`.

### Gap 5 — Layout density without hierarchy

Ether packs 6 always-visible rail cards + a tree gutter + a 3-row approval
zone, leaving the conversation pane feeling like an afterthought. Both
references make the **transcript the hero** and push everything else into
either a single status rule or a toggleable overlay.

- **Hermes** — single column: transcript (flex-grow) + composer + a 1-row
  status rule. Everything else (model picker, sessions, agents tree) is a
  floating overlay above the composer. Progressive disclosure: the status bar
  adds segments (`statusBarSegments` `appChrome.tsx:256`) as width grows, and
  yields the cwd first when narrow.
- **OpenCode** — single column with an **optional** right sidebar (width 42,
  shown when `wide()` or toggled). Sidebar holds plugin panels (files, todo,
  lsp, mcp). The transcript gets `flexGrow`, the composer is pinned, and the
  status lives in a 1-row footer.

**Ether today:** always-on 3-pane (gutter + transcript + 6-card rail). The rail
duplicates info the tree gutter already shows (LEDGER events appear in both).

**Port plan (already approved direction):** keep the 3-pane workbench identity
(per `docs/18` "What to Preserve") but make the rail toggleable and trim it to
3 cards (STATUS merged + LEDGER + RISK) with TOKENS/AUTHORITY/LEASES moved to
`/usage` `/policy` `/lease` floating windows that already exist. Collapse the
gutter to an icon rail by default.

---

## 2. Referenceable Code Locations (patterns to port, not copy)

Since neither reference is Go/lipgloss, these are design patterns to
re-implement, not imports.

| Pattern | Hermes | OpenCode | Ether port target |
|---------|--------|----------|-------------------|
| Markdown renderer | `hermes/ui-tui/src/components/markdown.tsx` | `opencode/packages/tui/src/theme/index.ts:586` (syntax rules) | new `packages/tui-go/setupapp/markdown.go` |
| Diff tinting | `markdown.tsx:774` | `session/index.tsx:2336` (`<diff>`) | extend `approval_diff.go` into a transcript `diffBlock` |
| Theme/palette | `theme.ts:257`, `bestReadableAnsiColor:183` | `theme/index.ts:360` `generateSystem` | extend `theme.go` with diff tints + a wordmark |
| Inline tool tree | `thinking.tsx:689` (rails + spinners + heatmap) | `session/index.tsx:1833` (InlineTool/BlockTool) | new `tool_block.go` renderer |
| Streaming cursor | `streamingMarkdown.tsx`, `StreamCursor:194` | `ui/spinner.ts:272` (scanner) | wire `chat.go` `assistantBuffer` to a `▍` cursor |
| Status rule (1 row, progressive) | `appChrome.tsx:405` `StatusRule` | `routes/session/footer.tsx` | slim `renderFooter` + move rail to toggle |
| Collapsible sections (chevrons) | `thinking.tsx` `SessionPanel`, `TodoPanel` | `sidebar.tsx` files/todo plugins | reuse the floating-window manager (`wm.go`) |
| Welcome splash | `branding.tsx:85` `Banner` + caduceus | `routes/home.tsx` + animated `logo.tsx` | replace flat `renderWelcome` with a wordmark |

---

## 3. What Ether Already Has That's Worth Keeping

The workbench identity (`docs/18` "What to Preserve") is a real
differentiator — Hermes and OpenCode are both single-column chat clients with
no persistent event visibility. Ether's **git-tree gutter** (the event trunk
with checkpoint/branch/HEAD nodes) and the **policy/lease/consent pipeline
cards** are unique. The fix is not to abandon them but to stop making them
fight the transcript for space.

Keep:
- Three-pane layout (tree + transcript + rail) as the workbench identity.
- Policy/lease/consent visibility in the rail.
- Ledger visibility via the tree gutter.
- VCS layer (the git-like operations).

Change:
- Transcript-first proportions (done: 64% in the last commit).
- Inline markdown + tool blocks so the transcript earns its space.
- Toggleable/trimmed rail so the density is opt-in.
- Streaming + spinner so the transcript feels alive.

---

## 4. Recommended Fix Order

1. **Inline markdown renderer** (Gap 1) — biggest visual win, self-contained,
   testable with fixture strings. Start: fenced code + diff tints.
2. **Streaming cursor** (Gap 4) — the event plumbing already exists; this is a
   small `chat.go` render change with outsized "feels alive" impact.
3. **Inline tool/diff blocks** (Gap 3) — reuse `approval_diff.go` logic inside
   the transcript; collapse flat `🔧` rows into rich blocks.
4. **Brand wordmark + diff tints** (Gap 2) — small `theme.go` + welcome
   change; low risk.
5. **Rail trim + gutter icon mode** (Gap 5) — layout change after the
   transcript can stand on its own; move cards to existing floating windows.

Each is independently shippable and testable.
