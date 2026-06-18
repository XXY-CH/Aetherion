package setupapp

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
	"strings"

	"charm.land/bubbles/v2/help"
	"charm.land/bubbles/v2/key"
	"charm.land/bubbles/v2/list"
	"charm.land/bubbles/v2/spinner"
	"charm.land/bubbles/v2/table"
	"charm.land/bubbles/v2/textarea"
	"charm.land/bubbles/v2/textinput"
	"charm.land/bubbles/v2/viewport"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
)

type Snapshot struct {
	ID              string          `json:"id"`
	RepoRoot        string          `json:"repo_root"`
	WorkspaceRoot   string          `json:"workspace_root"`
	Status          string          `json:"status"`
	Summary         Summary         `json:"summary"`
	ReadinessLayers ReadinessLayers `json:"readiness_layers"`
	V1CoreProfile   V1CoreProfile   `json:"v1_core_profile"`
	Checks          []Check         `json:"checks"`
	NextSteps       []string        `json:"next_steps"`
	Deferred        []string        `json:"deferred_surfaces"`
	SourceDocuments []SourceDoc     `json:"source_documents"`
}

type Summary struct {
	Pass          int `json:"pass"`
	Warn          int `json:"warn"`
	Fail          int `json:"fail"`
	NotApplicable int `json:"not_applicable"`
}

type ReadinessLayers struct {
	ToolchainReady   string `json:"toolchain_ready"`
	RepoReady        string `json:"repo_ready"`
	WorkspaceRuntime string `json:"workspace_runtime_state"`
	NextStepsReady   bool   `json:"next_steps_ready"`
}

type V1CoreProfile struct {
	Status                  string      `json:"status"`
	ReleaseCriticalCommands []string    `json:"release_critical_commands"`
	ReadinessCommands       []string    `json:"readiness_commands"`
	ReleaseSupportCommands  []string    `json:"release_support_commands"`
	PostV1ContractLabs      []string    `json:"post_v1_contract_labs"`
	PostV1SurfaceLabs       []string    `json:"post_v1_surface_labs"`
	ExcludedFromV1          []string    `json:"excluded_from_v1_release_critical"`
	Evidence                []string    `json:"evidence"`
	SourceDocuments         []SourceDoc `json:"source_documents"`
}

type Check struct {
	ID          string   `json:"id"`
	Status      string   `json:"status"`
	Severity    string   `json:"severity"`
	Summary     string   `json:"summary"`
	Evidence    []string `json:"evidence"`
	Remediation string   `json:"remediation"`
}

type SourceDoc struct {
	Path string `json:"path"`
	Role string `json:"role"`
}

type ModelStatus struct {
	SchemaVersion                  string   `json:"schema_version"`
	ProviderName                   string   `json:"provider_name"`
	ProviderRef                    string   `json:"provider_ref"`
	ModelRef                       string   `json:"model_ref"`
	NetworkCapable                 bool     `json:"network_capable"`
	CredentialRequired             bool     `json:"credential_required"`
	CredentialEnvRefs              []string `json:"credential_env_refs"`
	CredentialResolved             bool     `json:"credential_resolved"`
	CredentialSource               string   `json:"credential_source"`
	ProviderError                  string   `json:"provider_error"`
	RawSecretPersisted             bool     `json:"raw_secret_persisted"`
	SettingsPersisted              bool     `json:"settings_persisted"`
	ToolsAllowed                   bool     `json:"tools_allowed"`
	RuntimeAuthorityGranted        bool     `json:"runtime_authority_granted"`
	ModelOutputCanAuthorizeActions bool     `json:"model_output_can_authorize_actions"`
}

type Config struct {
	Snapshot           Snapshot
	NonInteractive     bool
	DefaultEntry       string
	OnboardingCommand  string
	DoctorCommand      string
	SecurityCommand    string
	ReleaseCommand     string
	RunCommand         string
	LLMReadLoopCommand string
	ModelStatus        ModelStatus
	DirectEntry        string
	PackageEntry       string
}

type ChatResult struct {
	SourceRunID                 string   `json:"source_run_id"`
	SourceRunCreated            bool     `json:"source_run_created"`
	InvocationID                string   `json:"invocation_id"`
	RequestID                   string   `json:"request_id"`
	ResponseID                  string   `json:"response_id"`
	ResponseAuditID             string   `json:"response_audit_id"`
	ProviderRef                 string   `json:"provider_ref"`
	ModelRef                    string   `json:"model_ref"`
	RawOutputPrinted            bool     `json:"raw_output_printed"`
	OutputText                  string   `json:"output_text"`
	OutputTextSHA256            string   `json:"output_text_sha256"`
	ResponsePayloadSHA256       string   `json:"response_payload_sha256"`
	ResponseAuditEvidenceStatus string   `json:"response_audit_evidence_status"`
	RuntimeAuthorityGranted     bool     `json:"runtime_authority_granted"`
	ToolsRequested              bool     `json:"tools_requested"`
	ResponseAuditRequired       bool     `json:"response_audit_required"`
	ResponseAuditStatus         string   `json:"response_audit_status"`
	ResponseAuditForbidden      []string `json:"response_audit_forbidden_claims"`
	ResponseAuditMissingBlocks  []string `json:"response_audit_missing_blocks"`
	ResponseAuditMissingCites   []string `json:"response_audit_missing_citations"`
}

type CommandResult struct {
	Stdout string
	Stderr string
	Err    error
}

type CommandRunner func(name string, args []string) CommandResult

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

type panelID int

const (
	panelOnboarding panelID = iota
	panelSettings
	panelChat
	panelDaemon
	panelReplay
	panelCount
)

type focusTarget int

const (
	focusMenu focusTarget = iota
	focusProvider
	focusModel
	focusComposer
)

type transcriptEntry struct {
	Role string
	Text string
	Meta string
}

type queuedPrompt struct {
	Text     string
	Provider string
	Model    string
}

type overlayMode int

const (
	overlayNone overlayMode = iota
	overlayPalette
	overlaySlash
	overlayHelp
	overlayQueue
	overlayModel
	overlaySessions
)

type transcriptRefreshMode int

const (
	transcriptRefreshPreserve transcriptRefreshMode = iota
	transcriptRefreshAppend
	transcriptRefreshJumpBottom
)

type menuItem struct {
	title string
	desc  string
	panel panelID
}

func (i menuItem) Title() string       { return i.title }
func (i menuItem) Description() string { return i.desc }
func (i menuItem) FilterValue() string { return i.title + " " + i.desc }

type keyMap struct {
	Up      key.Binding
	Down    key.Binding
	Left    key.Binding
	Right   key.Binding
	PageUp  key.Binding
	PageDn  key.Binding
	Home    key.Binding
	End     key.Binding
	Enter   key.Binding
	Newline key.Binding
	Tab     key.Binding
	Submit  key.Binding
	Palette key.Binding
	Help    key.Binding
	Blur    key.Binding
	Quit    key.Binding
}

func defaultKeyMap() keyMap {
	return keyMap{
		Up: key.NewBinding(
			key.WithKeys("up", "k"),
			key.WithHelp("↑/k", "move"),
		),
		Down: key.NewBinding(
			key.WithKeys("down", "j"),
			key.WithHelp("↓/j", "move"),
		),
		Left: key.NewBinding(
			key.WithKeys("left", "h"),
			key.WithHelp("←/h", "previous provider"),
		),
		Right: key.NewBinding(
			key.WithKeys("right", "l"),
			key.WithHelp("→/l", "next provider"),
		),
		PageUp: key.NewBinding(
			key.WithKeys("pgup"),
			key.WithHelp("pgup", "scroll up"),
		),
		PageDn: key.NewBinding(
			key.WithKeys("pgdown"),
			key.WithHelp("pgdn", "scroll down"),
		),
		Home: key.NewBinding(
			key.WithKeys("home"),
			key.WithHelp("home", "top"),
		),
		End: key.NewBinding(
			key.WithKeys("end"),
			key.WithHelp("end", "bottom"),
		),
		Enter: key.NewBinding(
			key.WithKeys("enter"),
			key.WithHelp("enter", "send"),
		),
		Newline: key.NewBinding(
			key.WithKeys("shift+enter", "alt+enter", "ctrl+j"),
			key.WithHelp("shift+enter", "newline"),
		),
		Tab: key.NewBinding(
			key.WithKeys("tab"),
			key.WithHelp("tab", "complete"),
		),
		Submit: key.NewBinding(
			key.WithKeys("ctrl+s"),
			key.WithHelp("ctrl+s", "send"),
		),
		Palette: key.NewBinding(
			key.WithKeys("ctrl+k"),
			key.WithHelp("ctrl+k", "queue/send next"),
		),
		Help: key.NewBinding(
			key.WithKeys("?"),
			key.WithHelp("?", "help"),
		),
		Blur: key.NewBinding(
			key.WithKeys("esc"),
			key.WithHelp("esc", "close overlay"),
		),
		Quit: key.NewBinding(
			key.WithKeys("q", "ctrl+c"),
			key.WithHelp("q", "quit"),
		),
	}
}

