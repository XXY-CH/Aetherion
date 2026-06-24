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

import { readdirSync, readFileSync } from "node:fs";
import { resolve, join, relative, matchesGlob } from "node:path";
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
  createAgentSpawnRequest,
  createShellExecRequest,
  createWorkspaceListRequest,
  createWorkspaceSearchRequest,
  createWebFetchRequest,
  evaluateSeedPolicy,
  issueExecuteLease,
  type ConsentRecord,
  type PolicyDecision,
  type ToolRequest
} from "./policy.ts";
import { composeRisk } from "./risk.ts";
import {
  assertLeaseActive,
  assertLeaseScopeIncludesCommand,
  assertLeaseScopeIncludesEgress,
  assertLeaseScopeIncludesPath,
  assertLeaseScopeIncludesTask,
  assertLeaseScopeIncludesTool
} from "./lease.ts";
import { readLocalFileThroughPolicy, writeLocalFileThroughPolicy } from "./local-file.ts";
import { fetchUrlThroughPolicy } from "./network-fetch.ts";
import { verifyFileContains } from "./verify.ts";
import { captureTreeSnapshot } from "./vcs/tree-snapshot.ts";
import { diffTrees } from "./vcs/tree-snapshot.ts";
import { runSubagentInBranch } from "./vcs/subagent.ts";
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
import { execSync } from "node:child_process";

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
  verb: "read" | "write" | "scan" | "exec" | "fetch";
  riskLevel: "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
  decisionHint: "allow" | "ask" | "deny" | "sandbox_only";
  policyDecision?: PolicyDecision;
  // For writes only: the content the model proposed to write.
  proposedContent?: string;
};

