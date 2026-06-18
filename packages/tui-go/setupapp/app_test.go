package setupapp

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"
)

func TestStaticViewRendersInteractiveOperatorPanels(t *testing.T) {
	model := NewModel(testConfig())
	view := model.StaticView()

	for _, want := range []string{
		"AETHERION",
		"Local-first agent harness",
		"provider stub",
		"tools on",
		"enter send",
		"/connect",
		"ctrl+b sidebar",
		"ctrl+c quit",
	} {
		if !strings.Contains(view, want) {
			t.Fatalf("static view missing %q\n%s", want, view)
		}
	}
}

func TestChatPanelRendersComposerTranscriptAndSlashOverlay(t *testing.T) {
	model := NewModel(testConfig())
	model.selected = panelChat
	model.focus = focusComposer
	model.menu.Select(int(panelChat))
	model.applyFocus()
	model.composer.SetValue("/he")
	view := model.StaticView()

	for _, want := range []string{
		"Slash Commands",
		"completions",
		"❯ /he",
		"/help",
		"Show available commands",
	} {
		if !strings.Contains(view, want) {
			t.Fatalf("chat view missing %q\n%s", want, view)
		}
	}

	teaView := model.View()
	if !teaView.AltScreen {
		t.Fatal("expected alternate-screen terminal view")
	}
	if teaView.MouseMode != tea.MouseModeCellMotion {
		t.Fatalf("mouse mode = %v", teaView.MouseMode)
	}
	if !teaView.ReportFocus {
		t.Fatal("expected focus reporting enabled")
	}
}

func TestSlashOverlayListsAllCommandsForBareSlash(t *testing.T) {
	model := NewModel(testConfig())
	model.composer.SetValue("/")
	view := model.StaticView()
	for _, want := range []string{"/help", "/settings", "/sessions", "/queue", "/status"} {
		if !strings.Contains(view, want) {
			t.Fatalf("slash view missing %q\n%s", want, view)
		}
	}
}

func TestSlashOverlayDoesNotPushComposer(t *testing.T) {
	model := NewModel(testConfig())
	model.composer.SetValue("before")
	baseline := model.StaticView()
	baseLine := lineIndexContaining(baseline, "❯ before")
	if baseLine < 0 {
		t.Fatalf("baseline missing composer\n%s", baseline)
	}

	model.composer.SetValue("/he")
	view := model.StaticView()
	overlayLine := lineIndexContaining(view, "❯ /he")
	if overlayLine != baseLine {
		t.Fatalf("overlay pushed composer: baseline=%d overlay=%d\n%s", baseLine, overlayLine, view)
	}
	if !strings.Contains(view, "Slash Commands") {
		t.Fatalf("missing slash overlay\n%s", view)
	}
}

func TestTranscriptScrollAndComposerSizing(t *testing.T) {
	model := NewModel(testConfig())
	model.transcript = []transcriptEntry{{Role: "intro", Text: "Aetherion Agent", Meta: "session panel"}}
	for i := 0; i < 20; i++ {
		model.transcript = append(model.transcript, transcriptEntry{Role: "assistant", Text: strings.Repeat("line ", 20)})
	}
	model.resize()

	if model.composer.Height() < 4 {
		t.Fatalf("composer height too small: %d", model.composer.Height())
	}
	model.transcriptVP.GotoTop()
	start := model.transcriptVP.YOffset()
	updated, _ := model.Update(keyPress("pgdown"))
	model = updated.(Model)
	if model.transcriptVP.YOffset() <= start {
		t.Fatalf("expected page down to move transcript, got %d -> %d", start, model.transcriptVP.YOffset())
	}
	updated, _ = model.Update(keyPress("home"))
	model = updated.(Model)
	if model.transcriptVP.YOffset() != 0 {
		t.Fatalf("expected home to return to top, got %d", model.transcriptVP.YOffset())
	}
}

