import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { EventRecord } from "./ledger.ts";
import type { ReplayRecord } from "./replay.ts";
import { validateAgainstSchema } from "./schema.ts";

export type RegistryItem = Record<string, unknown> & {
  id: string;
};

export type RegistryProvenanceStatus = "strong" | "weak" | "missing" | "invalid";

export type RegistryEventReference = {
  path: string;
  event_id: string;
  exists: boolean;
};

export type RegistryArtifactReference = {
  path: string;
  artifact_ref: string;
  resolved_path: string | null;
  exists: boolean;
  item_id_matches: boolean | null;
};

export type RegistryProvenanceFinding = {
  registry: string;
  item_id: string;
  status: RegistryProvenanceStatus;
  reason?: string;
  event_ids: string[];
  missing_event_ids: string[];
  event_refs: RegistryEventReference[];
  artifact_refs: RegistryArtifactReference[];
};

export type RegistryProvenanceSummary = {
  registry_count: number;
  item_count: number;
  strong: number;
  weak: number;
  missing: number;
  invalid: number;
};

export type RegistryProvenanceAudit = {
  id: "registry_provenance_audit";
  generated_at: string;
  workspace_root: string;
  registry_dir: string;
  ledger_event_count: number;
  scope: {
    mode: "heuristic_reference_check";
    rebuild_parity_checked: false;
    strong_status_meaning: string;
  };
  summary: RegistryProvenanceSummary;
  registry_summaries: Array<RegistryProvenanceSummary & { registry: string }>;
  findings: RegistryProvenanceFinding[];
};

export type RegistryRebuildParityStatus =
  | "matched"
  | "missing_registry"
  | "mismatched"
  | "stale_registry"
  | "invalid_artifact"
  | "invalid_registry";

export type ReplayRegistryRebuildFinding = {
  registry: "replay-records";
  item_id: string;
  status: RegistryRebuildParityStatus;
  reason?: string;
  artifact_path?: string;
  expected?: ReplayRecord;
  actual?: RegistryItem;
};

export type ReplayRegistryRebuildAudit = {
  id: "replay_registry_rebuild_audit";
  generated_at: string;
  workspace_root: string;
  registry: "replay-records";
  source_artifact_dir: string;
  scope: {
    mode: "read_only_artifact_rebuild_parity";
    mutates_registry: false;
    rebuilds_from: ".aetherion/artifacts/replay/**/*.json";
  };
  summary: {
    expected: number;
    actual: number;
    matched: number;
    missing_registry: number;
    mismatched: number;
    stale_registry: number;
    invalid_artifact: number;
    invalid_registry: number;
  };
  expected_items: ReplayRecord[];
  findings: ReplayRegistryRebuildFinding[];
};

export type MemoryRegistryName = "memory-candidates" | "memory-cards" | "memory-tombstones";

export type MemoryRegistryRebuildFinding = {
  registry: MemoryRegistryName;
  item_id: string;
  status: RegistryRebuildParityStatus;
  reason?: string;
  event_id?: string;
  artifact_ref?: string;
  artifact_path?: string;
  expected?: RegistryItem;
  actual?: RegistryItem;
};

export type MemoryRegistryRebuildAudit = {
  id: "memory_registry_rebuild_audit";
  generated_at: string;
  workspace_root: string;
  registries: MemoryRegistryName[];
  scope: {
    mode: "read_only_ledger_artifact_rebuild_parity";
    mutates_registry: false;
    rebuilds_from: "memory lifecycle Ledger events plus payload_ref artifacts";
  };
  summary: {
    expected_memory_candidates: number;
    expected_memory_cards: number;
    expected_memory_tombstones: number;
    actual_memory_candidates: number;
    actual_memory_cards: number;
    actual_memory_tombstones: number;
    matched: number;
    missing_registry: number;
    mismatched: number;
    stale_registry: number;
    invalid_artifact: number;
    invalid_registry: number;
  };
  expected_memory_candidates: RegistryItem[];
  expected_memory_cards: RegistryItem[];
  expected_memory_tombstones: RegistryItem[];
  findings: MemoryRegistryRebuildFinding[];
};

export type CapsuleRegistryName = "capsules" | "capsule-drafts" | "capsule-versions";

export type CapsuleRegistryRebuildFinding = {
  registry: CapsuleRegistryName;
  item_id: string;
  status: RegistryRebuildParityStatus;
  reason?: string;
  event_id?: string;
  artifact_ref?: string;
  artifact_path?: string;
  expected?: RegistryItem;
  actual?: RegistryItem;
};

export type CapsuleRegistryRebuildAudit = {
  id: "capsule_registry_rebuild_audit";
  generated_at: string;
  workspace_root: string;
  registries: CapsuleRegistryName[];
  scope: {
    mode: "read_only_ledger_artifact_rebuild_parity";
    mutates_registry: false;
    rebuilds_from: "capsule lifecycle Ledger events plus payload_ref artifacts";
  };
  summary: {
    expected_capsules: number;
    expected_capsule_drafts: number;
    expected_capsule_versions: number;
    actual_capsules: number;
    actual_capsule_drafts: number;
    actual_capsule_versions: number;
    matched: number;
    missing_registry: number;
    mismatched: number;
    stale_registry: number;
    invalid_artifact: number;
    invalid_registry: number;
  };
  expected_capsules: RegistryItem[];
  expected_capsule_drafts: RegistryItem[];
  expected_capsule_versions: RegistryItem[];
  findings: CapsuleRegistryRebuildFinding[];
};

export type HibernationRegistryName = "hibernations" | "wakeups";

export type HibernationRegistryRebuildFinding = {
  registry: HibernationRegistryName;
  item_id: string;
  status: RegistryRebuildParityStatus;
  reason?: string;
  artifact_path?: string;
  expected?: RegistryItem;
  actual?: RegistryItem;
};

export type HibernationRegistryRebuildAudit = {
  id: "hibernation_registry_rebuild_audit";
  generated_at: string;
  workspace_root: string;
  registries: HibernationRegistryName[];
  source_artifact_dirs: {
    hibernations: string;
    wakeups: string;
  };
  scope: {
    mode: "read_only_artifact_rebuild_parity";
    mutates_registry: false;
    evaluates_triggers: false;
    queues_wakeups: false;
    rebuilds_from: ".aetherion/artifacts/sleep/**/*.json plus .aetherion/artifacts/wake/**/*.json";
  };
  summary: {
    expected_hibernations: number;
    expected_wakeups: number;
    actual_hibernations: number;
    actual_wakeups: number;
    matched: number;
    missing_registry: number;
    mismatched: number;
    stale_registry: number;
    invalid_artifact: number;
    invalid_registry: number;
  };
  expected_hibernations: RegistryItem[];
  expected_wakeups: RegistryItem[];
  findings: HibernationRegistryRebuildFinding[];
};

export type SandboxRegistryName = "checkpoints" | "branches" | "rehearsals" | "sandbox-approvals";

export type SandboxRegistryRebuildFinding = {
  registry: SandboxRegistryName;
  item_id: string;
  status: RegistryRebuildParityStatus;
  reason?: string;
  artifact_path?: string;
  expected?: RegistryItem;
  actual?: RegistryItem;
};

export type SandboxRegistryRebuildAudit = {
  id: "sandbox_registry_rebuild_audit";
  generated_at: string;
  workspace_root: string;
  registries: SandboxRegistryName[];
  source_artifact_dirs: {
    checkpoints: string;
    branches: string;
    rehearsals: string;
    sandbox_approvals: string;
  };
  scope: {
    mode: "read_only_artifact_rebuild_parity";
    mutates_registry: false;
    requests_supervisor_authority: false;
    promotes_rehearsals: false;
    rebuilds_from: ".aetherion/artifacts/checkpoint/**/*.json plus branch/rehearse/approve-rehearsal artifacts";
  };
  summary: {
    expected_checkpoints: number;
    expected_branches: number;
    expected_rehearsals: number;
    expected_sandbox_approvals: number;
    actual_checkpoints: number;
    actual_branches: number;
    actual_rehearsals: number;
    actual_sandbox_approvals: number;
    matched: number;
    missing_registry: number;
    mismatched: number;
    stale_registry: number;
    invalid_artifact: number;
    invalid_registry: number;
  };
  expected_checkpoints: RegistryItem[];
  expected_branches: RegistryItem[];
  expected_rehearsals: RegistryItem[];
  expected_sandbox_approvals: RegistryItem[];
  findings: SandboxRegistryRebuildFinding[];
};

export type LedgerPayloadRefStatus = "resolved" | "missing" | "invalid_json" | "unresolved";
export type LedgerPayloadRefSchemaStatus = "valid" | "invalid" | "not_checked";

export type LedgerPayloadRefFinding = {
  event_id: string;
  run_id: string;
  event_type: string;
  payload_ref: string;
  status: LedgerPayloadRefStatus;
  resolved_path: string | null;
  schema_name?: string;
  schema_status: LedgerPayloadRefSchemaStatus;
  schema_errors: string[];
  reason?: string;
};

export type LedgerPayloadRefAudit = {
  id: "ledger_payload_ref_audit";
  generated_at: string;
  workspace_root: string;
  ledger_event_count: number;
  scope: {
    mode: "read_only_ledger_payload_ref_resolution";
    mutates_ledger: false;
    mutates_artifacts: false;
    repair_attempted: false;
  };
  summary: {
    events_with_payload_ref: number;
    resolved: number;
    missing: number;
    invalid_json: number;
    unresolved: number;
    schema_valid: number;
    schema_invalid: number;
    schema_not_checked: number;
  };
  findings: LedgerPayloadRefFinding[];
};

export function registryPath(workspaceRoot: string, name: string): string {
  return join(workspaceRoot, ".aetherion", "registries", `${name}.json`);
}

