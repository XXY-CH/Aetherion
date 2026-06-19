// Model provider boundary for the Agent runtime loop.
//
// This module performs the first real model invocation in Aetherion. It is the
// only place allowed to resolve a provider credential and make an outbound
// model call, and it does so under strict rules drawn from
// docs/13-schema-runtime-governance.md:
//
// - Credentials are resolved in-memory at call time and never returned,
//   logged, or persisted.
// - Raw prompt text and raw provider payloads stay in memory; callers persist
//   only hashes (see agent-runtime.ts AgentModelResponseArtifact).
// - Model output cannot authorize actions. Tool execution still requires Local
//   Supervisor policy and a scoped lease.
//
// A deterministic stub provider keeps the loop testable offline. The default
// provider is the stub unless AETHERION_MODEL_PROVIDER selects a live provider
// with a resolvable credential.

export type ModelMessage = {
  role: "system" | "developer" | "user";
  content: string;
};

// Multi-turn conversation entry for the agent loop. The first three variants
// match ModelMessage; the assistant + tool variants carry tool-call turn
// history that each provider maps onto its native request shape.
export type LoopConversationMessage =
  | ModelMessage
  | {
      role: "assistant";
      content: string;
      tool_calls: ModelToolCall[];
    }
  | {
      role: "tool";
      tool_call_id: string;
      tool_name: string;
      content: string;
      success: boolean;
    };

// Predicate helpers so conversation arrays stay readable at call sites.
export function isAssistantTurn(message: LoopConversationMessage): message is { role: "assistant"; content: string; tool_calls: ModelToolCall[] } {
  return message.role === "assistant";
}

export function isToolResult(message: LoopConversationMessage): message is { role: "tool"; tool_call_id: string; tool_name: string; content: string; success: boolean } {
  return message.role === "tool";
}

export type ModelInvocationRequest = {
  provider_ref: string;
  model_ref: string;
  output_mode: "plan" | "answer" | "patch";
  messages: ModelMessage[];
  max_output_tokens: number;
  // Audit scaffold the stub provider uses to emit a structurally valid,
  // non-authorizing response. Real providers ignore it because the rendered
  // prompt already carries the response contract.
  response_contract?: {
    required_blocks: Array<{ id: string; title: string }>;
    required_citation_ids: string[];
  };
  // Multi-turn history for the agent loop. When present, the tool-capable
  // providers build their native message arrays from this instead of the flat
  // `messages` field, preserving assistant tool_calls and tool results across
  // iterations. The flat `messages` field still carries system/developer/user
  // for the no-tools path and as a fallback.
  conversation?: LoopConversationMessage[];
};

export type ModelInvocationResult = {
  output_text: string;
  finish_reason: "stop" | "length" | "content_filter" | "tool_call" | "error";
  refusal_present: boolean;
  tool_calls_present: boolean;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    usage_source: "provider_reported" | "locally_estimated" | "not_recorded";
  };
};

// A single model-emitted tool call, normalized across providers. `arguments` is
// the raw model-produced argument container (JSON string for OpenAI, object for
// Anthropic/Gemini); parseToolArguments() decodes it into the loop's uniform
// shape.
export type ModelToolCall = {
  id: string;
  name: string;
  arguments: string | Record<string, unknown> | undefined;
};

// Result of a tool-capable model turn. `output_text` is the concatenation of
// non-tool content; `tool_calls` carries normalized calls (empty when the model
// finished without requesting a tool).
export type ModelToolCallResult = {
  output_text: string;
  tool_calls: ModelToolCall[];
  finish_reason: "stop" | "length" | "content_filter" | "tool_call" | "error";
  refusal_present: boolean;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    usage_source: "provider_reported" | "locally_estimated" | "not_recorded";
  };
};

// Streaming deltas emitted while a tool-capable turn is in flight. The loop
// forwards `text_delta` to the UI as it arrives; `text_done` + `tool_calls`
// arrive exactly once at the end of the turn.
export type ModelStreamDelta =
  | { type: "text_delta"; text: string }
  | { type: "done"; result: ModelToolCallResult };

export type ToolCapableProvider = ModelProvider & {
  // Stream a tool-capable turn. `onDelta` is invoked as text arrives; the
  // returned promise resolves with the final result. The stub provider ignores
  // tools and resolves immediately with a structured no-tool result so the
  // loop is testable offline.
  invokeWithTools(request: ModelInvocationRequest, tools: unknown[], onDelta: (delta: ModelStreamDelta) => void): Promise<ModelToolCallResult>;
};


export type ModelProviderErrorCode =
  | "provider_unknown"
  | "provider_missing_credential"
  | "provider_invalid_timeout"
  | "provider_network_failure"
  | "provider_timeout"
  | "provider_http_error"
  | "provider_malformed_json"
  | "provider_tool_call_rejected";

export type ModelProviderErrorCategory =
  | "configuration"
  | "credential"
  | "network"
  | "upstream_http"
  | "upstream_payload"
  | "no_tools_guard";

export const MODEL_PROVIDER_ERROR_CODES: ModelProviderErrorCode[] = [
  "provider_unknown",
  "provider_missing_credential",
  "provider_invalid_timeout",
  "provider_network_failure",
  "provider_timeout",
  "provider_http_error",
  "provider_malformed_json",
  "provider_tool_call_rejected"
];

export class ModelProviderError extends Error {
  code: ModelProviderErrorCode;
  category: ModelProviderErrorCategory;
  provider_ref: string | null;
  retryable: boolean;
  http_status?: number;

  constructor(input: {
    code: ModelProviderErrorCode;
    category: ModelProviderErrorCategory;
    provider_ref: string | null;
    retryable: boolean;
    message: string;
    http_status?: number;
  }) {
    super(input.message);
    this.name = "ModelProviderError";
    this.code = input.code;
    this.category = input.category;
    this.provider_ref = input.provider_ref;
    this.retryable = input.retryable;
    this.http_status = input.http_status;
  }
}

export function isModelProviderError(error: unknown): error is ModelProviderError {
  return error instanceof ModelProviderError;
}

function modelProviderError(input: ConstructorParameters<typeof ModelProviderError>[0]): ModelProviderError {
  return new ModelProviderError(input);
}

export type ModelProvider = {
  provider_ref: string;
  model_ref: string;
  // True only when an outbound network call was made. The stub stays false.
  network_capable: boolean;
  invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult>;
};

export function assertNoProviderToolCalls(result: ModelInvocationResult, providerRef: string): void {
  if (result.tool_calls_present || result.finish_reason === "tool_call") {
    throw modelProviderError({
      code: "provider_tool_call_rejected",
      category: "no_tools_guard",
      provider_ref: providerRef,
      retryable: false,
      message: `${providerRef} returned a tool/function call in no-tools mode; refusing to persist model response evidence.`
    });
  }
}

