#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
import { agentModelRequestArtifactRef, agentModelResponseArtifactRef, agentResponseAuditArtifactRef, agentRuntimeInvocationArtifactRef, agentToolRequestProposalArtifactRef, appendEvent, approvedWritePromotionEventSequence, auditAgentResponseAuditEvidence, auditCapsuleRegistryRebuild, auditHibernationRegistryRebuild, auditLedgerPayloadRefs, auditMemoryRegistryRebuild, auditRegistryProvenance, auditReplayRecordRegistryRebuild, auditSandboxRegistryRebuild, browserObservationEventSequence, callSupervisorRpc, childReadCompletedEventSequence, childReadPolicyDeniedEventSequence, childReadPostSupervisorBreakerEventSequence, childReadPreExecutionBreakerEventSequence, childReadRepeatedDenialEventSequence, completeRunManifest, completeRunManifestWithEventSequence, consentRecordArtifactRef, createAgentModelRequestArtifact, createAgentModelResponseArtifact, createAgentResponseAuditArtifact, createAgentToolRequestProposalArtifact, createBoundaryFacts, createRunManifest, createTraceReplayRecord, createWriteConsentRecord, eventRecord, imOutboxEventSequence, isRegistryItem, loadRunManifest, loadWorkspaceFromRegistry, readAgentModelRequestArtifact, readAgentResponseAuditArtifact, readAgentRuntimeInvocationArtifact, readBoundaryFactsArtifact, readEvents, readRegistry, reconstructTrace, recordRunEvent, replayRecordRunEventSequence, removeRegistryItem, resolveModelProvider, rpcResult, runLocalKernelLoop, runSupervisorKernelLoop, securityScanBlockedEventSequence, securityScanCleanEventSequence, upsertRegistryItem, upsertRegistryItems, validateAgainstSchema, verifyEventHashChain, wakeupQueueRunEventSequence, workspaceIdForRoot, writeAgentModelRequestArtifact, writeAgentModelResponseArtifact, writeAgentResponseAuditArtifact, writeAgentRuntimeInvocationArtifact, writeAgentToolRequestProposalArtifact, writeBoundaryFactsArtifact, type BoundaryFacts, type EventRecord, type ModelMessage, type ReplayRecord, type RunManifest } from "../../harness-core/src/index.ts";

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
  checkWakeups: boolean;
  printOutput: boolean;
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
  if (options.supervisor === "socket" && !options.socketPath) {
    throw new Error("--supervisor socket requires --socket-path <socket>");
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
        summaryText: options.summary,
        socketPath: options.supervisor === "socket" ? options.socketPath : undefined,
        socketAuthToken: options.supervisor === "socket" ? options.socketAuthToken : undefined
      });

  await printRunResult(result);
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
    inputProvided: false,
    output: ".aetherion/SUMMARY.md",
    approveWrite: false,
    dryRun: false,
    replayRuns: [],
    approvePermissions: false,
    approveSensitive: false,
    checkWakeups: false,
    printOutput: false
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
      case "--check-wakeups":
        options.checkWakeups = true;
        break;
      case "--print-output":
        options.printOutput = true;
        break;
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
  const valueFlags = new Set(["--workspace", "--input", "--output", "--summary", "--from", "--path", "--change", "--content", "--source-event", "--confidence", "--from-run", "--capsule", "--replay-run", "--version", "--deadline", "--watch-file", "--branch", "--kind", "--ttl", "--sensitivity", "--parent-run", "--child-agent", "--budget", "--agent-id", "--supervisor", "--socket-path", "--socket-auth-token"]);
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
    case "prompt":
      await runPrompt(options);
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
    default:
      return false;
  }
}

