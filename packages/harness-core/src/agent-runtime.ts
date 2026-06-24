import { createHash } from "node:crypto";
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
    tools_requested: boolean;
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
    mode: "no_tools_model_preview" | "tool_use_agent_loop";
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
    declared_tools: Array<{
      name: string;
      description: string;
      verb: "read" | "write" | "exec" | "fetch";
      parameters?: Record<string, unknown>;
    }>;
    tool_choice: "none" | "auto";
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
    tools_requested: boolean;
    tool_execution_allowed: boolean;
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

export type AgentResponseAuditArtifact = {
  id: string;
  response_id: string;
  response_artifact_ref: string;
  request_id: string;
  request_artifact_ref: string;
  run_id: string;
  runtime_invocation_id: string;
  runtime_invocation_artifact_ref: string;
  schema_version: "aetherion-agent-response-audit-v1";
  status: "pass" | "needs_revision";
  scope: {
    audit_invoked_model: false;
    audit_requested_tools: false;
    audit_read_raw_payload_artifacts: false;
    raw_response_persisted: false;
    raw_prompt_persisted: false;
    runtime_authority_granted: false;
  };
  response: {
    output_text_sha256: string;
    response_payload_sha256: string;
    response_sha256: string;
    raw_output_persisted: false;
  };
  checks: {
    required_block_ids: string[];
    present_block_ids: string[];
    missing_block_ids: string[];
    required_citation_ids: string[];
    cited_source_event_ids: string[];
    missing_citation_ids: string[];
    unknown_source_event_ids: string[];
    forbidden_claims_detected: string[];
    findings: Array<{
      id: string;
      severity: "error" | "warning";
      message: string;
    }>;
    next_steps: string[];
  };
  authority_gates: {
    local_supervisor_required: true;
    audit_can_authorize_actions: false;
    model_output_can_authorize_actions: false;
    audit_pass_is_runtime_verification: false;
    tool_execution_requires_scoped_lease: true;
    side_effects_require_policy_or_approval: true;
  };
  audit_sha256: string;
};

