import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Workspace } from "./ledger.ts";
import { createApprovalCard, type ApprovalCard } from "./approval.ts";
import { createBoundaryFacts, writeBoundaryFactsArtifact } from "./boundary.ts";
import { consentRecordArtifactRef, createWriteConsentRecord } from "./consent.ts";
import { createFileReadRequest, createFileWriteRequest, type PolicyDecision, type ToolRequest } from "./policy.ts";
import { composeRisk, type RiskComposition } from "./risk.ts";
import { defaultSafeSummary } from "./output-summary.ts";
import { reconstructTrace, type ReconstructedTrace } from "./replay.ts";
import { validateAgainstSchema } from "./schema.ts";
import { callSupervisorRpc, rpcResult } from "./supervisor-client.ts";
import type { ObservationRecord, VerificationRecord } from "./verify.ts";
import {
  completeRunManifestWithEventSequence,
  createRunManifest,
  assertWorkspaceIdForRoot,
  kernelFileRunApprovedEventSequence,
  kernelFileRunBlockedEventSequence,
  loadWorkspaceFromRegistry,
  recordRunEvent,
  workspaceIdForRoot,
  type RunManifest,
  type WorkspaceRegistry
} from "./workspace.ts";

export type SupervisorKernelRunInput = {
  repoRoot: string;
  workspaceRoot: string;
  workspaceId?: string;
  runId?: string;
  inputPath: string;
  outputPath: string;
  summaryText?: string;
  approveWrite: boolean;
};

export type SupervisorKernelRunResult = {
  workspace: Workspace;
  workspaceRegistry: WorkspaceRegistry;
  runManifest: RunManifest;
  runId: string;
  readRequest: ToolRequest;
  readRisk: RiskComposition;
  readDecision: PolicyDecision;
  writeRequest: ToolRequest;
  writeRisk: RiskComposition;
  writePreDecision: PolicyDecision;
  approvalCard: ApprovalCard;
  writeDecision?: PolicyDecision;
  observation?: ObservationRecord;
  verification?: VerificationRecord;
  trace: ReconstructedTrace;
  supervisor: "stdio";
};

