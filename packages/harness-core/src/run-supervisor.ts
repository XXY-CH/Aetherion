import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Workspace } from "./ledger.ts";
import { createApprovalCard, type ApprovalCard } from "./approval.ts";
import { createFileReadRequest, createFileWriteRequest, type PolicyDecision, type ToolRequest } from "./policy.ts";
import { composeRisk, type RiskComposition } from "./risk.ts";
import { reconstructTrace, type ReconstructedTrace } from "./replay.ts";
import { callSupervisorRpc, rpcResult } from "./supervisor-client.ts";
import { verifyFileContains, type ObservationRecord, type VerificationRecord } from "./verify.ts";
import {
  completeRunManifest,
  createRunManifest,
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

  await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "user.message", `Ether requested supervisor summary from ${input.inputPath} to ${input.outputPath}.`);

  const readRequest = createFileReadRequest(runId, inputPath);
  const readRisk = composeRisk(readRequest);
  await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "tool.requested", "Requested supervisor workspace file read.");
  const readEval = await supervisorCall(input.repoRoot, {
    id: `rpc_${runId}_read_policy`,
    method: "tool.evaluate",
    workspace_root: workspaceRoot,
    workspace_id: workspaceId,
    run_id: runId,
    verb: "read",
    path: inputPath
  });
  const readDecision = policyFromSupervisor(runId, readRequest, readEval, "Explicit workspace-scoped read evaluated by Rust supervisor.");
  await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "policy.decided", readDecision.reason);

  const readResult = await supervisorCall(input.repoRoot, {
    id: `rpc_${runId}_read`,
    method: "file.read",
    workspace_root: workspaceRoot,
    workspace_id: workspaceId,
    run_id: runId,
    path: inputPath
  });
  if (typeof readResult.contents !== "string") {
    throw new Error("Rust supervisor file.read returned no contents");
  }
  const readContents = readResult.contents;
  await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "tool.result", `Rust supervisor read ${Buffer.byteLength(readContents, "utf8")} bytes from workspace file.`);

  const writeRequest = createFileWriteRequest(runId, outputPath);
  const writeRisk = composeRisk(writeRequest);
  await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "tool.requested", "Requested supervisor workspace file write.");
  const writePreEval = await supervisorCall(input.repoRoot, {
    id: `rpc_${runId}_write_policy_ask`,
    method: "tool.evaluate",
    workspace_root: workspaceRoot,
    workspace_id: workspaceId,
    run_id: runId,
    verb: "write",
    path: outputPath
  });
  const writePreDecision = policyFromSupervisor(runId, writeRequest, writePreEval, "Workspace write requires explicit consent from Rust supervisor policy.");
  const approvalCard = createApprovalCard(writeRequest, writePreDecision);
  await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "policy.decided", writePreDecision.reason);

  if (!input.approveWrite) {
    await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "run.completed", "Run stopped before supervisor write because approval was not provided.");
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
      trace: await reconstructTrace(workspace, runId),
      supervisor: "stdio"
    };
  }

  await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "consent.recorded", "Ether user approved Rust supervisor workspace-scoped write.");
  const summaryText = input.summaryText ?? defaultSummary(readContents);
  const writeResult = await supervisorCall(input.repoRoot, {
    id: `rpc_${runId}_write`,
    method: "file.write",
    workspace_root: workspaceRoot,
    workspace_id: workspaceId,
    run_id: runId,
    path: outputPath,
    approved: true,
    contents: summaryText
  });
  const writeDecision = policyFromSupervisor(runId, writeRequest, writeResult, "Explicit consent approved workspace-scoped write through Rust supervisor.");
  if (writeResult.written !== true || writeDecision.decision !== "allow" || !writeDecision.lease) {
    throw new Error("Rust supervisor did not return an allowed lease-backed write result");
  }
  await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "policy.decided", writeDecision.reason);
  await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "action.recorded", "Rust supervisor wrote workspace file through scoped policy.");

  const { observation, verification } = await verifyFileContains({
    runId,
    actionId: `action_${runId}_write`,
    path: outputPath,
    expectedText: summaryText.trim()
  });
  await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "observation.recorded", observation.summary);
  await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "verification.recorded", verification.summary);
  await appendSupervisorEvent(input.repoRoot, workspace, runManifest, runId, "run.completed", "Ether Rust supervisor kernel loop completed.");
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
    writeDecision,
    observation,
    verification,
    trace: await reconstructTrace(workspace, runId),
    supervisor: "stdio"
  };
}

async function supervisorCall(repoRoot: string, request: Parameters<typeof callSupervisorRpc>[1]): Promise<Record<string, unknown>> {
  return rpcResult(await callSupervisorRpc(repoRoot, request));
}

async function appendSupervisorEvent(repoRoot: string, workspace: Workspace, manifest: RunManifest, runId: string, event_type: string, summary: string): Promise<void> {
  const appendResult = await supervisorCall(repoRoot, {
    id: `rpc_${event_type}_${randomUUID()}`,
    method: "event.append",
    workspace_root: workspace.root,
    workspace_id: workspace.id,
    run_id: runId,
    event_type,
    summary
  });
  if (typeof appendResult.event_id !== "string" || !appendResult.event_id) {
    throw new Error(`Rust supervisor event.append returned no event id for ${event_type}`);
  }
  await recordRunEvent(repoRoot, workspace, manifest, appendResult.event_id);
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

function defaultSummary(contents: string): string {
  const firstLine = contents.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "Untitled file";
  return `Summary: ${firstLine.trim()}\n`;
}
