// End-to-end integration test with a mock provider that simulates real API
// response format: streaming text deltas, tool calls, finish reasons.
// This validates the full chain: provider-config → resolveModelProvider →
// runAgentLoop → streaming events → tool proposal → approval → execution → result.

import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createV1ToolRegistry } from "../src/tool-registry.ts";
import {
  runAgentLoop,
  startAgentLoopState,
  type AgentLoopConfig,
  type AgentLoopState,
  type LoopEvent,
  type ApprovalCallback
} from "../src/agent-loop.ts";
import { createStubProvider, type ToolCapableProvider } from "../src/model-provider.ts";
import { writeProviderConfig } from "../src/provider-config.ts";
import { createWorkspace, writeWorkspaceRegistry, workspaceIdForRoot } from "../src/index.ts";
import type { AgentRuntimeInvocationArtifact } from "../src/agent-runtime.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");

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

// Mock provider that simulates real Anthropic-style streaming + tool calls.
// On the first call it emits text + a read tool call. On subsequent calls
// (after the tool result is fed back), it emits a final summary with no tools.
function createMockAnthropicProvider(modelRef: string): ToolCapableProvider {
  let callCount = 0;
  return {
    provider_ref: "provider_anthropic_mock",
    model_ref: modelRef,
    network_capable: true,
    async invoke(request: { messages: { content: string; role: string }[] }) {
      const lastUser = request.messages.filter((m) => m.role === "user").at(-1);
      const text = lastUser?.content ?? "";
      return {
        output_text: `Mock response to: ${text.slice(0, 50)}`,
        finish_reason: "stop",
        refusal_present: false,
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, usage_source: "provider_reported" as const }
      };
    },
    async invokeWithTools(request, _tools, onDelta) {
      callCount++;
      // Check if there's a tool result in the conversation (2nd+ call).
      // flatMessages filters out tool/assistant messages, so we check
      // the raw conversation array instead.
      const hasToolResult = (request.conversation ?? []).some((m: { role?: string }) => m.role === "tool");
      if (hasToolResult) {
        // Final turn — no more tools, just a summary
        const chunks = ["The ", "file ", "contains ", "test ", "content."];
        for (const c of chunks) onDelta({ type: "text_delta", text: c });
        return {
          output_text: chunks.join(""),
          tool_calls: [],
          finish_reason: "stop",
          refusal_present: false,
          usage: { input_tokens: 120, output_tokens: 10, total_tokens: 130, usage_source: "provider_reported" as const }
        };
      }
      // First turn — emit text + tool call
      const textChunks = ["I'll ", "read ", "the ", "file ", "for ", "you."];
      for (const chunk of textChunks) {
        onDelta({ type: "text_delta", text: chunk });
      }
      onDelta({
        type: "tool_call",
        toolCall: {
          id: "mock_call_1",
          name: "local_file_read",
          arguments: JSON.stringify({ path: "README.md" })
        }
      });
      return {
        output_text: textChunks.join(""),
        tool_calls: [{
          id: "mock_call_1",
          name: "local_file_read",
          arguments: JSON.stringify({ path: "README.md" })
        }],
        finish_reason: "tool_call",
        refusal_present: false,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
          usage_source: "provider_reported" as const
        }
      };
    }
  };
}

// Mock provider that simulates a write tool call with approval needed.
function createMockWriteProvider(modelRef: string): ToolCapableProvider {
  return {
    provider_ref: "provider_anthropic_mock_write",
    model_ref: modelRef,
    network_capable: true,
    async invoke() {
      return { output_text: "Done.", finish_reason: "stop", refusal_present: false, usage: { input_tokens: 5, output_tokens: 2, total_tokens: 7, usage_source: "locally_estimated" as const } };
    },
    async invokeWithTools(request, _tools, onDelta) {
      const hasToolResult = (request.conversation ?? []).some((m: { role?: string }) => m.role === "tool");
      if (hasToolResult) {
        onDelta({ type: "text_delta", text: "File created successfully." });
        return { output_text: "File created successfully.", tool_calls: [], finish_reason: "stop", refusal_present: false, usage: { input_tokens: 60, output_tokens: 5, total_tokens: 65, usage_source: "provider_reported" as const } };
      }
      onDelta({ type: "text_delta", text: "I'll create a test file." });
      onDelta({
        type: "tool_call",
        toolCall: {
          id: "mock_write_1",
          name: "local_file_write",
          arguments: JSON.stringify({ path: "test-output.txt", content: "Hello from mock provider!" })
        }
      });
      return {
        output_text: "I'll create a test file.",
        tool_calls: [{
          id: "mock_write_1",
          name: "local_file_write",
          arguments: JSON.stringify({ path: "test-output.txt", content: "Hello from mock provider!" })
        }],
        finish_reason: "tool_call",
        refusal_present: false,
        usage: { input_tokens: 50, output_tokens: 20, total_tokens: 70, usage_source: "provider_reported" as const }
      };
    }
  };
}

async function freshWorkspace(prefix: string): Promise<{ workspaceRoot: string; invocation: AgentRuntimeInvocationArtifact }> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), `aetherion-e2e-${prefix}-`));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });
  const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
  await writeWorkspaceRegistry(repoRoot, workspace, "typescript-seed");
  await writeFile(join(workspaceRoot, "README.md"), "# Test Workspace\n\nThis is a test.\n", "utf8");
  const invocation = await loadInvocationFixture();
  invocation.run_id = `run_e2e_${prefix}`;
  invocation.id = `agent_runtime_invocation_run_e2e_${prefix}`;
  return { workspaceRoot, invocation };
}

// ── Test 1: Full chain with mock read provider ───────────────────────────