export async function runSupervisorKernelLoop(input: SupervisorKernelRunInput): Promise<SupervisorKernelRunResult> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const workspaceId = input.workspaceId ?? workspaceIdForRoot(workspaceRoot);
  assertWorkspaceIdForRoot(workspaceRoot, workspaceId);
  const runId = input.runId ?? `run_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const inputPath = resolve(workspaceRoot, input.inputPath);
  const outputPath = resolve(workspaceRoot, input.outputPath);
  await mkdir(dirname(outputPath), { recursive: true });

  await supervisorCall(input.repoRoot, {
    id: `rpc_${runId}_workspace_init`,
    method: "workspace.init",
    workspace_root: workspaceRoot,
    workspace_id: workspaceId,
    run_id: runId
  });
  const { workspace, registry: workspaceRegistry } = await loadWorkspaceFromRegistry(workspaceRoot);
  const runManifest = await createRunManifest(input.repoRoot, workspace, runId, "Ether Rust supervisor kernel loop");
  const boundaryFacts = createBoundaryFacts({
    workspace,
    registry: workspaceRegistry,
    manifest: runManifest,
    workspaceFileWriteRequested: true
  });
  const boundaryRef = await writeBoundaryFactsArtifact(input.repoRoot, workspace, boundaryFacts);
  await appendSupervisorEvent(
    input.repoRoot,
    workspace,
    runManifest,
    runId,
    "run.started",
    `Ether run started on tui with authority ${workspaceRegistry.authority}; user_id, device_id, channel_id, and secret_vault are not recorded.`,
    boundaryRef
  );

  await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "user.message", `Ether requested supervisor summary from ${input.inputPath} to ${input.outputPath}.`);

  const readRequest = createFileReadRequest(runId, inputPath);
  const readRisk = composeRisk(readRequest);
  const readResult = await supervisorCall(input.repoRoot, {
    id: `rpc_${runId}_read_traced`,
    method: "file.read.traced",
    workspace_root: workspaceRoot,
    workspace_id: workspaceId,
    run_id: runId,
    path: inputPath
  });
  await recordSupervisorEventIds(input.repoRoot, workspace, runManifest, readResult, ["request_event_id", "risk_event_id", "policy_event_id", "lease_event_id", "result_event_id"]);
  const readDecision = policyFromSupervisor(runId, readRequest, readResult, "Explicit workspace-scoped read evaluated and executed by Rust supervisor.");
  if (typeof readResult.contents !== "string") {
    throw new Error("Rust supervisor file.read returned no contents");
  }

  const writeRequest = createFileWriteRequest(runId, outputPath);
  const writeRisk = composeRisk(writeRequest);
  const writePreEval = await supervisorCall(input.repoRoot, {
    id: `rpc_${runId}_write_prepare`,
    method: "file.write.prepare",
    workspace_root: workspaceRoot,
    workspace_id: workspaceId,
    run_id: runId,
    path: outputPath
  });
  await recordSupervisorEventIds(input.repoRoot, workspace, runManifest, writePreEval, ["request_event_id", "risk_event_id", "policy_event_id"]);
  const writePreDecision = policyFromSupervisor(runId, writeRequest, writePreEval, "Workspace write requires explicit consent from Rust supervisor policy.");
  const approvalCard = createApprovalCard(writeRequest, writePreDecision);

  if (!input.approveWrite) {
    await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "run.completed", "Run stopped before supervisor write because approval was not provided.");
    await completeRunManifestWithEventSequence(input.repoRoot, workspace, runManifest, "blocked", kernelFileRunBlockedEventSequence(runId));
    return {
      workspace,
      workspaceRegistry,
      runManifest,
      runId,
      readRequest,
      readRisk,
      readDecision,
      writeRequest,
      writeRisk,
      writePreDecision,
      approvalCard,
      trace: await reconstructTrace(workspace, runId),
      supervisor: "stdio"
    };
  }

  const summaryText = input.summaryText ?? defaultSafeSummary();
  const consent = createWriteConsentRecord({
    runId,
    workspaceId,
    toolRequestId: writeRequest.id,
    path: outputPath
  });
  const consentValidation = await validateConsentRecord(input.repoRoot, consent);
  const consentRef = consentRecordArtifactRef(runId);
  const writeResult = await supervisorCall(input.repoRoot, {
    id: `rpc_${runId}_write_commit`,
    method: "file.write.commit",
    workspace_root: workspaceRoot,
    workspace_id: workspaceId,
    run_id: runId,
    path: outputPath,
    approved: true,
    consent_record_json: consentValidation,
    consent_payload_ref: consentRef,
    contents: summaryText
  });
  const writeDecision = policyFromSupervisor(runId, writeRequest, writeResult, "Explicit consent approved workspace-scoped write through Rust supervisor.");
  if (writeResult.written !== true || writeDecision.decision !== "allow" || !writeDecision.lease) {
    throw new Error("Rust supervisor did not return an allowed lease-backed write result");
  }
  await recordSupervisorEventIds(input.repoRoot, workspace, runManifest, writeResult, [
    "consent_event_id",
    "policy_event_id",
    "lease_event_id",
    "action_event_id",
    "observation_event_id",
    "verification_event_id"
  ]);

  const observation = observationFromSupervisor(runId, writeResult);
  const verification = verificationFromSupervisor(runId, writeResult, observation);
  await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "run.completed", "Ether Rust supervisor kernel loop completed.");
  await completeRunManifestWithEventSequence(input.repoRoot, workspace, runManifest, "completed", kernelFileRunApprovedEventSequence(runId));

  return {
    workspace,
    workspaceRegistry,
    runManifest,
    runId,
    readRequest,
    readRisk,
    readDecision,
    writeRequest,
    writeRisk,
    writePreDecision,
    approvalCard,
    writeDecision,
    observation,
    verification,
    trace: await reconstructTrace(workspace, runId),
    supervisor: "stdio"
  };
}

async function validateConsentRecord(repoRoot: string, consent: unknown): Promise<string> {
  const result = await validateAgainstSchema(repoRoot, "consent-record.schema.json", consent);
  if (!result.valid) {
    throw new Error(`consent-record.schema.json validation failed: ${result.errors.join("; ")}`);
  }
  return `${JSON.stringify(consent, null, 2)}\n`;
}

async function supervisorCall(repoRoot: string, request: Parameters<typeof callSupervisorRpc>[1]): Promise<Record<string, unknown>> {
  return rpcResult(await callSupervisorRpc(repoRoot, request));
}

async function appendSupervisorEvent(repoRoot: string, workspace: Workspace, manifest: RunManifest, runId: string, event_type: string, summary: string, payloadRef?: string): Promise<void> {
  const appendResult = await supervisorCall(repoRoot, {
    id: `rpc_${event_type}_${randomUUID()}`,
    method: "event.append",
    workspace_root: workspace.root,
    workspace_id: workspace.id,
    run_id: runId,
    event_type,
    summary,
    payload_ref: payloadRef
  });
  if (typeof appendResult.event_id !== "string" || !appendResult.event_id) {
    throw new Error(`Rust supervisor event.append returned no event id for ${event_type}`);
  }
  await recordRunEvent(repoRoot, workspace, manifest, appendResult.event_id);
}

async function recordSupervisorEventIds(
  repoRoot: string,
  workspace: Workspace,
  manifest: RunManifest,
  result: Record<string, unknown>,
  keys: string[]
): Promise<void> {
  for (const key of keys) {
    const eventId = result[key];
    if (eventId === "") {
      continue;
    }
    if (typeof eventId !== "string") {
      throw new Error(`Rust supervisor traced action returned no ${key}`);
    }
    await recordRunEvent(repoRoot, workspace, manifest, eventId);
  }
}

function policyFromSupervisor(runId: string, request: ToolRequest, result: Record<string, unknown>, reason: string): PolicyDecision {
  const decision = result.decision === "allow" ? "allow" : result.decision === "ask" ? "ask" : "deny";
  const risk_level = result.risk_level === "L1" ? "L1" : result.risk_level === "L3" ? "L3" : "L5";
  const leaseId = typeof result.lease_id === "string" ? result.lease_id : "";
  return {
    id: `policy_${runId}_${request.operation.verb}_${decision}`,
    tool_request_id: request.id,
    decision,
    risk_level,
    reason,
    lease: leaseId ? {
      id: leaseId,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      scope: {
        tools: [`filesystem.${request.operation.verb}`],
        paths: [request.operation.target.uri.replace("file://", "")],
        egress: [request.risk_inputs.data_egress_destination]
      }
    } : undefined
  };
}

function observationFromSupervisor(runId: string, result: Record<string, unknown>): ObservationRecord {
  const actionId = stringResult(result, "action_id", `action_${runId}_write`);
  return {
    id: stringResult(result, "observation_id", `obs_${runId}_file`),
    run_id: runId,
    action_id: actionId,
    timestamp: new Date().toISOString(),
    observer: "local_supervisor",
    summary: stringResult(result, "observation_summary", "Supervisor observed workspace file state after scoped write."),
    artifact_ref: `artifact://${runId}/supervisor_file_verification`,
    sensitivity: "private",
    taint: { sources: ["trusted_system"], can_authorize_actions: false }
  };
}

function verificationFromSupervisor(runId: string, result: Record<string, unknown>, observation: ObservationRecord): VerificationRecord {
  const status = result.verification_status === "failed"
    ? "failed"
    : result.verification_status === "partial"
      ? "partial"
      : "passed";
  return {
    id: stringResult(result, "verification_id", `verify_${runId}_file`),
    run_id: runId,
    action_id: observation.action_id,
    observation_id: observation.id,
    expected_effect: "Supervisor write commit should leave the workspace file with exact committed contents.",
    status,
    summary: stringResult(result, "verification_summary", "Supervisor verified workspace file contents after scoped write."),
    unexpected_side_effects: []
  };
}

function stringResult(result: Record<string, unknown>, key: string, fallback: string): string {
  return typeof result[key] === "string" && result[key] ? result[key] : fallback;
}
