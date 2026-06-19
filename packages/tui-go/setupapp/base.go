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

	// --- Body: conversation (left) + right rail (right) ---
	approvalH := 0
	if m.pendingApproval != nil {
		approvalH = 3
	}
	composerH := clampInt(m.height/5, 4, 8)
	bodyH := maxInt(6, m.height-1-1-approvalH-composerH-1-1) // topBar + footer + approval + composer + padding
	conversationW := restW * 55 / 100
	railW := restW - conversationW - 1

	conversation := m.renderConversationPane(conversationW, bodyH)
	rail := m.renderRightRail(railW, bodyH)
	body := lipgloss.JoinHorizontal(lipgloss.Top, conversation, rail)

	// --- Approval bar ---
	approval := ""
	if m.pendingApproval != nil {
		approval = m.renderApprovalBar(restW)
	}

	// --- Composer ---
	composer := m.renderComposer(restW, composerH)

	// --- Footer ---
	footer := m.renderFooter(restW)

	// Assemble the right-of-gutter column.
	rightCol := lipgloss.JoinVertical(lipgloss.Left, topBar, body, approval, composer, footer)

	// Gutter on the far left.
	gutter := m.renderTreeGutter(treeW, bodyH+1+approvalH+composerH+1+1+1)
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
func (m Model) treeWidth() int {
	if m.treeExpanded {
		return 36
	}
	return 18
}

// --- Top bar ---

func (m Model) renderTopBar(width int) string {
	theme := styles()
	title := theme.title.Render("✦ Aetherion")
	provider := theme.meta.Render(fmt.Sprintf(" %s/%s", m.provider(), m.modelRef()))
	cred := theme.status.Render(" ✓cred")
	if !credentialPresent(m.provider()) {
		cred = theme.warn.Render(" ✗cred")
	}
	tools := theme.muted.Render(" · tools on")

	// Token sparkline (last 12 turns).
	var spark string
	if len(m.tokenHistory) > 0 {
		vals := make([]float64, 0, len(m.tokenHistory))
		var hi float64
		for _, s := range m.tokenHistory {
			vals = append(vals, float64(s.Total))
			if float64(s.Total) > hi {
				hi = float64(s.Total)
			}
		}
		spark = theme.muted.Render(" · ") + Sparkline(vals, 0, hi, lipgloss.Color("#5DFF8F"), lipgloss.Color("#56D4FF"))
		spark += theme.muted.Render(fmt.Sprintf(" %dt", m.loopTokens))
	}

	// Running indicator.
	runIndicator := ""
	if m.chatBusy {
		runIndicator = theme.streaming.Render(fmt.Sprintf(" · ⏺ run %d/%d", m.loopDepth, m.loopMaxDepth))
	}

	bar := title + provider + cred + tools + spark + runIndicator
	// Right-align doesn't compose well with sparkline; just pad.
	return theme.statusRule.Width(width).Render(bar)
}

// --- Conversation pane ---

func (m Model) renderConversationPane(width, height int) string {
	theme := styles()
	m.transcriptVP.SetWidth(maxInt(20, width-2))
	m.transcriptVP.SetHeight(maxInt(4, height-2))
	m.refreshTranscript()
	header := theme.sectionTitle.Render(" CONVERSATION")
	// Active pane gets a blue accent border; click flash adds gold flash.
	boxStyle := theme.transcript
	if m.activePane == "conversation" {
		borderColor := lipgloss.Color("#89B4FA")
		if m.clickFlash > 0 {
			borderColor = lipgloss.Color("#FFD700")
		}
		boxStyle = lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(borderColor).Padding(0, 1).Background(lipgloss.Color("#181825"))
	}
	return lipgloss.JoinVertical(lipgloss.Left, header, boxStyle.Width(width).Height(height).Render(m.transcriptVP.View()))
}

