package setupapp

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// renderApprovalDiff produces a unified diff between the current file content
// and the proposed content for a write approval.
// Returns empty string if no diff (e.g. file doesn't exist yet and content is empty).
func renderApprovalDiff(targetPath, proposedContent string) string {
	// Resolve path relative to workspace root if needed.
	fullPath := targetPath
	if !filepath.IsAbs(fullPath) {
		// Try as-is first; the TUI may have absolute paths.
	}

	beforeBytes, err := os.ReadFile(fullPath)
	before := ""
	isNewFile := false
	if err != nil {
		if os.IsNotExist(err) {
			isNewFile = true
		} else {
			return "" // can't read, skip diff
		}
	} else {
		before = string(beforeBytes)
	}

	if before == proposedContent {
		return "  (no changes)"
	}

	var lines []string
	if isNewFile {
		lines = append(lines, "  + (new file)")
	}

	beforeLines := strings.Split(before, "\n")
	afterLines := strings.Split(proposedContent, "\n")

	// Simple line-level diff: show up to 15 lines of changes.
	maxDiffLines := 15
	shown := 0

	// Find common prefix
	commonPrefix := 0
	minLen := len(beforeLines)
	if len(afterLines) < minLen {
		minLen = len(afterLines)
	}
	for commonPrefix < minLen && beforeLines[commonPrefix] == afterLines[commonPrefix] {
		commonPrefix++
	}

	// Find common suffix
	commonSuffix := 0
	for commonSuffix < minLen-commonPrefix &&
		beforeLines[len(beforeLines)-1-commonSuffix] == afterLines[len(afterLines)-1-commonSuffix] {
		commonSuffix++
	}

	// Removed lines (before but not in common)
	for i := commonPrefix; i < len(beforeLines)-commonSuffix && shown < maxDiffLines; i++ {
		lines = append(lines, "  - "+truncateLine(beforeLines[i], 60))
		shown++
	}

	// Added lines (after but not in common)
	for i := commonPrefix; i < len(afterLines)-commonSuffix && shown < maxDiffLines; i++ {
		lines = append(lines, "  + "+truncateLine(afterLines[i], 60))
		shown++
	}

	remaining := (len(beforeLines) - commonPrefix - commonSuffix) + (len(afterLines) - commonPrefix - commonSuffix) - shown
	if remaining > 0 {
		lines = append(lines, fmt.Sprintf("  ... (%d more lines)", remaining))
	}

	return strings.Join(lines, "\n")
}

// truncateLine limits a line for display in the diff panel.
func truncateLine(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
