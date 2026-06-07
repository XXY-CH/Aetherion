import assert from "node:assert/strict";
import { mkdtempSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ContextPack } from "../../memory-os/src/index.ts";
import {
  createDeadlineTrigger,
  createFileTrigger,
  createManualTrigger,
  evaluateWakeup,
  hibernateRun,
  queueWakeup
} from "../src/index.ts";

function contextPack(activeLeases: string[] = []): ContextPack {
  return {
    id: "ctx_resume_run_long",
    run_id: "run_long",
    selected_memories: [],
    excluded_memories: [{ id: "mem_blocked", reason: "blocked for resume" }],
    conflicts: [],
    active_leases: activeLeases,
    capability_cards: [],
    token_budget: {
      memory_tokens: 256,
      capability_tokens: 256,
      task_tokens: 1024
    }
  };
}

function hibernationWith(trigger = createManualTrigger("hibernate_run_long")) {
  return hibernateRun({
    runId: "run_long",
    contextPack: contextPack(),
    ledgerCursor: {
      event_id: "evt_head",
      event_hash: `sha256:${"a".repeat(64)}`,
      event_count: 8
    },
    resumeSummary: "Resume from the verified Ledger head.",
    triggers: [trigger]
  });
}

test("hibernation drops authority and queueing requires a fresh policy decision", () => {
  const trigger = createManualTrigger("hibernate_run_long");
  const sleeping = hibernationWith(trigger);
  const eligible = evaluateWakeup(process.cwd(), sleeping, trigger);
  const queued = queueWakeup(sleeping, eligible, "policy_resume_queue", "run_resume_1");

  assert.equal(sleeping.active_leases_retained, false);
  assert.equal(queued.hibernation.status, "queued");
  assert.equal(queued.hibernation.attention_budget.used_wakeups, 1);
  assert.equal(queued.trigger.fresh_policy_decision_id, "policy_resume_queue");
  assert.equal(queued.trigger.auto_execute_allowed, false);
  assert.match(queued.trigger.reason, /no action or lease was issued/);
  assert.throws(() => queueWakeup(sleeping, eligible, "", "run_resume_2"), /fresh supervisor policy/);
});

test("hibernation rejects retained leases and requires a hash-bound Ledger cursor", () => {
  const trigger = createManualTrigger("hibernate_run_long");
  assert.throws(() => hibernateRun({
    runId: "run_long",
    contextPack: { ...contextPack(), run_id: "run_other" },
    ledgerCursor: { event_id: "evt_head", event_hash: `sha256:${"a".repeat(64)}`, event_count: 8 },
    resumeSummary: "Mismatched context.",
    triggers: [trigger]
  }), /context must belong to the source run/);
  assert.throws(() => hibernateRun({
    runId: "run_long",
    contextPack: contextPack(["lease_old"]),
    ledgerCursor: { event_id: "evt_head", event_hash: `sha256:${"a".repeat(64)}`, event_count: 8 },
    resumeSummary: "Invalid retained authority.",
    triggers: [trigger]
  }), /cannot retain active leases/);
  assert.throws(() => hibernateRun({
    runId: "run_long",
    contextPack: contextPack(),
    ledgerCursor: { event_id: "evt_head", event_hash: "unbound", event_count: 8 },
    resumeSummary: "Invalid cursor.",
    triggers: [trigger]
  }), /hash-bound Ledger cursor/);
  assert.throws(() => hibernateRun({
    runId: "run_long",
    contextPack: contextPack(),
    ledgerCursor: { event_id: "evt_head", event_hash: `sha256:${"a".repeat(64)}`, event_count: 8 },
    resumeSummary: "Mismatched trigger.",
    triggers: [createManualTrigger("hibernate_run_other")]
  }), /triggers must belong to the source run/);
});

test("deadline and expiry evaluation are deterministic", () => {
  const trigger = createDeadlineTrigger("hibernate_run_long", "2030-01-02T00:00:00.000Z");
  const sleeping = hibernationWith(trigger);
  assert.equal(evaluateWakeup(process.cwd(), sleeping, trigger, new Date("2030-01-01T00:00:00.000Z")).status, "scheduled");
  assert.equal(evaluateWakeup(process.cwd(), sleeping, trigger, new Date("2030-01-03T00:00:00.000Z")).status, "eligible");

  const expired = { ...sleeping, expires_at: "2029-12-31T00:00:00.000Z" };
  assert.equal(evaluateWakeup(process.cwd(), expired, trigger, new Date("2030-01-01T00:00:00.000Z")).status, "expired");
  const exhausted = { ...sleeping, attention_budget: { max_wakeups: 1, used_wakeups: 1 } };
  assert.equal(evaluateWakeup(process.cwd(), exhausted, trigger, new Date("2030-01-01T00:00:00.000Z")).status, "discarded");
});

test("file wakeups detect changes and deletion without leaving the workspace", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aetherion-hibernation-"));
  const watched = join(workspace, "watched.txt");
  writeFileSync(watched, "before\n");
  const trigger = createFileTrigger(workspace, "hibernate_run_long", "watched.txt");
  const sleeping = hibernationWith(trigger);

  assert.equal(evaluateWakeup(workspace, sleeping, trigger).status, "scheduled");
  writeFileSync(watched, "after\n");
  assert.equal(evaluateWakeup(workspace, sleeping, trigger).status, "eligible");
  unlinkSync(watched);
  assert.equal(evaluateWakeup(workspace, sleeping, trigger).status, "eligible");
  assert.throws(() => createFileTrigger(workspace, "hibernate_run_long", "../outside.txt"), /inside the workspace/);
  assert.throws(() => createFileTrigger(workspace, "hibernate_run_long", ".aetherion/events/events.jsonl"), /runtime state/);
});

test("file wakeups reject symbolic links that escape the workspace", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aetherion-hibernation-link-"));
  const outside = join(mkdtempSync(join(tmpdir(), "aetherion-hibernation-outside-")), "outside.txt");
  writeFileSync(outside, "outside\n");
  symlinkSync(outside, join(workspace, "escape.txt"));
  assert.throws(
    () => createFileTrigger(workspace, "hibernate_run_long", "escape.txt"),
    /symbolic link outside the workspace/
  );
});
