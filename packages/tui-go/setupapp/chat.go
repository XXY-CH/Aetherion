package setupapp

import (
	"bufio"
	"fmt"
	"io"
	"os/exec"
	"strings"

	tea "charm.land/bubbletea/v2"
)

// Agent-loop bridge — carried over from the legacy app.go, adapted to the lean
// Model. The JSONL streaming contract, stdin approval writes, and event→transcript
// mapping are unchanged.

// runStreamingChatCommand launches the TS agent-loop subprocess with a piped
// stdin (for approvals) and stdout (for JSON-lines events). Returns a tea.Cmd
// that scans stdout line by line, emitting one loopEventMsg per event.
func runStreamingChatCommand(m Model, workspaceRoot, task, provider, modelRef string) (Model, tea.Cmd) {
	args := []string{
		"packages/tui/src/cli.ts",
		"model",
		"chat",
		"--workspace",
		workspaceRoot,
		"--content",
		task,
		"--tools",
		"--output-format",
		"jsonl",
		"--interactive",
	}
	if provider != "" {
		args = append(args, "--model-provider", provider)
	}
	if modelRef != "" {
		args = append(args, "--model", modelRef)
	}
	cmd := exec.Command("node", args...)
	cmd.Dir = repoRoot
	cmd.Env = m.env()
	stdin, err := cmd.StdinPipe()
	if err != nil {
		m.chatBusy = false
		m.chatError = err.Error()
		return m, func() tea.Msg { return chatStreamDoneMsg{err: err} }
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		m.chatBusy = false
		m.chatError = err.Error()
		return m, func() tea.Msg { return chatStreamDoneMsg{err: err} }
	}
	if startErr := cmd.Start(); startErr != nil {
		m.chatBusy = false
		m.chatError = startErr.Error()
		return m, func() tea.Msg { return chatStreamDoneMsg{err: startErr} }
	}
	m.stdinWriter = stdin
	m.streamingCmd = cmd
	m.toolsMode = true
	m.loopDepth = 0
	m.loopMaxDepth = 0
	m.loopTokens = 0
	m.loopToolCalls = 0
	m.assistantBuffer = ""
	m.startTime = nowFunc()

	events := make(chan LoopEvent, 64)
	go func() {
		scanner := bufio.NewScanner(stdout)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" {
				continue
			}
			if event, ok := DecodeLoopEvent(line); ok {
				events <- event
			}
		}
		close(events)
	}()
	m.streamEvents = events
	return m, drainStreamEvents(&m)
}

// drainStreamEvents returns a Cmd that pulls the next event off the stream
// channel. On channel close it waits for the subprocess and reports completion.
func drainStreamEvents(m *Model) tea.Cmd {
	return func() tea.Msg {
		if m.streamEvents == nil {
			return chatStreamDoneMsg{}
		}
		event, open := <-m.streamEvents
		if !open {
			waitErr := error(nil)
			if m.streamingCmd != nil {
				waitErr = m.streamingCmd.Wait()
			}
			return chatStreamDoneMsg{err: waitErr}
		}
		return loopEventMsg{event: event}
	}
}

// applyLoopEvent renders a single agent-loop event into the transcript and
// updates loop counters.
func (m *Model) applyLoopEvent(event LoopEvent) {
	switch event.Type {
	case "loop_started":
		m.loopMaxDepth = event.MaxLoopDepth
		m.statusMsg = fmt.Sprintf("agent loop started: max turns=%d", event.MaxLoopDepth)
	case "turn_started":
		m.loopDepth = event.Depth
		m.assistantBuffer = ""
	case "assistant_text":
		m.assistantBuffer += event.Content
	case "assistant_text_done":
		text := event.Content
		if len(strings.TrimSpace(text)) == 0 {
			text = m.assistantBuffer
		}
		if strings.TrimSpace(text) != "" {
			meta := "assistant"
			if event.Usage != nil {
				meta = fmt.Sprintf("assistant · %d tok", event.Usage.TotalTokens)
				m.loopTokens += event.Usage.TotalTokens
				m.tokenHistory = append(m.tokenHistory, tokenSample{
					Turn:   m.loopDepth,
					Input:  event.Usage.InputTokens,
					Output: event.Usage.OutputTokens,
					Total:  event.Usage.TotalTokens,
				})
			}
			m.transcript = append(m.transcript, transcriptEntry{Role: "assistant", Text: text, Meta: meta})
		}
		m.assistantBuffer = ""
	case "tool_executing":
		m.transcript = append(m.transcript, transcriptEntry{
			Role: "tool",
			Text: fmt.Sprintf("🔧 %s(%s)", event.ToolName, shortPath(event.Path)),
			Meta: "executing",
		})
	case "tool_result":
		success := "✓"
		if !event.Success {
			success = "✗"
		}
		m.transcript = append(m.transcript, transcriptEntry{
			Role: "tool",
			Text: fmt.Sprintf("📋 %s %s\n%s", event.ToolName, success, previewResult(event.Result)),
			Meta: "result",
		})
		m.loopToolCalls++
	case "tool_proposal":
		m.pendingApproval = event.Proposal
		// Auto-open policy window to show diff for write operations.
		m.wm.open(winPolicy, "APPROVAL", m.renderPolicyWindow(), 56, 28)
		m.transcript = append(m.transcript, transcriptEntry{
			Role: "approval",
			Text: fmt.Sprintf("⚠️ Approve %s on %s? [%s] [y/n]\n(Diff shown in policy window — press y/n)", event.Proposal.ToolName, shortPath(event.Proposal.Path), event.Proposal.RiskLevel),
			Meta: "awaiting approval",
		})
	case "tool_approved":
		m.pendingApproval = nil
		m.transcript = append(m.transcript, transcriptEntry{Role: "approval", Text: "✓ approved", Meta: "approval"})
	case "tool_denied":
		m.pendingApproval = nil
		m.transcript = append(m.transcript, transcriptEntry{Role: "approval", Text: "✗ denied: " + event.Reason, Meta: "approval"})
	case "policy_denied":
		m.transcript = append(m.transcript, transcriptEntry{Role: "error", Text: fmt.Sprintf("🚫 policy denied %s: %s", event.ToolName, event.Reason), Meta: "policy"})
	case "loop_complete":
		m.loopTokens = event.TotalTokens
		m.loopToolCalls = event.TotalToolCalls
		if strings.TrimSpace(event.FinalText) != "" {
			m.transcript = append(m.transcript, transcriptEntry{Role: "assistant", Text: event.FinalText, Meta: "final"})
		}
	case "error":
		m.transcript = append(m.transcript, transcriptEntry{Role: "error", Text: "⛔ " + event.Message, Meta: event.Code})
	}
	// After each event, reload the git-tree so it reflects new ledger events.
	m.loadTreeNodes()
	// Persist transcript so it survives restart.
	m.persistTranscript()
}

