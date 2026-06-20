import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { writeBlob } from "../src/vcs/blob-store.ts";
import {
  captureTreeSnapshot,
  restoreTree,
  diffTrees,
  type TreeSnapshot
} from "../src/vcs/tree-snapshot.ts";

async function makeWorkspace(files: Record<string, string> = {}): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-tree-"));
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(ws, path);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content, "utf8");
  }
  return ws;
}

test("captureTreeSnapshot records all workspace files", async () => {
  const ws = await makeWorkspace({
    "README.md": "# Hello",
    "src/app.ts": "export const x = 1;",
    "docs/guide.md": "# Guide"
  });
  const snap = captureTreeSnapshot(ws);
  assert.ok(snap.entries["README.md"], "README.md should be in snapshot");
  assert.ok(snap.entries["src/app.ts"], "src/app.ts should be in snapshot");
  assert.ok(snap.entries["docs/guide.md"], "docs/guide.md should be in snapshot");
  assert.ok(snap.tree_hash.length > 0, "tree_hash should be computed");
});

test("captureTreeSnapshot excludes .aetherion/ directory", async () => {
  const ws = await makeWorkspace({ "README.md": "# Hi" });
  await mkdir(join(ws, ".aetherion", "events"), { recursive: true });
  await writeFile(join(ws, ".aetherion", "events", "events.jsonl"), "secret", "utf8");
  await mkdir(join(ws, ".aetherion", "objects"), { recursive: true });
  await writeFile(join(ws, ".aetherion", "objects", "sha256_dummy"), "blob", "utf8");
  const snap = captureTreeSnapshot(ws);
  assert.ok(snap.entries["README.md"]);
  assert.equal(Object.keys(snap.entries).length, 1, "only README.md should be tracked, not .aetherion/");
  for (const path of Object.keys(snap.entries)) {
    assert.ok(!path.startsWith(".aetherion"), `path ${path} should not start with .aetherion`);
  }
});

test("captureTreeSnapshot stores blob content for each file", async () => {
  const ws = await makeWorkspace({ "file.txt": "store me" });
  const snap = captureTreeSnapshot(ws);
  const content = readFile(join(ws, ".aetherion", "objects", snap.entries["file.txt"].replace("sha256:", "sha256_")), "utf8");
  assert.equal(await content, "store me");
});

test("restoreTree rewrites workspace files to match snapshot", async () => {
  const ws = await makeWorkspace({ "a.txt": "original a", "b.txt": "original b" });
  // Capture snapshot
  const snap = captureTreeSnapshot(ws);
  // Modify files
  await writeFile(join(ws, "a.txt"), "modified a", "utf8");
  await writeFile(join(ws, "b.txt"), "modified b", "utf8");
  // Restore
  restoreTree(ws, snap);
  assert.equal(await readFile(join(ws, "a.txt"), "utf8"), "original a");
  assert.equal(await readFile(join(ws, "b.txt"), "utf8"), "original b");
});

test("restoreTree creates missing files and deletes extra files", async () => {
  const ws = await makeWorkspace({ "keep.txt": "keep", "delete.txt": "delete" });
  const snap = captureTreeSnapshot(ws);
  // Add a file not in snapshot, remove one that is
  await writeFile(join(ws, "extra.txt"), "extra", "utf8");
  await rm(join(ws, "delete.txt"));
  // Restore
  restoreTree(ws, snap);
  assert.equal(await readFile(join(ws, "keep.txt"), "utf8"), "keep");
  assert.equal(await readFile(join(ws, "delete.txt"), "utf8"), "delete");
  // extra.txt should be gone (not in snapshot)
  await assert.rejects(() => readFile(join(ws, "extra.txt"), "utf8"));
});

test("diffTrees identifies added/modified/deleted files", async () => {
  const before: TreeSnapshot = {
    tree_hash: "before",
    entries: {
      "unchanged.txt": "sha256:aaa",
      "modified.txt": "sha256:bbb",
      "deleted.txt": "sha256:ccc"
    }
  };
  const after: TreeSnapshot = {
    tree_hash: "after",
    entries: {
      "unchanged.txt": "sha256:aaa",
      "modified.txt": "sha256:ddd",
      "added.txt": "sha256:eee"
    }
  };
  const diff = diffTrees(before, after);
  const byPath = new Map(diff.map((d) => [d.path, d.change]));
  assert.equal(byPath.get("unchanged.txt"), undefined);
  assert.equal(byPath.get("modified.txt"), "modified");
  assert.equal(byPath.get("deleted.txt"), "deleted");
  assert.equal(byPath.get("added.txt"), "added");
});

test("two identical workspaces produce the same tree_hash", async () => {
  const ws1 = await makeWorkspace({ "x.txt": "same", "y.txt": "content" });
  const ws2 = await makeWorkspace({ "x.txt": "same", "y.txt": "content" });
  const snap1 = captureTreeSnapshot(ws1);
  const snap2 = captureTreeSnapshot(ws2);
  assert.equal(snap1.tree_hash, snap2.tree_hash);
});
