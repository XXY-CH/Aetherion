import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { readEvents, type EventRecord, type Workspace } from "./ledger.ts";
import { validateAgainstSchema } from "./schema.ts";

export type WorkspaceRegistry = {
  id: string;
  root: string;
  created_at: string;
  authority: "typescript-seed" | "rust-supervisor";
  runtime_dir: string;
  ledger_path: string;
};

export type RunManifest = {
  id: string;
  workspace_id: string;
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "blocked" | "failed";
  entry_surface: "tui" | "gui" | "im" | "browser" | "api" | "system";
  event_ids: string[];
  summary?: string;
};

export const KERNEL_FILE_RUN_APPROVED_EVENT_TYPES = [
  "run.started",
  "user.message",
  "tool.requested",
  "risk.composed",
  "policy.decided",
  "lease.issued",
  "tool.result",
  "tool.requested",
  "risk.composed",
  "policy.decided",
  "consent.recorded",
  "policy.decided",
  "lease.issued",
  "action.recorded",
  "observation.recorded",
  "verification.recorded",
  "run.completed"
] as const;

export const KERNEL_FILE_RUN_BLOCKED_EVENT_TYPES = [
  "run.started",
  "user.message",
  "tool.requested",
  "risk.composed",
  "policy.decided",
  "lease.issued",
  "tool.result",
  "tool.requested",
  "risk.composed",
  "policy.decided",
  "run.completed"
] as const;

export const APPROVED_WRITE_PROMOTION_EVENT_TYPES = [
  "run.started",
  "tool.requested",
  "risk.composed",
  "policy.decided",
  "consent.recorded",
  "policy.decided",
  "lease.issued",
  "action.recorded",
  "observation.recorded",
  "verification.recorded",
  "run.completed"
] as const;

export const REPLAY_RECORD_RUN_EVENT_TYPES = [
  "replay.recorded"
] as const;

export const WAKEUP_QUEUE_RUN_EVENT_TYPES = [
  "policy.decided",
  "wakeup.queued"
] as const;

export const SECURITY_SCAN_CLEAN_EVENT_TYPES = [
  "policy.decided",
  "security.content.assessed"
] as const;

export const SECURITY_SCAN_BLOCKED_EVENT_TYPES = [
  "policy.decided",
  "security.content.assessed",
  "poisoning.detected"
] as const;

export const BROWSER_OBSERVATION_EVENT_TYPES = [
  "policy.decided",
  "browser.observation.ingested"
] as const;

export const IM_OUTBOX_EVENT_TYPES = [
  "policy.decided",
  "im.outbox.queued"
] as const;

export const CHILD_READ_COMPLETED_EVENT_TYPES = [
  "agent.child.started",
  "tool.requested",
  "risk.composed",
  "policy.decided",
  "lease.issued",
  "tool.result",
  "agent.child.completed"
] as const;

export const CHILD_READ_POLICY_DENIED_EVENT_TYPES = [
  "agent.child.started",
  "tool.requested",
  "risk.composed",
  "policy.decided",
  "tool.result",
  "agent.child.policy_denied"
] as const;

export const CHILD_READ_REPEATED_DENIAL_EVENT_TYPES = [
  ...CHILD_READ_POLICY_DENIED_EVENT_TYPES,
  "circuit.opened"
] as const;

export const CHILD_READ_PRE_EXECUTION_BREAKER_EVENT_TYPES = [
  "agent.child.started",
  "circuit.opened"
] as const;

const CHILD_READ_POST_SUPERVISOR_BREAKER_PREFIXES = [
  [],
  ["tool.requested"],
  ["tool.requested", "risk.composed"],
  ["tool.requested", "risk.composed", "policy.decided"],
  ["tool.requested", "risk.composed", "policy.decided", "lease.issued"],
  ["tool.requested", "risk.composed", "policy.decided", "lease.issued", "tool.result"],
  ["tool.requested", "risk.composed", "policy.decided", "tool.result"]
] as const;

export type RunEventExpectation = string | {
  event_type: string;
  payload_ref?: string | null;
};

