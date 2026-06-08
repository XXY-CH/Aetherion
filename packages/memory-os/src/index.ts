export type MemoryCandidate = {
  id: string;
  source_events: string[];
  candidate: {
    type: string;
    subject: string;
    content: string;
    contradicts?: string[];
  };
  confidence: number;
  review: {
    status: "pending" | "accepted" | "rejected";
  };
  sensitivity?: string;
  allowed_contexts?: string[];
  blocked_contexts?: string[];
};

export type MemoryCard = {
  id: string;
  type: string;
  subject: string;
  content: string;
  source_events: string[];
  confidence: number;
  sensitivity: string;
  contradicts?: string[];
  blocked_contexts?: string[];
};

export type MemoryTombstone = {
  id: string;
  event_type: "memory.deleted";
  target_memory_id: string;
  source_events: string[];
  reason: string;
  created_at: string;
  active_memory_removed: true;
  history_rewritten: false;
  redaction_status: "tombstone_only" | "redaction_pending" | "redacted";
};

export type ContextPack = {
  id: string;
  run_id: string;
  selected_memories: Array<{ id: string; reason: string; confidence: number; source_events: string[] }>;
  excluded_memories: Array<{ id: string; reason: string }>;
  conflicts: string[];
  active_leases: string[];
  capability_cards: string[];
  token_budget: {
    memory_tokens: number;
    capability_tokens: number;
    task_tokens: number;
  };
};

export type EpisodicTimeline = {
  id: string;
  run_id: string;
  source_events: string[];
  user_intent: string;
  steps_taken: Array<{ event_id: string; event_type: string; summary: string }>;
  tools_used: string[];
  failures: string[];
  recoveries: string[];
  user_corrections: string[];
  final_artifact: string;
  skill_candidates: string[];
  regression_cases: string[];
};

export type UserModel = {
  id: string;
  source_memory_ids: string[];
  source_events: string[];
  communication_style: {
    prefers: string[];
    dislikes: string[];
  };
  work_style: {
    decision_pattern: string;
    risk_tolerance: string;
    approval_preference: string;
  };
  automation_policy: {
    auto_execute: string[];
    require_approval: string[];
  };
};

export type MemorySourceEvent = {
  id: string;
  run_id: string;
  event_type: string;
  summary: string;
  sensitivity?: string;
  payload_ref?: string;
};

const DEFAULT_CONTEXT_TOKEN_BUDGET = { memory_tokens: 1000, capability_tokens: 1000, task_tokens: 6000 };

export function createMemoryCandidate(input: Omit<MemoryCandidate, "review">): MemoryCandidate {
  if (input.source_events.length === 0) {
    throw new Error("Memory candidates must cite source events");
  }
  return { ...input, review: { status: "pending" } };
}

export function deriveMemoryCandidatesFromEvents(events: MemorySourceEvent[], runId: string): MemoryCandidate[] {
  const runEvents = events.filter((event) => event.run_id === runId && event.id);
  if (runEvents.length === 0) {
    return [];
  }

  const completed = runEvents.findLast((event) => event.event_type === "run.completed");
  const verification = runEvents.findLast((event) => event.event_type === "verification.recorded");
  const candidates: MemoryCandidate[] = [];

  if (completed) {
    candidates.push(createMemoryCandidate({
      id: `memcand_${sanitizeId(runId)}_episode`,
      source_events: compactEventIds([runEvents[0], verification, completed]),
      candidate: {
        type: "project",
        subject: runId,
        content: `Task episode completed: ${completed.summary}`
      },
      confidence: verification ? 0.82 : 0.68,
      sensitivity: completed.sensitivity ?? "private",
      blocked_contexts: ["external_send"]
    }));
  }

  if (verification) {
    candidates.push(createMemoryCandidate({
      id: `memcand_${sanitizeId(runId)}_verification`,
      source_events: compactEventIds([verification]),
      candidate: {
        type: "fact",
        subject: runId,
        content: `Verification result: ${verification.summary}`
      },
      confidence: 0.86,
      sensitivity: verification.sensitivity ?? "private",
      blocked_contexts: ["external_send"]
    }));
  }

  return candidates;
}

