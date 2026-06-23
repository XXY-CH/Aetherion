package setupapp

import (
	"fmt"
	"image/color"
	"strings"
	"time"

	"charm.land/lipgloss/v2"
)

// render() composes the full workbench frame:
//
//	git-tree gutter │ topBar
//	                 conversation pane │ right rail (status/ledger/risk)
//	                 approval bar (conditional)
//	                 composer
//	                 footer
//
// Floating windows + modals are composited on top via wm.renderWindows().
func (m Model) render() string {
	// Decrement click-flash animation counter each render.
	if m.clickFlash > 0 {
		m.clickFlash--
	}
	m.loadTreeNodesIfEmpty()

	treeW := m.treeWidth()
	restW := maxInt(40, m.width-treeW)

	// --- Top bar (spans the non-gutter width) ---
	topBar := m.renderTopBar(restW)

	// --- Named vertical sub-budgets (single source of truth) ---
	// Every height-consuming element is named so the gutter and right column
	// share one arithmetic derivation. Previously two independent formulas
	// (four unlabeled `1`s each) drifted and could push the footer off-screen.
	const topBarH = 1
	const footerH = 1
	approvalH := 0
	if m.pendingApproval != nil {
		approvalH = 3
	}
	composerH := clampInt(m.height/5, 4, 8)
	// Slash popup occupies rows above the composer when active; budget it so it
	// can't push the footer off-screen (the popup caps at 8 matches + border).
	slashPopupH := 0
	if m.slashActive && len(m.slashMatches) > 0 {
		slashPopupH = minInt(len(m.slashMatches), 8) + 2 // 8 rows + top/bottom border
	}
	// Render the composer once and measure its ACTUAL rendered height.
	// lipgloss .Height() on a bordered textarea does not produce an exact cell
	// count (border + padding add rows), so we measure rather than assume.
	composer := m.renderComposer(restW, composerH)
	composerActualH := countLines(composer)
	fixedH := topBarH + footerH + approvalH + slashPopupH + composerActualH
	// bodyH absorbs the rest. The footer (topBar + footer + composer + approval
	// + slash) is reserved first so it can never be pushed off-screen.
	bodyH := maxInt(6, m.height-fixedH)

	// --- Conversation (left, 64%) + right rail (right, 36%) ---
	// The transcript is the primary reading surface; it gets the majority of
	// width. The rail keeps the policy/lease/consent pipeline visible.
	conversationW := restW * 64 / 100
	railW := restW - conversationW

	conversation := m.renderConversationPane(conversationW, bodyH)
	rail := m.renderRightRail(railW, bodyH)
	// Both columns are pinned to bodyH so JoinHorizontal merges them side by
	// side (32+32 = 32 rows) rather than stacking them (32+32 = 64 rows).
	// The conversation pane already enforces bodyH internally; the rail needs
	// an explicit Height wrapper because JoinVertical produces a bare string.
	body := lipgloss.JoinHorizontal(lipgloss.Top, conversation, lipgloss.NewStyle().Height(bodyH).Render(rail))

	// --- Approval bar ---
	approval := ""
	if m.pendingApproval != nil {
		approval = m.renderApprovalBar(restW)
	}

	// Composer was rendered above so its actual height could be measured for
	// the body budget. Reuse that render here.

	// --- Slash completion popup (above composer) ---
	slashPopup := ""
	if m.slashActive && len(m.slashMatches) > 0 {
		slashPopup = m.renderSlashPopup(restW)
	}

	// --- Footer ---
	footer := m.renderFooter(restW)

	// Assemble the right-of-gutter column. Only non-empty blocks are joined —
	// passing "" to JoinVertical can add a spurious blank row that pushes the
	// footer past the terminal height.
	parts := []string{topBar, body}
	if approval != "" {
		parts = append(parts, approval)
	}
	if slashPopup != "" {
		parts = append(parts, slashPopup)
	}
	parts = append(parts, composer, footer)
	rightCol := lipgloss.JoinVertical(lipgloss.Left, parts...)
	// Truncate the assembled column to the terminal height. On small terminals
	// the stacked rail cards legitimately need more rows than bodyH provides;
	// MaxHeight clips the overflow so nothing scrolls past the last screen row.
	rightCol = lipgloss.NewStyle().MaxHeight(m.height).Render(rightCol)

	// Gutter on the far left — reuses the SAME bodyH + fixedH as the right
	// column so both columns end at the same row. Also clipped to terminal height.
	gutter := m.renderTreeGutter(treeW, bodyH+fixedH)
	gutter = lipgloss.NewStyle().MaxHeight(m.height).Render(gutter)
	base := lipgloss.JoinHorizontal(lipgloss.Top, gutter, rightCol)

	// Composite floating windows + modals on top.
	return m.wm.renderWindows(base, m.width, m.height)
}

