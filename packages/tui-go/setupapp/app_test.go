package setupapp

import (
	"image/color"
	"strings"
	"testing"

	"charm.land/lipgloss/v2"
)

func lipglossColor(hex string) color.Color {
	return lipgloss.Color(hex)
}

// testConfig builds a minimal Config for testing.
func testConfig() Config {
	return Config{
		Snapshot: Snapshot{
			WorkspaceRoot: ".",
			Summary:       Summary{Pass: 10, Warn: 0, Fail: 0},
			ReadinessLayers: ReadinessLayers{
				ToolchainReady: "yes",
				RepoReady:      "yes",
			},
		},
		ModelStatus: ModelStatus{
			ProviderName: "stub",
			ModelRef:     "stub-deterministic-v1",
		},
	}
}

// fakeRunner returns a canned CommandResult for deterministic testing.
func fakeRunner(stdout string) CommandRunner {
	return func(name string, args []string) CommandResult {
		return CommandResult{Stdout: stdout}
	}
}

func TestNewModelInitializesWorkbench(t *testing.T) {
	model := NewModel(testConfig())
	if model.toolsMode != true {
		t.Fatal("toolsMode should default to true")
	}
	if model.wm == nil {
		t.Fatal("window manager should be initialized")
	}
	if model.wm.hasModal() {
		t.Fatal("no modal should be open initially")
	}
	if len(model.transcript) == 0 {
		t.Fatal("transcript should have welcome entry")
	}
}

func TestStaticViewRendersWorkbench(t *testing.T) {
	model := NewModel(testConfig())
	view := model.StaticView()
	for _, want := range []string{
		"Aetherion",
		"CONVERSATION",
		"AGENT",
		"enter send",
	} {
		if !strings.Contains(view, want) {
			t.Fatalf("static view missing %q\n%s", want, view)
		}
	}
}

func TestSparklineRendersBlockChars(t *testing.T) {
	spark := Sparkline([]float64{0, 0.5, 1.0}, 0, 1.0, lipglossColor("#5DFF8F"), lipglossColor("#56D4FF"))
	if len(spark) == 0 {
		t.Fatal("sparkline should render non-empty")
	}
	// Should contain block characters.
	if !strings.ContainsAny(spark, "▁▂▃▄▅▆▇█") {
		t.Fatalf("sparkline missing block chars: %q", spark)
	}
}

func TestGaugeRendersCorrectFill(t *testing.T) {
	g := Gauge(0.5, 10, '█', '░', lipglossColor("#5DFF8F"), lipglossColor("#45475A"))
	if !strings.Contains(g, "50%") {
		t.Fatalf("gauge should show 50%%: %q", g)
	}
	if !strings.Contains(g, "█") {
		t.Fatalf("gauge should contain fill char: %q", g)
	}
}

func TestBarChartRendersBars(t *testing.T) {
	bars := []RiskBar{
		{"L0", 10, lipglossColor("#5DFF8F")},
		{"L3", 5, lipglossColor("#FFAE5D")},
	}
	chart := BarChart(bars, 20)
	if !strings.Contains(chart, "L0") || !strings.Contains(chart, "L3") {
		t.Fatalf("bar chart missing labels: %q", chart)
	}
	if !strings.Contains(chart, "█") {
		t.Fatalf("bar chart missing bars: %q", chart)
	}
}

func TestRiskBadgeRendersColoredLevel(t *testing.T) {
	badge := RiskBadge("L3")
	if !strings.Contains(badge, "L3") {
		t.Fatalf("risk badge should contain level: %q", badge)
	}
}

func TestWindowManagerOpenAndFocus(t *testing.T) {
	wm := newWindowManager()
	wm.open(winPolicy, "POLICY", "test content", 40, 20)
	if len(wm.windows) != 1 {
		t.Fatalf("expected 1 window, got %d", len(wm.windows))
	}
	if wm.focused == "" {
		t.Fatal("window should be focused after open")
	}
	// Opening same kind refreshes, not duplicates.
	wm.open(winPolicy, "POLICY", "updated content", 40, 20)
	if len(wm.windows) != 1 {
		t.Fatalf("expected 1 window after refresh, got %d", len(wm.windows))
	}
}

func TestWindowManagerCloseTop(t *testing.T) {
	wm := newWindowManager()
	wm.open(winPolicy, "POLICY", "content", 40, 20)
	wm.open(winLease, "LEASE", "content", 40, 20)
	if len(wm.windows) != 2 {
		t.Fatalf("expected 2 windows, got %d", len(wm.windows))
	}
	if !wm.closeTop() {
		t.Fatal("closeTop should close a window")
	}
	if len(wm.windows) != 1 {
		t.Fatalf("expected 1 window after close, got %d", len(wm.windows))
	}
}