export function buildEpisodicTimeline(events: MemorySourceEvent[], runId: string): EpisodicTimeline {
  const runEvents = events.filter((event) => event.run_id === runId && event.id);
  if (runEvents.length === 0) {
    throw new Error(`No source events found for ${runId}`);
  }
  const userIntent = runEvents.find((event) => event.event_type === "user.message")?.summary ?? "No explicit user intent event recorded.";
  const finalArtifact = runEvents.findLast((event) => event.payload_ref)?.payload_ref ?? "unavailable";
  return {
    id: `episode_${sanitizeId(runId)}`,
    run_id: runId,
    source_events: compactEventIds(runEvents),
    user_intent: userIntent,
    steps_taken: runEvents
      .filter((event) => event.event_type !== "user.message")
      .map((event) => ({ event_id: event.id, event_type: event.event_type, summary: event.summary })),
    tools_used: inferToolsUsed(runEvents),
    failures: failureEventIds(runEvents),
    recoveries: recoveryEventIds(runEvents),
    user_corrections: correctionEventIds(runEvents),
    final_artifact: finalArtifact,
    skill_candidates: skillCandidates(runEvents),
    regression_cases: regressionCases(runEvents)
  };
}

export function createBasicUserModel(memories: MemoryCard[]): UserModel {
  const sourceMemories = memories.filter((memory) => memory.source_events.length > 0);
  return {
    id: "user_model_local",
    source_memory_ids: sourceMemories.map((memory) => memory.id),
    source_events: [...new Set(sourceMemories.flatMap((memory) => memory.source_events))],
    communication_style: {
      prefers: inferPreferredCommunication(sourceMemories),
      dislikes: inferDislikedCommunication(sourceMemories)
    },
    work_style: {
      decision_pattern: inferExplicitValue(sourceMemories, ["decision pattern", "workflow"], "unknown"),
      risk_tolerance: inferExplicitValue(sourceMemories, ["risk tolerance"], "unknown"),
      approval_preference: inferExplicitValue(sourceMemories, ["approval", "permission"], "unknown")
    },
    automation_policy: {
      auto_execute: inferPolicyItems(sourceMemories, "auto"),
      require_approval: inferPolicyItems(sourceMemories, "approval")
    }
  };
}

export function acceptMemoryCandidate(candidate: MemoryCandidate): MemoryCard {
  if (candidate.source_events.length === 0) {
    throw new Error("Accepted memory must cite source events");
  }
  return {
    id: candidate.id.replace(/^memcand_/, "mem_"),
    type: candidate.candidate.type,
    subject: candidate.candidate.subject,
    content: candidate.candidate.content,
    source_events: candidate.source_events,
    confidence: candidate.confidence,
    sensitivity: candidate.sensitivity ?? "private",
    contradicts: candidate.candidate.contradicts ?? [],
    blocked_contexts: candidate.blocked_contexts ?? []
  };
}

export function createMemoryDeleteTombstone(memory: MemoryCard, reason: string, createdAt = new Date().toISOString()): MemoryTombstone {
  if (memory.source_events.length === 0) {
    throw new Error("Memory delete tombstones must cite source events");
  }
  return {
    id: `tombstone_${memory.id}`,
    event_type: "memory.deleted",
    target_memory_id: memory.id,
    source_events: memory.source_events,
    reason,
    created_at: createdAt,
    active_memory_removed: true,
    history_rewritten: false,
    redaction_status: "tombstone_only"
  };
}

export function blockMemoryContext(memory: MemoryCard, context: string): MemoryCard {
  const blocked = new Set(memory.blocked_contexts ?? []);
  blocked.add(context);
  return { ...memory, blocked_contexts: [...blocked].sort() };
}

