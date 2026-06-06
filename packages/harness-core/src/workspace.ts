import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { Workspace } from "./ledger.ts";
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

export async function loadRunManifest(workspace: Workspace, runId: string): Promise<RunManifest> {
  return JSON.parse(await readFile(runManifestPath(workspace, runId), "utf8")) as RunManifest;
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
  manifest.event_ids.push(eventId);
  await saveRunManifest(repoRoot, workspace, manifest);
  return manifest;
}

export async function completeRunManifest(repoRoot: string, workspace: Workspace, manifest: RunManifest, status: RunManifest["status"]): Promise<RunManifest> {
  manifest.status = status;
  manifest.completed_at = new Date().toISOString();
  await saveRunManifest(repoRoot, workspace, manifest);
  return manifest;
}

async function saveRunManifest(repoRoot: string, workspace: Workspace, manifest: RunManifest): Promise<void> {
  await assertValid(repoRoot, "run-manifest.schema.json", manifest);
  await writeJson(runManifestPath(workspace, manifest.id), manifest);
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
