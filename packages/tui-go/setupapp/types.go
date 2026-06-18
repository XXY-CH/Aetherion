package setupapp

// Data types for the workbench. The Config/Snapshot/ModelStatus/ChatResult
// types are carried verbatim from the legacy app.go (they decode the JSON
// piped by the TS CLI). New types for the workbench shell follow.

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
	SourceRunID                   string   `json:"source_run_id"`
	SourceRunCreated              bool     `json:"source_run_created"`
	InvocationID                  string   `json:"invocation_id"`
	RequestID                     string   `json:"request_id"`
	ResponseID                    string   `json:"response_id"`
	ResponseAuditID               string   `json:"response_audit_id"`
	ResponseAuditStatus           string   `json:"response_audit_status"`
	ResponseAuditEvidenceStatus   string   `json:"response_audit_evidence_status"`
	ProviderRef                   string   `json:"provider_ref"`
	ModelRef                      string   `json:"model_ref"`
	OutputText                    string   `json:"output_text"`
	OutputTextSHA256              string   `json:"output_text_sha256"`
	ToolsRequested                bool     `json:"tools_requested"`
	RuntimeAuthorityGranted       bool     `json:"runtime_authority_granted"`
	RawOutputPrinted              bool     `json:"raw_output_printed"`
	ResponseAuditMissingBlocks    []string `json:"response_audit_missing_blocks"`
	ResponseAuditMissingCitations []string `json:"response_audit_missing_citations"`
}

// transcriptEntry is one rendered line/block in the conversation pane.
type transcriptEntry struct {
	Role string // "user", "assistant", "tool", "approval", "error", "system", "intro", "result"
	Text string
	Meta string // short metadata label (token count, risk level, etc.)
}

type queuedPrompt struct {
	Task     string
	Provider string
	Model    string
}

// tokenSample captures one agent-loop turn's token usage for sparklines.
type tokenSample struct {
	Turn   int
	Input  int
	Output int
	Total  int
}

// treeNode is one node in the git-tree gutter (maps to an EventRecord).
type treeNode struct {
	EventID      string
	EventType    string
	RunID        string
	Actor        string
	Summary      string
	Timestamp    string
	RiskLevel    string // "" if not a risk-bearing event
	IsCheckpoint bool
	IsBranch     bool
	BranchStatus string // "sandbox"|"approved"|"discarded"|""
	IsHead       bool
}
