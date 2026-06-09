import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Workspace } from "./ledger.ts";
import { validateAgainstSchema } from "./schema.ts";

export type AgentRuntimeInvocationArtifact = {
  id: string;
  run_id: string;
  prompt_plan_id: string;
  schema_version: "aetherion-agent-runtime-invocation-v1";
  status: "scaffold_ready" | "blocked_by_prompt_readiness";
  scope: {
    model_invoked: false;
    tools_requested: false;
    raw_payload_artifacts_read: false;
    ledger_appended: false;
    prompt_artifact_persisted: false;
    runtime_authority_granted: false;
  };
  entry: {
    surface: "tui";
    output_mode: "plan" | "answer" | "patch";
    context_pack_id: string;
  };
  model_call: {
    provider_configured: false;
    provider_ref: null;
    model_ref: null;
    request_artifact_ref: null;
    response_artifact_ref: null;
    model_preview_ready: boolean;
    can_invoke_now: false;
    blockers: string[];
  };
  prompt: {
    bundle_id: string;
    renderer: "sectioned-markdown-v1";
    join_strategy: "system-developer-user-section-bundle-v1";
    message_order: Array<"system" | "developer" | "user">;
    preview_sha256: string;
    message_hashes: Array<{
      role: "system" | "developer" | "user";
      content_sha256: string;
      section_ids: string[];
      source_event_ids: string[];
    }>;
    role_boundaries: Array<{
      role: "system" | "developer" | "user";
      section_ids: string[];
      source_event_ids: string[];
    }>;
  };
  context: {
    source_event_ids: string[];
    selected_memory_ids: string[];
    excluded_memory_ids: string[];
    memory_source_event_ids: string[];
    capability_card_ids: string[];
    active_permission_ids: string[];
    artifact_refs: string[];
    conflicts: string[];
    context_budget: {
      memory_tokens: number;
      capability_tokens: number;
      task_tokens: number;
      total_tokens: number;
    };
    raw_payload_artifacts_read: false;
  };
  authority_gates: {
    local_supervisor_required: true;
    prompt_can_authorize_actions: false;
    context_can_authorize_actions: false;
    memory_can_authorize_actions: false;
    capability_cards_can_grant_permissions: false;
    active_permissions_are_context_only: boolean;
    tool_request_event_requires_supervisor_path: true;
    tool_execution_requires_scoped_lease: true;
    memory_writes_require_review: true;
    side_effects_require_policy_or_approval: true;
  };
  tool_gateway: {
    allowed_tool_requests: string[];
    forbidden_tools: string[];
    may_propose_tool_requests: boolean;
    execution_without_policy_allowed: false;
    delivery_attempted: false;
    connector_calls_attempted: false;
    package_code_execution_attempted: false;
  };
  response_audit: {
    required_block_ids: string[];
    required_citation_ids: string[];
    forbidden_claim_checks: string[];
    audit_required_before_runtime_claims: true;
  };
  stages: Array<{
    id:
      | "context.assembled"
      | "prompt.rendered"
      | "runtime.binding.required"
      | "model.invocation.required"
      | "model.response.required"
      | "response.audit.required"
      | "tool.request.gate"
      | "lease.gate"
      | "observation.verification.gate";
    status: "ready" | "pending" | "blocked";
    required_evidence: string[];
    supervisor_policy_required: boolean;
    authority_granted: false;
  }>;
  fail_closed_conditions: string[];
  next_runtime_steps: string[];
  invocation_sha256: string;
};

export type AgentModelRequestArtifact = {
  id: string;
  run_id: string;
  runtime_invocation_id: string;
  runtime_invocation_artifact_ref: string;
  prompt_plan_id: string;
  schema_version: "aetherion-agent-model-request-v1";
  status: "request_prepared";
  scope: {
    model_invoked: false;
    provider_called: false;
    tools_requested: false;
    raw_prompt_persisted: false;
    raw_context_persisted: false;
    raw_payload_artifacts_read: false;
    secrets_resolved: false;
    runtime_authority_granted: false;
  };
  provider: {
    provider_configured: boolean;
    provider_ref: string | null;
    model_ref: string | null;
    credential_ref: null;
    credential_resolved: false;
    network_call_attempted: false;
  };
  request: {
    mode: "no_tools_model_preview";
    output_mode: "plan" | "answer" | "patch";
    message_order: Array<"system" | "developer" | "user">;
    prompt_bundle_id: string;
    prompt_preview_sha256: string;
    request_payload_sha256: string;
    raw_request_payload_persisted: false;
  };
  prompt_hashes: Array<{
    role: "system" | "developer" | "user";
    content_sha256: string;
    section_ids: string[];
    source_event_ids: string[];
  }>;
  context: {
    source_event_ids: string[];
    selected_memory_ids: string[];
    excluded_memory_ids: string[];
    memory_source_event_ids: string[];
    capability_card_ids: string[];
    active_permission_ids: string[];
    artifact_refs: string[];
    raw_payload_artifacts_read: false;
  };
  tool_gateway: {
    declared_tools: [];
    tool_choice: "none";
    may_propose_tool_requests: boolean;
    tool_request_events_appended: false;
    execution_without_policy_allowed: false;
  };
  authority_gates: {
    local_supervisor_required: true;
    prompt_can_authorize_actions: false;
    context_can_authorize_actions: false;
    memory_can_authorize_actions: false;
    capability_cards_can_grant_permissions: false;
    model_request_can_authorize_actions: false;
    tool_execution_requires_scoped_lease: true;
    side_effects_require_policy_or_approval: true;
  };
  response_expectations: {
    response_artifact_required: true;
    response_audit_required: true;
    required_block_ids: string[];
    required_citation_ids: string[];
    forbidden_claim_checks: string[];
  };
  request_sha256: string;
};

