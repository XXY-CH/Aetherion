// Garbage collection for the VCS object store.
//
// Over time, snapshots, branches, and worktrees accumulate blobs (file
// content) and trees (path→hash manifests). Many become unreferenced: a
// transient snapshot taken before a write, a branch that was discarded, a
// file version superseded by a later capture. This module reclaims that space
// by deleting objects not reachable from any reference root.
//
// Reference roots (the GC "mark" set):
//   1. Every canonical tree file on disk (.aetherion/trees/*.json) protects
//      its blobs because it may be the target of a rollback or a diff at any
//      time.
//   2. Every branch/worktree head (.aetherion/worktrees/*/head.json →
//      tree_hash) points at a canonical tree that must survive.
//
// From each valid reachable tree, we transitively mark its entry blobs.
// Anything in .aetherion/objects or .aetherion/trees not in the mark set is
// swept.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readTreeSnapshot, type TreeSnapshot } from "./tree-snapshot.ts";

export type GcResult = {
  blobsScanned: number;
  treesScanned: number;
  blobsDeleted: number;
  treesDeleted: number;
  dryRun: boolean;
};

export type ReferencedObjects = {
  trees: Set<string>; // tree hashes reachable from any root
  blobs: Set<string>; // blob hashes reachable from any reachable tree's entries
};

function objectsDir(workspaceRoot: string): string {
  return join(workspaceRoot, ".aetherion", "objects");
}

function treesDir(workspaceRoot: string): string {
  return join(workspaceRoot, ".aetherion", "trees");
}

function worktreesDir(workspaceRoot: string): string {
  return join(workspaceRoot, ".aetherion", "worktrees");
}

// Parse a tree hash from a file name like "tree_<hex>.json" → "sha256:<hex>".
// The tree-snapshot module stores files as tree_<hex>.json (the sha256: prefix
// stripped), so we re-add it to match the in-memory hash format.
function hashFromTreeFile(name: string): string {
  const hex = name.replace(/^tree_/, "").replace(/\.json$/, "");
  return hex.startsWith("sha256:") ? hex : `sha256:${hex}`;
}

function treeFilePath(workspaceRoot: string, treeHash: string): string {
  return join(treesDir(workspaceRoot), treeHash.replace("sha256:", "tree_") + ".json");
}

function isObjectHash(value: string): boolean {
  return /^sha256:[0-9a-f]{64}$/.test(value);
}

function canonicalTreeHash(entries: Record<string, string>): string {
  const sortedEntries = Object.keys(entries).sort().map((k) => `${k}:${entries[k]}`).join("\n");
  return `sha256:${createHash("sha256").update(sortedEntries).digest("hex")}`;
}

function isCanonicalTreeSnapshot(treeHash: string, snap: TreeSnapshot): boolean {
  if (!isObjectHash(treeHash) || snap.tree_hash !== treeHash) return false;
  if (!snap.entries || typeof snap.entries !== "object" || Array.isArray(snap.entries)) return false;
  for (const blobHash of Object.values(snap.entries)) {
    if (!isObjectHash(blobHash)) return false;
  }
  return canonicalTreeHash(snap.entries) === treeHash;
}

// Parse a blob hash from a file name like "sha256_<hex>" → "sha256:<hex>".
function hashFromBlobFile(name: string): string {
  return name.replace(/^sha256_/, "sha256:");
}

// Enumerate every tree file under .aetherion/trees, returning their hashes.
function listTreeFiles(workspaceRoot: string): string[] {
  const dir = treesDir(workspaceRoot);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith("tree_") && f.endsWith(".json"))
    .map(hashFromTreeFile);
}

// Enumerate every blob file under .aetherion/objects, returning their hashes.
function listBlobFiles(workspaceRoot: string): string[] {
  const dir = objectsDir(workspaceRoot);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith("sha256_"))
    .map(hashFromBlobFile);
}

