import type { EventRecord } from "../../harness-core/src/index.ts";

export type CausalEdge = {
  id: string;
  from_event: string;
  to_event: string;
  relation: string;
  confidence: number;
  source_events: string[];
  projection_basis: "typed_event_sequence";
};

export type CounterfactualReport = {
  id: string;
  checkpoint_id: string;
  change: string;
  mode: "report";
  live_side_effects_allowed: false;
  confidence: number;
  summary: string;
  status: "partial" | "insufficient_evidence";
  evidence: string[];
  assumptions: string[];
  unknowns: string[];
};

export function buildCausalEdges(events: EventRecord[]): CausalEdge[] {
  const edges: CausalEdge[] = [];
  for (let index = 0; index < events.length - 1; index += 1) {
    const from = events[index];
    const to = events[index + 1];
    const relation = projectedRelation(from.event_type, to.event_type);
    if (!relation) {
      continue;
    }
    edges.push({
      id: `causal_${from.id}_to_${to.id}`.replace(/[^A-Za-z0-9_-]/g, "_"),
      from_event: from.id,
      to_event: to.id,
      relation,
      confidence: 0.55,
      source_events: [from.id, to.id],
      projection_basis: "typed_event_sequence"
    });
  }
  return edges;
}

export function counterfactualReport(checkpointId: string, change: string, evidence: CausalEdge[]): CounterfactualReport {
  const hasEvidence = evidence.length > 0;
  return {
    id: `counterfactual_${checkpointId}`,
    checkpoint_id: checkpointId,
    change,
    mode: "report",
    live_side_effects_allowed: false,
    confidence: hasEvidence ? 0.4 : 0,
    summary: hasEvidence
      ? "Report-only counterfactual based on typed event-sequence projections; no causal outcome is asserted."
      : "Insufficient checkpoint-linked evidence for a counterfactual projection.",
    status: hasEvidence ? "partial" : "insufficient_evidence",
    evidence: evidence.map((edge) => edge.id),
    assumptions: hasEvidence ? ["Typed event order is relevant to the proposed change."] : [],
    unknowns: ["Unobserved state changes", "External effects", "Model and tool behavior under the proposed change"]
  };
}

export function counterfactualFromCheckpoint(checkpointId: string, checkpointEventId: string, change: string, edges: CausalEdge[]): CounterfactualReport {
  const relevantEdges = edges.filter((edge) => edge.source_events.includes(checkpointEventId));
  return counterfactualReport(checkpointId, change, relevantEdges);
}

export function isCausalEdge(value: unknown): value is CausalEdge {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && "id" in value
    && typeof value.id === "string"
    && "source_events" in value
    && Array.isArray(value.source_events);
}

function projectedRelation(fromType: string, toType: string): string | null {
  const allowed = new Map([
    ["user.message->tool.requested", "intent_precedes_tool_request"],
    ["tool.requested->policy.decided", "tool_request_precedes_policy"],
    ["consent.recorded->policy.decided", "consent_precedes_policy_recheck"],
    ["policy.decided->action.recorded", "allow_decision_precedes_action"],
    ["action.recorded->observation.recorded", "action_precedes_observation"],
    ["observation.recorded->verification.recorded", "observation_precedes_verification"]
  ]);
  return allowed.get(`${fromType}->${toType}`) ?? null;
}
