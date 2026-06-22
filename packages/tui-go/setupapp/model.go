package setupapp

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"charm.land/bubbles/v2/help"
	"charm.land/bubbles/v2/progress"
	"charm.land/bubbles/v2/spinner"
	"charm.land/bubbles/v2/textarea"
	"charm.land/bubbles/v2/textinput"
	"charm.land/bubbles/v2/viewport"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
)

// Model is the workbench state. Lean — no dead menu/table fields.
type Model struct {
	cfg Config

	// Terminal geometry.
	width  int
	height int

	// Components.
	keys            keyMap
	help            help.Model
	providerInput   textinput.Model
	modelInput      textinput.Model
	composer        textarea.Model
	spinner         spinner.Model
	transcriptVP    viewport.Model
	turnProgress    progress.Model
	elapsedProgress progress.Model

	// Conversation.
	transcript       []transcriptEntry
	transcriptUnread int

	// Chat / agent-loop state.
	chatBusy     bool
	activePrompt string
	chatResult   *ChatResult
	chatError    string
	queue        []queuedPrompt
	runner       CommandRunner
	startTime    time.Time

	// Agent-loop streaming state (carried from legacy — unchanged engine).
	toolsMode       bool
	loopDepth       int
	loopMaxDepth    int
	loopTokens      int
	loopToolCalls   int
	pendingApproval *ToolCallProposal
	stdinWriter     io.WriteCloser
	streamingCmd    *exec.Cmd
	streamEvents    chan LoopEvent
	assistantBuffer string
	tokenHistory    []tokenSample

	// Git-tree gutter state.
	treeNodes  []treeNode
	treeCursor int

	// Window manager (Layer 2 + Layer 3).
	wm *windowManager

	// UX state.
	statusMsg     string
	quitRequested bool
	treeExpanded  bool
	historyIndex  int
	historyDraft  string

	// Connect wizard state.
	connectMode    string // "" | "select_provider" | "enter_key" | "confirm" | "enter_model"
	connectCursor  int    // cursor in provider list
	connectKeyInput textinput.Model
	connectModelInput textinput.Model
	connectSelectedProvider string
	connectSelectedModel string
	modelPickerActive bool
	personalityOverride string
	completionIdx int
	activePane    string // "conversation", "rail", "tree", "composer"
	clickFlash    int    // decremented each frame for click-feedback animation
	slashMatches  []slashCommand
	slashActive   bool
}

// Message types for the agent-loop engine (carried from legacy).
type chatFinishedMsg struct {
	result ChatResult
	stderr string
	err    error
}

type loopEventMsg struct {
	event LoopEvent
}

type chatStreamDoneMsg struct {
	err error
}

// CommandResult is the output of a one-shot subprocess run.
type CommandResult struct {
	Stdout string
	Stderr string
	Err    error
}

// CommandRunner runs a command and returns its output. Testable via injection.
type CommandRunner func(name string, args []string) CommandResult

func defaultRunner(name string, args []string) CommandResult {
	cmd := exec.Command(name, args...)
	cmd.Env = os.Environ()
	out, err := cmd.CombinedOutput()
	return CommandResult{Stdout: string(out), Err: err}
}

// NewModel creates a workbench Model with the default (real) runner.
func NewModel(cfg Config) Model {
	return NewModelWithRunner(cfg, defaultRunner)
}