func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Enter, k.Newline, k.Tab, k.PageUp, k.PageDn, k.Palette, k.Blur, k.Quit}
}

func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Enter, k.Newline, k.Tab, k.Palette},
		{k.Up, k.Down, k.Left, k.Right},
		{k.PageUp, k.PageDn, k.Home, k.End},
		{k.Blur, k.Help, k.Quit},
	}
}

type Model struct {
	cfg              Config
	width            int
	height           int
	selected         panelID
	focus            focusTarget
	keys             keyMap
	help             help.Model
	menu             list.Model
	readiness        table.Model
	daemon           table.Model
	replay           table.Model
	transcriptVP     viewport.Model
	providerInput    textinput.Model
	modelInput       textinput.Model
	composer         textarea.Model
	spinner          spinner.Model
	statusMsg        string
	chatBusy         bool
	activePrompt     string
	chatResult       *ChatResult
	chatError        string
	transcript       []transcriptEntry
	queue            []queuedPrompt
	transcriptUnread int
	completionIdx    int
	historyIndex     int
	historyDraft     string
	overlay          overlayMode
	runner           CommandRunner
	// Agent-loop streaming state. Active when tools mode is on; the transcript
	// renders each LoopEvent as it arrives and y/n resolves a pending approval.
	toolsMode        bool
	loopDepth        int
	loopMaxDepth     int
	loopTokens       int
	loopToolCalls    int
	pendingApproval  *ToolCallProposal
	stdinWriter      io.WriteCloser
	streamingCmd     *exec.Cmd
	streamEvents     chan LoopEvent
	assistantBuffer  string
	// UX shell state for the OpenCode-style single surface.
	sidebarOpen      bool
	interruptRequested bool
	quitRequested    bool
}

func NewModel(cfg Config) Model {
	return NewModelWithRunner(cfg, defaultRunner)
}

func NewModelWithRunner(cfg Config, runner CommandRunner) Model {
	items := []list.Item{
		menuItem{"Onboarding", "Workspace readiness and first-run handoff", panelOnboarding},
		menuItem{"Settings", "Provider/model selection with env-only credentials", panelSettings},
		menuItem{"Chat", "Run a real no-tools model turn through the TS provider layer", panelChat},
		menuItem{"Daemon", "Supervisor lifecycle status; no fake background start", panelDaemon},
		menuItem{"Replay / Debug", "Trace replay, audit artifacts, and source docs", panelReplay},
	}
	menu := list.New(items, list.NewDefaultDelegate(), 32, 14)
	menu.Title = "Ether TUI"
	menu.SetShowStatusBar(false)
	menu.SetFilteringEnabled(false)
	menu.SetShowHelp(false)
	menu.DisableQuitKeybindings()

	providerInput := textinput.New()
	providerInput.Prompt = "provider "
	providerInput.Placeholder = "stub | openai_responses | openai_chat_completions | anthropic | gemini"
	providerInput.SetValue(emptyAs(cfg.ModelStatus.ProviderName, "stub"))
	providerInput.SetSuggestions(supportedProviders())
	providerInput.ShowSuggestions = true

	modelInput := textinput.New()
	modelInput.Prompt = "model    "
	modelInput.Placeholder = "model reference"
	modelInput.SetValue(emptyAs(cfg.ModelStatus.ModelRef, "stub-deterministic-v1"))

	composer := textarea.New()
	composer.Prompt = ""
	composer.Placeholder = "Ask Aetherion anything, or type /help"
	composer.DynamicHeight = false
	composer.MinHeight = 4
	composer.MaxHeight = 10
	composer.ShowLineNumbers = false
	composer.SetWidth(88)
	composer.SetHeight(4)
	composer.KeyMap.InsertNewline = key.NewBinding(key.WithKeys("shift+enter", "alt+enter", "ctrl+j"), key.WithHelp("shift+enter", "newline"))

	model := Model{
		cfg:           cfg,
		width:         104,
		height:        34,
		keys:          defaultKeyMap(),
		help:          help.New(),
		menu:          menu,
		transcriptVP:  viewport.New(viewport.WithWidth(88), viewport.WithHeight(20)),
		providerInput: providerInput,
		modelInput:    modelInput,
		composer:      composer,
		spinner:       spinner.New(spinner.WithSpinner(spinner.Line), spinner.WithStyle(lipgloss.NewStyle().Foreground(lipgloss.Color("86")))),
		selected:      panelChat,
		focus:         focusComposer,
		statusMsg:     "ready",
		completionIdx: -1,
		historyIndex:  -1,
		transcript: []transcriptEntry{
			{Role: "intro", Text: "Aetherion Agent", Meta: "session panel"},
		},
		runner:    runner,
		toolsMode: true,
	}
	model.menu.Select(int(panelChat))
	model.applyFocus()
	model.rebuildTables()
	model.refreshTranscript()
	return model
}

func defaultRunner(name string, args []string) CommandResult {
	cmd := exec.Command(name, args...)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	cmd.Env = os.Environ()
	err := cmd.Run()
	return CommandResult{Stdout: stdout.String(), Stderr: stderr.String(), Err: err}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(textinput.Blink, textarea.Blink)
}

type chatFinishedMsg struct {
	result ChatResult
	stderr string
	err    error
}

// loopEventMsg carries one decoded agent-loop event for live rendering.
type loopEventMsg struct {
	event LoopEvent
}

// chatStreamDoneMsg signals the streaming subprocess exited.
type chatStreamDoneMsg struct {
	err error
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	if m.chatBusy {
		nextSpinner, cmd := m.spinner.Update(msg)
		m.spinner = nextSpinner
		cmds = append(cmds, cmd)
	}
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.resize()
	case tea.MouseWheelMsg:
		nextVP, cmd := m.transcriptVP.Update(msg)
		m.transcriptVP = nextVP
		cmds = append(cmds, cmd)
		if m.transcriptVP.AtBottom() {
			m.transcriptUnread = 0
		}
		m.statusMsg = fmt.Sprintf("transcript scroll %d%%", int(m.transcriptVP.ScrollPercent()*100))
	case chatFinishedMsg:
		m.chatBusy = false
		m.activePrompt = ""
		m.chatError = ""
		if msg.err != nil {
			m.chatError = strings.TrimSpace(msg.err.Error() + "\n" + msg.stderr)
			m.statusMsg = "chat failed: provider/config/workspace error"
			m.transcript = append(m.transcript, transcriptEntry{Role: "error", Text: m.chatError, Meta: "provider"})
			if len(m.queue) > 0 {
				m.overlay = overlayQueue
			}
			m.refreshTranscriptAfterAppend()
			return m, tea.Batch(cmds...)
		}
		m.chatResult = &msg.result
		if msg.result.RawOutputPrinted {
			m.transcript = append(m.transcript, transcriptEntry{Role: "assistant", Text: msg.result.OutputText, Meta: fmt.Sprintf("%s / %s", msg.result.ProviderRef, msg.result.ResponseAuditStatus)})
		}
		if len(m.queue) > 0 {
			next := m.queue[0]
			m.queue = m.queue[1:]
			cmds = append(cmds, m.beginChat(next.Text, next.Provider, next.Model, false))
			m.statusMsg = fmt.Sprintf("draining queued prompt: provider=%s remaining=%d", emptyAs(next.Provider, "stub"), len(m.queue))
		} else {
			m.statusMsg = fmt.Sprintf("chat complete: provider=%s audit=%s raw_output_printed=%t", msg.result.ProviderRef, msg.result.ResponseAuditStatus, msg.result.RawOutputPrinted)
		}
		m.refreshTranscriptAfterAppend()
	case loopEventMsg:
		m.applyLoopEvent(msg.event)
		m.refreshTranscriptAfterAppend()
		// Re-arm the stream drain so the next event renders too.
		cmds = append(cmds, drainStreamEvents(&m))
	case chatStreamDoneMsg:
		m.chatBusy = false
		m.activePrompt = ""
		m.pendingApproval = nil
		m.stdinWriter = nil
		m.streamingCmd = nil
		if msg.err != nil {
			m.chatError = msg.err.Error()
			m.statusMsg = "agent loop stream ended with error"
			m.transcript = append(m.transcript, transcriptEntry{Role: "error", Text: m.chatError, Meta: "stream"})
		} else {
			m.statusMsg = fmt.Sprintf("agent loop complete: turns=%d tools=%d tokens=%d", m.loopDepth, m.loopToolCalls, m.loopTokens)
		}
		m.refreshTranscriptAfterAppend()
	case tea.KeyPressMsg:
		switch {
		case isCtrlC(msg):
			// ctrl+c is contextual: quit when idle, interrupt when busy, then quit.
			if m.chatBusy {
				m.interruptRequested = true
				m.statusMsg = "interrupt requested — press ctrl+c again to quit"
				return m, tea.Batch(cmds...)
			}
			if m.interruptRequested {
				return m, tea.Quit
			}
			if strings.TrimSpace(m.composer.Value()) != "" {
				m.composer.Reset()
				m.historyIndex = -1
				m.statusMsg = "composer cleared — ctrl+c again to quit"
				return m, tea.Batch(cmds...)
			}
			return m, tea.Quit
		case isCtrlD(msg):
			return m, tea.Quit
		case m.pendingApproval != nil && (msg.String() == "y" || msg.String() == "Y"):
			m.resolveApproval(true)
			m.statusMsg = "approval: approved"
			m.refreshTranscriptAfterAppend()
			return m, tea.Batch(cmds...)
		case m.pendingApproval != nil && (msg.String() == "n" || msg.String() == "N"):
			m.resolveApproval(false)
			m.statusMsg = "approval: denied"
			m.refreshTranscriptAfterAppend()
			return m, tea.Batch(cmds...)
		case key.Matches(msg, m.keys.Newline):
			updated, cmd := m.updateFocusedInput(msg)
			m = updated
			cmds = append(cmds, cmd)
		case key.Matches(msg, m.keys.Palette) || msg.Keystroke() == "ctrl+k":
			if len(m.queue) > 0 && !m.chatBusy {
				next := m.queue[0]
				m.queue = m.queue[1:]
				cmds = append(cmds, m.beginChat(next.Text, next.Provider, next.Model, false))
				m.statusMsg = fmt.Sprintf("sent queued prompt: remaining=%d", len(m.queue))
			} else if len(m.queue) > 0 {
				m.overlay = overlayQueue
				m.statusMsg = "queue open"
			} else {
				m.toggleOverlay(overlayPalette)
				m.statusMsg = "command palette"
			}
		case key.Matches(msg, m.keys.Help):
			m.toggleOverlay(overlayHelp)
			m.help.ShowAll = !m.help.ShowAll
		case key.Matches(msg, m.keys.Blur):
			if m.overlay != overlayNone {
				m.overlay = overlayNone
				m.focus = focusComposer
				m.applyFocus()
				m.statusMsg = "overlay closed"
			} else {
				m.focus = focusComposer
				m.applyFocus()
				m.statusMsg = "focus=composer"
			}
		case msg.String() == "ctrl+b":
			m.sidebarOpen = !m.sidebarOpen
			m.statusMsg = fmt.Sprintf("sidebar %s", boolAs(m.sidebarOpen, "open", "closed"))
			return m, tea.Batch(cmds...)
		case key.Matches(msg, m.keys.Submit), msg.Keystroke() == "ctrl+s", key.Matches(msg, m.keys.Enter):
			if cmd := m.startChat(); cmd != nil {
				cmds = append(cmds, cmd)
			}
		case key.Matches(msg, m.keys.Tab):
			m.handleTab()
		case m.handleTranscriptNavigation(msg):
		case key.Matches(msg, m.keys.Left) && m.overlay == overlayModel:
			m.cycleProvider(-1)
		case key.Matches(msg, m.keys.Right) && m.overlay == overlayModel:
			m.cycleProvider(1)
		case key.Matches(msg, m.keys.Up) && m.handleCompletionNavigation(-1):
		case key.Matches(msg, m.keys.Down) && m.handleCompletionNavigation(1):
		case m.focus == focusComposer && m.handleComposerNavigation(msg):
		default:
			if m.focus != focusMenu {
				updated, cmd := m.updateFocusedInput(msg)
				m = updated
				cmds = append(cmds, cmd)
				m.syncSlashOverlay()
			}
		}
	}
	return m, tea.Batch(cmds...)
}

