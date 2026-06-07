#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { acceptCandidateFromRegistry, acceptMemoryCandidate, assembleContextPack, buildEpisodicTimeline, createBasicUserModel, createMemoryCandidate, createMemoryDeleteTombstone, deriveMemoryCandidatesFromEvents, isMemoryCandidate, isMemoryCard, rejectMemoryCandidate } from "../../memory-os/src/index.ts";
import { buildCausalEdges, buildWhyReport, counterfactualFromCheckpoint, rebuildCausalProjection, redactedSources } from "../../causal-memory/src/index.ts";
import { approveRehearsal, createBranch, createCheckpoint, findBranch, findCheckpoint, isBranch, isCheckpoint, isRehearsal, rehearseFileWrite } from "../../sandbox/src/index.ts";
import { attachCapsuleTestEvidence, createDraftCapsule, isCapsule, isPublishedCapsuleWithEvidence, publishCapsule, requireCapsule, rollbackCapsule, runDocumentSandboxTrial, type Capsule, type CapsuleDraftInput } from "../../capability-os/src/index.ts";
import { dryRunImport } from "../../migration/src/index.ts";
import { createDeadlineTrigger, createFileTrigger, createManualTrigger, createResumeRunId, evaluateWakeup, findHibernation, findWakeupTrigger, hibernateRun, isHibernationRecord, isWakeupTrigger, queueWakeup } from "../../hibernation/src/index.ts";
import { acceptMemoryFold, acceptPersonaAnchor, applyPersonaReset, createPersonaBranch, defaultInheritancePolicy, findPersonaAnchor, forkSoul, isMemoryFold, isPersonaAnchor, isPersonaBranch, isPersonaState, isSoulFork, proposeMemoryFold, proposePersonaAnchor, rejectMemoryFold, rejectPersonaAnchor } from "../../soul/src/index.ts";
import { assertCapsuleAllowed, assertPathAllowed, assertRiskBudget, createAgentContract, createBudgetAccount, findBudget, isAgentContract, isAgentScore, isBudgetAccount, isResourceBudget, openCircuitBreaker, recordLeaseUse, recordPolicyDenial, recordRuntimeUsage, reserveRead, updateAgentScore, type ChildResult } from "../../multiagent/src/index.ts";
import { acknowledgePoisoning, createPoisoningRegressionFixture, isPoisoningSignal, isUntrustedSource, runHoneypotTrial, scanUntrustedContent, signalFromAssessment, type UntrustedSource } from "../../security/src/index.ts";
import { createBrowserObservation, createCapsuleInstallRecord, createImInboxItem, createImOutboxItem, type BrowserObservationInput, type ImInboxInput, type ImOutboxInput, type StorePackage } from "../../surface-os/src/index.ts";
import { appendEvent, callSupervisorRpc, completeRunManifest, createRunManifest, createTraceReplayRecord, eventRecord, isRegistryItem, loadRunManifest, loadWorkspaceFromRegistry, readEvents, readRegistry, reconstructTrace, recordRunEvent, removeRegistryItem, rpcResult, runLocalKernelLoop, runSupervisorKernelLoop, upsertRegistryItem, upsertRegistryItems, validateAgainstSchema, verifyEventHashChain } from "../../harness-core/src/index.ts";

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
  deadline?: string;
  watchFile?: string;
  branch?: string;
  kind?: "style" | "preference" | "principle";
  ttl?: string;
  sensitivity?: string;
  approveSensitive: boolean;
  parentRun?: string;
  childAgent?: string;
  budget?: string;
  agentId?: string;
  sourceKind?: UntrustedSource;
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
    approvePermissions: false,
    approveSensitive: false
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
      case "--source-kind": {
        const sourceKind = requireValue(arg, next);
        if (!isUntrustedSource(sourceKind)) {
          throw new Error("--source-kind must be public_web, email, pdf, im, github_issue, mcp_description, or third_party_content");
        }
        options.sourceKind = sourceKind;
        index += 1;
        break;
      }
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
      case "--deadline":
        options.deadline = requireValue(arg, next);
        index += 1;
        break;
      case "--watch-file":
        options.watchFile = requireValue(arg, next);
        index += 1;
        break;
      case "--branch":
        options.branch = requireValue(arg, next);
        index += 1;
        break;
      case "--kind": {
        const kind = requireValue(arg, next);
        if (kind !== "style" && kind !== "preference" && kind !== "principle") {
          throw new Error("--kind must be style, preference, or principle");
        }
        options.kind = kind;
        index += 1;
        break;
      }
      case "--ttl":
        options.ttl = requireValue(arg, next);
        index += 1;
        break;
      case "--sensitivity":
        options.sensitivity = requireValue(arg, next);
        index += 1;
        break;
      case "--approve-sensitive":
        options.approveSensitive = true;
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
  const valueFlags = new Set(["--workspace", "--input", "--output", "--summary", "--from", "--path", "--change", "--content", "--source-event", "--confidence", "--from-run", "--capsule", "--replay-run", "--version", "--deadline", "--watch-file", "--branch", "--kind", "--ttl", "--sensitivity", "--parent-run", "--child-agent", "--budget", "--agent-id", "--supervisor"]);
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
      await runCounterfactual(options);
      return true;
    case "sleep":
      await runSleep(options);
      return true;
    case "wake":
      await runWake(options);
      return true;
    case "sleepers":
      runSleepers(options);
      return true;
    case "dream":
      await runDream(options);
      return true;
    case "anchors":
      await runAnchors(options);
      return true;
    case "persona":
      await runPersona(options);
      return true;
    case "soul":
      await runSoul(options);
      return true;
    case "agent":
      await runAgent(options);
      return true;
    case "security":
      await runSecurity(options);
      return true;
    case "surface":
      await runSurface(options);
      return true;
    case "store":
      await runStore(options);
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

async function validateAndUpsertAgentRecord(
  workspaceRoot: string,
  schemaName: string,
  registryName: string,
  value: Record<string, unknown> & { id: string }
): Promise<void> {
  await requireValidContract(schemaName, value);
  upsertRegistryItem(workspaceRoot, registryName, value);
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
  const workspaceRoot = resolve(options.workspace);
  const workspace = await openWorkspace(workspaceRoot);
  const ledgerEvents = await readEvents(workspace);
  const runEvents = ledgerEvents.filter((event) => event.run_id === runId);
  if (runEvents.length === 0) {
    throw new Error(`Run ${runId} has no ledger events`);
  }
  const edges = buildCausalEdges(runEvents, redactedSources(ledgerEvents));
  const report = buildWhyReport(runEvents, edges);
  const projection = rebuildCausalProjection(workspaceRoot, runId, ledgerEvents, edges);
  for (const edge of edges) {
    await requireValidContract("causal-edge.schema.json", edge);
  }
  await requireValidContract("why-report.schema.json", report);
  await requireValidContract("causal-projection.schema.json", projection);
  upsertRegistryItems(workspaceRoot, "causal-edges", edges);
  upsertRegistryItem(workspaceRoot, "why-reports", report);
  upsertRegistryItem(workspaceRoot, "causal-projections", projection);
  printJson({ id: report.id, report, projection, edges });
}