func (m *Model) loadTreeNodesIfEmpty() {
	if m.treeNodes == nil {
		m.loadTreeNodes()
	}
}

// treeWidth returns the gutter width (expanded mode shows more).
// Collapsed is 16 (was 18): symbol(1) + space(1) + abbrev(6) = 8 used, 8 spare,
// leaving more room for the conversation pane on narrow terminals.
func (m Model) treeWidth() int {
	if m.treeExpanded {
		return 36
	}
	return 16
}

// --- Top bar ---

func (m Model) renderTopBar(width int) string {
	theme := styles()
	title := theme.title.Render("Aetherion")
	provider := theme.meta.Render(fmt.Sprintf(" %s/%s", m.provider(), m.modelRef()))
	cred := theme.status.Render(" cred:yes")
	if !credentialPresent(m.provider()) {
		cred = theme.warn.Render(" cred:no")
	}
	tools := theme.muted.Render(" · tools on · policy-gated")

	// Token sparkline. The comment originally said "last 12 turns" but the code
	// rendered the full history — which on a long session grew wide enough to
	// truncate the right-side run indicator. Cap to the last 12 samples.
	var spark string
	if len(m.tokenHistory) > 0 {
		// Take the last 12 turns only.
		hist := m.tokenHistory
		if len(hist) > 12 {
			hist = hist[len(hist)-12:]
		}
		vals := make([]float64, 0, len(hist))
		var hi float64
		for _, s := range hist {
			vals = append(vals, float64(s.Total))
			if float64(s.Total) > hi {
				hi = float64(s.Total)
			}
		}
		spark = theme.muted.Render(" · ") + Sparkline(vals, 0, hi, cloudMedium, ivoryLight)
		spark += theme.muted.Render(fmt.Sprintf(" %dt", m.loopTokens))
	}

	// Running indicator.
	runIndicator := ""
	if m.chatBusy {
		runIndicator = theme.streaming.Render(fmt.Sprintf(" · run %d/%d", m.loopDepth, m.loopMaxDepth))
	}

	bar := title + provider + cred + tools + spark + runIndicator
	// Right-align doesn't compose well with sparkline; just pad.
	return theme.statusRule.Width(width).Render(bar)
}

// --- Conversation pane ---

func (m Model) renderConversationPane(width, height int) string {
	// border 2 + padding 2 = 4 cells of frame.
	m.transcriptVP.SetWidth(contentWidth(width, 2, 2, 0))
	m.transcriptVP.SetHeight(contentWidth(height, 2, 2, 0))
	m.refreshTranscript()
	// Focus = border color while keeping the workbench on a dark surface.
	borderColor := slateLight
	if m.activePane == "conversation" {
		borderColor = ivoryLight
		if m.clickFlash > 0 {
			borderColor = clay
		}
	}
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.NormalBorder()).
		BorderForeground(borderColor).
		Padding(0, 1).
		Foreground(ivoryLight).
		Background(slateDark)
	return boxStyle.Width(width).Height(height).Render(m.transcriptVP.View())
}

