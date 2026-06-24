import { assertLeaseActive, assertLeaseScopeIncludesEgress, assertLeaseScopeIncludesTool } from "./lease.ts";
import type { PolicyDecision, ToolRequest } from "./policy.ts";

export type NetworkFetchResult = {
  body: string;
  status: number;
  statusText: string;
};

export async function fetchUrlThroughPolicy(request: ToolRequest, decision: PolicyDecision): Promise<NetworkFetchResult> {
  if (decision.decision !== "allow") {
    throw new Error(`Policy did not allow request ${request.id}: ${decision.reason}`);
  }
  assertLeaseActive(decision);
  assertLeaseScopeIncludesTool(decision, "network.fetch");
  assertLeaseScopeIncludesEgress(decision, request.risk_inputs.data_egress_destination);

  const scope = decision.lease?.scope;
  if (!scope || !Array.isArray(scope.urls)) {
    throw new Error(`Policy decision ${decision.id} did not issue a URL lease`);
  }
  const targetUrl = request.operation.target.uri;
  if (!scope.urls.includes(targetUrl)) {
    throw new Error(`Policy lease does not include target URL ${targetUrl}`);
  }

  const response = await fetch(targetUrl, { signal: AbortSignal.timeout(15_000) });
  const body = await response.text();
  return {
    body,
    status: response.status,
    statusText: response.statusText
  };
}