async function runCounterfactual(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  const checkpointId = requirePositional(options.topic, "counterfactual requires a checkpoint id");
  const checkpoint = findCheckpoint(readRegistry(workspaceRoot, "checkpoints").filter(isCheckpoint), checkpointId);
  if (!checkpoint) {
    throw new Error(`Checkpoint ${checkpointId} not found`);
  }
  if (!options.change) {
    throw new Error("counterfactual requires --change <description>");
  }
  const workspace = await openWorkspace(workspaceRoot);
  const ledgerEvents = await readEvents(workspace);
  const runEvents = ledgerEvents.filter((event) => event.run_id === checkpoint.run_id);
  if (runEvents.length === 0) {
    throw new Error(`Checkpoint run ${checkpoint.run_id} has no ledger events`);
  }
  const edges = buildCausalEdges(runEvents, redactedSources(ledgerEvents));
  const projection = rebuildCausalProjection(workspaceRoot, checkpoint.run_id, ledgerEvents, edges);
  const report = counterfactualFromCheckpoint(checkpointId, checkpoint.event_id, options.change, edges);
  await requireValidContract("counterfactual-report.schema.json", report);
  await requireValidContract("causal-projection.schema.json", projection);
  upsertRegistryItems(workspaceRoot, "causal-edges", edges);
  upsertRegistryItem(workspaceRoot, "causal-projections", projection);
  printJson(report);
}

async function runSleep(options: CliOptions): Promise<void> {
  const runId = options.topic ?? options.input;
  const workspaceRoot = resolve(options.workspace);
  const workspace = await openWorkspace(workspaceRoot);
  const manifest = await loadRunManifest(workspace, runId).catch(() => undefined);
  if (!manifest) {
    throw new Error(`Cannot hibernate unknown run ${runId}`);
  }
  const runEvents = (await readEvents(workspace)).filter((event) => event.run_id === runId);
  const head = runEvents.at(-1);
  if (!head?.event_hash) {
    throw new Error(`Cannot hibernate run ${runId} without a hash-bound Ledger cursor`);
  }
  const contextPack = assembleContextPack(runId, readRegistry(workspaceRoot, "memory-cards").filter(isMemoryCard), "resume");
  contextPack.id = `ctx_resume_${runId}`;
  contextPack.active_leases = [];
  contextPack.token_budget = { memory_tokens: 256, capability_tokens: 256, task_tokens: 1024 };
  await requireValidContract("context-pack.schema.json", contextPack);
  upsertRegistryItem(workspaceRoot, "context-packs", contextPack);

  const hibernationId = `hibernate_${runId}`;
  const triggers = [createManualTrigger(hibernationId)];
  if (options.deadline) {
    triggers.push(createDeadlineTrigger(hibernationId, options.deadline));
  }
  if (options.watchFile) {
    triggers.push(createFileTrigger(workspaceRoot, hibernationId, options.watchFile));
  }
  for (const trigger of triggers) {
    await requireValidContract("wakeup-trigger.schema.json", trigger);
    upsertRegistryItem(workspaceRoot, "wakeups", trigger);
  }
  const record = hibernateRun({
    runId,
    contextPack,
    ledgerCursor: {
      event_id: head.id,
      event_hash: head.event_hash,
      event_count: runEvents.length
    },
    resumeSummary: manifest.summary ?? `Resume ${runId} from persisted Ledger state.`,
    triggers
  });
  await requireValidContract("hibernation-record.schema.json", record);
  printJson(record);
}

async function runWake(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  const targetId = requirePositional(options.topic, "wake requires a trigger or hibernation id");
  const hibernations = readRegistry(workspaceRoot, "hibernations").filter(isHibernationRecord);
  const triggers = readRegistry(workspaceRoot, "wakeups").filter(isWakeupTrigger);
  const directTrigger = findWakeupTrigger(triggers, targetId);
  const hibernation = directTrigger
    ? findHibernation(hibernations, directTrigger.hibernation_id)
    : findHibernation(hibernations, targetId);
  if (!hibernation) {
    throw new Error(`Hibernation for ${targetId} not found`);
  }
  const trigger = directTrigger ?? triggers.find((entry) => entry.hibernation_id === hibernation.id && entry.source === "manual");
  if (!trigger) {
    throw new Error(`Wakeup trigger for ${hibernation.id} not found`);
  }
  const evaluated = evaluateWakeup(workspaceRoot, hibernation, trigger);
  if (evaluated.status !== "eligible") {
    upsertRegistryItem(workspaceRoot, "wakeups", evaluated);
    printJson(evaluated);
    return;
  }

  const workspace = await openWorkspace(workspaceRoot);
  const resumeRunId = createResumeRunId();
  const policyResult = rpcResult(await callSupervisorRpc(repoRoot, {
    id: `rpc_${resumeRunId}_resume_policy`,
    method: "run.resume.evaluate",
    workspace_root: workspaceRoot,
    workspace_id: workspace.id,
    run_id: resumeRunId,
    source: evaluated.source,
    trigger_id: evaluated.id
  }));
  if (
    policyResult.decision !== "queue"
    || typeof policyResult.policy_decision_id !== "string"
    || typeof policyResult.policy_event_id !== "string"
    || policyResult.lease_id !== ""
    || policyResult.auto_execute_allowed !== false
  ) {
    throw new Error(`Supervisor did not return a queue-only wake policy for ${evaluated.id}`);
  }
  const queued = queueWakeup(hibernation, evaluated, policyResult.policy_decision_id, resumeRunId);
  const resumeManifest = await createRunManifest(repoRoot, workspace, resumeRunId, `Queued resume for ${hibernation.run_id}; no side effects executed.`);
  await recordRunEvent(repoRoot, workspace, resumeManifest, policyResult.policy_event_id);
  const appendResult = rpcResult(await callSupervisorRpc(repoRoot, {
    id: `rpc_${resumeRunId}_wakeup_event`,
    method: "event.append",
    workspace_root: workspaceRoot,
    workspace_id: workspace.id,
    run_id: resumeRunId,
    event_type: "wakeup.queued",
    summary: `Wakeup ${queued.trigger.id} passed fresh queue-only policy; no lease or automatic action was issued.`
  }));
  if (typeof appendResult.event_id !== "string") {
    throw new Error(`Supervisor did not append wakeup event for ${queued.trigger.id}`);
  }
  await recordRunEvent(repoRoot, workspace, resumeManifest, appendResult.event_id);
  await completeRunManifest(repoRoot, workspace, resumeManifest, "blocked");
  upsertRegistryItem(workspaceRoot, "hibernations", queued.hibernation);
  upsertRegistryItem(workspaceRoot, "wakeups", queued.trigger);
  printJson(queued.trigger);
}

