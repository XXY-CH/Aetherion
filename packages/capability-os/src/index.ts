import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import type { ReplayRecord } from "../../harness-core/src/index.ts";

export type PermissionDiff = {
  added_tools: string[];
  removed_tools: string[];
  requires_approval: boolean;
};

export type CapsuleReplayTest = {
  run_id: string;
  replay_record_id: string;
  status: "passed" | "failed" | "partial";
  source_events: string[];
};

export type CapsuleSandboxTrial = {
  status: "passed" | "failed";
  sandbox_path: string;
  content_sha256: string;
  forbidden_pattern_matches: string[];
};

export type Capsule = {
  id: string;
  version: string;
  description: string;
  playbook: string;
  execution_mode: "document_only" | "external_sandbox";
  permission_requirements: {
    required_tools: string[];
    forbidden_tools: string[];
  };
  tool_contracts: string[];
  risk_level: "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
  lifecycle: "draft" | "tested" | "published" | "deprecated" | "quarantined";
  sandbox_required: true;
  permissions_inherited: false;
  permission_diff: PermissionDiff;
  replay_tests: CapsuleReplayTest[];
  sandbox_trial: CapsuleSandboxTrial | null;
  approval: {
    required: boolean;
    status: "not_required" | "pending" | "approved";
    approval_card_id: string | null;
  };
  integrity: {
    algorithm: "sha256";
    digest: string;
  } | null;
  publication_scope: "not_published" | "local_unsigned";
  rollback: {
    previous_version: string | null;
  };
  provenance: {
    source_events: string[];
    source_tasks: string[];
  };
  legacy_source: string | null;
  evals: string[];
  scoring_summary: {
    success: number;
    correction: number;
    tool_error: number;
    policy_denial: number;
  };
};

export type CapsuleDraftInput = Pick<
  Capsule,
  "id" | "version" | "description" | "playbook" | "execution_mode" | "permission_requirements" | "tool_contracts" | "risk_level" | "provenance" | "evals"
> & {
  legacy_source?: string | null;
};

export type CapsuleDraftProposalInput = {
  id: string;
  version: string;
  description: string;
  playbook: string;
  replayRecords: ReplayRecord[];
};

const ALLOWED_DOCUMENT_EXTENSIONS = new Set([".md", ".txt", ".json", ".yaml", ".yml"]);
const FORBIDDEN_PATTERNS: Array<[string, RegExp]> = [
  ["shell_execution", /\b(exec|spawn|child_process|subprocess|os\.system)\b/i],
  ["network_access", /\b(fetch|curl|wget|http:\/\/|https:\/\/)\b/i],
  ["secret_access", /\b(vault|api[_ -]?key|password|secret|token)\b/i]
];

export function createDraftCapsule(input: CapsuleDraftInput, previous?: Capsule): Capsule {
  assertCapsuleIdentity(input.id, input.version);
  assertPermissionRequirements(input.permission_requirements);
  if (input.provenance.source_events.length === 0) {
    throw new Error("Capability Capsule draft must cite source events");
  }
  if (new Set(input.provenance.source_tasks).size < 2) {
    throw new Error("Capability Capsule draft requires at least two repeated source tasks");
  }
  if (input.execution_mode !== "document_only") {
    return {
      ...baseCapsule(input, previous),
      lifecycle: "quarantined",
      legacy_source: input.legacy_source ?? "external_executable",
      permission_diff: permissionDiff(previous, input.permission_requirements.required_tools)
    };
  }
  return {
    ...baseCapsule(input, previous),
    lifecycle: "draft",
    legacy_source: input.legacy_source ?? null,
    permission_diff: permissionDiff(previous, input.permission_requirements.required_tools)
  };
}

export function proposeDocumentCapsuleDraft(input: CapsuleDraftProposalInput): CapsuleDraftInput {
  if (input.replayRecords.length < 2) {
    throw new Error("Capability Capsule proposal requires at least two replay records");
  }
  if (new Set(input.replayRecords.map((record) => record.run_id)).size < 2) {
    throw new Error("Capability Capsule proposal requires two distinct historical runs");
  }
  const failedReplay = input.replayRecords.find((record) => record.result.status !== "passed");
  if (failedReplay) {
    throw new Error(`Replay record ${failedReplay.id} did not pass`);
  }
  const sourceEvents = [...new Set(input.replayRecords.flatMap((record) => record.source_events))];
  if (sourceEvents.length === 0) {
    throw new Error("Capability Capsule proposal requires replay records with source events");
  }
  const proposal: CapsuleDraftInput = {
    id: input.id,
    version: input.version,
    description: input.description,
    playbook: input.playbook,
    execution_mode: "document_only",
    permission_requirements: {
      required_tools: ["filesystem.read"],
      forbidden_tools: ["filesystem.write"]
    },
    tool_contracts: ["tool-request.schema.json", "policy-decision.schema.json"],
    risk_level: "L1",
    provenance: {
      source_events: sourceEvents,
      source_tasks: [...new Set(input.replayRecords.map((record) => record.run_id))]
    },
    legacy_source: null,
    evals: ["trace_replay"]
  };
  createDraftCapsule(proposal);
  return proposal;
}

