# Phase 12 — Proactive Opportunity Lifecycle with Inhibition

Alignment: doc 17 P2-8. AGENTS.md: "Proactive behavior is an Opportunity Lifecycle with inhibition, not cron self-interruption."

## Scope

1. `evaluateOpportunity()` — pure function checking 4 inhibition gates: source taint, confidence threshold (0.5), interruption cost (0.6 max), quiet hours (urgency >= 0.8 overrides).
2. Priority order: taint > confidence > interruption cost > quiet hours.
3. Available for daemon integration: daemon can use it to decide whether to surface a proactive notification or suppress it.

## Tests: 8 (all pass)
