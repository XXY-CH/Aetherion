import { relative, resolve } from "node:path";
import { composeRisk } from "./risk.ts";

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

export function issueExecuteLease(request: ToolRequest, leaseTool: string, leaseScope: Record<string, unknown>): PolicyDecision {
  return {
    id: `policy_${request.id}_allow_execute`,
    tool_request_id: request.id,
    decision: "allow",
    risk_level: "L4",
    reason: request.operation.target.kind === "command"
      ? "Shell exec is allowed under a scoped execute lease."
      : "Agent spawn is allowed under a scoped execute lease.",
    lease: {
      id: `lease_${request.id}`,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      scope: {
        tools: [leaseTool],
        egress: ["local_response"],
        ...leaseScope
      }
    }
  };
}

export type ConsentRecord = {
  id: string;
  user_id: string;
  workspace_id: string;
  tool_request_id: string;
  decision: "approved" | "denied";
  risk_level: "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
  approved_at: string;
  expires_at: string | null;
  scope: Record<string, unknown>;
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

export function createFileWriteRequest(runId: string, path: string): ToolRequest {
  return {
    id: `toolreq_${runId}_write`,
    run_id: runId,
    requested_by: "agent.local",
    capability_ref: "cap_local_file_write@0.1.0",
    intent: "Write a workspace-scoped summary file",
    operation: {
      verb: "write",
      target: {
        kind: "file",
        uri: `file://${path}`,
        label: "workspace summary file"
      },
      expected_effect: "Create or replace a workspace-scoped summary file"
    },
    risk_inputs: {
      action_type: "write",
      target_resource: "workspace_file",
      data_sensitivity: "private",
      side_effect: "definite",
      reversibility: "medium",
      audience: "local_user",
      credential_scope: "none",
      runtime_boundary: "local_workspace",
      user_intent_strength: "explicit",
      taint_chain: ["user"],
      target_confidence: 0.99,
      blast_radius: "single_file",
      data_egress_destination: "local_artifact_store"
    }
  };
}

export function createWorkspaceSearchRequest(runId: string, workspaceRoot: string, pattern: string, globFilter: string): ToolRequest {
  const resolvedWorkspace = resolve(workspaceRoot);
  return {
    id: `toolreq_${runId}_scan_search`,
    run_id: runId,
    requested_by: "agent.local",
    capability_ref: "cap_workspace_search@0.1.0",
    intent: "Search workspace files for matching lines",
    operation: {
      verb: "scan",
      target: {
        kind: "workspace_scan",
        uri: resolvedWorkspace,
        label: "workspace root"
      },
      expected_effect: `Return matching lines for /${pattern}/ ${globFilter ? `filtered by ${globFilter}` : ""}`.trim()
    },
    risk_inputs: {
      action_type: "scan",
      target_resource: "workspace_tree",
      data_sensitivity: "private",
      side_effect: "none",
      reversibility: "high",
      audience: "local_user",
      credential_scope: "none",
      runtime_boundary: "local_workspace",
      user_intent_strength: "explicit",
      taint_chain: ["user"],
      target_confidence: 0.95,
      blast_radius: "workspace_tree",
      data_egress_destination: "local_response"
    }
  };
}

export function createWorkspaceListRequest(runId: string, targetPath: string, dirPath: string, recursive: boolean): ToolRequest {
  const resolvedTarget = resolve(targetPath);
  return {
    id: `toolreq_${runId}_scan_list`,
    run_id: runId,
    requested_by: "agent.local",
    capability_ref: "cap_workspace_list@0.1.0",
    intent: "List workspace files in a directory",
    operation: {
      verb: "scan",
      target: {
        kind: "workspace_list",
        uri: resolvedTarget,
        label: dirPath
      },
      expected_effect: `Return files under ${dirPath}${recursive ? " recursively" : ""}`.trim()
    },
    risk_inputs: {
      action_type: "scan",
      target_resource: "workspace_tree",
      data_sensitivity: "private",
      side_effect: "none",
      reversibility: "high",
      audience: "local_user",
      credential_scope: "none",
      runtime_boundary: "local_workspace",
      user_intent_strength: "explicit",
      taint_chain: ["user"],
      target_confidence: 0.95,
      blast_radius: "workspace_tree",
      data_egress_destination: "local_response"
    }
  };
}

export function createShellExecRequest(runId: string, command: string): ToolRequest {
  return {
    id: `toolreq_${runId}_exec`,
    run_id: runId,
    requested_by: "agent.local",
    capability_ref: "cap_shell_exec@0.1.0",
    intent: "Run an approved shell command in the workspace",
    operation: {
      verb: "execute",
      target: {
        kind: "command",
        uri: `shell://${command}`,
        label: "workspace shell command"
      },
      expected_effect: "Run a shell command and return stdout/stderr/exit status"
    },
    risk_inputs: {
      action_type: "execute",
      target_resource: "workspace_shell",
      data_sensitivity: "private",
      side_effect: "definite",
      reversibility: "low",
      audience: "local_user",
      credential_scope: "workspace_process",
      runtime_boundary: "local_workspace",
      user_intent_strength: "explicit",
      taint_chain: ["user"],
      target_confidence: 0.95,
      blast_radius: "workspace_process",
      data_egress_destination: "local_response"
    }
  };
}

export function createAgentSpawnRequest(runId: string, task: string): ToolRequest {
  return {
    id: `toolreq_${runId}_spawn`,
    run_id: runId,
    requested_by: "agent.local",
    capability_ref: "cap_agent_spawn@0.1.0",
    intent: "Delegate a sub-task to a child agent",
    operation: {
      verb: "execute",
      target: {
        kind: "agent_task",
        uri: `agent://${task}`,
        label: "child agent task"
      },
      expected_effect: "Run a constrained child agent and return its final text"
    },
    risk_inputs: {
      action_type: "execute",
      target_resource: "subagent",
      data_sensitivity: "private",
      side_effect: "definite",
      reversibility: "low",
      audience: "local_user",
      credential_scope: "workspace_process",
      runtime_boundary: "local_workspace",
      user_intent_strength: "explicit",
      taint_chain: ["user"],
      target_confidence: 0.95,
      blast_radius: "single_child_agent",
      data_egress_destination: "local_response"
    }
  };
}

export function createWebFetchRequest(runId: string, url: string): ToolRequest {
  return {
    id: `toolreq_${runId}_fetch`,
    run_id: runId,
    requested_by: "agent.local",
    capability_ref: "cap_web_fetch@0.1.0",
    intent: "Read a policy-approved URL",
    operation: {
      verb: "fetch",
      target: {
        kind: "url",
        uri: url,
        label: "approved URL"
      },
      expected_effect: "Return response body without modifying workspace state"
    },
    risk_inputs: {
      action_type: "read",
      target_resource: "network_url",
      data_sensitivity: "public",
      side_effect: "none",
      reversibility: "high",
      audience: "local_user",
      credential_scope: "none",
      runtime_boundary: "local_workspace",
      user_intent_strength: "explicit",
      taint_chain: ["user"],
      target_confidence: 0.95,
      blast_radius: "single_url",
      data_egress_destination: classifyFetchEgress(url)
    }
  };
}

// ── Policy pipeline ──────────────────────────────────────────────────────
// Ordered steps inspired by OpenClaw's tool-policy-pipeline. Steps are created
// by factory functions that close over the workspaceRoot, so boundary checks
// stay pure and testable. Kept to two layers; do not grow without three
// concrete duplicates.

export type PolicyPipelineStep = {
  name: string;
  evaluate: (request: ToolRequest, prior: PolicyDecision | null) => PolicyDecision | null;
};

export function createBoundaryPolicyStep(workspaceRoot: string): PolicyPipelineStep {
  return {
    name: "boundary",
    evaluate(request, _prior) {
      // The seed policy enforces boundary checks on reads, workspace scans,
      // and loopback fetches. Write requests defer to the operation step
      // (which returns ask), and the true workspace containment check for
      // writes runs later in approveWriteWithConsent.
      if (request.operation.verb !== "read" && request.operation.verb !== "fetch" && request.operation.verb !== "scan") {
        return null;
      }
      if (request.operation.verb === "fetch") {
        const fetchTarget = parseFetchTarget(request.operation.target.uri);
        if (!fetchTarget) {
          return deny(request, "Fetch target must be a valid HTTP(S) URL.");
        }
        if (!isLoopbackFetchTarget(fetchTarget) || request.risk_inputs.data_egress_destination !== "loopback_http") {
          return deny(request, "Seed policy only allows loopback fetch targets.");
        }
        return null;
      }
      if (request.operation.verb === "execute") {
        if (request.operation.target.kind === "command") {
          return null;
        }
        if (request.operation.target.kind === "agent_task") {
          return null;
        }
        return deny(request, "Execute requests must target a command or delegated agent task.");
      }
      if (request.operation.verb === "scan") {
        if (request.operation.target.kind !== "workspace_scan" && request.operation.target.kind !== "workspace_list") {
          return deny(request, "Scan requests must target a workspace scan surface.");
        }
        const scanBoundary = workspaceBoundary(workspaceRoot, request.operation.target.uri);
        const resolvedWorkspace = resolve(workspaceRoot);
        const resolvedTarget = resolve(request.operation.target.uri);
        if (!scanBoundary.insideWorkspace && resolvedWorkspace !== resolvedTarget) {
          return deny(request, "Scan target is outside the workspace boundary.");
        }
        if (request.risk_inputs.data_egress_destination !== "local_response") {
          return deny(request, "Seed policy only allows local response egress.");
        }
        return null;
      }
      const boundary = workspaceBoundary(workspaceRoot, request.operation.target.uri.replace("file://", ""));
      if (!boundary.insideWorkspace) {
        return deny(request, "Target is outside the workspace boundary.");
      }
      if (request.risk_inputs.data_egress_destination !== "local_response") {
        return deny(request, "Seed policy only allows local response egress.");
      }
      return null;
    }
  };
}

export function createOperationPolicyStep(_workspaceRoot: string): PolicyPipelineStep {
  return {
    name: "operation",
    evaluate(request, _prior) {
      if (request.operation.verb === "read") {
        return allowRead(request);
      }
      if (request.operation.verb === "fetch") {
        return allowFetch(request);
      }
      if (request.operation.verb === "scan") {
        return allowScan(request);
      }
      if (request.operation.verb === "execute") {
        return ask(request, "Execute requests require explicit approval in the seed harness.", "L4");
      }
      if (request.operation.verb === "write") {
        return ask(request, "Workspace file write requires explicit approval in the seed harness.");
      }
      return deny(request, "Only read and approval-gated write are implemented in the seed harness.");
    }
  };
}

export function createDefaultSeedPolicyPipeline(workspaceRoot: string): PolicyPipelineStep[] {
  return [createBoundaryPolicyStep(workspaceRoot), createOperationPolicyStep(workspaceRoot)];
}

export function runPolicyPipeline(
  workspaceRoot: string,
  request: ToolRequest,
  steps?: PolicyPipelineStep[]
): PolicyDecision {
  const pipeline = steps ?? createDefaultSeedPolicyPipeline(workspaceRoot);
  let prior: PolicyDecision | null = null;
  for (const step of pipeline) {
    const decision = step.evaluate(request, prior);
    if (decision) {
      return decision;
    }
  }
  return deny(request, "No policy step decided for this request.");
}

export function evaluateSeedPolicy(workspaceRoot: string, request: ToolRequest): PolicyDecision {
  return runPolicyPipeline(workspaceRoot, request);
}

function allowRead(request: ToolRequest): PolicyDecision {
  const risk = composeRisk(request);
  const resolvedTarget = request.operation.target.uri.replace("file://", "");
  return {
    id: `policy_${request.run_id}_allow_read`,
    tool_request_id: request.id,
    decision: "allow",
    risk_level: risk.risk_level,
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

function allowFetch(request: ToolRequest): PolicyDecision {
  const risk = composeRisk(request);
  const resolvedTarget = request.operation.target.uri;
  return {
    id: `policy_${request.run_id}_allow_fetch`,
    tool_request_id: request.id,
    decision: "allow",
    risk_level: risk.risk_level,
    reason: "Loopback fetch is allowed under a scoped network lease.",
    lease: {
      id: `lease_${request.run_id}_fetch`,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      scope: {
        tools: ["network.fetch"],
        urls: [resolvedTarget],
        egress: [request.risk_inputs.data_egress_destination]
      }
    }
  };
}

function allowScan(request: ToolRequest): PolicyDecision {
  const risk = composeRisk(request);
  const resolvedTarget = request.operation.target.uri;
  return {
    id: `policy_${request.run_id}_allow_scan`,
    tool_request_id: request.id,
    decision: "allow",
    risk_level: risk.risk_level,
    reason: "Workspace scan is allowed under a scoped scan lease.",
    lease: {
      id: `lease_${request.run_id}_scan`,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      scope: {
        tools: ["workspace.scan"],
        paths: [resolvedTarget],
        egress: [request.risk_inputs.data_egress_destination]
      }
    }
  };
}

export function approveWriteWithConsent(workspaceRoot: string, request: ToolRequest, consent: ConsentRecord): PolicyDecision {
  const targetPath = request.operation.target.uri.replace("file://", "");
  const boundary = workspaceBoundary(workspaceRoot, targetPath);
  if (request.operation.verb !== "write") {
    return deny(request, "Consent approval path only applies to write requests.");
  }
  if (!boundary.insideWorkspace) {
    return deny(request, "Target is outside the workspace boundary.");
  }
  if (consent.tool_request_id !== request.id || consent.decision !== "approved") {
    return deny(request, "Write request lacks matching explicit consent.");
  }
  if (consent.expires_at !== null && Date.parse(consent.expires_at) <= Date.now()) {
    return deny(request, "Write consent has expired.");
  }
  return {
    id: `policy_${request.run_id}_allow_write`,
    tool_request_id: request.id,
    decision: "allow",
    risk_level: "L3",
    reason: "Explicit consent approved a workspace-scoped file write.",
    lease: {
      id: `lease_${request.run_id}_write`,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      scope: {
        tools: ["filesystem.write"],
        actions: ["write"],
        paths: [boundary.resolvedTarget],
        egress: ["local_artifact_store"],
        denied: ["read_home", "read_secrets", "external_send"]
      }
    }
  };
}

function ask(request: ToolRequest, reason: string, riskLevel: PolicyDecision["risk_level"] = "L3"): PolicyDecision {
  return {
    id: `policy_${request.run_id}_ask`,
    tool_request_id: request.id,
    decision: "ask",
    risk_level: riskLevel,
    reason
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

function workspaceBoundary(workspaceRoot: string, targetPath: string): {
  resolvedTarget: string;
  insideWorkspace: boolean;
} {
  const resolvedWorkspace = resolve(workspaceRoot);
  const resolvedTarget = resolve(targetPath);
  const relativeTarget = relative(resolvedWorkspace, resolvedTarget);
  return {
    resolvedTarget,
    insideWorkspace: relativeTarget !== "" && !relativeTarget.startsWith("..") && !relativeTarget.startsWith("/")
  };
}

function classifyFetchEgress(url: string): "loopback_http" | "external_http" | "invalid_url" {
  const parsed = parseFetchTarget(url);
  if (!parsed) {
    return "invalid_url";
  }
  return isLoopbackFetchTarget(parsed) ? "loopback_http" : "external_http";
}

function parseFetchTarget(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isLoopbackFetchTarget(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return host === "localhost"
    || host === "::1"
    || host === "[::1]"
    || /^127(?:\.\d{1,3}){3}$/.test(host);
}
