package setupapp

import (
	"strings"
	"testing"
)

// TestRenderSlashPopupNoLeakedANSI verifies that renderSlashPopup does not
// leak raw ANSI escape sequences as literal text. Regression guard for the
// bug where slash completion rows rendered "[m[1;4;38;2;250;249;245;4m" codes.
func TestRenderSlashPopupNoLeakedANSI(t *testing.T) {
	model := NewModel(testConfig())
	model.slashActive = true
	model.slashMatches = allSlashCommands()
	model.completionIdx = 1

	out := model.renderSlashPopup(80)
	if out == "" {
		t.Fatal("expected non-empty slash popup")
	}

	// Strip legitimate ESC sequences, leaving only visible text. If a style
	// sequence was leaked (ESC byte stripped but body kept), its parameter
	// digits/semicolons remain in the visible text.
	visible := stripANSI(out)

	// RGB color params, SGI codes, and bare "[" sequences must never appear as
	// literal visible characters. These are the fingerprints of the leak.
	leakMarkers := []string{
		"38;2;",
		"[1;4",
		"[4m",
		"[1m",
		"250;249;245",
		"217;119;87",
		"176;174;165",
	}
	for _, marker := range leakMarkers {
		if strings.Contains(visible, marker) {
			t.Fatalf("slash popup leaked raw style sequence %q into visible text:\n--- visible ---\n%s\n--- raw ---\n%s", marker, visible, out)
		}
	}
}

// TestRenderSlashPopupLinesContainCommandNames checks every visible row shows
// the command name as plain readable text (after ANSI stripping).
func TestRenderSlashPopupLinesContainCommandNames(t *testing.T) {
	model := NewModel(testConfig())
	model.slashActive = true
	model.slashMatches = allSlashCommands()
	model.completionIdx = 0

	visible := stripANSI(model.renderSlashPopup(80))
	for _, cmd := range model.slashMatches[:minInt(len(model.slashMatches), 8)] {
		if !strings.Contains(visible, cmd.Name) {
			t.Fatalf("slash popup missing command name %q in visible text:\n%s", cmd.Name, visible)
		}
		if !strings.Contains(visible, cmd.Description) {
			t.Fatalf("slash popup missing description %q in visible text:\n%s", cmd.Description, visible)
		}
	}
}

// TestRenderSlashPopupSelectedRowDistinguished confirms the selected row uses
// the clay accent (not the default ivory), proving the selection highlight
// survives without re-wrapping styled strings.
func TestRenderSlashPopupSelectedRowDistinguished(t *testing.T) {
	model := NewModel(testConfig())
	model.slashActive = true
	model.slashMatches = allSlashCommands()
	model.completionIdx = 0

	out := model.renderSlashPopup(80)
	// clay = #D97757 = 38;2;217;119;87. The selected row must emit this.
	if !strings.Contains(out, "38;2;217;119;87") {
		t.Fatalf("selected row not rendered with clay accent:\n%s", out)
	}
}
