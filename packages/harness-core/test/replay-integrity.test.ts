import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { reconstructTrace } from "../src/replay.ts";
import { createWorkspace, eventRecord, appendEvent, type Workspace } from "../src/ledger.ts";
import type { RunManifest } from "../src/workspace.ts";

// repoRoot must contain schemas/ for appendEvent validation.
const repoRoot = resolve(import.meta.dirname, "..", "..", "..");

async function makeWorkspace(root: string): Promise<Workspace> {
  return createWorkspace(root, "ws_test");
}

function makeRunManifest(runId: string, eventIds: string[]): RunManifest {
  return {
    id: runId,
    workspace_id: "ws_test",
    started_at: "2026-01-01T00:00:00.000Z",
    completed_at: "2026-01-01T00:01:00.000Z",
    status: "completed",
    entry_surface: "tui",
    event_ids: eventIds
  };
}

async function appendSimpleEvent(repoRoot: string, workspace: Workspace, runId: string, eventId: string, eventType: string): Promise<void> {
  await appendEvent(repoRoot, workspace, eventRecord({
    id: eventId,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: eventType,
    actor: { type: "system", id: "test" },
    summary: "test event"
  }));
}

test("reconstructTrace without manifest returns empty manifest_event_ids and missing_event_ids", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-replay-"));
  const workspace = await makeWorkspace(root);
  await appendSimpleEvent(repoRoot, workspace, "run_x", "evt_1", "run.started");
  const trace = await reconstructTrace(workspace, "run_x");
  assert.deepEqual(trace.manifest_event_ids, []);
  assert.deepEqual(trace.missing_event_ids, []);
});

test("reconstructTrace with matching manifest reports no missing events", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-replay-"));
  const workspace = await makeWorkspace(root);
  await appendSimpleEvent(repoRoot, workspace, "run_x", "evt_1", "run.started");
  await appendSimpleEvent(repoRoot, workspace, "run_x", "evt_2", "run.completed");
  const manifest = makeRunManifest("run_x", ["evt_1", "evt_2"]);
  const trace = await reconstructTrace(workspace, "run_x", manifest);
  assert.deepEqual(trace.missing_event_ids, []);
  assert.deepEqual(trace.manifest_event_ids, ["evt_1", "evt_2"]);
});

test("reconstructTrace with manifest reports missing_event_ids when ledger is short", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-replay-"));
  const workspace = await makeWorkspace(root);
  await appendSimpleEvent(repoRoot, workspace, "run_x", "evt_1", "run.started");
  const manifest = makeRunManifest("run_x", ["evt_1", "evt_2", "evt_3"]);
  const trace = await reconstructTrace(workspace, "run_x", manifest);
  assert.deepEqual(trace.missing_event_ids, ["evt_2", "evt_3"]);
  assert.deepEqual(trace.manifest_event_ids, ["evt_1", "evt_2", "evt_3"]);
});

test("missing_event_ids is sorted and contains only manifest ids absent from ledger", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-replay-"));
  const workspace = await makeWorkspace(root);
  await appendSimpleEvent(repoRoot, workspace, "run_x", "evt_b", "run.started");
  const manifest = makeRunManifest("run_x", ["evt_c", "evt_a", "evt_b"]);
  const trace = await reconstructTrace(workspace, "run_x", manifest);
  assert.deepEqual(trace.missing_event_ids, ["evt_a", "evt_c"]);
});
