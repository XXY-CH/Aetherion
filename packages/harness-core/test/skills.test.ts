import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { scanSkills, formatSkillsForPrompt } from "../src/skills.ts";

async function makeWorkspaceWithSkills(): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-skills-"));
  const skillsDir = join(ws, "skills");
  await mkdir(join(skillsDir, "github"), { recursive: true });
  await mkdir(join(skillsDir, "weather"), { recursive: true });
  await mkdir(join(skillsDir, "no-skill-md"), { recursive: true });
  await writeFile(join(skillsDir, "github", "SKILL.md"), "---\nname: github\ndescription: Manage GitHub issues and PRs\n---\n# GitHub Skill\n\nThis skill helps with GitHub operations.\n");
  await writeFile(join(skillsDir, "weather", "SKILL.md"), "---\nname: weather\ndescription: Check the weather for a location\n---\n# Weather\n\nGet weather info.\n");
  // no-skill-md has no SKILL.md — should be skipped.
  await writeFile(join(skillsDir, "no-skill-md", "README.md"), "not a skill");
  return ws;
}

test("scanSkills finds SKILL.md files in skills/ subdirectories", async () => {
  const ws = await makeWorkspaceWithSkills();
  const skills = scanSkills(ws);
  assert.equal(skills.length, 2);
  const names = skills.map((s) => s.name).sort();
  assert.deepEqual(names, ["github", "weather"]);
});

test("scanSkills extracts name and description from frontmatter", async () => {
  const ws = await makeWorkspaceWithSkills();
  const skills = scanSkills(ws);
  const github = skills.find((s) => s.name === "github");
  assert.ok(github);
  assert.match(github!.description, /GitHub issues and PRs/);
  assert.ok(github!.path.endsWith("SKILL.md"));
});

test("scanSkills returns empty when no skills/ directory", async () => {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-no-skills-"));
  const skills = scanSkills(ws);
  assert.equal(skills.length, 0);
});

test("scanSkills handles SKILL.md without frontmatter (falls back to H1)", async () => {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-plain-skill-"));
  const skillsDir = join(ws, "skills", "plain");
  await mkdir(skillsDir, { recursive: true });
  await writeFile(join(skillsDir, "SKILL.md"), "# My Plain Skill\n\nDoes something useful.\n");
  const skills = scanSkills(ws);
  assert.equal(skills.length, 1);
  assert.equal(skills[0].name, "My Plain Skill");
});

test("formatSkillsForPrompt produces a formatted list", async () => {
  const ws = await makeWorkspaceWithSkills();
  const skills = scanSkills(ws);
  const formatted = formatSkillsForPrompt(skills);
  assert.match(formatted, /## Available Skills/);
  assert.match(formatted, /github/);
  assert.match(formatted, /weather/);
  assert.match(formatted, /read.*SKILL\.md.*for details/);
});

test("formatSkillsForPrompt returns empty string for no skills", () => {
  const formatted = formatSkillsForPrompt([]);
  assert.equal(formatted, "");
});
