// Agent Loop Engine.
//
// The iterative tool-calling loop that turns a single user request into a
// multi-turn conversation: model -> tool_call -> policy -> (approval) -> lease
// -> execute -> verify -> ledger -> feed tool result back to model -> repeat,
// until the model answers without a tool call or the loop budget is exhausted.
//
// This engine owns NO policy, lease, or filesystem logic of its own. Every
// side effect is delegated to the existing seed pipeline:
//   - createFileReadRequest / createFileWriteRequest (policy.ts)
//   - composeRisk (risk.ts)
//   - evaluateSeedPolicy / approveWriteWithConsent (policy.ts)
//   - createApprovalCard (approval.ts)
//   - createWriteConsentRecord / writeConsentRecordArtifact (consent.ts)
//   - readLocalFileThroughPolicy / writeLocalFileThroughPolicy (local-file.ts)
//   - verifyFileContains (verify.ts)
//   - appendEvent / eventRecord (ledger.ts)
//
// Security invariant (from AGENTS.md): model output can never authorize an
// action. A model tool call is only a *proposal*. Execution requires a fresh
// policy decision and, for writes, an explicit human approval that produces a
// matching ConsentRecord and scoped lease. Nothing in this file grants
// authority.

import { resolve } from "node:path";
import { appendEvent, createWorkspace, eventRecord, type EventRecord, type Workspace } from "./ledger.ts";
import {
  createRunManifest,
  recordRunEvent,
  completeRunManifest,
  workspaceIdForRoot,
  type RunManifest
} from "./workspace.ts";
import { createApprovalCard } from "./approval.ts";
import { createWriteConsentRecord, writeConsentRecordArtifact } from "./consent.ts";
import {
  approveWriteWithConsent,
  createFileReadRequest,
  createFileWriteRequest,
  evaluateSeedPolicy,
  type ConsentRecord,
  type PolicyDecision,
  type ToolRequest
} from "./policy.ts";
import { composeRisk } from "./risk.ts";
import { readLocalFileThroughPolicy, writeLocalFileThroughPolicy } from "./local-file.ts";
import { verifyFileContains } from "./verify.ts";
import { captureTreeSnapshot } from "./vcs/tree-snapshot.ts";
import {
  asToolCapable,
  isAssistantTurn,
  isToolResult,
  type LoopConversationMessage,
  type ModelProvider,
  type ModelStreamDelta,
  type ModelToolCall,
  type ModelToolCallResult
} from "./model-provider.ts";
import {
  createToolModeModelRequestArtifact,
  createAgentModelResponseArtifact,
  writeAgentModelRequestArtifact,
  writeAgentModelResponseArtifact
} from "./agent-runtime.ts";
import type { AgentRuntimeInvocationArtifact } from "./agent-runtime.ts";
import { parseToolArguments, type ToolRegistry } from "./tool-registry.ts";
import { createHash } from "node:crypto";

export type AgentLoopConfig = {
  repoRoot: string;
  workspaceRoot: string;
  provider: ModelProvider;
  modelRef: string;
  toolRegistry: ToolRegistry;
  invocation: AgentRuntimeInvocationArtifact;
  maxLoopDepth: number;
  maxOutputTokens: number;
  systemPrompt?: string;
};

export type AgentLoopState = {
  workspace: Workspace;
  runId: string;
  manifest: RunManifest;
  conversation: LoopConversationMessage[];
  totalTokens: number;
  totalToolCalls: number;
  eventCounter?: number;
};

// A proposed tool call awaiting a human decision. The approval callback receives
// this and returns a decision; writes additionally carry a synthesized ConsentRecord.
export type ToolCallProposal = {
  proposalId: string;
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  path: string;
  verb: "read" | "write" | "exec";
  riskLevel: "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
  decisionHint: "allow" | "ask" | "deny" | "sandbox_only";
  policyDecision?: PolicyDecision;
  // For writes only: the content the model proposed to write.
  proposedContent?: string;
};

