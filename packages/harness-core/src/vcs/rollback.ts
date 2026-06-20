// Rollback — restore the workspace to a previous tree snapshot.
//
// rollbackToTree: given a TreeSnapshot, rewrites the workspace to match it.
//   - Files in the snapshot are restored from the blob store.
//   - Files not in the snapshot but present in workspace are deleted.
//   - Returns a report of what was restored/deleted.
//
// findNearestSnapshot: given a ledger event list and a target event id,
//   walks backwards to find the latest vcs.snapshot.created event's
//   payload_ref (the tree hash).

import { join } from "node:path";
import { readFileSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import {
  captureTreeSnapshot,
  readTreeSnapshot,
  restoreTree,
  diffTrees,
  type TreeSnapshot
} from "./tree-snapshot.ts";
import type { EventRecord } from "../ledger.ts";

export type RollbackResult = {
  restored: boolean;
  partial_rollback: boolean;
  target_tree_hash: string;
  restored_files: string[];
  deleted_files: string[];
  skipped_irreversible: string[];
};

// Rollback the workspace to match a given tree snapshot.
// This is a full restore: workspace files are rewritten to match the snapshot exactly.
export function rollbackToTree(workspaceRoot: string, snapshot: TreeSnapshot): RollbackResult {
  // Capture current state to compute what changed
  const current = captureTreeSnapshot(workspaceRoot);
  const diff = diffTrees(snapshot, current);

  // Files that were modified or added (now need to be restored/deleted)
  const restoredFiles: string[] = [];
  const deletedFiles: string[] = [];

  for (const change of diff) {
    // diffTrees(before=snapshot, after=current):
    // "added" = in current but not snapshot → must delete
    // "modified" = in both but different → must restore
    // "deleted" = in snapshot but not current → must restore
    if (change.change === "added") {
      deletedFiles.push(change.path);
    } else {
      restoredFiles.push(change.path);
    }
  }

  // Perform the restore
  restoreTree(workspaceRoot, snapshot);

  return {
    restored: true,
    partial_rollback: false,
    target_tree_hash: snapshot.tree_hash,
    restored_files: restoredFiles.sort(),
    deleted_files: deletedFiles.sort(),
    skipped_irreversible: []
  };
}

// Rollback by reading a tree snapshot from disk by its hash.
export function rollbackToSnapshot(workspaceRoot: string, treeHash: string): RollbackResult {
  const snapshot = readTreeSnapshot(workspaceRoot, treeHash);
  return rollbackToTree(workspaceRoot, snapshot);
}

// Find the latest vcs.snapshot.created event's tree hash that precedes
// the target event in the event list. Returns null if none found.
export function findNearestSnapshot(events: EventRecord[], targetEventId: string): string | null {
  // Find the index of the target event
  const targetIdx = events.findIndex((e) => e.id === targetEventId);
  if (targetIdx < 0) return null;

  // Walk backwards from targetIdx (inclusive) to find a snapshot event
  for (let i = targetIdx; i >= 0; i--) {
    const evt = events[i];
    if (evt.event_type === "vcs.snapshot.created" && evt.payload_ref) {
      // payload_ref contains the tree hash
      return evt.payload_ref;
    }
    // Also check action.recorded events which carry pre_write_tree_hash as payload_ref
    if (evt.event_type === "action.recorded" && evt.payload_ref) {
      return evt.payload_ref;
    }
  }

  return null;
}
