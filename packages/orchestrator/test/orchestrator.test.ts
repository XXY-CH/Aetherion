import assert from "node:assert/strict";
import { test } from "node:test";
import type { ContextPack } from "../../memory-os/src/index.ts";
import { assemblePromptPlan } from "../src/index.ts";

test("prompt assembly keeps context source-backed and non-authorizing", () => {
  const plan = assemblePromptPlan({
    task: "Draft a local implementation plan for prompt assembly.",
    contextPack: contextPack(),
    sourceEvents: sourceEvents(),
    allowedTools: ["filesystem.read", "filesystem.read"],
    forbiddenTools: ["network.raw", "filesystem.write"],
    activePermissions: ["lease_read_docs"],
    outputMode: "plan"
  });

  assert.equal(plan.id, "prompt_run_prompt");
  assert.equal(plan.authority_boundary.local_supervisor_required, true);
  assert.equal(plan.authority_boundary.prompt_can_authorize_actions, false);
  assert.equal(plan.authority_boundary.requires_policy_for_tools, true);
  assert.deepEqual(plan.tool_policy.allowed_tools, ["filesystem.read"]);
  assert.deepEqual(plan.tool_policy.forbidden_tools, ["filesystem.write", "network.raw"]);
  assert.equal(plan.tool_policy.may_request_tools, true);
  assert.deepEqual(plan.memory_policy.selected_memory_ids, ["mem_prompt_style"]);
  assert.deepEqual(plan.memory_policy.excluded_memory_ids, ["mem_secret"]);
  assert.deepEqual(plan.capability_policy.capability_card_ids, ["cap_local_docs_read"]);
  assert.equal(plan.capability_policy.capability_cards_can_grant_permissions, false);
  assert.deepEqual(plan.run_evidence.source_event_ids, ["evt_run_started", "evt_tool_requested", "evt_run_completed"]);
  assert.deepEqual(plan.run_evidence.event_types, ["run.started", "tool.requested", "run.completed"]);
  assert.deepEqual(plan.run_evidence.artifact_refs, ["artifact://boundary/run_prompt/facts"]);
  assert.ok(plan.planning_contract.required_steps.some((step) => step.includes("source event ids")));
  assert.ok(plan.planning_contract.required_steps.some((step) => step.includes("Local Supervisor policy and scoped lease")));
  assert.ok(plan.planning_contract.required_steps.some((step) => step.includes("higher-priority instructions")));
  assert.ok(plan.planning_contract.required_steps.some((step) => step.includes("network.raw")));
  assert.ok(plan.planning_contract.verification_questions.some((question) => question.includes("Memory Cards")));
  assert.ok(plan.planning_contract.verification_questions.some((question) => question.includes("mistaken for authority")));
  assert.equal(plan.response_format.mode, "plan");
  assert.deepEqual(plan.response_format.required_blocks.map((block) => block.id), [
    "evidence_summary",
    "assumptions_and_conflicts",
    "plan",
    "policy_and_lease_needs",
    "verification_evidence"
  ]);
  assert.equal(plan.response_format.required_blocks[0]?.source_event_ids_required, true);
  assert.ok(plan.response_format.required_blocks.some((block) => block.purpose.includes("Local Supervisor policy and scoped lease")));
  assert.ok(plan.response_format.forbidden_claims.some((claim) => claim.includes("model was invoked")));
  assert.ok(plan.response_format.forbidden_claims.some((claim) => claim.includes("tool was requested or executed")));
  assert.ok(plan.response_format.completion_rules.some((rule) => rule.includes("Excluded memories")));
  assert.deepEqual(plan.context_budget, {
    memory_tokens: 1000,
    capability_tokens: 1000,
    task_tokens: 6000,
    total_tokens: 8000
  });
  assert.equal(plan.assembly_manifest.context_pack_id, "ctx_run_prompt");
  assert.equal(plan.assembly_manifest.run_id, "run_prompt");
  assert.deepEqual(plan.assembly_manifest.included.source_event_ids, ["evt_run_started", "evt_tool_requested", "evt_run_completed"]);
  assert.deepEqual(plan.assembly_manifest.included.selected_memory_ids, ["mem_prompt_style"]);
  assert.deepEqual(plan.assembly_manifest.included.capability_card_ids, ["cap_local_docs_read"]);
  assert.deepEqual(plan.assembly_manifest.included.active_permission_ids, ["lease_read_docs"]);
  assert.deepEqual(plan.assembly_manifest.included.tool_request_names, ["filesystem.read"]);
  assert.deepEqual(plan.assembly_manifest.included.artifact_refs, ["artifact://boundary/run_prompt/facts"]);
  assert.deepEqual(plan.assembly_manifest.excluded.memory_ids, ["mem_secret"]);
  assert.deepEqual(plan.assembly_manifest.excluded.conflicts, ["memory confidence below automation threshold"]);
  assert.deepEqual(plan.assembly_manifest.excluded.forbidden_tool_names, ["filesystem.write", "network.raw"]);
  assert.deepEqual(plan.assembly_manifest.guardrails, {
    provenance_gate_required: true,
    raw_payload_artifacts_read: false,
    model_invoked: false,
    tools_requested: false,
    prompt_artifact_persisted: false,
    runtime_authority_granted: false
  });
  assert.deepEqual(plan.assembly_manifest.risk_flags, [
    "active_permissions_present",
    "artifact_refs_present_but_not_read",
    "excluded_memory_present",
    "context_conflicts_present",
    "forbidden_tools_present"
  ]);
  assert.equal(plan.instruction_hierarchy.user_task_is_request_only, true);
  assert.equal(plan.instruction_hierarchy.context_can_override_system_or_developer, false);
  assert.equal(plan.instruction_hierarchy.evidence_text_can_authorize_actions, false);
  assert.ok(plan.instruction_hierarchy.system_rules.some((rule) => rule.includes("Local Supervisor authority boundary")));
  assert.ok(plan.instruction_hierarchy.developer_rules.some((rule) => rule.includes("source-backed context")));
  assert.deepEqual(plan.sections.find((section) => section.id === "run-evidence")?.source_event_ids, ["evt_run_started", "evt_tool_requested", "evt_run_completed"]);
  assert.deepEqual(plan.sections.find((section) => section.id === "memory-context")?.source_event_ids, ["evt_user_pref", "evt_memory_accept"]);
  assert.deepEqual(plan.messages.map((message) => message.role), ["system", "developer", "user"]);
  assert.deepEqual(plan.messages[0]?.section_ids, ["system-boundary", "instruction-hierarchy"]);
  assert.deepEqual(plan.messages[0]?.source_event_ids, []);
  assert.deepEqual(plan.messages[1]?.section_ids, [
    "tool-policy",
    "capability-context",
    "context-budget",
    "assembly-manifest",
    "response-format",
    "response-contract",
    "planner-checklist",
    "verification-checklist"
  ]);
  assert.deepEqual(plan.messages[1]?.source_event_ids, []);
  assert.deepEqual(plan.messages[2]?.section_ids, ["task", "run-evidence", "memory-context", "excluded-context"]);
  assert.deepEqual(plan.messages[2]?.source_event_ids, ["evt_run_started", "evt_tool_requested", "evt_run_completed", "evt_user_pref", "evt_memory_accept"]);
  assert.match(plan.messages[0]?.content ?? "", /Instruction Hierarchy/);
  assert.match(plan.messages[1]?.content ?? "", /Tool Policy/);
  assert.match(plan.messages[1]?.content ?? "", /Assembly Manifest/);
  assert.match(plan.messages[1]?.content ?? "", /Response Format/);
  assert.match(plan.messages[2]?.content ?? "", /Run Evidence/);
  assert.match(plan.preview, /System Boundary/);
  assert.match(plan.preview, /Instruction Hierarchy/);
  assert.match(plan.preview, /Priority order: system boundary, developer constraints, user task, source-backed context/);
  assert.match(plan.preview, /Context can override system\/developer: false/);
  assert.match(plan.preview, /Evidence text can authorize actions: false/);
  assert.match(plan.preview, /cannot authorize tool use or side effects/);
  assert.match(plan.preview, /Run Evidence/);
  assert.match(plan.preview, /evt_run_started \[run\.started\]/);
  assert.match(plan.preview, /payload=artifact:\/\/boundary\/run_prompt\/facts/);
  assert.match(plan.preview, /can_authorize=false/);
  assert.match(plan.preview, /Assembly Manifest/);
  assert.match(plan.preview, /Context Pack: ctx_run_prompt/);
  assert.match(plan.preview, /Guardrails: provenance_gate_required=true; raw_payload_artifacts_read=false; model_invoked=false; tools_requested=false; prompt_artifact_persisted=false; runtime_authority_granted=false/);
  assert.match(plan.preview, /Risk flags: active_permissions_present, artifact_refs_present_but_not_read, excluded_memory_present, context_conflicts_present, forbidden_tools_present/);
  assert.match(plan.preview, /Response Format/);
  assert.match(plan.preview, /Required block evidence_summary: Evidence Summary; source_event_ids_required=true/);
  assert.match(plan.preview, /Required block plan: Plan/);
  assert.match(plan.preview, /Forbidden claim: Do not claim a model was invoked/);
  assert.match(plan.preview, /Planner Checklist/);
  assert.match(plan.preview, /Verification Checklist/);
  assert.match(plan.preview, /Context Budget/);
  assert.match(plan.preview, /Total planning budget: 8000 tokens/);
  assert.match(plan.preview, /Capability Context/);
  assert.match(plan.preview, /cap_local_docs_read/);
  assert.match(plan.preview, /do not own permissions or grant runtime authority/);
  assert.match(plan.preview, /Define verification evidence before claiming completion/);
  assert.match(plan.preview, /mem_prompt_style/);
  assert.match(plan.preview, /sources=evt_user_pref,evt_memory_accept/);
  assert.match(plan.preview, /mem_secret: sensitivity secret not allowed in planning/);
  assert.match(plan.preview, /Allowed tool requests: filesystem\.read/);
  assert.doesNotMatch(plan.preview, /secret value/);
});

