export type EventCheckpoint = {
  id: string;
  run_id: string;
  event_id: string;
  event_hash?: string;
  created_at: string;
  replay_mode: "trace" | "simulation";
  active_leases_reusable: false;
};

export type LedgerBranch = {
  id: string;
  checkpoint_id: string;
  source_event_id?: string;
  source_event_hash?: string;
  head_event_id?: string;
  head_event_hash?: string;
  created_at: string;
  inherits_authority: false;
  status: "sandbox" | "approved" | "discarded";
};

export type SandboxRehearsal = {
  id: string;
  branch_id: string;
  mode: "diff" | "draft" | "plan" | "simulation";
  real_workspace_mutated: false;
  result: string;
  approval_required: boolean;
};

export type SandboxApproval = {
  id: string;
  rehearsal_id: string;
  branch_id: string;
  fresh_policy_evaluated: true;
  inherited_authority: false;
  policy_event_id: string;
  live_action_event_id: string;
  status: "approved" | "denied";
};

export function createCheckpoint(runId: string, eventId: string, eventHash?: string): EventCheckpoint {
  return {
    id: `checkpoint_${runId}_${eventId}`.replace(/[^A-Za-z0-9_-]/g, "_"),
    run_id: runId,
    event_id: eventId,
    event_hash: eventHash,
    created_at: new Date().toISOString(),
    replay_mode: "simulation",
    active_leases_reusable: false
  };
}

export function createBranch(checkpoint: EventCheckpoint, suffix = "sandbox"): LedgerBranch {
  return {
    id: `branch_${checkpoint.id}_${suffix}`,
    checkpoint_id: checkpoint.id,
    source_event_id: checkpoint.event_id,
    source_event_hash: checkpoint.event_hash,
    head_event_id: checkpoint.event_id,
    head_event_hash: checkpoint.event_hash,
    created_at: new Date().toISOString(),
    inherits_authority: false,
    status: "sandbox"
  };
}

export function rehearse(branch: LedgerBranch, result: string): SandboxRehearsal {
  return {
    id: `rehearsal_${branch.id}`,
    branch_id: branch.id,
    mode: "diff",
    real_workspace_mutated: false,
    result,
    approval_required: true
  };
}

export function approveRehearsal(
  rehearsal: SandboxRehearsal,
  branch: LedgerBranch,
  policyEventId: string,
  liveActionEventId: string
): { branch: LedgerBranch; approval: SandboxApproval } {
  if (branch.id !== rehearsal.branch_id) {
    throw new Error(`Rehearsal ${rehearsal.id} does not belong to branch ${branch.id}`);
  }
  if (branch.inherits_authority !== false) {
    throw new Error(`Branch ${branch.id} attempted to inherit authority`);
  }
  if (!rehearsal.approval_required) {
    throw new Error(`Rehearsal ${rehearsal.id} does not require approval`);
  }
  const approvedBranch = approveBranch(branch);
  return {
    branch: approvedBranch,
    approval: {
      id: `sandbox_approval_${rehearsal.id}`,
      rehearsal_id: rehearsal.id,
      branch_id: branch.id,
      fresh_policy_evaluated: true,
      inherited_authority: false,
      policy_event_id: policyEventId,
      live_action_event_id: liveActionEventId,
      status: "approved"
    }
  };
}

export function findCheckpoint(checkpoints: EventCheckpoint[], id: string): EventCheckpoint | undefined {
  return checkpoints.find((checkpoint) => checkpoint.id === id);
}

export function findBranch(branches: LedgerBranch[], id: string): LedgerBranch | undefined {
  return branches.find((branch) => branch.id === id);
}

export function approveBranch(branch: LedgerBranch): LedgerBranch {
  if (branch.status !== "sandbox") {
    throw new Error(`Branch ${branch.id} is not in sandbox state`);
  }
  return { ...branch, status: "approved" };
}

export function discardBranch(branch: LedgerBranch): LedgerBranch {
  return { ...branch, status: "discarded" };
}

export function isCheckpoint(value: unknown): value is EventCheckpoint {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.run_id === "string"
    && value.active_leases_reusable === false;
}

export function isBranch(value: unknown): value is LedgerBranch {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.checkpoint_id === "string"
    && value.inherits_authority === false;
}

export function isRehearsal(value: unknown): value is SandboxRehearsal {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.branch_id === "string"
    && value.real_workspace_mutated === false
    && value.approval_required === true;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