function createExecutePolicyDecision(request: ReturnType<typeof createShellExecRequest> | ReturnType<typeof createAgentSpawnRequest>): PolicyDecision {
  const leaseTool = request.operation.target.kind === "command" ? "shell.exec" : "agent.spawn";
  const leaseScope = request.operation.target.kind === "command"
    ? { commands: [request.operation.target.uri.replace(/^shell:\/\//, "")] }
    : { tasks: [request.operation.target.uri.replace(/^agent:\/\//, "")] };
  return issueExecuteLease(request, leaseTool, leaseScope);
}

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
    "You have six tools:",
    "- local_file_read: read a workspace file (allowed directly)",
    "- local_file_write: write a workspace file (requires human approval)",
    "- search_files / list_files: scan workspace files and directories (read-only, local response)",
    "- shell_exec: run a shell command in the workspace (requires human approval, L4 risk)",
    "- web_fetch: fetch a URL and return the page content (read-only)",
    "- agent_spawn: delegate a sub-task to a child agent (requires approval, L4 risk)",
    "Never claim authority you do not have. Model output cannot authorize actions.",
    "When you have enough information, answer the user directly without calling a tool."
  ].join("\n");
}

// Process search_files tool call — scan workspace files for a pattern.
async function* processSearchFiles(config: AgentLoopConfig, state: AgentLoopState, toolCall: ModelToolCall, depth: number): AsyncGenerator<LoopEvent> {
  const args = parseToolArguments(toolCall.arguments);
  const pattern = args.pattern ?? "";
  const globFilter = args.glob ?? "";

  await appendLoopEvent(config.repoRoot, state, "tool.requested", `Model requested search_files: /${pattern}/ ${globFilter}.`, undefined);
  const searchRequest = createWorkspaceSearchRequest(state.runId, config.workspaceRoot, pattern, globFilter);
  searchRequest.id = `toolreq_${state.runId}_search_${depth}_${randomHex(4)}`;
  const risk = composeRisk(searchRequest);
  await appendLoopEvent(config.repoRoot, state, "risk.composed", `Composed ${risk.risk_level} risk for search_files.`, undefined);
  const policyDecision = evaluateSeedPolicy(config.workspaceRoot, searchRequest);
  await appendLoopEvent(config.repoRoot, state, "policy.decided", policyDecision.reason, undefined);
  if (policyDecision.decision === "deny") {
    const reason = `Policy denied search_files: ${policyDecision.reason}`;
    state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
    yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason: policyDecision.reason };
    return;
  }
  if (policyDecision.lease) {
    await appendLoopEvent(config.repoRoot, state, "lease.issued", `Issued scoped lease ${policyDecision.lease.id} for search_files.`, undefined);
  }
  yield { type: "tool_executing", toolName: toolCall.name, path: "" };
  assertLeaseActive(policyDecision);
  assertLeaseScopeIncludesTool(policyDecision, "workspace.scan");
  assertLeaseScopeIncludesPath(policyDecision, config.workspaceRoot);
  assertLeaseScopeIncludesEgress(policyDecision, "local_response");

  let resultText = "";
  let success = true;
  try {
    resultText = searchWorkspaceFiles(config.workspaceRoot, pattern, globFilter);
    if (!resultText) {
      resultText = `No matches found for /${pattern}/`;
    }
    await appendLoopEvent(config.repoRoot, state, "tool.result", `Search completed: ${resultText.length} chars output.`, undefined);
  } catch (error) {
    success = false;
    resultText = `Search failed: ${error instanceof Error ? error.message : String(error)}`;
    await appendLoopEvent(config.repoRoot, state, "tool.result", resultText, undefined);
  }

  state.totalToolCalls += 1;
  state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: truncateForModel(resultText), success });
  yield { type: "tool_result", toolCallId: toolCall.id, toolName: toolCall.name, path: "", result: truncateForModel(resultText), success };
}

// Process list_files tool call — list directory contents.
async function* processListFiles(config: AgentLoopConfig, state: AgentLoopState, toolCall: ModelToolCall, depth: number): AsyncGenerator<LoopEvent> {
  const args = parseToolArguments(toolCall.arguments);
  const dirPath = args.path ?? ".";
  const recursive = args.recursive ?? false;
  const resolvedDir = resolve(config.workspaceRoot, dirPath);

  await appendLoopEvent(config.repoRoot, state, "tool.requested", `Model requested list_files: ${dirPath} (recursive=${recursive}).`, undefined);
  const listRequest = createWorkspaceListRequest(state.runId, resolvedDir, dirPath, recursive);
  listRequest.id = `toolreq_${state.runId}_list_${depth}_${randomHex(4)}`;
  const risk = composeRisk(listRequest);
  await appendLoopEvent(config.repoRoot, state, "risk.composed", `Composed ${risk.risk_level} risk for list_files.`, undefined);
  const policyDecision = evaluateSeedPolicy(config.workspaceRoot, listRequest);
  await appendLoopEvent(config.repoRoot, state, "policy.decided", policyDecision.reason, undefined);
  if (policyDecision.decision === "deny") {
    const reason = `Policy denied list_files: ${policyDecision.reason}`;
    state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
    yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason: policyDecision.reason };
    return;
  }
  if (policyDecision.lease) {
    await appendLoopEvent(config.repoRoot, state, "lease.issued", `Issued scoped lease ${policyDecision.lease.id} for list_files.`, undefined);
  }
  yield { type: "tool_executing", toolName: toolCall.name, path: dirPath };
  assertLeaseActive(policyDecision);
  assertLeaseScopeIncludesTool(policyDecision, "workspace.scan");
  assertLeaseScopeIncludesPath(policyDecision, resolvedDir);
  assertLeaseScopeIncludesEgress(policyDecision, "local_response");

  let resultText = "";
  let success = true;
  try {
    const entries = listDirectoryEntries(config.workspaceRoot, resolvedDir, recursive)
      .slice(0, 100);
    resultText = entries.length > 0 ? entries.join("\n") : `Empty directory: ${dirPath}`;
    await appendLoopEvent(config.repoRoot, state, "tool.result", `List completed: ${resultText.length} chars output.`, undefined);
  } catch (error) {
    success = false;
    resultText = `List failed: ${error instanceof Error ? error.message : String(error)}`;
    await appendLoopEvent(config.repoRoot, state, "tool.result", resultText, undefined);
  }

  state.totalToolCalls += 1;
  state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: truncateForModel(resultText), success });
  yield { type: "tool_result", toolCallId: toolCall.id, toolName: toolCall.name, path: dirPath, result: truncateForModel(resultText), success };
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

