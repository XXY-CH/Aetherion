import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { expandContextReferences } from "../src/context-refs.ts";

async function makeWorkspace(files: Record<string, string> = {}): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-context-refs-"));
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(ws, path);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content, "utf8");
  }
  return ws;
}

test("@file: expands file content inline", async () => {
  const ws = await makeWorkspace({ "src/app.ts": "export const x = 42;" });
  const result = expandContextReferences("read @file:src/app.ts and explain", ws);
  assert.ok(result.text.includes("export const x = 42"));
  assert.ok(result.text.includes("--- @file:src/app.ts ---"));
  assert.equal(result.expansions.length, 1);
  assert.equal(result.expansions[0].ok, true);
});

test("@file: handles missing file gracefully", async () => {
  const ws = await makeWorkspace();
  const result = expandContextReferences("check @file:nonexistent.ts", ws);
  assert.match(result.text, /file not found/);
  assert.equal(result.expansions[0].ok, false);
});

test("@file: truncates large files", async () => {
  const ws = await makeWorkspace({ "big.txt": "x".repeat(10000) });
  const result = expandContextReferences("@file:big.txt", ws);
  assert.ok(result.text.includes("truncated"));
  assert.ok(result.text.length < 10000);
});

test("@diff expands git diff in a git repo", async () => {
  // The project root IS a git repo.
  const ws = process.cwd();
  const result = expandContextReferences("what changed? @diff", ws);
  // Should either show changes or say "no changes" — both are valid.
  assert.ok(result.text.includes("@diff") || result.text.includes("no changes"));
  assert.equal(result.expansions.length, 1);
});

test("plain text without @-refs is unchanged", async () => {
  const ws = await makeWorkspace();
  const result = expandContextReferences("just a normal message", ws);
  assert.equal(result.text, "just a normal message");
  assert.equal(result.expansions.length, 0);
});

test("multiple @file: refs in one message", async () => {
  const ws = await makeWorkspace({ "a.txt": "content A", "b.txt": "content B" });
  const result = expandContextReferences("compare @file:a.txt and @file:b.txt", ws);
  assert.ok(result.text.includes("content A"));
  assert.ok(result.text.includes("content B"));
  assert.equal(result.expansions.length, 2);
});
