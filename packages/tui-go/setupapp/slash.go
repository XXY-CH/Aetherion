package setupapp

import (
	"fmt"
	"strings"

	tea "charm.land/bubbletea/v2"
)

// handleSlashCommand dispatches a /command. Extended with workbench commands.
func (m *Model) handleSlashCommand(command string) {
	fields := strings.Fields(command)
	if len(fields) == 0 {
		return
	}
	theme := styles()

	switch fields[0] {
	case "/exit", "/quit":
		m.statusMsg = "slash=/exit"
		m.composer.Reset()
		m.completionIdx = -1
		m.quitRequested = true
		return

	case "/connect":
		m.wm.closeModals()
		m.startConnectWizard()
		m.statusMsg = "slash=/connect"

	case "/sidebar", "/tree":
		m.treeExpanded = !m.treeExpanded
		m.statusMsg = fmt.Sprintf("tree %s", boolAs(m.treeExpanded, "expanded", "compact"))

	case "/checkpoint":
		if m.treeCursor >= 0 && m.treeCursor < len(m.treeNodes) {
			node := m.treeNodes[m.treeCursor]
			m.transcript = append(m.transcript, transcriptEntry{
				Role: "system",
				Text: fmt.Sprintf("✓ checkpoint at %s (%s)", node.EventID, node.EventType),
				Meta: "checkpoint",
			})
			m.statusMsg = "slash=/checkpoint"
		}

	case "/undo":
		m.transcript = append(m.transcript, transcriptEntry{
			Role: "system",
			Text: "undo: fork a new run from the checkpoint (append-only — old history preserved).",
			Meta: "undo",
		})
		m.statusMsg = "slash=/undo (checkpoint-based fork)"

	case "/policy":
		m.wm.open(winPolicy, "POLICY", m.renderPolicyWindow(), 44, 20)
		m.statusMsg = "slash=/policy"

	case "/lease":
		m.wm.open(winLease, "LEASES", m.renderLeaseWindow(), 44, 18)
		m.statusMsg = "slash=/lease"

	case "/capsules":
		m.wm.open(winCapsules, "CAPSULES", m.renderCapsulesWindow(), 44, 18)
		m.statusMsg = "slash=/capsules"

	case "/trace":
		m.wm.open(winTrace, "TRACE", m.renderTraceWindow(), 48, 22)
		m.statusMsg = "slash=/trace"

	case "/usage":
		m.wm.open(winUsage, "USAGE", m.renderUsageWindow(), 44, 18)
		m.statusMsg = "slash=/usage"

	case "/model":
		m.wm.openModal("modal_model", "SELECT MODEL", m.renderModelPicker(), 48, 14)
		m.statusMsg = "slash=/model"

	case "/help":
		m.wm.openModal("modal_help", "HELP", m.renderHelpModal(), 52, 16)
		m.statusMsg = "slash=/help"

	case "/status":
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: statusReport(*m), Meta: "status"})
		m.statusMsg = "slash=/status"

	case "/vcs":
		subCmd := ""
		if len(fields) > 1 {
			subCmd = fields[1]
		}
		m.handleVcsSlash(subCmd, fields[2:])

	case "/clear":
		m.chatResult = nil
		m.chatError = ""
		m.transcriptUnread = 0
		m.transcript = []transcriptEntry{{Role: "intro", Text: "Aetherion", Meta: "welcome"}}
		m.persistTranscript()
		m.refreshTranscriptToBottom()
		m.statusMsg = "slash=/clear"

	case "/new":
		m.chatResult = nil
		m.chatError = ""
		m.queue = nil
		m.transcript = []transcriptEntry{{Role: "intro", Text: "Aetherion", Meta: "welcome"}}
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "New session started.", Meta: "new"})
		m.persistTranscript()
		m.refreshTranscriptToBottom()
		m.statusMsg = "slash=/new"

	case "/retry":
		m.handleRetrySlash()

	case "/copy":
		m.handleCopySlash()

	case "/compact":
		m.handleCompactSlash()

	case "/diff":
		m.handleDiffSlash()

	case "/history":
		m.handleHistorySlash()

	case "/tools":
		m.handleToolsSlash()

	case "/init":
		m.handleInitSlash()

	case "/personality":
		personality := ""
		if len(fields) > 1 {
			personality = fields[1]
		}
		m.handlePersonalitySlash(personality)

	case "/sessions":
		m.handleSessionsSlash()

	case "/resume":
		sessionId := ""
		if len(fields) > 1 {
			sessionId = fields[1]
		}
		m.handleResumeSlash(sessionId)

	default:
		m.transcript = append(m.transcript, transcriptEntry{
			Role: "system",
			Text: theme.muted.Render("Unknown command: ") + fields[0] + "\n" + slashHelpText(),
			Meta: "error",
		})
		m.statusMsg = "slash=unknown"
	}

	m.composer.Reset()
	m.completionIdx = -1
	_ = tea.Quit
}

// slashCommand is one command entry for autocomplete.
type slashCommand struct {
	Name        string
	Description string
}

// allSlashCommands returns the full list of commands for autocomplete filtering.
func allSlashCommands() []slashCommand {
	return []slashCommand{
		{"/exit", "quit"},
		{"/quit", "quit"},
		{"/connect", "set up provider credential"},
		{"/model", "pick a provider + model"},
		{"/policy", "policy + risk inspector"},
		{"/lease", "active leases"},
		{"/capsules", "capability capsules"},
		{"/trace", "trace replay"},
		{"/usage", "token usage"},
		{"/checkpoint", "mark git-tree checkpoint"},
		{"/undo", "fork from checkpoint"},
		{"/tree", "toggle tree expand"},
		{"/status", "status summary"},
		{"/vcs", "VCS: status, snapshot, rollback, branch"},
		{"/clear", "clear transcript"},
		{"/new", "new session"},
		{"/retry", "resend last user message"},
		{"/copy", "copy last assistant reply"},
		{"/compact", "show context usage"},
		{"/diff", "show workspace changes"},
		{"/history", "recent session history"},
		{"/tools", "list available tools"},
		{"/init", "bootstrap AGENTS.md"},
		{"/personality", "set agent personality"},
		{"/sessions", "list past sessions"},
		{"/resume", "resume a session [id]"},
		{"/help", "this help"},
	}
}

// filterSlashCommands returns commands whose Name starts with the given prefix.
func filterSlashCommands(prefix string) []slashCommand {
	var matches []slashCommand
	for _, cmd := range allSlashCommands() {
		if strings.HasPrefix(cmd.Name, prefix) {
			matches = append(matches, cmd)
		}
	}
	return matches
}

func slashHelpText() string {
	return strings.Join([]string{
		"/exit        quit",
		"/connect     set up a provider credential",
		"/model       pick a provider + model",
		"/policy      policy + risk inspector",
		"/lease       active leases",
		"/capsules    capability capsules",
		"/trace       trace replay",
		"/usage       token usage",
		"/checkpoint  mark git-tree checkpoint",
		"/undo        mark rollback point",
		"/status      status summary",
		"/vcs         VCS operations",
		"/clear       clear transcript",
		"/new         new session",
		"/retry       resend last message",
		"/copy        copy last reply",
		"/compact     context usage",
		"/diff        workspace changes",
		"/history     session history",
		"/tools       available tools",
		"/init        bootstrap AGENTS.md",
		"/personality set agent personality",
		"/sessions    list past sessions",
		"/resume      resume a session",
		"/sidebar     toggle sidebar",
		"/help        this help",
	}, "\n")
}

// renderHelpModal returns the help modal content.
func (m Model) renderHelpModal() string {
	return slashHelpText()
}
