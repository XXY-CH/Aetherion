package setupapp

import (
	"fmt"
	"image/color"
	"strings"

	"charm.land/lipgloss/v2"
)

// renderTreeGutter renders the left git-tree time axis with rich branch/merge
// connectors, color-coded nodes, and run-boundary markers.
//
//	╭─●  run.st  14:30  system
//	│ ●  usr.ms  14:31  user
//	│ ◆  ck_a3f              ← checkpoint (gold)
//	╰─◇  branch: rehear (sandbox)  ← fork point
//	  ●  run.st  14:35       ← undo fork
//	  ▸  HEAD
func (m Model) renderTreeGutter(width, height int) string {
	theme := styles()
	if len(m.treeNodes) == 0 {
		empty := theme.treeBase.Width(width).Height(height).
			Align(lipgloss.Center, lipgloss.Top).
			Render("\n\n " + theme.muted.Render("(no events yet)") + "\n\n " +
				theme.muted.Render("run a task to\n populate the tree"))
		return empty
	}

	// Determine the visible window (tail-end, fitting height).
	visible := m.treeNodes
	startIdx := 0
	// Reserve 2 lines for header/connector.
	maxVisible := height - 2
	if len(visible) > maxVisible {
		startIdx = len(visible) - maxVisible
		visible = visible[startIdx:]
	}

	var lines []string
	for i, node := range visible {
		realIdx := startIdx + i
		isCursor := realIdx == m.treeCursor
		isLast := i == len(visible)-1

		// Detect run boundary (previous node was a different run).
		runBoundary := ""
		if i > 0 && node.RunID != visible[i-1].RunID {
			runBoundary = theme.muted.Render("  ╶╶╶ " + compactRunID(node.RunID) + " ╶╶╶")
			lines = append(lines, runBoundary)
		}

		// Connector: trunk line or branch connector.
		connector := "│ "
		if node.IsBranch {
			if isLast {
				connector = "╰─"
			} else {
				connector = "├─"
			}
		} else if node.IsHead && isLast {
			connector = "  "
		} else if node.IsCheckpoint {
			connector = "◆ "
		}

		// Node symbol + color.
		symbol, symColor := nodeSymbol(node)
		symbolStyled := lipgloss.NewStyle().Foreground(symColor).Bold(true).Render(symbol)

		// Event type abbreviation + color.
		abbrev := eventAbbrev(node.EventType)
		typeColor := eventTypeColor(node.EventType)
		typeStyled := lipgloss.NewStyle().Foreground(typeColor).Render(abbrev)

		// Risk badge (if applicable).
		riskStr := ""
		lvl := node.RiskLevel
		if lvl == "" {
			lvl = extractRiskLevel(node.Summary)
		}
		if lvl != "" {
			riskStr = " " + miniRiskBadge(lvl)
		}

		// Timestamp (expanded mode only).
		timeStr := ""
		if m.treeExpanded {
			timeStr = " " + theme.muted.Render(compactTime(node.Timestamp))
		}

		// Cursor highlight.
		line := connector + symbolStyled + " " + typeStyled + timeStr + riskStr
		if isCursor {
			cursorBG := lipgloss.NewStyle().Background(lipgloss.Color("#313244"))
			line = cursorBG.Render(line)
			// Add cursor indicator.
			line = theme.treeCursor.Render("▸ ") + line
		}

		lines = append(lines, line)

		// Inter-node trunk connector (except after last).
		if !isLast {
			lines = append(lines, theme.treeBase.Render("│"))
		}
	}

	content := strings.Join(lines, "\n")
	box := theme.treeBase.Width(width).Height(height).
		Background(lipgloss.Color("#181825"))
	return box.Render(content)
}

// nodeSymbol returns the display symbol and color for a tree node.
func nodeSymbol(node treeNode) (string, color.Color) {
	if node.IsHead {
		return "▸", lipgloss.Color("#56D4FF")
	}
	if node.IsBranch {
		switch node.BranchStatus {
		case "sandbox":
			return "◇", lipgloss.Color("#FFAE5D")
		case "approved":
			return "✦", lipgloss.Color("#5DFF8F")
		case "discarded":
			return "✕", lipgloss.Color("#6C7086")
		}
		return "◇", lipgloss.Color("#FFAE5D")
	}
	if node.IsCheckpoint {
		return "◆", lipgloss.Color("#FFD700")
	}
	return "●", eventTypeColor(node.EventType)
}

// eventTypeColor maps an event type to a semantic color.
func eventTypeColor(eventType string) color.Color {
	switch {
	case strings.HasPrefix(eventType, "run."):
		return lipgloss.Color("#89B4FA") // blue
	case strings.HasPrefix(eventType, "user."):
		return lipgloss.Color("#F9E2AF") // yellow
	case strings.HasPrefix(eventType, "tool."):
		return lipgloss.Color("#A6E3A1") // green
	case strings.HasPrefix(eventType, "policy."):
		return lipgloss.Color("#94E2D5") // teal
	case strings.HasPrefix(eventType, "risk."):
		return lipgloss.Color("#FAB387") // peach
	case strings.HasPrefix(eventType, "lease."):
		return lipgloss.Color("#CBA6F7") // mauve
	case strings.HasPrefix(eventType, "agent."):
		return lipgloss.Color("#F5C2E7") // pink
	case strings.HasPrefix(eventType, "consent."):
		return lipgloss.Color("#89DCEB") // sky
	case strings.HasPrefix(eventType, "action."):
		return lipgloss.Color("#EBA0AC") // maroon
	case strings.HasPrefix(eventType, "verification."):
		return lipgloss.Color("#A6E3A1") // green
	case strings.HasPrefix(eventType, "security."), strings.HasPrefix(eventType, "poisoning."):
		return lipgloss.Color("#F38BA8") // red
	default:
		return lipgloss.Color("#6C7086") // gray
	}
}

// miniRiskBadge renders a compact colored dot for a risk level.
func miniRiskBadge(level string) string {
	c := riskColor(level)
	return lipgloss.NewStyle().Foreground(c).Render("●" + level)
}

// compactRunID shortens a run ID for display.
func compactRunID(runID string) string {
	if len(runID) <= 12 {
		return runID
	}
	return runID[:12]
}

// compactTime extracts HH:MM from an ISO timestamp.
func compactTime(ts string) string {
	if len(ts) >= 16 {
		return ts[11:16]
	}
	return ts
}

// suppress unused import warning if format fmt is not used in some builds.
var _ = fmt.Sprintf
