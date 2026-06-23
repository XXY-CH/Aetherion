package setupapp

import (
	"fmt"
	"strings"

	"charm.land/bubbles/v2/spinner"
	tea "charm.land/bubbletea/v2"
)

// Update is the core state machine. Routes keyboard input, mouse events, and
// agent-loop messages.
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	// Spinner always ticks while busy.
	if m.chatBusy {
		nextSpinner, cmd := m.spinner.Update(msg)
		m.spinner = nextSpinner
		cmds = append(cmds, cmd)
	}

	switch msg := msg.(type) {

	// --- Window resize ---
	case tea.WindowSizeMsg:
		m.width = maxInt(80, msg.Width)
		m.height = maxInt(24, msg.Height)
		m.help.SetWidth(m.width)
		m.resize()
		return m, tea.Batch(cmds...)

	// --- Agent-loop stream events ---
	case loopEventMsg:
		m.applyLoopEvent(msg.event)
		m.refreshTranscriptAfterAppend()
		cmds = append(cmds, drainStreamEvents(&m))
		return m, tea.Batch(cmds...)

	case chatStreamDoneMsg:
		m.chatBusy = false
		m.activePrompt = ""
		m.pendingApproval = nil
		m.stdinWriter = nil
		m.streamingCmd = nil
		if msg.err != nil {
			m.chatError = msg.err.Error()
		} else {
			m.statusMsg = fmt.Sprintf("agent loop complete: turns=%d tools=%d tokens=%d",
				m.loopDepth, m.loopToolCalls, m.loopTokens)
		}
		m.loadTreeNodes()
		m.refreshTranscriptAfterAppend()
		return m, nil

	case chatFinishedMsg:
		m.chatBusy = false
		if msg.err != nil {
			m.chatError = msg.err.Error()
		}
		m.refreshTranscriptAfterAppend()
		return m, nil

	// --- Mouse events ---
	case tea.MouseClickMsg:
		return m.handleMouseClick(msg, cmds)

	case tea.MouseMotionMsg:
		if m.wm.dragging != "" {
			m.wm.dragMove(msg.X, msg.Y, m.width, m.height)
		}
		return m, tea.Batch(cmds...)

	case tea.MouseWheelMsg:
		hit := m.wm.hit(msg.X, msg.Y)
		if hit != nil {
			// Scroll the window content (simple: adjust scrolled offset).
			switch msg.Button {
			case tea.MouseWheelUp:
				hit.scrolled = maxInt(0, hit.scrolled-3)
			case tea.MouseWheelDown:
				hit.scrolled += 3
			}
		} else {
			switch msg.Button {
			case tea.MouseWheelUp:
				m.transcriptVP.ScrollUp(3)
			case tea.MouseWheelDown:
				m.transcriptVP.ScrollDown(3)
			}
		}
		return m, tea.Batch(cmds...)

	// --- Keyboard ---
	case tea.KeyPressMsg:
		return m.handleKeyPress(msg, cmds)

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

// handleKeyPress routes keyboard input based on focus and state.
func (m Model) handleKeyPress(msg tea.KeyPressMsg, cmds []tea.Cmd) (tea.Model, tea.Cmd) {
	// If a modal is open, route all keys to it.
	if m.wm.hasModal() {
		return m.handleModalKey(msg, cmds)
	}

	// Connect wizard takes priority when active.
	if m.connectMode != "" {
		keyMsg := tea.KeyMsg(msg)
		consumed := m.handleConnectKey(keyMsg)
		if consumed {
			return m, tea.Batch(cmds...)
		}
	}

	// Approval y/n takes priority.
	if m.pendingApproval != nil {
		switch msg.String() {
		case "y", "Y":
			m.resolveApproval(true)
			m.statusMsg = "approval: approved"
			m.refreshTranscriptAfterAppend()
			return m, tea.Batch(cmds...)
		case "n", "N":
			m.resolveApproval(false)
			m.statusMsg = "approval: denied"
			m.refreshTranscriptAfterAppend()
			return m, tea.Batch(cmds...)
		}
	}

	switch {
	case msg.String() == "ctrl+c":
		if m.chatBusy {
			m.statusMsg = "interrupt — press ctrl+c again to quit"
			return m, tea.Batch(cmds...)
		}
		if strings.TrimSpace(m.composer.Value()) != "" {
			m.composer.Reset()
			m.statusMsg = "composer cleared — ctrl+c again to quit"
			return m, tea.Batch(cmds...)
		}
		return m, tea.Quit

	case msg.String() == "ctrl+d":
		return m, tea.Quit

	case msg.String() == "ctrl+b":
		m.treeExpanded = !m.treeExpanded
		return m, tea.Batch(cmds...)

	case msg.String() == "ctrl+\\":
		m.toggleRail()
		return m, tea.Batch(cmds...)

	case msg.String() == "ctrl+k":
		m.wm.openModal("modal_palette", "COMMANDS", slashHelpText(), 48, 16)
		return m, tea.Batch(cmds...)

	case msg.String() == "ctrl+o":
		m.modelPickerActive = true
		m.wm.openModal("modal_model", "SELECT MODEL", m.renderModelPicker(), 48, 14)
		return m, tea.Batch(cmds...)

	case msg.String() == "esc":
		if m.wm.closeTop() {
			return m, tea.Batch(cmds...)
		}
		m.composer.Focus()
		return m, tea.Batch(cmds...)

	case msg.String() == "tab":
		m.wm.cycleFocus()
		return m, tea.Batch(cmds...)

	// Tree gutter navigation: use [ and ] (intuitive, unambiguous, never block
	// typing) instead of h/l/j/k which must type into the composer.
	case msg.String() == "[":
		if m.treeCursor > 0 {
			m.treeCursor--
		}
		return m, tea.Batch(cmds...)
	case msg.String() == "]":
		if m.treeCursor < len(m.treeNodes)-1 {
			m.treeCursor++
		}
		return m, tea.Batch(cmds...)

	// Submit / newline in composer.
	case msg.String() == "enter":
		// If slash completion is active, accept the selected command instead of sending.
		if m.slashActive {
			m.acceptSlashCompletion()
			return m, tea.Batch(cmds...)
		}
		cmd := m.startChat()
		return m, tea.Batch(append(cmds, cmd)...)

	case msg.String() == "shift+enter" || msg.String() == "alt+enter" || msg.String() == "ctrl+j":
		m.composer.InsertString("\n")
		return m, tea.Batch(cmds...)

	case msg.String() == "ctrl+s":
		cmd := m.startChat()
		return m, tea.Batch(append(cmds, cmd)...)

	// Transcript scrolling uses page keys only — plain letters/j/k must type.
	case msg.String() == "pgup":
		m.transcriptVP.HalfPageUp()
		return m, tea.Batch(cmds...)
	case msg.String() == "pgdown":
		m.transcriptVP.HalfPageDown()
		return m, tea.Batch(cmds...)
	}

	// Slash completion navigation (when popup is active).
	if m.slashActive {
		switch msg.String() {
		case "up":
			if m.completionIdx > 0 {
				m.completionIdx--
			}
			return m, tea.Batch(cmds...)
		case "down":
			if m.completionIdx < len(m.slashMatches)-1 {
				m.completionIdx++
			}
			return m, tea.Batch(cmds...)
		case "tab":
			m.acceptSlashCompletion()
			return m, tea.Batch(cmds...)
		case "esc":
			m.slashActive = false
			m.slashMatches = nil
			return m, tea.Batch(cmds...)
		}
	}

	// Default: forward to the composer textarea.
	var cmd tea.Cmd
	m.composer, cmd = m.composer.Update(msg)
	// After each keystroke, check if composer starts with "/" for autocomplete.
	m.updateSlashCompletion()
	cmds = append(cmds, cmd)
	return m, tea.Batch(cmds...)
}

// updateSlashCompletion filters the slash command list based on the current
// composer content and shows/hides the autocomplete popup.
func (m *Model) updateSlashCompletion() {
	val := m.composer.Value()
	if strings.HasPrefix(val, "/") && !strings.Contains(val, "\n") {
		m.slashMatches = filterSlashCommands(val)
		m.slashActive = len(m.slashMatches) > 0
		if m.completionIdx >= len(m.slashMatches) {
			m.completionIdx = 0
		}
	} else {
		m.slashActive = false
		m.slashMatches = nil
	}
}

// acceptSlashCompletion replaces the composer content with the selected command.
func (m *Model) acceptSlashCompletion() {
	if !m.slashActive || len(m.slashMatches) == 0 {
		return
	}
	idx := m.completionIdx
	if idx < 0 || idx >= len(m.slashMatches) {
		idx = 0
	}
	m.composer.SetValue(m.slashMatches[idx].Name + " ")
	m.slashActive = false
	m.slashMatches = nil
	m.completionIdx = -1
}

// handleModalKey routes keys when a modal is open.
func (m Model) handleModalKey(msg tea.KeyPressMsg, cmds []tea.Cmd) (tea.Model, tea.Cmd) {
	// Model picker: left/right cycles providers, enter confirms + saves config.
	if m.wm.hasModal() && m.modelPickerActive {
		switch msg.String() {
		case "esc", "ctrl+c":
			m.wm.closeModals()
			m.modelPickerActive = false
			return m, tea.Batch(cmds...)
		case "left":
			m.cycleProvider(-1)
			m.wm.closeModals()
			m.wm.openModal("modal_model", "SELECT MODEL", m.renderModelPicker(), 48, 14)
			return m, tea.Batch(cmds...)
		case "right":
			m.cycleProvider(1)
			m.wm.closeModals()
			m.wm.openModal("modal_model", "SELECT MODEL", m.renderModelPicker(), 48, 14)
			return m, tea.Batch(cmds...)
		case "enter":
			m.confirmModelSelection()
			m.wm.closeModals()
			return m, tea.Batch(cmds...)
		}
	}

	switch msg.String() {
	case "esc", "ctrl+c":
		m.wm.closeModals()
		return m, tea.Batch(cmds...)
	case "enter":
		m.wm.closeModals()
		return m, tea.Batch(cmds...)
	case "tab":
		return m, tea.Batch(cmds...)
	}
	var cmd tea.Cmd
	m.composer, cmd = m.composer.Update(msg)
	cmds = append(cmds, cmd)
	return m, tea.Batch(cmds...)
}

// handleMouseClick routes a mouse click: focus windows, drag, or click buttons.
func (m Model) handleMouseClick(msg tea.MouseClickMsg, cmds []tea.Cmd) (tea.Model, tea.Cmd) {
	if msg.Button != tea.MouseLeft {
		return m, tea.Batch(cmds...)
	}
	// Check floating/modal windows.
	win := m.wm.hit(msg.X, msg.Y)
	if win != nil {
		if win.kind == winModal {
			// Click on modal: check for button hit (y/n, etc.)
			if strings.Contains(win.content, "[y]") && msg.Y >= win.y+win.height-3 {
				m.resolveApproval(true)
				return m, tea.Batch(cmds...)
			}
			if strings.Contains(win.content, "[n]") && msg.Y >= win.y+win.height-3 {
				m.resolveApproval(false)
				return m, tea.Batch(cmds...)
			}
		}
		m.wm.beginDrag(msg.X, msg.Y)
		return m, tea.Batch(cmds...)
	}
	// Click on the base: determine which pane was clicked and set focus.
	treeW := m.treeWidth()
	if msg.X < treeW {
		m.activePane = "tree"
		m.clickFlash = 3
	} else {
		// Right of gutter: conversation (left ~55%) vs rail (right ~45%).
		restW := m.width - treeW
		conversationW := restW * 55 / 100
		if msg.X < treeW+conversationW {
			m.activePane = "conversation"
		} else {
			m.activePane = "rail"
		}
		m.clickFlash = 3
	}
	// Check approval bar buttons (bottom area when pending).
	if m.pendingApproval != nil {
		m.wm.focus("")
	}
	return m, tea.Batch(cmds...)
}

// resize propagates geometry to child components.
func (m *Model) resize() {
	treeW := m.treeWidth()
	restW := maxInt(40, m.width-treeW)
	m.providerInput.SetWidth(maxInt(20, restW-20))
	m.modelInput.SetWidth(maxInt(20, restW-20))
	m.composer.SetWidth(maxInt(20, restW-6))
	m.help.SetWidth(m.width)
	m.refreshTranscript()
}

// renderModelPicker returns the model picker modal content.
func (m Model) renderModelPicker() string {
	var lines []string
	lines = append(lines, "")
	current := canonicalProvider(m.provider())
	for _, p := range supportedProviders() {
		marker := "  "
		if canonicalProvider(p) == current {
			marker = "▸ "
		}
		cred := "✓"
		if !credentialPresent(p) {
			cred = "✗"
		}
		lines = append(lines, fmt.Sprintf("%s%-26s credential %s", marker, p, cred))
	}
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("model: %s", m.modelRef()))
	lines = append(lines, "←/→ cycle   enter confirm   /connect for setup")
	return strings.Join(lines, "\n")
}

