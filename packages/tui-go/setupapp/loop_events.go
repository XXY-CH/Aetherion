package setupapp

import (
	"encoding/json"
)

// LoopEvent mirrors the TypeScript AgentLoop LoopEvent union. Each variant is
// distinguished by its Type field, which the JSON-lines stream sets from the
// TS side. Fields are kept optional so a single struct decodes every variant.

// ToolCallProposal is the approval payload emitted before a write executes.
type ToolCallProposal struct {
	ProposalID    string                 `json:"proposalId"`
	ToolCallID    string                 `json:"toolCallId"`
	ToolName      string                 `json:"toolName"`
	Arguments     map[string]interface{} `json:"arguments"`
	Path          string                 `json:"path"`
	Verb          string                 `json:"verb"`
	RiskLevel     string                 `json:"riskLevel"`
	DecisionHint  string                 `json:"decisionHint"`
	ProposedContent string               `json:"proposedContent,omitempty"`
}

// TokenUsage carries per-turn token accounting.
type TokenUsage struct {
	InputTokens  int    `json:"input_tokens"`
	OutputTokens int    `json:"output_tokens"`
	TotalTokens  int    `json:"total_tokens"`
}

// LoopEvent is one JSON-line event from the agent loop stream.
type LoopEvent struct {
	Type        string             `json:"type"`
	RunID       string             `json:"runId,omitempty"`
	MaxLoopDepth int               `json:"maxLoopDepth,omitempty"`
	Depth       int                `json:"depth,omitempty"`
	Content     string             `json:"content,omitempty"`
	Usage       *TokenUsage        `json:"usage,omitempty"`
	Proposal    *ToolCallProposal  `json:"proposal,omitempty"`
	ProposalID  string             `json:"proposalId,omitempty"`
	Reason      string             `json:"reason,omitempty"`
	ToolCallID  string             `json:"toolCallId,omitempty"`
	ToolName    string             `json:"toolName,omitempty"`
	Path        string             `json:"path,omitempty"`
	Result      string             `json:"result,omitempty"`
	Success     bool               `json:"success,omitempty"`
	TotalToolCalls int             `json:"totalToolCalls,omitempty"`
	TotalTokens int                `json:"totalTokens,omitempty"`
	FinalText   string             `json:"finalText,omitempty"`
	Message     string             `json:"message,omitempty"`
	Code        string             `json:"code,omitempty"`
}

// DecodeLoopEvent parses a single JSON-lines event. Returns ok=false on
// malformed lines so the caller can skip them without aborting the stream.
func DecodeLoopEvent(line string) (LoopEvent, bool) {
	var event LoopEvent
	if err := json.Unmarshal([]byte(line), &event); err != nil {
		return LoopEvent{}, false
	}
	if event.Type == "" {
		return LoopEvent{}, false
	}
	return event, true
}

// ApprovalDecision is the JSON payload written to the subprocess stdin to
// resolve a tool_proposal event.
type ApprovalDecision struct {
	Approve    bool   `json:"approve"`
	ProposalID string `json:"proposalId"`
	Reason     string `json:"reason,omitempty"`
}

// EncodeApprovalDecision serializes an approval decision to a single JSON line
// for the TS subprocess stdin.
func EncodeApprovalDecision(decision ApprovalDecision) string {
	encoded, _ := json.Marshal(decision)
	return string(encoded)
}