export type AgentToolRequestProposalArtifact = {
  id: string;
  run_id: string;
  runtime_invocation_id: string;
  runtime_invocation_artifact_ref: string;
  request_id: string;
  request_artifact_ref: string;
  response_id: string;
  response_artifact_ref: string;
  response_audit_id: string;
  response_audit_artifact_ref: string;
  schema_version: "aetherion-agent-tool-request-proposal-v1";
  status: "proposal_recorded";
  scope: {
    proposal_only: true;
    tool_requested: false;
    policy_decided: false;
    lease_issued: false;
    tool_executed: false;
    action_recorded: false;
    observation_recorded: false;
    verification_recorded: false;
    raw_response_persisted: false;
    raw_prompt_persisted: false;
    raw_payload_artifacts_read: false;
    runtime_authority_granted: false;
  };
  source_evidence: {
    required_response_audit_status: "pass";
    response_audit_evidence_status: "matched";
    runtime_bound_event_id: string;
    model_requested_event_id: string;
    model_responded_event_id: string;
    response_audit_recorded_event_id: string;
    source_event_ids: string[];
  };
  proposal: {
    kind: "tool_request_preview";
    requested_by: "operator_restatement";
    intent: string;
    operation: {
      verb: "read";
      target: {
        kind: "file";
        uri: string;
        label?: string;
      };
      expected_effect?: string;
    };
    risk_inputs: {
      action_type: "read";
      target_resource: "workspace_file";
      data_sensitivity: "private";
      side_effect: "none";
      reversibility: "high";
      audience: "local_user";
      credential_scope: "none";
      runtime_boundary: "local_workspace";
      user_intent_strength: "explicit";
      taint_chain: Array<"user" | "llm_output">;
      target_confidence: number;
      blast_radius: "single_file";
      data_egress_destination: "local_response";
    };
  };
  authority_gates: {
    local_supervisor_required: true;
    proposal_can_authorize_actions: false;
    model_output_can_authorize_actions: false;
    response_audit_can_authorize_actions: false;
    requires_tool_policy_proxy: true;
    requires_fresh_policy_decision: true;
    requires_scoped_lease: true;
    side_effects_require_policy_or_approval: true;
  };
  proposal_sha256: string;
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

export function agentResponseAuditArtifactRef(auditId: string): string {
  return `artifact://agent/response-audit/${auditId}`;
}

export function agentToolRequestProposalArtifactRef(proposalId: string): string {
  return `artifact://agent/tool-request-proposal/${proposalId}`;
}

export function createAgentModelRequestArtifact(
  invocation: AgentRuntimeInvocationArtifact,
  requestId: string
): AgentModelRequestArtifact {
  const payloadFingerprint = {
    mode: "no_tools_model_preview",
    output_mode: invocation.entry.output_mode,
    message_order: invocation.prompt.message_order,
    prompt_bundle_id: invocation.prompt.bundle_id,
    prompt_preview_sha256: invocation.prompt.preview_sha256,
    prompt_hashes: invocation.prompt.message_hashes,
    context: {
      source_event_ids: invocation.context.source_event_ids,
      selected_memory_ids: invocation.context.selected_memory_ids,
      excluded_memory_ids: invocation.context.excluded_memory_ids,
      memory_source_event_ids: invocation.context.memory_source_event_ids,
      capability_card_ids: invocation.context.capability_card_ids,
      active_permission_ids: invocation.context.active_permission_ids,
      artifact_refs: invocation.context.artifact_refs
    },
    tools: {
      declared_tools: [],
      tool_choice: "none"
    }
  };
  const withoutHash: Omit<AgentModelRequestArtifact, "request_sha256"> = {
    id: requestId,
    run_id: invocation.run_id,
    runtime_invocation_id: invocation.id,
    runtime_invocation_artifact_ref: agentRuntimeInvocationArtifactRef(invocation.id),
    prompt_plan_id: invocation.prompt_plan_id,
    schema_version: "aetherion-agent-model-request-v1",
    status: "request_prepared",
    scope: {
      model_invoked: false,
      provider_called: false,
      tools_requested: false,
      raw_prompt_persisted: false,
      raw_context_persisted: false,
      raw_payload_artifacts_read: false,
      secrets_resolved: false,
      runtime_authority_granted: false
    },
    provider: {
      provider_configured: false,
      provider_ref: null,
      model_ref: null,
      credential_ref: null,
      credential_resolved: false,
      network_call_attempted: false
    },
    request: {
      mode: "no_tools_model_preview",
      output_mode: invocation.entry.output_mode,
      message_order: [...invocation.prompt.message_order],
      prompt_bundle_id: invocation.prompt.bundle_id,
      prompt_preview_sha256: invocation.prompt.preview_sha256,
      request_payload_sha256: sha256(stableStringify(payloadFingerprint)),
      raw_request_payload_persisted: false
    },
    prompt_hashes: invocation.prompt.message_hashes.map((message) => ({
      role: message.role,
      content_sha256: message.content_sha256,
      section_ids: [...message.section_ids],
      source_event_ids: [...message.source_event_ids]
    })),
    context: {
      source_event_ids: [...invocation.context.source_event_ids],
      selected_memory_ids: [...invocation.context.selected_memory_ids],
      excluded_memory_ids: [...invocation.context.excluded_memory_ids],
      memory_source_event_ids: [...invocation.context.memory_source_event_ids],
      capability_card_ids: [...invocation.context.capability_card_ids],
      active_permission_ids: [...invocation.context.active_permission_ids],
      artifact_refs: [...invocation.context.artifact_refs],
      raw_payload_artifacts_read: false
    },
    tool_gateway: {
      declared_tools: [],
      tool_choice: "none",
      may_propose_tool_requests: invocation.tool_gateway.may_propose_tool_requests,
      tool_request_events_appended: false,
      execution_without_policy_allowed: false
    },
    authority_gates: {
      local_supervisor_required: true,
      prompt_can_authorize_actions: false,
      context_can_authorize_actions: false,
      memory_can_authorize_actions: false,
      capability_cards_can_grant_permissions: false,
      model_request_can_authorize_actions: false,
      tool_execution_requires_scoped_lease: true,
      side_effects_require_policy_or_approval: true
    },
    response_expectations: {
      response_artifact_required: true,
      response_audit_required: true,
      required_block_ids: [...invocation.response_audit.required_block_ids],
      required_citation_ids: [...invocation.response_audit.required_citation_ids],
      forbidden_claim_checks: [...invocation.response_audit.forbidden_claim_checks]
    }
  };
  return {
    ...withoutHash,
    request_sha256: sha256(stableStringify(withoutHash))
  };
}

export type ToolModeRequestInput = {
  invocation: AgentRuntimeInvocationArtifact;
  requestId: string;
  declaredTools: Array<{
    name: string;
    description: string;
    verb: "read" | "write" | "exec" | "fetch";
    parameters?: Record<string, unknown>;
  }>;
};

// Builds a model request artifact that declares tools and sets tool_choice to
// "auto", enabling the agent loop. Every authority gate is identical to the
// no-tools request: model output still cannot authorize actions, tool execution
// still requires a scoped lease, and side effects still require policy or
// approval. Declaring a tool to the model does not grant it permission to run.
export function createToolModeModelRequestArtifact(input: ToolModeRequestInput): AgentModelRequestArtifact {
  const { invocation, requestId, declaredTools } = input;
  const payloadFingerprint = {
    mode: "tool_use_agent_loop",
    output_mode: invocation.entry.output_mode,
    message_order: invocation.prompt.message_order,
    prompt_bundle_id: invocation.prompt.bundle_id,
    prompt_preview_sha256: invocation.prompt.preview_sha256,
    prompt_hashes: invocation.prompt.message_hashes,
    context: {
      source_event_ids: invocation.context.source_event_ids,
      selected_memory_ids: invocation.context.selected_memory_ids,
      excluded_memory_ids: invocation.context.excluded_memory_ids,
      memory_source_event_ids: invocation.context.memory_source_event_ids,
      capability_card_ids: invocation.context.capability_card_ids,
      active_permission_ids: invocation.context.active_permission_ids,
      artifact_refs: invocation.context.artifact_refs
    },
    tools: {
      declared_tools: declaredTools,
      tool_choice: "auto"
    }
  };
  const withoutHash: Omit<AgentModelRequestArtifact, "request_sha256"> = {
    id: requestId,
    run_id: invocation.run_id,
    runtime_invocation_id: invocation.id,
    runtime_invocation_artifact_ref: agentRuntimeInvocationArtifactRef(invocation.id),
    prompt_plan_id: invocation.prompt_plan_id,
    schema_version: "aetherion-agent-model-request-v1",
    status: "request_prepared",
    scope: {
      model_invoked: false,
      provider_called: false,
      tools_requested: true,
      raw_prompt_persisted: false,
      raw_context_persisted: false,
      raw_payload_artifacts_read: false,
      secrets_resolved: false,
      runtime_authority_granted: false
    },
    provider: {
      provider_configured: false,
      provider_ref: null,
      model_ref: null,
      credential_ref: null,
      credential_resolved: false,
      network_call_attempted: false
    },
    request: {
      mode: "tool_use_agent_loop",
      output_mode: invocation.entry.output_mode,
      message_order: [...invocation.prompt.message_order],
      prompt_bundle_id: invocation.prompt.bundle_id,
      prompt_preview_sha256: invocation.prompt.preview_sha256,
      request_payload_sha256: sha256(stableStringify(payloadFingerprint)),
      raw_request_payload_persisted: false
    },
    prompt_hashes: invocation.prompt.message_hashes.map((message) => ({
      role: message.role,
      content_sha256: message.content_sha256,
      section_ids: [...message.section_ids],
      source_event_ids: [...message.source_event_ids]
    })),
    context: {
      source_event_ids: [...invocation.context.source_event_ids],
      selected_memory_ids: [...invocation.context.selected_memory_ids],
      excluded_memory_ids: [...invocation.context.excluded_memory_ids],
      memory_source_event_ids: [...invocation.context.memory_source_event_ids],
      capability_card_ids: [...invocation.context.capability_card_ids],
      active_permission_ids: [...invocation.context.active_permission_ids],
      artifact_refs: [...invocation.context.artifact_refs],
      raw_payload_artifacts_read: false
    },
    tool_gateway: {
      declared_tools: declaredTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        verb: tool.verb,
        ...(tool.parameters ? { parameters: tool.parameters } : {})
      })),
      tool_choice: "auto",
      may_propose_tool_requests: invocation.tool_gateway.may_propose_tool_requests,
      tool_request_events_appended: false,
      execution_without_policy_allowed: false
    },
    authority_gates: {
      local_supervisor_required: true,
      prompt_can_authorize_actions: false,
      context_can_authorize_actions: false,
      memory_can_authorize_actions: false,
      capability_cards_can_grant_permissions: false,
      model_request_can_authorize_actions: false,
      tool_execution_requires_scoped_lease: true,
      side_effects_require_policy_or_approval: true
    },
    response_expectations: {
      response_artifact_required: true,
      response_audit_required: true,
      required_block_ids: [...invocation.response_audit.required_block_ids],
      required_citation_ids: [...invocation.response_audit.required_citation_ids],
      forbidden_claim_checks: [...invocation.response_audit.forbidden_claim_checks]
    }
  };
  return {
    ...withoutHash,
    request_sha256: sha256(stableStringify(withoutHash))
  };
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