export type LoopEvent =
  | { type: "loop_started"; runId: string; maxLoopDepth: number }
  | { type: "turn_started"; depth: number }
  | { type: "assistant_text"; content: string }
  | { type: "assistant_text_done"; content: string; usage?: { input_tokens: number; output_tokens: number; total_tokens: number } }
  | { type: "tool_proposal"; proposal: ToolCallProposal }
  | { type: "tool_approved"; proposalId: string }
  | { type: "tool_denied"; proposalId: string; reason: string }
  | { type: "tool_executing"; toolName: string; path: string }
  | { type: "tool_result"; toolCallId: string; toolName: string; path: string; result: string; success: boolean }
  | { type: "policy_denied"; toolCallId: string; toolName: string; reason: string }
  | { type: "loop_complete"; totalToolCalls: number; totalTokens: number; finalText: string }
  | { type: "error"; message: string; code: string };

export type ApprovalCallback = (proposal: ToolCallProposal) => Promise<{ approved: boolean; reason?: string }>;

export type AgentLoopStarterInput = {
  repoRoot: string;
  workspaceRoot: string;
  provider: ModelProvider;
  modelRef: string;
  toolRegistry: ToolRegistry;
  invocation: AgentRuntimeInvocationArtifact;
  runId?: string;
  maxLoopDepth?: number;
  maxOutputTokens?: number;
  systemPrompt?: string;
};

// Prepares the workspace + run manifest the loop will append to. Mirrors the
// setup in run-local.ts but for an open-ended agent loop.
export async function startAgentLoopState(input: AgentLoopStarterInput): Promise<AgentLoopState> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const workspaceId = workspaceIdForRoot(workspaceRoot);
  const workspace = await createWorkspace(workspaceRoot, workspaceId);
  const runId = input.runId ?? `run_agent_loop_${Date.now()}_${createHash("sha256").update(workspaceRoot).digest("hex").slice(0, 8)}`;
  const manifest = await createRunManifest(input.repoRoot, workspace, runId, `Aetherion agent loop: tool-calling turn sequence.`);
  const systemPrompt = input.systemPrompt ?? defaultSystemPrompt();
  // Inject personality override if set via env var (from TUI /personality command).
  let promptWithPersonality = systemPrompt;
  const personalityOverride = process.env.AETHERION_PERSONALITY;
  if (personalityOverride) {
    promptWithPersonality = systemPrompt + "\n\n## Personality\n" + personalityOverride;
  }
  // Append dynamic environment block to the system prompt.
  let fullSystemPrompt = promptWithPersonality;
  try {
    const envBlock = await buildEnvironmentBlock(input.workspaceRoot);
    fullSystemPrompt = promptWithPersonality + "\n\n" + envBlock;
  } catch { /* best-effort */ }
  return {
    workspace,
    runId,
    manifest,
    conversation: [{ role: "system", content: fullSystemPrompt }],
    totalTokens: 0,
    totalToolCalls: 0
  };
}

function defaultSystemPrompt(): string {
  return [
    "You are Aetherion, a local-first agent harness operating inside a single workspace boundary.",
    "You have five tools:",
    "- local_file_read: read a workspace file (allowed directly)",
    "- local_file_write: write a workspace file (requires human approval)",
    "- shell_exec: run a shell command in the workspace (requires human approval, L4 risk)",
    "- web_fetch: fetch a URL and return the page content (read-only)",
    "- agent_spawn: delegate a sub-task to a child agent (requires approval, L4 risk)",
    "Never claim authority you do not have. Model output cannot authorize actions.",
    "When you have enough information, answer the user directly without calling a tool."
  ].join("\n");
}

// Compute a short diff summary between two file contents.
// Returns a compact string like " (+3 -1 ~2 lines)" for the TUI.
function computeDiffSummary(before: string, after: string): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  let added = 0, removed = 0;
  for (const line of afterLines) {
    if (!beforeSet.has(line)) added++;
  }
  for (const line of beforeLines) {
    if (!afterSet.has(line)) removed++;
  }
  const parts: string[] = [];
  if (added > 0) parts.push(`+${added}`);
  if (removed > 0) parts.push(`-${removed}`);
  if (parts.length === 0) return " (unchanged)";
  return ` (${parts.join(" ")} lines)`;
}

