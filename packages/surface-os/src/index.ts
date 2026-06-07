import { createHash, verify } from "node:crypto";

export type BrowserObservationInput = {
  origin: string;
  title: string;
  current_tab: true;
  dom_snapshot: string;
  captured_at?: string;
};

export type BrowserObservation = {
  id: string;
  origin: string;
  title: string;
  mode: "current_tab_observe";
  current_tab_only: true;
  dom_sha256: string;
  raw_dom_persisted: false;
  redactions: {
    password_fields: number;
    hidden_inputs: number;
    credential_like_matches: number;
  };
  taint: {
    sources: ["public_web"];
    can_authorize_actions: false;
  };
  can_create_side_effects: false;
  policy_decision_id: string;
  source_event_ids: string[];
  captured_at: string;
};

export type ImInboxInput = {
  adapter: "telegram" | "slack" | "local_fixture";
  external_message_id: string;
  sender_id: string;
  sender_role: "owner" | "paired" | "unknown";
  visibility: "dm" | "group" | "public";
  mentioned: boolean;
  text: string;
};

export type ImInboxItem = {
  id: string;
  adapter: ImInboxInput["adapter"];
  external_message_id: string;
  sender_hash: string;
  sender_role: ImInboxInput["sender_role"];
  visibility: ImInboxInput["visibility"];
  mentioned: boolean;
  message_sha256: string;
  raw_message_persisted: false;
  risk_level: "L1" | "L3" | "L5";
  disposition: "queued" | "observe_only" | "pairing_required";
  can_authorize_actions: false;
  taint: {
    sources: ["im"];
    can_authorize_actions: false;
  };
  created_at: string;
};

export type ImOutboxInput = {
  source_run_id: string;
  adapter: "telegram" | "slack" | "local_fixture";
  destination: string;
  visibility: "dm" | "group" | "public";
  body: string;
};

export type ImOutboxItem = {
  id: string;
  source_run_id: string;
  adapter: ImOutboxInput["adapter"];
  destination_hash: string;
  visibility: ImOutboxInput["visibility"];
  body_sha256: string;
  raw_body_persisted: false;
  risk_level: "L3" | "L5";
  approval_required: true;
  delivery_status: "queued" | "blocked";
  delivery_attempted: false;
  approval_scope: {
    one_scoped_action: true;
    may_reuse_for_future_messages: false;
  };
  policy_decision_id: string;
  policy_event_id: string;
  created_at: string;
};

export type StorePackage = {
  id: string;
  publisher_id: string;
  issued_at: string;
  capsule: Record<string, unknown>;
  signature: {
    algorithm: "ed25519";
    public_key_pem: string;
    value_base64: string;
  };
};

export type CapsuleInstallRecord = {
  id: string;
  package_id: string;
  capsule_id: string;
  capsule_version: string;
  publisher_id: string;
  package_digest: string;
  signature_verified: true;
  permission_diff_reviewed: true;
  replay_tests_passed: true;
  sandbox_trial_passed: true;
  approval_card_id: string | null;
  rollback_target: string | null;
  installed_registry: "capsules";
  raw_code_executed: false;
  status: "installed";
  created_at: string;
};

export function createBrowserObservation(input: BrowserObservationInput, policyDecisionId: string, sourceEventIds: string[]): BrowserObservation {
  const origin = new URL(input.origin);
  if (origin.protocol !== "https:" && origin.protocol !== "http:") {
    throw new Error("Browser observation origin must be http or https");
  }
  if (!input.current_tab) {
    throw new Error("Browser observation must be current-tab scoped");
  }
  return {
    id: `browser_obs_${hashId(`${input.origin}:${input.title}:${input.dom_snapshot}`)}`,
    origin: input.origin,
    title: input.title,
    mode: "current_tab_observe",
    current_tab_only: true,
    dom_sha256: sha256(input.dom_snapshot),
    raw_dom_persisted: false,
    redactions: countBrowserRedactions(input.dom_snapshot),
    taint: { sources: ["public_web"], can_authorize_actions: false },
    can_create_side_effects: false,
    policy_decision_id: policyDecisionId,
    source_event_ids: sourceEventIds,
    captured_at: input.captured_at ?? new Date().toISOString()
  };
}

