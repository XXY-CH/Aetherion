# Phase 01 — Tool Policy Pipeline

Alignment: baseline doc §11 item 3 — layered tool-policy pipeline shape.

## Baseline delta

Current state (`packages/harness-core/src/policy.ts:129`): `evaluateSeedPolicy` is a single hard-coded function. Boundary check, egress check, and verb decision are tangled in one if/else chain. Adding a policy layer means editing this function, which makes policy evolution un-auditable and un-testable in isolation.

OpenClaw's shape (`src/agents/tool-policy-pipeline.ts:127`): ordered `ToolPolicyPipelineStep[]`, each step filters/decides independently, audit emitted per layer.

## Scope (minimum viable)

Refactor `evaluateSeedPolicy` into an ordered pipeline of steps, where each step is a pure function `(request, priorDecision) => decision`. Keep the exact same observable behavior — this is a refactor, not a feature add.

Two layers only (do NOT add OpenClaw's six layers):

1. **boundary** — workspace boundary + egress destination check. Returns `deny` if outside workspace or wrong egress.
2. **operation** — verb-based decision. `read` → allow with lease; `write` → ask; else → deny.

`approveWriteWithConsent` stays as-is (it's a separate consent-gated path, not part of the seed pipeline).

## What this is NOT

- Not a plugin system. Steps are hardcoded in an array.
- Not config-driven. No policy file parsing.
- Not a generic rule engine.
- Not adding new policy rules. Behavior is identical to today.

## Contracts

New internal type (no new JSON Schema needed — this is internal composition):

```typescript
type PolicyPipelineStep = {
  name: string;
  evaluate: (request: ToolRequest, prior: PolicyDecision | null) => PolicyDecision | null;
};
```

A step returns `null` to defer to the next step. A step returns a decision to short-circuit. The pipeline runs steps in order; the first non-null decision wins. If all steps defer, the pipeline returns a default `deny`.

## Tests (TDD — written first)

1. `boundary step denies target outside workspace`
2. `boundary step denies non-local-response egress`
3. `boundary step defers (null) for in-workspace local-egress read`
4. `operation step allows in-workspace read with lease`
5. `operation step asks for in-workspace write`
6. `operation step denies unknown verb`
7. `pipeline preserves exact behavior of evaluateSeedPolicy for all existing cases` (golden test against current output)
8. `pipeline returns deny when all steps defer`

## Exit criteria

- All 8 new tests pass.
- Existing `harness-core.test.ts` passes unchanged (no behavior change).
- `evaluateSeedPolicy` becomes a thin wrapper over the pipeline (backward compatible).
- `npm test` green.

## Out of scope

- policy-decision.schema.json changes (none).
- OpenClaw-style profile/provider/group layers.
- Audit emission per step.
- Policy file / config loading.