// renderTranscriptContent builds the string shown inside the conversation viewport.
func (m Model) renderTranscriptContent() string {
	var b strings.Builder
	viewportH := m.transcriptVP.Height()
	for _, entry := range m.transcript {
		if entry.Role == "intro" {
			b.WriteString(m.renderWelcome(viewportH))
			continue
		}
		b.WriteString(messageBlock(entry))
		b.WriteString("\n")
	}
	// Streaming turn: show the in-flight assistant text (run through the
	// markdown renderer so code blocks/diffs stream formatted, not raw) plus a
	// blinking-block cursor at the tail, then the spinner + status row.
	// Rendering the live buffer is what makes a long turn feel responsive
	// instead of frozen (gap 4 from docs/19; the assistant_text events already
	// populate m.assistantBuffer — we just surface it).
	if m.chatBusy {
		if m.assistantBuffer != "" {
			streamed := renderMarkdown(m.assistantBuffer)
			cursor := lipgloss.NewStyle().Foreground(clay).Blink(true).Render("▍")
			b.WriteString(streamed + cursor + "\n")
		}
		spinnerSym := lipgloss.NewStyle().Foreground(clay).Render(m.spinner.View())
		statusText := lipgloss.NewStyle().Foreground(cloudMedium).Render(
			fmt.Sprintf(" turn %d/%d · tools %d · %dt", m.loopDepth, m.loopMaxDepth, m.loopToolCalls, m.loopTokens))
		b.WriteString(spinnerSym + statusText + "\n")
	}
	if m.chatError != "" {
		b.WriteString(lipgloss.NewStyle().Foreground(ember).Render("✗ "+m.chatError) + "\n")
	}
	return b.String()
}

// renderWelcome is the actionable first-run welcome (not metadata dump).
// The welcome block is vertically centered within the given viewport height so
// a tall conversation pane does not leave a dead zone below it. A dynamic
// status footer (credential + pending approval count) is appended so the
// previously-empty lower half carries actionable information.
func (m Model) renderWelcome(viewportH int) string {
	theme := styles()
	cred := theme.status.Render("✓")
	if !credentialPresent(m.provider()) {
		cred = theme.warn.Render("✗ /connect")
	}
	lines := []string{
		theme.title.Render("Aetherion"),
		"",
		theme.muted.Render("Local-first agent harness."),
		theme.muted.Render("Approval-gated tool loop."),
		"",
		theme.meta.Render(m.provider() + "/" + m.modelRef() + " " + cred),
		"",
		theme.sectionTitle.Render("Get started"),
		theme.meta.Render(" /connect  provider setup"),
		theme.meta.Render(" /model    pick a model"),
		theme.meta.Render(" type → enter to start"),
		"",
		theme.muted.Render("[/] tree · /policy · ctrl+c quit"),
	}
	content := strings.Join(lines, "\n")

	// Dynamic status footer: credential state + pending approval count.
	footer := theme.muted.Render(fmt.Sprintf("%s/%s · %s · /connect to begin",
		m.provider(), m.modelRef(), boolAs(credentialPresent(m.provider()), "cred ✓", "cred ✗")))
	if m.pendingApproval != nil {
		footer = theme.warn.Render("⚠ approval pending · press y/n") + "  " + footer
	}
	full := content + "\n\n" + footer

	// Vertically center the welcome block within the viewport. If the viewport
	// is shorter than the content, render as-is (the viewport will scroll).
	welcomeH := countLines(full)
	if viewportH <= welcomeH {
		return full
	}
	return lipgloss.PlaceVertical(viewportH, lipgloss.Center, full)
}

// messageBlock renders one transcript entry as a flat note with a typographic
// role label. Color is reserved for state, not for every speaker.
// Assistant text is run through the markdown renderer so code blocks, inline
// code, bold, and diff tints appear in the transcript (matching the polish
// level of Hermes/OpenCode). Other roles keep their plain-text formatting.
func messageBlock(entry transcriptEntry) string {
	theme := styles()
	label := roleLabel(entry.Role)
	labelColor := roleColor(entry.Role)
	labelStyled := lipgloss.NewStyle().Bold(true).Foreground(labelColor).Render(label)
	metaStyled := ""
	if entry.Meta != "" {
		metaStyled = " " + theme.muted.Render(entry.Meta)
	}
	header := labelStyled + metaStyled
	// Render the body as markdown for assistant replies; plain for others.
	bodyText := entry.Text
	if entry.Role == "assistant" {
		bodyText = renderMarkdown(entry.Text)
	}
	body := header + "\n" + bodyText

	contentStyle := lipgloss.NewStyle().
		PaddingLeft(1).
		BorderLeft(true).
		BorderForeground(labelColor).
		Foreground(ivoryLight)
	return contentStyle.Render(body) + "\n"
}

func roleLabel(role string) string {
	switch role {
	case "user":
		return "YOU"
	case "assistant":
		return "ETHER"
	case "tool":
		return "TOOL"
	case "approval":
		return "APPROVAL"
	case "error":
		return "ERROR"
	case "system":
		return "SYSTEM"
	default:
		return strings.ToUpper(role)
	}
}

