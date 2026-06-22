// Context reference expansion — expands @file:, @diff, @url: references in
// user messages before they reach the agent loop.
//
// Inspired by Hermes's @-context references (@diff, @staged, @file:, @url:).
// The expansion is best-effort: missing files/failed fetches are replaced
// with error notes rather than failing the message.

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import { execSync } from "node:child_process";

export type ExpandResult = {
  text: string;
  expansions: { ref: string; ok: boolean; error?: string }[];
};

// Expand all @-references in a user message.
// Supported patterns:
//   @file:<path>     — inline file content (truncated to 5000 chars)
//   @diff            — inline git diff --stat output
//   @staged          — inline git diff --staged output
//   @url:<url>       — inline URL fetch (truncated to 3000 chars)
export function expandContextReferences(input: string, workspaceRoot: string): ExpandResult {
  const expansions: { ref: string; ok: boolean; error?: string }[] = [];
  let result = input;

  // @file:<path>
  result = result.replace(/@file:(\S+)/g, (match, filePath: string) => {
    try {
      const fullPath = isAbsolute(filePath) ? filePath : join(workspaceRoot, filePath);
      if (!existsSync(fullPath)) {
        expansions.push({ ref: match, ok: false, error: "file not found" });
        return `[${match}: file not found]`;
      }
      const content = readFileSync(fullPath, "utf8");
      const truncated = content.length > 5000 ? content.slice(0, 5000) + "\n... (truncated)" : content;
      expansions.push({ ref: match, ok: true });
      return `\n--- @file:${filePath} ---\n${truncated}\n--- end @file:${filePath} ---\n`;
    } catch (err) {
      expansions.push({ ref: match, ok: false, error: String(err) });
      return `[${match}: error: ${err}]`;
    }
  });

  // @diff
  result = result.replace(/@diff\b/g, () => {
    try {
      const diff = execSync("git diff --stat", { cwd: workspaceRoot, encoding: "utf8", timeout: 3000 }).trim();
      expansions.push({ ref: "@diff", ok: true });
      return diff ? `\n--- @diff ---\n${diff}\n--- end @diff ---\n` : "[@diff: no changes]";
    } catch (err) {
      expansions.push({ ref: "@diff", ok: false, error: String(err) });
      return "[@diff: not a git repo or git unavailable]";
    }
  });

  // @staged
  result = result.replace(/@staged\b/g, () => {
    try {
      const diff = execSync("git diff --staged --stat", { cwd: workspaceRoot, encoding: "utf8", timeout: 3000 }).trim();
      expansions.push({ ref: "@staged", ok: true });
      return diff ? `\n--- @staged ---\n${diff}\n--- end @staged ---\n` : "[@staged: no staged changes]";
    } catch (err) {
      expansions.push({ ref: "@staged", ok: false, error: String(err) });
      return "[@staged: not a git repo or git unavailable]";
    }
  });

  // @url:<url>
  result = result.replace(/@url:(\S+)/g, (match, url: string) => {
    try {
      const content = execSync(
        `node -e "fetch('${url.replace(/'/g, "")}').then(r=>r.text()).then(t=>process.stdout.write(t.slice(0,3000))).catch(e=>process.stdout.write('fetch error: '+e.message))"`,
        { encoding: "utf8", timeout: 10000 }
      );
      expansions.push({ ref: match, ok: true });
      return `\n--- @url:${url} ---\n${content}\n--- end @url:${url} ---\n`;
    } catch (err) {
      expansions.push({ ref: match, ok: false, error: String(err) });
      return `[${match}: fetch failed]`;
    }
  });

  return { text: result, expansions };
}
