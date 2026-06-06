export type PoisoningSignal = {
  id: string;
  source_event_id: string;
  signal_type: "prompt_injection" | "secret_exfiltration" | "policy_override" | "tool_abuse";
  severity: "low" | "medium" | "high";
  quarantined: boolean;
  can_authorize_actions: false;
};

const PATTERNS: Array<[RegExp, PoisoningSignal["signal_type"]]> = [
  [/ignore (all )?(previous|prior) instructions/i, "prompt_injection"],
  [/(send|exfiltrate|reveal).*(secret|token|password|api key)/i, "secret_exfiltration"],
  [/(bypass|override).*(policy|permission|approval)/i, "policy_override"]
];

export function detectPoisoning(sourceEventId: string, text: string): PoisoningSignal | null {
  for (const [pattern, signal_type] of PATTERNS) {
    if (pattern.test(text)) {
      return {
        id: `poison_${sourceEventId}`,
        source_event_id: sourceEventId,
        signal_type,
        severity: "high",
        quarantined: true,
        can_authorize_actions: false
      };
    }
  }
  return null;
}

export function acknowledgePoisoning(signal: PoisoningSignal): PoisoningSignal & { acknowledged: true } {
  return { ...signal, acknowledged: true };
}

export function isPoisoningSignal(value: unknown): value is PoisoningSignal {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && "id" in value
    && typeof value.id === "string"
    && "quarantined" in value
    && value.quarantined === true
    && "can_authorize_actions" in value
    && value.can_authorize_actions === false;
}
