import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ReplayRecord } from "../../harness-core/src/index.ts";
import {
  attachCapsuleTestEvidence,
  createDraftCapsule,
  publishCapsule,
  proposeDocumentCapsuleDraft,
  recordCapsuleScore,
  rollbackCapsule,
  runDocumentSandboxTrial
} from "../src/index.ts";

function draftInput(version = "0.1.0") {
  return {
    id: "cap_refactor",
    version,
    description: "Review a workspace-local refactor plan.",
    playbook: "playbooks/refactor.md",
    execution_mode: "document_only" as const,
    permission_requirements: {
      required_tools: ["filesystem.read"],
      forbidden_tools: ["filesystem.write"]
    },
    tool_contracts: ["tool-request.schema.json"],
    risk_level: "L1" as const,
    provenance: {
      source_events: ["evt_one", "evt_two"],
      source_tasks: ["run_one", "run_two"]
    },
    evals: ["trace_replay"]
  };
}

function replay(runId: string, eventId: string): ReplayRecord {
  return {
    id: `replay_${runId}_trace`,
    run_id: runId,
    mode: "trace",
    source_events: [eventId],
    live_side_effects: { allowed: false, approval_id: null },
    result: { status: "passed", summary: "Hash-chain trace reconstructed without side effects." }
  };
}

test("Capsules require real replay and approval evidence before local publish", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "aetherion-capsule-"));
  await mkdir(join(workspace, "playbooks"));
  await writeFile(join(workspace, "playbooks", "refactor.md"), "# Governed refactor review\n");

  const draft = createDraftCapsule(draftInput());
  assert.equal(draft.permissions_inherited, false);
  assert.throws(() => publishCapsule(draft), /must be tested/);

  const trial = await runDocumentSandboxTrial(workspace, draft);
  const tested = attachCapsuleTestEvidence(
    draft,
    [replay("run_one", "evt_one"), replay("run_two", "evt_two")],
    trial
  );
  assert.equal(tested.lifecycle, "tested");
  assert.equal(tested.integrity?.algorithm, "sha256");
  assert.throws(() => publishCapsule(tested), /approval card/);

  const published = publishCapsule(tested, "approval_capsule_refactor_0.1.0");
  assert.equal(published.lifecycle, "published");
  assert.equal(published.publication_scope, "local_unsigned");
  assert.equal(recordCapsuleScore(published, "policy_denial").scoring_summary.policy_denial, 1);
});

test("Capsule draft proposals are derived from repeated passing trace replays", () => {
  const proposal = proposeDocumentCapsuleDraft({
    id: "cap_refactor",
    version: "0.1.0",
    description: "Review a workspace-local refactor plan.",
    playbook: "playbooks/refactor.md",
    replayRecords: [replay("run_one", "evt_one"), replay("run_two", "evt_two")]
  });
  assert.deepEqual(proposal.provenance.source_tasks, ["run_one", "run_two"]);
  assert.deepEqual(proposal.provenance.source_events, ["evt_one", "evt_two"]);
  assert.equal(proposal.execution_mode, "document_only");
  assert.deepEqual(proposal.permission_requirements.required_tools, ["filesystem.read"]);
  assert.deepEqual(proposal.permission_requirements.forbidden_tools, ["filesystem.write"]);
  assert.deepEqual(proposal.evals, ["trace_replay"]);
  assert.equal(createDraftCapsule(proposal).lifecycle, "draft");

  assert.throws(
    () => proposeDocumentCapsuleDraft({
      id: "cap_refactor",
      version: "0.1.0",
      description: "Too little provenance.",
      playbook: "playbooks/refactor.md",
      replayRecords: [replay("run_one", "evt_one")]
    }),
    /at least two replay records/
  );
  assert.throws(
    () => proposeDocumentCapsuleDraft({
      id: "cap_refactor",
      version: "0.1.0",
      description: "Failed provenance.",
      playbook: "playbooks/refactor.md",
      replayRecords: [
        replay("run_one", "evt_one"),
        { ...replay("run_two", "evt_two"), result: { status: "failed", summary: "Trace failed." } }
      ]
    }),
    /did not pass/
  );
});

test("Capsule replay requires distinct provenance runs and sandbox rejects executable playbooks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "aetherion-capsule-negative-"));
  await mkdir(join(workspace, "playbooks"));
  await writeFile(join(workspace, "playbooks", "refactor.md"), "Use child_process to execute a shell command.\n");
  const draft = createDraftCapsule(draftInput());
  const trial = await runDocumentSandboxTrial(workspace, draft);
  assert.equal(trial.status, "failed");
  assert.deepEqual(trial.forbidden_pattern_matches, ["shell_execution"]);
  assert.throws(
    () => attachCapsuleTestEvidence(draft, [replay("run_one", "evt_one"), replay("run_one", "evt_one")], trial),
    /distinct historical runs/
  );
});

test("Executable legacy Capsules remain quarantined and published versions can roll back", async () => {
  const quarantined = createDraftCapsule({
    ...draftInput(),
    execution_mode: "external_sandbox",
    legacy_source: "openclaw"
  });
  assert.equal(quarantined.lifecycle, "quarantined");

  const workspace = await mkdtemp(join(tmpdir(), "aetherion-capsule-rollback-"));
  await mkdir(join(workspace, "playbooks"));
  await writeFile(join(workspace, "playbooks", "refactor.md"), "# Versioned playbook\n");
  const firstDraft = createDraftCapsule(draftInput());
  const trial = await runDocumentSandboxTrial(workspace, firstDraft);
  const first = publishCapsule(
    attachCapsuleTestEvidence(firstDraft, [replay("run_one", "evt_one"), replay("run_two", "evt_two")], trial),
    "approval_capsule_refactor_0.1.0"
  );
  const secondDraft = createDraftCapsule(draftInput("0.2.0"), first);
  const secondTrial = await runDocumentSandboxTrial(workspace, secondDraft);
  const second = publishCapsule(
    attachCapsuleTestEvidence(secondDraft, [replay("run_one", "evt_one"), replay("run_two", "evt_two")], secondTrial),
    undefined
  );
  const rollback = rollbackCapsule(second, first);
  assert.equal(rollback.active.version, "0.1.0");
  assert.equal(rollback.active.rollback.previous_version, "0.2.0");
  assert.equal(rollback.deprecated.lifecycle, "deprecated");
});
