import assert from "node:assert/strict";
import { test } from "node:test";
import { foldMemories, forkSoul, proposePersonaAnchor } from "../src/index.ts";

test("persona anchors require evidence and soul forks never inherit live authority", () => {
  assert.throws(() => proposePersonaAnchor({
    id: "anchor_bad",
    content: "No source",
    source_events: [],
    confidence: 0.5,
    ttl: "30d",
    allowed_contexts: [],
    blocked_contexts: []
  }), /source events/);
  const anchor = proposePersonaAnchor({
    id: "anchor_direct",
    content: "User prefers evidence.",
    source_events: ["evt_style"],
    confidence: 0.9,
    ttl: "180d",
    allowed_contexts: ["planning"],
    blocked_contexts: ["external_auto_send"]
  });
  assert.equal(anchor.review_status, "pending");
  assert.deepEqual(foldMemories(["memcand_a"], "mem_style", 0.8).folded_from, ["memcand_a"]);
  const fork = forkSoul("checkpoint_a", "agent_branch");
  assert.equal(fork.inherits_live_authority, false);
  assert.equal(fork.status, "proposed");
});
