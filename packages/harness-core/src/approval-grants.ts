import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// A standing "allow always" approval grant. Unlike a per-run ConsentRecord
// (which is TTL-scoped and bound to a single tool request), an always-grant is
// a durable, workspace-scoped decision that a given tool+verb may run without
// re-prompting. It is intentionally coarse (keyed by tool name and verb, not by
// resource) so it matches the OpenClaw/Hermes "allow always" affordance.
export type AlwaysGrant = {
  key: string;
  tool_name: string;
  verb: string;
  granted_at: string;
};

type AlwaysGrantsFile = {
  grants: AlwaysGrant[];
};

export function alwaysGrantKey(toolName: string, verb: string): string {
  return `${toolName}:${verb}`;
}

function grantsFilePath(workspaceRoot: string): string {
  return join(workspaceRoot, ".aetherion", "approvals", "always-grants.json");
}

export async function loadAlwaysGrants(workspaceRoot: string): Promise<AlwaysGrant[]> {
  try {
    const raw = await readFile(grantsFilePath(workspaceRoot), "utf8");
    const parsed = JSON.parse(raw) as Partial<AlwaysGrantsFile>;
    if (!parsed || !Array.isArray(parsed.grants)) {
      return [];
    }
    return parsed.grants.filter(
      (g): g is AlwaysGrant =>
        typeof g === "object" &&
        g !== null &&
        typeof g.key === "string" &&
        typeof g.tool_name === "string" &&
        typeof g.verb === "string"
    );
  } catch {
    return [];
  }
}

// recordAlwaysGrant adds a tool+verb grant if it is not already present and
// returns the full grant list. Writing is idempotent: a repeated grant does not
// duplicate or refresh the existing entry.
export async function recordAlwaysGrant(
  workspaceRoot: string,
  toolName: string,
  verb: string,
  grantedAt?: string
): Promise<AlwaysGrant[]> {
  const key = alwaysGrantKey(toolName, verb);
  const existing = await loadAlwaysGrants(workspaceRoot);
  if (existing.some((g) => g.key === key)) {
    return existing;
  }
  const next: AlwaysGrant[] = [
    ...existing,
    { key, tool_name: toolName, verb, granted_at: grantedAt ?? new Date().toISOString() }
  ];
  const path = grantsFilePath(workspaceRoot);
  await mkdir(join(workspaceRoot, ".aetherion", "approvals"), { recursive: true });
  await writeFile(path, `${JSON.stringify({ grants: next }, null, 2)}\n`);
  return next;
}