// renderTranscriptContent builds the string shown inside the conversation viewport.
func (m Model) renderTranscriptContent() string {
	var b strings.Builder
	for _, entry := range m.transcript {
		if entry.Role == "intro" {
			b.WriteString(m.renderWelcome())
			continue
		}
		b.WriteString(messageBlock(entry))
		b.WriteString("\n")
	}
	if m.chatBusy {
		b.WriteString(styles().streaming.Render(fmt.Sprintf(" %s streaming… turn %d/%d · tools %d · tokens %d",
			m.spinner.View(), m.loopDepth, m.loopMaxDepth, m.loopToolCalls, m.loopTokens)))
		b.WriteString("\n")
	}
	if m.chatError != "" {
		b.WriteString(styles().errorStyle.Render(" ✗ " + m.chatError))
		b.WriteString("\n")
	}
	return b.String()
}

// renderWelcome is the actionable first-run welcome (not metadata dump).
func (m Model) renderWelcome() string {
	theme := styles()
	cred := theme.status.Render("✓")
	if !credentialPresent(m.provider()) {
		cred = theme.warn.Render("✗ /connect")
	}
	lines := []string{
		theme.title.Render("✦ Aetherion"),
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
	return strings.Join(lines, "\n") + "\n"
}

// messageBlock renders one transcript entry with role-appropriate styling.
// Modern look: colored role label, subtle background tint per role.
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
	body := header + "\n" + entry.Text

	// Role-tinted backgrounds for visual grouping.
	bgTint := roleBg(entry.Role)
	contentStyle := lipgloss.NewStyle().PaddingLeft(1).BorderLeft(true).BorderForeground(labelColor)
	if bgTint != "" {
		contentStyle = contentStyle.Background(lipgloss.Color(bgTint))
	}
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
		return lipgloss.Color("#89B4FA") // blue
	case "assistant":
		return lipgloss.Color("#A6E3A1") // green
	case "tool":
		return lipgloss.Color("#94E2D5") // teal
	case "approval":
		return lipgloss.Color("#FAB387") // peach
	case "error":
		return lipgloss.Color("#F38BA8") // red
	case "system":
		return lipgloss.Color("#6C7086") // overlay0
	default:
		return lipgloss.Color("#CDD6F4")
	}
}

func roleBg(role string) string {
	switch role {
	case "assistant":
		return "#1A2A1E" // subtle green tint
	case "tool":
		return "#1A2228" // subtle teal tint
	case "error":
		return "#2A1A1E" // subtle red tint
	case "approval":
		return "#2A2418" // subtle peach tint
	default:
		return ""
	}
}

// --- Right rail ---

func (m Model) renderRightRail(width, height int) string {
	railActive := m.activePane == "rail"
	railBorder := lipgloss.Color("#45475A")
	if railActive {
		railBorder = lipgloss.Color("#89B4FA")
		if m.clickFlash > 0 {
			railBorder = lipgloss.Color("#FFD700")
		}
	}
	_ = railBorder // panels use their own border; this is for future per-block highlight
	statusH := 6
	ledgerH := maxInt(4, height-statusH-6-2) // status + risk + padding

	status := m.renderStatusBlock(width, statusH)
	ledger := m.renderLedgerBlock(width, ledgerH)
	risk := m.renderRiskBlock(width, 6)

	return lipgloss.JoinVertical(lipgloss.Left, status, ledger, risk)
}

// renderStatusBlock renders the AGENT status section with progress components.
func (m Model) renderStatusBlock(width, height int) string {
	theme := styles()
	state := theme.muted.Render("○ idle")
	if m.chatBusy {
		state = lipgloss.NewStyle().Foreground(lipgloss.Color("#89B4FA")).Render("⏺ running")
	}
	if m.chatError != "" {
		state = lipgloss.NewStyle().Foreground(lipgloss.Color("#F38BA8")).Render("⊘ blocked")
	}
	turn := fmt.Sprintf("turn %d/%d", m.loopDepth, m.loopMaxDepth)
	turnFrac := 0.0
	if m.loopMaxDepth > 0 {
		turnFrac = float64(m.loopDepth) / float64(m.loopMaxDepth)
	}
	turnBar := m.turnProgress.ViewAs(turnFrac)
	elapsed := int(time.Since(m.startTime).Seconds())
	elapsedFrac := float64(elapsed%60) / 60.0
	elapsedBar := m.elapsedProgress.ViewAs(elapsedFrac)

	content := strings.Join([]string{
		theme.sectionTitle.Render("AGENT"),
		state,
		theme.muted.Render(turn) + " " + turnBar,
		theme.muted.Render(fmt.Sprintf("tools %d · %ds", m.loopToolCalls, elapsed)) + " " + elapsedBar,
	}, "\n")
	return theme.panel.Width(width).Render(content)
}

