import { createHash } from "node:crypto";
import type { ToolDefinition } from "./tool-registry.ts";

// A ContextEpoch is the hash of the model-visible context baseline captured when
// a run starts. It lets a long-running, restarted, or nested run detect that the
// context it is operating under has drifted from what it was admitted with —
// most importantly, that the advertised tool surface changed mid-run.
export type ContextEpoch = {
  // Hash over the whole model-visible baseline (system prompt + tool surface).
  context_hash: string;
  // Hash over just the advertised tool descriptors, so a drifting tool
  // registration can be detected independently of prompt text.
  tools_hash: string;
  tool_count: number;
};

// canonicalize produces a deterministic, key-sorted JSON string so structurally
// equal values hash identically regardless of property insertion order.
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(",")}}`;
}

// toolRegistryDigest hashes the advertised tool descriptors. It is order- and
// key-order-independent: the same set of tools yields the same digest no matter
// how the registry happens to be ordered.
export function toolRegistryDigest(tools: readonly ToolDefinition[]): string {
  const canonical = tools
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      verb: tool.verb,
      parameters: tool.parameters
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return createHash("sha256").update(canonicalize(canonical)).digest("hex");
}

// computeContextEpoch captures the baseline hash from the system prompt and the
// advertised tools at admission time.
export function computeContextEpoch(systemPrompt: string, tools: readonly ToolDefinition[]): ContextEpoch {
  const toolsHash = toolRegistryDigest(tools);
  const contextHash = createHash("sha256")
    .update(systemPrompt)
    .update("\u0000")
    .update(toolsHash)
    .digest("hex");
  return { context_hash: contextHash, tools_hash: toolsHash, tool_count: tools.length };
}
