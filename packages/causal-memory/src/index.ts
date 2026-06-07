import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { EventRecord } from "../../harness-core/src/index.ts";

export type CausalEdge = {
  id: string;
  run_id: string;
  from_event: string;
  from_event_type: string;
  to_event: string;
  to_event_type: string;
  relation: string;
  inference: "temporal_dependency_candidate";
  confidence: number;
  sequence_distance: number;
  source_events: string[];
  source_status: "active" | "redacted";
  projection_basis: "typed_event_sequence";
};

export type WhyReport = {
  id: string;
  run_id: string;
  mode: "report";
  status: "complete" | "partial" | "insufficient_evidence";
  confidence: number;
  outcome_event_id: string | null;
  summary: string;
  evidence: string[];
  source_events: string[];
  failures: string[];
  corrections: string[];
  assumptions: string[];
  unknowns: string[];
  source_redacted: boolean;
};

export type CounterfactualReport = {
  id: string;
  checkpoint_id: string;
  checkpoint_event_id: string;
  change: string;
  mode: "report";
  live_side_effects_allowed: false;
  confidence: number;
  summary: string;
  status: "partial" | "insufficient_evidence";
  evidence: string[];
  affected_events: string[];
  assumptions: string[];
  unknowns: string[];
  source_redacted: boolean;
};

export type CausalProjectionRecord = {
  id: string;
  run_id: string;
  db_path: string;
  source_events: string[];
  source_ledger_head: string;
  edge_count: number;
  redacted_source_events: string[];
  rebuilt_at: string;
  source_of_truth: false;
};

type Transition = {
  sourceTypes: string[];
  targetType: string;
  relation: string;
  confidence: number;
};

const TRANSITIONS: Transition[] = [
  { sourceTypes: ["user.message"], targetType: "tool.requested", relation: "intent_context_for_tool_request", confidence: 0.65 },
  { sourceTypes: ["tool.requested"], targetType: "policy.decided", relation: "tool_request_context_for_policy", confidence: 0.7 },
  { sourceTypes: ["consent.recorded"], targetType: "policy.decided", relation: "consent_context_for_policy_recheck", confidence: 0.75 },
  { sourceTypes: ["policy.decided"], targetType: "tool.result", relation: "policy_context_for_tool_result", confidence: 0.65 },
  { sourceTypes: ["policy.decided"], targetType: "action.recorded", relation: "policy_context_for_action", confidence: 0.7 },
  { sourceTypes: ["action.recorded"], targetType: "observation.recorded", relation: "action_context_for_observation", confidence: 0.7 },
  { sourceTypes: ["observation.recorded"], targetType: "verification.recorded", relation: "observation_context_for_verification", confidence: 0.75 },
  { sourceTypes: ["verification.recorded", "observation.recorded", "tool.result"], targetType: "run.completed", relation: "result_context_for_run_outcome", confidence: 0.6 }
];

const REDACTION_EVENT_TYPES = new Set(["artifact.redacted", "event.redacted", "memory.deleted"]);

export function buildCausalEdges(events: EventRecord[], redactedEventIds: Set<string> = redactedSources(events)): CausalEdge[] {
  const edges: CausalEdge[] = [];
  const runIds = unique(events.map((event) => event.run_id));
  for (const runId of runIds) {
    const runEvents = events.filter((event) => event.run_id === runId && !REDACTION_EVENT_TYPES.has(event.event_type));
    for (const transition of TRANSITIONS) {
      for (const [targetIndex, target] of runEvents.entries()) {
        if (target.event_type !== transition.targetType) {
          continue;
        }
        const sourceIndex = findNearestSourceIndex(runEvents, targetIndex, transition.sourceTypes);
        if (sourceIndex < 0) {
          continue;
        }
        const source = runEvents[sourceIndex];
        edges.push(edgeFromTransition(source, target, targetIndex - sourceIndex, transition, redactedEventIds));
      }
    }
    const outcomeIndex = runEvents.findLastIndex((event) => event.event_type === "run.completed");
    if (outcomeIndex >= 0) {
      const outcome = runEvents[outcomeIndex];
      for (const [sourceIndex, source] of runEvents.entries()) {
        if (sourceIndex >= outcomeIndex) {
          continue;
        }
        const relation = isFailureEvent(source)
          ? "failure_context_for_run_outcome"
          : isCorrectionEvent(source)
            ? "correction_context_for_run_outcome"
            : null;
        if (!relation) {
          continue;
        }
        edges.push(edgeFromTransition(source, outcome, outcomeIndex - sourceIndex, {
          sourceTypes: [source.event_type],
          targetType: outcome.event_type,
          relation,
          confidence: 0.5
        }, redactedEventIds));
      }
    }
  }
  return edges.sort((left, right) => eventIndex(events, left.to_event) - eventIndex(events, right.to_event));
}