func roleColor(role string) color.Color {
	switch role {
	case "user":
		return ivoryLight
	case "assistant":
		return ivoryDark
	case "tool":
		return sky
	case "approval":
		return clay
	case "error":
		return ember
	case "system":
		return cloudMedium
	default:
		return cloudLight
	}
}

// renderRightRail stacks the six info cards vertically.
//
// The five "fixed" cards are rendered first and their actual rendered line
// counts are measured (lipgloss .Height() on a bordered panel does not always
// produce an exact cell count, so we measure instead of assume). The flexible
// LEDGER card then takes whatever vertical space remains so the whole rail
// fits exactly within `height` — keeping the rail's total height equal to the
// conversation pane's height so both columns bottom-align.
func (m Model) renderRightRail(width, height int) string {
	// Fixed cards. Heights are best-effort; actual rendered rows are measured.
	status := m.renderStatusBlock(width, 4)
	auth := m.renderAuthorityGates(width, 5)
	lease := m.renderActiveLeases(width, 5)
	tokens := m.renderTokenUsage(width, 5)
	risk := m.renderRiskBlock(width, 5)

	fixedLines := countLines(status) + countLines(auth) + countLines(lease) +
		countLines(tokens) + countLines(risk)
	// LEDGER absorbs the remainder. Floor at 2 (header + one event row).
	ledgerH := height - fixedLines
	if ledgerH < 2 {
		ledgerH = 2
	}
	ledger := m.renderLedgerBlock(width, ledgerH)

	return lipgloss.JoinVertical(lipgloss.Left, status, auth, lease, tokens, ledger, risk)
}

// renderStatusBlock renders the compact AGENT status pill + progress.
func (m Model) renderStatusBlock(width, height int) string {
	theme := styles()
	// Compact single-char status pill (k9s/btop principle).
	stateSym := lipgloss.NewStyle().Foreground(cloudMedium).Render("● idle")
	if m.chatBusy {
		stateSym = lipgloss.NewStyle().Bold(true).Foreground(clay).Render("● run " + fmt.Sprintf("%d/%d", m.loopDepth, m.loopMaxDepth))
	}
	if m.chatError != "" {
		stateSym = lipgloss.NewStyle().Bold(true).Foreground(ember).Render("● error")
	}
	turnFrac := 0.0
	if m.loopMaxDepth > 0 {
		turnFrac = float64(m.loopDepth) / float64(m.loopMaxDepth)
	}
	turnBar := m.turnProgress.ViewAs(turnFrac)
	elapsed := int(time.Since(m.startTime).Seconds())

	content := strings.Join([]string{
		theme.sectionTitle.Render("AGENT") + " " + stateSym,
		turnBar,
		theme.muted.Render(fmt.Sprintf("tools %d · %ds · %dt", m.loopToolCalls, elapsed, m.loopTokens)),
	}, "\n")
	return theme.panel.Width(width).Height(height).Render(content)
}

// renderAuthorityGates shows the 3 security invariants.
func (m Model) renderAuthorityGates(width, height int) string {
	theme := styles()
	redX := lipgloss.NewStyle().Bold(true).Foreground(ember).Render("✗")
	greenCheck := lipgloss.NewStyle().Bold(true).Foreground(olive).Render("✓")
	lines := []string{
		theme.sectionTitle.Render("AUTHORITY") + " " + theme.muted.Render("gates"),
		redX + theme.muted.Render(" model_output_auth"),
		greenCheck + theme.muted.Render(" exec_requires_lease"),
		greenCheck + theme.muted.Render(" side_effects_approve"),
	}
	return theme.panel.Width(width).Height(height).Render(strings.Join(lines, "\n"))
}

