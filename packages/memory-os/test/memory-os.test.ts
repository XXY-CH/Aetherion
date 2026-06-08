import assert from "node:assert/strict";
import { test } from "node:test";
import type { MemoryCard } from "../src/index.ts";
import { acceptMemoryCandidate, assembleContextPack, blockMemoryContext, buildEpisodicTimeline, createBasicUserModel, createMemoryCandidate, createMemoryDeleteTombstone, deriveMemoryCandidatesFromEvents } from "../src/index.ts";

test("memory candidates require source events and context explains selection", () => {
  assert.throws(() => createMemoryCandidate({
    id: "memcand_bad",
    source_events: [],
    candidate: { type: "preference", subject: "user", content: "No source" },
    confidence: 0.5
  }), /source events/);

  const candidate = createMemoryCandidate({
    id: "memcand_direct",
    source_events: ["evt_style"],
    candidate: { type: "preference", subject: "user", content: "User prefers direct answers." },
    confidence: 0.9,
    blocked_contexts: ["external_send"]
  });
  const memory = acceptMemoryCandidate(candidate);
  const pack = assembleContextPack("run_memory", [memory], "planning");
  assert.equal(pack.selected_memories[0].id, "mem_direct");

  const externalPack = assembleContextPack("run_memory", [memory], "external_send");
  assert.equal(externalPack.excluded_memories[0].reason, "blocked for external_send");

  const tombstone = createMemoryDeleteTombstone(memory, "user_delete_request");
  assert.equal(tombstone.event_type, "memory.deleted");
  assert.equal(tombstone.target_memory_id, "mem_direct");
  assert.deepEqual(tombstone.source_events, ["evt_style"]);
  assert.equal(tombstone.active_memory_removed, true);
  assert.equal(tombstone.history_rewritten, false);

  const deletedPack = assembleContextPack("run_memory", [memory], "planning", [tombstone]);
  assert.equal(deletedPack.selected_memories.length, 0);
  assert.equal(deletedPack.excluded_memories[0].reason, "deleted by memory tombstone");
});

test("memory block updates context boundaries without changing provenance", () => {
  const memory = acceptMemoryCandidate(createMemoryCandidate({
    id: "memcand_block",
    source_events: ["evt_block"],
    candidate: { type: "preference", subject: "user", content: "User wants local-only planning notes." },
    confidence: 0.92
  }));

  const blocked = blockMemoryContext(memory, "external_send");
  assert.deepEqual(blocked.source_events, ["evt_block"]);
  assert.deepEqual(blocked.blocked_contexts, ["external_send"]);

  const pack = assembleContextPack("run_block", [blocked], "external_send");
  assert.equal(pack.selected_memories.length, 0);
  assert.equal(pack.excluded_memories[0].reason, "blocked for external_send");
});

test("context assembly ranks source-backed memories before prompt use", () => {
  const lowerConfidence = memoryCard({
    id: "mem_lower_confidence",
    content: "Lower confidence context.",
    confidence: 0.52,
    source_events: ["evt_low"]
  });
  const higherConfidence = memoryCard({
    id: "mem_higher_confidence",
    content: "Higher confidence context.",
    confidence: 0.91,
    source_events: ["evt_high"]
  });
  const tiedConfidenceMoreEvidence = memoryCard({
    id: "mem_tied_more_evidence",
    content: "Same confidence with more source evidence.",
    confidence: 0.91,
    source_events: ["evt_tied_a", "evt_tied_b"]
  });

  const pack = assembleContextPack("run_ranked_context", [lowerConfidence, higherConfidence, tiedConfidenceMoreEvidence], "planning");

  assert.deepEqual(pack.selected_memories.map((memory) => memory.id), [
    "mem_tied_more_evidence",
    "mem_higher_confidence",
    "mem_lower_confidence"
  ]);
  assert.deepEqual(pack.excluded_memories, []);
});

