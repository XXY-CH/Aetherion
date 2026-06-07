import { createHash, randomUUID } from "node:crypto";
import type { MemoryCard } from "../../memory-os/src/index.ts";

export type PersonaAnchor = {
  id: string;
  branch: string;
  kind: "style" | "preference" | "principle";
  content: string;
  source_events: string[];
  confidence: number;
  ttl: string;
  created_at: string;
  expires_at: string;
  allowed_contexts: string[];
  blocked_contexts: string[];
  review_status: "pending" | "accepted" | "rejected";
  sensitivity: string;
  sensitive_approval_required: boolean;
  sensitive_approved: boolean;
};

export type MemoryFold = {
  id: string;
  source_run_id: string;
  folded_from: string[];
  source_events: string[];
  proposed_memory: MemoryCard;
  confidence: number;
  created_at: string;
  review_status: "pending" | "accepted" | "rejected";
  accepted_memory_id: string | null;
  replaces_active_memory: false;
  sensitive_approval_required: boolean;
  sensitive_approved: boolean;
};

export type PersonaBranch = {
  id: string;
  name: string;
  anchor_ids: string[];
  source_events: string[];
  created_at: string;
};

export type PersonaState = {
  id: "persona_state_local";
  active_branch: string;
  active_anchor_ids: string[];
  business_memory_ids: string[];
  updated_at: string;
};

export type PersonaReset = {
  id: string;
  from_branch: string | null;
  to_branch: string;
  status: "applied";
  retained_business_memory_ids: string[];
  activated_anchor_ids: string[];
  deactivated_anchor_ids: string[];
  inherits_live_authority: false;
  created_at: string;
};

export type InheritancePolicy = {
  id: string;
  allowed: string[];
  denied: string[];
  requires_fresh_approval: string[];
  default_memory_sensitivities: string[];
};

export type SoulFork = {
  id: string;
  source_checkpoint_id: string;
  source_run_id: string;
  source_event_id: string;
  source_event_hash: string;
  replay_record_id: string;
  new_agent_id: string;
  created_at: string;
  identity: {
    id: string;
    parent_agent_id: string;
  };
  policy: {
    id: string;
    max_auto_risk: "L2";
    vault_grants: [];
    oauth_grants: [];
    active_leases: [];
  };
  budget: {
    id: string;
    token_budget: 0;
    tool_call_budget: 0;
    cpu_ms_budget: 0;
    network_call_budget: 0;
    wall_time_ms_budget: 0;
    risk_budget: "L2";
    lease_budget: 0;
    on_exhaustion: "ask";
  };
  workspace_scope: {
    workspace_id: string;
    allowed_paths: [];
  };
  inheritance_policy_id: string;
  inherited_history_refs: string[];
  inherited_memory_ids: string[];
  excluded_memory_ids: string[];
  sensitive_history_approved: boolean;
  inherits_live_authority: false;
  live_side_effects_allowed: false;
  status: "created";
};

export function proposePersonaAnchor(input: Omit<PersonaAnchor, "created_at" | "expires_at" | "review_status" | "sensitive_approval_required" | "sensitive_approved">): PersonaAnchor {
  if (input.source_events.length === 0) {
    throw new Error("Persona anchors must cite source events");
  }
  if (input.confidence < 0 || input.confidence > 1) {
    throw new Error("Persona anchor confidence must be between 0 and 1");
  }
  const createdAt = new Date();
  const sensitive = input.sensitivity === "confidential" || input.sensitivity === "secret" || input.sensitivity === "regulated" || input.sensitivity === "credential-like";
  return {
    ...input,
    created_at: createdAt.toISOString(),
    expires_at: expiresAt(createdAt, input.ttl),
    review_status: "pending",
    sensitive_approval_required: sensitive,
    sensitive_approved: false
  };
}

export function acceptPersonaAnchor(anchor: PersonaAnchor, approveSensitive = false): PersonaAnchor {
  if (anchor.review_status !== "pending") {
    throw new Error(`Persona anchor ${anchor.id} is not pending`);
  }
  if (anchor.sensitive_approval_required && !approveSensitive) {
    throw new Error(`Persona anchor ${anchor.id} requires explicit sensitive approval`);
  }
  return {
    ...anchor,
    review_status: "accepted",
    sensitive_approved: anchor.sensitive_approval_required ? true : anchor.sensitive_approved
  };
}

export function rejectPersonaAnchor(anchor: PersonaAnchor): PersonaAnchor {
  if (anchor.review_status !== "pending") {
    throw new Error(`Persona anchor ${anchor.id} is not pending`);
  }
  return { ...anchor, review_status: "rejected" };
}

export function findPersonaAnchor(anchors: PersonaAnchor[], id: string): PersonaAnchor | undefined {
  return anchors.find((anchor) => anchor.id === id);
}

