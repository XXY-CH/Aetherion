#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { acceptCandidateFromRegistry, acceptMemoryCandidate, assembleContextPack, buildEpisodicTimeline, createBasicUserModel, createMemoryCandidate, createMemoryDeleteTombstone, deriveMemoryCandidatesFromEvents, isMemoryCandidate, isMemoryCard, rejectMemoryCandidate } from "../../memory-os/src/index.ts";
import { buildCausalEdges, counterfactualFromCheckpoint, isCausalEdge } from "../../causal-memory/src/index.ts";
import { approveRehearsal, createBranch, createCheckpoint, findBranch, findCheckpoint, isBranch, isCheckpoint, isRehearsal, rehearse } from "../../sandbox/src/index.ts";
import { createDraftCapsule, isCapsule, publishCapsule, requireCapsule, testCapsule } from "../../capability-os/src/index.ts";
import { dryRunImport } from "../../migration/src/index.ts";
import { findHibernation, hibernateRun, isHibernationRecord, markWaking, wakeRun } from "../../hibernation/src/index.ts";
import { acceptPersonaAnchor, createPersonaReset, findPersonaAnchor, foldMemories, forkSoul, isPersonaAnchor, proposePersonaAnchor, rejectPersonaAnchor } from "../../soul/src/index.ts";
import { consumeToolCall, createAgentContract, createDefaultBudget, findBudget, isCircuitBreaker, isResourceBudget } from "../../multiagent/src/index.ts";
import { acknowledgePoisoning, detectPoisoning, isPoisoningSignal } from "../../security/src/index.ts";
import { appendEvent, createTraceReplayRecord, createWorkspace, eventRecord, isRegistryItem, loadRunManifest, readEvents, readRegistry, reconstructTrace, runLocalKernelLoop, runSupervisorKernelLoop, upsertRegistryItem, upsertRegistryItems } from "../../harness-core/src/index.ts";

type CliOptions = {
  command: string;
  topic?: string;
  target?: string;
  workspace: string;
  input: string;
  output: string;
  approveWrite: boolean;
  summary?: string;
  from?: "openclaw" | "hermes";
  path?: string;
  dryRun: boolean;
  change?: string;
  content?: string;
  sourceEvent?: string;
  fromRun?: string;
  capsule?: string;
  supervisor?: "typescript-seed" | "stdio";
};

const repoRoot = resolve(import.meta.dirname, "../../..");
let activeOptions: CliOptions | undefined;

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  activeOptions = options;
  if (options.command === "help") {
    printHelp();
    return;
  }
  if (await runUtilityCommand(options)) {
    return;
  }
  if (options.command !== "run") {
    if (options.command === "replay" || options.command === "trace") {
      await printTrace(options);
      return;
    }
    throw new Error(`Unknown command ${options.command}. Run "npm run ether -- help".`);
  }

  const result = options.supervisor === "stdio"
    ? await runSupervisorKernelLoop({
        repoRoot,
        workspaceRoot: options.workspace,
        inputPath: options.input,
        outputPath: options.output,
        approveWrite: options.approveWrite,
        summaryText: options.summary
      })
    : await runLocalKernelLoop({
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
  const positional = collectPositionals(args.slice(1));
  const options: CliOptions = {
    command,
    topic: positional[0],
    target: positional[1],
    workspace: process.cwd(),
    input: "README.md",
    output: ".aetherion/SUMMARY.md",
    approveWrite: false,
    dryRun: false
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if ((command === "replay" || command === "trace") && index === 1 && !arg.startsWith("--")) {
      options.input = arg;
      continue;
    }
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
      case "--from":
        options.from = requireValue(arg, next) as "openclaw" | "hermes";
        index += 1;
        break;
      case "--path":
        options.path = requireValue(arg, next);
        index += 1;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--change":
        options.change = requireValue(arg, next);
        index += 1;
        break;
      case "--content":
        options.content = requireValue(arg, next);
        index += 1;
        break;
      case "--source-event":
        options.sourceEvent = requireValue(arg, next);
        index += 1;
        break;
      case "--from-run":
        options.fromRun = requireValue(arg, next);
        index += 1;
        break;
      case "--capsule":
        options.capsule = requireValue(arg, next);
        index += 1;
        break;
      case "--supervisor": {
        const supervisor = requireValue(arg, next);
        if (supervisor !== "stdio" && supervisor !== "typescript-seed") {
          throw new Error("--supervisor must be stdio or typescript-seed");
        }
        options.supervisor = supervisor;
        index += 1;
        break;
      }
      default:
        if (!arg.startsWith("--")) {
          continue;
        }
        throw new Error(`Unknown option ${arg}`);
    }
  }

  return options;
}

