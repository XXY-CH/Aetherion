import assert from "node:assert/strict";
import { test } from "node:test";
import { approveRehearsal, createBranch, createCheckpoint, rehearse } from "../src/index.ts";

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
