package setupapp

import (
	"charm.land/bubbles/v2/key"
)

// keyMap holds all keybindings for the workbench. Extended from the legacy
// keyMap with tree-gutter navigation and window-management keys.
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
	Submit  key.Binding
	Palette key.Binding
	Model   key.Binding
	Help    key.Binding
	Blur    key.Binding
	Quit    key.Binding
	// Workbench-specific bindings.
	TreeSelect key.Binding // tree gutter node selection
	TreeDetail key.Binding // open event detail from tree node
}

func defaultKeyMap() keyMap {
	return keyMap{
		Up:         key.NewBinding(key.WithKeys("up", "k"), key.WithHelp("↑/k", "scroll up")),
		Down:       key.NewBinding(key.WithKeys("down", "j"), key.WithHelp("↓/j", "scroll down")),
		Left:       key.NewBinding(key.WithKeys("left", "h"), key.WithHelp("←/h", "prev node/provider")),
		Right:      key.NewBinding(key.WithKeys("right", "l"), key.WithHelp("→/l", "next node/provider")),
		PageUp:     key.NewBinding(key.WithKeys("pgup"), key.WithHelp("pgup", "scroll up")),
		PageDn:     key.NewBinding(key.WithKeys("pgdown"), key.WithHelp("pgdn", "scroll down")),
		Home:       key.NewBinding(key.WithKeys("home"), key.WithHelp("home", "top")),
		End:        key.NewBinding(key.WithKeys("end"), key.WithHelp("end", "bottom")),
		Enter:      key.NewBinding(key.WithKeys("enter"), key.WithHelp("enter", "send")),
		Newline:    key.NewBinding(key.WithKeys("shift+enter", "alt+enter", "ctrl+j"), key.WithHelp("shift+enter", "newline")),
		Submit:     key.NewBinding(key.WithKeys("ctrl+s"), key.WithHelp("ctrl+s", "send")),
		Palette:    key.NewBinding(key.WithKeys("ctrl+k"), key.WithHelp("ctrl+k", "commands")),
		Model:      key.NewBinding(key.WithKeys("ctrl+o"), key.WithHelp("ctrl+o", "model picker")),
		Help:       key.NewBinding(key.WithKeys("?"), key.WithHelp("?", "help")),
		Blur:       key.NewBinding(key.WithKeys("esc"), key.WithHelp("esc", "close overlay")),
		Quit:       key.NewBinding(key.WithKeys("q"), key.WithHelp("q", "quit")),
		TreeSelect: key.NewBinding(key.WithKeys("left", "right", "up", "down"), key.WithHelp("←→", "tree node")),
		TreeDetail: key.NewBinding(key.WithKeys("enter"), key.WithHelp("enter", "event detail")),
	}
}

// ShortHelp implements help.KeyMap.
func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Enter, k.Newline, k.Palette, k.Help, k.Quit}
}

// FullHelp implements help.KeyMap.
func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Enter, k.Newline, k.Submit},
		{k.Up, k.Down, k.PageUp, k.PageDn},
		{k.Palette, k.Model, k.Help, k.Blur},
		{k.Left, k.Right, k.Quit},
	}
}