func TestTranscriptAppendPreservesManualScroll(t *testing.T) {
	model := NewModel(testConfig())
	model.transcript = []transcriptEntry{{Role: "intro", Text: "Aetherion Agent", Meta: "session panel"}}
	for i := 0; i < 28; i++ {
		model.transcript = append(model.transcript, transcriptEntry{Role: "assistant", Text: strings.Repeat("history ", 18), Meta: "fixture"})
	}
	model.resize()
	model.transcriptVP.GotoTop()
	start := model.transcriptVP.YOffset()

	model.chatBusy = true
	model.activePrompt = "background prompt"
	payload, _ := json.Marshal(ChatResult{
		SourceRunID:                 "run_model_chat_source_test",
		ResponseID:                  "agent_model_response_test",
		ResponseAuditID:             "agent_response_audit_test",
		ProviderRef:                 "provider_local_stub",
		ModelRef:                    "stub-deterministic-v1",
		RawOutputPrinted:            true,
		OutputText:                  "new response while reading history",
		OutputTextSHA256:            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		ResponsePayloadSHA256:       "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		ResponseAuditEvidenceStatus: "matched",
		ResponseAuditStatus:         "pass",
	})
	var result ChatResult
	if err := json.Unmarshal(payload, &result); err != nil {
		t.Fatalf("fixture decode: %v", err)
	}
	updated, _ := model.Update(chatFinishedMsg{result: result})
	model = updated.(Model)

	if got := model.transcriptVP.YOffset(); got != start {
		t.Fatalf("append stole manual scroll: got %d want %d", got, start)
	}
	if model.transcriptUnread == 0 {
		t.Fatalf("expected unread count after preserved append")
	}
	if !strings.Contains(model.StaticView(), "unread 1") {
		t.Fatalf("status missing unread marker\n%s", model.StaticView())
	}

	updated, _ = model.Update(keyPress("end"))
	model = updated.(Model)
	if !model.transcriptVP.AtBottom() {
		t.Fatal("expected end to jump to bottom")
	}
	if model.transcriptUnread != 0 {
		t.Fatalf("expected unread cleared at bottom, got %d", model.transcriptUnread)
	}
}

func lineIndexContaining(value, needle string) int {
	for i, line := range strings.Split(value, "\n") {
		if strings.Contains(line, needle) {
			return i
		}
	}
	return -1
}

func TestKeyboardNavigationFocusesSettingsAndCyclesProvider(t *testing.T) {
	model := NewModel(testConfig())
	model.selected = panelChat
	if model.focus != focusComposer || !model.composer.Focused() {
		t.Fatalf("expected composer focus, got focus=%v", model.focus)
	}

	updated, _ := model.Update(keyPress("ctrl+k"))
	model = updated.(Model)
	if model.overlay != overlayPalette {
		t.Fatalf("expected palette overlay, got %v", model.overlay)
	}

	updated, _ = model.Update(keyPress("esc"))
	model = updated.(Model)
	if model.focus != focusComposer {
		t.Fatalf("expected composer focus, got %v", model.focus)
	}

	model.composer.SetValue("/settings")
	updated, _ = model.Update(keyPress("enter"))
	model = updated.(Model)
	if model.overlay != overlayModel {
		t.Fatalf("expected model overlay, got %v", model.overlay)
	}
	updated, _ = model.Update(keyPress("right"))
	model = updated.(Model)
	if model.providerInput.Value() != "openai_responses" {
		t.Fatalf("provider = %q", model.providerInput.Value())
	}
	if model.modelInput.Value() != "gpt-5.4" {
		t.Fatalf("model = %q", model.modelInput.Value())
	}
}