export function createImInboxItem(input: ImInboxInput): ImInboxItem {
  const risk = input.visibility === "dm" && input.sender_role !== "unknown"
    ? "L1"
    : input.visibility === "group" && input.mentioned && input.sender_role !== "unknown"
      ? "L3"
      : "L5";
  return {
    id: `inbox_${hashId(`${input.adapter}:${input.external_message_id}`)}`,
    adapter: input.adapter,
    external_message_id: input.external_message_id,
    sender_hash: sha256(input.sender_id),
    sender_role: input.sender_role,
    visibility: input.visibility,
    mentioned: input.mentioned,
    message_sha256: sha256(input.text),
    raw_message_persisted: false,
    risk_level: risk,
    disposition: risk === "L5" ? (input.sender_role === "unknown" ? "pairing_required" : "observe_only") : "queued",
    can_authorize_actions: false,
    taint: { sources: ["im"], can_authorize_actions: false },
    created_at: new Date().toISOString()
  };
}

export function createImOutboxItem(input: ImOutboxInput, policy: { decision: "ask" | "deny"; policy_decision_id: string; policy_event_id: string }): ImOutboxItem {
  return {
    id: `outbox_${hashId(`${input.source_run_id}:${input.adapter}:${input.destination}:${input.body}`)}`,
    source_run_id: input.source_run_id,
    adapter: input.adapter,
    destination_hash: sha256(input.destination),
    visibility: input.visibility,
    body_sha256: sha256(input.body),
    raw_body_persisted: false,
    risk_level: input.visibility === "public" ? "L5" : "L3",
    approval_required: true,
    delivery_status: policy.decision === "deny" ? "blocked" : "queued",
    delivery_attempted: false,
    approval_scope: {
      one_scoped_action: true,
      may_reuse_for_future_messages: false
    },
    policy_decision_id: policy.policy_decision_id,
    policy_event_id: policy.policy_event_id,
    created_at: new Date().toISOString()
  };
}

export function verifyStorePackageSignature(pkg: StorePackage): { digest: string; verified: boolean } {
  const payload = storeSignaturePayload(pkg);
  return {
    digest: sha256(payload),
    verified: verify(null, Buffer.from(payload), pkg.signature.public_key_pem, Buffer.from(pkg.signature.value_base64, "base64"))
  };
}

export function createCapsuleInstallRecord(pkg: StorePackage, input: { approvePermissions: boolean; approvalCardId?: string | null }): CapsuleInstallRecord {
  const signature = verifyStorePackageSignature(pkg);
  if (!signature.verified) {
    throw new Error(`Store package ${pkg.id} signature verification failed`);
  }
  const capsule = pkg.capsule as {
    id?: string;
    version?: string;
    lifecycle?: string;
    permission_diff?: { requires_approval?: boolean };
    replay_tests?: Array<{ status?: string }>;
    sandbox_trial?: { status?: string };
    rollback?: { previous_version?: string | null };
  };
  if (typeof capsule.id !== "string" || typeof capsule.version !== "string") {
    throw new Error("Store package Capsule must include id and version");
  }
  if (capsule.lifecycle !== "published") {
    throw new Error("Store package Capsule must be published");
  }
  if (!Array.isArray(capsule.replay_tests) || capsule.replay_tests.length < 2 || capsule.replay_tests.some((test) => test.status !== "passed")) {
    throw new Error("Store package Capsule requires at least two passing replay tests");
  }
  if (capsule.sandbox_trial?.status !== "passed") {
    throw new Error("Store package Capsule requires a passing sandbox trial");
  }
  if (capsule.permission_diff?.requires_approval && !input.approvePermissions) {
    throw new Error("Store package permission expansion requires --approve-permissions");
  }
  return {
    id: `install_${hashId(`${pkg.id}:${capsule.id}:${capsule.version}`)}`,
    package_id: pkg.id,
    capsule_id: capsule.id,
    capsule_version: capsule.version,
    publisher_id: pkg.publisher_id,
    package_digest: signature.digest,
    signature_verified: true,
    permission_diff_reviewed: true,
    replay_tests_passed: true,
    sandbox_trial_passed: true,
    approval_card_id: capsule.permission_diff?.requires_approval ? (input.approvalCardId ?? null) : null,
    rollback_target: capsule.rollback?.previous_version ?? null,
    installed_registry: "capsules",
    raw_code_executed: false,
    status: "installed",
    created_at: new Date().toISOString()
  };
}

export function storeSignaturePayload(pkg: StorePackage): string {
  return stableStringify({
    id: pkg.id,
    publisher_id: pkg.publisher_id,
    issued_at: pkg.issued_at,
    capsule: pkg.capsule
  });
}

function countBrowserRedactions(dom: string): BrowserObservation["redactions"] {
  return {
    password_fields: count(/\btype\s*=\s*["']password["']/gi, dom),
    hidden_inputs: count(/\btype\s*=\s*["']hidden["']/gi, dom),
    credential_like_matches: count(/\b(api[_-]?key|password|secret|token|credential)\b/gi, dom)
  };
}

function count(pattern: RegExp, value: string): number {
  return Array.from(value.matchAll(pattern)).length;
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function hashId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