// renderPolicyWindow returns the /policy floating window content.
func (m Model) renderPolicyWindow() string {
	if m.pendingApproval == nil {
		return "No active tool proposal.\n\nRun a task that triggers a write to see policy details."
	}
	p := m.pendingApproval
	var lines []string
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("tool:     %s", p.ToolName))
	lines = append(lines, fmt.Sprintf("target:   %s", shortPath(p.Path)))
	lines = append(lines, fmt.Sprintf("risk:     %s  %s", p.RiskLevel, p.DecisionHint))
	lines = append(lines, fmt.Sprintf("verb:     %s", p.Verb))
	lines = append(lines, "")
	lines = append(lines, "AUTHORITY GATES")
	lines = append(lines, "  model_output_can_authorize  ✗ locked")
	lines = append(lines, "  tool_exec_requires_lease    ✓ required")
	lines = append(lines, "  side_effects_require_approval ✓")

	// For write operations, show a unified diff of before/after content.
	if p.Verb == "write" && p.Path != "" {
		diff := renderApprovalDiff(p.Path, p.ProposedContent)
		if diff != "" {
			lines = append(lines, "")
			lines = append(lines, "PROPOSED CHANGES")
			lines = append(lines, diff)
		}
	}

	// For exec operations, show the command.
	if p.Verb == "exec" && p.ProposedContent != "" {
		lines = append(lines, "")
		lines = append(lines, "COMMAND")
		lines = append(lines, "  $ "+p.ProposedContent)
	}

	return strings.Join(lines, "\n")
}

