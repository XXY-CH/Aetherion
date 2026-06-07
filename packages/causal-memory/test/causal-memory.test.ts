import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import type { EventRecord } from "../../harness-core/src/index.ts";
import {
  buildCausalEdges,
  buildWhyReport,
  counterfactualFromCheckpoint,
  rebuildCausalProjection,
  redactedSources
} from "../src/index.ts";

function event(id: string, eventType: string, summary = eventType, links?: string[]): EventRecord {
  return {
    id,
    timestamp: "2026-06-07T00:00:00.000Z",
    workspace_id: "ws_causal",
    run_id: "run_causal",
    event_type: eventType,
    actor: { type: "system", id: "test" },
    summary,
    links,
    event_hash: `sha256:${id}`,
    sensitivity: "private",
    taint: { sources: ["trusted_system"], can_authorize_actions: false }
  };
}

const completeTrace = [
  event("evt_intent", "user.message"),
  event("evt_request", "tool.requested"),
  event("evt_policy", "policy.decided"),
  event("evt_action", "action.recorded"),
  event("evt_observation", "observation.recorded"),
  event("evt_verification", "verification.recorded"),
  event("evt_complete", "run.completed")
];

test("causal projection traces typed dependencies without claiming proven causation", () => {
  const edges = buildCausalEdges(completeTrace);
  assert.ok(edges.length >= 6);
  assert.ok(edges.every((edge) => edge.inference === "temporal_dependency_candidate"));
  assert.ok(edges.every((edge) => edge.source_events.length === 2));

  const report = buildWhyReport(completeTrace, edges);
  assert.equal(report.status, "complete");
  assert.equal(report.outcome_event_id, "evt_complete");
  assert.match(report.summary, /not proven causation/);
  assert.ok(report.evidence.length >= 4);
});

test("counterfactual traverses downstream evidence and never enables live side effects", () => {
  const edges = buildCausalEdges(completeTrace);
  const report = counterfactualFromCheckpoint("checkpoint_policy", "evt_policy", "deny write", edges);
  assert.equal(report.live_side_effects_allowed, false);
  assert.equal(report.status, "partial");
  assert.ok(report.affected_events.includes("evt_action"));
  assert.ok(report.affected_events.includes("evt_complete"));
  assert.ok(report.unknowns.length > 0);
});

test("causal projection never links events across run boundaries", () => {
  const otherRun = completeTrace.map((entry) => ({ ...entry, id: `${entry.id}_other`, run_id: "run_other" }));
  const edges = buildCausalEdges([...completeTrace, ...otherRun]);
  const eventRuns = new Map([...completeTrace, ...otherRun].map((entry) => [entry.id, entry.run_id]));
  assert.ok(edges.every((edge) => eventRuns.get(edge.from_event) === eventRuns.get(edge.to_event)));
});

test("redacted source evidence makes why and counterfactual reports partial", () => {
  const redaction = event("evt_redaction", "event.redacted", "User redacted policy evidence.", ["evt_policy"]);
  const ledger = [...completeTrace, redaction];
  const edges = buildCausalEdges(completeTrace, redactedSources(ledger));
  assert.ok(edges.some((edge) => edge.source_status === "redacted"));
  const why = buildWhyReport(completeTrace, edges);
  assert.equal(why.status, "partial");
  assert.equal(why.source_redacted, true);
  const counterfactual = counterfactualFromCheckpoint("checkpoint_policy", "evt_policy", "deny write", edges);
  assert.equal(counterfactual.source_redacted, true);
  assert.ok(counterfactual.confidence < 0.4);
});

test("failure and correction signals are linked to the recorded outcome", () => {
  const trace = [
    event("evt_intent_failure", "user.message"),
    event("evt_request_failure", "tool.requested"),
    event("evt_policy_failure", "policy.decided"),
    event("evt_tool_failure", "tool.result", "Tool failed with a timeout."),
    event("evt_retry", "tool.requested", "Retry after correction."),
    event("evt_complete_failure", "run.completed", "Run completed after recovery.")
  ];
  const edges = buildCausalEdges(trace);
  assert.ok(edges.some((edge) => edge.relation === "failure_context_for_run_outcome"));
  assert.ok(edges.some((edge) => edge.relation === "correction_context_for_run_outcome"));
  const report = buildWhyReport(trace, edges);
  assert.deepEqual(report.failures, ["evt_tool_failure"]);
  assert.ok(report.corrections.includes("evt_retry"));
  assert.match(report.summary, /likely recorded contributors/);
});

test("events appended after run completion prevent a complete Why Report", () => {
  const extended = [...completeTrace, event("evt_post_complete_action", "action.recorded")];
  const report = buildWhyReport(extended, buildCausalEdges(extended));
  assert.equal(report.status, "partial");
  assert.ok(report.unknowns.includes("Events were recorded after the selected run.completed outcome"));
});

test("SQLite causal projection is disposable and rebuilds from ledger evidence", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "aetherion-causal-projection-"));
  const edges = buildCausalEdges(completeTrace);
  const projection = rebuildCausalProjection(workspace, "run_causal", completeTrace, edges);
  const dbPath = join(workspace, projection.db_path);
  assert.equal(projection.source_of_truth, false);
  assert.equal(projection.edge_count, edges.length);
  assert.equal(existsSync(dbPath), true);

  const db = new DatabaseSync(dbPath, { readOnly: true });
  const row = db.prepare("SELECT COUNT(*) AS count FROM causal_edges WHERE run_id = ?").get("run_causal") as { count: number };
  db.close();
  assert.equal(row.count, edges.length);
});