func TestBusyChatQueuesAndDrainsNextPrompt(t *testing.T) {
	var calls []string
	runner := func(_ string, args []string) CommandResult {
		for i := 0; i < len(args)-1; i++ {
			if args[i] == "--content" {
				calls = append(calls, args[i+1])
			}
		}
		payload, _ := json.Marshal(ChatResult{
			SourceRunID:                 "run_model_chat_source_test",
			ResponseID:                  "agent_model_response_test",
			ResponseAuditID:             "agent_response_audit_test",
			ProviderRef:                 "provider_local_stub",
			ModelRef:                    "stub-deterministic-v1",
			RawOutputPrinted:            true,
			OutputText:                  "## Evidence Summary\nStub response.\n",
			OutputTextSHA256:            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			ResponsePayloadSHA256:       "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			ResponseAuditEvidenceStatus: "matched",
			ResponseAuditStatus:         "pass",
		})
		return CommandResult{Stdout: string(payload)}
	}

	model := NewModelWithRunner(testConfig(), runner)
	model.toolsMode = false
	model.composer.SetValue("first prompt")
	cmd := model.startChat()
	if cmd == nil {
		t.Fatal("expected first chat command")
	}
	model.composer.SetValue("second prompt")
	if queued := model.startChat(); queued != nil {
		t.Fatal("busy chat should queue, not start a second command immediately")
	}
	if len(model.queue) != 1 || model.overlay != overlayQueue {
		t.Fatalf("queue=%#v overlay=%v", model.queue, model.overlay)
	}

	msg := cmd().(chatFinishedMsg)
	updated, nextCmd := model.Update(msg)
	model = updated.(Model)
	if nextCmd == nil {
		t.Fatal("expected queued prompt to drain")
	}
	_ = nextCmd()
	if len(calls) != 2 || calls[0] != "first prompt" || calls[1] != "second prompt" {
		t.Fatalf("calls=%#v", calls)
	}
}

func TestComposerHistoryRestoresDraft(t *testing.T) {
	model := NewModel(testConfig())
	model.transcript = append(model.transcript,
		transcriptEntry{Role: "user", Text: "first prompt"},
		transcriptEntry{Role: "assistant", Text: "answer"},
		transcriptEntry{Role: "user", Text: "second prompt"},
	)
	model.composer.SetValue("draft now")

	updated, _ := model.Update(keyPress("up"))
	model = updated.(Model)
	if got := strings.TrimSpace(model.composer.Value()); got != "second prompt" {
		t.Fatalf("history up = %q", got)
	}
	updated, _ = model.Update(keyPress("down"))
	model = updated.(Model)
	if got := strings.TrimSpace(model.composer.Value()); got != "draft now" {
		t.Fatalf("history restored = %q", got)
	}
}

func TestCommandPaletteOverlay(t *testing.T) {
	model := NewModel(testConfig())
	updated, _ := model.Update(keyPress("ctrl+k"))
	model = updated.(Model)
	view := model.StaticView()
	for _, want := range []string{"Command Palette", "/sessions", "/model", "/connect"} {
		if !strings.Contains(view, want) {
			t.Fatalf("palette view missing %q\n%s", want, view)
		}
	}
}

