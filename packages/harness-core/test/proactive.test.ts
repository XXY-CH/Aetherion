import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateOpportunity, type ProactiveOpportunityInput } from "../src/proactive.ts";

function baseOpp(overrides: Partial<ProactiveOpportunityInput> = {}): ProactiveOpportunityInput {
  return {
    confidence: 0.8,
    interruption_cost: 0.3,
    urgency: 0.5,
    source_events_tainted: false,
    quiet_hours_active: false,
    ...overrides
  };
}

test("surface=true when all gates pass", () => {
  const result = evaluateOpportunity(baseOpp());
  assert.equal(result.surface, true);
  assert.equal(result.inhibitors.source_tainted, false);
  assert.equal(result.inhibitors.confidence_too_low, false);
  assert.equal(result.inhibitors.quiet_hours_active, false);
  assert.equal(result.inhibitors.interruption_cost_too_high, false);
});

test("suppresses when confidence below 0.5", () => {
  const result = evaluateOpportunity(baseOpp({ confidence: 0.3 }));
  assert.equal(result.surface, false);
  assert.equal(result.inhibitors.confidence_too_low, true);
  assert.match(result.reason, /Confidence/);
});

test("suppresses when interruption cost above 0.6", () => {
  const result = evaluateOpportunity(baseOpp({ interruption_cost: 0.8 }));
  assert.equal(result.surface, false);
  assert.equal(result.inhibitors.interruption_cost_too_high, true);
});

test("suppresses when source events are tainted", () => {
  const result = evaluateOpportunity(baseOpp({ source_events_tainted: true }));
  assert.equal(result.surface, false);
  assert.equal(result.inhibitors.source_tainted, true);
  assert.match(result.reason, /tainted/);
});

test("suppresses during quiet hours with low urgency", () => {
  const result = evaluateOpportunity(baseOpp({ quiet_hours_active: true, urgency: 0.4 }));
  assert.equal(result.surface, false);
  assert.equal(result.inhibitors.quiet_hours_active, true);
});

test("allows during quiet hours when urgency >= 0.8 (override)", () => {
  const result = evaluateOpportunity(baseOpp({ quiet_hours_active: true, urgency: 0.9 }));
  assert.equal(result.surface, true);
  assert.equal(result.inhibitors.quiet_hours_active, false);
});

test("taint check takes priority over other inhibitors", () => {
  const result = evaluateOpportunity(baseOpp({
    source_events_tainted: true,
    confidence: 0.1,
    interruption_cost: 0.9,
    quiet_hours_active: true
  }));
  assert.equal(result.surface, false);
  assert.match(result.reason, /tainted/);
});

test("confidence check takes priority over quiet hours", () => {
  const result = evaluateOpportunity(baseOpp({
    confidence: 0.2,
    quiet_hours_active: true
  }));
  assert.equal(result.surface, false);
  assert.match(result.reason, /Confidence/);
});
