import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const cliPath = resolve(import.meta.dirname, "../../tui/src/cli.ts");
const repoRoot = resolve(import.meta.dirname, "../../..");

async function makeWorkspace(files: Record<string, string> = {}): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-vcs-cli-"));
  await mkdir(join(ws, ".aetherion"), { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(ws, path);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content, "utf8");
  }
  return ws;
}

function runVcs(workspace: string, args: string[]): string {
  try {
    return execFileSync("node", [cliPath, "vcs", ...args, "--workspace", workspace], {
      encoding: "utf8",
      timeout: 10000,
      cwd: repoRoot
    });
  } catch (err) {
    const e = err as Error & { stdout?: string };
    return e.stdout ?? "";
  }
}

test("vcs status shows workspace tree hash and file count", async () => {
  const ws = await makeWorkspace({ "README.md": "# Test", "src/app.ts": "x" });
  const output = runVcs(ws, ["status"]);
  assert.match(output, /Workspace tree:/);
  assert.match(output, /Tracked files: 2/);
});

test("vcs snapshot creates a tree manifest", async () => {
  const ws = await makeWorkspace({ "file.txt": "content" });
  const output = runVcs(ws, ["snapshot"]);
  const parsed = JSON.parse(output.trim());
  assert.ok(parsed.tree_hash);
  assert.equal(parsed.file_count, 1);
});

test("vcs diff shows changed files after modification", async () => {
  const ws = await makeWorkspace({ "a.txt": "v1", "b.txt": "v1" });
  // Capture initial snapshot
  const snapOutput = runVcs(ws, ["snapshot"]);
  const treeHash = JSON.parse(snapOutput.trim()).tree_hash;
  // Modify a file
  await writeFile(join(ws, "a.txt"), "v2", "utf8");
  // Diff
  const output = runVcs(ws, ["diff", treeHash]);
  assert.match(output, /modified.*a\.txt/);
});

test("vcs rollback restores files to snapshot state", async () => {
  const ws = await makeWorkspace({ "data.txt": "original" });
  // Capture snapshot
  const snapOutput = runVcs(ws, ["snapshot"]);
  const treeHash = JSON.parse(snapOutput.trim()).tree_hash;
  // Modify file
  await writeFile(join(ws, "data.txt"), "modified", "utf8");
  assert.notEqual(await readFile(join(ws, "data.txt"), "utf8"), "original");
  // Rollback
  const output = runVcs(ws, ["rollback", treeHash]);
  assert.match(output, /Rolled back/);
  assert.equal(await readFile(join(ws, "data.txt"), "utf8"), "original");
});

test("vcs branch create and list", async () => {
  const ws = await makeWorkspace({ "README.md": "# Main" });
  runVcs(ws, ["branch", "create", "feature-x"]);
  const output = runVcs(ws, ["branch", "list"]);
  assert.match(output, /feature-x/);
});

test("vcs branch merge applies branch changes to main", async () => {
  const ws = await makeWorkspace({ "base.txt": "base" });
  runVcs(ws, ["branch", "create", "merge-test"]);
  // Write a file in the branch worktree
  const wtDir = join(ws, ".aetherion", "worktrees", "merge-test", "workspace");
  await writeFile(join(wtDir, "from-branch.txt"), "merged content", "utf8");
  // Merge
  const output = runVcs(ws, ["branch", "merge", "merge-test"]);
  assert.match(output, /Merged/);
  assert.equal(await readFile(join(ws, "from-branch.txt"), "utf8"), "merged content");
});
