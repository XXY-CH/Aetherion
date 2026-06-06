import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export type MigrationReport = {
  id: string;
  source: "openclaw" | "hermes";
  import_mode: "dry_run";
  confidence: number;
  imported: string[];
  mapped_with_high_confidence: string[];
  mapped_with_low_confidence: string[];
  quarantined: string[];
  unsupported: string[];
  secrets: string[];
  vault_ref_placeholders: string[];
  requires_review: string[];
  review_required_reason: string;
  reversible_actions: string[];
};

const SECRET_PATTERN = /(token|secret|api[_-]?key|password|webhook)/i;

export async function dryRunImport(source: "openclaw" | "hermes", root: string): Promise<MigrationReport> {
  const files = await listFiles(root);
  const imported: string[] = [];
  const quarantined: string[] = [];
  const secrets: string[] = [];
  const vault_ref_placeholders: string[] = [];
  const requires_review: string[] = [];

  for (const file of files) {
    const lower = file.toLowerCase();
    const contents = await readFile(file, "utf8").catch(() => "");
    if (lower.includes("skill") || lower.includes("plugin") || lower.includes("hook")) {
      quarantined.push(file);
    }
    if (SECRET_PATTERN.test(file) || SECRET_PATTERN.test(contents)) {
      secrets.push(`${file}:migrated_as_vault_ref`);
      vault_ref_placeholders.push(`vault://pending/${source}/${sanitize(file)}`);
    }
    if (source === "hermes" && (lower.includes("vector") || lower.includes("memory"))) {
      imported.push("memory_candidates");
    }
    if (source === "openclaw" && (lower.includes("telegram") || lower.includes("discord"))) {
      imported.push("channels");
    }
  }

  if (quarantined.length > 0) {
    requires_review.push("quarantined_legacy_code");
  }
  if (secrets.length > 0) {
    requires_review.push("vault_ref_placeholders");
  }

  return {
    id: `migration_${source}_dry_run`,
    source,
    import_mode: "dry_run",
    confidence: files.length === 0 ? 0 : 0.72,
    imported: [...new Set(imported)],
    mapped_with_high_confidence: source === "openclaw" ? ["channel_shape"] : ["memory_export_shape"],
    mapped_with_low_confidence: ["automation_policy"],
    quarantined,
    unsupported: [],
    secrets,
    vault_ref_placeholders,
    requires_review,
    review_required_reason: "Dry-run imports evidence and drafts only; trust never inherits.",
    reversible_actions: ["discard_report", "delete_vault_ref_placeholders"]
  };
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root).catch(() => []);
  const results: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry);
    const info = await stat(path);
    if (info.isDirectory()) {
      results.push(...await listFiles(path));
    } else {
      results.push(path);
    }
  }
  return results;
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "_");
}