// renderActiveLeases shows leases with TTL countdown gauges.
func (m Model) renderActiveLeases(width, height int) string {
	theme := styles()
	leaseEvents := []ledgerEvent{}
	for _, e := range readLedgerEvents(m.workspaceRoot(), 100) {
		if e.EventType == "lease.issued" {
			leaseEvents = append(leaseEvents, e)
		}
	}
	header := theme.sectionTitle.Render("LEASES") + " " + theme.muted.Render(fmt.Sprintf("(%d)", len(leaseEvents)))
	if len(leaseEvents) == 0 {
		return theme.panel.Width(width).Height(height).Render(header + "\n" + theme.muted.Render("— none —"))
	}
	var lines []string
	lines = append(lines, header)
	maxShow := minInt(len(leaseEvents), 2)
	for range leaseEvents[:maxShow] {
		frac := 0.8 // default; real TTL would parse expires_at
		bar := Gauge(frac, 10, '█', '░', ttlGaugeColor(frac), slateLight)
		lines = append(lines, lipgloss.NewStyle().Foreground(clay).Render("●")+" "+bar)
	}
	return theme.panel.Width(width).Height(height).Render(strings.Join(lines, "\n"))
}

// renderTokenUsage shows input/output breakdown + trend sparkline.
func (m Model) renderTokenUsage(width, height int) string {
	theme := styles()
	inToks, outToks := 0, 0
	for _, s := range m.tokenHistory {
		inToks += s.Input
		outToks += s.Output
	}
	header := theme.sectionTitle.Render("TOKENS") + " " + theme.muted.Render(fmt.Sprintf("Σ%d", m.loopTokens))

	lines := []string{header}
	if len(m.tokenHistory) > 0 {
		barW := contentWidth(width, 2, 2, 6)
		inBar := Gauge(float64(inToks)/float64(maxInt(1, inToks+outToks)), barW, '█', '░', ivoryLight, slateLight)
		outBar := Gauge(float64(outToks)/float64(maxInt(1, inToks+outToks)), barW, '█', '░', cloudMedium, slateLight)
		lines = append(lines, theme.muted.Render("in ")+inBar)
		lines = append(lines, theme.muted.Render("out ")+outBar)
		// Trend sparkline
		vals := make([]float64, len(m.tokenHistory))
		var hi float64
		for i, s := range m.tokenHistory {
			vals[i] = float64(s.Total)
			if float64(s.Total) > hi {
				hi = float64(s.Total)
			}
		}
		spark := Sparkline(vals, 0, hi, cloudMedium, ivoryLight)
		lines = append(lines, theme.muted.Render("trend ")+spark)
	} else {
		lines = append(lines, theme.muted.Render("— no data —"))
	}
	return theme.panel.Width(width).Height(height).Render(strings.Join(lines, "\n"))
}

// renderLedgerBlock renders the LEDGER tail section.
func (m Model) renderLedgerBlock(width, height int) string {
	theme := styles()
	// Reserve 1 row for the border + header; the rest shows events. Guard
	// against tiny heights so the slice math never goes negative.
	eventRows := height - 2
	if eventRows < 0 {
		eventRows = 0
	}
	events := readLedgerEvents(m.workspaceRoot(), eventRows)
	header := theme.sectionTitle.Render("LEDGER")
	if len(events) > 0 {
		header += theme.status.Render(" ✓chain")
	}
	header += theme.muted.Render(fmt.Sprintf(" · %d evt", len(events)))

	var lines []string
	lines = append(lines, header)
	start := 0
	if eventRows > 0 && len(events) > eventRows {
		start = len(events) - eventRows
	}
	for _, evt := range events[start:] {
		lines = append(lines, formatLedgerLine(evt))
	}
	return theme.panel.Width(width).Height(height).Render(strings.Join(lines, "\n"))
}

// formatLedgerLine renders one ledger event as a compact colored pill.
func formatLedgerLine(evt ledgerEvent) string {
	typeColor := eventTypeColor(evt.EventType)
	abbrev := eventAbbrev(evt.EventType)

	// Colored pill: abbrev in event-type color on subtle background.
	pill := lipgloss.NewStyle().
		Foreground(typeColor).
		Render(abbrev)

	// Append status/risk indicators based on event type.
	switch evt.EventType {
	case "policy.decided":
		return pill + " " + lipgloss.NewStyle().Foreground(olive).Render("✓")
	case "policy.denied":
		return pill + " " + lipgloss.NewStyle().Foreground(ember).Render("✗")
	case "risk.composed":
		if containsAny(evt.Summary, "L0", "L1", "L2", "L3", "L4", "L5") {
			lvl := extractRiskLevel(evt.Summary)
			return pill + " " + miniRiskBadge(lvl)
		}
		return pill
	case "lease.issued":
		return pill + " " + lipgloss.NewStyle().Foreground(clay).Render("⏱")
	case "tool.result":
		return pill + " " + lipgloss.NewStyle().Foreground(cloudMedium).Render("ok")
	case "agent.loop.completed":
		return pill + " " + lipgloss.NewStyle().Foreground(olive).Render("✓")
	default:
		return pill
	}
}