function runSleepers(options: CliOptions): void {
  printJson(readRegistry(resolve(options.workspace), "hibernations").filter(isHibernationRecord));
}

async function runDream(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  if (options.topic === "run") {
    const runId = requirePositional(options.target, "dream run requires a run id");
    const content = requirePositional(options.content, "dream run requires --content <proposed-memory>");
    const confidence = options.confidence;
    if (confidence === undefined) {
      throw new Error("dream run requires --confidence <0..1>");
    }
    const workspace = await openWorkspace(workspaceRoot);
    await loadRunManifest(workspace, runId).catch(() => {
      throw new Error(`Dream source run ${runId} not found`);
    });
    const sourceEventIds = new Set((await readEvents(workspace)).filter((event) => event.run_id === runId).map((event) => event.id));
    const memories = readRegistry(workspaceRoot, "memory-cards")
      .filter(isMemoryCard)
      .filter((memory) => memory.source_events.some((eventId) => sourceEventIds.has(eventId)));
    const fold = proposeMemoryFold(runId, memories, content, confidence);
    await requireValidContract("memory-fold.schema.json", fold);
    await recordGovernanceEvent(workspaceRoot, "memory.fold.proposed", `Dreaming proposed ${fold.id} from ${fold.folded_from.join(", ")} without changing active memory.`, artifactRef("dream", "run", fold.id));
    printJson(fold);
    return;
  }
  if (options.topic === "accept" || options.topic === "reject") {
    const foldId = requirePositional(options.target, `dream ${options.topic} requires a fold id`);
    const fold = readRegistry(workspaceRoot, "memory-folds").filter(isMemoryFold).find((entry) => entry.id === foldId);
    if (!fold) {
      throw new Error(`Memory fold ${foldId} not found`);
    }
    if (options.topic === "accept") {
      const accepted = acceptMemoryFold(fold, options.approveSensitive);
      await requireValidContract("memory-card.schema.json", accepted.memory);
      await requireValidContract("memory-fold.schema.json", accepted.fold);
      await recordGovernanceEvent(workspaceRoot, "memory.fold.accepted", `Accepted ${fold.id} as ${accepted.memory.id}; source memories remain independently addressable.`, artifactRef("dream", "accept", accepted.fold.id));
      upsertRegistryItem(workspaceRoot, "memory-cards", accepted.memory);
      printJson(accepted.fold);
    } else {
      const rejected = rejectMemoryFold(fold);
      await requireValidContract("memory-fold.schema.json", rejected);
      await recordGovernanceEvent(workspaceRoot, "memory.fold.rejected", `Rejected ${fold.id}; active memory was unchanged.`, artifactRef("dream", "reject", rejected.id));
      printJson(rejected);
    }
    return;
  }
  throw new Error("dream supports run <run_id>, accept <fold_id>, and reject <fold_id>");
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
    const proposed = proposePersonaAnchor({
      id: `anchor_${sanitizePathSegment(options.sourceEvent)}_${sanitizePathSegment(options.branch ?? "default")}`,
      branch: options.branch ?? "default",
      kind: options.kind ?? "style",
      content: options.content,
      source_events: [options.sourceEvent],
      confidence: options.confidence,
      ttl: options.ttl ?? "180d",
      allowed_contexts: ["planning", "coding"],
      blocked_contexts: ["external_auto_send"],
      sensitivity: options.sensitivity ?? "private"
    });
    await requireValidContract("persona-anchor.schema.json", proposed);
    await recordGovernanceEvent(workspaceRoot, "persona.anchor.proposed", `Persona anchor ${proposed.id} was proposed for branch ${proposed.branch}; active persona was unchanged.`, artifactRef("anchors", "propose", proposed.id));
    printJson(proposed);
    return;
  }
  if (options.topic === "accept" || options.topic === "reject") {
    const anchorId = requirePositional(options.target, `anchors ${options.topic} requires an anchor id`);
    const anchor = findPersonaAnchor(readRegistry(workspaceRoot, "persona-anchors").filter(isPersonaAnchor), anchorId);
    if (!anchor) {
      throw new Error(`Persona anchor ${anchorId} not found`);
    }
    const updated = options.topic === "accept"
      ? acceptPersonaAnchor(anchor, options.approveSensitive)
      : rejectPersonaAnchor(anchor);
    await requireValidContract("persona-anchor.schema.json", updated);
    let branch;
    if (updated.review_status === "accepted") {
      const allAnchors = readRegistry(workspaceRoot, "persona-anchors")
        .filter(isPersonaAnchor)
        .filter((entry) => entry.id !== updated.id)
        .concat(updated);
      branch = createPersonaBranch(updated.branch, allAnchors);
      await requireValidContract("persona-branch.schema.json", branch);
    }
    await recordGovernanceEvent(workspaceRoot, `persona.anchor.${updated.review_status}`, `Persona anchor ${updated.id} moved to ${updated.review_status}; no tool authority changed.`, artifactRef("anchors", options.topic, updated.id));
    if (branch) {
      upsertRegistryItem(workspaceRoot, "persona-branches", branch);
    }
    printJson(updated);
    return;
  }
  throw new Error("anchors supports list, propose, accept, and reject");
}

async function runPersona(options: CliOptions): Promise<void> {
  if (options.topic !== "reset") {
    throw new Error("persona supports reset <branch>");
  }
  const workspaceRoot = resolve(options.workspace);
  const branchName = requirePositional(options.target, "persona reset requires a branch");
  const branch = readRegistry(workspaceRoot, "persona-branches").filter(isPersonaBranch).find((entry) => entry.name === branchName);
  if (!branch) {
    throw new Error(`Persona branch ${branchName} not found`);
  }
  const current = readRegistry(workspaceRoot, "persona-states").filter(isPersonaState).find((entry) => entry.id === "persona_state_local");
  const result = applyPersonaReset(current, branch, readRegistry(workspaceRoot, "memory-cards").filter(isMemoryCard));
  await requireValidContract("persona-reset.schema.json", result.reset);
  await requireValidContract("persona-state.schema.json", result.state);
  await recordGovernanceEvent(workspaceRoot, "persona.reset.applied", `Persona branch changed from ${result.reset.from_branch ?? "unset"} to ${result.reset.to_branch}; business memory references were retained.`, artifactRef("persona", "reset", result.reset.id));
  upsertRegistryItem(workspaceRoot, "persona-states", result.state);
  printJson(result.reset);
}

