package setupapp

import (
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
	cfg           Config
	width         int
	height        int
	selected      panelID
	focus         focusTarget
	keys          keyMap
	help          help.Model
	menu          list.Model
	readiness     table.Model
	daemon        table.Model
	replay        table.Model
	transcriptVP  viewport.Model
	providerInput textinput.Model
	modelInput    textinput.Model
	composer      textarea.Model
	spinner       spinner.Model
	statusMsg     string
	chatBusy      bool
	activePrompt  string
	chatResult    *ChatResult
	chatError     string
	transcript    []transcriptEntry
	queue         []queuedPrompt
	completionIdx int
	historyIndex  int
	historyDraft  string
	overlay       overlayMode
	runner        CommandRunner
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
		runner: runner,
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
			m.refreshTranscript()
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
		m.refreshTranscript()
	case tea.KeyPressMsg:
		switch {
		case isCtrlC(msg):
			if m.chatBusy {
				m.statusMsg = "interrupt requested; provider call will finish or fail closed"
				m.overlay = overlayQueue
				return m, tea.Batch(cmds...)
			}
			if strings.TrimSpace(m.composer.Value()) != "" {
				m.composer.Reset()
				m.historyIndex = -1
				m.statusMsg = "composer cleared"
				return m, tea.Batch(cmds...)
			}
			return m, tea.Quit
		case isCtrlD(msg):
			return m, tea.Quit
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
	m.overlay = overlayNone
	m.statusMsg = fmt.Sprintf("chat running: provider=%s model=%s", emptyAs(provider, "stub"), emptyAs(modelRef, "default"))
	m.refreshTranscript()
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
		m.transcript = []transcriptEntry{{Role: "intro", Text: "Aetherion Agent", Meta: "session panel"}, {Role: "system", Text: "Transcript cleared. Governance artifacts already written by completed runs are not deleted.", Meta: "local"}}
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
	m.transcriptVP.SetContent(m.renderTranscriptContent())
	if len(m.transcript) > 1 || m.chatBusy || m.chatResult != nil || m.chatError != "" {
		m.transcriptVP.GotoBottom()
		return
	}
	m.transcriptVP.GotoTop()
}

func (m Model) render() string {
	theme := styles()
	top := m.topBrand()
	body := m.transcriptVP.View()
	composer := m.composerZone()
	status := m.statusRule()
	help := theme.help.Render(m.help.View(m.keys))
	return lipgloss.JoinVertical(lipgloss.Left,
		top,
		body,
		composer,
		status,
		help,
	)
}

func (m Model) topBrand() string {
	theme := styles()
	title := theme.title.Render("✦ AETHERION")
	subtitle := theme.muted.Render("✦ Local-first Agent Harness Kernel · Ether TUI")
	meta := []string{
		fmt.Sprintf("command=setup default_entry=%s scope=chat layout=hermes_fullscreen_session composer=interactive panels=conversation,composer,slash_commands,history,streaming,status,overlay,queue", emptyAs(m.cfg.DefaultEntry, "ether")),
		fmt.Sprintf("provider=%s credential_resolved=%t settings_persisted=%t runtime_authority_granted=%t tools_allowed=%t model_output_authorizes=%t", emptyAs(m.providerInput.Value(), "stub"), m.cfg.ModelStatus.CredentialResolved, m.cfg.ModelStatus.SettingsPersisted, m.cfg.ModelStatus.RuntimeAuthorityGranted, m.cfg.ModelStatus.ToolsAllowed, m.cfg.ModelStatus.ModelOutputCanAuthorizeActions),
		"llm_read_loop=" + emptyAs(m.cfg.LLMReadLoopCommand, "model chat through no-tools provider path"),
		"workspace=" + compactPath(m.cfg.Snapshot.WorkspaceRoot, max(24, m.width-48)),
	}
	return lipgloss.JoinVertical(lipgloss.Left, title, subtitle, theme.meta.Render(strings.Join(meta, "\n")))
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
	if overlay := m.overlayView(); overlay != "" {
		rows = append(rows, overlay)
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
	lines := []string{
		centerText("Aetherion Agent", width-4),
		"",
		theme.sectionTitle.Render("▾ Available Tools"),
		theme.muted.Render("local_file.read, local_file.write_preview, policy.decide, lease.issue, trace.replay"),
		"",
		theme.sectionTitle.Render("▾ Available Skills"),
		theme.muted.Render("onboarding, model chat, supervisor status, replay/debug, release evidence"),
		"",
		theme.muted.Render("0 delegated tool grants · model output authorizes false · /help for commands"),
		theme.warn.Render("! Local Supervisor remains the root authority; this TUI is only a client surface"),
		"",
		theme.meta.Render(fmt.Sprintf("provider=%s model=%s credential_resolved=%t", emptyAs(m.providerInput.Value(), "stub"), emptyAs(m.modelInput.Value(), "stub-deterministic-v1"), m.cfg.ModelStatus.CredentialResolved)),
		theme.meta.Render("mutates_workspace=false initializes_workspace=false installs_dependencies=false starts_daemon=false mutates_secrets=false"),
		theme.meta.Render("panels=conversation,composer,slash_commands,history,streaming,status,overlay,queue"),
		theme.meta.Render("llm_read_loop=" + emptyAs(m.cfg.LLMReadLoopCommand, "model chat through no-tools provider path")),
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
	text := fmt.Sprintf("%s streaming/status: provider call running · active prompt=%s · response/audit artifacts hash-only", m.spinner.View(), truncateForPanel(m.activePrompt, 96))
	return styles().streaming.Render(text)
}

func (m Model) statusRule() string {
	state := "ready"
	if m.chatBusy {
		state = "running"
	}
	if m.chatError != "" {
		state = "error"
	}
	segments := []string{
		state,
		modelStatusLabel(m),
		fmt.Sprintf("%d/%dm", 0, 1),
		fmt.Sprintf("queue %d", len(m.queue)),
		"overlay " + overlayName(m.overlay),
		"voice off",
		compactPath(m.cfg.Snapshot.WorkspaceRoot, 34),
		"authority non_authorizing",
		"status_rule=" + state,
	}
	return styles().statusRule.Width(max(76, m.width)).Render("─ " + strings.Join(segments, " │ ") + " ─")
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
			"/settings   provider and model fields",
			"/model      model picker and credential status",
			"/sessions   local session switcher",
			"/queue      queued prompt overlay",
			"/status     daemon/supervisor boundary",
			"/clear      clear visible transcript",
			"/new        start a fresh local session view",
		}, "\n")
	case overlayHelp:
		title = "Help"
		body = strings.Join(slashHelp(), "\n")
	case overlayQueue:
		title = "Queue"
		body = queueText(m.queue)
	case overlayModel:
		title = "Model Picker"
		body = strings.Join([]string{
			"provider " + m.providerInput.Value(),
			"model    " + m.modelInput.Value(),
			fmt.Sprintf("credential_resolved=%t credential_source=%s", m.cfg.ModelStatus.CredentialResolved, emptyAs(m.cfg.ModelStatus.CredentialSource, "not_recorded")),
			"tools_allowed=false runtime_authority_granted=false",
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
	return styles().overlay.Render(styles().sectionTitle.Render(title) + "\n" + body)
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
		"/settings  jump to provider/model settings",
		"/model     print current provider/model status; optional: /model <model_ref>",
		"/status    show daemon/supervisor status boundary",
		"/queue     preview local pending provider turn queue",
		"/sessions  open local session switcher overlay",
		"/clear     clear visible transcript only",
		"/new       start a fresh local TUI session view",
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
