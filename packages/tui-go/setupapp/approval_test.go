package setupapp

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"
)

// bufWriteCloser adapts a bytes.Buffer to the io.WriteCloser the model writes
// approval decisions to.
type bufWriteCloser struct{ b *bytes.Buffer }

func (w bufWriteCloser) Write(p []byte) (int, error) { return w.b.Write(p) }
func (w bufWriteCloser) Close() error                { return nil }

func decodeDecision(t *testing.T, buf *bytes.Buffer) ApprovalDecision {
	t.Helper()
	var dec ApprovalDecision
	if err := json.Unmarshal(bytes.TrimSpace(buf.Bytes()), &dec); err != nil {
		t.Fatalf("decode decision %q: %v", buf.String(), err)
	}
	return dec
}

func TestResolveApprovalAlwaysEncodesScope(t *testing.T) {
	m := NewModel(tmpConfig(t))
	var buf bytes.Buffer
	m.stdinWriter = bufWriteCloser{&buf}
	m.pendingApproval = &ToolCallProposal{ProposalID: "p1", ToolName: "shell_exec", Verb: "exec"}

	m.resolveApproval(true, "always")

	dec := decodeDecision(t, &buf)
	if !dec.Approve || dec.Scope != "always" || dec.ProposalID != "p1" {
		t.Fatalf("unexpected decision: %+v", dec)
	}
}

func TestResolveApprovalOnceDefaultsScope(t *testing.T) {
	m := NewModel(tmpConfig(t))
	var buf bytes.Buffer
	m.stdinWriter = bufWriteCloser{&buf}
	m.pendingApproval = &ToolCallProposal{ProposalID: "p1", ToolName: "local_file_write", Verb: "write"}

	// An empty/garbage scope must normalize to "once".
	m.resolveApproval(true, "")

	dec := decodeDecision(t, &buf)
	if dec.Scope != "once" {
		t.Fatalf("expected scope=once, got %q", dec.Scope)
	}
}

func TestResolveApprovalDenyClearsPending(t *testing.T) {
	m := NewModel(tmpConfig(t))
	var buf bytes.Buffer
	m.stdinWriter = bufWriteCloser{&buf}
	m.pendingApproval = &ToolCallProposal{ProposalID: "p1", ToolName: "shell_exec", Verb: "exec"}

	m.resolveApproval(false, "once")

	dec := decodeDecision(t, &buf)
	if dec.Approve {
		t.Fatal("deny must encode approve=false")
	}
	if m.pendingApproval != nil {
		t.Fatal("deny should clear the pending approval")
	}
}

func TestApprovalKeyAllowAlwaysSendsAlwaysScope(t *testing.T) {
	m := NewModel(tmpConfig(t))
	var buf bytes.Buffer
	m.stdinWriter = bufWriteCloser{&buf}
	m.pendingApproval = &ToolCallProposal{ProposalID: "p2", ToolName: "shell_exec", Verb: "exec"}

	updated, _ := m.Update(tea.KeyPressMsg{Code: 'a'})
	next := updated.(Model)

	dec := decodeDecision(t, &buf)
	if !dec.Approve || dec.Scope != "always" {
		t.Fatalf("the 'a' key should approve-always, got %+v", dec)
	}
	if !strings.Contains(next.statusMsg, "always") {
		t.Fatalf("status should mention always, got %q", next.statusMsg)
	}
}
