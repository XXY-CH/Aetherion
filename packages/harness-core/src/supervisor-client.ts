import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export type SupervisorRpcRequest = {
  id: string;
  method: "workspace.init" | "event.append" | "tool.evaluate" | "lease.issue" | "file.read" | "file.write" | "trace.replay";
  workspace_root: string;
  workspace_id?: string;
  run_id?: string;
  path?: string;
  verb?: "read" | "write";
  approved?: boolean;
  contents?: string;
  event_type?: string;
  summary?: string;
};

export type SupervisorRpcResponse = {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: string;
};

export async function callSupervisorRpc(repoRoot: string, request: SupervisorRpcRequest): Promise<SupervisorRpcResponse> {
  const binary = join(repoRoot, "target", "debug", "aetherion-supervisor");
  const command = existsSync(binary) ? binary : "cargo";
  const args = existsSync(binary) ? ["rpc"] : ["run", "--quiet", "--bin", "aetherion-supervisor", "--", "rpc"];
  const child = spawn(command, args, {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  child.stdin.end(`${JSON.stringify(request)}\n`);

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  if (exitCode !== 0) {
    throw new Error(`supervisor rpc failed: ${stderr.trim()}`);
  }
  const line = stdout.split("\n").find(Boolean);
  if (!line) {
    throw new Error("supervisor rpc returned no response");
  }
  const response = JSON.parse(line) as SupervisorRpcResponse;
  if (response.error) {
    throw new Error(`supervisor rpc ${request.method} failed: ${response.error}`);
  }
  return response;
}

export function rpcResult<T extends Record<string, unknown>>(response: SupervisorRpcResponse): T {
  if (!response.result || typeof response.result !== "object" || Array.isArray(response.result)) {
    throw new Error(`supervisor rpc response ${response.id} did not include an object result`);
  }
  return response.result as T;
}
