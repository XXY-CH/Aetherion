package setupapp

import (
	"strings"
	"testing"
)

// TestStreamingBufferRenderedWhileBusy confirms the in-flight assistant text
// (m.assistantBuffer) is rendered in the transcript while chatBusy is true.
// Previously only a spinner row was shown — the streaming text was invisible
// until assistant_text_done committed it, making the UI feel frozen.
func TestStreamingBufferRenderedWhileBusy(t *testing.T) {
	m := NewModel(testConfig())
	m.chatBusy = true
	m.assistantBuffer = "Here is some streaming text"
	m.loopDepth = 1
	m.loopMaxDepth = 5
	content := stripANSI(renderTranscriptContentForTest(m))
	if !strings.Contains(content, "Here is some streaming text") {
		t.Fatalf("streaming assistantBuffer not rendered while busy:\n%s", content)
	}
}

// TestStreamingCursorShownWhileBusy confirms the blinking-block cursor marker
// (▍) appears at the tail of the streaming text while busy, so the user can
// see the model is actively producing tokens.
func TestStreamingCursorShownWhileBusy(t *testing.T) {
	m := NewModel(testConfig())
	m.chatBusy = true
	m.assistantBuffer = "partial response"
	m.loopDepth = 1
	m.loopMaxDepth = 5
	content := stripANSI(renderTranscriptContentForTest(m))
	if !strings.Contains(content, "▍") {
		t.Fatalf("streaming cursor ▍ not shown while busy:\n%s", content)
	}
}

// TestStreamingNotShownWhenIdle confirms the streaming buffer + cursor are NOT
// rendered when not busy (the committed transcript entry is the source of
// truth, not a stale buffer).
func TestStreamingNotShownWhenIdle(t *testing.T) {
	m := NewModel(testConfig())
	m.chatBusy = false
	m.assistantBuffer = "leftover buffer"
	m.transcript = []transcriptEntry{
		{Role: "assistant", Text: "committed response"},
	}
	content := stripANSI(renderTranscriptContentForTest(m))
	if strings.Contains(content, "leftover buffer") {
		t.Fatalf("stale assistantBuffer leaked into idle view:\n%s", content)
	}
	if strings.Contains(content, "▍") {
		t.Fatalf("streaming cursor shown while idle:\n%s", content)
	}
}

// renderTranscriptContentForTest is a thin accessor so tests can exercise the
// transcript content rendering without constructing a full viewport.
func renderTranscriptContentForTest(m Model) string {
	return m.renderTranscriptContent()
}
