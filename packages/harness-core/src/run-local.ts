import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  appendEvent,
  createWorkspace,
  eventRecord,
  type Workspace
} from "./ledger.ts";
import {
  approveWriteWithConsent,
  createFileReadRequest,
  createFileWriteRequest,
  mockPolicyDecision,
  type ConsentRecord,
  type PolicyDecision,
  type ToolRequest
} from "./policy.ts";
import {
  readLocalFileThroughPolicy,
  writeLocalFileThroughPolicy
} from "./local-file.ts";
import { reconstructTrace, type ReconstructedTrace } from "./replay.ts";
import { validateAgainstSchema } from "./schema.ts";
import { verifyFileContains, type ObservationRecord, type VerificationRecord } from "./verify.ts";

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
  runId: string;
  readRequest: ToolRequest;
  readDecision: PolicyDecision;
  writeRequest: ToolRequest;
  writePreDecision: PolicyDecision;
  consent?: ConsentRecord;
  writeDecision?: PolicyDecision;
  observation?: ObservationRecord;
  verification?: VerificationRecord;
  trace: ReconstructedTrace;
};

export async function runLocalKernelLoop(input: LocalKernelRunInput): Promise<LocalKernelRunResult> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const workspace = await createWorkspace(workspaceRoot, input.workspaceId ?? "ws_tui");
  const runId = input.runId ?? `run_${Date.now()}`;
  const inputPath = resolve(workspaceRoot, input.inputPath);
  const outputPath = resolve(workspaceRoot, input.outputPath);
  await mkdir(dirname(outputPath), { recursive: true });

  await appendEvent(input.repoRoot, workspace, eventRecord({
    id: `evt_${runId}_user_message`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "user.message",
    actor: { type: "user", id: "user_tui" },
    summary: `TUI requested local summary from ${input.inputPath} to ${input.outputPath}.`,
    taint: { sources: ["user"], can_authorize_actions: true }
  }));

  const readRequest = createFileReadRequest(runId, inputPath);
  await assertValid(input.repoRoot, "tool-request.schema.json", readRequest);
  await appendEvent(input.repoRoot, workspace, eventRecord({
    id: `evt_${runId}_read_requested`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "tool.requested",
    actor: { type: "agent", id: "tui.orchestrator" },
    summary: "Requested workspace file read."
  }));

  const readDecision = mockPolicyDecision(workspaceRoot, readRequest);
  await assertValid(input.repoRoot, "policy-decision.schema.json", readDecision);
  await appendEvent(input.repoRoot, workspace, eventRecord({
    id: `evt_${runId}_read_policy`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "policy.decided",
    actor: { type: "system", id: "tool_policy_proxy" },
    summary: readDecision.reason
  }));

  const readResult = await readLocalFileThroughPolicy(readRequest, readDecision);
  await appendEvent(input.repoRoot, workspace, eventRecord({
    id: `evt_${runId}_read_result`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "tool.result",
    actor: { type: "system", id: "filesystem.read" },
    summary: `Read ${readResult.bytes} bytes from workspace file.`
  }));

  const writeRequest = createFileWriteRequest(runId, outputPath);
  await assertValid(input.repoRoot, "tool-request.schema.json", writeRequest);
  const writePreDecision = mockPolicyDecision(workspaceRoot, writeRequest);
  await appendEvent(input.repoRoot, workspace, eventRecord({
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
    await appendEvent(input.repoRoot, workspace, eventRecord({
      id: `evt_${runId}_completed_without_write`,
      workspace_id: workspace.id,
      run_id: runId,
      event_type: "run.completed",
      actor: { type: "system", id: "tui.orchestrator" },
      summary: "Run stopped before write because approval was not provided."
    }));
    return {
      workspace,
      runId,
      readRequest,
      readDecision,
      writeRequest,
      writePreDecision,
      trace: await reconstructTrace(workspace, runId)
    };
  }

  consent = {
    id: `consent_${runId}_write`,
    user_id: "user_tui",
    workspace_id: workspace.id,
    tool_request_id: writeRequest.id,
    decision: "approved",
    risk_level: "L3",
    approved_at: new Date().toISOString(),
    expires_at: null,
    scope: {
      actions: ["write"],
      paths: [outputPath]
    }
  };
  await assertValid(input.repoRoot, "consent-record.schema.json", consent);
  await appendEvent(input.repoRoot, workspace, eventRecord({
    id: `evt_${runId}_consent`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "consent.recorded",
    actor: { type: "user", id: "user_tui" },
    summary: "TUI user approved workspace-scoped write.",
    taint: { sources: ["user"], can_authorize_actions: true }
  }));

  writeDecision = approveWriteWithConsent(workspaceRoot, writeRequest, consent);
  await assertValid(input.repoRoot, "policy-decision.schema.json", writeDecision);
  await appendEvent(input.repoRoot, workspace, eventRecord({
    id: `evt_${runId}_write_policy`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "policy.decided",
    actor: { type: "system", id: "tool_policy_proxy" },
    summary: writeDecision.reason
  }));

  const summaryText = input.summaryText ?? defaultSummary(readResult.contents);
  const writeResult = await writeLocalFileThroughPolicy(writeRequest, writeDecision, summaryText);
  await appendEvent(input.repoRoot, workspace, eventRecord({
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
  await appendEvent(input.repoRoot, workspace, eventRecord({
    id: `evt_${runId}_observation`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "observation.recorded",
    actor: { type: "system", id: "verifier" },
    summary: observation.summary
  }));
  await appendEvent(input.repoRoot, workspace, eventRecord({
    id: `evt_${runId}_verification`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "verification.recorded",
    actor: { type: "system", id: "verifier" },
    summary: verification.summary
  }));
  await appendEvent(input.repoRoot, workspace, eventRecord({
    id: `evt_${runId}_completed`,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: "run.completed",
    actor: { type: "system", id: "tui.orchestrator" },
    summary: "TUI local kernel loop completed."
  }));

  return {
    workspace,
    runId,
    readRequest,
    readDecision,
    writeRequest,
    writePreDecision,
    consent,
    writeDecision,
    observation,
    verification,
    trace: await reconstructTrace(workspace, runId)
  };
}

function defaultSummary(contents: string): string {
  const firstLine = contents.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "Untitled file";
  return `Summary: ${firstLine.trim()}\n`;
}

async function assertValid(repoRoot: string, schemaName: string, value: unknown): Promise<void> {
  const result = await validateAgainstSchema(repoRoot, schemaName, value);
  if (!result.valid) {
    throw new Error(`${schemaName} validation failed: ${result.errors.join("; ")}`);
  }
}
