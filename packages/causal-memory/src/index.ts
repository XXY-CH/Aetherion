import type { EventRecord } from "../../harness-core/src/index.ts";

export type CausalEdge = {
  id: string;
  from_event: string;
  to_event: string;
  relation: string;
  confidence: number;
  source_events: string[];
};

export type CounterfactualReport = {
  id: string;
  checkpoint_id: string;
  change: string;
  mode: "report";
  live_side_effects_allowed: false;
  confidence: number;
  summary: string;
};

export function buildCausalEdges(events: EventRecord[]): CausalEdge[] {
  const edges: CausalEdge[] = [];
  for (let index = 0; index < events.length - 1; index += 1) {
    edges.push({
      id: `causal_${events[index].id}_to_${events[index + 1].id}`.replace(/[^A-Za-z0-9_-]/g, "_"),
      from_event: events[index].id,
      to_event: events[index + 1].id,
      relation: `${events[index].event_type}->${events[index + 1].event_type}`,
      confidence: 0.8,
      source_events: [events[index].id, events[index + 1].id]
    });
  }
  return edges;
}

export function counterfactualReport(checkpointId: string, change: string, eventCount: number): CounterfactualReport {
  return {
    id: `counterfactual_${checkpointId}`,
    checkpoint_id: checkpointId,
    change,
    mode: "report",
    live_side_effects_allowed: false,
    confidence: eventCount > 0 ? 0.7 : 0.2,
    summary: eventCount > 0 ? "Generated a report-only counterfactual from trace evidence." : "Insufficient evidence; report is partial."
  };
}

export function counterfactualFromCheckpoint(checkpointId: string, change: string, edges: CausalEdge[]): CounterfactualReport {
  const relevantEdges = edges.filter((edge) => edge.source_events.includes(checkpointId) || edge.from_event === checkpointId || edge.to_event === checkpointId);
  return counterfactualReport(checkpointId, change, relevantEdges.length || edges.length);
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
