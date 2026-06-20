import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { captureTreeSnapshot } from "../src/vcs/tree-snapshot.ts";
import {
  createBranch,
  listBranches,
  getBranchHead,
  advanceBranchHead,
  checkoutBranch,
  mergeBranch,
  writeBranchEvent,
  readBranchEvents,
  type BranchHead
} from "../src/vcs/branch.ts";

async function makeWorkspace(files: Record<string, string> = {}): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-branch-"));
  await mkdir(join(ws, ".aetherion"), { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(ws, path);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content, "utf8");
  }
  return ws;
}

test("createBranch copies workspace into worktree directory", async () => {
  const ws = await makeWorkspace({ "README.md": "# Main", "src/app.ts": "x" });
  const snap = captureTreeSnapshot(ws);
  const branch = createBranch(ws, "feature-1", snap.tree_hash);
  // Worktree should exist and contain copied files
  const worktreeDir = join(ws, ".aetherion", "worktrees", "feature-1", "workspace");
  assert.ok(existsSync(join(worktreeDir, "README.md")));
  assert.ok(existsSync(join(worktreeDir, "src", "app.ts")));
  assert.equal(await readFile(join(worktreeDir, "README.md"), "utf8"), "# Main");
  // Branch head should point to the source tree hash
  assert.equal(branch.head.tree_hash, snap.tree_hash);
});

test("branch has independent events.jsonl", async () => {
  const ws = await makeWorkspace({ "file.txt": "content" });
  const snap = captureTreeSnapshot(ws);
  createBranch(ws, "test-branch", snap.tree_hash);
  // Write an event to the branch ledger
  writeBranchEvent(ws, "test-branch", {
    id: "evt_branch_1",
    timestamp: new Date().toISOString(),
    workspace_id: "ws",
    run_id: "run_branch",
    event_type: "action.recorded",
    actor: { type: "system", id: "test" },
    summary: "branch action",
    hash_version: "aetherion-event-v1",
    sensitivity: "private",
    taint: { sources: ["trusted_system"], can_authorize_actions: false }
  });
  const events = readBranchEvents(ws, "test-branch");
  assert.equal(events.length, 1);
  assert.equal(events[0].id, "evt_branch_1");
});

test("write in branch worktree does not affect main workspace", async () => {
  const ws = await makeWorkspace({ "shared.txt": "original" });
  const snap = captureTreeSnapshot(ws);
  createBranch(ws, "isolation-test", snap.tree_hash);
  // Write to branch worktree
  const worktreeDir = join(ws, ".aetherion", "worktrees", "isolation-test", "workspace");
  await writeFile(join(worktreeDir, "shared.txt"), "modified in branch", "utf8");
  // Main workspace should be unchanged
  assert.equal(await readFile(join(ws, "shared.txt"), "utf8"), "original");
});

test("listBranches shows all branches with their head tree_hash", async () => {
  const ws = await makeWorkspace({ "f.txt": "c" });
  const snap = captureTreeSnapshot(ws);
  createBranch(ws, "branch-a", snap.tree_hash);
  createBranch(ws, "branch-b", snap.tree_hash);
  const branches = listBranches(ws);
  assert.ok(branches.length >= 2);
  const names = branches.map((b) => b.name);
  assert.ok(names.includes("branch-a"));
  assert.ok(names.includes("branch-b"));
});

test("getBranchHead returns the current head for a branch", async () => {
  const ws = await makeWorkspace({ "x.txt": "x" });
  const snap = captureTreeSnapshot(ws);
  createBranch(ws, "head-test", snap.tree_hash);
  const head = getBranchHead(ws, "head-test");
  assert.ok(head);
  assert.equal(head!.tree_hash, snap.tree_hash);
});

test("advanceBranchHead updates the head to a new tree hash", async () => {
  const ws = await makeWorkspace({ "x.txt": "v1" });
  const snap1 = captureTreeSnapshot(ws);
  createBranch(ws, "advance-test", snap1.tree_hash);
  // Modify and capture new snapshot
  await writeFile(join(ws, "x.txt"), "v2", "utf8");
  const snap2 = captureTreeSnapshot(ws);
  advanceBranchHead(ws, "advance-test", snap2.tree_hash);
  const head = getBranchHead(ws, "advance-test");
  assert.equal(head!.tree_hash, snap2.tree_hash);
  assert.notEqual(head!.tree_hash, snap1.tree_hash);
});

test("checkoutBranch replaces main workspace with branch state", async () => {
  const ws = await makeWorkspace({ "main.txt": "main content" });
  const snap = captureTreeSnapshot(ws);
  createBranch(ws, "checkout-test", snap.tree_hash);
  // Modify branch worktree
  const worktreeDir = join(ws, ".aetherion", "worktrees", "checkout-test", "workspace");
  await writeFile(join(worktreeDir, "main.txt"), "branch content", "utf8");
  await writeFile(join(worktreeDir, "branch-only.txt"), "branch only", "utf8");
  // Checkout branch to main
  checkoutBranch(ws, "checkout-test");
  assert.equal(await readFile(join(ws, "main.txt"), "utf8"), "branch content");
  assert.equal(await readFile(join(ws, "branch-only.txt"), "utf8"), "branch only");
});

test("mergeBranch applies branch changes to main workspace", async () => {
  const ws = await makeWorkspace({ "base.txt": "base" });
  const snap = captureTreeSnapshot(ws);
  createBranch(ws, "merge-test", snap.tree_hash);
  // Make changes in branch worktree
  const worktreeDir = join(ws, ".aetherion", "worktrees", "merge-test", "workspace");
  await writeFile(join(worktreeDir, "new-file.txt"), "from branch", "utf8");
  await writeFile(join(worktreeDir, "base.txt"), "modified by branch", "utf8");
  // Merge
  const result = mergeBranch(ws, "merge-test");
  assert.equal(result.merged, true);
  assert.equal(await readFile(join(ws, "new-file.txt"), "utf8"), "from branch");
  assert.equal(await readFile(join(ws, "base.txt"), "utf8"), "modified by branch");
  assert.ok(result.changed_files.includes("new-file.txt"));
  assert.ok(result.changed_files.includes("base.txt"));
});
