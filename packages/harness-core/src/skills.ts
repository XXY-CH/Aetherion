// Skill loader — scans the workspace for SKILL.md files and extracts
// name/description for lazy injection into the system prompt.
//
// OpenClaw pattern (baseline §8): inject only name + description + file
// path. The model reads the full SKILL.md on demand via local_file_read.
// This keeps the system prompt small.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

export type SkillSummary = {
  name: string;
  description: string;
  path: string;
};

// Parse YAML-like frontmatter from a SKILL.md file.
// Only extracts `name:` and `description:` — minimal parser, no full YAML.
function parseFrontmatter(content: string): { name?: string; description?: string } {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    // No frontmatter — try first H1 as name, first paragraph as description.
    const h1 = content.match(/^#\s+(.+)/m);
    const para = content.match(/^(?!#)(.+)/m);
    return {
      name: h1?.[1]?.trim(),
      description: para?.[1]?.trim()?.slice(0, 120)
    };
  }
  const fm = fmMatch[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  return {
    name: nameMatch?.[1]?.trim(),
    description: descMatch?.[1]?.trim()
  };
}

// Scan a directory for SKILL.md files (recursive, one level deep into subdirs).
export function scanSkills(workspaceRoot: string): SkillSummary[] {
  const skillsDir = join(workspaceRoot, "skills");
  if (!existsSync(skillsDir) || !statSync(skillsDir).isDirectory()) {
    return [];
  }
  const results: SkillSummary[] = [];
  let entries: string[];
  try {
    entries = readdirSync(skillsDir);
  } catch {
    return [];
  }
  for (const entry of entries) {
    const entryPath = join(skillsDir, entry);
    try {
      if (!statSync(entryPath).isDirectory()) continue;
    } catch {
      continue;
    }
    // Look for SKILL.md in this subdirectory.
    const skillFile = join(entryPath, "SKILL.md");
    if (!existsSync(skillFile)) continue;
    try {
      const content = readFileSync(skillFile, "utf8");
      const parsed = parseFrontmatter(content);
      if (parsed.name) {
        results.push({
          name: parsed.name,
          description: parsed.description ?? "",
          path: skillFile
        });
      }
    } catch {
      // Skip unreadable files.
    }
  }
  return results;
}

// Format skills for injection into the system prompt.
export function formatSkillsForPrompt(skills: SkillSummary[]): string {
  if (skills.length === 0) return "";
  const lines = skills.map((s) => `- ${s.name}: ${s.description} (read ${s.path} for details)`);
  return `## Available Skills\n${lines.join("\n")}`;
}