export function readRegistry(workspaceRoot: string, name: string): RegistryItem[] {
  const path = registryPath(workspaceRoot, name);
  if (!existsSync(path)) {
    return [];
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Registry ${name} is not an array`);
  }
  return parsed.filter(isRegistryItem);
}

export function upsertRegistryItem(workspaceRoot: string, name: string, item: RegistryItem): RegistryItem[] {
  const items = readRegistry(workspaceRoot, name);
  const existingIndex = items.findIndex((entry) => entry.id === item.id);
  const next = existingIndex >= 0
    ? items.toSpliced(existingIndex, 1, item)
    : [...items, item];
  const path = registryPath(workspaceRoot, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export function upsertRegistryItems(workspaceRoot: string, name: string, items: RegistryItem[]): RegistryItem[] {
  let latest = readRegistry(workspaceRoot, name);
  for (const item of items) {
    const existingIndex = latest.findIndex((entry) => entry.id === item.id);
    latest = existingIndex >= 0
      ? latest.toSpliced(existingIndex, 1, item)
      : [...latest, item];
  }
  const path = registryPath(workspaceRoot, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(latest, null, 2)}\n`);
  return latest;
}

export function removeRegistryItem(workspaceRoot: string, name: string, id: string): RegistryItem[] {
  const next = readRegistry(workspaceRoot, name).filter((item) => item.id !== id);
  const path = registryPath(workspaceRoot, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export function isRegistryItem(value: unknown): value is RegistryItem {
  return value !== null && typeof value === "object" && !Array.isArray(value) && "id" in value && typeof value.id === "string";
}

export function auditRegistryProvenance(workspaceRoot: string, ledgerEvents: Iterable<EventRecord | string>): RegistryProvenanceAudit {
  const registryDir = join(workspaceRoot, ".aetherion", "registries");
  const ledgerEventIds = new Set(
    [...ledgerEvents]
      .map((event) => typeof event === "string" ? event : event.id)
      .filter((eventId) => eventId.length > 0)
  );
  const registryNames = existsSync(registryDir)
    ? readdirSync(registryDir)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => basename(fileName, ".json"))
      .sort()
    : [];
  const findings: RegistryProvenanceFinding[] = [];
  const registrySummaries: Array<RegistryProvenanceSummary & { registry: string }> = [];

  for (const registry of registryNames) {
    const auditedRegistry = readRegistryForAudit(workspaceRoot, registry);
    const registrySummary: RegistryProvenanceSummary & { registry: string } = {
      registry,
      registry_count: 1,
      item_count: auditedRegistry.itemCount,
      strong: 0,
      weak: 0,
      missing: 0,
      invalid: 0
    };

    for (const invalidFinding of auditedRegistry.invalidFindings) {
      registrySummary.invalid += 1;
      findings.push(invalidFinding);
    }

    for (const item of auditedRegistry.items) {
      const eventRefs = collectEventReferences(item).map((reference) => ({
        ...reference,
        exists: ledgerEventIds.has(reference.event_id)
      }));
      const eventIds = unique(eventRefs.map((reference) => reference.event_id));
      const missingEventIds = eventIds.filter((eventId) => !ledgerEventIds.has(eventId));
      const status: RegistryProvenanceStatus = eventIds.length === 0
        ? "missing"
        : missingEventIds.length > 0
          ? "weak"
          : "strong";

      registrySummary[status] += 1;
      findings.push({
        registry,
        item_id: item.id,
        status,
        event_ids: eventIds,
        missing_event_ids: missingEventIds,
        event_refs: eventRefs,
        artifact_refs: collectArtifactReferences(workspaceRoot, item.id, item)
      });
    }

    registrySummaries.push(registrySummary);
  }

  return {
    id: "registry_provenance_audit",
    generated_at: new Date().toISOString(),
    workspace_root: workspaceRoot,
    registry_dir: registryDir,
    ledger_event_count: ledgerEventIds.size,
    scope: {
      mode: "heuristic_reference_check",
      rebuild_parity_checked: false,
      strong_status_meaning: "all referenced Ledger event ids exist; this does not prove deterministic registry rebuild parity"
    },
    summary: registrySummaries.reduce<RegistryProvenanceSummary>((summary, registrySummary) => ({
      registry_count: summary.registry_count + registrySummary.registry_count,
      item_count: summary.item_count + registrySummary.item_count,
      strong: summary.strong + registrySummary.strong,
      weak: summary.weak + registrySummary.weak,
      missing: summary.missing + registrySummary.missing,
      invalid: summary.invalid + registrySummary.invalid
    }), { registry_count: 0, item_count: 0, strong: 0, weak: 0, missing: 0, invalid: 0 }),
    registry_summaries: registrySummaries,
    findings
  };
}

export function auditReplayRecordRegistryRebuild(workspaceRoot: string): ReplayRegistryRebuildAudit {
  const registry = "replay-records";
  const sourceArtifactDir = join(workspaceRoot, ".aetherion", "artifacts", "replay");
  const artifactRead = readReplayRecordArtifacts(sourceArtifactDir);
  const actualRead = readRegistryForAudit(workspaceRoot, registry);
  const expectedById = new Map(artifactRead.records.map((record) => [record.id, record]));
  const validActualItems: ReplayRecord[] = [];
  const findings: ReplayRegistryRebuildFinding[] = artifactRead.invalidFindings;

  for (const invalidFinding of actualRead.invalidFindings) {
    findings.push({
      registry,
      item_id: invalidFinding.item_id,
      status: "invalid_registry",
      reason: invalidFinding.reason
    });
  }

  for (const item of actualRead.items) {
    if (isReplayRecord(item)) {
      validActualItems.push(item);
      continue;
    }
    findings.push({
      registry,
      item_id: item.id,
      status: "invalid_registry",
      reason: "registry entry is not a valid Replay Record",
      actual: item
    });
  }

  const actualById = new Map(validActualItems.map((record) => [record.id, record]));
  for (const expected of artifactRead.records) {
    const actual = actualById.get(expected.id);
    if (!actual) {
      findings.push({
        registry,
        item_id: expected.id,
        status: "missing_registry",
        reason: "Replay Record artifact has no matching registry entry",
        expected
      });
      continue;
    }
    if (stableStringify(actual) === stableStringify(expected)) {
      findings.push({
        registry,
        item_id: expected.id,
        status: "matched",
        expected,
        actual
      });
      continue;
    }
    findings.push({
      registry,
      item_id: expected.id,
      status: "mismatched",
      reason: "Registry entry differs from Replay Record artifact",
      expected,
      actual
    });
  }

  for (const actual of validActualItems) {
    if (!expectedById.has(actual.id)) {
      findings.push({
        registry,
        item_id: actual.id,
        status: "stale_registry",
        reason: "Registry entry has no matching Replay Record artifact",
        actual
      });
    }
  }

  return {
    id: "replay_registry_rebuild_audit",
    generated_at: new Date().toISOString(),
    workspace_root: workspaceRoot,
    registry,
    source_artifact_dir: sourceArtifactDir,
    scope: {
      mode: "read_only_artifact_rebuild_parity",
      mutates_registry: false,
      rebuilds_from: ".aetherion/artifacts/replay/**/*.json"
    },
    summary: summarizeReplayRebuild(artifactRead.records.length, validActualItems.length, findings),
    expected_items: [...artifactRead.records].sort((left, right) => left.id.localeCompare(right.id)),
    findings: findings.sort((left, right) => `${left.status}:${left.item_id}`.localeCompare(`${right.status}:${right.item_id}`))
  };
}

export function auditMemoryRegistryRebuild(workspaceRoot: string, events: EventRecord[]): MemoryRegistryRebuildAudit {
  const expectedCandidates = new Map<string, RegistryItem>();
  const expectedCards = new Map<string, RegistryItem>();
  const expectedTombstones = new Map<string, RegistryItem>();
  const findings: MemoryRegistryRebuildFinding[] = [];

  for (const event of events) {
    if (!isMemoryLifecycleRebuildEvent(event.event_type)) {
      continue;
    }
    if (!event.payload_ref) {
      findings.push({
        registry: memoryRegistryForEvent(event.event_type),
        item_id: event.id,
        status: "invalid_artifact",
        event_id: event.id,
        reason: "memory lifecycle event has no payload_ref"
      });
      continue;
    }
    const resolved = resolveLocalArtifactReference(workspaceRoot, event.payload_ref);
    if (resolved.status === "unresolved" || !existsSync(resolved.path)) {
      findings.push({
        registry: memoryRegistryForEvent(event.event_type),
        item_id: event.id,
        status: "invalid_artifact",
        event_id: event.id,
        artifact_ref: event.payload_ref,
        artifact_path: resolved.status === "unresolved" ? undefined : resolved.path,
        reason: resolved.status === "unresolved" ? resolved.reason : "memory lifecycle artifact is missing"
      });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(resolved.path, "utf8")) as unknown;
    } catch {
      findings.push({
        registry: memoryRegistryForEvent(event.event_type),
        item_id: basename(resolved.path, ".json"),
        status: "invalid_artifact",
        event_id: event.id,
        artifact_ref: event.payload_ref,
        artifact_path: resolved.path,
        reason: "memory lifecycle artifact JSON could not be parsed"
      });
      continue;
    }

    if (event.event_type === "memory.candidate.created" && isMemoryCandidateRecord(parsed)) {
      expectedCandidates.set(parsed.id, parsed);
      continue;
    }
    if (event.event_type === "memory.rejected" && isMemoryCandidateRecord(parsed)) {
      expectedCandidates.set(parsed.id, parsed);
      continue;
    }
    if (event.event_type === "memory.accepted" && isMemoryCardRecord(parsed)) {
      const candidateId = parsed.id.replace(/^mem_/, "memcand_");
      const candidate = expectedCandidates.get(candidateId);
      if (candidate && isMemoryCandidateRecord(candidate)) {
        expectedCandidates.set(candidateId, { ...candidate, review: { ...candidate.review, status: "accepted" } });
      }
      expectedCards.set(parsed.id, parsed);
      continue;
    }
    if (event.event_type === "memory.blocked" && isMemoryCardRecord(parsed)) {
      expectedCards.set(parsed.id, parsed);
      continue;
    }
    if (event.event_type === "memory.deleted" && isMemoryTombstoneRecord(parsed)) {
      expectedCards.delete(parsed.target_memory_id);
      expectedTombstones.set(parsed.id, parsed);
      continue;
    }

    findings.push({
      registry: memoryRegistryForEvent(event.event_type),
      item_id: isRegistryItem(parsed) ? parsed.id : basename(resolved.path, ".json"),
      status: "invalid_artifact",
      event_id: event.id,
      artifact_ref: event.payload_ref,
      artifact_path: resolved.path,
      reason: `artifact is not valid for ${event.event_type}`
    });
  }

  const actualCandidates = readMemoryRegistryItems(workspaceRoot, "memory-candidates", isMemoryCandidateRecord, findings);
  const actualCards = readMemoryRegistryItems(workspaceRoot, "memory-cards", isMemoryCardRecord, findings);
  const actualTombstones = readMemoryRegistryItems(workspaceRoot, "memory-tombstones", isMemoryTombstoneRecord, findings);
  compareRegistryProjection("memory-candidates", expectedCandidates, actualCandidates, findings);
  compareRegistryProjection("memory-cards", expectedCards, actualCards, findings);
  compareRegistryProjection("memory-tombstones", expectedTombstones, actualTombstones, findings);

  const expectedMemoryCandidates = [...expectedCandidates.values()].sort((left, right) => left.id.localeCompare(right.id));
  const expectedMemoryCards = [...expectedCards.values()].sort((left, right) => left.id.localeCompare(right.id));
  const expectedMemoryTombstones = [...expectedTombstones.values()].sort((left, right) => left.id.localeCompare(right.id));
  return {
    id: "memory_registry_rebuild_audit",
    generated_at: new Date().toISOString(),
    workspace_root: workspaceRoot,
    registries: ["memory-candidates", "memory-cards", "memory-tombstones"],
    scope: {
      mode: "read_only_ledger_artifact_rebuild_parity",
      mutates_registry: false,
      rebuilds_from: "memory lifecycle Ledger events plus payload_ref artifacts"
    },
    summary: {
      expected_memory_candidates: expectedMemoryCandidates.length,
      expected_memory_cards: expectedMemoryCards.length,
      expected_memory_tombstones: expectedMemoryTombstones.length,
      actual_memory_candidates: actualCandidates.size,
      actual_memory_cards: actualCards.size,
      actual_memory_tombstones: actualTombstones.size,
      matched: findings.filter((finding) => finding.status === "matched").length,
      missing_registry: findings.filter((finding) => finding.status === "missing_registry").length,
      mismatched: findings.filter((finding) => finding.status === "mismatched").length,
      stale_registry: findings.filter((finding) => finding.status === "stale_registry").length,
      invalid_artifact: findings.filter((finding) => finding.status === "invalid_artifact").length,
      invalid_registry: findings.filter((finding) => finding.status === "invalid_registry").length
    },
    expected_memory_candidates: expectedMemoryCandidates,
    expected_memory_cards: expectedMemoryCards,
    expected_memory_tombstones: expectedMemoryTombstones,
    findings: findings.sort((left, right) => `${left.registry}:${left.status}:${left.item_id}`.localeCompare(`${right.registry}:${right.status}:${right.item_id}`))
  };
}

