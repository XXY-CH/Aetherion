import { createHash } from "node:crypto";
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
  hash_version: "aetherion-event-v1";
  payload_ref?: string;
  parent_event_id?: string;
  parent_event_hash?: string;
  event_hash?: string;
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
  runtimeDir: string;
};

export async function createWorkspace(root: string, id: string): Promise<Workspace> {
  const runtimeDir = join(root, ".aetherion");
  const ledgerPath = join(runtimeDir, "events", "events.jsonl");
  await mkdir(dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, "", { flag: "a" });
  return { root, id, ledgerPath, runtimeDir };
}

export async function appendEvent(repoRoot: string, workspace: Workspace, event: EventRecord): Promise<void> {
  const previous = (await readEvents(workspace)).at(-1);
  const enriched = withEventHash(event, previous);
  const result = await validateAgainstSchema(repoRoot, "event.schema.json", enriched);
  if (!result.valid) {
    throw new Error(`Invalid event ${enriched.id}: ${result.errors.join("; ")}`);
  }
  await writeFile(workspace.ledgerPath, `${JSON.stringify(enriched)}\n`, { flag: "a" });
}

export async function readEvents(workspace: Workspace): Promise<EventRecord[]> {
  const raw = await readFile(workspace.ledgerPath, "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EventRecord);
}

export function eventRecord(input: Omit<EventRecord, "timestamp" | "workspace_id" | "hash_version" | "sensitivity" | "taint"> & {
  workspace_id: string;
  sensitivity?: string;
  taint?: EventRecord["taint"];
}): EventRecord {
  return {
    ...input,
    timestamp: new Date().toISOString(),
    hash_version: "aetherion-event-v1",
    sensitivity: input.sensitivity ?? "private",
    taint: input.taint ?? { sources: ["trusted_system"], can_authorize_actions: false }
  };
}

export function eventContentHash(event: EventRecord): string {
  const { event_hash: _eventHash, ...withoutHash } = event;
  return `sha256:${createHash("sha256").update(stableStringify(withoutHash)).digest("hex")}`;
}

export function verifyEventHashChain(events: EventRecord[]): { valid: boolean; broken_at?: string } {
  for (const [index, event] of events.entries()) {
    if (event.event_hash !== eventContentHash(event)) {
      return { valid: false, broken_at: event.id };
    }
    const previous = events[index - 1];
    if (!previous) {
      if (event.parent_event_id || event.parent_event_hash) {
        return { valid: false, broken_at: event.id };
      }
      continue;
    }
    if (event.parent_event_id !== previous.id || event.parent_event_hash !== previous.event_hash) {
      return { valid: false, broken_at: event.id };
    }
  }
  return { valid: true };
}

function withEventHash(event: EventRecord, previous: EventRecord | undefined): EventRecord {
  const enriched: EventRecord = {
    ...event,
    parent_event_id: previous?.id,
    parent_event_hash: previous?.event_hash
  };
  if (!previous) {
    delete enriched.parent_event_id;
    delete enriched.parent_event_hash;
  }
  return {
    ...enriched,
    event_hash: eventContentHash(enriched)
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
