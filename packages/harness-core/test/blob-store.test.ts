import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { writeBlob, readBlob, blobExists } from "../src/vcs/blob-store.ts";

async function makeWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "aetherion-blob-"));
}

test("writeBlob stores content and returns sha256 hash", async () => {
  const ws = await makeWorkspace();
  const hash = writeBlob(ws, "hello world");
  assert.match(hash, /^sha256:[0-9a-f]{64}$/);
  const stored = await readFile(join(ws, ".aetherion", "objects", hash.replace("sha256:", "sha256_")), "utf8");
  assert.equal(stored, "hello world");
});

test("readBlob retrieves content by hash", async () => {
  const ws = await makeWorkspace();
  const hash = writeBlob(ws, "content here");
  const content = readBlob(ws, hash);
  assert.equal(content, "content here");
});

test("writeBlob is idempotent (same content → same hash, no duplicate file write)", async () => {
  const ws = await makeWorkspace();
  const hash1 = writeBlob(ws, "duplicate me");
  const hash2 = writeBlob(ws, "duplicate me");
  assert.equal(hash1, hash2);
  assert.ok(blobExists(ws, hash1));
  // Second write should not error — content already exists.
  const content = readBlob(ws, hash1);
  assert.equal(content, "duplicate me");
});

test("writeBlob with different content produces different hashes", async () => {
  const ws = await makeWorkspace();
  const hash1 = writeBlob(ws, "aaa");
  const hash2 = writeBlob(ws, "bbb");
  assert.notEqual(hash1, hash2);
});