export function auditCapsuleRegistryRebuild(workspaceRoot: string, events: EventRecord[]): CapsuleRegistryRebuildAudit {
  const expectedCapsules = new Map<string, RegistryItem>();
  const expectedDrafts = new Map<string, RegistryItem>();
  const expectedVersions = new Map<string, RegistryItem>();
  const findings: CapsuleRegistryRebuildFinding[] = [];

  for (const event of events) {
    if (!isCapsuleLifecycleRebuildEvent(event.event_type)) {
      continue;
    }
    if (!event.payload_ref) {
      findings.push({
        registry: capsuleRegistryForEvent(event.event_type),
        item_id: event.id,
        status: "invalid_artifact",
        event_id: event.id,
        reason: "capsule lifecycle event has no payload_ref"
      });
      continue;
    }
    const artifact = readLifecycleArtifact(workspaceRoot, event, "capsule", findings);
    if (artifact.status === "invalid") {
      continue;
    }

    if ((event.event_type === "capsule.draft.recorded" || event.event_type === "capsule.test.recorded") && isCapsuleRecord(artifact.value)) {
      expectedDrafts.set(artifact.value.id, artifact.value);
      expectedVersions.set(capsuleVersionRegistryId(artifact.value), capsuleVersionRegistryItem(artifact.value));
      continue;
    }

    if (event.event_type === "capsule.publish.recorded" && isCapsuleRecord(artifact.value)) {
      expectedCapsules.set(artifact.value.id, artifact.value);
      expectedDrafts.delete(artifact.value.id);
      expectedVersions.set(capsuleVersionRegistryId(artifact.value), capsuleVersionRegistryItem(artifact.value));
      continue;
    }

    if (event.event_type === "capsule.rollback.recorded" && isCapsuleRollbackArtifact(artifact.value)) {
      expectedCapsules.set(artifact.value.active.id, artifact.value.active);
      expectedDrafts.delete(artifact.value.active.id);
      expectedVersions.set(capsuleVersionRegistryId(artifact.value.active), capsuleVersionRegistryItem(artifact.value.active));
      expectedVersions.set(capsuleVersionRegistryId(artifact.value.deprecated), capsuleVersionRegistryItem(artifact.value.deprecated));
      continue;
    }

    findings.push({
      registry: capsuleRegistryForEvent(event.event_type),
      item_id: isRegistryItem(artifact.value) ? artifact.value.id : basename(artifact.path, ".json"),
      status: "invalid_artifact",
      event_id: event.id,
      artifact_ref: event.payload_ref,
      artifact_path: artifact.path,
      reason: `artifact is not valid for ${event.event_type}`
    });
  }

  const actualCapsules = readCapsuleRegistryItems(workspaceRoot, "capsules", isCapsuleRecord, findings);
  const actualDrafts = readCapsuleRegistryItems(workspaceRoot, "capsule-drafts", isCapsuleRecord, findings);
  const actualVersions = readCapsuleRegistryItems(workspaceRoot, "capsule-versions", isCapsuleVersionRegistryRecord, findings);
  compareCapsuleRegistryProjection("capsules", expectedCapsules, actualCapsules, findings);
  compareCapsuleRegistryProjection("capsule-drafts", expectedDrafts, actualDrafts, findings);
  compareCapsuleRegistryProjection("capsule-versions", expectedVersions, actualVersions, findings);

  const sortedCapsules = [...expectedCapsules.values()].sort((left, right) => left.id.localeCompare(right.id));
  const sortedDrafts = [...expectedDrafts.values()].sort((left, right) => left.id.localeCompare(right.id));
  const sortedVersions = [...expectedVersions.values()].sort((left, right) => left.id.localeCompare(right.id));
  return {
    id: "capsule_registry_rebuild_audit",
    generated_at: new Date().toISOString(),
    workspace_root: workspaceRoot,
    registries: ["capsules", "capsule-drafts", "capsule-versions"],
    scope: {
      mode: "read_only_ledger_artifact_rebuild_parity",
      mutates_registry: false,
      rebuilds_from: "capsule lifecycle Ledger events plus payload_ref artifacts"
    },
    summary: {
      expected_capsules: sortedCapsules.length,
      expected_capsule_drafts: sortedDrafts.length,
      expected_capsule_versions: sortedVersions.length,
      actual_capsules: actualCapsules.size,
      actual_capsule_drafts: actualDrafts.size,
      actual_capsule_versions: actualVersions.size,
      matched: findings.filter((finding) => finding.status === "matched").length,
      missing_registry: findings.filter((finding) => finding.status === "missing_registry").length,
      mismatched: findings.filter((finding) => finding.status === "mismatched").length,
      stale_registry: findings.filter((finding) => finding.status === "stale_registry").length,
      invalid_artifact: findings.filter((finding) => finding.status === "invalid_artifact").length,
      invalid_registry: findings.filter((finding) => finding.status === "invalid_registry").length
    },
    expected_capsules: sortedCapsules,
    expected_capsule_drafts: sortedDrafts,
    expected_capsule_versions: sortedVersions,
    findings: findings.sort((left, right) => `${left.registry}:${left.status}:${left.item_id}`.localeCompare(`${right.registry}:${right.status}:${right.item_id}`))
  };
}