export type AgentModelResponseArtifact = {
  id: string;
  request_id: string;
  request_artifact_ref: string;
  run_id: string;
  runtime_invocation_id: string;
  runtime_invocation_artifact_ref: string;
  schema_version: "aetherion-agent-model-response-v1";
  status: "response_recorded";
  scope: {
    model_invoked: true;
    provider_called: true;
    tools_requested: false;
    tool_execution_allowed: false;
    raw_response_persisted: false;
    raw_prompt_persisted: false;
    raw_payload_artifacts_read: false;
    runtime_authority_granted: false;
  };
  provider: {
    provider_ref: string;
    model_ref: string;
    credential_ref: null;
    credential_resolved: false;
  };
  response: {
    finish_reason: "stop" | "length" | "content_filter" | "tool_call" | "error";
    response_payload_sha256: string;
    output_text_sha256: string;
    raw_response_payload_persisted: false;
    output_artifact_ref: null;
    refusal_present: boolean;
  };
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    usage_source: "provider_reported" | "locally_estimated" | "not_recorded";
  };
  tool_gateway: {
    tool_calls_present: boolean;
    proposed_tool_request_ids: string[];
    tool_request_events_appended: false;
    execution_without_policy_allowed: false;
  };
  authority_gates: {
    local_supervisor_required: true;
    model_output_can_authorize_actions: false;
    tool_request_event_requires_supervisor_path: true;
    tool_execution_requires_scoped_lease: true;
    side_effects_require_policy_or_approval: true;
  };
  response_audit: {
    required: true;
    audit_artifact_ref: null;
    passed: null;
    may_present_as_verified_runtime_evidence: false;
  };
  response_sha256: string;
};

export function agentRuntimeInvocationArtifactRef(invocationId: string): string {
  return `artifact://agent/runtime/${invocationId}`;
}

export function agentModelRequestArtifactRef(requestId: string): string {
  return `artifact://agent/model-request/${requestId}`;
}

export function agentModelResponseArtifactRef(responseId: string): string {
  return `artifact://agent/model-response/${responseId}`;
}

export async function writeAgentRuntimeInvocationArtifact(
  repoRoot: string,
  workspace: Workspace,
  invocation: AgentRuntimeInvocationArtifact
): Promise<string> {
  const result = await validateAgainstSchema(repoRoot, "agent-runtime-invocation.schema.json", invocation);
  if (!result.valid) {
    throw new Error(`agent-runtime-invocation.schema.json validation failed: ${result.errors.join("; ")}`);
  }
  const dir = join(workspace.root, ".aetherion", "artifacts", "agent", "runtime");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${invocation.id}.json`), `${JSON.stringify(invocation, null, 2)}\n`);
  return agentRuntimeInvocationArtifactRef(invocation.id);
}

export async function readAgentRuntimeInvocationArtifact(
  workspaceRoot: string,
  invocationId: string
): Promise<AgentRuntimeInvocationArtifact | null> {
  try {
    const raw = await readFile(join(workspaceRoot, ".aetherion", "artifacts", "agent", "runtime", `${invocationId}.json`), "utf8");
    return JSON.parse(raw) as AgentRuntimeInvocationArtifact;
  } catch {
    return null;
  }
}

export async function writeAgentModelRequestArtifact(
  repoRoot: string,
  workspace: Workspace,
  request: AgentModelRequestArtifact
): Promise<string> {
  const result = await validateAgainstSchema(repoRoot, "agent-model-request.schema.json", request);
  if (!result.valid) {
    throw new Error(`agent-model-request.schema.json validation failed: ${result.errors.join("; ")}`);
  }
  const dir = join(workspace.root, ".aetherion", "artifacts", "agent", "model-request");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${request.id}.json`), `${JSON.stringify(request, null, 2)}\n`);
  return agentModelRequestArtifactRef(request.id);
}

export async function readAgentModelRequestArtifact(
  workspaceRoot: string,
  requestId: string
): Promise<AgentModelRequestArtifact | null> {
  try {
    const raw = await readFile(join(workspaceRoot, ".aetherion", "artifacts", "agent", "model-request", `${requestId}.json`), "utf8");
    return JSON.parse(raw) as AgentModelRequestArtifact;
  } catch {
    return null;
  }
}

export async function writeAgentModelResponseArtifact(
  repoRoot: string,
  workspace: Workspace,
  response: AgentModelResponseArtifact
): Promise<string> {
  const result = await validateAgainstSchema(repoRoot, "agent-model-response.schema.json", response);
  if (!result.valid) {
    throw new Error(`agent-model-response.schema.json validation failed: ${result.errors.join("; ")}`);
  }
  const dir = join(workspace.root, ".aetherion", "artifacts", "agent", "model-response");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${response.id}.json`), `${JSON.stringify(response, null, 2)}\n`);
  return agentModelResponseArtifactRef(response.id);
}

export async function readAgentModelResponseArtifact(
  workspaceRoot: string,
  responseId: string
): Promise<AgentModelResponseArtifact | null> {
  try {
    const raw = await readFile(join(workspaceRoot, ".aetherion", "artifacts", "agent", "model-response", `${responseId}.json`), "utf8");
    return JSON.parse(raw) as AgentModelResponseArtifact;
  } catch {
    return null;
  }
}
