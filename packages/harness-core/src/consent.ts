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
  ttlSeconds?: number;
}): ConsentRecord {
  const approvedAt = input.approvedAt ?? new Date().toISOString();
  const ttlSeconds = input.ttlSeconds ?? 300;
  const expiresAt = new Date(Date.parse(approvedAt) + ttlSeconds * 1000).toISOString();
  return {
    id: `consent_${input.runId}_write`,
    user_id: input.userId ?? "user_local",
    workspace_id: input.workspaceId,
    tool_request_id: input.toolRequestId,
    decision: "approved",
    risk_level: "L3",
    approved_at: approvedAt,
    expires_at: expiresAt,
    scope: {
      actions: ["write"],
      paths: [input.path]
    }
  };
}

// createExecConsentRecord synthesizes a durable, schema-valid ConsentRecord for
// an approved execute-family tool (shell_exec / agent_spawn). Unlike writes
// (one consent per run), execute calls can recur within a run, so the id is
// disambiguated by verb and loop depth. The scope is TTL-bounded to mirror the
// scoped-lease model — an approval authorizes this command/task now, not a
// standing capability.
export function createExecConsentRecord(input: {
  runId: string;
  workspaceId: string;
  toolRequestId: string;
  riskLevel: ConsentRecord["risk_level"];
  kind: "command" | "task";
  target: string;
  depth: number;
  userId?: string;
  approvedAt?: string;
  ttlSeconds?: number;
}): ConsentRecord {
  const approvedAt = input.approvedAt ?? new Date().toISOString();
  const ttlSeconds = input.ttlSeconds ?? 300;
  const expiresAt = new Date(Date.parse(approvedAt) + ttlSeconds * 1000).toISOString();
  const verb = input.kind === "command" ? "exec" : "spawn";
  const scope: Record<string, unknown> = input.kind === "command"
    ? { actions: ["exec"], commands: [input.target] }
    : { actions: ["spawn"], tasks: [input.target] };
  return {
    id: `consent_${input.runId}_${verb}_${input.depth}`,
    user_id: input.userId ?? "user_local",
    workspace_id: input.workspaceId,
    tool_request_id: input.toolRequestId,
    decision: "approved",
    risk_level: input.riskLevel,
    approved_at: approvedAt,
    expires_at: expiresAt,
    scope
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