test("context assembly excludes overflow memories under memory token budget", () => {
  const smallHighConfidence = memoryCard({
    id: "mem_small_high_confidence",
    content: "Short context that should fit the prompt memory budget.",
    confidence: 0.95,
    source_events: ["evt_small"]
  });
  const oversizedMediumConfidence = memoryCard({
    id: "mem_oversized_medium_confidence",
    content: "Large context. ".repeat(380),
    confidence: 0.82,
    source_events: ["evt_large"]
  });
  const smallLowConfidence = memoryCard({
    id: "mem_small_low_confidence",
    content: "Lower priority context that still fits after the oversized memory is skipped.",
    confidence: 0.4,
    source_events: ["evt_low"]
  });

  const pack = assembleContextPack("run_budgeted_context", [oversizedMediumConfidence, smallLowConfidence, smallHighConfidence], "planning");

  assert.deepEqual(pack.selected_memories.map((memory) => memory.id), [
    "mem_small_high_confidence",
    "mem_small_low_confidence"
  ]);
  assert.deepEqual(pack.excluded_memories, [{ id: "mem_oversized_medium_confidence", reason: "memory budget exceeded" }]);
  assert.equal(pack.token_budget.memory_tokens, 1000);
});

test("context assembly applies deletion blocking and sensitivity before budget selection", () => {
  const oversizedBlocked = blockMemoryContext(memoryCard({
    id: "mem_oversized_blocked",
    content: "Blocked context. ".repeat(380),
    confidence: 0.99,
    source_events: ["evt_blocked"]
  }), "planning");
  const oversizedSecret = memoryCard({
    id: "mem_oversized_secret",
    content: "Secret context. ".repeat(380),
    confidence: 0.98,
    sensitivity: "secret",
    source_events: ["evt_secret"]
  });
  const oversizedDeleted = memoryCard({
    id: "mem_oversized_deleted",
    content: "Deleted context. ".repeat(380),
    confidence: 0.97,
    source_events: ["evt_deleted"]
  });

  const pack = assembleContextPack("run_hard_exclusions", [oversizedBlocked, oversizedSecret, oversizedDeleted], "planning", [
    createMemoryDeleteTombstone(oversizedDeleted, "user_delete_request")
  ]);

  assert.deepEqual(pack.selected_memories, []);
  assert.deepEqual(pack.excluded_memories, [
    { id: "mem_oversized_blocked", reason: "blocked for planning" },
    { id: "mem_oversized_secret", reason: "sensitivity secret not allowed in planning" },
    { id: "mem_oversized_deleted", reason: "deleted by memory tombstone" }
  ]);
});

test("context assembly reports selected memory contradictions", () => {
  const localFirst = memoryCard({
    id: "mem_local_first",
    content: "Use local-first execution.",
    confidence: 0.91,
    source_events: ["evt_local"],
    contradicts: ["mem_cloud_first"]
  });
  const cloudFirst = memoryCard({
    id: "mem_cloud_first",
    content: "Use cloud-first execution.",
    confidence: 0.9,
    source_events: ["evt_cloud"]
  });

  const pack = assembleContextPack("run_conflict_selected", [cloudFirst, localFirst], "planning");

  assert.deepEqual(pack.selected_memories.map((memory) => memory.id), ["mem_local_first", "mem_cloud_first"]);
  assert.deepEqual(pack.conflicts, ["selected memory mem_local_first contradicts selected memory mem_cloud_first"]);
});

test("context assembly reports contradictions against excluded and missing memories", () => {
  const selected = memoryCard({
    id: "mem_selected_conflict",
    content: "Use a reviewed local-only plan.",
    confidence: 0.91,
    source_events: ["evt_selected"],
    contradicts: ["mem_blocked_conflict", "mem_missing_conflict"]
  });
  const blocked = blockMemoryContext(memoryCard({
    id: "mem_blocked_conflict",
    content: "Send the plan externally.",
    confidence: 0.89,
    source_events: ["evt_blocked"]
  }), "planning");

  const pack = assembleContextPack("run_conflict_excluded", [blocked, selected], "planning");

  assert.deepEqual(pack.selected_memories.map((memory) => memory.id), ["mem_selected_conflict"]);
  assert.deepEqual(pack.excluded_memories, [{ id: "mem_blocked_conflict", reason: "blocked for planning" }]);
  assert.deepEqual(pack.conflicts, [
    "selected memory mem_selected_conflict contradicts excluded memory mem_blocked_conflict (blocked for planning)",
    "selected memory mem_selected_conflict contradicts missing memory mem_missing_conflict"
  ]);
});