export function buildWhyReport(events: EventRecord[], edges: CausalEdge[]): WhyReport {
  const factualEvents = events.filter((event) => !REDACTION_EVENT_TYPES.has(event.event_type));
  const runId = factualEvents[0]?.run_id ?? "unknown";
  const outcome = factualEvents.findLast((event) => event.event_type === "run.completed")
    ?? factualEvents.findLast((event) => event.event_type === "verification.recorded")
    ?? null;
  if (!outcome) {
    return {
      id: `why_${sanitize(runId)}`,
      run_id: runId,
      mode: "report",
      status: "insufficient_evidence",
      confidence: 0,
      outcome_event_id: null,
      summary: "No outcome or verification event exists for this run.",
      evidence: [],
      source_events: factualEvents.map((event) => event.id),
      failures: failureEventIds(factualEvents),
      corrections: correctionEventIds(factualEvents),
      assumptions: [],
      unknowns: ["Run outcome", "Unrecorded external state", "Unrecorded model reasoning"],
      source_redacted: edges.some((edge) => edge.source_status === "redacted")
    };
  }

  const evidenceEdges = ancestorEdges(outcome.id, edges);
  const sourceEvents = unique(evidenceEdges.flatMap((edge) => edge.source_events));
  const sourceRedacted = evidenceEdges.some((edge) => edge.source_status === "redacted");
  const missingStages = expectedStages(factualEvents, outcome.event_type).filter((type) => !factualEvents.some((event) => event.event_type === type));
  const outcomeIndex = factualEvents.findIndex((event) => event.id === outcome.id);
  const postOutcomeEvents = outcomeIndex >= 0 ? factualEvents.slice(outcomeIndex + 1) : [];
  const status = evidenceEdges.length === 0
    ? "insufficient_evidence"
    : sourceRedacted || missingStages.length > 0 || postOutcomeEvents.length > 0
      ? "partial"
      : "complete";
  const confidence = status === "insufficient_evidence"
    ? 0
    : Math.min(...evidenceEdges.map((edge) => edge.confidence)) * (sourceRedacted ? 0.5 : 1);
  return {
    id: `why_${sanitize(runId)}`,
    run_id: runId,
    mode: "report",
    status,
    confidence: roundConfidence(confidence),
    outcome_event_id: outcome.id,
    summary: whySummary(status, failureEventIds(factualEvents).length),
    evidence: evidenceEdges.map((edge) => edge.id),
    source_events: sourceEvents,
    failures: failureEventIds(factualEvents),
    corrections: correctionEventIds(factualEvents),
    assumptions: ["Recorded typed event order is relevant to the observed outcome."],
    unknowns: [
      ...missingStages.map((type) => `Missing ${type} event`),
      ...(postOutcomeEvents.length > 0 ? ["Events were recorded after the selected run.completed outcome"] : []),
      "Unrecorded external state",
      "Unrecorded model reasoning"
    ],
    source_redacted: sourceRedacted
  };
}