func (m *Model) handleTranscriptNavigation(msg tea.KeyPressMsg) bool {
	switch {
	case key.Matches(msg, m.keys.PageUp):
		m.transcriptVP.PageUp()
	case key.Matches(msg, m.keys.PageDn):
		m.transcriptVP.PageDown()
	case key.Matches(msg, m.keys.Home):
		m.transcriptVP.GotoTop()
	case key.Matches(msg, m.keys.End):
		m.transcriptVP.GotoBottom()
	case key.Matches(msg, m.keys.Up) && m.focus == focusComposer && strings.TrimSpace(m.composer.Value()) == "":
		m.transcriptVP.ScrollUp(1)
	case key.Matches(msg, m.keys.Down) && m.focus == focusComposer && strings.TrimSpace(m.composer.Value()) == "":
		m.transcriptVP.ScrollDown(1)
	default:
		return false
	}
	if m.transcriptVP.AtBottom() {
		m.transcriptUnread = 0
	}
	m.statusMsg = fmt.Sprintf("transcript scroll %d%%", int(m.transcriptVP.ScrollPercent()*100))
	return true
}

func (m Model) updateFocusedInput(msg tea.KeyPressMsg) (Model, tea.Cmd) {
	switch m.focus {
	case focusProvider:
		next, cmd := m.providerInput.Update(msg)
		m.providerInput = next
		return m, cmd
	case focusModel:
		next, cmd := m.modelInput.Update(msg)
		m.modelInput = next
		return m, cmd
	case focusComposer:
		next, cmd := m.composer.Update(msg)
		m.composer = next
		return m, cmd
	default:
		return m, nil
	}
}

func (m *Model) handleTab() {
	if command, ok := m.selectedCompletion(); ok {
		m.composer.SetValue(command)
		if command != "/model" {
			m.composer.InsertString(" ")
		}
		m.overlay = overlaySlash
		m.statusMsg = "completion applied: " + command
		return
	}
	if m.overlay == overlayModel {
		if m.focus == focusProvider {
			m.focus = focusModel
		} else {
			m.focus = focusProvider
		}
		m.applyFocus()
		m.statusMsg = "model picker focus=" + focusName(m.focus)
		return
	}
	m.overlay = overlayPalette
	m.statusMsg = "command palette"
}

func (m *Model) handleCompletionNavigation(direction int) bool {
	if m.overlay != overlaySlash && !strings.HasPrefix(strings.TrimSpace(m.composer.Value()), "/") {
		return false
	}
	matches := slashCommandMatches(m.composer.Value())
	if len(matches) == 0 {
		return false
	}
	if m.completionIdx < 0 {
		if direction < 0 {
			m.completionIdx = len(matches) - 1
		} else {
			m.completionIdx = 0
		}
	} else {
		m.completionIdx = (m.completionIdx + direction + len(matches)) % len(matches)
	}
	m.overlay = overlaySlash
	m.statusMsg = fmt.Sprintf("completion %d/%d", m.completionIdx+1, len(matches))
	return true
}

func (m Model) selectedCompletion() (string, bool) {
	matches := slashCommandMatches(m.composer.Value())
	if len(matches) == 0 {
		return "", false
	}
	if m.completionIdx < 0 || m.completionIdx >= len(matches) {
		return matches[0], true
	}
	return matches[m.completionIdx], true
}

func (m *Model) syncSlashOverlay() {
	if strings.HasPrefix(strings.TrimSpace(m.composer.Value()), "/") {
		if m.overlay == overlayNone || m.overlay == overlayPalette {
			m.overlay = overlaySlash
		}
		m.clampCompletion()
		return
	}
	if m.overlay == overlaySlash {
		m.overlay = overlayNone
	}
	m.completionIdx = -1
}

func (m *Model) clampCompletion() {
	matches := slashCommandMatches(m.composer.Value())
	if len(matches) == 0 {
		m.completionIdx = -1
		return
	}
	if m.completionIdx >= len(matches) {
		m.completionIdx = len(matches) - 1
	}
}

func (m *Model) activateSelected() {
	if m.focus != focusMenu {
		return
	}
	if item, ok := m.menu.SelectedItem().(menuItem); ok {
		m.selected = item.panel
	}
	switch m.selected {
	case panelSettings:
		m.focus = focusProvider
		m.statusMsg = "editing provider"
	case panelChat:
		m.focus = focusComposer
		m.statusMsg = "editing chat composer"
	default:
		m.statusMsg = fmt.Sprintf("selected=%s", panelName(m.selected))
	}
	m.applyFocus()
}

func (m *Model) advanceFocus() {
	switch m.selected {
	case panelSettings:
		if m.focus == focusProvider {
			m.focus = focusModel
		} else {
			m.focus = focusProvider
		}
	case panelChat:
		if m.focus == focusComposer {
			m.focus = focusProvider
		} else if m.focus == focusProvider {
			m.focus = focusModel
		} else {
			m.focus = focusComposer
		}
	default:
		m.selected = panelID((int(m.selected) + 1) % int(panelCount))
		m.menu.Select(int(m.selected))
		m.focus = focusMenu
	}
	m.applyFocus()
	m.statusMsg = fmt.Sprintf("focus=%s panel=%s", focusName(m.focus), panelName(m.selected))
}

func (m *Model) toggleOverlay(next overlayMode) {
	if m.overlay == next {
		m.overlay = overlayNone
		return
	}
	m.overlay = next
}

func (m *Model) applyFocus() {
	m.providerInput.Blur()
	m.modelInput.Blur()
	m.composer.Blur()
	switch m.focus {
	case focusProvider:
		_ = m.providerInput.Focus()
	case focusModel:
		_ = m.modelInput.Focus()
	case focusComposer:
		_ = m.composer.Focus()
	}
}

