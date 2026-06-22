package setupapp

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Provider helpers — mirror the TS credentialEnvRefsForProvider mapping.

func supportedProviders() []string {
	return []string{"stub", "openai_responses", "openai_chat_completions", "anthropic", "gemini"}
}

func defaultModelForProvider(provider string) string {
	switch canonicalProvider(provider) {
	case "openai_responses", "openai_chat_completions":
		return "gpt-4o"
	case "anthropic":
		return "claude-sonnet-4-20250514"
	case "gemini":
		return "gemini-2.0-flash"
	default:
		return "stub-deterministic-v1"
	}
}

func providerCredentialEnv(provider string) []string {
	switch canonicalProvider(provider) {
	case "openai_responses", "openai_chat_completions":
		return []string{"OPENAI_API_KEY", "OPENAI_OAUTH_ACCESS_TOKEN"}
	case "anthropic":
		return []string{"ANTHROPIC_API_KEY"}
	case "gemini":
		return []string{"GEMINI_API_KEY", "GOOGLE_API_KEY", "GEMINI_OAUTH_ACCESS_TOKEN", "GOOGLE_OAUTH_ACCESS_TOKEN"}
	default:
		return nil
	}
}

func canonicalProvider(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.ReplaceAll(normalized, "-", "_")
	normalized = strings.ReplaceAll(normalized, " ", "_")
	switch normalized {
	case "openai", "openai_response", "openai_responses", "responses":
		return "openai_responses"
	case "openai_chat", "openai_chat_completion", "openai_chat_completions",
		"openai_completion", "openai_completions", "chat_completions":
		return "openai_chat_completions"
	case "google", "google_gemini", "gemini_generate_content":
		return "gemini"
	default:
		return normalized
	}
}

func credentialPresent(provider string) bool {
	if canonicalProvider(provider) == "stub" {
		return true
	}
	for _, name := range providerCredentialEnv(provider) {
		if v := os.Getenv(name); strings.TrimSpace(v) != "" {
			return true
		}
	}
	return false
}

// connectGuidance renders the /connect onboarding card text.
func connectGuidance(provider, modelRef string) string {
	prov := canonicalProvider(emptyAs(provider, "stub"))
	var lines []string
	lines = append(lines, fmt.Sprintf("Provider: %s", emptyAs(provider, "stub")))
	lines = append(lines, fmt.Sprintf("Model: %s", emptyAs(modelRef, "stub-deterministic-v1")))

	if prov == "stub" {
		lines = append(lines, "")
		lines = append(lines, "The stub provider works offline with no credential.")
		lines = append(lines, "To use a real model, set a provider and its key:")
		lines = append(lines, "  /model openai_chat_completions   then /connect")
		lines = append(lines, "")
		lines = append(lines, "Supported providers: stub, openai_responses, openai_chat_completions, anthropic, gemini")
		return strings.Join(lines, "\n")
	}

	envVars := providerCredentialEnv(prov)
	missing := []string{}
	present := []string{}
	for _, name := range envVars {
		if v := os.Getenv(name); strings.TrimSpace(v) != "" {
			present = append(present, name)
		} else {
			missing = append(missing, name)
		}
	}
	lines = append(lines, "")
	if len(present) > 0 {
		lines = append(lines, fmt.Sprintf("✓ credential present: %s (value never shown or stored)", strings.Join(present, ", ")))
	} else {
		lines = append(lines, fmt.Sprintf("✗ no credential found for %s", prov))
	}
	if len(missing) > 0 {
		lines = append(lines, "")
		lines = append(lines, "Set one of these in your shell, then restart the TUI:")
		for _, name := range missing {
			lines = append(lines, fmt.Sprintf("  export %s=<your-key>", name))
		}
		lines = append(lines, "")
		lines = append(lines, "Aetherion reads credentials from the environment only — it never persists them.")
	}
	return strings.Join(lines, "\n")
}

// String utilities.