export function auditHibernationRegistryRebuild(workspaceRoot: string): HibernationRegistryRebuildAudit {
  const hibernationArtifactDir = join(workspaceRoot, ".aetherion", "artifacts", "sleep");
  const wakeupArtifactDir = join(workspaceRoot, ".aetherion", "artifacts", "wake");
  const expectedHibernations = readHibernationArtifacts(hibernationArtifactDir, "hibernations", isHibernationRecord);
  const expectedWakeups = readHibernationArtifacts(wakeupArtifactDir, "wakeups", isWakeupRecord);
  const findings: HibernationRegistryRebuildFinding[] = [
    ...expectedHibernations.invalidFindings,
    ...expectedWakeups.invalidFindings
  ];

  const actualHibernations = readHibernationRegistryItems(workspaceRoot, "hibernations", isHibernationRecord, findings);
  const actualWakeups = readHibernationRegistryItems(workspaceRoot, "wakeups", isWakeupRecord, findings);
  const expectedHibernationMap = new Map(expectedHibernations.records.map((record) => [record.id, record]));
  const expectedWakeupMap = new Map(expectedWakeups.records.map((record) => [record.id, record]));
  compareHibernationRegistryProjection("hibernations", expectedHibernationMap, actualHibernations, findings);
  compareHibernationRegistryProjection("wakeups", expectedWakeupMap, actualWakeups, findings);

  const sortedHibernations = [...expectedHibernationMap.values()].sort((left, right) => left.id.localeCompare(right.id));
  const sortedWakeups = [...expectedWakeupMap.values()].sort((left, right) => left.id.localeCompare(right.id));
  return {
    id: "hibernation_registry_rebuild_audit",
    generated_at: new Date().toISOString(),
    workspace_root: workspaceRoot,
    registries: ["hibernations", "wakeups"],
    source_artifact_dirs: {
      hibernations: hibernationArtifactDir,
      wakeups: wakeupArtifactDir
    },
    scope: {
      mode: "read_only_artifact_rebuild_parity",
      mutates_registry: false,
      evaluates_triggers: false,
      queues_wakeups: false,
      rebuilds_from: ".aetherion/artifacts/sleep/**/*.json plus .aetherion/artifacts/wake/**/*.json"
    },
    summary: {
      expected_hibernations: sortedHibernations.length,
      expected_wakeups: sortedWakeups.length,
      actual_hibernations: actualHibernations.size,
      actual_wakeups: actualWakeups.size,
      matched: findings.filter((finding) => finding.status === "matched").length,
      missing_registry: findings.filter((finding) => finding.status === "missing_registry").length,
      mismatched: findings.filter((finding) => finding.status === "mismatched").length,
      stale_registry: findings.filter((finding) => finding.status === "stale_registry").length,
      invalid_artifact: findings.filter((finding) => finding.status === "invalid_artifact").length,
      invalid_registry: findings.filter((finding) => finding.status === "invalid_registry").length
    },
    expected_hibernations: sortedHibernations,
    expected_wakeups: sortedWakeups,
    findings: findings.sort((left, right) => `${left.registry}:${left.status}:${left.item_id}`.localeCompare(`${right.registry}:${right.status}:${right.item_id}`))
  };
}

export function auditSandboxRegistryRebuild(workspaceRoot: string): SandboxRegistryRebuildAudit {
  const checkpointArtifactDir = join(workspaceRoot, ".aetherion", "artifacts", "checkpoint");
  const branchArtifactDir = join(workspaceRoot, ".aetherion", "artifacts", "branch");
  const rehearsalArtifactDir = join(workspaceRoot, ".aetherion", "artifacts", "rehearse");
  const approvalArtifactDir = join(workspaceRoot, ".aetherion", "artifacts", "approve-rehearsal");
  const expectedCheckpoints = readSandboxArtifacts(checkpointArtifactDir, "checkpoints", isCheckpointRecord);
  const expectedBranches = readSandboxArtifacts(branchArtifactDir, "branches", isBranchRecord);
  const expectedRehearsals = readSandboxArtifacts(rehearsalArtifactDir, "rehearsals", isRehearsalRecord);
  const expectedApprovals = readSandboxArtifacts(approvalArtifactDir, "sandbox-approvals", isSandboxApprovalRecord);
  const findings: SandboxRegistryRebuildFinding[] = [
    ...expectedCheckpoints.invalidFindings,
    ...expectedBranches.invalidFindings,
    ...expectedRehearsals.invalidFindings,
    ...expectedApprovals.invalidFindings
  ];

  const expectedCheckpointMap = new Map(expectedCheckpoints.records.map((record) => [record.id, record]));
  const expectedBranchMap = new Map(expectedBranches.records.map((record) => [record.id, record]));
  for (const approval of expectedApprovals.records) {
    const branchId = typeof approval.branch_id === "string" ? approval.branch_id : "";
    const branch = expectedBranchMap.get(branchId);
    if (!branch) {
      findings.push({
        registry: "branches",
        item_id: branchId || approval.id,
        status: "invalid_artifact",
        reason: `sandbox approval ${approval.id} references a branch without an artifact-backed branch record`,
        expected: approval
      });
      continue;
    }
    if (approval.status === "approved") {
      expectedBranchMap.set(branch.id, { ...branch, status: "approved" });
    }
  }
  const expectedRehearsalMap = new Map(expectedRehearsals.records.map((record) => [record.id, record]));
  const expectedApprovalMap = new Map(expectedApprovals.records.map((record) => [record.id, record]));

  const actualCheckpoints = readSandboxRegistryItems(workspaceRoot, "checkpoints", isCheckpointRecord, findings);
  const actualBranches = readSandboxRegistryItems(workspaceRoot, "branches", isBranchRecord, findings);
  const actualRehearsals = readSandboxRegistryItems(workspaceRoot, "rehearsals", isRehearsalRecord, findings);
  const actualApprovals = readSandboxRegistryItems(workspaceRoot, "sandbox-approvals", isSandboxApprovalRecord, findings);
  compareSandboxRegistryProjection("checkpoints", expectedCheckpointMap, actualCheckpoints, findings);
  compareSandboxRegistryProjection("branches", expectedBranchMap, actualBranches, findings);
  compareSandboxRegistryProjection("rehearsals", expectedRehearsalMap, actualRehearsals, findings);
  compareSandboxRegistryProjection("sandbox-approvals", expectedApprovalMap, actualApprovals, findings);

  const sortedCheckpoints = [...expectedCheckpointMap.values()].sort((left, right) => left.id.localeCompare(right.id));
  const sortedBranches = [...expectedBranchMap.values()].sort((left, right) => left.id.localeCompare(right.id));
  const sortedRehearsals = [...expectedRehearsalMap.values()].sort((left, right) => left.id.localeCompare(right.id));
  const sortedApprovals = [...expectedApprovalMap.values()].sort((left, right) => left.id.localeCompare(right.id));
  return {
    id: "sandbox_registry_rebuild_audit",
    generated_at: new Date().toISOString(),
    workspace_root: workspaceRoot,
    registries: ["checkpoints", "branches", "rehearsals", "sandbox-approvals"],
    source_artifact_dirs: {
      checkpoints: checkpointArtifactDir,
      branches: branchArtifactDir,
      rehearsals: rehearsalArtifactDir,
      sandbox_approvals: approvalArtifactDir
    },
    scope: {
      mode: "read_only_artifact_rebuild_parity",
      mutates_registry: false,
      requests_supervisor_authority: false,
      promotes_rehearsals: false,
      rebuilds_from: ".aetherion/artifacts/checkpoint/**/*.json plus branch/rehearse/approve-rehearsal artifacts"
    },
    summary: {
      expected_checkpoints: sortedCheckpoints.length,
      expected_branches: sortedBranches.length,
      expected_rehearsals: sortedRehearsals.length,
      expected_sandbox_approvals: sortedApprovals.length,
      actual_checkpoints: actualCheckpoints.size,
      actual_branches: actualBranches.size,
      actual_rehearsals: actualRehearsals.size,
      actual_sandbox_approvals: actualApprovals.size,
      matched: findings.filter((finding) => finding.status === "matched").length,
      missing_registry: findings.filter((finding) => finding.status === "missing_registry").length,
      mismatched: findings.filter((finding) => finding.status === "mismatched").length,
      stale_registry: findings.filter((finding) => finding.status === "stale_registry").length,
      invalid_artifact: findings.filter((finding) => finding.status === "invalid_artifact").length,
      invalid_registry: findings.filter((finding) => finding.status === "invalid_registry").length
    },
    expected_checkpoints: sortedCheckpoints,
    expected_branches: sortedBranches,
    expected_rehearsals: sortedRehearsals,
    expected_sandbox_approvals: sortedApprovals,
    findings: findings.sort((left, right) => `${left.registry}:${left.status}:${left.item_id}`.localeCompare(`${right.registry}:${right.status}:${right.item_id}`))
  };
}

export async function auditLedgerPayloadRefs(repoRoot: string, workspaceRoot: string, events: EventRecord[]): Promise<LedgerPayloadRefAudit> {
  const findings: LedgerPayloadRefFinding[] = [];

  for (const event of events) {
    if (!event.payload_ref) {
      continue;
    }
    const resolved = resolveLocalArtifactReference(workspaceRoot, event.payload_ref);
    if (resolved.status === "unresolved") {
      findings.push({
        event_id: event.id,
        run_id: event.run_id,
        event_type: event.event_type,
        payload_ref: event.payload_ref,
        status: "unresolved",
        resolved_path: null,
        schema_status: "not_checked",
        schema_errors: [],
        reason: resolved.reason
      });
      continue;
    }
    if (!existsSync(resolved.path)) {
      findings.push({
        event_id: event.id,
        run_id: event.run_id,
        event_type: event.event_type,
        payload_ref: event.payload_ref,
        status: "missing",
        resolved_path: resolved.path,
        schema_status: "not_checked",
        schema_errors: [],
        reason: "resolved local artifact path does not exist"
      });
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(resolved.path, "utf8")) as unknown;
    } catch {
      findings.push({
        event_id: event.id,
        run_id: event.run_id,
        event_type: event.event_type,
        payload_ref: event.payload_ref,
        status: "invalid_json",
        resolved_path: resolved.path,
        schema_name: schemaNameForArtifactReference(event.payload_ref, event.event_type),
        schema_status: "not_checked",
        schema_errors: [],
        reason: "resolved artifact exists but JSON could not be parsed"
      });
      continue;
    }

    const schemaName = schemaNameForArtifactReference(event.payload_ref, event.event_type);
    const validation = schemaName ? await validateAgainstSchema(repoRoot, schemaName, parsed) : null;
    findings.push({
      event_id: event.id,
      run_id: event.run_id,
      event_type: event.event_type,
      payload_ref: event.payload_ref,
      status: "resolved",
      resolved_path: resolved.path,
      schema_name: schemaName,
      schema_status: validation ? (validation.valid ? "valid" : "invalid") : "not_checked",
      schema_errors: validation?.errors ?? []
    });
  }

  return {
    id: "ledger_payload_ref_audit",
    generated_at: new Date().toISOString(),
    workspace_root: workspaceRoot,
    ledger_event_count: events.length,
    scope: {
      mode: "read_only_ledger_payload_ref_resolution",
      mutates_ledger: false,
      mutates_artifacts: false,
      repair_attempted: false
    },
    summary: {
      events_with_payload_ref: findings.length,
      resolved: findings.filter((finding) => finding.status === "resolved").length,
      missing: findings.filter((finding) => finding.status === "missing").length,
      invalid_json: findings.filter((finding) => finding.status === "invalid_json").length,
      unresolved: findings.filter((finding) => finding.status === "unresolved").length,
      schema_valid: findings.filter((finding) => finding.schema_status === "valid").length,
      schema_invalid: findings.filter((finding) => finding.schema_status === "invalid").length,
      schema_not_checked: findings.filter((finding) => finding.schema_status === "not_checked").length
    },
    findings
  };
}

