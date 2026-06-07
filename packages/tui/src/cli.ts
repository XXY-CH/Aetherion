#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { acceptCandidateFromRegistry, acceptMemoryCandidate, assembleContextPack, buildEpisodicTimeline, createBasicUserModel, createMemoryCandidate, createMemoryDeleteTombstone, deriveMemoryCandidatesFromEvents, isMemoryCandidate, isMemoryCard, rejectMemoryCandidate } from "../../memory-os/src/index.ts";
import { buildCausalEdges, counterfactualFromCheckpoint, isCausalEdge } from "../../causal-memory/src/index.ts";
import { approveRehearsal, createBranch, createCheckpoint, findBranch, findCheckpoint, isBranch, isCheckpoint, isRehearsal, rehearseFileWrite } from "../../sandbox/src/index.ts";
import { attachCapsuleTestEvidence, createDraftCapsule, isCapsule, isPublishedCapsuleWithEvidence, publishCapsule, requireCapsule, rollbackCapsule, runDocumentSandboxTrial, type Capsule, type CapsuleDraftInput } from "../../capability-os/src/index.ts";
import { dryRunImport } from "../../migration/src/index.ts";
import { findHibernation, hibernateRun, isHibernationRecord, markWaking, wakeRun } from "../../hibernation/src/index.ts";
import { acceptPersonaAnchor, createPersonaReset, findPersonaAnchor, foldMemories, forkSoul, isPersonaAnchor, proposePersonaAnchor, rejectPersonaAnchor } from "../../soul/src/index.ts";
import { createAgentContract, findBudget, isResourceBudget } from "../../multiagent/src/index.ts";
import { acknowledgePoisoning, detectPoisoning, isPoisoningSignal } from "../../security/src/index.ts";
import { appendEvent, callSupervisorRpc, createTraceReplayRecord, eventRecord, isRegistryItem, loadRunManifest, loadWorkspaceFromRegistry, readEvents, readRegistry, reconstructTrace, removeRegistryItem, rpcResult, runLocalKernelLoop, runSupervisorKernelLoop, upsertRegistryItem, upsertRegistryItems, validateAgainstSchema } from "../../harness-core/src/index.ts";

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
  confidence?: number;
  fromRun?: string;
  capsule?: string;
  replayRuns: string[];
  approvePermissions: boolean;
  version?: string;
  parentRun?: string;
  childAgent?: string;
  budget?: string;
  agentId?: string;
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

  if (options.supervisor === "typescript-seed" && process.env.AETHERION_ALLOW_TYPESCRIPT_SEED !== "1") {
    throw new Error("typescript-seed is test-only; set AETHERION_ALLOW_TYPESCRIPT_SEED=1 explicitly");
  }
  const result = options.supervisor === "typescript-seed"
    ? await runLocalKernelLoop({
        repoRoot,
        workspaceRoot: options.workspace,
        inputPath: options.input,
        outputPath: options.output,
        approveWrite: options.approveWrite,
        summaryText: options.summary
      })
    : await runSupervisorKernelLoop({
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
    dryRun: false,
    replayRuns: [],
    approvePermissions: false
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
      case "--confidence": {
        const confidence = Number(requireValue(arg, next));
        if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
          throw new Error("--confidence must be a number between 0 and 1");
        }
        options.confidence = confidence;
        index += 1;
        break;
      }
      case "--from-run":
        options.fromRun = requireValue(arg, next);
        index += 1;
        break;
      case "--capsule":
        options.capsule = requireValue(arg, next);
        index += 1;
        break;
      case "--replay-run":
        options.replayRuns.push(requireValue(arg, next));
        index += 1;
        break;
      case "--approve-permissions":
        options.approvePermissions = true;
        break;
      case "--version":
        options.version = requireValue(arg, next);
        index += 1;
        break;
      case "--parent-run":
        options.parentRun = requireValue(arg, next);
        index += 1;
        break;
      case "--child-agent":
        options.childAgent = requireValue(arg, next);
        index += 1;
        break;
      case "--budget":
        options.budget = requireValue(arg, next);
        index += 1;
        break;
      case "--agent-id":
        options.agentId = requireValue(arg, next);
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
  const valueFlags = new Set(["--workspace", "--input", "--output", "--summary", "--from", "--path", "--change", "--content", "--source-event", "--confidence", "--from-run", "--capsule", "--replay-run", "--version", "--parent-run", "--child-agent", "--budget", "--agent-id", "--supervisor"]);
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
      await runRehearsal(options);
      return true;
    case "approve-rehearsal":
      await runApproveRehearsal(options);
      return true;
    case "capsule":
      await runCapsule(options);
      return true;
    case "why":
      await runWhy(options);
      return true;
    case "counterfactual":
      runCounterfactual(options);
      return true;
    case "sleep":
      await runSleep(options);
      return true;
    case "wake":
      runWake(options);
      return true;
    case "anchors":
      await runAnchors(options);
      return true;
    case "persona":
      runPersona(options);
      return true;
    case "soul":
      runSoul(options);
      return true;
    case "agent":
      await runAgent(options);
      return true;
    case "security":
      await runSecurity(options);
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
      const workspace = await openWorkspace(workspaceRoot);
      const candidates = deriveMemoryCandidatesFromEvents(await readEvents(workspace), options.fromRun);
      if (candidates.length === 0) {
        throw new Error(`No memory candidates can be derived from run ${options.fromRun}`);
      }
      printJson(candidates);
      return;
    }
    if (!options.sourceEvent || options.content === undefined || options.confidence === undefined) {
      throw new Error("memory candidates requires --from-run <run_id> or --source-event <event_id> --content <text> --confidence <0..1>");
    }
    await requireSourceEvent(workspaceRoot, options.sourceEvent);
    const candidate = createMemoryCandidate({
      id: `memcand_${sanitizePathSegment(options.sourceEvent)}`,
      source_events: [options.sourceEvent],
      candidate: { type: "preference", subject: "user", content: options.content },
      confidence: options.confidence
    });
    printJson(candidate);
    return;
  }
  if (options.topic === "timeline") {
    const runId = options.target ?? options.input;
    const workspace = await openWorkspace(workspaceRoot);
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
    const candidateId = requirePositional(options.target, "memory accept requires a candidate id");
    const candidates = readRegistry(workspaceRoot, "memory-candidates").filter(isMemoryCandidate);
    const { candidate, card } = acceptCandidateFromRegistry(candidates, candidateId);
    upsertRegistryItem(workspaceRoot, "memory-candidates", candidate);
    printJson(card);
    return;
  }
  if (options.topic === "reject") {
    const candidateId = requirePositional(options.target, "memory reject requires a candidate id");
    const candidate = readRegistry(workspaceRoot, "memory-candidates").filter(isMemoryCandidate).find((entry) => entry.id === candidateId);
    if (!candidate) {
      throw new Error(`Memory candidate ${candidateId} not found`);
    }
    printJson(rejectMemoryCandidate(candidate));
    return;
  }
  if (options.topic === "delete") {
    const memoryId = requirePositional(options.target, "memory delete requires a memory id");
    const memory = readRegistry(workspaceRoot, "memory-cards").filter(isMemoryCard).find((entry) => entry.id === memoryId);
    if (!memory) {
      throw new Error(`Memory card ${memoryId} not found`);
    }
    printJson({ id: `tombstone_${memory.id}`, ...createMemoryDeleteTombstone(memory, "user_delete_request") });
    return;
  }
  throw new Error("memory supports candidates, timeline, user-model, list, accept, reject, and delete");
}

