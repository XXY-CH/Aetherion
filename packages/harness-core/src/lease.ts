import type { PolicyDecision } from "./policy.ts";

export function assertLeaseActive(decision: PolicyDecision): void {
  if (!decision.lease) {
    throw new Error(`Policy decision ${decision.id} did not issue a scoped lease`);
  }
  if (Date.parse(decision.lease.expires_at) <= Date.now()) {
    throw new Error(`Policy decision ${decision.id} issued an expired scoped lease`);
  }
}