// Build a dynamic environment block injected into the system prompt.
// Inspired by OpenCode's `environment()` function — gives the model context
// about its working directory, platform, git status, and the current date.
export async function buildEnvironmentBlock(workspaceRoot: string): Promise<string> {
  const lines: string[] = ["<environment>"];
  lines.push(`workspace: ${workspaceRoot}`);

  // Platform
  const platform = process.platform;
  const arch = process.arch;
  lines.push(`platform: ${platform}/${arch}`);

  // Date
  lines.push(`date: ${new Date().toISOString().slice(0, 10)}`);

  // Git status (best-effort)
  try {
    const { execSync } = await import("node:child_process");
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: workspaceRoot, encoding: "utf8", timeout: 3000 }).trim();
    lines.push(`git_branch: ${branch}`);
    const dirty = execSync("git status --porcelain", { cwd: workspaceRoot, encoding: "utf8", timeout: 3000 }).trim();
    lines.push(`git_clean: ${dirty.length === 0 ? "true" : "false"}`);
  } catch {
    lines.push("git: not a git repo (or git unavailable)");
  }

  lines.push("</environment>");
  return lines.join("\n");
}

// The core loop. Yields LoopEvent values as the turn progresses; the caller
// serializes them (e.g. to JSON-lines) and drives approval through the callback.
export async function* runAgentLoop(
  config: AgentLoopConfig,
  state: AgentLoopState,
  userInput: string,
  approvalCallback: ApprovalCallback
): AsyncGenerator<LoopEvent> {
  const toolCapable = asToolCapable(config.provider);
  const tools = config.toolRegistry.toProviderFormat(providerNameFor(config.provider));

  // Expand @-context references (@file:, @diff, @staged, @url:) before processing.
  let expandedInput = userInput;
  try {
    const { expandContextReferences } = await import("./context-refs.ts");
    const expansion = expandContextReferences(userInput, config.workspaceRoot);
    expandedInput = expansion.text;
  } catch { /* best-effort — use raw input */ }
  state.conversation.push({ role: "user", content: expandedInput });
  yield { type: "loop_started", runId: state.runId, maxLoopDepth: config.maxLoopDepth };

  let depth = 0;
  let lastAssistantText = "";

  try {
    while (depth < config.maxLoopDepth) {
      depth += 1;
      yield { type: "turn_started", depth };

      // Build a tool-mode request artifact (persisted as durable evidence that
      // tools were declared to the model this turn). The artifact records only
      // hashes; no raw prompt or credential is persisted.
      const declaredTools = config.toolRegistry.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        verb: tool.verb,
        parameters: tool.parameters
      }));
      const requestId = `agent_model_request_${sanitize(state.runId)}_${depth}_${randomHex(8)}`;
      const requestArtifact = createToolModeModelRequestArtifact({
        invocation: config.invocation,
        requestId,
        declaredTools
      });
      await writeAgentModelRequestArtifact(config.repoRoot, state.workspace, requestArtifact);
      await appendLoopEvent(config.repoRoot, state, "agent.model.requested", `Turn ${depth}: prepared tool-mode request ${requestId}.`, undefined);

      // Invoke the provider with tools, streaming text deltas.
      let streamingResult: ModelToolCallResult;
      const textChunks: string[] = [];
      try {
        streamingResult = await toolCapable.invokeWithTools(
          {
            provider_ref: config.provider.provider_ref,
            model_ref: config.modelRef,
            output_mode: "answer",
            messages: flatMessages(state.conversation),
            conversation: state.conversation,
            max_output_tokens: config.maxOutputTokens
          },
          tools,
          (delta: ModelStreamDelta) => {
            if (delta.type === "text_delta") {
              textChunks.push(delta.text);
              // Forward the delta to the caller as it arrives.
              queueMicrotask(() => { /* delta already captured in textChunks */ });
            }
          }
        );
      } catch (error) {
        yield { type: "error", message: error instanceof Error ? error.message : String(error), code: "provider_invocation_failed" };
        return;
      }

      // Emit any streamed assistant text.
      for (const chunk of textChunks) {
        yield { type: "assistant_text", content: chunk };
      }
      if (streamingResult.output_text.length > 0 || textChunks.length === 0) {
        // If the provider didn't stream deltas (e.g. stub) emit the full text once.
        if (textChunks.length === 0 && streamingResult.output_text.length > 0) {
          yield { type: "assistant_text", content: streamingResult.output_text };
        }
      }
      yield {
        type: "assistant_text_done",
        content: streamingResult.output_text,
        usage: streamingResult.usage
      };
      state.totalTokens += streamingResult.usage.total_tokens;
      lastAssistantText = streamingResult.output_text;

      // Record the response artifact (hash-only, non-authorizing).
      await recordResponseArtifact(config, state, requestArtifact, streamingResult, depth);

      // Append the assistant turn to the conversation so the next iteration
      // sees the model's tool calls.
      state.conversation.push({
        role: "assistant",
        content: streamingResult.output_text,
        tool_calls: streamingResult.tool_calls
      });

      // No tool calls -> the model answered; the loop is complete.
      if (streamingResult.finish_reason !== "tool_call" || streamingResult.tool_calls.length === 0) {
        await appendLoopEvent(config.repoRoot, state, "agent.loop.completed", `Agent loop completed after ${depth} turn(s); ${state.totalToolCalls} tool call(s).`, undefined);
        await completeRunManifest(config.repoRoot, state.workspace, state.manifest, "completed");
        yield { type: "loop_complete", totalToolCalls: state.totalToolCalls, totalTokens: state.totalTokens, finalText: lastAssistantText };
        return;
      }

      // Process each tool call: policy -> approval -> lease -> execute -> verify.
      for (const toolCall of streamingResult.tool_calls) {
        const outcome = yield* processToolCall(config, state, toolCall, approvalCallback, depth);
        if (outcome.kind === "fatal_error") {
          yield { type: "error", message: outcome.message, code: outcome.code };
          return;
        }
      }
    }

    // Loop budget exhausted.
    yield {
      type: "error",
      message: `Agent loop exceeded max depth of ${config.maxLoopDepth} without a final answer.`,
      code: "max_loop_depth_exceeded"
    };
    await appendLoopEvent(config.repoRoot, state, "agent.loop.depth_exceeded", `Agent loop exceeded max depth of ${config.maxLoopDepth}.`, undefined);
    await completeRunManifest(config.repoRoot, state.workspace, state.manifest, "blocked");
  } catch (error) {
    yield { type: "error", message: error instanceof Error ? error.message : String(error), code: "loop_unexpected_error" };
  }
}

