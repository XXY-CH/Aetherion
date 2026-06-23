package setupapp

import (
	"regexp"
	"strings"

	"charm.land/lipgloss/v2"
)

// toolBlock renders a tool transcript entry as a compact, scannable block
// (gap 3 from docs/19): a fixed-width icon column + tool name + path, with the
// result meta shown compactly. This replaces the flat "🔧 name(path)" line with
// the icon-per-verb idiom from OpenCode (InlineTool) and the bullet idiom from
// Hermes (ToolTrail).
//
// Icons by verb (OpenCode mapping):
//
//	→  read      (local_file_read)
//	←  write     (local_file_write, file_edit)
//	$  exec      (shell_exec)
//	✱  search    (search_files, list_files)
//	%  fetch     (web_fetch)
//	⚡  spawn     (agent_spawn)

// toolBlockRegex parses the stored tool text "🔧 <name>(<path>)" or the
// legacy "<name> <path>" form. Path is optional.
var toolBlockRegex = regexp.MustCompile(`^(?:🔧\s*)?([a-z_]+)(?:\(([^)]*)\))?(?:\s+(.*))?$`)

func toolIcon(toolName string) string {
	switch {
	case strings.Contains(toolName, "read"):
		return "→"
	case strings.Contains(toolName, "write"), strings.Contains(toolName, "edit"):
		return "←"
	case strings.Contains(toolName, "exec"), strings.Contains(toolName, "shell"):
		return "$"
	case strings.Contains(toolName, "search"), strings.Contains(toolName, "list"):
		return "✱"
	case strings.Contains(toolName, "fetch"), strings.Contains(toolName, "web"):
		return "%"
	case strings.Contains(toolName, "spawn"), strings.Contains(toolName, "agent"):
		return "⚡"
	default:
		return "⚙"
	}
}

// renderToolBlock parses a tool transcript entry's text and renders it as a
// compact icon + name + path block with the meta (result/denied) appended.
func renderToolBlock(entry transcriptEntry) string {
	theme := styles()
	name, path, extra := parseToolText(entry.Text)
	icon := toolIcon(name)

	// Icon column: fixed-width 2 (icon + space), tinted by the tool color (sky).
	iconStyled := lipgloss.NewStyle().Foreground(sky).Bold(true).Render(icon + " ")
	nameStyled := lipgloss.NewStyle().Foreground(ivoryLight).Render(name)
	// Path (and any extra) in muted, trailing.
	pathPart := ""
	if path != "" {
		pathPart = " " + theme.muted.Render(path)
	}
	if extra != "" {
		pathPart += " " + theme.muted.Render(extra)
	}
	// Result meta appended after a dot separator, tinted by status.
	metaPart := ""
	if entry.Meta != "" {
		metaColor := cloudMedium
		switch entry.Meta {
		case "result", "ok", "success":
			metaColor = olive // muted green for success
		case "denied", "error", "failed":
			metaColor = ember
		}
		metaPart = " · " + lipgloss.NewStyle().Foreground(metaColor).Render(entry.Meta)
	}
	body := iconStyled + nameStyled + pathPart + metaPart

	// Wrap in a left-bordered callout (OpenCode BlockTool style) so the tool
	// block reads as a unit distinct from prose.
	contentStyle := lipgloss.NewStyle().
		PaddingLeft(1).
		BorderLeft(true).
		BorderForeground(sky).
		Foreground(ivoryLight)
	return contentStyle.Render(body) + "\n"
}

// parseToolText extracts (toolName, path, extra) from a tool transcript entry's
// text. Handles the "🔧 name(path)" canonical form and the legacy "name path"
// form. Returns empty strings for missing fields.
func parseToolText(text string) (name, path, extra string) {
	text = strings.TrimSpace(text)
	m := toolBlockRegex.FindStringSubmatch(text)
	if m == nil {
		return text, "", ""
	}
	name = m[1]
	path = m[2]
	extra = m[3]
	return name, path, extra
}
