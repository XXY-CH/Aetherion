import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { dryRunImport } from "../src/index.ts";

test("migration dry-run quarantines skills and redacts secrets into vault refs", async () => {
  const root = await mkdtemp(join(tmpdir(), "aetherion-migration-"));
  await mkdir(join(root, "skills"));
  await writeFile(join(root, "telegram.json"), JSON.stringify({ botToken: "123:SECRET" }));
  await writeFile(join(root, "skills", "skill.yaml"), "run: shell\n");

  const report = await dryRunImport("openclaw", root);
  assert.equal(report.import_mode, "dry_run");
  assert.equal(report.quarantined.length, 1);
  assert.equal(report.secrets.length, 1);
  assert.match(report.vault_ref_placeholders[0], /^vault:\/\/pending\/openclaw\//);
  assert.ok(!JSON.stringify(report).includes("123:SECRET"));
});
