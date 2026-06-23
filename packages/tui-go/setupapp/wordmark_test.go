package setupapp

import (
	"strings"
	"testing"
)

// TestRenderWordmarkWide confirms the wordmark renders multi-line ASCII block
// art when given a wide enough viewport. This is the branded splash that makes
// the welcome screen feel like a product (Hermes Banner / OpenCode Logo), not a
// debug view.
func TestRenderWordmarkWide(t *testing.T) {
	out := stripANSI(renderWordmark(80))
	lines := strings.Split(out, "\n")
	// The wordmark must be multi-line ASCII art (more than 1 content line) on
	// a wide viewport.
	nonEmpty := 0
	for _, l := range lines {
		if strings.TrimSpace(l) != "" {
			nonEmpty++
		}
	}
	if nonEmpty < 3 {
		t.Fatalf("wide wordmark should render multi-line ASCII art, got %d content lines:\n%s", nonEmpty, out)
	}
}

// TestRenderWordmarkNarrowFallsBackToText confirms a narrow viewport falls back
// to a compact text title rather than overflowing or wrapping the ASCII art.
func TestRenderWordmarkNarrowFallsBackToText(t *testing.T) {
	out := stripANSI(renderWordmark(30))
	// The text "Aetherion" must appear (the fallback title).
	if !strings.Contains(out, "Aetherion") {
		t.Fatalf("narrow wordmark should fall back to text title 'Aetherion':\n%s", out)
	}
}

// TestRenderWordmarkUsesBrandColor confirms the wordmark uses the clay brand
// accent (#D97757 = 38;2;217;119;87) in its raw (ANSI-bearing) output.
func TestRenderWordmarkUsesBrandColor(t *testing.T) {
	raw := renderWordmark(80)
	if !strings.Contains(raw, "38;2;217;119;87") {
		t.Fatalf("wordmark should use clay brand color (38;2;217;119;87):\n%s", raw)
	}
}