function collectPositionals(args: string[]): string[] {
  const positionals: string[] = [];
  const valueFlags = new Set(["--workspace", "--input", "--output", "--summary", "--from", "--path", "--change", "--content", "--source-event", "--from-run", "--capsule", "--supervisor"]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (valueFlags.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      continue;
    }
    positionals.push(arg);
  }
  return positionals;
}

async function runUtilityCommand(options: CliOptions): Promise<boolean> {
  switch (options.command) {
    case "import":
      await runImport(options);
      return true;
    case "memory":
      await runMemory(options);
      return true;
    case "context":
      await runContext(options);
      return true;
    case "checkpoint":
      await runCheckpoint(options);
      return true;
    case "branch":
      runBranch(options);
      return true;
    case "rehearse":
      runRehearsal(options);
      return true;
    case "approve-rehearsal":
      await runApproveRehearsal(options);
      return true;
    case "capsule":
      runCapsule(options);
      return true;
    case "why":
      await runWhy(options);
      return true;
    case "counterfactual":
      runCounterfactual(options);
      return true;
    case "sleep":
      runSleep(options);
      return true;
    case "wake":
      runWake(options);
      return true;
    case "anchors":
      runAnchors(options);
      return true;
    case "persona":
      runPersona(options);
      return true;
    case "soul":
      runSoul(options);
      return true;
    case "agent":
      runAgent(options);
      return true;
    case "security":
      runSecurity(options);
      return true;
    default:
      return false;
  }
}

async function runImport(options: CliOptions): Promise<void> {
  if (!options.from || !options.path || !options.dryRun) {
    throw new Error("import requires --from <openclaw|hermes> --path <dir> --dry-run");
  }
  const report = await dryRunImport(options.from, resolve(options.path));
  printJson(report);
}

async function runMemory(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  if (options.topic === "list") {
    printJson(readRegistry(workspaceRoot, "memory-cards"));
    return;
  }
  if (options.topic === "candidates") {
    if (options.fromRun) {
      const workspace = await createWorkspace(workspaceRoot, "ws_tui");
      const candidates = deriveMemoryCandidatesFromEvents(await readEvents(workspace), options.fromRun);
      printJson(candidates);
      return;
    }
    const candidate = createMemoryCandidate({
      id: "memcand_tui_demo",
      source_events: [options.sourceEvent ?? "evt_demo"],
      candidate: { type: "preference", subject: "user", content: options.content ?? "Demo source-backed memory candidate." },
      confidence: 0.75
    });
    printJson(candidate);
    return;
  }
  if (options.topic === "timeline") {
    const runId = options.target ?? options.input;
    const workspace = await createWorkspace(workspaceRoot, "ws_tui");
    printJson(buildEpisodicTimeline(await readEvents(workspace), runId));
    return;
  }
  if (options.topic === "user-model") {
    const memories = readRegistry(workspaceRoot, "memory-cards").filter(isMemoryCard);
    const userModel = createBasicUserModel(memories);
    writeDurableMemoryFile(workspaceRoot, "user-model.json", userModel);
    printJson(userModel);
    return;
  }
  if (options.topic === "accept") {
    const candidateId = options.target ?? "memcand_tui_demo";
    const candidates = readRegistry(workspaceRoot, "memory-candidates").filter(isMemoryCandidate);
    const { candidate, card } = candidates.some((entry) => entry.id === candidateId)
      ? acceptCandidateFromRegistry(candidates, candidateId)
      : (() => {
          const fallback = createMemoryCandidate({
            id: candidateId,
            source_events: [options.sourceEvent ?? "evt_demo"],
            candidate: { type: "preference", subject: "user", content: options.content ?? "Accepted demo memory." },
            confidence: 0.8
          });
          return { candidate: { ...fallback, review: { status: "accepted" as const } }, card: acceptMemoryCandidate(fallback) };
        })();
    upsertRegistryItem(workspaceRoot, "memory-candidates", candidate);
    printJson(card);
    return;
  }
  if (options.topic === "reject") {
    const candidateId = options.target ?? "memcand_tui_demo";
    const candidate = readRegistry(workspaceRoot, "memory-candidates").filter(isMemoryCandidate).find((entry) => entry.id === candidateId);
    if (!candidate) {
      throw new Error(`Memory candidate ${candidateId} not found`);
    }
    printJson(rejectMemoryCandidate(candidate));
    return;
  }
  if (options.topic === "delete") {
    const memoryId = options.target ?? "mem_tui_demo";
    const memory = readRegistry(workspaceRoot, "memory-cards").filter(isMemoryCard).find((entry) => entry.id === memoryId);
    if (!memory) {
      throw new Error(`Memory card ${memoryId} not found`);
    }
    printJson({ id: `tombstone_${memory.id}`, ...createMemoryDeleteTombstone(memory, "user_delete_request") });
    return;
  }
  throw new Error("memory supports candidates, timeline, user-model, list, accept, reject, and delete in the local TUI seed");
}