function isWithinWorkspace(workspaceRoot: string, targetPath: string): boolean {
  const resolvedWorkspace = resolve(workspaceRoot);
  const resolvedTarget = resolve(targetPath);
  const relativeTarget = relative(resolvedWorkspace, resolvedTarget);
  return relativeTarget === "" || (!relativeTarget.startsWith("..") && !relativeTarget.startsWith("/"));
}

function pathMatchesGlob(pathValue: string, pattern: string): boolean {
  try {
    return matchesGlob(pathValue, pattern);
  } catch {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]");
    return new RegExp(`^${escaped}$`).test(pathValue);
  }
}

function listWorkspaceFiles(workspaceRoot: string, recursive: boolean): string[] {
  const results: string[] = [];
  const exclude = new Set([".aetherion", "node_modules", ".git"]);

  function walk(dir: string): void {
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const rel = relative(workspaceRoot, fullPath);
      const relSegments = rel.split(/[\\/]/);
      if (relSegments.some((segment) => exclude.has(segment))) {
        continue;
      }
      if (entry.isDirectory()) {
        if (recursive) {
          walk(fullPath);
        }
        continue;
      }
      if (entry.isFile()) {
        results.push(rel);
      }
    }
  }

  walk(workspaceRoot);
  return results.sort();
}

function listDirectoryEntries(workspaceRoot: string, targetDir: string, recursive: boolean): string[] {
  const results: string[] = [];
  const exclude = new Set([".aetherion", "node_modules", ".git"]);
  const resolvedWorkspace = resolve(workspaceRoot);
  const resolvedTarget = resolve(targetDir);

  if (!isWithinWorkspace(workspaceRoot, resolvedTarget)) {
    throw new Error(`Directory is outside the workspace boundary: ${targetDir}`);
  }

  function walk(dir: string): void {
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const rel = relative(resolvedWorkspace, fullPath);
      const relSegments = rel.split(/[\\/]/);
      if (relSegments.some((segment) => exclude.has(segment))) {
        continue;
      }
      if (entry.isDirectory()) {
        if (recursive) {
          walk(fullPath);
        }
        continue;
      }
      if (entry.isFile()) {
        results.push(rel);
      }
    }
  }

  walk(resolvedTarget);
  return results.sort();
}