export function proposeMemoryFold(sourceRunId: string, memories: MemoryCard[], content: string, confidence: number): MemoryFold {
  const distinct = [...new Map(memories.map((memory) => [memory.id, memory])).values()];
  if (distinct.length < 2) {
    throw new Error("Memory folding requires at least two distinct Memory Cards");
  }
  if (distinct.some((memory) => memory.source_events.length === 0)) {
    throw new Error("Memory folding requires source-backed Memory Cards");
  }
  if (!content.trim()) {
    throw new Error("Memory folding requires proposed content");
  }
  if (confidence < 0 || confidence > 1) {
    throw new Error("Memory fold confidence must be between 0 and 1");
  }
  const sourceEvents = [...new Set(distinct.flatMap((memory) => memory.source_events))];
  const sourceDigest = createHash("sha256").update(distinct.map((memory) => memory.id).sort().join("\n")).digest("hex").slice(0, 12);
  const idSuffix = `${sanitize(sourceRunId)}_${sourceDigest}`;
  const proposedMemoryId = `mem_fold_${idSuffix}`;
  const sensitivity = highestSensitivity(distinct.map((memory) => memory.sensitivity));
  const sensitive = sensitivity === "confidential" || sensitivity === "secret" || sensitivity === "regulated" || sensitivity === "credential-like";
  return {
    id: `fold_${idSuffix}`,
    source_run_id: sourceRunId,
    folded_from: distinct.map((memory) => memory.id),
    source_events: sourceEvents,
    proposed_memory: {
      id: proposedMemoryId,
      type: distinct.every((memory) => memory.type === distinct[0].type) ? distinct[0].type : "project",
      subject: sourceRunId,
      content: content.trim(),
      source_events: sourceEvents,
      confidence,
      sensitivity,
      blocked_contexts: [...new Set(distinct.flatMap((memory) => memory.blocked_contexts ?? []))]
    },
    confidence,
    created_at: new Date().toISOString(),
    review_status: "pending",
    accepted_memory_id: null,
    replaces_active_memory: false,
    sensitive_approval_required: sensitive,
    sensitive_approved: false
  };
}

export function acceptMemoryFold(fold: MemoryFold, approveSensitive = false): { fold: MemoryFold; memory: MemoryCard } {
  if (fold.review_status !== "pending") {
    throw new Error(`Memory fold ${fold.id} is not pending`);
  }
  if (fold.sensitive_approval_required && !approveSensitive) {
    throw new Error(`Memory fold ${fold.id} requires explicit sensitive approval`);
  }
  return {
    fold: {
      ...fold,
      review_status: "accepted",
      accepted_memory_id: fold.proposed_memory.id,
      replaces_active_memory: false,
      sensitive_approved: fold.sensitive_approval_required ? true : fold.sensitive_approved
    },
    memory: fold.proposed_memory
  };
}

export function rejectMemoryFold(fold: MemoryFold): MemoryFold {
  if (fold.review_status !== "pending") {
    throw new Error(`Memory fold ${fold.id} is not pending`);
  }
  return { ...fold, review_status: "rejected" };
}

export function createPersonaBranch(name: string, anchors: PersonaAnchor[]): PersonaBranch {
  const now = Date.now();
  const accepted = anchors.filter((anchor) =>
    anchor.branch === name
    && anchor.review_status === "accepted"
    && Date.parse(anchor.expires_at) > now
  );
  if (accepted.length === 0) {
    throw new Error(`Persona branch ${name} requires at least one accepted anchor`);
  }
  return {
    id: `branch_${sanitize(name)}`,
    name,
    anchor_ids: accepted.map((anchor) => anchor.id),
    source_events: [...new Set(accepted.flatMap((anchor) => anchor.source_events))],
    created_at: new Date().toISOString()
  };
}

export function applyPersonaReset(
  current: PersonaState | undefined,
  branch: PersonaBranch,
  memories: MemoryCard[]
): { reset: PersonaReset; state: PersonaState } {
  const businessMemoryIds = memories
    .filter((memory) => memory.type !== "preference" && memory.type !== "habit")
    .map((memory) => memory.id);
  const previousAnchors = current?.active_anchor_ids ?? [];
  const reset: PersonaReset = {
    id: `persona_reset_${sanitize(branch.name)}_${randomUUID().slice(0, 8)}`,
    from_branch: current?.active_branch ?? null,
    to_branch: branch.name,
    status: "applied",
    retained_business_memory_ids: businessMemoryIds,
    activated_anchor_ids: branch.anchor_ids,
    deactivated_anchor_ids: previousAnchors.filter((id) => !branch.anchor_ids.includes(id)),
    inherits_live_authority: false,
    created_at: new Date().toISOString()
  };
  return {
    reset,
    state: {
      id: "persona_state_local",
      active_branch: branch.name,
      active_anchor_ids: branch.anchor_ids,
      business_memory_ids: businessMemoryIds,
      updated_at: reset.created_at
    }
  };
}

export function defaultInheritancePolicy(): InheritancePolicy {
  return {
    id: "inheritance_default",
    allowed: ["approved_memory_refs", "public_history_refs"],
    denied: ["raw_secrets", "oauth_grants", "active_leases", "vault_grants", "device_authority", "tool_sessions"],
    requires_fresh_approval: ["confidential_memory", "regulated_memory", "new_workspace_paths", "resource_budget_increase"],
    default_memory_sensitivities: ["public", "internal", "private"]
  };
}