async function runContext(options: CliOptions): Promise<void> {
  if (options.topic !== "explain") {
    throw new Error("context supports explain <run_id>");
  }
  const runId = options.target ?? options.input;
  const workspace = await createWorkspace(resolve(options.workspace), "ws_tui");
  const events = await readEvents(workspace);
  const selectedEvent = events.find((event) => event.run_id === runId)?.id ?? `evt_${runId}_synthetic`;
  const registryMemories = readRegistry(resolve(options.workspace), "memory-cards").filter(isMemoryCard);
  const memories = registryMemories.length > 0
    ? registryMemories
    : deriveMemoryCandidatesFromEvents(events, runId).map((candidate) => acceptMemoryCandidate(candidate));
  const fallbackMemories = memories.length > 0 ? memories : [acceptMemoryCandidate(createMemoryCandidate({
    id: `memcand_${runId}`,
    source_events: [selectedEvent],
    candidate: { type: "project", subject: runId, content: "Run has source-backed trace evidence." },
    confidence: 0.7,
    blocked_contexts: ["external_send"]
  }))];
  printJson(assembleContextPack(runId, fallbackMemories, "planning"));
}

async function runCheckpoint(options: CliOptions): Promise<void> {
  const runId = options.topic ?? options.input;
  const workspace = await createWorkspace(resolve(options.workspace), "ws_tui");
  const events = (await readEvents(workspace)).filter((event) => event.run_id === runId);
  const event = events.at(-1);
  printJson(createCheckpoint(runId, event?.id ?? `evt_${runId}_synthetic`, event?.event_hash));
}

function runBranch(options: CliOptions): void {
  const workspaceRoot = resolve(options.workspace);
  const checkpointId = options.topic ?? "checkpoint_seed";
  const checkpoint = findCheckpoint(readRegistry(workspaceRoot, "checkpoints").filter(isCheckpoint), checkpointId)
    ?? { ...createCheckpoint("run_branch_seed", "evt_checkpoint_seed"), id: checkpointId };
  printJson(createBranch(checkpoint));
}

function runRehearsal(options: CliOptions): void {
  const workspaceRoot = resolve(options.workspace);
  const branchId = options.topic ?? "branch_seed";
  const branch = findBranch(readRegistry(workspaceRoot, "branches").filter(isBranch), branchId)
    ?? { ...createBranch(createCheckpoint("run_rehearsal_seed", "evt_rehearsal_seed")), id: branchId };
  printJson(rehearse(branch, options.content ?? "Generated preview only."));
}