// renderLeaseWindow returns the /lease floating window content.
func (m Model) renderLeaseWindow() string {
	events := readLedgerEvents(m.workspaceRoot(), 50)
	var leases []ledgerEvent
	for _, e := range events {
		if e.EventType == "lease.issued" {
			leases = append(leases, e)
		}
	}
	if len(leases) == 0 {
		return "No active leases."
	}
	var lines []string
	lines = append(lines, fmt.Sprintf("ACTIVE (%d)", len(leases)))
	for _, l := range leases {
		lines = append(lines, "")
		lines = append(lines, fmt.Sprintf("  %s", l.ID))
		lines = append(lines, fmt.Sprintf("  %s", l.Summary))
	}
	return strings.Join(lines, "\n")
}

// renderCapsulesWindow returns the /capsules floating window content.
func (m Model) renderCapsulesWindow() string {
	lines := []string{
		"",
		"⚠ Capsules declare requirements; they do NOT",
		"  grant permissions. Runtime grants are scoped leases.",
		"",
		"INSTALLED (V1)",
		"  cap_local_file_read   v1.0.0  L1 ●  published",
		"    required: [local_file_read]",
		"  cap_local_file_write  v1.0.0  L3 ●  published",
		"    required: [local_file_write]",
	}
	return strings.Join(lines, "\n")
}