// renderRiskBlock renders the RISK distribution summary.
//
// All six levels L0–L5 are always visible so the X-axis categories never shift
// between renders (previously zero-count levels were omitted). The layout is
// compact — a header line + two rows of three level pills — so the card fits in
// the rail alongside the other five cards without forcing the column to grow.
// The full six-bar chart lives in the /trace inspector for when the operator
// wants detail.
func (m Model) renderRiskBlock(width, height int) string {
	theme := styles()
	// Count risk levels from ledger events.
	counts := map[string]int{"L0": 0, "L1": 0, "L2": 0, "L3": 0, "L4": 0, "L5": 0}
	for _, evt := range m.treeNodes {
		lvl := extractRiskLevel(evt.Summary + " " + evt.EventType)
		if lvl != "" {
			counts[lvl]++
		}
	}
	total := 0
	for _, c := range counts {
		total += c
	}

	header := theme.sectionTitle.Render("RISK")
	if total == 0 {
		return theme.panel.Width(width).Height(height).Render(header + "\n" + theme.muted.Render("— no data —"))
	}

	// Two compact rows of three pills each: "L0 N · L1 N · L2 N".
	// A pill uses the level's color so the level is identifiable at a glance
	// even when the count is 0.
	levels := []string{"L0", "L1", "L2", "L3", "L4", "L5"}
	pill := func(lvl string) string {
		c := riskColor(lvl)
		return lipgloss.NewStyle().Bold(true).Foreground(c).Render(lvl) +
			theme.muted.Render(":"+itoaSimple(counts[lvl]))
	}
	row1 := lipgloss.JoinHorizontal(lipgloss.Left, pill(levels[0]), theme.muted.Render(" · "), pill(levels[1]), theme.muted.Render(" · "), pill(levels[2]))
	row2 := lipgloss.JoinHorizontal(lipgloss.Left, pill(levels[3]), theme.muted.Render(" · "), pill(levels[4]), theme.muted.Render(" · "), pill(levels[5]))
	body := strings.Join([]string{header, row1, row2}, "\n")
	return theme.panel.Width(width).Height(height).Render(body)
}

// --- Approval bar ---

func (m Model) renderApprovalBar(width int) string {
	theme := styles()
	if m.pendingApproval == nil {
		return ""
	}
	p := m.pendingApproval
	badge := RiskBadge(p.RiskLevel)
	left := theme.warn.Render("APPROVE ") + lipgloss.NewStyle().Foreground(ivoryLight).Render(p.ToolName) +
		"(" + shortPath(p.Path) + ") " + badge + "  scope:" + p.Verb
	buttons := lipgloss.NewStyle().Foreground(ivoryLight).Underline(true).Render(" [y] approve ") +
		lipgloss.NewStyle().Foreground(clay).Render(" [n] deny ")
	content := lipgloss.JoinHorizontal(lipgloss.Center, left, buttons)
	return theme.overlay.Width(width).Render(content)
}

// --- Composer ---

func (m Model) renderComposer(width, height int) string {
	// Connect wizard replaces the composer when active.
	if m.connectMode != "" {
		theme := styles()
		boxStyle := lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(clay).
			Padding(0, 1).
			Foreground(ivoryLight).
			Background(slateDark)
		return boxStyle.Width(width).Render(theme.streaming.Render(m.renderConnectWizard()))
	}
	// border 2 + padding 2 + prompt 3 = 7 cells of frame.
	m.composer.SetWidth(contentWidth(width, 2, 2, 3))
	m.composer.SetHeight(contentWidth(height, 2, 0, 0))
	// Focus = border color.
	borderColor := slateLight
	if m.activePane == "composer" || m.activePane == "" {
		borderColor = ivoryLight
		if m.clickFlash > 0 {
			borderColor = clay
		}
	}
	prompt := lipgloss.NewStyle().Bold(true).Foreground(clay).Render(" ❯ ")
	content := lipgloss.JoinHorizontal(lipgloss.Top, prompt, m.composer.View())
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.NormalBorder()).
		BorderForeground(borderColor).
		Padding(0, 1).
		Foreground(ivoryLight).
		Background(slateDark)
	// Enforce the composer's allocated height so it doesn't expand to its
	// natural content height and push the footer off-screen.
	return boxStyle.Width(width).Height(height).Render(content)
}