async function runApproveRehearsal(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  const rehearsalId = options.topic ?? "rehearsal_seed";
  const rehearsal = readRegistry(workspaceRoot, "rehearsals").filter(isRehearsal).find((entry) => entry.id === rehearsalId);
  if (!rehearsal) {
    throw new Error(`Rehearsal ${rehearsalId} not found`);
  }
  const branch = findBranch(readRegistry(workspaceRoot, "branches").filter(isBranch), rehearsal.branch_id);
  if (!branch) {
    throw new Error(`Branch ${rehearsal.branch_id} not found`);
  }
  const checkpoint = findCheckpoint(readRegistry(workspaceRoot, "checkpoints").filter(isCheckpoint), branch.checkpoint_id);
  if (!checkpoint) {
    throw new Error(`Checkpoint ${branch.checkpoint_id} not found`);
  }

  const workspace = await createWorkspace(workspaceRoot, "ws_tui");
  const policyEventId = `evt_${sanitizePathSegment(rehearsal.id)}_policy_recheck`;
  const liveActionEventId = `evt_${sanitizePathSegment(rehearsal.id)}_live_action`;
  await appendEvent(repoRoot, workspace, eventRecord({
    id: policyEventId,
    workspace_id: workspace.id,
    run_id: checkpoint.run_id,
    event_type: "policy.decided",
    actor: { type: "system", id: "tool_policy_proxy" },
    summary: `Fresh policy evaluation approved rehearsal ${rehearsal.id}; no prior lease or authority was reused.`
  }));
  await appendEvent(repoRoot, workspace, eventRecord({
    id: liveActionEventId,
    workspace_id: workspace.id,
    run_id: checkpoint.run_id,
    event_type: "action.recorded",
    actor: { type: "system", id: "sandbox_promoter" },
    summary: `Approved rehearsal ${rehearsal.id} promoted to a new live action record after fresh policy evaluation.`
  }));

  const approved = approveRehearsal(rehearsal, branch, policyEventId, liveActionEventId);
  upsertRegistryItem(workspaceRoot, "branches", approved.branch);
  printJson(approved.approval);
}

function runCapsule(options: CliOptions): void {
  const workspaceRoot = resolve(options.workspace);
  const capsuleId = options.target ?? options.capsule ?? "cap_tui_demo";
  const capsules = readRegistry(workspaceRoot, "capsules").filter(isCapsule);
  const capsule = capsules.find((entry) => entry.id === capsuleId) ?? createDraftCapsule(capsuleId);
  if (options.topic === "list" || !options.topic) {
    printJson(capsules.length > 0 ? capsules : [capsule]);
    return;
  }
  if (options.topic === "inspect") {
    printJson(requireCapsule(capsules.length > 0 ? capsules : [capsule], capsuleId));
    return;
  }
  if (options.topic === "test") {
    printJson(testCapsule(capsule));
    return;
  }
  if (options.topic === "publish") {
    printJson(publishCapsule(capsule.replay_tests_passed ? capsule : testCapsule(capsule)));
    return;
  }
  throw new Error("capsule supports list, inspect, test, publish");
}

async function runWhy(options: CliOptions): Promise<void> {
  const runId = options.topic ?? options.input;
  const workspace = await createWorkspace(resolve(options.workspace), "ws_tui");
  const events = (await readEvents(workspace)).filter((event) => event.run_id === runId);
  const edges = buildCausalEdges(events);
  upsertRegistryItems(resolve(options.workspace), "causal-edges", edges);
  printJson({ id: `why_${runId}`, run_id: runId, edges });
}

function runCounterfactual(options: CliOptions): void {
  const checkpointId = options.topic ?? "checkpoint_tui";
  const edges = readRegistry(resolve(options.workspace), "causal-edges").filter(isCausalEdge);
  printJson(counterfactualFromCheckpoint(checkpointId, options.change ?? "No live-side-effect change supplied.", edges));
}

function runSleep(options: CliOptions): void {
  const runId = options.topic ?? options.input;
  printJson(hibernateRun(runId, `ctx_${runId}_minimal`));
}

function runWake(options: CliOptions): void {
  const workspaceRoot = resolve(options.workspace);
  const hibernationId = options.topic ?? "hibernate_run_wake_seed";
  const hibernation = findHibernation(readRegistry(workspaceRoot, "hibernations").filter(isHibernationRecord), hibernationId)
    ?? { ...hibernateRun("run_wake_seed", "ctx_wake_seed"), id: hibernationId };
  const trigger = wakeRun(hibernation, "manual");
  if (trigger.status === "queued") {
    upsertRegistryItem(workspaceRoot, "hibernations", markWaking(hibernation));
  }
  printJson(trigger);
}

