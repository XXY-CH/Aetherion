import assert from "node:assert/strict";
import { test } from "node:test";
import type { MemoryCard } from "../../memory-os/src/index.ts";
import {
  acceptMemoryFold,
  acceptPersonaAnchor,
  applyPersonaReset,
  createPersonaBranch,
  defaultInheritancePolicy,
  forkSoul,
  proposeMemoryFold,
  proposePersonaAnchor
} from "../src/index.ts";

function memory(id: string, sensitivity = "private", type: MemoryCard["type"] = "project"): MemoryCard {
  return {
    id,
    type,
    subject: "run_source",
    content: `Evidence for ${id}`,
    source_events: [`evt_${id}`],
    confidence: 0.9,
    sensitivity,
    blocked_contexts: ["external_send"]
  };
}

test("persona anchors require evidence, TTL, and explicit sensitive approval", () => {
  assert.throws(() => proposePersonaAnchor({
    id: "anchor_bad",
    branch: "direct",
    kind: "style",
    content: "No source",
    source_events: [],
    confidence: 0.5,
    ttl: "30d",
    allowed_contexts: [],
    blocked_contexts: [],
    sensitivity: "private"
  }), /source events/);
  const sensitive = proposePersonaAnchor({
    id: "anchor_sensitive",
    branch: "direct",
    kind: "principle",
    content: "Confidential preference",
    source_events: ["evt_style"],
    confidence: 0.9,
    ttl: "180d",
    allowed_contexts: ["planning"],
    blocked_contexts: ["external_auto_send"],
    sensitivity: "confidential"
  });
  assert.equal(sensitive.review_status, "pending");
  assert.equal(sensitive.sensitive_approval_required, true);
  assert.throws(() => acceptPersonaAnchor(sensitive), /explicit sensitive approval/);
  assert.equal(acceptPersonaAnchor(sensitive, true).sensitive_approved, true);
});

test("memory folding preserves source cards and becomes active only after acceptance", () => {
  const source = [memory("mem_a", "private", "preference"), memory("mem_b", "private", "preference")];
  const proposed = proposeMemoryFold("run_source", source, "User prefers evidence-backed concise answers.", 0.84);
  assert.deepEqual(proposed.folded_from, ["mem_a", "mem_b"]);
  assert.deepEqual(proposed.source_events, ["evt_mem_a", "evt_mem_b"]);
  assert.equal(proposed.review_status, "pending");
  assert.equal(proposed.replaces_active_memory, false);
  const accepted = acceptMemoryFold(proposed);
  assert.equal(accepted.fold.review_status, "accepted");
  assert.equal(accepted.fold.accepted_memory_id, accepted.memory.id);
  assert.deepEqual(source.map((entry) => entry.id), ["mem_a", "mem_b"]);
  assert.throws(() => proposeMemoryFold("run_source", [source[0]], "Over-folded", 0.8), /at least two distinct/);
  const sensitive = proposeMemoryFold("run_source", [source[0], memory("mem_secret", "secret")], "Sensitive fold", 0.8);
  assert.throws(() => acceptMemoryFold(sensitive), /explicit sensitive approval/);
  assert.equal(acceptMemoryFold(sensitive, true).fold.sensitive_approved, true);
});

test("persona reset switches accepted style anchors while retaining business memory", () => {
  const anchor = acceptPersonaAnchor(proposePersonaAnchor({
    id: "anchor_direct",
    branch: "direct",
    kind: "style",
    content: "Be direct.",
    source_events: ["evt_style"],
    confidence: 0.9,
    ttl: "180d",
    allowed_contexts: ["planning"],
    blocked_contexts: [],
    sensitivity: "private"
  }));
  const branch = createPersonaBranch("direct", [anchor]);
  const result = applyPersonaReset(undefined, branch, [
    memory("mem_project", "private", "project"),
    memory("mem_style", "private", "preference")
  ]);
  assert.equal(result.reset.status, "applied");
  assert.deepEqual(result.reset.retained_business_memory_ids, ["mem_project"]);
  assert.deepEqual(result.state.active_anchor_ids, ["anchor_direct"]);
  assert.equal(result.reset.inherits_live_authority, false);
});

test("Soul Fork creates isolated identity, zero authority, and reference-only inheritance", () => {
  const fork = forkSoul({
    checkpoint: {
      id: "checkpoint_source",
      run_id: "run_source",
      event_id: "evt_checkpoint",
      event_hash: `sha256:${"a".repeat(64)}`
    },
    replayRecordId: "replay_run_source_checkpoint",
    newAgentId: "agent_branch",
    workspaceId: "ws_source",
    memories: [
      memory("mem_private", "private"),
      memory("mem_secret", "secret"),
      memory("mem_confidential", "confidential")
    ],
    inheritancePolicy: defaultInheritancePolicy()
  });
  assert.equal(fork.status, "created");
  assert.equal(fork.inherits_live_authority, false);
  assert.equal(fork.live_side_effects_allowed, false);
  assert.deepEqual(fork.policy.active_leases, []);
  assert.deepEqual(fork.policy.vault_grants, []);
  assert.deepEqual(fork.policy.oauth_grants, []);
  assert.equal(fork.budget.token_budget, 0);
  assert.deepEqual(fork.workspace_scope.allowed_paths, []);
  assert.deepEqual(fork.inherited_memory_ids, ["mem_private"]);
  assert.deepEqual(fork.excluded_memory_ids, ["mem_secret", "mem_confidential"]);
  assert.equal(fork.sensitive_history_approved, false);
  assert.throws(() => forkSoul({
    checkpoint: {
      id: "checkpoint_sensitive",
      run_id: "run_source",
      event_id: "evt_sensitive",
      event_hash: `sha256:${"b".repeat(64)}`
    },
    replayRecordId: "replay_sensitive",
    newAgentId: "agent_sensitive",
    workspaceId: "ws_source",
    memories: [],
    containsSensitiveHistory: true
  }), /explicit approval for sensitive history/);
  assert.throws(() => forkSoul({
    checkpoint: { id: "checkpoint_bad", run_id: "run_source", event_id: "evt_bad" },
    replayRecordId: "replay_bad",
    newAgentId: "agent_bad",
    workspaceId: "ws_source",
    memories: []
  }), /hash-bound checkpoint/);
  assert.throws(() => forkSoul({
    checkpoint: {
      id: "checkpoint_bad_identity",
      run_id: "run_source",
      event_id: "evt_bad_identity",
      event_hash: `sha256:${"c".repeat(64)}`
    },
    replayRecordId: "replay_bad_identity",
    newAgentId: "../agent_escape",
    workspaceId: "ws_source",
    memories: []
  }), /agent_<id> form/);
});