async function runSoul(options: CliOptions): Promise<void> {
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
  if (readRegistry(workspaceRoot, "soul-forks").filter(isSoulFork).some((entry) => entry.new_agent_id === newAgentId)) {
    throw new Error(`Agent identity ${newAgentId} already exists`);
  }
  const workspace = await openWorkspace(workspaceRoot);
  const ledger = await readEvents(workspace);
  const checkpointIndex = ledger.findIndex((event) => event.id === checkpoint.event_id);
  if (checkpointIndex < 0) {
    throw new Error(`Checkpoint event ${checkpoint.event_id} not found in Ledger`);
  }
  const prefix = ledger.slice(0, checkpointIndex + 1);
  const sourceEvents = prefix.filter((event) => event.run_id === checkpoint.run_id);
  const checkpointChain = verifyEventHashChain(prefix);
  if (!checkpointChain.valid) {
    throw new Error(`Checkpoint ${checkpoint.id} cannot be forked from an invalid Ledger prefix`);
  }
  const containsSensitiveHistory = sourceEvents.some((event) =>
    event.sensitivity === "confidential"
    || event.sensitivity === "secret"
    || event.sensitivity === "regulated"
    || event.sensitivity === "credential-like"
  );
  const replayRecord = {
    id: `replay_${sanitizePathSegment(checkpoint.run_id)}_${sanitizePathSegment(checkpoint.id)}_trace`,
    run_id: checkpoint.run_id,
    mode: "trace" as const,
    source_events: sourceEvents.map((event) => event.id),
    artifact_ref: `artifact://replay/${checkpoint.run_id}/${checkpoint.id}`,
    live_side_effects: {
      allowed: false,
      approval_id: null
    },
    result: {
      status: "passed" as const,
      summary: "Checkpoint history references reconstructed without live side effects."
    }
  };
  await requireValidContract("replay-record.schema.json", replayRecord);
  writeReplayArtifact(workspaceRoot, replayRecord);
  upsertRegistryItem(workspaceRoot, "replay-records", replayRecord);
  const inheritancePolicy = defaultInheritancePolicy();
  await requireValidContract("inheritance-policy.schema.json", inheritancePolicy);
  upsertRegistryItem(workspaceRoot, "inheritance-policies", inheritancePolicy);
  const fork = forkSoul({
    checkpoint,
    replayRecordId: replayRecord.id,
    newAgentId,
    workspaceId: workspace.id,
    memories: readRegistry(workspaceRoot, "memory-cards").filter(isMemoryCard),
    containsSensitiveHistory,
    approveSensitiveHistory: options.approveSensitive,
    inheritancePolicy
  });
  await requireValidContract("soul-fork.schema.json", fork);
  await recordGovernanceEvent(workspaceRoot, "soul.fork.created", `Created ${fork.new_agent_id} from checkpoint ${checkpoint.id} with history references only and no live authority.`, artifactRef("soul", "fork", fork.id));
  printJson(fork);
}

