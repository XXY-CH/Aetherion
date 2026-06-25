import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

// Durable input admission records that a specific user input was accepted into a
// run. It is the durable-session-runner invariant that lets a restarted or
// resumed run recognize inputs it already admitted instead of re-executing them.
// Admission is idempotent and keyed by (runId, sequence): re-admitting the same
// input id is a no-op that returns the original record, so a replay after a
// crash does not double-process the same turn.
export type AdmittedInput = {
  input_id: string;
  content_hash: string;
  sequence: number;
  admitted_at: string;
};

type AdmissionsFile = {
  admissions: AdmittedInput[];
};

export type AdmissionOutcome = {
  // true when this call newly admitted the input; false when it was already
  // admitted (idempotent replay).
  admitted: boolean;
  record: AdmittedInput;
};

export function admissionInputId(runId: string, sequence: number): string {
  return `input_${runId}_${sequence}`;
}

function admissionsFilePath(workspaceRoot: string, runId: string): string {
  return join(workspaceRoot, ".aetherion", "admissions", `${runId}.json`);
}

export async function loadAdmittedInputs(workspaceRoot: string, runId: string): Promise<AdmittedInput[]> {
  try {
    const raw = await readFile(admissionsFilePath(workspaceRoot, runId), "utf8");
    const parsed = JSON.parse(raw) as Partial<AdmissionsFile>;
    if (!parsed || !Array.isArray(parsed.admissions)) {
      return [];
    }
    return parsed.admissions.filter(
      (a): a is AdmittedInput =>
        typeof a === "object" &&
        a !== null &&
        typeof a.input_id === "string" &&
        typeof a.content_hash === "string" &&
        typeof a.sequence === "number"
    );
  } catch {
    return [];
  }
}

// admitInput durably records an input under a run. It is idempotent: re-admitting
// an already-present input id returns the existing record with admitted=false and
// does not rewrite the store.
export async function admitInput(
  workspaceRoot: string,
  runId: string,
  content: string,
  sequence = 1,
  admittedAt?: string
): Promise<AdmissionOutcome> {
  const inputId = admissionInputId(runId, sequence);
  const existing = await loadAdmittedInputs(workspaceRoot, runId);
  const prior = existing.find((a) => a.input_id === inputId);
  if (prior) {
    return { admitted: false, record: prior };
  }
  const record: AdmittedInput = {
    input_id: inputId,
    content_hash: createHash("sha256").update(content).digest("hex"),
    sequence,
    admitted_at: admittedAt ?? new Date().toISOString()
  };
  const next = [...existing, record];
  await mkdir(join(workspaceRoot, ".aetherion", "admissions"), { recursive: true });
  await writeFile(admissionsFilePath(workspaceRoot, runId), `${JSON.stringify({ admissions: next }, null, 2)}\n`);
  return { admitted: true, record };
}
