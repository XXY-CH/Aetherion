import { relative, resolve } from "node:path";

export type ToolRequest = {
  id: string;
  run_id: string;
  requested_by: string;
  capability_ref?: string;
  intent: string;
  operation: {
    verb: string;
    target: {
      kind: string;
      uri: string;
      label?: string;
    };
    expected_effect?: string;
  };
  risk_inputs: {
    action_type: string;
    target_resource: string;
    data_sensitivity: string;
    side_effect: "none" | "possible" | "definite";
    reversibility: "high" | "medium" | "low";
    audience?: string;
    credential_scope?: string;
    runtime_boundary: string;
    user_intent_strength: "explicit" | "implicit" | "inferred" | "none";
    taint_chain: string[];
    target_confidence: number;
    blast_radius: string;
    data_egress_destination: string;
  };
};

export type PolicyDecision = {
  id: string;
  tool_request_id: string;
  decision: "allow" | "deny" | "ask" | "sandbox_only" | "redact_then_allow";
  risk_level: "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
  reason: string;
  lease?: {
    id: string;
    expires_at: string;
    scope: Record<string, unknown>;
  };
};

export function createFileReadRequest(runId: string, path: string): ToolRequest {
  return {
    id: `toolreq_${runId}_read`,
    run_id: runId,
    requested_by: "agent.local",
    capability_ref: "cap_local_file_read@0.1.0",
    intent: "Read a workspace-scoped file",
    operation: {
      verb: "read",
      target: {
        kind: "file",
        uri: `file://${path}`,
        label: "workspace file"
      },
      expected_effect: "Return file contents without modifying workspace state"
    },
    risk_inputs: {
      action_type: "read",
      target_resource: "workspace_file",
      data_sensitivity: "private",
      side_effect: "none",
      reversibility: "high",
      audience: "local_user",
      credential_scope: "none",
      runtime_boundary: "local_workspace",
      user_intent_strength: "explicit",
      taint_chain: ["user"],
      target_confidence: 0.99,
      blast_radius: "single_file",
      data_egress_destination: "local_response"
    }
  };
}

export function mockPolicyDecision(workspaceRoot: string, request: ToolRequest): PolicyDecision {
  const targetPath = request.operation.target.uri.replace("file://", "");
  const resolvedWorkspace = resolve(workspaceRoot);
  const resolvedTarget = resolve(targetPath);
  const relativeTarget = relative(resolvedWorkspace, resolvedTarget);
  const insideWorkspace = relativeTarget !== "" && !relativeTarget.startsWith("..") && !relativeTarget.startsWith("/");

  if (request.operation.verb !== "read") {
    return deny(request, "Only read is implemented in the seed harness.");
  }
  if (!insideWorkspace) {
    return deny(request, "Target is outside the workspace boundary.");
  }
  if (request.risk_inputs.data_egress_destination !== "local_response") {
    return deny(request, "Seed policy only allows local response egress.");
  }

  return {
    id: `policy_${request.run_id}_allow_read`,
    tool_request_id: request.id,
    decision: "allow",
    risk_level: "L1",
    reason: "Explicit user request for workspace-scoped local file read.",
    lease: {
      id: `lease_${request.run_id}_read`,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      scope: {
        tools: ["filesystem.read"],
        paths: [resolvedTarget],
        egress: ["local_response"]
      }
    }
  };
}

function deny(request: ToolRequest, reason: string): PolicyDecision {
  return {
    id: `policy_${request.run_id}_deny`,
    tool_request_id: request.id,
    decision: "deny",
    risk_level: "L5",
    reason
  };
}
