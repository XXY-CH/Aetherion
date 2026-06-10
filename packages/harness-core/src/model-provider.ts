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

export type ModelProvider = {
  provider_ref: string;
  model_ref: string;
  // True only when an outbound network call was made. The stub stays false.
  network_capable: boolean;
  invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult>;
};

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

export function resolveModelProvider(options: ResolveModelProviderOptions = {}): ModelProvider {
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
  throw new Error(
    `Unknown model provider '${providerName}'. Set AETHERION_MODEL_PROVIDER to 'stub', 'openai_responses', 'openai_chat_completions', 'anthropic', or 'gemini'.`
  );
}

// Deterministic, offline provider. It never touches the network and produces a
// response that satisfies the local prompt response contract so the audit step
// can be exercised end to end without a live model.
export function createStubProvider(modelRef: string): ModelProvider {
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
    }
  };
}

// Real OpenAI Responses API provider. OPENAI_API_KEY is the standard direct
// platform credential. OPENAI_OAUTH_ACCESS_TOKEN is accepted only as an
// externally obtained bearer token; Aetherion does not run an OAuth flow here.
export function createOpenAIResponsesProvider(modelRef: string, env: Record<string, string | undefined>): ModelProvider {
  const timeoutMs = resolveProviderTimeoutMs(env);
  return {
    provider_ref: "provider_openai_responses",
    model_ref: modelRef,
    network_capable: true,
    async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
      const credential = resolveBearerCredential(env, ["OPENAI_API_KEY"], ["OPENAI_OAUTH_ACCESS_TOKEN"], "openai_responses");
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
      }, body, "openai_responses", timeoutMs);
      return mapOpenAIResponsesResponse(payload);
    }
  };
}

// Real OpenAI Chat Completions API provider. This keeps the older
// message-array surface available for models and deployments that still expect
// chat completions instead of Responses.
export function createOpenAIChatCompletionsProvider(modelRef: string, env: Record<string, string | undefined>): ModelProvider {
  const timeoutMs = resolveProviderTimeoutMs(env);
  return {
    provider_ref: "provider_openai_chat_completions",
    model_ref: modelRef,
    network_capable: true,
    async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
      const credential = resolveBearerCredential(env, ["OPENAI_API_KEY"], ["OPENAI_OAUTH_ACCESS_TOKEN"], "openai_chat_completions");
      const body = {
        model: modelRef,
        messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
        max_completion_tokens: request.max_output_tokens,
        stream: false
      };
      const payload = await postJson<OpenAIChatCompletionResponse>(OPENAI_CHAT_COMPLETIONS_URL, {
        "authorization": `Bearer ${credential.value}`,
        "content-type": "application/json"
      }, body, "openai_chat_completions", timeoutMs);
      return mapOpenAIChatCompletionResponse(payload);
    }
  };
}

// Real Anthropic Messages API provider. The official direct API uses x-api-key.
// The key is read at call time and never stored on the provider object or
// returned to the caller.
export function createAnthropicProvider(modelRef: string, env: Record<string, string | undefined>): ModelProvider {
  const timeoutMs = resolveProviderTimeoutMs(env);
  return {
    provider_ref: "provider_anthropic",
    model_ref: modelRef,
    network_capable: true,
    async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
      const apiKey = firstEnvValue(env, ["ANTHROPIC_API_KEY"]);
      if (!apiKey) {
        throw new Error("anthropic provider requires ANTHROPIC_API_KEY; direct Anthropic Messages API OAuth is not implemented.");
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
      const payload = await postJson<AnthropicMessagesResponse>(ANTHROPIC_MESSAGES_URL, headers, body, "anthropic", timeoutMs);
      return mapAnthropicResponse(payload);
    }
  };
}

// Real Gemini generateContent provider. GEMINI_API_KEY is the direct API key
// path. GEMINI_OAUTH_ACCESS_TOKEN or GOOGLE_OAUTH_ACCESS_TOKEN may be supplied
// when an external Google OAuth flow already produced a bearer token.
export function createGeminiProvider(modelRef: string, env: Record<string, string | undefined>): ModelProvider {
  const timeoutMs = resolveProviderTimeoutMs(env);
  return {
    provider_ref: "provider_gemini",
    model_ref: modelRef,
    network_capable: true,
    async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
      const credential = resolveGeminiCredential(env);
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
        timeoutMs
      );
      return mapGeminiResponse(payload);
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
  providerName: string
): ProviderCredential {
  const apiKey = firstEnvValue(env, apiKeyEnvNames);
  if (apiKey) {
    return { kind: "api_key", value: apiKey.value, source_env: apiKey.name };
  }
  const oauth = firstEnvValue(env, oauthEnvNames);
  if (oauth) {
    return { kind: "oauth_bearer", value: oauth.value, source_env: oauth.name };
  }
  throw new Error(`${providerName} provider requires one of ${[...apiKeyEnvNames, ...oauthEnvNames].join(", ")}.`);
}

function resolveGeminiCredential(env: Record<string, string | undefined>): ProviderCredential {
  const apiKey = firstEnvValue(env, ["GEMINI_API_KEY", "GOOGLE_API_KEY"]);
  if (apiKey) {
    return { kind: "api_key", value: apiKey.value, source_env: apiKey.name };
  }
  const oauth = firstEnvValue(env, ["GEMINI_OAUTH_ACCESS_TOKEN", "GOOGLE_OAUTH_ACCESS_TOKEN"]);
  if (oauth) {
    return { kind: "oauth_bearer", value: oauth.value, source_env: oauth.name };
  }
  throw new Error("gemini provider requires one of GEMINI_API_KEY, GOOGLE_API_KEY, GEMINI_OAUTH_ACCESS_TOKEN, GOOGLE_OAUTH_ACCESS_TOKEN.");
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
    throw new Error(`${providerName} provider network call failed: ${message}`);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
  if (!response.ok) {
    // Do not echo the response body; it may contain request context.
    throw new Error(`${providerName} provider returned HTTP ${response.status}`);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`${providerName} provider returned malformed JSON`);
  }
}

function resolveProviderTimeoutMs(env: Record<string, string | undefined>): number {
  const raw = env.AETHERION_MODEL_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_PROVIDER_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("AETHERION_MODEL_TIMEOUT_MS must be a positive number of milliseconds");
  }
  return Math.trunc(parsed);
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
