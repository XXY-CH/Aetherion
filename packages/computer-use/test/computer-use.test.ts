import assert from "node:assert/strict";
import { test } from "node:test";
import { planComputerUse, type ComputerUseAdapterManifest } from "../src/index.ts";

const stagedBrowserAdapter: ComputerUseAdapterManifest = {
  id: "browser-current-tab-observer",
  kind: "browser",
  lifecycle: "staged",
  supported_verbs: ["observe", "read"],
  requires_policy_lease: true,
  can_read_sensitive_data: true,
  can_create_side_effects: false
};

test("computer-use scaffold requires policy and verifier", () => {
  const plan = planComputerUse({
    id: "cui_001",
    run_id: "run_demo",
    verb: "observe",
    target: { kind: "browser", origin: "https://example.com", label: "current tab" },
    expected_effect: "Capture current-tab metadata",
    target_confidence: 0.95,
    data_egress_destination: "local_artifact_store",
    taint_chain: ["public_web"]
  }, stagedBrowserAdapter);

  assert.equal(plan.policy_required, true);
  assert.equal(plan.verifier_required, true);
  assert.equal(plan.live_replay_allowed, false);
});

test("computer-use scaffold rejects quarantined adapters", () => {
  assert.throws(() => planComputerUse({
    id: "cui_002",
    run_id: "run_demo",
    verb: "observe",
    target: { kind: "browser", origin: "https://example.com" },
    expected_effect: "Observe page",
    target_confidence: 0.95,
    data_egress_destination: "local_artifact_store",
    taint_chain: ["public_web"]
  }, { ...stagedBrowserAdapter, lifecycle: "quarantined" }), /not executable/);
});