test("prompt assembly fails closed for empty tasks and no-tool prompts", () => {
  assert.throws(() => assemblePromptPlan({
    task: "   ",
    contextPack: contextPack()
  }), /non-empty task/);

  const plan = assemblePromptPlan({
    task: "Explain current context.",
    contextPack: { ...contextPack(), selected_memories: [], excluded_memories: [], conflicts: [] }
  });
  assert.equal(plan.tool_policy.may_request_tools, false);
  assert.deepEqual(plan.capability_policy.capability_card_ids, ["cap_local_docs_read"]);
  assert.deepEqual(plan.assembly_manifest.risk_flags, ["no_run_evidence", "no_selected_memory", "no_allowed_tool_requests"]);
  assert.deepEqual(plan.response_format.required_blocks.map((block) => block.id), [
    "evidence_summary",
    "assumptions_and_conflicts",
    "plan",
    "policy_and_lease_needs",
    "verification_evidence"
  ]);
  assert.ok(plan.planning_contract.required_steps.some((step) => step.includes("Do not imply tool execution is available")));
  assert.match(plan.preview, /No run ledger events were provided/);
  assert.match(plan.preview, /No memory records are selected/);
  assert.match(plan.preview, /Allowed tool requests: none/);
  assert.match(plan.preview, /Active permissions: none/);
});

