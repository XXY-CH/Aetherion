package setupapp

import (
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strings"

	"charm.land/bubbles/v2/help"
	"charm.land/bubbles/v2/key"
	"charm.land/bubbles/v2/list"
	"charm.land/bubbles/v2/table"
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
	DirectEntry        string
	PackageEntry       string
}

func DecodeConfig(r io.Reader) (Config, error) {
	var cfg Config
	decoder := json.NewDecoder(r)
	if err := decoder.Decode(&cfg); err != nil {
		return Config{}, err
	}
	if cfg.DefaultEntry == "" {
		cfg.DefaultEntry = "ether"
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
	panelRuns panelID = iota
	panelTimeline
	panelApprovals
	panelContext
	panelReplay
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
	Up    key.Binding
	Down  key.Binding
	Enter key.Binding
	Tab   key.Binding
	Help  key.Binding
	Quit  key.Binding
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
		Enter: key.NewBinding(
			key.WithKeys("enter"),
			key.WithHelp("enter", "select"),
		),
		Tab: key.NewBinding(
			key.WithKeys("tab"),
			key.WithHelp("tab", "next panel"),
		),
		Help: key.NewBinding(
			key.WithKeys("?"),
			key.WithHelp("?", "help"),
		),
		Quit: key.NewBinding(
			key.WithKeys("q", "ctrl+c"),
			key.WithHelp("q", "quit"),
		),
	}
}

func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Up, k.Down, k.Enter, k.Tab, k.Help, k.Quit}
}

func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Up, k.Down, k.Enter},
		{k.Tab, k.Help, k.Quit},
	}
}

type Model struct {
	cfg       Config
	width     int
	height    int
	selected  panelID
	keys      keyMap
	help      help.Model
	menu      list.Model
	runs      table.Model
	timeline  table.Model
	approvals table.Model
	context   table.Model
	replay    table.Model
	statusMsg string
}

func NewModel(cfg Config) Model {
	items := []list.Item{
		menuItem{"Runs", "Current workspace/runtime readiness and next command handoffs", panelRuns},
		menuItem{"Timeline", "Kernel loop stages from prompt/model proposal to policy and trace", panelTimeline},
		menuItem{"Approvals", "Approval gates stay explicit; this setup view never grants authority", panelApprovals},
		menuItem{"Context", "Prompt/context/model-read loop staging for the next OpenClaw-facing slice", panelContext},
		menuItem{"Replay / Debug", "Trace replay, blocked reasons, source docs, and release evidence", panelReplay},
	}
	menu := list.New(items, list.NewDefaultDelegate(), 32, 14)
	menu.Title = "Operator Panels"
	menu.SetShowStatusBar(false)
	menu.SetFilteringEnabled(false)
	menu.SetShowHelp(false)
	menu.DisableQuitKeybindings()

	model := Model{
		cfg:       cfg,
		width:     96,
		height:    32,
		keys:      defaultKeyMap(),
		help:      help.New(),
		menu:      menu,
		statusMsg: "read-only setup: no workspace mutation, no install, no daemon start",
	}
	model.rebuildTables()
	return model
}

func (m Model) Init() tea.Cmd {
	return nil
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.resize()
	case tea.KeyPressMsg:
		switch {
		case key.Matches(msg, m.keys.Quit):
			return m, tea.Quit
		case key.Matches(msg, m.keys.Help):
			m.help.ShowAll = !m.help.ShowAll
		case key.Matches(msg, m.keys.Tab):
			m.selected = panelID((int(m.selected) + 1) % 5)
			m.menu.Select(int(m.selected))
			m.statusMsg = fmt.Sprintf("panel=%s", panelName(m.selected))
		case key.Matches(msg, m.keys.Up), key.Matches(msg, m.keys.Down):
			nextMenu, cmd := m.menu.Update(msg)
			m.menu = nextMenu
			if item, ok := m.menu.SelectedItem().(menuItem); ok {
				m.selected = item.panel
				m.statusMsg = fmt.Sprintf("panel=%s", panelName(m.selected))
			}
			return m, cmd
		case key.Matches(msg, m.keys.Enter):
			if item, ok := m.menu.SelectedItem().(menuItem); ok {
				m.selected = item.panel
				m.statusMsg = fmt.Sprintf("selected=%s", panelName(m.selected))
			}
		}
	}
	return m, nil
}

func (m Model) View() tea.View {
	return tea.NewView(m.render())
}

func (m Model) StaticView() string {
	return stripANSI(m.render()) + "\n"
}

func (m *Model) resize() {
	if m.width < 72 {
		m.width = 72
	}
	if m.height < 24 {
		m.height = 24
	}
	m.menu.SetSize(32, max(10, m.height-12))
	m.help.SetWidth(m.width)
	m.rebuildTables()
}