// --- Footer ---

func (m Model) renderFooter(width int) string {
	theme := styles()
	var text string
	switch {
	case m.pendingApproval != nil:
		text = "⚠ approve? [y] yes · [n] no · esc cancel"
	case m.chatBusy:
		text = fmt.Sprintf("⏺ running turn %d/%d · tools %d · tokens %d · ctrl+c quit",
			m.loopDepth, m.loopMaxDepth, m.loopToolCalls, m.loopTokens)
	case m.chatError != "":
		text = "✗ error · /clear · ctrl+c quit"
	default:
		text = "enter send · shift+enter newline · [/] tree nav · /policy /lease /trace · ctrl+c quit"
	}
	if m.transcriptUnread > 0 {
		text = fmt.Sprintf("↓ unread %d · ", m.transcriptUnread) + text
	}
	return theme.statusRule.Width(width).Render(text)
}

// --- Slash completion popup ---

// renderSlashPopup renders the slash command autocomplete list above the composer.
// Each row: command name (accent) + description (dim). Selected row recolored.
//
// IMPORTANT: each row is styled in a single pass. We never call .Render() on a
// string that already contains escape sequences — lipgloss strips the ESC byte
// (0x1b) but leaks the sequence body ("[1;4;38;2;250;249;245;4m") as visible
// text and then styles each leaked character. That is the bug that produced the
// raw ANSI garbage seen in the slash popup. The selected/unselected distinction
// is applied to the name+description components directly, not by re-wrapping.
func (m Model) renderSlashPopup(width int) string {
	if len(m.slashMatches) == 0 {
		return ""
	}
	maxShow := minInt(len(m.slashMatches), 8)
	var lines []string
	for i, cmd := range m.slashMatches[:maxShow] {
		selected := i == m.completionIdx
		nameColor := ivoryLight
		descColor := cloudMedium
		if selected {
			nameColor = clay
			descColor = clay
		}
		nameStyled := lipgloss.NewStyle().Foreground(nameColor).Bold(true).Underline(true).Render(cmd.Name)
		descStyled := lipgloss.NewStyle().Foreground(descColor).Render(" " + cmd.Description)
		lines = append(lines, nameStyled+descStyled)
	}
	content := strings.Join(lines, "\n")
	return lipgloss.NewStyle().
		Border(lipgloss.NormalBorder()).
		BorderForeground(ivoryLight).
		Padding(0, 1).
		Foreground(ivoryLight).
		Background(slateDark).
		Width(width).
		Render(content)
}

// --- Event helpers ---

func eventAbbrev(eventType string) string {
	switch eventType {
	case "run.started":
		return "run.st"
	case "run.completed":
		return "run.✓"
	case "user.message":
		return "usr.ms"
	case "tool.requested":
		return "tol.rq"
	case "risk.composed":
		return "rsk.cp"
	case "policy.decided":
		return "pol.✓"
	case "lease.issued":
		return "les.is"
	case "tool.executing":
		return "tol.ex"
	case "tool.result":
		return "tol.rs"
	case "tool.denied":
		return "tol.✗"
	case "action.recorded":
		return "act.rc"
	case "consent.recorded":
		return "cns.rc"
	case "observation.recorded":
		return "obs.rc"
	case "verification.recorded":
		return "vfy.rc"
	case "agent.model.requested":
		return "mod.rq"
	case "agent.model.responded":
		return "mod.rs"
	case "agent.loop.completed":
		return "lop.✓"
	case "agent.loop.depth_exceeded":
		return "lop.!"
	default:
		if len(eventType) > 6 {
			return eventType[:6]
		}
		return eventType
	}
}

func extractRiskLevel(text string) string {
	for _, lvl := range []string{"L0", "L1", "L2", "L3", "L4", "L5"} {
		if strings.Contains(text, lvl) {
			return lvl
		}
	}
	return ""
}

func containsAny(s string, needles ...string) bool {
	for _, n := range needles {
		if strings.Contains(s, n) {
			return true
		}
	}
	return false
}
