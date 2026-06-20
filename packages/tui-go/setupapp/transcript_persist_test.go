package setupapp

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSaveTranscriptWritesValidJSONArray(t *testing.T) {
	dir := t.TempDir()
	entries := []transcriptEntry{
		{Role: "user", Text: "hello", Meta: "stub / default"},
		{Role: "assistant", Text: "Hi there!", Meta: "assistant · 42 tok"},
	}
	if err := saveTranscript(dir, entries); err != nil {
		t.Fatalf("saveTranscript: %v", err)
	}
	path := filepath.Join(dir, ".aetherion", "transcript.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read file: %v", err)
	}
	if len(data) == 0 {
		t.Fatal("transcript file is empty")
	}
	loaded, err := loadTranscript(dir)
	if err != nil {
		t.Fatalf("loadTranscript: %v", err)
	}
	if len(loaded) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(loaded))
	}
	if loaded[0].Role != "user" || loaded[0].Text != "hello" {
		t.Errorf("entry 0 mismatch: %+v", loaded[0])
	}
	if loaded[1].Role != "assistant" || loaded[1].Text != "Hi there!" {
		t.Errorf("entry 1 mismatch: %+v", loaded[1])
	}
}

func TestLoadTranscriptReturnsEmptyWhenFileMissing(t *testing.T) {
	dir := t.TempDir()
	loaded, err := loadTranscript(dir)
	if err != nil {
		t.Fatalf("loadTranscript on missing file should not error: %v", err)
	}
	if len(loaded) != 0 {
		t.Fatalf("expected 0 entries for missing file, got %d", len(loaded))
	}
}

func TestLoadTranscriptSkipsMalformedEntries(t *testing.T) {
	dir := t.TempDir()
	transcriptDir := filepath.Join(dir, ".aetherion")
	if err := os.MkdirAll(transcriptDir, 0o755); err != nil {
		t.Fatal(err)
	}
	// Write an array where one entry has no role (malformed for our schema).
	content := `[
		{"role":"user","text":"ok","meta":""},
		{"text":"no role"},
		{"role":"assistant","text":"fine","meta":""}
	]`
	path := filepath.Join(transcriptDir, "transcript.json")
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	loaded, err := loadTranscript(dir)
	if err != nil {
		t.Fatalf("loadTranscript should skip malformed, not abort: %v", err)
	}
	if len(loaded) != 2 {
		t.Fatalf("expected 2 valid entries (malformed skipped), got %d", len(loaded))
	}
	if loaded[0].Role != "user" {
		t.Errorf("entry 0 role: got %q, want user", loaded[0].Role)
	}
	if loaded[1].Role != "assistant" {
		t.Errorf("entry 1 role: got %q, want assistant", loaded[1].Role)
	}
}

func TestNewModelLoadsTranscriptFromDisk(t *testing.T) {
	dir := t.TempDir()
	transcriptDir := filepath.Join(dir, ".aetherion")
	if err := os.MkdirAll(transcriptDir, 0o755); err != nil {
		t.Fatal(err)
	}
	content := `[{"role":"user","text":"persisted prompt","meta":"test"}]`
	path := filepath.Join(transcriptDir, "transcript.json")
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	cfg := Config{
		Snapshot: Snapshot{WorkspaceRoot: dir},
		ModelStatus: ModelStatus{
			ProviderName: "stub",
			ModelRef:     "stub-deterministic-v1",
		},
	}
	m := NewModel(cfg)
	if len(m.transcript) != 1 {
		t.Fatalf("expected 1 loaded entry, got %d (transcript=%+v)", len(m.transcript), m.transcript)
	}
	if m.transcript[0].Text != "persisted prompt" {
		t.Errorf("loaded text: got %q, want 'persisted prompt'", m.transcript[0].Text)
	}
}

func TestNewModelUsesDefaultIntroWhenFileMissing(t *testing.T) {
	dir := t.TempDir()
	cfg := Config{
		Snapshot: Snapshot{WorkspaceRoot: dir},
		ModelStatus: ModelStatus{
			ProviderName: "stub",
			ModelRef:     "stub-deterministic-v1",
		},
	}
	m := NewModel(cfg)
	if len(m.transcript) != 1 {
		t.Fatalf("expected default intro entry, got %d", len(m.transcript))
	}
	if m.transcript[0].Role != "intro" {
		t.Errorf("default role: got %q, want intro", m.transcript[0].Role)
	}
}
