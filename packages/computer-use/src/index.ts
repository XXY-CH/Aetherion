export type ComputerUseTarget =
  | { kind: "browser"; origin: string; selector?: string; label?: string; current_tab_only?: boolean }
  | { kind: "desktop"; window_title?: string; label?: string }
  | { kind: "file"; path: string }
  | { kind: "sandbox"; command: string };

export type ComputerUseChannel =
  | "browser_dom"
  | "browser_cdp"
  | "browser_screenshot"
  | "desktop_accessibility"
  | "desktop_screenshot"
  | "shell"
  | "file"
  | "sandbox";

export type ComputerUseIntent = {
  id: string;
  run_id: string;
  verb: "observe" | "click" | "type" | "read" | "write" | "execute";
  target: ComputerUseTarget;
  expected_effect: string;
  target_confidence: number;
  data_egress_destination: string;
  taint_chain: string[];
  source_event_ids?: string[];
};

export type ComputerUseAdapterManifest = {
  id: string;
  kind: "browser" | "desktop" | "file" | "sandbox";
  lifecycle: "draft" | "quarantined" | "staged" | "active";
  requirements_gate: {
    feature: "browser_use" | "desktop_use" | "computer_use";
    enabled_by_requirements: true;
    enabled_by_user_config: false;
    source_event_ids: string[];
  };
  supported_verbs: ComputerUseIntent["verb"][];
  channels: ComputerUseChannel[];
  requires_policy_lease: true;
  can_read_sensitive_data: boolean;
  can_create_side_effects: boolean;
};

export type ComputerUseAuthority = {
  policy_decision_id: string;
  lease_id?: string;
  approval_card_id?: string;
};

export type ComputerUsePlan = {
  intent: ComputerUseIntent;
  adapter: ComputerUseAdapterManifest;
  channel: ComputerUseChannel;
  structured_first: true;
  screenshot_fallback_allowed: boolean;
  authority: ComputerUseAuthority;
  policy_required: true;
  verifier_required: true;
  live_replay_allowed: false;
  can_authorize_from_observation: false;
  approval_keys: string[];
};

const sideEffectVerbs = new Set<ComputerUseIntent["verb"]>(["click", "type", "write", "execute"]);

export function planComputerUse(
  intent: ComputerUseIntent,
  adapter: ComputerUseAdapterManifest,
  authority: ComputerUseAuthority = { policy_decision_id: "policy_required" }
): ComputerUsePlan {
  if (adapter.lifecycle !== "active" && adapter.lifecycle !== "staged") {
    throw new Error(`Computer-use adapter ${adapter.id} is not executable while ${adapter.lifecycle}`);
  }
  if (adapter.requirements_gate.enabled_by_requirements !== true || adapter.requirements_gate.enabled_by_user_config !== false) {
    throw new Error(`Computer-use adapter ${adapter.id} must be enabled by requirements, not user config`);
  }
  if (adapter.requirements_gate.source_event_ids.length === 0) {
    throw new Error(`Computer-use adapter ${adapter.id} requirements gate must cite source events`);
  }
  if (adapter.requires_policy_lease !== true) {
    throw new Error(`Computer-use adapter ${adapter.id} must require a scoped policy lease`);
  }
  if (!adapter.supported_verbs.includes(intent.verb)) {
    throw new Error(`Computer-use adapter ${adapter.id} does not support ${intent.verb}`);
  }
  if (intent.target_confidence < 0.8) {
    throw new Error(`Computer-use target confidence too low: ${intent.target_confidence}`);
  }
  if (intent.taint_chain.length > 0 && intent.data_egress_destination !== "local_artifact_store" && intent.data_egress_destination !== "none") {
    throw new Error("Tainted computer-use observations cannot be routed to external egress destinations");
  }
  if (sideEffectVerbs.has(intent.verb) && !authority.lease_id) {
    throw new Error(`Computer-use ${intent.verb} requires a scoped lease`);
  }
  if (sideEffectVerbs.has(intent.verb) && adapter.can_create_side_effects && !authority.approval_card_id) {
    throw new Error(`Computer-use ${intent.verb} requires an approval card before side effects`);
  }
  if (intent.target.kind === "browser") {
    if (!intent.target.origin.startsWith("http://") && !intent.target.origin.startsWith("https://")) {
      throw new Error("Browser computer-use targets must use http(s) origins");
    }
    if (intent.target.current_tab_only !== true) {
      throw new Error("Browser computer-use targets must be current-tab scoped");
    }
  }
  const channel = selectChannel(intent, adapter);
  const screenshot_fallback_allowed = channel === "browser_cdp" || channel === "desktop_accessibility";
  return {
    intent,
    adapter,
    channel,
    structured_first: true,
    screenshot_fallback_allowed,
    authority,
    policy_required: true,
    verifier_required: true,
    live_replay_allowed: false,
    can_authorize_from_observation: false,
    approval_keys: approvalKeysForIntent(intent, adapter)
  };
}

export function approvalKeysForIntent(intent: ComputerUseIntent, adapter: ComputerUseAdapterManifest): string[] {
  if (!sideEffectVerbs.has(intent.verb)) {
    return [];
  }
  const target = intent.target;
  if (target.kind === "browser") {
    return [`${adapter.id}:browser:${intent.verb}:${target.origin}:${target.selector ?? target.label ?? "unscoped"}`];
  }
  if (target.kind === "desktop") {
    return [`${adapter.id}:desktop:${intent.verb}:${target.window_title ?? target.label ?? "unscoped"}`];
  }
  if (target.kind === "file") {
    return [`${adapter.id}:file:${intent.verb}:${target.path}`];
  }
  return [`${adapter.id}:sandbox:${intent.verb}:${target.command}`];
}

function selectChannel(intent: ComputerUseIntent, adapter: ComputerUseAdapterManifest): ComputerUseChannel {
  const preferred = preferredChannels(intent.target.kind, intent.verb);
  const channel = preferred.find((candidate) => adapter.channels.includes(candidate));
  if (!channel) {
    throw new Error(`Computer-use adapter ${adapter.id} has no governed channel for ${intent.target.kind}:${intent.verb}`);
  }
  if (channel.endsWith("_screenshot") && intent.verb !== "observe" && intent.target_confidence < 0.95) {
    throw new Error("Raw screenshot-driven actions require very high target confidence");
  }
  return channel;
}

function preferredChannels(kind: ComputerUseTarget["kind"], verb: ComputerUseIntent["verb"]): ComputerUseChannel[] {
  if (kind === "browser") {
    if (verb === "observe" || verb === "read") {
      return ["browser_dom", "browser_cdp", "browser_screenshot"];
    }
    return ["browser_cdp", "browser_dom", "browser_screenshot"];
  }
  if (kind === "desktop") {
    return ["desktop_accessibility", "desktop_screenshot"];
  }
  if (kind === "file") {
    return ["file"];
  }
  return ["sandbox", "shell"];
}
