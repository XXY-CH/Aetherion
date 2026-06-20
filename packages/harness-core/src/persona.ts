// Persona injection — loads SOUL.md and IDENTITY.md from the workspace
// and accepted PersonaAnchor entries, injecting them into the system prompt.
//
// OpenClaw has SOUL.md (persona/tone/boundaries), IDENTITY.md (name/vibe),
// USER.md (user profile). Aetherion's ponytail minimum: SOUL.md + IDENTITY.md
// from workspace files, plus accepted PersonaAnchors from the registry.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type PersonaContext = {
  soul: string | null;
  identity: string | null;
  anchors: string[];
};

// Load persona files from the workspace root.
export function loadPersonaFiles(workspaceRoot: string): { soul: string | null; identity: string | null } {
  let soul: string | null = null;
  let identity: string | null = null;
  try {
    const soulPath = join(workspaceRoot, "SOUL.md");
    if (existsSync(soulPath)) {
      soul = readFileSync(soulPath, "utf8").trim();
    }
  } catch { /* ignore */ }
  try {
    const idPath = join(workspaceRoot, "IDENTITY.md");
    if (existsSync(idPath)) {
      identity = readFileSync(idPath, "utf8").trim();
    }
  } catch { /* ignore */ }
  return { soul, identity };
}

// Format persona context for injection into the system prompt.
export function formatPersonaForPrompt(persona: PersonaContext): string {
  const sections: string[] = [];
  if (persona.identity) {
    sections.push(`## Identity\n${persona.identity}`);
  }
  if (persona.soul) {
    sections.push(`## Soul (Persona & Tone)\n${persona.soul}`);
  }
  if (persona.anchors.length > 0) {
    sections.push(`## Accepted Persona Anchors\n${persona.anchors.map((a) => `- ${a}`).join("\n")}`);
  }
  return sections.join("\n\n");
}
