package setupapp

import (
	"image/color"

	"charm.land/lipgloss/v2"
)

var (
	slateDark   = lipgloss.Color("#141413")
	ivoryLight  = lipgloss.Color("#FAF9F5")
	ivoryMedium = lipgloss.Color("#F0EEE6")
	ivoryDark   = lipgloss.Color("#E8E6DC")
	oat         = lipgloss.Color("#E3DACC")
	cloudMedium = lipgloss.Color("#B0AEA5")
	cloudLight  = lipgloss.Color("#D1CFC5")
	cloudDark   = lipgloss.Color("#87867F")
	slateMedium = lipgloss.Color("#3D3D3A")
	slateLight  = lipgloss.Color("#5E5D59")
	clay        = lipgloss.Color("#D97757")
	ember       = lipgloss.Color("#C6613F")
	olive       = lipgloss.Color("#788C5D")
	sky         = lipgloss.Color("#6A9BCC")
	fig         = lipgloss.Color("#C46686")
	cactus      = lipgloss.Color("#BCD1CA")
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
		title:        lipgloss.NewStyle().Bold(true).Foreground(ivoryLight),
		badge:        lipgloss.NewStyle().Foreground(ivoryLight).Padding(0, 1),
		muted:        lipgloss.NewStyle().Foreground(cloudMedium),
		meta:         lipgloss.NewStyle().Foreground(ivoryDark),
		panel:        lipgloss.NewStyle().Border(lipgloss.NormalBorder()).BorderForeground(slateLight).Padding(0, 1).Foreground(ivoryLight).Background(slateDark),
		help:         lipgloss.NewStyle().Foreground(cloudMedium),
		prompt:       lipgloss.NewStyle().Bold(true).Foreground(clay),
		composerBox:  lipgloss.NewStyle().Border(lipgloss.NormalBorder()).BorderForeground(clay).Padding(0, 1).Foreground(ivoryLight).Background(slateDark),
		modelFields:  lipgloss.NewStyle().Foreground(ivoryLight).Border(lipgloss.NormalBorder()).BorderForeground(slateLight).Padding(0, 1).Background(slateDark),
		sessionPanel: lipgloss.NewStyle().Foreground(ivoryLight).Border(lipgloss.NormalBorder()).BorderForeground(clay).Padding(0, 1).Background(slateDark),
		sectionTitle: lipgloss.NewStyle().Bold(true).Foreground(ivoryLight).Underline(true),
		status:       lipgloss.NewStyle().Foreground(cactus),
		warn:         lipgloss.NewStyle().Foreground(clay),
		errorStyle:   lipgloss.NewStyle().Foreground(clay).Border(lipgloss.NormalBorder()).BorderForeground(clay).Padding(0, 1).Background(slateDark),
		response:     lipgloss.NewStyle().Foreground(ivoryLight).Border(lipgloss.NormalBorder()).BorderForeground(slateLight).Padding(0, 1).Background(slateDark),
		result:       lipgloss.NewStyle().Foreground(ivoryLight).Border(lipgloss.NormalBorder()).BorderForeground(cactus).Padding(0, 1).Background(slateDark),
		streaming:    lipgloss.NewStyle().Foreground(clay),
		transcript:   lipgloss.NewStyle().Foreground(ivoryLight).Border(lipgloss.NormalBorder()).BorderForeground(slateLight).Padding(0, 1).Background(slateDark),
		overlay:      lipgloss.NewStyle().Foreground(ivoryLight).Border(lipgloss.NormalBorder()).BorderForeground(clay).Padding(0, 1).Background(slateDark),
		statusRule:   lipgloss.NewStyle().Foreground(ivoryLight).Background(slateDark).Padding(0, 1),
		treeBase:     lipgloss.NewStyle().Foreground(cloudMedium).Background(slateDark),
		treeCursor:   lipgloss.NewStyle().Bold(true).Foreground(clay),
		floatFocused: lipgloss.NewStyle().Border(lipgloss.ThickBorder()).BorderForeground(clay).Padding(0, 1).Foreground(ivoryLight).Background(slateDark),
		floatBlurred: lipgloss.NewStyle().Border(lipgloss.NormalBorder()).BorderForeground(slateLight).Padding(0, 1).Foreground(ivoryLight).Background(slateDark),
		modalBox:     lipgloss.NewStyle().Border(lipgloss.ThickBorder()).BorderForeground(clay).Padding(1, 2).Foreground(ivoryLight).Background(slateDark),
	}
	return s
}

// riskColors is the L0→L5 color ramp, generated via CIELAB blend (green→red).
var riskColors []color.Color

func init() {
	riskColors = []color.Color{cactus, olive, sky, clay, ember, fig}
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
		return cloudDark
	}
}

// tokenSparkColors is the green→cyan gradient for token sparklines.
var tokenSparkColors []color.Color

func init() {
	tokenSparkColors = blendColors(8, cloudMedium, ivoryLight)
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
