export type HibernationRecord = {
  id: string;
  run_id: string;
  status: "sleeping" | "waking" | "completed" | "expired";
  created_at: string;
  active_leases_retained: false;
  minimal_context_pack_id: string;
};

export type WakeupTrigger = {
  id: string;
  hibernation_id: string;
  source: "manual" | "file" | "deadline" | "webhook" | "im";
  status: "queued" | "resumed" | "discarded" | "expired";
  policy_recheck_required: true;
};

export function hibernateRun(runId: string, contextPackId: string): HibernationRecord {
  return {
    id: `hibernate_${runId}`,
    run_id: runId,
    status: "sleeping",
    created_at: new Date().toISOString(),
    active_leases_retained: false,
    minimal_context_pack_id: contextPackId
  };
}

export function wakeRun(record: HibernationRecord, source: WakeupTrigger["source"]): WakeupTrigger {
  if (record.status !== "sleeping") {
    return {
      id: `wake_${record.id}`,
      hibernation_id: record.id,
      source,
      status: "discarded",
      policy_recheck_required: true
    };
  }
  return {
    id: `wake_${record.id}`,
    hibernation_id: record.id,
    source,
    status: "queued",
    policy_recheck_required: true
  };
}

export function markWaking(record: HibernationRecord): HibernationRecord {
  if (record.status !== "sleeping") {
    throw new Error(`Hibernation ${record.id} is not sleeping`);
  }
  return { ...record, status: "waking" };
}

export function findHibernation(records: HibernationRecord[], id: string): HibernationRecord | undefined {
  return records.find((record) => record.id === id);
}

export function isHibernationRecord(value: unknown): value is HibernationRecord {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && "id" in value
    && typeof value.id === "string"
    && "status" in value
    && typeof value.status === "string"
    && "active_leases_retained" in value
    && value.active_leases_retained === false;
}