func NewModelWithRunner(cfg Config, runner CommandRunner) Model {
	providerInput := textinput.New()
	providerInput.Prompt = ""
	providerInput.SetValue(emptyAs(cfg.ModelStatus.ProviderName, "stub"))
	providerInput.SetStyles(workbenchTextInputStyles())

	modelInput := textinput.New()
	modelInput.Prompt = ""
	modelInput.SetValue(emptyAs(cfg.ModelStatus.ModelRef, "stub-deterministic-v1"))
	modelInput.SetStyles(workbenchTextInputStyles())

	composer := textarea.New()
	composer.Prompt = ""
	composer.Placeholder = "Ask Aetherion anything, or type /help"
	composer.CharLimit = 0
	composer.ShowLineNumbers = false
	composer.SetWidth(80)
	composer.SetHeight(4)
	composer.SetStyles(workbenchTextareaStyles())

	sp := spinner.New()
	sp.Spinner = spinner.Points
	sp.Style = lipgloss.NewStyle().Foreground(clay)

	vp := viewport.New()

	tp := progress.New(
		progress.WithColors(ivoryLight),
		progress.WithFillCharacters('█', '░'),
		progress.WithoutPercentage(),
		progress.WithWidth(8),
	)
	ep := progress.New(
		progress.WithColors(cloudMedium),
		progress.WithFillCharacters('█', '░'),
		progress.WithoutPercentage(),
		progress.WithWidth(8),
	)

	// Load persisted transcript from disk; fall back to default intro.
	persisted, err := loadTranscript(cfg.Snapshot.WorkspaceRoot)
	var initialTranscript []transcriptEntry
	if err == nil && len(persisted) > 0 {
		initialTranscript = persisted
	} else {
		initialTranscript = []transcriptEntry{
			{Role: "intro", Text: "Aetherion", Meta: "welcome"},
		}
	}

	m := Model{
		cfg:             cfg,
		keys:            defaultKeyMap(),
		help:            help.New(),
		providerInput:   providerInput,
		modelInput:      modelInput,
		composer:        composer,
		spinner:         sp,
		transcriptVP:    vp,
		turnProgress:    tp,
		elapsedProgress: ep,
		runner:          runner,
		toolsMode:       true,
		wm:              newWindowManager(),
		startTime:       time.Now(),
		tokenHistory:    []tokenSample{},
		activePane:      "composer",
		transcript:      initialTranscript,
	}
	m.composer.Focus()
	return m
}

func workbenchTextInputStyles() textinput.Styles {
	s := textinput.DefaultDarkStyles()
	base := lipgloss.NewStyle().Foreground(ivoryLight).Background(slateDark)
	s.Focused.Text = base
	s.Focused.Placeholder = lipgloss.NewStyle().Foreground(cloudMedium).Background(slateDark)
	s.Focused.Prompt = lipgloss.NewStyle().Foreground(clay).Background(slateDark)
	s.Focused.Suggestion = lipgloss.NewStyle().Foreground(cloudMedium).Background(slateDark)
	s.Blurred.Text = base
	s.Blurred.Placeholder = lipgloss.NewStyle().Foreground(cloudMedium).Background(slateDark)
	s.Blurred.Prompt = lipgloss.NewStyle().Foreground(cloudMedium).Background(slateDark)
	s.Blurred.Suggestion = lipgloss.NewStyle().Foreground(cloudMedium).Background(slateDark)
	s.Cursor.Color = clay
	return s
}

func workbenchTextareaStyles() textarea.Styles {
	s := textarea.DefaultDarkStyles()
	base := lipgloss.NewStyle().Foreground(ivoryLight).Background(slateDark)
	s.Focused.Base = base
	s.Focused.Text = base
	s.Focused.CursorLine = lipgloss.NewStyle().Foreground(ivoryLight).Background(slateDark)
	s.Focused.Placeholder = lipgloss.NewStyle().Foreground(cloudMedium).Background(slateDark)
	s.Focused.Prompt = lipgloss.NewStyle().Foreground(clay).Background(slateDark)
	s.Focused.EndOfBuffer = lipgloss.NewStyle().Foreground(slateDark).Background(slateDark)
	s.Blurred.Base = base
	s.Blurred.Text = base
	s.Blurred.CursorLine = lipgloss.NewStyle().Foreground(ivoryLight).Background(slateDark)
	s.Blurred.Placeholder = lipgloss.NewStyle().Foreground(cloudMedium).Background(slateDark)
	s.Blurred.Prompt = lipgloss.NewStyle().Foreground(cloudMedium).Background(slateDark)
	s.Blurred.EndOfBuffer = lipgloss.NewStyle().Foreground(slateDark).Background(slateDark)
	s.Cursor.Color = clay
	return s
}

// Init starts the spinner.
func (m Model) Init() tea.Cmd {
	return m.spinner.Tick
}

// DecodeConfig reads the JSON config from stdin (piped by the TS CLI).
func DecodeConfig(r io.Reader) (Config, error) {
	var cfg Config
	decoder := json.NewDecoder(r)
	if err := decoder.Decode(&cfg); err != nil {
		return Config{}, err
	}
	if cfg.DefaultEntry == "" {
		cfg.DefaultEntry = "ether"
	}
	if cfg.ModelStatus.ProviderName == "" {
		cfg.ModelStatus.ProviderName = "stub"
	}
	if cfg.ModelStatus.ModelRef == "" {
		cfg.ModelStatus.ModelRef = "stub-deterministic-v1"
	}
	return cfg, nil
}

// Run launches the TUI program (or prints a static view in non-interactive mode).
func Run(cfg Config, out io.Writer) error {
	model := NewModel(cfg)
	if cfg.NonInteractive {
		_, err := io.WriteString(out, model.StaticView())
		return err
	}
	program := tea.NewProgram(model)
	_, err := program.Run()
	return err
}