export function counterfactualFromCheckpoint(
  checkpointId: string,
  checkpointEventId: string,
  change: string,
  edges: CausalEdge[]
): CounterfactualReport {
  const relevantEdges = descendantEdges(checkpointEventId, edges);
  const hasEvidence = relevantEdges.length > 0;
  const sourceRedacted = relevantEdges.some((edge) => edge.source_status === "redacted");
  const affectedEvents = unique(relevantEdges.flatMap((edge) => [edge.from_event, edge.to_event]))
    .filter((eventId) => eventId !== checkpointEventId);
  return {
    id: `counterfactual_${sanitize(checkpointId)}`,
    checkpoint_id: checkpointId,
    checkpoint_event_id: checkpointEventId,
    change,
    mode: "report",
    live_side_effects_allowed: false,
    confidence: hasEvidence ? roundConfidence(Math.min(...relevantEdges.map((edge) => edge.confidence)) * (sourceRedacted ? 0.5 : 0.65)) : 0,
    summary: hasEvidence
      ? "Report-only projection of recorded downstream dependencies. The listed events may need reevaluation, but no alternate outcome is asserted or executed."
      : "Insufficient checkpoint-linked evidence for a counterfactual projection.",
    status: hasEvidence ? "partial" : "insufficient_evidence",
    evidence: relevantEdges.map((edge) => edge.id),
    affected_events: affectedEvents,
    assumptions: hasEvidence ? ["The proposed change invalidates or alters dependencies downstream of the checkpoint."] : [],
    unknowns: [
      "Alternate model output",
      "Alternate policy decision",
      "External effects",
      "Tool behavior under the proposed change"
    ],
    source_redacted: sourceRedacted
  };
}

export function rebuildCausalProjection(
  workspaceRoot: string,
  runId: string,
  ledgerEvents: EventRecord[],
  edges: CausalEdge[]
): CausalProjectionRecord {
  const dbRelativePath = join(".aetherion", "projections", "causal.sqlite");
  const dbPath = join(workspaceRoot, dbRelativePath);
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS causal_edges (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        from_event TEXT NOT NULL,
        from_event_type TEXT NOT NULL,
        to_event TEXT NOT NULL,
        to_event_type TEXT NOT NULL,
        relation TEXT NOT NULL,
        inference TEXT NOT NULL,
        confidence REAL NOT NULL,
        sequence_distance INTEGER NOT NULL,
        source_status TEXT NOT NULL,
        source_events_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS causal_edges_run_id ON causal_edges(run_id);
    `);
    db.exec("BEGIN IMMEDIATE");
    db.prepare("DELETE FROM causal_edges WHERE run_id = ?").run(runId);
    const insert = db.prepare(`
      INSERT INTO causal_edges (
        id, run_id, from_event, from_event_type, to_event, to_event_type,
        relation, inference, confidence, sequence_distance, source_status, source_events_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const edge of edges) {
      insert.run(
        edge.id,
        edge.run_id,
        edge.from_event,
        edge.from_event_type,
        edge.to_event,
        edge.to_event_type,
        edge.relation,
        edge.inference,
        edge.confidence,
        edge.sequence_distance,
        edge.source_status,
        JSON.stringify(edge.source_events)
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // No active transaction.
    }
    throw error;
  } finally {
    db.close();
  }
  const runEvents = ledgerEvents.filter((event) => event.run_id === runId && !REDACTION_EVENT_TYPES.has(event.event_type));
  const redacted = redactedSources(ledgerEvents);
  const relevantRedactions = ledgerEvents.filter((event) =>
    REDACTION_EVENT_TYPES.has(event.event_type)
    && (event.links ?? []).some((link) => runEvents.some((runEvent) => runEvent.id === link))
  );
  return {
    id: `causal_projection_${sanitize(runId)}`,
    run_id: runId,
    db_path: dbRelativePath,
    source_events: [...runEvents, ...relevantRedactions].map((event) => event.id),
    source_ledger_head: ledgerEvents.at(-1)?.event_hash ?? "missing",
    edge_count: edges.length,
    redacted_source_events: runEvents.map((event) => event.id).filter((id) => redacted.has(id)),
    rebuilt_at: new Date().toISOString(),
    source_of_truth: false
  };
}

export function redactedSources(events: EventRecord[]): Set<string> {
  const redacted = new Set<string>();
  for (const event of events) {
    if (!REDACTION_EVENT_TYPES.has(event.event_type)) {
      continue;
    }
    for (const link of event.links ?? []) {
      redacted.add(link);
    }
  }
  return redacted;
}

export function isCausalEdge(value: unknown): value is CausalEdge {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.run_id === "string"
    && typeof value.from_event === "string"
    && typeof value.to_event === "string"
    && Array.isArray(value.source_events)
    && (value.source_status === "active" || value.source_status === "redacted");
}

function edgeFromTransition(
  source: EventRecord,
  target: EventRecord,
  distance: number,
  transition: Transition,
  redactedEventIds: Set<string>
): CausalEdge {
  const sourceEvents = [source.id, target.id];
  return {
    id: `causal_${sanitize(source.id)}_to_${sanitize(target.id)}`,
    run_id: target.run_id,
    from_event: source.id,
    from_event_type: source.event_type,
    to_event: target.id,
    to_event_type: target.event_type,
    relation: transition.relation,
    inference: "temporal_dependency_candidate",
    confidence: transition.confidence,
    sequence_distance: distance,
    source_events: sourceEvents,
    source_status: sourceEvents.some((eventId) => redactedEventIds.has(eventId)) ? "redacted" : "active",
    projection_basis: "typed_event_sequence"
  };
}

function findNearestSourceIndex(events: EventRecord[], targetIndex: number, sourceTypes: string[]): number {
  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    if (sourceTypes.includes(events[index].event_type)) {
      return index;
    }
  }
  return -1;
}