async function runSupervisorCommand(options: CliOptions): Promise<void> {
  if (options.topic !== "status" && options.topic !== "preflight") {
    throw new Error("supervisor supports status and preflight");
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
  if (!topic || !["registries", "replay-records", "memory-records", "capsule-records", "hibernation-records", "sandbox-records", "payload-refs", "response-audits"].includes(topic)) {
    throw new Error("audit requires topic registries, replay-records, memory-records, capsule-records, hibernation-records, sandbox-records, payload-refs, or response-audits");
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
      "Run Ether with Node.js 25 or newer."
    ),
    commandVersionCheck("npm_available", "npm", ["--version"], "npm is available for lockfile install and audit commands.", "Install npm with Node.js 25 or newer."),
    commandVersionCheck("git_available", "git", ["--version"], "git is available for source checkout and evidence snapshots.", "Install git before using from-source onboarding."),
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
    checks,
    next_steps: [
      "npm ci --ignore-scripts",
      "npm audit --audit-level=high --json",
      "npm test",
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
  };
  remote_observed_evidence: RemoteObservedEvidence;
  local_reports: {
    doctor: Pick<DoctorReport, "status" | "check_status" | "summary">;
    security_audit: Pick<SecurityAuditReport, "status" | "summary">;
  };
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
    installer_available: false;
    updater_available: false;
  };
  source_documents: Array<{ path: string; role: string }>;
  remaining_gaps: string[];
};

