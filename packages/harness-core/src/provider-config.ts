// Provider configuration storage.
//
// Stores provider name, model ref, and API key in .aetherion/provider-config.json.
// File permissions are 0600 (same trust level as Hermes auth.json, OpenCode auth.json).
//
// resolveModelProvider uses this as fallback when env vars are absent.

import { readFileSync, writeFileSync, existsSync, chmodSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export type ProviderConfig = {
  provider: string;       // "stub" | "anthropic" | "openai_responses" | "openai_chat_completions" | "gemini"
  model_ref: string;
  api_key?: string;       // plaintext, stored with 0600 perms
  base_url?: string;      // optional override
};

export const SUPPORTED_PROVIDERS = [
  { name: "stub", label: "Stub (offline testing)", needsKey: false },
  { name: "anthropic", label: "Anthropic (Claude)", needsKey: true, keyEnv: "ANTHROPIC_API_KEY" },
  { name: "openai_responses", label: "OpenAI (Responses API)", needsKey: true, keyEnv: "OPENAI_API_KEY" },
  { name: "openai_chat_completions", label: "OpenAI (Chat Completions)", needsKey: true, keyEnv: "OPENAI_API_KEY" },
  { name: "gemini", label: "Google Gemini", needsKey: true, keyEnv: "GEMINI_API_KEY" }
] as const;

function configPath(workspaceRoot: string): string {
  return join(workspaceRoot, ".aetherion", "provider-config.json");
}

// Read provider config from disk. Returns null if file doesn't exist.
export function readProviderConfig(workspaceRoot: string): ProviderConfig | null {
  const path = configPath(workspaceRoot);
  if (!existsSync(path)) return null;
  try {
    const data = readFileSync(path, "utf8");
    const parsed = JSON.parse(data) as ProviderConfig;
    if (typeof parsed.provider === "string" && typeof parsed.model_ref === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// Write provider config to disk with 0600 permissions.
export function writeProviderConfig(workspaceRoot: string, config: ProviderConfig): void {
  const path = configPath(workspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf8");
  try {
    chmodSync(path, 0o600);
  } catch {
    // chmod may fail on some platforms — best effort.
  }
}

// Display config with API key redacted.
export function redactApiKey(config: ProviderConfig): ProviderConfig {
  if (!config.api_key) return config;
  const key = config.api_key;
  const visible = key.length > 8 ? key.slice(0, 4) + "..." + key.slice(-4) : "...";
  return { ...config, api_key: visible };
}
