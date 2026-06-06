import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCausalEdges, counterfactualReport } from "../src/index.ts";

test("causal memory cites events and counterfactuals do not allow live side effects", () => {
  const edges = buildCausalEdges([
    { id: "evt_a", timestamp: "", workspace_id: "ws", run_id: "run", event_type: "policy.decided", actor: { type: "system", id: "policy" }, summary: "", sensitivity: "private", taint: { sources: ["trusted_system"], can_authorize_actions: false } },
    { id: "evt_b", timestamp: "", workspace_id: "ws", run_id: "run", event_type: "action.recorded", actor: { type: "system", id: "fs" }, summary: "", sensitivity: "private", taint: { sources: ["trusted_system"], can_authorize_actions: false } }
  ]);
  assert.deepEqual(edges[0].source_events, ["evt_a", "evt_b"]);
  const report = counterfactualReport("checkpoint_a", "deny write", edges.length);
  assert.equal(report.live_side_effects_allowed, false);
});
