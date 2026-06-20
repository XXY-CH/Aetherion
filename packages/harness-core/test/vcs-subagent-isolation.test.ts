import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createV1ToolRegistry } from "../src/tool-registry.ts";
import { captureTreeSnapshot } from "../src/vcs/tree-snapshot.ts";
import { createBranch, mergeBranch, getBranchHead, branchWorkspace } from "../src/vcs/branch.ts";
import { runSubagentInBranch } from "../src/vcs/subagent.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function makeWorkspace(files: Record<string, string> = {}): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-subagent-iso-"));
  await mkdir(join(ws, ".aetherion"), { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(ws, path);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content, "utf8");
  }
  return ws;
}

test("runSubagentInBranch creates a branch worktree for the child", async () => {
  const ws = await makeWorkspace({ "README.md": "# Main workspace" });
  const snap = captureTreeSnapshot(ws);
  const result = await runSubagentInBranch({
    workspaceRoot: ws,
    branchName: "child-test-1",
    sourceTreeHash: snap.tree_hash,
    task: "write a file called output.txt with content 'hello from child'",
    repoRoot
  });
  assert.ok(result.branchName, "should return branch name");
  assert.ok(existsSync(join(ws, ".aetherion", "worktrees", "child-test-1", "workspace")), "worktree should exist");
});

test("child agent writes only affect worktree, not main workspace", async () => {
  const ws = await makeWorkspace({ "README.md": "# Main" });
  const snap = captureTreeSnapshot(ws);
  await runSubagentInBranch({
    workspaceRoot: ws,
    branchName: "child-iso-test",
    sourceTreeHash: snap.tree_hash,
    task: "write output.txt",
    repoRoot
  });
  // Main workspace should NOT have output.txt (it's in the worktree only)
  assert.ok(!existsSync(join(ws, "output.txt")), "main workspace should not have child's output");
  // But README.md should still be there unchanged
  assert.equal(await readFile(join(ws, "README.md"), "utf8"), "# Main");
});

test("mergeBranch after subagent applies changes to main workspace", async () => {
  const ws = await makeWorkspace({ "README.md": "# Main" });
  const snap = captureTreeSnapshot(ws);
  await runSubagentInBranch({
    workspaceRoot: ws,
    branchName: "child-merge-test",
    sourceTreeHash: snap.tree_hash,
    task: "write merged.txt",
    repoRoot
  });
  // Write a file manually in the worktree to simulate child agent output
  const wtDir = branchWorkspace(ws, "child-merge-test");
  await writeFile(join(wtDir, "child-output.txt"), "from child", "utf8");
  // Merge
  const result = mergeBranch(ws, "child-merge-test");
  assert.ok(result.merged);
  assert.ok(result.changed_files.includes("child-output.txt"));
  assert.equal(await readFile(join(ws, "child-output.txt"), "utf8"), "from child");
});

test("discarded child branch leaves no trace in main workspace", async () => {
  const ws = await makeWorkspace({ "README.md": "# Main" });
  const snap = captureTreeSnapshot(ws);
  await runSubagentInBranch({
    workspaceRoot: ws,
    branchName: "child-discard-test",
    sourceTreeHash: snap.tree_hash,
    task: "write discard.txt",
    repoRoot
  });
  // Write a file in the worktree
  const wtDir = branchWorkspace(ws, "child-discard-test");
  await writeFile(join(wtDir, "discard-me.txt"), "should not appear in main", "utf8");
  // Don't merge — just verify main is clean
  assert.ok(!existsSync(join(ws, "discard-me.txt")), "main should be untouched");
  assert.ok(!existsSync(join(ws, "child-output.txt")), "main should be clean");
});

test("subagent result includes worktree tree_hash for review", async () => {
  const ws = await makeWorkspace({ "README.md": "# Main" });
  const snap = captureTreeSnapshot(ws);
  const result = await runSubagentInBranch({
    workspaceRoot: ws,
    branchName: "child-review-test",
    sourceTreeHash: snap.tree_hash,
    task: "do something",
    repoRoot
  });
  assert.ok(result.worktreeTreeHash, "result should include worktree tree hash");
  assert.match(result.worktreeTreeHash, /^sha256:[0-9a-f]{64}$/);
  assert.ok(result.branchHead, "result should include branch head info");
});
