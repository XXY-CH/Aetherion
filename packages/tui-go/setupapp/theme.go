package setupapp

import (
	"image/color"

	"charm.land/lipgloss/v2"
)

// styleSet holds every style the workbench uses. Carried from the legacy
// app.go and extended with tree/chart styles.
type styleSet struct {
	title        lipgloss.Style
	badge        lipgloss.Style
	muted        lipgloss.Style
	meta         lipgloss.Style
	panel        lipgloss.Style
	help         lipgloss.Style
	prompt       lipgloss.Style
	composerBox  lipgloss.Style
	modelFields  lipgloss.Style
	sessionPanel lipgloss.Style
	sectionTitle lipgloss.Style
	status       lipgloss.Style
	warn         lipgloss.Style
	errorStyle   lipgloss.Style
	response     lipgloss.Style
	result       lipgloss.Style
	streaming    lipgloss.Style
	transcript   lipgloss.Style
	overlay      lipgloss.Style
	statusRule   lipgloss.Style
	treeBase     lipgloss.Style
	treeCursor   lipgloss.Style
	floatFocused lipgloss.Style
	floatBlurred lipgloss.Style
	modalBox     lipgloss.Style
}

func styles() styleSet {
	s := styleSet{
		title:        lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#FFD700")),
		badge:        lipgloss.NewStyle().Foreground(lipgloss.Color("#1E1E2E")).Background(lipgloss.Color("#FFD700")).Padding(0, 1),
		muted:        lipgloss.NewStyle().Foreground(lipgloss.Color("#6C7086")),
		meta:         lipgloss.NewStyle().Foreground(lipgloss.Color("#CDD6F4")),
		panel:        lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("#45475A")).Padding(0, 1),
		help:         lipgloss.NewStyle().Foreground(lipgloss.Color("#6C7086")),
		prompt:       lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#FFD700")),
		composerBox:  lipgloss.NewStyle().Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("#45475A")).Padding(0, 1),
		modelFields:  lipgloss.NewStyle().Foreground(lipgloss.Color("#CDD6F4")).Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("#45475A")).Padding(0, 1),
		sessionPanel: lipgloss.NewStyle().Foreground(lipgloss.Color("#CDD6F4")).Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("#FFD700")).Padding(0, 1),
		sectionTitle: lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#FFD700")),
		status:       lipgloss.NewStyle().Foreground(lipgloss.Color("#5DFF8F")),
		warn:         lipgloss.NewStyle().Foreground(lipgloss.Color("#FFAE5D")),
		errorStyle:   lipgloss.NewStyle().Foreground(lipgloss.Color("#FF3B3B")).Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("#FF3B3B")).Padding(0, 1),
		response:     lipgloss.NewStyle().Foreground(lipgloss.Color("#CDD6F4")).Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("#45475A")).Padding(0, 1),
		result:       lipgloss.NewStyle().Foreground(lipgloss.Color("#CDD6F4")).Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("#5DFF8F")).Padding(0, 1),
		streaming:    lipgloss.NewStyle().Foreground(lipgloss.Color("#FFD700")).Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("#45475A")).Padding(0, 1),
		transcript:   lipgloss.NewStyle().Foreground(lipgloss.Color("#CDD6F4")).Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("#45475A")).Padding(0, 1),
		overlay:      lipgloss.NewStyle().Foreground(lipgloss.Color("#CDD6F4")).Border(lipgloss.DoubleBorder()).BorderForeground(lipgloss.Color("#FFD700")).Padding(0, 1),
		statusRule:   lipgloss.NewStyle().Foreground(lipgloss.Color("#CDD6F4")).Background(lipgloss.Color("#181825")).Padding(0, 1),
		treeBase:     lipgloss.NewStyle().Foreground(lipgloss.Color("#6C7086")),
		treeCursor:   lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#56D4FF")),
		floatFocused: lipgloss.NewStyle().Border(lipgloss.DoubleBorder()).BorderForeground(lipgloss.Color("#FFD700")).Padding(0, 1),
		floatBlurred: lipgloss.NewStyle().Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("#45475A")).Padding(0, 1),
		modalBox:     lipgloss.NewStyle().Border(lipgloss.DoubleBorder()).BorderForeground(lipgloss.Color("#FFD700")).Padding(1, 2).Background(lipgloss.Color("#1E1E2E")),
	}
	return s
}

// riskColors is the L0→L5 color ramp, generated via CIELAB blend (green→red).
var riskColors []color.Color

func init() {
	riskColors = blendColors(6, lipgloss.Color("#5DFF8F"), lipgloss.Color("#FF3B3B"))
}

// riskColor returns the TerminalColor for a risk level string ("L0".."L5").
func riskColor(level string) color.Color {
	switch level {
	case "L0":
		return riskColors[0]
	case "L1":
		return riskColors[1]
	case "L2":
		return riskColors[2]
	case "L3":
		return riskColors[3]
	case "L4":
		return riskColors[4]
	case "L5":
		return riskColors[5]
	default:
		return lipgloss.Color("#6C7086")
	}
}

// tokenSparkColors is the green→cyan gradient for token sparklines.
var tokenSparkColors []color.Color

func init() {
	tokenSparkColors = blendColors(8, lipgloss.Color("#5DFF8F"), lipgloss.Color("#56D4FF"))
}

// blendColors returns n evenly-spaced CIELAB-blended colors from c0 to c1.
func blendColors(n int, c0, c1 color.Color) []color.Color {
	if n <= 0 {
		return nil
	}
	if n == 1 {
		return []color.Color{c0}
	}
	stops := lipgloss.Blend1D(n, c0, c1)
	out := make([]color.Color, len(stops))
	copy(out, stops)
	return out
}
