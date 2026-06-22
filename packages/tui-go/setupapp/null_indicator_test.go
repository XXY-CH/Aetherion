package setupapp

import (
	"strings"
	"testing"
)

// TestStaticViewHasNoNULLPointerArtifact renders the full workbench across
// representative runtime states and scans for the literal "null"/"NULL" token.
// A "NULL" indicator in the UI (seen in the TUI screenshot) is the fingerprint
// of a nil pointer/interface formatted with %s/%v, or a JSON-null field printed
// verbatim, or an empty slice/map. We exercise every state that the running TUI
// can be in.
func TestStaticViewHasNoNULLPointerArtifact(t *testing.T) {
	cases := map[string]func(m *Model){
		"default":             func(m *Model) {},
		"chat_busy":           func(m *Model) { m.chatBusy = true; m.loopMaxDepth = 10; m.loopDepth = 3 },
		"chat_error":          func(m *Model) { m.chatError = "boom" },
		"tree_expanded":       func(m *Model) { m.treeExpanded = true },
		"pending_approval":    func(m *Model) { m.pendingApproval = &ToolCallProposal{ProposalID: "p1", ToolName: "local_file_write", Path: "/tmp/x", Verb: "write", RiskLevel: "L3"} },
		"connect_select":      func(m *Model) { m.startConnectWizard() },
		"connect_enter_model": func(m *Model) { m.startConnectWizard(); m.connectMode = "enter_model"; m.connectSelectedProvider = "anthropic" },
		"connect_enter_key":   func(m *Model) { m.startConnectWizard(); m.connectMode = "enter_key"; m.connectSelectedProvider = "anthropic"; m.connectSelectedModel = "claude-sonnet-4-20250514" },
		"connect_confirm":     func(m *Model) { m.startConnectWizard(); m.connectMode = "confirm"; m.connectSelectedProvider = "anthropic"; m.connectSelectedModel = "claude-sonnet-4-20250514" },
		"model_picker":        func(m *Model) { m.modelPickerActive = true },
		"policy_window":       func(m *Model) { m.wm.open(winPolicy, "POLICY", m.renderPolicyWindow(), 44, 20) },
		"lease_window":        func(m *Model) { m.wm.open(winLease, "LEASES", m.renderLeaseWindow(), 44, 18) },
		"capsules_window":     func(m *Model) { m.wm.open(winCapsules, "CAPSULES", m.renderCapsulesWindow(), 44, 18) },
		"trace_window":        func(m *Model) { m.wm.open(winTrace, "TRACE", m.renderTraceWindow(), 44, 20) },
		"usage_window":        func(m *Model) { m.wm.open(winUsage, "USAGE", m.renderUsageWindow(), 44, 18) },
		"slash_popup":         func(m *Model) { m.slashActive = true; m.slashMatches = allSlashCommands(); m.completionIdx = 2 },
		"slash_popup_busy":    func(m *Model) { m.slashActive = true; m.slashMatches = allSlashCommands(); m.completionIdx = 0; m.chatBusy = true },
		"personality_set":     func(m *Model) { m.personalityOverride = "concise assistant" },
	}

	for name, setup := range cases {
		t.Run(name, func(t *testing.T) {
			model := NewModel(testConfig())
			setup(&model)
			view := stripANSI(model.StaticView())
			lower := strings.ToLower(view)
			if strings.Contains(lower, "null") {
				t.Fatalf("state %q produced literal \"null\" in view:\n%s", name, view)
			}
		})
	}
}