async function runAgent(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  const workspace = await openWorkspace(workspaceRoot);
  if (options.topic === "contract") {
    const parentRunId = requirePositional(options.parentRun, "agent contract requires --parent-run <run_id>");
    const childAgentId = requirePositional(options.childAgent, "agent contract requires --child-agent <agent_id>");
    const budgetId = requirePositional(options.budget, "agent contract requires --budget <budget_id>");
    const task = requirePositional(options.content, "agent contract requires --content <task>");
    const capsuleId = requirePositional(options.capsule, "agent contract requires --capsule <capsule_id>");
    const path = requirePositional(options.path, "agent contract requires --path <workspace-file>");
    await loadRunManifest(workspace, parentRunId).catch(() => {
      throw new Error(`Parent run ${parentRunId} not found`);
    });
    const existingBudget = findBudget(readRegistry(workspaceRoot, "resource-budgets").filter(isResourceBudget), budgetId);
    if (!existingBudget) {
      throw new Error(`Resource budget ${budgetId} not found`);
    }
    if (existingBudget.on_exhaustion !== "stop") {
      throw new Error("Phase 10 child execution currently supports only on_exhaustion=stop");
    }
    const capsule = readRegistry(workspaceRoot, "capsules").filter(isCapsule).find((entry) => entry.id === capsuleId);
    if (!capsule || !isPublishedCapsuleWithEvidence(capsule)) {
      throw new Error(`Published capsule ${capsuleId} not found`);
    }
    await requireValidContract("capability-capsule.schema.json", capsule);
    const contract = createAgentContract({
      parentRunId,
      childAgentId,
      task,
      budget: existingBudget,
      allowedCapsules: [capsuleId],
      allowedPaths: [path]
    });
    await requireValidContract("agent-contract.schema.json", contract);
    await recordGovernanceEvent(workspaceRoot, "agent.contract.created", `Created ${contract.id} as a reviewable child work order; no child execution occurred.`, artifactRef("agent", "contract", contract.id));
    printJson(contract);
    return;
  }
  if (options.topic !== "execute") {
    throw new Error("agent supports contract and execute <contract_id>");
  }
  const contractId = requirePositional(options.target, "agent execute requires a contract id");
  const contract = readRegistry(workspaceRoot, "agent-contracts").filter(isAgentContract).find((entry) => entry.id === contractId);
  if (!contract) {
    throw new Error(`Agent contract ${contractId} not found`);
  }
  if (contract.status === "completed" || contract.status === "stopped") {
    throw new Error(`Agent contract ${contract.id} is ${contract.status}`);
  }
  const capsuleId = options.capsule ?? contract.allowed_capsules[0];
  const path = options.path ?? contract.allowed_paths[0];
  const childRunId = `run_child_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const manifest = await createRunManifest(repoRoot, workspace, childRunId, `Child ${contract.child_agent_id}: ${contract.task}`);
  const startedEventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "agent.child.started", `Child run started under ${contract.id}.`, artifactRef("agent", "contract", contract.id));
  let account = readRegistry(workspaceRoot, "budget-accounts").filter(isBudgetAccount).find((entry) => entry.contract_id === contract.id) ?? createBudgetAccount(contract);
  const score = readRegistry(workspaceRoot, "agent-scores").filter(isAgentScore).find((entry) => entry.agent_id === contract.child_agent_id);
  const capsule = readRegistry(workspaceRoot, "capsules").filter(isCapsule).find((entry) => entry.id === capsuleId);
  try {
    assertCapsuleAllowed(contract, capsuleId);
    assertPathAllowed(contract, path);
    assertRiskBudget(contract, "L1");
    if (
      !capsule
      || !isPublishedCapsuleWithEvidence(capsule)
      || capsule.execution_mode !== "document_only"
      || capsule.permission_requirements.required_tools.length !== 1
      || capsule.permission_requirements.required_tools[0] !== "filesystem.read"
    ) {
      throw new Error(`Capsule ${capsuleId} is not an eligible document-only read Capsule`);
    }
  } catch (error) {
    const eventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "circuit.opened", String(error), artifactRef("agent", "execute", childRunId));
    const breaker = openCircuitBreaker({ contractId: contract.id, childRunId, trigger: "permission_violation", eventId, reason: String(error) });
    await validateAndUpsertAgentRecord(workspaceRoot, "circuit-breaker.schema.json", "circuit-breakers", breaker);
    await validateAndUpsertAgentRecord(workspaceRoot, "agent-score.schema.json", "agent-scores", updateAgentScore(score, contract.child_agent_id, "permission_violation"));
    await validateAndUpsertAgentRecord(workspaceRoot, "agent-contract.schema.json", "agent-contracts", { ...contract, status: "stopped" });
    await completeRunManifest(repoRoot, workspace, manifest, "blocked");
    printJson(breaker);
    return;
  }
  const reserved = reserveRead(account);
  if (reserved === "exhausted") {
    const eventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "circuit.opened", `Budget exhausted for ${contract.id}.`, artifactRef("agent", "execute", childRunId));
    const breaker = openCircuitBreaker({ contractId: contract.id, childRunId, trigger: "budget_exhausted", eventId, reason: "Tool-call or lease budget exhausted" });
    await validateAndUpsertAgentRecord(workspaceRoot, "circuit-breaker.schema.json", "circuit-breakers", breaker);
    await validateAndUpsertAgentRecord(workspaceRoot, "budget-account.schema.json", "budget-accounts", { ...account, status: "exhausted" });
    await validateAndUpsertAgentRecord(workspaceRoot, "agent-contract.schema.json", "agent-contracts", { ...contract, status: "stopped" });
    await completeRunManifest(repoRoot, workspace, manifest, "blocked");
    printJson(breaker);
    return;
  }
  account = reserved;
  const wallStarted = performance.now();
  const cpuStarted = process.cpuUsage();
  let readResult: Record<string, unknown>;
  try {
    readResult = rpcResult(await callSupervisorRpc(repoRoot, {
      id: `rpc_${childRunId}_read`,
      method: "child.file.read",
      workspace_root: workspaceRoot,
      workspace_id: workspace.id,
      run_id: childRunId,
      path: resolve(workspaceRoot, path)
    }, { timeoutMs: Math.max(1, account.remaining.wall_time_ms_budget) }));
  } catch (error) {
    const cpuUsed = process.cpuUsage(cpuStarted);
    account = recordRuntimeUsage(account, (cpuUsed.user + cpuUsed.system) / 1000, performance.now() - wallStarted);
    const timedOut = String(error).includes("timed out");
    account = { ...account, status: timedOut ? "exhausted" : "stopped" };
    const reason = timedOut ? "Wall-time budget exhausted" : `Supervisor child read failed: ${String(error)}`;
    const eventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "circuit.opened", reason, artifactRef("agent", "execute", childRunId));
    const breaker = openCircuitBreaker({
      contractId: contract.id,
      childRunId,
      trigger: timedOut ? "budget_exhausted" : "execution_failure",
      eventId,
      reason
    });
    await validateAndUpsertAgentRecord(workspaceRoot, "circuit-breaker.schema.json", "circuit-breakers", breaker);
    await validateAndUpsertAgentRecord(workspaceRoot, "budget-account.schema.json", "budget-accounts", account);
    await validateAndUpsertAgentRecord(workspaceRoot, "agent-contract.schema.json", "agent-contracts", { ...contract, status: "stopped" });
    await completeRunManifest(repoRoot, workspace, manifest, "blocked");
    printJson(breaker);
    return;
  }
  const cpuUsed = process.cpuUsage(cpuStarted);
  account = recordRuntimeUsage(account, (cpuUsed.user + cpuUsed.system) / 1000, performance.now() - wallStarted);
  if (account.status === "exhausted") {
    const eventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "circuit.opened", `Child execution exceeded CPU or wall-time accounting for ${contract.id}.`, artifactRef("agent", "execute", childRunId));
    const breaker = openCircuitBreaker({ contractId: contract.id, childRunId, trigger: "budget_exhausted", eventId, reason: "CPU or wall-time budget exhausted" });
    await validateAndUpsertAgentRecord(workspaceRoot, "circuit-breaker.schema.json", "circuit-breakers", breaker);
    await validateAndUpsertAgentRecord(workspaceRoot, "budget-account.schema.json", "budget-accounts", account);
    await validateAndUpsertAgentRecord(workspaceRoot, "agent-contract.schema.json", "agent-contracts", { ...contract, status: "stopped" });
    await completeRunManifest(repoRoot, workspace, manifest, "blocked");
    printJson(breaker);
    return;
  }
  const supervisorEventIds = [
    readResult.request_event_id,
    readResult.policy_event_id,
    readResult.result_event_id
  ];
  if (!supervisorEventIds.every((eventId) => typeof eventId === "string" && eventId.length > 0)) {
    throw new Error(`Supervisor child read did not return Ledger event evidence for ${childRunId}`);
  }
  for (const eventId of supervisorEventIds as string[]) {
    await recordRunEvent(repoRoot, workspace, manifest, eventId);
  }
  if (readResult.decision !== "allow") {
    account = recordPolicyDenial(account);
    const denialEventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "agent.child.policy_denied", `Supervisor denied ${path} for ${contract.id}.`, artifactRef("agent", "execute", childRunId));
    await validateAndUpsertAgentRecord(workspaceRoot, "budget-account.schema.json", "budget-accounts", account);
    await validateAndUpsertAgentRecord(workspaceRoot, "agent-score.schema.json", "agent-scores", updateAgentScore(score, contract.child_agent_id, "policy_denial"));
    if (account.policy_denials >= 3) {
      const breaker = openCircuitBreaker({ contractId: contract.id, childRunId, trigger: "repeated_policy_denial", eventId: denialEventId, reason: "Three supervisor policy denials", action: "stop" });
      await validateAndUpsertAgentRecord(workspaceRoot, "circuit-breaker.schema.json", "circuit-breakers", breaker);
      await validateAndUpsertAgentRecord(workspaceRoot, "agent-contract.schema.json", "agent-contracts", { ...contract, status: "stopped" });
      await completeRunManifest(repoRoot, workspace, manifest, "blocked");
      printJson(breaker);
      return;
    }
    await completeRunManifest(repoRoot, workspace, manifest, "blocked");
    printJson(account);
    return;
  }
  if (typeof readResult.contents !== "string" || typeof readResult.request_id !== "string" || typeof readResult.policy_decision_id !== "string" || typeof readResult.lease_id !== "string" || !readResult.lease_id) {
    throw new Error(`Supervisor child read did not return completion evidence for ${childRunId}`);
  }
  account = recordLeaseUse(account);
  const resultRef = artifactRef("agent", "execute", `child_result_${childRunId}`);
  const completedEventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "agent.child.completed", `Child read completed with hash-only parent evidence.`, resultRef);
  const result: ChildResult = {
    id: `child_result_${childRunId}`,
    contract_id: contract.id,
    child_run_id: childRunId,
    child_agent_id: contract.child_agent_id,
    capsule_id: capsuleId,
    status: "completed",
    completion_evidence: {
      source_event_ids: [startedEventId, ...(supervisorEventIds as string[]), completedEventId],
      request_id: readResult.request_id,
      policy_decision_id: readResult.policy_decision_id,
      lease_id: readResult.lease_id,
      artifact_sha256: `sha256:${createHash("sha256").update(readResult.contents).digest("hex")}`,
      byte_count: Buffer.byteLength(readResult.contents),
      usage: {
        token_used: account.token_used,
        cpu_ms_used: account.cpu_ms_used,
        network_calls_used: account.network_calls_used,
        wall_time_ms_used: account.wall_time_ms_used
      }
    },
    output_taint: { sources: ["child_agent"], can_authorize_actions: false },
    parent_must_reauthorize_actions: true
  };
  await requireValidContract("child-result.schema.json", result);
  await validateAndUpsertAgentRecord(workspaceRoot, "budget-account.schema.json", "budget-accounts", account);
  await validateAndUpsertAgentRecord(workspaceRoot, "agent-score.schema.json", "agent-scores", updateAgentScore(score, contract.child_agent_id, "success"));
  await validateAndUpsertAgentRecord(workspaceRoot, "agent-contract.schema.json", "agent-contracts", { ...contract, status: "completed" });
  await completeRunManifest(repoRoot, workspace, manifest, "completed");
  printJson(result);
}

async function runSecurity(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  if (options.topic === "scan") {
    if (!options.sourceEvent || options.content === undefined) {
      throw new Error("security scan requires --source-event <event_id> and --content <text>");
    }
    await requireSourceEvent(workspaceRoot, options.sourceEvent);
    const assessment = scanUntrustedContent({
      sourceEventId: options.sourceEvent,
      sourceKind: options.sourceKind ?? "third_party_content",
      text: options.content
    });
    await requireValidContract("content-assessment.schema.json", assessment);
    persistSecurityRecord(workspaceRoot, "scan", "content-assessments", assessment);
    const workspace = await openWorkspace(workspaceRoot);
    const securityRunId = `run_security_scan_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const manifest = await createRunManifest(repoRoot, workspace, securityRunId, `Assess tainted ${assessment.source_kind} content from ${assessment.source_event_id}.`);
    let taintPolicy: Record<string, unknown>;
    try {
      taintPolicy = rpcResult(await callSupervisorRpc(repoRoot, {
        id: `rpc_${securityRunId}_taint_policy`,
        method: "security.taint.evaluate",
        workspace_root: workspaceRoot,
        workspace_id: workspace.id,
        run_id: securityRunId,
        source_kind: assessment.source_kind
      }));
    } catch (error) {
      await completeRunManifest(repoRoot, workspace, manifest, "failed");
      throw error;
    }
    if (
      taintPolicy.decision !== "deny"
      || taintPolicy.lease_id !== ""
      || taintPolicy.can_authorize_actions !== false
      || typeof taintPolicy.policy_event_id !== "string"
    ) {
      await completeRunManifest(repoRoot, workspace, manifest, "failed");
      throw new Error(`Supervisor did not deny tainted authorization for ${assessment.id}`);
    }
    await recordRunEvent(repoRoot, workspace, manifest, taintPolicy.policy_event_id);
    await appendManagedRunEvent(
      workspaceRoot,
      workspace,
      manifest,
      "security.content.assessed",
      `Assessed tainted ${assessment.source_kind} content from ${assessment.source_event_id}; raw content was not persisted and cannot authorize actions.`,
      artifactRef("security", "scan", assessment.id)
    );
    const signal = signalFromAssessment(assessment);
    if (!signal) {
      await completeRunManifest(repoRoot, workspace, manifest, "completed");
      console.log(JSON.stringify(assessment, null, 2));
      return;
    }
    await requireValidContract("poisoning-signal.schema.json", signal);
    persistSecurityRecord(workspaceRoot, "scan", "poisoning-signals", signal);
    await appendManagedRunEvent(
      workspaceRoot,
      workspace,
      manifest,
      "poisoning.detected",
      `Quarantined ${signal.signal_type} signal ${signal.id}; no authorization or external action was issued.`,
      artifactRef("security", "scan", signal.id)
    );
    await completeRunManifest(repoRoot, workspace, manifest, "blocked");
    console.log(JSON.stringify(signal, null, 2));
    return;
  }
  if (options.topic === "ack") {
    const signalId = requirePositional(options.target, "security ack requires a signal id");
    const signal = readRegistry(workspaceRoot, "poisoning-signals").filter(isPoisoningSignal).find((entry) => entry.id === signalId);
    if (!signal) {
      throw new Error(`Poisoning signal ${signalId} not found`);
    }
    const acknowledged = acknowledgePoisoning(signal);
    await requireValidContract("poisoning-signal.schema.json", acknowledged);
    persistSecurityRecord(workspaceRoot, "ack", "poisoning-signals", acknowledged);
    await recordGovernanceEvent(
      workspaceRoot,
      "poisoning.acknowledged",
      `Acknowledged poisoning signal ${signal.id}; quarantine and authorization block remain active.`,
      artifactRef("security", "ack", acknowledged.id)
    );
    console.log(JSON.stringify(acknowledged, null, 2));
    return;
  }
  if (options.topic === "trial") {
    const signalId = requirePositional(options.target, "security trial requires a signal id");
    const signal = readRegistry(workspaceRoot, "poisoning-signals").filter(isPoisoningSignal).find((entry) => entry.id === signalId);
    if (!signal) {
      throw new Error(`Poisoning signal ${signalId} not found`);
    }
    if (options.capsule) {
      const published = readRegistry(workspaceRoot, "capsules").filter(isCapsule).find((entry) => entry.id === options.capsule);
      const draft = readRegistry(workspaceRoot, "capsule-drafts").filter(isCapsule).find((entry) => entry.id === options.capsule);
      const capsule = published ?? draft;
      if (!capsule) {
        throw new Error(`Capsule ${options.capsule} not found`);
      }
      const quarantined = { ...capsule, lifecycle: "quarantined" as const };
      await requireValidContract("capability-capsule.schema.json", quarantined);
      upsertRegistryItem(workspaceRoot, published ? "capsules" : "capsule-drafts", quarantined);
    }
    const trial = runHoneypotTrial(signal, options.capsule);
    await requireValidContract("honeypot-trial.schema.json", trial);
    persistSecurityRecord(workspaceRoot, "trial", "honeypot-trials", trial);
    await recordGovernanceEvent(
      workspaceRoot,
      "honeypot.trial.completed",
      `Completed decoy-only containment trial ${trial.id}; no real secret, network, or authorization path was available.`,
      artifactRef("security", "trial", trial.id)
    );
    console.log(JSON.stringify(trial, null, 2));
    return;
  }
  if (options.topic === "fixture") {
    const signalId = requirePositional(options.target, "security fixture requires a signal id");
    const signal = readRegistry(workspaceRoot, "poisoning-signals").filter(isPoisoningSignal).find((entry) => entry.id === signalId);
    if (!signal) {
      throw new Error(`Poisoning signal ${signalId} not found`);
    }
    const created = createPoisoningRegressionFixture(signal);
    await requireValidContract("poisoning-signal.schema.json", created.signal);
    await requireValidContract("poisoning-regression-fixture.schema.json", created.fixture);
    persistSecurityRecord(workspaceRoot, "fixture", "poisoning-signals", created.signal);
    persistSecurityRecord(workspaceRoot, "fixture", "poisoning-regression-fixtures", created.fixture);
    await recordGovernanceEvent(
      workspaceRoot,
      "poisoning.regression.created",
      `Created detector-only regression fixture ${created.fixture.id} from ${signal.id}; raw content and live side effects are excluded.`,
      artifactRef("security", "fixture", created.fixture.id)
    );
    console.log(JSON.stringify(created.fixture, null, 2));
    return;
  }
  throw new Error("security supports scan, ack <signal_id>, trial <signal_id>, and fixture <signal_id>");
}

