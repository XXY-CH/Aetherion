import assert from "node:assert/strict";
import { test } from "node:test";
import { assertCapsuleAllowed, consumeToolCall, createAgentContract, type CircuitBreaker, type ResourceBudget } from "../src/index.ts";

test("multi-agent contracts isolate capsules and trigger budget breakers", () => {
  const budget: ResourceBudget = { id: "budget_child", token_budget: 1000, tool_call_budget: 1, risk_budget: "L2", lease_budget: 1, on_exhaustion: "stop" };
  const contract = createAgentContract("run_parent", "agent_search", "search docs", budget, ["cap_search"]);
  assertCapsuleAllowed(contract, "cap_search");
  assert.throws(() => assertCapsuleAllowed(contract, "cap_payment"), /outside child agent contract/);
  const remaining = consumeToolCall(budget) as ResourceBudget;
  assert.equal(remaining.tool_call_budget, 0);
  const breaker = consumeToolCall(remaining) as CircuitBreaker;
  assert.equal(breaker.status, "open");
});
