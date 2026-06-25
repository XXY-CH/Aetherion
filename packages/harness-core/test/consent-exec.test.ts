import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { createExecConsentRecord, validateAgainstSchema } from "../src/index.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");

test("createExecConsentRecord builds a schema-valid command consent", async () => {
  const consent = createExecConsentRecord({
    runId: "run_exec_1",
    workspaceId: "ws",
    toolRequestId: "toolreq_x",
    riskLevel: "L3",
    kind: "command",
    target: "ls -la",
    depth: 2,
    approvedAt: "2026-01-01T00:00:00.000Z",
    ttlSeconds: 300
  });
  assert.equal(consent.id, "consent_run_exec_1_exec_2");
  assert.equal(consent.decision, "approved");
  assert.equal(consent.expires_at, "2026-01-01T00:05:00.000Z");
  assert.deepEqual(consent.scope, { actions: ["exec"], commands: ["ls -la"] });

  const result = await validateAgainstSchema(repoRoot, "consent-record.schema.json", consent);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("createExecConsentRecord builds a schema-valid task consent for agent_spawn", async () => {
  const consent = createExecConsentRecord({
    runId: "run_spawn_1",
    workspaceId: "ws",
    toolRequestId: "toolreq_y",
    riskLevel: "L4",
    kind: "task",
    target: "summarize the repo",
    depth: 0
  });
  assert.equal(consent.id, "consent_run_spawn_1_spawn_0");
  assert.deepEqual(consent.scope, { actions: ["spawn"], tasks: ["summarize the repo"] });

  const result = await validateAgainstSchema(repoRoot, "consent-record.schema.json", consent);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("distinct exec depths produce distinct consent ids within one run", () => {
  const first = createExecConsentRecord({
    runId: "run_r", workspaceId: "ws", toolRequestId: "t", riskLevel: "L3", kind: "command", target: "echo a", depth: 1
  });
  const second = createExecConsentRecord({
    runId: "run_r", workspaceId: "ws", toolRequestId: "t", riskLevel: "L3", kind: "command", target: "echo b", depth: 2
  });
  assert.notEqual(first.id, second.id);
});
