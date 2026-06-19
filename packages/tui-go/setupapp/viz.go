package setupapp

import (
	"fmt"
	"image/color"
	"math"
	"strings"

	"charm.land/lipgloss/v2"
)

// Hand-rolled data-visualization widgets. The Charm v2 stack ships no
// sparkline/gauge/chart package, so these are built from block characters +
// lipgloss styles. All are pure functions returning styled strings.

var sparkBlocks = []rune{'▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'}

// Sparkline renders values as a single-line sparkline with a gradient from c0
// to c1. lo/hi define the value domain; values are clamped.
func Sparkline(values []float64, lo, hi float64, c0, c1 color.Color) string {
	if len(values) == 0 {
		return ""
	}
	if hi <= lo {
		hi = lo + 1
	}
	n := len(values)
	stops := blendColors(n, c0, c1)
	span := hi - lo
	var b strings.Builder
	for i, v := range values {
		norm := (v - lo) / span
		if norm < 0 {
			norm = 0
		} else if norm > 1 {
			norm = 1
		}
		idx := int(math.Round(norm * float64(len(sparkBlocks)-1)))
		st := lipgloss.NewStyle().Foreground(stops[i])
		b.WriteString(st.Render(string(sparkBlocks[idx])))
	}
	return b.String()
}

// Gauge renders "████░░ pct%" — filled cells in fullColor, empty in emptyColor.
func Gauge(pct float64, total int, full, empty rune, fullColor, emptyColor color.Color) string {
	if total < 1 {
		total = 1
	}
	if pct < 0 {
		pct = 0
	} else if pct > 1 {
		pct = 1
	}
	filled := int(math.Round(pct * float64(total)))
	if filled > total {
		filled = total
	}
	bar := lipgloss.NewStyle().Foreground(fullColor).Render(strings.Repeat(string(full), filled)) +
		lipgloss.NewStyle().Foreground(emptyColor).Render(strings.Repeat(string(empty), total-filled))
	return fmt.Sprintf("%s %3.0f%%", bar, pct*100)
}

// ttlGaugeColor returns green/yellow/red based on remaining fraction.
func ttlGaugeColor(frac float64) color.Color {
	switch {
	case frac > 0.5:
		return lipgloss.Color("#5DFF8F")
	case frac > 0.2:
		return lipgloss.Color("#FFE75D")
	default:
		return lipgloss.Color("#FF3B3B")
	}
}

// RiskBar is a single bar in the risk distribution chart.
type RiskBar struct {
	Label string
	Count int
	Color color.Color
}

// BarChart renders a horizontal bar chart. maxBar is the character width for
// the longest bar.
func BarChart(bars []RiskBar, maxBar int) string {
	if maxBar <= 0 {
		maxBar = 20
	}
	total := 0
	for _, b := range bars {
		total += b.Count
	}
	if total <= 0 {
		total = 1
	}
	var rows []string
	for _, b := range bars {
		width := int(math.Round(float64(b.Count) / float64(total) * float64(maxBar)))
		label := lipgloss.NewStyle().Width(4).Bold(true).Foreground(b.Color).Render(b.Label)
		bar := lipgloss.NewStyle().Foreground(b.Color).Render(strings.Repeat("█", max(0, width)))
		count := lipgloss.NewStyle().Foreground(b.Color).Render(fmt.Sprintf(" %4d", b.Count))
		rows = append(rows, lipgloss.JoinHorizontal(lipgloss.Center, label, bar, count))
	}
	return strings.Join(rows, "\n")
}

// RiskBadge renders a colored "[Lx]" pill.
func RiskBadge(level string) string {
	c := riskColor(level)
	return lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#1E1E2E")).Background(c).Padding(0, 1).Render(level)
}

// Segment is a fixed-width segment in a StatusStrip.
type Segment struct {
	Text  string
	Style lipgloss.Style
	Width int
}

// StatusStrip joins segments horizontally with separators.
func StatusStrip(segments []Segment, totalWidth int) string {
	parts := make([]string, len(segments))
	for i, seg := range segments {
		style := seg.Style
		if seg.Width > 0 {
			style = style.Width(seg.Width)
		}
		parts[i] = style.Render(seg.Text)
	}
	return lipgloss.JoinHorizontal(lipgloss.Center, parts...)
}

// truncateString truncates s to maxLen, appending an ellipsis.
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-1] + "…"
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func clampInt(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// contentWidth computes the inner content width given the outer box width,
// border (left+right chars), padding (left+right cells), and any extra inline
// decoration (e.g. a "❯ " prompt). Prevents the lipgloss no-truncate overflow
// where inner content is wider than the box can hold.
func contentWidth(outerW, borderW, paddingW, extraW int) int {
	w := outerW - borderW - paddingW - extraW
	if w < 4 {
		w = 4
	}
	return w
}
