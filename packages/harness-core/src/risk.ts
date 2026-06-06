import type { ToolRequest } from "./policy.ts";

export type RiskComposition = {
  id: string;
  tool_request_id: string;
  risk_level: "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
  factors: {
    action_type: string;
    target_resource: string;
    side_effect: string;
    reversibility: string;
    data_sensitivity: string;
    egress: string;
  };
  decision_hint: "allow" | "ask" | "deny" | "sandbox_only";
  reason: string;
};

export function composeRisk(request: ToolRequest): RiskComposition {
  const factors = {
    action_type: request.risk_inputs.action_type,
    target_resource: request.risk_inputs.target_resource,
    side_effect: request.risk_inputs.side_effect,
    reversibility: request.risk_inputs.reversibility,
    data_sensitivity: request.risk_inputs.data_sensitivity,
    egress: request.risk_inputs.data_egress_destination
  };

  if (request.risk_inputs.target_confidence < 0.75 || request.risk_inputs.user_intent_strength === "none") {
    return risk(request, "L5", factors, "deny", "Low target confidence or missing user intent blocks execution.");
  }
  if (request.operation.verb === "read" && request.risk_inputs.side_effect === "none" && request.risk_inputs.data_egress_destination === "local_response") {
    return risk(request, "L1", factors, "allow", "Workspace-local read with local-only response is low risk.");
  }
  if (request.operation.verb === "write") {
    return risk(request, "L3", factors, "ask", "Workspace write has a definite local side effect and needs explicit approval.");
  }
  return risk(request, "L5", factors, "deny", "Unsupported action defaults to deny in the seed policy.");
}

function risk(
  request: ToolRequest,
  risk_level: RiskComposition["risk_level"],
  factors: RiskComposition["factors"],
  decision_hint: RiskComposition["decision_hint"],
  reason: string
): RiskComposition {
  return {
    id: `risk_${request.run_id}_${request.operation.verb}`,
    tool_request_id: request.id,
    risk_level,
    factors,
    decision_hint,
    reason
  };
}