function ancestorEdges(outcomeEventId: string, edges: CausalEdge[]): CausalEdge[] {
  const selected = new Map<string, CausalEdge>();
  const queue = [outcomeEventId];
  while (queue.length > 0) {
    const target = queue.shift()!;
    for (const edge of edges.filter((candidate) => candidate.to_event === target)) {
      if (selected.has(edge.id)) {
        continue;
      }
      selected.set(edge.id, edge);
      queue.push(edge.from_event);
    }
  }
  return [...selected.values()].reverse();
}

function descendantEdges(checkpointEventId: string, edges: CausalEdge[]): CausalEdge[] {
  const selected = new Map<string, CausalEdge>();
  const queue = [checkpointEventId];
  while (queue.length > 0) {
    const source = queue.shift()!;
    for (const edge of edges.filter((candidate) => candidate.from_event === source)) {
      if (selected.has(edge.id)) {
        continue;
      }
      selected.set(edge.id, edge);
      queue.push(edge.to_event);
    }
  }
  return [...selected.values()];
}

function expectedStages(events: EventRecord[], outcomeType: string): string[] {
  if (outcomeType !== "run.completed") {
    return ["observation.recorded", "verification.recorded"];
  }
  const stages = ["user.message", "tool.requested", "policy.decided", "run.completed"];
  if (events.some((event) => event.event_type === "action.recorded")) {
    stages.push("action.recorded", "observation.recorded", "verification.recorded");
  } else if (events.some((event) => event.event_type === "tool.result")) {
    stages.push("tool.result");
  }
  return stages;
}

function failureEventIds(events: EventRecord[]): string[] {
  return events
    .filter(isFailureEvent)
    .map((event) => event.id);
}

function correctionEventIds(events: EventRecord[]): string[] {
  return events
    .filter(isCorrectionEvent)
    .map((event) => event.id);
}

function isFailureEvent(event: EventRecord): boolean {
  return /fail|error|denied|blocked|partial/i.test(`${event.event_type} ${event.summary}`);
}

function isCorrectionEvent(event: EventRecord): boolean {
  return /correct|retry|recover|rollback|replan/i.test(`${event.event_type} ${event.summary}`);
}

function whySummary(status: WhyReport["status"], failureCount: number): string {
  if (status === "complete") {
    return failureCount > 0
      ? "The report traces recorded failure context and typed dependencies to the run outcome. It identifies likely recorded contributors, not proven causation."
      : "The report traces recorded intent, policy, action, observation, and verification context to the run outcome. It identifies temporal dependencies, not proven causation.";
  }
  return "The report is partial because required stages are missing or source evidence was redacted. It does not assert proven causation.";
}

function eventIndex(events: EventRecord[], eventId: string): number {
  return events.findIndex((event) => event.id === eventId);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "_");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
