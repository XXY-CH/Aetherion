import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  appendEvent,
  createWorkspace,
  eventRecord,
  type Workspace
} from "./ledger.ts";
import { createApprovalCard, type ApprovalCard } from "./approval.ts";
import { createBoundaryFacts, writeBoundaryFactsArtifact } from "./boundary.ts";
import { createWriteConsentRecord, writeConsentRecordArtifact } from "./consent.ts";
import {
  approveWriteWithConsent,
  createFileReadRequest,
  createFileWriteRequest,
  evaluateSeedPolicy,
  type ConsentRecord,
  type PolicyDecision,
  type ToolRequest
} from "./policy.ts";
import { composeRisk, type RiskComposition } from "./risk.ts";
import {
  readLocalFileThroughPolicy,
  writeLocalFileThroughPolicy
} from "./local-file.ts";
import { defaultSafeSummary } from "./output-summary.ts";
import { reconstructTrace, type ReconstructedTrace } from "./replay.ts";
import { validateAgainstSchema } from "./schema.ts";
import { verifyFileContains, type ObservationRecord, type VerificationRecord } from "./verify.ts";
import {
  completeRunManifest,
  createRunManifest,
  recordRunEvent,
  workspaceIdForRoot,
  writeWorkspaceRegistry,
  type RunManifest,
  type WorkspaceRegistry
} from "./workspace.ts";

export type LocalKernelRunInput = {
  repoRoot: string;
  workspaceRoot: string;
  workspaceId?: string;
  runId?: string;
  inputPath: string;
  outputPath: string;
  summaryText?: string;
  approveWrite: boolean;
};

export type LocalKernelRunResult = {
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
  consent?: ConsentRecord;
  writeDecision?: PolicyDecision;
  observation?: ObservationRecord;
  verification?: VerificationRecord;
  trace: ReconstructedTrace;
};