func TestChatSubmitRunsModelChatCommand(t *testing.T) {
	var gotName string
	var gotArgs []string
	runner := func(name string, args []string) CommandResult {
		gotName = name
		gotArgs = append([]string(nil), args...)
		payload, _ := json.Marshal(ChatResult{
			SourceRunID:                 "run_model_chat_source_test",
			SourceRunCreated:            true,
			InvocationID:                "agent_runtime_invocation_test",
			RequestID:                   "agent_model_request_test",
			ResponseID:                  "agent_model_response_test",
			ResponseAuditID:             "agent_response_audit_test",
			ProviderRef:                 "provider_local_stub",
			ModelRef:                    "stub-deterministic-v1",
			RawOutputPrinted:            true,
			OutputText:                  "## Evidence Summary\nStub response.\n",
			OutputTextSHA256:            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			ResponsePayloadSHA256:       "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			ResponseAuditEvidenceStatus: "matched",
			ResponseAuditRequired:       true,
			ResponseAuditStatus:         "pass",
		})
		return CommandResult{Stdout: string(payload)}
	}

	model := NewModelWithRunner(testConfig(), runner)
	model.toolsMode = false
	model.selected = panelChat
	model.menu.Select(int(panelChat))
	model.composer.SetValue("Draft a local implementation plan.")
	cmd := model.startChat()
	if cmd == nil {
		t.Fatal("expected chat command")
	}
	msg := cmd().(chatFinishedMsg)
	updated, _ := model.Update(msg)
	model = updated.(Model)

	if gotName != "node" {
		t.Fatalf("command name = %q", gotName)
	}
	assertArgsContain(t, gotArgs, "packages/tui/src/cli.ts", "model", "chat", "--workspace", "/repo", "--content", "Draft a local implementation plan.", "--model-provider", "stub", "--model", "stub-deterministic-v1")
	if model.chatResult == nil {
		t.Fatal("expected chat result")
	}
	if model.chatResult.ResponseAuditStatus != "pass" {
		t.Fatalf("audit status = %q", model.chatResult.ResponseAuditStatus)
	}
	if model.chatBusy {
		t.Fatal("chat should not be busy after result")
	}
	view := model.StaticView()
	if !strings.Contains(view, "provider_local_stub") || !strings.Contains(view, "Stub response") {
		t.Fatalf("view missing chat result\n%s", view)
	}
}

