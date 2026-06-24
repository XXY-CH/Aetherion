import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createV1ToolRegistry, parseToolArguments } from "../src/tool-registry.ts";
import {
  runAgentLoop,
  startAgentLoopState,
  type AgentLoopConfig,
  type AgentLoopState,
  type LoopEvent,
  type ApprovalCallback
} from "../src/agent-loop.ts";
import { createStubProvider } from "../src/model-provider.ts";
import { createWorkspace, writeWorkspaceRegistry, workspaceIdForRoot } from "../src/index.ts";
import type { AgentRuntimeInvocationArtifact } from "../src/agent-runtime.ts";
import { createWebFetchRequest, evaluateSeedPolicy } from "../src/policy.ts";
import { fetchUrlThroughPolicy } from "../src/network-fetch.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");
const alwaysApprove: ApprovalCallback = async () => ({ approved: true });

async function loadInvocationFixture(): Promise<AgentRuntimeInvocationArtifact> {
  const raw = await readFile(join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json"), "utf8");
  return JSON.parse(raw) as AgentRuntimeInvocationArtifact;
}

async function drainLoop(config: AgentLoopConfig, state: AgentLoopState, input: string, approval: ApprovalCallback): Promise<LoopEvent[]> {
  const events: LoopEvent[] = [];
  for await (const event of runAgentLoop(config, state, input, approval)) {
    events.push(event);
  }
  return events;
}

async function freshWorkspace(prefix: string): Promise<{ workspaceRoot: string; invocation: AgentRuntimeInvocationArtifact }> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), `aetherion-fetch-${prefix}-`));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  const invocation = await loadInvocationFixture();
  invocation.run_id = "run_fetch";
  invocation.id = "agent_runtime_invocation_run_fetch";
  return { workspaceRoot, invocation };
}

test("web_fetch registry entry exists with verb=fetch and url parameter", () => {
  const registry = createV1ToolRegistry();
  const fetch = registry.get("web_fetch");
  assert.ok(fetch, "web_fetch must be in the V1 registry");
  assert.equal(fetch!.verb, "fetch");
  const params = fetch!.parameters as { properties: Record<string, { type: string }>; required: string[] };
  assert.ok(params.properties.url, "must have a url parameter");
  assert.equal(params.properties.url.type, "string");
  assert.ok(params.required.includes("url"), "url must be required");
});

test("parseToolArguments extracts url", () => {
  const args = parseToolArguments({ url: "https://example.com" });
  assert.equal(args.url, "https://example.com");
});

test("stub provider emits web_fetch on fetch intent", () => {
  const registry = createV1ToolRegistry();
  const tools = registry.toProviderFormat("stub");
  const toolNames = tools.map((t: Record<string, unknown>) => {
    const t2 = t as { name?: string };
    return t2.name ?? "";
  });
  assert.ok(toolNames.includes("web_fetch"));
});

test("web_fetch returns page content from a local server", async () => {
  // Spin up a tiny HTTP server that returns a known body.
  const server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("hello_from_server");
  });
  await new Promise<void>((resolveFn) => server.listen(0, "127.0.0.1", resolveFn));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const url = `http://127.0.0.1:${port}/`;

  try {
    const { workspaceRoot, invocation } = await freshWorkspace("server");
    const provider = createStubProvider("stub-deterministic-v1");
    const toolRegistry = createV1ToolRegistry();
    const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 2 });
    const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 2 };
    const events = await drainLoop(config, state, `fetch ${url}`, alwaysApprove);
    const results = events.filter((e) => e.type === "tool_result");
    assert.ok(results.length > 0, "must yield a tool_result");
    const result = results[0] as Extract<LoopEvent, { type: "tool_result" }>;
    assert.ok(result.success, "fetch should succeed");
    assert.match(result.result, /hello_from_server/);
  } finally {
    server.close();
  }
});

test("web_fetch policy denies external URLs", async () => {
  const request = createWebFetchRequest("run_fetch_external", "https://example.com");
  const decision = evaluateSeedPolicy("/tmp/aetherion-web-fetch", request);
  assert.equal(decision.decision, "deny");
  assert.match(decision.reason, /loopback/i);
});

test("fetchUrlThroughPolicy rejects lease tool mismatch", async () => {
  const request = createWebFetchRequest("run_fetch_lease", "http://127.0.0.1:1234/");
  const decision = evaluateSeedPolicy("/tmp/aetherion-web-fetch", request);
  if (!decision.lease) {
    throw new Error("expected fetch decision to issue a lease");
  }
  const tampered = {
    ...decision,
    lease: {
      ...decision.lease,
      scope: {
        ...decision.lease.scope,
        tools: ["filesystem.read"]
      }
    }
  };
  await assert.rejects(
    () => fetchUrlThroughPolicy(request, tampered),
    /network\.fetch|tool/i
  );
});