// renderTraceWindow returns the /trace floating window content.
func (m Model) renderTraceWindow() string {
	events := readLedgerEvents(m.workspaceRoot(), 100)
	var lines []string
	lines = append(lines, fmt.Sprintf("chain: %d events", len(events)))
	lines = append(lines, "")
	maxShow := 20
	start := 0
	if len(events) > maxShow {
		start = len(events) - maxShow
	}
	for i := start; i < len(events); i++ {
		e := events[i]
		lines = append(lines, fmt.Sprintf("%2d  %-22s  %s", i+1, e.EventType, e.Actor.Type))
	}
	return strings.Join(lines, "\n")
}

// renderUsageWindow returns the /usage floating window content.
func (m Model) renderUsageWindow() string {
	lines := []string{
		"",
		"CUMULATIVE",
		fmt.Sprintf("  total: %d tok", m.loopTokens),
		fmt.Sprintf("  tools: %d called", m.loopToolCalls),
	}
	if len(m.tokenHistory) > 0 {
		lines = append(lines, "")
		lines = append(lines, "PER-TURN")
		vals := make([]float64, len(m.tokenHistory))
		var hi float64
		for i, s := range m.tokenHistory {
			vals[i] = float64(s.Total)
			if float64(s.Total) > hi {
				hi = float64(s.Total)
			}
			lines = append(lines, fmt.Sprintf("  turn %d  %4d  in %d out %d", s.Turn, s.Total, s.Input, s.Output))
		}
		lines = append(lines, "")
		lines = append(lines, "TREND")
		lines = append(lines, "  "+Sparkline(vals, 0, hi, cloudDark, slateDark))
	}
	return strings.Join(lines, "\n")
}