test("memory candidates can be derived from real run trace events", () => {
  const events = [
    {
      id: "evt_run_user",
      run_id: "run_trace_memory",
      event_type: "user.message",
      summary: "Summarize a workspace file."
    },
    {
      id: "evt_run_verification",
      run_id: "run_trace_memory",
      event_type: "verification.recorded",
      summary: "Verification passed for summary file."
    },
    {
      id: "evt_run_completed",
      run_id: "run_trace_memory",
      event_type: "run.completed",
      summary: "Run completed with trace reconstruction available."
    }
  ];
  const candidates = deriveMemoryCandidatesFromEvents(events, "run_trace_memory");

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].id, "memcand_run_trace_memory_episode");
  assert.deepEqual(candidates[0].source_events, ["evt_run_user", "evt_run_verification", "evt_run_completed"]);
  assert.equal(candidates[0].review.status, "pending");
  assert.deepEqual(candidates[0].blocked_contexts, ["external_send"]);

  const memory = acceptMemoryCandidate(candidates[0]);
  const externalPack = assembleContextPack("run_trace_memory", [memory], "external_send");
  assert.equal(externalPack.excluded_memories[0].reason, "blocked for external_send");

  const timeline = buildEpisodicTimeline(events, "run_trace_memory");
  assert.equal(timeline.id, "episode_run_trace_memory");
  assert.equal(timeline.user_intent, "Summarize a workspace file.");
  assert.deepEqual(timeline.source_events, ["evt_run_user", "evt_run_verification", "evt_run_completed"]);
  assert.equal(timeline.final_artifact, "unavailable");
  assert.deepEqual(timeline.regression_cases, []);

  const userModel = createBasicUserModel([memory]);
  assert.deepEqual(userModel.source_memory_ids, ["mem_run_trace_memory_episode"]);
  assert.deepEqual(userModel.source_events, ["evt_run_user", "evt_run_verification", "evt_run_completed"]);
  assert.deepEqual(userModel.communication_style.prefers, []);
  assert.equal(userModel.work_style.decision_pattern, "unknown");
  assert.deepEqual(userModel.automation_policy.auto_execute, []);
});

test("episodic timelines extract failures corrections skill candidates and regression cases", () => {
  const events = [
    {
      id: "evt_intent",
      run_id: "run_timeline_learning",
      event_type: "user.message",
      summary: "Fix a flaky prompt response audit."
    },
    {
      id: "evt_tool_failure",
      run_id: "run_timeline_learning",
      event_type: "tool.result",
      summary: "Tool failed with a timeout while reading the response fixture."
    },
    {
      id: "evt_user_correction",
      run_id: "run_timeline_learning",
      event_type: "user.message",
      summary: "User corrected the expected citation format."
    },
    {
      id: "evt_retry",
      run_id: "run_timeline_learning",
      event_type: "tool.requested",
      summary: "Retry after correction with the updated fixture."
    },
    {
      id: "evt_skill",
      run_id: "run_timeline_learning",
      event_type: "verification.recorded",
      summary: "This repeated workflow should become a capability candidate for prompt response audits.",
      payload_ref: "artifact://verification/run_timeline_learning/prompt-audit"
    },
    {
      id: "evt_regression",
      run_id: "run_timeline_learning",
      event_type: "verification.recorded",
      summary: "Add a regression test case for missing source citations."
    },
    {
      id: "evt_complete",
      run_id: "run_timeline_learning",
      event_type: "run.completed",
      summary: "Run completed after recovery."
    }
  ];

  const timeline = buildEpisodicTimeline(events, "run_timeline_learning");

  assert.deepEqual(timeline.failures, ["evt_tool_failure"]);
  assert.deepEqual(timeline.user_corrections, ["evt_user_correction"]);
  assert.deepEqual(timeline.recoveries, ["evt_user_correction", "evt_retry", "evt_complete"]);
  assert.deepEqual(timeline.skill_candidates, [
    "evt_skill: This repeated workflow should become a capability candidate for prompt response audits."
  ]);
  assert.deepEqual(timeline.regression_cases, [
    "evt_tool_failure: Tool failed with a timeout while reading the response fixture.",
    "evt_user_correction: User corrected the expected citation format.",
    "evt_regression: Add a regression test case for missing source citations."
  ]);
  assert.equal(timeline.final_artifact, "artifact://verification/run_timeline_learning/prompt-audit");
});

function memoryCard(input: Partial<MemoryCard> & Pick<MemoryCard, "id" | "content" | "confidence" | "source_events">): MemoryCard {
  return {
    type: "project",
    subject: "Aetherion",
    sensitivity: "private",
    blocked_contexts: [],
    ...input
  };
}