export function kernelFileRunApprovedEventSequence(runId: string): readonly RunEventExpectation[] {
  return withKernelFilePayloadRefs(KERNEL_FILE_RUN_APPROVED_EVENT_TYPES, runId);
}

export function kernelFileRunBlockedEventSequence(runId: string): readonly RunEventExpectation[] {
  return withKernelFilePayloadRefs(KERNEL_FILE_RUN_BLOCKED_EVENT_TYPES, runId);
}

export function approvedWritePromotionEventSequence(runId: string): readonly RunEventExpectation[] {
  return withKernelFilePayloadRefs(APPROVED_WRITE_PROMOTION_EVENT_TYPES, runId);
}

export function replayRecordRunEventSequence(payloadRef: string): readonly RunEventExpectation[] {
  return [{ event_type: "replay.recorded", payload_ref: payloadRef }];
}

export function wakeupQueueRunEventSequence(): readonly RunEventExpectation[] {
  return WAKEUP_QUEUE_RUN_EVENT_TYPES.map((eventType) => ({ event_type: eventType, payload_ref: null }));
}

export function securityScanCleanEventSequence(assessmentPayloadRef: string): readonly RunEventExpectation[] {
  return [
    { event_type: "policy.decided", payload_ref: null },
    { event_type: "security.content.assessed", payload_ref: assessmentPayloadRef }
  ];
}

export function securityScanBlockedEventSequence(assessmentPayloadRef: string, signalPayloadRef: string): readonly RunEventExpectation[] {
  return [
    ...securityScanCleanEventSequence(assessmentPayloadRef),
    { event_type: "poisoning.detected", payload_ref: signalPayloadRef }
  ];
}

export function browserObservationEventSequence(observationPayloadRef: string): readonly RunEventExpectation[] {
  return [
    { event_type: "policy.decided", payload_ref: null },
    { event_type: "browser.observation.ingested", payload_ref: observationPayloadRef }
  ];
}

export function imOutboxEventSequence(outboxPayloadRef: string): readonly RunEventExpectation[] {
  return [
    { event_type: "policy.decided", payload_ref: null },
    { event_type: "im.outbox.queued", payload_ref: outboxPayloadRef }
  ];
}

export function childReadCompletedEventSequence(contractPayloadRef: string, childResultPayloadRef: string): readonly RunEventExpectation[] {
  return [
    { event_type: "agent.child.started", payload_ref: contractPayloadRef },
    "tool.requested",
    "risk.composed",
    "policy.decided",
    "lease.issued",
    "tool.result",
    { event_type: "agent.child.completed", payload_ref: childResultPayloadRef }
  ];
}

export function childReadPolicyDeniedEventSequence(contractPayloadRef: string, denialPayloadRef: string): readonly RunEventExpectation[] {
  return [
    { event_type: "agent.child.started", payload_ref: contractPayloadRef },
    "tool.requested",
    "risk.composed",
    "policy.decided",
    "tool.result",
    { event_type: "agent.child.policy_denied", payload_ref: denialPayloadRef }
  ];
}

export function childReadRepeatedDenialEventSequence(contractPayloadRef: string, denialPayloadRef: string, breakerPayloadRef: string): readonly RunEventExpectation[] {
  return [
    ...childReadPolicyDeniedEventSequence(contractPayloadRef, denialPayloadRef),
    { event_type: "circuit.opened", payload_ref: breakerPayloadRef }
  ];
}

export function childReadPreExecutionBreakerEventSequence(contractPayloadRef: string, breakerPayloadRef: string): readonly RunEventExpectation[] {
  return [
    { event_type: "agent.child.started", payload_ref: contractPayloadRef },
    { event_type: "circuit.opened", payload_ref: breakerPayloadRef }
  ];
}

