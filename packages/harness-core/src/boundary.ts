import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunManifest, WorkspaceRegistry } from "./workspace.ts";
import type { Workspace } from "./ledger.ts";
import { validateAgainstSchema } from "./schema.ts";

export type BoundaryFacts = {
  id: string;
  run_id: string;
  workspace_id: string;
  recorded_at: string;
  entry_surface: RunManifest["entry_surface"];
  authority: WorkspaceRegistry["authority"];
  known_facts: Array<"run_id" | "workspace_id" | "entry_surface" | "authority">;
  not_recorded: Array<"user_id" | "device_id" | "channel_id" | "secret_vault">;
  limits: {
    full_user_identity: false;
    device_pairing: false;
    remote_channel_identity: false;
    secret_vault_backend: false;
  };
  impact: {
    memory_candidate_created: boolean;
    user_model_updated: boolean;
    capability_changed: boolean;
    runtime_permissions_changed: boolean;
    external_delivery_attempted: false;
    browser_automation_attempted: false;
    connector_called: false;
    package_code_executed: false;
    workspace_file_write_requested: boolean;
  };
  evidence: {
    run_manifest: "recorded";
    workspace_registry: "recorded";
    ledger_event: "run.started";
  };
};

export function createBoundaryFacts(input: {
  workspace: Workspace;
  registry: WorkspaceRegistry;
  manifest: RunManifest;
  workspaceFileWriteRequested: boolean;
}): BoundaryFacts {
  return {
    id: `boundary_${input.manifest.id}_facts`,
    run_id: input.manifest.id,
    workspace_id: input.workspace.id,
    recorded_at: new Date().toISOString(),
    entry_surface: input.manifest.entry_surface,
    authority: input.registry.authority,
    known_facts: ["run_id", "workspace_id", "entry_surface", "authority"],
    not_recorded: ["user_id", "device_id", "channel_id", "secret_vault"],
    limits: {
      full_user_identity: false,
      device_pairing: false,
      remote_channel_identity: false,
      secret_vault_backend: false
    },
    impact: {
      memory_candidate_created: false,
      user_model_updated: false,
      capability_changed: false,
      runtime_permissions_changed: false,
      external_delivery_attempted: false,
      browser_automation_attempted: false,
      connector_called: false,
      package_code_executed: false,
      workspace_file_write_requested: input.workspaceFileWriteRequested
    },
    evidence: {
      run_manifest: "recorded",
      workspace_registry: "recorded",
      ledger_event: "run.started"
    }
  };
}

export async function writeBoundaryFactsArtifact(repoRoot: string, workspace: Workspace, facts: BoundaryFacts): Promise<string> {
  const result = await validateAgainstSchema(repoRoot, "boundary-facts.schema.json", facts);
  if (!result.valid) {
    throw new Error(`boundary-facts.schema.json validation failed: ${result.errors.join("; ")}`);
  }
  const dir = join(workspace.root, ".aetherion", "artifacts", "boundary", facts.run_id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${facts.id}.json`), `${JSON.stringify(facts, null, 2)}\n`);
  return `artifact://boundary/${facts.run_id}/facts`;
}

export async function readBoundaryFactsArtifact(workspaceRoot: string, runId: string): Promise<BoundaryFacts | null> {
  try {
    const raw = await readFile(join(workspaceRoot, ".aetherion", "artifacts", "boundary", runId, `boundary_${runId}_facts.json`), "utf8");
    return JSON.parse(raw) as BoundaryFacts;
  } catch {
    return null;
  }
}