func emptyAs(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func boolAs(value bool, whenTrue, whenFalse string) string {
	if value {
		return whenTrue
	}
	return whenFalse
}

func compactPath(path string, maxLen int) string {
	if len(path) <= maxLen {
		return path
	}
	half := maxLen / 2
	if half < 3 {
		return path[:maxLen]
	}
	return path[:half] + "…" + path[len(path)-half:]
}

func shortPath(path string) string {
	if len(path) <= 48 {
		return path
	}
	return "…" + path[len(path)-47:]
}

func previewResult(result string) string {
	if len(result) <= 240 {
		return result
	}
	return result[:240] + "\n…[truncated]"
}

func centerText(text string, width int) string {
	if width <= len(text) {
		return text
	}
	pad := (width - len(text)) / 2
	return strings.Repeat(" ", pad) + text
}

func stripANSI(s string) string {
	// Minimal ANSI escape stripper for non-interactive (piped) rendering.
	var b strings.Builder
	inEsc := false
	for _, r := range s {
		if r == '\x1b' {
			inEsc = true
			continue
		}
		if inEsc {
			if r == 'm' || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
				inEsc = false
			}
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

// countLines returns the number of rendered lines in a (possibly styled)
// string, counting newlines. Used to measure a lipgloss-rendered card's actual
// row footprint since .Height() on a bordered panel does not always yield an
// exact cell count.
func countLines(s string) int {
	if s == "" {
		return 0
	}
	return strings.Count(s, "\n") + 1
}

// --- Ledger reader (parses .aetherion/events/events.jsonl) ---

type ledgerEvent struct {
	ID        string `json:"id"`
	RunID     string `json:"run_id"`
	EventType string `json:"event_type"`
	Actor     struct {
		Type string `json:"type"`
		ID   string `json:"id"`
	} `json:"actor"`
	Summary     string `json:"summary"`
	Timestamp   string `json:"timestamp"`
	EventHash   string `json:"event_hash"`
	ParentID    string `json:"parent_event_id"`
	ParentHash  string `json:"parent_event_hash"`
	PayloadRef  string `json:"payload_ref"`
	Sensitivity string `json:"sensitivity"`
}

// readLedgerEvents reads the workspace's events.jsonl tail (up to limit events).
func readLedgerEvents(workspaceRoot string, limit int) []ledgerEvent {
	path := filepath.Join(workspaceRoot, ".aetherion", "events", "events.jsonl")
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	var all []ledgerEvent
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var evt ledgerEvent
		if err := json.Unmarshal([]byte(line), &evt); err != nil {
			continue
		}
		all = append(all, evt)
	}
	if limit > 0 && len(all) > limit {
		all = all[len(all)-limit:]
	}
	return all
}

// readRegistry reads a JSON-array registry file (checkpoints/branches/etc).
func readRegistry(workspaceRoot, name string) []map[string]interface{} {
	path := filepath.Join(workspaceRoot, ".aetherion", "registries", name+".json")
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	var items []map[string]interface{}
	if err := json.NewDecoder(f).Decode(&items); err != nil {
		return nil
	}
	return items
}

// checkpointEventIDs returns the set of event IDs that have checkpoints.
func checkpointEventIDs(workspaceRoot string) map[string]bool {
	items := readRegistry(workspaceRoot, "checkpoints")
	out := make(map[string]bool, len(items))
	for _, item := range items {
		if id, ok := item["event_id"].(string); ok {
			out[id] = true
		}
	}
	return out
}

// branchInfo holds minimal branch info for the git-tree.
type branchInfo struct {
	SourceEventID string
	HeadEventID   string
	Status        string
	ID            string
}

// readBranches returns the branch labels pinned to trunk events.
func readBranches(workspaceRoot string) []branchInfo {
	items := readRegistry(workspaceRoot, "branches")
	var out []branchInfo
	for _, item := range items {
		bi := branchInfo{
			Status: getString(item, "status"),
			ID:     getString(item, "id"),
		}
		bi.SourceEventID = getString(item, "source_event_id")
		bi.HeadEventID = getString(item, "head_event_id")
		out = append(out, bi)
	}
	return out
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}