// Narrows a provider to its tool-capable surface. The stub and all live
// providers implement invokeWithTools(); resolveModelProvider() always returns
// a ToolCapableProvider.
export function asToolCapable(provider: ModelProvider): ToolCapableProvider {
  const candidate = provider as ToolCapableProvider;
  if (typeof candidate.invokeWithTools !== "function") {
    throw modelProviderError({
      code: "provider_unknown",
      category: "configuration",
      provider_ref: provider.provider_ref,
      retryable: false,
      message: `${provider.provider_ref} does not implement tool-capable invocation.`
    });
  }
  return candidate;
}

// Builds the OpenAI Chat Completions message array from a loop conversation,
// mapping assistant tool_calls and tool results onto the native shapes.
function buildOpenAIChatMessages(request: ModelInvocationRequest): unknown[] {
  const conv = request.conversation ?? request.messages.map((message) => ({ role: message.role, content: message.content } as LoopConversationMessage));
  const out: unknown[] = [];
  for (const message of conv) {
    if (message.role === "system" || message.role === "developer" || message.role === "user") {
      out.push({ role: message.role === "developer" ? "developer" : message.role, content: message.content });
    } else if (message.role === "assistant") {
      const entry: Record<string, unknown> = { role: "assistant", content: message.content || null };
      if (message.tool_calls.length > 0) {
        entry.tool_calls = message.tool_calls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments ?? {}) }
        }));
      }
      out.push(entry);
    } else if (message.role === "tool") {
      out.push({ role: "tool", tool_call_id: message.tool_call_id, content: message.content });
    }
  }
  return out;
}

// Builds the Anthropic Messages request: system text (system+developer) is
// hoisted out, and the remaining turns form the user/assistant/tool turns.
function buildAnthropicMessages(request: ModelInvocationRequest): { system: string; messages: unknown[] } {
  const conv = request.conversation ?? request.messages.map((message) => ({ role: message.role, content: message.content } as LoopConversationMessage));
  const systemParts: string[] = [];
  const messages: unknown[] = [];
  for (const message of conv) {
    if (message.role === "system" || message.role === "developer") {
      systemParts.push(message.content);
      continue;
    }
    if (message.role === "user") {
      messages.push({ role: "user", content: message.content });
    } else if (message.role === "assistant") {
      const content: unknown[] = [];
      if (message.content.length > 0) {
        content.push({ type: "text", text: message.content });
      }
      for (const call of message.tool_calls) {
        const input = typeof call.arguments === "string" ? safeParseJsonObject(call.arguments) : call.arguments ?? {};
        content.push({ type: "tool_use", id: call.id, name: call.name, input });
      }
      messages.push({ role: "assistant", content });
    } else if (message.role === "tool") {
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: message.tool_call_id, content: message.content, is_error: !message.success }]
      });
    }
  }
  return { system: systemParts.join("\n\n"), messages };
}

// Builds the Gemini contents array, mapping assistant function calls and tool
// results onto the functionCall / functionResponse parts.
function buildGeminiContents(request: ModelInvocationRequest): unknown[] {
  const conv = request.conversation ?? request.messages.map((message) => ({ role: message.role, content: message.content } as LoopConversationMessage));
  const out: unknown[] = [];
  for (const message of conv) {
    if (message.role === "system" || message.role === "developer") {
      continue;
    }
    if (message.role === "user") {
      out.push({ role: "user", parts: [{ text: message.content }] });
    } else if (message.role === "assistant") {
      const parts: unknown[] = [];
      if (message.content.length > 0) {
        parts.push({ text: message.content });
      }
      for (const call of message.tool_calls) {
        const args = typeof call.arguments === "string" ? safeParseJsonObject(call.arguments) : call.arguments ?? {};
        parts.push({ functionCall: { name: call.name, args } });
      }
      out.push({ role: "model", parts });
    } else if (message.role === "tool") {
      const response = safeParseJsonObject(message.content);
      out.push({ role: "user", parts: [{ functionResponse: { name: message.tool_name, response } }] });
    }
  }
  return out;
}