func TestWindowManagerModalGrabsInput(t *testing.T) {
	wm := newWindowManager()
	if wm.hasModal() {
		t.Fatal("no modal initially")
	}
	wm.openModal("modal_test", "TEST", "content", 40, 10)
	if !wm.hasModal() {
		t.Fatal("modal should be open")
	}
	wm.closeModals()
	if wm.hasModal() {
		t.Fatal("modal should be closed")
	}
}

func TestWindowManagerDrag(t *testing.T) {
	wm := newWindowManager()
	wm.open(winPolicy, "POLICY", "content", 20, 10)
	// Position the window.
	wm.positionWindows(100, 50)
	win := wm.windows[0]
	origX := win.x
	origY := win.y
	// Start drag on title bar (y == win.y).
	if !wm.beginDrag(win.x, win.y) {
		t.Fatal("should start drag on title bar")
	}
	wm.dragMove(win.x+5, win.y+3, 100, 50)
	if win.x != origX+5 || win.y != origY+3 {
		t.Fatalf("window not dragged: orig=(%d,%d) new=(%d,%d)", origX, origY, win.x, win.y)
	}
	wm.endDrag()
}

func TestSlashCommandExit(t *testing.T) {
	model := NewModel(testConfig())
	model.composer.SetValue("/exit")
	cmd := model.startChat()
	if cmd == nil {
		t.Fatal("/exit should return a quit command")
	}
}

func TestSlashCommandConnectAppendsGuidance(t *testing.T) {
	model := NewModel(testConfig())
	model.composer.SetValue("/connect")
	_ = model.startChat()
	found := false
	for _, entry := range model.transcript {
		if entry.Meta == "connect" && strings.Contains(entry.Text, "Provider:") {
			found = true
		}
	}
	if !found {
		t.Fatalf("connect card not appended: %#v", model.transcript)
	}
}

func TestSlashCommandOpensFloatingWindow(t *testing.T) {
	model := NewModel(testConfig())
	model.composer.SetValue("/policy")
	_ = model.startChat()
	if len(model.wm.windows) != 1 {
		t.Fatalf("expected 1 floating window, got %d", len(model.wm.windows))
	}
	if model.wm.windows[0].kind != winPolicy {
		t.Fatalf("expected policy window, got %v", model.wm.windows[0].kind)
	}
}

func TestSlashCommandTreeExpand(t *testing.T) {
	model := NewModel(testConfig())
	expanded := model.treeExpanded
	model.composer.SetValue("/tree")
	_ = model.startChat()
	if model.treeExpanded == expanded {
		t.Fatal("/tree should toggle treeExpanded")
	}
}

func TestApplyLoopEventUpdatesCounters(t *testing.T) {
	model := NewModel(testConfig())
	model.applyLoopEvent(LoopEvent{Type: "loop_started", MaxLoopDepth: 10})
	if model.loopMaxDepth != 10 {
		t.Fatalf("loopMaxDepth=%d want 10", model.loopMaxDepth)
	}
	model.applyLoopEvent(LoopEvent{Type: "tool_result", ToolName: "local_file_read", Result: "data", Success: true})
	if model.loopToolCalls != 1 {
		t.Fatalf("loopToolCalls=%d want 1", model.loopToolCalls)
	}
}

func TestDecodeLoopEventParsesAllTypes(t *testing.T) {
	cases := []struct {
		line     string
		wantType string
	}{
		{`{"type":"loop_started","runId":"r1","maxLoopDepth":8}`, "loop_started"},
		{`{"type":"tool_proposal","proposal":{"proposalId":"p1","toolName":"local_file_write","riskLevel":"L3"}}`, "tool_proposal"},
		{`{"type":"loop_complete","totalToolCalls":2,"totalTokens":300}`, "loop_complete"},
	}
	for _, tc := range cases {
		event, ok := DecodeLoopEvent(tc.line)
		if !ok {
			t.Fatalf("expected ok decode for %s", tc.line)
		}
		if event.Type != tc.wantType {
			t.Fatalf("type=%s want=%s", event.Type, tc.wantType)
		}
	}
}

func TestEventAbbrev(t *testing.T) {
	cases := map[string]string{
		"run.started":           "run.st",
		"policy.decided":        "pol.✓",
		"lease.issued":          "les.is",
		"agent.model.responded": "mod.rs",
	}
	for full, abbrev := range cases {
		if got := eventAbbrev(full); got != abbrev {
			t.Fatalf("eventAbbrev(%s)=%s want %s", full, got, abbrev)
		}
	}
}

func TestExtractRiskLevel(t *testing.T) {
	if lvl := extractRiskLevel("risk L3 workspace write"); lvl != "L3" {
		t.Fatalf("expected L3, got %s", lvl)
	}
	if lvl := extractRiskLevel("no risk here"); lvl != "" {
		t.Fatalf("expected empty, got %s", lvl)
	}
}
