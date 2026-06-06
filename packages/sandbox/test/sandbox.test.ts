import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { approveRehearsal, createBranch, createCheckpoint, rehearse, rehearseFileWrite } from "../src/index.ts";

test("sandbox branches never inherit live authority or mutate real workspace", () => {
  const checkpoint = createCheckpoint("run_demo", "evt_write_ask", "sha256:head");
  assert.equal(checkpoint.active_leases_reusable, false);
  assert.equal(checkpoint.event_hash, "sha256:head");
  const branch = createBranch(checkpoint);
  assert.equal(branch.inherits_authority, false);
  assert.equal(branch.source_event_id, "evt_write_ask");
  assert.equal(branch.source_event_hash, "sha256:head");
  assert.equal(branch.head_event_id, "evt_write_ask");
  assert.equal(branch.head_event_hash, "sha256:head");
  const rehearsal = rehearse(branch, "preview only");
  assert.equal(rehearsal.real_workspace_mutated, false);
  assert.equal(rehearsal.approval_required, true);

  const approved = approveRehearsal(rehearsal, branch, "evt_policy_fresh", "evt_action_new");
  assert.equal(approved.branch.status, "approved");
  assert.equal(approved.approval.fresh_policy_evaluated, true);
  assert.equal(approved.approval.inherited_authority, false);
  assert.equal(approved.approval.policy_event_id, "evt_policy_fresh");
  assert.equal(approved.approval.live_action_event_id, "evt_action_new");
});

test("file rehearsal writes only to branch sandbox and rejects boundary escape", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "aetherion-sandbox-"));
  const target = join(workspace, "notes.txt");
  await writeFile(target, "original\n");
  const branch = createBranch(createCheckpoint("run_file", "evt_file", "sha256:file"));
  const rehearsal = await rehearseFileWrite(workspace, branch, "notes.txt", "proposed\n");

  assert.equal(await readFile(target, "utf8"), "original\n");
  assert.equal(await readFile(join(workspace, rehearsal.sandbox_path!), "utf8"), "proposed\n");
  assert.equal(rehearsal.real_workspace_mutated, false);
  assert.match(rehearsal.result, /--- a\/notes\.txt/);
  assert.match(rehearsal.original_sha256!, /^sha256:/);
  assert.match(rehearsal.proposed_sha256!, /^sha256:/);

  await assert.rejects(
    () => rehearseFileWrite(workspace, branch, "../outside.txt", "nope"),
    /outside workspace boundary/
  );
  await assert.rejects(
    () => rehearseFileWrite(workspace, branch, ".aetherion/events/events.jsonl", "nope"),
    /cannot modify Aetherion runtime state/
  );
});
