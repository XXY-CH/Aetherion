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
import { createWorkspace, writeWorkspaceRegistry, workspaceIdForRoot, readEvents } from "../src/index.ts";
import type { AgentRuntimeInvocationArtifact } from "../src/agent-runtime.ts";
import { createWebFetchRequest, evaluateSeedPolicy, createFileReadRequest } from "../src/policy.ts";
import { fetchUrlThroughPolicy } from "../src/network-fetch.ts";
import { readLocalFileThroughPolicy } from "../src/local-file.ts";

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

function createSingleToolProvider(toolName: string, args: Record<string, unknown>) {
  const resultBase = {
    output_text: "",
    tool_calls: [{ id: `call_${toolName}`, name: toolName, arguments: JSON.stringify(args) }],
    finish_reason: "tool_call" as const,
    refusal_present: false,
    usage: {
      input_tokens: 1,
      output_tokens: 1,
      total_tokens: 2,
      usage_source: "locally_estimated" as const
    }
  };
  return {
    provider_ref: "tool-call-provider",
    model_ref: "tool-call-provider",
    network_capable: false,
    async invoke() {
      return {
        output_text: "done",
        finish_reason: "stop" as const,
        refusal_present: false,
        tool_calls_present: false,
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
          usage_source: "locally_estimated" as const
        }
      };
    },
    async invokeWithTools(request: { conversation?: Array<{ role: string }> }, _tools: unknown[], onDelta: (delta: { type: "text_delta"; text: string } | { type: "done"; result: typeof resultBase }) => void) {
      if ((request.conversation ?? []).some((message) => message.role === "tool")) {
        const doneResult = {
          ...resultBase,
          output_text: `completed ${toolName}`,
          tool_calls: []
        };
        onDelta({ type: "text_delta", text: doneResult.output_text });
        onDelta({ type: "done", result: doneResult });
        return doneResult;
      }
      onDelta({ type: "done", result: resultBase });
      return resultBase;
    }
  } as const;
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

test("search_files does not treat glob input as a shell command", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("search-injection");
  await writeFile(join(workspaceRoot, "README.md"), "needle present\n", "utf8");
  const provider = createSingleToolProvider("search_files", { pattern: "needle", glob: "README.md$(touch HACKED)" }) as any;
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 2 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 2 };
  const events = await drainLoop(config, state, "search needle", alwaysApprove);
  const result = events.find((event) => event.type === "tool_result" && (event as Extract<LoopEvent, { type: "tool_result" }>).toolName === "search_files") as Extract<LoopEvent, { type: "tool_result" }>;
  assert.ok(result, "search should yield a result");
  assert.ok(result.success, "search should succeed");
  assert.ok(!result.result.includes("HACKED"), "malicious glob must not execute as shell");
  await assert.rejects(readFile(join(workspaceRoot, "HACKED"), "utf8"));
  const ledgerTypes = (await readEvents(state.workspace)).map((event) => event.event_type);
  assert.ok(ledgerTypes.includes("tool.requested"));
  assert.ok(ledgerTypes.includes("risk.composed"));
  assert.ok(ledgerTypes.includes("policy.decided"));
});

test("list_files returns nested workspace entries without shelling out", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("list-files");
  await mkdir(join(workspaceRoot, "src", "nested"), { recursive: true });
  await writeFile(join(workspaceRoot, "src", "a.ts"), "export const a = 1;\n", "utf8");
  await writeFile(join(workspaceRoot, "src", "nested", "b.ts"), "export const b = 2;\n", "utf8");
  const provider = createSingleToolProvider("list_files", { path: "src", recursive: true }) as any;
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({ repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 2 });
  const config: AgentLoopConfig = { repoRoot, workspaceRoot, provider, modelRef: "stub-deterministic-v1", toolRegistry, invocation, maxLoopDepth: 2 };
  const events = await drainLoop(config, state, "list files in src", alwaysApprove);
  const result = events.find((event) => event.type === "tool_result" && (event as Extract<LoopEvent, { type: "tool_result" }>).toolName === "list_files") as Extract<LoopEvent, { type: "tool_result" }>;
  assert.ok(result, "list_files should yield a result");
  assert.ok(result.success, "list_files should succeed");
  assert.match(result.result, /src\/a\.ts/);
  assert.match(result.result, /src\/nested\/b\.ts/);
});

test("scan and read both require policy leases", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("shared-policy");
  await mkdir(join(workspaceRoot, "src"), { recursive: true });
  await writeFile(join(workspaceRoot, "src", "x.txt"), "needle\n", "utf8");

  const scanProvider = createSingleToolProvider("search_files", { pattern: "needle", glob: "src/**" }) as any;
  const scanToolRegistry = createV1ToolRegistry();
  const scanState = await startAgentLoopState({ repoRoot, workspaceRoot, provider: scanProvider, modelRef: "stub-deterministic-v1", toolRegistry: scanToolRegistry, invocation, maxLoopDepth: 2 });
  const scanConfig: AgentLoopConfig = { repoRoot, workspaceRoot, provider: scanProvider, modelRef: "stub-deterministic-v1", toolRegistry: scanToolRegistry, invocation, maxLoopDepth: 2 };
  const scanEvents = await drainLoop(scanConfig, scanState, "search needle", alwaysApprove);
  assert.ok(scanEvents.some((event) => event.type === "tool_result" && (event as Extract<LoopEvent, { type: "tool_result" }>).toolName === "search_files"));

  const readRequest = createFileReadRequest("run_shared_policy", join(workspaceRoot, "src", "x.txt"));
  const readDecision = evaluateSeedPolicy(workspaceRoot, readRequest);
  const readResult = await readLocalFileThroughPolicy(readRequest, readDecision);
  assert.match(readResult.contents, /needle/);
});
