package setupapp

import (
	"strings"
	"testing"
)

// TestRenderRiskBlockStableAxis asserts all six risk levels (L0-L5) are always
// rendered, even when some have zero counts. Previously zero-count levels were
// omitted, causing the X-axis categories to shift between renders. The compact
// pill layout shows every level in two rows.
func TestRenderRiskBlockStableAxis(t *testing.T) {
	m := NewModel(testConfig())
	// treeNodes with only L1, L3, L5 events — L0/L2/L4 should still appear.
	m.treeNodes = []treeNode{
		{EventType: "risk.composed", Summary: "L1 low"},
		{EventType: "risk.composed", Summary: "L3 high"},
		{EventType: "risk.composed", Summary: "L5 critical"},
	}
	out := stripANSI(m.renderRiskBlock(30, 5))
	for _, lvl := range []string{"L0", "L1", "L2", "L3", "L4", "L5"} {
		if !strings.Contains(out, lvl) {
			t.Fatalf("risk chart missing level %q (axis unstable):\n%s", lvl, out)
		}
	}
}

// TestRenderRiskBlockNoNegativeBarWidth confirms that a narrow rail width does
// not overflow the card. Each rendered line must stay within the declared card
// width.
func TestRenderRiskBlockNoNegativeBarWidth(t *testing.T) {
	m := NewModel(testConfig())
	m.treeNodes = []treeNode{
		{EventType: "risk.composed", Summary: "L2 medium"},
		{EventType: "risk.composed", Summary: "L2 medium"},
	}
	for _, cardW := range []int{20, 24, 30} {
		out := stripANSI(m.renderRiskBlock(cardW, 5))
		for i, line := range strings.Split(out, "\n") {
			if w := visibleWidth(line); w > cardW {
				t.Fatalf("cardW=%d line %d overflows (width %d > %d):\n%s", cardW, i, w, cardW, out)
			}
		}
	}
}

// visibleWidth counts the printable runes in s (after ANSI stripping).
func visibleWidth(s string) int {
	n := 0
	for _, r := range s {
		if r == '\x1b' {
			continue
		}
		n++
	}
	return n
}

// TestRenderRiskBlockAppliesHeight confirms the RISK card enforces its assigned
// height. The compact pill layout needs ~5 rows (header + 2 pill rows + border
// + pad).
func TestRenderRiskBlockAppliesHeight(t *testing.T) {
	m := NewModel(testConfig())
	m.treeNodes = []treeNode{
		{EventType: "risk.composed", Summary: "L2 medium"},
	}
	out := stripANSI(m.renderRiskBlock(30, 5))
	lines := strings.Split(out, "\n")
	// height=5 → at most 5 rendered lines.
	if len(lines) > 5 {
		t.Fatalf("RISK card height mismatch: %d lines for height=5:\n%s", len(lines), out)
	}
}

// TestStaticViewNoNullAcrossWidths scans the full frame at multiple terminal
// widths for literal "null"/"NULL" — the indicator seen in the screenshot.
// This is the regression guard for the right-rail overflow theory.
func TestStaticViewNoNullAcrossWidths(t *testing.T) {
	widths := []int{80, 100, 120, 160}
	states := map[string]func(m *Model){
		"default":          func(m *Model) {},
		"with_tree_events": func(m *Model) {
			m.treeNodes = []treeNode{
				{EventType: "run.started", Summary: "run"},
				{EventType: "risk.composed", Summary: "L2"},
				{EventType: "tool.result", Summary: "ok"},
			}
		},
		"chat_busy":        func(m *Model) { m.chatBusy = true; m.loopMaxDepth = 10; m.loopDepth = 3 },
		"pending_approval": func(m *Model) { m.pendingApproval = &ToolCallProposal{ProposalID: "p1", ToolName: "local_file_write", Path: "/tmp/x", Verb: "write", RiskLevel: "L3"} },
		"slash_popup":      func(m *Model) { m.slashActive = true; m.slashMatches = allSlashCommands(); m.completionIdx = 0 },
		"policy_window":    func(m *Model) { m.wm.open(winPolicy, "POLICY", m.renderPolicyWindow(), 44, 20) },
	}
	for _, w := range widths {
		for state, setup := range states {
			t.Run(state, func(t *testing.T) {
				m := NewModel(testConfig())
				m.width = w
				m.height = 40
				setup(&m)
				view := stripANSI(m.render())
				lower := strings.ToLower(view)
				if strings.Contains(lower, "null") {
					t.Fatalf("state=%q width=%d produced literal \"null\":\n%s", state, w, view)
				}
			})
		}
	}
}