func (m *Model) cycleProvider(offset int) {
	providers := supportedProviders()
	current := strings.TrimSpace(m.providerInput.Value())
	index := 0
	for i, provider := range providers {
		if provider == current {
			index = i
			break
		}
	}
	index = (index + offset + len(providers)) % len(providers)
	m.providerInput.SetValue(providers[index])
	m.modelInput.SetValue(defaultModelForProvider(providers[index]))
	m.statusMsg = fmt.Sprintf("provider=%s model=%s", providers[index], m.modelInput.Value())
}

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
		m.queue = append(m.queue, queuedPrompt{Text: task, Provider: provider, Model: modelRef})
		m.composer.Reset()
		m.historyIndex = -1
		m.overlay = overlayQueue
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
	if resetComposer {
		m.composer.Reset()
	}
	m.historyIndex = -1
	m.historyDraft = ""
	m.completionIdx = -1
	m.transcriptUnread = 0
	m.overlay = overlayNone
	m.refreshTranscriptToBottom()
	// When tools mode is on, launch the streaming agent-loop subprocess and
	// drain JSON-lines events. Otherwise fall back to the one-shot runner path
	// (used by tests with an injected CommandRunner mock).
	if m.toolsMode {
		m.statusMsg = fmt.Sprintf("agent loop running: provider=%s model=%s", emptyAs(provider, "stub"), emptyAs(modelRef, "default"))
		updated, drainCmd := runStreamingChatCommand(*m, m.cfg.Snapshot.WorkspaceRoot, task, provider, modelRef)
		*m = updated
		return drainCmd
	}
	m.statusMsg = fmt.Sprintf("chat running: provider=%s model=%s", emptyAs(provider, "stub"), emptyAs(modelRef, "default"))
	return runChatCommand(m.runner, m.cfg.Snapshot.WorkspaceRoot, task, provider, modelRef)
}

func (m *Model) handleComposerNavigation(msg tea.KeyPressMsg) bool {
	switch msg.String() {
	case "up":
		return m.browseHistory(-1)
	case "down":
		return m.browseHistory(1)
	default:
		return false
	}
}

func (m *Model) browseHistory(direction int) bool {
	if strings.TrimSpace(m.composer.Value()) == "" && m.historyIndex == -1 {
		return false
	}
	if strings.Contains(m.composer.Value(), "\n") {
		return false
	}
	history := m.userHistory()
	if len(history) == 0 {
		return false
	}
	if direction < 0 {
		if m.historyIndex == -1 {
			m.historyDraft = m.composer.Value()
			m.historyIndex = len(history) - 1
		} else if m.historyIndex > 0 {
			m.historyIndex--
		}
		m.composer.SetValue(history[m.historyIndex])
		m.statusMsg = fmt.Sprintf("history %d/%d", len(history)-m.historyIndex, len(history))
		return true
	}
	if m.historyIndex == -1 {
		return false
	}
	if m.historyIndex < len(history)-1 {
		m.historyIndex++
		m.composer.SetValue(history[m.historyIndex])
		m.statusMsg = fmt.Sprintf("history %d/%d", len(history)-m.historyIndex, len(history))
	} else {
		m.historyIndex = -1
		m.composer.SetValue(m.historyDraft)
		m.historyDraft = ""
		m.statusMsg = "history restored draft"
	}
	return true
}

func (m Model) userHistory() []string {
	history := make([]string, 0)
	for _, entry := range m.transcript {
		if entry.Role == "user" && strings.TrimSpace(entry.Text) != "" {
			history = append(history, entry.Text)
		}
	}
	return history
}

func (m *Model) handleSlashCommand(command string) {
	fields := strings.Fields(command)
	if len(fields) == 0 {
		return
	}
	switch fields[0] {
	case "/exit", "/quit":
		m.statusMsg = "slash=/exit"
		m.composer.Reset()
		m.completionIdx = -1
		// Signal quit via a sentinel the caller checks; tea.Quit is returned by
		// the Update caller, so we mark a flag and the key path issues Quit.
		m.quitRequested = true
		return
	case "/connect":
		m.overlay = overlayNone
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: connectGuidance(m), Meta: "connect"})
		m.statusMsg = "slash=/connect"
	case "/sidebar":
		m.sidebarOpen = !m.sidebarOpen
		m.statusMsg = fmt.Sprintf("sidebar %s", boolAs(m.sidebarOpen, "open", "closed"))
	case "/help":
		m.overlay = overlayHelp
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "Opened help overlay.", Meta: "slash"})
		m.statusMsg = "slash=/help"
	case "/settings":
		m.focus = focusProvider
		m.applyFocus()
		m.overlay = overlayModel
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "Opened model/settings overlay. Provider and model are session-scoped; credentials stay environment-only.", Meta: "settings"})
		m.statusMsg = "slash=/settings"
	case "/chat":
		m.focus = focusComposer
		m.applyFocus()
		m.overlay = overlayNone
		m.statusMsg = "slash=/chat"
	case "/status":
		m.overlay = overlayNone
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: statusReport(m), Meta: "status"})
		m.statusMsg = "slash=/status"
	case "/model":
		if len(fields) >= 2 {
			m.modelInput.SetValue(fields[1])
		}
		m.overlay = overlayModel
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: fmt.Sprintf("provider=%s model=%s credential_resolved=%t", m.providerInput.Value(), m.modelInput.Value(), m.cfg.ModelStatus.CredentialResolved), Meta: "model"})
		m.statusMsg = "slash=/model"
	case "/clear":
		m.overlay = overlayNone
		m.chatResult = nil
		m.chatError = ""
		m.transcriptUnread = 0
		m.transcript = []transcriptEntry{{Role: "intro", Text: "Aetherion Agent", Meta: "welcome"}, {Role: "system", Text: "Transcript cleared. Governance artifacts already written by completed runs are not deleted.", Meta: "local"}}
		m.statusMsg = "slash=/clear"
	case "/new":
		m.chatResult = nil
		m.chatError = ""
		m.queue = nil
		m.overlay = overlaySessions
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "Started a fresh local TUI session view. Workspace ledger history remains intact.", Meta: "local"})
		m.statusMsg = "slash=/new"
	case "/queue":
		m.overlay = overlayQueue
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: queueText(m.queue), Meta: "queue"})
		m.statusMsg = "slash=/queue"
	case "/sessions", "/switch":
		m.overlay = overlaySessions
		m.statusMsg = "slash=/sessions"
	default:
		m.overlay = overlaySlash
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "Unknown slash command. Try /help.", Meta: "slash"})
		m.statusMsg = "slash=unknown"
	}
	m.composer.Reset()
	m.completionIdx = -1
}

func runChatCommand(runner CommandRunner, workspaceRoot, task, provider, modelRef string) tea.Cmd {
	return func() tea.Msg {
		args := []string{
			"packages/tui/src/cli.ts",
			"model",
			"chat",
			"--workspace",
			workspaceRoot,
			"--content",
			task,
		}
		if provider != "" {
			args = append(args, "--model-provider", provider)
		}
		if modelRef != "" {
			args = append(args, "--model", modelRef)
		}
		result := runner("node", args)
		if result.Err != nil {
			return chatFinishedMsg{stderr: result.Stderr, err: result.Err}
		}
		var parsed ChatResult
		if err := json.Unmarshal([]byte(result.Stdout), &parsed); err != nil {
			return chatFinishedMsg{stderr: result.Stderr, err: fmt.Errorf("parse model chat JSON: %w", err)}
		}
		return chatFinishedMsg{result: parsed, stderr: result.Stderr}
	}
}

