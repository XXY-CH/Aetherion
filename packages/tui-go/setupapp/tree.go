package setupapp

import (
	"fmt"
	"image/color"
	"strings"

	"charm.land/lipgloss/v2"
)

// renderTreeGutter renders the left git-tree time axis with parallel run lanes,
// branch/merge nodes, and color-coded connectors.
//
//	●  run.st  14:30         ← trunk
//	│
//	◆  usr.ms                 ← checkpoint (gold diamond)
//	├─◇ branch: rehear         ← fork into lane 1 (orange diamond)
//	│  ●  run.st  14:35       ← lane 1 node (indented)
//	│  │
//	│  ✦ merge ← trunk        ← merge back to trunk (green)
//	│
//	▸  lop.✓  HEAD
func (m Model) renderTreeGutter(width, height int) string {
	theme := styles()
	if len(m.treeNodes) == 0 {
		empty := theme.treeBase.Width(width).Height(height).
			Align(lipgloss.Center, lipgloss.Top).
			Render("\n\n " + theme.muted.Render("◇ no events") + "\n\n " +
				theme.muted.Render("run a task to\n populate the tree"))
		return empty
	}

	// Assign each run to a "lane" (0 = trunk, 1+ = parallel branches).
	runLanes := map[string]int{}
	nextLane := 1
	for _, node := range m.treeNodes {
		if node.IsBranch {
			// Branch events start a new lane.
			runLanes[node.RunID] = nextLane
			nextLane++
		} else if _, ok := runLanes[node.RunID]; !ok {
			runLanes[node.RunID] = 0 // trunk
		}
	}

	// Determine visible window (tail-end).
	visible := m.treeNodes
	startIdx := 0
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
		lane := runLanes[node.RunID]

		// Lane indentation: trunk (lane 0) is full-width, lanes 1+ are indented.
		indent := ""
		if lane > 0 {
			indent = strings.Repeat("  ", lane)
		}

		// Run boundary marker when a new run starts.
		if i > 0 && node.RunID != visible[i-1].RunID {
			boundary := theme.muted.Render(indent + "── " + compactRunID(node.RunID) + " ──")
			lines = append(lines, boundary)
		}

		// Connector: trunk line or branch fork/merge connector.
		connector := "│ "
		if node.IsBranch {
			if lane > 0 {
				connector = "├─"
			} else {
				connector = "╭─"
			}
		} else if node.IsHead && isLast {
			connector = "  "
		} else if isMergeNode(node, visible, i) {
			connector = "╰─" // merge back to trunk
		}

		// Node symbol + color.
		symbol, symColor := nodeSymbol(node)
		symbolStyled := lipgloss.NewStyle().Foreground(symColor).Bold(true).Render(symbol)

		// Event type abbreviation + color.
		abbrev := eventAbbrev(node.EventType)
		typeColor := eventTypeColor(node.EventType)
		typeStyled := lipgloss.NewStyle().Foreground(typeColor).Render(abbrev)

		// Risk badge.
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

		// Lane indicator for parallel runs.
		laneTag := ""
		if lane > 0 {
			laneTag = lipgloss.NewStyle().Foreground(laneColor(lane)).Render("L" + itoaSimple(lane) + " ")
		}

		// Build the line.
		line := indent + connector + symbolStyled + " " + typeStyled + laneTag + timeStr + riskStr
		if isCursor {
			line = lipgloss.NewStyle().Foreground(clay).Underline(true).Render(line)
			line = theme.treeCursor.Render("▸") + line
		} else {
			// Add trunk connector for non-last, non-branch nodes.
			lines = append(lines, line)
			if !isLast {
				lines = append(lines, indent+theme.treeBase.Render("│"))
			}
			continue
		}
		lines = append(lines, line)

		// Inter-node trunk connector (except after last).
		if !isLast {
			lines = append(lines, indent+theme.treeBase.Render("│"))
		}
	}

	content := strings.Join(lines, "\n")
	box := theme.treeBase.Width(width).Height(height).Background(slateDark)
	return box.Render(content)
}

// isMergeNode detects if this node is the last in a non-trunk lane (merge point).
func isMergeNode(node treeNode, all []treeNode, idx int) bool {
	if node.IsHead {
		return false
	}
	// It's a merge point if it's the last node of a non-trunk run.
	if idx+1 < len(all) {
		nextRun := all[idx+1].RunID
		if nextRun != node.RunID && !node.IsBranch {
			// Check if this run was on a non-trunk lane by looking back.
			for j := idx; j >= 0; j-- {
				if all[j].RunID != node.RunID {
					break
				}
				if all[j].IsBranch {
					return true
				}
			}
		}
	}
	return false
}

// laneColor returns a distinct color for each parallel lane.
func laneColor(lane int) color.Color {
	laneColors := []color.Color{cloudLight, cloudMedium, cactus, sky, fig}
	if lane > 0 && lane <= len(laneColors) {
		return laneColors[lane-1]
	}
	return cloudDark
}

// nodeSymbol returns the display symbol and color for a tree node.
func nodeSymbol(node treeNode) (string, color.Color) {
	if node.IsHead {
		return "▸", clay
	}
	if node.IsBranch {
		switch node.BranchStatus {
		case "sandbox":
			return "◇", clay
		case "approved":
			return "✦", olive
		case "discarded":
			return "✕", cloudDark
		}
		return "◇", clay
	}
	if node.IsCheckpoint {
		return "◆", ivoryLight
	}
	return "●", eventTypeColor(node.EventType)
}

// eventTypeColor maps an event type to a semantic color.
func eventTypeColor(eventType string) color.Color {
	switch {
	case strings.HasPrefix(eventType, "run."):
		return ivoryLight
	case strings.HasPrefix(eventType, "user."):
		return ivoryDark
	case strings.HasPrefix(eventType, "tool."):
		return olive
	case strings.HasPrefix(eventType, "policy."):
		return ivoryLight
	case strings.HasPrefix(eventType, "risk."):
		return clay
	case strings.HasPrefix(eventType, "lease."):
		return clay
	case strings.HasPrefix(eventType, "agent."):
		return cloudLight
	case strings.HasPrefix(eventType, "consent."):
		return sky
	case strings.HasPrefix(eventType, "action."):
		return clay
	case strings.HasPrefix(eventType, "verification."):
		return olive
	case strings.HasPrefix(eventType, "security."), strings.HasPrefix(eventType, "poisoning."):
		return ember
	default:
		return cloudMedium
	}
}

// miniRiskBadge renders a compact colored dot+level for a risk level.
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

func itoaSimple(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}

var _ = fmt.Sprintf
