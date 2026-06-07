import assert from "node:assert/strict";
import { test } from "node:test";
import { planComputerUse, type ComputerUseAdapterManifest } from "../src/index.ts";

const stagedBrowserAdapter: ComputerUseAdapterManifest = {
  id: "browser-current-tab-observer",
  kind: "browser",
  lifecycle: "staged",
  supported_verbs: ["observe", "read"],
  channels: ["browser_dom", "browser_cdp", "browser_screenshot"],
  requires_policy_lease: true,
  can_read_sensitive_data: true,
  can_create_side_effects: false
};

const activeBrowserActionAdapter: ComputerUseAdapterManifest = {
  id: "browser-current-tab-cdp",
  kind: "browser",
  lifecycle: "active",
  supported_verbs: ["click", "type", "observe"],
  channels: ["browser_cdp", "browser_screenshot"],
  requires_policy_lease: true,
  can_read_sensitive_data: true,
  can_create_side_effects: true
};

test("computer-use scaffold requires policy and verifier", () => {
  const plan = planComputerUse({
    id: "cui_001",
    run_id: "run_demo",
    verb: "observe",
    target: { kind: "browser", origin: "https://example.com", label: "current tab", current_tab_only: true },
    expected_effect: "Capture current-tab metadata",
    target_confidence: 0.95,
    data_egress_destination: "local_artifact_store",
    taint_chain: ["public_web"]
  }, stagedBrowserAdapter);

  assert.equal(plan.policy_required, true);
  assert.equal(plan.verifier_required, true);
  assert.equal(plan.live_replay_allowed, false);
  assert.equal(plan.structured_first, true);
  assert.equal(plan.can_authorize_from_observation, false);
  assert.equal(plan.channel, "browser_dom");
});

test("computer-use scaffold rejects quarantined adapters", () => {
  assert.throws(() => planComputerUse({
    id: "cui_002",
    run_id: "run_demo",
    verb: "observe",
    target: { kind: "browser", origin: "https://example.com", current_tab_only: true },
    expected_effect: "Observe page",
    target_confidence: 0.95,
    data_egress_destination: "local_artifact_store",
    taint_chain: ["public_web"]
  }, { ...stagedBrowserAdapter, lifecycle: "quarantined" }), /not executable/);
});

test("computer-use action requires lease, approval, current tab, and structured channel", () => {
  const intent = {
    id: "cui_003",
    run_id: "run_demo",
    verb: "click" as const,
    target: { kind: "browser" as const, origin: "https://example.com", selector: "#export", current_tab_only: true },
    expected_effect: "Open export dialog",
    target_confidence: 0.93,
    data_egress_destination: "local_artifact_store",
    taint_chain: ["public_web"]
  };

  assert.throws(() => planComputerUse(intent, activeBrowserActionAdapter, {
    policy_decision_id: "policy_click"
  }), /requires a scoped lease/);

  assert.throws(() => planComputerUse(intent, activeBrowserActionAdapter, {
    policy_decision_id: "policy_click",
    lease_id: "lease_click"
  }), /requires an approval card/);

  const plan = planComputerUse(intent, activeBrowserActionAdapter, {
    policy_decision_id: "policy_click",
    lease_id: "lease_click",
    approval_card_id: "approval_click"
  });
  assert.equal(plan.channel, "browser_cdp");
  assert.equal(plan.screenshot_fallback_allowed, true);
});

test("computer-use rejects tainted external egress and non-current-tab browser control", () => {
  assert.throws(() => planComputerUse({
    id: "cui_004",
    run_id: "run_demo",
    verb: "read",
    target: { kind: "browser", origin: "https://example.com", current_tab_only: true },
    expected_effect: "Read current page",
    target_confidence: 0.9,
    data_egress_destination: "external_service",
    taint_chain: ["public_web"]
  }, stagedBrowserAdapter), /cannot be routed to external egress/);

  assert.throws(() => planComputerUse({
    id: "cui_005",
    run_id: "run_demo",
    verb: "observe",
    target: { kind: "browser", origin: "https://example.com", current_tab_only: false },
    expected_effect: "Observe all tabs",
    target_confidence: 0.9,
    data_egress_destination: "local_artifact_store",
    taint_chain: ["public_web"]
  }, stagedBrowserAdapter), /current-tab scoped/);
});