export async function runLocalKernelLoop(input: LocalKernelRunInput): Promise<LocalKernelRunResult> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const workspace = await createWorkspace(workspaceRoot, input.workspaceId ?? workspaceIdForRoot(workspaceRoot));
  const workspaceRegistry = await writeWorkspaceRegistry(input.repoRoot, workspace, "typescript-seed");
  const runId = input.runId ?? `run_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const runManifest = await createRunManifest(input.repoRoot, workspace, runId, "Ether test-only local kernel loop");
  const inputPath = resolve(workspaceRoot, input.inputPath);
  const outputPath = resolve(workspaceRoot, input.outputPath);
  await mkdir(dirname(outputPath), { recursive: true });

  const boundaryFacts = createBoundaryFacts({
    workspace,
    registry: workspaceRegistry,
    manifest: runManifest,
    workspaceFileWriteRequested: true
  });
  const boundaryRef = await writeBoundaryFactsArtifact(input.repoRoot, workspace, boundaryFacts);
  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_started`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "run.started",
    actor: { type: "system", id: "ether.test_orchestrator" },
    summary: "Ether test-only run started on tui; user_id, device_id, channel_id, and secret_vault are not recorded.",
    payload_ref: boundaryRef
  }));

  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_user_message`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "user.message",
    actor: { type: "user", id: "user_local" },
    summary: `Ether requested local summary from ${input.inputPath} to ${input.outputPath}.`,
    taint: { sources: ["user"], can_authorize_actions: true }
  }));

  const readRequest = createFileReadRequest(runId, inputPath);
  await assertValid(input.repoRoot, "tool-request.schema.json", readRequest);
  const readRisk = composeRisk(readRequest);
  await assertValid(input.repoRoot, "risk-composition.schema.json", readRisk);
  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_read_requested`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "tool.requested",
    actor: { type: "agent", id: "ether.test_orchestrator" },
    summary: "Requested workspace file read."
  }));
  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_read_risk`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "risk.composed",
    actor: { type: "system", id: "risk_composer" },
    summary: `Composed ${readRisk.risk_level} risk for workspace file read.`
  }));

  const readDecision = evaluateSeedPolicy(workspaceRoot, readRequest);
  await assertValid(input.repoRoot, "policy-decision.schema.json", readDecision);
  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_read_policy`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "policy.decided",
    actor: { type: "system", id: "tool_policy_proxy" },
    summary: readDecision.reason
  }));
  if (readDecision.lease) {
    await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
      id: `evt_${runId}_read_lease`,
      workspace_id: workspace.id,
      run_id: runId,
      event_type: "lease.issued",
      actor: { type: "system", id: "lease_manager" },
      summary: `Issued scoped read lease ${readDecision.lease.id}.`
    }));
  }

  const readResult = await readLocalFileThroughPolicy(readRequest, readDecision);
  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_read_result`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "tool.result",
    actor: { type: "system", id: "filesystem.read" },
    summary: `Read ${readResult.bytes} bytes from workspace file.`
  }));

  const writeRequest = createFileWriteRequest(runId, outputPath);
  await assertValid(input.repoRoot, "tool-request.schema.json", writeRequest);
  const writeRisk = composeRisk(writeRequest);
  await assertValid(input.repoRoot, "risk-composition.schema.json", writeRisk);
  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_write_requested`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "tool.requested",
    actor: { type: "agent", id: "ether.test_orchestrator" },
    summary: "Requested workspace file write."
  }));
  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_write_risk`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "risk.composed",
    actor: { type: "system", id: "risk_composer" },
    summary: `Composed ${writeRisk.risk_level} risk for workspace file write.`
  }));
  const writePreDecision = evaluateSeedPolicy(workspaceRoot, writeRequest);
  const approvalCard = createApprovalCard(writeRequest, writePreDecision);
  await assertValid(input.repoRoot, "approval-card.schema.json", approvalCard);
  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_write_policy_ask`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "policy.decided",
    actor: { type: "system", id: "tool_policy_proxy" },
    summary: writePreDecision.reason
  }));

  let consent: ConsentRecord | undefined;
  let writeDecision: PolicyDecision | undefined;
  let observation: ObservationRecord | undefined;
  let verification: VerificationRecord | undefined;

  if (!input.approveWrite) {
    await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
      id: `evt_${runId}_completed_without_write`,
      workspace_id: workspace.id,
      run_id: runId,
      event_type: "run.completed",
      actor: { type: "system", id: "ether.test_orchestrator" },
      summary: "Run stopped before write because approval was not provided."
    }));
    await completeRunManifest(input.repoRoot, workspace, runManifest, "blocked");
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
      trace: await reconstructTrace(workspace, runId)
    };
  }

  consent = createWriteConsentRecord({
    runId,
    workspaceId: workspace.id,
    toolRequestId: writeRequest.id,
    path: outputPath
  });
  await assertValid(input.repoRoot, "consent-record.schema.json", consent);
  const consentRef = await writeConsentRecordArtifact(input.repoRoot, workspace, runId, consent);
  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_consent`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "consent.recorded",
    actor: { type: "user", id: "user_local" },
    summary: "Ether user approved workspace-scoped write.",
    payload_ref: consentRef,
    taint: { sources: ["user"], can_authorize_actions: true }
  }));

  writeDecision = approveWriteWithConsent(workspaceRoot, writeRequest, consent);
  await assertValid(input.repoRoot, "policy-decision.schema.json", writeDecision);
  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_write_policy`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "policy.decided",
    actor: { type: "system", id: "tool_policy_proxy" },
    summary: writeDecision.reason
  }));
  if (writeDecision.lease) {
    await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
      id: `evt_${runId}_write_lease`,
      workspace_id: workspace.id,
      run_id: runId,
      event_type: "lease.issued",
      actor: { type: "system", id: "lease_manager" },
      summary: `Issued scoped write lease ${writeDecision.lease.id}.`
    }));
  }

  const summaryText = input.summaryText ?? defaultSafeSummary();
  const writeResult = await writeLocalFileThroughPolicy(writeRequest, writeDecision, summaryText);
  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_write_action`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "action.recorded",
    actor: { type: "system", id: "filesystem.write" },
    summary: `Wrote ${writeResult.bytes} bytes to workspace file.`
  }));

  ({ observation, verification } = await verifyFileContains({
    runId,
    actionId: `action_${runId}_write`,
    path: outputPath,
    expectedText: summaryText.trim()
  }));
  await assertValid(input.repoRoot, "observation-record.schema.json", observation);
  await assertValid(input.repoRoot, "verification-record.schema.json", verification);
  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_observation`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "observation.recorded",
    actor: { type: "system", id: "verifier" },
    summary: observation.summary
  }));
  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_verification`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "verification.recorded",
    actor: { type: "system", id: "verifier" },
    summary: verification.summary
  }));
  await appendRunEvent(input.repoRoot, workspace, runManifest, eventRecord({
    id: `evt_${runId}_completed`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "run.completed",
    actor: { type: "system", id: "ether.test_orchestrator" },
    summary: "Ether test-only local kernel loop completed."
  }));
  await completeRunManifest(input.repoRoot, workspace, runManifest, "completed");

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
    consent,
    writeDecision,
    observation,
    verification,
    trace: await reconstructTrace(workspace, runId)
  };
}

async function appendRunEvent(repoRoot: string, workspace: Workspace, manifest: RunManifest, event: ReturnType<typeof eventRecord>): Promise<void> {
  await appendEvent(repoRoot, workspace, event);
  await recordRunEvent(repoRoot, workspace, manifest, event.id);
}

async function assertValid(repoRoot: string, schemaName: string, value: unknown): Promise<void> {
  const result = await validateAgainstSchema(repoRoot, schemaName, value);
  if (!result.valid) {
    throw new Error(`${schemaName} validation failed: ${result.errors.join("; ")}`);
  }
}
