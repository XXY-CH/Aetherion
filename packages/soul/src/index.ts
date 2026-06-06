export type PersonaAnchor = {
  id: string;
  content: string;
  source_events: string[];
  confidence: number;
  ttl: string;
  allowed_contexts: string[];
  blocked_contexts: string[];
  review_status: "pending" | "accepted" | "rejected";
  sensitivity?: string;
};

export type MemoryFold = {
  id: string;
  folded_from: string[];
  proposed_memory_id: string;
  confidence: number;
  review_status: "pending" | "accepted" | "rejected";
};

export type SoulFork = {
  id: string;
  source_checkpoint_id: string;
  new_agent_id: string;
  inherits_history_refs: true;
  inherits_live_authority: false;
  policy_id: string;
  status: "proposed";
};

export type PersonaReset = {
  id: string;
  branch: string;
  status: "proposed";
  business_memory_retention_planned: true;
  style_anchor_switch_planned: true;
  source_anchor_ids: string[];
};

export function proposePersonaAnchor(input: Omit<PersonaAnchor, "review_status">): PersonaAnchor {
  if (input.source_events.length === 0) {
    throw new Error("Persona anchors must cite source events");
  }
  return { ...input, review_status: "pending" };
}

export function acceptPersonaAnchor(anchor: PersonaAnchor): PersonaAnchor {
  if (anchor.review_status !== "pending") {
    throw new Error(`Persona anchor ${anchor.id} is not pending`);
  }
  return { ...anchor, review_status: "accepted" };
}

export function rejectPersonaAnchor(anchor: PersonaAnchor): PersonaAnchor {
  return { ...anchor, review_status: "rejected" };
}

export function findPersonaAnchor(anchors: PersonaAnchor[], id: string): PersonaAnchor | undefined {
  return anchors.find((anchor) => anchor.id === id);
}

export function foldMemories(foldedFrom: string[], proposedMemoryId: string, confidence: number): MemoryFold {
  if (foldedFrom.length === 0) {
    throw new Error("Memory folds must preserve folded_from references");
  }
  return {
    id: `fold_${proposedMemoryId}`,
    folded_from: foldedFrom,
    proposed_memory_id: proposedMemoryId,
    confidence,
    review_status: "pending"
  };
}

export function forkSoul(checkpointId: string, newAgentId: string): SoulFork {
  return {
    id: `soulfork_${newAgentId}`,
    source_checkpoint_id: checkpointId,
    new_agent_id: newAgentId,
    inherits_history_refs: true,
    inherits_live_authority: false,
    policy_id: `policy_${newAgentId}`,
    status: "proposed"
  };
}

export function createPersonaReset(branch: string, anchors: PersonaAnchor[]): PersonaReset {
  return {
    id: `persona_reset_${branch}`.replace(/[^A-Za-z0-9_-]/g, "_"),
    branch,
    status: "proposed",
    business_memory_retention_planned: true,
    style_anchor_switch_planned: true,
    source_anchor_ids: anchors.filter((anchor) => anchor.review_status === "accepted").map((anchor) => anchor.id)
  };
}

export function isPersonaAnchor(value: unknown): value is PersonaAnchor {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.content === "string"
    && Array.isArray(value.source_events)
    && typeof value.review_status === "string";
}

export function isSoulFork(value: unknown): value is SoulFork {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.source_checkpoint_id === "string"
    && value.inherits_live_authority === false;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
