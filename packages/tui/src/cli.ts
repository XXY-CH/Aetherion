#!/usr/bin/env node
import { resolve } from "node:path";
import { runLocalKernelLoop } from "../../harness-core/src/index.ts";

type CliOptions = {
  command: string;
  workspace: string;
  input: string;
  output: string;
  approveWrite: boolean;
  summary?: string;
};

const repoRoot = resolve(import.meta.dirname, "../../..");

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "help") {
    printHelp();
    return;
  }
  if (options.command !== "run") {
    throw new Error(`Unknown command ${options.command}. Run "npm run tui -- help".`);
  }

  const result = await runLocalKernelLoop({
    repoRoot,
    workspaceRoot: options.workspace,
    inputPath: options.input,
    outputPath: options.output,
    approveWrite: options.approveWrite,
    summaryText: options.summary
  });

  printRunResult(result);
}

function parseArgs(args: string[]): CliOptions {
  const command = args[0] ?? "help";
  const options: CliOptions = {
    command,
    workspace: process.cwd(),
    input: "README.md",
    output: ".aetherion/SUMMARY.md",
    approveWrite: false
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    switch (arg) {
      case "--workspace":
        options.workspace = requireValue(arg, next);
        index += 1;
        break;
      case "--input":
        options.input = requireValue(arg, next);
        index += 1;
        break;
      case "--output":
        options.output = requireValue(arg, next);
        index += 1;
        break;
      case "--summary":
        options.summary = requireValue(arg, next);
        index += 1;
        break;
      case "--approve-write":
        options.approveWrite = true;
        break;
      default:
        throw new Error(`Unknown option ${arg}`);
    }
  }

  return options;
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function printRunResult(result: Awaited<ReturnType<typeof runLocalKernelLoop>>): void {
  console.log(`run_id=${result.runId}`);
  console.log(`workspace=${result.workspace.root}`);
  console.log(`read_policy=${result.readDecision.decision}:${result.readDecision.risk_level}`);
  console.log(`write_policy_initial=${result.writePreDecision.decision}:${result.writePreDecision.risk_level}`);
  if (result.writeDecision) {
    console.log(`write_policy_final=${result.writeDecision.decision}:${result.writeDecision.risk_level}`);
  }
  if (result.verification) {
    console.log(`verification=${result.verification.status}`);
  }
  console.log(`trace_events=${result.trace.event_count}`);
  console.log(`live_side_effects_replayed=${result.trace.live_side_effects_replayed}`);
  console.log(`ledger=${result.workspace.ledgerPath}`);
}

function printHelp(): void {
  console.log(`Aetherion TUI

Usage:
  npm run tui -- run --workspace <path> --input README.md --output .aetherion/SUMMARY.md --approve-write

Commands:
  run   Execute the V1 local kernel loop
  help  Show this help

Options:
  --workspace <path>   Workspace root. Defaults to cwd.
  --input <path>       Workspace-relative file to read. Defaults to README.md.
  --output <path>      Workspace-relative file to write. Defaults to .aetherion/SUMMARY.md.
  --summary <text>     Explicit summary text to write.
  --approve-write      Required to execute the write stage.
`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