export async function runDocumentSandboxTrial(workspaceRoot: string, capsule: Capsule): Promise<CapsuleSandboxTrial> {
  if (capsule.execution_mode !== "document_only") {
    throw new Error(`Capsule ${capsule.id} requires an external sandbox runner`);
  }
  const playbookPath = assertWorkspaceFile(workspaceRoot, capsule.playbook);
  const extension = extname(playbookPath).toLowerCase();
  if (!ALLOWED_DOCUMENT_EXTENSIONS.has(extension)) {
    throw new Error(`Document-only Capsule playbook extension ${extension || "(none)"} is not allowed`);
  }
  const contents = await readFile(playbookPath, "utf8");
  const matches = FORBIDDEN_PATTERNS
    .filter(([, pattern]) => pattern.test(contents))
    .map(([name]) => name);
  const sandboxRelative = join(
    ".aetherion",
    "capsules",
    "trials",
    sanitize(capsule.id),
    sanitize(capsule.version),
    `playbook${extension}`
  );
  const sandboxPath = resolve(workspaceRoot, sandboxRelative);
  await mkdir(resolve(sandboxPath, ".."), { recursive: true });
  await writeFile(sandboxPath, contents, "utf8");
  return {
    status: matches.length === 0 ? "passed" : "failed",
    sandbox_path: sandboxRelative,
    content_sha256: sha256(contents),
    forbidden_pattern_matches: matches
  };
}

export function attachCapsuleTestEvidence(
  capsule: Capsule,
  replayRecords: ReplayRecord[],
  sandboxTrial: CapsuleSandboxTrial
): Capsule {
  if (capsule.lifecycle !== "draft" && capsule.lifecycle !== "tested") {
    throw new Error(`Capsule ${capsule.id} cannot be tested from lifecycle ${capsule.lifecycle}`);
  }
  if (replayRecords.length < 2) {
    throw new Error("Capability Capsule test requires at least two historical replay records");
  }
  if (new Set(replayRecords.map((record) => record.run_id)).size < 2) {
    throw new Error("Capability Capsule test requires two distinct historical runs");
  }
  const expectedTrialPrefix = join(".aetherion", "capsules", "trials", sanitize(capsule.id), sanitize(capsule.version));
  if (!sandboxTrial.sandbox_path.startsWith(`${expectedTrialPrefix}/`) && !sandboxTrial.sandbox_path.startsWith(`${expectedTrialPrefix}\\`)) {
    throw new Error(`Sandbox trial is not bound to Capsule ${capsule.id}@${capsule.version}`);
  }
  const unrelatedRun = replayRecords.find((record) => !capsule.provenance.source_tasks.includes(record.run_id));
  if (unrelatedRun) {
    throw new Error(`Replay run ${unrelatedRun.run_id} is not cited by Capsule provenance`);
  }
  const replayTests = replayRecords.map((record) => ({
    run_id: record.run_id,
    replay_record_id: record.id,
    status: record.result.status,
    source_events: record.source_events
  }));
  const passed = replayTests.every((test) => test.status === "passed") && sandboxTrial.status === "passed";
  return {
    ...capsule,
    lifecycle: passed ? "tested" : "draft",
    replay_tests: replayTests,
    sandbox_trial: sandboxTrial,
    approval: {
      required: capsule.permission_diff.requires_approval,
      status: capsule.permission_diff.requires_approval ? "pending" : "not_required",
      approval_card_id: null
    },
    integrity: passed ? capsuleIntegrity(capsule, replayTests, sandboxTrial) : null
  };
}

export function publishCapsule(capsule: Capsule, approvalCardId?: string): Capsule {
  if (capsule.lifecycle !== "tested") {
    throw new Error(`Capsule ${capsule.id} must be tested before publish`);
  }
  if (!capsule.integrity || !capsule.sandbox_trial || capsule.sandbox_trial.status !== "passed") {
    throw new Error("Capsule publish requires integrity-bound sandbox trial evidence");
  }
  if (capsule.replay_tests.length < 2 || capsule.replay_tests.some((test) => test.status !== "passed")) {
    throw new Error("Capsule publish requires at least two passing replay tests");
  }
  if (capsule.permission_diff.requires_approval && !approvalCardId) {
    throw new Error("Permission expansion requires an approved approval card");
  }
  return {
    ...capsule,
    lifecycle: "published",
    publication_scope: "local_unsigned",
    approval: {
      required: capsule.permission_diff.requires_approval,
      status: capsule.permission_diff.requires_approval ? "approved" : "not_required",
      approval_card_id: approvalCardId ?? null
    }
  };
}