async function runRelease(options: CliOptions): Promise<void> {
  if (options.topic !== "evidence") {
    throw new Error("release supports evidence");
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
  const workspaceRuntime = releaseWorkspaceRuntime(doctor, securityAudit);
  const remoteBlocksRelease = remoteEvidence.status === "invalid"
    || remoteEvidence.ci.status === "fail"
    || remoteEvidence.codeql.status === "fail"
    || remoteEvidence.commit_matches_head === false;
  const blocked = doctor.status === "blocked" || securityAudit.status === "fail" || remoteBlocksRelease;
  const status = blocked
    ? "blocked"
    : git.dirty || remoteEvidence.status !== "observed" || remoteEvidence.warnings.length > 0
      ? "draft"
      : "ready";

  return {
    id: "aetherion_release_evidence_report",
    generated_at: new Date().toISOString(),
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
        package_manager_cache_disabled: ciWorkflow.includes("package-manager-cache: false"),
        evidence: [
          `node24_forced=${String(ciWorkflow.includes("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true"))}`,
          `checkout_v5=${String(ciWorkflow.includes("actions/checkout@v5"))}`,
          `setup_node_v5=${String(ciWorkflow.includes("actions/setup-node@v5"))}`,
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
      }
    },
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
    workspace_runtime: workspaceRuntime,
    release_artifacts: {
      packaged: false,
      signed: false,
      published: false,
      remote_ci_checked: remoteEvidence.status === "observed",
      evidence_repository: false,
      public_docs_deployed: false,
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
    remaining_gaps: [
      remoteEvidence.status === "observed"
        ? "remote CI/CodeQL evidence is read from an operator-supplied snapshot, not queried live"
        : "remote CI/CodeQL execution evidence is missing; pass --remote-evidence <snapshot.json> to include observed CI and CodeQL status",
      "release packages are not built",
      "release artifacts are not signed",
      "public docs are not deployed",
      "installer and updater infrastructure are not implemented",
      "broader platform/release matrix artifacts are not produced",
      "GUI, browser automation, IM delivery, MCP/OAuth connectors, cloud workers, and package-code execution remain deferred"
    ]
  };
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
  const packageJson = readRepoJson("package.json") as { name?: string; license?: string; private?: boolean; engines?: { node?: string }; scripts?: Record<string, string> } | null;
  const ciWorkflow = readRepoText(".github/workflows/ci.yml");
  const gitignore = readRepoText(".gitignore");
  const checks: DoctorCheck[] = [];

  checks.push(check(
    "node_runtime_version",
    nodeMajorVersion() >= 25 ? "pass" : "fail",
    nodeMajorVersion() >= 25 ? "info" : "error",
    `Current Node.js runtime is ${process.versions.node}.`,
    [`process.versions.node=${process.versions.node}`, "required=>=25"],
    "Run Ether with Node.js 25 or newer."
  ));
  checks.push(check(
    "package_metadata",
    packageJson?.license === "MIT" && packageJson.private === true && packageJson.engines?.node === ">=25" ? "pass" : "fail",
    packageJson?.license === "MIT" && packageJson.private === true && packageJson.engines?.node === ">=25" ? "info" : "error",
    "Package metadata preserves the current private MIT Node 25 baseline.",
    [
      `license=${packageJson?.license ?? "missing"}`,
      `private=${String(packageJson?.private ?? "missing")}`,
      `node_engine=${packageJson?.engines?.node ?? "missing"}`
    ],
    "Keep package.json license=MIT, private=true, and engines.node=>=25 unless the release policy changes."
  ));
  checks.push(check(
    "package_scripts",
    Boolean(packageJson?.scripts?.test && packageJson.scripts["test:all"] && packageJson.scripts.ether) ? "pass" : "fail",
    Boolean(packageJson?.scripts?.test && packageJson.scripts["test:all"] && packageJson.scripts.ether) ? "info" : "error",
    "Core verification and Ether scripts are present.",
    [
      `test=${packageJson?.scripts?.test ?? "missing"}`,
      `test_all=${packageJson?.scripts?.["test:all"] ?? "missing"}`,
      `ether=${packageJson?.scripts?.ether ?? "missing"}`
    ],
    "Restore npm scripts for test, test:all, and ether."
  ));
  checks.push(check(
    "ci_workflow_gate",
    ciWorkflow && ciGateNeedles().every((needle) => ciWorkflow.includes(needle)) ? "pass" : "fail",
    ciWorkflow ? "info" : "error",
    "GitHub Actions workflow covers local quality gates, dependency audits, platform smoke evidence, release evidence, and the Node 24 action-runtime baseline.",
    [
      `.github/workflows/ci.yml=${ciWorkflow ? "present" : "missing"}`,
      "required=node24 action runtime,npm ci,npm audit,cargo audit,npm test,cargo test --locked,cargo clippy --locked,cargo fmt,git diff --check,artifact guard,onboarding check,doctor,security audit,release evidence,ubuntu/macos platform smoke"
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
  return checks;
}

function ciGateNeedles(): string[] {
  return [
    "FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true",
    "actions/checkout@v5",
    "actions/setup-node@v5",
    "package-manager-cache: false",
    "npm ci --ignore-scripts",
    "npm audit --audit-level=high --json",
    "cargo install cargo-audit --locked --version 0.22.1",
    "cargo audit",
    "npm test",
    "cargo test --locked",
    "cargo clippy --all-targets --all-features --locked -- -D warnings",
    "cargo fmt --check",
    "git diff --check",
    "tools/forbidden-tracked-roots.txt",
    "npm run ether -- onboarding check --workspace .",
    "npm run ether -- doctor --workspace .",
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

function dependencyLockfileState(packageJson: { name?: string; license?: string; engines?: { node?: string } } | null): { ok: boolean; evidence: string[] } {
  const packageLock = readRepoJson("package-lock.json") as {
    lockfileVersion?: number;
    packages?: Record<string, { name?: string; license?: string; engines?: { node?: string }; dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> }>;
  } | null;
  const cargoLock = readRepoText("Cargo.lock");
  const rootPackage = packageLock?.packages?.[""];
  const rootDependencyCount = Object.keys(rootPackage?.dependencies ?? {}).length;
  const rootDevDependencyCount = Object.keys(rootPackage?.devDependencies ?? {}).length;
  const packageLockOk = packageLock?.lockfileVersion === 3
    && rootPackage?.name === packageJson?.name
    && rootPackage?.license === packageJson?.license
    && rootPackage?.engines?.node === packageJson?.engines?.node;
  const cargoLockOk = Boolean(cargoLock?.includes("version = 4") && cargoLock.includes('name = "aetherion-supervisor"'));
  return {
    ok: Boolean(packageLockOk && cargoLockOk),
    evidence: [
      `package_lock=${packageLock ? "present" : "missing"}`,
      `package_lock_version=${packageLock?.lockfileVersion ?? "missing"}`,
      `package_lock_root_name=${rootPackage?.name ?? "missing"}`,
      `package_name=${packageJson?.name ?? "missing"}`,
      `package_lock_root_license=${rootPackage?.license ?? "missing"}`,
      `package_license=${packageJson?.license ?? "missing"}`,
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

function nodeMajorVersion(): number {
  return Number(process.versions.node.split(".")[0] ?? "0");
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
  if (options.topic !== "plan" && options.topic !== "audit" && options.topic !== "bind-runtime" && options.topic !== "prepare-model-request" && options.topic !== "invoke-model" && options.topic !== "propose-tool-request") {
    throw new Error("prompt supports plan <run_id> --content <task>, audit <run_id> --content <task> --path <response-file>, bind-runtime <run_id> --content <task>, prepare-model-request <invocation_id>, invoke-model <request_id> --content <task>, and propose-tool-request <response_audit_id> --path <workspace-file> --content <intent>");
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
      dependencyLockfileState(readRepoJson("package.json") as { name?: string; license?: string; engines?: { node?: string } } | null).evidence
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
  const packageJson = readRepoJson("package.json") as { name?: string; license?: string; engines?: { node?: string } } | null;
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
        "Update .github/workflows/ci.yml to run npm ci, npm audit, cargo audit, onboarding check, doctor, security audit, release evidence, Node 24 JavaScript actions, and the platform smoke matrix."
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

async function printRunResult(result: Awaited<ReturnType<typeof runLocalKernelLoop>> | Awaited<ReturnType<typeof runSupervisorKernelLoop>>): Promise<void> {
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
  await printRunEvidence(result.workspace, result.runManifest);
}

function printHelp(): void {
  console.log(`Ether CLI

Usage:
  V1 core:
  npm run ether -- run --workspace <path> --input README.md --output .aetherion/SUMMARY.md --approve-write
  npm run ether -- run --supervisor stdio --workspace <path> --input README.md --output .aetherion/SUMMARY.md --approve-write
  npm run ether -- run --supervisor socket --socket-path <socket> --workspace <path> --input README.md --output .aetherion/SUMMARY.md --approve-write
  npm run ether -- replay <run_id> --workspace <path>
  npm run ether -- trace <run_id> --workspace <path>
  npm run ether -- boundary <run_id> --workspace <path>
  npm run ether -- supervisor status --workspace <path>
  npm run ether -- supervisor preflight --workspace <path>
  npm run ether -- supervisor status --workspace <path> --socket-path <socket> [--socket-auth-token <token>]
  npm run ether -- onboarding check --workspace <path>
  npm run ether -- doctor --workspace <path>
  npm run ether -- release evidence --workspace <path> [--remote-evidence <snapshot.json>]

  Trace-backed local runtime:
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
  npm run ether -- audit payload-refs --workspace <path>
  npm run ether -- audit response-audits --workspace <path>

Commands:
  run/replay/trace       Phase 1 local kernel loop and replay
  boundary               Read-only User Boundary card from Ledger and run manifest
  supervisor             Read-only Rust supervisor workspace status and lifecycle preflight
  onboarding             Read-only from-source onboarding preflight; no install, repair, daemon start, or workspace mutation
  doctor                 Read-only production readiness report for repo and workspace invariants
  release                Read-only local/configured plus optional operator-supplied remote release evidence; no packaging, signing, publishing, or live CI query
  import                 Phase 4 dry-run migration report
  memory/context/prompt  Source-backed Memory OS surfaces plus non-authorizing prompt plan/audit previews
  checkpoint/branch/rehearse Phase 5 sandbox and time-travel surfaces
  capsule                Governed document-only draft/test/local-publish/rollback lifecycle
  why/counterfactual     Phase 7 causal memory report surfaces
  sleep/wake/sleepers    Phase 8 local trigger evaluation and queue-only resume
  dream/anchors/persona/soul Phase 9 governed folding, persona branches, and Soul Fork
  agent                  Phase 10 governed document-read child run and evidence
  security               Phase 11 taint denial plus read-only security audit, poisoning detection, decoy trial, and fixture
  surface                Phase 12 contract surface: hash-only browser/IM ingress and queued outbox
  store                  Phase 12 contract surface: trusted-publisher signed Capsule declaration install, no code execution
  audit                  Read-only registry provenance, replay/memory parity, and Ledger payload-ref audits
  help                   Show this help

Options:
  --workspace <path>   Workspace root. Defaults to cwd.
  --input <path>       Workspace-relative file to read. Defaults to README.md.
  --output <path>      Workspace-relative file to write. Defaults to .aetherion/SUMMARY.md.
  --summary <text>     Explicit summary text to write; default output does not copy source content.
  --approve-write      Required to execute the write stage.
  --approve-sensitive  Explicitly approve sensitive fold, anchor, or history inheritance.
  --socket-path <path> Explicit foreground supervisor socket for supervisor status.
  --socket-auth-token <token> Caller-supplied token for an auth-gated supervisor socket.
  --remote-evidence <path>  Workspace-local CI/CodeQL snapshot for release evidence; read-only and never queried live.
  --check-wakeups    Preview sleeper wakeup eligibility without queueing or mutating registries.
  --print-output     Explicitly include raw model output in prompt invoke-model stdout.
`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