// runStreamingChatCommand launches the TS agent-loop subprocess with a piped
// stdin (for approvals) and stdout (for JSON-lines events). It returns a tea.Cmd
// that scans stdout line by line, emitting one loopEventMsg per event and a
// terminal chatStreamDoneMsg. The caller stores the stdin writer on the Model
// so approval keys can write decisions back.
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
	cmd.Env = os.Environ()
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

	// The scanner goroutine copies decoded events into a buffered channel. The
	// drainCmd reads one event at a time (returning loopEventMsg) and is re-armed
	// after each Update so the stream renders incrementally.
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
// updates loop counters. Called from the loopEventMsg case in Update.
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
		m.transcript = append(m.transcript, transcriptEntry{
			Role: "approval",
			Text: fmt.Sprintf("⚠️ Approve %s on %s? [%s] [y/n]", event.Proposal.ToolName, shortPath(event.Proposal.Path), event.Proposal.RiskLevel),
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
}

// resolveApproval writes the y/n decision to the subprocess stdin and clears the
// pending approval card. Called when the user presses y or n during a proposal.
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

func shortPath(path string) string {
	if len(path) <= 48 {
		return path
	}
	return "…" + path[len(path)-47:]
}

func previewResult(result string) string {
	if len(result) <= 240 {
		return result
	}
	return result[:240] + "\n…[truncated]"
}

func (m Model) View() tea.View {
	view := tea.NewView(m.render())
	view.AltScreen = true
	view.ReportFocus = true
	view.MouseMode = tea.MouseModeCellMotion
	return view
}

func (m Model) StaticView() string {
	return stripANSI(m.render()) + "\n"
}

func (m *Model) resize() {
	if m.width < 80 {
		m.width = 80
	}
	if m.height < 24 {
		m.height = 24
	}
	contentWidth := max(72, m.width-4)
	composerHeight := min(8, max(4, m.height/5))
	chromeHeight := 10 + composerHeight
	transcriptHeight := max(6, m.height-chromeHeight)
	m.menu.SetSize(min(42, contentWidth), max(8, transcriptHeight-4))
	m.help.SetWidth(m.width)
	m.providerInput.SetWidth(max(24, contentWidth-18))
	m.modelInput.SetWidth(max(24, contentWidth-18))
	m.composer.SetWidth(max(36, contentWidth-6))
	m.composer.SetHeight(composerHeight)
	m.transcriptVP.SetWidth(contentWidth)
	m.transcriptVP.SetHeight(transcriptHeight)
	m.rebuildTables()
	m.refreshTranscript()
}

func (m *Model) rebuildTables() {
	panelWidth := max(60, m.width-40)
	panelHeight := max(8, m.height-18)
	m.readiness = makeTable(panelWidth, panelHeight, []table.Column{
		{Title: "Signal", Width: 26},
		{Title: "Evidence", Width: panelWidth - 30},
	}, []table.Row{
		{"status", m.cfg.Snapshot.Status},
		{"workspace", m.cfg.Snapshot.WorkspaceRoot},
		{"toolchain", m.cfg.Snapshot.ReadinessLayers.ToolchainReady},
		{"repo", m.cfg.Snapshot.ReadinessLayers.RepoReady},
		{"runtime", m.cfg.Snapshot.ReadinessLayers.WorkspaceRuntime},
		{"checks", fmt.Sprintf("pass:%d warn:%d fail:%d n/a:%d", m.cfg.Snapshot.Summary.Pass, m.cfg.Snapshot.Summary.Warn, m.cfg.Snapshot.Summary.Fail, m.cfg.Snapshot.Summary.NotApplicable)},
		{"first model turn", m.cfg.LLMReadLoopCommand},
	})
	m.daemon = makeTable(panelWidth, panelHeight, []table.Column{
		{Title: "Lifecycle", Width: 28},
		{Title: "Status", Width: panelWidth - 32},
	}, []table.Row{
		{"background daemon", "not implemented; this TUI does not start or keep a resident process"},
		{"status check", "use supervisor status/preflight for read-only evidence"},
		{"start/stop", "fail-closed unsupported lifecycle command in V1"},
		{"authority", "Local Supervisor remains root authority; TUI cannot issue leases"},
		{"operator next step", m.cfg.DoctorCommand},
	})
	m.replay = makeTable(panelWidth, panelHeight, []table.Column{
		{Title: "Debug", Width: 24},
		{Title: "Evidence", Width: panelWidth - 28},
	}, replayRows(m.cfg))
}

func makeTable(width, height int, cols []table.Column, rows []table.Row) table.Model {
	t := table.New(
		table.WithColumns(cols),
		table.WithRows(rows),
		table.WithWidth(width),
		table.WithHeight(height),
		table.WithFocused(true),
	)
	styles := table.DefaultStyles()
	styles.Header = styles.Header.Bold(true).Foreground(lipgloss.Color("86"))
	styles.Selected = styles.Selected.Foreground(lipgloss.Color("229")).Background(lipgloss.Color("57")).Bold(false)
	t.SetStyles(styles)
	return t
}

func replayRows(cfg Config) []table.Row {
	rows := []table.Row{
		{"replay command", "npm run ether -- replay <run_id> --workspace " + quote(cfg.Snapshot.WorkspaceRoot)},
		{"trace command", "npm run ether -- trace <run_id> --workspace " + quote(cfg.Snapshot.WorkspaceRoot)},
		{"boundary command", "npm run ether -- boundary <run_id> --workspace " + quote(cfg.Snapshot.WorkspaceRoot)},
		{"source docs", strings.Join(sourceDocPaths(cfg.Snapshot.SourceDocuments), ", ")},
	}
	if len(cfg.Snapshot.Deferred) > 0 {
		rows = append(rows, table.Row{"deferred", strings.Join(cfg.Snapshot.Deferred, ", ")})
	}
	return rows
}

func (m *Model) refreshTranscript() {
	m.refreshTranscriptView(transcriptRefreshPreserve)
}

func (m *Model) refreshTranscriptAfterAppend() {
	m.refreshTranscriptView(transcriptRefreshAppend)
}

func (m *Model) refreshTranscriptToBottom() {
	m.refreshTranscriptView(transcriptRefreshJumpBottom)
}

func (m *Model) refreshTranscriptView(mode transcriptRefreshMode) {
	oldOffset := m.transcriptVP.YOffset()
	oldLines := m.transcriptVP.TotalLineCount()
	wasAtBottom := m.transcriptVP.AtBottom()

	m.transcriptVP.SetContent(m.renderTranscriptContent())
	if len(m.transcript) <= 1 && !m.chatBusy && m.chatResult == nil && m.chatError == "" {
		m.transcriptUnread = 0
		m.transcriptVP.GotoTop()
		return
	}
	if mode == transcriptRefreshJumpBottom || wasAtBottom || oldLines == 0 {
		m.transcriptUnread = 0
		m.transcriptVP.GotoBottom()
		return
	}
	m.transcriptVP.SetYOffset(oldOffset)
	if mode == transcriptRefreshAppend {
		m.transcriptUnread++
	}
}

func (m Model) render() string {
	top := m.topBrand()
	composer := m.composerZone()
	status := m.statusRule()
	body := m.transcriptWithOverlay()
	// When the sidebar is open, split the body horizontally: conversation left,
	// sidebar right.
	if m.sidebarOpen {
		sidebar := m.sidebarView()
		joined := lipgloss.JoinHorizontal(lipgloss.Top, body, sidebar)
		return lipgloss.JoinVertical(lipgloss.Left, top, joined, composer, status)
	}
	return lipgloss.JoinVertical(lipgloss.Left, top, body, composer, status)
}

func (m Model) transcriptWithOverlay() string {
	body := m.transcriptVP.View()
	overlay := m.overlayView()
	if overlay == "" {
		return body
	}
	return placeOverlayBottom(body, overlay, m.transcriptVP.Width())
}

func (m Model) topBrand() string {
	theme := styles()
	title := theme.title.Render("✦ AETHERION")
	// Single contextual line: provider/model, credential state, workspace.
	provider := emptyAs(m.providerInput.Value(), "stub")
	modelRef := emptyAs(m.modelInput.Value(), "stub-deterministic-v1")
	credOk := credentialPresent(provider)
	cred := theme.status.Render("credential ✓")
	if !credOk && provider != "stub" {
		cred = theme.warn.Render("credential ✗ — /connect")
	}
	model := theme.meta.Render(fmt.Sprintf("%s / %s", provider, modelRef))
	tools := theme.muted.Render("tools on")
	ws := theme.muted.Render("· " + compactPath(m.cfg.Snapshot.WorkspaceRoot, max(16, m.width-60)))
	if m.sidebarOpen {
		ws = theme.muted.Render("· sidebar ⦉")
	}
	return lipgloss.JoinHorizontal(lipgloss.Left, title, "  ", model, "  ", cred, "  ", tools, "  ", ws)
}

// credentialPresent reports whether the active provider's credential env var is
// set in the current process environment. The stub needs none.
func credentialPresent(provider string) bool {
	if canonicalProvider(provider) == "stub" {
		return true
	}
	for _, name := range providerCredentialEnv(provider) {
		if v := os.Getenv(name); strings.TrimSpace(v) != "" {
			return true
		}
	}
	return false
}

// sidebarView renders the toggleable right column: model/credential, loop
// stats, readiness summary, and queue preview. OpenCode-style.
func (m Model) sidebarView() string {
	theme := styles()
	width := max(26, m.width/3)
	var sections []string

	// Model + credential
	provider := emptyAs(m.providerInput.Value(), "stub")
	modelRef := emptyAs(m.modelInput.Value(), "stub-deterministic-v1")
	cred := "✓"
	if !credentialPresent(provider) {
		cred = "✗"
	}
	sections = append(sections, theme.sectionTitle.Render("Model"))
	sections = append(sections, theme.meta.Render(fmt.Sprintf("%s / %s", provider, modelRef)))
	sections = append(sections, theme.muted.Render("credential "+cred+"  tools on"))

	// Agent-loop stats
	sections = append(sections, "")
	sections = append(sections, theme.sectionTitle.Render("Loop"))
	stats := "idle"
	if m.chatBusy {
		stats = fmt.Sprintf("running turn %d/%d", m.loopDepth, m.loopMaxDepth)
	}
	sections = append(sections, theme.meta.Render(stats))
	sections = append(sections, theme.muted.Render(fmt.Sprintf("tool calls %d · tokens %d", m.loopToolCalls, m.loopTokens)))
	if len(m.queue) > 0 {
		sections = append(sections, theme.warn.Render(fmt.Sprintf("queued %d", len(m.queue))))
	}

	// Readiness summary (from the snapshot data already on the config)
	sections = append(sections, "")
	sections = append(sections, theme.sectionTitle.Render("Readiness"))
	snap := m.cfg.Snapshot
	sections = append(sections, theme.muted.Render(fmt.Sprintf("toolchain %s · repo %s", snap.ReadinessLayers.ToolchainReady, snap.ReadinessLayers.RepoReady)))
	sections = append(sections, theme.muted.Render(fmt.Sprintf("checks pass:%d warn:%d fail:%d", snap.Summary.Pass, snap.Summary.Warn, snap.Summary.Fail)))

	body := strings.Join(sections, "\n")
	return theme.overlay.Width(width).Render(body)
}

func (m Model) composerZone() string {
	theme := styles()
	rows := []string{}
	if queue := queuePreview(m.queue, max(24, m.width-8)); queue != "" {
		rows = append(rows, queue)
	}
	if m.chatBusy {
		rows = append(rows, m.streamingPreview())
	}
	prompt := theme.prompt.Render("❯")
	if strings.HasPrefix(strings.TrimSpace(m.composer.Value()), "!") {
		prompt = theme.prompt.Render("$")
	}
	composer := lipgloss.JoinHorizontal(lipgloss.Top, prompt+" ", m.composer.View())
	rows = append(rows, theme.composerBox.Width(max(40, m.width-2)).Render(composer))
	if m.overlay == overlayModel {
		rows = append(rows, theme.modelFields.Render(strings.Join([]string{m.providerInput.View(), m.modelInput.View()}, "\n")))
	}
	if strings.TrimSpace(m.composer.Value()) == "" && m.overlay == overlayNone {
		rows = append(rows, theme.muted.Render(`Try "/help" for commands · PgUp/PgDn scroll transcript · Shift+Enter newline`))
	}
	return strings.Join(rows, "\n")
}

func (m Model) renderTranscriptContent() string {
	rows := []string{}
	for _, entry := range m.transcript {
		switch entry.Role {
		case "intro":
			rows = append(rows, m.introPanel())
		default:
			rows = append(rows, messageBlock(entry))
		}
	}
	if m.chatBusy {
		rows = append(rows, messageBlock(transcriptEntry{Role: "assistant", Text: fmt.Sprintf("%s streaming/status: provider call running. Response and audit artifacts will remain hash-only until completion.", m.spinner.View()), Meta: "running"}))
	}
	if m.chatError != "" {
		rows = append(rows, messageBlock(transcriptEntry{Role: "error", Text: compactWhitespace(m.chatError), Meta: "provider"}))
	}
	if m.chatResult != nil {
		rows = append(rows, m.resultPanel())
	}
	return strings.Join(rows, "\n\n")
}

func (m Model) introPanel() string {
	theme := styles()
	width := max(42, min(86, m.width-8))
	provider := emptyAs(m.providerInput.Value(), "stub")
	modelRef := emptyAs(m.modelInput.Value(), "stub-deterministic-v1")
	cred := "credential ✓"
	if !credentialPresent(provider) && provider != "stub" {
		cred = theme.warn.Render("credential ✗ — type /connect to set up")
	}
	lines := []string{
		centerText("✦ Aetherion", width-4),
		"",
		theme.muted.Render("Local-first agent harness. Read and write files in this workspace through an"),
		theme.muted.Render("approval-gated tool loop. Model output never authorizes actions on its own."),
		"",
		theme.meta.Render(fmt.Sprintf("provider %s · model %s · %s", provider, modelRef, cred)),
		"",
		theme.sectionTitle.Render("Get started"),
		theme.meta.Render("  /connect    set up a provider credential"),
		theme.meta.Render("  /model      pick a provider + model"),
		theme.meta.Render("  type a message and press enter to start"),
		"",
		theme.muted.Render("enter send · shift+enter newline · ctrl+b sidebar · /help · ctrl+c quit"),
	}
	return theme.sessionPanel.Width(width).Render(strings.Join(lines, "\n"))
}

func (m Model) resultPanel() string {
	if m.chatResult == nil {
		return ""
	}
	lines := []string{
		kv("provider", m.chatResult.ProviderRef),
		kv("model", m.chatResult.ModelRef),
		kv("source run", m.chatResult.SourceRunID),
		kv("response", m.chatResult.ResponseID),
		kv("audit", fmt.Sprintf("%s evidence=%s", m.chatResult.ResponseAuditStatus, m.chatResult.ResponseAuditEvidenceStatus)),
		kv("authority", fmt.Sprintf("tools_requested=%t runtime_authority_granted=%t", m.chatResult.ToolsRequested, m.chatResult.RuntimeAuthorityGranted)),
		kv("raw output", fmt.Sprintf("printed=%t persisted=false sha256=%s", m.chatResult.RawOutputPrinted, m.chatResult.OutputTextSHA256)),
	}
	return styles().result.Render("Response Evidence\n" + strings.Join(lines, "\n"))
}

func (m Model) streamingPreview() string {
	if !m.chatBusy {
		return ""
	}
	theme := styles()
	if m.toolsMode {
		approval := ""
		if m.pendingApproval != nil {
			approval = " · ⚠️ awaiting approval [y/n]"
		}
		text := fmt.Sprintf("%s agent loop · turn %d/%d · tools %d · tokens %d · %s%s",
			m.spinner.View(),
			m.loopDepth, m.loopMaxDepth,
			m.loopToolCalls, m.loopTokens,
			truncateForPanel(m.activePrompt, 64),
			approval)
		if m.pendingApproval != nil {
			return theme.warn.Render(text)
		}
		return theme.streaming.Render(text)
	}
	text := fmt.Sprintf("%s streaming/status: provider call running · active prompt=%s · response/audit artifacts hash-only", m.spinner.View(), truncateForPanel(m.activePrompt, 96))
	return theme.streaming.Render(text)
}

func (m Model) statusRule() string {
	theme := styles()
	// Contextual one-line footer (OpenCode style). The body changes by state.
	var text string
	switch {
	case m.pendingApproval != nil:
		text = "⚠ approve " + m.pendingApproval.ToolName + "?  [y] yes  [n] no  · esc cancel"
	case m.chatBusy:
		tools := fmt.Sprintf("turn %d/%d · tools %d · tokens %d", m.loopDepth, m.loopMaxDepth, m.loopToolCalls, m.loopTokens)
		text = "⏺ running " + tools + " · esc interrupt · ctrl+c quit"
	case m.chatError != "":
		text = "✗ error: " + truncateInline(m.chatError, m.width-24) + " · /clear · ctrl+c quit"
	case strings.TrimSpace(m.composer.Value()) != "":
		text = "enter send · shift+enter newline · ctrl+c quit"
	default:
		if m.sidebarOpen {
			text = "enter send · shift+enter newline · /help · ctrl+b hide sidebar · ctrl+c quit"
		} else {
			text = "enter send · shift+enter newline · /help · /connect · ctrl+b sidebar · ctrl+c quit"
		}
	}
	// When there are unread transcript lines (scrolled up), surface a marker so
	// the user knows new content arrived below the viewport.
	if m.transcriptUnread > 0 {
		text = fmt.Sprintf("↓ unread %d · ", m.transcriptUnread) + text
	}
	return theme.statusRule.Width(max(76, m.width)).Render(text)
}

func transcriptScrollLabel(m Model) string {
	label := fmt.Sprintf("scroll %d%%", int(m.transcriptVP.ScrollPercent()*100))
	if m.transcriptUnread > 0 {
		label += fmt.Sprintf(" unread %d", m.transcriptUnread)
	}
	return label
}

func (m Model) overlayView() string {
	if m.overlay == overlayNone && !strings.HasPrefix(strings.TrimSpace(m.composer.Value()), "/") {
		return ""
	}
	title := "Slash Commands"
	body := completionOverlay(m.composer.Value(), m.completionIdx)
	switch m.overlay {
	case overlayPalette:
		title = "Command Palette"
		body = strings.Join([]string{
			"/chat       focus transcript composer",
			"/connect    set up a provider credential",
			"/model      model picker and credential status",
			"/sidebar    toggle the right sidebar",
			"/sessions   local session switcher",
			"/queue      queued prompt overlay",
			"/status     daemon/supervisor boundary",
			"/clear      clear visible transcript",
			"/new        start a fresh local session view",
			"/exit       quit the TUI",
		}, "\n")
	case overlayHelp:
		title = "Help"
		body = strings.Join(slashHelp(), "\n")
	case overlayQueue:
		title = "Queue"
		body = queueText(m.queue)
	case overlayModel:
		title = "Model Picker"
		current := canonicalProvider(strings.TrimSpace(m.providerInput.Value()))
		providerRows := []string{}
		for _, p := range supportedProviders() {
			marker := "  "
			if canonicalProvider(p) == current {
				marker = "▸ "
			}
			cred := "✗"
			if credentialPresent(p) {
				cred = "✓"
			}
			providerRows = append(providerRows, fmt.Sprintf("%s%-26s credential %s", marker, p, cred))
		}
		body = strings.Join([]string{
			strings.Join(providerRows, "\n"),
			"",
			"current model: " + m.modelInput.Value(),
			"← / →  cycle provider    /model <ref>  set model",
			"/connect for credential setup",
		}, "\n")
	case overlaySessions:
		title = "Session Switcher"
		body = strings.Join([]string{
			"current local session: active",
			"visible transcript entries: " + fmt.Sprint(len(m.transcript)),
			"queued prompts: " + fmt.Sprint(len(m.queue)),
			"new session views do not delete Event Ledger history",
		}, "\n")
	case overlaySlash:
		title = "Slash Commands"
	default:
		if strings.HasPrefix(strings.TrimSpace(m.composer.Value()), "/") {
			title = "Slash Commands"
		}
	}
	width := max(28, min(72, m.transcriptVP.Width()-4))
	return styles().overlay.Width(width).Render(styles().sectionTitle.Render(title) + "\n" + body)
}

func placeOverlayBottom(base, overlay string, width int) string {
	if strings.TrimSpace(overlay) == "" {
		return base
	}
	baseLines := strings.Split(base, "\n")
	overlayLines := strings.Split(overlay, "\n")
	if len(baseLines) == 0 || len(overlayLines) == 0 {
		return base
	}
	if len(overlayLines) > len(baseLines) {
		overlayLines = overlayLines[len(overlayLines)-len(baseLines):]
	}
	start := len(baseLines) - len(overlayLines)
	placed := strings.Split(lipgloss.PlaceHorizontal(width, lipgloss.Left, strings.Join(overlayLines, "\n")), "\n")
	for i := range placed {
		if start+i >= len(baseLines) {
			break
		}
		baseLines[start+i] = placed[i]
	}
	return strings.Join(baseLines, "\n")
}

func section(title, desc, body string) string {
	s := styles()
	return s.sectionTitle.Render(title) + "\n" + s.muted.Render(desc) + "\n\n" + body
}

func kv(name, value string) string {
	if value == "" {
		value = "not_recorded"
	}
	return fmt.Sprintf("%-20s %s", name, value)
}

func transcriptView(entries []transcriptEntry, maxEntries int, width int) string {
	s := styles()
	if len(entries) == 0 {
		return s.muted.Render("No transcript entries yet.")
	}
	start := 0
	if len(entries) > maxEntries {
		start = len(entries) - maxEntries
	}
	rendered := make([]string, 0, len(entries)-start)
	for _, entry := range entries[start:] {
		label := strings.ToUpper(entry.Role)
		if entry.Meta != "" {
			label += " " + entry.Meta
		}
		text := truncateForPanel(entry.Text, max(160, width*4))
		rendered = append(rendered, s.transcript.Render(label+"\n"+text))
	}
	return strings.Join(rendered, "\n")
}

func queuePreview(queue []queuedPrompt, width int) string {
	if len(queue) == 0 {
		return ""
	}
	rows := []string{styles().muted.Render(fmt.Sprintf("queued (%d)  Esc closes overlays", len(queue)))}
	limit := min(len(queue), 3)
	for i := 0; i < limit; i++ {
		rows = append(rows, fmt.Sprintf("  %d. %s", i+1, truncateForPanel(queue[i].Text, max(24, width-8))))
	}
	if len(queue) > limit {
		rows = append(rows, fmt.Sprintf("  ...and %d more", len(queue)-limit))
	}
	return strings.Join(rows, "\n") + "\n"
}

func completionOverlay(value string, selected int) string {
	trimmed := strings.TrimSpace(value)
	matches := slashCommandMatches(trimmed)
	if len(matches) == 0 {
		matches = slashCommands()
	}
	rows := []string{styles().badge.Render(" completions ")}
	for i, command := range matches {
		prefix := "  "
		if i == selected || selected < 0 && i == 0 {
			prefix = "› "
		}
		rows = append(rows, prefix+command+"  "+slashDescription(command))
	}
	return strings.Join(rows, "\n")
}

func slashCommandMatches(value string) []string {
	trimmed := strings.TrimSpace(value)
	if !strings.HasPrefix(trimmed, "/") {
		return nil
	}
	matches := make([]string, 0)
	for _, command := range slashCommands() {
		if strings.HasPrefix(command, trimmed) || strings.HasPrefix(trimmed, command) {
			matches = append(matches, command)
		}
	}
	if len(matches) == 0 && trimmed != "" {
		return []string{"/help"}
	}
	return matches
}

func slashCommands() []string {
	return []string{"/help", "/chat", "/settings", "/model", "/status", "/queue", "/sessions", "/clear", "/new"}
}

func slashDescription(command string) string {
	switch command {
	case "/help":
		return "Show available commands"
	case "/chat":
		return "Focus the composer"
	case "/settings":
		return "Open provider/model settings"
	case "/model":
		return "Inspect or set the model"
	case "/status":
		return "Show boundary/status report"
	case "/queue":
		return "Preview queued prompts"
	case "/sessions":
		return "Open session switcher"
	case "/clear":
		return "Clear visible transcript"
	case "/new":
		return "Start a fresh local session view"
	default:
		return ""
	}
}

func slashHelp() []string {
	return []string{
		"/help      show local TUI commands",
		"/chat      focus the transcript composer",
		"/connect   set up a provider credential (env-var guidance)",
		"/model     pick a provider + model; optional: /model <model_ref>",
		"/settings  jump to provider/model settings",
		"/sidebar   toggle the right sidebar (ctrl+b)",
		"/status    show daemon/supervisor status boundary",
		"/queue     preview local pending provider turn queue",
		"/sessions  open local session switcher overlay",
		"/clear     clear visible transcript only",
		"/new       start a fresh local TUI session view",
		"/exit      quit the TUI (also ctrl+c / ctrl+d)",
	}
}

func queueText(queue []queuedPrompt) string {
	if len(queue) == 0 {
		return "queue empty; no provider call is currently pending"
	}
	rows := make([]string, 0, len(queue))
	for i, item := range queue {
		rows = append(rows, fmt.Sprintf("%d. provider=%s model=%s text=%s", i+1, emptyAs(item.Provider, "stub"), emptyAs(item.Model, "default"), item.Text))
	}
	return strings.Join(rows, "\n")
}

func isCtrlC(msg tea.KeyPressMsg) bool {
	return msg.String() == "ctrl+c" || msg.Keystroke() == "ctrl+c"
}

func isCtrlD(msg tea.KeyPressMsg) bool {
	return msg.String() == "ctrl+d" || msg.Keystroke() == "ctrl+d"
}

func statusReport(m *Model) string {
	lines := []string{
		"daemon_running=false",
		"daemon_start_supported=false",
		"background_resident=false",
		"runtime_authority_granted=false",
		"tools_allowed=false",
		"model_output_authorizes=false",
		"local_supervisor=root_authority",
		"policy_decision_required_for_tools=true",
		"scoped_lease_required_for_side_effects=true",
		"provider=" + emptyAs(m.providerInput.Value(), "stub"),
		"model=" + emptyAs(m.modelInput.Value(), "stub-deterministic-v1"),
		fmt.Sprintf("credential_resolved=%t", m.cfg.ModelStatus.CredentialResolved),
		"onboarding=" + emptyAs(m.cfg.OnboardingCommand, "not_recorded"),
		"doctor=" + emptyAs(m.cfg.DoctorCommand, "not_recorded"),
	}
	return strings.Join(lines, "\n")
}

// providerCredentialEnv maps a provider name to the env vars that satisfy its
// credential, mirroring cli.ts credentialEnvRefsForProvider.
func providerCredentialEnv(provider string) []string {
	switch canonicalProvider(provider) {
	case "openai_responses", "openai_chat_completions":
		return []string{"OPENAI_API_KEY", "OPENAI_OAUTH_ACCESS_TOKEN"}
	case "anthropic":
		return []string{"ANTHROPIC_API_KEY"}
	case "gemini":
		return []string{"GEMINI_API_KEY", "GOOGLE_API_KEY", "GEMINI_OAUTH_ACCESS_TOKEN", "GOOGLE_OAUTH_ACCESS_TOKEN"}
	default:
		return nil
	}
}

func canonicalProvider(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.ReplaceAll(normalized, "-", "_")
	normalized = strings.ReplaceAll(normalized, " ", "_")
	switch normalized {
	case "openai", "openai_response", "openai_responses", "responses":
		return "openai_responses"
	case "openai_chat", "openai_chat_completion", "openai_chat_completions",
		"openai_completion", "openai_completions", "chat_completions":
		return "openai_chat_completions"
	case "google", "google_gemini", "gemini_generate_content":
		return "gemini"
	default:
		return normalized
	}
}

// connectGuidance renders the /connect onboarding card: for the active provider
// it shows whether the credential env var is set and the exact export line to
// run if it is missing. Never echoes a secret value, only presence.
func connectGuidance(m *Model) string {
	provider := canonicalProvider(emptyAs(m.providerInput.Value(), "stub"))
	var lines []string
	lines = append(lines, fmt.Sprintf("Provider: %s", emptyAs(m.providerInput.Value(), "stub")))
	lines = append(lines, fmt.Sprintf("Model: %s", emptyAs(m.modelInput.Value(), "stub-deterministic-v1")))

	if provider == "stub" {
		lines = append(lines, "")
		lines = append(lines, "The stub provider works offline with no credential. To use a real model, set a provider and its key:")
		lines = append(lines, "  /model openai_chat_completions   then /connect")
		lines = append(lines, "")
		lines = append(lines, "Supported providers: stub, openai_responses, openai_chat_completions, anthropic, gemini")
		return strings.Join(lines, "\n")
	}

	envVars := providerCredentialEnv(provider)
	missing := []string{}
	present := []string{}
	for _, name := range envVars {
		if v := os.Getenv(name); strings.TrimSpace(v) != "" {
			present = append(present, name)
		} else {
			missing = append(missing, name)
		}
	}
	lines = append(lines, "")
	if len(present) > 0 {
		lines = append(lines, fmt.Sprintf("✓ credential present: %s (value never shown or stored)", strings.Join(present, ", ")))
	} else {
		lines = append(lines, fmt.Sprintf("✗ no credential found for %s", provider))
	}
	if len(missing) > 0 {
		lines = append(lines, "")
		lines = append(lines, "Set one of these in your shell, then restart the TUI:")
		for _, name := range missing {
			lines = append(lines, fmt.Sprintf("  export %s=<your-key>", name))
		}
		lines = append(lines, "")
		lines = append(lines, "Aetherion reads credentials from the environment only — it never persists them.")
	}
	return strings.Join(lines, "\n")
}

func messageBlock(entry transcriptEntry) string {
	theme := styles()
	label := strings.ToUpper(emptyAs(entry.Role, "system"))
	if entry.Meta != "" {
		label += " · " + entry.Meta
	}
	text := strings.TrimSpace(entry.Text)
	if text == "" {
		text = "empty"
	}
	body := theme.meta.Render(label) + "\n" + text
	switch entry.Role {
	case "user":
		return theme.transcript.Render(body)
	case "assistant":
		return theme.response.Render(body)
	case "error":
		return theme.error.Render(body)
	case "tool":
		return theme.muted.Render(body)
	case "approval":
		return theme.warn.Render(body)
	default:
		return theme.transcript.Render(body)
	}
}

func centerText(value string, width int) string {
	if width <= 0 {
		return value
	}
	textWidth := lipgloss.Width(value)
	if textWidth >= width {
		return value
	}
	left := (width - textWidth) / 2
	right := width - textWidth - left
	return strings.Repeat(" ", left) + value + strings.Repeat(" ", right)
}

func modelStatusLabel(m Model) string {
	model := emptyAs(strings.TrimSpace(m.modelInput.Value()), m.cfg.ModelStatus.ModelRef)
	provider := emptyAs(strings.TrimSpace(m.providerInput.Value()), m.cfg.ModelStatus.ProviderName)
	if provider == "" {
		provider = "stub"
	}
	if model == "" {
		model = "stub-deterministic-v1"
	}
	label := model
	if provider != "stub" {
		label = provider + "/" + model
	}
	if !m.cfg.ModelStatus.ToolsAllowed && !m.cfg.ModelStatus.RuntimeAuthorityGranted {
		label += " no-tools"
	}
	return label
}

type styleSet struct {
	title        lipgloss.Style
	badge        lipgloss.Style
	muted        lipgloss.Style
	meta         lipgloss.Style
	panel        lipgloss.Style
	help         lipgloss.Style
	prompt       lipgloss.Style
	composerBox  lipgloss.Style
	modelFields  lipgloss.Style
	sessionPanel lipgloss.Style
	sectionTitle lipgloss.Style
	status       lipgloss.Style
	warn         lipgloss.Style
	error        lipgloss.Style
	response     lipgloss.Style
	result       lipgloss.Style
	streaming    lipgloss.Style
	transcript   lipgloss.Style
	overlay      lipgloss.Style
	statusRule   lipgloss.Style
}

func styles() styleSet {
	return styleSet{
		title:        lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("220")),
		badge:        lipgloss.NewStyle().Foreground(lipgloss.Color("235")).Background(lipgloss.Color("220")).Padding(0, 1),
		muted:        lipgloss.NewStyle().Foreground(lipgloss.Color("244")),
		meta:         lipgloss.NewStyle().Foreground(lipgloss.Color("250")).MarginBottom(1),
		panel:        lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("238")).Padding(1, 2).MarginRight(2),
		help:         lipgloss.NewStyle().Foreground(lipgloss.Color("244")),
		prompt:       lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("220")),
		composerBox:  lipgloss.NewStyle().Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("238")).Padding(0, 1).MarginTop(1),
		modelFields:  lipgloss.NewStyle().Foreground(lipgloss.Color("252")).Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("238")).Padding(0, 1).MarginTop(1),
		sessionPanel: lipgloss.NewStyle().Foreground(lipgloss.Color("252")).Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("220")).Padding(1, 2).MarginTop(1).MarginBottom(1),
		sectionTitle: lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("220")),
		status:       lipgloss.NewStyle().Foreground(lipgloss.Color("72")).MarginTop(1),
		warn:         lipgloss.NewStyle().Foreground(lipgloss.Color("214")),
		error:        lipgloss.NewStyle().Foreground(lipgloss.Color("203")).Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("203")).Padding(0, 1),
		response:     lipgloss.NewStyle().Foreground(lipgloss.Color("252")).Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("238")).Padding(0, 1).MarginBottom(1),
		result:       lipgloss.NewStyle().Foreground(lipgloss.Color("252")).Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("72")).Padding(1, 2).MarginTop(1),
		streaming:    lipgloss.NewStyle().Foreground(lipgloss.Color("220")).Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("238")).Padding(0, 1),
		transcript:   lipgloss.NewStyle().Foreground(lipgloss.Color("252")).Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("238")).Padding(0, 1).MarginBottom(1),
		overlay:      lipgloss.NewStyle().Foreground(lipgloss.Color("252")).Border(lipgloss.DoubleBorder()).BorderForeground(lipgloss.Color("220")).Padding(0, 1).MarginBottom(1),
		statusRule:   lipgloss.NewStyle().Foreground(lipgloss.Color("250")).Background(lipgloss.Color("235")).Padding(0, 1),
	}
}