// StaticView returns a plain-text render for non-interactive mode (no ANSI).
// The default geometry (120×40) is large enough to show all six rail cards
// plus the composer and footer without truncation; the interactive program
// uses the real terminal size via the WindowSizeMsg.
func (m Model) StaticView() string {
	if m.width == 0 {
		m.width = 120
	}
	if m.height == 0 {
		m.height = 40
	}
	return stripANSI(m.render())
}

// View returns the tea.View for the interactive program.
func (m Model) View() tea.View {
	v := tea.NewView(m.render())
	v.AltScreen = true
	v.ReportFocus = true
	v.MouseMode = tea.MouseModeCellMotion
	return v
}

// refreshTranscript rebuilds the transcript viewport content.
func (m *Model) refreshTranscript() {
	m.transcriptVP.SetContent(m.renderTranscriptContent())
}

func (m *Model) refreshTranscriptToBottom() {
	m.refreshTranscript()
	m.transcriptVP.GotoBottom()
}

func (m *Model) refreshTranscriptAfterAppend() {
	m.refreshTranscript()
	m.transcriptVP.GotoBottom()
}

// loadTreeNodes reads the ledger and builds the git-tree node list.
func (m *Model) loadTreeNodes() {
	events := readLedgerEvents(m.cfg.Snapshot.WorkspaceRoot, 200)
	checkpoints := checkpointEventIDs(m.cfg.Snapshot.WorkspaceRoot)
	branches := readBranches(m.cfg.Snapshot.WorkspaceRoot)

	// Build a set of branch-source event IDs for quick lookup.
	branchByEvent := make(map[string]branchInfo)
	for _, b := range branches {
		if b.SourceEventID != "" {
			branchByEvent[b.SourceEventID] = b
		}
	}

	nodes := make([]treeNode, 0, len(events))
	for _, evt := range events {
		node := treeNode{
			EventID:   evt.ID,
			EventType: evt.EventType,
			RunID:     evt.RunID,
			Actor:     evt.Actor.Type,
			Summary:   evt.Summary,
			Timestamp: evt.Timestamp,
		}
		if checkpoints[evt.ID] {
			node.IsCheckpoint = true
		}
		if b, ok := branchByEvent[evt.ID]; ok {
			node.IsBranch = true
			node.BranchStatus = b.Status
		}
		nodes = append(nodes, node)
	}
	// Mark HEAD as the last node.
	if len(nodes) > 0 {
		nodes[len(nodes)-1].IsHead = true
	}
	m.treeNodes = nodes
	if m.treeCursor >= len(nodes) {
		m.treeCursor = len(nodes) - 1
	}
}

// repoRoot is the git repo root for subprocess invocation.
var repoRoot string

func init() {
	cwd, err := os.Getwd()
	if err != nil {
		cwd = "."
	}
	// Walk up to find go.mod or .git.
	dir := cwd
	for i := 0; i < 10; i++ {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			repoRoot = dir
			return
		}
		if _, err := os.Stat(filepath.Join(dir, ".git")); err == nil {
			repoRoot = dir
			return
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	repoRoot = cwd
}

func (m Model) workspaceRoot() string {
	return emptyAs(m.cfg.Snapshot.WorkspaceRoot, ".")
}

// osEnv and nowFunc are package-level so tests can override them.
var osEnv = os.Environ
var nowFunc = time.Now

func (m Model) provider() string {
	return emptyAs(m.providerInput.Value(), "stub")
}

func (m Model) modelRef() string {
	return emptyAs(m.modelInput.Value(), "stub-deterministic-v1")
}

// statusReport renders a /status summary.
func statusReport(m Model) string {
	lines := []string{
		fmt.Sprintf("workspace: %s", m.workspaceRoot()),
		fmt.Sprintf("provider: %s · model: %s", m.provider(), m.modelRef()),
		fmt.Sprintf("credential_resolved: %t", credentialPresent(m.provider())),
		fmt.Sprintf("tools_mode: %t · tools_allowed: %t", m.toolsMode, m.cfg.ModelStatus.ToolsAllowed),
		fmt.Sprintf("loop: depth %d/%d · tools %d · tokens %d", m.loopDepth, m.loopMaxDepth, m.loopToolCalls, m.loopTokens),
		fmt.Sprintf("events in tree: %d · queue: %d", len(m.treeNodes), len(m.queue)),
	}
	return strings.Join(lines, "\n")
}