func (m *Model) rebuildTables() {
	panelWidth := max(60, m.width-38)
	panelHeight := max(8, m.height-16)
	m.runs = makeTable(panelWidth, panelHeight, []table.Column{
		{Title: "Signal", Width: 26},
		{Title: "Evidence", Width: panelWidth - 30},
	}, []table.Row{
		{"status", m.cfg.Snapshot.Status},
		{"workspace", m.cfg.Snapshot.WorkspaceRoot},
		{"toolchain", m.cfg.Snapshot.ReadinessLayers.ToolchainReady},
		{"repo", m.cfg.Snapshot.ReadinessLayers.RepoReady},
		{"runtime", m.cfg.Snapshot.ReadinessLayers.WorkspaceRuntime},
		{"checks", fmt.Sprintf("pass:%d warn:%d fail:%d n/a:%d", m.cfg.Snapshot.Summary.Pass, m.cfg.Snapshot.Summary.Warn, m.cfg.Snapshot.Summary.Fail, m.cfg.Snapshot.Summary.NotApplicable)},
		{"first run", m.cfg.RunCommand},
	})
	m.timeline = makeTable(panelWidth, panelHeight, []table.Column{
		{Title: "Stage", Width: 28},
		{Title: "Boundary", Width: panelWidth - 32},
	}, []table.Row{
		{"1 user task", "operator starts from Ether TUI; no implicit workspace mutation"},
		{"2 prompt plan", "context and source docs are inspectable before model calls"},
		{"3 no-tools LLM", "provider output is metadata/hash governed; tools remain unavailable"},
		{"4 response audit", "model claims and proposed actions are linted before policy"},
		{"5 restated proposal", "operator restates file-read intent; model output is not authority"},
		{"6 supervisor policy", "fresh tool.requested -> risk.composed -> policy.decided -> lease"},
		{"7 observation", "file.read.traced returns observed evidence for final answer"},
		{"8 replay/debug", "trace replay reconstructs the run without live side effects"},
	})
	m.approvals = makeTable(panelWidth, panelHeight, []table.Column{
		{Title: "Queue", Width: 24},
		{Title: "State", Width: panelWidth - 28},
	}, []table.Row{
		{"workspace writes", "approval-gated; setup does not request or grant write leases"},
		{"tool proposals", "future read-only LLM loop must use operator restatement"},
		{"outbox delivery", "deferred; external messages require approval cards"},
		{"connector grants", "deferred until identity, vault, policy, and leases exist"},
		{"package execution", "deferred; package code is not run by this TUI"},
	})
	m.context = makeTable(panelWidth, panelHeight, []table.Column{
		{Title: "Context", Width: 26},
		{Title: "Current Slice", Width: panelWidth - 30},
	}, []table.Row{
		{"readiness", m.cfg.OnboardingCommand},
		{"doctor", m.cfg.DoctorCommand},
		{"security", m.cfg.SecurityCommand},
		{"release", m.cfg.ReleaseCommand},
		{"LLM read loop", emptyAs(m.cfg.LLMReadLoopCommand, "next slice: no-tools -> audit -> restated read proposal")},
		{"direct entry", m.cfg.DirectEntry},
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

func (m Model) render() string {
	theme := styles()
	header := theme.title.Render("Ether Operator Console") + " " + theme.badge.Render("Bubble Tea/Bubbles")
	subtitle := theme.muted.Render("V1 terminal GUI for setup, runtime inspection, approvals, context, and replay. Read-only on entry.")
	meta := fmt.Sprintf("command=setup default_entry=%s scope=read_only mutates_workspace=false initializes_workspace=false installs_dependencies=false starts_daemon=false", emptyAs(m.cfg.DefaultEntry, "ether"))
	panelIndex := "operator_panels=Runs,Timeline,Approvals,Context,Replay / Debug"
	llmLoop := "llm_read_loop=" + emptyAs(m.cfg.LLMReadLoopCommand, "next slice: no-tools -> audit -> restated read proposal")

	menu := theme.panel.Render(m.menu.View())
	body := theme.panel.Width(max(60, m.width-38)).Render(m.panelView())
	footer := theme.status.Render(m.statusMsg) + "\n" + m.help.View(m.keys)

	return lipgloss.JoinVertical(lipgloss.Left,
		header,
		subtitle,
		theme.meta.Render(meta),
		theme.meta.Render(panelIndex),
		theme.meta.Render(llmLoop),
		lipgloss.JoinHorizontal(lipgloss.Top, menu, body),
		footer,
	)
}

func (m Model) panelView() string {
	switch m.selected {
	case panelRuns:
		return section("Runs", "Current readiness and first safe handoffs", m.runs.View())
	case panelTimeline:
		return section("Timeline", "Target LLM read-only loop: no tools until audit + fresh policy", m.timeline.View())
	case panelApprovals:
		return section("Approvals", "Approval inbox design before writes, outbox, connectors, or package execution", m.approvals.View())
	case panelContext:
		return section("Context", "Prompt/model context will remain source-backed and non-authorizing", m.context.View())
	case panelReplay:
		return section("Replay / Debug", "Trace replay and source docs make failures inspectable", m.replay.View())
	default:
		return section("Runs", "Current readiness and first safe handoffs", m.runs.View())
	}
}

func section(title, desc, body string) string {
	s := styles()
	return s.sectionTitle.Render(title) + "\n" + s.muted.Render(desc) + "\n\n" + body
}

type styleSet struct {
	title        lipgloss.Style
	badge        lipgloss.Style
	muted        lipgloss.Style
	meta         lipgloss.Style
	panel        lipgloss.Style
	sectionTitle lipgloss.Style
	status       lipgloss.Style
}

func styles() styleSet {
	return styleSet{
		title:        lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("86")),
		badge:        lipgloss.NewStyle().Foreground(lipgloss.Color("230")).Background(lipgloss.Color("57")).Padding(0, 1),
		muted:        lipgloss.NewStyle().Foreground(lipgloss.Color("244")),
		meta:         lipgloss.NewStyle().Foreground(lipgloss.Color("250")).MarginBottom(1),
		panel:        lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("238")).Padding(1, 2).MarginRight(2),
		sectionTitle: lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("229")),
		status:       lipgloss.NewStyle().Foreground(lipgloss.Color("86")).MarginTop(1),
	}
}

func panelName(panel panelID) string {
	switch panel {
	case panelRuns:
		return "runs"
	case panelTimeline:
		return "timeline"
	case panelApprovals:
		return "approvals"
	case panelContext:
		return "context"
	case panelReplay:
		return "replay_debug"
	default:
		return "unknown"
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

var ansiPattern = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]`)

func stripANSI(value string) string {
	return ansiPattern.ReplaceAllString(value, "")
}