func panelName(panel panelID) string {
	switch panel {
	case panelOnboarding:
		return "onboarding"
	case panelSettings:
		return "settings"
	case panelChat:
		return "chat"
	case panelDaemon:
		return "daemon"
	case panelReplay:
		return "replay_debug"
	default:
		return "unknown"
	}
}

func focusName(focus focusTarget) string {
	switch focus {
	case focusMenu:
		return "menu"
	case focusProvider:
		return "provider"
	case focusModel:
		return "model"
	case focusComposer:
		return "composer"
	default:
		return "unknown"
	}
}

func overlayName(mode overlayMode) string {
	switch mode {
	case overlayPalette:
		return "palette"
	case overlaySlash:
		return "slash"
	case overlayHelp:
		return "help"
	case overlayQueue:
		return "queue"
	case overlayModel:
		return "model"
	case overlaySessions:
		return "sessions"
	default:
		return "none"
	}
}

func supportedProviders() []string {
	return []string{"stub", "openai_responses", "openai_chat_completions", "anthropic", "gemini"}
}

func defaultModelForProvider(provider string) string {
	switch provider {
	case "openai_responses", "openai_chat_completions":
		return "gpt-5.4"
	case "anthropic":
		return "claude-haiku-4-5-20251001"
	case "gemini":
		return "gemini-3.5-flash"
	default:
		return "stub-deterministic-v1"
	}
}

func sourceDocPaths(docs []SourceDoc) []string {
	paths := make([]string, 0, len(docs))
	for _, doc := range docs {
		if doc.Path != "" {
			paths = append(paths, doc.Path)
		}
	}
	return paths
}

func emptyAs(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func boolAs(value bool, whenTrue, whenFalse string) string {
	if value {
		return whenTrue
	}
	return whenFalse
}

func quote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\\''") + "'"
}

func compactPath(value string, limit int) string {
	if len(value) <= limit {
		return value
	}
	if limit < 8 {
		return value
	}
	return "..." + value[len(value)-limit+3:]
}

func compactWhitespace(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func truncateForPanel(value string, limit int) string {
	if len(value) <= limit {
		return value
	}
	if limit < 32 {
		limit = 32
	}
	return value[:limit-16] + "\n... truncated ..."
}

func truncateInline(value string, limit int) string {
	value = compactWhitespace(value)
	if len(value) <= limit {
		return value
	}
	if limit < 8 {
		limit = 8
	}
	return value[:limit-1] + "…"
}

var ansiPattern = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]`)

func stripANSI(value string) string {
	return ansiPattern.ReplaceAllString(value, "")
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
