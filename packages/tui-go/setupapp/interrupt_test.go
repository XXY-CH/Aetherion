package setupapp

import (
	"os/exec"
	"syscall"
	"testing"
	"time"

	tea "charm.land/bubbletea/v2"
)

// tmpConfig is testConfig with an isolated workspace so best-effort transcript
// persistence does not write into the package directory.
func tmpConfig(t *testing.T) Config {
	t.Helper()
	cfg := testConfig()
	cfg.Snapshot.WorkspaceRoot = t.TempDir()
	return cfg
}

// startSleeper launches a real long-lived child in its own process group so the
// interrupt path exercises a genuine group SIGTERM, mirroring the agent-loop
// subprocess.
func startSleeper(t *testing.T) *exec.Cmd {
	t.Helper()
	cmd := exec.Command("sleep", "30")
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err := cmd.Start(); err != nil {
		t.Fatalf("start sleeper: %v", err)
	}
	return cmd
}

func waitTerminated(t *testing.T, cmd *exec.Cmd) {
	t.Helper()
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		_ = cmd.Process.Kill()
		t.Fatal("subprocess was not terminated by the interrupt")
	}
}

func TestInterruptChatTerminatesSubprocess(t *testing.T) {
	m := NewModel(tmpConfig(t))
	cmd := startSleeper(t)
	m.chatBusy = true
	m.streamingCmd = cmd

	m.interruptChat()

	if !m.interrupting {
		t.Fatal("interrupting flag should be set")
	}
	waitTerminated(t, cmd)

	last := m.transcript[len(m.transcript)-1]
	if last.Meta != "interrupt" {
		t.Fatalf("expected an interrupt transcript entry, got %+v", last)
	}
}

func TestInterruptChatNoopWhenIdle(t *testing.T) {
	m := NewModel(tmpConfig(t))
	before := len(m.transcript)
	m.interruptChat()
	if m.interrupting {
		t.Fatal("interrupting must stay false when no turn is running")
	}
	if len(m.transcript) != before {
		t.Fatal("idle interrupt must not append a transcript entry")
	}
}

func TestCtrlCWhileBusyInterruptsTurn(t *testing.T) {
	m := NewModel(tmpConfig(t))
	cmd := startSleeper(t)
	m.chatBusy = true
	m.streamingCmd = cmd

	updated, _ := m.Update(tea.KeyPressMsg{Code: 'c', Mod: tea.ModCtrl})
	next := updated.(Model)
	if !next.interrupting {
		t.Fatal("ctrl+c while busy should request an interrupt")
	}
	waitTerminated(t, cmd)
}

func TestChatStreamDoneClearsInterruptState(t *testing.T) {
	m := NewModel(tmpConfig(t))
	m.chatBusy = true
	m.interrupting = true

	updated, _ := m.Update(chatStreamDoneMsg{err: &exec.ExitError{}})
	next := updated.(Model)
	if next.chatBusy {
		t.Fatal("chatBusy should be cleared after the stream ends")
	}
	if next.interrupting {
		t.Fatal("interrupting should reset after teardown")
	}
	if next.chatError != "" {
		t.Fatalf("an interrupted turn must not surface a chat error, got %q", next.chatError)
	}
}