export function childReadPostSupervisorBreakerEventSequence(
  contractPayloadRef: string,
  breakerPayloadRef: string,
  supervisorEventTypes: readonly string[]
): readonly RunEventExpectation[] {
  const validPrefix = CHILD_READ_POST_SUPERVISOR_BREAKER_PREFIXES.some((prefix) => stringArraysEqual(prefix, supervisorEventTypes));
  if (!validPrefix) {
    throw new Error(`Invalid child read supervisor breaker lifecycle prefix: ${supervisorEventTypes.join(" -> ")}`);
  }
  return [
    { event_type: "agent.child.started", payload_ref: contractPayloadRef },
    ...supervisorEventTypes,
    { event_type: "circuit.opened", payload_ref: breakerPayloadRef }
  ];
}

export function workspaceRegistryPath(workspace: Workspace): string {
  return join(workspace.root, ".aetherion", "workspace.json");
}

export function canonicalRuntimeDir(root: string): string {
  return join(resolve(root), ".aetherion");
}

export function canonicalLedgerPath(root: string): string {
  return join(canonicalRuntimeDir(root), "events", "events.jsonl");
}

export function runManifestPath(workspace: Workspace, runId: string): string {
  return join(workspace.root, ".aetherion", "runs", `${runId}.json`);
}

export function workspaceIdForRoot(root: string): string {
  const digest = createHash("sha256").update(resolve(root)).digest("hex").slice(0, 16);
  return `ws_${digest}`;
}

export function assertWorkspaceIdForRoot(root: string, workspaceId: string): void {
  const expected = workspaceIdForRoot(root);
  if (workspaceId !== expected) {
    throw new Error(`Workspace id ${workspaceId} does not match resolved root identity ${expected}`);
  }
}

export async function writeWorkspaceRegistry(repoRoot: string, workspace: Workspace, authority: WorkspaceRegistry["authority"]): Promise<WorkspaceRegistry> {
  const root = resolve(workspace.root);
  assertWorkspaceIdForRoot(root, workspace.id);
  const registry: WorkspaceRegistry = {
    id: workspace.id,
    root,
    created_at: new Date().toISOString(),
    authority,
    runtime_dir: canonicalRuntimeDir(root),
    ledger_path: canonicalLedgerPath(root)
  };
  await assertValid(repoRoot, "workspace-registry.schema.json", registry);
  await writeJson(join(root, ".aetherion", "workspace.json"), registry);
  return registry;
}

export async function createRunManifest(repoRoot: string, workspace: Workspace, runId: string, summary: string): Promise<RunManifest> {
  await assertRunManifestDoesNotExist(workspace, runId);
  const manifest: RunManifest = {
    id: runId,
    workspace_id: workspace.id,
    started_at: new Date().toISOString(),
    completed_at: null,
    status: "running",
    entry_surface: "tui",
    event_ids: [],
    summary
  };
  await saveRunManifest(repoRoot, workspace, manifest);
  return manifest;
}

