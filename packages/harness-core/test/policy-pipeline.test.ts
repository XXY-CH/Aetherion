import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  createFileReadRequest,
  createFileWriteRequest,
  evaluateSeedPolicy,
  runPolicyPipeline,
  createBoundaryPolicyStep,
  createOperationPolicyStep,
  type PolicyPipelineStep,
  type ToolRequest
} from "../src/policy.ts";

async function makeWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "aetherion-policy-pipeline-"));
}

function normalizeDecision(decision: ReturnType<typeof evaluateSeedPolicy>): ReturnType<typeof evaluateSeedPolicy> {
  return {
    ...decision,
    lease: decision.lease ? { ...decision.lease, expires_at: "<normalized>" } : undefined
  };
}

test("boundary step denies target outside workspace", async () => {
  const workspace = await makeWorkspace();
  const step = createBoundaryPolicyStep(workspace);
  const request = createFileReadRequest("run_test", "/etc/passwd");
  const decision = step.evaluate(request, null);
  assert.equal(decision?.decision, "deny");
  assert.match(decision?.reason ?? "", /workspace boundary/i);
});

test("boundary step denies non-local-response egress for read", async () => {
  const workspace = await makeWorkspace();
  const step = createBoundaryPolicyStep(workspace);
  const request = createFileReadRequest("run_test", join(workspace, "input.txt"));
  const mutated: ToolRequest = {
    ...request,
    risk_inputs: { ...request.risk_inputs, data_egress_destination: "external_api" }
  };
  const decision = step.evaluate(mutated, null);
  assert.equal(decision?.decision, "deny");
  assert.match(decision?.reason ?? "", /egress/i);
});

test("boundary step defers for in-workspace local-egress read", async () => {
  const workspace = await makeWorkspace();
  const step = createBoundaryPolicyStep(workspace);
  const request = createFileReadRequest("run_test", join(workspace, "input.txt"));
  const decision = step.evaluate(request, null);
  assert.equal(decision, null);
});

test("operation step allows in-workspace read with lease", async () => {
  const workspace = await makeWorkspace();
  const step = createOperationPolicyStep(workspace);
  const request = createFileReadRequest("run_test", join(workspace, "input.txt"));
  const decision = step.evaluate(request, null);
  assert.equal(decision?.decision, "allow");
  assert.ok(decision?.lease, "read allow must carry a scoped lease");
  assert.equal(decision?.lease?.scope.tools?.[0], "filesystem.read");
});

test("operation step asks for write", async () => {
  const workspace = await makeWorkspace();
  const step = createOperationPolicyStep(workspace);
  const request = createFileWriteRequest("run_test", join(workspace, "output.txt"));
  const decision = step.evaluate(request, null);
  assert.equal(decision?.decision, "ask");
});

test("operation step denies unknown verb", async () => {
  const workspace = await makeWorkspace();
  const step = createOperationPolicyStep(workspace);
  const request = createFileReadRequest("run_test", join(workspace, "input.txt"));
  const mutated: ToolRequest = {
    ...request,
    operation: { ...request.operation, verb: "delete" }
  };
  const decision = step.evaluate(mutated, null);
  assert.equal(decision?.decision, "deny");
});

test("pipeline preserves exact behavior of evaluateSeedPolicy for read", async () => {
  const workspace = await makeWorkspace();
  const request = createFileReadRequest("run_golden_read", join(workspace, "input.txt"));
  const legacy = evaluateSeedPolicy(workspace, request);
  const piped = runPolicyPipeline(workspace, request);
  assert.deepEqual(normalizeDecision(piped), normalizeDecision(legacy));
});

test("pipeline preserves exact behavior of evaluateSeedPolicy for write", async () => {
  const workspace = await makeWorkspace();
  const request = createFileWriteRequest("run_golden_write", join(workspace, "output.txt"));
  const legacy = evaluateSeedPolicy(workspace, request);
  const piped = runPolicyPipeline(workspace, request);
  assert.deepEqual(normalizeDecision(piped), normalizeDecision(legacy));
});

test("pipeline preserves exact behavior of evaluateSeedPolicy for outside-workspace deny", async () => {
  const workspace = await makeWorkspace();
  const request = createFileReadRequest("run_golden_outside", "/etc/passwd");
  const legacy = evaluateSeedPolicy(workspace, request);
  const piped = runPolicyPipeline(workspace, request);
  assert.deepEqual(normalizeDecision(piped), normalizeDecision(legacy));
});

test("pipeline returns deny when all steps defer", async () => {
  const workspace = await makeWorkspace();
  const deferringStep: PolicyPipelineStep = {
    name: "always-defer",
    evaluate: () => null
  };
  const request = createFileReadRequest("run_defer", join(workspace, "input.txt"));
  const decision = runPolicyPipeline(workspace, request, [deferringStep]);
  assert.equal(decision.decision, "deny");
});
