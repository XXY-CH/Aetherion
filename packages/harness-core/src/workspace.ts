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

export function workspaceRegistryPath(workspace: Workspace): string {
  return join(workspace.root, ".aetherion", "workspace.json");
}

export function runManifestPath(workspace: Workspace, runId: string): string {
  return join(workspace.root, ".aetherion", "runs", `${runId}.json`);
}

export function workspaceIdForRoot(root: string): string {
  const digest = createHash("sha256").update(resolve(root)).digest("hex").slice(0, 16);
  return `ws_${digest}`;
}

export async function writeWorkspaceRegistry(repoRoot: string, workspace: Workspace, authority: WorkspaceRegistry["authority"]): Promise<WorkspaceRegistry> {
  const registry: WorkspaceRegistry = {
    id: workspace.id,
    root: workspace.root,
    created_at: new Date().toISOString(),
    authority,
    runtime_dir: join(workspace.root, ".aetherion"),
    ledger_path: workspace.ledgerPath
  };
  await assertValid(repoRoot, "workspace-registry.schema.json", registry);
  await writeJson(workspaceRegistryPath(workspace), registry);
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
  if (registry.root !== resolvedRoot) {
    throw new Error(`Workspace registry root mismatch: ${registry.root}`);
  }
  return {
    registry,
    workspace: {
      root: resolvedRoot,
      id: registry.id,
      ledgerPath: registry.ledger_path,
      runtimeDir: registry.runtime_dir
    }
  };
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
  expectedEventTypes: readonly string[]
): Promise<RunManifest> {
  const manifestEvents = await manifestEventsInLedgerOrder(workspace, manifest);
  const actualEventTypes = manifestEvents.map((event) => event.event_type);
  if (!stringArraysEqual(actualEventTypes, expectedEventTypes)) {
    throw new Error(
      `Run manifest ${manifest.id} cannot complete as ${status}: expected lifecycle ${expectedEventTypes.join(" -> ")}, got ${actualEventTypes.join(" -> ")}`
    );
  }
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
