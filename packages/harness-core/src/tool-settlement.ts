// Tool settlement binds every tool call to the assistant message that requested
// it and guarantees each (assistantMessageId, toolCallId) pair settles at most
// once. This is the durable-session-runner invariant that stops a duplicated or
// stale tool result — e.g. a model that re-emits the same tool_call id, or a
// replayed result from a previous turn — from being accepted twice.

export type SettlementRejection = "unknown_tool_call" | "assistant_mismatch" | "already_settled";

export type SettlementResult =
  | { ok: true }
  | { ok: false; reason: SettlementRejection };

export class ToolSettlementTracker {
  // toolCallId -> assistantMessageId it was admitted under.
  private readonly pending = new Map<string, string>();
  // toolCallId values that have already settled exactly once.
  private readonly settled = new Set<string>();

  // register admits a tool call advertised by a specific assistant message. The
  // last registration for a given id wins, so re-advertising under a new
  // assistant message rebinds it (a fresh turn).
  register(assistantMessageId: string, toolCallId: string): void {
    this.pending.set(toolCallId, assistantMessageId);
  }

  // settle records that a registered tool call has been resolved. It rejects a
  // call that was never registered, one settled against a different assistant
  // message than it was admitted under, or one already settled.
  settle(assistantMessageId: string, toolCallId: string): SettlementResult {
    const boundTo = this.pending.get(toolCallId);
    if (boundTo === undefined) {
      return { ok: false, reason: "unknown_tool_call" };
    }
    if (boundTo !== assistantMessageId) {
      return { ok: false, reason: "assistant_mismatch" };
    }
    if (this.settled.has(toolCallId)) {
      return { ok: false, reason: "already_settled" };
    }
    this.settled.add(toolCallId);
    return { ok: true };
  }

  isSettled(toolCallId: string): boolean {
    return this.settled.has(toolCallId);
  }
}
