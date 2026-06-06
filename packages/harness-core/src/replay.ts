import { readEvents, verifyEventHashChain } from "./ledger.ts";
import type { Workspace } from "./ledger.ts";

export type ReconstructedTrace = {
  run_id: string;
  event_count: number;
  event_types: string[];
  head_event_id?: string;
  head_event_hash?: string;
  chain_valid: boolean;
  live_side_effects_replayed: false;
};

export type ReplayRecord = {
  id: string;
  run_id: string;
  mode: "trace" | "simulation" | "live";
  source_events: string[];
  fixture_ref?: string;
  live_side_effects: {
    allowed: boolean;
    approval_id: string | null;
  };
  result: {
    status: "passed" | "failed" | "partial";
    summary: string;
  };
};

export async function reconstructTrace(workspace: Workspace, runId: string): Promise<ReconstructedTrace> {
  const events = (await readEvents(workspace)).filter((event) => event.run_id === runId);
  return {
    run_id: runId,
    event_count: events.length,
    event_types: events.map((event) => event.event_type),
    head_event_id: events.at(-1)?.id,
    head_event_hash: events.at(-1)?.event_hash,
    chain_valid: verifyEventHashChain(events).valid,
    live_side_effects_replayed: false
  };
}

export async function createTraceReplayRecord(workspace: Workspace, runId: string): Promise<ReplayRecord> {
  const events = (await readEvents(workspace)).filter((event) => event.run_id === runId);
  if (events.length === 0) {
    throw new Error(`Cannot create replay record for ${runId} without source events`);
  }
  const trace = await reconstructTrace(workspace, runId);
  return {
    id: `replay_${runId}_trace`,
    run_id: runId,
    mode: "trace",
    source_events: events.map((event) => event.id),
    fixture_ref: `artifact://replay/${runId}/trace`,
    live_side_effects: {
      allowed: false,
      approval_id: null
    },
    result: {
      status: trace.chain_valid ? "passed" : "partial",
      summary: trace.chain_valid
        ? "Trace reconstructed without live tool calls."
        : "Trace reconstructed without live tool calls, but event hash chain did not fully validate."
    }
  };
}