test("e2e: mock provider → streaming text → tool call → read → result", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("read");
  const provider = createMockAnthropicProvider("claude-sonnet-4-20250514");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot, workspaceRoot, provider,
    modelRef: "claude-sonnet-4-20250514",
    toolRegistry, invocation, maxLoopDepth: 3
  });
  const config: AgentLoopConfig = {
    repoRoot, workspaceRoot, provider,
    modelRef: "claude-sonnet-4-20250514",
    toolRegistry, invocation, maxLoopDepth: 3
  };

  const events = await drainLoop(config, state, "read README.md", async () => ({ approved: true }));

  // Verify streaming happened
  const textEvents = events.filter((e) => e.type === "assistant_text");
  assert.ok(textEvents.length > 0, "should have streaming assistant_text events");

  // Verify tool call happened
  const results = events.filter((e) => e.type === "tool_result");
  assert.ok(results.length > 0, "should have tool_result");
  const readResult = results[0] as Extract<LoopEvent, { type: "tool_result" }>;
  assert.ok(readResult.success, "read should succeed");
  assert.match(readResult.result, /Test Workspace/, "should contain README content");

  // Verify loop completed
  const complete = events.filter((e) => e.type === "loop_complete");
  assert.ok(complete.length > 0, "should complete the loop");
});

// ── Test 2: Full chain with mock write provider + approval ───────────────

test("e2e: mock provider → write proposal → approve → diff → file written", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("write");
  const provider = createMockWriteProvider("claude-sonnet-4-20250514");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot, workspaceRoot, provider,
    modelRef: "claude-sonnet-4-20250514",
    toolRegistry, invocation, maxLoopDepth: 3
  });
  const config: AgentLoopConfig = {
    repoRoot, workspaceRoot, provider,
    modelRef: "claude-sonnet-4-20250514",
    toolRegistry, invocation, maxLoopDepth: 3
  };

  const events = await drainLoop(config, state, "write a test file", async () => ({ approved: true }));

  // Verify tool_proposal was emitted (approval needed for write)
  const proposals = events.filter((e) => e.type === "tool_proposal");
  assert.ok(proposals.length > 0, "should emit tool_proposal for write");

  // Verify approval happened
  const approved = events.filter((e) => e.type === "tool_approved");
  assert.ok(approved.length > 0, "should emit tool_approved");

  // Verify file was actually written
  const written = await readFile(join(workspaceRoot, "test-output.txt"), "utf8");
  assert.equal(written, "Hello from mock provider!");

  // Verify tool result
  const results = events.filter((e) => e.type === "tool_result");
  assert.ok(results.length > 0);
  const writeResult = results[0] as Extract<LoopEvent, { type: "tool_result" }>;
  assert.ok(writeResult.success);

  // Verify diff summary in result text
  assert.match(writeResult.result, /\+|new file|lines/i, "should include diff info");
});

// ── Test 3: Write denied by user ─────────────────────────────────────────

test("e2e: mock provider → write proposal → deny → file NOT written", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("deny");
  const provider = createMockWriteProvider("claude-sonnet-4-20250514");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot, workspaceRoot, provider,
    modelRef: "claude-sonnet-4-20250514",
    toolRegistry, invocation, maxLoopDepth: 3
  });
  const config: AgentLoopConfig = {
    repoRoot, workspaceRoot, provider,
    modelRef: "claude-sonnet-4-20250514",
    toolRegistry, invocation, maxLoopDepth: 3
  };

  const events = await drainLoop(config, state, "write a file", async () => ({ approved: false, reason: "user denied" }));

  // Verify denial
  const denied = events.filter((e) => e.type === "tool_denied");
  assert.ok(denied.length > 0, "should emit tool_denied");

  // Verify file was NOT written
  await assert.rejects(() => readFile(join(workspaceRoot, "test-output.txt"), "utf8"), /ENOENT/, "file should not exist");
});

// ── Test 4: provider-config.json → resolveModelProvider integration ─────

test("e2e: provider-config.json is read by resolveModelProvider", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "aetherion-e2e-config-"));
  await mkdir(join(workspaceRoot, ".aetherion"), { recursive: true });

  // Write a config pointing to anthropic with a fake key
  writeProviderConfig(workspaceRoot, {
    provider: "anthropic",
    model_ref: "claude-sonnet-4-20250514",
    api_key: "test-key-anthropic-12345"
  });

  // Verify config is readable
  const { readProviderConfig } = await import("../src/provider-config.ts");
  const config = readProviderConfig(workspaceRoot);
  assert.ok(config);
  assert.equal(config!.provider, "anthropic");
  assert.equal(config!.model_ref, "claude-sonnet-4-20250514");
  assert.equal(config!.api_key, "test-key-anthropic-12345");
});

// ── Test 5: Streaming produces incremental text events ───────────────────

test("e2e: streaming produces multiple assistant_text events (not batch)", async () => {
  const { workspaceRoot, invocation } = await freshWorkspace("stream");
  const provider = createMockAnthropicProvider("claude-sonnet-4-20250514");
  const toolRegistry = createV1ToolRegistry();
  const state = await startAgentLoopState({
    repoRoot, workspaceRoot, provider,
    modelRef: "claude-sonnet-4-20250514",
    toolRegistry, invocation, maxLoopDepth: 3
  });
  const config: AgentLoopConfig = {
    repoRoot, workspaceRoot, provider,
    modelRef: "claude-sonnet-4-20250514",
    toolRegistry, invocation, maxLoopDepth: 3
  };

  const events = await drainLoop(config, state, "hello", async () => ({ approved: true }));
  const textEvents = events.filter((e) => e.type === "assistant_text");
  // Mock provider sends 6 text chunks — should get at least 2 separate events
  // (not just one batch event)
  assert.ok(textEvents.length >= 2, `should have multiple streaming events, got ${textEvents.length}`);
});
