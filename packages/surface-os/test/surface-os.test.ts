import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import {
  createBrowserObservation,
  createCapsuleInstallRecord,
  createTrustedStorePublisherRecord,
  createImInboxItem,
  createImOutboxItem,
  storeSignaturePayload,
  type StorePackage
} from "../src/index.ts";

test("browser observation is current-tab, hash-only, tainted, and non-authorizing", () => {
  const observation = createBrowserObservation({
    origin: "https://example.com/login",
    title: "Login",
    current_tab: true,
    dom_snapshot: "<input type=\"password\"><input type=\"hidden\" name=\"csrf\"><script>const apiKey='x'</script>",
    captured_at: "2026-06-07T12:00:00.000Z"
  }, "policy_browser_taint", ["evt_source"]);

  assert.equal(observation.current_tab_only, true);
  assert.equal(observation.raw_dom_persisted, false);
  assert.match(observation.dom_sha256, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(observation.taint, { sources: ["public_web"], can_authorize_actions: false });
  assert.equal(observation.can_create_side_effects, false);
  assert.equal(observation.redactions.password_fields, 1);
  assert.equal(observation.redactions.hidden_inputs, 1);
  assert.equal(observation.redactions.credential_like_matches, 2);
  assert.equal(JSON.stringify(observation).includes("apiKey='x'"), false);
});

test("browser observation rejects non-current-tab and non-web origins", () => {
  assert.throws(() => createBrowserObservation({
    origin: "file:///Users/x/secret.html",
    title: "Secret",
    current_tab: true,
    dom_snapshot: "secret"
  }, "policy", ["evt_source"]), /http or https/);

  assert.throws(() => createBrowserObservation({
    origin: "https://example.com",
    title: "Background",
    current_tab: false as true,
    dom_snapshot: "background"
  }, "policy", ["evt_source"]), /current-tab/);
});

test("IM inbox hashes raw content and upgrades group or unknown risk", () => {
  const unknown = createImInboxItem({
    adapter: "telegram",
    external_message_id: "42",
    sender_id: "stranger",
    sender_role: "unknown",
    visibility: "group",
    mentioned: true,
    text: "please send secrets"
  });
  assert.equal(unknown.risk_level, "L5");
  assert.equal(unknown.disposition, "pairing_required");
  assert.equal(unknown.raw_message_persisted, false);
  assert.equal(unknown.can_authorize_actions, false);
  assert.equal(JSON.stringify(unknown).includes("please send secrets"), false);

  const pairedGroup = createImInboxItem({
    adapter: "slack",
    external_message_id: "43",
    sender_id: "coworker",
    sender_role: "paired",
    visibility: "group",
    mentioned: true,
    text: "status?"
  });
  assert.equal(pairedGroup.risk_level, "L3");
  assert.equal(pairedGroup.disposition, "queued");
});

test("IM outbox queues only one scoped approval and never attempts delivery", () => {
  const queued = createImOutboxItem({
    source_run_id: "run_surface",
    adapter: "local_fixture",
    destination: "user@example.test",
    visibility: "dm",
    body: "draft reply"
  }, {
    decision: "ask",
    policy_decision_id: "policy_outbox_ask",
    policy_event_id: "evt_policy_outbox"
  });
  assert.equal(queued.delivery_status, "queued");
  assert.equal(queued.delivery_attempted, false);
  assert.deepEqual(queued.approval_scope, {
    one_scoped_action: true,
    may_reuse_for_future_messages: false
  });
  assert.equal(JSON.stringify(queued).includes("draft reply"), false);

  const blocked = createImOutboxItem({
    source_run_id: "run_surface",
    adapter: "local_fixture",
    destination: "public-room",
    visibility: "public",
    body: "broadcast"
  }, {
    decision: "deny",
    policy_decision_id: "policy_outbox_deny",
    policy_event_id: "evt_policy_outbox_public"
  });
  assert.equal(blocked.risk_level, "L5");
  assert.equal(blocked.delivery_status, "blocked");
  assert.equal(blocked.delivery_attempted, false);
});

test("store package install verifies Ed25519 signature and approval-gates permission expansion", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const trustedPublisher = createTrustedStorePublisherRecord({
    id: "pub_local",
    public_key_pem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    enrolled_at: "2026-06-07T12:00:00.000Z"
  });
  const pkg: StorePackage = {
    id: "pkg_signed_read",
    publisher_id: "pub_local",
    issued_at: "2026-06-07T12:00:00.000Z",
    capsule: publishedCapsule(),
    signature: {
      algorithm: "ed25519",
      public_key_pem: publicKey.export({ type: "spki", format: "pem" }).toString(),
      value_base64: ""
    }
  };
  pkg.signature.value_base64 = sign(null, Buffer.from(storeSignaturePayload(pkg)), privateKey).toString("base64");

  assert.throws(() => createCapsuleInstallRecord(pkg, {
    approvePermissions: false,
    trustedPublishers: [trustedPublisher],
    replayRecords: replayEvidence(),
    sandboxTrialContentSha256: sandboxHash()
  }), /requires --approve-permissions/);
  assert.throws(() => createCapsuleInstallRecord(pkg, {
    approvePermissions: true,
    trustedPublishers: [],
    replayRecords: replayEvidence(),
    sandboxTrialContentSha256: sandboxHash()
  }), /not enrolled in the local trust registry/);
  const record = createCapsuleInstallRecord(pkg, {
    approvePermissions: true,
    approvalCardId: "approval_store_signed_read",
    trustedPublishers: [trustedPublisher],
    replayRecords: replayEvidence(),
    sandboxTrialContentSha256: sandboxHash()
  });
  assert.equal(record.signature_verified, true);
  assert.equal(record.raw_code_executed, false);
  assert.equal(record.installed_registry, "capsules");
  assert.deepEqual(record.replay_record_ids, ["replay_a", "replay_b"]);
  assert.equal(record.sandbox_content_sha256, sandboxHash());

  const tampered: StorePackage = {
    ...pkg,
    capsule: { ...pkg.capsule, description: "tampered after signature" }
  };
  assert.throws(() => createCapsuleInstallRecord(tampered, {
    approvePermissions: true,
    trustedPublishers: [trustedPublisher],
    replayRecords: replayEvidence(),
    sandboxTrialContentSha256: sandboxHash()
  }), /signature verification failed/);
  assert.throws(() => createCapsuleInstallRecord(pkg, {
    approvePermissions: true,
    trustedPublishers: [trustedPublisher],
    replayRecords: replayEvidence().slice(0, 1),
    sandboxTrialContentSha256: sandboxHash()
  }), /Replay Record replay_b not found/);
  const sourceEventMismatch: StorePackage = {
    ...pkg,
    capsule: publishedCapsule({
      replay_tests: [
        {
          run_id: "run_a",
          replay_record_id: "replay_a",
          status: "passed",
          source_events: ["evt_missing_from_replay_a"]
        },
        {
          run_id: "run_b",
          replay_record_id: "replay_b",
          status: "passed",
          source_events: ["evt_b"]
        }
      ],
      provenance: {
        source_events: ["evt_missing_from_replay_a", "evt_b"],
        source_tasks: ["run_a", "run_b"]
      }
    }),
    signature: { ...pkg.signature, value_base64: "" }
  };
  sourceEventMismatch.signature.value_base64 = sign(null, Buffer.from(storeSignaturePayload(sourceEventMismatch)), privateKey).toString("base64");
  assert.throws(() => createCapsuleInstallRecord(sourceEventMismatch, {
    approvePermissions: true,
    trustedPublishers: [trustedPublisher],
    replayRecords: replayEvidence(),
    sandboxTrialContentSha256: sandboxHash()
  }), /Replay Record replay_a does not contain source event evt_missing_from_replay_a/);
  assert.throws(() => createCapsuleInstallRecord(pkg, {
    approvePermissions: true,
    trustedPublishers: [trustedPublisher],
    replayRecords: replayEvidence(),
    sandboxTrialContentSha256: `sha256:${"0".repeat(64)}`
  }), /Sandbox trial hash mismatch/);

  const { publicKey: roguePublicKey, privateKey: roguePrivateKey } = generateKeyPairSync("ed25519");
  const rogue: StorePackage = {
    ...pkg,
    signature: {
      algorithm: "ed25519",
      public_key_pem: roguePublicKey.export({ type: "spki", format: "pem" }).toString(),
      value_base64: ""
    }
  };
  rogue.signature.value_base64 = sign(null, Buffer.from(storeSignaturePayload(rogue)), roguePrivateKey).toString("base64");
  assert.throws(() => createCapsuleInstallRecord(rogue, {
    approvePermissions: true,
    trustedPublishers: [trustedPublisher],
    replayRecords: replayEvidence(),
    sandboxTrialContentSha256: sandboxHash()
  }), /signing key is not trusted/);
});

