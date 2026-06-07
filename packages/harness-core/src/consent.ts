import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Workspace } from "./ledger.ts";
import type { ConsentRecord } from "./policy.ts";
import { validateAgainstSchema } from "./schema.ts";

export function createWriteConsentRecord(input: {
  runId: string;
  workspaceId: string;
  toolRequestId: string;
  path: string;
  userId?: string;
  approvedAt?: string;
}): ConsentRecord {
  return {
    id: `consent_${input.runId}_write`,
    user_id: input.userId ?? "user_local",
    workspace_id: input.workspaceId,
    tool_request_id: input.toolRequestId,
    decision: "approved",
    risk_level: "L3",
    approved_at: input.approvedAt ?? new Date().toISOString(),
    expires_at: null,
    scope: {
      actions: ["write"],
      paths: [input.path]
    }
  };
}

export async function writeConsentRecordArtifact(repoRoot: string, workspace: Workspace, runId: string, consent: ConsentRecord): Promise<string> {
  const result = await validateAgainstSchema(repoRoot, "consent-record.schema.json", consent);
  if (!result.valid) {
    throw new Error(`consent-record.schema.json validation failed: ${result.errors.join("; ")}`);
  }
  const dir = join(workspace.root, ".aetherion", "artifacts", "consent", runId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${consent.id}.json`), `${JSON.stringify(consent, null, 2)}\n`);
  return consentRecordArtifactRef(runId);
}

export function consentRecordArtifactRef(runId: string): string {
  return `artifact://consent/${runId}/write`;
}

export async function readConsentRecordArtifact(workspaceRoot: string, runId: string): Promise<ConsentRecord | null> {
  try {
    const raw = await readFile(join(workspaceRoot, ".aetherion", "artifacts", "consent", runId, `consent_${runId}_write.json`), "utf8");
    return JSON.parse(raw) as ConsentRecord;
  } catch {
    return null;
  }
}
