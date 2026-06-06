export type ResourceBudget = {
  id: string;
  token_budget: number;
  tool_call_budget: number;
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
  allowed_capsules: string[];
  completion_evidence_required: boolean;
};

export type CircuitBreaker = {
  id: string;
  trigger: "budget_exhausted" | "repeated_policy_denial" | "permission_violation" | "poisoning_detected";
  status: "open" | "closed";
  event_id: string;
  reason: string;
};

export function createAgentContract(parentRunId: string, childAgentId: string, task: string, budget: ResourceBudget, allowedCapsules: string[]): AgentContract {
  return {
    id: `contract_${parentRunId}_${childAgentId}`,
    parent_run_id: parentRunId,
    child_agent_id: childAgentId,
    task,
    resource_budget_id: budget.id,
    allowed_capsules: allowedCapsules,
    completion_evidence_required: true
  };
}

export function consumeToolCall(budget: ResourceBudget): ResourceBudget | CircuitBreaker {
  if (budget.tool_call_budget <= 0) {
    return {
      id: `breaker_${budget.id}`,
      trigger: "budget_exhausted",
      status: "open",
      event_id: `evt_${budget.id}_exhausted`,
      reason: "Tool-call budget exhausted"
    };
  }
  return { ...budget, tool_call_budget: budget.tool_call_budget - 1 };
}

export function assertCapsuleAllowed(contract: AgentContract, capsuleId: string): void {
  if (!contract.allowed_capsules.includes(capsuleId)) {
    throw new Error(`Capsule ${capsuleId} is outside child agent contract`);
  }
}

export function createDefaultBudget(id = "budget_tui_child"): ResourceBudget {
  return { id, token_budget: 1000, tool_call_budget: 1, risk_budget: "L2", lease_budget: 1, on_exhaustion: "stop" };
}

export function findBudget(budgets: ResourceBudget[], id: string): ResourceBudget | undefined {
  return budgets.find((budget) => budget.id === id);
}

export function isResourceBudget(value: unknown): value is ResourceBudget {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && "id" in value
    && typeof value.id === "string"
    && "tool_call_budget" in value
    && typeof value.tool_call_budget === "number";
}

export function isCircuitBreaker(value: unknown): value is CircuitBreaker {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && "id" in value
    && typeof value.id === "string"
    && "trigger" in value
    && "status" in value;
}
