package setupapp

import (
	"fmt"
	"strings"
)

// renderTreeGutter renders the left git-tree time axis.
//
//	●  run.st  14:30
//	│
//	◆  usr.ms          ← checkpoint
//	│
//	▸  HEAD
func (m Model) renderTreeGutter(width, height int) string {
	theme := styles()
	if len(m.treeNodes) == 0 {
		return theme.treeBase.Width(width).Height(height).Render(theme.muted.Render(" (no events)"))
	}

	// Determine the visible window (tail-end, fitting height).
	visible := m.treeNodes
	startIdx := 0
	if len(visible) > height {
		startIdx = len(visible) - height
		visible = visible[startIdx:]
	}

	var lines []string
	for i, node := range visible {
		realIdx := startIdx + i
		isCursor := realIdx == m.treeCursor

		// Node symbol.
		symbol := "●"
		if node.IsCheckpoint {
			symbol = "◆"
		}
		if node.IsBranch {
			symbol = "◇"
		}
		if node.IsHead {
			symbol = "▸"
		}
		// Run boundary (first event of a new run).
		if i > 0 && node.RunID != visible[i-1].RunID && symbol == "●" {
			lines = append(lines, theme.muted.Render("│  ── run ──"))
		}

		abbrev := eventAbbrev(node.EventType)
		timeStr := compactTime(node.Timestamp)

		var line string
		if m.treeExpanded {
			riskStr := ""
			if node.RiskLevel != "" {
				riskStr = " " + RiskBadge(node.RiskLevel)
			}
			line = fmt.Sprintf("%s %-8s %s %s", symbol, abbrev, timeStr, riskStr)
		} else {
			line = fmt.Sprintf("%s %-8s", symbol, abbrev)
		}

		if isCursor {
			line = theme.treeCursor.Render(line)
		} else {
			line = theme.treeBase.Render(line)
		}
		lines = append(lines, line)

		// Connector line (except after last).
		if i < len(visible)-1 {
			lines = append(lines, theme.treeBase.Render("│"))
		}
	}

	content := strings.Join(lines, "\n")
	return theme.panel.Width(width).Height(height).Render(content)
}

// compactTime extracts HH:MM from an ISO timestamp.
func compactTime(ts string) string {
	if len(ts) >= 16 {
		return ts[11:16]
	}
	return ts
}
