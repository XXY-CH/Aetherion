export type ComputerUseTarget =
  | { kind: "browser"; origin: string; selector?: string; label?: string }
  | { kind: "desktop"; window_title?: string; label?: string }
  | { kind: "file"; path: string }
  | { kind: "sandbox"; command: string };

export type ComputerUseIntent = {
  id: string;
  run_id: string;
  verb: "observe" | "click" | "type" | "read" | "write" | "execute";
  target: ComputerUseTarget;
  expected_effect: string;
  target_confidence: number;
  data_egress_destination: string;
  taint_chain: string[];
};

export type ComputerUseAdapterManifest = {
  id: string;
  kind: "browser" | "desktop" | "file" | "sandbox";
  lifecycle: "draft" | "quarantined" | "staged" | "active";
  supported_verbs: ComputerUseIntent["verb"][];
  requires_policy_lease: true;
  can_read_sensitive_data: boolean;
  can_create_side_effects: boolean;
};

export type ComputerUsePlan = {
  intent: ComputerUseIntent;
  adapter: ComputerUseAdapterManifest;
  policy_required: true;
  verifier_required: true;
  live_replay_allowed: false;
};

export function planComputerUse(intent: ComputerUseIntent, adapter: ComputerUseAdapterManifest): ComputerUsePlan {
  if (adapter.lifecycle !== "active" && adapter.lifecycle !== "staged") {
    throw new Error(`Computer-use adapter ${adapter.id} is not executable while ${adapter.lifecycle}`);
  }
  if (!adapter.supported_verbs.includes(intent.verb)) {
    throw new Error(`Computer-use adapter ${adapter.id} does not support ${intent.verb}`);
  }
  if (intent.target_confidence < 0.8) {
    throw new Error(`Computer-use target confidence too low: ${intent.target_confidence}`);
  }
  return {
    intent,
    adapter,
    policy_required: true,
    verifier_required: true,
    live_replay_allowed: false
  };
}