function readRegistryForAudit(workspaceRoot: string, registry: string): {
  itemCount: number;
  items: RegistryItem[];
  invalidFindings: RegistryProvenanceFinding[];
} {
  const path = registryPath(workspaceRoot, registry);
  if (!existsSync(path)) {
    return {
      itemCount: 0,
      items: [],
      invalidFindings: []
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return {
      itemCount: 1,
      items: [],
      invalidFindings: [invalidRegistryFinding(registry, "invalid_registry_json", "registry JSON could not be parsed")]
    };
  }
  if (!Array.isArray(parsed)) {
    return {
      itemCount: 1,
      items: [],
      invalidFindings: [invalidRegistryFinding(registry, "invalid_registry_shape", "registry JSON is not an array")]
    };
  }
  const items: RegistryItem[] = [];
  const invalidFindings: RegistryProvenanceFinding[] = [];
  for (const [index, entry] of parsed.entries()) {
    if (isRegistryItem(entry)) {
      items.push(entry);
    } else {
      invalidFindings.push(invalidRegistryFinding(registry, `invalid_entry_${index}`, "registry entry is not an object with a string id"));
    }
  }
  return {
    itemCount: parsed.length,
    items,
    invalidFindings
  };
}

function readReplayRecordArtifacts(root: string): {
  records: ReplayRecord[];
  invalidFindings: ReplayRegistryRebuildFinding[];
} {
  if (!existsSync(root)) {
    return { records: [], invalidFindings: [] };
  }
  const records: ReplayRecord[] = [];
  const invalidFindings: ReplayRegistryRebuildFinding[] = [];
  for (const path of jsonFiles(root)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    } catch {
      invalidFindings.push({
        registry: "replay-records",
        item_id: basename(path, ".json"),
        status: "invalid_artifact",
        reason: "Replay Record artifact JSON could not be parsed",
        artifact_path: path
      });
      continue;
    }
    if (!isReplayRecord(parsed)) {
      invalidFindings.push({
        registry: "replay-records",
        item_id: isRegistryItem(parsed) ? parsed.id : basename(path, ".json"),
        status: "invalid_artifact",
        reason: "Artifact is not a valid Replay Record",
        artifact_path: path
      });
      continue;
    }
    records.push(parsed);
  }
  return { records, invalidFindings };
}

function readHibernationArtifacts(
  root: string,
  registry: HibernationRegistryName,
  isValid: (value: unknown) => value is RegistryItem
): { records: RegistryItem[]; invalidFindings: HibernationRegistryRebuildFinding[] } {
  if (!existsSync(root)) {
    return { records: [], invalidFindings: [] };
  }
  const records: RegistryItem[] = [];
  const invalidFindings: HibernationRegistryRebuildFinding[] = [];
  for (const path of jsonFiles(root)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    } catch {
      invalidFindings.push({
        registry,
        item_id: basename(path, ".json"),
        status: "invalid_artifact",
        reason: `${registry} artifact JSON could not be parsed`,
        artifact_path: path
      });
      continue;
    }
    if (!isValid(parsed)) {
      invalidFindings.push({
        registry,
        item_id: isRegistryItem(parsed) ? parsed.id : basename(path, ".json"),
        status: "invalid_artifact",
        reason: `artifact is not a valid ${registry} record`,
        artifact_path: path
      });
      continue;
    }
    records.push(parsed);
  }
  return { records, invalidFindings };
}

function readSandboxArtifacts(
  root: string,
  registry: SandboxRegistryName,
  isValid: (value: unknown) => value is RegistryItem
): { records: RegistryItem[]; invalidFindings: SandboxRegistryRebuildFinding[] } {
  if (!existsSync(root)) {
    return { records: [], invalidFindings: [] };
  }
  const records: RegistryItem[] = [];
  const invalidFindings: SandboxRegistryRebuildFinding[] = [];
  for (const path of jsonFiles(root)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    } catch {
      invalidFindings.push({
        registry,
        item_id: basename(path, ".json"),
        status: "invalid_artifact",
        reason: `${registry} artifact JSON could not be parsed`,
        artifact_path: path
      });
      continue;
    }
    if (!isValid(parsed)) {
      invalidFindings.push({
        registry,
        item_id: isRegistryItem(parsed) ? parsed.id : basename(path, ".json"),
        status: "invalid_artifact",
        reason: `artifact is not a valid ${registry} record`,
        artifact_path: path
      });
      continue;
    }
    records.push(parsed);
  }
  return { records, invalidFindings };
}

function jsonFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return jsonFiles(path);
    }
    return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
  }).sort();
}

function isReplayRecord(value: unknown): value is ReplayRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const liveSideEffects = record.live_side_effects;
  const result = record.result;
  return hasOnlyKeys(record, ["artifact_ref", "id", "live_side_effects", "mode", "result", "run_id", "source_events"])
    && typeof record.id === "string"
    && record.id.startsWith("replay_")
    && typeof record.run_id === "string"
    && (record.mode === "trace" || record.mode === "simulation" || record.mode === "live")
    && Array.isArray(record.source_events)
    && record.source_events.length > 0
    && record.source_events.every((eventId) => typeof eventId === "string")
    && (record.artifact_ref === undefined || typeof record.artifact_ref === "string")
    && !!liveSideEffects
    && typeof liveSideEffects === "object"
    && !Array.isArray(liveSideEffects)
    && hasOnlyKeys(liveSideEffects as Record<string, unknown>, ["allowed", "approval_id"])
    && typeof (liveSideEffects as Record<string, unknown>).allowed === "boolean"
    && (
      (liveSideEffects as Record<string, unknown>).approval_id === null
      || typeof (liveSideEffects as Record<string, unknown>).approval_id === "string"
      || (liveSideEffects as Record<string, unknown>).approval_id === undefined
    )
    && !!result
    && typeof result === "object"
    && !Array.isArray(result)
    && hasOnlyKeys(result as Record<string, unknown>, ["status", "summary"])
    && ((result as Record<string, unknown>).status === "passed" || (result as Record<string, unknown>).status === "failed" || (result as Record<string, unknown>).status === "partial")
    && typeof (result as Record<string, unknown>).summary === "string";
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function summarizeReplayRebuild(expected: number, actual: number, findings: ReplayRegistryRebuildFinding[]): ReplayRegistryRebuildAudit["summary"] {
  return {
    expected,
    actual,
    matched: findings.filter((finding) => finding.status === "matched").length,
    missing_registry: findings.filter((finding) => finding.status === "missing_registry").length,
    mismatched: findings.filter((finding) => finding.status === "mismatched").length,
    stale_registry: findings.filter((finding) => finding.status === "stale_registry").length,
    invalid_artifact: findings.filter((finding) => finding.status === "invalid_artifact").length,
    invalid_registry: findings.filter((finding) => finding.status === "invalid_registry").length
  };
}

function isMemoryLifecycleRebuildEvent(eventType: string): eventType is "memory.candidate.created" | "memory.accepted" | "memory.rejected" | "memory.blocked" | "memory.deleted" {
  return eventType === "memory.candidate.created"
    || eventType === "memory.accepted"
    || eventType === "memory.rejected"
    || eventType === "memory.blocked"
    || eventType === "memory.deleted";
}

function isCapsuleLifecycleRebuildEvent(eventType: string): eventType is "capsule.draft.recorded" | "capsule.test.recorded" | "capsule.publish.recorded" | "capsule.rollback.recorded" {
  return eventType === "capsule.draft.recorded"
    || eventType === "capsule.test.recorded"
    || eventType === "capsule.publish.recorded"
    || eventType === "capsule.rollback.recorded";
}

function memoryRegistryForEvent(eventType: "memory.candidate.created" | "memory.accepted" | "memory.rejected" | "memory.blocked" | "memory.deleted"): MemoryRegistryName {
  if (eventType === "memory.candidate.created" || eventType === "memory.rejected") {
    return "memory-candidates";
  }
  return eventType === "memory.deleted" ? "memory-tombstones" : "memory-cards";
}

function capsuleRegistryForEvent(eventType: "capsule.draft.recorded" | "capsule.test.recorded" | "capsule.publish.recorded" | "capsule.rollback.recorded"): CapsuleRegistryName {
  if (eventType === "capsule.draft.recorded" || eventType === "capsule.test.recorded") {
    return "capsule-drafts";
  }
  return "capsules";
}

