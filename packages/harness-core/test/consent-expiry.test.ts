import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  createFileWriteRequest,
  approveWriteWithConsent,
  type PolicyDecision
} from "../src/policy.ts";
import { createWriteConsentRecord } from "../src/consent.ts";

async function makeWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "aetherion-consent-expiry-"));
}

test("createWriteConsentRecord sets expires_at to approvedAt + ttlSeconds", async () => {
  const consent = createWriteConsentRecord({
    runId: "run_a",
    workspaceId: "ws",
    toolRequestId: "req_a",
    path: "/tmp/a.txt",
    approvedAt: "2026-01-01T00:00:00.000Z",
    ttlSeconds: 120
  });
  assert.equal(consent.expires_at, "2026-01-01T00:02:00.000Z");
});

test("createWriteConsentRecord defaults ttlSeconds to 300", async () => {
  const consent = createWriteConsentRecord({
    runId: "run_b",
    workspaceId: "ws",
    toolRequestId: "req_b",
    path: "/tmp/b.txt",
    approvedAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(consent.expires_at, "2026-01-01T00:05:00.000Z");
});

test("createWriteConsentRecord with ttlSeconds=0 sets expires_at to approvedAt", async () => {
  const consent = createWriteConsentRecord({
    runId: "run_c",
    workspaceId: "ws",
    toolRequestId: "req_c",
    path: "/tmp/c.txt",
    approvedAt: "2026-01-01T00:00:00.000Z",
    ttlSeconds: 0
  });
  assert.equal(consent.expires_at, "2026-01-01T00:00:00.000Z");
});

test("approveWriteWithConsent rejects expired consent", async () => {
  const workspace = await makeWorkspace();
  const request = createFileWriteRequest("run_expired", join(workspace, "out.txt"));
  const consent = createWriteConsentRecord({
    runId: "run_expired",
    workspaceId: "ws",
    toolRequestId: request.id,
    path: join(workspace, "out.txt"),
    approvedAt: "2020-01-01T00:00:00.000Z",
    ttlSeconds: 60
  });
  // expires_at is 2020-01-01T00:01:00 — long in the past
  const decision = approveWriteWithConsent(workspace, request, consent);
  assert.equal(decision.decision, "deny");
  assert.match(decision.reason, /expired/i);
});

test("approveWriteWithConsent accepts consent with null expires_at (backward compat)", async () => {
  const workspace = await makeWorkspace();
  const request = createFileWriteRequest("run_null", join(workspace, "out.txt"));
  const consent = createWriteConsentRecord({
    runId: "run_null",
    workspaceId: "ws",
    toolRequestId: request.id,
    path: join(workspace, "out.txt")
  });
  // Force null to simulate legacy consent
  consent.expires_at = null;
  const decision = approveWriteWithConsent(workspace, request, consent);
  assert.equal(decision.decision, "allow");
});

test("approveWriteWithConsent accepts consent with future expires_at", async () => {
  const workspace = await makeWorkspace();
  const request = createFileWriteRequest("run_future", join(workspace, "out.txt"));
  const futureDate = new Date(Date.now() + 600_000).toISOString();
  const consent = createWriteConsentRecord({
    runId: "run_future",
    workspaceId: "ws",
    toolRequestId: request.id,
    path: join(workspace, "out.txt"),
    approvedAt: new Date().toISOString(),
    ttlSeconds: 600
  });
  const decision = approveWriteWithConsent(workspace, request, consent);
  assert.equal(decision.decision, "allow");
});
