package setupapp

import (
	"strings"
	"testing"
)

// TestRenderMarkdownPassesPlainThrough confirms plain text with no markdown
// constructs is returned unchanged (so non-markdown transcript entries don't
// regress).
func TestRenderMarkdownPassesPlainThrough(t *testing.T) {
	in := "Just a plain sentence.\nAnd another line."
	out := stripANSI(renderMarkdown(in))
	if out != in {
		t.Fatalf("plain text should pass through unchanged:\nwant: %q\ngot:  %q", in, out)
	}
}

// TestRenderMarkdownFencedCodeBlock confirms a fenced code block gets a language
// label header and the body is preserved.
func TestRenderMarkdownFencedCodeBlock(t *testing.T) {
	in := "Here is code:\n\n```go\nfmt.Println(\"hi\")\n```\n\nDone."
	out := stripANSI(renderMarkdown(in))
	// The language label must appear.
	if !strings.Contains(out, "go") {
		t.Fatalf("code block missing language label:\n%s", out)
	}
	// The code body must survive.
	if !strings.Contains(out, `fmt.Println("hi")`) {
		t.Fatalf("code block body lost:\n%s", out)
	}
}

// TestRenderMarkdownInlineCode confirms inline `code` is styled distinctly
// (wrapping backticks removed, content preserved).
func TestRenderMarkdownInlineCode(t *testing.T) {
	in := "Use the `local_file_read` tool."
	out := stripANSI(renderMarkdown(in))
	// Backticks removed, content kept.
	if strings.Contains(out, "`local_file_read`") {
		t.Fatalf("inline code backticks not stripped:\n%s", out)
	}
	if !strings.Contains(out, "local_file_read") {
		t.Fatalf("inline code content lost:\n%s", out)
	}
}

// TestRenderMarkdownDiffBlock confirms a ```diff fenced block tints + and -
// lines. We assert the raw output contains the ANSI tint for added/removed
// (clay / ember foregrounds) so the diff is visually distinguishable.
func TestRenderMarkdownDiffBlock(t *testing.T) {
	in := "```diff\n+ added line\n- removed line\n```"
	raw := renderMarkdown(in)
	// clay = #D97757 = 38;2;217;119;87 should tint the + line.
	if !strings.Contains(raw, "38;2;217;119;87") {
		t.Fatalf("diff block does not tint added (+) lines with clay:\n%s", raw)
	}
	// ember = #C6613F = 38;2;198;97;63 should tint the - line.
	if !strings.Contains(raw, "38;2;198;97;63") {
		t.Fatalf("diff block does not tint removed (-) lines with ember:\n%s", raw)
	}
}

// TestRenderMarkdownBold confirms **bold** markers are stripped and the text
// survives (bold applied via ANSI).
func TestRenderMarkdownBold(t *testing.T) {
	in := "This is **important** text."
	out := stripANSI(renderMarkdown(in))
	if strings.Contains(out, "**") {
		t.Fatalf("bold markers not stripped:\n%s", out)
	}
	if !strings.Contains(out, "important") {
		t.Fatalf("bold text content lost:\n%s", out)
	}
}

// TestRenderMarkdownNoLeakedANSI is the regression guard: after stripping
// legitimate ESC sequences, no style-sequence body should leak as visible text
// (same class of bug as the slash popup / tree cursor).
func TestRenderMarkdownNoLeakedANSI(t *testing.T) {
	in := "```go\nfmt.Println(\"x\")\n```\n\n`inline` and **bold**."
	out := stripANSI(renderMarkdown(in))
	leakMarkers := []string{"38;2;", "[1m", "[4m", "[22m"}
	for _, marker := range leakMarkers {
		if strings.Contains(out, marker) {
			t.Fatalf("markdown leaked raw style sequence %q into visible text:\n%s", marker, out)
		}
	}
}
