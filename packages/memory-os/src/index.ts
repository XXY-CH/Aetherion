export type MemoryCandidate = {
  id: string;
  source_events: string[];
  candidate: {
    type: string;
    subject: string;
    content: string;
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
  blocked_contexts?: string[];
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
};

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
  const finalArtifact = runEvents.findLast((event) => event.event_type === "verification.recorded" || event.event_type === "run.completed")?.summary ?? "No final artifact recorded.";
  return {
    id: `episode_${sanitizeId(runId)}`,
    run_id: runId,
    source_events: compactEventIds(runEvents),
    user_intent: userIntent,
    steps_taken: runEvents
      .filter((event) => event.event_type !== "user.message")
      .map((event) => ({ event_id: event.id, event_type: event.event_type, summary: event.summary })),
    tools_used: inferToolsUsed(runEvents),
    failures: runEvents.filter((event) => /fail|error|denied/i.test(`${event.event_type} ${event.summary}`)).map((event) => event.id),
    recoveries: runEvents.filter((event) => /recover|retry|correct/i.test(event.summary)).map((event) => event.id),
    user_corrections: runEvents.filter((event) => /correction|corrected/i.test(`${event.event_type} ${event.summary}`)).map((event) => event.id),
    final_artifact: finalArtifact,
    skill_candidates: [],
    regression_cases: runEvents.some((event) => event.event_type === "verification.recorded")
      ? [`Replay ${runId} must preserve verification evidence without live side effects.`]
      : []
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
      dislikes: ["generic advice", "unverified completion claims"]
    },
    work_style: {
      decision_pattern: "Start from architecture, then iterate through MVP loops.",
      risk_tolerance: "medium_high",
      approval_preference: "Ask before irreversible external effects."
    },
    automation_policy: {
      auto_execute: ["summarize local documents", "draft plans", "run reversible tests"],
      require_approval: ["send external messages", "commit or publish changes", "modify paid services"]
    }
  };
}

export function acceptMemoryCandidate(candidate: MemoryCandidate): MemoryCard {
  if (candidate.source_events.length === 0) {
    throw new Error("Accepted memory must cite source events");
  }
  candidate.review.status = "accepted";
  return {
    id: candidate.id.replace(/^memcand_/, "mem_"),
    type: candidate.candidate.type,
    subject: candidate.candidate.subject,
    content: candidate.candidate.content,
    source_events: candidate.source_events,
    confidence: candidate.confidence,
    sensitivity: candidate.sensitivity ?? "private",
    blocked_contexts: candidate.blocked_contexts ?? []
  };
}

export function createMemoryDeleteTombstone(memory: MemoryCard, reason: string): { event_type: "memory.deleted"; target_memory_id: string; reason: string } {
  return { event_type: "memory.deleted", target_memory_id: memory.id, reason };
}

export function assembleContextPack(runId: string, memories: MemoryCard[], context: string): ContextPack {
  const selected_memories = [];
  const excluded_memories = [];
  for (const memory of memories) {
    if (memory.blocked_contexts?.includes(context)) {
      excluded_memories.push({ id: memory.id, reason: `blocked for ${context}` });
    } else if (memory.sensitivity === "secret" || (memory.sensitivity === "confidential" && context === "external_send")) {
      excluded_memories.push({ id: memory.id, reason: `sensitivity ${memory.sensitivity} not allowed in ${context}` });
    } else {
      selected_memories.push({ id: memory.id, reason: "context-compatible source-backed memory", confidence: memory.confidence, source_events: memory.source_events });
    }
  }
  return {
    id: `ctx_${runId}`,
    run_id: runId,
    selected_memories,
    excluded_memories,
    conflicts: [],
    active_leases: [],
    capability_cards: [],
    token_budget: { memory_tokens: 1000, capability_tokens: 1000, task_tokens: 6000 }
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

function inferPreferredCommunication(memories: MemoryCard[]): string[] {
  const preferences = new Set(["direct conclusions", "concrete verification evidence", "compact status updates"]);
  for (const memory of memories) {
    const content = memory.content.toLowerCase();
    if (content.includes("direct")) preferences.add("direct answers");
    if (content.includes("evidence") || content.includes("verification")) preferences.add("evidence-backed summaries");
    if (content.includes("compact") || content.includes("concise")) preferences.add("concise updates");
  }
  return [...preferences];
}
