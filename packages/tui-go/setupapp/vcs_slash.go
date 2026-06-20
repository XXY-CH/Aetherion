package setupapp

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// handleVcsSlash processes /vcs subcommands from the TUI.
// It reads VCS state directly from the .aetherion/ filesystem.
func (m *Model) handleVcsSlash(subCmd string, args []string) {
	wsRoot := m.cfg.Snapshot.WorkspaceRoot
	switch subCmd {
	case "", "status":
		m.vcsStatus(wsRoot)
	case "snapshot":
		m.vcsSnapshotInfo(wsRoot)
	case "rollback":
		if len(args) > 0 {
			m.vcsRollbackInfo(wsRoot, args[0])
		} else {
			m.vcsListSnapshots(wsRoot)
		}
	case "branch":
		if len(args) > 0 {
			switch args[0] {
			case "list":
				m.vcsBranchList(wsRoot)
			default:
				m.vcsBranchList(wsRoot)
			}
		} else {
			m.vcsBranchList(wsRoot)
		}
	default:
		m.transcript = append(m.transcript, transcriptEntry{
			Role: "system",
			Text: "VCS commands: /vcs status, /vcs snapshot, /vcs rollback [hash], /vcs branch list",
			Meta: "vcs help",
		})
	}
	m.statusMsg = "slash=/vcs"
	m.refreshTranscriptToBottom()
}

// vcsStatus shows the current workspace tree hash and object count.
func (m *Model) vcsStatus(wsRoot string) {
	treesDir := filepath.Join(wsRoot, ".aetherion", "trees")
	objectsDir := filepath.Join(wsRoot, ".aetherion", "objects")
	worktreesDir := filepath.Join(wsRoot, ".aetherion", "worktrees")

	treeCount := countFiles(treesDir)
	objCount := countFiles(objectsDir)
	wtCount := countDirs(worktreesDir)

	text := fmt.Sprintf("VCS Status\n  tree snapshots: %d\n  blob objects:  %d\n  branches:      %d\n\nUse /vcs rollback to restore a previous state.", treeCount, objCount, wtCount)
	m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: text, Meta: "vcs status"})
}

// vcsSnapshotInfo shows details about tree snapshots.
func (m *Model) vcsSnapshotInfo(wsRoot string) {
	treesDir := filepath.Join(wsRoot, ".aetherion", "trees")
	entries := listTreeSnapshots(treesDir)
	if len(entries) == 0 {
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "No tree snapshots yet. Snapshots are created automatically before each write/exec.", Meta: "vcs"})
		return
	}
	// Show the 5 most recent
	lines := []string{"Recent tree snapshots (newest first):"}
	start := 0
	if len(entries) > 5 {
		start = len(entries) - 5
	}
	for _, e := range entries[start:] {
		shortHash := e
		if len(shortHash) > 20 {
			shortHash = shortHash[:20] + "..."
		}
		lines = append(lines, "  "+shortHash)
	}
	m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: strings.Join(lines, "\n"), Meta: "vcs snapshots"})
}

// vcsListSnapshots lists available snapshots for rollback.
func (m *Model) vcsListSnapshots(wsRoot string) {
	m.vcsSnapshotInfo(wsRoot)
	m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "Use /vcs rollback <hash> to restore (via CLI: ether vcs rollback <hash>)", Meta: "vcs"})
}

// vcsRollbackInfo shows info about a specific rollback target.
func (m *Model) vcsRollbackInfo(wsRoot string, hashOrPrefix string) {
	treesDir := filepath.Join(wsRoot, ".aetherion", "trees")
	entries := listTreeSnapshots(treesDir)
	var match string
	for _, e := range entries {
		if strings.HasPrefix(e, hashOrPrefix) || strings.Contains(e, hashOrPrefix) {
			match = e
			break
		}
	}
	if match == "" {
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: fmt.Sprintf("No snapshot matching '%s'. Use /vcs snapshot to list available.", hashOrPrefix), Meta: "vcs"})
		return
	}
	// Read the tree manifest
	treePath := filepath.Join(treesDir, match)
	data, err := os.ReadFile(treePath)
	if err != nil {
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: fmt.Sprintf("Error reading snapshot: %v", err), Meta: "vcs error"})
		return
	}
	var snap struct {
		TreeHash string            `json:"tree_hash"`
		Entries  map[string]string `json:"entries"`
	}
	if err := json.Unmarshal(data, &snap); err != nil {
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: fmt.Sprintf("Error parsing snapshot: %v", err), Meta: "vcs error"})
		return
	}
	text := fmt.Sprintf("Snapshot %s\n  files: %d\n\nTo restore: ether vcs rollback %s", match[:20]+"...", len(snap.Entries), snap.TreeHash)
	m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: text, Meta: "vcs rollback"})
}

// vcsBranchList lists all branches.
func (m *Model) vcsBranchList(wsRoot string) {
	wtDir := filepath.Join(wsRoot, ".aetherion", "worktrees")
	branches := listDirs(wtDir)
	if len(branches) == 0 {
		m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: "No branches. Use 'ether vcs branch create <name>' from CLI.", Meta: "vcs branches"})
		return
	}
	lines := []string{"Branches:"}
	for _, b := range branches {
		headPath := filepath.Join(wtDir, b, "head.json")
		info := b
		if data, err := os.ReadFile(headPath); err == nil {
			var head struct {
				TreeHash   string `json:"tree_hash"`
				EventCount int    `json:"event_count"`
			}
			if json.Unmarshal(data, &head) == nil {
				th := head.TreeHash
				if len(th) > 15 {
					th = th[:15] + "..."
				}
				info = fmt.Sprintf("%s  tree=%s  events=%d", b, th, head.EventCount)
			}
		}
		lines = append(lines, "  "+info)
	}
	m.transcript = append(m.transcript, transcriptEntry{Role: "system", Text: strings.Join(lines, "\n"), Meta: "vcs branches"})
}

// Helpers

func countFiles(dir string) int {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}
	count := 0
	for _, e := range entries {
		if !e.IsDir() {
			count++
		}
	}
	return count
}

func countDirs(dir string) int {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}
	count := 0
	for _, e := range entries {
		if e.IsDir() {
			count++
		}
	}
	return count
}

func listTreeSnapshots(treesDir string) []string {
	entries, err := os.ReadDir(treesDir)
	if err != nil {
		return nil
	}
	var result []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".json") {
			result = append(result, e.Name())
		}
	}
	sort.Strings(result)
	return result
}

func listDirs(dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var result []string
	for _, e := range entries {
		if e.IsDir() {
			result = append(result, e.Name())
		}
	}
	sort.Strings(result)
	return result
}
