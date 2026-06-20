// Branch management for the VCS layer.
//
// Each branch has:
// - An independent events.jsonl under .aetherion/worktrees/<name>/events.jsonl
// - A physical workspace copy under .aetherion/worktrees/<name>/workspace/
// - A head.json recording the current tree_hash + event position
//
// Creating a branch copies the current workspace files into the worktree.
// Operations in a branch only affect the worktree directory, not the main
// workspace. Merging copies worktree changes back to main.

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, cpSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { captureTreeSnapshot, readTreeSnapshot, diffTrees, type TreeSnapshot } from "./tree-snapshot.ts";
import type { EventRecord } from "../ledger.ts";

export type BranchHead = {
  name: string;
  tree_hash: string;
  parent_branch: string;
  parent_tree_hash: string;
  event_count: number;
  created_at: string;
};

export type BranchInfo = {
  name: string;
  head: BranchHead;
};

export type MergeResult = {
  merged: boolean;
  changed_files: string[];
  target_tree_hash: string;
};

function worktreeRoot(workspaceRoot: string): string {
  return join(workspaceRoot, ".aetherion", "worktrees");
}

function branchDir(workspaceRoot: string, branchName: string): string {
  return join(worktreeRoot(workspaceRoot), branchName);
}

function branchWorkspace(workspaceRoot: string, branchName: string): string {
  return join(branchDir(workspaceRoot, branchName), "workspace");
}

function branchLedgerPath(workspaceRoot: string, branchName: string): string {
  return join(branchDir(workspaceRoot, branchName), "events.jsonl");
}

function branchHeadPath(workspaceRoot: string, branchName: string): string {
  return join(branchDir(workspaceRoot, branchName), "head.json");
}

// Create a new branch from a source tree snapshot.
// Copies all workspace files into the branch's worktree directory.
export function createBranch(
  workspaceRoot: string,
  branchName: string,
  sourceTreeHash: string,
  parentBranch = "main"
): BranchInfo {
  const bDir = branchDir(workspaceRoot, branchName);
  const wsDir = branchWorkspace(workspaceRoot, branchName);

  // Create directory structure
  mkdirSync(bDir, { recursive: true });
  mkdirSync(wsDir, { recursive: true });

  // Copy all workspace files (excluding .aetherion) into the worktree
  copyWorkspaceFiles(workspaceRoot, wsDir);

  // Create empty events.jsonl for the branch
  writeFileSync(branchLedgerPath(workspaceRoot, branchName), "", "utf8");

  // Write head.json
  const head: BranchHead = {
    name: branchName,
    tree_hash: sourceTreeHash,
    parent_branch: parentBranch,
    parent_tree_hash: sourceTreeHash,
    event_count: 0,
    created_at: new Date().toISOString()
  };
  writeFileSync(branchHeadPath(workspaceRoot, branchName), JSON.stringify(head, null, 2) + "\n", "utf8");

  return { name: branchName, head };
}

// Copy all files from source workspace to target, excluding .aetherion/ and node_modules/
function copyWorkspaceFiles(sourceRoot: string, targetRoot: string): void {
  const entries = readdirSync(sourceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".aetherion" || entry.name === "node_modules" || entry.name === ".git") continue;
    const srcPath = join(sourceRoot, entry.name);
    const tgtPath = join(targetRoot, entry.name);
    if (entry.isDirectory()) {
      cpSync(srcPath, tgtPath, { recursive: true });
    } else {
      cpSync(srcPath, tgtPath);
    }
  }
}

// List all branches in the workspace.
export function listBranches(workspaceRoot: string): BranchInfo[] {
  const wtRoot = worktreeRoot(workspaceRoot);
  if (!existsSync(wtRoot)) return [];

  const results: BranchInfo[] = [];
  const entries = readdirSync(wtRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const headPath = branchHeadPath(workspaceRoot, entry.name);
    if (!existsSync(headPath)) continue;
    try {
      const head = JSON.parse(readFileSync(headPath, "utf8")) as BranchHead;
      results.push({ name: entry.name, head });
    } catch {
      // Skip malformed branches
    }
  }
  return results;
}