async function runSurface(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  const workspace = await openWorkspace(workspaceRoot);
  if (options.topic === "browser-observe") {
    if (!options.path || !options.sourceEvent) {
      throw new Error("surface browser-observe requires --path <observation-input.json> --source-event <event_id>");
    }
    await requireSourceEvent(workspaceRoot, options.sourceEvent);
    const input = JSON.parse(readFileSync(resolve(workspaceRoot, options.path), "utf8")) as BrowserObservationInput;
    const runId = `run_surface_browser_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const manifest = await createRunManifest(repoRoot, workspace, runId, `Ingest current-tab browser observation for ${input.origin}.`);
    const taintPolicy = rpcResult(await callSupervisorRpc(repoRoot, {
      id: `rpc_${runId}_browser_taint`,
      method: "security.taint.evaluate",
      workspace_root: workspaceRoot,
      workspace_id: workspace.id,
      run_id: runId,
      source_kind: "public_web"
    }));
    if (
      taintPolicy.decision !== "deny"
      || taintPolicy.lease_id !== ""
      || taintPolicy.can_authorize_actions !== false
      || typeof taintPolicy.policy_decision_id !== "string"
      || typeof taintPolicy.policy_event_id !== "string"
    ) {
      await completeRunManifest(repoRoot, workspace, manifest, "failed");
      throw new Error("Supervisor did not mark browser observation as non-authorizing tainted content");
    }
    await recordRunEvent(repoRoot, workspace, manifest, taintPolicy.policy_event_id);
    const observation = createBrowserObservation(input, taintPolicy.policy_decision_id, [options.sourceEvent, taintPolicy.policy_event_id]);
    await requireValidContract("browser-observation.schema.json", observation);
    persistSurfaceRecord(workspaceRoot, "browser-observe", "browser-observations", observation);
    await appendManagedRunEvent(
      workspaceRoot,
      workspace,
      manifest,
      "browser.observation.ingested",
      `Ingested hash-only current-tab browser observation ${observation.id}; raw DOM was not persisted and cannot authorize actions.`,
      artifactRef("surface", "browser-observe", observation.id)
    );
    await completeRunManifest(repoRoot, workspace, manifest, "completed");
    printJson(observation);
    return;
  }
  if (options.topic === "im-inbox") {
    if (!options.path) {
      throw new Error("surface im-inbox requires --path <inbox-input.json>");
    }
    const input = JSON.parse(readFileSync(resolve(workspaceRoot, options.path), "utf8")) as ImInboxInput;
    const item = createImInboxItem(input);
    await requireValidContract("im-inbox-item.schema.json", item);
    persistSurfaceRecord(workspaceRoot, "im-inbox", "im-inbox", item);
    await recordGovernanceEvent(
      workspaceRoot,
      "im.inbox.received",
      `Queued hash-only ${item.adapter} ${item.visibility} inbox item ${item.id}; inbound IM cannot authorize actions.`,
      artifactRef("surface", "im-inbox", item.id)
    );
    printJson(item);
    return;
  }
  if (options.topic === "im-outbox") {
    if (!options.path) {
      throw new Error("surface im-outbox requires --path <outbox-input.json>");
    }
    const input = JSON.parse(readFileSync(resolve(workspaceRoot, options.path), "utf8")) as ImOutboxInput;
    await loadRunManifest(workspace, input.source_run_id).catch(() => {
      throw new Error(`Outbox source run ${input.source_run_id} not found`);
    });
    const runId = `run_surface_outbox_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const manifest = await createRunManifest(repoRoot, workspace, runId, `Evaluate ${input.adapter} outbox item for ${input.source_run_id}.`);
    const policy = rpcResult(await callSupervisorRpc(repoRoot, {
      id: `rpc_${runId}_outbox_policy`,
      method: "surface.outbox.evaluate",
      workspace_root: workspaceRoot,
      workspace_id: workspace.id,
      run_id: runId,
      visibility: input.visibility,
      adapter: input.adapter
    }));
    if (
      (policy.decision !== "ask" && policy.decision !== "deny")
      || policy.lease_id !== ""
      || policy.delivery_allowed !== false
      || typeof policy.policy_decision_id !== "string"
      || typeof policy.policy_event_id !== "string"
    ) {
      await completeRunManifest(repoRoot, workspace, manifest, "failed");
      throw new Error("Supervisor returned an invalid outbox policy response");
    }
    await recordRunEvent(repoRoot, workspace, manifest, policy.policy_event_id);
    const item = createImOutboxItem(input, {
      decision: policy.decision as "ask" | "deny",
      policy_decision_id: policy.policy_decision_id,
      policy_event_id: policy.policy_event_id
    });
    await requireValidContract("im-outbox-item.schema.json", item);
    persistSurfaceRecord(workspaceRoot, "im-outbox", "im-outbox", item);
    await appendManagedRunEvent(
      workspaceRoot,
      workspace,
      manifest,
      "im.outbox.queued",
      `${item.delivery_status === "queued" ? "Queued" : "Blocked"} hash-only ${item.adapter} outbox item ${item.id}; delivery was not attempted.`,
      artifactRef("surface", "im-outbox", item.id)
    );
    await completeRunManifest(repoRoot, workspace, manifest, item.delivery_status === "queued" ? "blocked" : "completed");
    printJson(item);
    return;
  }
  throw new Error("surface supports browser-observe, im-inbox, and im-outbox");
}

