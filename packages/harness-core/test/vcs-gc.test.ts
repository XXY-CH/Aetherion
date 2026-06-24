import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  captureTreeSnapshot,
  readTreeSnapshot,
} from "../src/vcs/tree-snapshot.ts";
import { writeBlob } from "../src/vcs/blob-store.ts";
import { createBranch } from "../src/vcs/branch.ts";
import {
  gcUnreferencedObjects,
  countObjects,
  listReferencedObjects,
} from "../src/vcs/gc.ts";

async function freshWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "aetherion-gc-"));
  await mkdir(join(root, ".aetherion"), { recursive: true });
  await writeFile(join(root, "README.md"), "# initial\n", "utf8");
  await writeFile(join(root, "main.ts"), "console.log('v1');\n", "utf8");
  return root;
}

// Test: GC removes an orphan blob that no tree snapshot references.
test("gc removes orphan blobs not referenced by any tree", async () => {
  const root = await freshWorkspace();
  // Capture a snapshot — this creates referenced blobs + a tree.
  const snap = captureTreeSnapshot(root);
  // Write an orphan blob that nothing references.
  const orphanHash = writeBlob(root, "this content is orphaned and unreferenced");

  const before = await countObjects(root);
  assert.ok(before.blobs >= 3, "should have at least the 2 file blobs + 1 orphan");

  const result = gcUnreferencedObjects(root, { dryRun: false });
  assert.equal(result.blobsDeleted, 1, "should delete exactly the orphan blob");
  assert.equal(result.treesDeleted, 0);

  // The orphan blob must be gone.
  assert.equal(
    existsSync(join(root, ".aetherion", "objects", orphanHash.replace("sha256:", "sha256_"))),
    false,
    "orphan blob file must be deleted"
  );
  // The referenced blobs must survive.
  for (const hash of Object.values(snap.entries)) {
    assert.equal(
      existsSync(join(root, ".aetherion", "objects", hash.replace("sha256:", "sha256_"))),
      true,
      `referenced blob ${hash} must survive GC`
    );
  }

  await rm(root, { recursive: true, force: true });
});

// Test: GC does NOT remove blobs referenced by tree snapshots (even old ones).
test("gc preserves blobs referenced by old tree snapshots", async () => {
  const root = await freshWorkspace();
  const snap1 = captureTreeSnapshot(root);
  // Modify a file and capture again — snap1's blobs must survive GC.
  await writeFile(join(root, "main.ts"), "console.log('v2');\n", "utf8");
  const snap2 = captureTreeSnapshot(root);

  const result = gcUnreferencedObjects(root, { dryRun: false });
  // README blob is referenced by both snapshots; main.ts v1 only by snap1.
  // Both must survive because both trees exist.
  assert.equal(result.blobsDeleted, 0, "no blobs should be deleted while both trees exist");
  // snap1 must still be readable.
  const reRead = readTreeSnapshot(root, snap1.tree_hash);
  assert.ok(reRead, "snap1 tree must survive GC");

  await rm(root, { recursive: true, force: true });
});

// Test: GC removes orphan tree snapshots (e.g. if a tree file exists but no
// branch/event/head references it).
test("gc removes orphan tree files not referenced by any root", async () => {
  const root = await freshWorkspace();
  // Create a real snapshot (referenced by the objects dir + will be a root).
  captureTreeSnapshot(root);
  // Now manually drop an orphan tree file by capturing + then deleting the
  // reference... Simpler: write an orphan tree JSON directly.
  const orphanTreePath = join(root, ".aetherion", "trees", "tree_orphan123.json");
  await mkdir(join(root, ".aetherion", "trees"), { recursive: true });
  await writeFile(orphanTreePath, JSON.stringify({ tree_hash: "sha256:orphan123", entries: {} }), "utf8");

  const result = gcUnreferencedObjects(root, { dryRun: false });
  assert.ok(result.treesDeleted >= 1, "should delete the orphan tree");
  assert.equal(existsSync(orphanTreePath), false, "orphan tree file must be deleted");

  await rm(root, { recursive: true, force: true });
});