// Get the head of a specific branch.
export function getBranchHead(workspaceRoot: string, branchName: string): BranchHead | null {
  const headPath = branchHeadPath(workspaceRoot, branchName);
  if (!existsSync(headPath)) return null;
  try {
    return JSON.parse(readFileSync(headPath, "utf8")) as BranchHead;
  } catch {
    return null;
  }
}

// Advance the branch head to a new tree hash.
export function advanceBranchHead(workspaceRoot: string, branchName: string, newTreeHash: string): void {
  const head = getBranchHead(workspaceRoot, branchName);
  if (!head) throw new Error(`Branch '${branchName}' not found`);
  head.tree_hash = newTreeHash;
  head.event_count += 1;
  writeFileSync(branchHeadPath(workspaceRoot, branchName), JSON.stringify(head, null, 2) + "\n", "utf8");
}

// Write an event to the branch's independent ledger.
export function writeBranchEvent(workspaceRoot: string, branchName: string, event: EventRecord): void {
  const ledgerPath = branchLedgerPath(workspaceRoot, branchName);
  const line = JSON.stringify(event) + "\n";
  writeFileSync(ledgerPath, line, { flag: "a", encoding: "utf8" });
}

// Read all events from a branch's ledger.
export function readBranchEvents(workspaceRoot: string, branchName: string): EventRecord[] {
  const ledgerPath = branchLedgerPath(workspaceRoot, branchName);
  if (!existsSync(ledgerPath)) return [];
  const data = readFileSync(ledgerPath, "utf8");
  return data.trim().split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as EventRecord);
}

// Checkout: replace the main workspace with the branch's state.
// This is a destructive operation on the main workspace.
export function checkoutBranch(workspaceRoot: string, branchName: string): void {
  const wsDir = branchWorkspace(workspaceRoot, branchName);
  if (!existsSync(wsDir)) throw new Error(`Branch '${branchName}' worktree not found`);

  // Delete all current workspace files (except .aetherion)
  const entries = readdirSync(workspaceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".aetherion") continue;
    rmSync(join(workspaceRoot, entry.name), { recursive: true, force: true });
  }

  // Copy branch worktree files to main workspace
  copyWorkspaceFiles(wsDir, workspaceRoot);
}

// Merge: apply branch worktree changes to the main workspace.
// Returns the list of changed files.
export function mergeBranch(workspaceRoot: string, branchName: string): MergeResult {
  const wsDir = branchWorkspace(workspaceRoot, branchName);
  if (!existsSync(wsDir)) throw new Error(`Branch '${branchName}' worktree not found`);

  // Capture current states
  const mainSnap = captureTreeSnapshot(workspaceRoot);
  const branchSnap = captureTreeSnapshot(wsDir);
  const diff = diffTrees(mainSnap, branchSnap);

  // Apply changes: copy modified/added files from branch to main
  const changedFiles: string[] = [];
  for (const change of diff) {
    const branchFilePath = join(wsDir, change.path);
    const mainFilePath = join(workspaceRoot, change.path);

    if (change.change === "deleted") {
      // File was in main but deleted in branch → delete from main
      if (existsSync(mainFilePath)) {
        rmSync(mainFilePath);
        changedFiles.push(change.path);
      }
    } else {
      // "added" or "modified" → copy from branch
      mkdirSync(dirname(mainFilePath), { recursive: true });
      cpSync(branchFilePath, mainFilePath);
      changedFiles.push(change.path);
    }
  }

  // Capture the new main tree hash
  const newMainSnap = captureTreeSnapshot(workspaceRoot);

  return {
    merged: true,
    changed_files: changedFiles.sort(),
    target_tree_hash: newMainSnap.tree_hash
  };
}