type ToolCallOutcome =
  | { kind: "executed"; toolName: string; path: string; result: string; success: boolean }
  | { kind: "denied"; toolCallId: string; reason: string }
  | { kind: "policy_denied"; toolCallId: string; reason: string }
  | { kind: "fatal_error"; message: string; code: string };

// Processes a single model tool call through the full policy/approval/execute
// pipeline. Yields LoopEvents as it goes and returns the terminal outcome.
async function* processToolCall(
  config: AgentLoopConfig,
  state: AgentLoopState,
  toolCall: ModelToolCall,
  approvalCallback: ApprovalCallback,
  depth: number
): AsyncGenerator<LoopEvent, ToolCallOutcome> {
  const definition = config.toolRegistry.get(toolCall.name);
  if (!definition) {
    // Unknown tool: treat as policy denial, inform the model.
    const reason = `Tool '${toolCall.name}' is not in the declared registry.`;
    state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
    yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason };
    return { kind: "policy_denied", toolCallId: toolCall.id, reason };
  }

  // Shell exec is a sibling target family (AGENTS.md §13). It does not use
  // the file-system ToolRequest pipeline — it has its own approval + execute
  // path inline below. All other verbs (read/write) flow through the file pipeline.
  if (definition.verb === "exec") {
    // agent_spawn: delegate a sub-task to a child agent loop.
    if (toolCall.name === "agent_spawn") {
      const args = parseToolArguments(toolCall.arguments);
      if (!args.task) {
        const reason = `Tool '${toolCall.name}' call is missing required 'task' argument.`;
        state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
        yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason };
        return { kind: "policy_denied", toolCallId: toolCall.id, reason };
      }

      await appendLoopEvent(config.repoRoot, state, "tool.requested", `Model requested agent_spawn: ${args.task}.`, undefined);

      const proposal: ToolCallProposal = {
        proposalId: `approval_${state.runId}_spawn_${depth}`,
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        arguments: args,
        path: "",
        verb: "exec",
        riskLevel: "L4",
        decisionHint: "ask",
        policyDecision: undefined,
        proposedContent: args.task
      };
      yield { type: "tool_proposal", proposal };

      const decision = await approvalCallback(proposal);
      if (!decision.approved) {
        const reason = decision.reason ?? "User denied the agent_spawn approval.";
        state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: `Spawn denied: ${reason}`, success: false });
        yield { type: "tool_denied", proposalId: proposal.proposalId, reason };
        await appendLoopEvent(config.repoRoot, state, "tool.denied", `agent_spawn denied by user.`, undefined);
        return { kind: "denied", toolCallId: toolCall.id, reason };
      }

      yield { type: "tool_approved", proposalId: proposal.proposalId };
      await appendLoopEvent(config.repoRoot, state, "consent.recorded", `agent_spawn approved for: ${args.task}.`, undefined);
      yield { type: "tool_executing", toolName: toolCall.name, path: "" };

      // Run the child agent loop synchronously (nested).
      const childRunId = `${state.runId}_child_${depth}`;
      const childInvocation = {
        ...config.invocation,
        run_id: childRunId,
        id: `agent_runtime_invocation_${childRunId}`
      };
      const childConfig: AgentLoopConfig = {
        ...config,
        invocation: childInvocation,
        maxLoopDepth: Math.min(config.maxLoopDepth, 5)
      };
      const childState = await startAgentLoopState({
        repoRoot: config.repoRoot,
        workspaceRoot: config.workspaceRoot,
        provider: config.provider,
        modelRef: config.modelRef,
        toolRegistry: config.toolRegistry,
        invocation: childInvocation,
        maxLoopDepth: Math.min(config.maxLoopDepth, 5),
        maxOutputTokens: 512,
        systemPrompt: `You are a child agent handling a delegated sub-task. Be concise. Task: ${args.task}`
      });

      let childResult = "";
      let childSuccess = true;
      try {
        for await (const childEvent of runAgentLoop(childConfig, childState, args.task, async () => ({ approved: true }))) {
          if (childEvent.type === "assistant_text") {
            const at = childEvent as Extract<LoopEvent, { type: "assistant_text" }>;
            childResult += at.text;
          }
        }
        if (!childResult) {
          childResult = "(child agent produced no text output)";
        }
        childResult = truncateForModel(childResult);
      } catch (error) {
        childSuccess = false;
        childResult = `Child agent failed: ${error instanceof Error ? error.message : String(error)}`;
      }

      await appendLoopEvent(config.repoRoot, state, "tool.result", `agent_spawn completed: ${childResult.length} chars.`, undefined);
      state.totalToolCalls += 1;
      state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: childResult, success: childSuccess });
      yield { type: "tool_result", toolCallId: toolCall.id, toolName: toolCall.name, path: "", result: childResult, success: childSuccess };
      return { kind: "executed", toolName: toolCall.name, path: "", result: childResult, success: childSuccess };
    }

    const args = parseToolArguments(toolCall.arguments);
    if (!args.command) {
      const reason = `Tool '${toolCall.name}' call is missing required 'command' argument.`;
      state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
      yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason };
      return { kind: "policy_denied", toolCallId: toolCall.id, reason };
    }

    await appendLoopEvent(config.repoRoot, state, "tool.requested", `Model requested ${definition.name}: ${args.command}.`, undefined);

    const proposal: ToolCallProposal = {
      proposalId: `approval_${state.runId}_exec_${depth}`,
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      arguments: args,
      path: "",
      verb: "exec",
      riskLevel: "L4",
      decisionHint: "ask",
      policyDecision: undefined,
      proposedContent: args.command
    };
    yield { type: "tool_proposal", proposal };

    const decision = await approvalCallback(proposal);
    if (!decision.approved) {
      const reason = decision.reason ?? "User denied the shell exec approval.";
      state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: `Exec denied: ${reason}`, success: false });
      yield { type: "tool_denied", proposalId: proposal.proposalId, reason };
      await appendLoopEvent(config.repoRoot, state, "tool.denied", `Exec ${definition.name} denied by user.`, undefined);
      return { kind: "denied", toolCallId: toolCall.id, reason };
    }

    yield { type: "tool_approved", proposalId: proposal.proposalId };
    await appendLoopEvent(config.repoRoot, state, "consent.recorded", `Exec approved by user for: ${args.command}.`, undefined);

    yield { type: "tool_executing", toolName: toolCall.name, path: "" };

    // Capture pre-exec tree snapshot for VCS rollback. Best-effort.
    let preExecTreeHash: string | undefined;
    try {
      const snap = captureTreeSnapshot(config.workspaceRoot);
      preExecTreeHash = snap.tree_hash;
      await appendLoopEvent(config.repoRoot, state, "vcs.snapshot.created",
        `Pre-exec snapshot: ${preExecTreeHash}.`, preExecTreeHash);
    } catch { /* best-effort */ }

    const timeoutMs = Math.min(args.timeout_ms ?? 30_000, 60_000);
    let resultText: string;
    let success = true;
    try {
      const { execSync } = await import("node:child_process");
      const stdout = execSync(args.command, {
        cwd: config.workspaceRoot,
        timeout: timeoutMs,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 1024 * 1024
      });
      resultText = truncateForModel(stdout);
      await appendLoopEvent(config.repoRoot, state, "tool.result", `Exec completed: ${resultText.length} chars output.`, undefined);
    } catch (error) {
      success = false;
      const execError = error as NodeJS.ErrnoException & { stderr?: string; status?: number };
      const stderr = execError.stderr ?? "";
      const exitInfo = execError.status !== undefined ? ` (exit ${execError.status})` : "";
      resultText = truncateForModel(`Command failed${exitInfo}: ${execError.message}${stderr ? `\n${stderr}` : ""}`);
      await appendLoopEvent(config.repoRoot, state, "tool.result", resultText, undefined);
    }

    state.totalToolCalls += 1;
    state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: resultText, success });
    yield { type: "tool_result", toolCallId: toolCall.id, toolName: toolCall.name, path: "", result: resultText, success };
    return { kind: "executed", toolName: toolCall.name, path: "", result: resultText, success };
  }

  // Web fetch is a read-only network tool (L2 risk). It does not use the
  // file-system pipeline — no lease, no approval. The URL is fetched and the
  // response body returned as truncated text.
  if (definition.verb === "fetch") {
    const args = parseToolArguments(toolCall.arguments);
    if (!args.url) {
      const reason = `Tool '${toolCall.name}' call is missing required 'url' argument.`;
      state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
      yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason };
      return { kind: "policy_denied", toolCallId: toolCall.id, reason };
    }

    await appendLoopEvent(config.repoRoot, state, "tool.requested", `Model requested ${definition.name}: ${args.url}.`, undefined);
    yield { type: "tool_executing", toolName: toolCall.name, path: args.url };

    let resultText: string;
    let success = true;
    try {
      const response = await fetch(args.url, { signal: AbortSignal.timeout(15_000) });
      const body = await response.text();
      resultText = `HTTP ${response.status} ${response.statusText}\n\n${truncateForModel(body)}`;
      await appendLoopEvent(config.repoRoot, state, "tool.result", `Fetched ${args.url}: HTTP ${response.status}, ${body.length} chars.`, undefined);
    } catch (error) {
      success = false;
      resultText = `Fetch failed: ${error instanceof Error ? error.message : String(error)}`;
      await appendLoopEvent(config.repoRoot, state, "tool.result", resultText, undefined);
    }

    state.totalToolCalls += 1;
    state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: resultText, success });
    yield { type: "tool_result", toolCallId: toolCall.id, toolName: toolCall.name, path: args.url, result: resultText, success };
    return { kind: "executed", toolName: toolCall.name, path: args.url, result: resultText, success };
  }

  const args = parseToolArguments(toolCall.arguments);
  if (!args.path) {
    const reason = `Tool '${toolCall.name}' call is missing required 'path' argument.`;
    state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
    yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason };
    return { kind: "policy_denied", toolCallId: toolCall.id, reason };
  }

  const targetPath = resolve(config.workspaceRoot, args.path);
  // Build the seed-policy ToolRequest that the existing pipeline expects.
  const toolRequest: ToolRequest = definition.verb === "read"
    ? createFileReadRequest(state.runId, targetPath)
    : createFileWriteRequest(state.runId, targetPath);
  // Give each request a unique id per turn so multiple calls don't collide.
  toolRequest.id = `toolreq_${state.runId}_${definition.verb}_${depth}_${randomHex(4)}`;

  await appendLoopEvent(config.repoRoot, state, "tool.requested", `Model requested ${definition.name} on ${targetPath}.`, undefined);
  const risk = composeRisk(toolRequest);
  await appendLoopEvent(config.repoRoot, state, "risk.composed", `Composed ${risk.risk_level} risk for ${definition.name}.`, undefined);

  const policyDecision = evaluateSeedPolicy(config.workspaceRoot, toolRequest);
  await appendLoopEvent(config.repoRoot, state, "policy.decided", policyDecision.reason, undefined);

  if (policyDecision.decision === "deny") {
    const reason = `Policy denied ${definition.name}: ${policyDecision.reason}`;
    state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
    yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason: policyDecision.reason };
    return { kind: "policy_denied", toolCallId: toolCall.id, reason: policyDecision.reason };
  }

  // Reads are allowed directly; writes need "ask" -> human approval + consent.
  let effectiveDecision = policyDecision;
  let consent: ConsentRecord | undefined;

  if (definition.verb === "write") {
    const approvalCard = createApprovalCard(toolRequest, policyDecision);
    await appendLoopEvent(config.repoRoot, state, "policy.decided", `Approval card ${approvalCard.id} presented for ${definition.name}.`, undefined);

    const proposal: ToolCallProposal = {
      proposalId: approvalCard.id,
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      arguments: args,
      path: targetPath,
      verb: definition.verb,
      riskLevel: policyDecision.risk_level,
      decisionHint: "ask",
      policyDecision,
      proposedContent: args.content
    };
    yield { type: "tool_proposal", proposal };

    const decision = await approvalCallback(proposal);
    if (!decision.approved) {
      const reason = decision.reason ?? "User denied the write approval.";
      state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: `Write denied: ${reason}`, success: false });
      yield { type: "tool_denied", proposalId: proposal.proposalId, reason };
      await appendLoopEvent(config.repoRoot, state, "tool.denied", `Write ${definition.name} denied by user.`, undefined);
      return { kind: "denied", toolCallId: toolCall.id, reason };
    }

    yield { type: "tool_approved", proposalId: proposal.proposalId };
    consent = createWriteConsentRecord({
      runId: state.runId,
      workspaceId: state.workspace.id,
      toolRequestId: toolRequest.id,
      path: targetPath
    });
    await writeConsentRecordArtifact(config.repoRoot, state.workspace, state.runId, consent);
    await appendLoopEvent(config.repoRoot, state, "consent.recorded", `Consent ${consent.id} recorded for write.`, undefined);
    effectiveDecision = approveWriteWithConsent(config.workspaceRoot, toolRequest, consent);
    await appendLoopEvent(config.repoRoot, state, "policy.decided", effectiveDecision.reason, undefined);
    if (effectiveDecision.decision === "deny") {
      state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: effectiveDecision.reason, success: false });
      yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason: effectiveDecision.reason };
      return { kind: "policy_denied", toolCallId: toolCall.id, reason: effectiveDecision.reason };
    }
  }

  if (effectiveDecision.lease) {
    await appendLoopEvent(config.repoRoot, state, "lease.issued", `Issued scoped lease ${effectiveDecision.lease.id} for ${definition.name}.`, undefined);
  }

  // Execute under the lease.
  yield { type: "tool_executing", toolName: toolCall.name, path: targetPath };
  let resultText: string;
  let success = true;
  try {
    if (definition.verb === "read") {
      const readResult = await readLocalFileThroughPolicy(toolRequest, effectiveDecision);
      resultText = truncateForModel(readResult.contents);
      await appendLoopEvent(config.repoRoot, state, "tool.result", `Read ${readResult.bytes} bytes from ${targetPath}.`, undefined);
    } else {
      const contentToWrite = args.content ?? "";
      const writeResult = await writeLocalFileThroughPolicy(toolRequest, effectiveDecision, contentToWrite);
      // Build a short diff summary from the pre-write snapshot.
      let diffSummary = "";
      try {
        if (writeResult.pre_write_tree_hash) {
          const { readTreeSnapshot, readBlob } = await import("./vcs/tree-snapshot.ts");
          const tree = readTreeSnapshot(config.workspaceRoot, writeResult.pre_write_tree_hash);
          const relPath = targetPath.replace(config.workspaceRoot + "/", "").replace(config.workspaceRoot, "");
          const beforeHash = tree.entries[relPath];
          if (beforeHash) {
            const beforeContent = readBlob(config.workspaceRoot, beforeHash);
            diffSummary = computeDiffSummary(beforeContent, contentToWrite);
          } else {
            diffSummary = ` (+${contentToWrite.split("\n").length} lines new file)`;
          }
        }
      } catch { /* best-effort diff */ }
      resultText = `Wrote ${writeResult.bytes} bytes to ${writeResult.path}${diffSummary}.`;
      await appendLoopEvent(config.repoRoot, state, "action.recorded", resultText, writeResult.pre_write_tree_hash);
      // Verify the write landed.
      const { verification } = await verifyFileContains({
        runId: state.runId,
        actionId: `action_${state.runId}_write_${depth}`,
        path: targetPath,
        expectedText: contentToWrite.trim()
      });
      await appendLoopEvent(config.repoRoot, state, "verification.recorded", verification.summary, undefined);
    }
  } catch (error) {
    success = false;
    resultText = `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`;
    await appendLoopEvent(config.repoRoot, state, "tool.result", resultText, undefined);
  }

  state.totalToolCalls += 1;
  state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: resultText, success });
  yield { type: "tool_result", toolCallId: toolCall.id, toolName: toolCall.name, path: targetPath, result: resultText, success };
  return { kind: "executed", toolName: toolCall.name, path: targetPath, result: resultText, success };
}