async function runContext(options: CliOptions): Promise<void> {
  if (options.topic !== "explain") {
    throw new Error("context supports explain <run_id>");
  }
  const runId = options.target ?? options.input;
  const workspaceRoot = resolve(options.workspace);
  const workspace = await openWorkspace(workspaceRoot);
  const events = await readEvents(workspace);
  if (!events.some((event) => event.run_id === runId)) {
    throw new Error(`Run ${runId} has no ledger events`);
  }
  const memories = readRegistry(workspaceRoot, "memory-cards").filter(isMemoryCard);
  printJson(assembleContextPack(runId, memories, "planning"));
}

async function runCheckpoint(options: CliOptions): Promise<void> {
  const runId = options.topic ?? options.input;
  const workspace = await openWorkspace(resolve(options.workspace));
  const events = (await readEvents(workspace)).filter((event) => event.run_id === runId);
  const event = events.at(-1);
  if (!event) {
    throw new Error(`Cannot checkpoint run ${runId}: no ledger events found`);
  }
  printJson(createCheckpoint(runId, event.id, event.event_hash));
}

function runBranch(options: CliOptions): void {
  const workspaceRoot = resolve(options.workspace);
  const checkpointId = requirePositional(options.topic, "branch requires a checkpoint id");
  const checkpoint = findCheckpoint(readRegistry(workspaceRoot, "checkpoints").filter(isCheckpoint), checkpointId);
  if (!checkpoint) {
    throw new Error(`Checkpoint ${checkpointId} not found`);
  }
  printJson(createBranch(checkpoint));
}

