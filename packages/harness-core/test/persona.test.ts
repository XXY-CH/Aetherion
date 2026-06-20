import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadPersonaFiles, formatPersonaForPrompt, type PersonaContext } from "../src/persona.ts";

test("loadPersonaFiles reads SOUL.md and IDENTITY.md when present", async () => {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-persona-"));
  await writeFile(join(ws, "SOUL.md"), "Be concise and helpful.\nUse a warm tone.\n");
  await writeFile(join(ws, "IDENTITY.md"), "Name: Aetherion\nVibe: calm, precise\n");
  const result = loadPersonaFiles(ws);
  assert.match(result.soul!, /concise and helpful/);
  assert.match(result.identity!, /Aetherion/);
});

test("loadPersonaFiles returns nulls when files absent", async () => {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-no-persona-"));
  const result = loadPersonaFiles(ws);
  assert.equal(result.soul, null);
  assert.equal(result.identity, null);
});

test("loadPersonaFiles handles SOUL.md without IDENTITY.md", async () => {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-soul-only-"));
  await writeFile(join(ws, "SOUL.md"), "Just soul.\n");
  const result = loadPersonaFiles(ws);
  assert.ok(result.soul);
  assert.equal(result.identity, null);
});

test("formatPersonaForPrompt includes identity section", () => {
  const formatted = formatPersonaForPrompt({
    soul: null,
    identity: "Name: Test\nVibe: friendly",
    anchors: []
  });
  assert.match(formatted, /## Identity/);
  assert.match(formatted, /Name: Test/);
});

test("formatPersonaForPrompt includes soul section", () => {
  const formatted = formatPersonaForPrompt({
    soul: "Be precise.",
    identity: null,
    anchors: []
  });
  assert.match(formatted, /## Soul/);
  assert.match(formatted, /Be precise/);
});

test("formatPersonaForPrompt includes anchors", () => {
  const formatted = formatPersonaForPrompt({
    soul: null,
    identity: null,
    anchors: ["Prefers dark mode", "Uses TypeScript"]
  });
  assert.match(formatted, /## Accepted Persona Anchors/);
  assert.match(formatted, /dark mode/);
  assert.match(formatted, /TypeScript/);
});

test("formatPersonaForPrompt returns empty string when all null", () => {
  const formatted = formatPersonaForPrompt({ soul: null, identity: null, anchors: [] });
  assert.equal(formatted, "");
});
