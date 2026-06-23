package setupapp

import (
	"strings"

	"charm.land/lipgloss/v2"
)

// renderWordmark returns the Aetherion ASCII-art wordmark for the welcome
// screen, styled with the clay brand accent. On viewports too narrow for the
// block art (typically < 40 cols), it falls back to a text title so it never
// overflows or wraps.
//
// This is gap 2 from docs/19 — a branded splash (like Hermes' Banner or
// OpenCode's animated Logo) that makes the empty state feel like a product.
// The block art is compact (4 lines) so it fits above the welcome guidance
// without dominating it.
func renderWordmark(maxWidth int) string {
	const wordmarkWidth = 36 // each art line is 36 chars wide
	if maxWidth < 40 {
		// Fallback: plain text title in clay, no block art.
		return lipgloss.NewStyle().Foreground(clay).Bold(true).Render("Aetherion")
	}
	art := []string{
		"    ▄▀▀▄ ▄▀▀▄ █▀▀▄ ▄▀▀▄ █  █ █▀▀▄",
		"    █▀▀▄ █  █ █▀▀▄ █  █ █▀▀█ █▀▀▄",
		"    ▀  ▀ ▀▀▀ ▀▀▀  ▀▀▀ ▀  ▀ ▀▀▀ ",
		"      local-first agent harness  ",
	}
	brandStyle := lipgloss.NewStyle().Foreground(clay).Bold(true)
	tagStyle := lipgloss.NewStyle().Foreground(cloudMedium)
	var lines []string
	for i, line := range art {
		if i == len(art)-1 {
			lines = append(lines, tagStyle.Render(line))
			continue
		}
		lines = append(lines, brandStyle.Render(line))
	}
	return strings.Join(lines, "\n")
}
