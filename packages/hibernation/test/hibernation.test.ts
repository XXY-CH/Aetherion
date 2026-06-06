import assert from "node:assert/strict";
import { test } from "node:test";
import { hibernateRun, wakeRun } from "../src/index.ts";

test("hibernation drops active leases and wake requires policy recheck", () => {
  const sleep = hibernateRun("run_long", "ctx_minimal");
  assert.equal(sleep.active_leases_retained, false);
  const wake = wakeRun(sleep, "manual");
  assert.equal(wake.policy_recheck_required, true);
  assert.equal(wake.status, "queued");
});
