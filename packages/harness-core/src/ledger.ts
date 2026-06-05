import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { validateAgainstSchema } from "./schema.ts";

export type EventRecord = {
  id: string;
  timestamp: string;
  workspace_id: string;
  run_id: string;
  event_type: string;
  actor: {
    type: "user" | "agent" | "system" | "connector" | "worker";
    id: string;
  };
  summary: string;
  payload_ref?: string;
  sensitivity: string;
  taint: {
    sources: string[];
    can_authorize_actions: boolean;
  };
  retention?: {
    ttl?: string;
    user_deletable?: boolean;
  };
  links?: string[];
};

export type Workspace = {
  root: string;
  id: string;
  ledgerPath: string;
};

export async function createWorkspace(root: string, id = "ws_test"): Promise<Workspace> {
  const ledgerPath = join(root, ".aetherion", "events", "events.jsonl");
  await mkdir(dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, "", { flag: "a" });
  return { root, id, ledgerPath };
}

export async function appendEvent(repoRoot: string, workspace: Workspace, event: EventRecord): Promise<void> {
  const result = await validateAgainstSchema(repoRoot, "event.schema.json", event);
  if (!result.valid) {
    throw new Error(`Invalid event ${event.id}: ${result.errors.join("; ")}`);
  }
  await writeFile(workspace.ledgerPath, `${JSON.stringify(event)}\n`, { flag: "a" });
}

export async function readEvents(workspace: Workspace): Promise<EventRecord[]> {
  const raw = await readFile(workspace.ledgerPath, "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EventRecord);
}

export function eventRecord(input: Omit<EventRecord, "timestamp" | "workspace_id" | "sensitivity" | "taint"> & {
  workspace_id: string;
  sensitivity?: string;
  taint?: EventRecord["taint"];
}): EventRecord {
  return {
    ...input,
    timestamp: new Date().toISOString(),
    sensitivity: input.sensitivity ?? "private",
    taint: input.taint ?? { sources: ["trusted_system"], can_authorize_actions: false }
  };
}
