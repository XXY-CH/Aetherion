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
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: connectGuidance(m.provider(), m.modelRef()), Meta: "connect"})
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

	case "/clear":
		m.chatResult = nil
		m.chatError = ""
		m.transcriptUnread = 0
		m.transcript = []transcriptEntry{{Role: "intro", Text: "Aetherion", Meta: "welcome"}}
		m.statusMsg = "slash=/clear"

	case "/new":
		m.chatResult = nil
		m.chatError = ""
		m.queue = nil
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "New session started.", Meta: "new"})
		m.statusMsg = "slash=/new"

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
		"/undo        fork from checkpoint",
		"/tree        toggle tree expand",
		"/status      status summary",
		"/clear       clear transcript",
		"/help        this help",
	}, "\n")
}

// renderHelpModal returns the help modal content.
func (m Model) renderHelpModal() string {
	return slashHelpText()
}
