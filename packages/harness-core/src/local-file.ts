import { readFile } from "node:fs/promises";
import type { PolicyDecision, ToolRequest } from "./policy.ts";

export type FileReadResult = {
  contents: string;
  bytes: number;
};

export async function readLocalFileThroughPolicy(request: ToolRequest, decision: PolicyDecision): Promise<FileReadResult> {
  if (decision.decision !== "allow") {
    throw new Error(`Policy did not allow request ${request.id}: ${decision.reason}`);
  }
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
