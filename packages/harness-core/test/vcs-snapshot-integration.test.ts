import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  createFileReadRequest,
  createFileWriteRequest,
  evaluateSeedPolicy,
  approveWriteWithConsent,
  type PolicyDecision
} from "../src/policy.ts";
import { createWriteConsentRecord } from "../src/consent.ts";
import {
  readLocalFileThroughPolicy,
  writeLocalFileThroughPolicy
} from "../src/local-file.ts";
import { captureTreeSnapshot, readTreeSnapshot } from "../src/vcs/tree-snapshot.ts";

async function makeWorkspace(): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-vcs-int-"));
  await mkdir(join(ws, ".aetherion"), { recursive: true });
  await writeFile(join(ws, "README.md"), "# Original\n", "utf8");
  return ws;
}

test("writeLocalFileThroughPolicy captures pre-write tree snapshot", async () => {
  const ws = await makeWorkspace();
  const targetPath = join(ws, "output.txt");
  const request = createFileWriteRequest("run_snap", targetPath);
  const consent = createWriteConsentRecord({
    runId: "run_snap",
    workspaceId: "ws",
    toolRequestId: request.id,
    path: targetPath,
    ttlSeconds: 99999
  });
  const decision = approveWriteWithConsent(ws, request, consent);
  const result = await writeLocalFileThroughPolicy(request, decision, "new content");
  assert.ok(result.pre_write_tree_hash, "write result should include pre_write_tree_hash");
  assert.match(result.pre_write_tree_hash!, /^sha256:[0-9a-f]{64}$/);
});

test("read operations do not create snapshots", async () => {
  const ws = await makeWorkspace();
  const inputPath = join(ws, "README.md");
  const request = createFileReadRequest("run_read_nosnap", inputPath);
  const decision = evaluateSeedPolicy(ws, request);
  const result = await readLocalFileThroughPolicy(request, decision);
  // FileReadResult has no tree_hash field — reads don't snapshot.
  assert.equal((result as Record<string, unknown>).pre_write_tree_hash, undefined);
});

test("two consecutive writes produce different tree hashes", async () => {
  const ws = await makeWorkspace();

  // First write
  const target1 = join(ws, "file1.txt");
  const req1 = createFileWriteRequest("run_a", target1);
  const consent1 = createWriteConsentRecord({
    runId: "run_a", workspaceId: "ws", toolRequestId: req1.id, path: target1, ttlSeconds: 99999
  });
  const dec1 = approveWriteWithConsent(ws, req1, consent1);
  const res1 = await writeLocalFileThroughPolicy(req1, dec1, "content A");

  // Second write (different file → different tree)
  const target2 = join(ws, "file2.txt");
  const req2 = createFileWriteRequest("run_b", target2);
  const consent2 = createWriteConsentRecord({
    runId: "run_b", workspaceId: "ws", toolRequestId: req2.id, path: target2, ttlSeconds: 99999
  });
  const dec2 = approveWriteWithConsent(ws, req2, consent2);
  const res2 = await writeLocalFileThroughPolicy(req2, dec2, "content B");

  assert.notEqual(res1.pre_write_tree_hash, res2.pre_write_tree_hash,
    "consecutive writes to different files should have different pre-write tree hashes");
});

test("snapshot tree manifest is readable after write", async () => {
  const ws = await makeWorkspace();
  const target = join(ws, "tracked.txt");
  const req = createFileWriteRequest("run_track", target);
  const consent = createWriteConsentRecord({
    runId: "run_track", workspaceId: "ws", toolRequestId: req.id, path: target, ttlSeconds: 99999
  });
  const dec = approveWriteWithConsent(ws, req, consent);
  const res = await writeLocalFileThroughPolicy(req, dec, "tracked content");
  const snap = readTreeSnapshot(ws, res.pre_write_tree_hash!);
  assert.ok(snap.entries["README.md"], "snapshot should include README.md");
  // output.txt shouldn't be in the PRE-write snapshot (it didn't exist yet)
  assert.equal(snap.entries["tracked.txt"], undefined);
});