async function runStore(options: CliOptions): Promise<void> {
  if (options.topic !== "install") {
    throw new Error("store supports install --path <signed-package.json> [--approve-permissions]");
  }
  if (!options.path) {
    throw new Error("store install requires --path <signed-package.json>");
  }
  const workspaceRoot = resolve(options.workspace);
  const workspace = await openWorkspace(workspaceRoot);
  const pkg = JSON.parse(readFileSync(resolve(workspaceRoot, options.path), "utf8")) as StorePackage;
  await requireValidContract("store-package.schema.json", pkg);
  const capsule = pkg.capsule as Capsule;
  let approvalCardId: string | null = null;
  if (capsule.permission_diff?.requires_approval) {
    if (!options.approvePermissions) {
      throw new Error("Store package permission expansion requires --approve-permissions");
    }
    const approvalCard = capsuleApprovalCard(capsule);
    await requireValidContract("approval-card.schema.json", approvalCard);
    upsertRegistryItem(workspaceRoot, "approval-cards", approvalCard);
    approvalCardId = approvalCard.id;
  }
  const install = createCapsuleInstallRecord(pkg, {
    approvePermissions: options.approvePermissions,
    approvalCardId
  });
  await requireValidContract("capsule-install.schema.json", install);
  await requireValidContract("capability-capsule.schema.json", capsule);
  upsertRegistryItem(workspaceRoot, "capsules", capsule);
  upsertRegistryItem(workspaceRoot, "capsule-installs", install);
  archiveCapsuleVersion(workspaceRoot, capsule);
  await recordGovernanceEvent(
    workspaceRoot,
    "capsule.store.installed",
    `Installed signed Capsule package ${pkg.id} into the local registry after signature, replay, sandbox, and permission-diff checks; no package code executed.`,
    artifactRef("store", "install", install.id)
  );
  printJson(install);
}

