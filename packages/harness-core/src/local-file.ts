import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { assertLeaseActive } from "./lease.ts";
import type { PolicyDecision, ToolRequest } from "./policy.ts";

const verbToTool: Record<string, string> = {
  read: "filesystem.read",
  write: "filesystem.write"
};

function assertLeaseScopeMatchesRequest(request: ToolRequest, decision: PolicyDecision): void {
  const scope = decision.lease?.scope;
  if (!scope) {
    throw new Error(`Policy decision ${decision.id} did not issue a scoped lease`);
  }
  const expectedTool = verbToTool[request.operation.verb];
  if (!expectedTool || !Array.isArray(scope.tools) || !scope.tools.includes(expectedTool)) {
    throw new Error(`Policy lease does not authorize tool for verb ${request.operation.verb}`);
  }
  const egress = request.risk_inputs.data_egress_destination;
  if (!Array.isArray(scope.egress) || !scope.egress.includes(egress)) {
    throw new Error(`Policy lease does not authorize egress destination ${egress}`);
  }
}

export type FileReadResult = {
  contents: string;
  bytes: number;
};

export async function readLocalFileThroughPolicy(request: ToolRequest, decision: PolicyDecision): Promise<FileReadResult> {
  if (decision.decision !== "allow") {
    throw new Error(`Policy did not allow request ${request.id}: ${decision.reason}`);
  }
  assertLeaseActive(decision);
  assertLeaseScopeMatchesRequest(request, decision);
  if (!decision.lease?.scope || !Array.isArray(decision.lease.scope.paths)) {
    throw new Error(`Policy decision ${decision.id} did not issue a file path lease`);
  }
  const targetPath = request.operation.target.uri.replace("file://", "");
  if (!decision.lease.scope.paths.includes(targetPath)) {
    throw new Error(`Policy lease does not include target path ${targetPath}`);
  }
  const contents = await readFile(targetPath, "utf8");
  return { contents, bytes: Buffer.byteLength(contents, "utf8") };
}

export type FileWriteResult = {
  path: string;
  bytes: number;
};

export async function writeLocalFileThroughPolicy(request: ToolRequest, decision: PolicyDecision, contents: string): Promise<FileWriteResult> {
  if (decision.decision !== "allow") {
    throw new Error(`Policy did not allow request ${request.id}: ${decision.reason}`);
  }
  assertLeaseActive(decision);
  assertLeaseScopeMatchesRequest(request, decision);
  if (!decision.lease?.scope || !Array.isArray(decision.lease.scope.paths)) {
    throw new Error(`Policy decision ${decision.id} did not issue a file path lease`);
  }
  const targetPath = request.operation.target.uri.replace("file://", "");
  if (!decision.lease.scope.paths.includes(targetPath)) {
    throw new Error(`Policy lease does not include target path ${targetPath}`);
  }
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, contents);
  return { path: targetPath, bytes: Buffer.byteLength(contents, "utf8") };
}