function searchWorkspaceFiles(workspaceRoot: string, pattern: string, globFilter: string): string {
  let matcher: RegExp;
  try {
    matcher = new RegExp(pattern);
  } catch (error) {
    throw new Error(`Invalid search pattern: ${error instanceof Error ? error.message : String(error)}`);
  }
  const files = listWorkspaceFiles(workspaceRoot, true).filter((filePath) => !globFilter || pathMatchesGlob(filePath, globFilter));
  const lines: string[] = [];
  for (const relPath of files) {
    const fullPath = join(workspaceRoot, relPath);
    let content: string;
    try {
      content = readFileSync(fullPath, "utf8");
    } catch {
      continue;
    }
    const fileLines = content.split(/\r?\n/);
    for (let index = 0; index < fileLines.length; index += 1) {
      const line = fileLines[index];
      if (matcher.test(line)) {
        lines.push(`${relPath}:${index + 1}:${line}`);
      }
    }
  }
  return lines.slice(0, 50).join("\n");
}

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

  if (definition.verb === "exec") {
    const args = parseToolArguments(toolCall.arguments);
    if (toolCall.name === "shell_exec") {
      if (!args.command) {
        const reason = `Tool '${toolCall.name}' call is missing required 'command' argument.`;
        state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
        yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason };
        return { kind: "policy_denied", toolCallId: toolCall.id, reason };
      }

      const toolRequest = createShellExecRequest(state.runId, args.command);
      toolRequest.id = `toolreq_${state.runId}_exec_${depth}_${randomHex(4)}`;
      const risk = composeRisk(toolRequest);
      await appendLoopEvent(config.repoRoot, state, "tool.requested", `Model requested ${definition.name}: ${args.command}.`, undefined);
      await appendLoopEvent(config.repoRoot, state, "risk.composed", `Composed ${risk.risk_level} risk for ${definition.name}.`, undefined);
      const policyDecision = evaluateSeedPolicy(config.workspaceRoot, toolRequest);
      await appendLoopEvent(config.repoRoot, state, "policy.decided", policyDecision.reason, undefined);
      if (policyDecision.decision === "deny") {
        const reason = `Policy denied ${definition.name}: ${policyDecision.reason}`;
        state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
        yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason: policyDecision.reason };
        return { kind: "policy_denied", toolCallId: toolCall.id, reason: policyDecision.reason };
      }

      const approvalCard = createApprovalCard(toolRequest, policyDecision);
      await appendLoopEvent(config.repoRoot, state, "policy.decided", `Approval card ${approvalCard.id} presented for ${definition.name}.`, undefined);
      const proposal: ToolCallProposal = {
        proposalId: approvalCard.id,
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        arguments: args,
        path: "",
        verb: "exec",
        riskLevel: policyDecision.risk_level,
        decisionHint: "ask",
        policyDecision,
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
      const effectiveDecision = createExecutePolicyDecision(toolRequest);
      await appendLoopEvent(config.repoRoot, state, "policy.decided", effectiveDecision.reason, undefined);
      await appendLoopEvent(config.repoRoot, state, "lease.issued", `Issued scoped lease ${effectiveDecision.lease?.id ?? approvalCard.id} for ${definition.name}.`, undefined);
      yield { type: "tool_executing", toolName: toolCall.name, path: "" };

      assertLeaseActive(effectiveDecision);
      assertLeaseScopeIncludesTool(effectiveDecision, "shell.exec");
      assertLeaseScopeIncludesCommand(effectiveDecision, args.command);
      assertLeaseScopeIncludesEgress(effectiveDecision, "local_response");

      let preExecTreeHash: string | undefined;
      try {
        const snap = captureTreeSnapshot(config.workspaceRoot);
        preExecTreeHash = snap.tree_hash;
        await appendLoopEvent(config.repoRoot, state, "vcs.snapshot.created", `Pre-exec snapshot: ${preExecTreeHash}.`, preExecTreeHash);
      } catch { /* best-effort */ }

      const timeoutMs = Math.min(args.timeout_ms ?? 30_000, 60_000);
      let resultText: string;
      let success = true;
      try {
        const stdout = execSync(args.command, {
          cwd: config.workspaceRoot,
          timeout: timeoutMs,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
          maxBuffer: 1024 * 1024
        }) as string;
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

    if (toolCall.name === "agent_spawn") {
      if (!args.task) {
        const reason = `Tool '${toolCall.name}' call is missing required 'task' argument.`;
        state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
        yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason };
        return { kind: "policy_denied", toolCallId: toolCall.id, reason };
      }

      const toolRequest = createAgentSpawnRequest(state.runId, args.task);
      toolRequest.id = `toolreq_${state.runId}_spawn_${depth}_${randomHex(4)}`;
      const risk = composeRisk(toolRequest);
      await appendLoopEvent(config.repoRoot, state, "tool.requested", `Model requested agent_spawn: ${args.task}.`, undefined);
      await appendLoopEvent(config.repoRoot, state, "risk.composed", `Composed ${risk.risk_level} risk for ${definition.name}.`, undefined);
      const policyDecision = evaluateSeedPolicy(config.workspaceRoot, toolRequest);
      await appendLoopEvent(config.repoRoot, state, "policy.decided", policyDecision.reason, undefined);
      if (policyDecision.decision === "deny") {
        const reason = `Policy denied ${definition.name}: ${policyDecision.reason}`;
        state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
        yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason: policyDecision.reason };
        return { kind: "policy_denied", toolCallId: toolCall.id, reason: policyDecision.reason };
      }

      const approvalCard = createApprovalCard(toolRequest, policyDecision);
      await appendLoopEvent(config.repoRoot, state, "policy.decided", `Approval card ${approvalCard.id} presented for ${definition.name}.`, undefined);
      const proposal: ToolCallProposal = {
        proposalId: approvalCard.id,
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        arguments: args,
        path: "",
        verb: "exec",
        riskLevel: policyDecision.risk_level,
        decisionHint: "ask",
        policyDecision,
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
      const effectiveDecision = createExecutePolicyDecision(toolRequest);
      await appendLoopEvent(config.repoRoot, state, "policy.decided", effectiveDecision.reason, undefined);
      await appendLoopEvent(config.repoRoot, state, "lease.issued", `Issued scoped lease ${effectiveDecision.lease?.id ?? approvalCard.id} for ${definition.name}.`, undefined);
      yield { type: "tool_executing", toolName: toolCall.name, path: "" };

      assertLeaseActive(effectiveDecision);
      assertLeaseScopeIncludesTool(effectiveDecision, "agent.spawn");
      assertLeaseScopeIncludesTask(effectiveDecision, args.task);
      assertLeaseScopeIncludesEgress(effectiveDecision, "local_response");

      const sourceSnap = captureTreeSnapshot(config.workspaceRoot);
      const branchName = `${state.runId}_spawn_${depth}_${randomHex(4)}`;
      const branch = await runSubagentInBranch({
        workspaceRoot: config.workspaceRoot,
        branchName,
        sourceTreeHash: sourceSnap.tree_hash,
        task: args.task,
        repoRoot: config.repoRoot
      });
      const wtDir = branch.worktreePath;
      const childRunId = `${state.runId}_child_${depth}`;
      const childInvocation = {
        ...config.invocation,
        run_id: childRunId,
        id: `agent_runtime_invocation_${childRunId}`
      };
      const childConfig: AgentLoopConfig = {
        ...config,
        workspaceRoot: wtDir,
        invocation: childInvocation,
        maxLoopDepth: Math.min(config.maxLoopDepth, 5)
      };
      const childState = await startAgentLoopState({
        repoRoot: config.repoRoot,
        workspaceRoot: wtDir,
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
            childResult += at.content;
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

      const afterSnap = captureTreeSnapshot(wtDir);
      const changes = diffTrees(sourceSnap, afterSnap);
      const changedFiles = changes.map((c) => c.path).sort();
      const diffSummary = changedFiles.length > 0
        ? `changed ${changedFiles.length} file(s): ${changedFiles.join(", ")} (branch: ${branchName})`
        : `no file changes (branch: ${branchName})`;

      const fullResult = `${childResult}\n\n[${diffSummary}]`;
      const truncated = truncateForModel(fullResult);
      await appendLoopEvent(config.repoRoot, state, "tool.result", `agent_spawn completed: ${truncated.length} chars. ${diffSummary}`, undefined);
      state.totalToolCalls += 1;
      state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: truncated, success: childSuccess });
      yield { type: "tool_result", toolCallId: toolCall.id, toolName: toolCall.name, path: "", result: truncated, success: childSuccess };
      return { kind: "executed", toolName: toolCall.name, path: "", result: truncated, success: childSuccess };
    }
  }

  if (toolCall.name === "search_files") {
    yield* processSearchFiles(config, state, toolCall, depth);
    return { kind: "executed", toolName: toolCall.name, path: "", result: "search completed", success: true };
  }
  if (toolCall.name === "list_files") {
    yield* processListFiles(config, state, toolCall, depth);
    return { kind: "executed", toolName: toolCall.name, path: "", result: "list completed", success: true };
  }

  if (definition.verb === "fetch") {
    const args = parseToolArguments(toolCall.arguments);
    if (!args.url) {
      const reason = `Tool '${toolCall.name}' call is missing required 'url' argument.`;
      state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
      yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason };
      return { kind: "policy_denied", toolCallId: toolCall.id, reason };
    }

    const toolRequest = createWebFetchRequest(state.runId, args.url);
    toolRequest.id = `toolreq_${state.runId}_fetch_${depth}_${randomHex(4)}`;
    const risk = composeRisk(toolRequest);
    await appendLoopEvent(config.repoRoot, state, "tool.requested", `Model requested ${definition.name}: ${args.url}.`, undefined);
    await appendLoopEvent(config.repoRoot, state, "risk.composed", `Composed ${risk.risk_level} risk for ${definition.name}.`, undefined);
    const policyDecision = evaluateSeedPolicy(config.workspaceRoot, toolRequest);
    await appendLoopEvent(config.repoRoot, state, "policy.decided", policyDecision.reason, undefined);
    if (policyDecision.decision === "deny") {
      const reason = `Policy denied ${definition.name}: ${policyDecision.reason}`;
      state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
      yield { type: "policy_denied", toolCallId: toolCall.id, toolName: toolCall.name, reason: policyDecision.reason };
      return { kind: "policy_denied", toolCallId: toolCall.id, reason: policyDecision.reason };
    }
    if (policyDecision.lease) {
      await appendLoopEvent(config.repoRoot, state, "lease.issued", `Issued scoped lease ${policyDecision.lease.id} for ${definition.name}.`, undefined);
    }
    yield { type: "tool_executing", toolName: toolCall.name, path: args.url };

    let resultText: string;
    let success = true;
    try {
      const fetchResult = await fetchUrlThroughPolicy(toolRequest, policyDecision);
      resultText = `HTTP ${fetchResult.status} ${fetchResult.statusText}\n\n${truncateForModel(fetchResult.body)}`;
      await appendLoopEvent(config.repoRoot, state, "tool.result", `Fetched ${args.url}: HTTP ${fetchResult.status}, ${fetchResult.body.length} chars.`, undefined);
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
    // file_edit: read current file, apply search-replace, then use result as content.
    if (toolCall.name === "file_edit") {
      const editPath = args.path ?? "";
      const oldText = args.old_text ?? "";
      const newText = args.new_text ?? "";
      try {
        const { readFileSync, existsSync } = await import("node:fs");
        const fullPath = editPath.startsWith("/") ? editPath : join(config.workspaceRoot, editPath);
        if (!existsSync(fullPath)) {
          if (oldText === "") {
            args.content = newText;
            args.path = editPath;
          } else {
            throw new Error(`File not found: ${editPath}`);
          }
        } else {
          const current = readFileSync(fullPath, "utf8");
          if (oldText === "") {
            args.content = newText;
          } else {
            const matchCount = current.split(oldText).length - 1;
            if (matchCount === 0) {
              throw new Error(`old_text not found in ${editPath}`);
            }
            if (matchCount > 1) {
              throw new Error(`old_text appears ${matchCount} times in ${editPath} — must be unique`);
            }
            args.content = current.replace(oldText, newText);
          }
          args.path = editPath;
        }
      } catch (editErr) {
        const reason = `file_edit failed: ${editErr instanceof Error ? editErr.message : String(editErr)}`;
        state.conversation.push({ role: "tool", tool_call_id: toolCall.id, tool_name: toolCall.name, content: reason, success: false });
        yield { type: "tool_result", toolCallId: toolCall.id, toolName: toolCall.name, path: editPath, result: reason, success: false };
        return { kind: "executed", toolName: toolCall.name, path: editPath, result: reason, success: false };
      }
    }

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
