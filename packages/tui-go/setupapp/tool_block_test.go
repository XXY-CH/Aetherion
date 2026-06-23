package setupapp

import (
	"strings"
	"testing"
)

// TestToolBlockRendersIconAndName confirms a tool transcript entry renders as
// a compact block with an icon and the tool name (not the flat "🔧 name(path)"
// line). Mirrors OpenCode's InlineTool (fixed-width icon column + name) and
// Hermes's tool trail bullets.
func TestToolBlockRendersIconAndName(t *testing.T) {
	entry := transcriptEntry{
		Role: "tool",
		Text: "🔧 local_file_read(src/main.ts)",
		Meta: "result",
	}
	out := stripANSI(messageBlock(entry))
	// The tool name must appear.
	if !strings.Contains(out, "local_file_read") {
		t.Fatalf("tool block missing tool name:\n%s", out)
	}
	// The path must appear.
	if !strings.Contains(out, "src/main.ts") {
		t.Fatalf("tool block missing path:\n%s", out)
	}
	// The raw 🔧-prefixed flat line should NOT appear verbatim (we re-render).
	if strings.Contains(out, "🔧 local_file_read(src/main.ts)") {
		t.Fatalf("tool block still rendering the flat 🔧 line:\n%s", out)
	}
}

// TestToolBlockIconByVerb confirms the icon differs by tool: read → →, write →
// ←, exec → $, search → ✱. This is the OpenCode InlineTool icon mapping.
func TestToolBlockIconByVerb(t *testing.T) {
	cases := []struct {
		text string
		icon string
	}{
		{"🔧 local_file_read(foo)", "→"},
		{"🔧 local_file_write(foo)", "←"},
		{"🔧 file_edit(foo)", "←"},
		{"🔧 shell_exec(ls)", "$"},
		{"🔧 search_files(foo)", "✱"},
		{"🔧 list_files(foo)", "✱"},
		{"🔧 web_fetch(http://x)", "%"},
		{"🔧 agent_spawn(task)", "⚡"},
	}
	for _, tc := range cases {
		entry := transcriptEntry{Role: "tool", Text: tc.text}
		out := stripANSI(messageBlock(entry))
		if !strings.Contains(out, tc.icon) {
			t.Fatalf("tool %q should render icon %q, got:\n%s", tc.text, tc.icon, out)
		}
	}
}

// TestToolBlockShowsResultMeta confirms the result/status meta (e.g. "result",
// "denied") is shown compactly.
func TestToolBlockShowsResultMeta(t *testing.T) {
	entry := transcriptEntry{
		Role: "tool",
		Text: "🔧 local_file_read(foo)",
		Meta: "result",
	}
	out := stripANSI(messageBlock(entry))
	if !strings.Contains(out, "result") {
		t.Fatalf("tool block missing result meta:\n%s", out)
	}
}

// TestToolBlockParsesFlatLegacyText confirms the tool block handles entries
// that were stored without the 🔧 prefix (legacy) gracefully.
func TestToolBlockParsesFlatLegacyText(t *testing.T) {
	entry := transcriptEntry{
		Role: "tool",
		Text: "local_file_read foo",
	}
	out := stripANSI(messageBlock(entry))
	if !strings.Contains(out, "local_file_read") {
		t.Fatalf("legacy tool entry lost:\n%s", out)
	}
}
