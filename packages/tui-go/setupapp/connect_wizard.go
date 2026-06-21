package setupapp

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"
)

// connectProviderList returns the providers shown in the connect wizard.
func connectProviderList() []struct {
	Name  string
	Label string
	Model string
} {
	return []struct {
		Name  string
		Label string
		Model string
	}{
		{"anthropic", "Anthropic (Claude)", "claude-sonnet-4-20250514"},
		{"openai_responses", "OpenAI (Responses API)", "gpt-4o"},
		{"openai_chat_completions", "OpenAI (Chat Completions)", "gpt-4o"},
		{"gemini", "Google Gemini", "gemini-2.0-flash"},
		{"stub", "Stub (offline testing)", "stub-deterministic-v1"},
	}
}

// startConnectWizard initializes the connect wizard.
func (m *Model) startConnectWizard() {
	m.connectMode = "select_provider"
	m.connectCursor = 0
	m.wm.closeModals()

	// Initialize the key input field
	ti := newTextInput()
	ti.Placeholder = "paste your API key"
	ti.EchoMode = 2 // password mode (dots)
	m.connectKeyInput = ti

	// Initialize the model input field
	mi := newTextInput()
	mi.Placeholder = "model ref (e.g. claude-sonnet-4-20250514)"
	m.connectModelInput = mi
}

// renderConnectWizard returns the connect wizard content for the modal.
func (m Model) renderConnectWizard() string {
	providers := connectProviderList()
	var lines []string

	switch m.connectMode {
	case "select_provider":
		lines = append(lines, "CONNECT PROVIDER")
		lines = append(lines, "")
		lines = append(lines, "Select a provider:")
		lines = append(lines, "")
		for i, p := range providers {
			marker := "  "
			if i == m.connectCursor {
				marker = "▸ "
			}
			cred := ""
			if p.Name != "stub" {
				if envKey := providerEnvKey(p.Name); envKey != "" {
					if os.Getenv(envKey) != "" {
						cred = " ✓"
					} else {
						cred = " ✗"
					}
				}
			}
			lines = append(lines, fmt.Sprintf("%s%-28s%s", marker, p.Label, cred))
		}
		lines = append(lines, "")
		lines = append(lines, "↑↓ navigate   enter select   esc cancel")

	case "enter_model":
		lines = append(lines, "SELECT MODEL")
		lines = append(lines, "")
		lines = append(lines, fmt.Sprintf("Provider: %s", m.connectSelectedProvider))
		lines = append(lines, "")
		lines = append(lines, m.connectModelInput.View())
		lines = append(lines, "")
		lines = append(lines, "enter confirm   esc back")

	case "enter_key":
		lines = append(lines, "ENTER API KEY")
		lines = append(lines, "")
		lines = append(lines, fmt.Sprintf("Provider: %s", m.connectSelectedProvider))
		lines = append(lines, fmt.Sprintf("Model:    %s", m.connectSelectedModel))
		lines = append(lines, "")
		lines = append(lines, m.connectKeyInput.View())
		lines = append(lines, "")
		envKey := providerEnvKey(m.connectSelectedProvider)
		if envKey != "" && os.Getenv(envKey) != "" {
			lines = append(lines, fmt.Sprintf("(detected %s in env — enter to use it)", envKey))
		}
		lines = append(lines, "enter confirm   esc back")

	case "confirm":
		lines = append(lines, "CONFIRM CONNECTION")
		lines = append(lines, "")
		lines = append(lines, fmt.Sprintf("Provider: %s", m.connectSelectedProvider))
		lines = append(lines, fmt.Sprintf("Model:    %s", m.connectSelectedModel))
		keyDisplay := "(none)"
		if m.connectKeyInput.Value() != "" {
			k := m.connectKeyInput.Value()
			if len(k) > 8 {
				keyDisplay = k[:4] + "..." + k[len(k)-4:]
			} else {
				keyDisplay = "..."
			}
		}
		lines = append(lines, fmt.Sprintf("Key:      %s", keyDisplay))
		lines = append(lines, "")
		lines = append(lines, "enter save & connect   esc cancel")
	}

	return strings.Join(lines, "\n")
}

// handleConnectKey processes a key in the connect wizard.
// Returns true if the key was consumed.
func (m *Model) handleConnectKey(msg tea.KeyMsg) bool {
	if m.connectMode == "" {
		return false
	}

	switch m.connectMode {
	case "select_provider":
		return m.handleConnectSelect(msg)
	case "enter_model":
		return m.handleConnectModel(msg)
	case "enter_key":
		return m.handleConnectKeyEntry(msg)
	case "confirm":
		return m.handleConnectConfirm(msg)
	}
	return false
}