function readLifecycleArtifact(
  workspaceRoot: string,
  event: EventRecord,
  lifecycleName: "capsule",
  findings: CapsuleRegistryRebuildFinding[]
): { status: "valid"; value: unknown; path: string } | { status: "invalid" } {
  const registry = capsuleRegistryForEvent(event.event_type as "capsule.draft.recorded" | "capsule.test.recorded" | "capsule.publish.recorded" | "capsule.rollback.recorded");
  if (!event.payload_ref) {
    findings.push({
      registry,
      item_id: event.id,
      status: "invalid_artifact",
      event_id: event.id,
      reason: `${lifecycleName} lifecycle event has no payload_ref`
    });
    return { status: "invalid" };
  }
  const resolved = resolveLocalArtifactReference(workspaceRoot, event.payload_ref);
  if (resolved.status === "unresolved" || !existsSync(resolved.path)) {
    findings.push({
      registry,
      item_id: event.id,
      status: "invalid_artifact",
      event_id: event.id,
      artifact_ref: event.payload_ref,
      artifact_path: resolved.status === "unresolved" ? undefined : resolved.path,
      reason: resolved.status === "unresolved" ? resolved.reason : `${lifecycleName} lifecycle artifact is missing`
    });
    return { status: "invalid" };
  }
  try {
    return {
      status: "valid",
      value: JSON.parse(readFileSync(resolved.path, "utf8")) as unknown,
      path: resolved.path
    };
  } catch {
    findings.push({
      registry,
      item_id: basename(resolved.path, ".json"),
      status: "invalid_artifact",
      event_id: event.id,
      artifact_ref: event.payload_ref,
      artifact_path: resolved.path,
      reason: `${lifecycleName} lifecycle artifact JSON could not be parsed`
    });
    return { status: "invalid" };
  }
}

function readMemoryRegistryItems(
  workspaceRoot: string,
  registry: MemoryRegistryName,
  isValid: (value: unknown) => value is RegistryItem,
  findings: MemoryRegistryRebuildFinding[]
): Map<string, RegistryItem> {
  const auditedRegistry = readRegistryForAudit(workspaceRoot, registry);
  for (const invalidFinding of auditedRegistry.invalidFindings) {
    findings.push({
      registry,
      item_id: invalidFinding.item_id,
      status: "invalid_registry",
      reason: invalidFinding.reason
    });
  }

  const valid = new Map<string, RegistryItem>();
  for (const item of auditedRegistry.items) {
    if (isValid(item)) {
      valid.set(item.id, item);
      continue;
    }
    findings.push({
      registry,
      item_id: item.id,
      status: "invalid_registry",
      reason: `registry entry is not a valid ${registry} record`,
      actual: item
    });
  }
  return valid;
}

function readCapsuleRegistryItems(
  workspaceRoot: string,
  registry: CapsuleRegistryName,
  isValid: (value: unknown) => value is RegistryItem,
  findings: CapsuleRegistryRebuildFinding[]
): Map<string, RegistryItem> {
  const auditedRegistry = readRegistryForAudit(workspaceRoot, registry);
  for (const invalidFinding of auditedRegistry.invalidFindings) {
    findings.push({
      registry,
      item_id: invalidFinding.item_id,
      status: "invalid_registry",
      reason: invalidFinding.reason
    });
  }

  const valid = new Map<string, RegistryItem>();
  for (const item of auditedRegistry.items) {
    if (isValid(item)) {
      valid.set(item.id, item);
      continue;
    }
    findings.push({
      registry,
      item_id: item.id,
      status: "invalid_registry",
      reason: `registry entry is not a valid ${registry} record`,
      actual: item
    });
  }
  return valid;
}

function readHibernationRegistryItems(
  workspaceRoot: string,
  registry: HibernationRegistryName,
  isValid: (value: unknown) => value is RegistryItem,
  findings: HibernationRegistryRebuildFinding[]
): Map<string, RegistryItem> {
  const auditedRegistry = readRegistryForAudit(workspaceRoot, registry);
  for (const invalidFinding of auditedRegistry.invalidFindings) {
    findings.push({
      registry,
      item_id: invalidFinding.item_id,
      status: "invalid_registry",
      reason: invalidFinding.reason
    });
  }

  const valid = new Map<string, RegistryItem>();
  for (const item of auditedRegistry.items) {
    if (isValid(item)) {
      valid.set(item.id, item);
      continue;
    }
    findings.push({
      registry,
      item_id: item.id,
      status: "invalid_registry",
      reason: `registry entry is not a valid ${registry} record`,
      actual: item
    });
  }
  return valid;
}

function readSandboxRegistryItems(
  workspaceRoot: string,
  registry: SandboxRegistryName,
  isValid: (value: unknown) => value is RegistryItem,
  findings: SandboxRegistryRebuildFinding[]
): Map<string, RegistryItem> {
  const auditedRegistry = readRegistryForAudit(workspaceRoot, registry);
  for (const invalidFinding of auditedRegistry.invalidFindings) {
    findings.push({
      registry,
      item_id: invalidFinding.item_id,
      status: "invalid_registry",
      reason: invalidFinding.reason
    });
  }

  const valid = new Map<string, RegistryItem>();
  for (const item of auditedRegistry.items) {
    if (isValid(item)) {
      valid.set(item.id, item);
      continue;
    }
    findings.push({
      registry,
      item_id: item.id,
      status: "invalid_registry",
      reason: `registry entry is not a valid ${registry} record`,
      actual: item
    });
  }
  return valid;
}

function compareRegistryProjection(
  registry: MemoryRegistryName,
  expected: Map<string, RegistryItem>,
  actual: Map<string, RegistryItem>,
  findings: MemoryRegistryRebuildFinding[]
): void {
  for (const [itemId, expectedItem] of expected.entries()) {
    const actualItem = actual.get(itemId);
    if (!actualItem) {
      findings.push({
        registry,
        item_id: itemId,
        status: "missing_registry",
        reason: `${registry} artifact-backed expected item has no registry entry`,
        expected: expectedItem
      });
      continue;
    }
    if (stableStringify(actualItem) === stableStringify(expectedItem)) {
      findings.push({
        registry,
        item_id: itemId,
        status: "matched",
        expected: expectedItem,
        actual: actualItem
      });
      continue;
    }
    findings.push({
      registry,
      item_id: itemId,
      status: "mismatched",
      reason: `${registry} registry entry differs from Ledger artifact rebuild`,
      expected: expectedItem,
      actual: actualItem
    });
  }

  for (const [itemId, actualItem] of actual.entries()) {
    if (!expected.has(itemId)) {
      findings.push({
        registry,
        item_id: itemId,
        status: "stale_registry",
        reason: `${registry} registry entry has no active Ledger artifact rebuild source`,
        actual: actualItem
      });
    }
  }
}

function compareSandboxRegistryProjection(
  registry: SandboxRegistryName,
  expected: Map<string, RegistryItem>,
  actual: Map<string, RegistryItem>,
  findings: SandboxRegistryRebuildFinding[]
): void {
  for (const [itemId, expectedItem] of expected.entries()) {
    const actualItem = actual.get(itemId);
    if (!actualItem) {
      findings.push({
        registry,
        item_id: itemId,
        status: "missing_registry",
        reason: `${registry} artifact-backed expected item has no registry entry`,
        expected: expectedItem
      });
      continue;
    }
    if (stableStringify(actualItem) === stableStringify(expectedItem)) {
      findings.push({
        registry,
        item_id: itemId,
        status: "matched",
        expected: expectedItem,
        actual: actualItem
      });
      continue;
    }
    findings.push({
      registry,
      item_id: itemId,
      status: "mismatched",
      reason: `${registry} registry entry differs from artifact rebuild`,
      expected: expectedItem,
      actual: actualItem
    });
  }

  for (const [itemId, actualItem] of actual.entries()) {
    if (!expected.has(itemId)) {
      findings.push({
        registry,
        item_id: itemId,
        status: "stale_registry",
        reason: `${registry} registry entry has no artifact rebuild source`,
        actual: actualItem
      });
    }
  }
}

function compareHibernationRegistryProjection(
  registry: HibernationRegistryName,
  expected: Map<string, RegistryItem>,
  actual: Map<string, RegistryItem>,
  findings: HibernationRegistryRebuildFinding[]
): void {
  for (const [itemId, expectedItem] of expected.entries()) {
    const actualItem = actual.get(itemId);
    if (!actualItem) {
      findings.push({
        registry,
        item_id: itemId,
        status: "missing_registry",
        reason: `${registry} artifact-backed expected item has no registry entry`,
        expected: expectedItem
      });
      continue;
    }
    if (stableStringify(actualItem) === stableStringify(expectedItem)) {
      findings.push({
        registry,
        item_id: itemId,
        status: "matched",
        expected: expectedItem,
        actual: actualItem
      });
      continue;
    }
    findings.push({
      registry,
      item_id: itemId,
      status: "mismatched",
      reason: `${registry} registry entry differs from artifact rebuild`,
      expected: expectedItem,
      actual: actualItem
    });
  }

  for (const [itemId, actualItem] of actual.entries()) {
    if (!expected.has(itemId)) {
      findings.push({
        registry,
        item_id: itemId,
        status: "stale_registry",
        reason: `${registry} registry entry has no artifact rebuild source`,
        actual: actualItem
      });
    }
  }
}

