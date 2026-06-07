import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertCapsuleAllowed,
  assertPathAllowed,
  assertRiskBudget,
  createAgentContract,
  createBudgetAccount,
  openCircuitBreaker,
  recordLeaseUse,
  recordPolicyDenial,
  recordRuntimeUsage,
  reserveRead,
  updateAgentScore,
  type ResourceBudget
} from "../src/index.ts";

function budget(toolCalls = 1, leases = 1): ResourceBudget {
  return {
    id: "budget_child",
    token_budget: 1000,
    tool_call_budget: toolCalls,
    cpu_ms_budget: 10000,
    network_call_budget: 0,
    wall_time_ms_budget: 30000,
    risk_budget: "L2",
    lease_budget: leases,
    on_exhaustion: "stop"
  };
}

test("multi-agent contracts isolate Capsules, paths, budgets, and child output authority", () => {
  const contract = createAgentContract({
    parentRunId: "run_parent",
    childAgentId: "agent_search",
    task: "search docs",
    budget: budget(),
    allowedCapsules: ["cap_search"],
    allowedPaths: ["README.md"]
  });
  assertCapsuleAllowed(contract, "cap_search");
  assertPathAllowed(contract, "README.md");
  assert.throws(() => assertCapsuleAllowed(contract, "cap_payment"), /outside child agent contract/);
  assert.throws(() => assertPathAllowed(contract, "secrets.txt"), /outside child agent contract/);
  assert.equal(contract.output_taint.can_authorize_actions, false);

  const account = createBudgetAccount(contract);
  const reserved = reserveRead(account);
  assert.notEqual(reserved, "exhausted");
  const consumed = recordLeaseUse(reserved as typeof account);
  assert.equal(consumed.remaining.tool_call_budget, 0);
  assert.equal(consumed.remaining.lease_budget, 0);
  assert.equal(reserveRead(consumed), "exhausted");
  assert.doesNotThrow(() => assertRiskBudget(contract, "L1"));
  assert.throws(() => assertRiskBudget(contract, "L3"), /exceeds child agent budget/);
  const overCpu = recordRuntimeUsage(createBudgetAccount(contract), 10001, 1);
  assert.equal(overCpu.status, "exhausted");
  const noWallBudget = createBudgetAccount({
    ...contract,
    budget_snapshot: { ...contract.budget_snapshot, wall_time_ms_budget: 0 }
  });
  assert.equal(reserveRead(noWallBudget), "exhausted");
});

test("repeated policy denial opens a hard-stop breaker and lowers routing weight", () => {
  const contract = createAgentContract({
    parentRunId: "run_parent",
    childAgentId: "agent_search",
    task: "search docs",
    budget: budget(3, 1),
    allowedCapsules: ["cap_search"],
    allowedPaths: ["../outside"]
  });
  let account = createBudgetAccount(contract);
  account = recordPolicyDenial(account);
  account = recordPolicyDenial(account);
  account = recordPolicyDenial(account);
  assert.equal(account.status, "stopped");
  const breaker = openCircuitBreaker({
    contractId: contract.id,
    childRunId: "run_child_denied",
    trigger: "repeated_policy_denial",
    eventId: "evt_denied",
    reason: "Three policy denials"
  });
  assert.equal(breaker.status, "open");
  const first = updateAgentScore(undefined, "agent_search", "success");
  const denied = updateAgentScore(first, "agent_search", "policy_denial");
  assert.ok(denied.routing_weight < first.routing_weight);
});