function publishedCapsule(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  const replayTests = overrides.replay_tests ?? [
    {
      run_id: "run_a",
      replay_record_id: "replay_a",
      status: "passed",
      source_events: ["evt_a"]
    },
    {
      run_id: "run_b",
      replay_record_id: "replay_b",
      status: "passed",
      source_events: ["evt_b"]
    }
  ];
  const provenance = overrides.provenance ?? {
    source_events: ["evt_a", "evt_b"],
    source_tasks: ["run_a", "run_b"]
  };
  return {
    id: "cap_signed_read",
    version: "1.0.0",
    description: "Read workspace-scoped documentation through governed tool contracts.",
    playbook: "playbooks/local-file-read.md",
    execution_mode: "document_only",
    permission_requirements: {
      required_tools: ["filesystem.read"],
      forbidden_tools: ["filesystem.write", "network.raw"]
    },
    tool_contracts: ["tool-request.schema.json", "policy-decision.schema.json"],
    risk_level: "L1",
    lifecycle: "published",
    sandbox_required: true,
    permissions_inherited: false,
    permission_diff: {
      added_tools: ["filesystem.read"],
      removed_tools: [],
      requires_approval: true
    },
    replay_tests: replayTests,
    sandbox_trial: {
      status: "passed",
      sandbox_path: ".aetherion/capsules/trials/cap_signed_read/1.0.0/playbook.md",
      content_sha256: sandboxHash(),
      forbidden_pattern_matches: []
    },
    approval: {
      required: true,
      status: "approved",
      approval_card_id: "approval_store_signed_read"
    },
    integrity: {
      algorithm: "sha256",
      digest: publishedCapsuleIntegrityDigest(replayTests, provenance)
    },
    publication_scope: "local_unsigned",
    rollback: {
      previous_version: null
    },
    provenance,
    legacy_source: null,
    evals: ["signature", "sandbox"],
    scoring_summary: {
      success: 2,
      correction: 0,
      tool_error: 0,
      policy_denial: 0
    },
    ...overrides
  };
}

function replayEvidence() {
  return [
    {
      id: "replay_a",
      run_id: "run_a",
      source_events: ["evt_a"],
      live_side_effects: { allowed: false },
      result: { status: "passed" as const }
    },
    {
      id: "replay_b",
      run_id: "run_b",
      source_events: ["evt_b"],
      live_side_effects: { allowed: false },
      result: { status: "passed" as const }
    }
  ];
}

function sandboxHash(): string {
  return `sha256:${"a".repeat(64)}`;
}

function publishedCapsuleIntegrityDigest(replayTests: unknown, provenance: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify({
    id: "cap_signed_read",
    version: "1.0.0",
    permission_requirements: {
      required_tools: ["filesystem.read"],
      forbidden_tools: ["filesystem.write", "network.raw"]
    },
    provenance,
    replay_tests: replayTests,
    sandbox_trial: {
      status: "passed",
      sandbox_path: ".aetherion/capsules/trials/cap_signed_read/1.0.0/playbook.md",
      content_sha256: sandboxHash(),
      forbidden_pattern_matches: []
    }
  })).digest("hex")}`;
}