function compareCapsuleRegistryProjection(
  registry: CapsuleRegistryName,
  expected: Map<string, RegistryItem>,
  actual: Map<string, RegistryItem>,
  findings: CapsuleRegistryRebuildFinding[]
): void {
  for (const [itemId, expectedItem] of expected.entries()) {
    const actualItem = actual.get(itemId);
    if (!actualItem) {
      findings.push({
        registry,
        item_id: itemId,
        status: "missing_registry",
        reason: `${registry} artifact-backed expected item has no registry entry`,
        expected: expectedItem
      });
      continue;
    }
    if (stableStringify(actualItem) === stableStringify(expectedItem)) {
      findings.push({
        registry,
        item_id: itemId,
        status: "matched",
        expected: expectedItem,
        actual: actualItem
      });
      continue;
    }
    findings.push({
      registry,
      item_id: itemId,
      status: "mismatched",
      reason: `${registry} registry entry differs from Ledger artifact rebuild`,
      expected: expectedItem,
      actual: actualItem
    });
  }

  for (const [itemId, actualItem] of actual.entries()) {
    if (!expected.has(itemId)) {
      findings.push({
        registry,
        item_id: itemId,
        status: "stale_registry",
        reason: `${registry} registry entry has no active Ledger artifact rebuild source`,
        actual: actualItem
      });
    }
  }
}

function isMemoryCardRecord(value: unknown): value is RegistryItem {
  if (!isRegistryItem(value)) {
    return false;
  }
  return typeof value.type === "string"
    && typeof value.subject === "string"
    && typeof value.content === "string"
    && Array.isArray(value.source_events)
    && value.source_events.length > 0
    && value.source_events.every((eventId) => typeof eventId === "string")
    && typeof value.confidence === "number"
    && typeof value.sensitivity === "string"
    && (value.blocked_contexts === undefined || (Array.isArray(value.blocked_contexts) && value.blocked_contexts.every((context) => typeof context === "string")));
}

function isMemoryCandidateRecord(value: unknown): value is RegistryItem & { review: { status: string } } {
  if (!isRegistryItem(value)) {
    return false;
  }
  return Array.isArray(value.source_events)
    && value.source_events.length > 0
    && value.source_events.every((eventId) => typeof eventId === "string")
    && isObjectRecord(value.candidate)
    && isObjectRecord(value.review)
    && typeof value.review.status === "string";
}

function isMemoryTombstoneRecord(value: unknown): value is RegistryItem & { target_memory_id: string } {
  if (!isRegistryItem(value)) {
    return false;
  }
  return value.event_type === "memory.deleted"
    && typeof value.target_memory_id === "string"
    && Array.isArray(value.source_events)
    && value.source_events.length > 0
    && value.source_events.every((eventId) => typeof eventId === "string")
    && typeof value.reason === "string"
    && typeof value.created_at === "string"
    && value.active_memory_removed === true
    && value.history_rewritten === false
    && typeof value.redaction_status === "string";
}

function isCapsuleRecord(value: unknown): value is RegistryItem {
  if (!isRegistryItem(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.version === "string"
    && typeof record.description === "string"
    && typeof record.playbook === "string"
    && typeof record.execution_mode === "string"
    && typeof record.lifecycle === "string"
    && record.sandbox_required === true
    && record.permissions_inherited === false
    && isObjectRecord(record.permission_requirements)
    && Array.isArray(record.replay_tests)
    && isObjectRecord(record.approval)
    && isObjectRecord(record.provenance)
    && isObjectRecord(record.scoring_summary);
}

function isCapsuleVersionRegistryRecord(value: unknown): value is RegistryItem {
  return isRegistryItem(value)
    && "capsule" in value
    && isCapsuleRecord((value as Record<string, unknown>).capsule);
}

function isCapsuleRollbackArtifact(value: unknown): value is { active: RegistryItem; deprecated: RegistryItem } {
  return isObjectRecord(value)
    && isCapsuleRecord(value.active)
    && isCapsuleRecord(value.deprecated);
}

function isHibernationRecord(value: unknown): value is RegistryItem {
  return isRegistryItem(value)
    && typeof value.run_id === "string"
    && ["sleeping", "queued", "completed", "expired"].includes(String(value.status))
    && typeof value.created_at === "string"
    && (typeof value.expires_at === "string" || value.expires_at === null)
    && value.active_leases_retained === false
    && typeof value.minimal_context_pack_id === "string"
    && isObjectRecord(value.ledger_cursor)
    && typeof value.ledger_cursor.event_id === "string"
    && typeof value.ledger_cursor.event_hash === "string"
    && value.ledger_cursor.event_hash.startsWith("sha256:")
    && Number.isInteger(value.ledger_cursor.event_count)
    && typeof value.resume_summary === "string"
    && Array.isArray(value.trigger_ids)
    && value.trigger_ids.length > 0
    && value.trigger_ids.every((triggerId) => typeof triggerId === "string")
    && isObjectRecord(value.attention_budget)
    && Number.isInteger(value.attention_budget.max_wakeups)
    && Number.isInteger(value.attention_budget.used_wakeups)
    && value.max_auto_risk === "L2";
}

function isWakeupRecord(value: unknown): value is RegistryItem {
  return isRegistryItem(value)
    && typeof value.hibernation_id === "string"
    && ["manual", "file", "deadline"].includes(String(value.source))
    && ["scheduled", "eligible", "queued", "discarded", "expired"].includes(String(value.status))
    && typeof value.created_at === "string"
    && (typeof value.expires_at === "string" || value.expires_at === null)
    && isObjectRecord(value.condition)
    && (typeof value.condition.deadline_at === "string" || value.condition.deadline_at === null)
    && (typeof value.condition.file_path === "string" || value.condition.file_path === null)
    && (typeof value.condition.baseline_sha256 === "string" || value.condition.baseline_sha256 === null)
    && (typeof value.observed_at === "string" || value.observed_at === null)
    && value.policy_recheck_required === true
    && (typeof value.fresh_policy_decision_id === "string" || value.fresh_policy_decision_id === null)
    && (typeof value.resume_run_id === "string" || value.resume_run_id === null)
    && value.auto_execute_allowed === false
    && typeof value.reason === "string";
}

function isCheckpointRecord(value: unknown): value is RegistryItem {
  return isRegistryItem(value)
    && value.id.startsWith("checkpoint_")
    && typeof value.run_id === "string"
    && typeof value.event_id === "string"
    && (typeof value.event_hash === "string" || value.event_hash === undefined)
    && typeof value.created_at === "string"
    && (value.replay_mode === "trace" || value.replay_mode === "simulation")
    && value.active_leases_reusable === false;
}

function isBranchRecord(value: unknown): value is RegistryItem {
  return isRegistryItem(value)
    && value.id.startsWith("branch_")
    && typeof value.checkpoint_id === "string"
    && (typeof value.source_event_id === "string" || value.source_event_id === undefined)
    && (typeof value.source_event_hash === "string" || value.source_event_hash === undefined)
    && (typeof value.head_event_id === "string" || value.head_event_id === undefined)
    && (typeof value.head_event_hash === "string" || value.head_event_hash === undefined)
    && typeof value.created_at === "string"
    && value.inherits_authority === false
    && ["sandbox", "approved", "discarded"].includes(String(value.status));
}

function isRehearsalRecord(value: unknown): value is RegistryItem {
  return isRegistryItem(value)
    && value.id.startsWith("rehearsal_")
    && typeof value.branch_id === "string"
    && ["diff", "draft", "plan", "simulation"].includes(String(value.mode))
    && value.real_workspace_mutated === false
    && typeof value.result === "string"
    && (typeof value.approval_required === "boolean" || value.approval_required === undefined)
    && (value.operation === "file.write" || value.operation === undefined)
    && (typeof value.target_path === "string" || value.target_path === undefined)
    && (typeof value.sandbox_path === "string" || value.sandbox_path === undefined)
    && (typeof value.original_sha256 === "string" || value.original_sha256 === undefined)
    && (typeof value.proposed_sha256 === "string" || value.proposed_sha256 === undefined);
}

function isSandboxApprovalRecord(value: unknown): value is RegistryItem {
  return isRegistryItem(value)
    && value.id.startsWith("sandbox_approval_")
    && typeof value.rehearsal_id === "string"
    && typeof value.branch_id === "string"
    && value.fresh_policy_evaluated === true
    && value.inherited_authority === false
    && typeof value.policy_event_id === "string"
    && typeof value.live_action_event_id === "string"
    && (value.status === "approved" || value.status === "denied")
    && (typeof value.promotion_run_id === "string" || value.promotion_run_id === undefined)
    && (typeof value.target_path === "string" || value.target_path === undefined)
    && (typeof value.new_lease_id === "string" || value.new_lease_id === undefined)
    && (typeof value.real_side_effect_executed === "boolean" || value.real_side_effect_executed === undefined)
    && (value.verification_status === "passed" || value.verification_status === "failed" || value.verification_status === undefined);
}

function capsuleVersionRegistryId(capsule: RegistryItem): string {
  return `capver_${sanitizeRegistryId(capsule.id)}_${sanitizeRegistryId(String(capsule.version))}`;
}

function capsuleVersionRegistryItem(capsule: RegistryItem): RegistryItem {
  return {
    id: capsuleVersionRegistryId(capsule),
    capsule
  };
}

function sanitizeRegistryId(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 120) || "artifact";
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function invalidRegistryFinding(registry: string, itemId: string, reason: string): RegistryProvenanceFinding {
  return {
    registry,
    item_id: itemId,
    status: "invalid",
    reason,
    event_ids: [],
    missing_event_ids: [],
    event_refs: [],
    artifact_refs: []
  };
}

const eventArrayFields = new Set([
  "affected_events",
  "event_ids",
  "inherited_history_refs",
  "redacted_source_events",
  "source_event_ids",
  "source_events"
]);

const eventStringFields = new Set([
  "event_id",
  "from_event",
  "source_event",
  "to_event"
]);

function collectEventReferences(value: unknown, path = "$"): Array<Omit<RegistryEventReference, "exists">> {
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => collectEventReferences(child, `${path}[${index}]`));
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  const references: Array<Omit<RegistryEventReference, "exists">> = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    if (isEventArrayField(key) && Array.isArray(child)) {
      references.push(...child
        .map((eventId, index) => ({ eventId, index }))
        .filter((entry): entry is { eventId: string; index: number } => typeof entry.eventId === "string" && entry.eventId.length > 0)
        .map((entry) => ({ path: `${childPath}[${entry.index}]`, event_id: entry.eventId })));
    }
    if (isEventStringField(key) && typeof child === "string" && child.length > 0) {
      references.push({ path: childPath, event_id: child });
    }
    references.push(...collectEventReferences(child, childPath));
  }

  return uniqueReferences(references);
}

