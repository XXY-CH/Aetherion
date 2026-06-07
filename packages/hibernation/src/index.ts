import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { ContextPack } from "../../memory-os/src/index.ts";

export type WakeSource = "manual" | "file" | "deadline";

export type HibernationRecord = {
  id: string;
  run_id: string;
  status: "sleeping" | "queued" | "completed" | "expired";
  created_at: string;
  expires_at: string | null;
  active_leases_retained: false;
  minimal_context_pack_id: string;
  ledger_cursor: {
    event_id: string;
    event_hash: string;
    event_count: number;
  };
  resume_summary: string;
  trigger_ids: string[];
  attention_budget: {
    max_wakeups: number;
    used_wakeups: number;
  };
  max_auto_risk: "L2";
};

export type WakeupTrigger = {
  id: string;
  hibernation_id: string;
  source: WakeSource;
  status: "scheduled" | "eligible" | "queued" | "discarded" | "expired";
  created_at: string;
  expires_at: string | null;
  condition: {
    deadline_at: string | null;
    file_path: string | null;
    baseline_sha256: string | null;
  };
  observed_at: string | null;
  policy_recheck_required: true;
  fresh_policy_decision_id: string | null;
  resume_run_id: string | null;
  auto_execute_allowed: false;
  reason: string;
};

export type HibernationInput = {
  runId: string;
  contextPack: ContextPack;
  ledgerCursor: HibernationRecord["ledger_cursor"];
  resumeSummary: string;
  triggers: WakeupTrigger[];
  expiresAt?: string | null;
  maxWakeups?: number;
};

export function hibernateRun(input: HibernationInput): HibernationRecord {
  const hibernationId = `hibernate_${input.runId}`;
  if (input.contextPack.run_id !== input.runId) {
    throw new Error("Hibernation context must belong to the source run");
  }
  if (input.contextPack.active_leases.length > 0) {
    throw new Error("Hibernation context cannot retain active leases");
  }
  if (input.contextPack.selected_memories.some((memory) => memory.reason.includes("blocked"))) {
    throw new Error("Hibernation context cannot contain blocked memory");
  }
  if (!input.ledgerCursor.event_hash.startsWith("sha256:")) {
    throw new Error("Hibernation requires a hash-bound Ledger cursor");
  }
  if (!Number.isInteger(input.ledgerCursor.event_count) || input.ledgerCursor.event_count < 1) {
    throw new Error("Hibernation requires a non-empty Ledger cursor");
  }
  if (input.triggers.length === 0 || input.triggers.some((trigger) => trigger.hibernation_id !== hibernationId)) {
    throw new Error("Hibernation triggers must belong to the source run");
  }
  if (input.maxWakeups !== undefined && (!Number.isInteger(input.maxWakeups) || input.maxWakeups < 1)) {
    throw new Error("Hibernation attention budget must allow at least one wakeup");
  }
  return {
    id: hibernationId,
    run_id: input.runId,
    status: "sleeping",
    created_at: new Date().toISOString(),
    expires_at: input.expiresAt ?? null,
    active_leases_retained: false,
    minimal_context_pack_id: input.contextPack.id,
    ledger_cursor: input.ledgerCursor,
    resume_summary: input.resumeSummary,
    trigger_ids: input.triggers.map((trigger) => trigger.id),
    attention_budget: {
      max_wakeups: input.maxWakeups ?? 3,
      used_wakeups: 0
    },
    max_auto_risk: "L2"
  };
}

export function createManualTrigger(hibernationId: string): WakeupTrigger {
  return baseTrigger(hibernationId, "manual", {
    deadline_at: null,
    file_path: null,
    baseline_sha256: null
  });
}

export function createDeadlineTrigger(hibernationId: string, deadlineAt: string): WakeupTrigger {
  const deadline = Date.parse(deadlineAt);
  if (!Number.isFinite(deadline)) {
    throw new Error("Deadline trigger requires a valid date-time");
  }
  return baseTrigger(hibernationId, "deadline", {
    deadline_at: new Date(deadline).toISOString(),
    file_path: null,
    baseline_sha256: null
  });
}

export function createFileTrigger(workspaceRoot: string, hibernationId: string, filePath: string): WakeupTrigger {
  const canonicalRoot = realpathSync(resolve(workspaceRoot));
  const target = workspaceFile(workspaceRoot, filePath);
  return baseTrigger(hibernationId, "file", {
    deadline_at: null,
    file_path: relative(canonicalRoot, target),
    baseline_sha256: fileSha256(target)
  });
}