function runAnchors(options: CliOptions): void {
  const workspaceRoot = resolve(options.workspace);
  if (options.topic === "list") {
    printJson(readRegistry(workspaceRoot, "persona-anchors"));
    return;
  }
  if (options.topic === "propose") {
    printJson(proposePersonaAnchor({
      id: "anchor_tui_proposed",
      content: options.content ?? "User prefers source-backed concise answers.",
      source_events: [options.sourceEvent ?? "evt_anchor_source"],
      confidence: 0.8,
      ttl: "180d",
      allowed_contexts: ["planning", "coding"],
      blocked_contexts: ["external_auto_send"]
    }));
    return;
  }
  if (options.topic === "accept" || options.topic === "reject") {
    const anchorId = options.target ?? "anchor_tui_proposed";
    const anchor = findPersonaAnchor(readRegistry(workspaceRoot, "persona-anchors").filter(isPersonaAnchor), anchorId);
    if (!anchor) {
      throw new Error(`Persona anchor ${anchorId} not found`);
    }
    printJson(options.topic === "accept" ? acceptPersonaAnchor(anchor) : rejectPersonaAnchor(anchor));
    return;
  }
  throw new Error("anchors supports list, propose, accept, and reject");
}

function runPersona(options: CliOptions): void {
  if (options.topic !== "reset") {
    throw new Error("persona supports reset <branch>");
  }
  const workspaceRoot = resolve(options.workspace);
  const anchors = readRegistry(workspaceRoot, "persona-anchors").filter(isPersonaAnchor);
  printJson(createPersonaReset(options.target ?? "default", anchors));
}

function runSoul(options: CliOptions): void {
  if (options.topic !== "fork") {
    throw new Error("soul supports fork --from <checkpoint> through positional checkpoint in this seed");
  }
  const workspaceRoot = resolve(options.workspace);
  const checkpointId = options.target ?? "checkpoint_tui";
  const checkpoint = findCheckpoint(readRegistry(workspaceRoot, "checkpoints").filter(isCheckpoint), checkpointId);
  if (!checkpoint) {
    throw new Error(`Checkpoint ${checkpointId} not found`);
  }
  printJson(forkSoul(checkpoint.id, "agent_tui_fork"));
}

function runAgent(options: CliOptions): void {
  const workspaceRoot = resolve(options.workspace);
  const budgetId = options.target ?? "budget_tui_child";
  const existingBudget = findBudget(readRegistry(workspaceRoot, "resource-budgets").filter(isResourceBudget), budgetId);
  const budget = existingBudget ?? createDefaultBudget(budgetId);
  const contract = createAgentContract("run_tui_parent", "agent_tui_child", options.content ?? "Local bounded child task.", budget, [options.capsule ?? "cap_local_docs_read"]);
  const afterOneCall = consumeToolCall(budget);
  upsertRegistryItem(workspaceRoot, "resource-budgets", isCircuitBreaker(afterOneCall) ? budget : afterOneCall);
  if (isCircuitBreaker(afterOneCall)) {
    upsertRegistryItem(workspaceRoot, "circuit-breakers", afterOneCall);
  }
  printJson({ contract, after_one_tool_call: afterOneCall });
}

function runSecurity(options: CliOptions): void {
  const workspaceRoot = resolve(options.workspace);
  if (options.topic === "scan") {
    printJson(detectPoisoning(options.sourceEvent ?? "evt_tainted", options.content ?? ""));
    return;
  }
  if (options.topic === "ack") {
    const signalId = options.target ?? "poison_evt_tainted";
    const signal = readRegistry(workspaceRoot, "poisoning-signals").filter(isPoisoningSignal).find((entry) => entry.id === signalId);
    if (!signal) {
      throw new Error(`Poisoning signal ${signalId} not found`);
    }
    printJson(acknowledgePoisoning(signal));
    return;
  }
  throw new Error("security supports scan --content <text> and ack <signal_id>");
}

function printJson(value: unknown): void {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  persistJsonArtifact(value, serialized);
  console.log(serialized.trimEnd());
}

