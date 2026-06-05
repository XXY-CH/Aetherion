import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../../..");
const cliPath = join(repoRoot, "packages", "tui", "src", "cli.ts");

test("TUI run executes approval-gated local kernel loop", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "aetherion-tui-"));
  await writeFile(join(workspace, "README.md"), "Aetherion TUI fixture\n");

  const { stdout } = await execFileAsync(process.execPath, [
    cliPath,
    "run",
    "--workspace",
    workspace,
    "--input",
    "README.md",
    "--output",
    ".aetherion/SUMMARY.md",
    "--approve-write"
  ]);

  assert.match(stdout, /write_policy_initial=ask:L3/);
  assert.match(stdout, /write_policy_final=allow:L3/);
  assert.match(stdout, /verification=passed/);
  assert.match(stdout, /live_side_effects_replayed=false/);

  const summary = await readFile(join(workspace, ".aetherion", "SUMMARY.md"), "utf8");
  assert.equal(summary, "Summary: Aetherion TUI fixture\n");
});
