package setupapp

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// handleRetrySlash resends the last user message.
func (m *Model) handleRetrySlash() {
	// Find last user message in transcript
	var lastUserText string
	for i := len(m.transcript) - 1; i >= 0; i-- {
		if m.transcript[i].Role == "user" {
			lastUserText = m.transcript[i].Text
			break
		}
	}
	if lastUserText == "" {
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "No previous message to retry.", Meta: "retry"})
		m.refreshTranscriptToBottom()
		m.statusMsg = "slash=/retry"
		return
	}
	m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "Retrying last message...", Meta: "retry"})
	m.refreshTranscriptToBottom()
	m.queue = append(m.queue, queuedPrompt{Task: lastUserText})
	m.statusMsg = "slash=/retry"
}

// handleCopySlash copies the last assistant reply to clipboard.
func (m *Model) handleCopySlash() {
	var lastAssistant string
	for i := len(m.transcript) - 1; i >= 0; i-- {
		if m.transcript[i].Role == "assistant" {
			lastAssistant = m.transcript[i].Text
			break
		}
	}
	if lastAssistant == "" {
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "No assistant reply to copy.", Meta: "copy"})
		m.refreshTranscriptToBottom()
		m.statusMsg = "slash=/copy"
		return
	}
	if err := copyToClipboard(lastAssistant); err != nil {
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: fmt.Sprintf("Copy failed: %v\n\n%s", err, truncateForDisplay(lastAssistant, 200)), Meta: "copy"})
	} else {
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "✓ Copied last reply to clipboard.", Meta: "copy"})
	}
	m.refreshTranscriptToBottom()
	m.statusMsg = "slash=/copy"
}

// handleCompactSlash shows context window usage info.
func (m *Model) handleCompactSlash() {
	text := fmt.Sprintf("Context Usage\n  tokens used: %d\n  turns: %d\n  tool calls: %d\n\nNo auto-compaction yet — start a /new session to reset context.",
		m.totalTokens(), m.turnCount(), len(m.tokenHistory))
	m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: text, Meta: "compact"})
	m.refreshTranscriptToBottom()
	m.statusMsg = "slash=/compact"
}

// handleDiffSlash shows uncommitted workspace changes via git diff.
func (m *Model) handleDiffSlash() {
	wsRoot := m.cfg.Snapshot.WorkspaceRoot
	cmd := exec.Command("git", "diff", "--stat")
	cmd.Dir = wsRoot
	output, err := cmd.Output()
	if err != nil {
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "No git changes (or not a git repo).", Meta: "diff"})
	} else {
		text := strings.TrimSpace(string(output))
		if text == "" {
			text = "Working tree clean — no uncommitted changes."
		}
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "Workspace Changes\n" + text, Meta: "diff"})
	}
	m.refreshTranscriptToBottom()
	m.statusMsg = "slash=/diff"
}

// handleHistorySlash shows recent transcript entries.
func (m *Model) handleHistorySlash() {
	var lines []string
	lines = append(lines, "Session History")
	count := 0
	startIdx := 0
	if len(m.transcript) > 20 {
		startIdx = len(m.transcript) - 20
	}
	for i := startIdx; i < len(m.transcript); i++ {
		entry := m.transcript[i]
		role := entry.Role
		text := truncateForDisplay(entry.Text, 80)
		lines = append(lines, fmt.Sprintf("  [%s] %s", role, text))
		count++
	}
	if count == 0 {
		lines = append(lines, "  (empty)")
	}
	m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: strings.Join(lines, "\n"), Meta: "history"})
	m.refreshTranscriptToBottom()
	m.statusMsg = "slash=/history"
}

// handleToolsSlash lists available tools.
func (m *Model) handleToolsSlash() {
	tools := []string{
		"local_file_read    Read a workspace file (L1, auto-approved)",
		"local_file_write   Write a workspace file (L3, approval required)",
		"shell_exec         Run a shell command (L4, approval required)",
		"web_fetch          Fetch URL content (L2, read-only)",
		"agent_spawn        Delegate to a child agent (L4, approval required)",
	}
	m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "Available Tools\n" + strings.Join(tools, "\n"), Meta: "tools"})
	m.refreshTranscriptToBottom()
	m.statusMsg = "slash=/tools"
}

// handleInitSlash bootstraps an AGENTS.md file if missing.
func (m *Model) handleInitSlash() {
	wsRoot := m.cfg.Snapshot.WorkspaceRoot
	agentsPath := filepath.Join(wsRoot, "AGENTS.md")
	if _, err := os.Stat(agentsPath); err == nil {
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "AGENTS.md already exists.", Meta: "init"})
		m.refreshTranscriptToBottom()
		m.statusMsg = "slash=/init"
		return
	}
	content := "# AGENTS.md\n\n## Project\n\nDescribe your project here.\n\n## Conventions\n\n- List coding conventions\n- Build/test commands\n- Architecture notes\n"
	if err := os.WriteFile(agentsPath, []byte(content), 0644); err != nil {
		m.transcript = append(m.transcript, transcriptEntry{Role: "error", Text: fmt.Sprintf("Failed to create AGENTS.md: %v", err), Meta: "init"})
	} else {
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "✓ Created AGENTS.md. Edit it to describe your project.", Meta: "init"})
	}
	m.refreshTranscriptToBottom()
	m.statusMsg = "slash=/init"
}

// handlePersonalitySlash sets the agent personality.
func (m *Model) handlePersonalitySlash(name string) {
	personalities := map[string]string{
		"concise":   "Be extremely concise. No pleasantries. Direct answers only.",
		"technical": "Be technical and precise. Use proper terminology. Show code when relevant.",
		"teacher":   "Explain concepts clearly. Use analogies. Anticipate confusion points.",
		"creative":  "Be creative and exploratory. Suggest unconventional approaches.",
		"default":   "Be helpful, knowledgeable, and direct.",
	}
	if name == "" {
		var keys []string
		for k := range personalities {
			keys = append(keys, k)
		}
		m.transcript = append(m.transcript, transcriptEntry{
			Role: "system",
			Text: fmt.Sprintf("Personalities: %s\n\nUsage: /personality <name>", strings.Join(keys, ", ")),
			Meta: "personality",
		})
	} else {
		desc, ok := personalities[name]
		if !ok {
			m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: fmt.Sprintf("Unknown personality: %s", name), Meta: "personality"})
		} else {
			m.personalityOverride = desc
			m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: fmt.Sprintf("✓ Personality set: %s", name), Meta: "personality"})
		}
	}
	m.refreshTranscriptToBottom()
	m.statusMsg = "slash=/personality"
}

// ── Helpers ─────────────────────────────────────────────────────────────

func copyToClipboard(text string) error {
	switch runtime.GOOS {
	case "darwin":
		cmd := exec.Command("pbcopy")
		cmd.Stdin = strings.NewReader(text)
		return cmd.Run()
	case "linux":
		cmd := exec.Command("xclip", "-selection", "clipboard")
		cmd.Stdin = strings.NewReader(text)
		return cmd.Run()
	default:
		return fmt.Errorf("clipboard not supported on %s", runtime.GOOS)
	}
}

func truncateForDisplay(s string, maxLen int) string {
	s = strings.ReplaceAll(s, "\n", " ")
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// totalTokens returns the cumulative token count from token history.
func (m Model) totalTokens() int {
	total := 0
	for _, s := range m.tokenHistory {
		total += s.Input + s.Output
	}
	return total
}

// turnCount is derived from token history length.
func (m Model) turnCount() int {
	return len(m.tokenHistory)
}