async function runRehearsal(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  const branchId = requirePositional(options.topic, "rehearse requires a branch id");
  const branch = findBranch(readRegistry(workspaceRoot, "branches").filter(isBranch), branchId);
  if (!branch) {
    throw new Error(`Branch ${branchId} not found`);
  }
  if (!options.path || options.content === undefined) {
    throw new Error("rehearse requires --path <workspace-file> and --content <proposed-contents>");
  }
  const rehearsal = await rehearseFileWrite(workspaceRoot, branch, options.path, options.content);
  printJson(rehearsal);
}

async function runApproveRehearsal(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  const rehearsalId = requirePositional(options.topic, "approve-rehearsal requires a rehearsal id");
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
  if (rehearsal.operation !== "file.write") {
    throw new Error(`Rehearsal ${rehearsal.id} has no implemented live operation`);
  }

  const workspace = await openWorkspace(workspaceRoot);
  const policyEventId = `evt_${sanitizePathSegment(rehearsal.id)}_policy_recheck`;
  const liveActionEventId = `evt_${sanitizePathSegment(rehearsal.id)}_live_action`;
  let newLeaseId: string | undefined;
  let verificationStatus: "passed" | "failed" | undefined;
  let realSideEffectExecuted = false;

  if (rehearsal.operation === "file.write") {
    if (!rehearsal.target_path || !rehearsal.sandbox_path) {
      throw new Error(`File rehearsal ${rehearsal.id} is missing target or sandbox path`);
    }
    const targetPath = resolve(workspaceRoot, rehearsal.target_path);
    const proposedContents = readFileSync(resolve(workspaceRoot, rehearsal.sandbox_path), "utf8");
    const policyResult = rpcResult(await callSupervisorRpc(repoRoot, {
      id: `rpc_${rehearsal.id}_fresh_policy`,
      method: "tool.evaluate",
      workspace_root: workspaceRoot,
      workspace_id: workspace.id,
      run_id: checkpoint.run_id,
      path: targetPath,
      verb: "write",
      approved: true
    }));
    if (policyResult.decision !== "allow" || typeof policyResult.lease_id !== "string" || !policyResult.lease_id) {
      throw new Error(`Fresh supervisor policy did not allow rehearsal ${rehearsal.id}`);
    }
    const preflightLeaseId = policyResult.lease_id;
    await appendEvent(repoRoot, workspace, eventRecord({
      id: policyEventId,
      workspace_id: workspace.id,
      run_id: checkpoint.run_id,
      event_type: "policy.decided",
      actor: { type: "system", id: "tool_policy_proxy" },
      summary: `Rust supervisor preflight allowed rehearsal ${rehearsal.id} with fresh lease ${preflightLeaseId}; no prior authority was reused.`
    }));
    const writeResult = rpcResult(await callSupervisorRpc(repoRoot, {
      id: `rpc_${rehearsal.id}_live_write`,
      method: "file.write",
      workspace_root: workspaceRoot,
      workspace_id: workspace.id,
      run_id: checkpoint.run_id,
      path: targetPath,
      approved: true,
      contents: proposedContents
    }));
    if (writeResult.written !== true || writeResult.decision !== "allow" || typeof writeResult.lease_id !== "string" || !writeResult.lease_id) {
      throw new Error(`Rust supervisor did not return a lease-backed write result for ${rehearsal.id}`);
    }
    newLeaseId = writeResult.lease_id;
    realSideEffectExecuted = writeResult.written === true;
    verificationStatus = readFileSync(targetPath, "utf8") === proposedContents ? "passed" : "failed";
    if (!realSideEffectExecuted || verificationStatus !== "passed") {
      throw new Error(`Approved rehearsal ${rehearsal.id} failed file verification`);
    }
  } else {
    await appendEvent(repoRoot, workspace, eventRecord({
      id: policyEventId,
      workspace_id: workspace.id,
      run_id: checkpoint.run_id,
      event_type: "policy.decided",
      actor: { type: "system", id: "tool_policy_proxy" },
      summary: `Fresh policy evaluation approved rehearsal ${rehearsal.id}; no prior lease or authority was reused.`
    }));
  }
  await appendEvent(repoRoot, workspace, eventRecord({
    id: liveActionEventId,
    workspace_id: workspace.id,
    run_id: checkpoint.run_id,
    event_type: "action.recorded",
    actor: { type: "system", id: "sandbox_promoter" },
    summary: `Approved rehearsal ${rehearsal.id} promoted to a new live action record after fresh policy evaluation.`
  }));

  const approved = approveRehearsal(rehearsal, branch, policyEventId, liveActionEventId);
  if (rehearsal.operation === "file.write") {
    approved.approval.target_path = rehearsal.target_path;
    approved.approval.new_lease_id = newLeaseId;
    approved.approval.real_side_effect_executed = realSideEffectExecuted;
    approved.approval.verification_status = verificationStatus;
  }
  upsertRegistryItem(workspaceRoot, "branches", approved.branch);
  printJson(approved.approval);
}

