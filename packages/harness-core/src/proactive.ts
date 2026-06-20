// Proactive Opportunity Lifecycle with inhibition.
//
// AGENTS.md: "Proactive behavior is an Opportunity Lifecycle with inhibition,
// not cron self-interruption." This module evaluates whether a proactive
// opportunity should be surfaced to the user, applying inhibition gates
// (quiet hours, confidence threshold, interruption cost, taint).

export type InhibitorState = {
  quiet_hours_active: boolean;
  confidence_too_low: boolean;
  interruption_cost_too_high: boolean;
  source_tainted: boolean;
};

export type OpportunityDecision = {
  surface: boolean;
  reason: string;
  inhibitors: InhibitorState;
};

export type ProactiveOpportunityInput = {
  confidence: number;       // 0-1
  interruption_cost: number; // 0-1
  urgency: number;          // 0-1
  source_events_tainted: boolean;
  quiet_hours_active: boolean;
};

const MIN_CONFIDENCE = 0.5;
const MAX_INTERRUPTION_COST = 0.6;

// Evaluate whether a proactive opportunity passes the inhibition gates.
// An opportunity is surfaced ONLY when all inhibitors are clear.
// Urgency can override quiet_hours for critical items (urgency >= 0.8).
export function evaluateOpportunity(opp: ProactiveOpportunityInput): OpportunityDecision {
  const inhibitors: InhibitorState = {
    quiet_hours_active: opp.quiet_hours_active && opp.urgency < 0.8,
    confidence_too_low: opp.confidence < MIN_CONFIDENCE,
    interruption_cost_too_high: opp.interruption_cost > MAX_INTERRUPTION_COST,
    source_tainted: opp.source_events_tainted
  };

  if (inhibitors.source_tainted) {
    return { surface: false, reason: "Source events are tainted — opportunity suppressed.", inhibitors };
  }
  if (inhibitors.confidence_too_low) {
    return { surface: false, reason: `Confidence ${opp.confidence.toFixed(2)} below threshold ${MIN_CONFIDENCE}.`, inhibitors };
  }
  if (inhibitors.interruption_cost_too_high) {
    return { surface: false, reason: `Interruption cost ${opp.interruption_cost.toFixed(2)} above max ${MAX_INTERRUPTION_COST}.`, inhibitors };
  }
  if (inhibitors.quiet_hours_active) {
    return { surface: false, reason: "Quiet hours active and urgency below override threshold.", inhibitors };
  }

  return { surface: true, reason: "All inhibition gates passed.", inhibitors };
}
