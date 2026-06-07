import { randomUUID } from "node:crypto";

export type ResourceBudget = {
  id: string;
  token_budget: number;
  tool_call_budget: number;
  cpu_ms_budget: number;
  network_call_budget: number;
  wall_time_ms_budget: number;
  risk_budget: "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
  lease_budget: number;
  on_exhaustion: "stop" | "queue" | "ask";
};

export type AgentContract = {
  id: string;
  parent_run_id: string;
  child_agent_id: string;
  task: string;
  resource_budget_id: string;
  budget_snapshot: ResourceBudget;
  allowed_capsules: string[];
  allowed_paths: string[];
  completion_evidence_required: true;
  output_taint: { sources: ["child_agent"]; can_authorize_actions: false };
  status: "draft" | "active" | "completed" | "stopped";
  created_at: string;
};

export type BudgetAccount = {
  id: string;
  contract_id: string;
  remaining: ResourceBudget;
  tool_calls_used: number;
  leases_used: number;
  policy_denials: number;
  token_used: number;
  cpu_ms_used: number;
  network_calls_used: number;
  wall_time_ms_used: number;
  status: "active" | "exhausted" | "stopped";
};

export type CircuitBreaker = {
  id: string;
  contract_id: string;
  child_run_id: string;
  trigger: "budget_exhausted" | "repeated_policy_denial" | "permission_violation" | "poisoning_detected" | "execution_failure";
  status: "open" | "closed";
  action: "stop" | "queue" | "report";
  event_id: string;
  reason: string;
  created_at: string;
};

export type ChildResult = {
  id: string;
  contract_id: string;
  child_run_id: string;
  child_agent_id: string;
  capsule_id: string;
  status: "completed";
  completion_evidence: {
    source_event_ids: string[];
    request_id: string;
    policy_decision_id: string;
    lease_id: string;
    artifact_sha256: string;
    byte_count: number;
    usage: {
      token_used: number;
      cpu_ms_used: number;
      network_calls_used: number;
      wall_time_ms_used: number;
    };
  };
  output_taint: { sources: ["child_agent"]; can_authorize_actions: false };
  parent_must_reauthorize_actions: true;
};

export type AgentScore = {
  id: string;
  agent_id: string;
  successes: number;
  policy_denials: number;
  permission_violations: number;
  routing_weight: number;
};

export function createAgentContract(input: {
  parentRunId: string;
  childAgentId: string;
  task: string;
  budget: ResourceBudget;
  allowedCapsules: string[];
  allowedPaths: string[];
}): AgentContract {
  if (!/^agent_[A-Za-z0-9_-]+$/.test(input.childAgentId)) {
    throw new Error("Child agent identity must use the agent_<id> form");
  }
  if (input.allowedCapsules.length === 0 || input.allowedPaths.length === 0) {
    throw new Error("Agent contract requires at least one Capsule and path");
  }
  return {
    id: `contract_${input.parentRunId}_${input.childAgentId}`,
    parent_run_id: input.parentRunId,
    child_agent_id: input.childAgentId,
    task: input.task,
    resource_budget_id: input.budget.id,
    budget_snapshot: structuredClone(input.budget),
    allowed_capsules: [...new Set(input.allowedCapsules)],
    allowed_paths: [...new Set(input.allowedPaths)],
    completion_evidence_required: true,
    output_taint: { sources: ["child_agent"], can_authorize_actions: false },
    status: "draft",
    created_at: new Date().toISOString()
  };
}

export function createBudgetAccount(contract: AgentContract): BudgetAccount {
  return {
    id: `account_${contract.id}`,
    contract_id: contract.id,
    remaining: structuredClone(contract.budget_snapshot),
    tool_calls_used: 0,
    leases_used: 0,
    policy_denials: 0,
    token_used: 0,
    cpu_ms_used: 0,
    network_calls_used: 0,
    wall_time_ms_used: 0,
    status: "active"
  };
}

export function reserveRead(account: BudgetAccount): BudgetAccount | "exhausted" {
  if (
    account.status !== "active"
    || account.remaining.tool_call_budget < 1
    || account.remaining.lease_budget < 1
    || account.remaining.cpu_ms_budget < 1
    || account.remaining.wall_time_ms_budget < 1
  ) {
    return "exhausted";
  }
  return {
    ...account,
    remaining: {
      ...account.remaining,
      tool_call_budget: account.remaining.tool_call_budget - 1,
      lease_budget: account.remaining.lease_budget
    },
    tool_calls_used: account.tool_calls_used + 1,
    leases_used: account.leases_used
  };
}

export function recordLeaseUse(account: BudgetAccount): BudgetAccount {
  if (account.remaining.lease_budget < 1) {
    throw new Error("Lease budget exhausted");
  }
  return {
    ...account,
    remaining: { ...account.remaining, lease_budget: account.remaining.lease_budget - 1 },
    leases_used: account.leases_used + 1
  };
}

