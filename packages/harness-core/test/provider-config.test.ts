import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  readProviderConfig,
  writeProviderConfig,
  redactApiKey,
  SUPPORTED_PROVIDERS
} from "../src/provider-config.ts";

async function makeWorkspace(): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-prov-config-"));
  await mkdir(join(ws, ".aetherion"), { recursive: true });
  return ws;
}

test("writeProviderConfig stores provider + model + key in JSON", async () => {
  const ws = await makeWorkspace();
  writeProviderConfig(ws, { provider: "anthropic", model_ref: "claude-sonnet-4-20250514", api_key: "test-key-anthropic" });
  const config = readProviderConfig(ws);
  assert.ok(config);
  assert.equal(config!.provider, "anthropic");
  assert.equal(config!.model_ref, "claude-sonnet-4-20250514");
  assert.equal(config!.api_key, "test-key-anthropic");
});

test("readProviderConfig returns null when file doesn't exist", async () => {
  const ws = await makeWorkspace();
  const config = readProviderConfig(ws);
  assert.equal(config, null);
});

test("provider-config.json has 0600 permissions", async () => {
  const ws = await makeWorkspace();
  writeProviderConfig(ws, { provider: "openai_responses", model_ref: "gpt-4o", api_key: "test-key-openai" });
  const stats = statSync(join(ws, ".aetherion", "provider-config.json"));
  const mode = stats.mode & 0o777;
  assert.equal(mode, 0o600, `expected 0600 perms, got ${mode.toString(8)}`);
});

test("redactApiKey masks the middle of the key", () => {
  const config = { provider: "anthropic", model_ref: "claude", api_key: "test-key-1234567890abcdef" };
  const redacted = redactApiKey(config);
  assert.ok(redacted.api_key!.includes("..."));
  assert.ok(!redacted.api_key!.includes("1234567890abcdef"));
});

test("redactApiKey preserves config without key", () => {
  const config = { provider: "stub", model_ref: "stub-deterministic-v1" };
  const redacted = redactApiKey(config);
  assert.equal(redacted.api_key, undefined);
});

test("SUPPORTED_PROVIDERS includes anthropic and openai", () => {
  const names = SUPPORTED_PROVIDERS.map((p) => p.name);
  assert.ok(names.includes("anthropic"));
  assert.ok(names.includes("openai_responses"));
  assert.ok(names.includes("stub"));
});

test("writeProviderConfig overwrites previous config", async () => {
  const ws = await makeWorkspace();
  writeProviderConfig(ws, { provider: "stub", model_ref: "stub-v1" });
  writeProviderConfig(ws, { provider: "anthropic", model_ref: "claude" });
  const config = readProviderConfig(ws);
  assert.equal(config!.provider, "anthropic");
  assert.equal(config!.model_ref, "claude");
});
