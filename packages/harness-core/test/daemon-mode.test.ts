import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const cliPath = resolve(import.meta.dirname, "../../tui/src/cli.ts");
const repoRoot = resolve(import.meta.dirname, "../../..");

async function makeWorkspace(): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "aetherion-daemon-"));
  await mkdir(join(ws, ".aetherion"), { recursive: true });
  await writeFile(join(ws, "README.md"), "# Daemon test\n", "utf8");
  return ws;
}

function runDaemon(workspace: string, stdin: string, timeoutMs = 15000): string {
  try {
    const stdout = execFileSync("node", [cliPath, "daemon", "--workspace", workspace], {
      input: stdin,
      encoding: "utf8",
      timeout: timeoutMs,
      cwd: repoRoot,
      env: { ...process.env, AETHERION_MODEL_PROVIDER: "stub", AETHERION_MODEL_REF: "stub-deterministic-v1" }
    });
    return stdout;
  } catch (err) {
    const e = err as Error & { stdout?: string; stderr?: string };
    // Daemon may exit with non-zero on stdin close — that's OK, capture stdout.
    return e.stdout ?? "";
  }
}

test("daemon processes a single stdin line and produces a loop event", async () => {
  const ws = await makeWorkspace();
  const output = runDaemon(ws, "hello there\n/exit\n");
  // Should contain at least one JSON-lines event.
  const lines = output.split("\n").filter((l) => l.startsWith("{"));
  assert.ok(lines.length > 0, "daemon should emit JSON-lines events");
  const events = lines.map((l) => JSON.parse(l));
  const types = events.map((e) => e.type);
  assert.ok(types.includes("loop_started"), "should emit loop_started");
  assert.ok(types.includes("loop_complete") || types.includes("turn_started"), "should progress the loop");
});

test("daemon prints ready banner on startup", async () => {
  const ws = await makeWorkspace();
  const output = runDaemon(ws, "/exit\n");
  assert.match(output, /\[aetherion daemon\] ready/);
});

test("daemon handles /exit command cleanly", async () => {
  const ws = await makeWorkspace();
  const output = runDaemon(ws, "/exit\n");
  assert.match(output, /shutting down/);
});

test("daemon stays alive across multiple inputs", async () => {
  const ws = await makeWorkspace();
  const output = runDaemon(ws, "first message\nsecond message\n/exit\n");
  const lines = output.split("\n").filter((l) => l.startsWith("{"));
  const events = lines.map((l) => {
    try { return JSON.parse(l); } catch { return { type: "unknown" }; }
  });
  // Should have at least two loop_started events (one per input).
  const loopStarts = events.filter((e) => e.type === "loop_started");
  assert.ok(loopStarts.length >= 2, `expected >=2 loop_started events, got ${loopStarts.length}`);
});

test("daemon resumes session when prior ledger events exist", async () => {
  const ws = await makeWorkspace();
  // First run: produce some ledger events.
  runDaemon(ws, "hello from first session\n/exit\n");
  // Second run: should detect prior events and show "session resumed".
  const output = runDaemon(ws, "/exit\n");
  assert.match(output, /session resumed/);
});

test("daemon starts fresh when no prior ledger events", async () => {
  const ws = await makeWorkspace();
  const output = runDaemon(ws, "/exit\n");
  assert.doesNotMatch(output, /session resumed/);
});
