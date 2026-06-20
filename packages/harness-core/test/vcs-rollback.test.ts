import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  captureTreeSnapshot,
  readTreeSnapshot,
  restoreTree,
  type TreeSnapshot
} from "../src/vcs/tree-snapshot.ts";
import {
  rollbackToTree,
  rollbackToSnapshot,
  findNearestSnapshot
} from "../src/vcs/rollback.ts";
import type { EventRecord } from "../src/ledger.ts";

async function makeWorkspace(files: Record<string, string> = {}): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-rollback-"));
  await mkdir(join(ws, ".aetherion"), { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(ws, path);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content, "utf8");
  }
  return ws;
}

test("rollbackToTree restores files to snapshot state", async () => {
  const ws = await makeWorkspace({ "a.txt": "original", "b.txt": "original" });
  const snap = captureTreeSnapshot(ws);
  // Mutate
  await writeFile(join(ws, "a.txt"), "changed", "utf8");
  await writeFile(join(ws, "b.txt"), "changed", "utf8");
  // Rollback
  const result = rollbackToTree(ws, snap);
  assert.equal(result.restored, true);
  assert.equal(result.partial_rollback, false);
  assert.equal(await readFile(join(ws, "a.txt"), "utf8"), "original");
  assert.equal(await readFile(join(ws, "b.txt"), "utf8"), "original");
});

test("rollbackToTree deletes files added after snapshot", async () => {
  const ws = await makeWorkspace({ "keep.txt": "keep" });
  const snap = captureTreeSnapshot(ws);
  // Add a file
  await writeFile(join(ws, "added.txt"), "added", "utf8");
  // Rollback
  rollbackToTree(ws, snap);
  await assert.rejects(() => readFile(join(ws, "added.txt"), "utf8"));
});

test("rollbackToSnapshot by tree_hash reads manifest and restores", async () => {
  const ws = await makeWorkspace({ "data.txt": "v1" });
  const snap = captureTreeSnapshot(ws);
  // Change file
  await writeFile(join(ws, "data.txt"), "v2", "utf8");
  // Rollback by hash
  rollbackToSnapshot(ws, snap.tree_hash);
  assert.equal(await readFile(join(ws, "data.txt"), "utf8"), "v1");
});

test("findNearestSnapshot finds the latest snapshot before a target event", () => {
  const events: EventRecord[] = [
    { id: "evt_1", event_type: "run.started", summary: "start" } as EventRecord,
    { id: "evt_2", event_type: "vcs.snapshot.created", summary: "snap sha256:aaa", payload_ref: "sha256:aaa" } as EventRecord,
    { id: "evt_3", event_type: "action.recorded", summary: "wrote file", payload_ref: "sha256:aaa" } as EventRecord,
    { id: "evt_4", event_type: "vcs.snapshot.created", summary: "snap sha256:bbb", payload_ref: "sha256:bbb" } as EventRecord,
    { id: "evt_5", event_type: "action.recorded", summary: "wrote again", payload_ref: "sha256:bbb" } as EventRecord,
  ];
  // Target evt_5 → nearest snapshot is evt_4 (sha256:bbb)
  const snap = findNearestSnapshot(events, "evt_5");
  assert.equal(snap, "sha256:bbb");
  // Target evt_3 → nearest snapshot is evt_2 (sha256:aaa)
  const snap2 = findNearestSnapshot(events, "evt_3");
  assert.equal(snap2, "sha256:aaa");
});

test("findNearestSnapshot returns null when no snapshot precedes target", () => {
  const events: EventRecord[] = [
    { id: "evt_1", event_type: "run.started", summary: "start" } as EventRecord,
    { id: "evt_2", event_type: "action.recorded", summary: "wrote" } as EventRecord,
  ];
  const snap = findNearestSnapshot(events, "evt_2");
  assert.equal(snap, null);
});

test("rollback result records which files were restored", async () => {
  const ws = await makeWorkspace({ "x.txt": "x", "y.txt": "y" });
  const snap = captureTreeSnapshot(ws);
  await writeFile(join(ws, "x.txt"), "modified", "utf8");
  await writeFile(join(ws, "z.txt"), "new file", "utf8");
  const result = rollbackToTree(ws, snap);
  // x.txt was modified (restored), y.txt unchanged, z.txt deleted
  assert.ok(result.restored_files.includes("x.txt"));
  assert.ok(result.deleted_files.includes("z.txt"));
});

test("rollbackToTree with empty workspace (genesis) clears all tracked files", async () => {
  const ws = await makeWorkspace({});
  const emptySnap = captureTreeSnapshot(ws);
  // Add files
  await writeFile(join(ws, "new1.txt"), "content", "utf8");
  await writeFile(join(ws, "new2.txt"), "content", "utf8");
  // Rollback to empty genesis
  rollbackToTree(ws, emptySnap);
  await assert.rejects(() => readFile(join(ws, "new1.txt"), "utf8"));
  await assert.rejects(() => readFile(join(ws, "new2.txt"), "utf8"));
});