func TestChatSubmitReportsRunnerError(t *testing.T) {
	runner := func(string, []string) CommandResult {
		return CommandResult{Stderr: "missing credential", Err: errors.New("exit status 1")}
	}
	model := NewModelWithRunner(testConfig(), runner)
	model.toolsMode = false
	model.selected = panelChat
	model.composer.SetValue("Use a live provider.")
	cmd := model.startChat()
	msg := cmd().(chatFinishedMsg)
	updated, _ := model.Update(msg)
	model = updated.(Model)

	if model.chatError == "" {
		t.Fatal("expected chat error")
	}
	if !strings.Contains(model.StaticView(), "missing credential") {
		t.Fatalf("view missing error\n%s", model.StaticView())
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
	if cfg.ModelStatus.ProviderName != "stub" {
		t.Fatalf("provider = %q", cfg.ModelStatus.ProviderName)
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
		LLMReadLoopCommand: "npm run ether -- model chat --workspace '/repo' --content <task> --model-provider stub --model stub-deterministic-v1",
		ModelStatus: ModelStatus{
			SchemaVersion:                  "aetherion-ether-model-status-v1",
			ProviderName:                   "stub",
			ProviderRef:                    "provider_local_stub",
			ModelRef:                       "stub-deterministic-v1",
			NetworkCapable:                 false,
			CredentialResolved:             true,
			CredentialSource:               "not_required",
			RawSecretPersisted:             false,
			SettingsPersisted:              false,
			ToolsAllowed:                   false,
			RuntimeAuthorityGranted:        false,
			ModelOutputCanAuthorizeActions: false,
		},
		DirectEntry:  "ether --workspace '/repo'",
		PackageEntry: "npm run ether -- --workspace '/repo'",
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
		"ModelStatus": {
			"schema_version": "aetherion-ether-model-status-v1",
			"provider_name": "stub",
			"provider_ref": "provider_local_stub",
			"model_ref": "stub-deterministic-v1",
			"credential_resolved": true
		}
	}`
}

func keyPress(value string) tea.KeyPressMsg {
	switch value {
	case "down":
		return tea.KeyPressMsg(tea.Key{Code: tea.KeyDown})
	case "tab":
		return tea.KeyPressMsg(tea.Key{Code: tea.KeyTab})
	case "enter":
		return tea.KeyPressMsg(tea.Key{Code: tea.KeyEnter})
	case "esc":
		return tea.KeyPressMsg(tea.Key{Code: tea.KeyEsc})
	case "right":
		return tea.KeyPressMsg(tea.Key{Code: tea.KeyRight})
	case "up":
		return tea.KeyPressMsg(tea.Key{Code: tea.KeyUp})
	case "home":
		return tea.KeyPressMsg(tea.Key{Code: tea.KeyHome})
	case "pgdown":
		return tea.KeyPressMsg(tea.Key{Code: tea.KeyPgDown})
	case "ctrl+k":
		return tea.KeyPressMsg(tea.Key{Code: 'k', Mod: tea.ModCtrl})
	case "ctrl+c":
		return tea.KeyPressMsg(tea.Key{Code: 'c', Mod: tea.ModCtrl})
	default:
		return tea.KeyPressMsg(tea.Key{Text: value, Code: []rune(value)[0]})
	}
}

func assertArgsContain(t *testing.T, got []string, want ...string) {
	t.Helper()
	joined := "\x00" + strings.Join(got, "\x00") + "\x00"
	for _, item := range want {
		if !strings.Contains(joined, "\x00"+item+"\x00") {
			t.Fatalf("args missing %q: %#v", item, got)
		}
	}
}

func TestDecodeLoopEventParsesAllEventTypes(t *testing.T) {
	cases := []struct {
		name string
		line string
		wantType string
	}{
		{"loop_started", `{"type":"loop_started","runId":"run_1","maxLoopDepth":10}`, "loop_started"},
		{"turn_started", `{"type":"turn_started","depth":1}`, "turn_started"},
		{"assistant_text", `{"type":"assistant_text","content":"hello"}`, "assistant_text"},
		{"tool_result", `{"type":"tool_result","toolCallId":"c1","toolName":"local_file_read","path":"/x/README.md","result":"# hi","success":true}`, "tool_result"},
		{"tool_proposal", `{"type":"tool_proposal","proposal":{"proposalId":"p1","toolName":"local_file_write","path":"/x/a.md","riskLevel":"L3"}}`, "tool_proposal"},
		{"loop_complete", `{"type":"loop_complete","totalToolCalls":2,"totalTokens":300,"finalText":"done"}`, "loop_complete"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			event, ok := DecodeLoopEvent(tc.line)
			if !ok {
				t.Fatalf("expected ok decode for %s", tc.name)
			}
			if event.Type != tc.wantType {
				t.Fatalf("type=%s want=%s", event.Type, tc.wantType)
			}
		})
	}
	// Malformed lines are rejected, not fatal.
	if _, ok := DecodeLoopEvent("not json"); ok {
		t.Fatal("expected malformed line to be rejected")
	}
	if _, ok := DecodeLoopEvent(`{"noType":true}`); ok {
		t.Fatal("expected missing type to be rejected")
	}
}

func TestApplyLoopEventRendersToolAndApprovalBlocks(t *testing.T) {
	model := NewModel(testConfig())
	model.applyLoopEvent(LoopEvent{Type: "loop_started", MaxLoopDepth: 8})
	if model.loopMaxDepth != 8 {
		t.Fatalf("loopMaxDepth=%d want 8", model.loopMaxDepth)
	}
	model.applyLoopEvent(LoopEvent{Type: "turn_started", Depth: 1})
	model.applyLoopEvent(LoopEvent{Type: "tool_executing", ToolName: "local_file_read", Path: "/ws/README.md"})
	model.applyLoopEvent(LoopEvent{Type: "tool_result", ToolName: "local_file_read", Result: "# title", Success: true})
	if model.loopToolCalls != 1 {
		t.Fatalf("loopToolCalls=%d want 1", model.loopToolCalls)
	}

	// Proposal sets pendingApproval and renders an approval block.
	model.applyLoopEvent(LoopEvent{Type: "tool_proposal", Proposal: &ToolCallProposal{ProposalID: "p1", ToolName: "local_file_write", Path: "/ws/out.md", RiskLevel: "L3"}})
	if model.pendingApproval == nil {
		t.Fatal("expected pendingApproval set")
	}
	hasApproval := false
	for _, entry := range model.transcript {
		if entry.Role == "approval" {
			hasApproval = true
		}
	}
	if !hasApproval {
		t.Fatal("expected an approval transcript entry")
	}
}

func TestApprovalDecisionEncodingRoundTrips(t *testing.T) {
	decision := ApprovalDecision{Approve: true, ProposalID: "p1"}
	line := EncodeApprovalDecision(decision)
	var decoded ApprovalDecision
	if err := json.Unmarshal([]byte(line), &decoded); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !decoded.Approve || decoded.ProposalID != "p1" {
		t.Fatalf("decoded=%#v", decoded)
	}
}

func TestExitSlashCommandQuits(t *testing.T) {
	model := NewModel(testConfig())
	model.composer.SetValue("/exit")
	cmd := model.startChat()
	if cmd == nil {
		t.Fatal("expected a quit command from /exit")
	}
}

func TestCtrlCQuitsWhenIdle(t *testing.T) {
	model := NewModel(testConfig())
	updated, cmd := model.Update(keyPress("ctrl+c"))
	if cmd == nil {
		t.Fatal("expected ctrl+c to quit when idle with empty composer")
	}
	_ = updated
}

func TestCtrlCClearsComposerThenQuits(t *testing.T) {
	model := NewModel(testConfig())
	model.composer.SetValue("a draft")
	updated, first := model.Update(keyPress("ctrl+c"))
	if first != nil {
		t.Fatal("first ctrl+c should clear composer, not quit")
	}
	model = updated.(Model)
	if model.composer.Value() != "" {
		t.Fatalf("composer not cleared: %q", model.composer.Value())
	}
	_, second := model.Update(keyPress("ctrl+c"))
	if second == nil {
		t.Fatal("second ctrl+c should quit")
	}
}

func TestConnectSlashCommandRendersEnvGuidance(t *testing.T) {
	model := NewModel(testConfig())
	model.composer.SetValue("/connect")
	_ = model.startChat()
	// The connect card is appended as a system transcript entry.
	found := false
	for _, entry := range model.transcript {
		if entry.Meta == "connect" && strings.Contains(entry.Text, "Provider:") {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("connect card not appended to transcript: %#v", model.transcript)
	}
}

func TestSidebarToggle(t *testing.T) {
	model := NewModel(testConfig())
	if model.sidebarOpen {
		t.Fatal("sidebar should start closed")
	}
	updated, _ := model.Update(keyPress("ctrl+b"))
	model = updated.(Model)
	if !model.sidebarOpen {
		t.Fatal("ctrl+b should open sidebar")
	}
	view := model.StaticView()
	if !strings.Contains(view, "Loop") || !strings.Contains(view, "Readiness") {
		t.Fatalf("sidebar view missing sections\n%s", view)
	}
	updated, _ = model.Update(keyPress("ctrl+b"))
	model = updated.(Model)
	if model.sidebarOpen {
		t.Fatal("second ctrl+b should close sidebar")
	}
}

func TestFooterShowsApprovalHint(t *testing.T) {
	model := NewModel(testConfig())
	model.pendingApproval = &ToolCallProposal{ToolName: "local_file_write"}
	model.chatBusy = true
	view := model.StaticView()
	if !strings.Contains(view, "approve") || !strings.Contains(view, "[y]") {
		t.Fatalf("footer missing approval hint\n%s", view)
	}
}

func TestWelcomeIsActionableNotMetadata(t *testing.T) {
	model := NewModel(testConfig())
	view := model.StaticView()
	// The new welcome names the entry commands; the old metadata dump is gone.
	for _, want := range []string{"/connect", "type a message"} {
		if !strings.Contains(view, want) {
			t.Fatalf("welcome missing %q\n%s", want, view)
		}
	}
	for _, stale := range []string{"layout=hermes_fullscreen_session", "Available Tools", "status_rule=ready"} {
		if strings.Contains(view, stale) {
			t.Fatalf("welcome still contains stale metadata %q\n%s", stale, view)
		}
	}
}


