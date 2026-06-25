package setupapp

import "testing"

func TestStaleLoopEventIsDropped(t *testing.T) {
	m := NewModel(tmpConfig(t))
	m.streamGen = 2

	updated, _ := m.Update(loopEventMsg{event: LoopEvent{Type: "loop_started", MaxLoopDepth: 9}, gen: 1})
	next := updated.(Model)

	if next.loopMaxDepth != 0 {
		t.Fatalf("event from a superseded generation must not be applied, got loopMaxDepth=%d", next.loopMaxDepth)
	}
}

func TestCurrentLoopEventIsApplied(t *testing.T) {
	m := NewModel(tmpConfig(t))
	m.streamGen = 2

	updated, cmd := m.Update(loopEventMsg{event: LoopEvent{Type: "loop_started", MaxLoopDepth: 7}, gen: 2})
	next := updated.(Model)

	if next.loopMaxDepth != 7 {
		t.Fatalf("a matching-generation event should be applied, got loopMaxDepth=%d", next.loopMaxDepth)
	}
	if cmd == nil {
		t.Fatal("a live event should re-arm the drain")
	}
}

func TestStaleStreamDoneIsIgnored(t *testing.T) {
	m := NewModel(tmpConfig(t))
	m.streamGen = 2
	m.chatBusy = true

	updated, _ := m.Update(chatStreamDoneMsg{gen: 1})
	next := updated.(Model)

	if !next.chatBusy {
		t.Fatal("completion from a superseded generation must not clear the live turn's busy state")
	}
}

func TestInterruptingDropsBufferedEventsButKeepsDraining(t *testing.T) {
	m := NewModel(tmpConfig(t))
	m.streamGen = 1
	m.chatBusy = true
	m.interrupting = true
	m.streamEvents = make(chan LoopEvent, 1)

	updated, cmd := m.Update(loopEventMsg{event: LoopEvent{Type: "loop_started", MaxLoopDepth: 5}, gen: 1})
	next := updated.(Model)

	if next.loopMaxDepth == 5 {
		t.Fatal("an interrupting turn must not apply its buffered events")
	}
	if cmd == nil {
		t.Fatal("the drain must be re-armed so the channel close still triggers teardown")
	}
}