function collectArtifactReferences(workspaceRoot: string, itemId: string, value: unknown, path = "$"): RegistryArtifactReference[] {
  if (Array.isArray(value)) {
    return uniqueArtifactReferences(value.flatMap((child, index) => collectArtifactReferences(workspaceRoot, itemId, child, `${path}[${index}]`)));
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  const references: RegistryArtifactReference[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    if ((key === "artifact_ref" || key === "payload_ref") && typeof child === "string" && child.length > 0) {
      references.push(resolveArtifactReference(workspaceRoot, itemId, childPath, child));
    }
    references.push(...collectArtifactReferences(workspaceRoot, itemId, child, childPath));
  }
  return uniqueArtifactReferences(references);
}

function resolveArtifactReference(workspaceRoot: string, itemId: string, path: string, artifactRef: string): RegistryArtifactReference {
  const artifactPath = conventionalArtifactPath(workspaceRoot, artifactRef);
  if (!artifactPath || !existsSync(artifactPath)) {
    return {
      path,
      artifact_ref: artifactRef,
      resolved_path: artifactPath,
      exists: false,
      item_id_matches: null
    };
  }
  return {
    path,
    artifact_ref: artifactRef,
    resolved_path: artifactPath,
    exists: true,
    item_id_matches: artifactContainsItemId(artifactPath, itemId)
  };
}

function conventionalArtifactPath(workspaceRoot: string, artifactRef: string): string | null {
  const resolved = resolveLocalArtifactReference(workspaceRoot, artifactRef);
  return resolved.status === "unresolved" ? null : resolved.path;
}

function resolveLocalArtifactReference(workspaceRoot: string, artifactRef: string): { status: "resolvable"; path: string } | { status: "unresolved"; reason: string } {
  if (!artifactRef.startsWith("artifact://")) {
    return { status: "unresolved", reason: "payload_ref does not use artifact:// local artifact scheme" };
  }
  const parts = artifactRef.slice("artifact://".length).split("/").filter(Boolean);
  if (parts.length < 3) {
    return { status: "unresolved", reason: "artifact reference does not include command/topic/id segments" };
  }
  if (parts.some((part) => part === "." || part === ".." || part.includes("\\"))) {
    return { status: "unresolved", reason: "artifact reference contains an unsafe path segment" };
  }

  const artifactsRoot = resolve(workspaceRoot, ".aetherion", "artifacts");
  let path: string;
  if (parts[0] === "boundary" && parts.length === 3 && parts[2] === "facts") {
    path = resolve(artifactsRoot, "boundary", parts[1], `boundary_${parts[1]}_facts.json`);
  } else if (parts[0] === "consent" && parts.length === 3 && parts[2] === "write") {
    path = resolve(artifactsRoot, "consent", parts[1], `consent_${parts[1]}_write.json`);
  } else if (parts[0] === "replay" && parts.length === 3 && parts[2] === "trace") {
    path = resolve(artifactsRoot, "replay", parts[1], `replay_${parts[1]}_trace.json`);
  } else if (parts[0] === "agent" && parts.length === 3 && parts[1] === "runtime") {
    path = resolve(artifactsRoot, "agent", "runtime", `${parts[2]}.json`);
  } else {
    path = resolve(artifactsRoot, ...parts.slice(0, -1), `${parts.at(-1)}.json`);
  }

  if (path !== artifactsRoot && !path.startsWith(`${artifactsRoot}/`)) {
    return { status: "unresolved", reason: "artifact reference resolves outside the local artifact root" };
  }
  return { status: "resolvable", path };
}

function schemaNameForArtifactReference(artifactRef: string, eventType?: string): string | undefined {
  if (!artifactRef.startsWith("artifact://")) {
    return undefined;
  }
  const parts = artifactRef.slice("artifact://".length).split("/").filter(Boolean);
  if (parts[0] === "boundary" && parts.length === 3 && parts[2] === "facts") {
    return "boundary-facts.schema.json";
  }
  if (parts[0] === "consent" && parts.length === 3 && parts[2] === "write") {
    return "consent-record.schema.json";
  }
  if (parts[0] === "replay" && parts.length === 3 && parts[2] === "trace") {
    return "replay-record.schema.json";
  }
  if (parts[0] === "capsule" && parts.length === 3 && ["draft", "test", "publish"].includes(parts[1])) {
    return "capability-capsule.schema.json";
  }
  if (parts[0] === "capsule" && parts.length === 3 && parts[1] === "rollback" && eventType === "capsule.rollback.recorded") {
    return "capsule-rollback.schema.json";
  }
  if (parts[0] === "dream" && parts.length === 3 && ["run", "accept", "reject"].includes(parts[1]) && eventType?.startsWith("memory.fold.")) {
    return "memory-fold.schema.json";
  }
  if (parts[0] === "anchors" && parts.length === 3 && ["propose", "accept", "reject"].includes(parts[1]) && eventType?.startsWith("persona.anchor.")) {
    return "persona-anchor.schema.json";
  }
  if (parts[0] === "persona" && parts.length === 3 && parts[1] === "reset" && eventType === "persona.reset.applied") {
    return "persona-reset.schema.json";
  }
  if (parts[0] === "soul" && parts.length === 3 && parts[1] === "fork" && eventType === "soul.fork.created") {
    return "soul-fork.schema.json";
  }
  if (parts[0] === "agent" && parts.length === 3 && parts[1] === "contract" && (eventType === "agent.contract.created" || eventType === "agent.child.started")) {
    return "agent-contract.schema.json";
  }
  if (parts[0] === "agent" && parts.length === 3 && parts[1] === "runtime" && eventType === "agent.runtime.bound") {
    return "agent-runtime-invocation.schema.json";
  }
  if (parts[0] === "agent" && parts.length === 3 && parts[1] === "model-request" && eventType === "agent.model.requested") {
    return "agent-model-request.schema.json";
  }
  if (parts[0] === "agent" && parts.length === 3 && parts[1] === "model-response" && eventType === "agent.model.responded") {
    return "agent-model-response.schema.json";
  }
  if (parts[0] === "agent" && parts.length === 3 && parts[1] === "response-audit" && eventType === "agent.response.audit.recorded") {
    return "agent-response-audit.schema.json";
  }
  if (parts[0] === "agent" && parts.length === 3 && parts[1] === "execute" && eventType === "agent.child.completed") {
    return "child-result.schema.json";
  }
  if (parts[0] === "agent" && parts.length === 3 && parts[1] === "execute" && parts[2].startsWith("account_") && eventType === "agent.child.policy_denied") {
    return "budget-account.schema.json";
  }
  if (parts[0] === "agent" && parts.length === 3 && parts[1] === "execute" && parts[2].startsWith("breaker_") && eventType === "circuit.opened") {
    return "circuit-breaker.schema.json";
  }
  if (parts[0] === "memory" && parts.length === 3) {
    if (parts[1] === "candidates" || parts[1] === "reject") {
      return "memory-candidate.schema.json";
    }
    if (parts[1] === "accept" || parts[1] === "block") {
      return "memory-card.schema.json";
    }
    if (parts[1] === "delete") {
      return "memory-tombstone.schema.json";
    }
  }
  if (parts[0] === "security" && parts.length === 3) {
    if (parts[1] === "scan" && eventType === "security.content.assessed") {
      return "content-assessment.schema.json";
    }
    if ((parts[1] === "scan" && eventType === "poisoning.detected") || (parts[1] === "ack" && eventType === "poisoning.acknowledged")) {
      return "poisoning-signal.schema.json";
    }
    if (parts[1] === "trial" && eventType === "honeypot.trial.completed") {
      return "honeypot-trial.schema.json";
    }
    if (parts[1] === "fixture" && eventType === "poisoning.regression.created") {
      return "poisoning-regression-fixture.schema.json";
    }
  }
  if (parts[0] === "surface" && parts.length === 3) {
    if (parts[1] === "browser-observe" && eventType === "browser.observation.ingested") {
      return "browser-observation.schema.json";
    }
    if (parts[1] === "im-inbox" && eventType === "im.inbox.received") {
      return "im-inbox-item.schema.json";
    }
    if (parts[1] === "im-outbox" && eventType === "im.outbox.queued") {
      return "im-outbox-item.schema.json";
    }
  }
  if (parts[0] === "store" && parts.length === 3 && parts[1] === "install" && eventType === "capsule.store.installed") {
    return "capsule-install.schema.json";
  }
  return undefined;
}

function artifactContainsItemId(path: string, itemId: string): boolean | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (isRegistryItem(parsed)) {
      return parsed.id === itemId;
    }
    if (Array.isArray(parsed)) {
      return parsed.some((entry) => isRegistryItem(entry) && entry.id === itemId);
    }
    return false;
  } catch {
    return null;
  }
}

function isEventArrayField(key: string): boolean {
  return eventArrayFields.has(key) || key.endsWith("_event_ids");
}

function isEventStringField(key: string): boolean {
  return eventStringFields.has(key) || key.endsWith("_event_id");
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueReferences(references: Array<Omit<RegistryEventReference, "exists">>): Array<Omit<RegistryEventReference, "exists">> {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = `${reference.path}\u0000${reference.event_id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqueArtifactReferences(references: RegistryArtifactReference[]): RegistryArtifactReference[] {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = `${reference.path}\u0000${reference.artifact_ref}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