function safeParseJsonObject(value: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (typeof value !== "string") {
    return value ?? {};
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

// Reads an SSE (Server-Sent Events) byte stream line by line, yielding parsed
// `data:` payloads. Used by the streaming tool providers. Non-data lines (event
// names, comments, id/retry hints) are ignored.
async function* readSseDataChunks(response: Response): AsyncGenerator<string> {
  if (!response.body) {
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        const trimmed = line.replace(/\r$/, "").trim();
        if (trimmed.length === 0 || trimmed.startsWith(":")) {
          continue;
        }
        if (trimmed.startsWith("data:")) {
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            return;
          }
          yield data;
        }
      }
    }
    const tail = buffer.trim();
    if (tail.startsWith("data:")) {
      const data = tail.slice(5).trim();
      if (data && data !== "[DONE]") {
        yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export type ResolveModelProviderOptions = {
  providerName?: string;
  modelRef?: string;
  env?: Record<string, string | undefined>;
};

const DEFAULT_OPENAI_MODEL = "gpt-5.4";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const GEMINI_GENERATE_CONTENT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const ANTHROPIC_API_VERSION = "2023-06-01";
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_PROVIDER_TIMEOUT_MS = 30_000;

export function resolveModelProvider(options: ResolveModelProviderOptions = {}): ToolCapableProvider {
  const env = options.env ?? process.env;
  const providerName = normalizeProviderName(options.providerName ?? env.AETHERION_MODEL_PROVIDER ?? "stub");
  if (providerName === "stub") {
    return createStubProvider(options.modelRef ?? env.AETHERION_MODEL_REF ?? "stub-deterministic-v1");
  }
  if (providerName === "openai_responses") {
    return createOpenAIResponsesProvider(options.modelRef ?? env.AETHERION_MODEL_REF ?? DEFAULT_OPENAI_MODEL, env);
  }
  if (providerName === "openai_chat_completions") {
    return createOpenAIChatCompletionsProvider(options.modelRef ?? env.AETHERION_MODEL_REF ?? DEFAULT_OPENAI_MODEL, env);
  }
  if (providerName === "anthropic") {
    return createAnthropicProvider(options.modelRef ?? env.AETHERION_MODEL_REF ?? DEFAULT_ANTHROPIC_MODEL, env);
  }
  if (providerName === "gemini") {
    return createGeminiProvider(options.modelRef ?? env.AETHERION_MODEL_REF ?? DEFAULT_GEMINI_MODEL, env);
  }
  throw modelProviderError({
    code: "provider_unknown",
    category: "configuration",
    provider_ref: null,
    retryable: false,
    message: `Unknown model provider '${providerName}'. Set AETHERION_MODEL_PROVIDER to 'stub', 'openai_responses', 'openai_chat_completions', 'anthropic', or 'gemini'.`
  });
}

// Deterministic, offline provider. It never touches the network and produces a
// response that satisfies the local prompt response contract so the audit step
// can be exercised end to end without a live model.
export function createStubProvider(modelRef: string): ToolCapableProvider {
  return {
    provider_ref: "provider_local_stub",
    model_ref: modelRef,
    network_capable: false,
    async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
      const output_text = renderStubResponse(request);
      const input_tokens = estimateTokens(request.messages.map((message) => message.content).join("\n"));
      const output_tokens = estimateTokens(output_text);
      return {
        output_text,
        finish_reason: "stop",
        refusal_present: false,
        tool_calls_present: false,
        usage: {
          input_tokens,
          output_tokens,
          total_tokens: input_tokens + output_tokens,
          usage_source: "locally_estimated"
        }
      };
    },
    async invokeWithTools(request: ModelInvocationRequest, tools: unknown[], onDelta: (delta: ModelStreamDelta) => void): Promise<ModelToolCallResult> {
      // Deterministic, offline tool-call simulation for testing the loop without
      // a live model. When the registry declares tools and the latest message
      // reads like a read/write intent, emit a matching tool call; otherwise
      // emit a plain answer and stop. This keeps the agent loop fully testable.
      const lastUser = [...request.messages].reverse().find((message) => message.role === "user");
      const userText = lastUser?.content ?? "";
      const toolNames = tools.map((tool) => toolNameOf(tool));
      // If a prior tool result is already in the conversation, the stub answers
      // with a summary instead of emitting another tool call. This terminates the
      // loop deterministically once a tool has run.
      const hasPriorToolResult = (request.conversation ?? []).some((message) => message.role === "tool");
      const result = simulateStubToolTurn(userText, toolNames, request, hasPriorToolResult);
      // Emit deltas so the streaming UI path is exercised even offline.
      if (result.output_text.length > 0) {
        onDelta({ type: "text_delta", text: result.output_text });
      }
      onDelta({ type: "done", result });
      return result;
    }
  };
}

function toolNameOf(tool: unknown): string {
  if (tool && typeof tool === "object") {
    const record = tool as Record<string, unknown>;
    if (typeof record.name === "string") {
      return record.name;
    }
    const fn = record.function as Record<string, unknown> | undefined;
    if (fn && typeof fn.name === "string") {
      return fn.name;
    }
  }
  return "";
}

// Offline tool-turn simulation. The stub never makes a real decision; it maps a
// small set of intent phrases onto the declared tools so the loop's approval,
// policy, and verification paths can be exercised deterministically.
function simulateStubToolTurn(userText: string, toolNames: string[], request: ModelInvocationRequest, hasPriorToolResult: boolean): ModelToolCallResult {
  const intent = userText.toLowerCase();
  const wantsRead = /read|inspect|show|contents? of|first|lines? of/.test(intent) && toolNames.includes("local_file_read");
  const wantsWrite = /write|create|save|update|replace/.test(intent) && toolNames.includes("local_file_write");
  const input_tokens = estimateTokens(request.messages.map((message) => message.content).join("\n"));

  // Once a tool has run, summarize instead of looping forever.
  if (hasPriorToolResult) {
    const lastTool = (request.conversation ?? []).reverse().find((message) => message.role === "tool");
    const summary = lastTool && "content" in lastTool
      ? `Based on the tool result, here is what I found: ${String(lastTool.content).slice(0, 200)}`
      : "I have completed the requested action and have nothing further to do.";
    return {
      output_text: summary,
      tool_calls: [],
      finish_reason: "stop",
      refusal_present: false,
      usage: {
        input_tokens,
        output_tokens: estimateTokens(summary),
        total_tokens: input_tokens + estimateTokens(summary),
        usage_source: "locally_estimated"
      }
    };
  }

  if (wantsRead) {
    const target = extractStubPath(userText) ?? "README.md";
    return {
      output_text: "",
      tool_calls: [{ id: "stub_call_read_1", name: "local_file_read", arguments: JSON.stringify({ path: target }) }],
      finish_reason: "tool_call",
      refusal_present: false,
      usage: {
        input_tokens,
        output_tokens: estimateTokens(`read ${target}`),
        total_tokens: input_tokens + estimateTokens(`read ${target}`),
        usage_source: "locally_estimated"
      }
    };
  }
  if (wantsWrite) {
    const target = extractStubPath(userText) ?? "AETHERION_STUB_OUTPUT.md";
    return {
      output_text: "",
      tool_calls: [{ id: "stub_call_write_1", name: "local_file_write", arguments: JSON.stringify({ path: target, content: "# Aetherion stub write\n\nCreated by the offline agent loop simulation.\n" }) }],
      finish_reason: "tool_call",
      refusal_present: false,
      usage: {
        input_tokens,
        output_tokens: estimateTokens(`write ${target}`),
        total_tokens: input_tokens + estimateTokens(`write ${target}`),
        usage_source: "locally_estimated"
      }
    };
  }
  const output_text = "I would read the relevant workspace files to answer this, but no read/write intent was detected in the stub simulation. Provide a phrase like 'read README.md' to exercise a tool call.";
  return {
    output_text,
    tool_calls: [],
    finish_reason: "stop",
    refusal_present: false,
    usage: {
      input_tokens,
      output_tokens: estimateTokens(output_text),
      total_tokens: input_tokens + estimateTokens(output_text),
      usage_source: "locally_estimated"
    }
  };
}

// Best-effort path extraction from a stub user message. Matches quoted paths or
// a trailing token ending in a file extension.
function extractStubPath(userText: string): string | null {
  const quoted = userText.match(/["'`]([^"'`]+\.\w+)["'`]/);
  if (quoted) {
    return quoted[1];
  }
  const trailing = userText.match(/([A-Za-z0-9_./-]+\.\w+)\b/);
  if (trailing) {
    return trailing[1];
  }
  return null;
}


// Real OpenAI Responses API provider. OPENAI_API_KEY is the standard direct
// platform credential. OPENAI_OAUTH_ACCESS_TOKEN is accepted only as an
// externally obtained bearer token; Aetherion does not run an OAuth flow here.
export function createOpenAIResponsesProvider(modelRef: string, env: Record<string, string | undefined>): ToolCapableProvider {
  const providerRef = "provider_openai_responses";
  const timeoutMs = resolveProviderTimeoutMs(env, providerRef);
  return {
    provider_ref: providerRef,
    model_ref: modelRef,
    network_capable: true,
    async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
      const credential = resolveBearerCredential(env, ["OPENAI_API_KEY"], ["OPENAI_OAUTH_ACCESS_TOKEN"], "openai_responses", providerRef);
      const instructions = systemAndDeveloperText(request.messages);
      const userContent = userText(request.messages);
      const body: Record<string, unknown> = {
        model: modelRef,
        input: userContent || allMessageText(request.messages),
        max_output_tokens: request.max_output_tokens,
        store: false
      };
      if (instructions) {
        body.instructions = instructions;
      }
      const payload = await postJson<OpenAIResponsesResponse>(OPENAI_RESPONSES_URL, {
        "authorization": `Bearer ${credential.value}`,
        "content-type": "application/json"
      }, body, "openai_responses", providerRef, timeoutMs);
      const result = mapOpenAIResponsesResponse(payload);
      assertNoProviderToolCalls(result, "provider_openai_responses");
      return result;
    },
    async invokeWithTools(request: ModelInvocationRequest, tools: unknown[], onDelta: (delta: ModelStreamDelta) => void): Promise<ModelToolCallResult> {
      // The Responses API has its own streaming event vocabulary; to keep this
      // path correct and testable without exercising an unverified SSE shape we
      // make a single non-streaming tool-capable call and emit the assembled
      // text as one delta. The tool loop and policy pipeline are unaffected.
      const credential = resolveBearerCredential(env, ["OPENAI_API_KEY"], ["OPENAI_OAUTH_ACCESS_TOKEN"], "openai_responses", providerRef);
      const instructions = systemAndDeveloperText(request.messages);
      const userContent = userText(request.messages);
      const body: Record<string, unknown> = {
        model: modelRef,
        input: userContent || allMessageText(request.messages),
        max_output_tokens: request.max_output_tokens,
        store: false,
        tools: mapOpenAIResponsesTools(tools),
        tool_choice: "auto"
      };
      if (instructions) {
        body.instructions = instructions;
      }
      const payload = await postJson<OpenAIResponsesToolResponse>(OPENAI_RESPONSES_URL, {
        "authorization": `Bearer ${credential.value}`,
        "content-type": "application/json"
      }, body, "openai_responses", providerRef, timeoutMs);

      const textParts: string[] = [];
      const toolCalls: ModelToolCall[] = [];
      let finishReason = "stop";
      for (const item of payload.output ?? []) {
        if (item.type === "message") {
          for (const block of item.content ?? []) {
            if (block.type === "output_text" && typeof block.text === "string") {
              textParts.push(block.text);
            }
          }
        } else if (item.type === "function_call") {
          toolCalls.push({
            id: item.call_id ?? item.id ?? `call_${Math.random().toString(36).slice(2)}`,
            name: item.name ?? "",
            arguments: item.arguments
          });
          finishReason = "tool_call";
        }
      }
      const output_text = payload.output_text ?? textParts.join("");
      const input_tokens = Math.max(0, Math.trunc(payload.usage?.input_tokens ?? 0));
      const output_tokens = Math.max(0, Math.trunc(payload.usage?.output_tokens ?? 0));
      const result: ModelToolCallResult = {
        output_text,
        tool_calls: toolCalls,
        finish_reason: toolCalls.length > 0 ? "tool_call" : mapOpenAIResponsesFinishReason({ status: payload.status, incomplete_details: payload.incomplete_details } as OpenAIResponsesResponse, false),
        refusal_present: false,
        usage: {
          input_tokens,
          output_tokens,
          total_tokens: Math.max(input_tokens + output_tokens, Math.trunc(payload.usage?.total_tokens ?? input_tokens + output_tokens)),
          usage_source: "provider_reported"
        }
      };
      if (output_text.length > 0) {
        onDelta({ type: "text_delta", text: output_text });
      }
      onDelta({ type: "done", result });
      return result;
    }
  };
}

// Maps the registry's uniform OpenAI tool shape onto the Responses API's
// function tool declaration.
function mapOpenAIResponsesTools(tools: unknown[]): unknown[] {
  return tools.map((tool) => {
    const record = tool as Record<string, unknown>;
    const fn = (record.function as Record<string, unknown> | undefined) ?? record;
    return { type: "function", name: fn.name, description: fn.description, parameters: fn.parameters };
  });
}


// Real OpenAI Chat Completions API provider. This keeps the older
// message-array surface available for models and deployments that still expect
// chat completions instead of Responses.
export function createOpenAIChatCompletionsProvider(modelRef: string, env: Record<string, string | undefined>): ToolCapableProvider {
  const providerRef = "provider_openai_chat_completions";
  const timeoutMs = resolveProviderTimeoutMs(env, providerRef);
  return {
    provider_ref: providerRef,
    model_ref: modelRef,
    network_capable: true,
    async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
      const credential = resolveBearerCredential(env, ["OPENAI_API_KEY"], ["OPENAI_OAUTH_ACCESS_TOKEN"], "openai_chat_completions", providerRef);
      const body = {
        model: modelRef,
        messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
        max_completion_tokens: request.max_output_tokens,
        stream: false
      };
      const payload = await postJson<OpenAIChatCompletionResponse>(OPENAI_CHAT_COMPLETIONS_URL, {
        "authorization": `Bearer ${credential.value}`,
        "content-type": "application/json"
      }, body, "openai_chat_completions", providerRef, timeoutMs);
      const result = mapOpenAIChatCompletionResponse(payload);
      assertNoProviderToolCalls(result, "provider_openai_chat_completions");
      return result;
    },
    async invokeWithTools(request: ModelInvocationRequest, tools: unknown[], onDelta: (delta: ModelStreamDelta) => void): Promise<ModelToolCallResult> {
      const credential = resolveBearerCredential(env, ["OPENAI_API_KEY"], ["OPENAI_OAUTH_ACCESS_TOKEN"], "openai_chat_completions", providerRef);
      const body = {
        model: modelRef,
        messages: buildOpenAIChatMessages(request),
        max_completion_tokens: request.max_output_tokens,
        stream: true,
        stream_options: { include_usage: true },
        tools: tools as object[],
        tool_choice: "auto"
      };
      const response = await postStream(OPENAI_CHAT_COMPLETIONS_URL, {
        "authorization": `Bearer ${credential.value}`,
        "content-type": "application/json"
      }, body, "openai_chat_completions", providerRef, timeoutMs);

      const textParts: string[] = [];
      const toolCallAgg = new Map<number, { id: string; name: string; args: string }>();
      let finishReason = "stop";
      let usage: ModelToolCallResult["usage"] | undefined;

      for await (const data of readSseDataChunks(response)) {
        let chunk: OpenAIChatStreamChunk;
        try {
          chunk = JSON.parse(data) as OpenAIChatStreamChunk;
        } catch {
          continue;
        }
        const choice = chunk.choices?.[0];
        if (choice) {
          const delta = choice.delta;
          if (delta) {
            if (typeof delta.content === "string" && delta.content.length > 0) {
              textParts.push(delta.content);
              onDelta({ type: "text_delta", text: delta.content });
            }
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                const entry = toolCallAgg.get(idx) ?? { id: "", name: "", args: "" };
                if (tc.id) {
                  entry.id = tc.id;
                }
                if (tc.function?.name) {
                  entry.name = tc.function.name;
                }
                if (tc.function?.arguments) {
                  entry.args += tc.function.arguments;
                }
                toolCallAgg.set(idx, entry);
              }
            }
          }
          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }
        }
        if (chunk.usage) {
          usage = {
            input_tokens: Math.max(0, Math.trunc(chunk.usage.prompt_tokens ?? 0)),
            output_tokens: Math.max(0, Math.trunc(chunk.usage.completion_tokens ?? 0)),
            total_tokens: Math.max(0, Math.trunc(chunk.usage.total_tokens ?? 0)),
            usage_source: "provider_reported"
          };
        }
      }

      const toolCalls: ModelToolCall[] = [...toolCallAgg.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, entry]) => ({ id: entry.id || `call_${Math.random().toString(36).slice(2)}`, name: entry.name, arguments: entry.args }));

      const toolCallsPresent = toolCalls.length > 0 || finishReason === "tool_calls" || finishReason === "function_call";
      const result: ModelToolCallResult = {
        output_text: textParts.join(""),
        tool_calls: toolCalls,
        finish_reason: mapOpenAIChatFinishReason(finishReason, toolCallsPresent),
        refusal_present: false,
        usage: usage ?? locallyEstimatedUsage(request, textParts.join(""))
      };
      onDelta({ type: "done", result });
      return result;
    }
  };
}

// Real Anthropic Messages API provider. The official direct API uses x-api-key.
// The key is read at call time and never stored on the provider object or
// returned to the caller.
export function createAnthropicProvider(modelRef: string, env: Record<string, string | undefined>): ToolCapableProvider {
  const providerRef = "provider_anthropic";
  const timeoutMs = resolveProviderTimeoutMs(env, providerRef);
  return {
    provider_ref: providerRef,
    model_ref: modelRef,
    network_capable: true,
    async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
      const apiKey = firstEnvValue(env, ["ANTHROPIC_API_KEY"]);
      if (!apiKey) {
        throw modelProviderError({
          code: "provider_missing_credential",
          category: "credential",
          provider_ref: providerRef,
          retryable: false,
          message: "anthropic provider requires ANTHROPIC_API_KEY; direct Anthropic Messages API OAuth is not implemented."
        });
      }
      const system = systemAndDeveloperText(request.messages);
      const userContent = userText(request.messages);
      const body = {
        model: modelRef,
        max_tokens: request.max_output_tokens,
        system,
        messages: [{ role: "user", content: userContent }]
      };
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "anthropic-version": ANTHROPIC_API_VERSION,
        "x-api-key": apiKey.value
      };
      const payload = await postJson<AnthropicMessagesResponse>(ANTHROPIC_MESSAGES_URL, headers, body, "anthropic", providerRef, timeoutMs);
      const result = mapAnthropicResponse(payload);
      assertNoProviderToolCalls(result, "provider_anthropic");
      return result;
    },
    async invokeWithTools(request: ModelInvocationRequest, tools: unknown[], onDelta: (delta: ModelStreamDelta) => void): Promise<ModelToolCallResult> {
      const apiKey = firstEnvValue(env, ["ANTHROPIC_API_KEY"]);
      if (!apiKey) {
        throw modelProviderError({
          code: "provider_missing_credential",
          category: "credential",
          provider_ref: providerRef,
          retryable: false,
          message: "anthropic provider requires ANTHROPIC_API_KEY; direct Anthropic Messages API OAuth is not implemented."
        });
      }
      const { system, messages } = buildAnthropicMessages(request);
      const body = {
        model: modelRef,
        max_tokens: request.max_output_tokens,
        system,
        stream: true,
        messages: messages.length > 0 ? messages : [{ role: "user", content: userText(request.messages) }],
        tools: tools as object[],
        tool_choice: { type: "auto" }
      };
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "anthropic-version": ANTHROPIC_API_VERSION,
        "x-api-key": apiKey.value
      };
      const response = await postStream(ANTHROPIC_MESSAGES_URL, headers, body, "anthropic", providerRef, timeoutMs);

      const textParts: string[] = [];
      const toolCalls: ModelToolCall[] = [];
      let stopReason = "end_turn";
      let usage: ModelToolCallResult["usage"] | undefined;
      const inputBuffers = new Map<string, { name: string; json: string }>();

      for await (const data of readSseDataChunks(response)) {
        let event: AnthropicStreamEvent;
        try {
          event = JSON.parse(data) as AnthropicStreamEvent;
        } catch {
          continue;
        }
        if (event.type === "content_block_start" && event.index != null && event.content_block?.type === "tool_use") {
          inputBuffers.set(String(event.index), { name: event.content_block.name ?? "", json: "" });
        } else if (event.type === "content_block_delta" && event.delta) {
          if (event.delta.type === "text_delta" && typeof event.delta.text === "string") {
            textParts.push(event.delta.text);
            onDelta({ type: "text_delta", text: event.delta.text });
          } else if (event.delta.type === "input_json_delta" && typeof event.delta.partial_json === "string" && event.index != null) {
            const buf = inputBuffers.get(String(event.index));
            if (buf) {
              buf.json += event.delta.partial_json;
            }
          }
        } else if (event.type === "content_block_stop" && event.index != null) {
          const buf = inputBuffers.get(String(event.index));
          if (buf) {
            toolCalls.push({ id: `toolu_${event.index}`, name: buf.name, arguments: buf.json || "{}" });
            inputBuffers.delete(String(event.index));
          }
        } else if (event.type === "message_delta" && event.delta?.stop_reason) {
          stopReason = event.delta.stop_reason;
        } else if (event.type === "message_start" && event.message?.usage) {
          usage = {
            input_tokens: Math.max(0, Math.trunc(event.message.usage.input_tokens ?? 0)),
            output_tokens: Math.max(0, Math.trunc(event.message.usage.output_tokens ?? 0)),
            total_tokens: Math.max(0, Math.trunc((event.message.usage.input_tokens ?? 0) + (event.message.usage.output_tokens ?? 0))),
            usage_source: "provider_reported"
          };
        } else if (event.type === "message_delta" && event.usage) {
          usage = usage
            ? { ...usage, output_tokens: Math.max(0, Math.trunc(event.usage.output_tokens ?? usage.output_tokens)) }
            : { input_tokens: 0, output_tokens: Math.max(0, Math.trunc(event.usage.output_tokens ?? 0)), total_tokens: 0, usage_source: "provider_reported" };
          if (usage) {
            usage.total_tokens = usage.input_tokens + usage.output_tokens;
          }
        }
      }

      const toolCallsPresent = toolCalls.length > 0 || stopReason === "tool_use";
      const result: ModelToolCallResult = {
        output_text: textParts.join(""),
        tool_calls: toolCalls,
        finish_reason: mapStopReason(stopReason, toolCallsPresent),
        refusal_present: false,
        usage: usage ?? locallyEstimatedUsage(request, textParts.join(""))
      };
      onDelta({ type: "done", result });
      return result;
    }
  };
}

// Real Gemini generateContent provider. GEMINI_API_KEY is the direct API key
// path. GEMINI_OAUTH_ACCESS_TOKEN or GOOGLE_OAUTH_ACCESS_TOKEN may be supplied
// when an external Google OAuth flow already produced a bearer token.
export function createGeminiProvider(modelRef: string, env: Record<string, string | undefined>): ToolCapableProvider {
  const providerRef = "provider_gemini";
  const timeoutMs = resolveProviderTimeoutMs(env, providerRef);
  return {
    provider_ref: providerRef,
    model_ref: modelRef,
    network_capable: true,
    async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
      const credential = resolveGeminiCredential(env, providerRef);
      const system = systemAndDeveloperText(request.messages);
      const userContent = userText(request.messages) || allMessageText(request.messages);
      const body: Record<string, unknown> = {
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: { maxOutputTokens: request.max_output_tokens }
      };
      if (system) {
        body.systemInstruction = { parts: [{ text: system }] };
      }
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (credential.kind === "api_key") {
        headers["x-goog-api-key"] = credential.value;
      } else {
        headers.authorization = `Bearer ${credential.value}`;
      }
      const payload = await postJson<GeminiGenerateContentResponse>(
        `${GEMINI_GENERATE_CONTENT_BASE_URL}/${geminiModelPath(modelRef)}:generateContent`,
        headers,
        body,
        "gemini",
        providerRef,
        timeoutMs
      );
      const result = mapGeminiResponse(payload);
      assertNoProviderToolCalls(result, "provider_gemini");
      return result;
    },
    async invokeWithTools(request: ModelInvocationRequest, tools: unknown[], onDelta: (delta: ModelStreamDelta) => void): Promise<ModelToolCallResult> {
      const credential = resolveGeminiCredential(env, providerRef);
      const system = systemAndDeveloperText(request.messages);
      const functionDeclarations = tools.flatMap((tool) => {
        const record = tool as Record<string, unknown>;
        const decls = record.functionDeclarations;
        return Array.isArray(decls) ? decls : [tool];
      });
      const contents = buildGeminiContents(request);
      const body: Record<string, unknown> = {
        contents: contents.length > 0 ? contents : [{ role: "user", parts: [{ text: userText(request.messages) || allMessageText(request.messages) }] }],
        generationConfig: { maxOutputTokens: request.max_output_tokens },
        tools: [{ functionDeclarations }]
      };
      if (system) {
        body.systemInstruction = { parts: [{ text: system }] };
      }
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (credential.kind === "api_key") {
        headers["x-goog-api-key"] = credential.value;
      } else {
        headers.authorization = `Bearer ${credential.value}`;
      }
      const response = await postStream(
        `${GEMINI_GENERATE_CONTENT_BASE_URL}/${geminiModelPath(modelRef)}:streamGenerateContent?alt=sse`,
        headers,
        body,
        "gemini",
        providerRef,
        timeoutMs
      );

      const textParts: string[] = [];
      const toolCalls: ModelToolCall[] = [];
      let finishReason = "STOP";
      let usage: ModelToolCallResult["usage"] | undefined;

      for await (const data of readSseDataChunks(response)) {
        let chunk: GeminiGenerateContentResponse;
        try {
          chunk = JSON.parse(data) as GeminiGenerateContentResponse;
        } catch {
          continue;
        }
        const candidate = chunk.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (typeof part.text === "string" && part.text.length > 0) {
              textParts.push(part.text);
              onDelta({ type: "text_delta", text: part.text });
            }
            const fc = (part as { functionCall?: { name?: string; args?: Record<string, unknown> } }).functionCall;
            if (fc && typeof fc.name === "string") {
              toolCalls.push({ id: `gemini_call_${toolCalls.length + 1}`, name: fc.name, arguments: fc.args ?? {} });
            }
          }
        }
        if (candidate?.finishReason) {
          finishReason = candidate.finishReason;
        }
        if (chunk.usageMetadata) {
          usage = {
            input_tokens: Math.max(0, Math.trunc(chunk.usageMetadata.promptTokenCount ?? 0)),
            output_tokens: Math.max(0, Math.trunc(chunk.usageMetadata.candidatesTokenCount ?? 0)),
            total_tokens: Math.max(0, Math.trunc(chunk.usageMetadata.totalTokenCount ?? 0)),
            usage_source: "provider_reported"
          };
        }
      }

      const toolCallsPresent = toolCalls.length > 0;
      const result: ModelToolCallResult = {
        output_text: textParts.join(""),
        tool_calls: toolCalls,
        finish_reason: mapGeminiFinishReason(finishReason, toolCallsPresent),
        refusal_present: finishReason === "SAFETY" || finishReason === "RECITATION",
        usage: usage ?? locallyEstimatedUsage(request, textParts.join(""))
      };
      onDelta({ type: "done", result });
      return result;
    }
  };
}

type ProviderCredential = {
  kind: "api_key" | "oauth_bearer";
  value: string;
  source_env: string;
};

type OpenAIResponsesResponse = {
  status?: string;
  output_text?: string;
  incomplete_details?: { reason?: string };
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string; refusal?: string }>;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
};

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | null;
      refusal?: string | null;
      tool_calls?: unknown[];
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

type AnthropicMessagesResponse = {
  stop_reason?: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string; functionCall?: unknown; executableCode?: unknown }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

// Streaming chunk shapes. Each provider streams SSE `data:` lines whose payload
// matches one of these. Fields are optional because chunks are incremental.
type OpenAIChatStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

type OpenAIResponsesToolResponse = {
  status?: string;
  output_text?: string;
  incomplete_details?: { reason?: string };
  output?: Array<{
    id?: string;
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
    call_id?: string;
    name?: string;
    arguments?: string;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
};

type AnthropicStreamEvent = {
  type?: string;
  index?: number;
  content_block?: { type?: string; name?: string };
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  message?: { usage?: { input_tokens?: number; output_tokens?: number } };
  usage?: { output_tokens?: number };
};


function mapOpenAIResponsesResponse(payload: OpenAIResponsesResponse): ModelInvocationResult {
  const contentBlocks = (payload.output ?? []).flatMap((item) => item.content ?? []);
  const output_text = payload.output_text
    ?? contentBlocks.filter((block) => typeof block.text === "string").map((block) => block.text as string).join("");
  const toolCallsPresent = (payload.output ?? []).some((item) => typeof item.type === "string" && item.type.includes("call"));
  const refusalPresent = contentBlocks.some((block) => typeof block.refusal === "string" && block.refusal.length > 0);
  const input_tokens = Math.max(0, Math.trunc(payload.usage?.input_tokens ?? 0));
  const output_tokens = Math.max(0, Math.trunc(payload.usage?.output_tokens ?? 0));
  const total_tokens = Math.max(input_tokens + output_tokens, Math.trunc(payload.usage?.total_tokens ?? input_tokens + output_tokens));
  return {
    output_text,
    finish_reason: mapOpenAIResponsesFinishReason(payload, toolCallsPresent),
    refusal_present: refusalPresent,
    tool_calls_present: toolCallsPresent,
    usage: {
      input_tokens,
      output_tokens,
      total_tokens,
      usage_source: "provider_reported"
    }
  };
}

function mapOpenAIChatCompletionResponse(payload: OpenAIChatCompletionResponse): ModelInvocationResult {
  const choice = payload.choices?.[0];
  const output_text = choice?.message?.content ?? "";
  const toolCallsPresent = (choice?.message?.tool_calls?.length ?? 0) > 0 || choice?.finish_reason === "tool_calls";
  const input_tokens = Math.max(0, Math.trunc(payload.usage?.prompt_tokens ?? 0));
  const output_tokens = Math.max(0, Math.trunc(payload.usage?.completion_tokens ?? 0));
  const total_tokens = Math.max(input_tokens + output_tokens, Math.trunc(payload.usage?.total_tokens ?? input_tokens + output_tokens));
  return {
    output_text,
    finish_reason: mapOpenAIChatFinishReason(choice?.finish_reason, toolCallsPresent),
    refusal_present: typeof choice?.message?.refusal === "string" && choice.message.refusal.length > 0,
    tool_calls_present: toolCallsPresent,
    usage: {
      input_tokens,
      output_tokens,
      total_tokens,
      usage_source: "provider_reported"
    }
  };
}

function mapAnthropicResponse(payload: AnthropicMessagesResponse): ModelInvocationResult {
  const textParts = (payload.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string);
  const toolCallsPresent = (payload.content ?? []).some((block) => block.type === "tool_use");
  const output_text = textParts.join("");
  const input_tokens = Math.max(0, Math.trunc(payload.usage?.input_tokens ?? 0));
  const output_tokens = Math.max(0, Math.trunc(payload.usage?.output_tokens ?? 0));
  return {
    output_text,
    finish_reason: mapStopReason(payload.stop_reason, toolCallsPresent),
    refusal_present: false,
    tool_calls_present: toolCallsPresent,
    usage: {
      input_tokens,
      output_tokens,
      total_tokens: input_tokens + output_tokens,
      usage_source: "provider_reported"
    }
  };
}

function mapGeminiResponse(payload: GeminiGenerateContentResponse): ModelInvocationResult {
  const candidate = payload.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const output_text = parts.filter((part) => typeof part.text === "string").map((part) => part.text as string).join("");
  const toolCallsPresent = parts.some((part) => Boolean(part.functionCall) || Boolean(part.executableCode));
  const input_tokens = Math.max(0, Math.trunc(payload.usageMetadata?.promptTokenCount ?? 0));
  const output_tokens = Math.max(0, Math.trunc(payload.usageMetadata?.candidatesTokenCount ?? 0));
  const total_tokens = Math.max(input_tokens + output_tokens, Math.trunc(payload.usageMetadata?.totalTokenCount ?? input_tokens + output_tokens));
  return {
    output_text,
    finish_reason: mapGeminiFinishReason(candidate?.finishReason, toolCallsPresent),
    refusal_present: candidate?.finishReason === "SAFETY" || candidate?.finishReason === "RECITATION",
    tool_calls_present: toolCallsPresent,
    usage: {
      input_tokens,
      output_tokens,
      total_tokens,
      usage_source: "provider_reported"
    }
  };
}

function mapStopReason(stopReason: string | undefined, toolCallsPresent: boolean): ModelInvocationResult["finish_reason"] {
  if (toolCallsPresent || stopReason === "tool_use") {
    return "tool_call";
  }
  switch (stopReason) {
    case "max_tokens":
      return "length";
    case "refusal":
      return "content_filter";
    case "end_turn":
    case "stop_sequence":
      return "stop";
    default:
      return "stop";
  }
}

function mapOpenAIResponsesFinishReason(payload: OpenAIResponsesResponse, toolCallsPresent: boolean): ModelInvocationResult["finish_reason"] {
  if (toolCallsPresent) {
    return "tool_call";
  }
  if (payload.status === "incomplete") {
    return payload.incomplete_details?.reason === "max_output_tokens" ? "length" : "error";
  }
  if (payload.status === "failed") {
    return "error";
  }
  return "stop";
}

function mapOpenAIChatFinishReason(finishReason: string | undefined, toolCallsPresent: boolean): ModelInvocationResult["finish_reason"] {
  if (toolCallsPresent || finishReason === "tool_calls" || finishReason === "function_call") {
    return "tool_call";
  }
  switch (finishReason) {
    case "length":
      return "length";
    case "content_filter":
      return "content_filter";
    case "stop":
    case null:
    case undefined:
      return "stop";
    default:
      return "stop";
  }
}

function mapGeminiFinishReason(finishReason: string | undefined, toolCallsPresent: boolean): ModelInvocationResult["finish_reason"] {
  if (toolCallsPresent) {
    return "tool_call";
  }
  switch (finishReason) {
    case "MAX_TOKENS":
      return "length";
    case "SAFETY":
    case "RECITATION":
      return "content_filter";
    case "STOP":
    case undefined:
      return "stop";
    default:
      return "stop";
  }
}

function normalizeProviderName(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, "_");
  switch (normalized) {
    case "openai":
    case "openai_response":
    case "openai_responses":
    case "responses":
      return "openai_responses";
    case "openai_chat":
    case "openai_chat_completion":
    case "openai_chat_completions":
    case "openai_completion":
    case "openai_completions":
    case "chat_completions":
      return "openai_chat_completions";
    case "google":
    case "google_gemini":
    case "gemini_generate_content":
      return "gemini";
    default:
      return normalized;
  }
}

function systemAndDeveloperText(messages: ModelMessage[]): string {
  return messages
    .filter((message) => message.role === "system" || message.role === "developer")
    .map((message) => message.content)
    .join("\n\n");
}

function userText(messages: ModelMessage[]): string {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n\n");
}

function allMessageText(messages: ModelMessage[]): string {
  return messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
}

function resolveBearerCredential(
  env: Record<string, string | undefined>,
  apiKeyEnvNames: string[],
  oauthEnvNames: string[],
  providerName: string,
  providerRef: string
): ProviderCredential {
  const apiKey = firstEnvValue(env, apiKeyEnvNames);
  if (apiKey) {
    return { kind: "api_key", value: apiKey.value, source_env: apiKey.name };
  }
  const oauth = firstEnvValue(env, oauthEnvNames);
  if (oauth) {
    return { kind: "oauth_bearer", value: oauth.value, source_env: oauth.name };
  }
  throw modelProviderError({
    code: "provider_missing_credential",
    category: "credential",
    provider_ref: providerRef,
    retryable: false,
    message: `${providerName} provider requires one of ${[...apiKeyEnvNames, ...oauthEnvNames].join(", ")}.`
  });
}

function resolveGeminiCredential(env: Record<string, string | undefined>, providerRef: string): ProviderCredential {
  const apiKey = firstEnvValue(env, ["GEMINI_API_KEY", "GOOGLE_API_KEY"]);
  if (apiKey) {
    return { kind: "api_key", value: apiKey.value, source_env: apiKey.name };
  }
  const oauth = firstEnvValue(env, ["GEMINI_OAUTH_ACCESS_TOKEN", "GOOGLE_OAUTH_ACCESS_TOKEN"]);
  if (oauth) {
    return { kind: "oauth_bearer", value: oauth.value, source_env: oauth.name };
  }
  throw modelProviderError({
    code: "provider_missing_credential",
    category: "credential",
    provider_ref: providerRef,
    retryable: false,
    message: "gemini provider requires one of GEMINI_API_KEY, GOOGLE_API_KEY, GEMINI_OAUTH_ACCESS_TOKEN, GOOGLE_OAUTH_ACCESS_TOKEN."
  });
}

function firstEnvValue(env: Record<string, string | undefined>, names: string[]): { name: string; value: string } | null {
  for (const name of names) {
    const value = (env[name] ?? "").trim();
    if (value) {
      return { name, value };
    }
  }
  return null;
}

async function postJson<T>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  providerName: string,
  providerRef: string,
  timeoutMs: number
): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error(`timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    response = await Promise.race([
      fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      }),
      timeoutPromise
    ]);
  } catch (error) {
    const message = timedOut
      ? `timed out after ${timeoutMs}ms`
      : error instanceof Error ? error.message : String(error);
    throw modelProviderError({
      code: timedOut ? "provider_timeout" : "provider_network_failure",
      category: "network",
      provider_ref: providerRef,
      retryable: true,
      message: `${providerName} provider network call failed: ${message}`
    });
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
  if (!response.ok) {
    // Do not echo the response body; it may contain request context.
    throw modelProviderError({
      code: "provider_http_error",
      category: "upstream_http",
      provider_ref: providerRef,
      retryable: retryableHttpStatus(response.status),
      http_status: response.status,
      message: `${providerName} provider returned HTTP ${response.status}`
    });
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw modelProviderError({
      code: "provider_malformed_json",
      category: "upstream_payload",
      provider_ref: providerRef,
      retryable: false,
      message: `${providerName} provider returned malformed JSON`
    });
  }
}

// Streaming POST variant. Returns the raw Response so the caller can read the
// SSE body incrementally. Same timeout/error contract as postJson, but the body
// is never buffered or parsed as JSON here.
async function postStream(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  providerName: string,
  providerRef: string,
  timeoutMs: number
): Promise<Response> {
  let response: Response;
  const controller = new AbortController();
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error(`timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    response = await Promise.race([
      fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      }),
      timeoutPromise
    ]);
  } catch (error) {
    const message = timedOut
      ? `timed out after ${timeoutMs}ms`
      : error instanceof Error ? error.message : String(error);
    throw modelProviderError({
      code: timedOut ? "provider_timeout" : "provider_network_failure",
      category: "network",
      provider_ref: providerRef,
      retryable: true,
      message: `${providerName} provider network call failed: ${message}`
    });
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
  if (!response.ok) {
    throw modelProviderError({
      code: "provider_http_error",
      category: "upstream_http",
      provider_ref: providerRef,
      retryable: retryableHttpStatus(response.status),
      http_status: response.status,
      message: `${providerName} provider returned HTTP ${response.status}`
    });
  }
  return response;
}

// Fallback usage estimate when a provider does not report token counts.
function locallyEstimatedUsage(request: ModelInvocationRequest, outputText: string): ModelToolCallResult["usage"] {
  const input_tokens = estimateTokens(request.messages.map((message) => message.content).join("\n"));
  const output_tokens = estimateTokens(outputText);
  return {
    input_tokens,
    output_tokens,
    total_tokens: input_tokens + output_tokens,
    usage_source: "locally_estimated"
  };
}


function resolveProviderTimeoutMs(env: Record<string, string | undefined>, providerRef: string): number {
  const raw = env.AETHERION_MODEL_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_PROVIDER_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw modelProviderError({
      code: "provider_invalid_timeout",
      category: "configuration",
      provider_ref: providerRef,
      retryable: false,
      message: "AETHERION_MODEL_TIMEOUT_MS must be a positive number of milliseconds"
    });
  }
  return Math.trunc(parsed);
}

function retryableHttpStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function geminiModelPath(modelRef: string): string {
  return modelRef.startsWith("models/") ? modelRef : `models/${modelRef}`;
}

function renderStubResponse(request: ModelInvocationRequest): string {
  const citationIds = request.response_contract?.required_citation_ids ?? [];
  const citationLine = citationIds.length > 0
    ? citationIds.map((eventId) => `- ${eventId}`).join("\n")
    : "- No source events were provided for this task.";
  const blocks = request.response_contract?.required_blocks ?? [];
  const rendered = blocks.map((block) => {
    if (block.id === "evidence_summary") {
      return `## ${block.title}\n\nThis plan is grounded in the following recorded source events:\n${citationLine}`;
    }
    if (block.id === "assumptions_and_conflicts") {
      return `## ${block.title}\n\nNo conflicting context was supplied. Any missing evidence is treated as unknown rather than assumed.`;
    }
    if (block.id === "plan" || block.id === "answer" || block.id === "patch_outline") {
      return `## ${block.title}\n\nOutline the requested work in ordered steps using only the supplied source-backed context. Each step stays within the requested ${request.output_mode} mode.`;
    }
    if (block.id === "policy_and_lease_needs") {
      return `## ${block.title}\n\nAny future sensitive read, write, egress, delivery, or tool use would be phrased as a request requiring Local Supervisor policy and a scoped lease before execution.`;
    }
    if (block.id === "verification_evidence") {
      return `## ${block.title}\n\nDefine the tests, audits, or replay checks that would need to pass before treating this work as complete.`;
    }
    return `## ${block.title}\n\nContent for ${block.id}.`;
  });
  return rendered.join("\n\n").trim();
}

// Rough local token estimate (~4 chars/token) for offline usage accounting.
function estimateTokens(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(text.length / 4));
}