// renderLedgerBlock renders the LEDGER tail section.
func (m Model) renderLedgerBlock(width, height int) string {
	theme := styles()
	events := readLedgerEvents(m.workspaceRoot(), height-3)
	header := theme.sectionTitle.Render("LEDGER")
	if len(events) > 0 {
		header += theme.status.Render(" ✓chain")
	}
	header += theme.muted.Render(fmt.Sprintf(" · %d evt", len(events)))

	var lines []string
	lines = append(lines, header)
	start := 0
	if len(events) > height-2 {
		start = len(events) - (height - 2)
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
		return pill + " " + lipgloss.NewStyle().Foreground(lipgloss.Color("#A6E3A1")).Render("✓")
	case "policy.denied":
		return pill + " " + lipgloss.NewStyle().Foreground(lipgloss.Color("#F38BA8")).Render("✗")
	case "risk.composed":
		if containsAny(evt.Summary, "L0", "L1", "L2", "L3", "L4", "L5") {
			lvl := extractRiskLevel(evt.Summary)
			return pill + " " + miniRiskBadge(lvl)
		}
		return pill
	case "lease.issued":
		return pill + " " + lipgloss.NewStyle().Foreground(lipgloss.Color("#CBA6F7")).Render("⏱")
	case "tool.result":
		return pill + " " + lipgloss.NewStyle().Foreground(lipgloss.Color("#6C7086")).Render("ok")
	case "agent.loop.completed":
		return pill + " " + lipgloss.NewStyle().Foreground(lipgloss.Color("#A6E3A1")).Render("✓")
	default:
		return pill
	}
}

// renderRiskBlock renders the RISK distribution chart (conditional).
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
	hasData := false
	for _, c := range counts {
		if c > 0 {
			hasData = true
		}
	}
	if !hasData {
		return theme.panel.Width(width).Render(theme.sectionTitle.Render("RISK") + "\n" + theme.muted.Render("— no data —"))
	}
	var bars []RiskBar
	for _, lvl := range []string{"L0", "L1", "L2", "L3", "L4", "L5"} {
		if counts[lvl] > 0 {
			bars = append(bars, RiskBar{Label: lvl, Count: counts[lvl], Color: riskColor(lvl)})
		}
	}
	chart := BarChart(bars, width-16)
	return theme.panel.Width(width).Render(theme.sectionTitle.Render("RISK") + "\n" + chart)
}

// --- Approval bar ---

func (m Model) renderApprovalBar(width int) string {
	theme := styles()
	if m.pendingApproval == nil {
		return ""
	}
	p := m.pendingApproval
	badge := RiskBadge(p.RiskLevel)
	left := theme.warn.Render("⚠ APPROVE ") + theme.meta.Render(p.ToolName) +
		"(" + shortPath(p.Path) + ") " + badge + "  scope:" + p.Verb
	buttons := theme.status.Render(" [y]✓ ") + theme.errorStyle.Render(" [n]✗")
	content := lipgloss.JoinHorizontal(lipgloss.Center, left, buttons)
	return theme.overlay.Width(width).Render(content)
}

// --- Composer ---

func (m Model) renderComposer(width, height int) string {
	m.composer.SetWidth(maxInt(20, width-4))
	m.composer.SetHeight(height)
	// Active composer gets a blue accent border; flash gold on click.
	borderColor := lipgloss.Color("#45475A")
	if m.activePane == "composer" || m.activePane == "" {
		borderColor = lipgloss.Color("#89B4FA")
		if m.clickFlash > 0 {
			borderColor = lipgloss.Color("#FFD700")
		}
	}
	prompt := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#FFD700")).Render(" ❯ ")
	content := lipgloss.JoinHorizontal(lipgloss.Top, prompt, m.composer.View())
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Padding(0, 1).
		Background(lipgloss.Color("#181825"))
	return boxStyle.Width(width).Render(content)
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