export function evaluateWakeup(
  workspaceRoot: string,
  record: HibernationRecord,
  trigger: WakeupTrigger,
  now = new Date()
): WakeupTrigger {
  if (trigger.hibernation_id !== record.id || record.status !== "sleeping") {
    return { ...trigger, status: "discarded", observed_at: now.toISOString(), reason: "Hibernation is not eligible for wakeup." };
  }
  if (record.expires_at && Date.parse(record.expires_at) <= now.getTime()) {
    return { ...trigger, status: "expired", observed_at: now.toISOString(), reason: "Hibernation expired before wakeup." };
  }
  if (trigger.expires_at && Date.parse(trigger.expires_at) <= now.getTime()) {
    return { ...trigger, status: "expired", observed_at: now.toISOString(), reason: "Wakeup trigger expired." };
  }
  if (record.attention_budget.used_wakeups >= record.attention_budget.max_wakeups) {
    return { ...trigger, status: "discarded", observed_at: now.toISOString(), reason: "Wakeup attention budget exhausted." };
  }

  let eligible = trigger.source === "manual";
  let reason = "Manual wakeup requested.";
  if (trigger.source === "deadline") {
    eligible = trigger.condition.deadline_at !== null && Date.parse(trigger.condition.deadline_at) <= now.getTime();
    reason = eligible ? "Deadline reached." : "Deadline has not been reached.";
  }
  if (trigger.source === "file") {
    const path = trigger.condition.file_path;
    if (!path || !trigger.condition.baseline_sha256) {
      return { ...trigger, status: "discarded", observed_at: now.toISOString(), reason: "File trigger is incomplete." };
    }
    const target = workspaceFile(workspaceRoot, path, false);
    eligible = fileSha256OrMissing(target) !== trigger.condition.baseline_sha256;
    reason = eligible ? "Watched file changed." : "Watched file is unchanged.";
  }
  return {
    ...trigger,
    status: eligible ? "eligible" : "scheduled",
    observed_at: now.toISOString(),
    reason
  };
}

export function queueWakeup(
  record: HibernationRecord,
  trigger: WakeupTrigger,
  policyDecisionId: string,
  resumeRunId: string
): { hibernation: HibernationRecord; trigger: WakeupTrigger } {
  if (record.status !== "sleeping" || trigger.hibernation_id !== record.id) {
    throw new Error("Wakeup trigger does not belong to an eligible hibernation");
  }
  if (trigger.status !== "eligible") {
    throw new Error(`Wakeup trigger ${trigger.id} is not eligible`);
  }
  if (!policyDecisionId) {
    throw new Error("Wakeup queueing requires a fresh supervisor policy decision");
  }
  return {
    hibernation: {
      ...record,
      status: "queued",
      active_leases_retained: false,
      attention_budget: {
        ...record.attention_budget,
        used_wakeups: record.attention_budget.used_wakeups + 1
      }
    },
    trigger: {
      ...trigger,
      status: "queued",
      fresh_policy_decision_id: policyDecisionId,
      resume_run_id: resumeRunId,
      auto_execute_allowed: false,
      reason: `${trigger.reason} Fresh policy allowed queueing only; no action or lease was issued.`
    }
  };
}

export function createResumeRunId(): string {
  return `run_resume_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

export function findHibernation(records: HibernationRecord[], id: string): HibernationRecord | undefined {
  return records.find((record) => record.id === id);
}

export function findWakeupTrigger(records: WakeupTrigger[], id: string): WakeupTrigger | undefined {
  return records.find((record) => record.id === id);
}

export function isHibernationRecord(value: unknown): value is HibernationRecord {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.run_id === "string"
    && typeof value.status === "string"
    && value.active_leases_retained === false
    && isObject(value.ledger_cursor)
    && isObject(value.attention_budget);
}

export function isWakeupTrigger(value: unknown): value is WakeupTrigger {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.hibernation_id === "string"
    && typeof value.source === "string"
    && typeof value.status === "string"
    && value.auto_execute_allowed === false;
}

function baseTrigger(hibernationId: string, source: WakeSource, condition: WakeupTrigger["condition"]): WakeupTrigger {
  return {
    id: `wake_${sanitize(hibernationId)}_${source}_${randomUUID().slice(0, 8)}`,
    hibernation_id: hibernationId,
    source,
    status: source === "manual" ? "eligible" : "scheduled",
    created_at: new Date().toISOString(),
    expires_at: null,
    condition,
    observed_at: null,
    policy_recheck_required: true,
    fresh_policy_decision_id: null,
    resume_run_id: null,
    auto_execute_allowed: false,
    reason: source === "manual" ? "Manual wakeup is immediately eligible." : "Waiting for trigger condition."
  };
}

function workspaceFile(workspaceRoot: string, path: string, mustExist = true): string {
  const root = realpathSync(resolve(workspaceRoot));
  const target = resolve(root, path);
  const relativePath = relative(root, target);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Wakeup file trigger must stay inside the workspace");
  }
  if (relativePath === ".aetherion" || relativePath.startsWith(`.aetherion/`)) {
    throw new Error("Wakeup file trigger cannot watch Aetherion runtime state");
  }
  if (mustExist && !existsSync(target)) {
    throw new Error(`Wakeup file trigger target does not exist: ${relativePath}`);
  }
  if (existsSync(target)) {
    const canonicalTarget = realpathSync(target);
    const canonicalRelative = relative(root, canonicalTarget);
    if (!canonicalRelative || canonicalRelative.startsWith("..") || isAbsolute(canonicalRelative)) {
      throw new Error("Wakeup file trigger cannot follow a symbolic link outside the workspace");
    }
  }
  return target;
}

function fileSha256(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function fileSha256OrMissing(path: string): string {
  return existsSync(path) ? fileSha256(path) : "missing";
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "_");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