// Read a branch/worktree head's tree_hash, or null if the head is missing.
function branchHeadTreeHash(workspaceRoot: string, branchName: string): string | null {
  const headPath = join(worktreesDir(workspaceRoot), branchName, "head.json");
  if (!existsSync(headPath)) return null;
  try {
    const head = JSON.parse(readFileSync(headPath, "utf8"));
    return head.tree_hash ?? null;
  } catch {
    return null;
  }
}

// Enumerate all branch names from the worktrees directory.
function listBranchNames(workspaceRoot: string): string[] {
  const dir = worktreesDir(workspaceRoot);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function collectReferencedObjects(workspaceRoot: string): ReferencedObjects {
  const trees = new Set<string>();
  const blobs = new Set<string>();

  // Canonical tree files protect their blobs; malformed, mismatched, or forged
  // tree files are swept below.
  for (const treeHash of listTreeFiles(workspaceRoot)) {
    try {
      const snap: TreeSnapshot = readTreeSnapshot(workspaceRoot, treeHash);
      if (!isCanonicalTreeSnapshot(treeHash, snap)) continue;
      trees.add(treeHash);
      for (const blobHash of Object.values(snap.entries)) blobs.add(blobHash);
    } catch {
      // Invalid tree files cannot protect blobs.
    }
  }

  // Branch/worktree heads reference trees that MUST survive.
  for (const branchName of listBranchNames(workspaceRoot)) {
    const headHash = branchHeadTreeHash(workspaceRoot, branchName);
    if (headHash) trees.add(headHash);
  }

  for (const treeHash of trees) {
    try {
      const snap: TreeSnapshot = readTreeSnapshot(workspaceRoot, treeHash);
      for (const blobHash of Object.values(snap.entries)) {
        blobs.add(blobHash);
      }
    } catch {
      // Tree file may be corrupt/missing — skip, it can't mark anything.
    }
  }

  return { trees, blobs };
}

// Mark all objects reachable from reference roots.
export async function listReferencedObjects(workspaceRoot: string): Promise<ReferencedObjects> {
  return collectReferencedObjects(workspaceRoot);
}

// Count objects currently in the store (for before/after reporting).
export async function countObjects(workspaceRoot: string): Promise<{ blobs: number; trees: number }> {
  return {
    blobs: listBlobFiles(workspaceRoot).length,
    trees: listTreeFiles(workspaceRoot).length,
  };
}

// Run garbage collection. Returns a report of what was (or would be) deleted.
// In dryRun mode, nothing is actually deleted.
export function gcUnreferencedObjects(
  workspaceRoot: string,
  opts: { dryRun?: boolean } = {}
): GcResult {
  const dryRun = opts.dryRun ?? false;

  const referenced = collectReferencedObjects(workspaceRoot);

  let blobsDeleted = 0;
  let treesDeleted = 0;

  // Sweep blobs.
  const blobFiles = listBlobFiles(workspaceRoot);
  for (const blobHash of blobFiles) {
    if (!referenced.blobs.has(blobHash)) {
      if (!dryRun) {
        const path = join(objectsDir(workspaceRoot), blobHash.replace("sha256:", "sha256_"));
        rmSync(path, { force: true });
      }
      blobsDeleted++;
    }
  }

  // Sweep invalid tree files. Valid tree files remain rollback/diff targets
  // until the VCS grows an explicit snapshot-retention root.
  const treeFiles = listTreeFiles(workspaceRoot);
  for (const treeHash of treeFiles) {
    let isOrphan = false;
    try {
      const snap = readTreeSnapshot(workspaceRoot, treeHash);
      if (!isCanonicalTreeSnapshot(treeHash, snap)) {
        isOrphan = true;
      }
    } catch {
      isOrphan = true;
    }
    if (isOrphan) {
      if (!dryRun) {
        rmSync(treeFilePath(workspaceRoot, treeHash), { force: true });
      }
      treesDeleted++;
    }
  }

  return {
    blobsScanned: blobFiles.length,
    treesScanned: treeFiles.length,
    blobsDeleted,
    treesDeleted,
    dryRun,
  };
}
