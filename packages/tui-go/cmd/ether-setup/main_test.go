package main

import (
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestOpenConfigInputUsesStdinWithoutPath(t *testing.T) {
	input, err := openConfigInput(nil, strings.NewReader("stdin-config"))
	if err != nil {
		t.Fatalf("open config input: %v", err)
	}
	if input.close != nil {
		t.Fatal("stdin input should not require close")
	}
	data, err := io.ReadAll(input.reader)
	if err != nil {
		t.Fatalf("read config input: %v", err)
	}
	if string(data) != "stdin-config" {
		t.Fatalf("stdin config = %q", string(data))
	}
}

func TestOpenConfigInputReadsPathArgument(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(path, []byte(`{"DefaultEntry":"ether"}`), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	input, err := openConfigInput([]string{path}, strings.NewReader("ignored"))
	if err != nil {
		t.Fatalf("open config input: %v", err)
	}
	if input.close == nil {
		t.Fatal("file input should expose close")
	}
	defer input.close()

	data, err := io.ReadAll(input.reader)
	if err != nil {
		t.Fatalf("read config input: %v", err)
	}
	if string(data) != `{"DefaultEntry":"ether"}` {
		t.Fatalf("file config = %q", string(data))
	}
}

func TestOpenConfigInputReportsMissingPath(t *testing.T) {
	_, err := openConfigInput([]string{filepath.Join(t.TempDir(), "missing.json")}, strings.NewReader("ignored"))
	if err == nil {
		t.Fatal("expected missing config path error")
	}
	if !strings.Contains(err.Error(), "open config") {
		t.Fatalf("missing path error = %v", err)
	}
}