async function runCapsule(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  const capsules = readRegistry(workspaceRoot, "capsules").filter(isCapsule);
  const drafts = readRegistry(workspaceRoot, "capsule-drafts").filter(isCapsule);
  if (options.topic === "list" || !options.topic) {
    printJson([...capsules, ...drafts]);
    return;
  }
  if (options.topic === "inspect") {
    const capsuleId = requirePositional(options.target ?? options.capsule, "capsule inspect requires a capsule id");
    printJson(requireCapsule([...capsules, ...drafts], capsuleId));
    return;
  }
  if (options.topic === "draft") {
    if (!options.path) {
      throw new Error("capsule draft requires --path <manifest.json>");
    }
    const raw = JSON.parse(readFileSync(resolve(workspaceRoot, options.path), "utf8")) as unknown;
    const draftInput = capsuleDraftInput(raw);
    const previous = capsules.find((entry) => entry.id === draftInput.id);
    const draft = createDraftCapsule(draftInput, previous);
    await requireCapsuleProvenance(workspaceRoot, draft);
    await requireValidContract("capability-capsule.schema.json", draft);
    archiveCapsuleVersion(workspaceRoot, draft);
    upsertRegistryItem(workspaceRoot, "capsule-drafts", draft);
    printJson(draft);
    return;
  }
  if (options.topic === "test") {
    const capsuleId = requirePositional(options.target ?? options.capsule, "capsule test requires a capsule id");
    const capsule = requireCapsule(drafts, capsuleId);
    if (options.replayRuns.length < 2) {
      throw new Error("capsule test requires at least two --replay-run <run_id> values");
    }
    const workspace = await openWorkspace(workspaceRoot);
    const replayRecords = await Promise.all(options.replayRuns.map((runId) => createTraceReplayRecord(workspace, runId)));
    for (const replayRecord of replayRecords) {
      writeReplayArtifact(workspaceRoot, replayRecord);
      upsertRegistryItem(workspaceRoot, "replay-records", replayRecord);
    }
    const sandboxTrial = await runDocumentSandboxTrial(workspaceRoot, capsule);
    const tested = attachCapsuleTestEvidence(capsule, replayRecords, sandboxTrial);
    await requireValidContract("capability-capsule.schema.json", tested);
    archiveCapsuleVersion(workspaceRoot, tested);
    upsertRegistryItem(workspaceRoot, "capsule-drafts", tested);
    printJson(tested);
    return;
  }
  if (options.topic === "publish") {
    const capsuleId = requirePositional(options.target ?? options.capsule, "capsule publish requires a capsule id");
    const capsule = requireCapsule(drafts, capsuleId);
    let approvalCardId: string | undefined;
    if (capsule.permission_diff.requires_approval) {
      if (!options.approvePermissions) {
        throw new Error("Permission expansion requires --approve-permissions");
      }
      const approvalCard = capsuleApprovalCard(capsule);
      await requireValidContract("approval-card.schema.json", approvalCard);
      upsertRegistryItem(workspaceRoot, "approval-cards", approvalCard);
      approvalCardId = approvalCard.id;
    }
    const published = publishCapsule(capsule, approvalCardId);
    await requireValidContract("capability-capsule.schema.json", published);
    archiveCapsuleVersion(workspaceRoot, published);
    upsertRegistryItem(workspaceRoot, "capsules", published);
    removeRegistryItem(workspaceRoot, "capsule-drafts", published.id);
    printJson(published);
    return;
  }
  if (options.topic === "rollback") {
    const capsuleId = requirePositional(options.target ?? options.capsule, "capsule rollback requires a capsule id");
    if (!options.version) {
      throw new Error("capsule rollback requires --version <published_version>");
    }
    const current = requireCapsule(capsules, capsuleId);
    const target = readCapsuleVersion(workspaceRoot, capsuleId, options.version);
    const result = rollbackCapsule(current, target);
    archiveCapsuleVersion(workspaceRoot, result.deprecated);
    archiveCapsuleVersion(workspaceRoot, result.active);
    upsertRegistryItem(workspaceRoot, "capsules", result.active);
    printJson(result);
    return;
  }
  throw new Error("capsule supports draft, list, inspect, test, publish, and rollback");
}

