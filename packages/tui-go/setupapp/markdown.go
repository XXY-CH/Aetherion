package setupapp

import (
	"strings"

	"charm.land/lipgloss/v2"
)

// renderMarkdown converts a markdown string into a styled string suitable for
// the conversation transcript. It is a deliberately small, line-based renderer
// (not a full CommonMark parser) focused on the constructs that actually appear
// in agent tool output and assistant replies:
//
//   - fenced code blocks with a language label
//   - ```diff blocks with + / - line tinting (clay added, ember removed)
//   - inline `code`
//   - **bold**
//
// Everything else passes through as plain text. Styling is applied per-segment
// and the segments are concatenated — we never call .Render() on a string that
// already contains escape sequences (the lipgloss re-wrap anti-pattern that
// leaks the sequence body as visible text).
//
// Reference: Hermes markdown.tsx and OpenCode session/index.tsx both ship rich
// terminal markdown; this is the Go/lipgloss equivalent of the highest-impact
// subset (code blocks + diff tints), which is what makes a transcript stop
// reading like a debug log.

func renderMarkdown(text string) string {
	lines := strings.Split(text, "\n")
	var out strings.Builder
	i := 0
	for i < len(lines) {
		line := lines[i]
		// Detect a fenced code block: a line starting with ``` (optionally
		// followed by a language tag).
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "```") {
			lang := strings.TrimPrefix(trimmed, "```")
			lang = strings.TrimSpace(lang)
			// Collect until the closing fence.
			var body []string
			i++
			for i < len(lines) && !strings.HasPrefix(strings.TrimSpace(lines[i]), "```") {
				body = append(body, lines[i])
				i++
			}
			// Skip the closing fence if present.
			if i < len(lines) {
				i++
			}
			out.WriteString(renderCodeBlock(lang, body))
			continue
		}
		// Regular line: apply inline formatting.
		out.WriteString(renderInline(line))
		if i < len(lines)-1 || strings.HasSuffix(text, "\n") {
			out.WriteString("\n")
		}
		i++
	}
	return out.String()
}

// renderCodeBlock renders a fenced code block with a language label header and
// (for ```diff) per-line add/remove tinting.
func renderCodeBlock(lang string, body []string) string {
	var b strings.Builder
	// Language label as a subtle `─ lang` header (Hermes style).
	if lang != "" {
		b.WriteString(lipgloss.NewStyle().Foreground(cloudDark).Render("─ "+lang))
		b.WriteString("\n")
	}
	switch strings.ToLower(lang) {
	case "diff", "patch":
		for _, line := range body {
			b.WriteString(renderDiffLine(line))
			b.WriteString("\n")
		}
	default:
		// Render the code body in a single style pass (ivory on slate) so the
		// block reads as a unit. Indent by one for visual separation.
		bodyText := strings.Join(body, "\n")
		codeStyle := lipgloss.NewStyle().
			Foreground(ivoryLight).
			Background(slateMedium).
			PaddingLeft(1)
		b.WriteString(codeStyle.Render(bodyText))
		b.WriteString("\n")
	}
	return b.String()
}

// renderDiffLine tints a single diff line: clay (+), ember (-), muted (hunk
// header @@), plain (context).
func renderDiffLine(line string) string {
	switch {
	case strings.HasPrefix(line, "+"):
		return lipgloss.NewStyle().Foreground(clay).Render(line)
	case strings.HasPrefix(line, "-"):
		return lipgloss.NewStyle().Foreground(ember).Render(line)
	case strings.HasPrefix(line, "@@"):
		return lipgloss.NewStyle().Foreground(cloudMedium).Render(line)
	default:
		return lipgloss.NewStyle().Foreground(ivoryDark).Render(line)
	}
}

// renderInline applies inline formatting to a single line: inline `code` and
// **bold**. These are applied by splitting the line into segments and styling
// each segment once (never re-wrapping a styled string).
func renderInline(line string) string {
	// First pass: extract inline code spans, then bold within the remaining
	// segments. We tokenize on backticks first.
	parts := splitOnDelim(line, "`")
	var b strings.Builder
	for idx, p := range parts {
		// Odd indices are inside backticks → render as inline code.
		if idx%2 == 1 {
			b.WriteString(lipgloss.NewStyle().Foreground(clay).Render(p))
			continue
		}
		// Even indices: apply bold within this plain segment.
		b.WriteString(renderBold(p))
	}
	return b.String()
}

// renderBold replaces **text** with a bold-styled rendering of text.
func renderBold(text string) string {
	parts := splitOnDelim(text, "**")
	var b strings.Builder
	for idx, p := range parts {
		if idx%2 == 1 {
			b.WriteString(lipgloss.NewStyle().Bold(true).Foreground(ivoryLight).Render(p))
		} else {
			b.WriteString(p)
		}
	}
	return b.String()
}

// splitOnDelim splits s on delim into alternating [outside, inside, outside, ...]
// segments. A trailing unterminated delim puts the remainder in an "inside"
// segment. This mirrors how markdown inline spans nest: odd indices are inside
// the delimiter.
func splitOnDelim(s, delim string) []string {
	var parts []string
	for {
		idx := strings.Index(s, delim)
		if idx < 0 {
			parts = append(parts, s)
			return parts
		}
		before := s[:idx]
		rest := s[idx+len(delim):]
		next := strings.Index(rest, delim)
		if next < 0 {
			// Unterminated: treat the rest as inside.
			parts = append(parts, before, rest)
			return parts
		}
		inside := rest[:next]
		parts = append(parts, before, inside)
		s = rest[next+len(delim):]
	}
}