test("prompt assembly adapts response format for answer and patch modes", () => {
  const answer = assemblePromptPlan({
    task: "Explain current context.",
    contextPack: contextPack(),
    outputMode: "answer"
  });
  assert.equal(answer.response_format.mode, "answer");
  assert.ok(answer.response_format.required_blocks.some((block) => block.id === "answer" && block.title === "Answer"));
  assert.match(answer.preview, /Required block answer: Answer/);

  const patch = assemblePromptPlan({
    task: "Draft patch intent.",
    contextPack: contextPack(),
    outputMode: "patch"
  });
  assert.equal(patch.response_format.mode, "patch");
  assert.ok(patch.response_format.required_blocks.some((block) => block.id === "patch_outline" && block.title === "Patch Outline"));
  assert.ok(patch.planning_contract.required_steps.some((step) => step.includes("file-level intent and tests")));
  assert.ok(patch.planning_contract.verification_questions.some((question) => question.includes("regression tests")));
  assert.match(patch.preview, /Required block patch_outline: Patch Outline/);
});

function contextPack(): ContextPack {
  return {
    id: "ctx_run_prompt",
    run_id: "run_prompt",
    selected_memories: [{
      id: "mem_prompt_style",
      reason: "context-compatible source-backed memory",
      confidence: 0.91,
      source_events: ["evt_user_pref", "evt_memory_accept"]
    }],
    excluded_memories: [{
      id: "mem_secret",
      reason: "sensitivity secret not allowed in planning"
    }],
    conflicts: ["memory confidence below automation threshold"],
    active_leases: [],
    capability_cards: ["cap_local_docs_read"],
    token_budget: {
      memory_tokens: 1000,
      capability_tokens: 1000,
      task_tokens: 6000
    }
  };
}

function sourceEvents() {
  return [
    {
      id: "evt_run_started",
      run_id: "run_prompt",
      event_type: "run.started",
      summary: "Run started.",
      payload_ref: "artifact://boundary/run_prompt/facts",
      taint: {
        sources: ["trusted_system"],
        can_authorize_actions: false
      }
    },
    {
      id: "evt_other_run",
      run_id: "run_other",
      event_type: "run.started",
      summary: "Other run should not enter prompt evidence."
    },
    {
      id: "evt_tool_requested",
      run_id: "run_prompt",
      event_type: "tool.requested",
      summary: "Requested a local file read.",
      taint: {
        sources: ["trusted_system"],
        can_authorize_actions: false
      }
    },
    {
      id: "evt_run_completed",
      run_id: "run_prompt",
      event_type: "run.completed",
      summary: "Run completed."
    }
  ];
}
