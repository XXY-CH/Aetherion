import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  createFileReadRequest,
  createFileWriteRequest,
  evaluateSeedPolicy,
  approveWriteWithConsent,
  type PolicyDecision,
  type ToolRequest
} from "../src/policy.ts";
import { createWriteConsentRecord } from "../src/consent.ts";
import {
  readLocalFileThroughPolicy,
  writeLocalFileThroughPolicy
} from "../src/local-file.ts";

async function makeWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "aetherion-lease-scope-"));
}

function tamperLease(decision: PolicyDecision, override: Partial<NonNullable<PolicyDecision["lease"]>["scope"]>): PolicyDecision {
  if (!decision.lease) {
    throw new Error("test setup: decision has no lease to tamper");
  }
  return {
    ...decision,
    lease: {
      ...decision.lease,
      scope: { ...decision.lease.scope, ...override }
    }
  };
}

test("read execution succeeds when lease scope tools and egress match", async () => {
  const workspace = await makeWorkspace();
  const inputPath = join(workspace, "input.txt");
  await writeFile(inputPath, "hello");
  const request = createFileReadRequest("run_read_ok", inputPath);
  const decision = evaluateSeedPolicy(workspace, request);
  const result = await readLocalFileThroughPolicy(request, decision);
  assert.equal(result.contents, "hello");
});

test("read execution rejects when lease tools does not include filesystem.read", async () => {
  const workspace = await makeWorkspace();
  const inputPath = join(workspace, "input.txt");
  await writeFile(inputPath, "hello");
  const request = createFileReadRequest("run_read_badtool", inputPath);
  const decision = evaluateSeedPolicy(workspace, request);
  const tampered = tamperLease(decision, { tools: ["filesystem.write"] });
  await assert.rejects(
    () => readLocalFileThroughPolicy(request, tampered),
    /tool/i
  );
});

test("read execution rejects when lease egress does not include request egress destination", async () => {
  const workspace = await makeWorkspace();
  const inputPath = join(workspace, "input.txt");
  await writeFile(inputPath, "hello");
  const request = createFileReadRequest("run_read_badegress", inputPath);
  const decision = evaluateSeedPolicy(workspace, request);
  const tampered = tamperLease(decision, { egress: ["external_api"] });
  await assert.rejects(
    () => readLocalFileThroughPolicy(request, tampered),
    /egress/i
  );
});

test("write execution succeeds when lease scope tools and egress match", async () => {
  const workspace = await makeWorkspace();
  const outputPath = join(workspace, "output.txt");
  const request = createFileWriteRequest("run_write_ok", outputPath);
  const preDecision = evaluateSeedPolicy(workspace, request);
  const consent = createWriteConsentRecord({
    runId: "run_write_ok",
    workspaceId: "ws",
    toolRequestId: request.id,
    path: outputPath
  });
  const decision = approveWriteWithConsent(workspace, request, consent);
  const result = await writeLocalFileThroughPolicy(request, decision, "data");
  assert.equal(result.bytes, 4);
});

test("write execution rejects when lease tools does not include filesystem.write", async () => {
  const workspace = await makeWorkspace();
  const outputPath = join(workspace, "output.txt");
  const request = createFileWriteRequest("run_write_badtool", outputPath);
  const preDecision = evaluateSeedPolicy(workspace, request);
  const consent = createWriteConsentRecord({
    runId: "run_write_badtool",
    workspaceId: "ws",
    toolRequestId: request.id,
    path: outputPath
  });
  const decision = approveWriteWithConsent(workspace, request, consent);
  const tampered = tamperLease(decision, { tools: ["filesystem.read"] });
  await assert.rejects(
    () => writeLocalFileThroughPolicy(request, tampered, "data"),
    /tool/i
  );
});

test("write execution rejects when lease egress does not include request egress destination", async () => {
  const workspace = await makeWorkspace();
  const outputPath = join(workspace, "output.txt");
  const request = createFileWriteRequest("run_write_badegress", outputPath);
  const consent = createWriteConsentRecord({
    runId: "run_write_badegress",
    workspaceId: "ws",
    toolRequestId: request.id,
    path: outputPath
  });
  const decision = approveWriteWithConsent(workspace, request, consent);
  const tampered = tamperLease(decision, { egress: ["external_api"] });
  await assert.rejects(
    () => writeLocalFileThroughPolicy(request, tampered, "data"),
    /egress/i
  );
});

test("execution rejects unknown verb (fail closed)", async () => {
  const workspace = await makeWorkspace();
  const inputPath = join(workspace, "input.txt");
  await writeFile(inputPath, "hello");
  const baseRequest = createFileReadRequest("run_unknown_verb", inputPath);
  const request: ToolRequest = {
    ...baseRequest,
    operation: { ...baseRequest.operation, verb: "delete" }
  };
  const decision = evaluateSeedPolicy(workspace, baseRequest);
  const tampered = tamperLease(decision, { tools: ["filesystem.delete"] });
  await assert.rejects(
    () => readLocalFileThroughPolicy(request as ToolRequest, tampered),
    /tool/i
  );
});
