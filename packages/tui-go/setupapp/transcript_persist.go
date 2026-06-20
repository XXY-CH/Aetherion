package setupapp

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// transcriptFilePath returns the path to the persisted transcript for a workspace.
func transcriptFilePath(workspaceRoot string) string {
	return filepath.Join(workspaceRoot, ".aetherion", "transcript.json")
}

// saveTranscript writes the transcript entries as a JSON array to
// <workspaceRoot>/.aetherion/transcript.json. Creates the directory if needed.
func saveTranscript(workspaceRoot string, entries []transcriptEntry) error {
	path := transcriptFilePath(workspaceRoot)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.Marshal(entries)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

// loadTranscript reads the persisted transcript from disk. Returns an empty
// slice (not nil) when the file does not exist. Malformed entries (missing
// role) are skipped rather than aborting the load.
func loadTranscript(workspaceRoot string) ([]transcriptEntry, error) {
	path := transcriptFilePath(workspaceRoot)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []transcriptEntry{}, nil
		}
		return nil, err
	}
	var raw []transcriptEntry
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	// Filter out entries without a role — they are malformed for our schema.
	out := make([]transcriptEntry, 0, len(raw))
	for _, e := range raw {
		if e.Role != "" {
			out = append(out, e)
		}
	}
	return out, nil
}

// persistTranscript saves the current transcript to disk. Called after every
// transcript mutation. Errors are silently ignored — persistence is best-effort
// and must never break the TUI loop.
func (m *Model) persistTranscript() {
	_ = saveTranscript(m.workspaceRoot(), m.transcript)
}