function capsuleDraftInput(value: unknown): CapsuleDraftInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Capsule manifest must be a JSON object");
  }
  const manifest = value as Record<string, unknown>;
  const executionMode = requireManifestString(manifest, "execution_mode");
  if (executionMode !== "document_only" && executionMode !== "external_sandbox") {
    throw new Error("Capsule manifest execution_mode must be document_only or external_sandbox");
  }
  const riskLevel = requireManifestString(manifest, "risk_level");
  if (!["L0", "L1", "L2", "L3", "L4", "L5"].includes(riskLevel)) {
    throw new Error("Capsule manifest risk_level must be L0 through L5");
  }
  const permissionRequirements = requireManifestObject(manifest, "permission_requirements");
  const provenance = requireManifestObject(manifest, "provenance");
  return {
    id: requireManifestString(manifest, "id"),
    version: requireManifestString(manifest, "version"),
    description: requireManifestString(manifest, "description"),
    playbook: requireManifestString(manifest, "playbook"),
    execution_mode: executionMode,
    permission_requirements: {
      required_tools: requireManifestStringArray(permissionRequirements, "required_tools"),
      forbidden_tools: requireManifestStringArray(permissionRequirements, "forbidden_tools")
    },
    tool_contracts: requireManifestStringArray(manifest, "tool_contracts"),
    risk_level: riskLevel as CapsuleDraftInput["risk_level"],
    provenance: {
      source_events: requireManifestStringArray(provenance, "source_events"),
      source_tasks: requireManifestStringArray(provenance, "source_tasks")
    },
    legacy_source: typeof manifest.legacy_source === "string" ? manifest.legacy_source : null,
    evals: requireManifestStringArray(manifest, "evals")
  };
}

