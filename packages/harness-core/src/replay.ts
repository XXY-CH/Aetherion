import { readEvents } from "./ledger.ts";
import type { Workspace } from "./ledger.ts";

export type ReconstructedTrace = {
  run_id: string;
  event_count: number;
  event_types: string[];
  live_side_effects_replayed: false;
};

export async function reconstructTrace(workspace: Workspace, runId: string): Promise<ReconstructedTrace> {
  const events = (await readEvents(workspace)).filter((event) => event.run_id === runId);
  return {
    run_id: runId,
    event_count: events.length,
    event_types: events.map((event) => event.event_type),
    live_side_effects_replayed: false
  };
}
