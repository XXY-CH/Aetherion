package setupapp

import (
	"fmt"
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
	box := theme.transcript.Width(width).Height(height)
	return lipgloss.JoinVertical(lipgloss.Left, header, box.Render(m.transcriptVP.View()))
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
	cred := theme.status.Render("✓ credential")
	if !credentialPresent(m.provider()) {
		cred = theme.warn.Render("✗ credential — type /connect")
	}
	lines := []string{
		theme.title.Render("✦ Aetherion"),
		"",
		theme.muted.Render("Local-first agent harness. Read and write files through an"),
		theme.muted.Render("approval-gated tool loop. Model output never authorizes actions."),
		"",
		theme.meta.Render(fmt.Sprintf("provider %s · model %s · %s", m.provider(), m.modelRef(), cred)),
		"",
		theme.sectionTitle.Render("Get started"),
		theme.meta.Render("  /connect    set up a provider credential"),
		theme.meta.Render("  /model      pick a provider + model"),
		theme.meta.Render("  type a message and press enter to start"),
		"",
		theme.muted.Render("enter send · shift+enter newline · /policy /lease /trace · ctrl+c quit"),
	}
	return strings.Join(lines, "\n") + "\n"
}

// messageBlock renders one transcript entry with role-appropriate styling.
func messageBlock(entry transcriptEntry) string {
	theme := styles()
	label := strings.ToUpper(emptyAs(entry.Role, "system"))
	body := theme.muted.Render(label) + "\n" + entry.Text
	switch entry.Role {
	case "user":
		return theme.transcript.Render(body)
	case "assistant":
		return theme.response.Render(body)
	case "error":
		return theme.errorStyle.Render(body)
	case "tool":
		return theme.muted.Render(body)
	case "approval":
		return theme.warn.Render(body)
	default:
		return theme.transcript.Render(body)
	}
}

// --- Right rail ---

func (m Model) renderRightRail(width, height int) string {
	statusH := 6
	ledgerH := maxInt(4, height-statusH-6-2) // status + risk + padding

	status := m.renderStatusBlock(width, statusH)
	ledger := m.renderLedgerBlock(width, ledgerH)
	risk := m.renderRiskBlock(width, 6)

	return lipgloss.JoinVertical(lipgloss.Left, status, ledger, risk)
}

// renderStatusBlock renders the AGENT status section.
func (m Model) renderStatusBlock(width, height int) string {
	theme := styles()
	state := "○ idle"
	if m.chatBusy {
		state = "⏺ running"
	}
	if m.chatError != "" {
		state = "⊘ blocked"
	}
	turn := fmt.Sprintf("turn %d/%d", m.loopDepth, m.loopMaxDepth)
	turnBar := Gauge(float64(m.loopDepth)/float64(maxInt(1, m.loopMaxDepth)), 8, '▓', '░',
		lipgloss.Color("#56D4FF"), lipgloss.Color("#45475A"))
	elapsed := int(time.Since(m.startTime).Seconds())
	elapsedBar := Gauge(float64(elapsed)/float64(maxInt(1, elapsed+1)), 8, '█', '░',
		lipgloss.Color("#5DFF8F"), lipgloss.Color("#45475A"))

	content := strings.Join([]string{
		theme.sectionTitle.Render("AGENT"),
		theme.meta.Render(state),
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

// formatLedgerLine renders one ledger event as a compact line.
func formatLedgerLine(evt ledgerEvent) string {
	theme := styles()
	abbrev := eventAbbrev(evt.EventType)
	switch evt.EventType {
	case "policy.decided":
		return theme.muted.Render(abbrev) + " " + theme.status.Render("✓")
	case "risk.composed":
		if containsAny(evt.Summary, "L0", "L1", "L2", "L3", "L4", "L5") {
			lvl := extractRiskLevel(evt.Summary)
			return theme.muted.Render(abbrev) + " " + RiskBadge(lvl)
		}
		return theme.muted.Render(abbrev)
	case "lease.issued":
		return theme.muted.Render(abbrev) + " " + theme.status.Render("⏱")
	default:
		return theme.muted.Render(abbrev)
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
	theme := styles()
	m.composer.SetWidth(maxInt(20, width-4))
	m.composer.SetHeight(height)
	prompt := theme.prompt.Render(" ❯ ")
	content := lipgloss.JoinHorizontal(lipgloss.Top, prompt, m.composer.View())
	return theme.composerBox.Width(width).Render(content)
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
		text = "enter send · shift+enter newline · /policy /lease /trace · ←→ tree · ctrl+c quit"
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