async function requireCapsuleProvenance(workspaceRoot: string, capsule: Capsule): Promise<void> {
  const workspace = await openWorkspace(workspaceRoot);
  const events = await readEvents(workspace);
  const eventIds = new Set(events.map((event) => event.id));
  for (const sourceEvent of capsule.provenance.source_events) {
    if (!eventIds.has(sourceEvent)) {
      throw new Error(`Capsule source event ${sourceEvent} not found in Event Ledger`);
    }
  }
  for (const sourceTask of capsule.provenance.source_tasks) {
    if (!events.some((event) => event.run_id === sourceTask)) {
      throw new Error(`Capsule source task ${sourceTask} has no Event Ledger evidence`);
    }
  }
}

async function requireValidContract(schemaName: string, value: unknown): Promise<void> {
  const validation = await validateAgainstSchema(repoRoot, schemaName, value);
  if (!validation.valid) {
    throw new Error(`${schemaName} validation failed: ${validation.errors.join("; ")}`);
  }
}

function capsuleApprovalCard(capsule: Capsule): Record<string, unknown> & { id: string } {
  const approvalSuffix = `${capsule.id}_${capsule.version}`.replace(/[^A-Za-z0-9_-]+/g, "_");
  return {
    id: `approval_capsule_${approvalSuffix}`,
    tool_request_id: `capsule_publish_${capsule.id}_${capsule.version}`,
    risk_level: capsule.risk_level,
    target: `capsule://${capsule.id}@${capsule.version}`,
    expected_effect: `Publish a local unsigned Capsule with added tool requirements: ${capsule.permission_diff.added_tools.join(", ")}`,
    scope: {
      actions: ["capsule.publish"],
      resources: capsule.permission_diff.added_tools,
      egress: ["none"],
      ttl_seconds: 300
    },
    choices: ["approve_once", "deny"]
  };
}

function archiveCapsuleVersion(workspaceRoot: string, capsule: Capsule): void {
  upsertRegistryItem(workspaceRoot, "capsule-versions", {
    id: `capver_${sanitizePathSegment(capsule.id)}_${sanitizePathSegment(capsule.version)}`,
    capsule
  });
}

function readCapsuleVersion(workspaceRoot: string, capsuleId: string, version: string): Capsule {
  const recordId = `capver_${sanitizePathSegment(capsuleId)}_${sanitizePathSegment(version)}`;
  const record = readRegistry(workspaceRoot, "capsule-versions").find((entry) => entry.id === recordId);
  const capsule = record?.capsule;
  if (!isCapsule(capsule) || capsule.lifecycle !== "published") {
    throw new Error(`Published Capsule ${capsuleId}@${version} not found`);
  }
  return capsule;
}

function requireManifestString(manifest: Record<string, unknown>, key: string): string {
  const value = manifest[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Capsule manifest ${key} must be a non-empty string`);
  }
  return value;
}

function requireManifestStringArray(manifest: Record<string, unknown>, key: string): string[] {
  const value = manifest[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Capsule manifest ${key} must be an array of strings`);
  }
  return value;
}

