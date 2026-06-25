import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { alwaysGrantKey, loadAlwaysGrants, recordAlwaysGrant } from "../src/index.ts";

test("loadAlwaysGrants returns empty for a workspace with no grants file", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-grants-empty-"));
  assert.deepEqual(await loadAlwaysGrants(root), []);
});

test("recordAlwaysGrant persists a durable, reloadable tool+verb grant", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-grants-record-"));
  const after = await recordAlwaysGrant(root, "shell_exec", "exec", "2026-01-01T00:00:00.000Z");
  assert.equal(after.length, 1);
  assert.equal(after[0].key, alwaysGrantKey("shell_exec", "exec"));
  assert.equal(after[0].tool_name, "shell_exec");
  assert.equal(after[0].verb, "exec");

  const reloaded = await loadAlwaysGrants(root);
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].key, "shell_exec:exec");

  const persisted = JSON.parse(
    await readFile(join(root, ".aetherion", "approvals", "always-grants.json"), "utf8")
  ) as { grants: unknown[] };
  assert.equal(persisted.grants.length, 1);
});

test("recordAlwaysGrant is idempotent and does not refresh an existing grant", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-grants-idem-"));
  await recordAlwaysGrant(root, "local_file_write", "write", "2026-01-01T00:00:00.000Z");
  const after = await recordAlwaysGrant(root, "local_file_write", "write", "2026-02-02T00:00:00.000Z");
  assert.equal(after.length, 1);
  assert.equal(after[0].granted_at, "2026-01-01T00:00:00.000Z");
});

test("recordAlwaysGrant accumulates distinct tool+verb keys", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-grants-multi-"));
  await recordAlwaysGrant(root, "shell_exec", "exec");
  await recordAlwaysGrant(root, "local_file_write", "write");
  const grants = await loadAlwaysGrants(root);
  const keys = grants.map((g) => g.key).sort();
  assert.deepEqual(keys, ["local_file_write:write", "shell_exec:exec"]);
});

test("loadAlwaysGrants tolerates a malformed grants file", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-grants-bad-"));
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(join(root, ".aetherion", "approvals"), { recursive: true });
  await writeFile(join(root, ".aetherion", "approvals", "always-grants.json"), "{not json");
  assert.deepEqual(await loadAlwaysGrants(root), []);
});