async function assertRunManifestDoesNotExist(workspace: Workspace, runId: string): Promise<void> {
  try {
    await readFile(runManifestPath(workspace, runId), "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }
    throw error;
  }
  throw new Error(`Run manifest ${runId} already exists`);
}

export async function loadRunManifest(workspace: Workspace, runId: string): Promise<RunManifest> {
  const manifest = JSON.parse(await readFile(runManifestPath(workspace, runId), "utf8")) as RunManifest;
  if (manifest.id !== runId) {
    throw new Error(`Run manifest file ${runId} contains manifest ${manifest.id}`);
  }
  assertManifestWorkspace(workspace, manifest);
  return manifest;
}

export async function loadWorkspaceFromRegistry(root: string): Promise<{ workspace: Workspace; registry: WorkspaceRegistry }> {
  const resolvedRoot = resolve(root);
  const path = join(resolvedRoot, ".aetherion", "workspace.json");
  const registry = JSON.parse(await readFile(path, "utf8")) as WorkspaceRegistry;
  assertWorkspaceRegistryForRoot(registry, resolvedRoot);
  const runtimeDir = canonicalRuntimeDir(resolvedRoot);
  const ledgerPath = canonicalLedgerPath(resolvedRoot);
  try {
    assertWorkspaceIdForRoot(resolvedRoot, registry.id);
  } catch {
    throw new Error(`Workspace registry id mismatch: ${registry.id}`);
  }
  if (registry.root !== resolvedRoot) {
    throw new Error(`Workspace registry root mismatch: ${registry.root}`);
  }
  if (registry.runtime_dir !== runtimeDir) {
    throw new Error(`Workspace registry runtime_dir mismatch: ${registry.runtime_dir}`);
  }
  if (registry.ledger_path !== ledgerPath) {
    throw new Error(`Workspace registry ledger_path mismatch: ${registry.ledger_path}`);
  }
  return {
    registry,
    workspace: {
      root: resolvedRoot,
      id: registry.id,
      ledgerPath,
      runtimeDir
    }
  };
}

function assertWorkspaceRegistryForRoot(registry: unknown, root: string): asserts registry is WorkspaceRegistry {
  if (!isRecord(registry)) {
    throw new Error("Workspace registry must be an object");
  }
  for (const key of ["id", "root", "created_at", "authority", "runtime_dir", "ledger_path"]) {
    if (typeof registry[key] !== "string" || registry[key].length === 0) {
      throw new Error(`Workspace registry ${key} missing or invalid`);
    }
  }
  if (registry.authority !== "typescript-seed" && registry.authority !== "rust-supervisor") {
    throw new Error(`Workspace registry authority mismatch: ${registry.authority}`);
  }
  if (registry.root !== root) {
    throw new Error(`Workspace registry root mismatch: ${registry.root}`);
  }
}

export async function recordRunEvent(repoRoot: string, workspace: Workspace, manifest: RunManifest, eventId: string): Promise<RunManifest> {
  assertManifestWorkspace(workspace, manifest);
  const nextEvent = await nextLedgerEventForManifest(workspace, manifest);
  if (!nextEvent) {
    throw new Error(`Run manifest ${manifest.id} has no unrecorded Ledger event ${eventId}`);
  }
  if (nextEvent.id !== eventId) {
    throw new Error(`Run manifest ${manifest.id} expected next Ledger event ${nextEvent.id}, got ${eventId}`);
  }
  if (nextEvent.workspace_id !== workspace.id) {
    throw new Error(`Run manifest ${manifest.id} event ${eventId} belongs to workspace ${nextEvent.workspace_id}, not ${workspace.id}`);
  }
  if (nextEvent.run_id !== manifest.id) {
    throw new Error(`Run manifest ${manifest.id} event ${eventId} belongs to run ${nextEvent.run_id}`);
  }
  manifest.event_ids.push(eventId);
  await saveRunManifest(repoRoot, workspace, manifest);
  return manifest;
}

export async function completeRunManifest(repoRoot: string, workspace: Workspace, manifest: RunManifest, status: RunManifest["status"]): Promise<RunManifest> {
  await manifestEventsInLedgerOrder(workspace, manifest);
  manifest.status = status;
  manifest.completed_at = new Date().toISOString();
  await saveRunManifest(repoRoot, workspace, manifest);
  return manifest;
}

export async function completeRunManifestWithEventSequence(
  repoRoot: string,
  workspace: Workspace,
  manifest: RunManifest,
  status: RunManifest["status"],
  expectedEvents: readonly RunEventExpectation[]
): Promise<RunManifest> {
  const manifestEvents = await manifestEventsInLedgerOrder(workspace, manifest);
  const actualEventTypes = manifestEvents.map((event) => event.event_type);
  const expectedEventTypes = expectedEvents.map(expectedEventType);
  if (!stringArraysEqual(actualEventTypes, expectedEventTypes)) {
    throw new Error(
      `Run manifest ${manifest.id} cannot complete as ${status}: expected lifecycle ${expectedEventTypes.join(" -> ")}, got ${actualEventTypes.join(" -> ")}`
    );
  }
  assertExpectedPayloadRefs(manifest, manifestEvents, expectedEvents);
  return completeRunManifest(repoRoot, workspace, manifest, status);
}

async function manifestEventsInLedgerOrder(workspace: Workspace, manifest: RunManifest): Promise<EventRecord[]> {
  assertManifestWorkspace(workspace, manifest);
  const events = await readEvents(workspace);
  const runEvents = events.filter((event) => event.run_id === manifest.id);
  assertRunEventsBelongToWorkspace(workspace, manifest, runEvents);
  const runEventIds = runEvents.map((event) => event.id);
  if (!stringArraysEqual(runEventIds, manifest.event_ids)) {
    throw new Error(
      `Run manifest ${manifest.id} event ids do not match Ledger order: manifest=${manifest.event_ids.join(",")} ledger=${runEventIds.join(",")}`
    );
  }
  return runEvents;
}

async function nextLedgerEventForManifest(workspace: Workspace, manifest: RunManifest): Promise<EventRecord | undefined> {
  assertManifestWorkspace(workspace, manifest);
  const events = await readEvents(workspace);
  const runEvents = events.filter((event) => event.run_id === manifest.id);
  const recordedPrefix = runEvents.slice(0, manifest.event_ids.length).map((event) => event.id);
  if (!stringArraysEqual(recordedPrefix, manifest.event_ids)) {
    throw new Error(
      `Run manifest ${manifest.id} event ids do not match Ledger prefix: manifest=${manifest.event_ids.join(",")} ledger_prefix=${recordedPrefix.join(",")}`
    );
  }
  return runEvents[manifest.event_ids.length];
}

function assertRunEventsBelongToWorkspace(workspace: Workspace, manifest: RunManifest, events: readonly EventRecord[]): void {
  const mismatched = events.find((event) => event.workspace_id !== workspace.id);
  if (mismatched) {
    throw new Error(`Run manifest ${manifest.id} event ${mismatched.id} belongs to workspace ${mismatched.workspace_id}, not ${workspace.id}`);
  }
}

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function withKernelFilePayloadRefs(eventTypes: readonly string[], runId: string): readonly RunEventExpectation[] {
  return eventTypes.map((eventType) => {
    if (eventType === "run.started") {
      return { event_type: eventType, payload_ref: `artifact://boundary/${runId}/facts` };
    }
    if (eventType === "consent.recorded") {
      return { event_type: eventType, payload_ref: `artifact://consent/${runId}/write` };
    }
    return eventType;
  });
}

function expectedEventType(expected: RunEventExpectation): string {
  return typeof expected === "string" ? expected : expected.event_type;
}

function assertExpectedPayloadRefs(manifest: RunManifest, events: readonly EventRecord[], expectedEvents: readonly RunEventExpectation[]): void {
  expectedEvents.forEach((expected, index) => {
    if (typeof expected === "string" || !("payload_ref" in expected)) {
      return;
    }
    const event = events[index];
    const expectedPayloadRef = expected.payload_ref;
    if (expectedPayloadRef === null || expectedPayloadRef === undefined) {
      if (event.payload_ref !== undefined) {
        throw new Error(
          `Run manifest ${manifest.id} event ${event.id} (${event.event_type}) cannot complete: expected no payload_ref, got ${event.payload_ref}`
        );
      }
      return;
    }
    if (event.payload_ref !== expectedPayloadRef) {
      throw new Error(
        `Run manifest ${manifest.id} event ${event.id} (${event.event_type}) cannot complete: expected payload_ref ${expectedPayloadRef}, got ${event.payload_ref ?? "not_recorded"}`
      );
    }
  });
}

async function saveRunManifest(repoRoot: string, workspace: Workspace, manifest: RunManifest): Promise<void> {
  assertManifestWorkspace(workspace, manifest);
  await assertValid(repoRoot, "run-manifest.schema.json", manifest);
  await writeJson(runManifestPath(workspace, manifest.id), manifest);
}

function assertManifestWorkspace(workspace: Workspace, manifest: RunManifest): void {
  if (manifest.workspace_id !== workspace.id) {
    throw new Error(`Run manifest ${manifest.id} belongs to workspace ${manifest.workspace_id}, not ${workspace.id}`);
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function assertValid(repoRoot: string, schemaName: string, value: unknown): Promise<void> {
  const result = await validateAgainstSchema(repoRoot, schemaName, value);
  if (!result.valid) {
    throw new Error(`${schemaName} validation failed: ${result.errors.join("; ")}`);
  }
}
