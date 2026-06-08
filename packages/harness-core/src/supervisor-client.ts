import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";

export type SupervisorRpcRequest = {
  id: string;
  method: "workspace.init" | "supervisor.status" | "event.append" | "run.resume.evaluate" | "security.taint.evaluate" | "surface.outbox.evaluate" | "file.read.traced" | "child.file.read" | "file.write.prepare" | "file.write.commit";
  workspace_root: string;
  auth_token?: string;
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

export async function callSupervisorRpc(repoRoot: string, request: SupervisorRpcRequest, options?: { timeoutMs?: number; socketPath?: string; authToken?: string }): Promise<SupervisorRpcResponse> {
  if (options?.socketPath) {
    return callSupervisorSocketRpc(request, options.socketPath, options.timeoutMs, options.authToken);
  }
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
  const line = singleSupervisorResponseLine(request, stdout);
  const response = parseSupervisorResponseEnvelope(request, line);
  if (response.error) {
    throw new Error(`supervisor rpc ${request.method} failed: ${response.error}`);
  }
  return response;
}

async function callSupervisorSocketRpc(request: SupervisorRpcRequest, socketPath: string, timeoutMs = 5000, authToken?: string): Promise<SupervisorRpcResponse> {
  const socket = createConnection(socketPath);
  socket.setEncoding("utf8");
  let stdout = "";
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    socket.destroy(new Error("supervisor socket rpc timed out"));
  }, timeoutMs);
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
    const socketRequest = authToken ? { ...request, auth_token: authToken } : request;
    socket.write(`${JSON.stringify(socketRequest)}\n`);
    socket.end();
    await new Promise<void>((resolve, reject) => {
      socket.on("data", (chunk) => {
        stdout += chunk;
      });
      socket.once("end", resolve);
      socket.once("error", reject);
    });
  } catch (error) {
    throw new Error(`supervisor socket rpc ${timedOut ? "timed out" : "failed"}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
  const line = singleSupervisorResponseLine(request, stdout);
  const response = parseSupervisorResponseEnvelope(request, line);
  if (response.error) {
    throw new Error(`supervisor socket rpc ${request.method} failed: ${response.error}`);
  }
  return response;
}

function singleSupervisorResponseLine(request: SupervisorRpcRequest, stdout: string): string {
  const lines = stdout.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error(`supervisor rpc ${request.method} returned no response`);
  }
  if (lines.length > 1) {
    throw new Error(`supervisor rpc ${request.method} returned multiple response lines`);
  }
  return lines[0];
}

function parseSupervisorResponseEnvelope(request: SupervisorRpcRequest, line: string): SupervisorRpcResponse {
  assertNoDuplicateSupervisorEnvelopeFields(request, line);
  const response = JSON.parse(line) as SupervisorRpcResponse;
  assertSupervisorResponseEnvelope(request, response);
  return response;
}

function assertNoDuplicateSupervisorEnvelopeFields(request: SupervisorRpcRequest, line: string): void {
  const duplicates = duplicateTopLevelJsonObjectKeys(line);
  if (duplicates.length === 1) {
    throw new Error(`supervisor rpc ${request.method} response ${request.id} included duplicate envelope field ${duplicates[0]}`);
  }
  if (duplicates.length > 1) {
    throw new Error(`supervisor rpc ${request.method} response ${request.id} included duplicate envelope fields ${duplicates.join(", ")}`);
  }
}

function duplicateTopLevelJsonObjectKeys(line: string): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  let index = skipJsonWhitespace(line, 0);
  if (line[index] !== "{") {
    return [];
  }
  index += 1;

  while (index < line.length) {
    index = skipJsonWhitespace(line, index);
    if (line[index] === "}") {
      return [...duplicates];
    }
    if (line[index] !== "\"") {
      return [];
    }
    const keyEnd = jsonStringEnd(line, index);
    if (keyEnd === -1) {
      return [];
    }
    let key: string;
    try {
      key = JSON.parse(line.slice(index, keyEnd)) as string;
    } catch {
      return [];
    }
    if (seen.has(key)) {
      duplicates.add(key);
    } else {
      seen.add(key);
    }
    index = skipJsonWhitespace(line, keyEnd);
    if (line[index] !== ":") {
      return [];
    }
    index = skipJsonValue(line, index + 1);
    if (index === -1) {
      return [];
    }
    index = skipJsonWhitespace(line, index);
    if (line[index] === ",") {
      index += 1;
      continue;
    }
    if (line[index] === "}") {
      return [...duplicates];
    }
    return [];
  }
  return [];
}

function skipJsonWhitespace(line: string, index: number): number {
  while (index < line.length && /\s/.test(line[index])) {
    index += 1;
  }
  return index;
}

function skipJsonValue(line: string, index: number): number {
  let depth = 0;
  for (let cursor = skipJsonWhitespace(line, index); cursor < line.length; cursor += 1) {
    const char = line[cursor];
    if (char === "\"") {
      const end = jsonStringEnd(line, cursor);
      if (end === -1) {
        return -1;
      }
      cursor = end - 1;
      continue;
    }
    if (char === "{" || char === "[") {
      depth += 1;
      continue;
    }
    if (char === "}" || char === "]") {
      if (depth === 0) {
        return cursor;
      }
      depth -= 1;
      continue;
    }
    if (char === "," && depth === 0) {
      return cursor;
    }
  }
  return line.length;
}

function jsonStringEnd(line: string, index: number): number {
  for (let cursor = index + 1; cursor < line.length; cursor += 1) {
    if (line[cursor] === "\\") {
      cursor += 1;
      continue;
    }
    if (line[cursor] === "\"") {
      return cursor + 1;
    }
  }
  return -1;
}

function assertSupervisorResponseEnvelope(request: SupervisorRpcRequest, response: SupervisorRpcResponse): void {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error(`supervisor rpc ${request.method} returned a non-object response`);
  }
  const envelope = response as Record<string, unknown>;
  if (envelope.jsonrpc !== "2.0") {
    throw new Error(`supervisor rpc ${request.method} returned invalid jsonrpc version`);
  }
  if (envelope.id !== request.id) {
    throw new Error(`supervisor rpc ${request.method} response id mismatch: expected ${request.id}, got ${String(envelope.id)}`);
  }
  const hasResult = "result" in envelope;
  const hasError = "error" in envelope;
  if (!hasResult && !hasError) {
    throw new Error(`supervisor rpc ${request.method} response ${request.id} included neither result nor error`);
  }
  if (hasResult && hasError) {
    throw new Error(`supervisor rpc ${request.method} response ${request.id} included both result and error`);
  }
  if (hasError && (typeof envelope.error !== "string" || envelope.error.length === 0)) {
    throw new Error(`supervisor rpc ${request.method} response ${request.id} included an invalid error`);
  }
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
