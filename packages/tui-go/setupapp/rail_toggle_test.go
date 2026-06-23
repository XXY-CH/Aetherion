package setupapp

import (
	"strings"
	"testing"
)

// TestRailHiddenExpandsConversation confirms that when railHidden is true, the
// conversation pane takes the full non-gutter width (no right rail rendered).
// This is the "opt-in density" toggle from gap 5 (docs/19): the transcript
// becomes the hero when the operator hides the rail.
func TestRailHiddenExpandsConversation(t *testing.T) {
	m := NewModel(testConfig())
	m.width = 120
	m.height = 40
	m.railHidden = true
	view := stripANSI(m.render())
	// The AGENT card (always rendered by renderRightRail) must NOT appear when
	// the rail is hidden.
	if strings.Contains(view, "AGENT") {
		t.Fatalf("rail should be hidden, but AGENT card appears:\n%s", view)
	}
}

// TestRailVisibleShowsCards confirms that when railHidden is false (default),
// the rail cards ARE rendered (regression guard — we didn't break the default).
func TestRailVisibleShowsCards(t *testing.T) {
	m := NewModel(testConfig())
	m.width = 120
	m.height = 40
	m.railHidden = false
	view := stripANSI(m.render())
	if !strings.Contains(view, "AGENT") {
		t.Fatalf("rail should be visible, but AGENT card missing:\n%s", view)
	}
}

// TestRailToggleReversesState confirms the toggleRail helper flips railHidden.
// The keybinding in update.go calls this; here we test the core behavior
// directly so the test is independent of the key-code plumbing.
func TestRailToggleReversesState(t *testing.T) {
	m := NewModel(testConfig())
	if m.railHidden {
		t.Fatal("rail should be visible by default")
	}
	m.toggleRail()
	if !m.railHidden {
		t.Fatal("toggleRail should hide the rail")
	}
	m.toggleRail()
	if m.railHidden {
		t.Fatal("second toggleRail should show the rail again")
	}
}

// TestRailHiddenByDefault confirms the rail is visible by default (opt-in hide,
// not opt-out show) so existing users keep the workbench identity.
func TestRailHiddenByDefault(t *testing.T) {
	m := NewModel(testConfig())
	if m.railHidden {
		t.Fatal("rail should be visible by default (railHidden should be false)")
	}
}

// TestRailHiddenHelpHintShown confirms the footer/key hints reference the rail
// toggle so the operator can discover it.
func TestRailHiddenHelpHintShown(t *testing.T) {
	m := NewModel(testConfig())
	m.width = 120
	m.height = 40
	view := stripANSI(m.render())
	// The footer or welcome should hint at the rail toggle (ctrl+\\).
	if !strings.Contains(view, "ctrl+\\") {
		t.Fatalf("rail toggle hint (ctrl+\\) should be discoverable in the view:\n%s", view)
	}
}