export type AgentModelResponseInput = {
  request: AgentModelRequestArtifact;
  responseId: string;
  provider_ref: string;
  model_ref: string;
  // Hashes are computed by the caller from in-memory text/payload. Raw text is
  // never passed here so it cannot leak into a persisted artifact.
  output_text_sha256: string;
  response_payload_sha256: string;
  finish_reason: AgentModelResponseArtifact["response"]["finish_reason"];
  refusal_present: boolean;
  tool_calls_present: boolean;
  usage: AgentModelResponseArtifact["usage"];
  // Tool-loop provenance. Default to false so the existing no-tools callers
  // are unchanged. tool_execution_allowed is true only when a tool actually ran
  // under a scoped lease during the turn that produced this response.
  tools_requested?: boolean;
  tool_execution_allowed?: boolean;
};

// Builds the durable evidence that a model was actually invoked. Per
// docs/13-schema-runtime-governance.md the artifact records hashes and usage
// only: no raw prompt/response payload, no resolved credential, no claim that
// the response audit passed, and no runtime authority.
export function createAgentModelResponseArtifact(input: AgentModelResponseInput): AgentModelResponseArtifact {
  const withoutHash: Omit<AgentModelResponseArtifact, "response_sha256"> = {
    id: input.responseId,
    request_id: input.request.id,
    request_artifact_ref: agentModelRequestArtifactRef(input.request.id),
    run_id: input.request.run_id,
    runtime_invocation_id: input.request.runtime_invocation_id,
    runtime_invocation_artifact_ref: agentRuntimeInvocationArtifactRef(input.request.runtime_invocation_id),
    schema_version: "aetherion-agent-model-response-v1",
    status: "response_recorded",
    scope: {
      model_invoked: true,
      provider_called: true,
      tools_requested: input.tools_requested ?? false,
      tool_execution_allowed: input.tool_execution_allowed ?? false,
      raw_response_persisted: false,
      raw_prompt_persisted: false,
      raw_payload_artifacts_read: false,
      runtime_authority_granted: false
    },
    provider: {
      provider_ref: input.provider_ref,
      model_ref: input.model_ref,
      credential_ref: null,
      credential_resolved: false
    },
    response: {
      finish_reason: input.finish_reason,
      response_payload_sha256: input.response_payload_sha256,
      output_text_sha256: input.output_text_sha256,
      raw_response_payload_persisted: false,
      output_artifact_ref: null,
      refusal_present: input.refusal_present
    },
    usage: {
      input_tokens: input.usage.input_tokens,
      output_tokens: input.usage.output_tokens,
      total_tokens: input.usage.total_tokens,
      usage_source: input.usage.usage_source
    },
    tool_gateway: {
      tool_calls_present: input.tool_calls_present,
      proposed_tool_request_ids: [],
      tool_request_events_appended: false,
      execution_without_policy_allowed: false
    },
    authority_gates: {
      local_supervisor_required: true,
      model_output_can_authorize_actions: false,
      tool_request_event_requires_supervisor_path: true,
      tool_execution_requires_scoped_lease: true,
      side_effects_require_policy_or_approval: true
    },
    response_audit: {
      required: true,
      audit_artifact_ref: null,
      passed: null,
      may_present_as_verified_runtime_evidence: false
    }
  };
  return {
    ...withoutHash,
    response_sha256: sha256(stableStringify(withoutHash))
  };
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

export type AgentResponseAuditInput = {
  response: AgentModelResponseArtifact;
  auditId: string;
  status: AgentResponseAuditArtifact["status"];
  required_block_ids: string[];
  present_block_ids: string[];
  missing_block_ids: string[];
  required_citation_ids: string[];
  cited_source_event_ids: string[];
  missing_citation_ids: string[];
  unknown_source_event_ids: string[];
  forbidden_claims_detected: string[];
  findings: AgentResponseAuditArtifact["checks"]["findings"];
  next_steps: string[];
};

export function createAgentResponseAuditArtifact(input: AgentResponseAuditInput): AgentResponseAuditArtifact {
  const withoutHash: Omit<AgentResponseAuditArtifact, "audit_sha256"> = {
    id: input.auditId,
    response_id: input.response.id,
    response_artifact_ref: agentModelResponseArtifactRef(input.response.id),
    request_id: input.response.request_id,
    request_artifact_ref: input.response.request_artifact_ref,
    run_id: input.response.run_id,
    runtime_invocation_id: input.response.runtime_invocation_id,
    runtime_invocation_artifact_ref: input.response.runtime_invocation_artifact_ref,
    schema_version: "aetherion-agent-response-audit-v1",
    status: input.status,
    scope: {
      audit_invoked_model: false,
      audit_requested_tools: false,
      audit_read_raw_payload_artifacts: false,
      raw_response_persisted: false,
      raw_prompt_persisted: false,
      runtime_authority_granted: false
    },
    response: {
      output_text_sha256: input.response.response.output_text_sha256,
      response_payload_sha256: input.response.response.response_payload_sha256,
      response_sha256: input.response.response_sha256,
      raw_output_persisted: false
    },
    checks: {
      required_block_ids: [...input.required_block_ids],
      present_block_ids: [...input.present_block_ids],
      missing_block_ids: [...input.missing_block_ids],
      required_citation_ids: [...input.required_citation_ids],
      cited_source_event_ids: [...input.cited_source_event_ids],
      missing_citation_ids: [...input.missing_citation_ids],
      unknown_source_event_ids: [...input.unknown_source_event_ids],
      forbidden_claims_detected: [...input.forbidden_claims_detected],
      findings: input.findings.map((finding) => ({
        id: finding.id,
        severity: finding.severity,
        message: finding.message
      })),
      next_steps: [...input.next_steps]
    },
    authority_gates: {
      local_supervisor_required: true,
      audit_can_authorize_actions: false,
      model_output_can_authorize_actions: false,
      audit_pass_is_runtime_verification: false,
      tool_execution_requires_scoped_lease: true,
      side_effects_require_policy_or_approval: true
    }
  };
  return {
    ...withoutHash,
    audit_sha256: sha256(stableStringify(withoutHash))
  };
}

export async function writeAgentResponseAuditArtifact(
  repoRoot: string,
  workspace: Workspace,
  audit: AgentResponseAuditArtifact
): Promise<string> {
  const result = await validateAgainstSchema(repoRoot, "agent-response-audit.schema.json", audit);
  if (!result.valid) {
    throw new Error(`agent-response-audit.schema.json validation failed: ${result.errors.join("; ")}`);
  }
  const dir = join(workspace.root, ".aetherion", "artifacts", "agent", "response-audit");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${audit.id}.json`), `${JSON.stringify(audit, null, 2)}\n`);
  return agentResponseAuditArtifactRef(audit.id);
}

export async function readAgentResponseAuditArtifact(
  workspaceRoot: string,
  auditId: string
): Promise<AgentResponseAuditArtifact | null> {
  try {
    const raw = await readFile(join(workspaceRoot, ".aetherion", "artifacts", "agent", "response-audit", `${auditId}.json`), "utf8");
    return JSON.parse(raw) as AgentResponseAuditArtifact;
  } catch {
    return null;
  }
}

export type AgentToolRequestProposalInput = {
  responseAudit: AgentResponseAuditArtifact;
  proposalId: string;
  intent: string;
  target_uri: string;
  target_label?: string;
  expected_effect?: string;
  source_evidence: {
    runtime_bound_event_id: string;
    model_requested_event_id: string;
    model_responded_event_id: string;
    response_audit_recorded_event_id: string;
  };
};

export function createAgentToolRequestProposalArtifact(input: AgentToolRequestProposalInput): AgentToolRequestProposalArtifact {
  const sourceEventIds = uniqueStrings([
    input.source_evidence.runtime_bound_event_id,
    input.source_evidence.model_requested_event_id,
    input.source_evidence.model_responded_event_id,
    input.source_evidence.response_audit_recorded_event_id
  ]);
  const withoutHash: Omit<AgentToolRequestProposalArtifact, "proposal_sha256"> = {
    id: input.proposalId,
    run_id: input.responseAudit.run_id,
    runtime_invocation_id: input.responseAudit.runtime_invocation_id,
    runtime_invocation_artifact_ref: input.responseAudit.runtime_invocation_artifact_ref,
    request_id: input.responseAudit.request_id,
    request_artifact_ref: input.responseAudit.request_artifact_ref,
    response_id: input.responseAudit.response_id,
    response_artifact_ref: input.responseAudit.response_artifact_ref,
    response_audit_id: input.responseAudit.id,
    response_audit_artifact_ref: agentResponseAuditArtifactRef(input.responseAudit.id),
    schema_version: "aetherion-agent-tool-request-proposal-v1",
    status: "proposal_recorded",
    scope: {
      proposal_only: true,
      tool_requested: false,
      policy_decided: false,
      lease_issued: false,
      tool_executed: false,
      action_recorded: false,
      observation_recorded: false,
      verification_recorded: false,
      raw_response_persisted: false,
      raw_prompt_persisted: false,
      raw_payload_artifacts_read: false,
      runtime_authority_granted: false
    },
    source_evidence: {
      required_response_audit_status: "pass",
      response_audit_evidence_status: "matched",
      runtime_bound_event_id: input.source_evidence.runtime_bound_event_id,
      model_requested_event_id: input.source_evidence.model_requested_event_id,
      model_responded_event_id: input.source_evidence.model_responded_event_id,
      response_audit_recorded_event_id: input.source_evidence.response_audit_recorded_event_id,
      source_event_ids: sourceEventIds
    },
    proposal: {
      kind: "tool_request_preview",
      requested_by: "operator_restatement",
      intent: input.intent,
      operation: {
        verb: "read",
        target: {
          kind: "file",
          uri: input.target_uri,
          ...(input.target_label ? { label: input.target_label } : {})
        },
        ...(input.expected_effect ? { expected_effect: input.expected_effect } : {})
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
        taint_chain: ["user", "llm_output"],
        target_confidence: 1,
        blast_radius: "single_file",
        data_egress_destination: "local_response"
      }
    },
    authority_gates: {
      local_supervisor_required: true,
      proposal_can_authorize_actions: false,
      model_output_can_authorize_actions: false,
      response_audit_can_authorize_actions: false,
      requires_tool_policy_proxy: true,
      requires_fresh_policy_decision: true,
      requires_scoped_lease: true,
      side_effects_require_policy_or_approval: true
    }
  };
  return {
    ...withoutHash,
    proposal_sha256: sha256(stableStringify(withoutHash))
  };
}

export async function writeAgentToolRequestProposalArtifact(
  repoRoot: string,
  workspace: Workspace,
  proposal: AgentToolRequestProposalArtifact
): Promise<string> {
  const result = await validateAgainstSchema(repoRoot, "agent-tool-request-proposal.schema.json", proposal);
  if (!result.valid) {
    throw new Error(`agent-tool-request-proposal.schema.json validation failed: ${result.errors.join("; ")}`);
  }
  const dir = join(workspace.root, ".aetherion", "artifacts", "agent", "tool-request-proposal");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${proposal.id}.json`), `${JSON.stringify(proposal, null, 2)}\n`);
  return agentToolRequestProposalArtifactRef(proposal.id);
}

export async function readAgentToolRequestProposalArtifact(
  workspaceRoot: string,
  proposalId: string
): Promise<AgentToolRequestProposalArtifact | null> {
  try {
    const raw = await readFile(join(workspaceRoot, ".aetherion", "artifacts", "agent", "tool-request-proposal", `${proposalId}.json`), "utf8");
    return JSON.parse(raw) as AgentToolRequestProposalArtifact;
  } catch {
    return null;
  }
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].filter(Boolean);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, sortJsonValue(record[key])]));
  }
  return value;
}