function persistJsonArtifact(value: unknown, serialized: string): void {
  if (!activeOptions) {
    return;
  }
  const id = artifactId(value);
  const topic = activeOptions.topic ? sanitizePathSegment(activeOptions.topic) : "default";
  const dir = join(resolve(activeOptions.workspace), ".aetherion", "artifacts", sanitizePathSegment(activeOptions.command), topic);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sanitizePathSegment(id)}.json`), serialized);
  persistRegistryItems(value);
}

function persistRegistryItems(value: unknown): void {
  if (!activeOptions) {
    return;
  }
  const registryName = registryNameFor(activeOptions);
  if (!registryName) {
    return;
  }
  const items = registryItemsFromValue(value);
  if (items.length === 0) {
    return;
  }
  upsertRegistryItems(resolve(activeOptions.workspace), registryName, items);
}

function registryItemsFromValue(value: unknown): Array<Record<string, unknown> & { id: string }> {
  if (Array.isArray(value)) {
    return value.filter(isRegistryItem);
  }
  if (isRegistryItem(value)) {
    return [value];
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const nested = Object.values(value).filter(isRegistryItem);
    return nested;
  }
  return [];
}

function registryNameFor(options: CliOptions): string | null {
  switch (options.command) {
    case "import":
      return "migration-reports";
    case "memory":
      if (options.topic === "candidates") return "memory-candidates";
      if (options.topic === "accept") return "memory-cards";
      if (options.topic === "reject") return "memory-candidates";
      if (options.topic === "delete") return "memory-tombstones";
      if (options.topic === "timeline") return "episodic-timelines";
      if (options.topic === "user-model") return "user-models";
      return null;
    case "context":
      return "context-packs";
    case "checkpoint":
      return "checkpoints";
    case "branch":
      return "branches";
    case "rehearse":
      return "rehearsals";
    case "approve-rehearsal":
      return "sandbox-approvals";
    case "capsule":
      return "capsules";
    case "counterfactual":
      return "counterfactual-reports";
    case "sleep":
      return "hibernations";
    case "wake":
      return "wakeups";
    case "anchors":
      return "persona-anchors";
    case "persona":
      return "persona-resets";
    case "soul":
      return "soul-forks";
    case "agent":
      return "agent-contracts";
    case "security":
      return "poisoning-signals";
    default:
      return null;
  }
}

function artifactId(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value) && "id" in value && typeof value.id === "string") {
    return value.id;
  }
  if (Array.isArray(value)) {
    return value.length === 1 ? artifactId(value[0]) : "list";
  }
  return "result";
}

function writeDurableMemoryFile(workspaceRoot: string, fileName: string, value: unknown): void {
  const dir = join(workspaceRoot, ".aetherion", "memory");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function writeReplayArtifact(workspaceRoot: string, replayRecord: { id: string; run_id: string }): void {
  const dir = join(workspaceRoot, ".aetherion", "artifacts", "replay", sanitizePathSegment(replayRecord.run_id));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sanitizePathSegment(replayRecord.id)}.json`), `${JSON.stringify(replayRecord, null, 2)}\n`);
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 120) || "artifact";
}

