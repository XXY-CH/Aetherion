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
// provider is the stub unless AETHERION_MODEL_PROVIDER=anthropic is set with a
// resolvable credential.

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

const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_API_VERSION = "2023-06-01";
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

export function resolveModelProvider(options: ResolveModelProviderOptions = {}): ModelProvider {
  const env = options.env ?? process.env;
  const providerName = (options.providerName ?? env.AETHERION_MODEL_PROVIDER ?? "stub").trim().toLowerCase();
  if (providerName === "stub") {
    return createStubProvider(options.modelRef ?? env.AETHERION_MODEL_REF ?? "stub-deterministic-v1");
  }
  if (providerName === "anthropic") {
    return createAnthropicProvider(options.modelRef ?? env.AETHERION_MODEL_REF ?? DEFAULT_ANTHROPIC_MODEL, env);
  }
  throw new Error(`Unknown model provider '${providerName}'. Set AETHERION_MODEL_PROVIDER to 'stub' or 'anthropic'.`);
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

// Real Anthropic Messages API provider. The API key is read at call time from
// the supplied environment and used only for the request Authorization; it is
// never stored on the provider object or returned to the caller.
export function createAnthropicProvider(modelRef: string, env: Record<string, string | undefined>): ModelProvider {
  return {
    provider_ref: "provider_anthropic",
    model_ref: modelRef,
    network_capable: true,
    async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
      const apiKey = (env.ANTHROPIC_API_KEY ?? "").trim();
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY is not set; cannot invoke the anthropic provider.");
      }
      const system = request.messages
        .filter((message) => message.role === "system" || message.role === "developer")
        .map((message) => message.content)
        .join("\n\n");
      const userContent = request.messages
        .filter((message) => message.role === "user")
        .map((message) => message.content)
        .join("\n\n");
      const body = {
        model: modelRef,
        max_tokens: request.max_output_tokens,
        system,
        messages: [{ role: "user", content: userContent }]
      };
      let response: Response;
      try {
        response = await fetch(ANTHROPIC_MESSAGES_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_API_VERSION
          },
          body: JSON.stringify(body)
        });
      } catch (error) {
        throw new Error(`anthropic provider network call failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (!response.ok) {
        // Do not echo the response body; it may contain request context.
        throw new Error(`anthropic provider returned HTTP ${response.status}`);
      }
      const payload = (await response.json()) as AnthropicMessagesResponse;
      return mapAnthropicResponse(payload);
    }
  };
}

type AnthropicMessagesResponse = {
  stop_reason?: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

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