export function rollbackCapsule(current: Capsule, target: Capsule): { active: Capsule; deprecated: Capsule } {
  if (current.lifecycle !== "published") {
    throw new Error(`Capsule ${current.id} is not currently published`);
  }
  if (target.id !== current.id || target.lifecycle !== "published") {
    throw new Error("Rollback target must be a previously published version of the same Capsule");
  }
  return {
    active: {
      ...target,
      lifecycle: "published",
      rollback: { previous_version: current.version }
    },
    deprecated: {
      ...current,
      lifecycle: "deprecated"
    }
  };
}

export function recordCapsuleScore(capsule: Capsule, key: keyof Capsule["scoring_summary"]): Capsule {
  return {
    ...capsule,
    scoring_summary: {
      ...capsule.scoring_summary,
      [key]: capsule.scoring_summary[key] + 1
    }
  };
}

export function findCapsule(capsules: Capsule[], id: string): Capsule | undefined {
  return capsules.find((capsule) => capsule.id === id);
}

export function requireCapsule(capsules: Capsule[], id: string): Capsule {
  const capsule = findCapsule(capsules, id);
  if (!capsule) {
    throw new Error(`Capsule ${id} not found`);
  }
  return capsule;
}

export function isCapsule(value: unknown): value is Capsule {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.version === "string"
    && typeof value.lifecycle === "string"
    && isObject(value.permission_requirements)
    && isObject(value.permission_diff)
    && Array.isArray(value.replay_tests)
    && (value.sandbox_trial === null || isObject(value.sandbox_trial))
    && isObject(value.approval)
    && (value.integrity === null || isObject(value.integrity))
    && typeof value.publication_scope === "string"
    && isObject(value.provenance)
    && isObject(value.scoring_summary);
}

export function isPublishedCapsuleWithEvidence(capsule: Capsule): boolean {
  return capsule.lifecycle === "published"
    && capsule.publication_scope === "local_unsigned"
    && capsule.integrity !== null
    && capsule.sandbox_trial?.status === "passed"
    && capsule.replay_tests.length >= 2
    && capsule.replay_tests.every((test) => test.status === "passed")
    && (!capsule.permission_diff.requires_approval || capsule.approval.status === "approved");
}

function baseCapsule(input: CapsuleDraftInput, previous?: Capsule): Omit<Capsule, "lifecycle" | "legacy_source" | "permission_diff"> {
  return {
    ...input,
    sandbox_required: true,
    permissions_inherited: false,
    replay_tests: [],
    sandbox_trial: null,
    approval: {
      required: false,
      status: "not_required",
      approval_card_id: null
    },
    integrity: null,
    publication_scope: "not_published",
    rollback: {
      previous_version: previous?.version ?? null
    },
    scoring_summary: {
      success: 0,
      correction: 0,
      tool_error: 0,
      policy_denial: 0
    }
  };
}

function permissionDiff(previous: Capsule | undefined, requiredTools: string[]): PermissionDiff {
  const previousTools = previous?.permission_requirements.required_tools ?? [];
  const addedTools = requiredTools.filter((tool) => !previousTools.includes(tool));
  const removedTools = previousTools.filter((tool) => !requiredTools.includes(tool));
  return {
    added_tools: addedTools,
    removed_tools: removedTools,
    requires_approval: addedTools.length > 0
  };
}

function capsuleIntegrity(
  capsule: Capsule,
  replayTests: CapsuleReplayTest[],
  sandboxTrial: CapsuleSandboxTrial
): Capsule["integrity"] {
  const payload = JSON.stringify({
    id: capsule.id,
    version: capsule.version,
    permission_requirements: capsule.permission_requirements,
    provenance: capsule.provenance,
    replay_tests: replayTests,
    sandbox_trial: sandboxTrial
  });
  return { algorithm: "sha256", digest: sha256(payload) };
}

function assertPermissionRequirements(requirements: Capsule["permission_requirements"]): void {
  const required = new Set(requirements.required_tools);
  const overlap = requirements.forbidden_tools.find((tool) => required.has(tool));
  if (overlap) {
    throw new Error(`Tool ${overlap} cannot be both required and forbidden`);
  }
}

function assertWorkspaceFile(workspaceRoot: string, path: string): string {
  const root = resolve(workspaceRoot);
  const target = resolve(root, path);
  const relativePath = relative(root, target);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Capsule playbook must be a workspace-local file");
  }
  if (relativePath === ".aetherion" || relativePath.startsWith(`.aetherion/`)) {
    throw new Error("Capsule playbook cannot originate from Aetherion runtime state");
  }
  return target;
}

function assertCapsuleIdentity(id: string, version: string): void {
  if (!/^cap_[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error(`Invalid Capsule id ${id}`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Capsule version ${version} must use semantic version x.y.z`);
  }
}

function sha256(contents: string): string {
  return `sha256:${createHash("sha256").update(contents).digest("hex")}`;
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]+/g, "_");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
