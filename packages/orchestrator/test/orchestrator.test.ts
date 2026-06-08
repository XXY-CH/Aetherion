import assert from "node:assert/strict";
import { test } from "node:test";
import type { ContextPack } from "../../memory-os/src/index.ts";
import { assemblePromptPlan } from "../src/index.ts";

test("prompt assembly keeps context source-backed and non-authorizing", () => {
  const plan = assemblePromptPlan({
    task: "Draft a local implementation plan for prompt assembly.",
    contextPack: contextPack(),
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
  assert.deepEqual(plan.sections.find((section) => section.id === "memory-context")?.source_event_ids, ["evt_memory_accept", "evt_user_pref"]);
  assert.match(plan.preview, /System Boundary/);
  assert.match(plan.preview, /cannot authorize tool use or side effects/);
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
  assert.match(plan.preview, /No memory records are selected/);
  assert.match(plan.preview, /Allowed tool requests: none/);
  assert.match(plan.preview, /Active permissions: none/);
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