export function assembleContextPack(runId: string, memories: MemoryCard[], context: string, tombstones: MemoryTombstone[] = []): ContextPack {
  const selected_memories: ContextPack["selected_memories"] = [];
  const excluded_memories: ContextPack["excluded_memories"] = [];
  const eligible_memories: MemoryCard[] = [];
  const deletedMemoryIds = new Set(tombstones.map((tombstone) => tombstone.target_memory_id));
  for (const memory of memories) {
    if (deletedMemoryIds.has(memory.id)) {
      excluded_memories.push({ id: memory.id, reason: "deleted by memory tombstone" });
    } else if (memory.blocked_contexts?.includes(context)) {
      excluded_memories.push({ id: memory.id, reason: `blocked for ${context}` });
    } else if (memory.sensitivity === "secret" || (memory.sensitivity === "confidential" && context === "external_send")) {
      excluded_memories.push({ id: memory.id, reason: `sensitivity ${memory.sensitivity} not allowed in ${context}` });
    } else {
      eligible_memories.push(memory);
    }
  }
  let usedMemoryTokens = 0;
  for (const memory of eligible_memories.sort(compareMemoryForContext)) {
    const estimatedTokens = estimateMemoryTokenCost(memory);
    if (usedMemoryTokens + estimatedTokens > DEFAULT_CONTEXT_TOKEN_BUDGET.memory_tokens) {
      excluded_memories.push({ id: memory.id, reason: "memory budget exceeded" });
      continue;
    }
    usedMemoryTokens += estimatedTokens;
    selected_memories.push({ id: memory.id, reason: "context-compatible source-backed memory", confidence: memory.confidence, source_events: memory.source_events });
  }
  return {
    id: `ctx_${runId}`,
    run_id: runId,
    selected_memories,
    excluded_memories,
    conflicts: contextConflicts(selected_memories.map((selected) => selected.id), excluded_memories, eligible_memories),
    active_leases: [],
    capability_cards: [],
    token_budget: { ...DEFAULT_CONTEXT_TOKEN_BUDGET }
  };
}

export function findMemoryCandidate(candidates: MemoryCandidate[], id: string): MemoryCandidate | undefined {
  return candidates.find((candidate) => candidate.id === id);
}

export function rejectMemoryCandidate(candidate: MemoryCandidate): MemoryCandidate {
  return { ...candidate, review: { status: "rejected" } };
}

export function acceptCandidateFromRegistry(candidates: MemoryCandidate[], id: string): { candidate: MemoryCandidate; card: MemoryCard } {
  const candidate = findMemoryCandidate(candidates, id);
  if (!candidate) {
    throw new Error(`Memory candidate ${id} not found`);
  }
  if (candidate.review.status !== "pending") {
    throw new Error(`Memory candidate ${id} is not pending`);
  }
  const accepted = { ...candidate, review: { status: "accepted" as const } };
  return { candidate: accepted, card: acceptMemoryCandidate(accepted) };
}

export function isMemoryCandidate(value: unknown): value is MemoryCandidate {
  return isObject(value)
    && typeof value.id === "string"
    && Array.isArray(value.source_events)
    && isObject(value.candidate)
    && typeof value.confidence === "number"
    && isObject(value.review);
}

export function isMemoryCard(value: unknown): value is MemoryCard {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.content === "string"
    && Array.isArray(value.source_events)
    && typeof value.confidence === "number";
}

export function isMemoryTombstone(value: unknown): value is MemoryTombstone {
  return isObject(value)
    && typeof value.id === "string"
    && value.event_type === "memory.deleted"
    && typeof value.target_memory_id === "string"
    && Array.isArray(value.source_events)
    && value.active_memory_removed === true
    && value.history_rewritten === false;
}

export function isEpisodicTimeline(value: unknown): value is EpisodicTimeline {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.run_id === "string"
    && Array.isArray(value.source_events)
    && Array.isArray(value.steps_taken);
}

export function isUserModel(value: unknown): value is UserModel {
  return isObject(value)
    && typeof value.id === "string"
    && Array.isArray(value.source_events)
    && isObject(value.communication_style)
    && isObject(value.work_style)
    && isObject(value.automation_policy);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compactEventIds(events: Array<MemorySourceEvent | undefined>): string[] {
  return [...new Set(events.filter((event): event is MemorySourceEvent => Boolean(event)).map((event) => event.id))];
}

function sanitizeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "_");
}

function compareMemoryForContext(left: MemoryCard, right: MemoryCard): number {
  const confidenceDifference = right.confidence - left.confidence;
  if (confidenceDifference !== 0) {
    return confidenceDifference;
  }
  const sourceEventDifference = right.source_events.length - left.source_events.length;
  if (sourceEventDifference !== 0) {
    return sourceEventDifference;
  }
  const tokenDifference = estimateMemoryTokenCost(left) - estimateMemoryTokenCost(right);
  if (tokenDifference !== 0) {
    return tokenDifference;
  }
  return left.id.localeCompare(right.id);
}

function estimateMemoryTokenCost(memory: MemoryCard): number {
  const serializedMemory = [
    memory.id,
    memory.type,
    memory.subject,
    memory.content,
    memory.source_events.join(" ")
  ].join(" ");
  return Math.max(1, Math.ceil(serializedMemory.length / 4));
}

