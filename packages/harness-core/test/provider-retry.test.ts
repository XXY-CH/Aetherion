import assert from "node:assert/strict";
import { test } from "node:test";
import { isModelProviderError, resolveModelProvider } from "../src/index.ts";

type ResponseFactory = () => Response;

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

const OPENAI_OK = {
  status: "completed",
  output_text: "Recovered output.",
  usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 }
};

// Replays a fixed sequence of fetch outcomes, counting how many times the live
// provider actually reached the network so retry attempts can be asserted.
async function withSequencedFetch(
  factories: ResponseFactory[],
  run: (state: { calls: number }) => Promise<void>
): Promise<void> {
  const originalFetch = globalThis.fetch;
  const state = { calls: 0 };
  globalThis.fetch = (async () => {
    const factory = factories[Math.min(state.calls, factories.length - 1)];
    state.calls += 1;
    return factory();
  }) as typeof fetch;
  try {
    await run(state);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function openAiProvider(extraEnv: Record<string, string> = {}) {
  return resolveModelProvider({
    env: {
      AETHERION_MODEL_PROVIDER: "openai_responses",
      OPENAI_API_KEY: "openai-api-key",
      // Keep backoff delays at zero so the suite stays fast and deterministic.
      AETHERION_MODEL_RETRY_BASE_MS: "0",
      AETHERION_MODEL_RETRY_MAX_MS: "0",
      ...extraEnv
    }
  });
}

const request = {
  provider_ref: "provider_openai_responses",
  model_ref: "gpt-test",
  output_mode: "answer" as const,
  messages: [{ role: "user" as const, content: "Answer from source events." }],
  max_output_tokens: 16
};

test("provider retries transient 503 responses and then succeeds", async () => {
  await withSequencedFetch([
    () => jsonResponse(503, { error: { message: "overloaded" } }),
    () => jsonResponse(503, { error: { message: "overloaded" } }),
    () => jsonResponse(200, OPENAI_OK)
  ], async (state) => {
    const provider = openAiProvider({ AETHERION_MODEL_MAX_RETRIES: "2" });
    const result = await provider.invoke(request);
    assert.equal(result.output_text, "Recovered output.");
    assert.equal(state.calls, 3);
  });
});

test("provider retries network failures until success", async () => {
  await withSequencedFetch([
    () => { throw new Error("ECONNRESET"); },
    () => jsonResponse(200, OPENAI_OK)
  ], async (state) => {
    const provider = openAiProvider({ AETHERION_MODEL_MAX_RETRIES: "2" });
    const result = await provider.invoke(request);
    assert.equal(result.output_text, "Recovered output.");
    assert.equal(state.calls, 2);
  });
});

test("provider does not retry non-retryable 400 responses", async () => {
  await withSequencedFetch([
    () => jsonResponse(400, { error: { message: "bad request" } })
  ], async (state) => {
    const provider = openAiProvider({ AETHERION_MODEL_MAX_RETRIES: "2" });
    await assert.rejects(provider.invoke(request), (error) => {
      assert.ok(isModelProviderError(error));
      assert.equal(error.http_status, 400);
      assert.equal(error.retryable, false);
      return true;
    });
    assert.equal(state.calls, 1);
  });
});

test("provider stops after exhausting retries on persistent 429", async () => {
  await withSequencedFetch([
    () => jsonResponse(429, { error: { message: "rate limited" } }, { "retry-after": "0" })
  ], async (state) => {
    const provider = openAiProvider({ AETHERION_MODEL_MAX_RETRIES: "2" });
    await assert.rejects(provider.invoke(request), (error) => {
      assert.ok(isModelProviderError(error));
      assert.equal(error.http_status, 429);
      assert.equal(error.retryable, true);
      return true;
    });
    assert.equal(state.calls, 3);
  });
});

test("provider retry can be disabled with AETHERION_MODEL_MAX_RETRIES=0", async () => {
  await withSequencedFetch([
    () => jsonResponse(503, { error: { message: "overloaded" } })
  ], async (state) => {
    const provider = openAiProvider({ AETHERION_MODEL_MAX_RETRIES: "0" });
    await assert.rejects(provider.invoke(request), (error) => {
      assert.ok(isModelProviderError(error));
      assert.equal(error.http_status, 503);
      return true;
    });
    assert.equal(state.calls, 1);
  });
});