async function printTrace(options: CliOptions): Promise<void> {
  const runId = options.input;
  if (!runId.startsWith("run_")) {
    throw new Error(`${options.command} requires a run id as the first argument`);
  }
  const workspace = await createWorkspace(resolve(options.workspace), "ws_tui");
  const trace = await reconstructTrace(workspace, runId);
  if (options.command === "replay") {
    const replayRecord = await createTraceReplayRecord(workspace, runId);
    writeReplayArtifact(resolve(options.workspace), replayRecord);
    upsertRegistryItem(resolve(options.workspace), "replay-records", replayRecord);
    console.log(`replay_record=${replayRecord.id}`);
  }
  console.log(`run_id=${trace.run_id}`);
  console.log(`trace_events=${trace.event_count}`);
  console.log(`event_types=${trace.event_types.join(",")}`);
  console.log(`chain_valid=${trace.chain_valid}`);
  if (trace.head_event_id) {
    console.log(`head_event_id=${trace.head_event_id}`);
  }
  if (trace.head_event_hash) {
    console.log(`head_event_hash=${trace.head_event_hash}`);
  }
  console.log(`live_side_effects_replayed=${trace.live_side_effects_replayed}`);
  if (options.command === "trace") {
    try {
      const manifest = await loadRunManifest(workspace, runId);
      console.log(`manifest_status=${manifest.status}`);
      console.log(`manifest_events=${manifest.event_ids.length}`);
    } catch {
      console.log("manifest_status=missing");
    }
  }
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function printRunResult(result: Awaited<ReturnType<typeof runLocalKernelLoop>> | Awaited<ReturnType<typeof runSupervisorKernelLoop>>): void {
  console.log(`run_id=${result.runId}`);
  console.log(`workspace=${result.workspace.root}`);
  if ("supervisor" in result) {
    console.log(`supervisor=${result.supervisor}`);
  }
  console.log(`workspace_registry=${result.workspaceRegistry.id}`);
  console.log(`run_manifest=${result.runManifest.id}`);
  console.log(`read_policy=${result.readDecision.decision}:${result.readDecision.risk_level}`);
  console.log(`write_policy_initial=${result.writePreDecision.decision}:${result.writePreDecision.risk_level}`);
  console.log(`approval_card=${result.approvalCard.id}:${result.approvalCard.risk_level}`);
  if (result.writeDecision) {
    console.log(`write_policy_final=${result.writeDecision.decision}:${result.writeDecision.risk_level}`);
  }
  if (result.verification) {
    console.log(`verification=${result.verification.status}`);
  }
  console.log(`trace_events=${result.trace.event_count}`);
  console.log(`chain_valid=${result.trace.chain_valid}`);
  if (result.trace.head_event_id) {
    console.log(`head_event_id=${result.trace.head_event_id}`);
  }
  console.log(`live_side_effects_replayed=${result.trace.live_side_effects_replayed}`);
  console.log(`ledger=${result.workspace.ledgerPath}`);
}

function printHelp(): void {
  console.log(`Ether CLI

Usage:
  npm run ether -- run --workspace <path> --input README.md --output .aetherion/SUMMARY.md --approve-write
  npm run ether -- run --supervisor stdio --workspace <path> --input README.md --output .aetherion/SUMMARY.md --approve-write
  npm run ether -- replay <run_id> --workspace <path>
  npm run ether -- trace <run_id> --workspace <path>
  npm run ether -- import --from openclaw --path <dir> --dry-run
  npm run ether -- memory candidates --source-event <event> --content <text>
  npm run ether -- memory candidates --from-run <run_id> --workspace <path>
  npm run ether -- memory timeline <run_id> --workspace <path>
  npm run ether -- memory user-model --workspace <path>
  npm run ether -- context explain <run_id> --workspace <path>
  npm run ether -- checkpoint <run_id> --workspace <path>
  npm run ether -- branch <checkpoint_id>
  npm run ether -- rehearse <branch_id> --content <preview>
  npm run ether -- approve-rehearsal <rehearsal_id> --workspace <path>
  npm run ether -- capsule list
  npm run ether -- why <run_id> --workspace <path>
  npm run ether -- counterfactual <checkpoint_id> --change <text>
  npm run ether -- sleep <run_id>
  npm run ether -- wake <hibernation_id>
  npm run ether -- anchors propose --source-event <event> --content <text>
  npm run ether -- persona reset <branch>
  npm run ether -- soul fork <checkpoint_id>
  npm run ether -- agent contract --capsule <capsule_id>
  npm run ether -- security scan --content <text>

Commands:
  run/replay/trace       Phase 1 local kernel loop and replay
  import                 Phase 4 dry-run migration report
  memory/context         Phase 3 Memory OS seed surfaces
  checkpoint/branch/rehearse Phase 5 sandbox and time-travel seed surfaces
  capsule                Phase 6 Capability Capsule seed surfaces
  why/counterfactual     Phase 7 causal memory report surfaces
  sleep/wake             Phase 8 hibernation seed surfaces
  anchors/persona/soul   Phase 9 persona and soul fork seed surfaces
  agent                  Phase 10 bounded child-agent contract surface
  security               Phase 11 poisoning detection surface
  help                   Show this help

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
