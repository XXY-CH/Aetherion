import type { PolicyDecision } from "./policy.ts";

export function assertLeaseActive(decision: PolicyDecision): void {
  if (!decision.lease) {
    throw new Error(`Policy decision ${decision.id} did not issue a scoped lease`);
  }
  if (Date.parse(decision.lease.expires_at) <= Date.now()) {
    throw new Error(`Policy decision ${decision.id} issued an expired scoped lease`);
  }
}

export function assertLeaseScopeIncludesTool(decision: PolicyDecision, toolName: string): void {
  const scope = decision.lease?.scope;
  if (!scope || !Array.isArray(scope.tools) || !scope.tools.includes(toolName)) {
    throw new Error(`Policy lease does not authorize tool ${toolName}`);
  }
}

export function assertLeaseScopeIncludesEgress(decision: PolicyDecision, egress: string): void {
  const scope = decision.lease?.scope;
  if (!scope || !Array.isArray(scope.egress) || !scope.egress.includes(egress)) {
    throw new Error(`Policy lease does not authorize egress destination ${egress}`);
  }
}