function contextConflicts(selectedMemoryIds: string[], excludedMemories: ContextPack["excluded_memories"], eligibleMemories: MemoryCard[]): string[] {
  const selected = new Set(selectedMemoryIds);
  const known = new Set(eligibleMemories.map((memory) => memory.id));
  const excluded = new Map(excludedMemories.map((memory) => [memory.id, memory.reason]));
  const conflicts: string[] = [];

  for (const memory of eligibleMemories.sort((left, right) => left.id.localeCompare(right.id))) {
    for (const contradictedId of [...new Set(memory.contradicts ?? [])].sort()) {
      if (selected.has(memory.id) && selected.has(contradictedId)) {
        conflicts.push(`selected memory ${memory.id} contradicts selected memory ${contradictedId}`);
      } else if (selected.has(memory.id) && excluded.has(contradictedId)) {
        conflicts.push(`selected memory ${memory.id} contradicts excluded memory ${contradictedId} (${excluded.get(contradictedId)})`);
      } else if (selected.has(memory.id) && !known.has(contradictedId) && !excluded.has(contradictedId)) {
        conflicts.push(`selected memory ${memory.id} contradicts missing memory ${contradictedId}`);
      }
    }
  }

  return [...new Set(conflicts)];
}

function inferToolsUsed(events: MemorySourceEvent[]): string[] {
  const tools = new Set<string>();
  for (const event of events) {
    if (event.event_type === "tool.requested" || event.event_type === "tool.result") {
      if (/write/i.test(event.summary)) tools.add("filesystem.write");
      if (/read/i.test(event.summary)) tools.add("filesystem.read");
    }
  }
  return [...tools];
}

function failureEventIds(events: MemorySourceEvent[]): string[] {
  return events.filter((event) => /fail|failure|error|denied|timeout|timed out/i.test(`${event.event_type} ${event.summary}`)).map((event) => event.id);
}

function recoveryEventIds(events: MemorySourceEvent[]): string[] {
  return events.filter((event) => /recover|recovery|retry|correct/i.test(event.summary)).map((event) => event.id);
}

function correctionEventIds(events: MemorySourceEvent[]): string[] {
  return events
    .filter((event) => (
      event.event_type === "user.message"
      || /user corrected|user correction/i.test(event.summary)
    ) && /correction|corrected/i.test(event.summary))
    .map((event) => event.id);
}

function skillCandidates(events: MemorySourceEvent[]): string[] {
  return events
    .filter((event) => /skill candidate|capability candidate|reusable workflow|repeated workflow|should become (?:a )?(?:skill|capability)/i.test(event.summary))
    .map((event) => `${event.id}: ${event.summary}`);
}

function regressionCases(events: MemorySourceEvent[]): string[] {
  return events
    .filter((event) => (
      /regression case|regression test|test case|failure|failed|error|denied/i.test(`${event.event_type} ${event.summary}`)
      || correctionEventIds([event]).length > 0
    ))
    .map((event) => `${event.id}: ${event.summary}`);
}

function inferPreferredCommunication(memories: MemoryCard[]): string[] {
  const preferences = new Set<string>();
  for (const memory of memories) {
    const content = memory.content.toLowerCase();
    if (content.includes("direct")) preferences.add("direct answers");
    if (content.includes("evidence") || content.includes("verification")) preferences.add("evidence-backed summaries");
    if (content.includes("compact") || content.includes("concise")) preferences.add("concise updates");
  }
  return [...preferences];
}

function inferDislikedCommunication(memories: MemoryCard[]): string[] {
  const dislikes = new Set<string>();
  for (const memory of memories) {
    const content = memory.content.toLowerCase();
    if (content.includes("dislike") || content.includes("avoid") || content.includes("不要")) {
      dislikes.add(memory.content);
    }
  }
  return [...dislikes];
}

function inferExplicitValue(memories: MemoryCard[], markers: string[], fallback: string): string {
  return memories.find((memory) => markers.some((marker) => memory.content.toLowerCase().includes(marker)))?.content ?? fallback;
}

function inferPolicyItems(memories: MemoryCard[], marker: string): string[] {
  return memories
    .filter((memory) => memory.content.toLowerCase().includes(marker))
    .map((memory) => memory.content);
}