// Records the model response artifact (hash-only evidence) for a turn.
async function recordResponseArtifact(
  config: AgentLoopConfig,
  state: AgentLoopState,
  requestArtifact: ReturnType<typeof createToolModeModelRequestArtifact>,
  result: ModelToolCallResult,
  depth: number
): Promise<void> {
  const outputSha = sha256(result.output_text);
  const payloadSha = sha256(JSON.stringify(result));
  const responseId = `agent_model_response_${sanitize(state.runId)}_${depth}_${randomHex(8)}`;
  const response = createAgentModelResponseArtifact({
    request: requestArtifact,
    responseId,
    provider_ref: config.provider.provider_ref,
    model_ref: config.modelRef,
    output_text_sha256: outputSha,
    response_payload_sha256: payloadSha,
    finish_reason: result.finish_reason,
    refusal_present: result.refusal_present,
    tool_calls_present: result.tool_calls.length > 0,
    usage: result.usage,
    tools_requested: true,
    tool_execution_allowed: false
  });
  await writeAgentModelResponseArtifact(config.repoRoot, state.workspace, response);
  await appendLoopEvent(config.repoRoot, state, "agent.model.responded", `Recorded model response ${responseId} for turn ${depth}.`, undefined);
}

async function appendLoopEvent(repoRoot: string, state: AgentLoopState, eventType: string, summary: string, payloadRef: string | undefined): Promise<void> {
  // Event ids must match ^evt_[A-Za-z0-9_-]+$; event types may contain dots, so
  // the id uses a monotonic counter + random suffix instead of the type.
  state.eventCounter = (state.eventCounter ?? 0) + 1;
  const event = eventRecord({
    id: `evt_${state.runId}_${String(state.eventCounter).padStart(3, "0")}_${randomHex(4)}`,
    workspace_id: state.workspace.id,
    run_id: state.runId,
    event_type: eventType,
    actor: { type: "system", id: "agent_loop" },
    summary,
    ...(payloadRef ? { payload_ref: payloadRef } : {})
  });
  await appendEvent(repoRoot, state.workspace, event as EventRecord);
  await recordRunEvent(repoRoot, state.workspace, state.manifest, event.id);
}

function flatMessages(conversation: LoopConversationMessage[]): { role: "system" | "developer" | "user"; content: string }[] {
  const out: { role: "system" | "developer" | "user"; content: string }[] = [];
  for (const message of conversation) {
    if (!isAssistantTurn(message) && !isToolResult(message)) {
      out.push({ role: message.role, content: message.content });
    }
  }
  return out;
}

function providerNameFor(provider: ModelProvider): "stub" | "openai_responses" | "openai_chat_completions" | "anthropic" | "gemini" {
  switch (provider.provider_ref) {
    case "provider_openai_responses":
      return "openai_responses";
    case "provider_openai_chat_completions":
      return "openai_chat_completions";
    case "provider_anthropic":
      return "anthropic";
    case "provider_gemini":
      return "gemini";
    default:
      return "stub";
  }
}

// Keep tool output within a sane bound so the conversation doesn't blow the
// context window. The full content is still written to disk for writes.
function truncateForModel(text: string, limit = 8000): string {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}\n\n…[truncated: ${text.length - limit} more bytes]`;
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_");
}

function randomHex(length: number): string {
  return createHash("sha256").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, length);
}
