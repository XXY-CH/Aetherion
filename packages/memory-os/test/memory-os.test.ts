import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptMemoryCandidate, assembleContextPack, buildEpisodicTimeline, createBasicUserModel, createMemoryCandidate, createMemoryDeleteTombstone, deriveMemoryCandidatesFromEvents } from "../src/index.ts";

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
  assert.ok(timeline.regression_cases[0].includes("without live side effects"));

  const userModel = createBasicUserModel([memory]);
  assert.deepEqual(userModel.source_memory_ids, ["mem_run_trace_memory_episode"]);
  assert.deepEqual(userModel.source_events, ["evt_run_user", "evt_run_verification", "evt_run_completed"]);
  assert.ok(userModel.communication_style.prefers.includes("concrete verification evidence"));
});
