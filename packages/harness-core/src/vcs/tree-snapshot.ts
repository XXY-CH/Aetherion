// Tree snapshot — captures the state of all workspace files as a path→hash map.
//
// A tree snapshot is like a Git tree object: it records which files exist and
// their content hash, but not the content itself (that's in the blob store).
// Two workspaces with identical file contents produce identical tree hashes.
//
// Snapshots are stored as JSON under .aetherion/trees/tree_<hash>.json.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { writeBlob, readBlob, hashContent } from "./blob-store.ts";

export type TreeSnapshot = {
  tree_hash: string;
  entries: Record<string, string>; // relative path → sha256 hash
};

export type FileChange = {
  path: string;
  change: "added" | "modified" | "deleted";
  before_hash?: string;
  after_hash?: string;
};

function treesDir(workspaceRoot: string): string {
  return join(workspaceRoot, ".aetherion", "trees");
}

function treePath(workspaceRoot: string, treeHash: string): string {
  return join(treesDir(workspaceRoot), treeHash.replace("sha256:", "tree_") + ".json");
}

// Recursively list all files in a directory, returning relative paths.
// Excludes the .aetherion/ directory and node_modules/.
function listWorkspaceFiles(workspaceRoot: string): string[] {
  const results: string[] = [];
  const exclude = new Set([".aetherion", "node_modules", ".git"]);

  function walk(dir: string): void {
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        // Allow dotfiles in subdirectories, but exclude top-level hidden dirs
        const rel = relative(workspaceRoot, join(dir, entry.name));
        if (!rel.includes("/")) {
          // Top-level entry
          if (exclude.has(entry.name)) continue;
        }
      }
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const rel = relative(workspaceRoot, fullPath);
        results.push(rel);
      }
    }
  }

  walk(workspaceRoot);
  return results.sort();
}

// Capture the current workspace state as a tree snapshot.
// Stores blob content for each file and writes the tree manifest to disk.
export function captureTreeSnapshot(workspaceRoot: string): TreeSnapshot {
  const files = listWorkspaceFiles(workspaceRoot);
  const entries: Record<string, string> = {};

  for (const relPath of files) {
    const fullPath = join(workspaceRoot, relPath);
    const content = readFileSync(fullPath, "utf8");
    // Store blob content
    writeBlob(workspaceRoot, content);
    entries[relPath] = hashContent(content);
  }

  // Compute tree hash from sorted entries
  const sortedEntries = Object.keys(entries).sort().map((k) => `${k}:${entries[k]}`).join("\n");
  const treeHash = `sha256:${createHash("sha256").update(sortedEntries).digest("hex")}`;

  const snapshot: TreeSnapshot = { tree_hash: treeHash, entries };

  // Persist tree manifest
  const path = treePath(workspaceRoot, treeHash);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  }

  return snapshot;
}

// Read a previously persisted tree snapshot by hash.
export function readTreeSnapshot(workspaceRoot: string, treeHash: string): TreeSnapshot {
  const path = treePath(workspaceRoot, treeHash);
  const data = readFileSync(path, "utf8");
  return JSON.parse(data) as TreeSnapshot;
}

// Restore the workspace to match a tree snapshot.
// Creates missing files, overwrites modified files, deletes extra files.
export function restoreTree(workspaceRoot: string, snapshot: TreeSnapshot): void {
  const currentFiles = new Set(listWorkspaceFiles(workspaceRoot));
  const snapshotPaths = new Set(Object.keys(snapshot.entries));

  // Restore/create files that are in the snapshot
  for (const [relPath, hash] of Object.entries(snapshot.entries)) {
    const fullPath = join(workspaceRoot, relPath);
    mkdirSync(dirname(fullPath), { recursive: true });
    const content = readBlob(workspaceRoot, hash);
    writeFileSync(fullPath, content, "utf8");
  }

  // Delete files that exist in workspace but not in snapshot
  for (const relPath of currentFiles) {
    if (!snapshotPaths.has(relPath)) {
      rmSync(join(workspaceRoot, relPath));
    }
  }
}

// Compare two tree snapshots and return the list of changes.
export function diffTrees(before: TreeSnapshot, after: TreeSnapshot): FileChange[] {
  const changes: FileChange[] = [];
  const beforeEntries = before.entries;
  const afterEntries = after.entries;

  const allPaths = new Set([...Object.keys(beforeEntries), ...Object.keys(afterEntries)]);

  for (const path of allPaths) {
    const beforeHash = beforeEntries[path];
    const afterHash = afterEntries[path];

    if (beforeHash && !afterHash) {
      changes.push({ path, change: "deleted", before_hash: beforeHash });
    } else if (!beforeHash && afterHash) {
      changes.push({ path, change: "added", after_hash: afterHash });
    } else if (beforeHash !== afterHash) {
      changes.push({ path, change: "modified", before_hash: beforeHash, after_hash: afterHash });
    }
  }

  return changes.sort((a, b) => a.path.localeCompare(b.path));
}
