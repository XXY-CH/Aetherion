package setupapp

import (
	"strings"
	"testing"
)

// TestTreeGutterCursorRowNoANSILeak is the regression guard for the git-tree
// cursor row. Previously the cursor row was re-wrapped via
// lipgloss.NewStyle().Foreground(clay).Underline(true).Render(line), where
// `line` already contained styled components. That leaks the style-sequence
// body as visible text (the same bug as the slash popup). The cursor is now
// indicated by the "▸" prefix only.
func TestTreeGutterCursorRowNoANSILeak(t *testing.T) {
	model := NewModel(testConfig())
	model.treeExpanded = true
	model.treeNodes = []treeNode{
		{EventID: "e1", EventType: "run.started", RunID: "r1", Timestamp: "2026-06-20T14:30:00Z", Summary: "run start"},
		{EventID: "e2", EventType: "user.message", RunID: "r1", Timestamp: "2026-06-20T14:31:00Z", Summary: "hi"},
		{EventID: "e3", EventType: "risk.composed", RunID: "r1", Timestamp: "2026-06-20T14:31:30Z", Summary: "L2 risk"},
		{EventID: "e4", EventType: "tool.result", RunID: "r1", Timestamp: "2026-06-20T14:32:00Z", Summary: "ok"},
	}
	// Put the cursor on a non-head, non-checkpoint row so the cursor branch is
	// exercised.
	model.treeCursor = 2

	out := model.renderTreeGutter(40, 20)
	visible := stripANSI(out)

	leakMarkers := []string{
		"38;2;",
		"[1;4",
		"[4m",
		"[1m",
		"217;119;87",
	}
	for _, marker := range leakMarkers {
		if strings.Contains(visible, marker) {
			t.Fatalf("tree cursor row leaked raw style sequence %q into visible text:\n--- visible ---\n%s\n--- raw ---\n%s", marker, visible, out)
		}
	}

	// The cursor marker "▸" must be present (the cursor indicator).
	if !strings.Contains(visible, "▸") {
		t.Fatalf("cursor marker ▸ missing from tree gutter:\n%s", visible)
	}
}

// TestTreeGutterRendersEventAbbrevs confirms the tree content is still readable.
func TestTreeGutterRendersEventAbbrevs(t *testing.T) {
	model := NewModel(testConfig())
	model.treeNodes = []treeNode{
		{EventID: "e1", EventType: "run.started", RunID: "r1", Summary: "run"},
	}
	out := stripANSI(model.renderTreeGutter(40, 10))
	if !strings.Contains(out, "run.st") {
		t.Fatalf("tree gutter missing event abbrev:\n%s", out)
	}
}