// resolveApproval writes the y/n decision to the subprocess stdin.
func (m *Model) resolveApproval(approve bool) {
	if m.pendingApproval == nil || m.stdinWriter == nil {
		return
	}
	decision := ApprovalDecision{
		Approve:    approve,
		ProposalID: m.pendingApproval.ProposalID,
	}
	if !approve {
		decision.Reason = "user denied in TUI"
	}
	line := EncodeApprovalDecision(decision) + "\n"
	_, _ = io.WriteString(m.stdinWriter, line)
	if !approve {
		m.pendingApproval = nil
	}
}

// startChat is called when the user presses Enter/Submit in the composer.
func (m *Model) startChat() tea.Cmd {
	task := strings.TrimSpace(m.composer.Value())
	if task == "" {
		m.statusMsg = "chat task is empty"
		return nil
	}
	if strings.HasPrefix(task, "/") {
		m.handleSlashCommand(task)
		m.refreshTranscript()
		if m.quitRequested {
			m.quitRequested = false
			return tea.Quit
		}
		return nil
	}
	provider := strings.TrimSpace(m.providerInput.Value())
	modelRef := strings.TrimSpace(m.modelInput.Value())
	if m.chatBusy {
		m.queue = append(m.queue, queuedPrompt{Task: task, Provider: provider, Model: modelRef})
		m.composer.Reset()
		m.historyIndex = -1
		m.statusMsg = fmt.Sprintf("queued prompt: position=%d provider=%s", len(m.queue), emptyAs(provider, "stub"))
		return nil
	}
	return m.beginChat(task, provider, modelRef, true)
}

func (m *Model) beginChat(task, provider, modelRef string, resetComposer bool) tea.Cmd {
	m.chatBusy = true
	m.chatError = ""
	m.activePrompt = task
	m.transcript = append(m.transcript, transcriptEntry{Role: "user", Text: task, Meta: fmt.Sprintf("%s / %s", provider, modelRef)})
	m.persistTranscript()
	if resetComposer {
		m.composer.Reset()
	}
	m.historyIndex = -1
	m.historyDraft = ""
	m.completionIdx = -1
	m.transcriptUnread = 0
	m.refreshTranscriptToBottom()
	if m.toolsMode {
		m.statusMsg = fmt.Sprintf("agent loop running: provider=%s model=%s", emptyAs(provider, "stub"), emptyAs(modelRef, "default"))
		updated, drainCmd := runStreamingChatCommand(*m, m.cfg.Snapshot.WorkspaceRoot, task, provider, modelRef)
		*m = updated
		return drainCmd
	}
	m.statusMsg = fmt.Sprintf("chat running: provider=%s model=%s", emptyAs(provider, "stub"), emptyAs(modelRef, "default"))
	return nil
}

// userHistory returns previously sent user messages from the transcript.
func (m Model) userHistory() []string {
	var out []string
	for _, entry := range m.transcript {
		if entry.Role == "user" {
			out = append(out, entry.Text)
		}
	}
	return out
}

func (m Model) env() []string {
	env := append([]string{}, osEnv()...)
	// Inject personality override into the child process env.
	if m.personalityOverride != "" {
		env = append(env, "AETHERION_PERSONALITY="+m.personalityOverride)
	}
	return env
}