// Test: GC does not trust tree files whose file name and embedded tree_hash
// agree but whose entries do not hash to that tree_hash.
test("gc removes non-canonical tree files and their otherwise-orphan blobs", async () => {
  const root = await freshWorkspace();
  captureTreeSnapshot(root);
  const fakeTreeHash = `sha256:${"a".repeat(64)}`;
  const orphanBlobHash = writeBlob(root, "only a forged tree points here");
  const forgedTreePath = join(root, ".aetherion", "trees", `tree_${"a".repeat(64)}.json`);
  await mkdir(join(root, ".aetherion", "trees"), { recursive: true });
  await writeFile(
    forgedTreePath,
    JSON.stringify({ tree_hash: fakeTreeHash, entries: { "forged.txt": orphanBlobHash } }),
    "utf8"
  );

  const result = gcUnreferencedObjects(root, { dryRun: false });
  assert.ok(result.treesDeleted >= 1, "should delete the non-canonical tree");
  assert.equal(existsSync(forgedTreePath), false, "non-canonical tree file must be deleted");
  assert.equal(
    existsSync(join(root, ".aetherion", "objects", orphanBlobHash.replace("sha256:", "sha256_"))),
    false,
    "blob referenced only by a non-canonical tree must be deleted"
  );

  await rm(root, { recursive: true, force: true });
});

// Test: dry-run mode reports what would be deleted without deleting.
test("gc dryRun reports but does not delete", async () => {
  const root = await freshWorkspace();
  captureTreeSnapshot(root);
  writeBlob(root, "orphan content");

  const before = await countObjects(root);
  const result = gcUnreferencedObjects(root, { dryRun: true });
  assert.equal(result.blobsDeleted, 1, "dryRun should report the orphan as deletable");
  // But the file must still exist.
  const after = await countObjects(root);
  assert.equal(after.blobs, before.blobs, "dryRun must not actually delete anything");

  await rm(root, { recursive: true, force: true });
});

// Test: GC respects branch head references — blobs referenced by a branch
// head's tree (even if not the current workspace tree) survive.
test("gc preserves blobs referenced by branch heads", async () => {
  const root = await freshWorkspace();
  const sourceSnap = captureTreeSnapshot(root);
  const branchName = "gc-test-branch";
  createBranch(root, branchName, sourceSnap.tree_hash, "main");
  // The branch head references sourceSnap.tree_hash. Now change the workspace
  // and capture a new snapshot — the old blobs must survive GC because the
  // branch head still references them.
  await writeFile(join(root, "main.ts"), "console.log('new');\n", "utf8");
  captureTreeSnapshot(root);

  const result = gcUnreferencedObjects(root, { dryRun: false });
  // The v1 main.ts blob is referenced by the branch's tree — must survive.
  const v1Blob = sourceSnap.entries["main.ts"];
  assert.equal(
    existsSync(join(root, ".aetherion", "objects", v1Blob.replace("sha256:", "sha256_"))),
    true,
    "branch-referenced blob must survive GC"
  );

  await rm(root, { recursive: true, force: true });
});

// Test: listReferencedObjects collects all reachable blob/tree hashes from
// every reference root (tree files on disk + branch heads + worktree heads).
test("listReferencedObjects includes trees and their blobs", async () => {
  const root = await freshWorkspace();
  const snap = captureTreeSnapshot(root);
  const refs = await listReferencedObjects(root);
  assert.ok(refs.trees.has(snap.tree_hash), "captured tree hash must be in referenced set");
  for (const hash of Object.values(snap.entries)) {
    assert.ok(refs.blobs.has(hash), `blob ${hash} from tree entries must be referenced`);
  }

  await rm(root, { recursive: true, force: true });
});
