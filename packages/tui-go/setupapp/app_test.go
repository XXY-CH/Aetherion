package setupapp

import (
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"
)

func TestStaticViewRendersOperatorPanels(t *testing.T) {
	model := NewModel(testConfig())
	view := model.StaticView()

	for _, want := range []string{
		"Ether Operator Console",
		"Bubble Tea/Bubbles",
		"command=setup",
		"scope=read_only",
		"mutates_workspace=false",
		"Runs",
		"Timeline",
		"Approvals",
		"Context",
		"Replay / Debug",
		"operator-restated file read",
		"fresh supervisor policy",
	} {
		if !strings.Contains(view, want) {
			t.Fatalf("static view missing %q\n%s", want, view)
		}
	}
}

func TestKeyboardNavigationSelectsPanels(t *testing.T) {
	model := NewModel(testConfig())
	updated, _ := model.Update(keyPress("down"))
	model = updated.(Model)
	if model.selected != panelTimeline {
		t.Fatalf("expected timeline panel, got %v", model.selected)
	}

	updated, _ = model.Update(keyPress("tab"))
	model = updated.(Model)
	if model.selected != panelApprovals {
		t.Fatalf("expected approvals panel, got %v", model.selected)
	}

	updated, _ = model.Update(keyPress("?"))
	model = updated.(Model)
	if !model.help.ShowAll {
		t.Fatal("expected full help to be visible")
	}
}

func TestDecodeConfigAcceptsJSONConfig(t *testing.T) {
	cfg, err := DecodeConfig(strings.NewReader(testConfigJSON()))
	if err != nil {
		t.Fatalf("decode config: %v", err)
	}
	if !cfg.NonInteractive {
		t.Fatal("expected non-interactive config")
	}
	if cfg.Snapshot.WorkspaceRoot != "/repo" {
		t.Fatalf("workspace root = %q", cfg.Snapshot.WorkspaceRoot)
	}
	if !strings.Contains(cfg.LLMReadLoopCommand, "fresh supervisor policy") {
		t.Fatalf("missing LLM read loop: %q", cfg.LLMReadLoopCommand)
	}
}

func testConfig() Config {
	return Config{
		Snapshot: Snapshot{
			ID:            "aetherion_onboarding_preflight_report",
			RepoRoot:      "/repo",
			WorkspaceRoot: "/repo",
			Status:        "ready",
			Summary:       Summary{Pass: 4},
			ReadinessLayers: ReadinessLayers{
				ToolchainReady:   "ready",
				RepoReady:        "ready",
				WorkspaceRuntime: "not_initialized",
				NextStepsReady:   true,
			},
			SourceDocuments: []SourceDoc{{Path: "docs/00-product-brief.md", Role: "V1 TUI-first"}},
			Deferred:        []string{"GUI", "IM delivery"},
		},
		DefaultEntry:       "ether",
		OnboardingCommand:  "npm run ether -- onboarding check --workspace '/repo'",
		DoctorCommand:      "npm run ether -- doctor --workspace '/repo'",
		SecurityCommand:    "npm run ether -- security audit --workspace '/repo'",
		ReleaseCommand:     "npm run ether -- release evidence --workspace '/repo'",
		RunCommand:         "npm run ether -- run --workspace '/repo' --input README.md --output .aetherion/SUMMARY.md --approve-write",
		LLMReadLoopCommand: "next slice: prompt invoke-model -> response audit -> operator-restated file read -> fresh supervisor policy",
		DirectEntry:        "ether --workspace '/repo'",
		PackageEntry:       "npm run ether -- --workspace '/repo'",
	}
}

func testConfigJSON() string {
	return `{
		"Snapshot": {
			"id": "aetherion_onboarding_preflight_report",
			"repo_root": "/repo",
			"workspace_root": "/repo",
			"status": "ready",
			"summary": { "pass": 4, "warn": 0, "fail": 0, "not_applicable": 0 },
			"readiness_layers": {
				"toolchain_ready": "ready",
				"repo_ready": "ready",
				"workspace_runtime_state": "not_initialized",
				"next_steps_ready": true
			}
		},
		"NonInteractive": true,
		"DefaultEntry": "ether",
		"LLMReadLoopCommand": "next slice: prompt invoke-model -> response audit -> operator-restated file read -> fresh supervisor policy"
	}`
}

func keyPress(value string) tea.KeyPressMsg {
	switch value {
	case "down":
		return tea.KeyPressMsg(tea.Key{Code: tea.KeyDown})
	case "tab":
		return tea.KeyPressMsg(tea.Key{Code: tea.KeyTab})
	default:
		return tea.KeyPressMsg(tea.Key{Text: value, Code: []rune(value)[0]})
	}
}
