package setupapp

import (
	"os/exec"
	"testing"
)

// transcriptHasUser reports whether the transcript contains a user entry with
// the given text.
func transcriptHasUser(m Model, text string) bool {
	for _, e := range m.transcript {
		if e.Role == "user" && e.Text == text {
			return true
		}
	}
	return false
}

func TestQueuedPromptStartsAfterTurnCompletes(t *testing.T) {
	m := NewModel(tmpConfig(t))
	m.toolsMode = false // non-tools beginChat avoids spawning a real subprocess
	m.chatBusy = true
	m.queue = []queuedPrompt{
		{Task: "second prompt", Provider: "stub", Model: "m"},
		{Task: "third prompt", Provider: "stub", Model: "m"},
	}

	updated, _ := m.Update(chatStreamDoneMsg{})
	next := updated.(Model)

	if len(next.queue) != 1 {
		t.Fatalf("exactly one queued prompt should drain per completion, got %d remaining", len(next.queue))
	}
	if next.queue[0].Task != "third prompt" {
		t.Fatalf("queue should preserve FIFO order, head=%q", next.queue[0].Task)
	}
	if !next.chatBusy {
		t.Fatal("starting the next queued prompt should set chatBusy")
	}
	if !transcriptHasUser(next, "second prompt") {
		t.Fatal("the drained prompt should appear as a user transcript entry")
	}
}

func TestNoQueuedPromptLeavesIdle(t *testing.T) {
	m := NewModel(tmpConfig(t))
	m.toolsMode = false
	m.chatBusy = true

	updated, _ := m.Update(chatStreamDoneMsg{})
	next := updated.(Model)

	if next.chatBusy {
		t.Fatal("with an empty queue the loop should return to idle")
	}
}

func TestInterruptLeavesQueueIntact(t *testing.T) {
	m := NewModel(tmpConfig(t))
	m.toolsMode = false
	m.chatBusy = true
	m.interrupting = true
	m.queue = []queuedPrompt{{Task: "queued", Provider: "stub", Model: "m"}}

	updated, _ := m.Update(chatStreamDoneMsg{err: &exec.ExitError{}})
	next := updated.(Model)

	if len(next.queue) != 1 {
		t.Fatalf("an interrupt must not drain the queue, got %d remaining", len(next.queue))
	}
	if next.chatBusy {
		t.Fatal("an interrupt must not auto-start the next queued prompt")
	}
}

func TestStartNextQueuedEmptyIsNoop(t *testing.T) {
	m := NewModel(tmpConfig(t))
	cmd, ok := m.startNextQueued()
	if ok || cmd != nil {
		t.Fatal("startNextQueued on an empty queue must be a no-op")
	}
}
