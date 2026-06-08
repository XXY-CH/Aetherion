import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

export type SupervisorRpcRequest = {
  id: string;
  method: "workspace.init" | "event.append" | "run.resume.evaluate" | "security.taint.evaluate" | "surface.outbox.evaluate" | "file.read.traced" | "child.file.read" | "file.write.prepare" | "file.write.commit";
  workspace_root: string;
  workspace_id?: string;
  run_id?: string;
  source?: "manual" | "file" | "deadline";
  trigger_id?: string;
  source_kind?: string;
  visibility?: "dm" | "group" | "public";
  adapter?: "telegram" | "slack" | "local_fixture";
  path?: string;
  verb?: "read" | "write";
  approved?: boolean;
  consent_record_json?: string;
  consent_payload_ref?: string;
  contents?: string;
  event_type?: string;
  summary?: string;
  payload_ref?: string;
};

export type SupervisorRpcResponse = {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: string;
};

export async function callSupervisorRpc(repoRoot: string, request: SupervisorRpcRequest, options?: { timeoutMs?: number }): Promise<SupervisorRpcResponse> {
  const binary = join(repoRoot, "target", "debug", "aetherion-supervisor");
  const binaryIsFresh = isSupervisorBinaryFresh(repoRoot, binary);
  const command = binaryIsFresh ? binary : "cargo";
  const args = binaryIsFresh ? ["rpc"] : ["run", "--quiet", "--bin", "aetherion-supervisor", "--", "rpc"];
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

  let timedOut = false;
  const timeout = options?.timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, options.timeoutMs)
    : undefined;
  let exitCode: number | null;
  try {
    exitCode = await new Promise<number | null>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  if (exitCode !== 0) {
    throw new Error(`supervisor rpc ${timedOut ? "timed out" : "failed"}: ${stderr.trim()}`);
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

function isSupervisorBinaryFresh(repoRoot: string, binary: string): boolean {
  if (!existsSync(binary)) {
    return false;
  }
  const binaryMtime = statSync(binary).mtimeMs;
  return [
    join(repoRoot, "crates", "supervisor", "Cargo.toml"),
    join(repoRoot, "crates", "supervisor", "src", "lib.rs"),
    join(repoRoot, "crates", "supervisor", "src", "main.rs")
  ].every((source) => statSync(source).mtimeMs <= binaryMtime);
}

export function rpcResult<T extends Record<string, unknown>>(response: SupervisorRpcResponse): T {
  if (!response.result || typeof response.result !== "object" || Array.isArray(response.result)) {
    throw new Error(`supervisor rpc response ${response.id} did not include an object result`);
  }
  return response.result as T;
}