export function forkSoul(input: {
  checkpoint: {
    id: string;
    run_id: string;
    event_id: string;
    event_hash?: string;
  };
  replayRecordId: string;
  newAgentId: string;
  workspaceId: string;
  memories: MemoryCard[];
  containsSensitiveHistory?: boolean;
  approveSensitiveHistory?: boolean;
  inheritancePolicy?: InheritancePolicy;
}): SoulFork {
  if (!input.checkpoint.event_hash?.startsWith("sha256:")) {
    throw new Error("Soul Fork requires a hash-bound checkpoint");
  }
  if (!/^agent_[A-Za-z0-9_-]+$/.test(input.newAgentId)) {
    throw new Error("Soul Fork agent identity must use the agent_<id> form");
  }
  const policy = input.inheritancePolicy ?? defaultInheritancePolicy();
  if (input.containsSensitiveHistory && !input.approveSensitiveHistory) {
    throw new Error("Soul Fork requires explicit approval for sensitive history references");
  }
  const allowedSensitivity = new Set(policy.default_memory_sensitivities);
  const inherited = input.memories.filter((memory) => allowedSensitivity.has(memory.sensitivity));
  const excluded = input.memories.filter((memory) => !allowedSensitivity.has(memory.sensitivity));
  return {
    id: `soulfork_${sanitize(input.newAgentId)}`,
    source_checkpoint_id: input.checkpoint.id,
    source_run_id: input.checkpoint.run_id,
    source_event_id: input.checkpoint.event_id,
    source_event_hash: input.checkpoint.event_hash,
    replay_record_id: input.replayRecordId,
    new_agent_id: input.newAgentId,
    created_at: new Date().toISOString(),
    identity: {
      id: input.newAgentId,
      parent_agent_id: "agent_local"
    },
    policy: {
      id: `policy_${sanitize(input.newAgentId)}`,
      max_auto_risk: "L2",
      vault_grants: [],
      oauth_grants: [],
      active_leases: []
    },
    budget: {
      id: `budget_${sanitize(input.newAgentId)}`,
      token_budget: 0,
      tool_call_budget: 0,
      cpu_ms_budget: 0,
      network_call_budget: 0,
      wall_time_ms_budget: 0,
      risk_budget: "L2",
      lease_budget: 0,
      on_exhaustion: "ask"
    },
    workspace_scope: {
      workspace_id: input.workspaceId,
      allowed_paths: []
    },
    inheritance_policy_id: policy.id,
    inherited_history_refs: [input.checkpoint.event_id],
    inherited_memory_ids: inherited.map((memory) => memory.id),
    excluded_memory_ids: excluded.map((memory) => memory.id),
    sensitive_history_approved: input.containsSensitiveHistory ? true : false,
    inherits_live_authority: false,
    live_side_effects_allowed: false,
    status: "created"
  };
}

export function isPersonaAnchor(value: unknown): value is PersonaAnchor {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.branch === "string"
    && typeof value.content === "string"
    && Array.isArray(value.source_events)
    && typeof value.review_status === "string";
}

export function isMemoryFold(value: unknown): value is MemoryFold {
  return isObject(value)
    && typeof value.id === "string"
    && Array.isArray(value.folded_from)
    && isObject(value.proposed_memory)
    && value.replaces_active_memory === false;
}

export function isPersonaBranch(value: unknown): value is PersonaBranch {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && Array.isArray(value.anchor_ids);
}

export function isPersonaState(value: unknown): value is PersonaState {
  return isObject(value)
    && value.id === "persona_state_local"
    && typeof value.active_branch === "string"
    && Array.isArray(value.active_anchor_ids);
}

export function isSoulFork(value: unknown): value is SoulFork {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.source_checkpoint_id === "string"
    && value.inherits_live_authority === false
    && value.live_side_effects_allowed === false
    && isObject(value.policy)
    && Array.isArray(value.policy.vault_grants)
    && value.policy.vault_grants.length === 0
    && Array.isArray(value.policy.oauth_grants)
    && value.policy.oauth_grants.length === 0
    && Array.isArray(value.policy.active_leases)
    && value.policy.active_leases.length === 0
    && isObject(value.budget)
    && value.budget.token_budget === 0
    && value.budget.tool_call_budget === 0
    && value.budget.lease_budget === 0
    && isObject(value.workspace_scope)
    && Array.isArray(value.workspace_scope.allowed_paths)
    && value.workspace_scope.allowed_paths.length === 0;
}

function expiresAt(createdAt: Date, ttl: string): string {
  const match = ttl.match(/^([1-9][0-9]*)(d|h)$/);
  if (!match) {
    throw new Error("Persona anchor TTL must use a positive day or hour duration");
  }
  const count = Number(match[1]);
  const unitMs = match[2] === "d" ? 86_400_000 : 3_600_000;
  return new Date(createdAt.getTime() + count * unitMs).toISOString();
}

function highestSensitivity(values: string[]): string {
  const order = ["public", "internal", "private", "confidential", "secret", "regulated", "credential-like"];
  return values.reduce((highest, current) => order.indexOf(current) > order.indexOf(highest) ? current : highest, "public");
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 96);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