func (m *Model) handleConnectSelect(msg tea.KeyMsg) bool {
	providers := connectProviderList()
	switch msg.String() {
	case "esc":
		m.connectMode = ""
		return true
	case "up", "k":
		if m.connectCursor > 0 {
			m.connectCursor--
		}
		return true
	case "down", "j":
		if m.connectCursor < len(providers)-1 {
			m.connectCursor++
		}
		return true
	case "enter":
		p := providers[m.connectCursor]
		m.connectSelectedProvider = p.Name
		m.connectSelectedModel = p.Model
		if p.Name == "stub" {
			// Stub doesn't need key — go straight to confirm
			m.connectMode = "confirm"
		} else {
			// Check if key is already in env
			envKey := providerEnvKey(p.Name)
			if envKey != "" && os.Getenv(envKey) != "" {
				m.connectKeyInput.SetValue(os.Getenv(envKey))
				m.connectMode = "confirm"
			} else {
				m.connectMode = "enter_model"
				m.connectModelInput.SetValue(p.Model)
				m.connectModelInput.Focus()
			}
		}
		return true
	}
	return false
}

func (m *Model) handleConnectModel(msg tea.KeyMsg) bool {
	switch msg.String() {
	case "esc":
		m.connectMode = "select_provider"
		m.connectModelInput.Blur()
		return true
	case "enter":
		if m.connectModelInput.Value() != "" {
			m.connectSelectedModel = m.connectModelInput.Value()
		}
		m.connectModelInput.Blur()
		// Check if key is already in env
		envKey := providerEnvKey(m.connectSelectedProvider)
		if envKey != "" && os.Getenv(envKey) != "" {
			m.connectKeyInput.SetValue(os.Getenv(envKey))
			m.connectMode = "confirm"
		} else {
			m.connectMode = "enter_key"
			m.connectKeyInput.Focus()
		}
		return true
	}
	m.connectModelInput, _ = m.connectModelInput.Update(msg)
	return true
}

func (m *Model) handleConnectKeyEntry(msg tea.KeyMsg) bool {
	switch msg.String() {
	case "esc":
		m.connectMode = "enter_model"
		m.connectKeyInput.Blur()
		m.connectModelInput.Focus()
		return true
	case "enter":
		m.connectKeyInput.Blur()
		m.connectMode = "confirm"
		return true
	}
	m.connectKeyInput, _ = m.connectKeyInput.Update(msg)
	return true
}

func (m *Model) handleConnectConfirm(msg tea.KeyMsg) bool {
	switch msg.String() {
	case "esc":
		m.connectMode = ""
		return true
	case "enter":
		m.saveProviderConfig()
		m.connectMode = ""
		return true
	}
	return false
}

// saveProviderConfig writes the config via the TS CLI and updates TUI state.
func (m *Model) saveProviderConfig() {
	wsRoot := m.cfg.Snapshot.WorkspaceRoot
	configPath := filepath.Join(wsRoot, ".aetherion", "provider-config.json")

	config := map[string]string{
		"provider":  m.connectSelectedProvider,
		"model_ref": m.connectSelectedModel,
	}
	if key := m.connectKeyInput.Value(); key != "" {
		config["api_key"] = key
	}

	// Ensure .aetherion directory exists
	os.MkdirAll(filepath.Dir(configPath), 0755)

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		m.transcript = append(m.transcript, transcriptEntry{
			Role: "error",
			Text: fmt.Sprintf("Failed to encode provider config: %v", err),
			Meta: "connect error",
		})
		return
	}
	data = append(data, '\n')

	if err := os.WriteFile(configPath, data, 0600); err != nil {
		m.transcript = append(m.transcript, transcriptEntry{
			Role: "error",
			Text: fmt.Sprintf("Failed to write provider config: %v", err),
			Meta: "connect error",
		})
		return
	}

	// Update TUI model status
	m.cfg.ModelStatus.ProviderName = m.connectSelectedProvider
	m.cfg.ModelStatus.ModelRef = m.connectSelectedModel
	m.cfg.ModelStatus.NetworkCapable = m.connectSelectedProvider != "stub"

	// Also set env var for immediate use
	if key := m.connectKeyInput.Value(); key != "" {
		envKey := providerEnvKey(m.connectSelectedProvider)
		if envKey != "" {
			os.Setenv(envKey, key)
		}
	}

	m.transcript = append(m.transcript, transcriptEntry{
		Role: "system",
		Text: fmt.Sprintf("✓ Connected: %s / %s\n  Config saved to .aetherion/provider-config.json", m.connectSelectedProvider, m.connectSelectedModel),
		Meta: "connect done",
	})
	m.refreshTranscriptToBottom()
	m.statusMsg = "provider connected"
}

// providerEnvKey returns the environment variable name for a provider's API key.
func providerEnvKey(provider string) string {
	switch provider {
	case "anthropic":
		return "ANTHROPIC_API_KEY"
	case "openai_responses", "openai_chat_completions":
		return "OPENAI_API_KEY"
	case "gemini":
		return "GEMINI_API_KEY"
	}
	return ""
}

// newTextInput creates a configured text input model.
func newTextInput() textinput.Model {
	ti := textinput.New()
	ti.CharLimit = 200
	ti.SetWidth(40)
	return ti
}
