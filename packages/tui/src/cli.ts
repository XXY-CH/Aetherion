#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { acceptCandidateFromRegistry, acceptMemoryCandidate, assembleContextPack, blockMemoryContext, buildEpisodicTimeline, createBasicUserModel, createMemoryCandidate, createMemoryDeleteTombstone, deriveMemoryCandidatesFromEvents, isMemoryCandidate, isMemoryCard, isMemoryTombstone, rejectMemoryCandidate } from "../../memory-os/src/index.ts";
import { buildCausalEdges, buildWhyReport, counterfactualFromCheckpoint, rebuildCausalProjection, redactedSources } from "../../causal-memory/src/index.ts";
import { approveRehearsal, assertWorkspaceRelativePath, createBranch, createCheckpoint, findBranch, findCheckpoint, isBranch, isCheckpoint, isRehearsal, rehearseFileWrite, sandboxWorkspacePath, type EventCheckpoint, type LedgerBranch, type SandboxRehearsal } from "../../sandbox/src/index.ts";
import { attachCapsuleTestEvidence, createDraftCapsule, isCapsule, isPublishedCapsuleWithEvidence, proposeDocumentCapsuleDraft, publishCapsule, requireCapsule, rollbackCapsule, runDocumentSandboxTrial, type Capsule, type CapsuleDraftInput } from "../../capability-os/src/index.ts";
import { dryRunImport } from "../../migration/src/index.ts";
import { createDeadlineTrigger, createFileTrigger, createManualTrigger, createResumeRunId, evaluateWakeup, findHibernation, findWakeupTrigger, hibernateRun, isHibernationRecord, isWakeupTrigger, queueWakeup, type HibernationRecord, type WakeupTrigger } from "../../hibernation/src/index.ts";
import { acceptMemoryFold, acceptPersonaAnchor, applyPersonaReset, createPersonaBranch, defaultInheritancePolicy, findPersonaAnchor, forkSoul, isMemoryFold, isPersonaAnchor, isPersonaBranch, isPersonaState, isSoulFork, proposeMemoryFold, proposePersonaAnchor, rejectMemoryFold, rejectPersonaAnchor } from "../../soul/src/index.ts";
import { assertCapsuleAllowed, assertPathAllowed, assertRiskBudget, createAgentContract, createBudgetAccount, findBudget, isAgentContract, isAgentScore, isBudgetAccount, isResourceBudget, openCircuitBreaker, recordLeaseUse, recordPolicyDenial, recordRuntimeUsage, reserveRead, updateAgentScore, type BudgetAccount, type ChildResult, type CircuitBreaker } from "../../multiagent/src/index.ts";
import { acknowledgePoisoning, createPoisoningRegressionFixture, isPoisoningSignal, isUntrustedSource, runHoneypotTrial, scanUntrustedContent, signalFromAssessment, type UntrustedSource } from "../../security/src/index.ts";
import { createBrowserObservation, createCapsuleInstallRecord, createImInboxItem, createImOutboxItem, createTrustedStorePublisherRecord, isStoreReplayEvidenceRecord, isStoreTrustedPublisher, type BrowserObservationInput, type ImInboxInput, type ImOutboxInput, type StorePackage, type StoreReplayEvidenceRecord } from "../../surface-os/src/index.ts";
import { assemblePromptPlan, auditPromptResponse, createAgentRuntimeInvocationArtifact, type PromptPlan } from "../../orchestrator/src/index.ts";
import { agentModelRequestArtifactRef, agentModelResponseArtifactRef, agentResponseAuditArtifactRef, agentRuntimeInvocationArtifactRef, agentToolRequestProposalArtifactRef, appendEvent, approvedWritePromotionEventSequence, auditAgentRegistryRebuild, auditAgentResponseAuditEvidence, auditCapsuleRegistryRebuild, auditHibernationRegistryRebuild, auditLedgerPayloadRefs, auditMemoryRegistryRebuild, auditPromptModelArtifactEvidence, auditRegistryProvenance, auditReplayRecordRegistryRebuild, auditSandboxRegistryRebuild, auditSecurityFixtureEvidence, auditStoreRegistryRebuild, auditSurfaceRegistryRebuild, browserObservationEventSequence, callSupervisorRpc, childReadCompletedEventSequence, childReadPolicyDeniedEventSequence, childReadPostSupervisorBreakerEventSequence, childReadPreExecutionBreakerEventSequence, childReadRepeatedDenialEventSequence, completeRunManifest, completeRunManifestWithEventSequence, consentRecordArtifactRef, createAgentModelRequestArtifact, createAgentModelResponseArtifact, createAgentResponseAuditArtifact, createAgentToolRequestProposalArtifact, createBoundaryFacts, createRunManifest, createTraceReplayRecord, createWorkspace, createWriteConsentRecord, eventRecord, imOutboxEventSequence, isRegistryItem, loadRunManifest, loadWorkspaceFromRegistry, readAgentModelRequestArtifact, readAgentResponseAuditArtifact, readAgentRuntimeInvocationArtifact, readAgentToolRequestProposalArtifact, readBoundaryFactsArtifact, readEvents, readRegistry, reconstructTrace, recordRunEvent, replayRecordRunEventSequence, removeRegistryItem, resolveModelProvider, rpcResult, runLocalKernelLoop, runSupervisorKernelLoop, runAgentLoop, startAgentLoopState, securityScanBlockedEventSequence, securityScanCleanEventSequence, upsertRegistryItem, upsertRegistryItems, validateAgainstSchema, verifyEventHashChain, wakeupQueueRunEventSequence, workspaceIdForRoot, writeAgentModelRequestArtifact, writeAgentModelResponseArtifact, writeAgentResponseAuditArtifact, writeAgentRuntimeInvocationArtifact, writeAgentToolRequestProposalArtifact, writeBoundaryFactsArtifact, writeWorkspaceRegistry, type BoundaryFacts, type EventRecord, type LoopEvent, type ModelMessage, type ReplayRecord, type RunManifest, type ToolCallProposal } from "../../harness-core/src/index.ts";
import { createV1ToolRegistry } from "../../harness-core/src/tool-registry.ts";
import { notify } from "../../harness-core/src/notify.ts";
import { scanSkills, formatSkillsForPrompt } from "../../harness-core/src/skills.ts";
import type { AgentRuntimeInvocationArtifact } from "../../harness-core/src/agent-runtime.ts";

type CliOptions = {
  command: string;
  topic?: string;
  target?: string;
  workspace: string;
  input: string;
  inputProvided: boolean;
  output: string;
  approveWrite: boolean;
  summary?: string;
  from?: "openclaw" | "hermes";
  path?: string;
  dryRun: boolean;
  change?: string;
  content?: string;
  sourceEvent?: string;
  context?: string;
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
  supervisor?: "typescript-seed" | "stdio" | "socket";
  socketPath?: string;
  socketAuthToken?: string;
  remoteEvidence?: string;
  idempotencyKey?: string;
  checkWakeups: boolean;
  printOutput: boolean;
  quiet: boolean;
  modelProvider?: ModelProviderName;
  modelRef?: string;
  tools: boolean;
  outputFormat?: "json" | "jsonl";
  autoApprove: boolean;
  interactive: boolean;
};

const repoRoot = resolve(import.meta.dirname, "../../..");
let activeOptions: CliOptions | undefined;
type ModelProviderName = "stub" | "openai_responses" | "openai_chat_completions" | "anthropic" | "gemini";

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
    throw new Error(`Unknown command ${options.command}. Run "ether help" or "npm run ether -- help".`);
  }

  if (options.supervisor === "typescript-seed" && process.env.AETHERION_ALLOW_TYPESCRIPT_SEED !== "1") {
    throw new Error("typescript-seed is test-only; set AETHERION_ALLOW_TYPESCRIPT_SEED=1 explicitly");
  }
  if (options.supervisor === "socket" && !options.socketPath) {
    throw new Error("--supervisor socket requires --socket-path <socket>");
  }
  const runId = `run_${Date.now()}_${randomUUID().slice(0, 8)}`;
  await preflightSocketSupervisorBinding(options, runId);
  const rawIdempotencyKey = validatedRunIdempotencyKey(options, runId);
  const rateLimitReservation = await reserveLocalIngressRateLimit(options, runId);
  const ingressReservation = await reserveLocalIngressIdempotency(options, runId, rawIdempotencyKey, rateLimitReservation);
  if (ingressReservation.kind === "cached_replay") {
    await printCachedIdempotencyReplay(ingressReservation.reservation, ingressReservation.completion, rateLimitReservation, resolve(options.workspace));
    return;
  }
  const result = options.supervisor === "typescript-seed"
    ? await runLocalKernelLoop({
        repoRoot,
        workspaceRoot: options.workspace,
        runId,
        inputPath: options.input,
        outputPath: options.output,
        approveWrite: options.approveWrite,
        summaryText: options.summary
      })
    : await runSupervisorKernelLoop({
        repoRoot,
        workspaceRoot: options.workspace,
        runId,
        inputPath: options.input,
        outputPath: options.output,
        approveWrite: options.approveWrite,
        summaryText: options.summary,
        socketPath: options.supervisor === "socket" ? options.socketPath : undefined,
        socketAuthToken: options.supervisor === "socket" ? options.socketAuthToken : undefined
      });

  const completion = await writeLocalIngressIdempotencyCompletion(options, ingressReservation.reservation, result);
  await printRunResult(result, ingressReservation.reservation, rateLimitReservation, completion);
}

function parseArgs(args: string[]): CliOptions {
  const firstArg = args[0];
  const hasExplicitCommand = firstArg !== undefined && !firstArg.startsWith("--");
  const isHelpFlag = firstArg === "--help" || firstArg === "-h";
  const command = isHelpFlag ? "help" : hasExplicitCommand ? firstArg : "setup";
  const optionStartIndex = isHelpFlag ? 1 : hasExplicitCommand ? 1 : 0;
  const positional = collectPositionals(args.slice(optionStartIndex));
  const options: CliOptions = {
    command,
    topic: positional[0],
    target: positional[1],
    workspace: process.cwd(),
    input: "README.md",
    inputProvided: false,
    output: ".aetherion/SUMMARY.md",
    approveWrite: false,
    dryRun: false,
    replayRuns: [],
    approvePermissions: false,
    approveSensitive: false,
    checkWakeups: false,
    quiet: false,
    printOutput: false,
    tools: false,
    autoApprove: false,
    interactive: false
  };

  for (let index = optionStartIndex; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if ((command === "replay" || command === "trace") && index === optionStartIndex && !arg.startsWith("--")) {
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
        options.inputProvided = true;
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
      case "--context":
        options.context = requireValue(arg, next);
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
        if (supervisor !== "stdio" && supervisor !== "socket" && supervisor !== "typescript-seed") {
          throw new Error("--supervisor must be stdio, socket, or typescript-seed");
        }
        options.supervisor = supervisor;
        index += 1;
        break;
      }
      case "--socket-path":
        options.socketPath = requireValue(arg, next);
        index += 1;
        break;
      case "--socket-auth-token":
        options.socketAuthToken = requireValue(arg, next);
        index += 1;
        break;
      case "--remote-evidence":
        options.remoteEvidence = requireValue(arg, next);
        index += 1;
        break;
      case "--idempotency-key":
        options.idempotencyKey = requireValue(arg, next);
        index += 1;
        break;
      case "--check-wakeups":
        options.checkWakeups = true;
        break;
      case "--print-output":
        options.printOutput = true;
        break;
      case "--model-provider": {
        const provider = parseModelProviderName(requireValue(arg, next));
        options.modelProvider = provider;
        index += 1;
        break;
      }
      case "--model":
        options.modelRef = requireValue(arg, next);
        index += 1;
        break;
      case "--tools":
        options.tools = true;
        break;
      case "--auto-approve":
        options.autoApprove = true;
        break;
      case "--quiet":
        options.quiet = true;
        break;
      case "--interactive":
        options.interactive = true;
        break;
      case "--output-format": {
        const value = requireValue(arg, next);
        if (value !== "json" && value !== "jsonl") {
          throw new Error("--output-format must be 'json' or 'jsonl'");
        }
        options.outputFormat = value;
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
  const valueFlags = new Set(["--workspace", "--input", "--output", "--summary", "--from", "--path", "--change", "--content", "--source-event", "--confidence", "--from-run", "--capsule", "--replay-run", "--version", "--deadline", "--watch-file", "--branch", "--kind", "--ttl", "--sensitivity", "--parent-run", "--child-agent", "--budget", "--agent-id", "--supervisor", "--socket-path", "--socket-auth-token", "--remote-evidence", "--idempotency-key", "--model-provider", "--model", "--output-format"]);
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
    case "setup":
      await runSetup(options);
      return true;
    case "import":
      await runImport(options);
      return true;
    case "memory":
      await runMemory(options);
      return true;
    case "context":
      await runContext(options);
      return true;
    case "prompt":
      await runPrompt(options);
      return true;
    case "model":
      await runModel(options);
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
    case "ingress":
      await runIngress(options);
      return true;
    case "surface":
      await runSurface(options);
      return true;
    case "store":
      await runStore(options);
      return true;
    case "audit":
      await runAudit(options);
      return true;
    case "doctor":
      await runDoctor(options);
      return true;
    case "onboarding":
      await runOnboarding(options);
      return true;
    case "release":
      await runRelease(options);
      return true;
    case "supervisor":
      await runSupervisorCommand(options);
      return true;
    case "boundary":
      await runBoundary(options);
      return true;
    case "daemon":
      await runDaemon(options);
      return true;
    default:
      return false;
  }
}

async function runSetup(options: CliOptions): Promise<void> {
  if (options.topic) {
    throw new Error("setup does not take a topic; use onboarding check for the JSON preflight report.");
  }
  const workspaceRoot = resolve(options.workspace);
  const report = await buildOnboardingPreflightReport(workspaceRoot);
  const interactive = shouldPromptSetup();
  const config = setupTuiConfig(report, interactive, options);
  const input = `${JSON.stringify(config)}\n`;
  const goArgs = ["run", "./packages/tui-go/cmd/ether-setup"];

  if (interactive) {
    const configFile = writeSetupConfigFile(input);
    try {
      const result = spawnSync("go", [...goArgs, configFile], {
        cwd: repoRoot,
        stdio: "inherit",
        env: {
          ...process.env,
          AETHERION_SETUP_NONINTERACTIVE: "0"
        }
      });
      if (result.error) {
        throw result.error;
      }
      if (result.status !== 0) {
        throw new Error(`Go Bubble Tea setup exited with status ${result.status ?? "unknown"}`);
      }
    } finally {
      rmSync(dirname(configFile), { recursive: true, force: true });
    }
    return;
  }

  const result = spawnSync("go", goArgs, {
    cwd: repoRoot,
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      AETHERION_SETUP_NONINTERACTIVE: "1"
    }
  });
  if (result.error) {
    throw result.error;
  }
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`Go Bubble Tea setup exited with status ${result.status ?? "unknown"}`);
  }
}

function writeSetupConfigFile(input: string): string {
  const dir = mkdtempSync(join(tmpdir(), "aetherion-setup-"));
  const file = join(dir, "config.json");
  writeFileSync(file, input, { encoding: "utf8", mode: 0o600 });
  return file;
}

function setupTuiConfig(report: OnboardingPreflightReport, interactive = shouldPromptSetup(), options?: Pick<CliOptions, "modelProvider" | "modelRef">): Record<string, unknown> {
  const workspaceRoot = report.workspace_root;
  const modelStatus = buildModelStatus(options ?? {});
  return {
    Snapshot: report,
    NonInteractive: !interactive,
    DefaultEntry: "ether",
    OnboardingCommand: setupCommand("onboarding check --workspace", workspaceRoot),
    DoctorCommand: setupCommand("doctor --workspace", workspaceRoot),
    SecurityCommand: setupCommand("security audit --workspace", workspaceRoot),
    ReleaseCommand: setupCommand("release evidence --workspace", workspaceRoot),
    RunCommand: `${setupCommand("run --workspace", workspaceRoot)} --input README.md --output .aetherion/SUMMARY.md --approve-write`,
    LLMReadLoopCommand: `${setupCommand("model chat --workspace", workspaceRoot)} --content <task> --model-provider ${modelStatus.provider_name} --model ${modelStatus.model_ref ?? "<model>"}`,
    ModelStatus: modelStatus,
    DirectEntry: `ether --workspace ${shellQuote(workspaceRoot)}`,
    PackageEntry: `npm run ether -- --workspace ${shellQuote(workspaceRoot)}`
  };
}

function setupReadinessCommands(workspaceRoot: string): string[] {
  return [
    `onboarding_command=${setupCommand("onboarding check --workspace", workspaceRoot)}`,
    `doctor_command=${setupCommand("doctor --workspace", workspaceRoot)}`,
    `security_audit_command=${setupCommand("security audit --workspace", workspaceRoot)}`,
    `release_evidence_command=${setupCommand("release evidence --workspace", workspaceRoot)}`
  ];
}

function setupCommand(prefix: string, workspaceRoot: string): string {
  return `npm run ether -- ${prefix} ${shellQuote(workspaceRoot)}`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function shouldPromptSetup(): boolean {
  return process.stdin.isTTY === true
    && process.stdout.isTTY === true
    && process.env.CI !== "true"
    && process.env.AETHERION_SETUP_NONINTERACTIVE !== "1";
}

async function runSupervisorCommand(options: CliOptions): Promise<void> {
  if (!options.topic || !["status", "preflight", "start", "stop", "recover-stale-lock"].includes(options.topic)) {
    throw new Error("supervisor supports status, preflight, start, stop, and recover-stale-lock");
  }
  const workspaceRoot = resolve(options.workspace);
  const result = rpcResult(await callSupervisorRpc(repoRoot, {
    id: `rpc_supervisor_status_${Date.now()}`,
    method: "supervisor.status",
    workspace_root: workspaceRoot,
    workspace_id: workspaceIdForRoot(workspaceRoot),
    run_id: "run_supervisor_status"
  }, options.socketPath ? {
    socketPath: options.socketPath,
    authToken: options.socketAuthToken
  } : undefined));
  if (options.topic === "start" || options.topic === "stop" || options.topic === "recover-stale-lock") {
    await printUnsupportedSupervisorLifecycleCommand(options.topic, workspaceRoot, result);
    process.exitCode = 2;
    return;
  }
  if (options.topic === "preflight") {
    printKeyValueRecord(supervisorLifecyclePreflight(result), [
      "workspace_id",
      "lifecycle_state",
      "lifecycle_summary",
      "operator_next_step",
      "transport",
      "daemon_running",
      "runtime_lock_present",
      "runtime_lock_workspace_match",
      "runtime_lock_process_status",
      "runtime_lock_stale",
      "start_supported",
      "stop_supported",
      "repair_supported",
      "mutates_ledger",
      "issues_lease"
    ]);
    return;
  }
  printKeyValueRecord(result, [
    "workspace_id",
    "authority",
    "transport",
    "daemon_running",
    "ledger_chain_valid",
    "ledger_events",
    "ledger_head_event_id",
    "ledger_head_event_hash",
    "runtime_dir",
    "ledger_path",
    "registry_path",
    "runtime_lock_present",
    "runtime_lock_path",
    "runtime_lock_pid",
    "runtime_lock_transport",
    "runtime_lock_workspace_id",
    "runtime_lock_socket_path",
    "runtime_lock_workspace_match",
    "runtime_lock_process_status",
    "runtime_lock_stale",
    "runtime_lock_parse_error"
  ]);
}

type SupervisorLifecycleCommandReport = {
  id: string;
  schema_version: "aetherion-supervisor-lifecycle-command-v1";
  requested_command: "supervisor start" | "supervisor stop" | "supervisor recover-stale-lock";
  status: "unsupported_fail_closed";
  command_surface_supported: true;
  implemented: false;
  fail_closed: true;
  reason_code: "production_daemon_lifecycle_unimplemented" | "stale_lock_repair_unimplemented";
  workspace: {
    workspace_id: string;
    workspace_root_hash: string;
    workspace_id_derived_from_root: true;
  };
  status_observation: {
    performed: true;
    source: "supervisor.status";
    may_initialize_workspace_registry: true;
    mutates_ledger: false;
    writes_artifacts: false;
    repairs_state: false;
    runtime_lock_present: boolean;
    runtime_lock_stale: boolean;
    daemon_running: false;
  };
  effects: {
    starts_daemon: false;
    stops_daemon: false;
    kills_process: false;
    repairs_stale_lock: false;
    mutates_ledger: false;
    writes_artifacts: false;
    issues_session: false;
    issues_lease: false;
    resolves_vault_secret: false;
  };
  authority: {
    can_authorize_actions: false;
    can_grant_tool_access: false;
    can_override_policy: false;
    local_supervisor_required_for_actions: true;
    tool_policy_proxy_required_for_actions: true;
  };
  operator_next_step: string;
};

async function printUnsupportedSupervisorLifecycleCommand(
  topic: "start" | "stop" | "recover-stale-lock",
  workspaceRoot: string,
  status: Record<string, unknown>
): Promise<void> {
  const report = supervisorUnsupportedLifecycleCommandReport(topic, workspaceRoot, status);
  const validation = await validateAgainstSchema(repoRoot, "supervisor-lifecycle-command.schema.json", report);
  if (!validation.valid) {
    throw new Error(`supervisor-lifecycle-command.schema.json validation failed: ${validation.errors.join("; ")}`);
  }
  printKeyValueRecord(flattenSupervisorLifecycleCommandReport(report), [
    "id",
    "schema_version",
    "requested_command",
    "status",
    "command_surface_supported",
    "implemented",
    "fail_closed",
    "reason_code",
    "workspace_id",
    "workspace_root_hash",
    "workspace_id_derived_from_root",
    "status_observation_performed",
    "status_observation_source",
    "status_may_initialize_workspace_registry",
    "status_mutates_ledger",
    "status_writes_artifacts",
    "status_repairs_state",
    "daemon_running",
    "runtime_lock_present",
    "runtime_lock_stale",
    "starts_daemon",
    "stops_daemon",
    "kills_process",
    "repairs_stale_lock",
    "mutates_ledger",
    "writes_artifacts",
    "issues_session",
    "issues_lease",
    "resolves_vault_secret",
    "can_authorize_actions",
    "can_grant_tool_access",
    "can_override_policy",
    "local_supervisor_required_for_actions",
    "tool_policy_proxy_required_for_actions",
    "operator_next_step"
  ]);
}

function supervisorUnsupportedLifecycleCommandReport(
  topic: "start" | "stop" | "recover-stale-lock",
  workspaceRoot: string,
  status: Record<string, unknown>
): SupervisorLifecycleCommandReport {
  const requestedCommand = `supervisor ${topic}` as SupervisorLifecycleCommandReport["requested_command"];
  const reasonCode = topic === "recover-stale-lock"
    ? "stale_lock_repair_unimplemented"
    : "production_daemon_lifecycle_unimplemented";
  return {
    id: `supervisor_lifecycle_command_${topic.replace(/-/g, "_")}_unsupported_${hashDigest(sha256Hex(workspaceRoot)).slice(0, 16)}`,
    schema_version: "aetherion-supervisor-lifecycle-command-v1",
    requested_command: requestedCommand,
    status: "unsupported_fail_closed",
    command_surface_supported: true,
    implemented: false,
    fail_closed: true,
    reason_code: reasonCode,
    workspace: {
      workspace_id: workspaceIdForRoot(workspaceRoot),
      workspace_root_hash: sha256Hex(workspaceRoot),
      workspace_id_derived_from_root: true
    },
    status_observation: {
      performed: true,
      source: "supervisor.status",
      may_initialize_workspace_registry: true,
      mutates_ledger: false,
      writes_artifacts: false,
      repairs_state: false,
      runtime_lock_present: status.runtime_lock_present === true,
      runtime_lock_stale: status.runtime_lock_stale === true,
      daemon_running: false
    },
    effects: {
      starts_daemon: false,
      stops_daemon: false,
      kills_process: false,
      repairs_stale_lock: false,
      mutates_ledger: false,
      writes_artifacts: false,
      issues_session: false,
      issues_lease: false,
      resolves_vault_secret: false
    },
    authority: {
      can_authorize_actions: false,
      can_grant_tool_access: false,
      can_override_policy: false,
      local_supervisor_required_for_actions: true,
      tool_policy_proxy_required_for_actions: true
    },
    operator_next_step: supervisorUnsupportedLifecycleNextStep(topic)
  };
}

function flattenSupervisorLifecycleCommandReport(report: SupervisorLifecycleCommandReport): Record<string, unknown> {
  return {
    id: report.id,
    schema_version: report.schema_version,
    requested_command: report.requested_command,
    status: report.status,
    command_surface_supported: report.command_surface_supported,
    implemented: report.implemented,
    fail_closed: report.fail_closed,
    reason_code: report.reason_code,
    workspace_id: report.workspace.workspace_id,
    workspace_root_hash: report.workspace.workspace_root_hash,
    workspace_id_derived_from_root: report.workspace.workspace_id_derived_from_root,
    status_observation_performed: report.status_observation.performed,
    status_observation_source: report.status_observation.source,
    status_may_initialize_workspace_registry: report.status_observation.may_initialize_workspace_registry,
    status_mutates_ledger: report.status_observation.mutates_ledger,
    status_writes_artifacts: report.status_observation.writes_artifacts,
    status_repairs_state: report.status_observation.repairs_state,
    daemon_running: report.status_observation.daemon_running,
    runtime_lock_present: report.status_observation.runtime_lock_present,
    runtime_lock_stale: report.status_observation.runtime_lock_stale,
    starts_daemon: report.effects.starts_daemon,
    stops_daemon: report.effects.stops_daemon,
    kills_process: report.effects.kills_process,
    repairs_stale_lock: report.effects.repairs_stale_lock,
    mutates_ledger: report.effects.mutates_ledger,
    writes_artifacts: report.effects.writes_artifacts,
    issues_session: report.effects.issues_session,
    issues_lease: report.effects.issues_lease,
    resolves_vault_secret: report.effects.resolves_vault_secret,
    can_authorize_actions: report.authority.can_authorize_actions,
    can_grant_tool_access: report.authority.can_grant_tool_access,
    can_override_policy: report.authority.can_override_policy,
    local_supervisor_required_for_actions: report.authority.local_supervisor_required_for_actions,
    tool_policy_proxy_required_for_actions: report.authority.tool_policy_proxy_required_for_actions,
    operator_next_step: report.operator_next_step
  };
}

function supervisorUnsupportedLifecycleNextStep(topic: "start" | "stop" | "recover-stale-lock"): string {
  if (topic === "recover-stale-lock") {
    return "Use supervisor status or supervisor preflight for read-only evidence; automatic stale-lock repair is not implemented.";
  }
  return "Use supervisor status or supervisor preflight for read-only evidence; production daemon lifecycle commands are not implemented.";
}

function supervisorLifecyclePreflight(status: Record<string, unknown>): Record<string, unknown> {
  const lockPresent = status.runtime_lock_present === true;
  const lockMatchesWorkspace = status.runtime_lock_workspace_match === true;
  const lockStale = status.runtime_lock_stale === true;
  const processStatus = stringField(status, "runtime_lock_process_status");
  const parseError = stringField(status, "runtime_lock_parse_error");
  const lockTransport = stringField(status, "runtime_lock_transport");
  let lifecycleState = "not_running";
  let summary = "No foreground supervisor runtime lock is present for this workspace.";
  let nextStep = "Use a foreground supervisor socket when needed; production daemon start is not implemented.";

  if (lockPresent && parseError) {
    lifecycleState = "runtime_lock_invalid";
    summary = "A supervisor runtime lock exists but cannot be parsed as valid preflight evidence.";
    nextStep = "Inspect the runtime lock manually; automatic lock repair is not implemented.";
  } else if (lockPresent && !lockMatchesWorkspace) {
    lifecycleState = "runtime_lock_workspace_mismatch";
    summary = "A supervisor runtime lock exists but does not match this workspace.";
    nextStep = "Do not use this lock as authority; automatic lock repair is not implemented.";
  } else if (lockPresent && (lockStale || processStatus === "missing")) {
    lifecycleState = "stale_runtime_lock";
    summary = "A supervisor runtime lock points at a missing owner process.";
    nextStep = "Treat the lock as operator evidence only; automatic lock repair is not implemented.";
  } else if (lockPresent && processStatus === "unknown") {
    lifecycleState = "runtime_lock_owner_unknown";
    summary = "A supervisor runtime lock exists but owner process liveness is unknown on this platform.";
    nextStep = "Use an explicit foreground socket check before relying on this runtime.";
  } else if (lockPresent && processStatus === "running" && lockTransport === "unix-socket") {
    lifecycleState = "foreground_socket_running";
    summary = "A foreground Unix socket supervisor appears to own this workspace lock.";
    nextStep = "Use the bound foreground socket for this workspace; production daemon lifecycle remains unimplemented.";
  } else if (lockPresent) {
    lifecycleState = "runtime_lock_unclassified";
    summary = "A supervisor runtime lock exists but does not match a known lifecycle state.";
    nextStep = "Inspect supervisor status before requesting runtime work.";
  }

  return {
    workspace_id: status.workspace_id,
    lifecycle_state: lifecycleState,
    lifecycle_summary: summary,
    operator_next_step: nextStep,
    transport: status.transport,
    daemon_running: status.daemon_running,
    runtime_lock_present: status.runtime_lock_present,
    runtime_lock_workspace_match: status.runtime_lock_workspace_match,
    runtime_lock_process_status: status.runtime_lock_process_status,
    runtime_lock_stale: status.runtime_lock_stale,
    start_supported: false,
    stop_supported: false,
    repair_supported: false,
    mutates_ledger: false,
    issues_lease: false
  };
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

async function runAudit(options: CliOptions): Promise<void> {
  const topic = options.topic;
  if (!topic || !["registries", "replay-records", "memory-records", "capsule-records", "hibernation-records", "sandbox-records", "store-records", "surface-records", "child-records", "payload-refs", "response-audits", "prompt-model-artifacts", "security-fixtures"].includes(topic)) {
    throw new Error("audit requires topic registries, replay-records, memory-records, capsule-records, hibernation-records, sandbox-records, store-records, surface-records, child-records, payload-refs, response-audits, prompt-model-artifacts, or security-fixtures");
  }
  const workspaceRoot = resolve(options.workspace);
  const verified = await readVerifiedLedgerForReadOnlyCommand(workspaceRoot, `audit ${topic}`);
  if (options.topic === "registries") {
    const audit = auditRegistryProvenance(workspaceRoot, verified.events);
    printRawJson(audit);
    return;
  }
  if (options.topic === "replay-records") {
    printRawJson(auditReplayRecordRegistryRebuild(workspaceRoot));
    return;
  }
  if (options.topic === "memory-records") {
    printRawJson(auditMemoryRegistryRebuild(workspaceRoot, verified.events));
    return;
  }
  if (options.topic === "capsule-records") {
    printRawJson(auditCapsuleRegistryRebuild(workspaceRoot, verified.events));
    return;
  }
  if (options.topic === "hibernation-records") {
    printRawJson(auditHibernationRegistryRebuild(workspaceRoot));
    return;
  }
  if (options.topic === "sandbox-records") {
    printRawJson(auditSandboxRegistryRebuild(workspaceRoot));
    return;
  }
  if (options.topic === "store-records") {
    printRawJson(auditStoreRegistryRebuild(workspaceRoot, verified.events));
    return;
  }
  if (options.topic === "surface-records") {
    printRawJson(auditSurfaceRegistryRebuild(workspaceRoot, verified.events));
    return;
  }
  if (options.topic === "child-records") {
    printRawJson(auditAgentRegistryRebuild(workspaceRoot, verified.events));
    return;
  }
  if (options.topic === "payload-refs") {
    const audit = await auditLedgerPayloadRefs(repoRoot, workspaceRoot, verified.events);
    printRawJson(audit);
    return;
  }
  if (options.topic === "response-audits") {
    const audit = await auditAgentResponseAuditEvidence(repoRoot, workspaceRoot, verified.events);
    printRawJson(audit);
    return;
  }
  if (options.topic === "prompt-model-artifacts") {
    const audit = await auditPromptModelArtifactEvidence(repoRoot, workspaceRoot, verified.events);
    printRawJson(audit);
    return;
  }
  if (options.topic === "security-fixtures") {
    const audit = await auditSecurityFixtureEvidence(repoRoot, workspaceRoot, verified.events);
    printRawJson(audit);
    return;
  }
}

type DoctorCheckStatus = "pass" | "warn" | "fail" | "not_applicable";

type DoctorCheck = {
  id: string;
  status: DoctorCheckStatus;
  severity: "info" | "warning" | "error";
  summary: string;
  evidence: string[];
  remediation: string | null;
};

type MarkdownRelativeLinkEvidence = {
  markdownFilesChecked: number;
  relativeLinksChecked: number;
  unresolvedRelativeLinks: string[];
};

type DoctorReport = {
  id: "aetherion_doctor_report";
  generated_at: string;
  repo_root: string;
  workspace_root: string;
  status: "ready" | "degraded" | "blocked";
  check_status: "pass" | "warn" | "fail";
  scope: ReadOnlyCommandScope;
  summary: {
    pass: number;
    warn: number;
    fail: number;
    not_applicable: number;
  };
  checks: DoctorCheck[];
};

type ReadOnlyCommandScope = {
  read_only: true;
  mutates_ledger: false;
  mutates_registries: false;
  writes_artifacts: false;
  calls_model_provider: false;
  issues_lease: false;
  repairs_state: false;
};

type OnboardingPreflightReport = {
  id: "aetherion_onboarding_preflight_report";
  generated_at: string;
  repo_root: string;
  workspace_root: string;
  status: "ready" | "degraded" | "blocked";
  installation_kind: "from_source";
  scope: ReadOnlyCommandScope & {
    installs_dependencies: false;
    runs_verification_suite: false;
    starts_daemon: false;
    opens_browser: false;
    writes_workspace: false;
    checks_remote_ci: false;
  };
  summary: {
    pass: number;
    warn: number;
    fail: number;
    not_applicable: number;
  };
  readiness_layers: {
    toolchain_ready: DoctorReport["status"];
    repo_ready: DoctorReport["status"];
    workspace_runtime_state: "not_initialized" | "initialized" | "invalid";
    next_steps_ready: boolean;
  };
  v1_core_profile: V1CoreProfile;
  checks: DoctorCheck[];
  next_steps: string[];
  deferred_surfaces: string[];
  source_documents: Array<{ path: string; role: string }>;
};

async function runOnboarding(options: CliOptions): Promise<void> {
  if (options.topic !== "check") {
    throw new Error("onboarding supports check");
  }
  const workspaceRoot = resolve(options.workspace);
  const report = await buildOnboardingPreflightReport(workspaceRoot);
  if (report.status === "blocked") {
    process.exitCode = 1;
  }
  printRawJson(report);
}

async function buildOnboardingPreflightReport(workspaceRoot: string): Promise<OnboardingPreflightReport> {
  const repoChecks = repoDoctorChecks();
  const repoCheckById = new Map(repoChecks.map((checkItem) => [checkItem.id, checkItem]));
  const workspaceChecks = await workspaceDoctorChecks(workspaceRoot);
  const checks: DoctorCheck[] = [
    checkWorkspaceTarget(workspaceRoot),
    repoCheckById.get("node_runtime_version") ?? check(
      "node_runtime_version",
      "fail",
      "error",
      "Node.js runtime check could not be built.",
      [],
      "Run Ether with Node.js 24.9.0 or newer."
    ),
    commandVersionCheck("npm_available", "npm", ["--version"], "npm is available for lockfile install and audit commands.", "Install npm with Node.js 24.9.0 or newer."),
    commandVersionCheck("git_available", "git", ["--version"], "git is available for source checkout and evidence snapshots.", "Install git before using from-source onboarding."),
    commandVersionCheck("go_available", "go", ["version"], "Go is available for the default Bubble Tea/Bubbles operator TUI.", "Install Go 1.25.x before using the default Ether setup console."),
    commandVersionCheck("rustc_available", "rustc", ["--version"], "rustc is available for Rust supervisor builds and checks.", "Install the Rust toolchain before running supervisor tests."),
    commandVersionCheck("cargo_available", "cargo", ["--version"], "cargo is available for Rust supervisor tests, clippy, and audit commands.", "Install Cargo with the Rust toolchain."),
    commandVersionCheck("cargo_audit_available", "cargo", ["audit", "--version"], "cargo-audit is available for the full dependency-audit gate.", "Install cargo-audit with: cargo install cargo-audit --locked --version 0.22.1", "warn"),
    repoCheckById.get("package_metadata") ?? missingRepoCheck("package_metadata"),
    repoCheckById.get("package_scripts") ?? missingRepoCheck("package_scripts"),
    repoCheckById.get("dependency_lockfiles") ?? missingRepoCheck("dependency_lockfiles"),
    repoCheckById.get("ci_workflow_gate") ?? missingRepoCheck("ci_workflow_gate"),
    repoCheckById.get("governance_files") ?? missingRepoCheck("governance_files"),
    repoCheckById.get("bilingual_main_docs") ?? missingRepoCheck("bilingual_main_docs"),
    repoCheckById.get("runtime_artifact_ignore_rules") ?? missingRepoCheck("runtime_artifact_ignore_rules"),
    repoCheckById.get("schema_example_manifest") ?? missingRepoCheck("schema_example_manifest"),
    repoCheckById.get("local_ingress_readiness_contract") ?? missingRepoCheck("local_ingress_readiness_contract"),
    repoCheckById.get("model_provider_readiness_contract") ?? missingRepoCheck("model_provider_readiness_contract"),
    repoCheckById.get("vault_policy_binding_contract") ?? missingRepoCheck("vault_policy_binding_contract"),
    repoCheckById.get("supervisor_lifecycle_readiness_contract") ?? missingRepoCheck("supervisor_lifecycle_readiness_contract"),
    repoCheckById.get("supervisor_socket_auth_boundary_contract") ?? missingRepoCheck("supervisor_socket_auth_boundary_contract"),
    repoCheckById.get("ledger_integrity_extension_readiness_contract") ?? missingRepoCheck("ledger_integrity_extension_readiness_contract"),
    repoCheckById.get("adapter_gate_readiness_contract") ?? missingRepoCheck("adapter_gate_readiness_contract"),
    repoCheckById.get("vault_reference_contract") ?? missingRepoCheck("vault_reference_contract"),
    ...workspaceChecks,
    onboardingDocsCheck()
  ];
  const summary = {
    pass: checks.filter((checkItem) => checkItem.status === "pass").length,
    warn: checks.filter((checkItem) => checkItem.status === "warn").length,
    fail: checks.filter((checkItem) => checkItem.status === "fail").length,
    not_applicable: checks.filter((checkItem) => checkItem.status === "not_applicable").length
  };
  const status = summary.fail > 0 ? "blocked" : summary.warn > 0 ? "degraded" : "ready";
  const toolchainChecks = checks.filter((checkItem) => [
    "node_runtime_version",
    "npm_available",
    "git_available",
    "go_available",
    "rustc_available",
    "cargo_available",
    "cargo_audit_available"
  ].includes(checkItem.id));
  const repoLayerChecks = checks.filter((checkItem) => [
    "package_metadata",
    "package_scripts",
    "dependency_lockfiles",
    "ci_workflow_gate",
    "governance_files",
    "bilingual_main_docs",
    "runtime_artifact_ignore_rules",
    "schema_example_manifest",
    "local_ingress_readiness_contract",
    "model_provider_readiness_contract",
    "vault_policy_binding_contract",
    "supervisor_lifecycle_readiness_contract",
    "supervisor_socket_auth_boundary_contract",
    "ledger_integrity_extension_readiness_contract",
    "adapter_gate_readiness_contract",
    "vault_reference_contract",
    "from_source_onboarding_docs"
  ].includes(checkItem.id));
  const workspaceLayer = onboardingWorkspaceRuntimeState(workspaceChecks);
  return {
    id: "aetherion_onboarding_preflight_report",
    generated_at: new Date().toISOString(),
    repo_root: repoRoot,
    workspace_root: workspaceRoot,
    status,
    installation_kind: "from_source",
    scope: {
      ...readOnlyCommandScope(),
      installs_dependencies: false,
      runs_verification_suite: false,
      starts_daemon: false,
      opens_browser: false,
      writes_workspace: false,
      checks_remote_ci: false
    },
    summary,
    readiness_layers: {
      toolchain_ready: layerStatus(toolchainChecks),
      repo_ready: layerStatus(repoLayerChecks),
      workspace_runtime_state: workspaceLayer,
      next_steps_ready: status !== "blocked"
    },
    v1_core_profile: buildV1CoreProfile(),
    checks,
    next_steps: [
      "npm ci --ignore-scripts",
      "npm audit --audit-level=high --json",
      "npm test",
      "npm run test:go-tui",
      "cargo audit",
      "cargo test --locked",
      "cargo clippy --all-targets --all-features --locked -- -D warnings",
      "cargo fmt --check",
      "git diff --check",
      "npm run ether -- doctor --workspace .",
      "npm run ether -- security audit --workspace .",
      "npm run ether -- release evidence --workspace ."
    ],
    deferred_surfaces: [
      "installer/updater automation",
      "release packaging",
      "artifact signing",
      "public docs deployment",
      "daemon lifecycle start/stop/repair commands",
      "GUI, browser automation, IM delivery, MCP/OAuth connectors, cloud workers, and package-code execution"
    ],
    source_documents: [
      { path: "README.md", role: "from-source verification commands and current scope" },
      { path: "CONTRIBUTING.md", role: "developer setup and contribution workflow" },
      { path: "docs/06-roadmap.md", role: "V1 TUI-first scope and deferred product surfaces" },
      { path: "docs/14-runtime-loop-plan.md", role: "production-hardening gap tracker" }
    ]
  };
}

async function runDoctor(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  const report = await buildDoctorReport(workspaceRoot);
  if (report.status === "blocked") {
    process.exitCode = 1;
  }
  printRawJson(report);
}

async function buildDoctorReport(workspaceRoot: string): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [
    ...repoDoctorChecks(),
    ...(await workspaceDoctorChecks(workspaceRoot))
  ];
  const checkStatus = checks.some((check) => check.status === "fail")
    ? "fail"
    : checks.some((check) => check.status === "warn")
      ? "warn"
      : "pass";
  const operatorStatus = checkStatus === "fail"
    ? "blocked"
    : checkStatus === "warn"
      ? "degraded"
      : "ready";
  return {
    id: "aetherion_doctor_report",
    generated_at: new Date().toISOString(),
    repo_root: repoRoot,
    workspace_root: workspaceRoot,
    status: operatorStatus,
    check_status: checkStatus,
    scope: {
      read_only: true,
      mutates_ledger: false,
      mutates_registries: false,
      writes_artifacts: false,
      calls_model_provider: false,
      issues_lease: false,
      repairs_state: false
    },
    summary: {
      pass: checks.filter((check) => check.status === "pass").length,
      warn: checks.filter((check) => check.status === "warn").length,
      fail: checks.filter((check) => check.status === "fail").length,
      not_applicable: checks.filter((check) => check.status === "not_applicable").length
    },
    checks
  };
}

type GitReleaseEvidence = {
  is_git_repo: boolean;
  branch: string | null;
  head: string | null;
  head_short: string | null;
  dirty: boolean;
  changed_file_count: number;
  tracked_change_count: number;
  untracked_file_count: number;
  changed_files: string[];
};

type RemoteCiWorkflowRunEvidence = {
  name: string;
  status: "queued" | "in_progress" | "completed" | "unknown";
  conclusion: "success" | "failure" | "cancelled" | "skipped" | "timed_out" | "action_required" | "neutral" | "unknown" | null;
  head_sha: string | null;
  url: string | null;
  observed_at: string;
};

type RemoteCodeqlEvidence = {
  status: "pass" | "warn" | "fail" | "not_configured" | "unknown";
  conclusion: "success" | "failure" | "cancelled" | "skipped" | "timed_out" | "action_required" | "neutral" | "unknown" | null;
  url: string | null;
  observed_at: string | null;
};

type RemoteObservedEvidence = {
  status: "not_checked" | "observed" | "invalid";
  source: "not_provided" | "snapshot_file";
  evidence_path: string | null;
  repository: string | null;
  observed_at: string | null;
  commit: string | null;
  commit_matches_head: boolean | null;
  ci: {
    status: "not_checked" | "pass" | "warn" | "fail" | "unknown";
    latest_runs: RemoteCiWorkflowRunEvidence[];
    summary: {
      total: number;
      success: number;
      failure: number;
      incomplete: number;
      unknown: number;
    };
  };
  codeql: RemoteCodeqlEvidence;
  evidence: string[];
  warnings: string[];
};

type ReleaseManifestPreviewStatus = "candidate" | "blocked" | "draft";

type ReleaseManifestEvidenceItem = {
  name: string;
  status: DoctorCheckStatus;
  evidence: string[];
};

type ReleaseManifestPreview = {
  id: string;
  repository: string;
  source_revision: {
    git_head: string;
    git_head_short: string;
    branch: string;
    dirty: boolean;
  };
  generated_at: string;
  status: ReleaseManifestPreviewStatus;
  dependency_lockfiles: ReleaseManifestEvidenceItem[];
  test_gates: Array<{
    name: string;
    command: string;
    status: DoctorCheckStatus;
    evidence: string[];
  }>;
  artifact_hashes: Array<{
    path: string;
    sha256: string;
  }>;
  governance_docs: ReleaseManifestEvidenceItem[];
  bilingual_docs: ReleaseManifestEvidenceItem[];
  remote_observed_evidence: {
    ci_status: RemoteObservedEvidence["ci"]["status"];
    codeql_status: RemoteCodeqlEvidence["status"];
    snapshot_ref: string | null;
    observed_at: string | null;
  };
  known_gaps: string[];
};

type RemoteEvidenceSnapshot = {
  id: "aetherion_remote_ci_evidence_snapshot";
  generated_at: string;
  repo_root: string;
  workspace_root: string;
  source: "github_cli_run_list";
  repository: string | null;
  branch: string | null;
  commit: string | null;
  observed_at: string;
  scope: ReadOnlyCommandScope & {
    checks_remote_ci: true;
    writes_workspace: false;
    starts_daemon: false;
    packages_release: false;
    signs_artifacts: false;
    publishes_release: false;
    queries_code_scanning_alerts: false;
  };
  workflow_runs: RemoteCiWorkflowRunEvidence[];
  codeql: RemoteCodeqlEvidence;
  summary: {
    workflow_runs: number;
    workflow_success: number;
    workflow_failure: number;
    workflow_incomplete: number;
    workflow_unknown: number;
    codeql_status: RemoteCodeqlEvidence["status"];
  };
  evidence: string[];
  warnings: string[];
};

type V1CoreProfile = {
  status: "pass" | "fail";
  release_critical_commands: string[];
  readiness_commands: string[];
  release_support_commands: string[];
  post_v1_contract_labs: string[];
  post_v1_surface_labs: string[];
  excluded_from_v1_release_critical: string[];
  evidence: string[];
  source_documents: Array<{ path: string; role: string }>;
};

type ReleaseEvidenceReport = {
  id: "aetherion_release_evidence_report";
  generated_at: string;
  repo_root: string;
  workspace_root: string;
  status: "ready" | "draft" | "blocked";
  evidence_kind: "local_and_optional_remote_release_snapshot";
  scope: ReadOnlyCommandScope & {
    publishes_release: false;
    signs_artifacts: false;
    checks_remote_ci: boolean;
  };
  summary: {
    doctor_status: DoctorReport["status"];
    security_audit_status: SecurityAuditReport["status"];
    git_dirty: boolean;
    configured_ci_gate: DoctorCheckStatus;
    dependency_lockfiles: DoctorCheckStatus;
    docs_deployment_readiness: DoctorCheckStatus;
    workspace_runtime: string;
    remote_ci_checked: boolean;
    remote_ci_status: RemoteObservedEvidence["ci"]["status"];
    remote_codeql_status: RemoteCodeqlEvidence["status"];
    packaged: false;
    signed: false;
    published: false;
  };
  git: GitReleaseEvidence;
  configured_evidence: {
    ci_workflow_gate: {
      status: DoctorCheckStatus;
      missing_gates: string[];
      evidence: string[];
    };
    platform_smoke_matrix: {
      configured: boolean;
      runners: string[];
      evidence: string[];
    };
    action_runtime: {
      node24_forced: boolean;
      checkout_v5: boolean;
      setup_node_v5: boolean;
      setup_go_v6: boolean;
      go_version_125: boolean;
      package_manager_cache_disabled: boolean;
      evidence: string[];
    };
    dependency_lockfiles: {
      status: DoctorCheckStatus;
      evidence: string[];
    };
    governance_files: {
      status: DoctorCheckStatus;
      evidence: string[];
    };
    bilingual_main_docs: {
      status: DoctorCheckStatus;
      evidence: string[];
    };
    docs_deployment_readiness: {
      status: DoctorCheckStatus;
      public_docs_deployed: false;
      markdown_files_checked: number;
      unresolved_relative_links: string[];
      evidence: string[];
    };
    local_ingress_readiness_contract: {
      status: DoctorCheckStatus;
      evidence: string[];
    };
    model_provider_readiness_contract: {
      status: DoctorCheckStatus;
      evidence: string[];
    };
    vault_policy_binding_contract: {
      status: DoctorCheckStatus;
      evidence: string[];
    };
    supervisor_lifecycle_readiness_contract: {
      status: DoctorCheckStatus;
      evidence: string[];
    };
    supervisor_socket_auth_boundary_contract: {
      status: DoctorCheckStatus;
      evidence: string[];
    };
    ledger_integrity_extension_readiness_contract: {
      status: DoctorCheckStatus;
      evidence: string[];
    };
    adapter_gate_readiness_contract: {
      status: DoctorCheckStatus;
      evidence: string[];
    };
    vault_reference_contract: {
      status: DoctorCheckStatus;
      evidence: string[];
    };
  };
  v1_core_profile: V1CoreProfile;
  remote_observed_evidence: RemoteObservedEvidence;
  local_reports: {
    doctor: Pick<DoctorReport, "status" | "check_status" | "summary">;
    security_audit: Pick<SecurityAuditReport, "status" | "summary">;
  };
  release_manifest_preview: ReleaseManifestPreview;
  workspace_runtime: {
    status: "not_initialized" | "initialized" | "invalid";
    ledger_status: DoctorCheckStatus | SecurityAuditCheckStatus;
    evidence: string[];
  };
  release_artifacts: {
    packaged: false;
    signed: false;
    published: false;
    remote_ci_checked: boolean;
    evidence_repository: false;
    public_docs_deployed: false;
    docs_deployment_readiness_checked: boolean;
    installer_available: false;
    updater_available: false;
  };
  source_documents: Array<{ path: string; role: string }>;
  remaining_gaps: string[];
};

async function runRelease(options: CliOptions): Promise<void> {
  if (options.topic === "remote-evidence") {
    const workspaceRoot = resolve(options.workspace);
    printRawJson(buildRemoteEvidenceSnapshot(workspaceRoot, options.branch));
    return;
  }
  if (options.topic !== "evidence") {
    throw new Error("release supports evidence and remote-evidence");
  }
  const workspaceRoot = resolve(options.workspace);
  const report = await buildReleaseEvidenceReport(workspaceRoot, options.remoteEvidence);
  if (report.status === "blocked") {
    process.exitCode = 1;
  }
  printRawJson(report);
}

async function buildReleaseEvidenceReport(workspaceRoot: string, remoteEvidencePath?: string): Promise<ReleaseEvidenceReport> {
  const doctor = await buildDoctorReport(workspaceRoot);
  const securityAudit = await buildSecurityAuditReport(workspaceRoot);
  const git = gitReleaseEvidence();
  const remoteEvidence = readRemoteObservedEvidence(workspaceRoot, remoteEvidencePath, git.head);
  const doctorChecks = new Map(doctor.checks.map((checkItem) => [checkItem.id, checkItem]));
  const ciWorkflow = readRepoText(".github/workflows/ci.yml") ?? "";
  const ciWorkflowGate = doctorChecks.get("ci_workflow_gate");
  const dependencyLockfiles = doctorChecks.get("dependency_lockfiles");
  const governanceFiles = doctorChecks.get("governance_files");
  const bilingualMainDocs = doctorChecks.get("bilingual_main_docs");
  const docsDeploymentReadiness = doctorChecks.get("docs_deployment_readiness");
  const markdownRelativeLinks = markdownRelativeLinkEvidence();
  const localIngressReadinessContract = doctorChecks.get("local_ingress_readiness_contract");
  const modelProviderReadinessContract = doctorChecks.get("model_provider_readiness_contract");
  const vaultPolicyBindingContract = doctorChecks.get("vault_policy_binding_contract");
  const supervisorLifecycleReadinessContract = doctorChecks.get("supervisor_lifecycle_readiness_contract");
  const supervisorSocketAuthBoundaryContract = doctorChecks.get("supervisor_socket_auth_boundary_contract");
  const ledgerIntegrityExtensionReadinessContract = doctorChecks.get("ledger_integrity_extension_readiness_contract");
  const adapterGateReadinessContract = doctorChecks.get("adapter_gate_readiness_contract");
  const vaultReferenceContract = doctorChecks.get("vault_reference_contract");
  const workspaceRuntime = releaseWorkspaceRuntime(doctor, securityAudit);
  const v1CoreProfile = buildV1CoreProfile();
  const remoteBlocksRelease = remoteEvidence.status === "invalid"
    || remoteEvidence.ci.status === "fail"
    || remoteEvidence.codeql.status === "fail"
    || remoteEvidence.commit_matches_head === false;
  const blocked = doctor.status === "blocked" || securityAudit.status === "fail" || remoteBlocksRelease || v1CoreProfile.status === "fail";
  const status = blocked
    ? "blocked"
    : git.dirty || remoteEvidence.status !== "observed" || remoteEvidence.warnings.length > 0
      ? "draft"
      : "ready";
  const generatedAt = new Date().toISOString();
  const remainingGaps = releaseRemainingGaps(remoteEvidence, docsDeploymentReadiness);

  return {
    id: "aetherion_release_evidence_report",
    generated_at: generatedAt,
    repo_root: repoRoot,
    workspace_root: workspaceRoot,
    status,
    evidence_kind: "local_and_optional_remote_release_snapshot",
    scope: {
      ...readOnlyCommandScope(),
      publishes_release: false,
      signs_artifacts: false,
      checks_remote_ci: remoteEvidence.status === "observed"
    },
    summary: {
      doctor_status: doctor.status,
      security_audit_status: securityAudit.status,
      git_dirty: git.dirty,
      configured_ci_gate: ciWorkflowGate?.status ?? "fail",
      dependency_lockfiles: dependencyLockfiles?.status ?? "fail",
      docs_deployment_readiness: docsDeploymentReadiness?.status ?? "fail",
      workspace_runtime: workspaceRuntime.status,
      remote_ci_checked: remoteEvidence.status === "observed",
      remote_ci_status: remoteEvidence.ci.status,
      remote_codeql_status: remoteEvidence.codeql.status,
      packaged: false,
      signed: false,
      published: false
    },
    git,
    configured_evidence: {
      ci_workflow_gate: {
        status: ciWorkflowGate?.status ?? "fail",
        missing_gates: ciGateNeedles().filter((needle) => !ciWorkflow.includes(needle)),
        evidence: ciWorkflowGate?.evidence ?? [".github/workflows/ci.yml=missing"]
      },
      platform_smoke_matrix: {
        configured: ciWorkflow.includes("platform-smoke:") && ciWorkflow.includes("ubuntu-latest") && ciWorkflow.includes("macos-latest"),
        runners: ["ubuntu-latest", "macos-latest"].filter((runner) => ciWorkflow.includes(runner)),
        evidence: [
          `workflow_job=${ciWorkflow.includes("platform-smoke:") ? "platform-smoke" : "missing"}`,
          `ubuntu_latest=${String(ciWorkflow.includes("ubuntu-latest"))}`,
          `macos_latest=${String(ciWorkflow.includes("macos-latest"))}`,
          "remote_execution_checked=false"
        ]
      },
      action_runtime: {
        node24_forced: ciWorkflow.includes("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true"),
        checkout_v5: ciWorkflow.includes("actions/checkout@v5"),
        setup_node_v5: ciWorkflow.includes("actions/setup-node@v5"),
        setup_go_v6: ciWorkflow.includes("actions/setup-go@v6"),
        go_version_125: ciWorkflow.includes("go-version: 1.25.x"),
        package_manager_cache_disabled: ciWorkflow.includes("package-manager-cache: false"),
        evidence: [
          `node24_forced=${String(ciWorkflow.includes("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true"))}`,
          `checkout_v5=${String(ciWorkflow.includes("actions/checkout@v5"))}`,
          `setup_node_v5=${String(ciWorkflow.includes("actions/setup-node@v5"))}`,
          `setup_go_v6=${String(ciWorkflow.includes("actions/setup-go@v6"))}`,
          `go_version_125=${String(ciWorkflow.includes("go-version: 1.25.x"))}`,
          `package_manager_cache_disabled=${String(ciWorkflow.includes("package-manager-cache: false"))}`
        ]
      },
      dependency_lockfiles: {
        status: dependencyLockfiles?.status ?? "fail",
        evidence: dependencyLockfiles?.evidence ?? ["dependency_lockfiles=missing"]
      },
      governance_files: {
        status: governanceFiles?.status ?? "fail",
        evidence: governanceFiles?.evidence ?? ["governance_files=missing"]
      },
      bilingual_main_docs: {
        status: bilingualMainDocs?.status ?? "fail",
        evidence: bilingualMainDocs?.evidence ?? ["bilingual_main_docs=missing"]
      },
      docs_deployment_readiness: {
        status: docsDeploymentReadiness?.status ?? "fail",
        public_docs_deployed: false,
        markdown_files_checked: markdownRelativeLinks.markdownFilesChecked,
        unresolved_relative_links: markdownRelativeLinks.unresolvedRelativeLinks,
        evidence: docsDeploymentReadiness?.evidence ?? ["docs_deployment_readiness=missing"]
      },
      local_ingress_readiness_contract: {
        status: localIngressReadinessContract?.status ?? "fail",
        evidence: localIngressReadinessContract?.evidence ?? ["local_ingress_readiness_contract=missing"]
      },
      model_provider_readiness_contract: {
        status: modelProviderReadinessContract?.status ?? "fail",
        evidence: modelProviderReadinessContract?.evidence ?? ["model_provider_readiness_contract=missing"]
      },
      vault_policy_binding_contract: {
        status: vaultPolicyBindingContract?.status ?? "fail",
        evidence: vaultPolicyBindingContract?.evidence ?? ["vault_policy_binding_contract=missing"]
      },
      supervisor_lifecycle_readiness_contract: {
        status: supervisorLifecycleReadinessContract?.status ?? "fail",
        evidence: supervisorLifecycleReadinessContract?.evidence ?? ["supervisor_lifecycle_readiness_contract=missing"]
      },
      supervisor_socket_auth_boundary_contract: {
        status: supervisorSocketAuthBoundaryContract?.status ?? "fail",
        evidence: supervisorSocketAuthBoundaryContract?.evidence ?? ["supervisor_socket_auth_boundary_contract=missing"]
      },
      ledger_integrity_extension_readiness_contract: {
        status: ledgerIntegrityExtensionReadinessContract?.status ?? "fail",
        evidence: ledgerIntegrityExtensionReadinessContract?.evidence ?? ["ledger_integrity_extension_readiness_contract=missing"]
      },
      adapter_gate_readiness_contract: {
        status: adapterGateReadinessContract?.status ?? "fail",
        evidence: adapterGateReadinessContract?.evidence ?? ["adapter_gate_readiness_contract=missing"]
      },
      vault_reference_contract: {
        status: vaultReferenceContract?.status ?? "fail",
        evidence: vaultReferenceContract?.evidence ?? ["vault_reference_contract=missing"]
      }
    },
    v1_core_profile: v1CoreProfile,
    remote_observed_evidence: remoteEvidence,
    local_reports: {
      doctor: {
        status: doctor.status,
        check_status: doctor.check_status,
        summary: doctor.summary
      },
      security_audit: {
        status: securityAudit.status,
        summary: securityAudit.summary
      }
    },
    release_manifest_preview: releaseManifestPreview({
      generatedAt,
      releaseStatus: status,
      git,
      remoteEvidence,
      ciWorkflow,
      ciWorkflowGate,
      dependencyLockfiles,
      governanceFiles,
      remainingGaps
    }),
    workspace_runtime: workspaceRuntime,
    release_artifacts: {
      packaged: false,
      signed: false,
      published: false,
      remote_ci_checked: remoteEvidence.status === "observed",
      evidence_repository: false,
      public_docs_deployed: false,
      docs_deployment_readiness_checked: docsDeploymentReadiness?.status === "pass",
      installer_available: false,
      updater_available: false
    },
    source_documents: [
      { path: "docs/00-product-brief.md", role: "local-first authority and reviewable evidence intent" },
      { path: "docs/05-audit-and-data-contracts.md", role: "Event Ledger and rebuildable projection source of truth" },
      { path: "docs/06-roadmap.md", role: "TUI-first V1 scope and deferred connector surfaces" },
      { path: "docs/13-schema-runtime-governance.md", role: "schema and governance source constraints" },
      { path: "docs/14-runtime-loop-plan.md", role: "current production-hardening loop" }
    ],
    remaining_gaps: remainingGaps
  };
}

function releaseManifestPreview(input: {
  generatedAt: string;
  releaseStatus: ReleaseEvidenceReport["status"];
  git: GitReleaseEvidence;
  remoteEvidence: RemoteObservedEvidence;
  ciWorkflow: string;
  ciWorkflowGate?: DoctorCheck;
  dependencyLockfiles?: DoctorCheck;
  governanceFiles?: DoctorCheck;
  remainingGaps: string[];
}): ReleaseManifestPreview {
  return {
    id: "release_manifest_preview",
    repository: input.remoteEvidence.repository ?? gitRemoteRepository() ?? "local-aetherion",
    source_revision: {
      git_head: input.git.head ?? "unknown",
      git_head_short: input.git.head_short ?? "unknown",
      branch: input.git.branch ?? "unknown",
      dirty: input.git.dirty
    },
    generated_at: input.generatedAt,
    status: releaseManifestStatus(input.releaseStatus),
    dependency_lockfiles: releaseManifestDependencyLockfiles(input.dependencyLockfiles),
    test_gates: releaseManifestTestGates(input.ciWorkflow, input.ciWorkflowGate),
    artifact_hashes: releaseManifestArtifactHashes(),
    governance_docs: releaseManifestGovernanceDocs(input.governanceFiles),
    bilingual_docs: releaseManifestBilingualDocs(),
    remote_observed_evidence: {
      ci_status: input.remoteEvidence.ci.status,
      codeql_status: input.remoteEvidence.codeql.status,
      snapshot_ref: input.remoteEvidence.evidence_path,
      observed_at: input.remoteEvidence.observed_at
    },
    known_gaps: uniqueStrings([
      ...input.remainingGaps,
      "release manifest preview is not written as a generated, signed, or published manifest artifact"
    ])
  };
}

function releaseManifestStatus(status: ReleaseEvidenceReport["status"]): ReleaseManifestPreviewStatus {
  if (status === "ready") {
    return "candidate";
  }
  if (status === "blocked") {
    return "blocked";
  }
  return "draft";
}

function releaseManifestDependencyLockfiles(checkItem?: DoctorCheck): ReleaseManifestEvidenceItem[] {
  const status = checkItem?.status ?? "fail";
  const evidence = checkItem?.evidence ?? ["dependency_lockfiles=missing"];
  const packageEvidence = evidence.filter((line) => line.startsWith("package_"));
  const cargoEvidence = evidence.filter((line) => line.startsWith("cargo_"));
  return [
    {
      name: "package-lock.json",
      status,
      evidence: packageEvidence.length > 0 ? packageEvidence : evidence
    },
    {
      name: "Cargo.lock",
      status,
      evidence: cargoEvidence.length > 0 ? cargoEvidence : evidence
    }
  ];
}

function releaseManifestTestGates(ciWorkflow: string, ciWorkflowGate?: DoctorCheck): ReleaseManifestPreview["test_gates"] {
  const gates = [
    ["npm_test_configured", "npm test"],
    ["go_tui_test_configured", "go test ./packages/tui-go/..."],
    ["cargo_test_locked_configured", "cargo test --locked"],
    ["cargo_clippy_configured", "cargo clippy --all-targets --all-features --locked -- -D warnings"],
    ["cargo_fmt_configured", "cargo fmt --check"],
    ["security_audit_configured", "npm run ether -- security audit --workspace ."],
    ["doctor_configured", "npm run ether -- doctor --workspace ."],
    ["release_evidence_configured", "npm run ether -- release evidence --workspace ."]
  ] as const;
  return gates.map(([name, command]) => {
    const configured = Boolean(ciWorkflow.includes(command));
    return {
      name,
      command,
      status: configured ? (ciWorkflowGate?.status ?? "pass") : "fail",
      evidence: [
        `ci_workflow_contains_command=${String(configured)}`,
        "configured_not_executed_by_release_evidence=true"
      ]
    };
  });
}

function releaseManifestArtifactHashes(): ReleaseManifestPreview["artifact_hashes"] {
  return [
    "package-lock.json",
    "Cargo.lock",
    "schemas/release-manifest.schema.json",
    "examples/contracts/release-manifest.json"
  ].flatMap((path) => {
    const sha256 = sha256RepoFile(path);
    return sha256 ? [{ path, sha256 }] : [];
  });
}

function releaseManifestGovernanceDocs(checkItem?: DoctorCheck): ReleaseManifestEvidenceItem[] {
  return requiredGovernanceFiles().map((file) => ({
    name: file,
    status: existsRepoFile(file) ? "pass" : (checkItem?.status ?? "fail"),
    evidence: [`${file}=${existsRepoFile(file) ? "present" : "missing"}`]
  }));
}

function releaseManifestBilingualDocs(): ReleaseManifestEvidenceItem[] {
  return bilingualDocsEvidence().map((line) => {
    const [name] = line.split("=");
    return {
      name: name ?? "bilingual_doc_link",
      status: line.endsWith("=ok") ? "pass" : "fail",
      evidence: [line]
    };
  });
}

function releaseRemainingGaps(remoteEvidence: RemoteObservedEvidence, docsDeploymentReadiness?: DoctorCheck): string[] {
  return [
    remoteEvidence.status === "observed"
      ? "remote CI/CodeQL evidence is read from an operator-supplied snapshot, not queried live"
      : "remote CI/CodeQL execution evidence is missing; pass --remote-evidence <snapshot.json> to include observed CI and CodeQL status",
    "release packages are not built",
    "release artifacts are not signed",
    "local ingress readiness now has TUI run local rate-limit, duplicate-key reservation, and same-intent cached replay before supervisor handoff, but durable/session/remote idempotency replay, durable/distributed/session/remote rate limiting, persistent auth/session lifecycle, public API listener, browser extension ingress, IM delivery, mobile pairing, or cloud worker ingress is not implemented",
    "supervisor lifecycle readiness covers read-only status/preflight plus foreground socket lock observation, and supervisor socket auth boundary evidence covers caller-supplied local socket token gating, but production daemon start/stop, socket auth lifecycle, stale-lock recovery, process sandboxing, vault-backed supervisor secrets, session issuance, and lease authority are not implemented",
    "vault policy binding is metadata-only; no secret resolution, provider vault-backed call, token refresh, egress grant, or connector grant lifecycle is implemented",
    "vault references are metadata-only; no production vault backend, token refresh, or connector grant lifecycle is implemented",
    "model provider readiness covers OpenAI Responses, OpenAI Chat Completions, Anthropic Messages, and Gemini generateContent, but OAuth flows, token refresh, connector grants, streaming, multimodal payloads, and legacy OpenAI text completions are not implemented",
    "ledger integrity extension readiness documents event signature, redaction, rebuild, and explicit repair prerequisites, but runtime event signing, ledger migration, redaction tooling, projection repair commands, public transparency logs, and cloud notaries are not implemented",
    "adapter gate readiness documents the adapter-family policy matrix and pre-runtime controls for browser, IM, MCP, OAuth/SaaS connector, computer-use, local API, package execution, and cloud worker families, but real adapter execution, browser automation, desktop automation, IM delivery, connector grants, local API gateway, package execution, and cloud worker surfaces remain deferred",
    docsDeploymentReadiness?.status === "pass"
      ? "docs deployment readiness is checked locally, but public docs are not deployed"
      : "docs deployment readiness is missing or failing, and public docs are not deployed",
    "installer and updater infrastructure are not implemented",
    "broader platform/release matrix artifacts are not produced",
    "GUI, browser automation, IM delivery, MCP/OAuth connectors, cloud workers, and package-code execution remain deferred"
  ];
}

function sha256RepoFile(relativePath: string): string | null {
  const path = join(repoRoot, relativePath);
  return existsSync(path) ? `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}` : null;
}

function readOnlyCommandScope(): ReadOnlyCommandScope {
  return {
    read_only: true,
    mutates_ledger: false,
    mutates_registries: false,
    writes_artifacts: false,
    calls_model_provider: false,
    issues_lease: false,
    repairs_state: false
  };
}

function checkWorkspaceTarget(workspaceRoot: string): DoctorCheck {
  let isDirectory = false;
  try {
    isDirectory = existsSync(workspaceRoot) && statSync(workspaceRoot).isDirectory();
  } catch {
    isDirectory = false;
  }
  return check(
    "workspace_target",
    isDirectory ? "pass" : "fail",
    isDirectory ? "info" : "error",
    isDirectory
      ? "Workspace target exists for from-source onboarding checks."
      : "Workspace target does not exist or is not a directory.",
    [`workspace_root=${workspaceRoot}`, `is_directory=${String(isDirectory)}`],
    "Create the workspace directory or pass --workspace <path> that points to an existing directory."
  );
}

function commandVersionCheck(
  id: string,
  commandName: string,
  args: string[],
  passSummary: string,
  remediation: string,
  missingStatus: "warn" | "fail" = "fail"
): DoctorCheck {
  try {
    const output = execFileSync(commandName, args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5000
    }).trim();
    return check(
      id,
      "pass",
      "info",
      passSummary,
      [`command=${[commandName, ...args].join(" ")}`, `version=${singleLine(output.split(/\r?\n/)[0] ?? "available")}`],
      remediation
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return check(
      id,
      missingStatus,
      missingStatus === "warn" ? "warning" : "error",
      `${commandName} ${args.join(" ")} is not available for from-source onboarding.`,
      [`command=${[commandName, ...args].join(" ")}`, `error=${singleLine(message)}`],
      remediation
    );
  }
}

function missingRepoCheck(id: string): DoctorCheck {
  return check(
    id,
    "fail",
    "error",
    `Required repo onboarding check ${id} could not be built.`,
    [`check_id=${id}`],
    "Restore repo doctor checks before relying on onboarding preflight."
  );
}

function onboardingDocsCheck(): DoctorCheck {
  const requiredLinks = [
    ["README.md", "npm run ether -- onboarding check --workspace ."],
    ["README.zh-CN.md", "npm run ether -- onboarding check --workspace ."],
    ["CONTRIBUTING.md", "npm run ether -- onboarding check --workspace ."],
    ["CONTRIBUTING.zh-CN.md", "npm run ether -- onboarding check --workspace ."],
    ["packages/tui/README.md", "npm run ether -- onboarding check --workspace ."],
    ["packages/tui/README.zh-CN.md", "npm run ether -- onboarding check --workspace ."]
  ] as const;
  const evidence = requiredLinks.map(([file, needle]) => `${file}:${readRepoText(file)?.includes(needle) ? "linked" : "missing"}`);
  const ok = evidence.every((line) => line.endsWith(":linked"));
  return check(
    "from_source_onboarding_docs",
    ok ? "pass" : "fail",
    ok ? "info" : "error",
    "Primary docs link the from-source onboarding preflight command.",
    evidence,
    "Add npm run ether -- onboarding check --workspace . to README, CONTRIBUTING, and TUI README in both languages."
  );
}

function layerStatus(checks: DoctorCheck[]): DoctorReport["status"] {
  if (checks.some((checkItem) => checkItem.status === "fail")) {
    return "blocked";
  }
  if (checks.some((checkItem) => checkItem.status === "warn")) {
    return "degraded";
  }
  return "ready";
}

function onboardingWorkspaceRuntimeState(workspaceChecks: DoctorCheck[]): OnboardingPreflightReport["readiness_layers"]["workspace_runtime_state"] {
  if (workspaceChecks.some((checkItem) => checkItem.status === "fail")) {
    return "invalid";
  }
  if (workspaceChecks.some((checkItem) => checkItem.id === "workspace_runtime_state" && checkItem.status === "not_applicable")) {
    return "not_initialized";
  }
  return "initialized";
}

function gitReleaseEvidence(): GitReleaseEvidence {
  const head = gitOutput(["rev-parse", "HEAD"]);
  const changedFiles = gitOutputRaw(["status", "--porcelain=v1", "--untracked-files=all"])
    .split("\n")
    .filter(Boolean);
  return {
    is_git_repo: Boolean(head),
    branch: gitOutput(["rev-parse", "--abbrev-ref", "HEAD"]),
    head,
    head_short: gitOutput(["rev-parse", "--short", "HEAD"]),
    dirty: changedFiles.length > 0,
    changed_file_count: changedFiles.length,
    tracked_change_count: changedFiles.filter((line) => !line.startsWith("??")).length,
    untracked_file_count: changedFiles.filter((line) => line.startsWith("??")).length,
    changed_files: changedFiles
  };
}

function buildV1CoreProfile(): V1CoreProfile {
  const releaseCriticalCommands = [
    "run",
    "replay",
    "trace",
    "boundary",
    "supervisor status",
    "supervisor preflight",
    "onboarding check",
    "doctor",
    "release evidence"
  ];
  const releaseSupportCommands = ["security audit", "ingress audit"];
  const postV1ContractLabs = [
    "import",
    "memory",
    "context",
    "prompt",
    "checkpoint",
    "branch",
    "rehearse",
    "approve-rehearsal",
    "capsule",
    "why",
    "counterfactual",
    "sleep",
    "wake",
    "sleepers",
    "dream",
    "anchors",
    "persona",
    "soul",
    "agent",
    "audit"
  ];
  const postV1SurfaceLabs = ["surface", "store"];
  const releaseCriticalSet = new Set(releaseCriticalCommands);
  const excluded = [...postV1ContractLabs, ...postV1SurfaceLabs];
  const overlap = excluded.filter((command) => releaseCriticalSet.has(command));
  return {
    status: overlap.length === 0 ? "pass" : "fail",
    release_critical_commands: releaseCriticalCommands,
    readiness_commands: ["onboarding check", "doctor", "security audit", "ingress audit", "release evidence"],
    release_support_commands: releaseSupportCommands,
    post_v1_contract_labs: postV1ContractLabs,
    post_v1_surface_labs: postV1SurfaceLabs,
    excluded_from_v1_release_critical: excluded,
    evidence: [
      "help_section=V1 core",
      "help_section=Post-V1 / experimental local contract labs (not V1 release-critical)",
      "help_section=Post-V1 contract surfaces (no real delivery, automation, or package-code execution)",
      `release_critical_overlap=${overlap.length === 0 ? "none" : overlap.join(",")}`
    ],
    source_documents: [
      { path: "docs/00-product-brief.md", role: "V1 is TUI-first and deferred surfaces are out of scope" },
      { path: "docs/06-roadmap.md", role: "Phase 1/2 kernel loop before broader surfaces" },
      { path: "docs/15-production-gap-closure-plan.md", role: "production gap closure without V1 surface creep" }
    ]
  };
}

function readRemoteObservedEvidence(workspaceRoot: string, snapshotPath: string | undefined, gitHead: string | null): RemoteObservedEvidence {
  if (!snapshotPath) {
    return {
      status: "not_checked",
      source: "not_provided",
      evidence_path: null,
      repository: null,
      observed_at: null,
      commit: null,
      commit_matches_head: null,
      ci: {
        status: "not_checked",
        latest_runs: [],
        summary: { total: 0, success: 0, failure: 0, incomplete: 0, unknown: 0 }
      },
      codeql: {
        status: "unknown",
        conclusion: null,
        url: null,
        observed_at: null
      },
      evidence: ["remote_evidence_snapshot=not_provided"],
      warnings: ["remote CI and CodeQL evidence were not observed in this report"]
    };
  }

  const relativeSnapshotPath = assertWorkspaceReadPath(workspaceRoot, snapshotPath);
  const resolvedSnapshotPath = resolve(workspaceRoot, relativeSnapshotPath);
  try {
    const snapshot = JSON.parse(readFileSync(resolvedSnapshotPath, "utf8")) as Record<string, unknown>;
    const runs = Array.isArray(snapshot.workflow_runs)
      ? snapshot.workflow_runs.map(normalizeRemoteWorkflowRun).filter((run): run is RemoteCiWorkflowRunEvidence => Boolean(run))
      : [];
    const codeql = normalizeRemoteCodeqlEvidence(snapshot.codeql);
    const commit = typeof snapshot.commit === "string" && snapshot.commit.length > 0 ? snapshot.commit : null;
    const observedAt = typeof snapshot.observed_at === "string" && snapshot.observed_at.length > 0 ? snapshot.observed_at : null;
    const repository = typeof snapshot.repository === "string" && snapshot.repository.length > 0 ? snapshot.repository : null;
    const summary = {
      total: runs.length,
      success: runs.filter((run) => run.status === "completed" && run.conclusion === "success").length,
      failure: runs.filter((run) => run.status === "completed" && run.conclusion !== "success" && run.conclusion !== "neutral" && run.conclusion !== "skipped").length,
      incomplete: runs.filter((run) => run.status === "queued" || run.status === "in_progress").length,
      unknown: runs.filter((run) => run.status === "unknown" || run.conclusion === "unknown").length
    };
    const ciStatus = remoteCiStatus(summary);
    const warnings = [
      ...(runs.length === 0 ? ["remote workflow run evidence is empty"] : []),
      ...(codeql.status === "unknown" ? ["remote CodeQL evidence is unknown"] : []),
      ...(codeql.status === "not_configured" ? ["remote CodeQL evidence is not configured"] : []),
      ...(commit && gitHead && commit !== gitHead ? ["remote evidence commit does not match local git head"] : [])
    ];
    return {
      status: "observed",
      source: "snapshot_file",
      evidence_path: relativeSnapshotPath,
      repository,
      observed_at: observedAt,
      commit,
      commit_matches_head: commit && gitHead ? commit === gitHead : null,
      ci: {
        status: ciStatus,
        latest_runs: runs,
        summary
      },
      codeql,
      evidence: [
        `remote_evidence_snapshot=${relativeSnapshotPath}`,
        `workflow_runs=${runs.length}`,
        `workflow_success=${summary.success}`,
        `workflow_failure=${summary.failure}`,
        `workflow_incomplete=${summary.incomplete}`,
        `codeql_status=${codeql.status}`,
        `commit_matches_head=${String(commit && gitHead ? commit === gitHead : "unknown")}`
      ],
      warnings
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "invalid",
      source: "snapshot_file",
      evidence_path: relativeSnapshotPath,
      repository: null,
      observed_at: null,
      commit: null,
      commit_matches_head: null,
      ci: {
        status: "unknown",
        latest_runs: [],
        summary: { total: 0, success: 0, failure: 0, incomplete: 0, unknown: 0 }
      },
      codeql: {
        status: "unknown",
        conclusion: null,
        url: null,
        observed_at: null
      },
      evidence: [`remote_evidence_snapshot=${relativeSnapshotPath}`, `error=${singleLine(message)}`],
      warnings: ["remote evidence snapshot could not be parsed"]
    };
  }
}

function buildRemoteEvidenceSnapshot(workspaceRoot: string, branchOverride?: string): RemoteEvidenceSnapshot {
  const git = gitReleaseEvidence();
  const branch = branchOverride ?? git.branch;
  if (!branch) {
    throw new Error("release remote-evidence requires a git branch; pass --branch <name>");
  }
  const observedAt = new Date().toISOString();
  const rawRuns = execFileSync("gh", [
    "run",
    "list",
    "--branch",
    branch,
    "--limit",
    "20",
    "--json",
    "name,workflowName,status,conclusion,headSha,url,updatedAt"
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15000
  });
  const parsed = JSON.parse(rawRuns) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("gh run list returned a non-array JSON payload");
  }
  const rawWorkflowRuns = parsed.map((run) => normalizeGhWorkflowRun(run, observedAt));
  const workflowRuns = latestWorkflowRunsByName(rawWorkflowRuns);
  const summary = {
    workflow_runs: workflowRuns.length,
    workflow_success: workflowRuns.filter((run) => run.status === "completed" && run.conclusion === "success").length,
    workflow_failure: workflowRuns.filter((run) => run.status === "completed" && run.conclusion !== "success" && run.conclusion !== "neutral" && run.conclusion !== "skipped").length,
    workflow_incomplete: workflowRuns.filter((run) => run.status === "queued" || run.status === "in_progress").length,
    workflow_unknown: workflowRuns.filter((run) => run.status === "unknown" || run.conclusion === "unknown").length,
    codeql_status: "unknown" as RemoteCodeqlEvidence["status"]
  };
  const codeqlRun = workflowRuns.find((run) => run.name.toLowerCase().includes("codeql"));
  const codeql = codeqlRun
    ? normalizeRemoteCodeqlEvidence({
        status: codeqlRun.status === "completed" && codeqlRun.conclusion === "success" ? "pass" : undefined,
        conclusion: codeqlRun.conclusion,
        url: codeqlRun.url,
        observed_at: codeqlRun.observed_at
      })
    : {
        status: "not_configured" as const,
        conclusion: null,
        url: null,
        observed_at: null
      };
  summary.codeql_status = codeql.status;
  const warnings = [
    ...(workflowRuns.length === 0 ? ["gh run list returned no workflow runs"] : []),
    ...(codeql.status === "not_configured" ? ["no CodeQL workflow run was observed in the latest branch runs"] : []),
    ...(workflowRuns.some((run) => run.head_sha && git.head && run.head_sha !== git.head) ? ["one or more observed workflow runs do not match local git head"] : [])
  ];
  return {
    id: "aetherion_remote_ci_evidence_snapshot",
    generated_at: observedAt,
    repo_root: repoRoot,
    workspace_root: workspaceRoot,
    source: "github_cli_run_list",
    repository: gitRemoteRepository(),
    branch,
    commit: git.head,
    observed_at: observedAt,
    scope: {
      ...readOnlyCommandScope(),
      checks_remote_ci: true,
      writes_workspace: false,
      starts_daemon: false,
      packages_release: false,
      signs_artifacts: false,
      publishes_release: false,
      queries_code_scanning_alerts: false
    },
    workflow_runs: workflowRuns,
    codeql,
    summary,
    evidence: [
      "remote_evidence_reader=gh_run_list",
      `repository=${gitRemoteRepository() ?? "unknown"}`,
      `branch=${branch}`,
      `commit=${git.head ?? "unknown"}`,
      `raw_workflow_runs=${rawWorkflowRuns.length}`,
      `latest_workflow_runs=${workflowRuns.length}`,
      `workflow_runs=${summary.workflow_runs}`,
      `workflow_success=${summary.workflow_success}`,
      `workflow_failure=${summary.workflow_failure}`,
      `workflow_incomplete=${summary.workflow_incomplete}`,
      `workflow_unknown=${summary.workflow_unknown}`,
      `codeql_status=${codeql.status}`
    ],
    warnings
  };
}

function latestWorkflowRunsByName(runs: RemoteCiWorkflowRunEvidence[]): RemoteCiWorkflowRunEvidence[] {
  const latest = new Map<string, RemoteCiWorkflowRunEvidence>();
  for (const run of runs.toSorted((left, right) => Date.parse(right.observed_at) - Date.parse(left.observed_at))) {
    if (!latest.has(run.name)) {
      latest.set(run.name, run);
    }
  }
  return [...latest.values()];
}

function normalizeGhWorkflowRun(value: unknown, observedAt: string): RemoteCiWorkflowRunEvidence {
  if (typeof value !== "object" || value === null) {
    return {
      name: "unknown",
      status: "unknown",
      conclusion: "unknown",
      head_sha: null,
      url: null,
      observed_at: observedAt
    };
  }
  const record = value as Record<string, unknown>;
  const workflowName = typeof record.workflowName === "string" && record.workflowName.length > 0 ? record.workflowName : null;
  const name = typeof record.name === "string" && record.name.length > 0 ? record.name : null;
  const updatedAt = typeof record.updatedAt === "string" && record.updatedAt.length > 0 ? record.updatedAt : observedAt;
  return {
    name: workflowName ?? name ?? "unknown",
    status: normalizeRemoteRunStatus(record.status),
    conclusion: normalizeRemoteConclusion(record.conclusion),
    head_sha: typeof record.headSha === "string" && record.headSha.length > 0 ? record.headSha : null,
    url: typeof record.url === "string" && record.url.length > 0 ? record.url : null,
    observed_at: updatedAt
  };
}

function normalizeRemoteWorkflowRun(value: unknown): RemoteCiWorkflowRunEvidence | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const status = normalizeRemoteRunStatus(record.status);
  return {
    name: typeof record.name === "string" && record.name.length > 0 ? record.name : "unknown",
    status,
    conclusion: normalizeRemoteConclusion(record.conclusion),
    head_sha: typeof record.head_sha === "string" && record.head_sha.length > 0 ? record.head_sha : null,
    url: typeof record.url === "string" && record.url.length > 0 ? record.url : null,
    observed_at: typeof record.observed_at === "string" && record.observed_at.length > 0 ? record.observed_at : new Date(0).toISOString()
  };
}

function normalizeRemoteCodeqlEvidence(value: unknown): RemoteCodeqlEvidence {
  if (typeof value !== "object" || value === null) {
    return { status: "unknown", conclusion: null, url: null, observed_at: null };
  }
  const record = value as Record<string, unknown>;
  const conclusion = normalizeRemoteConclusion(record.conclusion);
  let status: RemoteCodeqlEvidence["status"] = "unknown";
  if (record.status === "pass" || conclusion === "success") {
    status = "pass";
  } else if (record.status === "fail" || conclusion === "failure" || conclusion === "timed_out" || conclusion === "action_required") {
    status = "fail";
  } else if (record.status === "warn" || conclusion === "cancelled" || conclusion === "neutral") {
    status = "warn";
  } else if (record.status === "not_configured") {
    status = "not_configured";
  }
  return {
    status,
    conclusion,
    url: typeof record.url === "string" && record.url.length > 0 ? record.url : null,
    observed_at: typeof record.observed_at === "string" && record.observed_at.length > 0 ? record.observed_at : null
  };
}

function normalizeRemoteRunStatus(value: unknown): RemoteCiWorkflowRunEvidence["status"] {
  return value === "queued" || value === "in_progress" || value === "completed" ? value : "unknown";
}

function normalizeRemoteConclusion(value: unknown): RemoteCiWorkflowRunEvidence["conclusion"] {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return value === "success"
    || value === "failure"
    || value === "cancelled"
    || value === "skipped"
    || value === "timed_out"
    || value === "action_required"
    || value === "neutral"
    || value === "unknown"
    ? value
    : "unknown";
}

function remoteCiStatus(summary: RemoteObservedEvidence["ci"]["summary"]): RemoteObservedEvidence["ci"]["status"] {
  if (summary.total === 0 || summary.unknown > 0) {
    return "unknown";
  }
  if (summary.failure > 0) {
    return "fail";
  }
  if (summary.incomplete > 0) {
    return "warn";
  }
  return "pass";
}

function gitRemoteRepository(): string | null {
  const origin = gitOutput(["config", "--get", "remote.origin.url"]);
  if (!origin) {
    return null;
  }
  const sshMatch = origin.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/);
  if (sshMatch) {
    return sshMatch[1];
  }
  return null;
}

function gitOutput(args: string[]): string | null {
  try {
    const output = execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
    return output.length > 0 ? output : null;
  } catch {
    return null;
  }
}

function gitOutputRaw(args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  } catch {
    return "";
  }
}

function releaseWorkspaceRuntime(
  doctor: DoctorReport,
  securityAudit: SecurityAuditReport
): ReleaseEvidenceReport["workspace_runtime"] {
  const workspaceChecks = doctor.checks.filter((checkItem) => checkItem.id.startsWith("workspace_"));
  const ledgerCheck = securityAudit.checks.find((checkItem) => checkItem.id === "workspace.ledger_hash_chain");
  if (workspaceChecks.some((checkItem) => checkItem.status === "fail") || ledgerCheck?.status === "fail") {
    return {
      status: "invalid",
      ledger_status: ledgerCheck?.status ?? "fail",
      evidence: [
        ...workspaceChecks.flatMap((checkItem) => checkItem.evidence),
        ...(ledgerCheck?.evidence ?? [])
      ]
    };
  }
  if (workspaceChecks.some((checkItem) => checkItem.id === "workspace_runtime_state" && checkItem.status === "not_applicable")) {
    return {
      status: "not_initialized",
      ledger_status: ledgerCheck?.status ?? "not_applicable",
      evidence: [
        ...workspaceChecks.flatMap((checkItem) => checkItem.evidence),
        ...(ledgerCheck?.evidence ?? [])
      ]
    };
  }
  return {
    status: "initialized",
    ledger_status: ledgerCheck?.status ?? "pass",
    evidence: [
      ...workspaceChecks.flatMap((checkItem) => checkItem.evidence),
      ...(ledgerCheck?.evidence ?? [])
    ]
  };
}

async function readVerifiedLedgerForReadOnlyCommand(workspaceRoot: string, commandName: string): Promise<{
  workspace: Awaited<ReturnType<typeof openWorkspace>>;
  events: EventRecord[];
}> {
  const { workspace } = await loadWorkspaceFromRegistry(workspaceRoot);
  const events = await readEvents(workspace);
  const chain = verifyEventHashChain(events);
  if (!chain.valid) {
    throw new Error(`${commandName} requires a valid Event Ledger hash chain; broken_at=${chain.broken_at ?? "unknown"}`);
  }
  return { workspace, events };
}

function repoDoctorChecks(): DoctorCheck[] {
  const packageJson = readRepoJson("package.json") as { name?: string; version?: string; license?: string; private?: boolean; bin?: { ether?: string }; engines?: { node?: string }; scripts?: Record<string, string> } | null;
  const ciWorkflow = readRepoText(".github/workflows/ci.yml");
  const gitignore = readRepoText(".gitignore");
  const checks: DoctorCheck[] = [];

  checks.push(check(
    "node_runtime_version",
    nodeVersionAtLeast("24.9.0") ? "pass" : "fail",
    nodeVersionAtLeast("24.9.0") ? "info" : "error",
    `Current Node.js runtime is ${process.versions.node}.`,
    [`process.versions.node=${process.versions.node}`, "required=>=24.9.0"],
    "Run Ether with Node.js 24.9.0 or newer."
  ));
  checks.push(commandVersionCheck(
    "go_available",
    "go",
    ["version"],
    "Go is available for the default Bubble Tea/Bubbles operator TUI.",
    "Install Go 1.25.x before using the default Ether setup console."
  ));
  const packageMetadataOk = packageJson?.license === "MIT"
    && packageJson.private === true
    && packageJson.version === "0.0.0"
    && packageJson.bin?.ether === "packages/tui/src/cli.ts"
    && packageJson.engines?.node === ">=24.9.0";
  checks.push(check(
    "package_metadata",
    packageMetadataOk ? "pass" : "fail",
    packageMetadataOk ? "info" : "error",
    "Package metadata preserves the current private MIT Node 24.9 Ether bin baseline.",
    [
      `name=${packageJson?.name ?? "missing"}`,
      `version=${packageJson?.version ?? "missing"}`,
      `license=${packageJson?.license ?? "missing"}`,
      `private=${String(packageJson?.private ?? "missing")}`,
      `bin_ether=${packageJson?.bin?.ether ?? "missing"}`,
      `node_engine=${packageJson?.engines?.node ?? "missing"}`
    ],
    "Keep package.json version=0.0.0, license=MIT, private=true, bin.ether=packages/tui/src/cli.ts, and engines.node=>=24.9.0 unless the release policy changes."
  ));
  checks.push(check(
    "package_scripts",
    Boolean(packageJson?.scripts?.test && packageJson.scripts["test:go-tui"] && packageJson.scripts["test:all"] && packageJson.scripts.ether) ? "pass" : "fail",
    Boolean(packageJson?.scripts?.test && packageJson.scripts["test:go-tui"] && packageJson.scripts["test:all"] && packageJson.scripts.ether) ? "info" : "error",
    "Core verification, Go operator TUI, and Ether scripts are present.",
    [
      `test=${packageJson?.scripts?.test ?? "missing"}`,
      `test_go_tui=${packageJson?.scripts?.["test:go-tui"] ?? "missing"}`,
      `test_all=${packageJson?.scripts?.["test:all"] ?? "missing"}`,
      `ether=${packageJson?.scripts?.ether ?? "missing"}`
    ],
    "Restore npm scripts for test, test:go-tui, test:all, and ether."
  ));
  checks.push(check(
    "ci_workflow_gate",
    ciWorkflow && ciGateNeedles().every((needle) => ciWorkflow.includes(needle)) ? "pass" : "fail",
    ciWorkflow ? "info" : "error",
    "GitHub Actions workflow covers local quality gates, Go Bubble Tea TUI tests, dependency audits, platform smoke evidence, release evidence, and the Node 24 action-runtime baseline.",
    [
      `.github/workflows/ci.yml=${ciWorkflow ? "present" : "missing"}`,
      "required=node24 action runtime,npm ci,npm audit,go setup,go tui test,cargo audit,npm test,cargo test --locked,cargo clippy --locked,cargo fmt,git diff --check,artifact guard,onboarding check,doctor,ingress audit,security audit,release evidence,ubuntu/macos platform smoke"
    ],
    "Update .github/workflows/ci.yml to mirror the documented local gate."
  ));
  const dependencyLockfiles = dependencyLockfileState(packageJson);
  checks.push(check(
    "dependency_lockfiles",
    dependencyLockfiles.ok ? "pass" : "fail",
    dependencyLockfiles.ok ? "info" : "error",
    dependencyLockfiles.ok
      ? "Root Node and Rust dependency lockfiles are present and match project metadata."
      : "Dependency lockfile evidence is missing or inconsistent.",
    dependencyLockfiles.evidence,
    "Regenerate package-lock.json with npm install --package-lock-only --ignore-scripts and keep Cargo.lock committed."
  ));
  checks.push(check(
    "governance_files",
    requiredGovernanceFiles().every((file) => existsRepoFile(file)) ? "pass" : "fail",
    requiredGovernanceFiles().every((file) => existsRepoFile(file)) ? "info" : "error",
    "Contribution, conduct, license, security, issue, and PR policy files are present.",
    requiredGovernanceFiles().map((file) => `${file}=${existsRepoFile(file) ? "present" : "missing"}`),
    "Restore the missing governance file or template."
  ));
  checks.push(check(
    "bilingual_main_docs",
    bilingualDocsOk() ? "pass" : "fail",
    bilingualDocsOk() ? "info" : "error",
    "Primary docs have English/Chinese companion links.",
    bilingualDocsEvidence(),
    "Add the missing companion file or reciprocal language link."
  ));
  checks.push(docsDeploymentReadinessCheck());
  checks.push(check(
    "runtime_artifact_ignore_rules",
    Boolean(gitignore?.includes(".aetherion/") && gitignore.includes("target/")) ? "pass" : "fail",
    Boolean(gitignore?.includes(".aetherion/") && gitignore.includes("target/")) ? "info" : "error",
    "Runtime and build artifact directories are ignored.",
    [
      `.aetherion_ignored=${String(Boolean(gitignore?.includes(".aetherion/")))}`,
      `target_ignored=${String(Boolean(gitignore?.includes("target/")))}`
    ],
    "Restore .gitignore entries for .aetherion/ and target/."
  ));
  checks.push(check(
    "schema_example_manifest",
    schemaExampleFilesPresent() ? "pass" : "fail",
    schemaExampleFilesPresent() ? "info" : "error",
    "Schema and example directories contain the contract validation baseline.",
    [
      `schemas=${existsRepoFile("schemas") ? "present" : "missing"}`,
      `examples/contracts=${existsRepoFile("examples/contracts") ? "present" : "missing"}`,
      `event_schema=${existsRepoFile("schemas/event.schema.json") ? "present" : "missing"}`,
      `event_example=${existsRepoFile("examples/contracts/event.json") ? "present" : "missing"}`
    ],
    "Restore schemas/ and examples/contracts/ before changing contracts."
  ));
  checks.push(localIngressReadinessContractCheck());
  checks.push(modelProviderReadinessContractCheck());
  checks.push(vaultPolicyBindingContractCheck());
  checks.push(supervisorLifecycleReadinessContractCheck());
  checks.push(supervisorSocketAuthBoundaryContractCheck());
  checks.push(ledgerIntegrityExtensionReadinessContractCheck());
  checks.push(adapterGateReadinessContractCheck());
  checks.push(vaultReferenceContractCheck());
  return checks;
}

function localIngressReadinessContractCheck(): DoctorCheck {
  const schemaPresent = existsRepoFile("schemas/local-ingress-readiness.schema.json");
  const examplePresent = existsRepoFile("examples/contracts/local-ingress-readiness.json");
  const rateLimitReservationSchemaPresent = existsRepoFile("schemas/local-ingress-rate-limit-reservation.schema.json");
  const rateLimitReservationExamplePresent = existsRepoFile("examples/contracts/local-ingress-rate-limit-reservation.json");
  const idempotencyReservationSchemaPresent = existsRepoFile("schemas/local-ingress-idempotency-reservation.schema.json");
  const idempotencyReservationExamplePresent = existsRepoFile("examples/contracts/local-ingress-idempotency-reservation.json");
  const idempotencyCompletionSchemaPresent = existsRepoFile("schemas/local-ingress-idempotency-completion.schema.json");
  const idempotencyCompletionExamplePresent = existsRepoFile("examples/contracts/local-ingress-idempotency-completion.json");
  const architecture = readRepoText("docs/01-architecture.md") ?? "";
  const gapPlan = readRepoText("docs/15-production-gap-closure-plan.md") ?? "";
  const source = readRepoText("packages/tui/src/cli.ts") ?? "";
  const contractTests = readRepoText("packages/harness-core/test/harness-core.test.ts") ?? "";
  const tuiTests = readRepoText("packages/tui/test/tui.test.ts") ?? "";
  const example = readRepoJson("examples/contracts/local-ingress-readiness.json") as {
    supported_surfaces?: {
      tui_command_surface?: unknown;
      local_api_like_envelope_contract?: unknown;
      public_http_api_listener?: unknown;
      gui_client?: unknown;
      browser_extension?: unknown;
      im_delivery?: unknown;
      mobile_client?: unknown;
      cloud_worker?: unknown;
    };
    request_envelope?: {
      required_fields?: unknown;
      caller_identity_placeholder_required?: unknown;
      surface_id_required?: unknown;
      workspace_id_required?: unknown;
      idempotency_key_required?: unknown;
      normalized_intent_hash_required?: unknown;
      auth_state_required?: unknown;
      rate_limit_state_required?: unknown;
      policy_handoff_required?: unknown;
      raw_intent_persisted?: unknown;
      raw_remote_payload_persisted?: unknown;
    };
    normalization?: {
      canonical_surface_required?: unknown;
      normalized_intent_hash_algorithm?: unknown;
      raw_payload_can_authorize_actions?: unknown;
      unknown_surface_disposition?: unknown;
    };
    authentication?: {
      auth_state_values?: unknown;
      unknown_or_unauthenticated_can_authorize_tools?: unknown;
      device_identity_implemented?: unknown;
      user_identity_implemented?: unknown;
      remote_channel_identity_implemented?: unknown;
      oauth_pairing_implemented?: unknown;
      auth_token_persisted?: unknown;
    };
    rate_limit?: {
      rate_limit_state_required?: unknown;
      rate_limit_enforcement_implemented?: unknown;
      rate_limit_enforcement_scope?: unknown;
      over_limit_can_execute_actions?: unknown;
      background_queue_implemented?: unknown;
    };
    idempotency?: {
      idempotency_key_required?: unknown;
      duplicate_detection_before_action_run_required?: unknown;
      duplicate_runtime_detector_implemented?: unknown;
      duplicate_runtime_detector_scope?: unknown;
      duplicate_key_can_reuse_authority?: unknown;
      replay_protection_required?: unknown;
      replay_protection_implemented?: unknown;
      cached_replay_scope?: unknown;
      cached_replay_requires_completed_manifest?: unknown;
      cached_replay_reuses_policy_or_lease?: unknown;
      cached_replay_performs_live_side_effects?: unknown;
      durable_remote_replay_implemented?: unknown;
    };
    policy_handoff?: {
      local_supervisor_required?: unknown;
      tool_policy_proxy_required?: unknown;
      fresh_policy_required_for_actions?: unknown;
      scoped_lease_required_for_actions?: unknown;
      ingress_envelope_can_issue_lease?: unknown;
      ingress_envelope_can_authorize_side_effects?: unknown;
    };
    remote_surface_boundary?: {
      remote_api_gateway_implemented?: unknown;
      browser_extension_delivery_implemented?: unknown;
      im_delivery_implemented?: unknown;
      mobile_pairing_implemented?: unknown;
      connector_oauth_implemented?: unknown;
      cloud_worker_ingress_implemented?: unknown;
      remote_surface_can_bypass_supervisor?: unknown;
    };
    authority?: {
      local_supervisor_is_root_authority?: unknown;
      event_ledger_is_fact_layer?: unknown;
      tool_policy_proxy_gates_side_effects?: unknown;
      ingress_contract_can_mutate_state?: unknown;
      ingress_contract_can_write_ledger?: unknown;
      ingress_contract_can_authorize_tools?: unknown;
    };
    limits?: {
      production_gateway_implemented?: unknown;
      public_http_listener_implemented?: unknown;
      persistent_session_tokens_implemented?: unknown;
      automatic_tool_execution_implemented?: unknown;
      real_remote_surface_ingress_implemented?: unknown;
      raw_external_payload_storage_implemented?: unknown;
    };
  } | null;
  const requiredEnvelopeFields = [
    "caller_identity_placeholder",
    "surface_id",
    "workspace_id",
    "idempotency_key",
    "normalized_intent_hash",
    "auth_state",
    "rate_limit_state",
    "policy_handoff"
  ];
  const envelopeFields = Array.isArray(example?.request_envelope?.required_fields)
    ? example.request_envelope.required_fields
    : [];
  const authStateValues = Array.isArray(example?.authentication?.auth_state_values)
    ? example.authentication.auth_state_values
    : [];
  const surfacesSafe = example?.supported_surfaces?.tui_command_surface === true
    && example.supported_surfaces.local_api_like_envelope_contract === true
    && example.supported_surfaces.public_http_api_listener === false
    && example.supported_surfaces.gui_client === false
    && example.supported_surfaces.browser_extension === false
    && example.supported_surfaces.im_delivery === false
    && example.supported_surfaces.mobile_client === false
    && example.supported_surfaces.cloud_worker === false;
  const envelopeSafe = requiredEnvelopeFields.every((field) => envelopeFields.includes(field))
    && envelopeFields.length === requiredEnvelopeFields.length
    && example?.request_envelope?.caller_identity_placeholder_required === true
    && example.request_envelope.surface_id_required === true
    && example.request_envelope.workspace_id_required === true
    && example.request_envelope.idempotency_key_required === true
    && example.request_envelope.normalized_intent_hash_required === true
    && example.request_envelope.auth_state_required === true
    && example.request_envelope.rate_limit_state_required === true
    && example.request_envelope.policy_handoff_required === true
    && example.request_envelope.raw_intent_persisted === false
    && example.request_envelope.raw_remote_payload_persisted === false;
  const normalizationSafe = example?.normalization?.canonical_surface_required === true
    && example.normalization.normalized_intent_hash_algorithm === "sha256"
    && example.normalization.raw_payload_can_authorize_actions === false
    && example.normalization.unknown_surface_disposition === "observation_or_queued_intent_only";
  const authSafe = ["local_operator", "unknown", "unauthenticated"].every((state) => authStateValues.includes(state))
    && authStateValues.length === 3
    && example?.authentication?.unknown_or_unauthenticated_can_authorize_tools === false
    && example.authentication.device_identity_implemented === false
    && example.authentication.user_identity_implemented === false
    && example.authentication.remote_channel_identity_implemented === false
    && example.authentication.oauth_pairing_implemented === false
    && example.authentication.auth_token_persisted === false;
  const rateLimitSafe = example?.rate_limit?.rate_limit_state_required === true
    && example.rate_limit.rate_limit_enforcement_implemented === true
    && example.rate_limit.rate_limit_enforcement_scope === "tui_run_local_atomic_window_before_supervisor_handoff"
    && example.rate_limit.over_limit_can_execute_actions === false
    && example.rate_limit.background_queue_implemented === false;
  const idempotencySafe = example?.idempotency?.idempotency_key_required === true
    && example.idempotency.duplicate_detection_before_action_run_required === true
    && example.idempotency.duplicate_runtime_detector_implemented === true
    && example.idempotency.duplicate_runtime_detector_scope === "tui_run_local_atomic_reservation_before_supervisor_handoff"
    && example.idempotency.duplicate_key_can_reuse_authority === false
    && example.idempotency.replay_protection_required === true
    && example.idempotency.replay_protection_implemented === true
    && example.idempotency.cached_replay_scope === "tui_same_key_same_normalized_intent_completed_manifest_only"
    && example.idempotency.cached_replay_requires_completed_manifest === true
    && example.idempotency.cached_replay_reuses_policy_or_lease === false
    && example.idempotency.cached_replay_performs_live_side_effects === false
    && example.idempotency.durable_remote_replay_implemented === false;
  const runtimeDuplicateDetectorReady = idempotencyReservationSchemaPresent
    && idempotencyReservationExamplePresent
    && source.includes("reserveLocalIngressIdempotency")
    && source.includes("local-ingress-idempotency-reservation.schema.json")
    && source.includes("flag: \"wx\"")
    && source.includes("Duplicate ingress idempotency key has different normalized intent before action run")
    && tuiTests.includes("Ether run rejects duplicate idempotency keys with different intents before supervisor handoff")
    && contractTests.includes("local-ingress-idempotency-reservation.schema.json");
  const runtimeCachedReplayReady = idempotencyCompletionSchemaPresent
    && idempotencyCompletionExamplePresent
    && source.includes("writeLocalIngressIdempotencyCompletion")
    && source.includes("readAndValidateCachedIdempotencyCompletion")
    && source.includes("ingress_idempotency_replay=cached")
    && source.includes("local-ingress-idempotency-completion.schema.json")
    && tuiTests.includes("Ether run serves same-intent idempotency keys from cached replay evidence")
    && contractTests.includes("local-ingress-idempotency-completion.schema.json");
  const runtimeRateLimitReady = rateLimitReservationSchemaPresent
    && rateLimitReservationExamplePresent
    && source.includes("reserveLocalIngressRateLimit")
    && source.includes("local-ingress-rate-limit-reservation.schema.json")
    && source.includes("local_atomic_window_slot")
    && source.includes("TUI run ingress rate limit exceeded before action run")
    && tuiTests.includes("Ether run rejects local rate-limit overflow before supervisor handoff")
    && contractTests.includes("local-ingress-rate-limit-reservation.schema.json");
  const policyHandoffSafe = example?.policy_handoff?.local_supervisor_required === true
    && example.policy_handoff.tool_policy_proxy_required === true
    && example.policy_handoff.fresh_policy_required_for_actions === true
    && example.policy_handoff.scoped_lease_required_for_actions === true
    && example.policy_handoff.ingress_envelope_can_issue_lease === false
    && example.policy_handoff.ingress_envelope_can_authorize_side_effects === false;
  const remoteSurfaceSafe = example?.remote_surface_boundary?.remote_api_gateway_implemented === false
    && example.remote_surface_boundary.browser_extension_delivery_implemented === false
    && example.remote_surface_boundary.im_delivery_implemented === false
    && example.remote_surface_boundary.mobile_pairing_implemented === false
    && example.remote_surface_boundary.connector_oauth_implemented === false
    && example.remote_surface_boundary.cloud_worker_ingress_implemented === false
    && example.remote_surface_boundary.remote_surface_can_bypass_supervisor === false;
  const authoritySafe = example?.authority?.local_supervisor_is_root_authority === true
    && example.authority.event_ledger_is_fact_layer === true
    && example.authority.tool_policy_proxy_gates_side_effects === true
    && example.authority.ingress_contract_can_mutate_state === false
    && example.authority.ingress_contract_can_write_ledger === false
    && example.authority.ingress_contract_can_authorize_tools === false;
  const limitsSafe = example?.limits?.production_gateway_implemented === false
    && example.limits.public_http_listener_implemented === false
    && example.limits.persistent_session_tokens_implemented === false
    && example.limits.automatic_tool_execution_implemented === false
    && example.limits.real_remote_surface_ingress_implemented === false
    && example.limits.raw_external_payload_storage_implemented === false;
  const sourceReady = architecture.includes("normalize / authenticate / rate-limit / idempotency")
    && gapPlan.includes("Local ingress request envelope")
    && gapPlan.includes("Duplicate idempotency keys")
    && gapPlan.includes("rate-limit")
    && source.includes("function buildIngressAuditReport")
    && source.includes("local_ingress_readiness_contract");
  const testsReady = contractTests.includes("local ingress readiness rejects remote surface, auth, idempotency, and authority overclaims")
    && contractTests.includes("local-ingress-readiness.schema.json")
    && contractTests.includes("local ingress idempotency completions reject raw material, authority, mismatch, and live replay claims")
    && tuiTests.includes("Ether run rejects duplicate idempotency keys with different intents before supervisor handoff")
    && tuiTests.includes("Ether run serves same-intent idempotency keys from cached replay evidence")
    && tuiTests.includes("Ether run rejects local rate-limit overflow before supervisor handoff");
  const ok = schemaPresent
    && examplePresent
    && rateLimitReservationSchemaPresent
    && rateLimitReservationExamplePresent
    && idempotencyReservationSchemaPresent
    && idempotencyReservationExamplePresent
    && idempotencyCompletionSchemaPresent
    && idempotencyCompletionExamplePresent
    && surfacesSafe
    && envelopeSafe
    && normalizationSafe
    && authSafe
    && rateLimitSafe
    && idempotencySafe
    && runtimeRateLimitReady
    && runtimeDuplicateDetectorReady
    && runtimeCachedReplayReady
    && policyHandoffSafe
    && remoteSurfaceSafe
    && authoritySafe
    && limitsSafe
    && sourceReady
    && testsReady;
  return check(
    "local_ingress_readiness_contract",
    ok ? "pass" : "fail",
    ok ? "info" : "error",
    ok
      ? "Local ingress readiness contract requires envelope, auth-state, rate-limit, idempotency, and policy handoff metadata with TUI run local rate-limit, duplicate-key reservation, and same-intent cached replay before supervisor handoff, without enabling remote surfaces or authority bypass."
      : "Local ingress readiness contract is missing or overclaims remote ingress, authentication, idempotency, rate-limit, or authority behavior.",
    [
      `schema=${schemaPresent ? "present" : "missing"}`,
      `example=${examplePresent ? "present" : "missing"}`,
      `rate_limit_reservation_schema=${rateLimitReservationSchemaPresent ? "present" : "missing"}`,
      `rate_limit_reservation_example=${rateLimitReservationExamplePresent ? "present" : "missing"}`,
      `idempotency_reservation_schema=${idempotencyReservationSchemaPresent ? "present" : "missing"}`,
      `idempotency_reservation_example=${idempotencyReservationExamplePresent ? "present" : "missing"}`,
      `idempotency_completion_schema=${idempotencyCompletionSchemaPresent ? "present" : "missing"}`,
      `idempotency_completion_example=${idempotencyCompletionExamplePresent ? "present" : "missing"}`,
      `surfaces_safe=${String(surfacesSafe)}`,
      `envelope_safe=${String(envelopeSafe)}`,
      `normalization_safe=${String(normalizationSafe)}`,
      `auth_safe=${String(authSafe)}`,
      `rate_limit_safe=${String(rateLimitSafe)}`,
      `idempotency_safe=${String(idempotencySafe)}`,
      `runtime_rate_limit_ready=${String(runtimeRateLimitReady)}`,
      `runtime_duplicate_detector_ready=${String(runtimeDuplicateDetectorReady)}`,
      `runtime_cached_replay_ready=${String(runtimeCachedReplayReady)}`,
      `policy_handoff_safe=${String(policyHandoffSafe)}`,
      `remote_surface_safe=${String(remoteSurfaceSafe)}`,
      `authority_safe=${String(authoritySafe)}`,
      `limits_safe=${String(limitsSafe)}`,
      `source_ready=${String(sourceReady)}`,
      `tests_ready=${String(testsReady)}`
    ],
    "Restore local ingress readiness plus rate-limit/idempotency reservation/completion schemas/examples with required local envelope fields, atomic TUI run rate-limit, duplicate-key reservation, same-intent cached replay before supervisor handoff, unknown/unauthenticated denial, policy handoff requirements, and no remote surface or authority claims."
  );
}

function modelProviderReadinessContractCheck(): DoctorCheck {
  const schemaPresent = existsRepoFile("schemas/model-provider-readiness.schema.json");
  const examplePresent = existsRepoFile("examples/contracts/model-provider-readiness.json");
  const source = readRepoText("packages/harness-core/src/model-provider.ts") ?? "";
  const tests = readRepoText("packages/harness-core/test/harness-core.test.ts") ?? "";
  const example = readRepoJson("examples/contracts/model-provider-readiness.json") as {
    interfaces?: Array<{
      provider_ref?: unknown;
      api_surface?: unknown;
      credential_env_vars?: unknown;
      externally_supplied_oauth_bearer_allowed?: unknown;
      oauth_flow_implemented?: unknown;
      connector_grant_implemented?: unknown;
      no_tools_mode?: unknown;
      tool_call_outputs_rejected?: unknown;
    }>;
    credential_boundary?: {
      credential_values_in_examples?: unknown;
      credential_values_persisted?: unknown;
      credential_refs_persisted?: unknown;
      credential_resolution_recorded_as_authority?: unknown;
    };
    no_tools_guard?: {
      declares_provider_tools?: unknown;
      tool_choice?: unknown;
      tool_calls_fail_closed?: unknown;
      executable_code_fail_closed?: unknown;
      response_written_after_tool_call?: unknown;
    };
    persistence?: {
      raw_prompt_persisted?: unknown;
      raw_request_payload_persisted?: unknown;
      raw_response_payload_persisted?: unknown;
      raw_model_output_persisted?: unknown;
      provider_error_body_persisted?: unknown;
    };
    error_taxonomy?: {
      error_type?: unknown;
      codes?: unknown;
      categories?: unknown;
      retryable_metadata_present?: unknown;
      http_status_metadata_present?: unknown;
      credential_values_in_errors?: unknown;
      raw_provider_error_body_persisted?: unknown;
      tool_call_outputs_persisted_on_error?: unknown;
    };
    authority?: {
      model_output_can_authorize_actions?: unknown;
      provider_credential_can_grant_tool_authority?: unknown;
      provider_call_can_issue_lease?: unknown;
      requires_local_supervisor_for_actions?: unknown;
      requires_scoped_lease_for_actions?: unknown;
    };
    limits?: {
      oauth_flows_implemented?: unknown;
      token_refresh_implemented?: unknown;
      connector_grants_implemented?: unknown;
      streaming_implemented?: unknown;
      multimodal_payloads_implemented?: unknown;
      legacy_openai_text_completions_implemented?: unknown;
    };
  } | null;
  const interfaces = Array.isArray(example?.interfaces) ? example.interfaces : [];
  const providerRefs = new Set(interfaces.map((entry) => entry.provider_ref).filter((value): value is string => typeof value === "string"));
  const apiSurfaces = new Set(interfaces.map((entry) => entry.api_surface).filter((value): value is string => typeof value === "string"));
  const requiredProviderRefs = [
    "provider_openai_responses",
    "provider_openai_chat_completions",
    "provider_anthropic",
    "provider_gemini"
  ];
  const requiredApiSurfaces = [
    "openai_responses_api",
    "openai_chat_completions_api",
    "anthropic_messages_api",
    "gemini_generate_content_api"
  ];
  const providersDeclared = requiredProviderRefs.every((ref) => providerRefs.has(ref))
    && requiredApiSurfaces.every((surface) => apiSurfaces.has(surface));
  const providerFlagsSafe = interfaces.length === 4 && interfaces.every((entry) =>
    entry.oauth_flow_implemented === false
    && entry.connector_grant_implemented === false
    && entry.no_tools_mode === true
    && entry.tool_call_outputs_rejected === true
  );
  const openAiOAuthNamed = interfaces
    .filter((entry) => entry.provider_ref === "provider_openai_responses" || entry.provider_ref === "provider_openai_chat_completions")
    .every((entry) => Array.isArray(entry.credential_env_vars) && entry.credential_env_vars.includes("OPENAI_OAUTH_ACCESS_TOKEN") && entry.externally_supplied_oauth_bearer_allowed === true);
  const geminiOAuthNamed = interfaces.some((entry) =>
    entry.provider_ref === "provider_gemini"
    && Array.isArray(entry.credential_env_vars)
    && entry.credential_env_vars.includes("GEMINI_OAUTH_ACCESS_TOKEN")
    && entry.credential_env_vars.includes("GOOGLE_OAUTH_ACCESS_TOKEN")
    && entry.externally_supplied_oauth_bearer_allowed === true
  );
  const anthropicBoundaryNamed = interfaces.some((entry) =>
    entry.provider_ref === "provider_anthropic"
    && Array.isArray(entry.credential_env_vars)
    && entry.credential_env_vars.includes("ANTHROPIC_API_KEY")
    && entry.externally_supplied_oauth_bearer_allowed === false
  );
  const boundarySafe = example?.credential_boundary?.credential_values_in_examples === false
    && example.credential_boundary.credential_values_persisted === false
    && example.credential_boundary.credential_refs_persisted === false
    && example.credential_boundary.credential_resolution_recorded_as_authority === false
    && example.no_tools_guard?.declares_provider_tools === false
    && example.no_tools_guard.tool_choice === "none"
    && example.no_tools_guard.tool_calls_fail_closed === true
    && example.no_tools_guard.executable_code_fail_closed === true
    && example.no_tools_guard.response_written_after_tool_call === false
    && example.persistence?.raw_prompt_persisted === false
    && example.persistence.raw_request_payload_persisted === false
    && example.persistence.raw_response_payload_persisted === false
    && example.persistence.raw_model_output_persisted === false
    && example.persistence.provider_error_body_persisted === false
    && example.authority?.model_output_can_authorize_actions === false
    && example.authority.provider_credential_can_grant_tool_authority === false
    && example.authority.provider_call_can_issue_lease === false
    && example.authority.requires_local_supervisor_for_actions === true
    && example.authority.requires_scoped_lease_for_actions === true;
  const taxonomyCodes = Array.isArray(example?.error_taxonomy?.codes)
    ? example.error_taxonomy.codes.filter((value): value is string => typeof value === "string")
    : [];
  const taxonomyCategories = Array.isArray(example?.error_taxonomy?.categories)
    ? example.error_taxonomy.categories.filter((value): value is string => typeof value === "string")
    : [];
  const requiredErrorCodes = [
    "provider_unknown",
    "provider_missing_credential",
    "provider_invalid_timeout",
    "provider_network_failure",
    "provider_timeout",
    "provider_http_error",
    "provider_malformed_json",
    "provider_tool_call_rejected"
  ];
  const requiredErrorCategories = [
    "configuration",
    "credential",
    "network",
    "upstream_http",
    "upstream_payload",
    "no_tools_guard"
  ];
  const errorTaxonomySafe = example?.error_taxonomy?.error_type === "ModelProviderError"
    && requiredErrorCodes.every((code) => taxonomyCodes.includes(code))
    && requiredErrorCategories.every((category) => taxonomyCategories.includes(category))
    && example.error_taxonomy.retryable_metadata_present === true
    && example.error_taxonomy.http_status_metadata_present === true
    && example.error_taxonomy.credential_values_in_errors === false
    && example.error_taxonomy.raw_provider_error_body_persisted === false
    && example.error_taxonomy.tool_call_outputs_persisted_on_error === false;
  const limitsSafe = example?.limits?.oauth_flows_implemented === false
    && example.limits.token_refresh_implemented === false
    && example.limits.connector_grants_implemented === false
    && example.limits.streaming_implemented === false
    && example.limits.multimodal_payloads_implemented === false
    && example.limits.legacy_openai_text_completions_implemented === false;
  const sourceReady = requiredProviderRefs.every((ref) => source.includes(ref))
    && source.includes("OPENAI_RESPONSES_URL")
    && source.includes("OPENAI_CHAT_COMPLETIONS_URL")
    && source.includes("ANTHROPIC_MESSAGES_URL")
    && source.includes("GEMINI_GENERATE_CONTENT_BASE_URL")
    && source.includes("assertNoProviderToolCalls")
    && source.includes("class ModelProviderError")
    && source.includes("MODEL_PROVIDER_ERROR_CODES");
  const testsReady = tests.includes("live model providers map official API surfaces")
    && tests.includes("live model providers reject tool calls in no-tools mode")
    && tests.includes("live model provider errors expose stable taxonomy")
    && tests.includes("OPENAI_OAUTH_ACCESS_TOKEN")
    && tests.includes("GOOGLE_OAUTH_ACCESS_TOKEN");
  const ok = schemaPresent
    && examplePresent
    && providersDeclared
    && providerFlagsSafe
    && openAiOAuthNamed
    && geminiOAuthNamed
    && anthropicBoundaryNamed
    && boundarySafe
    && errorTaxonomySafe
    && limitsSafe
    && sourceReady
    && testsReady;
  return check(
    "model_provider_readiness_contract",
    ok ? "pass" : "fail",
    ok ? "info" : "error",
    ok
      ? "Model provider readiness contract covers OpenAI Responses, OpenAI Chat Completions, Anthropic Messages, Gemini generateContent, and stable provider error taxonomy without OAuth-flow or connector-grant overclaiming."
      : "Model provider readiness contract is missing or overclaims provider, OAuth, persistence, tool-call, error-taxonomy, or authority behavior.",
    [
      `schema=${schemaPresent ? "present" : "missing"}`,
      `example=${examplePresent ? "present" : "missing"}`,
      `provider_refs=${[...providerRefs].sort().join(",") || "missing"}`,
      `api_surfaces=${[...apiSurfaces].sort().join(",") || "missing"}`,
      `provider_flags_safe=${String(providerFlagsSafe)}`,
      `openai_external_bearer_env=${String(openAiOAuthNamed)}`,
      `gemini_external_bearer_env=${String(geminiOAuthNamed)}`,
      `anthropic_direct_api_key_only=${String(anthropicBoundaryNamed)}`,
      `credential_boundary_safe=${String(boundarySafe)}`,
      `error_taxonomy_safe=${String(errorTaxonomySafe)}`,
      `limits_safe=${String(limitsSafe)}`,
      `source_ready=${String(sourceReady)}`,
      `tests_ready=${String(testsReady)}`
    ],
    "Restore schemas/model-provider-readiness.schema.json, examples/contracts/model-provider-readiness.json, and the no-tools provider boundary without raw credential persistence, OAuth-flow claims, connector grants, raw provider error bodies, or model-output authority."
  );
}

function vaultPolicyBindingContractCheck(): DoctorCheck {
  const schemaPresent = existsRepoFile("schemas/vault-policy-binding.schema.json");
  const examplePresent = existsRepoFile("examples/contracts/vault-policy-binding.json");
  const vaultSchema = readRepoText("schemas/vault-reference.schema.json") ?? "";
  const policySchema = readRepoText("schemas/policy-decision.schema.json") ?? "";
  const providerReadiness = readRepoText("examples/contracts/model-provider-readiness.json") ?? "";
  const tests = readRepoText("packages/harness-core/test/harness-core.test.ts") ?? "";
  const example = readRepoJson("examples/contracts/vault-policy-binding.json") as {
    vault_reference?: {
      schema?: unknown;
      id?: unknown;
      uri?: unknown;
      fingerprint?: unknown;
      material_kind?: unknown;
    };
    policy_decision_binding?: {
      policy_decision_schema?: unknown;
      policy_decision_id?: unknown;
      tool_request_id?: unknown;
      allowed_reference_scopes?: unknown;
      fresh_policy_required?: unknown;
      scoped_lease_required?: unknown;
      may_cite_vault_reference?: unknown;
      may_resolve_secret?: unknown;
      may_copy_secret?: unknown;
      vault_reference_can_authorize_action?: unknown;
    };
    provider_boundary?: {
      provider_readiness_schema?: unknown;
      supported_provider_refs?: unknown;
      future_credential_source?: unknown;
      current_provider_vault_resolution?: unknown;
      provider_call_authorized_by_reference?: unknown;
      connector_grant_authorized_by_reference?: unknown;
    };
    redaction?: {
      ledger_material?: unknown;
      artifact_material?: unknown;
      run_manifest_material?: unknown;
      stdout_material?: unknown;
    };
    authority?: {
      local_supervisor_required_for_actions?: unknown;
      tool_policy_proxy_required_for_egress?: unknown;
      scoped_lease_required_for_secret_use?: unknown;
      binding_can_issue_lease?: unknown;
      binding_can_authorize_egress?: unknown;
      binding_can_create_connector_grant?: unknown;
    };
    limits?: {
      raw_secret_persisted?: unknown;
      raw_secret_available_to_aetherion?: unknown;
      secret_resolution_implemented?: unknown;
      provider_vault_resolution_implemented?: unknown;
      oauth_flow_implemented?: unknown;
      token_refresh_implemented?: unknown;
      connector_grant_implemented?: unknown;
      egress_allowed_by_binding?: unknown;
    };
  } | null;
  const providerRefs = Array.isArray(example?.provider_boundary?.supported_provider_refs)
    ? example.provider_boundary.supported_provider_refs
    : [];
  const requiredProviderRefs = [
    "provider_openai_responses",
    "provider_openai_chat_completions",
    "provider_anthropic",
    "provider_gemini"
  ];
  const vaultRefSafe = example?.vault_reference?.schema === "vault-reference.schema.json"
    && typeof example.vault_reference.id === "string"
    && example.vault_reference.id.startsWith("vaultref_")
    && typeof example.vault_reference.uri === "string"
    && example.vault_reference.uri.startsWith("vault://")
    && typeof example.vault_reference.fingerprint === "string"
    && example.vault_reference.fingerprint.startsWith("sha256:")
    && example.vault_reference.material_kind === "opaque_secret_reference";
  const allowedScopes = Array.isArray(example?.policy_decision_binding?.allowed_reference_scopes)
    ? example.policy_decision_binding.allowed_reference_scopes
    : [];
  const policyBindingSafe = example?.policy_decision_binding?.policy_decision_schema === "policy-decision.schema.json"
    && typeof example.policy_decision_binding.policy_decision_id === "string"
    && example.policy_decision_binding.policy_decision_id.startsWith("policy_")
    && typeof example.policy_decision_binding.tool_request_id === "string"
    && example.policy_decision_binding.tool_request_id.startsWith("toolreq_")
    && allowedScopes.length === 1
    && allowedScopes[0] === "policy_decision"
    && example.policy_decision_binding.fresh_policy_required === true
    && example.policy_decision_binding.scoped_lease_required === true
    && example.policy_decision_binding.may_cite_vault_reference === true
    && example.policy_decision_binding.may_resolve_secret === false
    && example.policy_decision_binding.may_copy_secret === false
    && example.policy_decision_binding.vault_reference_can_authorize_action === false;
  const providerBoundarySafe = example?.provider_boundary?.provider_readiness_schema === "model-provider-readiness.schema.json"
    && requiredProviderRefs.every((ref) => providerRefs.includes(ref))
    && example.provider_boundary.future_credential_source === "vault_reference_metadata_only"
    && example.provider_boundary.current_provider_vault_resolution === false
    && example.provider_boundary.provider_call_authorized_by_reference === false
    && example.provider_boundary.connector_grant_authorized_by_reference === false;
  const redactionSafe = example?.redaction?.ledger_material === "reference_and_fingerprint_only"
    && example.redaction.artifact_material === "reference_and_fingerprint_only"
    && example.redaction.run_manifest_material === "reference_and_fingerprint_only"
    && example.redaction.stdout_material === "reference_and_fingerprint_only";
  const authoritySafe = example?.authority?.local_supervisor_required_for_actions === true
    && example.authority.tool_policy_proxy_required_for_egress === true
    && example.authority.scoped_lease_required_for_secret_use === true
    && example.authority.binding_can_issue_lease === false
    && example.authority.binding_can_authorize_egress === false
    && example.authority.binding_can_create_connector_grant === false;
  const limitsSafe = example?.limits?.raw_secret_persisted === false
    && example.limits.raw_secret_available_to_aetherion === false
    && example.limits.secret_resolution_implemented === false
    && example.limits.provider_vault_resolution_implemented === false
    && example.limits.oauth_flow_implemented === false
    && example.limits.token_refresh_implemented === false
    && example.limits.connector_grant_implemented === false
    && example.limits.egress_allowed_by_binding === false;
  const sourceReady = vaultSchema.includes("policy_binding")
    && vaultSchema.includes("reference_and_fingerprint_only")
    && policySchema.includes("policy-decision.schema.json")
    && providerReadiness.includes("provider_openai_chat_completions")
    && providerReadiness.includes("legacy_openai_text_completions_implemented");
  const testsReady = tests.includes("vault policy bindings reject secret resolution, egress, connector grant, and authority overclaims")
    && tests.includes("vault-policy-binding.schema.json");
  const ok = schemaPresent
    && examplePresent
    && vaultRefSafe
    && policyBindingSafe
    && providerBoundarySafe
    && redactionSafe
    && authoritySafe
    && limitsSafe
    && sourceReady
    && testsReady;
  return check(
    "vault_policy_binding_contract",
    ok ? "pass" : "fail",
    ok ? "info" : "error",
    ok
      ? "Vault policy binding contract proves policy decisions may cite vault references as metadata without secret resolution, egress, connector grants, or authority transfer."
      : "Vault policy binding contract is missing or overclaims secret resolution, egress, provider vault resolution, connector grants, or authority behavior.",
    [
      `schema=${schemaPresent ? "present" : "missing"}`,
      `example=${examplePresent ? "present" : "missing"}`,
      `vault_ref_citation_safe=${String(vaultRefSafe)}`,
      `policy_binding_safe=${String(policyBindingSafe)}`,
      `provider_boundary_safe=${String(providerBoundarySafe)}`,
      `redaction_safe=${String(redactionSafe)}`,
      `authority_safe=${String(authoritySafe)}`,
      `limits_safe=${String(limitsSafe)}`,
      `source_ready=${String(sourceReady)}`,
      `tests_ready=${String(testsReady)}`
    ],
    "Restore schemas/vault-policy-binding.schema.json and examples/contracts/vault-policy-binding.json with metadata-only vault refs, fresh-policy and scoped-lease requirements, reference/fingerprint-only redaction, and no secret resolution, egress, connector grant, or authority claims."
  );
}

function supervisorLifecycleReadinessContractCheck(): DoctorCheck {
  const schemaPresent = existsRepoFile("schemas/supervisor-lifecycle-readiness.schema.json");
  const examplePresent = existsRepoFile("examples/contracts/supervisor-lifecycle-readiness.json");
  const commandSchemaPresent = existsRepoFile("schemas/supervisor-lifecycle-command.schema.json");
  const commandExamplePresent = existsRepoFile("examples/contracts/supervisor-lifecycle-command.json");
  const source = readRepoText("packages/tui/src/cli.ts") ?? "";
  const tests = readRepoText("packages/tui/test/tui.test.ts") ?? "";
  const supervisorReadme = readRepoText("crates/supervisor/README.md") ?? "";
  const example = readRepoJson("examples/contracts/supervisor-lifecycle-readiness.json") as {
    supported_runtime_modes?: {
      stdio_rpc?: unknown;
      foreground_unix_socket?: unknown;
      foreground_workspace_lock?: unknown;
      production_daemon?: unknown;
      service_installation?: unknown;
      background_process_manager?: unknown;
    };
    lifecycle_commands?: Array<{
      command?: unknown;
      supported?: unknown;
      implemented?: unknown;
      read_only?: unknown;
      idempotent?: unknown;
      mutates_ledger?: unknown;
      issues_lease?: unknown;
      repairs_state?: unknown;
    }>;
    runtime_lock?: {
      lock_path?: unknown;
      workspace_bound?: unknown;
      owner_pid_reported?: unknown;
      owner_process_status_reported?: unknown;
      stale_lock_detected?: unknown;
      stale_lock_repaired?: unknown;
      runtime_lock_can_authorize_actions?: unknown;
      reported_fields?: unknown;
    };
    socket_auth_boundary?: {
      caller_supplied_token_supported?: unknown;
      token_value_persisted?: unknown;
      token_rotation_implemented?: unknown;
      device_identity_implemented?: unknown;
      user_identity_implemented?: unknown;
      pairing_implemented?: unknown;
      vault_backed_token_storage?: unknown;
    };
    vault_boundary?: {
      vault_reference_contract_present?: unknown;
      raw_secret_available_to_supervisor?: unknown;
      secret_retrieval_api_implemented?: unknown;
      provider_tokens_resolved_by_supervisor?: unknown;
    };
    authority?: {
      local_supervisor_is_root_authority?: unknown;
      workspace_id_derived_from_root?: unknown;
      lifecycle_contract_can_issue_lease?: unknown;
      socket_token_can_authorize_tools?: unknown;
      preflight_can_mutate_state?: unknown;
      status_can_mutate_ledger?: unknown;
    };
    limits?: {
      production_daemon_implemented?: unknown;
      start_command_implemented?: unknown;
      stop_command_implemented?: unknown;
      recover_stale_lock_command_implemented?: unknown;
      socket_auth_lifecycle_implemented?: unknown;
      vault_backend_implemented?: unknown;
      signer_implemented?: unknown;
      process_sandbox_implemented?: unknown;
      cloud_worker_implemented?: unknown;
    };
  } | null;
  const commands = Array.isArray(example?.lifecycle_commands) ? example.lifecycle_commands : [];
  const commandByName = new Map(commands
    .filter((entry): entry is typeof entry & { command: string } => typeof entry.command === "string")
    .map((entry) => [entry.command, entry]));
  const readOnlyCommandSafe = ["supervisor status", "supervisor preflight"].every((name) => {
    const command = commandByName.get(name);
    return command?.supported === true
      && command.read_only === true
      && command.idempotent === true
      && command.mutates_ledger === false
      && command.issues_lease === false
      && command.repairs_state === false;
  });
  const unsupportedLifecycleSafe = ["supervisor start", "supervisor stop", "supervisor recover-stale-lock"].every((name) => {
    const command = commandByName.get(name);
    return command?.supported === false
      && command.implemented === false
      && command.mutates_ledger === false
      && command.issues_lease === false
      && command.repairs_state === false;
  });
  const runtimeModesSafe = example?.supported_runtime_modes?.stdio_rpc === true
    && example.supported_runtime_modes.foreground_unix_socket === true
    && example.supported_runtime_modes.foreground_workspace_lock === true
    && example.supported_runtime_modes.production_daemon === false
    && example.supported_runtime_modes.service_installation === false
    && example.supported_runtime_modes.background_process_manager === false;
  const reportedFields = Array.isArray(example?.runtime_lock?.reported_fields)
    ? example.runtime_lock.reported_fields
    : [];
  const requiredRuntimeLockFields = [
    "runtime_lock_present",
    "runtime_lock_path",
    "runtime_lock_pid",
    "runtime_lock_transport",
    "runtime_lock_workspace_id",
    "runtime_lock_socket_path",
    "runtime_lock_workspace_match",
    "runtime_lock_process_status",
    "runtime_lock_stale",
    "runtime_lock_parse_error"
  ];
  const runtimeLockSafe = example?.runtime_lock?.lock_path === ".aetherion/supervisor.lock"
    && example.runtime_lock.workspace_bound === true
    && example.runtime_lock.owner_pid_reported === true
    && example.runtime_lock.owner_process_status_reported === true
    && example.runtime_lock.stale_lock_detected === true
    && example.runtime_lock.stale_lock_repaired === false
    && example.runtime_lock.runtime_lock_can_authorize_actions === false
    && requiredRuntimeLockFields.every((field) => reportedFields.includes(field));
  const socketAuthBoundarySafe = example?.socket_auth_boundary?.caller_supplied_token_supported === true
    && example.socket_auth_boundary.token_value_persisted === false
    && example.socket_auth_boundary.token_rotation_implemented === false
    && example.socket_auth_boundary.device_identity_implemented === false
    && example.socket_auth_boundary.user_identity_implemented === false
    && example.socket_auth_boundary.pairing_implemented === false
    && example.socket_auth_boundary.vault_backed_token_storage === false;
  const vaultBoundarySafe = example?.vault_boundary?.vault_reference_contract_present === true
    && example.vault_boundary.raw_secret_available_to_supervisor === false
    && example.vault_boundary.secret_retrieval_api_implemented === false
    && example.vault_boundary.provider_tokens_resolved_by_supervisor === false;
  const authoritySafe = example?.authority?.local_supervisor_is_root_authority === true
    && example.authority.workspace_id_derived_from_root === true
    && example.authority.lifecycle_contract_can_issue_lease === false
    && example.authority.socket_token_can_authorize_tools === false
    && example.authority.preflight_can_mutate_state === false
    && example.authority.status_can_mutate_ledger === false;
  const limitsSafe = example?.limits?.production_daemon_implemented === false
    && example.limits.start_command_implemented === false
    && example.limits.stop_command_implemented === false
    && example.limits.recover_stale_lock_command_implemented === false
    && example.limits.socket_auth_lifecycle_implemented === false
    && example.limits.vault_backend_implemented === false
    && example.limits.signer_implemented === false
    && example.limits.process_sandbox_implemented === false
    && example.limits.cloud_worker_implemented === false;
  const sourceReady = source.includes("supervisor supports status, preflight, start, stop, and recover-stale-lock")
    && source.includes("function supervisorLifecyclePreflight")
    && source.includes("function supervisorUnsupportedLifecycleCommandReport")
    && source.includes("supervisor-lifecycle-command.schema.json")
    && source.includes("unsupported_fail_closed")
    && source.includes("start_supported: false")
    && source.includes("repair_supported: false")
    && source.includes("runtime_lock_stale")
    && source.includes("socketAuthToken")
    && supervisorReadme.includes("Production daemon lifecycle")
    && supervisorReadme.includes("stale supervisor runtime-lock recovery")
    && supervisorReadme.includes("Real vault backend");
  const testsReady = tests.includes("TUI supervisor status reports Rust runtime health without appending events")
    && tests.includes("supervisor lifecycle unsupported commands fail closed")
    && tests.includes("foreground_socket_running")
    && tests.includes("stale_runtime_lock")
    && tests.includes("start_supported")
    && tests.includes("repair_supported");
  const ok = schemaPresent
    && examplePresent
    && commandSchemaPresent
    && commandExamplePresent
    && commands.length === 5
    && readOnlyCommandSafe
    && unsupportedLifecycleSafe
    && runtimeModesSafe
    && runtimeLockSafe
    && socketAuthBoundarySafe
    && vaultBoundarySafe
    && authoritySafe
    && limitsSafe
    && sourceReady
    && testsReady;
  return check(
    "supervisor_lifecycle_readiness_contract",
    ok ? "pass" : "fail",
    ok ? "info" : "error",
    ok
      ? "Supervisor lifecycle readiness contract covers read-only status/preflight, foreground socket lock observation, and unsupported production lifecycle boundaries."
      : "Supervisor lifecycle readiness contract is missing or overclaims daemon, socket-auth, stale-lock repair, vault, lease, or tool authority behavior.",
    [
      `schema=${schemaPresent ? "present" : "missing"}`,
      `example=${examplePresent ? "present" : "missing"}`,
      `command_schema=${commandSchemaPresent ? "present" : "missing"}`,
      `command_example=${commandExamplePresent ? "present" : "missing"}`,
      `commands=${[...commandByName.keys()].sort().join(",") || "missing"}`,
      `read_only_status_preflight=${String(readOnlyCommandSafe)}`,
      `start_stop_recover_unsupported=${String(unsupportedLifecycleSafe)}`,
      `runtime_modes_safe=${String(runtimeModesSafe)}`,
      `runtime_lock_observable_only=${String(runtimeLockSafe)}`,
      `socket_auth_boundary_safe=${String(socketAuthBoundarySafe)}`,
      `vault_boundary_safe=${String(vaultBoundarySafe)}`,
      `authority_safe=${String(authoritySafe)}`,
      `limits_safe=${String(limitsSafe)}`,
      `source_ready=${String(sourceReady)}`,
      `tests_ready=${String(testsReady)}`
    ],
    "Restore supervisor lifecycle readiness and command schemas/examples plus the status/preflight/unsupported-command boundary without claiming production daemon lifecycle, socket-auth lifecycle, stale-lock repair, vault backend, or lease authority."
  );
}

function supervisorSocketAuthBoundaryContractCheck(): DoctorCheck {
  const schemaPresent = existsRepoFile("schemas/supervisor-socket-auth-boundary.schema.json");
  const examplePresent = existsRepoFile("examples/contracts/supervisor-socket-auth-boundary.json");
  const supervisorSource = readRepoText("crates/supervisor/src/main.rs") ?? "";
  const supervisorReadme = readRepoText("crates/supervisor/README.md") ?? "";
  const tuiSource = readRepoText("packages/tui/src/cli.ts") ?? "";
  const tuiTests = readRepoText("packages/tui/test/tui.test.ts") ?? "";
  const contractTests = readRepoText("packages/harness-core/test/harness-core.test.ts") ?? "";
  const example = readRepoJson("examples/contracts/supervisor-socket-auth-boundary.json") as {
    transport_gate?: {
      foreground_unix_socket_supported?: unknown;
      stdio_requires_auth_token?: unknown;
      public_network_listener?: unknown;
      remote_client_supported?: unknown;
    };
    request_auth?: {
      caller_supplied_token_supported?: unknown;
      missing_token_rejected?: unknown;
      wrong_token_rejected?: unknown;
      correct_token_allows_rpc_dispatch?: unknown;
      token_value_echoed?: unknown;
      token_value_persisted?: unknown;
      token_hash_persisted?: unknown;
      auth_failure_writes_ledger?: unknown;
      auth_failure_writes_artifact?: unknown;
    };
    workspace_binding?: {
      workspace_root_binding_supported?: unknown;
      workspace_id_derived_from_root?: unknown;
      workspace_mismatch_rejected?: unknown;
      mismatch_initializes_other_workspace?: unknown;
      mismatch_writes_ledger?: unknown;
    };
    runtime_lock_boundary?: {
      foreground_lock_workspace_bound?: unknown;
      runtime_lock_observable?: unknown;
      runtime_lock_can_authorize_actions?: unknown;
      stale_lock_repair_by_auth_token?: unknown;
    };
    vault_boundary?: {
      vault_reference_secret_family?: unknown;
      vault_storage_implemented?: unknown;
      token_rotation_implemented?: unknown;
      token_refresh_implemented?: unknown;
      secret_retrieval_api_implemented?: unknown;
    };
    authority?: {
      local_supervisor_required_for_actions?: unknown;
      tool_policy_proxy_required_for_actions?: unknown;
      socket_token_can_authorize_tools?: unknown;
      socket_token_can_issue_lease?: unknown;
      socket_token_can_issue_session?: unknown;
      socket_token_can_override_policy?: unknown;
    };
    limits?: {
      socket_auth_lifecycle_implemented?: unknown;
      device_identity_implemented?: unknown;
      user_identity_implemented?: unknown;
      pairing_implemented?: unknown;
      production_daemon_implemented?: unknown;
      public_api_listener_implemented?: unknown;
      connector_oauth_implemented?: unknown;
      cloud_worker_implemented?: unknown;
    };
  } | null;
  const transportSafe = example?.transport_gate?.foreground_unix_socket_supported === true
    && example.transport_gate.stdio_requires_auth_token === false
    && example.transport_gate.public_network_listener === false
    && example.transport_gate.remote_client_supported === false;
  const requestAuthSafe = example?.request_auth?.caller_supplied_token_supported === true
    && example.request_auth.missing_token_rejected === true
    && example.request_auth.wrong_token_rejected === true
    && example.request_auth.correct_token_allows_rpc_dispatch === true
    && example.request_auth.token_value_echoed === false
    && example.request_auth.token_value_persisted === false
    && example.request_auth.token_hash_persisted === false
    && example.request_auth.auth_failure_writes_ledger === false
    && example.request_auth.auth_failure_writes_artifact === false;
  const workspaceBindingSafe = example?.workspace_binding?.workspace_root_binding_supported === true
    && example.workspace_binding.workspace_id_derived_from_root === true
    && example.workspace_binding.workspace_mismatch_rejected === true
    && example.workspace_binding.mismatch_initializes_other_workspace === false
    && example.workspace_binding.mismatch_writes_ledger === false;
  const runtimeLockSafe = example?.runtime_lock_boundary?.foreground_lock_workspace_bound === true
    && example.runtime_lock_boundary.runtime_lock_observable === true
    && example.runtime_lock_boundary.runtime_lock_can_authorize_actions === false
    && example.runtime_lock_boundary.stale_lock_repair_by_auth_token === false;
  const vaultBoundarySafe = example?.vault_boundary?.vault_reference_secret_family === "local_socket_token"
    && example.vault_boundary.vault_storage_implemented === false
    && example.vault_boundary.token_rotation_implemented === false
    && example.vault_boundary.token_refresh_implemented === false
    && example.vault_boundary.secret_retrieval_api_implemented === false;
  const authoritySafe = example?.authority?.local_supervisor_required_for_actions === true
    && example.authority.tool_policy_proxy_required_for_actions === true
    && example.authority.socket_token_can_authorize_tools === false
    && example.authority.socket_token_can_issue_lease === false
    && example.authority.socket_token_can_issue_session === false
    && example.authority.socket_token_can_override_policy === false;
  const limitsSafe = example?.limits?.socket_auth_lifecycle_implemented === false
    && example.limits.device_identity_implemented === false
    && example.limits.user_identity_implemented === false
    && example.limits.pairing_implemented === false
    && example.limits.production_daemon_implemented === false
    && example.limits.public_api_listener_implemented === false
    && example.limits.connector_oauth_implemented === false
    && example.limits.cloud_worker_implemented === false;
  const sourceReady = supervisorSource.includes("socket RPC auth failed")
    && supervisorSource.includes("socket RPC workspace binding mismatch")
    && supervisorSource.includes("auth_token")
    && supervisorReadme.includes("caller-supplied socket `auth_token`")
    && supervisorReadme.includes("not device identity, user identity, pairing, or a vault")
    && tuiSource.includes("socketAuthToken")
    && tuiSource.includes("--socket-auth-token");
  const testsReady = contractTests.includes("supervisor-socket-auth-boundary.schema.json")
    && contractTests.includes("supervisor socket auth boundary rejects token persistence, remote clients, and authority")
    && tuiTests.includes("TUI run over supervisor socket honors auth and workspace binding")
    && tuiTests.includes("supervisor socket RPC can require an explicit auth token")
    && tuiTests.includes("socket RPC auth failed")
    && tuiTests.includes("socket RPC workspace binding mismatch");
  const ok = schemaPresent
    && examplePresent
    && transportSafe
    && requestAuthSafe
    && workspaceBindingSafe
    && runtimeLockSafe
    && vaultBoundarySafe
    && authoritySafe
    && limitsSafe
    && sourceReady
    && testsReady;
  return check(
    "supervisor_socket_auth_boundary_contract",
    ok ? "pass" : "fail",
    ok ? "info" : "error",
    ok
      ? "Supervisor socket auth boundary contract proves caller-supplied foreground socket tokens gate local RPC dispatch without becoming identity, vault storage, session, lease, or tool authority."
      : "Supervisor socket auth boundary contract is missing or overclaims identity, token lifecycle, vault storage, remote clients, session, lease, or tool authority behavior.",
    [
      `schema=${schemaPresent ? "present" : "missing"}`,
      `example=${examplePresent ? "present" : "missing"}`,
      `transport_safe=${String(transportSafe)}`,
      `request_auth_safe=${String(requestAuthSafe)}`,
      `workspace_binding_safe=${String(workspaceBindingSafe)}`,
      `runtime_lock_safe=${String(runtimeLockSafe)}`,
      `vault_boundary_safe=${String(vaultBoundarySafe)}`,
      `authority_safe=${String(authoritySafe)}`,
      `limits_safe=${String(limitsSafe)}`,
      `source_ready=${String(sourceReady)}`,
      `tests_ready=${String(testsReady)}`
    ],
    "Restore schemas/supervisor-socket-auth-boundary.schema.json and examples/contracts/supervisor-socket-auth-boundary.json with caller-supplied local socket auth gating, missing/wrong token and workspace mismatch rejection, no token persistence or echo, no remote listener/client claim, no vault storage, and no session, lease, tool, or policy authority."
  );
}

function ledgerIntegrityExtensionReadinessContractCheck(): DoctorCheck {
  const schemaPresent = existsRepoFile("schemas/ledger-integrity-extension-readiness.schema.json");
  const examplePresent = existsRepoFile("examples/contracts/ledger-integrity-extension-readiness.json");
  const ledgerSource = readRepoText("packages/harness-core/src/ledger.ts") ?? "";
  const replaySource = readRepoText("packages/harness-core/src/replay.ts") ?? "";
  const contractTests = readRepoText("packages/harness-core/test/harness-core.test.ts") ?? "";
  const technicalStrategy = readRepoText("docs/10-technical-strategy.md") ?? "";
  const governance = readRepoText("docs/13-schema-runtime-governance.md") ?? "";
  const runtimePlan = readRepoText("docs/14-runtime-loop-plan.md") ?? "";
  const gapPlan = readRepoText("docs/15-production-gap-closure-plan.md") ?? "";
  const example = readRepoJson("examples/contracts/ledger-integrity-extension-readiness.json") as {
    current_baseline?: {
      event_hash_chain_implemented?: unknown;
      event_hash_algorithm?: unknown;
      jsonl_append_implemented?: unknown;
      audit_hash_chain_gate_implemented?: unknown;
      event_signature_runtime_implemented?: unknown;
      redaction_tooling_implemented?: unknown;
      repair_commands_implemented?: unknown;
      projection_rebuild_complete?: unknown;
    };
    extension_design?: {
      event_signatures?: unknown;
      redaction_manifests?: unknown;
      projection_rebuild?: unknown;
      explicit_repair?: unknown;
      irreversible_migration_requires_operator_approval?: unknown;
      design_contract_can_modify_runtime_state?: unknown;
    };
    signature_plan?: {
      signed_material?: unknown;
      excluded_material?: unknown;
      signer_implemented?: unknown;
      signature_values_in_examples?: unknown;
      signature_verification_required_before_repair?: unknown;
      signature_can_authorize_actions?: unknown;
    };
    redaction_plan?: {
      ledger_material?: unknown;
      artifact_material?: unknown;
      run_manifest_material?: unknown;
      raw_prompt_persisted?: unknown;
      raw_model_output_persisted?: unknown;
      raw_secret_persisted?: unknown;
      raw_untrusted_content_persisted?: unknown;
      redaction_manifest_implemented?: unknown;
      redaction_rebuild_requires_source_artifacts?: unknown;
      redaction_tombstone_preserves_hash_chain?: unknown;
    };
    rebuild_plan?: {
      event_ledger_is_source_truth?: unknown;
      registries_are_authority?: unknown;
      rebuilds_from_ledger_and_artifacts?: unknown;
      unrebuildable_states_reported?: unknown;
      remaining_security_projection_rebuild_complete?: unknown;
      prompt_model_artifact_repair_implemented?: unknown;
      security_fixture_repair_implemented?: unknown;
    };
    repair_boundary?: {
      audit_commands_read_only?: unknown;
      automatic_repair_allowed?: unknown;
      repair_requires_explicit_operator_command?: unknown;
      repair_command_implemented?: unknown;
      repair_can_issue_lease?: unknown;
      repair_can_treat_projection_as_authority?: unknown;
      repair_can_bypass_policy_proxy?: unknown;
    };
    authority?: {
      local_supervisor_is_root_authority?: unknown;
      event_ledger_is_fact_layer?: unknown;
      tool_policy_proxy_gates_side_effects?: unknown;
      readiness_contract_can_issue_lease?: unknown;
      readiness_contract_can_authorize_actions?: unknown;
      signature_can_grant_tool_authority?: unknown;
      redaction_can_hide_authorizing_material?: unknown;
    };
    limits?: {
      event_signature_runtime_implemented?: unknown;
      ledger_migration_implemented?: unknown;
      redaction_tooling_implemented?: unknown;
      projection_repair_implemented?: unknown;
      public_transparency_log_implemented?: unknown;
      cloud_notary_implemented?: unknown;
    };
  } | null;
  const signedMaterial = Array.isArray(example?.signature_plan?.signed_material)
    ? example.signature_plan.signed_material
    : [];
  const excludedMaterial = Array.isArray(example?.signature_plan?.excluded_material)
    ? example.signature_plan.excluded_material
    : [];
  const baselineSafe = example?.current_baseline?.event_hash_chain_implemented === true
    && example.current_baseline.event_hash_algorithm === "sha256_stable_json_without_event_hash"
    && example.current_baseline.jsonl_append_implemented === true
    && example.current_baseline.audit_hash_chain_gate_implemented === true
    && example.current_baseline.event_signature_runtime_implemented === false
    && example.current_baseline.redaction_tooling_implemented === false
    && example.current_baseline.repair_commands_implemented === false
    && example.current_baseline.projection_rebuild_complete === false;
  const extensionDesignSafe = example?.extension_design?.event_signatures === "planned_not_implemented"
    && example.extension_design.redaction_manifests === "planned_not_implemented"
    && example.extension_design.projection_rebuild === "partial_read_only_previews_exist"
    && example.extension_design.explicit_repair === "planned_not_implemented"
    && example.extension_design.irreversible_migration_requires_operator_approval === true
    && example.extension_design.design_contract_can_modify_runtime_state === false;
  const signaturePlanSafe = ["event_hash", "parent_event_hash", "workspace_id", "run_id", "event_type"].every((item) => signedMaterial.includes(item))
    && ["raw_prompt", "raw_model_output", "raw_secret", "raw_untrusted_content"].every((item) => excludedMaterial.includes(item))
    && example?.signature_plan?.signer_implemented === false
    && example.signature_plan.signature_values_in_examples === false
    && example.signature_plan.signature_verification_required_before_repair === true
    && example.signature_plan.signature_can_authorize_actions === false;
  const redactionPlanSafe = example?.redaction_plan?.ledger_material === "hashes_refs_and_redaction_markers_only"
    && example.redaction_plan.artifact_material === "schema_valid_metadata_only_until_dedicated_redaction_contract"
    && example.redaction_plan.run_manifest_material === "artifact_refs_hashes_and_status_only"
    && example.redaction_plan.raw_prompt_persisted === false
    && example.redaction_plan.raw_model_output_persisted === false
    && example.redaction_plan.raw_secret_persisted === false
    && example.redaction_plan.raw_untrusted_content_persisted === false
    && example.redaction_plan.redaction_manifest_implemented === false
    && example.redaction_plan.redaction_rebuild_requires_source_artifacts === true
    && example.redaction_plan.redaction_tombstone_preserves_hash_chain === true;
  const rebuildPlanSafe = example?.rebuild_plan?.event_ledger_is_source_truth === true
    && example.rebuild_plan.registries_are_authority === false
    && example.rebuild_plan.rebuilds_from_ledger_and_artifacts === true
    && example.rebuild_plan.unrebuildable_states_reported === true
    && example.rebuild_plan.remaining_security_projection_rebuild_complete === false
    && example.rebuild_plan.prompt_model_artifact_repair_implemented === false
    && example.rebuild_plan.security_fixture_repair_implemented === false;
  const repairBoundarySafe = example?.repair_boundary?.audit_commands_read_only === true
    && example.repair_boundary.automatic_repair_allowed === false
    && example.repair_boundary.repair_requires_explicit_operator_command === true
    && example.repair_boundary.repair_command_implemented === false
    && example.repair_boundary.repair_can_issue_lease === false
    && example.repair_boundary.repair_can_treat_projection_as_authority === false
    && example.repair_boundary.repair_can_bypass_policy_proxy === false;
  const authoritySafe = example?.authority?.local_supervisor_is_root_authority === true
    && example.authority.event_ledger_is_fact_layer === true
    && example.authority.tool_policy_proxy_gates_side_effects === true
    && example.authority.readiness_contract_can_issue_lease === false
    && example.authority.readiness_contract_can_authorize_actions === false
    && example.authority.signature_can_grant_tool_authority === false
    && example.authority.redaction_can_hide_authorizing_material === false;
  const limitsSafe = example?.limits?.event_signature_runtime_implemented === false
    && example.limits.ledger_migration_implemented === false
    && example.limits.redaction_tooling_implemented === false
    && example.limits.projection_repair_implemented === false
    && example.limits.public_transparency_log_implemented === false
    && example.limits.cloud_notary_implemented === false;
  const sourceReady = ledgerSource.includes("eventContentHash")
    && ledgerSource.includes("sha256")
    && ledgerSource.includes("verifyEventHashChain")
    && replaySource.includes("live_side_effects_replayed: false")
    && technicalStrategy.includes("signatures later")
    && technicalStrategy.includes("does not implement a vault, event signatures")
    && governance.includes("audit prompt-model-artifacts")
    && governance.includes("audit security-fixtures")
    && governance.includes("event signatures, redaction, and explicit repair remains future work")
    && runtimePlan.includes("audit prompt-model-artifacts")
    && runtimePlan.includes("audit security-fixtures")
    && gapPlan.includes("Signature/redaction/rebuild design notes")
    && gapPlan.includes("event signatures, redaction, explicit repair");
  const testsReady = contractTests.includes("ledger-integrity-extension-readiness.schema.json")
    && contractTests.includes("ledger integrity extension readiness rejects signature, redaction, repair, and authority overclaims");
  const ok = schemaPresent
    && examplePresent
    && baselineSafe
    && extensionDesignSafe
    && signaturePlanSafe
    && redactionPlanSafe
    && rebuildPlanSafe
    && repairBoundarySafe
    && authoritySafe
    && limitsSafe
    && sourceReady
    && testsReady;
  return check(
    "ledger_integrity_extension_readiness_contract",
    ok ? "pass" : "fail",
    ok ? "info" : "error",
    ok
      ? "Ledger integrity extension readiness contract documents signature, redaction, rebuild, and explicit repair prerequisites without implementing signing, migration, repair, or new authority."
      : "Ledger integrity extension readiness contract is missing or overclaims event signatures, redaction tooling, projection repair, migration, cloud notarization, or authority behavior.",
    [
      `schema=${schemaPresent ? "present" : "missing"}`,
      `example=${examplePresent ? "present" : "missing"}`,
      `baseline_safe=${String(baselineSafe)}`,
      `extension_design_safe=${String(extensionDesignSafe)}`,
      `signature_plan_safe=${String(signaturePlanSafe)}`,
      `redaction_plan_safe=${String(redactionPlanSafe)}`,
      `rebuild_plan_safe=${String(rebuildPlanSafe)}`,
      `repair_boundary_safe=${String(repairBoundarySafe)}`,
      `authority_safe=${String(authoritySafe)}`,
      `limits_safe=${String(limitsSafe)}`,
      `source_ready=${String(sourceReady)}`,
      `tests_ready=${String(testsReady)}`
    ],
    "Restore ledger integrity extension readiness schema/example and docs/tests that keep event signatures, redaction manifests, irreversible ledger migration, and projection repair planned but not implemented; audits must stay read-only and repair explicit/operator-approved."
  );
}

function adapterGateReadinessContractCheck(): DoctorCheck {
  const schemaPresent = existsRepoFile("schemas/adapter-gate-readiness.schema.json");
  const examplePresent = existsRepoFile("examples/contracts/adapter-gate-readiness.json");
  const computerUseSource = readRepoText("packages/computer-use/src/index.ts") ?? "";
  const connectorSource = readRepoText("packages/connector-sdk/src/index.ts") ?? "";
  const surfaceSource = readRepoText("packages/surface-os/src/index.ts") ?? "";
  const contractTests = readRepoText("packages/harness-core/test/harness-core.test.ts") ?? "";
  const computerUseDoc = readRepoText("docs/09-computer-use-implementation.md") ?? "";
  const technicalStrategy = readRepoText("docs/10-technical-strategy.md") ?? "";
  const governance = readRepoText("docs/13-schema-runtime-governance.md") ?? "";
  const gapPlan = readRepoText("docs/15-production-gap-closure-plan.md") ?? "";
  const example = readRepoJson("examples/contracts/adapter-gate-readiness.json") as {
    adapter_families?: Array<{
      family?: unknown;
      manifest_status?: unknown;
      runtime_status?: unknown;
      requires_controls?: unknown;
      raw_secret_persistence_allowed?: unknown;
      raw_untrusted_payload_persistence_allowed?: unknown;
      live_side_effect_replay_allowed?: unknown;
      can_authorize_actions?: unknown;
      can_bypass_supervisor?: unknown;
    }>;
    gate_controls?: Record<string, {
      required_before_runtime?: unknown;
      implemented_for_all_adapter_families?: unknown;
      evidence_only?: unknown;
    }>;
    execution_boundary?: {
      real_adapter_execution_enabled?: unknown;
      browser_extension_runtime_enabled?: unknown;
      browser_automation_enabled?: unknown;
      desktop_automation_enabled?: unknown;
      im_delivery_enabled?: unknown;
      mcp_connector_runtime_enabled?: unknown;
      oauth_saas_connector_runtime_enabled?: unknown;
      local_api_gateway_enabled?: unknown;
      package_code_execution_enabled?: unknown;
      cloud_worker_execution_enabled?: unknown;
    };
    policy_matrix?: {
      matrix_kind?: unknown;
      typed_target_families_required?: unknown;
      deny_first_rules_required?: unknown;
      fresh_policy_required_per_action?: unknown;
      egress_policy_required?: unknown;
      connector_grant_lifecycle_required?: unknown;
      policy_matrix_can_issue_lease?: unknown;
      policy_matrix_can_execute_adapter?: unknown;
    };
    authority?: {
      local_supervisor_is_root_authority?: unknown;
      event_ledger_is_fact_layer?: unknown;
      tool_policy_proxy_gates_side_effects?: unknown;
      adapter_manifest_can_authorize_actions?: unknown;
      adapter_gate_contract_can_issue_lease?: unknown;
      adapter_can_bypass_supervisor?: unknown;
      adapter_observation_can_authorize_side_effects?: unknown;
      generated_package_can_be_trust_root?: unknown;
    };
    limits?: {
      real_browser_automation_implemented?: unknown;
      real_desktop_automation_implemented?: unknown;
      real_im_delivery_implemented?: unknown;
      real_mcp_adapter_implemented?: unknown;
      real_oauth_connector_implemented?: unknown;
      real_local_api_gateway_implemented?: unknown;
      real_package_execution_implemented?: unknown;
      real_cloud_worker_implemented?: unknown;
      supervisor_governed_adapter_action_gateway_implemented?: unknown;
      connector_grants_implemented?: unknown;
      vault_secret_resolution_implemented?: unknown;
      token_refresh_revocation_implemented?: unknown;
    };
  } | null;
  const families = Array.isArray(example?.adapter_families) ? example.adapter_families : [];
  const familyNames = new Set(families.map((entry) => entry.family).filter((value): value is string => typeof value === "string"));
  const requiredFamilies = [
    "browser_extension",
    "browser_automation",
    "desktop_automation",
    "im_delivery",
    "mcp_connector",
    "oauth_saas_connector",
    "computer_use",
    "local_api_gateway",
    "package_execution",
    "cloud_worker"
  ];
  const requiredControls = [
    "identity",
    "vault_reference",
    "fresh_policy_decision",
    "scoped_lease",
    "approval_for_side_effects",
    "observation_artifact",
    "verification_record",
    "no_live_side_effect_replay",
    "egress_policy",
    "taint_handling",
    "supervisor_action_gateway"
  ];
  const familiesDeclared = families.length === requiredFamilies.length
    && requiredFamilies.every((family) => familyNames.has(family));
  const familyBoundariesSafe = familiesDeclared && families.every((entry) => {
    const controls = Array.isArray(entry.requires_controls) ? entry.requires_controls : [];
    return entry.manifest_status === "required_before_runtime"
      && entry.runtime_status === "deferred_not_implemented"
      && requiredControls.every((control) => controls.includes(control))
      && entry.raw_secret_persistence_allowed === false
      && entry.raw_untrusted_payload_persistence_allowed === false
      && entry.live_side_effect_replay_allowed === false
      && entry.can_authorize_actions === false
      && entry.can_bypass_supervisor === false;
  });
  const requiredGateControlKeys = [
    "identity",
    "vault",
    "policy",
    "lease",
    "approval",
    "observation",
    "verification",
    "replay",
    "egress",
    "taint",
    "supervisor_action_gateway"
  ];
  const gateControlsSafe = requiredGateControlKeys.every((key) => {
    const control = example?.gate_controls?.[key];
    return control?.required_before_runtime === true
      && control.implemented_for_all_adapter_families === false
      && control.evidence_only === true;
  });
  const executionBoundarySafe = example?.execution_boundary?.real_adapter_execution_enabled === false
    && example.execution_boundary.browser_extension_runtime_enabled === false
    && example.execution_boundary.browser_automation_enabled === false
    && example.execution_boundary.desktop_automation_enabled === false
    && example.execution_boundary.im_delivery_enabled === false
    && example.execution_boundary.mcp_connector_runtime_enabled === false
    && example.execution_boundary.oauth_saas_connector_runtime_enabled === false
    && example.execution_boundary.local_api_gateway_enabled === false
    && example.execution_boundary.package_code_execution_enabled === false
    && example.execution_boundary.cloud_worker_execution_enabled === false;
  const policyMatrixSafe = example?.policy_matrix?.matrix_kind === "required_before_runtime_adapter_enablement"
    && example.policy_matrix.typed_target_families_required === true
    && example.policy_matrix.deny_first_rules_required === true
    && example.policy_matrix.fresh_policy_required_per_action === true
    && example.policy_matrix.egress_policy_required === true
    && example.policy_matrix.connector_grant_lifecycle_required === true
    && example.policy_matrix.policy_matrix_can_issue_lease === false
    && example.policy_matrix.policy_matrix_can_execute_adapter === false;
  const authoritySafe = example?.authority?.local_supervisor_is_root_authority === true
    && example.authority.event_ledger_is_fact_layer === true
    && example.authority.tool_policy_proxy_gates_side_effects === true
    && example.authority.adapter_manifest_can_authorize_actions === false
    && example.authority.adapter_gate_contract_can_issue_lease === false
    && example.authority.adapter_can_bypass_supervisor === false
    && example.authority.adapter_observation_can_authorize_side_effects === false
    && example.authority.generated_package_can_be_trust_root === false;
  const limitsSafe = example?.limits?.real_browser_automation_implemented === false
    && example.limits.real_desktop_automation_implemented === false
    && example.limits.real_im_delivery_implemented === false
    && example.limits.real_mcp_adapter_implemented === false
    && example.limits.real_oauth_connector_implemented === false
    && example.limits.real_local_api_gateway_implemented === false
    && example.limits.real_package_execution_implemented === false
    && example.limits.real_cloud_worker_implemented === false
    && example.limits.supervisor_governed_adapter_action_gateway_implemented === false
    && example.limits.connector_grants_implemented === false
    && example.limits.vault_secret_resolution_implemented === false
    && example.limits.token_refresh_revocation_implemented === false;
  const sourceReady = computerUseSource.includes("requires_policy_lease: true")
    && computerUseSource.includes("live_replay_allowed: false")
    && computerUseSource.includes("can_authorize_from_observation: false")
    && connectorSource.includes("policy_required_for_calls: true")
    && connectorSource.includes("trust_inherited: false")
    && surfaceSource.includes("can_authorize_actions: false")
    && surfaceSource.includes("delivery_attempted: false")
    && computerUseDoc.includes("Aetherion adapter manifests")
    && computerUseDoc.includes("Any side-effectful computer action requires a policy decision plus a scoped lease")
    && technicalStrategy.includes("MCP/OAuth/SaaS connectors")
    && governance.includes("Real click/type/browser/desktop automation must wait")
    && gapPlan.includes("PGC-7: Adapter And Surface Gate Readiness")
    && gapPlan.includes("Adapter manifest and policy matrix")
    && gapPlan.includes("Per-family gate document");
  const testsReady = contractTests.includes("adapter-gate-readiness.schema.json")
    && contractTests.includes("adapter gate readiness rejects runtime execution, missing gates, replay, and authority overclaims");
  const ok = schemaPresent
    && examplePresent
    && familiesDeclared
    && familyBoundariesSafe
    && gateControlsSafe
    && executionBoundarySafe
    && policyMatrixSafe
    && authoritySafe
    && limitsSafe
    && sourceReady
    && testsReady;
  return check(
    "adapter_gate_readiness_contract",
    ok ? "pass" : "fail",
    ok ? "info" : "error",
    ok
      ? "Adapter gate readiness contract documents adapter-family manifests, policy matrix, and pre-runtime controls without enabling real adapter execution or authority bypass."
      : "Adapter gate readiness contract is missing or overclaims adapter execution, policy/lease authority, live replay, secret access, connector grants, package execution, or supervisor bypass.",
    [
      `schema=${schemaPresent ? "present" : "missing"}`,
      `example=${examplePresent ? "present" : "missing"}`,
      `families=${[...familyNames].sort().join(",") || "missing"}`,
      `families_declared=${String(familiesDeclared)}`,
      `family_boundaries_safe=${String(familyBoundariesSafe)}`,
      `gate_controls_safe=${String(gateControlsSafe)}`,
      `execution_boundary_safe=${String(executionBoundarySafe)}`,
      `policy_matrix_safe=${String(policyMatrixSafe)}`,
      `authority_safe=${String(authoritySafe)}`,
      `limits_safe=${String(limitsSafe)}`,
      `source_ready=${String(sourceReady)}`,
      `tests_ready=${String(testsReady)}`
    ],
    "Restore adapter gate readiness schema/example, source checks, and tests that keep browser, IM, MCP, OAuth/SaaS connector, computer-use, local API, package execution, and cloud worker families behind identity, vault, policy, lease, approval, observation, verification, replay, egress, taint, and supervisor action-gateway controls without executing adapters."
  );
}

function vaultReferenceContractCheck(): DoctorCheck {
  const schemaPresent = existsRepoFile("schemas/vault-reference.schema.json");
  const examplePresent = existsRepoFile("examples/contracts/vault-reference.json");
  const example = readRepoJson("examples/contracts/vault-reference.json") as {
    reference?: { uri?: unknown };
    fingerprint?: { value?: unknown };
    redaction?: {
      ledger_material?: unknown;
      artifact_material?: unknown;
      run_manifest_material?: unknown;
    };
    limits?: {
      raw_secret_persisted?: unknown;
      raw_secret_available_to_aetherion?: unknown;
      oauth_flow_implemented?: unknown;
      connector_grant_implemented?: unknown;
    };
  } | null;
  const noRawMaterial = example?.limits?.raw_secret_persisted === false
    && example.limits.raw_secret_available_to_aetherion === false
    && example.limits.oauth_flow_implemented === false
    && example.limits.connector_grant_implemented === false;
  const referenceOnly = typeof example?.reference?.uri === "string"
    && example.reference.uri.startsWith("vault://")
    && typeof example.fingerprint?.value === "string"
    && example.fingerprint.value.startsWith("sha256:")
    && example.redaction?.ledger_material === "reference_and_fingerprint_only"
    && example.redaction.artifact_material === "reference_and_fingerprint_only"
    && example.redaction.run_manifest_material === "reference_and_fingerprint_only";
  const ok = schemaPresent && examplePresent && noRawMaterial && referenceOnly;
  return check(
    "vault_reference_contract",
    ok ? "pass" : "fail",
    ok ? "info" : "error",
    ok
      ? "Metadata-only vault reference contract is present and keeps raw secret material out of repo examples."
      : "Vault reference contract is missing or does not prove metadata-only redaction boundaries.",
    [
      `schema=${schemaPresent ? "present" : "missing"}`,
      `example=${examplePresent ? "present" : "missing"}`,
      `reference_uri=${typeof example?.reference?.uri === "string" && example.reference.uri.startsWith("vault://") ? "vault_ref" : "missing"}`,
      `fingerprint=${typeof example?.fingerprint?.value === "string" && example.fingerprint.value.startsWith("sha256:") ? "sha256" : "missing"}`,
      `raw_secret_persisted=${String(example?.limits?.raw_secret_persisted ?? "missing")}`,
      `raw_secret_available_to_aetherion=${String(example?.limits?.raw_secret_available_to_aetherion ?? "missing")}`,
      `oauth_flow_implemented=${String(example?.limits?.oauth_flow_implemented ?? "missing")}`,
      `connector_grant_implemented=${String(example?.limits?.connector_grant_implemented ?? "missing")}`,
      `ledger_material=${String(example?.redaction?.ledger_material ?? "missing")}`,
      `artifact_material=${String(example?.redaction?.artifact_material ?? "missing")}`,
      `run_manifest_material=${String(example?.redaction?.run_manifest_material ?? "missing")}`
    ],
    "Restore schemas/vault-reference.schema.json and examples/contracts/vault-reference.json with reference-only material, sha256 fingerprint evidence, and raw/OAuth/connector limits set to false."
  );
}

function ciGateNeedles(): string[] {
  return [
    "FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true",
    "actions/checkout@v5",
    "actions/setup-node@v5",
    "package-manager-cache: false",
    "actions/setup-go@v6",
    "go-version: 1.25.x",
    "npm ci --ignore-scripts",
    "npm audit --audit-level=high --json",
    "cargo install cargo-audit --locked --version 0.22.1",
    "cargo audit",
    "npm test",
    "go test ./packages/tui-go/...",
    "cargo test --locked",
    "cargo clippy --all-targets --all-features --locked -- -D warnings",
    "cargo fmt --check",
    "git diff --check",
    "tools/forbidden-tracked-roots.txt",
    "npm run ether -- onboarding check --workspace .",
    "npm run ether -- doctor --workspace .",
    "npm run ether -- ingress audit --workspace .",
    "npm run ether -- security audit --workspace .",
    "npm run ether -- release evidence --workspace .",
    "platform-smoke:",
    "fail-fast: false",
    "ubuntu-latest",
    "macos-latest",
    "node --test --test-name-pattern",
    "Platform smoke"
  ];
}

function dependencyLockfileState(packageJson: { name?: string; version?: string; license?: string; bin?: { ether?: string }; engines?: { node?: string } } | null): { ok: boolean; evidence: string[] } {
  const packageLock = readRepoJson("package-lock.json") as {
    lockfileVersion?: number;
    packages?: Record<string, { name?: string; version?: string; license?: string; bin?: { ether?: string }; engines?: { node?: string }; dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> }>;
  } | null;
  const cargoLock = readRepoText("Cargo.lock");
  const rootPackage = packageLock?.packages?.[""];
  const rootDependencyCount = Object.keys(rootPackage?.dependencies ?? {}).length;
  const rootDevDependencyCount = Object.keys(rootPackage?.devDependencies ?? {}).length;
  const packageLockOk = packageLock?.lockfileVersion === 3
    && rootPackage?.name === packageJson?.name
    && rootPackage?.version === packageJson?.version
    && rootPackage?.license === packageJson?.license
    && rootPackage?.bin?.ether === packageJson?.bin?.ether
    && rootPackage?.engines?.node === packageJson?.engines?.node;
  const cargoLockOk = Boolean(cargoLock?.includes("version = 4") && cargoLock.includes('name = "aetherion-supervisor"'));
  return {
    ok: Boolean(packageLockOk && cargoLockOk),
    evidence: [
      `package_lock=${packageLock ? "present" : "missing"}`,
      `package_lock_version=${packageLock?.lockfileVersion ?? "missing"}`,
      `package_lock_root_name=${rootPackage?.name ?? "missing"}`,
      `package_name=${packageJson?.name ?? "missing"}`,
      `package_lock_root_version=${rootPackage?.version ?? "missing"}`,
      `package_version=${packageJson?.version ?? "missing"}`,
      `package_lock_root_license=${rootPackage?.license ?? "missing"}`,
      `package_license=${packageJson?.license ?? "missing"}`,
      `package_lock_bin_ether=${rootPackage?.bin?.ether ?? "missing"}`,
      `package_bin_ether=${packageJson?.bin?.ether ?? "missing"}`,
      `package_lock_node_engine=${rootPackage?.engines?.node ?? "missing"}`,
      `package_node_engine=${packageJson?.engines?.node ?? "missing"}`,
      `package_lock_root_dependencies=${rootDependencyCount}`,
      `package_lock_root_dev_dependencies=${rootDevDependencyCount}`,
      `cargo_lock=${cargoLock ? "present" : "missing"}`,
      `cargo_lock_supervisor_package=${String(Boolean(cargoLock?.includes('name = "aetherion-supervisor"')))}`
    ]
  };
}

async function workspaceDoctorChecks(workspaceRoot: string): Promise<DoctorCheck[]> {
  const runtimeDir = join(workspaceRoot, ".aetherion");
  const workspaceRegistry = join(runtimeDir, "workspace.json");
  if (!existsSync(workspaceRegistry)) {
    return [check(
      "workspace_runtime_state",
      "not_applicable",
      "info",
      "Workspace runtime state is not initialized; doctor did not create it.",
      [`workspace_registry=${workspaceRegistry}`, "runtime_state=not_initialized"],
      null
    )];
  }
  try {
    const { workspace } = await loadWorkspaceFromRegistry(workspaceRoot);
    const events = await readEvents(workspace);
    const chain = verifyEventHashChain(events);
    const runDir = join(runtimeDir, "runs");
    return [
      check(
        "workspace_registry_identity",
        workspace.id === workspaceIdForRoot(workspaceRoot) ? "pass" : "fail",
        workspace.id === workspaceIdForRoot(workspaceRoot) ? "info" : "error",
        "Workspace registry identity matches the resolved workspace root.",
        [`workspace_id=${workspace.id}`, `derived_workspace_id=${workspaceIdForRoot(workspaceRoot)}`],
        "Recreate the workspace registry through the supervisor path; do not hand-edit identity fields."
      ),
      check(
        "workspace_ledger_hash_chain",
        chain.valid ? "pass" : "fail",
        chain.valid ? "info" : "error",
        "Workspace Event Ledger hash chain verifies without replaying side effects.",
        [`event_count=${events.length}`, `broken_at=${chain.broken_at ?? "none"}`],
        "Inspect the Ledger before trusting projections; do not repair by deleting events."
      ),
      check(
        "workspace_run_manifests",
        existsSync(runDir) ? "pass" : "warn",
        existsSync(runDir) ? "info" : "warning",
        "Run manifest directory is present when runtime state exists.",
        [`runs_dir=${runDir}`, `present=${String(existsSync(runDir))}`],
        "Run an Ether kernel command to create a manifest before relying on run projections."
      )
    ];
  } catch (error) {
    return [check(
      "workspace_runtime_state",
      "fail",
      "error",
      "Workspace runtime state exists but could not be loaded read-only.",
      [error instanceof Error ? error.message : String(error)],
      "Inspect .aetherion/workspace.json and Ledger path drift before running authority-bearing commands."
    )];
  }
}

function check(
  id: string,
  status: DoctorCheckStatus,
  severity: DoctorCheck["severity"],
  summary: string,
  evidence: string[],
  remediation: string | null
): DoctorCheck {
  return { id, status, severity, summary, evidence, remediation };
}

function nodeVersionAtLeast(minimum: string): boolean {
  const currentParts = process.versions.node.split(".").map((part) => Number(part));
  const minimumParts = minimum.split(".").map((part) => Number(part));
  for (let index = 0; index < Math.max(currentParts.length, minimumParts.length); index += 1) {
    const current = currentParts[index] ?? 0;
    const required = minimumParts[index] ?? 0;
    if (current > required) {
      return true;
    }
    if (current < required) {
      return false;
    }
  }
  return true;
}

function readRepoText(relativePath: string): string | null {
  const path = join(repoRoot, relativePath);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function readRepoJson(relativePath: string): unknown {
  const text = readRepoText(relativePath);
  if (!text) {
    return null;
  }
  return JSON.parse(text) as unknown;
}

function existsRepoFile(relativePath: string): boolean {
  return existsSync(join(repoRoot, relativePath));
}

function requiredGovernanceFiles(): string[] {
  return [
    "CODE_OF_CONDUCT.md",
    "CODE_OF_CONDUCT.zh-CN.md",
    "CONTRIBUTING.md",
    "CONTRIBUTING.zh-CN.md",
    "LICENSE",
    "LICENSE.zh-CN.md",
    "SECURITY.md",
    "SECURITY.zh-CN.md",
    ".github/ISSUE_TEMPLATE/bug_report.yml",
    ".github/ISSUE_TEMPLATE/contract_change.yml",
    ".github/ISSUE_TEMPLATE/feature_request.yml",
    ".github/ISSUE_TEMPLATE/security_hardening.yml",
    ".github/pull_request_template.md"
  ];
}

function bilingualDocsOk(): boolean {
  return bilingualDocsEvidence().every((line) => line.endsWith("=ok"));
}

function bilingualDocsEvidence(): string[] {
  const docsDir = join(repoRoot, "docs");
  const docs = readdirSync(docsDir)
    .filter((file) => file.endsWith(".md") && !file.endsWith(".zh-CN.md"))
    .sort();
  return docs.map((file) => {
    const zh = file.replace(/\.md$/, ".zh-CN.md");
    const enText = readRepoText(join("docs", file)) ?? "";
    const zhText = readRepoText(join("docs", zh)) ?? "";
    const ok = existsRepoFile(join("docs", zh))
      && enText.includes(`[中文版本](${zh})`)
      && zhText.includes(`[English](${file})`);
    return `docs/${file}<->docs/${zh}=${ok ? "ok" : "missing_or_unlinked"}`;
  });
}

function docsDeploymentReadinessCheck(): DoctorCheck {
  const markdownLinks = markdownRelativeLinkEvidence();
  const requiredEntrypoints = [
    "README.md",
    "README.zh-CN.md",
    "docs/14-runtime-loop-plan.md",
    "docs/14-runtime-loop-plan.zh-CN.md",
    "docs/15-production-gap-closure-plan.md",
    "docs/15-production-gap-closure-plan.zh-CN.md"
  ];
  const requiredEntryEvidence = requiredEntrypoints.map((file) => `${file}=${existsRepoFile(file) ? "present" : "missing"}`);
  const readme = readRepoText("README.md") ?? "";
  const readmeZh = readRepoText("README.zh-CN.md") ?? "";
  const governanceOk = requiredGovernanceFiles().every((file) => existsRepoFile(file));
  const bilingualOk = bilingualDocsOk();
  const sourceLinksOk = readme.includes("docs/14-runtime-loop-plan.md")
    && readme.includes("docs/15-production-gap-closure-plan.md")
    && readmeZh.includes("docs/14-runtime-loop-plan.zh-CN.md")
    && readmeZh.includes("docs/15-production-gap-closure-plan.zh-CN.md");
  const requiredEntrypointsOk = requiredEntrypoints.every((file) => existsRepoFile(file));
  const markdownLinksOk = markdownLinks.unresolvedRelativeLinks.length === 0;
  const ready = governanceOk && bilingualOk && sourceLinksOk && requiredEntrypointsOk && markdownLinksOk;

  return check(
    "docs_deployment_readiness",
    ready ? "pass" : "fail",
    ready ? "info" : "error",
    ready
      ? "Docs deployment inputs are locally checkable without deploying public docs."
      : "Docs deployment readiness inputs are missing or contain unresolved local links.",
    [
      "read_only=true",
      "deploys_public_docs=false",
      "public_docs_deployed=false",
      "docs_site_config=not_required_for_static_markdown_readiness",
      `governance_files=${governanceOk ? "pass" : "fail"}`,
      `bilingual_main_docs=${bilingualOk ? "pass" : "fail"}`,
      `source_doc_links=${sourceLinksOk ? "pass" : "fail"}`,
      `markdown_files_checked=${markdownLinks.markdownFilesChecked}`,
      `relative_links_checked=${markdownLinks.relativeLinksChecked}`,
      `unresolved_relative_links=${markdownLinks.unresolvedRelativeLinks.length}`,
      ...requiredEntryEvidence,
      ...markdownLinks.unresolvedRelativeLinks.slice(0, 20).map((link) => `unresolved=${link}`)
    ],
    "Restore governance files, bilingual doc links, source-document links, or broken relative Markdown targets before publishing docs."
  );
}

function markdownRelativeLinkEvidence(): MarkdownRelativeLinkEvidence {
  const trackedMarkdownFiles = (gitOutputRaw(["ls-files"]) || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".md") && line !== "AGENTS.md");
  const unresolvedRelativeLinks: string[] = [];
  let relativeLinksChecked = 0;
  const inlineLinkPattern = /!?\[[^\]]*]\(([^)]+)\)/g;
  const referenceLinkPattern = /^\s*\[[^\]]+]:\s*(\S+)/gm;

  for (const file of trackedMarkdownFiles) {
    const text = readRepoText(file) ?? "";
    const candidates = [
      ...Array.from(text.matchAll(inlineLinkPattern), (match) => match[1]),
      ...Array.from(text.matchAll(referenceLinkPattern), (match) => match[1])
    ];
    for (const rawHref of candidates) {
      const href = markdownLinkTarget(rawHref);
      if (!href || !isRelativeMarkdownLink(href)) {
        continue;
      }
      relativeLinksChecked += 1;
      const pathOnly = href.split("#", 1)[0];
      if (!pathOnly) {
        continue;
      }
      const decodedPath = safeDecodeURIComponent(pathOnly);
      const targetPath = resolve(dirname(join(repoRoot, file)), decodedPath);
      const repoRelativeTarget = relative(repoRoot, targetPath);
      if (repoRelativeTarget.startsWith("..") || isAbsolute(repoRelativeTarget) || !existsSync(targetPath)) {
        unresolvedRelativeLinks.push(`${file}->${href}`);
      }
    }
  }

  return {
    markdownFilesChecked: trackedMarkdownFiles.length,
    relativeLinksChecked,
    unresolvedRelativeLinks
  };
}

function markdownLinkTarget(rawHref: string): string {
  return rawHref.trim().replace(/^<(.+)>$/, "$1");
}

function isRelativeMarkdownLink(href: string): boolean {
  return !href.startsWith("#")
    && !href.startsWith("/")
    && !/^[a-z][a-z0-9+.-]*:/i.test(href);
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function schemaExampleFilesPresent(): boolean {
  return existsRepoFile("schemas")
    && existsRepoFile("examples/contracts")
    && existsRepoFile("schemas/event.schema.json")
    && existsRepoFile("examples/contracts/event.json")
    && existsRepoFile("schemas/capsule-install.schema.json")
    && existsRepoFile("examples/contracts/capsule-install.json");
}

async function runBoundary(options: CliOptions): Promise<void> {
  const runId = options.topic;
  if (!runId?.startsWith("run_")) {
    throw new Error("boundary requires a run id as the first argument");
  }
  const workspaceRoot = resolve(options.workspace);
  const { workspace, registry } = await loadWorkspaceFromRegistry(workspaceRoot);
  const manifest = await loadRunManifest(workspace, runId);
  const ledger = await readEvents(workspace);
  const runEvents = ledger.filter((event) => event.run_id === runId);
  const trace = await reconstructTrace(workspace, runId);
  const eventTypes = runEvents.map((event) => event.event_type);
  const policyEvents = eventsOfType(runEvents, "policy.decided");
  const riskEvents = eventsOfType(runEvents, "risk.composed");
  const consentEvents = eventsOfType(runEvents, "consent.recorded");
  const leaseEvents = eventsOfType(runEvents, "lease.issued");
  const actionEvents = eventsOfType(runEvents, "action.recorded");
  const toolRequestEvents = eventsOfType(runEvents, "tool.requested");
  const startedEvent = eventsOfType(runEvents, "run.started").at(0);
  const userMessage = eventsOfType(runEvents, "user.message").at(0);
  const materialActions = boundaryMaterialActions(runEvents, userMessage?.summary ?? manifest.summary ?? "not_recorded");
  const boundaryFacts = await readBoundaryFactsArtifact(workspaceRoot, runId);
  const actorIds = (actorType: EventRecord["actor"]["type"]) => uniqueStrings(runEvents
    .filter((event) => event.actor.type === actorType)
    .map((event) => event.actor.id));
  const missingBoundaryFacts = boundaryFacts?.not_recorded ?? [
    actorIds("user").length === 0 ? "user_id" : "",
    "device_id",
    "channel_id",
    "secret_vault"
  ].filter(Boolean);

  console.log(`boundary_run=${runId}`);
  console.log("boundary_scope=read_only_ledger_manifest");
  console.log(`boundary_status=${runEvents.length > 0 ? "recorded" : "missing_events"}`);
  console.log(`boundary_facts_ref=${startedEvent?.payload_ref ?? "not_recorded"}`);
  console.log(`boundary_known_facts=${joinOrNotRecorded(boundaryFacts?.known_facts ?? [])}`);
  console.log(`who_user_ids=${joinOrNotRecorded(actorIds("user"))}`);
  console.log(`who_agent_ids=${joinOrNotRecorded(actorIds("agent"))}`);
  console.log(`who_system_ids=${joinOrNotRecorded(actorIds("system"))}`);
  console.log(`where_workspace_id=${manifest.workspace_id}`);
  console.log(`where_workspace_root=${singleLine(registry.root)}`);
  console.log(`where_entry_surface=${manifest.entry_surface}`);
  console.log(`where_authority=${registry.authority}`);
  console.log(`what_event_types=${joinOrNotRecorded(eventTypes)}`);
  console.log(`what_tool_requests=${toolRequestEvents.length}`);
  console.log(`what_policy_decisions=${policyEvents.length}`);
  console.log(`what_consents=${consentEvents.length}`);
  console.log(`what_leases=${leaseEvents.length}`);
  console.log(`what_actions=${actionEvents.length}`);
  console.log(`boundary_material_actions=${materialActions.length}`);
  console.log(`why_manifest=${singleLine(manifest.summary ?? "not_recorded")}`);
  console.log(`why_user_message=${singleLine(userMessage?.summary ?? "not_recorded")}`);
  console.log(`risk_levels=${joinOrNotRecorded(riskLevels(riskEvents))}`);
  console.log(`risk_latest_policy=${singleLine(policyEvents.at(-1)?.summary ?? "not_recorded")}`);
  console.log(`consent_status=${consentEvents.length > 0 ? "recorded" : "not_recorded"}`);
  console.log(`consent_event_ids=${joinOrNotRecorded(consentEvents.map((event) => event.id))}`);
  console.log(`consent_payload_refs=${joinOrNotRecorded(consentEvents.map((event) => event.payload_ref).filter((value): value is string => typeof value === "string" && value.length > 0))}`);
  console.log(`policy_event_ids=${joinOrNotRecorded(policyEvents.map((event) => event.id))}`);
  console.log(`lease_event_ids=${joinOrNotRecorded(leaseEvents.map((event) => event.id))}`);
  console.log(`proof_chain_valid=${trace.chain_valid}`);
  if (trace.head_event_id) {
    console.log(`proof_head_event_id=${trace.head_event_id}`);
  }
  if (trace.head_event_hash) {
    console.log(`proof_head_event_hash=${trace.head_event_hash}`);
  }
  console.log(`proof_manifest_status=${manifest.status}`);
  console.log(`proof_manifest_events=${manifest.event_ids.length}`);
  console.log(`proof_ledger=${workspace.ledgerPath}`);
  console.log(`proof_live_side_effects_replayed=${trace.live_side_effects_replayed}`);
  console.log(`boundary_not_recorded=${joinOrNotRecorded(missingBoundaryFacts)}`);
  printBoundaryMaterialActions(materialActions);
  printBoundaryFactDetails(boundaryFacts);
}

type BoundaryMaterialAction = {
  index: number;
  operation: string;
  actor: string;
  where: string;
  why: string;
  risk: string;
  policy: string;
  consent: string;
  lease: string;
  result: string;
  proof: string;
  memory_impact: string;
  permission_impact: string;
  source_events: string[];
};

function boundaryMaterialActions(events: EventRecord[], fallbackWhy: string): BoundaryMaterialAction[] {
  const rows: BoundaryMaterialAction[] = [];
  let current: BoundaryMaterialAction | null = null;

  for (const event of events) {
    if (event.event_type === "tool.requested") {
      current = {
        index: rows.length + 1,
        operation: boundaryOperation(event),
        actor: `${event.actor.type}:${event.actor.id}`,
        where: boundaryTarget(event.summary),
        why: fallbackWhy,
        risk: "not_recorded",
        policy: "not_recorded",
        consent: "not_required_or_not_recorded",
        lease: "not_recorded",
        result: "pending",
        proof: "not_recorded",
        memory_impact: "not_recorded",
        permission_impact: "not_recorded",
        source_events: [event.id]
      };
      rows.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    if (event.event_type === "risk.composed") {
      current.risk = riskLevels([event]).at(0) ?? "not_recorded";
      current.source_events.push(event.id);
    } else if (event.event_type === "policy.decided") {
      current.policy = boundaryPolicy(event.summary);
      current.permission_impact = "policy_checked";
      current.source_events.push(event.id);
    } else if (event.event_type === "consent.recorded") {
      current.consent = "recorded";
      current.source_events.push(event.id);
    } else if (event.event_type === "lease.issued") {
      current.lease = "issued";
      current.permission_impact = "scoped_lease_issued";
      current.source_events.push(event.id);
    } else if (event.event_type === "tool.result") {
      current.result = boundaryResult(event.summary);
      current.proof = "tool_result";
      current.source_events.push(event.id);
    } else if (event.event_type === "action.recorded") {
      current.result = "side_effect_recorded";
      current.proof = "action_recorded";
      current.source_events.push(event.id);
    } else if (event.event_type === "observation.recorded") {
      current.proof = "observation_recorded";
      current.source_events.push(event.id);
    } else if (event.event_type === "verification.recorded") {
      current.proof = /fail/i.test(event.summary) ? "verification_failed" : "verification_passed";
      current.source_events.push(event.id);
    } else if (event.event_type === "memory.candidate.created" || event.event_type === "memory.patch.proposed" || event.event_type === "memory.fold.proposed") {
      current.memory_impact = "recorded";
      current.source_events.push(event.id);
    }
  }

  return rows;
}

function printBoundaryMaterialActions(actions: BoundaryMaterialAction[]): void {
  if (actions.length === 0) {
    console.log("boundary_action_matrix=not_recorded");
    return;
  }
  for (const action of actions) {
    const prefix = `boundary_action_${action.index}`;
    console.log(`${prefix}_operation=${singleLine(action.operation)}`);
    console.log(`${prefix}_actor=${singleLine(action.actor)}`);
    console.log(`${prefix}_where=${singleLine(action.where)}`);
    console.log(`${prefix}_why=${singleLine(action.why)}`);
    console.log(`${prefix}_risk=${singleLine(action.risk)}`);
    console.log(`${prefix}_policy=${singleLine(action.policy)}`);
    console.log(`${prefix}_consent=${singleLine(action.consent)}`);
    console.log(`${prefix}_lease=${singleLine(action.lease)}`);
    console.log(`${prefix}_result=${singleLine(action.result)}`);
    console.log(`${prefix}_proof=${singleLine(action.proof)}`);
    console.log(`${prefix}_memory_impact=${singleLine(action.memory_impact)}`);
    console.log(`${prefix}_permission_impact=${singleLine(action.permission_impact)}`);
    console.log(`${prefix}_source_events=${joinOrNotRecorded(action.source_events)}`);
  }
}

function boundaryOperation(event: EventRecord): string {
  const summary = event.summary.toLowerCase();
  if (summary.includes("write")) return "filesystem.write";
  if (summary.includes("read")) return "filesystem.read";
  if (summary.includes("outbox") || summary.includes("send")) return "outbox.send";
  return event.summary;
}

function boundaryTarget(summary: string): string {
  const match = summary.match(/(?:read|write)\s+(.+)$/i);
  return match ? match[1].replace(/[.。]$/, "") : "workspace";
}

function boundaryPolicy(summary: string): string {
  const lower = summary.toLowerCase();
  if (lower.includes(" deny") || lower.startsWith("denied")) return "deny";
  if (lower.includes(" ask") || lower.includes("requires explicit consent") || lower.includes("requires approval")) return "ask";
  if (lower.includes(" allow") || lower.includes("approved") || lower.includes("allowed")) return "allow";
  return summary;
}

function boundaryResult(summary: string): string {
  const lower = summary.toLowerCase();
  if (lower.includes("denied") || lower.includes("error") || lower.includes("failed")) return "denied_or_failed";
  if (lower.includes("read")) return "read_recorded";
  if (lower.includes("wrote") || lower.includes("write")) return "write_recorded";
  return "recorded";
}

function printBoundaryFactDetails(facts: BoundaryFacts | null): void {
  if (!facts) {
    console.log("boundary_limits=not_recorded");
    console.log("boundary_impact=not_recorded");
    return;
  }
  console.log(`boundary_limits_full_user_identity=${facts.limits.full_user_identity}`);
  console.log(`boundary_limits_device_pairing=${facts.limits.device_pairing}`);
  console.log(`boundary_limits_remote_channel_identity=${facts.limits.remote_channel_identity}`);
  console.log(`boundary_limits_secret_vault_backend=${facts.limits.secret_vault_backend}`);
  console.log(`boundary_impact_memory_candidate_created=${facts.impact.memory_candidate_created}`);
  console.log(`boundary_impact_user_model_updated=${facts.impact.user_model_updated}`);
  console.log(`boundary_impact_capability_changed=${facts.impact.capability_changed}`);
  console.log(`boundary_impact_runtime_permissions_changed=${facts.impact.runtime_permissions_changed}`);
  console.log(`boundary_impact_workspace_file_write_requested=${facts.impact.workspace_file_write_requested}`);
  console.log(`boundary_impact_external_delivery_attempted=${facts.impact.external_delivery_attempted}`);
  console.log(`boundary_impact_browser_automation_attempted=${facts.impact.browser_automation_attempted}`);
  console.log(`boundary_impact_connector_called=${facts.impact.connector_called}`);
  console.log(`boundary_impact_package_code_executed=${facts.impact.package_code_executed}`);
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

  if (options.topic === "inspect") {
    const memoryId = requirePositional(options.target, "memory inspect requires a memory id");
    const memory = readRegistry(workspaceRoot, "memory-cards").filter(isMemoryCard).find((entry) => entry.id === memoryId);
    const tombstone = readRegistry(workspaceRoot, "memory-tombstones").filter(isMemoryTombstone).find((entry) => entry.target_memory_id === memoryId);
    if (!memory && !tombstone) {
      throw new Error(`Memory ${memoryId} not found`);
    }
    printJson({ id: `memory_inspect_${sanitizePathSegment(memoryId)}`, memory, tombstone, active: Boolean(memory) && !tombstone });
    return;
  }

  if (options.topic === "candidates") {
    if (options.fromRun) {
      const workspace = await openWorkspace(workspaceRoot);
      const candidates = deriveMemoryCandidatesFromEvents(await readEvents(workspace), options.fromRun);
      if (candidates.length === 0) {
        throw new Error(`No memory candidates can be derived from run ${options.fromRun}`);
      }
      for (const candidate of candidates) {
        await recordMemoryLifecycleEvent(
          workspaceRoot,
          "memory.candidate.created",
          "candidates",
          candidate.id,
          candidate,
          `Recorded Memory Candidate ${candidate.id} from run ${options.fromRun}; registry projection is updated after the Ledger fact.`
        );
      }
      upsertRegistryItems(workspaceRoot, "memory-candidates", candidates.map(registryItem));
      printRawJson(candidates);
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
    await recordMemoryLifecycleEvent(
      workspaceRoot,
      "memory.candidate.created",
      "candidates",
      candidate.id,
      candidate,
      `Recorded Memory Candidate ${candidate.id} from source event ${options.sourceEvent}; registry projection is updated after the Ledger fact.`
    );
    upsertRegistryItem(workspaceRoot, "memory-candidates", registryItem(candidate));
    printRawJson(candidate);
    return;
  }

  if (options.topic === "timeline") {
    const runId = options.target ?? options.input;
    const workspace = await openWorkspace(workspaceRoot);
    printJson(buildEpisodicTimeline(await readEvents(workspace), runId));
    return;
  }

  if (options.topic === "user-model") {
    const workspace = await openWorkspace(workspaceRoot);
    await requireStrongRegistryProvenance(workspaceRoot, await readEvents(workspace), ["memory-cards"]);
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
    await requireValidContract("memory-card.schema.json", card);
    await recordMemoryLifecycleEvent(
      workspaceRoot,
      "memory.accepted",
      "accept",
      card.id,
      card,
      `Accepted Memory Candidate ${candidate.id} as Memory Card ${card.id}; registry projection is updated after the Ledger fact.`
    );
    upsertRegistryItem(workspaceRoot, "memory-candidates", registryItem(candidate));
    upsertRegistryItem(workspaceRoot, "memory-cards", registryItem(card));
    printRawJson(card);
    return;
  }

  if (options.topic === "reject") {
    const candidateId = requirePositional(options.target, "memory reject requires a candidate id");
    const candidate = readRegistry(workspaceRoot, "memory-candidates").filter(isMemoryCandidate).find((entry) => entry.id === candidateId);
    if (!candidate) {
      throw new Error(`Memory candidate ${candidateId} not found`);
    }
    const rejected = rejectMemoryCandidate(candidate);
    await recordMemoryLifecycleEvent(
      workspaceRoot,
      "memory.rejected",
      "reject",
      rejected.id,
      rejected,
      `Rejected Memory Candidate ${rejected.id}; active memory projection is not changed by this review event.`
    );
    upsertRegistryItem(workspaceRoot, "memory-candidates", registryItem(rejected));
    printRawJson(rejected);
    return;
  }

  if (options.topic === "delete") {
    const memoryId = requirePositional(options.target, "memory delete requires a memory id");
    const memory = readRegistry(workspaceRoot, "memory-cards").filter(isMemoryCard).find((entry) => entry.id === memoryId);
    if (!memory) {
      throw new Error(`Memory card ${memoryId} not found`);
    }
    const tombstone = createMemoryDeleteTombstone(memory, "user_delete_request");
    await requireValidContract("memory-tombstone.schema.json", tombstone);
    await recordMemoryLifecycleEvent(
      workspaceRoot,
      "memory.deleted",
      "delete",
      tombstone.id,
      tombstone,
      `Deleted active Memory Card ${memory.id} through tombstone ${tombstone.id}; Ledger history was not rewritten.`
    );
    removeRegistryItem(workspaceRoot, "memory-cards", memory.id);
    upsertRegistryItem(workspaceRoot, "memory-tombstones", registryItem(tombstone));
    printRawJson(tombstone);
    return;
  }

  if (options.topic === "block") {
    const memoryId = requirePositional(options.target, "memory block requires a memory id");
    const context = options.context ?? "external_send";
    const memory = readRegistry(workspaceRoot, "memory-cards").filter(isMemoryCard).find((entry) => entry.id === memoryId);
    if (!memory) {
      throw new Error(`Memory card ${memoryId} not found`);
    }
    const blocked = blockMemoryContext(memory, context);
    await requireValidContract("memory-card.schema.json", blocked);
    await recordMemoryLifecycleEvent(
      workspaceRoot,
      "memory.blocked",
      "block",
      blocked.id,
      blocked,
      `Blocked Memory Card ${blocked.id} for context ${context}; source provenance is unchanged.`
    );
    upsertRegistryItem(workspaceRoot, "memory-cards", registryItem(blocked));
    printRawJson(blocked);
    return;
  }

  throw new Error("memory supports candidates, timeline, user-model, list, inspect, accept, reject, block, and delete");
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
  await requireStrongRegistryProvenance(workspaceRoot, events, ["memory-cards", "memory-tombstones"]);
  const memories = readRegistry(workspaceRoot, "memory-cards").filter(isMemoryCard);
  const tombstones = readRegistry(workspaceRoot, "memory-tombstones").filter(isMemoryTombstone);
  printJson(assembleContextPack(runId, memories, "planning", tombstones));
}

async function runPrompt(options: CliOptions): Promise<void> {
  if (options.topic !== "plan" && options.topic !== "audit" && options.topic !== "bind-runtime" && options.topic !== "prepare-model-request" && options.topic !== "invoke-model" && options.topic !== "propose-tool-request" && options.topic !== "execute-tool-request") {
    throw new Error("prompt supports plan <run_id> --content <task>, audit <run_id> --content <task> --path <response-file>, bind-runtime <run_id> --content <task>, prepare-model-request <invocation_id>, invoke-model <request_id> --content <task>, propose-tool-request <response_audit_id> --path <workspace-file> --content <intent>, and execute-tool-request <proposal_id> --path <workspace-file> --content <operator-restated intent>");
  }
  if (options.topic === "prepare-model-request") {
    await runPromptPrepareModelRequest(options);
    return;
  }
  if (options.topic === "invoke-model") {
    await runPromptInvokeModel(options);
    return;
  }
  if (options.topic === "propose-tool-request") {
    await runPromptProposeToolRequest(options);
    return;
  }
  if (options.topic === "execute-tool-request") {
    await runPromptExecuteToolRequest(options);
    return;
  }
  if (!options.content) {
    throw new Error(`prompt ${options.topic} requires --content <task>`);
  }
  const workspaceRoot = resolve(options.workspace);
  const runId = options.target ?? options.input;
  const { workspace, plan } = await assemblePromptPlanForRun(workspaceRoot, runId, options.content);
  if (options.topic === "plan") {
    printRawJson(plan);
    return;
  }
  if (options.topic === "bind-runtime") {
    const invocation = createAgentRuntimeInvocationArtifact(plan);
    const artifactRef = await writeAgentRuntimeInvocationArtifact(repoRoot, workspace, invocation);
    const bindingRunId = `run_runtime_binding_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const summary = `Bound ${invocation.id} for source run ${runId}; no model, tool, or runtime authority was granted.`;
    const manifest = await createRunManifest(repoRoot, workspace, bindingRunId, summary);
    const bindingEventId = await appendManagedRunEvent(
      workspaceRoot,
      workspace,
      manifest,
      "agent.runtime.bound",
      summary,
      artifactRef
    );
    await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "completed", [
      { event_type: "agent.runtime.bound", payload_ref: artifactRef }
    ]);
    printRawJson({
      invocation_id: invocation.id,
      source_run_id: runId,
      prompt_plan_id: invocation.prompt_plan_id,
      artifact_ref: artifactRef,
      expected_artifact_ref: agentRuntimeInvocationArtifactRef(invocation.id),
      binding_run_id: bindingRunId,
      binding_event_id: bindingEventId,
      model_invoked: false,
      tools_requested: false,
      runtime_authority_granted: false,
      prompt_artifact_persisted: false,
      raw_payload_artifacts_read: false,
      model_request_artifact_created: false,
      model_response_artifact_created: false
    });
    return;
  }
  const responsePath = requirePositional(options.path, "prompt audit requires --path <response-file>");
  const relativeResponsePath = assertWorkspaceReadPath(workspaceRoot, responsePath);
  const response = readFileSync(join(workspaceRoot, relativeResponsePath), "utf8");
  printRawJson(auditPromptResponse({ plan, response }));
}

async function runModel(options: CliOptions): Promise<void> {
  if (options.topic === "status") {
    printRawJson(buildModelStatus(options));
    return;
  }
  if (options.topic !== "chat") {
    throw new Error("model supports status and chat <workspace-run> --content <task>");
  }
  if (!options.content) {
    throw new Error("model chat requires --content <task>");
  }

  if (options.tools) {
    await runModelAgentLoop(options);
    return;
  }

  const workspaceRoot = resolve(options.workspace);
  const workspace = await ensureModelChatWorkspace(workspaceRoot);
  const requestedRunId = options.target?.startsWith("run_") ? options.target : undefined;
  const runManifest = requestedRunId ? await loadOptionalRunManifest(workspace, requestedRunId) : undefined;
  let sourceRunId = requestedRunId ?? "";
  let sourceRunCreated = false;

  if (runManifest) {
    sourceRunId = runManifest.id;
  } else {
    const source = await runSupervisorKernelLoop({
      repoRoot,
      workspaceRoot,
      runId: `run_model_chat_source_${Date.now()}_${randomUUID().slice(0, 8)}`,
      inputPath: "README.md",
      outputPath: "AETHERION_MODEL_CHAT_SOURCE.md",
      approveWrite: true,
      summaryText: "Model chat source run completed; raw model output is not persisted by this source run."
    });
    sourceRunId = source.runId;
    sourceRunCreated = true;
  }

  await ensureModelChatMemoryProvenance(workspaceRoot, sourceRunId);
  const bindingRecord = await bindRuntimeForModelChat(workspaceRoot, sourceRunId, options.content);
  const prepareRecord = await prepareModelRequestForChat(workspaceRoot, bindingRecord.invocation_id);
  const invokeRecord = await invokeModelForChat(workspaceRoot, prepareRecord.request_id, options.content, options);
  const responseId = String(invokeRecord.response_id ?? "");
  const responseAuditId = String(invokeRecord.response_audit_id ?? "");
  const responseAuditReport = await auditAgentResponseAuditEvidence(repoRoot, workspaceRoot, await readEvents(await openWorkspace(workspaceRoot)));
  const responseFinding = responseAuditReport.findings.find((finding) => finding.audit_id === responseAuditId);

  printRawJson({
    source_run_id: sourceRunId,
    source_run_created: sourceRunCreated,
    invocation_id: bindingRecord.invocation_id,
    request_id: prepareRecord.request_id,
    response_id: responseId,
    response_audit_id: responseAuditId,
    provider_ref: invokeRecord.provider_ref,
    model_ref: invokeRecord.model_ref,
    raw_output_printed: invokeRecord.raw_output_printed,
    output_text: invokeRecord.output_text ?? null,
    output_text_sha256: invokeRecord.output_text_sha256,
    response_payload_sha256: invokeRecord.response_payload_sha256,
    response_audit_evidence_status: responseFinding?.status ?? "missing",
    runtime_authority_granted: Boolean(invokeRecord.runtime_authority_granted),
    tools_requested: Boolean(invokeRecord.tools_requested),
    response_audit_required: Boolean(invokeRecord.response_audit_required),
    response_audit_status: invokeRecord.response_audit_status,
    response_audit_forbidden_claims: invokeRecord.response_audit_forbidden_claims,
    response_audit_missing_blocks: invokeRecord.response_audit_missing_blocks,
    response_audit_missing_citations: invokeRecord.response_audit_missing_citations
  });
}

// Tools-mode chat: runs the iterative agent loop and streams LoopEvent values
// as JSON-lines to stdout. When a tool_proposal needs approval, the event is
// emitted and the process blocks reading one JSON line from stdin
// ({"approve":bool,"reason":...}) so a parent process (e.g. the Go TUI) can
// drive approval. --auto-approve bypasses stdin for L0-L2 reads/writes.
async function runModelAgentLoop(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  await ensureModelChatWorkspace(workspaceRoot);
  const provider = resolveModelProvider({
    providerName: options.modelProvider,
    modelRef: options.modelRef
  });
  const toolRegistry = createV1ToolRegistry();

  // Build a minimal invocation artifact the loop records evidence against. The
  // tools path does not require a pre-existing source run; it derives a
  // self-contained invocation from the user task directly.
  const probeRunId = `run_agent_loop_probe_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const invocation = buildAgentLoopInvocation(workspaceRoot, probeRunId, options.content ?? "");

  const maxLoopDepth = Number.parseInt(process.env.AETHERION_MAX_LOOP_DEPTH ?? "10", 10) || 10;

  // Load persisted memory cards and inject them into the system prompt so the
  // agent has context from prior interactions.
  let systemPrompt: string | undefined;
  try {
    const memRegistry = readRegistry(workspaceRoot, "memory-cards");
    const cards = memRegistry.filter(isMemoryCard);
    if (cards.length > 0) {
      const userModel = createBasicUserModel(cards);
      const knownFacts = cards
        .filter((c) => c.review === "accepted")
        .map((c) => `- ${c.statement}${c.sources && c.sources.length > 0 ? ` (source: ${c.sources[0]})` : ""}`)
        .join("\n");
      const userPrefs = userModel.preferences.length > 0
        ? userModel.preferences.map((p) => `- ${p}`).join("\n")
        : "";
      systemPrompt = [
        "You are Aetherion, a local-first agent harness operating inside a single workspace boundary.",
        "You have four tools: local_file_read, local_file_write (needs approval), shell_exec (needs approval), web_fetch (read-only).",
        "Never claim authority you do not have. Model output cannot authorize actions.",
        "",
        "## Persistent Memory",
        knownFacts || "(no accepted memories yet)",
        userPrefs ? `\n## User Preferences\n${userPrefs}` : "",
        "",
        "When you have enough information, answer the user directly without calling a tool."
      ].join("\n");
    }
  } catch {
    // Memory registry may not exist on first run — that's fine, use default prompt.
  }

  const state = await startAgentLoopState({
    repoRoot,
    workspaceRoot,
    provider,
    modelRef: provider.model_ref,
    toolRegistry,
    invocation,
    maxLoopDepth,
    maxOutputTokens: 1024,
    systemPrompt
  });

  const outputJsonl = options.outputFormat === "jsonl";
  const interactive = options.interactive || !options.autoApprove;
  const writeEvent = (event: LoopEvent): void => {
    if (outputJsonl) {
      process.stdout.write(`${JSON.stringify(event)}\n`);
    }
  };

  const approvalCallback = async (proposal: ToolCallProposal): Promise<{ approved: boolean; reason?: string }> => {
    if (options.autoApprove) {
      // Auto-approve only low-risk (L0-L2) calls; higher risk still asks.
      const lowRisk = proposal.riskLevel === "L0" || proposal.riskLevel === "L1" || proposal.riskLevel === "L2";
      if (lowRisk) {
        return { approved: true };
      }
    }
    if (!interactive) {
      return { approved: true };
    }
    // Emit the proposal event, then block on stdin for a decision line.
    writeEvent({ type: "tool_proposal", proposal });
    const decision = await readApprovalLine(proposal.proposalId);
    return decision;
  };

  for await (const event of runAgentLoop(
    {
      repoRoot,
      workspaceRoot,
      provider,
      modelRef: provider.model_ref,
      toolRegistry,
      invocation,
      maxLoopDepth,
      maxOutputTokens: 1024
    },
    state,
    options.content ?? "",
    approvalCallback
  )) {
    // tool_proposal is emitted inside the approval callback when interactive,
    // so skip re-emitting it here to avoid duplicates.
    if (event.type === "tool_proposal" && interactive) {
      continue;
    }
    writeEvent(event);
  }
}

// Reads a single JSON approval line from stdin. Returns a deny decision on EOF
// or malformed input so the loop never silently auto-approves.
function readApprovalLine(proposalId: string): Promise<{ approved: boolean; reason?: string }> {  return new Promise((resolveDecision) => {
    let buffer = "";
    const onData = (chunk: Buffer): void => {
      buffer += chunk.toString("utf8");
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        process.stdin.removeListener("data", onData);
        process.stdin.removeListener("end", onEnd);
        try {
          const parsed = JSON.parse(line) as { approve?: boolean; approved?: boolean; reason?: string };
          const approved = Boolean(parsed.approve ?? parsed.approved);
          resolveDecision({ approved, reason: parsed.reason });
        } catch {
          resolveDecision({ approved: false, reason: `Malformed approval response for ${proposalId}` });
        }
      }
    };
    const onEnd = (): void => {
      process.stdin.removeListener("data", onData);
      resolveDecision({ approved: false, reason: `stdin closed before approval for ${proposalId}` });
    };
    process.stdin.on("data", onData);
    process.stdin.on("end", onEnd);
  });
}

// ── Daemon mode ─────────────────────────────────────────────────────────
// A foreground REPL that keeps the agent alive. Each stdin line triggers one
// agent loop turn. Wakeup triggers are polled every 60s. SIGINT exits cleanly.

async function runDaemon(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  await ensureModelChatWorkspace(workspaceRoot);

  const provider = resolveModelProvider({
    providerName: options.modelProvider,
    modelRef: options.modelRef
  });
  const toolRegistry = createV1ToolRegistry();
  const maxLoopDepth = Number.parseInt(process.env.AETHERION_MAX_LOOP_DEPTH ?? "10", 10) || 10;

  // Auto-approve L0-L2 in daemon mode; L3+ requires explicit y/n on stdin.
  const approvalCallback = async (proposal: ToolCallProposal): Promise<{ approved: boolean; reason?: string }> => {
    const lowRisk = proposal.riskLevel === "L0" || proposal.riskLevel === "L1" || proposal.riskLevel === "L2";
    if (lowRisk) {
      return { approved: true };
    }
    process.stdout.write(`⚠️ Approve ${proposal.toolName}? [L${proposal.riskLevel}] [y/n] `);
    const decision = await readApprovalLine(proposal.proposalId);
    return decision;
  };

  const writeEvent = (event: LoopEvent): void => {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  };

  // Wakeup poller: check deadline/file triggers every 60s.
  let poller: NodeJS.Timeout | undefined;
  const pollWakeups = (): void => {
    try {
      const triggers = readRegistry(workspaceRoot, "wakeups").filter(isWakeupTrigger);
      const hibernations = readRegistry(workspaceRoot, "hibernations").filter(isHibernationRecord);
      for (const trigger of triggers) {
        if (trigger.status === "expired" || trigger.status === "discarded") {
          continue;
        }
        const evaluated = evaluateWakeup(trigger, hibernations, new Date().toISOString());
        if (evaluated.trigger.status === "eligible" || evaluated.trigger.status === "queued") {
          writeEvent({
            type: "tool_result",
            toolCallId: `wakeup_${trigger.id}`,
            toolName: "wakeup",
            path: "",
            result: `⏰ Wakeup triggered: ${trigger.reason}`,
            success: true
          } as LoopEvent);
          notify("Aetherion — Wakeup", trigger.reason, { quiet: options.quiet });
        }
      }
    } catch {
      // Registry may not exist — that's fine.
    }
  };
  poller = setInterval(pollWakeups, 60_000);

  // Graceful shutdown.
  const shutdown = (): void => {
    if (poller) {
      clearInterval(poller);
    }
    process.stdout.write("\n[aetherion daemon] shutting down.\n");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);

  // Load recent ledger events for session context (resume).
  let sessionContext = "";
  try {
    const ledgerPath = join(workspaceRoot, ".aetherion", "events", "events.jsonl");
    const ledgerText = readFileSync(ledgerPath, "utf8");
    const allEvents = ledgerText.trim().split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as EventRecord)
      .filter((e) => e && typeof e.event_type === "string");
    const recent = allEvents.slice(-20);
    const relevant = recent.filter(
      (e) => e.event_type === "tool.result" ||
             e.event_type === "action.recorded" ||
             e.event_type === "agent.loop.completed"
    );
    if (relevant.length > 0) {
      const lines = relevant.map((e) => `- [${e.event_type}] ${e.summary ?? ""}`);
      sessionContext = `\n\n## Recent Session\n${lines.join("\n")}`;
    }
  } catch {
    // No prior ledger — fresh start.
  }

  // REPL loop.
  const readyMsg = sessionContext
    ? "[aetherion daemon] ready (session resumed). Type a message and press Enter. Ctrl+C to exit.\n"
    : "[aetherion daemon] ready. Type a message and press Enter. Ctrl+C to exit.\n";
  process.stdout.write(readyMsg);
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  for await (const line of rl) {
    const input = line.trim();
    if (!input) {
      continue;
    }
    if (input === "/exit" || input === "/quit") {
      break;
    }

    const runId = `run_daemon_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const invocation = buildAgentLoopInvocation(workspaceRoot, runId, input);

    let systemPrompt: string | undefined;
    const skillSection = formatSkillsForPrompt(scanSkills(workspaceRoot));
    try {
      const memRegistry = readRegistry(workspaceRoot, "memory-cards");
      const cards = memRegistry.filter(isMemoryCard).filter((c) => c.review === "accepted");
      const sections: string[] = [
        "You are Aetherion, a local-first agent harness.",
        "Tools: local_file_read, local_file_write (approval), shell_exec (approval), web_fetch.",
        ""
      ];
      if (cards.length > 0) {
        const knownFacts = cards.map((c) => `- ${c.statement}`).join("\n");
        sections.push("## Persistent Memory", knownFacts, "");
      }
      if (skillSection) {
        sections.push(skillSection, "");
      }
      if (sessionContext) {
        sections.push(sessionContext, "");
      }
      sections.push("Answer directly when you have enough information.");
      systemPrompt = sections.join("\n");
    } catch {
      // No memory registry yet — build prompt with skills + session only.
      if (skillSection || sessionContext) {
        const sections: string[] = [
          "You are Aetherion, a local-first agent harness.",
          "Tools: local_file_read, local_file_write (approval), shell_exec (approval), web_fetch.",
          ""
        ];
        if (skillSection) sections.push(skillSection, "");
        if (sessionContext) sections.push(sessionContext, "");
        sections.push("Answer directly when you have enough information.");
        systemPrompt = sections.join("\n");
      }
    }

    let state;
    try {
      state = await startAgentLoopState({
        repoRoot,
        workspaceRoot,
        provider,
        modelRef: provider.model_ref,
        toolRegistry,
        invocation,
        maxLoopDepth,
        maxOutputTokens: 1024,
        systemPrompt
      });
    } catch (err) {
      process.stdout.write(`[error] failed to start loop: ${err instanceof Error ? err.message : String(err)}\n`);
      continue;
    }

    try {
      for await (const event of runAgentLoop(
        {
          repoRoot,
          workspaceRoot,
          provider,
          modelRef: provider.model_ref,
          toolRegistry,
          invocation,
          maxLoopDepth,
          maxOutputTokens: 1024
        },
        state,
        input,
        approvalCallback
      )) {
        writeEvent(event);
        // Desktop notifications for important events.
        if (!options.quiet) {
          if (event.type === "tool_proposal") {
            const p = (event as Extract<LoopEvent, { type: "tool_proposal" }>).proposal;
            const needsNotify = p.riskLevel === "L3" || p.riskLevel === "L4" || p.riskLevel === "L5";
            if (needsNotify) {
              notify("Aetherion — Approval needed", `${p.toolName} (${p.riskLevel})`);
            }
          } else if (event.type === "loop_complete") {
            const lc = event as Extract<LoopEvent, { type: "loop_complete" }>;
            if (lc.totalToolCalls > 0) {
              notify("Aetherion — Task complete", `${lc.totalToolCalls} tool call(s), ${lc.totalTokens} tokens`);
            }
          }
        }
      }
    } catch (err) {
      process.stdout.write(`[error] loop failed: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  shutdown();
}

// Builds a self-contained AgentRuntimeInvocationArtifact for the tools path.
// Loads the canonical fixture and rewrites the run-scoped identifiers so the
// loop has a valid, schema-conformant invocation to record evidence against,
// without requiring a pre-existing source run in the ledger.
function buildAgentLoopInvocation(workspaceRoot: string, runId: string, task: string): AgentRuntimeInvocationArtifact {
  const fixturePath = join(repoRoot, "examples", "contracts", "agent-runtime-invocation.json");
  const invocation = JSON.parse(readFileSync(fixturePath, "utf8")) as AgentRuntimeInvocationArtifact;
  const taskHash = sha256Hex(task);
  const runHash = sha256Hex(runId);
  invocation.id = `agent_runtime_invocation_${runId}`;
  invocation.run_id = runId;
  invocation.prompt_plan_id = `prompt_${runId}`;
  invocation.entry.context_pack_id = `ctx_${runId}`;
  invocation.entry.output_mode = "answer";
  invocation.prompt.bundle_id = `prompt_bundle_${runId}`;
  invocation.prompt.preview_sha256 = runHash;
  invocation.prompt.message_hashes[2].content_sha256 = taskHash;
  invocation.prompt.role_boundaries[2].source_event_ids = [];
  invocation.context.source_event_ids = [];
  invocation.context.artifact_refs = [`artifact://boundary/${runId}/facts`];
  invocation.invocation_sha256 = sha256Hex(JSON.stringify(invocation));
  return invocation;
}


type ModelStatusReport = {
  schema_version: "aetherion-ether-model-status-v1";
  provider_name: string;
  provider_ref: string | null;
  model_ref: string | null;
  network_capable: boolean;
  credential_required: boolean;
  credential_env_refs: string[];
  credential_resolved: boolean;
  credential_source: "not_required" | "env_present" | "missing" | "invalid_provider";
  provider_error: string | null;
  raw_secret_persisted: false;
  settings_persisted: false;
  tools_allowed: false;
  runtime_authority_granted: false;
  model_output_can_authorize_actions: false;
};

function buildModelStatus(options: Pick<CliOptions, "modelProvider" | "modelRef">, env: Record<string, string | undefined> = process.env): ModelStatusReport {
  const providerName = canonicalModelProviderName(options.modelProvider ?? env.AETHERION_MODEL_PROVIDER ?? "stub");
  const credentialEnvRefs = credentialEnvRefsForProvider(providerName);
  const credentialResolved = credentialEnvRefs.some((name) => typeof env[name] === "string" && env[name] !== "");
  try {
    const provider = resolveModelProvider({
      providerName,
      modelRef: options.modelRef,
      env
    });
    const credentialRequired = credentialEnvRefs.length > 0;
    return {
      schema_version: "aetherion-ether-model-status-v1",
      provider_name: providerName,
      provider_ref: provider.provider_ref,
      model_ref: provider.model_ref,
      network_capable: provider.network_capable,
      credential_required: credentialRequired,
      credential_env_refs: credentialEnvRefs,
      credential_resolved: !credentialRequired || credentialResolved,
      credential_source: credentialRequired ? credentialResolved ? "env_present" : "missing" : "not_required",
      provider_error: null,
      raw_secret_persisted: false,
      settings_persisted: false,
      tools_allowed: false,
      runtime_authority_granted: false,
      model_output_can_authorize_actions: false
    };
  } catch (error) {
    return {
      schema_version: "aetherion-ether-model-status-v1",
      provider_name: providerName,
      provider_ref: null,
      model_ref: options.modelRef ?? env.AETHERION_MODEL_REF ?? null,
      network_capable: false,
      credential_required: credentialEnvRefs.length > 0,
      credential_env_refs: credentialEnvRefs,
      credential_resolved: false,
      credential_source: "invalid_provider",
      provider_error: error instanceof Error ? error.message : String(error),
      raw_secret_persisted: false,
      settings_persisted: false,
      tools_allowed: false,
      runtime_authority_granted: false,
      model_output_can_authorize_actions: false
    };
  }
}

function credentialEnvRefsForProvider(providerName: string): string[] {
  switch (canonicalModelProviderName(providerName)) {
    case "openai_responses":
    case "openai_chat_completions":
      return ["OPENAI_API_KEY", "OPENAI_OAUTH_ACCESS_TOKEN"];
    case "anthropic":
      return ["ANTHROPIC_API_KEY"];
    case "gemini":
      return ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GEMINI_OAUTH_ACCESS_TOKEN", "GOOGLE_OAUTH_ACCESS_TOKEN"];
    default:
      return [];
  }
}

function canonicalModelProviderName(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, "_");
  switch (normalized) {
    case "openai":
    case "openai_response":
    case "openai_responses":
    case "responses":
      return "openai_responses";
    case "openai_chat":
    case "openai_chat_completion":
    case "openai_chat_completions":
    case "openai_completion":
    case "openai_completions":
    case "chat_completions":
      return "openai_chat_completions";
    case "google":
    case "google_gemini":
    case "gemini_generate_content":
      return "gemini";
    default:
      return normalized;
  }
}

function parseModelProviderName(value: string): ModelProviderName {
  const providerName = canonicalModelProviderName(value);
  if (providerName === "stub" || providerName === "openai_responses" || providerName === "openai_chat_completions" || providerName === "anthropic" || providerName === "gemini") {
    return providerName;
  }
  throw new Error("--model-provider must be stub, openai_responses, openai_chat_completions, anthropic, or gemini");
}

async function ensureModelChatWorkspace(workspaceRoot: string): Promise<Awaited<ReturnType<typeof openWorkspace>>> {
  mkdirSync(workspaceRoot, { recursive: true });
  const readmePath = join(workspaceRoot, "README.md");
  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, "# Aetherion workspace\n\nCreated by Ether onboarding for local model chat context.\n", { encoding: "utf8" });
  }
  try {
    return await openWorkspace(workspaceRoot);
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
    const workspace = await createWorkspace(workspaceRoot, workspaceIdForRoot(workspaceRoot));
    await writeWorkspaceRegistry(repoRoot, workspace, "rust-supervisor");
    return workspace;
  }
}

async function ensureModelChatMemoryProvenance(workspaceRoot: string, sourceRunId: string): Promise<void> {
  const workspace = await openWorkspace(workspaceRoot);
  const existing = readRegistry(workspaceRoot, "memory-cards").filter(isMemoryCard);
  if (existing.some((memory) => memory.id === `mem_${sourceRunId}_episode`)) {
    return;
  }
  const candidates = deriveMemoryCandidatesFromEvents(await readEvents(workspace), sourceRunId);
  if (candidates.length === 0) {
    throw new Error(`No memory candidates can be derived from model chat source run ${sourceRunId}`);
  }
  for (const candidate of candidates) {
    await recordMemoryLifecycleEvent(
      workspaceRoot,
      "memory.candidate.created",
      "candidates",
      candidate.id,
      candidate,
      `Recorded Memory Candidate ${candidate.id} from model chat source run ${sourceRunId}; registry projection is updated after the Ledger fact.`
    );
  }
  upsertRegistryItems(workspaceRoot, "memory-candidates", candidates.map(registryItem));
  const episodeId = `memcand_${sourceRunId}_episode`;
  const { candidate, card } = acceptCandidateFromRegistry(candidates, episodeId);
  await requireValidContract("memory-card.schema.json", card);
  await recordMemoryLifecycleEvent(
    workspaceRoot,
    "memory.accepted",
    "accept",
    card.id,
    card,
    `Accepted model chat Memory Candidate ${candidate.id} as Memory Card ${card.id}; registry projection is updated after the Ledger fact.`
  );
  upsertRegistryItem(workspaceRoot, "memory-candidates", registryItem(candidate));
  upsertRegistryItem(workspaceRoot, "memory-cards", registryItem(card));
}

async function bindRuntimeForModelChat(workspaceRoot: string, sourceRunId: string, task: string): Promise<{
  invocation_id: string;
  artifact_ref: string;
  binding_run_id: string;
  binding_event_id: string;
}> {
  const { workspace, plan } = await assemblePromptPlanForRun(workspaceRoot, sourceRunId, task);
  const invocation = createAgentRuntimeInvocationArtifact(plan);
  const artifactRef = await writeAgentRuntimeInvocationArtifact(repoRoot, workspace, invocation);
  const bindingRunId = `run_runtime_binding_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const summary = `Bound ${invocation.id} for source run ${sourceRunId}; no model, tool, or runtime authority was granted.`;
  const manifest = await createRunManifest(repoRoot, workspace, bindingRunId, summary);
  const bindingEventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "agent.runtime.bound", summary, artifactRef);
  await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "completed", [
    { event_type: "agent.runtime.bound", payload_ref: artifactRef }
  ]);
  return {
    invocation_id: invocation.id,
    artifact_ref: artifactRef,
    binding_run_id: bindingRunId,
    binding_event_id: bindingEventId
  };
}

async function prepareModelRequestForChat(workspaceRoot: string, invocationId: string): Promise<{ request_id: string }> {
  const workspace = await openWorkspace(workspaceRoot);
  const invocation = await readAgentRuntimeInvocationArtifact(workspaceRoot, invocationId);
  if (!invocation) {
    throw new Error(`Agent Runtime Invocation artifact ${invocationId} not found`);
  }
  const invocationRef = agentRuntimeInvocationArtifactRef(invocation.id);
  const bindingEvent = (await readEvents(workspace)).find((event) =>
    event.event_type === "agent.runtime.bound" && event.payload_ref === invocationRef
  );
  if (!bindingEvent) {
    throw new Error(`Agent Runtime Invocation ${invocationId} has no agent.runtime.bound Ledger evidence`);
  }
  const requestId = `agent_model_request_${sanitizePathSegment(invocation.run_id)}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const request = createAgentModelRequestArtifact(invocation, requestId);
  const requestRef = await writeAgentModelRequestArtifact(repoRoot, workspace, request);
  const requestRunId = `run_model_request_${sanitizePathSegment(invocation.run_id)}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const summary = `Prepared no-tools model request metadata for ${invocation.id}; no provider, network, tool, lease, or runtime authority was used.`;
  const manifest = await createRunManifest(repoRoot, workspace, requestRunId, summary);
  await appendManagedRunEvent(workspaceRoot, workspace, manifest, "agent.model.requested", summary, requestRef);
  await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "completed", [
    { event_type: "agent.model.requested", payload_ref: requestRef }
  ]);
  return { request_id: request.id };
}

async function invokeModelForChat(workspaceRoot: string, requestId: string, task: string, options: CliOptions): Promise<Record<string, unknown>> {
  const request = await readAgentModelRequestArtifact(workspaceRoot, requestId);
  if (!request) {
    throw new Error(`Agent Model Request artifact ${requestId} not found`);
  }
  const requestRef = agentModelRequestArtifactRef(request.id);
  const workspace = await openWorkspace(workspaceRoot);
  const ledger = await readEvents(workspace);
  const requestEvent = ledger.find((event) => event.event_type === "agent.model.requested" && event.payload_ref === requestRef);
  if (!requestEvent) {
    throw new Error(`Agent Model Request ${requestId} has no agent.model.requested Ledger evidence`);
  }
  const { plan } = await assemblePromptPlanForRun(workspaceRoot, request.run_id, task);
  assertPromptMatchesBoundRequest(plan, request);

  const provider = resolveModelProvider({
    providerName: options.modelProvider,
    modelRef: options.modelRef
  });
  const messages: ModelMessage[] = plan.messages.map((message) => ({ role: message.role, content: message.content }));
  const result = await provider.invoke({
    provider_ref: provider.provider_ref,
    model_ref: provider.model_ref,
    output_mode: request.request.output_mode,
    messages,
    max_output_tokens: 1024,
    response_contract: {
      required_blocks: plan.response_format.required_blocks.map((block) => ({ id: block.id, title: block.title })),
      required_citation_ids: plan.response_audit_contract.required_citation_ids
    }
  });

  const outputTextSha = sha256Hex(result.output_text);
  const responsePayloadSha = sha256Hex(stableResponsePayload(result));
  const responseId = modelResponseIdForRequest(request.id);
  const response = createAgentModelResponseArtifact({
    request,
    responseId,
    provider_ref: provider.provider_ref,
    model_ref: provider.model_ref,
    output_text_sha256: outputTextSha,
    response_payload_sha256: responsePayloadSha,
    finish_reason: result.finish_reason,
    refusal_present: result.refusal_present,
    tool_calls_present: result.tool_calls_present,
    usage: result.usage
  });
  const responseRef = await writeAgentModelResponseArtifact(repoRoot, workspace, response);
  const responseRunId = `run_model_response_${sanitizePathSegment(request.run_id)}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const summary = `Recorded model response ${response.id} for ${request.id}; output is hash-only evidence, requires response audit, and cannot authorize actions.`;
  const manifest = await createRunManifest(repoRoot, workspace, responseRunId, summary);
  const responseEventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "agent.model.responded", summary, responseRef);
  await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "completed", [
    { event_type: "agent.model.responded", payload_ref: responseRef }
  ]);

  const audit = auditPromptResponse({ plan, response: result.output_text });
  const auditId = responseAuditIdForResponse(response.id);
  const auditArtifact = createAgentResponseAuditArtifact({
    response,
    auditId,
    status: audit.status,
    required_block_ids: audit.required_block_ids,
    present_block_ids: audit.present_block_ids,
    missing_block_ids: audit.missing_block_ids,
    required_citation_ids: audit.required_citation_ids,
    cited_source_event_ids: audit.cited_source_event_ids,
    missing_citation_ids: audit.missing_citation_ids,
    unknown_source_event_ids: audit.unknown_source_event_ids,
    forbidden_claims_detected: audit.forbidden_claims_detected,
    findings: audit.findings,
    next_steps: audit.next_steps
  });
  const auditRef = await writeAgentResponseAuditArtifact(repoRoot, workspace, auditArtifact);
  const auditRunId = `run_response_audit_${sanitizePathSegment(request.run_id)}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const auditSummary = `Recorded local response audit ${auditArtifact.id} for ${response.id}; audit output is non-authorizing and is not runtime verification.`;
  const auditManifest = await createRunManifest(repoRoot, workspace, auditRunId, auditSummary);
  const auditEventId = await appendManagedRunEvent(workspaceRoot, workspace, auditManifest, "agent.response.audit.recorded", auditSummary, auditRef);
  await completeRunManifestWithEventSequence(repoRoot, workspace, auditManifest, "completed", [
    { event_type: "agent.response.audit.recorded", payload_ref: auditRef }
  ]);

  return promptInvokeModelConsoleOutput({
    response_id: response.id,
    request_id: request.id,
    source_run_id: request.run_id,
    invocation_id: request.runtime_invocation_id,
    request_artifact_ref: requestRef,
    request_event_id: requestEvent.id,
    response_artifact_ref: responseRef,
    expected_response_artifact_ref: agentModelResponseArtifactRef(response.id),
    response_run_id: responseRunId,
    response_event_id: responseEventId,
    response_audit_id: auditArtifact.id,
    response_audit_artifact_ref: auditRef,
    expected_response_audit_artifact_ref: agentResponseAuditArtifactRef(auditArtifact.id),
    response_audit_run_id: auditRunId,
    response_audit_event_id: auditEventId,
    provider_ref: provider.provider_ref,
    model_ref: provider.model_ref,
    network_capable: provider.network_capable,
    finish_reason: response.response.finish_reason,
    refusal_present: response.response.refusal_present,
    tool_calls_present: response.tool_gateway.tool_calls_present,
    output_text_sha256: response.response.output_text_sha256,
    response_payload_sha256: response.response.response_payload_sha256,
    usage: response.usage,
    model_invoked: true,
    provider_called: true,
    credential_resolved: false,
    raw_response_persisted: false,
    raw_prompt_persisted: false,
    tools_requested: false,
    tool_request_events_appended: false,
    runtime_authority_granted: false,
    response_audit_required: true,
    response_audit_status: audit.status,
    response_audit_missing_blocks: audit.missing_block_ids,
    response_audit_missing_citations: audit.missing_citation_ids,
    response_audit_unknown_source_events: audit.unknown_source_event_ids,
    response_audit_forbidden_claims: audit.forbidden_claims_detected,
    response_audit_can_authorize_actions: false,
    response_audit_is_runtime_verification: false
  }, result.output_text, { printOutput: true });
}

async function runPromptPrepareModelRequest(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  const workspace = await openWorkspace(workspaceRoot);
  const invocationId = requirePositional(options.target ?? options.input, "prompt prepare-model-request requires an Agent Runtime Invocation id");
  if (!invocationId.startsWith("agent_runtime_invocation_")) {
    throw new Error("prompt prepare-model-request requires an Agent Runtime Invocation id");
  }
  const invocation = await readAgentRuntimeInvocationArtifact(workspaceRoot, invocationId);
  if (!invocation) {
    throw new Error(`Agent Runtime Invocation artifact ${invocationId} not found`);
  }
  if (invocation.status !== "scaffold_ready" || !invocation.model_call.model_preview_ready) {
    throw new Error(`Agent Runtime Invocation ${invocationId} is not ready for model-request preparation`);
  }
  const invocationRef = agentRuntimeInvocationArtifactRef(invocation.id);
  const bindingEvent = (await readEvents(workspace)).find((event) =>
    event.event_type === "agent.runtime.bound" && event.payload_ref === invocationRef
  );
  if (!bindingEvent) {
    throw new Error(`Agent Runtime Invocation ${invocationId} has no agent.runtime.bound Ledger evidence`);
  }
  const requestId = `agent_model_request_${sanitizePathSegment(invocation.run_id)}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const request = createAgentModelRequestArtifact(invocation, requestId);
  const requestRef = await writeAgentModelRequestArtifact(repoRoot, workspace, request);
  const requestRunId = `run_model_request_${sanitizePathSegment(invocation.run_id)}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const summary = `Prepared no-tools model request metadata for ${invocation.id}; no provider, network, tool, lease, or runtime authority was used.`;
  const manifest = await createRunManifest(repoRoot, workspace, requestRunId, summary);
  const requestEventId = await appendManagedRunEvent(
    workspaceRoot,
    workspace,
    manifest,
    "agent.model.requested",
    summary,
    requestRef
  );
  await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "completed", [
    { event_type: "agent.model.requested", payload_ref: requestRef }
  ]);
  printRawJson({
    request_id: request.id,
    source_run_id: invocation.run_id,
    invocation_id: invocation.id,
    runtime_invocation_artifact_ref: invocationRef,
    runtime_binding_event_id: bindingEvent.id,
    request_artifact_ref: requestRef,
    expected_request_artifact_ref: agentModelRequestArtifactRef(request.id),
    request_run_id: requestRunId,
    request_event_id: requestEventId,
    mode: request.request.mode,
    model_invoked: false,
    provider_called: false,
    network_call_attempted: false,
    tools_requested: false,
    tool_request_events_appended: false,
    runtime_authority_granted: false,
    raw_prompt_persisted: false,
    raw_context_persisted: false,
    response_artifact_created: false
  });
}

async function runPromptInvokeModel(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  const requestId = requirePositional(options.target ?? options.input, "prompt invoke-model requires an Agent Model Request id");
  if (!requestId.startsWith("agent_model_request_")) {
    throw new Error("prompt invoke-model requires an Agent Model Request id");
  }
  if (!options.content) {
    throw new Error("prompt invoke-model requires --content <task> to re-derive and verify the bound prompt");
  }
  const request = await readAgentModelRequestArtifact(workspaceRoot, requestId);
  if (!request) {
    throw new Error(`Agent Model Request artifact ${requestId} not found`);
  }
  const requestRef = agentModelRequestArtifactRef(request.id);
  const workspaceForEvidence = await openWorkspace(workspaceRoot);
  const ledger = await readEvents(workspaceForEvidence);
  const requestEvent = ledger.find((event) =>
    event.event_type === "agent.model.requested" && event.payload_ref === requestRef
  );
  if (!requestEvent) {
    throw new Error(`Agent Model Request ${requestId} has no agent.model.requested Ledger evidence`);
  }
  if (ledger.some((event) => event.event_type === "agent.model.responded" && event.payload_ref === agentModelResponseArtifactRef(modelResponseIdForRequest(request.id)))) {
    throw new Error(`Agent Model Request ${requestId} already has a recorded response`);
  }

  // Re-derive the prompt from the same provenance-gated path and prove it
  // matches the bound request hashes before any provider call. Drift fails
  // closed so a model can never be invoked on a prompt that differs from what
  // was audited and bound.
  const { plan } = await assemblePromptPlanForRun(workspaceRoot, request.run_id, options.content);
  assertPromptMatchesBoundRequest(plan, request);

  const provider = resolveModelProvider();
  const messages: ModelMessage[] = plan.messages.map((message) => ({ role: message.role, content: message.content }));
  const result = await provider.invoke({
    provider_ref: provider.provider_ref,
    model_ref: provider.model_ref,
    output_mode: request.request.output_mode,
    messages,
    max_output_tokens: 1024,
    response_contract: {
      required_blocks: plan.response_format.required_blocks.map((block) => ({ id: block.id, title: block.title })),
      required_citation_ids: plan.response_audit_contract.required_citation_ids
    }
  });

  // Persist hashes only. Raw output text and the provider payload stay in
  // memory; the artifact records that a model ran, never its content.
  const outputTextSha = sha256Hex(result.output_text);
  const responsePayloadSha = sha256Hex(stableResponsePayload(result));
  const responseId = modelResponseIdForRequest(request.id);
  const response = createAgentModelResponseArtifact({
    request,
    responseId,
    provider_ref: provider.provider_ref,
    model_ref: provider.model_ref,
    output_text_sha256: outputTextSha,
    response_payload_sha256: responsePayloadSha,
    finish_reason: result.finish_reason,
    refusal_present: result.refusal_present,
    tool_calls_present: result.tool_calls_present,
    usage: result.usage
  });
  const responseRef = await writeAgentModelResponseArtifact(repoRoot, workspaceForEvidence, response);

  const responseRunId = `run_model_response_${sanitizePathSegment(request.run_id)}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const summary = `Recorded model response ${response.id} for ${request.id}; output is hash-only evidence, requires response audit, and cannot authorize actions.`;
  const manifest = await createRunManifest(repoRoot, workspaceForEvidence, responseRunId, summary);
  const responseEventId = await appendManagedRunEvent(
    workspaceRoot,
    workspaceForEvidence,
    manifest,
    "agent.model.responded",
    summary,
    responseRef
  );
  await completeRunManifestWithEventSequence(repoRoot, workspaceForEvidence, manifest, "completed", [
    { event_type: "agent.model.responded", payload_ref: responseRef }
  ]);

  // The response audit is local output linting. It is recorded as its own
  // governance event so the response-audit gate has traceable evidence, but it
  // still cannot authorize actions or claim runtime verification.
  const audit = auditPromptResponse({ plan, response: result.output_text });
  const auditId = responseAuditIdForResponse(response.id);
  const auditArtifact = createAgentResponseAuditArtifact({
    response,
    auditId,
    status: audit.status,
    required_block_ids: audit.required_block_ids,
    present_block_ids: audit.present_block_ids,
    missing_block_ids: audit.missing_block_ids,
    required_citation_ids: audit.required_citation_ids,
    cited_source_event_ids: audit.cited_source_event_ids,
    missing_citation_ids: audit.missing_citation_ids,
    unknown_source_event_ids: audit.unknown_source_event_ids,
    forbidden_claims_detected: audit.forbidden_claims_detected,
    findings: audit.findings,
    next_steps: audit.next_steps
  });
  const auditRef = await writeAgentResponseAuditArtifact(repoRoot, workspaceForEvidence, auditArtifact);
  const auditRunId = `run_response_audit_${sanitizePathSegment(request.run_id)}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const auditSummary = `Recorded local response audit ${auditArtifact.id} for ${response.id}; audit output is non-authorizing and is not runtime verification.`;
  const auditManifest = await createRunManifest(repoRoot, workspaceForEvidence, auditRunId, auditSummary);
  const auditEventId = await appendManagedRunEvent(
    workspaceRoot,
    workspaceForEvidence,
    auditManifest,
    "agent.response.audit.recorded",
    auditSummary,
    auditRef
  );
  await completeRunManifestWithEventSequence(repoRoot, workspaceForEvidence, auditManifest, "completed", [
    { event_type: "agent.response.audit.recorded", payload_ref: auditRef }
  ]);

  const output = promptInvokeModelConsoleOutput({
    response_id: response.id,
    request_id: request.id,
    source_run_id: request.run_id,
    invocation_id: request.runtime_invocation_id,
    request_artifact_ref: requestRef,
    request_event_id: requestEvent.id,
    response_artifact_ref: responseRef,
    expected_response_artifact_ref: agentModelResponseArtifactRef(response.id),
    response_run_id: responseRunId,
    response_event_id: responseEventId,
    response_audit_id: auditArtifact.id,
    response_audit_artifact_ref: auditRef,
    expected_response_audit_artifact_ref: agentResponseAuditArtifactRef(auditArtifact.id),
    response_audit_run_id: auditRunId,
    response_audit_event_id: auditEventId,
    provider_ref: provider.provider_ref,
    model_ref: provider.model_ref,
    network_capable: provider.network_capable,
    finish_reason: response.response.finish_reason,
    refusal_present: response.response.refusal_present,
    tool_calls_present: response.tool_gateway.tool_calls_present,
    output_text_sha256: response.response.output_text_sha256,
    response_payload_sha256: response.response.response_payload_sha256,
    usage: response.usage,
    model_invoked: true,
    provider_called: true,
    credential_resolved: false,
    raw_response_persisted: false,
    raw_prompt_persisted: false,
    tools_requested: false,
    tool_request_events_appended: false,
    runtime_authority_granted: false,
    response_audit_required: true,
    response_audit_status: audit.status,
    response_audit_missing_blocks: audit.missing_block_ids,
    response_audit_missing_citations: audit.missing_citation_ids,
    response_audit_unknown_source_events: audit.unknown_source_event_ids,
    response_audit_forbidden_claims: audit.forbidden_claims_detected,
    response_audit_can_authorize_actions: false,
    response_audit_is_runtime_verification: false
  }, result.output_text, options);
  printRawJson(output);
}

function promptInvokeModelConsoleOutput(
  metadata: Record<string, unknown>,
  outputText: string,
  options: Pick<CliOptions, "printOutput">
): Record<string, unknown> {
  const output: Record<string, unknown> = {
    ...metadata,
    raw_output_printed: options.printOutput
  };
  if (options.printOutput) {
    output.output_text = outputText;
  }
  return output;
}

async function runPromptProposeToolRequest(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  const auditId = requirePositional(options.target ?? options.input, "prompt propose-tool-request requires an Agent Response Audit id");
  if (!auditId.startsWith("agent_response_audit_")) {
    throw new Error("prompt propose-tool-request requires an Agent Response Audit id");
  }
  if (!options.content) {
    throw new Error("prompt propose-tool-request requires --content <operator-restated intent>");
  }
  const targetPath = requirePositional(options.path, "prompt propose-tool-request requires --path <workspace-file>");
  const relativeTargetPath = assertWorkspaceReadPath(workspaceRoot, targetPath);
  const auditArtifact = await readAgentResponseAuditArtifact(workspaceRoot, auditId);
  if (!auditArtifact) {
    throw new Error(`Agent Response Audit artifact ${auditId} not found`);
  }
  if (auditArtifact.status !== "pass") {
    throw new Error(`Agent Response Audit ${auditId} status is ${auditArtifact.status}; refusing to record a tool request proposal`);
  }

  const workspace = await openWorkspace(workspaceRoot);
  const ledger = await readEvents(workspace);
  const evidence = await auditAgentResponseAuditEvidence(repoRoot, workspaceRoot, ledger);
  const finding = evidence.findings.find((entry) => entry.audit_id === auditArtifact.id);
  if (!finding || finding.status !== "matched") {
    throw new Error(`Agent Response Audit ${auditId} evidence is not matched; refusing to record a tool request proposal`);
  }
  const related = finding.related_event_ids;
  if (!related?.runtime_bound || !related.model_requested || !related.model_responded || !related.response_audit_recorded) {
    throw new Error(`Agent Response Audit ${auditId} matched evidence is missing required event ids`);
  }

  const proposalId = `agent_tool_request_proposal_${sanitizePathSegment(auditArtifact.run_id)}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const proposal = createAgentToolRequestProposalArtifact({
    responseAudit: auditArtifact,
    proposalId,
    intent: options.content,
    target_uri: workspaceFileUri(relativeTargetPath),
    target_label: relativeTargetPath,
    expected_effect: "Preview a possible local file read; no tool request, policy decision, lease, or tool execution is emitted.",
    source_evidence: {
      runtime_bound_event_id: related.runtime_bound,
      model_requested_event_id: related.model_requested,
      model_responded_event_id: related.model_responded,
      response_audit_recorded_event_id: related.response_audit_recorded
    }
  });
  const proposalRef = await writeAgentToolRequestProposalArtifact(repoRoot, workspace, proposal);
  const proposalRunId = `run_tool_request_proposal_${sanitizePathSegment(auditArtifact.run_id)}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const summary = `Recorded non-authorizing tool request proposal ${proposal.id} from passed response audit ${auditArtifact.id}; no tool request, policy, lease, or execution was created.`;
  const manifest = await createRunManifest(repoRoot, workspace, proposalRunId, summary);
  const proposalEventId = await appendManagedRunEvent(
    workspaceRoot,
    workspace,
    manifest,
    "agent.tool.request.proposed",
    summary,
    proposalRef
  );
  await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "completed", [
    { event_type: "agent.tool.request.proposed", payload_ref: proposalRef }
  ]);

  printRawJson({
    proposal_id: proposal.id,
    source_run_id: proposal.run_id,
    response_audit_id: proposal.response_audit_id,
    response_audit_artifact_ref: proposal.response_audit_artifact_ref,
    response_audit_status: auditArtifact.status,
    response_audit_evidence_status: finding.status,
    response_id: proposal.response_id,
    request_id: proposal.request_id,
    runtime_invocation_id: proposal.runtime_invocation_id,
    proposal_artifact_ref: proposalRef,
    expected_proposal_artifact_ref: agentToolRequestProposalArtifactRef(proposal.id),
    proposal_run_id: proposalRunId,
    proposal_event_id: proposalEventId,
    operation_verb: proposal.proposal.operation.verb,
    target_uri: proposal.proposal.operation.target.uri,
    target_label: proposal.proposal.operation.target.label,
    tool_requested: proposal.scope.tool_requested,
    policy_decided: proposal.scope.policy_decided,
    lease_issued: proposal.scope.lease_issued,
    tool_executed: proposal.scope.tool_executed,
    action_recorded: proposal.scope.action_recorded,
    observation_recorded: proposal.scope.observation_recorded,
    verification_recorded: proposal.scope.verification_recorded,
    raw_response_persisted: proposal.scope.raw_response_persisted,
    raw_prompt_persisted: proposal.scope.raw_prompt_persisted,
    runtime_authority_granted: proposal.scope.runtime_authority_granted,
    proposal_can_authorize_actions: proposal.authority_gates.proposal_can_authorize_actions,
    requires_tool_policy_proxy: proposal.authority_gates.requires_tool_policy_proxy,
    requires_fresh_policy_decision: proposal.authority_gates.requires_fresh_policy_decision,
    requires_scoped_lease: proposal.authority_gates.requires_scoped_lease
  });
}

async function runPromptExecuteToolRequest(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  const proposalId = requirePositional(options.target ?? options.input, "prompt execute-tool-request requires an Agent Tool Request Proposal id");
  if (!proposalId.startsWith("agent_tool_request_proposal_")) {
    throw new Error("prompt execute-tool-request requires an Agent Tool Request Proposal id");
  }
  if (!options.content) {
    throw new Error("prompt execute-tool-request requires --content <operator-restated intent>");
  }
  const targetPath = requirePositional(options.path, "prompt execute-tool-request requires --path <workspace-file>");
  const relativeTargetPath = assertWorkspaceReadPath(workspaceRoot, targetPath);
  const proposal = await readAgentToolRequestProposalArtifact(workspaceRoot, proposalId);
  if (!proposal) {
    throw new Error(`Agent Tool Request Proposal artifact ${proposalId} not found`);
  }
  const proposalUri = proposal.proposal.operation.target.uri;
  const restatedUri = workspaceFileUri(relativeTargetPath);
  if (proposal.proposal.operation.verb !== "read" || proposal.proposal.operation.target.kind !== "file") {
    throw new Error(`Agent Tool Request Proposal ${proposalId} is not a workspace file-read proposal`);
  }
  if (proposalUri !== restatedUri) {
    throw new Error(`Operator-restated path ${restatedUri} does not match proposal target ${proposalUri}; refusing path drift`);
  }

  const workspace = await openWorkspace(workspaceRoot);
  const ledger = await readEvents(workspace);
  const evidence = await auditPromptModelArtifactEvidence(repoRoot, workspaceRoot, ledger);
  const finding = evidence.findings.find((entry) =>
    entry.artifact_kind === "tool_request_proposal" && entry.artifact_id === proposal.id
  );
  if (!finding || finding.status !== "matched") {
    throw new Error(`Agent Tool Request Proposal ${proposalId} evidence is not matched; refusing supervisor execution`);
  }
  const related = finding.related_event_ids;
  if (!related?.runtime_bound || !related.model_requested || !related.model_responded || !related.response_audit_recorded || !related.tool_request_proposed) {
    throw new Error(`Agent Tool Request Proposal ${proposalId} matched evidence is missing required event ids`);
  }

  const executionRunId = `run_tool_request_execution_${sanitizePathSegment(proposal.run_id)}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const summary = `Evaluated operator-restated file-read proposal ${proposal.id} through fresh supervisor policy; the proposal itself remained non-authorizing and any lease must come from the execution run.`;
  const manifest = await createRunManifest(repoRoot, workspace, executionRunId, summary);
  const readResult = rpcResult(await callSupervisorRpc(repoRoot, {
    id: `rpc_${executionRunId}_proposal_read`,
    method: "file.read.traced",
    workspace_root: workspaceRoot,
    workspace_id: workspace.id,
    run_id: executionRunId,
    path: join(workspaceRoot, relativeTargetPath)
  }));
  const eventKeys = readResult.decision === "allow"
    ? ["request_event_id", "risk_event_id", "policy_event_id", "lease_event_id", "result_event_id"]
    : ["request_event_id", "risk_event_id", "policy_event_id", "result_event_id"];
  await recordSupervisorEventIds(workspace, manifest, readResult, eventKeys);
  await completeRunManifestWithEventSequence(
    repoRoot,
    workspace,
    manifest,
    readResult.decision === "allow" ? "completed" : "blocked",
    readResult.decision === "allow"
      ? [
          { event_type: "tool.requested" },
          { event_type: "risk.composed" },
          { event_type: "policy.decided" },
          { event_type: "lease.issued" },
          { event_type: "tool.result" }
        ]
      : [
          { event_type: "tool.requested" },
          { event_type: "risk.composed" },
          { event_type: "policy.decided" },
          { event_type: "tool.result" }
        ]
  );
  printRawJson({
    execution_run_id: executionRunId,
    source_run_id: proposal.run_id,
    proposal_id: proposal.id,
    proposal_artifact_ref: agentToolRequestProposalArtifactRef(proposal.id),
    proposal_event_id: related.tool_request_proposed,
    response_audit_id: proposal.response_audit_id,
    response_audit_event_id: related.response_audit_recorded,
    operator_restatement_required: true,
    operator_restatement_sha256: sha256Hex(options.content),
    proposal_target_uri: proposalUri,
    operator_target_uri: restatedUri,
    path_drift_detected: false,
    proposal_can_authorize_actions: proposal.authority_gates.proposal_can_authorize_actions,
    proposal_reused_authority: false,
    fresh_policy_required: proposal.authority_gates.requires_fresh_policy_decision,
    fresh_policy_decision: readResult.decision,
    scoped_lease_required: proposal.authority_gates.requires_scoped_lease,
    lease_issued: readResult.decision === "allow",
    tool_executed: readResult.decision === "allow",
    tool_result_persisted: true,
    raw_response_persisted: proposal.scope.raw_response_persisted,
    raw_prompt_persisted: proposal.scope.raw_prompt_persisted,
    request_id: readResult.request_id,
    request_event_id: readResult.request_event_id,
    risk_event_id: readResult.risk_event_id,
    policy_decision_id: readResult.policy_decision_id,
    policy_event_id: readResult.policy_event_id,
    lease_event_id: readResult.decision === "allow" ? readResult.lease_event_id : "",
    result_event_id: readResult.result_event_id,
    risk_level: readResult.risk_level,
    lease_id: readResult.decision === "allow" ? readResult.lease_id : "",
    contents_sha256: typeof readResult.contents === "string" ? sha256Hex(readResult.contents) : null,
    contents_bytes: typeof readResult.contents === "string" ? Buffer.byteLength(readResult.contents) : 0,
    contents_printed: false,
    denial_reason_sha256: typeof readResult.reason === "string" ? sha256Hex(readResult.reason) : null,
    denial_reason_printed: false
  });
}

function assertPromptMatchesBoundRequest(plan: PromptPlan, request: AgentModelRequestArtifactShape): void {
  const planBundle = plan.prompt_bundle;
  if (planBundle.id !== request.request.prompt_bundle_id) {
    throw new Error(`Re-derived prompt bundle ${planBundle.id} does not match bound request ${request.request.prompt_bundle_id}`);
  }
  if (planBundle.preview_sha256 !== request.request.prompt_preview_sha256) {
    throw new Error("Re-derived prompt preview hash does not match the bound model request; refusing to invoke the model on a drifted prompt");
  }
  const planMessageHashes = planBundle.message_hashes.map((message) => `${message.role}:${message.content_sha256}`);
  const requestMessageHashes = request.prompt_hashes.map((message) => `${message.role}:${message.content_sha256}`);
  if (planMessageHashes.length !== requestMessageHashes.length
    || planMessageHashes.some((value, index) => value !== requestMessageHashes[index])) {
    throw new Error("Re-derived prompt message hashes do not match the bound model request; refusing to invoke the model on a drifted prompt");
  }
}

type AgentModelRequestArtifactShape = NonNullable<Awaited<ReturnType<typeof readAgentModelRequestArtifact>>>;

function modelResponseIdForRequest(requestId: string): string {
  return `agent_model_response_${requestId.replace(/^agent_model_request_/, "")}`;
}

function responseAuditIdForResponse(responseId: string): string {
  return `agent_response_audit_${responseId.replace(/^agent_model_response_/, "")}`;
}

function stableResponsePayload(result: { output_text: string; finish_reason: string; refusal_present: boolean; tool_calls_present: boolean; usage: unknown }): string {
  return JSON.stringify({
    finish_reason: result.finish_reason,
    output_text: result.output_text,
    refusal_present: result.refusal_present,
    tool_calls_present: result.tool_calls_present,
    usage: result.usage
  });
}

function sha256Hex(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function hashDigest(value: string): string {
  return value.startsWith("sha256:") ? value.slice("sha256:".length) : value;
}

function stableCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableCanonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => `${JSON.stringify(key)}:${stableCanonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function workspaceFileUri(relativePath: string): string {
  return `workspace://${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

async function assemblePromptPlanForRun(workspaceRoot: string, runId: string, task: string): Promise<{
  workspace: Awaited<ReturnType<typeof openWorkspace>>;
  plan: PromptPlan;
}> {
  const workspace = await openWorkspace(workspaceRoot);
  const events = await readEvents(workspace);
  if (!events.some((event) => event.run_id === runId)) {
    throw new Error(`Run ${runId} has no ledger events`);
  }
  await requireStrongRegistryProvenance(workspaceRoot, events, ["memory-cards", "memory-tombstones"]);
  const memories = readRegistry(workspaceRoot, "memory-cards").filter(isMemoryCard);
  const tombstones = readRegistry(workspaceRoot, "memory-tombstones").filter(isMemoryTombstone);
  const contextPack = assembleContextPack(runId, memories, "planning", tombstones);
  return {
    workspace,
    plan: assemblePromptPlan({
      task,
      contextPack,
      sourceEvents: events,
      allowedTools: contextPack.capability_cards,
      forbiddenTools: ["network.raw", "filesystem.write"],
      activePermissions: contextPack.active_leases,
      outputMode: "plan"
    })
  };
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

  const { workspace, registry: workspaceRegistry } = await loadWorkspaceFromRegistry(workspaceRoot);
  await assertSandboxPromotionEvidence(workspaceRoot, workspace, checkpoint, branch, rehearsal);
  const promotionRunId = `run_rehearsal_${sanitizePathSegment(rehearsal.id)}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const manifest = await createRunManifest(repoRoot, workspace, promotionRunId, `Approve sandbox rehearsal ${rehearsal.id}`);
  const boundaryRef = await writeBoundaryFactsArtifact(repoRoot, workspace, createBoundaryFacts({
    workspace,
    registry: workspaceRegistry,
    manifest,
    workspaceFileWriteRequested: true
  }));
  await appendManagedRunEvent(
    workspaceRoot,
    workspace,
    manifest,
    "run.started",
    `Started independent sandbox promotion run for rehearsal ${rehearsal.id}; checkpoint ${checkpoint.id} authority was not reused.`,
    boundaryRef
  );

  let policyEventId = "";
  let liveActionEventId = "";
  let newLeaseId: string | undefined;
  let verificationStatus: "passed" | "failed" | undefined;
  let realSideEffectExecuted = false;

  if (rehearsal.operation === "file.write") {
    if (!rehearsal.target_path || !rehearsal.sandbox_path) {
      throw new Error(`File rehearsal ${rehearsal.id} is missing target or sandbox path`);
    }
    const targetPath = resolve(workspaceRoot, rehearsal.target_path);
    const proposedContents = readFileSync(resolve(workspaceRoot, rehearsal.sandbox_path), "utf8");
    const consent = createWriteConsentRecord({
      runId: promotionRunId,
      workspaceId: workspace.id,
      toolRequestId: `toolreq_${promotionRunId}_write`,
      path: rehearsal.target_path
    });
    const consentValidation = await validateAgainstSchema(repoRoot, "consent-record.schema.json", consent);
    if (!consentValidation.valid) {
      throw new Error(`consent-record.schema.json validation failed: ${consentValidation.errors.join("; ")}`);
    }
    const prepareResult = rpcResult(await callSupervisorRpc(repoRoot, {
      id: `rpc_${rehearsal.id}_write_prepare`,
      method: "file.write.prepare",
      workspace_root: workspaceRoot,
      workspace_id: workspace.id,
      run_id: promotionRunId,
      path: targetPath
    }));
    if (prepareResult.decision !== "ask" || typeof prepareResult.policy_event_id !== "string") {
      throw new Error(`Rust supervisor did not return write-prepare evidence for ${rehearsal.id}`);
    }
    await recordSupervisorEventIds(workspace, manifest, prepareResult, [
      "request_event_id",
      "risk_event_id",
      "policy_event_id"
    ]);
    const writeResult = rpcResult(await callSupervisorRpc(repoRoot, {
      id: `rpc_${rehearsal.id}_live_write`,
      method: "file.write.commit",
      workspace_root: workspaceRoot,
      workspace_id: workspace.id,
      run_id: promotionRunId,
      path: targetPath,
      approved: true,
      consent_record_json: `${JSON.stringify(consent, null, 2)}\n`,
      consent_payload_ref: consentRecordArtifactRef(promotionRunId),
      contents: proposedContents
    }));
    if (
      writeResult.written !== true
      || writeResult.decision !== "allow"
      || typeof writeResult.lease_id !== "string"
      || !writeResult.lease_id
      || typeof writeResult.policy_event_id !== "string"
      || typeof writeResult.action_event_id !== "string"
    ) {
      throw new Error(`Rust supervisor did not return a full lease-backed write lifecycle for ${rehearsal.id}`);
    }
    await recordSupervisorEventIds(workspace, manifest, writeResult, [
      "consent_event_id",
      "policy_event_id",
      "lease_event_id",
      "action_event_id",
      "observation_event_id",
      "verification_event_id"
    ]);
    policyEventId = writeResult.policy_event_id;
    liveActionEventId = writeResult.action_event_id;
    newLeaseId = writeResult.lease_id;
    realSideEffectExecuted = writeResult.written === true;
    verificationStatus = writeResult.verification_status === "passed" && readFileSync(targetPath, "utf8") === proposedContents ? "passed" : "failed";
    if (!realSideEffectExecuted || verificationStatus !== "passed") {
      throw new Error(`Approved rehearsal ${rehearsal.id} failed file verification`);
    }
  } else {
    policyEventId = await appendManagedRunEvent(
      workspaceRoot,
      workspace,
      manifest,
      "policy.decided",
      `Fresh policy evaluation approved rehearsal ${rehearsal.id}; no prior lease or authority was reused.`
    );
  }
  if (!liveActionEventId) {
    liveActionEventId = await appendManagedRunEvent(
      workspaceRoot,
      workspace,
      manifest,
      "action.recorded",
      `Approved rehearsal ${rehearsal.id} promoted to a new live action record after fresh policy evaluation.`
    );
  }
  await appendManagedRunEvent(
    workspaceRoot,
    workspace,
    manifest,
    "run.completed",
    `Completed independent sandbox promotion run for rehearsal ${rehearsal.id}.`
  );
  await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "completed", approvedWritePromotionEventSequence(promotionRunId));

  const approved = approveRehearsal(rehearsal, branch, policyEventId, liveActionEventId);
  if (rehearsal.operation === "file.write") {
    approved.approval.target_path = rehearsal.target_path;
    approved.approval.promotion_run_id = promotionRunId;
    approved.approval.new_lease_id = newLeaseId;
    approved.approval.real_side_effect_executed = realSideEffectExecuted;
    approved.approval.verification_status = verificationStatus;
  }
  await requireValidContract("sandbox-approval.schema.json", approved.approval);
  upsertRegistryItem(workspaceRoot, "branches", approved.branch);
  printJson(approved.approval);
}

async function assertSandboxPromotionEvidence(
  workspaceRoot: string,
  workspace: Awaited<ReturnType<typeof openWorkspace>>,
  checkpoint: EventCheckpoint,
  branch: LedgerBranch,
  rehearsal: SandboxRehearsal
): Promise<void> {
  if (branch.status !== "sandbox") {
    throw new Error(`Branch ${branch.id} must be sandbox before rehearsal approval`);
  }
  if (branch.id !== rehearsal.branch_id) {
    throw new Error(`Rehearsal ${rehearsal.id} does not belong to branch ${branch.id}`);
  }
  if (branch.checkpoint_id !== checkpoint.id) {
    throw new Error(`Branch ${branch.id} checkpoint ${branch.checkpoint_id} does not match checkpoint ${checkpoint.id}`);
  }
  if (!checkpoint.event_hash) {
    throw new Error(`Checkpoint ${checkpoint.id} has no Ledger event hash evidence`);
  }
  const checkpointEvent = (await readEvents(workspace)).find((event) => event.id === checkpoint.event_id);
  if (!checkpointEvent) {
    throw new Error(`Checkpoint event ${checkpoint.event_id} not found in Ledger`);
  }
  if (checkpointEvent.run_id !== checkpoint.run_id) {
    throw new Error(`Checkpoint ${checkpoint.id} run ${checkpoint.run_id} does not match Ledger event run ${checkpointEvent.run_id}`);
  }
  if (checkpointEvent.event_hash !== checkpoint.event_hash) {
    throw new Error(`Checkpoint ${checkpoint.id} event hash does not match Ledger event ${checkpoint.event_id}`);
  }
  if (branch.source_event_id !== checkpoint.event_id || branch.head_event_id !== checkpoint.event_id) {
    throw new Error(`Branch ${branch.id} event pointers do not match checkpoint event ${checkpoint.event_id}`);
  }
  if (branch.source_event_hash !== checkpoint.event_hash || branch.head_event_hash !== checkpoint.event_hash) {
    throw new Error(`Branch ${branch.id} event hashes do not match checkpoint event hash`);
  }
  if (!rehearsal.target_path || !rehearsal.sandbox_path || !rehearsal.original_sha256 || !rehearsal.proposed_sha256) {
    throw new Error(`File rehearsal ${rehearsal.id} is missing target, sandbox, or content hash evidence`);
  }
  const relativeTarget = assertWorkspaceRelativePath(workspaceRoot, rehearsal.target_path);
  const expectedSandboxPath = resolve(workspaceRoot, sandboxWorkspacePath(branch.id, relativeTarget));
  const sandboxPath = resolve(workspaceRoot, rehearsal.sandbox_path);
  if (sandboxPath !== expectedSandboxPath) {
    throw new Error(`Rehearsal ${rehearsal.id} sandbox path is not bound to target ${relativeTarget}`);
  }
  const targetPath = resolve(workspaceRoot, relativeTarget);
  const currentOriginalHash = contentSha256(readUtf8OrEmpty(targetPath));
  if (currentOriginalHash !== rehearsal.original_sha256) {
    throw new Error(`Rehearsal ${rehearsal.id} target content changed since rehearsal`);
  }
  const proposedHash = contentSha256(readFileSync(sandboxPath, "utf8"));
  if (proposedHash !== rehearsal.proposed_sha256) {
    throw new Error(`Rehearsal ${rehearsal.id} sandbox content hash changed`);
  }
}

function readUtf8OrEmpty(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return "";
    }
    throw error;
  }
}

function contentSha256(contents: string): string {
  return `sha256:${createHash("sha256").update(contents).digest("hex")}`;
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
  if (options.topic === "propose") {
    const capsuleId = requirePositional(options.target ?? options.capsule, "capsule propose requires a capsule id");
    if (!options.version) {
      throw new Error("capsule propose requires --version <semver>");
    }
    if (!options.content) {
      throw new Error("capsule propose requires --content <description>");
    }
    if (!options.path) {
      throw new Error("capsule propose requires --path <manifest-output.json>");
    }
    if (!options.inputProvided) {
      throw new Error("capsule propose requires --input <playbook.md>");
    }
    if (options.replayRuns.length < 2) {
      throw new Error("capsule propose requires at least two --replay-run <run_id> values");
    }
    const workspace = await openWorkspace(workspaceRoot);
    const replayRecords = await Promise.all(options.replayRuns.map((runId) => createTraceReplayRecord(workspace, runId)));
    const proposal = proposeDocumentCapsuleDraft({
      id: capsuleId,
      version: options.version,
      description: options.content,
      playbook: options.input,
      replayRecords
    });
    const manifestPath = writeCapsuleProposalManifest(workspaceRoot, options.path, proposal);
    printJson({
      id: `capsule_proposal_${sanitizePathSegment(proposal.id)}_${sanitizePathSegment(proposal.version)}`,
      status: "proposed",
      manifest_path: manifestPath,
      mutates_ledger: false,
      mutates_registries: false,
      executes_playbook: false,
      proposal
    });
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
    await recordCapsuleLifecycleEvent(workspaceRoot, "draft", draft, `Recorded Capsule draft ${draft.id}@${draft.version}; lifecycle state remains non-executable and registry-backed.`);
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
    await recordCapsuleLifecycleEvent(workspaceRoot, "test", tested, `Recorded Capsule test evidence for ${tested.id}@${tested.version}; replay and sandbox evidence were captured without live side effects.`);
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
    await recordCapsuleLifecycleEvent(workspaceRoot, "publish", published, `Recorded local unsigned Capsule publication ${published.id}@${published.version}; Capsule still owns no runtime permissions.`);
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
    await recordCapsuleLifecycleEvent(
      workspaceRoot,
      "rollback",
      result.active,
      `Recorded Capsule rollback for ${result.active.id} from ${result.deprecated.version} to ${result.active.version}; no live tool authority was changed.`,
      result,
      `${result.active.id}_${result.deprecated.version}_to_${result.active.version}`
    );
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

function writeCapsuleProposalManifest(workspaceRoot: string, outputPath: string, proposal: CapsuleDraftInput): string {
  const root = resolve(workspaceRoot);
  const target = resolve(root, outputPath);
  const relativePath = relative(root, target);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Capsule proposal manifest path must stay inside the workspace");
  }
  if (relativePath === ".aetherion" || relativePath.startsWith(`.aetherion/`)) {
    throw new Error("Capsule proposal manifest cannot be written into Aetherion runtime state");
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(proposal, null, 2)}\n`);
  return relativePath;
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

async function recordCapsuleLifecycleEvent(
  workspaceRoot: string,
  lifecycle: "draft" | "test" | "publish" | "rollback",
  capsule: Capsule,
  summary: string,
  artifactValue: unknown = capsule,
  artifactId = `${capsule.id}_${capsule.version}`
): Promise<void> {
  const payloadRef = writeCapsuleLifecycleArtifact(workspaceRoot, lifecycle, artifactId, artifactValue);
  await recordGovernanceEvent(
    workspaceRoot,
    `capsule.${lifecycle}.recorded`,
    summary,
    payloadRef
  );
}

function writeCapsuleLifecycleArtifact(workspaceRoot: string, lifecycle: string, artifactId: string, value: unknown): string {
  const dir = join(workspaceRoot, ".aetherion", "artifacts", "capsule", sanitizePathSegment(lifecycle));
  const safeId = sanitizePathSegment(artifactId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${safeId}.json`), `${JSON.stringify(value, null, 2)}\n`);
  return artifactRef("capsule", lifecycle, safeId);
}

type MemoryLifecycleEventType =
  | "memory.candidate.created"
  | "memory.accepted"
  | "memory.rejected"
  | "memory.blocked"
  | "memory.deleted";

async function recordMemoryLifecycleEvent(
  workspaceRoot: string,
  eventType: MemoryLifecycleEventType,
  topic: string,
  artifactId: string,
  value: unknown,
  summary: string
): Promise<void> {
  const payloadRef = writeMemoryLifecycleArtifact(workspaceRoot, topic, artifactId, value);
  await recordGovernanceEvent(workspaceRoot, eventType, summary, payloadRef);
}

function writeMemoryLifecycleArtifact(workspaceRoot: string, topic: string, artifactId: string, value: unknown): string {
  const dir = join(workspaceRoot, ".aetherion", "artifacts", "memory", sanitizePathSegment(topic));
  const safeId = sanitizePathSegment(artifactId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${safeId}.json`), `${JSON.stringify(value, null, 2)}\n`);
  return artifactRef("memory", topic, safeId);
}

function registryItem<T extends Record<string, unknown> & { id: string }>(value: T): Record<string, unknown> & { id: string } {
  return value;
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

function circuitBreakerArtifactId(contractId: string, childRunId: string, trigger: CircuitBreaker["trigger"]): string {
  return sanitizePathSegment(`breaker_${contractId}_${childRunId}_${trigger}`);
}

function budgetAccountArtifactSnapshot(account: BudgetAccount, childRunId: string): BudgetAccount {
  return {
    ...account,
    id: sanitizePathSegment(`${account.id}_${childRunId}`)
  };
}

function writeAgentArtifact(workspaceRoot: string, topic: "contract" | "execute", value: { id: string }): string {
  const dir = join(workspaceRoot, ".aetherion", "artifacts", "agent", topic);
  const safeId = sanitizePathSegment(value.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${safeId}.json`), `${JSON.stringify(value, null, 2)}\n`);
  return artifactRef("agent", topic, safeId);
}

function writeAgentContractArtifact(workspaceRoot: string, value: { id: string }): string {
  return writeAgentArtifact(workspaceRoot, "contract", value);
}

function writeAgentExecuteArtifact(workspaceRoot: string, value: { id: string }): string {
  return writeAgentArtifact(workspaceRoot, "execute", value);
}

function writeHibernationArtifact(workspaceRoot: string, sourceRunId: string, value: { id: string }): string {
  const dir = join(workspaceRoot, ".aetherion", "artifacts", "sleep", sanitizePathSegment(sourceRunId));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sanitizePathSegment(value.id)}.json`), `${JSON.stringify(value, null, 2)}\n`);
  return artifactRef("sleep", sourceRunId, value.id);
}

function writeWakeArtifact(workspaceRoot: string, value: { id: string; hibernation_id: string }): string {
  const dir = join(workspaceRoot, ".aetherion", "artifacts", "wake", sanitizePathSegment(value.hibernation_id));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sanitizePathSegment(value.id)}.json`), `${JSON.stringify(value, null, 2)}\n`);
  return artifactRef("wake", value.hibernation_id, value.id);
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
  const ledgerEvents = await readEvents(workspace);
  const runEvents = ledgerEvents.filter((event) => event.run_id === runId);
  const head = runEvents.at(-1);
  if (!head?.event_hash) {
    throw new Error(`Cannot hibernate run ${runId} without a hash-bound Ledger cursor`);
  }
  await requireStrongRegistryProvenance(workspaceRoot, ledgerEvents, ["memory-cards", "memory-tombstones"]);
  const memories = readRegistry(workspaceRoot, "memory-cards").filter(isMemoryCard);
  const tombstones = readRegistry(workspaceRoot, "memory-tombstones").filter(isMemoryTombstone);
  const contextPack = assembleContextPack(runId, memories, "resume", tombstones);
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
    writeWakeArtifact(workspaceRoot, trigger);
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
  writeHibernationArtifact(workspaceRoot, runId, record);
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
  await completeRunManifestWithEventSequence(repoRoot, workspace, resumeManifest, "blocked", wakeupQueueRunEventSequence());
  writeHibernationArtifact(workspaceRoot, hibernation.run_id, queued.hibernation);
  writeWakeArtifact(workspaceRoot, queued.trigger);
  upsertRegistryItem(workspaceRoot, "hibernations", queued.hibernation);
  upsertRegistryItem(workspaceRoot, "wakeups", queued.trigger);
  printJson(queued.trigger);
}

function runSleepers(options: CliOptions): void {
  const workspaceRoot = resolve(options.workspace);
  const hibernations = readRegistry(workspaceRoot, "hibernations").filter(isHibernationRecord);
  if (!options.checkWakeups) {
    printJson(hibernations);
    return;
  }
  const wakeups = readRegistry(workspaceRoot, "wakeups").filter(isWakeupTrigger);
  printRawJson(buildWakeupEligibilityPreview(workspaceRoot, hibernations, wakeups));
}

function buildWakeupEligibilityPreview(
  workspaceRoot: string,
  hibernations: HibernationRecord[],
  wakeups: WakeupTrigger[]
): Record<string, unknown> {
  const hibernationById = new Map(hibernations.filter(isHibernationRecord).map((record) => [record.id, record]));
  const previews = wakeups.filter(isWakeupTrigger).map((trigger) => {
    const hibernation = hibernationById.get(trigger.hibernation_id);
    if (!hibernation) {
      return {
        trigger_id: trigger.id,
        hibernation_id: trigger.hibernation_id,
        source: trigger.source,
        current_status: trigger.status,
        evaluated_status: "orphaned",
        eligible_for_queue: false,
        reason: "Wakeup trigger references a missing hibernation record."
      };
    }
    try {
      const evaluated = evaluateWakeup(workspaceRoot, hibernation, trigger);
      return {
        trigger_id: trigger.id,
        hibernation_id: trigger.hibernation_id,
        source: trigger.source,
        current_status: trigger.status,
        evaluated_status: evaluated.status,
        eligible_for_queue: evaluated.status === "eligible",
        reason: evaluated.reason
      };
    } catch (error) {
      return {
        trigger_id: trigger.id,
        hibernation_id: trigger.hibernation_id,
        source: trigger.source,
        current_status: trigger.status,
        evaluated_status: "invalid",
        eligible_for_queue: false,
        reason: error instanceof Error ? error.message : String(error)
      };
    }
  });
  const eligibleTriggerIds = previews
    .filter((preview) => preview.eligible_for_queue === true)
    .map((preview) => preview.trigger_id);
  return {
    id: "wakeup_eligibility_preview",
    mode: "read_only",
    hibernation_count: hibernations.length,
    trigger_count: wakeups.length,
    eligible_trigger_ids: eligibleTriggerIds,
    scope: {
      mutates_registries: false,
      appends_ledger_events: false,
      calls_supervisor_policy: false,
      queues_wakeups: false,
      issues_lease: false,
      resumes_actions: false
    },
    wakeups: previews
  };
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
  const replayRecordId = `replay_${sanitizePathSegment(checkpoint.run_id)}_${sanitizePathSegment(checkpoint.id)}_trace`;
  const replayRecord = {
    id: replayRecordId,
    run_id: checkpoint.run_id,
    mode: "trace" as const,
    source_events: sourceEvents.map((event) => event.id),
    artifact_ref: artifactRef("replay", checkpoint.run_id, replayRecordId),
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
    const contractRef = writeAgentContractArtifact(workspaceRoot, contract);
    upsertRegistryItem(workspaceRoot, "agent-contracts", registryItem(contract));
    await recordGovernanceEvent(workspaceRoot, "agent.contract.created", `Created ${contract.id} as a reviewable child work order; no child execution occurred.`, contractRef);
    printRawJson(contract);
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
  const contractPayloadRef = artifactRef("agent", "contract", contract.id);
  const startedEventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "agent.child.started", `Child run started under ${contract.id}.`, contractPayloadRef);
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
    const breakerId = circuitBreakerArtifactId(contract.id, childRunId, "permission_violation");
    const breakerPayloadRef = artifactRef("agent", "execute", breakerId);
    const eventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "circuit.opened", String(error), breakerPayloadRef);
    const breaker = openCircuitBreaker({ id: breakerId, contractId: contract.id, childRunId, trigger: "permission_violation", eventId, reason: String(error) });
    await validateAndUpsertAgentRecord(workspaceRoot, "circuit-breaker.schema.json", "circuit-breakers", breaker);
    writeAgentExecuteArtifact(workspaceRoot, breaker);
    await validateAndUpsertAgentRecord(workspaceRoot, "agent-score.schema.json", "agent-scores", updateAgentScore(score, contract.child_agent_id, "permission_violation"));
    await validateAndUpsertAgentRecord(workspaceRoot, "agent-contract.schema.json", "agent-contracts", { ...contract, status: "stopped" });
    await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "blocked", childReadPreExecutionBreakerEventSequence(contractPayloadRef, breakerPayloadRef));
    printRawJson(breaker);
    return;
  }
  const reserved = reserveRead(account);
  if (reserved === "exhausted") {
    const breakerId = circuitBreakerArtifactId(contract.id, childRunId, "budget_exhausted");
    const breakerPayloadRef = artifactRef("agent", "execute", breakerId);
    const eventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "circuit.opened", `Budget exhausted for ${contract.id}.`, breakerPayloadRef);
    const breaker = openCircuitBreaker({ id: breakerId, contractId: contract.id, childRunId, trigger: "budget_exhausted", eventId, reason: "Tool-call or lease budget exhausted" });
    await validateAndUpsertAgentRecord(workspaceRoot, "circuit-breaker.schema.json", "circuit-breakers", breaker);
    writeAgentExecuteArtifact(workspaceRoot, breaker);
    await validateAndUpsertAgentRecord(workspaceRoot, "budget-account.schema.json", "budget-accounts", { ...account, status: "exhausted" });
    await validateAndUpsertAgentRecord(workspaceRoot, "agent-contract.schema.json", "agent-contracts", { ...contract, status: "stopped" });
    await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "blocked", childReadPreExecutionBreakerEventSequence(contractPayloadRef, breakerPayloadRef));
    printRawJson(breaker);
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
    const trigger = timedOut ? "budget_exhausted" : "execution_failure";
    const breakerId = circuitBreakerArtifactId(contract.id, childRunId, trigger);
    const breakerPayloadRef = artifactRef("agent", "execute", breakerId);
    const observedSupervisorEvents = await recordUnprojectedRunEvents(repoRoot, workspace, manifest);
    const expectedSequence = childReadPostSupervisorBreakerEventSequence(
      contractPayloadRef,
      breakerPayloadRef,
      observedSupervisorEvents.map((event) => event.event_type)
    );
    const eventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "circuit.opened", reason, breakerPayloadRef);
    const breaker = openCircuitBreaker({
      id: breakerId,
      contractId: contract.id,
      childRunId,
      trigger,
      eventId,
      reason
    });
    await validateAndUpsertAgentRecord(workspaceRoot, "circuit-breaker.schema.json", "circuit-breakers", breaker);
    writeAgentExecuteArtifact(workspaceRoot, breaker);
    await validateAndUpsertAgentRecord(workspaceRoot, "budget-account.schema.json", "budget-accounts", account);
    await validateAndUpsertAgentRecord(workspaceRoot, "agent-contract.schema.json", "agent-contracts", { ...contract, status: "stopped" });
    await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "blocked", expectedSequence);
    printRawJson(breaker);
    return;
  }
  const cpuUsed = process.cpuUsage(cpuStarted);
  account = recordRuntimeUsage(account, (cpuUsed.user + cpuUsed.system) / 1000, performance.now() - wallStarted);
  const supervisorEvidence = childReadSupervisorEvidence(readResult, childRunId);
  for (const eventId of supervisorEvidence.eventIds) {
    await recordRunEvent(repoRoot, workspace, manifest, eventId);
  }
  if (account.status === "exhausted") {
    const breakerId = circuitBreakerArtifactId(contract.id, childRunId, "budget_exhausted");
    const breakerPayloadRef = artifactRef("agent", "execute", breakerId);
    const expectedSequence = childReadPostSupervisorBreakerEventSequence(contractPayloadRef, breakerPayloadRef, supervisorEvidence.eventTypes);
    const eventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "circuit.opened", `Child execution exceeded CPU or wall-time accounting for ${contract.id}.`, breakerPayloadRef);
    const breaker = openCircuitBreaker({ id: breakerId, contractId: contract.id, childRunId, trigger: "budget_exhausted", eventId, reason: "CPU or wall-time budget exhausted" });
    await validateAndUpsertAgentRecord(workspaceRoot, "circuit-breaker.schema.json", "circuit-breakers", breaker);
    writeAgentExecuteArtifact(workspaceRoot, breaker);
    await validateAndUpsertAgentRecord(workspaceRoot, "budget-account.schema.json", "budget-accounts", account);
    await validateAndUpsertAgentRecord(workspaceRoot, "agent-contract.schema.json", "agent-contracts", { ...contract, status: "stopped" });
    await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "blocked", expectedSequence);
    printRawJson(breaker);
    return;
  }
  const recordedSupervisorEventIds = supervisorEvidence.eventIds;
  if (readResult.decision !== "allow") {
    account = recordPolicyDenial(account);
    const denialPayload = budgetAccountArtifactSnapshot(account, childRunId);
    const denialPayloadRef = writeAgentExecuteArtifact(workspaceRoot, denialPayload);
    await appendManagedRunEvent(workspaceRoot, workspace, manifest, "agent.child.policy_denied", `Supervisor denied ${path} for ${contract.id}.`, denialPayloadRef);
    await validateAndUpsertAgentRecord(workspaceRoot, "budget-account.schema.json", "budget-accounts", account);
    await validateAndUpsertAgentRecord(workspaceRoot, "agent-score.schema.json", "agent-scores", updateAgentScore(score, contract.child_agent_id, "policy_denial"));
    if (account.policy_denials >= 3) {
      const breakerId = circuitBreakerArtifactId(contract.id, childRunId, "repeated_policy_denial");
      const breakerPayloadRef = artifactRef("agent", "execute", breakerId);
      const circuitEventId = await appendManagedRunEvent(workspaceRoot, workspace, manifest, "circuit.opened", `Repeated policy denials stopped ${contract.id}.`, breakerPayloadRef);
      const breaker = openCircuitBreaker({ id: breakerId, contractId: contract.id, childRunId, trigger: "repeated_policy_denial", eventId: circuitEventId, reason: "Three supervisor policy denials", action: "stop" });
      await validateAndUpsertAgentRecord(workspaceRoot, "circuit-breaker.schema.json", "circuit-breakers", breaker);
      writeAgentExecuteArtifact(workspaceRoot, breaker);
      await validateAndUpsertAgentRecord(workspaceRoot, "agent-contract.schema.json", "agent-contracts", { ...contract, status: "stopped" });
      await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "blocked", childReadRepeatedDenialEventSequence(contractPayloadRef, denialPayloadRef, breakerPayloadRef));
      printRawJson(breaker);
      return;
    }
    await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "blocked", childReadPolicyDeniedEventSequence(contractPayloadRef, denialPayloadRef));
    printRawJson(account);
    return;
  }
  if (typeof readResult.contents !== "string" || typeof readResult.request_id !== "string" || typeof readResult.policy_decision_id !== "string" || typeof readResult.lease_id !== "string" || !readResult.lease_id) {
    throw new Error(`Supervisor child read did not return completion evidence for ${childRunId}`);
  }
  if (typeof readResult.lease_event_id !== "string" || !readResult.lease_event_id) {
    throw new Error(`Supervisor child read did not return lease event evidence for ${childRunId}`);
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
      source_event_ids: [startedEventId, ...recordedSupervisorEventIds, completedEventId],
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
  writeAgentExecuteArtifact(workspaceRoot, result);
  upsertRegistryItem(workspaceRoot, "child-results", registryItem(result));
  await validateAndUpsertAgentRecord(workspaceRoot, "budget-account.schema.json", "budget-accounts", account);
  await validateAndUpsertAgentRecord(workspaceRoot, "agent-score.schema.json", "agent-scores", updateAgentScore(score, contract.child_agent_id, "success"));
  await validateAndUpsertAgentRecord(workspaceRoot, "agent-contract.schema.json", "agent-contracts", { ...contract, status: "completed" });
  await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "completed", childReadCompletedEventSequence(contractPayloadRef, resultRef));
  printRawJson(result);
}

async function runSecurity(options: CliOptions): Promise<void> {
  const workspaceRoot = resolve(options.workspace);
  if (options.topic === "audit") {
    const report = await buildSecurityAuditReport(workspaceRoot);
    if (report.summary.critical > 0 || report.summary.high > 0) {
      process.exitCode = 1;
    }
    printRawJson(report);
    return;
  }
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
    const assessmentPayloadRef = artifactRef("security", "scan", assessment.id);
    await appendManagedRunEvent(
      workspaceRoot,
      workspace,
      manifest,
      "security.content.assessed",
      `Assessed tainted ${assessment.source_kind} content from ${assessment.source_event_id}; raw content was not persisted and cannot authorize actions.`,
      assessmentPayloadRef
    );
    const signal = signalFromAssessment(assessment);
    if (!signal) {
      await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "completed", securityScanCleanEventSequence(assessmentPayloadRef));
      console.log(JSON.stringify(assessment, null, 2));
      return;
    }
    await requireValidContract("poisoning-signal.schema.json", signal);
    persistSecurityRecord(workspaceRoot, "scan", "poisoning-signals", signal);
    const signalPayloadRef = artifactRef("security", "scan", signal.id);
    await appendManagedRunEvent(
      workspaceRoot,
      workspace,
      manifest,
      "poisoning.detected",
      `Quarantined ${signal.signal_type} signal ${signal.id}; no authorization or external action was issued.`,
      signalPayloadRef
    );
    await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "blocked", securityScanBlockedEventSequence(assessmentPayloadRef, signalPayloadRef));
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
  throw new Error("security supports audit, scan, ack <signal_id>, trial <signal_id>, and fixture <signal_id>");
}

type IngressAuditReport = {
  id: "aetherion_ingress_audit_report";
  generated_at: string;
  repo_root: string;
  workspace_root: string;
  status: "draft" | "blocked";
  scope: ReadOnlyCommandScope & {
    starts_listener: false;
    accepts_remote_connections: false;
    mutates_workspace: false;
    detects_live_duplicates: false;
    enforces_rate_limits: false;
    issues_session: false;
  };
  summary: {
    pass: number;
    warn: number;
    fail: number;
    not_applicable: number;
  };
  checks: DoctorCheck[];
  ingress_profile: {
    runnable_surface: "tui";
    contract_surface: "local_api_like_envelope";
    envelope_fields: string[];
    current_rate_limit_enforcement: "tui_run_local_atomic_window_before_supervisor_handoff";
    rate_limit_reservation_schema: "local-ingress-rate-limit-reservation.schema.json";
    current_duplicate_detection: "tui_run_local_atomic_reservation_before_supervisor_handoff";
    idempotency_reservation_schema: "local-ingress-idempotency-reservation.schema.json";
    current_idempotency_replay: "tui_same_key_same_normalized_intent_completed_manifest_only";
    idempotency_completion_schema: "local-ingress-idempotency-completion.schema.json";
    unknown_or_unauthenticated_disposition: "observation_or_queued_intent_only";
    policy_handoff: "fresh_policy_and_scoped_lease_required_before_actions";
  };
  deferred_surfaces: string[];
  remaining_gaps: string[];
  source_documents: Array<{ path: string; role: string }>;
};

type LocalIngressRateLimitReservation = {
  id: string;
  schema_version: "aetherion-local-ingress-rate-limit-reservation-v1";
  workspace_id: string;
  run_id: string;
  reserved_at: string;
  surface_id: "tui";
  command: "run";
  rate_limit_key_hash: string;
  normalized_intent_hash: string;
  window_started_at: string;
  window_ends_at: string;
  window_size_ms: number;
  max_requests: number;
  slot_index: number;
  remaining_after: number;
  rate_limit_state: "enforced_allow";
  enforcement_stage: "before_supervisor_handoff";
  enforcer: "local_atomic_window_slot";
  auth_state: "local_operator";
  policy_handoff: "pending_fresh_policy_and_scoped_lease";
  raw_key_persisted: false;
  raw_intent_persisted: false;
  can_authorize_actions: false;
  issues_session: false;
  background_queue_implemented: false;
};

type LocalIngressIdempotencyReservation = {
  id: string;
  schema_version: "aetherion-local-ingress-idempotency-reservation-v1";
  workspace_id: string;
  run_id: string;
  reserved_at: string;
  surface_id: "tui";
  command: "run";
  key_source: "operator_supplied" | "generated";
  idempotency_key_hash: string;
  normalized_intent_hash: string;
  duplicate_detection_stage: "before_supervisor_handoff";
  duplicate_detector: "local_atomic_reservation_file";
  auth_state: "local_operator";
  rate_limit_state: "enforced_allow";
  policy_handoff: "pending_fresh_policy_and_scoped_lease";
  raw_key_persisted: false;
  raw_intent_persisted: false;
  can_authorize_actions: false;
};

type LocalIngressIdempotencyCompletion = {
  id: string;
  schema_version: "aetherion-local-ingress-idempotency-completion-v1";
  workspace_id: string;
  reservation_id: string;
  idempotency_key_hash: string;
  normalized_intent_hash: string;
  source_run_id: string;
  cached_at: string;
  surface_id: "tui";
  command: "run";
  completion_stage: "after_run_manifest_completed";
  cache_state: "replay_available";
  replay_scope: "same_key_same_normalized_intent_completed_tui_run";
  source_manifest_status: "completed";
  source_manifest_event_ids: string[];
  source_artifact_refs: string[];
  source_artifact_ref_count: number;
  source_head_event_id: string;
  source_head_event_hash: string;
  source_chain_valid: true;
  live_side_effects_replayed: false;
  replay_performs_live_side_effects: false;
  replay_requires_new_policy: false;
  replay_requires_new_lease: false;
  replay_authorizes_actions: false;
  policy_handoff: "not_reused_replay_only";
  raw_key_persisted: false;
  raw_intent_persisted: false;
  can_authorize_actions: false;
};

type LocalIngressIdempotencyResult =
  | { kind: "reserved"; reservation: LocalIngressIdempotencyReservation }
  | { kind: "cached_replay"; reservation: LocalIngressIdempotencyReservation; completion: LocalIngressIdempotencyCompletion };

async function preflightSocketSupervisorBinding(options: CliOptions, runId: string): Promise<void> {
  if (options.supervisor !== "socket") {
    return;
  }
  const workspaceRoot = resolve(options.workspace);
  await supervisorStatusPreflight(workspaceRoot, runId, options.socketPath, options.socketAuthToken);
}

async function supervisorStatusPreflight(workspaceRoot: string, runId: string, socketPath: string | undefined, socketAuthToken: string | undefined): Promise<void> {
  if (!socketPath) {
    throw new Error("--supervisor socket requires --socket-path <socket>");
  }
  rpcResult(await callSupervisorRpc(repoRoot, {
    id: `rpc_${runId}_ingress_preflight`,
    method: "supervisor.status",
    workspace_root: workspaceRoot,
    workspace_id: workspaceIdForRoot(workspaceRoot),
    run_id: runId
  }, {
    socketPath,
    authToken: socketAuthToken
  }));
}

function validatedRunIdempotencyKey(options: CliOptions, runId: string): string {
  const rawKey = options.idempotencyKey ?? `aetherion:tui:run:${runId}`;
  if (rawKey.trim().length === 0) {
    throw new Error("--idempotency-key must not be empty");
  }
  if (rawKey.length > 512) {
    throw new Error("--idempotency-key must be 512 characters or fewer");
  }
  return rawKey;
}

function normalizedIntentHashForRun(options: CliOptions, workspaceId: string): string {
  return sha256Hex(stableCanonicalJson({
    command: "run",
    surface_id: "tui",
    workspace_id: workspaceId,
    input_path: options.input,
    output_path: options.output,
    approve_write: options.approveWrite,
    supervisor: options.supervisor ?? "stdio",
    summary_sha256: options.summary ? sha256Hex(options.summary) : null
  }));
}

function rateLimitKeyHashForRun(workspaceId: string): string {
  return sha256Hex(stableCanonicalJson({
    auth_state: "local_operator",
    command: "run",
    surface_id: "tui",
    workspace_id: workspaceId
  }));
}

type LocalIngressRateLimitConfig = {
  maxRequests: number;
  windowSizeMs: number;
};

function localIngressRateLimitConfig(env: NodeJS.ProcessEnv = process.env): LocalIngressRateLimitConfig {
  return {
    maxRequests: boundedPositiveIntegerEnv(env.AETHERION_TUI_RUN_RATE_LIMIT_MAX, 120, 1, 10000, "AETHERION_TUI_RUN_RATE_LIMIT_MAX"),
    windowSizeMs: boundedPositiveIntegerEnv(env.AETHERION_TUI_RUN_RATE_LIMIT_WINDOW_MS, 60000, 1000, 86400000, "AETHERION_TUI_RUN_RATE_LIMIT_WINDOW_MS")
  };
}

function boundedPositiveIntegerEnv(value: string | undefined, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined || value.length === 0) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

async function reserveLocalIngressRateLimit(options: CliOptions, runId: string): Promise<LocalIngressRateLimitReservation> {
  const workspaceRoot = resolve(options.workspace);
  const workspaceId = workspaceIdForRoot(workspaceRoot);
  const config = localIngressRateLimitConfig();
  const now = Date.now();
  const windowStartMs = Math.floor(now / config.windowSizeMs) * config.windowSizeMs;
  const windowEndMs = windowStartMs + config.windowSizeMs;
  const rateLimitKeyHash = rateLimitKeyHashForRun(workspaceId);
  const normalizedIntentHash = normalizedIntentHashForRun(options, workspaceId);
  const reservationDir = localIngressRateLimitReservationDir(workspaceRoot, rateLimitKeyHash, windowStartMs);
  mkdirSync(reservationDir, { recursive: true });
  for (let slotIndex = 0; slotIndex < config.maxRequests; slotIndex += 1) {
    const reservation: LocalIngressRateLimitReservation = {
      id: `local_ingress_rate_limit_${hashDigest(rateLimitKeyHash).slice(0, 16)}_${slotIndex}`,
      schema_version: "aetherion-local-ingress-rate-limit-reservation-v1",
      workspace_id: workspaceId,
      run_id: runId,
      reserved_at: new Date(now).toISOString(),
      surface_id: "tui",
      command: "run",
      rate_limit_key_hash: rateLimitKeyHash,
      normalized_intent_hash: normalizedIntentHash,
      window_started_at: new Date(windowStartMs).toISOString(),
      window_ends_at: new Date(windowEndMs).toISOString(),
      window_size_ms: config.windowSizeMs,
      max_requests: config.maxRequests,
      slot_index: slotIndex,
      remaining_after: config.maxRequests - slotIndex - 1,
      rate_limit_state: "enforced_allow",
      enforcement_stage: "before_supervisor_handoff",
      enforcer: "local_atomic_window_slot",
      auth_state: "local_operator",
      policy_handoff: "pending_fresh_policy_and_scoped_lease",
      raw_key_persisted: false,
      raw_intent_persisted: false,
      can_authorize_actions: false,
      issues_session: false,
      background_queue_implemented: false
    };
    const validation = await validateAgainstSchema(repoRoot, "local-ingress-rate-limit-reservation.schema.json", reservation);
    if (!validation.valid) {
      throw new Error(`local-ingress-rate-limit-reservation.schema.json validation failed: ${validation.errors.join("; ")}`);
    }
    try {
      writeFileSync(localIngressRateLimitReservationPath(reservationDir, slotIndex), `${JSON.stringify(reservation, null, 2)}\n`, { flag: "wx" });
      return reservation;
    } catch (error) {
      if (!isFileExistsError(error)) {
        throw error;
      }
    }
  }
  throw new Error(`TUI run ingress rate limit exceeded before action run: key_hash=${rateLimitKeyHash} window_started_at=${new Date(windowStartMs).toISOString()} max_requests=${config.maxRequests} enforcement_stage=before_supervisor_handoff`);
}

function localIngressRateLimitReservationDir(workspaceRoot: string, rateLimitKeyHash: string, windowStartMs: number): string {
  return join(resolve(workspaceRoot), ".aetherion", "ingress", "rate-limit", hashDigest(rateLimitKeyHash), String(windowStartMs));
}

function localIngressRateLimitReservationPath(reservationDir: string, slotIndex: number): string {
  return join(reservationDir, `slot_${slotIndex}.json`);
}

async function reserveLocalIngressIdempotency(options: CliOptions, runId: string, rawKey: string, rateLimitReservation: LocalIngressRateLimitReservation): Promise<LocalIngressIdempotencyResult> {
  const workspaceRoot = resolve(options.workspace);
  const workspaceId = workspaceIdForRoot(workspaceRoot);
  const keySource: LocalIngressIdempotencyReservation["key_source"] = options.idempotencyKey ? "operator_supplied" : "generated";
  const idempotencyKeyHash = sha256Hex(rawKey);
  const normalizedIntentHash = normalizedIntentHashForRun(options, workspaceId);
  if (rateLimitReservation.normalized_intent_hash !== normalizedIntentHash) {
    throw new Error("Ingress rate-limit reservation normalized intent does not match idempotency reservation intent");
  }
  const reservation: LocalIngressIdempotencyReservation = {
    id: `local_ingress_idempotency_${hashDigest(idempotencyKeyHash).slice(0, 16)}`,
    schema_version: "aetherion-local-ingress-idempotency-reservation-v1",
    workspace_id: workspaceId,
    run_id: runId,
    reserved_at: new Date().toISOString(),
    surface_id: "tui",
    command: "run",
    key_source: keySource,
    idempotency_key_hash: idempotencyKeyHash,
    normalized_intent_hash: normalizedIntentHash,
    duplicate_detection_stage: "before_supervisor_handoff",
    duplicate_detector: "local_atomic_reservation_file",
    auth_state: "local_operator",
    rate_limit_state: "enforced_allow",
    policy_handoff: "pending_fresh_policy_and_scoped_lease",
    raw_key_persisted: false,
    raw_intent_persisted: false,
    can_authorize_actions: false
  };
  const validation = await validateAgainstSchema(repoRoot, "local-ingress-idempotency-reservation.schema.json", reservation);
  if (!validation.valid) {
    throw new Error(`local-ingress-idempotency-reservation.schema.json validation failed: ${validation.errors.join("; ")}`);
  }
  const reservationPath = localIngressIdempotencyReservationPath(workspaceRoot, idempotencyKeyHash);
  mkdirSync(dirname(reservationPath), { recursive: true });
  try {
    writeFileSync(reservationPath, `${JSON.stringify(reservation, null, 2)}\n`, { flag: "wx" });
  } catch (error) {
    if (!isFileExistsError(error)) {
      throw error;
    }
    const existing = readOptionalLocalIngressReservation(reservationPath);
    if (!existing) {
      throw new Error(`Duplicate ingress idempotency key detected before action run: key_hash=${idempotencyKeyHash} existing_run_id=unknown duplicate_stage=before_supervisor_handoff`);
    }
    const existingValidation = await validateAgainstSchema(repoRoot, "local-ingress-idempotency-reservation.schema.json", existing);
    if (!existingValidation.valid) {
      throw new Error(`Existing ingress idempotency reservation is invalid: ${existingValidation.errors.join("; ")}`);
    }
    if (existing.normalized_intent_hash !== normalizedIntentHash) {
      throw new Error(`Duplicate ingress idempotency key has different normalized intent before action run: key_hash=${idempotencyKeyHash} existing_run_id=${existing.run_id} duplicate_stage=before_supervisor_handoff`);
    }
    const completion = await readAndValidateCachedIdempotencyCompletion(workspaceRoot, existing);
    return { kind: "cached_replay", reservation: existing, completion };
  }
  return { kind: "reserved", reservation };
}

function localIngressIdempotencyReservationPath(workspaceRoot: string, idempotencyKeyHash: string): string {
  return join(resolve(workspaceRoot), ".aetherion", "ingress", "idempotency", `idem_${hashDigest(idempotencyKeyHash)}.json`);
}

function readOptionalLocalIngressReservation(path: string): LocalIngressIdempotencyReservation | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as LocalIngressIdempotencyReservation;
  } catch {
    return null;
  }
}

function localIngressIdempotencyCompletionPath(workspaceRoot: string, idempotencyKeyHash: string): string {
  return join(resolve(workspaceRoot), ".aetherion", "ingress", "idempotency-completion", `idem_${hashDigest(idempotencyKeyHash)}.json`);
}

async function writeLocalIngressIdempotencyCompletion(
  options: CliOptions,
  reservation: LocalIngressIdempotencyReservation,
  result: Awaited<ReturnType<typeof runLocalKernelLoop>> | Awaited<ReturnType<typeof runSupervisorKernelLoop>>
): Promise<LocalIngressIdempotencyCompletion | undefined> {
  if (result.runManifest.status !== "completed") {
    return undefined;
  }
  const sourceArtifactRefs = await artifactRefsForRunManifest(result.workspace, result.runManifest);
  const completion = localIngressCompletionFromRun(reservation, result.runManifest, result.trace, sourceArtifactRefs);
  const validation = await validateAgainstSchema(repoRoot, "local-ingress-idempotency-completion.schema.json", completion);
  if (!validation.valid) {
    throw new Error(`local-ingress-idempotency-completion.schema.json validation failed: ${validation.errors.join("; ")}`);
  }
  const completionPath = localIngressIdempotencyCompletionPath(options.workspace, reservation.idempotency_key_hash);
  mkdirSync(dirname(completionPath), { recursive: true });
  writeFileSync(completionPath, `${JSON.stringify(completion, null, 2)}\n`, { flag: "wx" });
  return completion;
}

function localIngressCompletionFromRun(
  reservation: LocalIngressIdempotencyReservation,
  manifest: RunManifest,
  trace: Awaited<ReturnType<typeof reconstructTrace>>,
  sourceArtifactRefs: string[]
): LocalIngressIdempotencyCompletion {
  if (manifest.status !== "completed") {
    throw new Error(`Cannot cache idempotent replay for non-completed run ${manifest.id}`);
  }
  if (!trace.chain_valid || !trace.head_event_id || !trace.head_event_hash) {
    throw new Error(`Cannot cache idempotent replay for ${manifest.id} without valid trace head evidence`);
  }
  return {
    id: `local_ingress_idempotency_completion_${hashDigest(reservation.idempotency_key_hash).slice(0, 16)}`,
    schema_version: "aetherion-local-ingress-idempotency-completion-v1",
    workspace_id: manifest.workspace_id,
    reservation_id: reservation.id,
    idempotency_key_hash: reservation.idempotency_key_hash,
    normalized_intent_hash: reservation.normalized_intent_hash,
    source_run_id: manifest.id,
    cached_at: new Date().toISOString(),
    surface_id: "tui",
    command: "run",
    completion_stage: "after_run_manifest_completed",
    cache_state: "replay_available",
    replay_scope: "same_key_same_normalized_intent_completed_tui_run",
    source_manifest_status: "completed",
    source_manifest_event_ids: [...manifest.event_ids],
    source_artifact_refs: sourceArtifactRefs,
    source_artifact_ref_count: sourceArtifactRefs.length,
    source_head_event_id: trace.head_event_id,
    source_head_event_hash: trace.head_event_hash,
    source_chain_valid: true,
    live_side_effects_replayed: false,
    replay_performs_live_side_effects: false,
    replay_requires_new_policy: false,
    replay_requires_new_lease: false,
    replay_authorizes_actions: false,
    policy_handoff: "not_reused_replay_only",
    raw_key_persisted: false,
    raw_intent_persisted: false,
    can_authorize_actions: false
  };
}

async function readAndValidateCachedIdempotencyCompletion(workspaceRoot: string, reservation: LocalIngressIdempotencyReservation): Promise<LocalIngressIdempotencyCompletion> {
  const completionPath = localIngressIdempotencyCompletionPath(workspaceRoot, reservation.idempotency_key_hash);
  let completion: LocalIngressIdempotencyCompletion;
  try {
    completion = JSON.parse(readFileSync(completionPath, "utf8")) as LocalIngressIdempotencyCompletion;
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(`Duplicate ingress idempotency key detected before action run, but no completed cached replay is available: key_hash=${reservation.idempotency_key_hash} existing_run_id=${reservation.run_id} duplicate_stage=before_supervisor_handoff`);
    }
    throw error;
  }
  const validation = await validateAgainstSchema(repoRoot, "local-ingress-idempotency-completion.schema.json", completion);
  if (!validation.valid) {
    throw new Error(`Cached ingress idempotency completion is invalid: ${validation.errors.join("; ")}`);
  }
  if (completion.reservation_id !== reservation.id
    || completion.idempotency_key_hash !== reservation.idempotency_key_hash
    || completion.normalized_intent_hash !== reservation.normalized_intent_hash
    || completion.source_run_id !== reservation.run_id) {
    throw new Error(`Cached ingress idempotency completion does not match reservation: key_hash=${reservation.idempotency_key_hash} existing_run_id=${reservation.run_id}`);
  }

  const workspace = await openWorkspace(workspaceRoot);
  const manifest = await loadRunManifest(workspace, completion.source_run_id);
  if (manifest.status !== "completed") {
    throw new Error(`Cached ingress idempotency replay source run is not completed: source_run_id=${completion.source_run_id} status=${manifest.status}`);
  }
  if (!stringArraysEqual(manifest.event_ids, completion.source_manifest_event_ids)) {
    throw new Error(`Cached ingress idempotency replay manifest event ids drifted: source_run_id=${completion.source_run_id}`);
  }
  const trace = await reconstructTrace(workspace, completion.source_run_id);
  if (!trace.chain_valid || trace.live_side_effects_replayed !== false) {
    throw new Error(`Cached ingress idempotency replay source trace is not replay-safe: source_run_id=${completion.source_run_id}`);
  }
  if (trace.head_event_id !== completion.source_head_event_id || trace.head_event_hash !== completion.source_head_event_hash) {
    throw new Error(`Cached ingress idempotency replay source trace head drifted: source_run_id=${completion.source_run_id}`);
  }
  const sourceArtifactRefs = await artifactRefsForRunManifest(workspace, manifest);
  if (!stringArraysEqual(sourceArtifactRefs, completion.source_artifact_refs) || completion.source_artifact_ref_count !== sourceArtifactRefs.length) {
    throw new Error(`Cached ingress idempotency replay artifact refs drifted: source_run_id=${completion.source_run_id}`);
  }
  return completion;
}

async function artifactRefsForRunManifest(workspace: Awaited<ReturnType<typeof openWorkspace>>, manifest: RunManifest): Promise<string[]> {
  const ledger = await readEvents(workspace);
  const manifestEventIds = new Set(manifest.event_ids);
  return uniqueStrings(ledger
    .filter((event) => event.run_id === manifest.id && manifestEventIds.has(event.id))
    .map((event) => event.payload_ref)
    .filter((value): value is string => typeof value === "string" && value.length > 0));
}

async function runIngress(options: CliOptions): Promise<void> {
  if (options.topic !== "audit") {
    throw new Error("ingress supports audit");
  }
  const report = buildIngressAuditReport(resolve(options.workspace));
  if (report.status === "blocked") {
    process.exitCode = 1;
  }
  printRawJson(report);
}

function buildIngressAuditReport(workspaceRoot: string): IngressAuditReport {
  const repoChecks = repoDoctorChecks();
  const repoCheckById = new Map(repoChecks.map((checkItem) => [checkItem.id, checkItem]));
  const checks = [
    checkWorkspaceTarget(workspaceRoot),
    repoCheckById.get("local_ingress_readiness_contract") ?? missingRepoCheck("local_ingress_readiness_contract")
  ];
  const summary = {
    pass: checks.filter((checkItem) => checkItem.status === "pass").length,
    warn: checks.filter((checkItem) => checkItem.status === "warn").length,
    fail: checks.filter((checkItem) => checkItem.status === "fail").length,
    not_applicable: checks.filter((checkItem) => checkItem.status === "not_applicable").length
  };
  const envelopeFields = [
    "caller_identity_placeholder",
    "surface_id",
    "workspace_id",
    "idempotency_key",
    "normalized_intent_hash",
    "auth_state",
    "rate_limit_state",
    "policy_handoff"
  ];
  return {
    id: "aetherion_ingress_audit_report",
    generated_at: new Date().toISOString(),
    repo_root: repoRoot,
    workspace_root: workspaceRoot,
    status: summary.fail > 0 ? "blocked" : "draft",
    scope: {
      ...readOnlyCommandScope(),
      starts_listener: false,
      accepts_remote_connections: false,
      mutates_workspace: false,
      detects_live_duplicates: false,
      enforces_rate_limits: false,
      issues_session: false
    },
    summary,
    checks,
    ingress_profile: {
      runnable_surface: "tui",
      contract_surface: "local_api_like_envelope",
      envelope_fields: envelopeFields,
      current_rate_limit_enforcement: "tui_run_local_atomic_window_before_supervisor_handoff",
      rate_limit_reservation_schema: "local-ingress-rate-limit-reservation.schema.json",
      current_duplicate_detection: "tui_run_local_atomic_reservation_before_supervisor_handoff",
      idempotency_reservation_schema: "local-ingress-idempotency-reservation.schema.json",
      current_idempotency_replay: "tui_same_key_same_normalized_intent_completed_manifest_only",
      idempotency_completion_schema: "local-ingress-idempotency-completion.schema.json",
      unknown_or_unauthenticated_disposition: "observation_or_queued_intent_only",
      policy_handoff: "fresh_policy_and_scoped_lease_required_before_actions"
    },
    deferred_surfaces: [
      "public HTTP/API listener",
      "GUI client ingress",
      "browser extension ingress",
      "IM delivery ingress",
      "mobile pairing and ingress",
      "connector OAuth ingress",
      "cloud worker ingress"
    ],
    remaining_gaps: [
      "TUI run rate limits are enforced through local atomic window slots before supervisor handoff, but durable/distributed/session/remote rate limiting is not implemented",
      "same-key same-intent TUI idempotency replay returns cached manifest/Ledger evidence without a new action run, but durable/session/remote idempotency replay is not implemented",
      "caller identity is a placeholder; no durable user identity, device identity, remote channel identity, session token lifecycle, or OAuth pairing is implemented",
      "unknown or unauthenticated local API/browser/IM/mobile inputs may only be observations or queued intents and cannot authorize tools or side effects",
      "no public API listener, browser extension ingress, IM delivery, mobile pairing, connector OAuth ingress, or cloud worker ingress is implemented"
    ],
    source_documents: [
      { path: "docs/01-architecture.md", role: "Ingress Gateways normalize, authenticate, rate-limit, and provide idempotency before Local Supervisor" },
      { path: "docs/02-user-boundary-layer.md", role: "client surfaces and remote channels cannot authorize sensitive actions directly" },
      { path: "docs/06-roadmap.md", role: "V1 stays TUI-first before broader client surfaces" },
      { path: "docs/15-production-gap-closure-plan.md", role: "PGC-3 local ingress gateway MVP acceptance criteria" }
    ]
  };
}

type SecurityAuditSeverity = "info" | "low" | "medium" | "high" | "critical";
type SecurityAuditCheckStatus = "pass" | "warn" | "fail" | "not_applicable";

type SecurityAuditFinding = {
  id: string;
  check_id: string;
  severity: SecurityAuditSeverity;
  title: string;
  detail: string;
  evidence: string[];
  remediation: string;
};

type SecurityAuditCheck = {
  id: string;
  status: SecurityAuditCheckStatus;
  severity: SecurityAuditSeverity;
  summary: string;
  evidence: string[];
  finding_ids: string[];
};

type SecurityAuditReport = {
  id: "aetherion_security_audit_report";
  generated_at: string;
  repo_root: string;
  workspace_root: string;
  status: "pass" | "warn" | "fail";
  scope: {
    read_only: true;
    mutates_ledger: false;
    mutates_registries: false;
    writes_artifacts: false;
    calls_model_provider: false;
    issues_lease: false;
    repairs_state: false;
    deep_live_probe: false;
  };
  summary: {
    checks: number;
    findings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  checks: SecurityAuditCheck[];
  findings: SecurityAuditFinding[];
};

type SecurityAuditCheckResult = {
  check: SecurityAuditCheck;
  findings: SecurityAuditFinding[];
};

async function buildSecurityAuditReport(workspaceRoot: string): Promise<SecurityAuditReport> {
  const workspaceLedger = await workspaceLedgerSecurityCheck(workspaceRoot);
  const modelStdout = modelStdoutSecurityCheck();
  const findings: SecurityAuditFinding[] = [
    ...trackedRuntimeArtifactFindings(),
    ...trackedSecretFindings(),
    ...dependencyReproducibilityFindings(),
    ...workspaceRuntimeArtifactFindings(workspaceRoot),
    ...ciArtifactGuardFindings(),
    ...ciDependencyAuditGuardFindings(),
    ...workspaceLedger.findings,
    ...modelStdout.findings
  ];
  const checks: SecurityAuditCheck[] = [
    checkForFindings(
      "repo.tracked_runtime_artifacts",
      findings,
      "No tracked runtime/build artifact roots were found.",
      [`forbidden_roots=${forbiddenTrackedRoots().join(",")}`]
    ),
    checkForFindings(
      "repo.high_confidence_secret_material",
      findings,
      "No high-confidence raw secret material was found in tracked repository text files.",
      ["patterns=private_keys,api_keys,provider_tokens,github_tokens,aws_access_keys"]
    ),
    checkForFindings(
      "repo.dependency_reproducibility",
      findings,
      "Root Node and Rust dependency lockfiles are present and match project metadata.",
      dependencyLockfileState(readRepoJson("package.json") as { name?: string; version?: string; license?: string; bin?: { ether?: string }; engines?: { node?: string } } | null).evidence
    ),
    checkForFindings(
      "runtime.raw_sensitive_artifacts",
      findings,
      existsSync(join(workspaceRoot, ".aetherion"))
        ? "Workspace runtime artifacts do not contain raw prompt/model/provider payload fields or high-confidence secrets."
        : "Workspace runtime state is not initialized; runtime artifact scan was skipped.",
      [`runtime_dir=${join(workspaceRoot, ".aetherion")}`],
      existsSync(join(workspaceRoot, ".aetherion")) ? "pass" : "not_applicable"
    ),
    workspaceLedger.check,
    checkForFindings(
      "ci.runtime_artifact_guard",
      findings,
      "CI artifact guard covers the documented runtime/build artifact roots.",
      [`forbidden_roots=${forbiddenTrackedRoots().join(",")}`]
    ),
    checkForFindings(
      "ci.dependency_audit_guard",
      findings,
    "CI enforces lockfile install, dependency audit, platform smoke, Node 24 action runtime, and operator readiness/release-evidence snapshots.",
      [`required_gates=${ciGateNeedles().join(",")}`]
    ),
    modelStdout.check
  ];
  const summary = {
    checks: checks.length,
    findings: findings.length,
    critical: findings.filter((finding) => finding.severity === "critical").length,
    high: findings.filter((finding) => finding.severity === "high").length,
    medium: findings.filter((finding) => finding.severity === "medium").length,
    low: findings.filter((finding) => finding.severity === "low").length,
    info: findings.filter((finding) => finding.severity === "info").length
  };
  const status = summary.critical > 0 || summary.high > 0
    ? "fail"
    : summary.medium > 0 || summary.low > 0
      ? "warn"
      : "pass";
  return {
    id: "aetherion_security_audit_report",
    generated_at: new Date().toISOString(),
    repo_root: repoRoot,
    workspace_root: workspaceRoot,
    status,
    scope: {
      read_only: true,
      mutates_ledger: false,
      mutates_registries: false,
      writes_artifacts: false,
      calls_model_provider: false,
      issues_lease: false,
      repairs_state: false,
      deep_live_probe: false
    },
    summary,
    checks,
    findings: findings.sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || left.id.localeCompare(right.id))
  };
}

function forbiddenTrackedRoots(): string[] {
  const configured = readRepoText("tools/forbidden-tracked-roots.txt")
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (configured && configured.length > 0) {
    return configured;
  }
  return [
    ".aetherion",
    ".claude",
    "target",
    "reports",
    "screenshots",
    "playwright-report",
    "test-results",
    ".omx",
    ".omc",
    "artifacts",
    "coverage",
    "logs",
    "tmp",
    "temp",
    "vault",
    "memory-vault",
    "local-data"
  ];
}

function trackedRuntimeArtifactFindings(): SecurityAuditFinding[] {
  const tracked = gitTrackedFiles();
  const forbidden = forbiddenTrackedRoots();
  return tracked
    .filter((file) => forbidden.some((root) => file === root || file.startsWith(`${root}/`)))
    .map((file) => securityFinding(
      "repo.tracked_runtime_artifacts",
      "high",
      "Tracked runtime/build artifact",
      `Tracked file ${file} lives under a runtime/build artifact root.`,
      [`tracked_file=${file}`],
      "Remove the tracked artifact and keep generated/runtime state ignored."
    ));
}

function trackedSecretFindings(): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  for (const file of gitTrackedFiles()) {
    const absolute = join(repoRoot, file);
    if (!isScannableTextPath(file) || !existsSync(absolute)) {
      continue;
    }
    let text: string;
    try {
      text = readFileSync(absolute, "utf8");
    } catch {
      continue;
    }
    for (const match of highConfidenceSecretMatches(text)) {
      findings.push(securityFinding(
        "repo.high_confidence_secret_material",
        "critical",
        "High-confidence secret material in tracked file",
        `Tracked file ${file} contains ${match}.`,
        [`tracked_file=${file}`, `pattern=${match}`],
        "Remove the secret, rotate the credential, and replace examples with inert placeholders."
      ));
    }
  }
  return findings;
}

function dependencyReproducibilityFindings(): SecurityAuditFinding[] {
  const packageJson = readRepoJson("package.json") as { name?: string; version?: string; license?: string; bin?: { ether?: string }; engines?: { node?: string } } | null;
  const state = dependencyLockfileState(packageJson);
  if (state.ok) {
    return [];
  }
  return [securityFinding(
    "repo.dependency_reproducibility",
    "high",
    "Dependency lockfile evidence is incomplete",
    "Root Node and Rust dependency lockfiles are missing or inconsistent with project metadata.",
    state.evidence,
    "Commit a fresh package-lock.json and Cargo.lock so dependency resolution and audit commands are reproducible."
  )];
}

function workspaceRuntimeArtifactFindings(workspaceRoot: string): SecurityAuditFinding[] {
  const artifactsDir = join(workspaceRoot, ".aetherion", "artifacts");
  if (!existsSync(artifactsDir)) {
    return [];
  }
  const findings: SecurityAuditFinding[] = [];
  for (const file of jsonAndTextFiles(artifactsDir)) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const match of highConfidenceSecretMatches(text)) {
      findings.push(securityFinding(
        "runtime.raw_sensitive_artifacts",
        "critical",
        "High-confidence secret material in runtime artifact",
        `Runtime artifact ${relative(workspaceRoot, file)} contains ${match}.`,
        [`artifact=${relative(workspaceRoot, file)}`, `pattern=${match}`],
        "Remove the raw secret artifact, rotate the credential, and preserve only redacted/hash evidence."
      ));
    }
    const rawFields = rawSensitivePayloadFields(text);
    for (const field of rawFields) {
      findings.push(securityFinding(
        "runtime.raw_sensitive_artifacts",
        "medium",
        "Raw prompt/model/provider payload field in runtime artifact",
        `Runtime artifact ${relative(workspaceRoot, file)} contains raw field ${field}.`,
        [`artifact=${relative(workspaceRoot, file)}`, `field=${field}`],
        "Persist hashes, ids, refs, and audit metadata only; keep raw prompt/model/provider payloads out of artifacts."
      ));
    }
  }
  return findings;
}

function ciArtifactGuardFindings(): SecurityAuditFinding[] {
  const workflow = readRepoText(".github/workflows/ci.yml") ?? "";
  const denylistPath = "tools/forbidden-tracked-roots.txt";
  const denylist = readRepoText(denylistPath) ?? "";
  const missing = forbiddenTrackedRoots().filter((root) => !denylist.split(/\r?\n/).map((line) => line.trim()).includes(root));
  const workflowUsesSharedDenylist = workflow.includes(denylistPath);
  if (workflowUsesSharedDenylist && missing.length === 0) {
    return [];
  }
  return missing.length === 0
    ? [securityFinding(
        "ci.runtime_artifact_guard",
        "medium",
        "CI artifact leakage guard does not use the shared denylist",
        "The CI tracked-artifact guard is not wired to the shared forbidden root list.",
        [`shared_denylist=${denylistPath}`],
        "Read tracked runtime/build roots from tools/forbidden-tracked-roots.txt in CI."
      )]
    : [securityFinding(
        "ci.runtime_artifact_guard",
        "medium",
        "CI artifact leakage guard is incomplete",
        "The CI tracked-artifact guard does not cover every documented runtime/build artifact root.",
        [`missing_roots=${missing.join(",")}`],
        "Update .github/workflows/ci.yml or a checked helper script so tracked runtime/build roots fail CI."
      )];
}

function ciDependencyAuditGuardFindings(): SecurityAuditFinding[] {
  const workflow = readRepoText(".github/workflows/ci.yml") ?? "";
  const missing = ciGateNeedles().filter((needle) => !workflow.includes(needle));
  return missing.length === 0
    ? []
    : [securityFinding(
        "ci.dependency_audit_guard",
        "medium",
        "CI dependency and readiness guard is incomplete",
        "GitHub Actions does not run every dependency reproducibility, dependency audit, platform smoke, action-runtime, and operator readiness/release-evidence gate.",
        [`missing_gates=${missing.join(",")}`],
        "Update .github/workflows/ci.yml to run npm ci, npm audit, cargo audit, onboarding check, doctor, ingress audit, security audit, release evidence, Node 24 JavaScript actions, and the platform smoke matrix."
      )];
}

async function workspaceLedgerSecurityCheck(workspaceRoot: string): Promise<SecurityAuditCheckResult> {
  const registryPath = join(workspaceRoot, ".aetherion", "workspace.json");
  if (!existsSync(registryPath)) {
    return {
      check: {
        id: "workspace.ledger_hash_chain",
        status: "not_applicable",
        severity: "info",
        summary: "Workspace runtime state is not initialized; Ledger scan was skipped.",
        evidence: [`workspace_registry=${registryPath}`],
        finding_ids: []
      },
      findings: []
    };
  }
  try {
    const { workspace } = await loadWorkspaceFromRegistry(workspaceRoot);
    const events = await readEvents(workspace);
    const chain = verifyEventHashChain(events);
    if (!chain.valid) {
      const finding = securityFinding(
        "workspace.ledger_hash_chain",
        "high",
        "Workspace Event Ledger hash chain is invalid",
        `Workspace Ledger verification failed at ${chain.broken_at ?? "unknown"}.`,
        [`broken_at=${chain.broken_at ?? "unknown"}`, `event_count=${events.length}`],
        "Inspect the Ledger before trusting projections; do not repair by deleting events."
      );
      return {
        check: {
          id: "workspace.ledger_hash_chain",
          status: "fail",
          severity: "high",
          summary: "Workspace Event Ledger hash chain is invalid.",
          evidence: finding.evidence,
          finding_ids: [finding.id]
        },
        findings: [finding]
      };
    }
    return {
      check: {
        id: "workspace.ledger_hash_chain",
        status: "pass",
        severity: "info",
        summary: "Workspace Event Ledger hash chain verifies.",
        evidence: [`event_count=${events.length}`, "broken_at=none"],
        finding_ids: []
      },
      findings: []
    };
  } catch (error) {
    const finding = securityFinding(
      "workspace.ledger_hash_chain",
      "high",
      "Workspace runtime state cannot be loaded",
      "Workspace runtime state exists but could not be loaded read-only.",
      [error instanceof Error ? error.message : String(error)],
      "Inspect workspace registry identity and Ledger files before trusting projections."
    );
    return {
      check: {
        id: "workspace.ledger_hash_chain",
        status: "fail",
        severity: "high",
        summary: "Workspace runtime state exists but could not be loaded read-only.",
        evidence: finding.evidence,
        finding_ids: [finding.id]
      },
      findings: [finding]
    };
  }
}

function modelStdoutSecurityCheck(): SecurityAuditCheckResult {
  const defaultOutput = promptInvokeModelConsoleOutput(
    { output_text_sha256: `sha256:${"0".repeat(64)}` },
    "raw model output probe",
    parseArgs(["prompt", "invoke-model", "agent_model_request_probe", "--content", "probe"])
  );
  const explicitOutput = promptInvokeModelConsoleOutput(
    { output_text_sha256: `sha256:${"0".repeat(64)}` },
    "raw model output probe",
    parseArgs(["prompt", "invoke-model", "agent_model_request_probe", "--content", "probe", "--print-output"])
  );
  if (!("output_text" in defaultOutput) && defaultOutput.raw_output_printed === false && explicitOutput.output_text === "raw model output probe" && explicitOutput.raw_output_printed === true) {
    return {
      check: {
        id: "prompt.invoke_model_stdout_default",
        status: "pass",
        severity: "info",
        summary: "prompt invoke-model defaults to hash/metadata stdout; raw output requires --print-output.",
        evidence: ["default_raw_output=false", "raw_output_flag=--print-output"],
        finding_ids: []
      },
      findings: []
    };
  }
  const finding = securityFinding(
    "prompt.invoke_model_stdout_default",
    "medium",
    "Raw model output may print by default",
    "prompt invoke-model did not prove hash/metadata-only default stdout.",
    ["default_raw_output=unproven"],
    "Keep raw model output behind an explicit --print-output operator flag."
  );
  return {
    check: {
      id: "prompt.invoke_model_stdout_default",
      status: "warn",
      severity: "medium",
      summary: "prompt invoke-model may print raw model output by default.",
      evidence: finding.evidence,
      finding_ids: [finding.id]
    },
    findings: [finding]
  };
}

function checkForFindings(
  id: string,
  findings: SecurityAuditFinding[],
  passSummary: string,
  passEvidence: string[],
  emptyStatus: SecurityAuditCheckStatus = "pass"
): SecurityAuditCheck {
  const related = findings.filter((finding) => finding.check_id === id);
  if (related.length === 0) {
    return {
      id,
      status: emptyStatus,
      severity: "info",
      summary: passSummary,
      evidence: passEvidence,
      finding_ids: []
    };
  }
  const worst = related.map((finding) => finding.severity).sort((left, right) => severityRank(right) - severityRank(left))[0] ?? "info";
  return {
    id,
    status: severityRank(worst) >= severityRank("high") ? "fail" : "warn",
    severity: worst,
    summary: `${related.length} security finding(s) found for ${id}.`,
    evidence: related.flatMap((finding) => finding.evidence).slice(0, 12),
    finding_ids: related.map((finding) => finding.id)
  };
}

function securityFinding(
  checkId: string,
  severity: SecurityAuditSeverity,
  title: string,
  detail: string,
  evidence: string[],
  remediation: string
): SecurityAuditFinding {
  const suffix = createHash("sha256").update(`${checkId}:${severity}:${title}:${evidence.join("|")}`).digest("hex").slice(0, 12);
  return {
    id: `sec_${checkId.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_${suffix}`,
    check_id: checkId,
    severity,
    title,
    detail,
    evidence,
    remediation
  };
}

function gitTrackedFiles(): string[] {
  try {
    return execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isScannableTextPath(file: string): boolean {
  return !/\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|woff2?|ttf|otf)$/i.test(file);
}

function highConfidenceSecretMatches(text: string): string[] {
  const patterns: Array<[string, RegExp]> = [
    ["private_key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/],
    ["openai_key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
    ["anthropic_key", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
    ["google_api_key", /\bAIza[A-Za-z0-9_-]{20,}\b/],
    ["github_token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
    ["slack_token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
    ["aws_access_key", /\bAKIA[0-9A-Z]{16}\b/]
  ];
  return patterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
}

function rawSensitivePayloadFields(text: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return [];
  }
  const rawKeys = new Set([
    "output_text",
    "raw_output",
    "raw_model_output",
    "raw_prompt",
    "rendered_prompt",
    "prompt_text",
    "raw_provider_payload",
    "provider_payload",
    "raw_response"
  ]);
  const found = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (rawKeys.has(key) && child !== null && child !== false && child !== "") {
        found.add(key);
      }
      visit(child);
    }
  };
  visit(parsed);
  return [...found].sort();
}

function jsonAndTextFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.isFile() && /\.(json|jsonl|md|txt)$/i.test(entry.name)) {
        files.push(path);
      }
    }
  };
  walk(root);
  return files;
}

function severityRank(severity: SecurityAuditSeverity): number {
  return { info: 0, low: 1, medium: 2, high: 3, critical: 4 }[severity];
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
    const observationPayloadRef = artifactRef("surface", "browser-observe", observation.id);
    await appendManagedRunEvent(
      workspaceRoot,
      workspace,
      manifest,
      "browser.observation.ingested",
      `Ingested hash-only current-tab browser observation ${observation.id}; raw DOM was not persisted and cannot authorize actions.`,
      observationPayloadRef
    );
    await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "completed", browserObservationEventSequence(observationPayloadRef));
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
    const outboxPayloadRef = artifactRef("surface", "im-outbox", item.id);
    await appendManagedRunEvent(
      workspaceRoot,
      workspace,
      manifest,
      "im.outbox.queued",
      `${item.delivery_status === "queued" ? "Queued" : "Blocked"} hash-only ${item.adapter} outbox item ${item.id}; delivery was not attempted.`,
      outboxPayloadRef
    );
    await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, item.delivery_status === "queued" ? "blocked" : "completed", imOutboxEventSequence(outboxPayloadRef));
    printJson(item);
    return;
  }
  throw new Error("surface supports browser-observe, im-inbox, and im-outbox");
}

async function runStore(options: CliOptions): Promise<void> {
  if (options.topic === "trust-publisher") {
    if (!options.path) {
      throw new Error("store trust-publisher requires --path <publisher-key.json>");
    }
    const workspaceRoot = resolve(options.workspace);
    await openWorkspace(workspaceRoot);
    const input = JSON.parse(readFileSync(resolve(workspaceRoot, options.path), "utf8")) as { id?: string; public_key_pem?: string };
    if (typeof input.id !== "string" || typeof input.public_key_pem !== "string") {
      throw new Error("Store publisher trust input must include id and public_key_pem");
    }
    const publisher = createTrustedStorePublisherRecord({
      id: input.id,
      public_key_pem: input.public_key_pem
    });
    writeStoreArtifact(workspaceRoot, "publisher", publisher);
    upsertRegistryItem(workspaceRoot, "store-publishers", publisher);
    await recordGovernanceEvent(
      workspaceRoot,
      "store.publisher.trusted",
      `Trusted Store publisher ${publisher.id} with local operator-enrolled key fingerprint ${publisher.fingerprint_sha256}.`,
      artifactRef("store", "publisher", publisher.id)
    );
    printJson(publisher);
    return;
  }
  if (options.topic !== "install") {
    throw new Error("store supports trust-publisher --path <publisher-key.json> and install --path <signed-package.json> [--approve-permissions]");
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
  let approvalCard: (Record<string, unknown> & { id: string }) | null = null;
  if (capsule.permission_diff?.requires_approval) {
    if (!options.approvePermissions) {
      throw new Error("Store package permission expansion requires --approve-permissions");
    }
    approvalCard = capsuleApprovalCard(capsule);
    await requireValidContract("approval-card.schema.json", approvalCard);
    approvalCardId = approvalCard.id;
  }
  const trustedPublishers = readRegistry(workspaceRoot, "store-publishers").filter(isStoreTrustedPublisher);
  const replayRecords = await readLedgerBackedStoreReplayEvidence(workspaceRoot, workspace);
  const sandboxTrialContentSha256 = readSandboxTrialContentHash(workspaceRoot, capsule);
  const install = createCapsuleInstallRecord(pkg, {
    approvePermissions: options.approvePermissions,
    approvalCardId,
    trustedPublishers,
    replayRecords,
    sandboxTrialContentSha256
  });
  await requireValidContract("capsule-install.schema.json", install);
  await requireValidContract("capability-capsule.schema.json", capsule);
  writeStoreArtifact(workspaceRoot, "install", install);
  if (approvalCard) {
    upsertRegistryItem(workspaceRoot, "approval-cards", approvalCard);
  }
  upsertRegistryItem(workspaceRoot, "capsules", capsule);
  upsertRegistryItem(workspaceRoot, "capsule-installs", install);
  archiveCapsuleVersion(workspaceRoot, capsule);
  await recordGovernanceEvent(
    workspaceRoot,
    "capsule.store.installed",
    `Installed signed Capsule package ${pkg.id} into the local registry after trusted publisher, replay, sandbox, and permission-diff checks; no package code executed.`,
    artifactRef("store", "install", install.id)
  );
  printJson(install);
}

async function readLedgerBackedStoreReplayEvidence(
  workspaceRoot: string,
  workspace: Awaited<ReturnType<typeof openWorkspace>>
): Promise<StoreReplayEvidenceRecord[]> {
  const events = await readEvents(workspace);
  const chain = verifyEventHashChain(events);
  if (!chain.valid) {
    throw new Error(`store install requires a valid Event Ledger hash chain; broken_at=${chain.broken_at ?? "unknown"}`);
  }
  const eventIds = new Set(events.map((event) => event.id));
  const replayRecords: StoreReplayEvidenceRecord[] = [];
  for (const event of events.filter((entry) => entry.event_type === "replay.recorded")) {
    if (!event.payload_ref) {
      throw new Error(`Replay evidence event ${event.id} has no payload_ref`);
    }
    const artifactPath = localArtifactPathFromRef(workspaceRoot, event.payload_ref);
    if (!existsSync(artifactPath)) {
      throw new Error(`Replay evidence artifact missing for ${event.id}: ${event.payload_ref}`);
    }
    const parsed = JSON.parse(readFileSync(artifactPath, "utf8")) as unknown;
    await requireValidContract("replay-record.schema.json", parsed);
    if (!isStoreReplayEvidenceRecord(parsed)) {
      throw new Error(`Replay evidence artifact ${event.payload_ref} is not usable Store replay evidence`);
    }
    const replayRecord = parsed as StoreReplayEvidenceRecord & { artifact_ref?: string };
    const expectedArtifactRef = replayRecord.artifact_ref ?? `artifact://replay/${replayRecord.run_id}/trace`;
    if (expectedArtifactRef !== event.payload_ref) {
      throw new Error(`Replay Record ${replayRecord.id} artifact_ref does not match replay.recorded event ${event.id}`);
    }
    const missingSourceEvent = replayRecord.source_events.find((sourceEventId) => !eventIds.has(sourceEventId));
    if (missingSourceEvent) {
      throw new Error(`Replay Record ${replayRecord.id} cites missing source event ${missingSourceEvent}`);
    }
    replayRecords.push(replayRecord);
  }
  return replayRecords;
}

function localArtifactPathFromRef(workspaceRoot: string, ref: string): string {
  if (!ref.startsWith("artifact://")) {
    throw new Error(`Unsupported local artifact reference ${ref}`);
  }
  const parts = ref.slice("artifact://".length).split("/").filter(Boolean);
  if (parts.length < 3) {
    throw new Error(`Local artifact reference ${ref} is missing command/topic/id segments`);
  }
  if (parts.some((part) => part === "." || part === ".." || part.includes("\\"))) {
    throw new Error(`Local artifact reference ${ref} contains an unsafe path segment`);
  }
  const artifactsRoot = resolve(workspaceRoot, ".aetherion", "artifacts");
  const artifactPath = parts[0] === "replay" && parts.length === 3 && parts[2] === "trace"
    ? resolve(artifactsRoot, "replay", parts[1], `replay_${parts[1]}_trace.json`)
    : resolve(artifactsRoot, ...parts.slice(0, -1), `${parts.at(-1)}.json`);
  if (artifactPath !== artifactsRoot && !artifactPath.startsWith(`${artifactsRoot}/`)) {
    throw new Error(`Local artifact reference ${ref} resolves outside the workspace artifact root`);
  }
  return artifactPath;
}

function readSandboxTrialContentHash(workspaceRoot: string, capsule: Capsule): string {
  const sandboxPath = capsule.sandbox_trial?.sandbox_path;
  if (typeof sandboxPath !== "string" || sandboxPath.length === 0) {
    throw new Error("Store package Capsule requires sandbox trial path evidence");
  }
  const root = resolve(workspaceRoot);
  const target = resolve(root, sandboxPath);
  const relativePath = relative(root, target);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Store package sandbox trial path must stay inside the workspace");
  }
  const expectedPrefix = join(".aetherion", "capsules", "trials", capsule.id, capsule.version);
  if (relativePath !== expectedPrefix && !relativePath.startsWith(`${expectedPrefix}/`)) {
    throw new Error(`Store package sandbox trial path is not bound to Capsule ${capsule.id}@${capsule.version}`);
  }
  return `sha256:${createHash("sha256").update(readFileSync(target)).digest("hex")}`;
}

function writeStoreArtifact(workspaceRoot: string, topic: "publisher" | "install", value: { id: string }): string {
  const dir = join(workspaceRoot, ".aetherion", "artifacts", "store", topic);
  const safeId = sanitizePathSegment(value.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${safeId}.json`), `${JSON.stringify(value, null, 2)}\n`);
  return artifactRef("store", topic, safeId);
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

function printRawJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
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

async function recordReplayEvidence(
  workspaceRoot: string,
  workspace: Awaited<ReturnType<typeof openWorkspace>>,
  replayRecord: ReplayRecord
): Promise<{ eventId: string; runId: string }> {
  await requireValidContract("replay-record.schema.json", replayRecord);
  writeReplayArtifact(workspaceRoot, replayRecord);
  const replayArtifactRef = replayRecord.artifact_ref ?? `artifact://replay/${replayRecord.run_id}/trace`;
  const replayRunId = `run_replay_${sanitizePathSegment(replayRecord.run_id)}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const manifest = await createRunManifest(
    repoRoot,
    workspace,
    replayRunId,
    `Replay trace for ${replayRecord.run_id}.`
  );
  const eventId = await appendManagedRunEvent(
    workspaceRoot,
    workspace,
    manifest,
    "replay.recorded",
    `Replay Record ${replayRecord.id} persisted as read-only trace evidence for ${replayRecord.run_id}.`,
    replayArtifactRef
  );
  await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "completed", replayRecordRunEventSequence(replayArtifactRef));
  upsertRegistryItem(workspaceRoot, "replay-records", replayRecord);
  return { eventId, runId: replayRunId };
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
  const manifest = await loadOptionalRunManifest(workspace, runId);
  if (options.command === "replay") {
    const replayRecord = await createTraceReplayRecord(workspace, runId);
    const replayEvidence = await recordReplayEvidence(resolve(options.workspace), workspace, replayRecord);
    console.log(`replay_record=${replayRecord.id}`);
    console.log(`replay_artifact_ref=${replayRecord.artifact_ref ?? "not_recorded"}`);
    console.log(`replay_run_id=${replayEvidence.runId}`);
    console.log(`replay_event_id=${replayEvidence.eventId}`);
    const replayParity = auditReplayRecordRegistryRebuild(resolve(options.workspace));
    const replayDrift = replayParity.summary.missing_registry
      + replayParity.summary.mismatched
      + replayParity.summary.stale_registry
      + replayParity.summary.invalid_artifact
      + replayParity.summary.invalid_registry;
    console.log(`replay_registry_parity=${replayDrift === 0 ? "matched" : "drift"}`);
    console.log(`replay_registry_drift=${replayDrift}`);
    console.log(`replay_registry_expected=${replayParity.summary.expected}`);
    console.log(`replay_registry_actual=${replayParity.summary.actual}`);
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
  if (!manifest) {
    console.log("manifest_status=missing");
    console.log("manifest_event_ids=not_recorded");
    console.log("artifact_refs=not_recorded");
    console.log("artifact_ref_count=0");
    return;
  }
  await printRunEvidence(workspace, manifest);
}

function eventsOfType(events: EventRecord[], eventType: string): EventRecord[] {
  return events.filter((event) => event.event_type === eventType);
}

function riskLevels(events: EventRecord[]): string[] {
  return uniqueStrings(events.flatMap((event) => event.summary.match(/\bL[0-5]\b/g) ?? []));
}

function joinOrNotRecorded(values: string[]): string {
  return values.length > 0 ? values.join(",") : "not_recorded";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].filter(Boolean);
}

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

function assertWorkspaceReadPath(workspaceRoot: string, targetPath: string): string {
  const resolvedRoot = resolve(workspaceRoot);
  const resolvedTarget = resolve(resolvedRoot, targetPath);
  const relativeTarget = relative(resolvedRoot, resolvedTarget);
  if (!relativeTarget || relativeTarget === ".") {
    throw new Error("Read target must be a file path inside the workspace");
  }
  if (relativeTarget.startsWith("..") || isAbsolute(relativeTarget)) {
    throw new Error("Read target is outside workspace boundary");
  }
  return relativeTarget;
}

async function openWorkspace(workspaceRoot: string) {
  return (await loadWorkspaceFromRegistry(workspaceRoot)).workspace;
}

async function loadOptionalRunManifest(workspace: Awaited<ReturnType<typeof openWorkspace>>, runId: string): Promise<RunManifest | undefined> {
  try {
    return await loadRunManifest(workspace, runId);
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "ENOENT";
}

function isFileExistsError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "EEXIST";
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

async function requireStrongRegistryProvenance(workspaceRoot: string, ledgerEvents: EventRecord[], registries: string[]): Promise<void> {
  const audit = auditRegistryProvenance(workspaceRoot, ledgerEvents);
  const registrySet = new Set(registries);
  const unsafeFindings = audit.findings.filter((finding) => registrySet.has(finding.registry) && finding.status !== "strong");
  if (unsafeFindings.length === 0) {
    return;
  }
  const details = unsafeFindings
    .map((finding) => `${finding.registry}/${finding.item_id}:${finding.status}${finding.missing_event_ids.length > 0 ? `[missing=${finding.missing_event_ids.join(",")}]` : ""}`)
    .join("; ");
  throw new Error(`Memory registry provenance is not strong enough for context assembly: ${details}`);
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
  await completeRunManifestWithEventSequence(repoRoot, workspace, manifest, "completed", [{ event_type: eventType, payload_ref: payloadRef }]);
  return result.event_id;
}

async function appendManagedRunEvent(
  workspaceRoot: string,
  workspace: Awaited<ReturnType<typeof openWorkspace>>,
  manifest: Awaited<ReturnType<typeof createRunManifest>>,
  eventType: string,
  summary: string,
  payloadRef?: string
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

async function recordUnprojectedRunEvents(
  repoRoot: string,
  workspace: Awaited<ReturnType<typeof openWorkspace>>,
  manifest: RunManifest
): Promise<EventRecord[]> {
  const runEvents = (await readEvents(workspace)).filter((event) => event.run_id === manifest.id);
  const unprojected = runEvents.slice(manifest.event_ids.length);
  for (const event of unprojected) {
    await recordRunEvent(repoRoot, workspace, manifest, event.id);
  }
  return unprojected;
}

function childReadSupervisorEvidence(readResult: Record<string, unknown>, childRunId: string): { eventIds: string[]; eventTypes: string[] } {
  const requestEventId = requiredSupervisorEventId(readResult, "request_event_id", childRunId);
  const riskEventId = requiredSupervisorEventId(readResult, "risk_event_id", childRunId);
  const policyEventId = requiredSupervisorEventId(readResult, "policy_event_id", childRunId);
  const resultEventId = requiredSupervisorEventId(readResult, "result_event_id", childRunId);
  if (readResult.decision === "allow") {
    const leaseEventId = readResult.lease_event_id;
    if (typeof leaseEventId !== "string" || leaseEventId.length === 0) {
      throw new Error(`Supervisor child read did not return lease event evidence for ${childRunId}`);
    }
    return {
      eventIds: [requestEventId, riskEventId, policyEventId, leaseEventId, resultEventId],
      eventTypes: ["tool.requested", "risk.composed", "policy.decided", "lease.issued", "tool.result"]
    };
  }
  return {
    eventIds: [requestEventId, riskEventId, policyEventId, resultEventId],
    eventTypes: ["tool.requested", "risk.composed", "policy.decided", "tool.result"]
  };
}

function requiredSupervisorEventId(readResult: Record<string, unknown>, key: string, childRunId: string): string {
  const eventId = readResult[key];
  if (typeof eventId !== "string" || eventId.length === 0) {
    throw new Error(`Supervisor child read did not return Ledger event evidence for ${childRunId}`);
  }
  return eventId;
}

async function recordSupervisorEventIds(
  workspace: Awaited<ReturnType<typeof openWorkspace>>,
  manifest: Awaited<ReturnType<typeof createRunManifest>>,
  result: Record<string, unknown>,
  keys: string[]
): Promise<void> {
  for (const key of keys) {
    const eventId = result[key];
    if (eventId === "") {
      continue;
    }
    if (typeof eventId !== "string") {
      throw new Error(`Supervisor write lifecycle returned no ${key}`);
    }
    await recordRunEvent(repoRoot, workspace, manifest, eventId);
  }
}

async function printRunEvidence(workspace: Awaited<ReturnType<typeof openWorkspace>>, manifest: RunManifest): Promise<void> {
  const ledger = await readEvents(workspace);
  const manifestEventIds = new Set(manifest.event_ids);
  const artifactRefs = uniqueStrings(ledger
    .filter((event) => event.run_id === manifest.id && manifestEventIds.has(event.id))
    .map((event) => event.payload_ref)
    .filter((value): value is string => typeof value === "string" && value.length > 0));
  console.log(`manifest_status=${manifest.status}`);
  console.log(`manifest_events=${manifest.event_ids.length}`);
  console.log(`manifest_event_ids=${joinOrNotRecorded(manifest.event_ids)}`);
  console.log(`artifact_refs=${joinOrNotRecorded(artifactRefs)}`);
  console.log(`artifact_ref_count=${artifactRefs.length}`);
}

function printKeyValueRecord(record: Record<string, unknown>, keys: string[]): void {
  for (const key of keys) {
    const value = record[key];
    if (value === undefined || value === null || value === "") {
      console.log(`${key}=not_recorded`);
      continue;
    }
    console.log(`${key}=${singleLine(String(value))}`);
  }
}

async function printRunResult(
  result: Awaited<ReturnType<typeof runLocalKernelLoop>> | Awaited<ReturnType<typeof runSupervisorKernelLoop>>,
  ingressReservation: LocalIngressIdempotencyReservation,
  rateLimitReservation: LocalIngressRateLimitReservation,
  idempotencyCompletion?: LocalIngressIdempotencyCompletion
): Promise<void> {
  console.log(`run_id=${result.runId}`);
  console.log(`workspace=${result.workspace.root}`);
  console.log(`ingress_rate_limit_key_hash=${rateLimitReservation.rate_limit_key_hash}`);
  console.log(`ingress_rate_limit_state=${rateLimitReservation.rate_limit_state}`);
  console.log(`ingress_rate_limit_window=${rateLimitReservation.window_started_at}/${rateLimitReservation.window_ends_at}`);
  console.log(`ingress_rate_limit_slot=${rateLimitReservation.slot_index}`);
  console.log(`ingress_rate_limit_remaining=${rateLimitReservation.remaining_after}`);
  console.log(`ingress_rate_limit_enforcer=${rateLimitReservation.enforcer}:${rateLimitReservation.enforcement_stage}`);
  console.log(`ingress_idempotency_key_hash=${ingressReservation.idempotency_key_hash}`);
  console.log(`ingress_idempotency_key_source=${ingressReservation.key_source}`);
  console.log(`ingress_normalized_intent_hash=${ingressReservation.normalized_intent_hash}`);
  console.log(`ingress_duplicate_detector=${ingressReservation.duplicate_detector}:${ingressReservation.duplicate_detection_stage}`);
  console.log(`ingress_idempotency_replay=${idempotencyCompletion ? "recorded" : "not_available"}`);
  if (idempotencyCompletion) {
    console.log(`ingress_idempotency_completion=${idempotencyCompletion.id}`);
    console.log(`cached_replay_scope=${idempotencyCompletion.replay_scope}`);
    console.log(`cached_replay_authorizes_actions=${idempotencyCompletion.replay_authorizes_actions}`);
  }
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
  await printRunEvidence(result.workspace, result.runManifest);
}

async function printCachedIdempotencyReplay(
  ingressReservation: LocalIngressIdempotencyReservation,
  idempotencyCompletion: LocalIngressIdempotencyCompletion,
  rateLimitReservation: LocalIngressRateLimitReservation,
  workspaceRoot: string
): Promise<void> {
  const { workspace, registry } = await loadWorkspaceFromRegistry(workspaceRoot);
  console.log(`run_id=${idempotencyCompletion.source_run_id}`);
  console.log(`workspace=${workspace.root}`);
  console.log(`ingress_rate_limit_key_hash=${rateLimitReservation.rate_limit_key_hash}`);
  console.log(`ingress_rate_limit_state=${rateLimitReservation.rate_limit_state}`);
  console.log(`ingress_rate_limit_window=${rateLimitReservation.window_started_at}/${rateLimitReservation.window_ends_at}`);
  console.log(`ingress_rate_limit_slot=${rateLimitReservation.slot_index}`);
  console.log(`ingress_rate_limit_remaining=${rateLimitReservation.remaining_after}`);
  console.log(`ingress_rate_limit_enforcer=${rateLimitReservation.enforcer}:${rateLimitReservation.enforcement_stage}`);
  console.log(`ingress_idempotency_key_hash=${ingressReservation.idempotency_key_hash}`);
  console.log(`ingress_idempotency_key_source=${ingressReservation.key_source}`);
  console.log(`ingress_normalized_intent_hash=${ingressReservation.normalized_intent_hash}`);
  console.log(`ingress_duplicate_detector=${ingressReservation.duplicate_detector}:${ingressReservation.duplicate_detection_stage}`);
  console.log(`ingress_idempotency_replay=cached`);
  console.log(`ingress_idempotency_completion=${idempotencyCompletion.id}`);
  console.log(`cached_replay_source_run=${idempotencyCompletion.source_run_id}`);
  console.log(`cached_replay_scope=${idempotencyCompletion.replay_scope}`);
  console.log(`cached_replay_new_policy=${idempotencyCompletion.replay_requires_new_policy}`);
  console.log(`cached_replay_new_lease=${idempotencyCompletion.replay_requires_new_lease}`);
  console.log(`cached_replay_authorizes_actions=${idempotencyCompletion.replay_authorizes_actions}`);
  console.log(`cached_replay_live_side_effects_replayed=${idempotencyCompletion.live_side_effects_replayed}`);
  console.log(`workspace_registry=${registry.id}`);
  console.log(`run_manifest=${idempotencyCompletion.source_run_id}`);
  console.log(`read_policy=cached_replay:not_requested`);
  console.log(`write_policy_initial=cached_replay:not_requested`);
  console.log(`approval_card=cached_replay:not_requested`);
  console.log(`verification=cached_replay:source_manifest_completed`);
  console.log(`trace_events=${idempotencyCompletion.source_manifest_event_ids.length}`);
  console.log(`chain_valid=${idempotencyCompletion.source_chain_valid}`);
  console.log(`head_event_id=${idempotencyCompletion.source_head_event_id}`);
  console.log(`live_side_effects_replayed=${idempotencyCompletion.live_side_effects_replayed}`);
  console.log(`ledger=${workspace.ledgerPath}`);
  console.log(`manifest_status=${idempotencyCompletion.source_manifest_status}`);
  console.log(`manifest_events=${idempotencyCompletion.source_manifest_event_ids.length}`);
  console.log(`manifest_event_ids=${joinOrNotRecorded(idempotencyCompletion.source_manifest_event_ids)}`);
  console.log(`artifact_refs=${joinOrNotRecorded(idempotencyCompletion.source_artifact_refs)}`);
  console.log(`artifact_ref_count=${idempotencyCompletion.source_artifact_ref_count}`);
}

function printHelp(): void {
  console.log(`Ether CLI

Usage:
  ether
  ether --workspace <path>
  npm run ether -- --workspace <path>

  V1 core:
  npm run ether -- run --workspace <path> --input README.md --output .aetherion/SUMMARY.md --approve-write [--idempotency-key <key>]
  npm run ether -- run --supervisor stdio --workspace <path> --input README.md --output .aetherion/SUMMARY.md --approve-write [--idempotency-key <key>]
  npm run ether -- run --supervisor socket --socket-path <socket> --workspace <path> --input README.md --output .aetherion/SUMMARY.md --approve-write [--idempotency-key <key>]
  npm run ether -- replay <run_id> --workspace <path>
  npm run ether -- trace <run_id> --workspace <path>
  npm run ether -- boundary <run_id> --workspace <path>
  npm run ether -- supervisor status --workspace <path>
  npm run ether -- supervisor preflight --workspace <path>
  npm run ether -- supervisor start --workspace <path>
  npm run ether -- supervisor stop --workspace <path>
  npm run ether -- supervisor recover-stale-lock --workspace <path>
  npm run ether -- supervisor status --workspace <path> --socket-path <socket> [--socket-auth-token <token>]
  npm run ether -- onboarding check --workspace <path>
  npm run ether -- model status [--model-provider <provider>] [--model <model_ref>]
  npm run ether -- model chat --workspace <path> --content <task> [--model-provider <provider>] [--model <model_ref>]
  npm run ether -- doctor --workspace <path>
  npm run ether -- ingress audit --workspace <path>
  npm run ether -- release evidence --workspace <path> [--remote-evidence <snapshot.json>]
  npm run ether -- release remote-evidence --workspace <path> [--branch <name>]

  Post-V1 / experimental local contract labs (not V1 release-critical):
  npm run ether -- import --from openclaw --path <dir> --dry-run
  npm run ether -- memory candidates --source-event <event> --content <text> --confidence <0..1>
  npm run ether -- memory candidates --from-run <run_id> --workspace <path>
  npm run ether -- memory inspect <memory_id> --workspace <path>
  npm run ether -- memory block <memory_id> --context external_send --workspace <path>
  npm run ether -- memory delete <memory_id> --workspace <path>
  npm run ether -- memory timeline <run_id> --workspace <path>
  npm run ether -- memory user-model --workspace <path>
  npm run ether -- context explain <run_id> --workspace <path>
  npm run ether -- prompt plan <run_id> --content <task> --workspace <path>
  npm run ether -- prompt bind-runtime <run_id> --content <task> --workspace <path>
  npm run ether -- prompt prepare-model-request <invocation_id> --workspace <path>
  npm run ether -- prompt invoke-model <request_id> --content <task> --workspace <path> [--print-output]
  npm run ether -- prompt audit <run_id> --content <task> --path <response-file> --workspace <path>
  npm run ether -- prompt propose-tool-request <response_audit_id> --path <workspace-file> --content <intent> --workspace <path>
  npm run ether -- prompt execute-tool-request <proposal_id> --path <workspace-file> --content <operator-restated intent> --workspace <path>
  npm run ether -- checkpoint <run_id> --workspace <path>
  npm run ether -- branch <checkpoint_id>
  npm run ether -- rehearse <branch_id> --path <workspace-file> --content <proposed-contents>
  npm run ether -- approve-rehearsal <rehearsal_id> --workspace <path>
  npm run ether -- capsule propose <capsule_id> --version <semver> --input <playbook.md> --path <manifest-output.json> --content <description> --replay-run <run_id> --replay-run <run_id> --workspace <path>
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
  npm run ether -- sleepers --check-wakeups
  npm run ether -- dream run <run_id> --content <proposed-memory> --confidence <0..1>
  npm run ether -- dream accept <fold_id> [--approve-sensitive]
  npm run ether -- anchors propose --source-event <event> --content <text> --confidence <0..1> [--branch <name>]
  npm run ether -- persona reset <branch>
  npm run ether -- soul fork <checkpoint_id> --agent-id <new_agent_id> [--approve-sensitive]
  npm run ether -- agent contract --parent-run <run_id> --child-agent <agent_id> --budget <budget_id> --capsule <capsule_id> --path <workspace-file> --content <task>
  npm run ether -- agent execute <contract_id> [--capsule <capsule_id>] [--path <workspace-file>]
  npm run ether -- security scan --source-event <event_id> --source-kind <kind> --content <text>
  npm run ether -- security audit --workspace <path>
  npm run ether -- security ack <signal_id>
  npm run ether -- security trial <signal_id> [--capsule <capsule_id>]
  npm run ether -- security fixture <signal_id>

  Post-V1 contract surfaces (no real delivery, automation, or package-code execution):
  npm run ether -- surface browser-observe --path <observation-input.json> --source-event <event_id>
  npm run ether -- surface im-inbox --path <inbox-input.json>
  npm run ether -- surface im-outbox --path <outbox-input.json>
  npm run ether -- store trust-publisher --path <publisher-key.json>
  npm run ether -- store install --path <signed-package.json> [--approve-permissions]

  Read-only audits:
  npm run ether -- audit registries --workspace <path>
  npm run ether -- audit replay-records --workspace <path>
  npm run ether -- audit memory-records --workspace <path>
  npm run ether -- audit capsule-records --workspace <path>
  npm run ether -- audit hibernation-records --workspace <path>
  npm run ether -- audit sandbox-records --workspace <path>
  npm run ether -- audit store-records --workspace <path>
  npm run ether -- audit surface-records --workspace <path>
  npm run ether -- audit child-records --workspace <path>
  npm run ether -- audit payload-refs --workspace <path>
  npm run ether -- audit response-audits --workspace <path>
  npm run ether -- audit prompt-model-artifacts --workspace <path>
  npm run ether -- audit security-fixtures --workspace <path>
  npm run ether -- ingress audit --workspace <path>

Commands:
  ether                  Open the interactive Ether TUI for onboarding, settings, no-tools model chat, daemon status, and replay
  run/replay/trace       Phase 1 local kernel loop and replay
  boundary               Read-only User Boundary card from Ledger and run manifest
  supervisor             Read-only Rust supervisor status/preflight plus fail-closed unsupported lifecycle command reports
  onboarding             Read-only from-source onboarding preflight; no install, repair, daemon start, or workspace mutation
  model                  V1 no-tools model status/chat path through the provider layer; raw output is stdout/TUI only, persisted artifacts stay hash-only
  doctor                 Read-only production readiness report for repo and workspace invariants
  ingress                Read-only local ingress envelope/rate-limit/idempotency readiness audit; no listener, session, remote connection, or action authority
  release                Read-only local/configured release evidence plus a gh-backed remote snapshot reader; no packaging, signing, publishing, workspace writes, or code-scanning alert query
  import                 Phase 4 dry-run migration report
  memory/context/prompt  Post-V1 contract lab: source-backed Memory OS plus non-authorizing prompt plan/audit previews
  checkpoint/branch/rehearse Post-V1 contract lab: Phase 5 sandbox and time-travel surfaces
  capsule                Post-V1 contract lab: governed document-only draft/test/local-publish/rollback lifecycle
  why/counterfactual     Post-V1 contract lab: Phase 7 causal memory report surfaces
  sleep/wake/sleepers    Post-V1 contract lab: Phase 8 local trigger evaluation and queue-only resume
  dream/anchors/persona/soul Post-V1 contract lab: governed folding, persona branches, and Soul Fork
  agent                  Post-V1 contract lab: Phase 10 governed document-read child run and evidence
  security               V1 readiness plus post-V1 lab: read-only security audit, poisoning detection, decoy trial, and fixture
  surface                Post-V1 contract surface: hash-only browser/IM ingress and queued outbox
  store                  Post-V1 contract surface: trusted-publisher signed Capsule declaration install, no code execution
  audit                  Post-V1 support audit: registry provenance, parity previews, Ledger payload-ref, and prompt/model evidence audits
  help                   Show this help

Options:
  --workspace <path>   Workspace root. Defaults to cwd.
  --input <path>       Workspace-relative file to read. Defaults to README.md.
  --output <path>      Workspace-relative file to write. Defaults to .aetherion/SUMMARY.md.
  --summary <text>     Explicit summary text to write; default output does not copy source content.
  --idempotency-key <key> Optional caller-supplied run idempotency key; raw keys are hashed before local reservation.
  --approve-write      Required to execute the write stage.
  --approve-sensitive  Explicitly approve sensitive fold, anchor, or history inheritance.
  --socket-path <path> Explicit foreground supervisor socket for supervisor status.
  --socket-auth-token <token> Caller-supplied token for an auth-gated supervisor socket.
  --remote-evidence <path>  Workspace-local CI/CodeQL snapshot for release evidence; read-only and never queried live by release evidence.
  --check-wakeups    Preview sleeper wakeup eligibility without queueing or mutating registries.
  --print-output     Explicitly include raw model output in prompt invoke-model stdout.
`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