export function recordPolicyDenial(account: BudgetAccount): BudgetAccount {
  const policyDenials = account.policy_denials + 1;
  return {
    ...account,
    policy_denials: policyDenials,
    status: policyDenials >= 3 ? "stopped" : account.status
  };
}

export function recordRuntimeUsage(account: BudgetAccount, cpuMs: number, wallTimeMs: number): BudgetAccount {
  const cpu = Math.max(0, Math.ceil(cpuMs));
  const wall = Math.max(0, Math.ceil(wallTimeMs));
  const remainingCpu = Math.max(0, account.remaining.cpu_ms_budget - cpu);
  const remainingWall = Math.max(0, account.remaining.wall_time_ms_budget - wall);
  return {
    ...account,
    remaining: {
      ...account.remaining,
      cpu_ms_budget: remainingCpu,
      wall_time_ms_budget: remainingWall
    },
    cpu_ms_used: account.cpu_ms_used + cpu,
    wall_time_ms_used: account.wall_time_ms_used + wall,
    status: cpu > account.remaining.cpu_ms_budget || wall > account.remaining.wall_time_ms_budget ? "exhausted" : account.status
  };
}

export function assertRiskBudget(contract: AgentContract, required: ResourceBudget["risk_budget"]): void {
  const levels = ["L0", "L1", "L2", "L3", "L4", "L5"];
  if (levels.indexOf(contract.budget_snapshot.risk_budget) < levels.indexOf(required)) {
    throw new Error(`Risk ${required} exceeds child agent budget ${contract.budget_snapshot.risk_budget}`);
  }
}

export function openCircuitBreaker(input: {
  contractId: string;
  childRunId: string;
  trigger: CircuitBreaker["trigger"];
  eventId: string;
  reason: string;
  action?: CircuitBreaker["action"];
}): CircuitBreaker {
  return {
    id: `breaker_${input.contractId}_${randomUUID().slice(0, 8)}`,
    contract_id: input.contractId,
    child_run_id: input.childRunId,
    trigger: input.trigger,
    status: "open",
    action: input.action ?? "stop",
    event_id: input.eventId,
    reason: input.reason,
    created_at: new Date().toISOString()
  };
}

export function assertCapsuleAllowed(contract: AgentContract, capsuleId: string): void {
  if (!contract.allowed_capsules.includes(capsuleId)) {
    throw new Error(`Capsule ${capsuleId} is outside child agent contract`);
  }
}

export function assertPathAllowed(contract: AgentContract, path: string): void {
  if (!contract.allowed_paths.includes(path)) {
    throw new Error(`Path ${path} is outside child agent contract`);
  }
}

export function updateAgentScore(current: AgentScore | undefined, agentId: string, outcome: "success" | "policy_denial" | "permission_violation"): AgentScore {
  const next = current ?? {
    id: `score_${agentId}`,
    agent_id: agentId,
    successes: 0,
    policy_denials: 0,
    permission_violations: 0,
    routing_weight: 1
  };
  const updated = {
    ...next,
    successes: next.successes + (outcome === "success" ? 1 : 0),
    policy_denials: next.policy_denials + (outcome === "policy_denial" ? 1 : 0),
    permission_violations: next.permission_violations + (outcome === "permission_violation" ? 1 : 0)
  };
  return {
    ...updated,
    routing_weight: Math.max(0.1, Number(((updated.successes + 1) / (updated.successes + updated.policy_denials + updated.permission_violations + 1)).toFixed(3)))
  };
}

export function findBudget(budgets: ResourceBudget[], id: string): ResourceBudget | undefined {
  return budgets.find((budget) => budget.id === id);
}

export function isResourceBudget(value: unknown): value is ResourceBudget {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.token_budget === "number"
    && typeof value.tool_call_budget === "number"
    && typeof value.cpu_ms_budget === "number"
    && typeof value.network_call_budget === "number"
    && typeof value.wall_time_ms_budget === "number"
    && typeof value.lease_budget === "number";
}

export function isAgentContract(value: unknown): value is AgentContract {
  return isObject(value)
    && typeof value.id === "string"
    && Array.isArray(value.allowed_capsules)
    && Array.isArray(value.allowed_paths)
    && value.completion_evidence_required === true;
}

export function isBudgetAccount(value: unknown): value is BudgetAccount {
  return isObject(value) && typeof value.id === "string" && isObject(value.remaining);
}

export function isAgentScore(value: unknown): value is AgentScore {
  return isObject(value) && typeof value.id === "string" && typeof value.routing_weight === "number";
}

export function isCircuitBreaker(value: unknown): value is CircuitBreaker {
  return isObject(value) && typeof value.id === "string" && value.status === "open";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