function persistSurfaceRecord(
  workspaceRoot: string,
  topic: string,
  registryName: string,
  value: Record<string, unknown> & { id: string }
): void {
  const dir = join(workspaceRoot, ".aetherion", "artifacts", "surface", sanitizePathSegment(topic));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sanitizePathSegment(value.id)}.json`), `${JSON.stringify(value, null, 2)}\n`);
  upsertRegistryItem(workspaceRoot, registryName, value);
}

function persistSecurityRecord(
  workspaceRoot: string,
  topic: string,
  registryName: string,
  value: Record<string, unknown> & { id: string }
): void {
  const dir = join(workspaceRoot, ".aetherion", "artifacts", "security", sanitizePathSegment(topic));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sanitizePathSegment(value.id)}.json`), `${JSON.stringify(value, null, 2)}\n`);
  upsertRegistryItem(workspaceRoot, registryName, value);
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
    case "dream":
      return "memory-folds";
    case "anchors":
      return "persona-anchors";
    case "persona":
      return "persona-resets";
    case "soul":
      return "soul-forks";
    case "agent":
      if (options.topic === "contract") return "agent-contracts";
      if (options.topic === "execute") return "child-results";
      return null;
    case "security":
      return null;
    case "surface":
      return null;
    case "store":
      return "capsule-installs";
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

function artifactRef(command: string, topic: string, id: string): string {
  return `artifact://${sanitizePathSegment(command)}/${sanitizePathSegment(topic)}/${sanitizePathSegment(id)}`;
}

async function recordGovernanceEvent(workspaceRoot: string, eventType: string, summary: string, payloadRef: string): Promise<string> {
  const workspace = await openWorkspace(workspaceRoot);
  const runId = `run_governance_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const manifest = await createRunManifest(repoRoot, workspace, runId, summary);
  const result = rpcResult(await callSupervisorRpc(repoRoot, {
    id: `rpc_${runId}_event`,
    method: "event.append",
    workspace_root: workspaceRoot,
    workspace_id: workspace.id,
    run_id: runId,
    event_type: eventType,
    summary,
    payload_ref: payloadRef
  }));
  if (typeof result.event_id !== "string") {
    throw new Error(`Supervisor did not append governance event ${eventType}`);
  }
  await recordRunEvent(repoRoot, workspace, manifest, result.event_id);
  await completeRunManifest(repoRoot, workspace, manifest, "completed");
  return result.event_id;
}

async function appendManagedRunEvent(
  workspaceRoot: string,
  workspace: Awaited<ReturnType<typeof openWorkspace>>,
  manifest: Awaited<ReturnType<typeof createRunManifest>>,
  eventType: string,
  summary: string,
  payloadRef: string
): Promise<string> {
  const result = rpcResult(await callSupervisorRpc(repoRoot, {
    id: `rpc_${manifest.id}_${randomUUID().slice(0, 8)}`,
    method: "event.append",
    workspace_root: workspaceRoot,
    workspace_id: workspace.id,
    run_id: manifest.id,
    event_type: eventType,
    summary,
    payload_ref: payloadRef
  }));
  if (typeof result.event_id !== "string") {
    throw new Error(`Supervisor did not append managed run event ${eventType}`);
  }
  await recordRunEvent(repoRoot, workspace, manifest, result.event_id);
  return result.event_id;
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
  npm run ether -- sleep <run_id> [--deadline <iso-date>] [--watch-file <workspace-file>]
  npm run ether -- wake <trigger_or_hibernation_id>
  npm run ether -- sleepers
  npm run ether -- dream run <run_id> --content <proposed-memory> --confidence <0..1>
  npm run ether -- dream accept <fold_id> [--approve-sensitive]
  npm run ether -- anchors propose --source-event <event> --content <text> --confidence <0..1> [--branch <name>]
  npm run ether -- persona reset <branch>
  npm run ether -- soul fork <checkpoint_id> --agent-id <new_agent_id> [--approve-sensitive]
  npm run ether -- agent contract --parent-run <run_id> --child-agent <agent_id> --budget <budget_id> --capsule <capsule_id> --path <workspace-file> --content <task>
  npm run ether -- agent execute <contract_id> [--capsule <capsule_id>] [--path <workspace-file>]
  npm run ether -- security scan --source-event <event_id> --source-kind <kind> --content <text>
  npm run ether -- security ack <signal_id>
  npm run ether -- security trial <signal_id> [--capsule <capsule_id>]
  npm run ether -- security fixture <signal_id>
  npm run ether -- surface browser-observe --path <observation-input.json> --source-event <event_id>
  npm run ether -- surface im-inbox --path <inbox-input.json>
  npm run ether -- surface im-outbox --path <outbox-input.json>
  npm run ether -- store install --path <signed-package.json> [--approve-permissions]

Commands:
  run/replay/trace       Phase 1 local kernel loop and replay
  import                 Phase 4 dry-run migration report
  memory/context         Phase 3 source-backed Memory OS surfaces
  checkpoint/branch/rehearse Phase 5 sandbox and time-travel surfaces
  capsule                Governed document-only draft/test/local-publish/rollback lifecycle
  why/counterfactual     Phase 7 causal memory report surfaces
  sleep/wake/sleepers    Phase 8 local trigger evaluation and queue-only resume
  dream/anchors/persona/soul Phase 9 governed folding, persona branches, and Soul Fork
  agent                  Phase 10 governed document-read child run and evidence
  security               Phase 11 taint denial, poisoning detection, decoy trial, and fixture
  surface                Phase 12 hash-only browser/IM ingress and approval-gated outbox queue
  store                  Phase 12 signed Capsule install into local registry without code execution
  help                   Show this help

Options:
  --workspace <path>   Workspace root. Defaults to cwd.
  --input <path>       Workspace-relative file to read. Defaults to README.md.
  --output <path>      Workspace-relative file to write. Defaults to .aetherion/SUMMARY.md.
  --summary <text>     Explicit summary text to write.
  --approve-write      Required to execute the write stage.
  --approve-sensitive  Explicitly approve sensitive fold, anchor, or history inheritance.
`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
