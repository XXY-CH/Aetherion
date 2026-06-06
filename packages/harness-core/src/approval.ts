import type { PolicyDecision, ToolRequest } from "./policy.ts";

export type ApprovalCard = {
  id: string;
  tool_request_id: string;
  risk_level: "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
  target: string;
  expected_effect: string;
  scope: {
    actions: string[];
    resources: string[];
    egress: string[];
    ttl_seconds: number;
  };
  choices: string[];
};

export function createApprovalCard(request: ToolRequest, decision: PolicyDecision): ApprovalCard {
  return {
    id: `approval_${request.run_id}_${request.operation.verb}`,
    tool_request_id: request.id,
    risk_level: decision.risk_level,
    target: request.operation.target.uri,
    expected_effect: request.operation.expected_effect ?? "Execute requested operation",
    scope: {
      actions: [request.operation.verb],
      resources: [request.operation.target.uri.replace("file://", "")],
      egress: [request.risk_inputs.data_egress_destination],
      ttl_seconds: 300
    },
    choices: ["approve_once", "deny"]
  };
}