function requireManifestObject(manifest: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = manifest[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Capsule manifest ${key} must be an object`);
  }
  return value as Record<string, unknown>;
}

async function runWhy(options: CliOptions): Promise<void> {
  const runId = options.topic ?? options.input;
  const workspace = await openWorkspace(resolve(options.workspace));
  const events = (await readEvents(workspace)).filter((event) => event.run_id === runId);
  if (events.length === 0) {
    throw new Error(`Run ${runId} has no ledger events`);
  }
  const edges = buildCausalEdges(events);
  upsertRegistryItems(resolve(options.workspace), "causal-edges", edges);
  printJson({ id: `why_${runId}`, run_id: runId, edges });
}

function runCounterfactual(options: CliOptions): void {
  const workspaceRoot = resolve(options.workspace);
  const checkpointId = requirePositional(options.topic, "counterfactual requires a checkpoint id");
  const checkpoint = findCheckpoint(readRegistry(workspaceRoot, "checkpoints").filter(isCheckpoint), checkpointId);
  if (!checkpoint) {
    throw new Error(`Checkpoint ${checkpointId} not found`);
  }
  if (!options.change) {
    throw new Error("counterfactual requires --change <description>");
  }
  const edges = readRegistry(workspaceRoot, "causal-edges").filter(isCausalEdge);
  printJson(counterfactualFromCheckpoint(checkpointId, checkpoint.event_id, options.change, edges));
}

async function runSleep(options: CliOptions): Promise<void> {
  const runId = options.topic ?? options.input;
  const workspaceRoot = resolve(options.workspace);
  const workspace = await openWorkspace(workspaceRoot);
  const manifest = await loadRunManifest(workspace, runId).catch(() => undefined);
  if (!manifest) {
    throw new Error(`Cannot hibernate unknown run ${runId}`);
  }
  const contextPackId = `ctx_${runId}`;
  const contextPack = readRegistry(workspaceRoot, "context-packs").find((entry) => entry.id === contextPackId);
  if (!contextPack) {
    throw new Error(`Cannot hibernate run ${runId}: context pack ${contextPackId} not found`);
  }
  printJson(hibernateRun(runId, contextPackId));
}

function runWake(options: CliOptions): void {
  const workspaceRoot = resolve(options.workspace);
  const hibernationId = requirePositional(options.topic, "wake requires a hibernation id");
  const hibernation = findHibernation(readRegistry(workspaceRoot, "hibernations").filter(isHibernationRecord), hibernationId);
  if (!hibernation) {
    throw new Error(`Hibernation ${hibernationId} not found`);
  }
  const trigger = wakeRun(hibernation, "manual");
  if (trigger.status === "queued") {
    upsertRegistryItem(workspaceRoot, "hibernations", markWaking(hibernation));
  }
  printJson(trigger);
}

async function runAnchors(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  if (options.topic === "list") {
    printJson(readRegistry(workspaceRoot, "persona-anchors"));
    return;
  }
  if (options.topic === "propose") {
    if (!options.sourceEvent || options.content === undefined || options.confidence === undefined) {
      throw new Error("anchors propose requires --source-event <event_id> --content <text> --confidence <0..1>");
    }
    await requireSourceEvent(workspaceRoot, options.sourceEvent);
    printJson(proposePersonaAnchor({
      id: `anchor_${sanitizePathSegment(options.sourceEvent)}`,
      content: options.content,
      source_events: [options.sourceEvent],
      confidence: options.confidence,
      ttl: "180d",
      allowed_contexts: ["planning", "coding"],
      blocked_contexts: ["external_auto_send"]
    }));
    return;
  }
  if (options.topic === "accept" || options.topic === "reject") {
    const anchorId = requirePositional(options.target, `anchors ${options.topic} requires an anchor id`);
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
    throw new Error("soul supports fork <checkpoint_id> --agent-id <new_agent_id>");
  }
  const workspaceRoot = resolve(options.workspace);
  const checkpointId = requirePositional(options.target, "soul fork requires a checkpoint id");
  const newAgentId = requirePositional(options.agentId, "soul fork requires --agent-id <new_agent_id>");
  const checkpoint = findCheckpoint(readRegistry(workspaceRoot, "checkpoints").filter(isCheckpoint), checkpointId);
  if (!checkpoint) {
    throw new Error(`Checkpoint ${checkpointId} not found`);
  }
  printJson(forkSoul(checkpoint.id, newAgentId));
}

async function runAgent(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  if (options.topic !== "contract") {
    throw new Error("agent supports contract");
  }
  const parentRunId = requirePositional(options.parentRun, "agent contract requires --parent-run <run_id>");
  const childAgentId = requirePositional(options.childAgent, "agent contract requires --child-agent <agent_id>");
  const budgetId = requirePositional(options.budget, "agent contract requires --budget <budget_id>");
  const task = requirePositional(options.content, "agent contract requires --content <task>");
  const capsuleId = requirePositional(options.capsule, "agent contract requires --capsule <capsule_id>");
  const workspace = await openWorkspace(workspaceRoot);
  await loadRunManifest(workspace, parentRunId).catch(() => {
    throw new Error(`Parent run ${parentRunId} not found`);
  });
  const existingBudget = findBudget(readRegistry(workspaceRoot, "resource-budgets").filter(isResourceBudget), budgetId);
  if (!existingBudget) {
    throw new Error(`Resource budget ${budgetId} not found`);
  }
  const capsule = readRegistry(workspaceRoot, "capsules").filter(isCapsule).find((entry) => entry.id === capsuleId);
  if (!capsule || !isPublishedCapsuleWithEvidence(capsule)) {
    throw new Error(`Published capsule ${capsuleId} not found`);
  }
  await requireValidContract("capability-capsule.schema.json", capsule);
  printJson(createAgentContract(parentRunId, childAgentId, task, existingBudget, [capsuleId]));
}

async function runSecurity(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  if (options.topic === "scan") {
    if (!options.sourceEvent || options.content === undefined) {
      throw new Error("security scan requires --source-event <event_id> and --content <text>");
    }
    await requireSourceEvent(workspaceRoot, options.sourceEvent);
    const signal = detectPoisoning(options.sourceEvent, options.content);
    if (!signal) {
      console.log(JSON.stringify({
        source_event_id: options.sourceEvent,
        status: "no_signal",
        can_authorize_actions: false
      }, null, 2));
      return;
    }
    printJson(signal);
    return;
  }
  if (options.topic === "ack") {
    const signalId = requirePositional(options.target, "security ack requires a signal id");
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
      return null;
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
  const workspace = await openWorkspace(resolve(options.workspace));
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

function requirePositional(value: string | undefined, message: string): string {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

async function openWorkspace(workspaceRoot: string) {
  return (await loadWorkspaceFromRegistry(workspaceRoot)).workspace;
}

async function requireSourceEvent(workspaceRoot: string, eventId: string): Promise<void> {
  const exists = await openWorkspace(workspaceRoot)
    .then(readEvents)
    .then((events) => events.some((event) => event.id === eventId))
    .catch(() => false);
  if (!exists) {
    throw new Error(`Source event ${eventId} not found`);
  }
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
  npm run ether -- memory candidates --source-event <event> --content <text> --confidence <0..1>
  npm run ether -- memory candidates --from-run <run_id> --workspace <path>
  npm run ether -- memory timeline <run_id> --workspace <path>
  npm run ether -- memory user-model --workspace <path>
  npm run ether -- context explain <run_id> --workspace <path>
  npm run ether -- checkpoint <run_id> --workspace <path>
  npm run ether -- branch <checkpoint_id>
  npm run ether -- rehearse <branch_id> --path <workspace-file> --content <proposed-contents>
  npm run ether -- approve-rehearsal <rehearsal_id> --workspace <path>
  npm run ether -- capsule draft --path <manifest.json> --workspace <path>
  npm run ether -- capsule list
  npm run ether -- capsule inspect <capsule_id>
  npm run ether -- capsule test <capsule_id> --replay-run <run_id> --replay-run <run_id>
  npm run ether -- capsule publish <capsule_id> [--approve-permissions]
  npm run ether -- capsule rollback <capsule_id> --version <published_version>
  npm run ether -- why <run_id> --workspace <path>
  npm run ether -- counterfactual <checkpoint_id> --change <text>
  npm run ether -- sleep <run_id>
  npm run ether -- wake <hibernation_id>
  npm run ether -- anchors propose --source-event <event> --content <text> --confidence <0..1>
  npm run ether -- persona reset <branch>
  npm run ether -- soul fork <checkpoint_id> --agent-id <new_agent_id>
  npm run ether -- agent contract --parent-run <run_id> --child-agent <agent_id> --budget <budget_id> --capsule <capsule_id> --content <task>
  npm run ether -- security scan --source-event <event_id> --content <text>

Commands:
  run/replay/trace       Phase 1 local kernel loop and replay
  import                 Phase 4 dry-run migration report
  memory/context         Phase 3 source-backed Memory OS surfaces
  checkpoint/branch/rehearse Phase 5 sandbox and time-travel surfaces
  capsule                Governed document-only draft/test/local-publish/rollback lifecycle
  why/counterfactual     Phase 7 causal memory report surfaces
  sleep/wake             Phase 8 evidence-backed hibernation records
  anchors/persona/soul   Phase 9 evidence-backed persona and soul fork records
  agent                  Phase 10 contract creation only; no child execution
  security               Phase 11 signature-based poisoning detection
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
