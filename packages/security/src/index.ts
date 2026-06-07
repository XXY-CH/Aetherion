import { createHash, randomUUID } from "node:crypto";

export type UntrustedSource =
  | "public_web"
  | "email"
  | "pdf"
  | "im"
  | "github_issue"
  | "mcp_description"
  | "third_party_content";

export type TaintRecord = {
  sources: UntrustedSource[];
  can_authorize_actions: false;
};

export type PoisoningSignalType =
  | "prompt_injection"
  | "secret_exfiltration"
  | "policy_override"
  | "tool_abuse";

export type ContentAssessment = {
  id: string;
  source_event_id: string;
  source_kind: UntrustedSource;
  content_sha256: string;
  status: "clean" | "suspicious";
  matched_rules: string[];
  taint: TaintRecord;
  raw_content_persisted: false;
  created_at: string;
};

export type PoisoningSignal = {
  id: string;
  assessment_id: string;
  source_event_id: string;
  source_kind: UntrustedSource;
  content_sha256: string;
  signal_type: PoisoningSignalType;
  severity: "medium" | "high" | "critical";
  matched_rules: string[];
  status: "detected" | "acknowledged";
  quarantined: true;
  sandbox_required: true;
  can_authorize_actions: false;
  acknowledged_at: string | null;
  regression_fixture_id: string | null;
  created_at: string;
};

export type HoneypotTrial = {
  id: string;
  signal_id: string;
  source_event_ids: string[];
  subject: {
    kind: "content" | "capsule";
    id: string;
  };
  mode: "deterministic_decoy_trial";
  decoy_secret_refs: string[];
  real_secret_accessed: false;
  network_accessed: false;
  authorization_issued: false;
  observed_attempts: PoisoningSignalType[];
  outcome: "contained";
  quarantine_recommended: true;
  capsule_quarantined: boolean;
  created_at: string;
};

export type PoisoningRegressionFixture = {
  id: string;
  signal_id: string;
  source_event_ids: string[];
  input_sha256: string;
  replay_mode: "detector_only";
  expected_signal_type: PoisoningSignalType;
  expected_matched_rules: string[];
  expected_authorization_blocked: true;
  raw_content_included: false;
  created_at: string;
};

type DetectionRule = {
  id: string;
  signalType: PoisoningSignalType;
  severity: PoisoningSignal["severity"];
  pattern: RegExp;
};

const DETECTION_RULES: DetectionRule[] = [
  {
    id: "rule_prompt_ignore_prior",
    signalType: "prompt_injection",
    severity: "high",
    pattern: /\bignore\s+(?:all\s+)?(?:previous|prior|system)\s+(?:instructions?|messages?|prompts?)\b/i
  },
  {
    id: "rule_secret_exfiltration",
    signalType: "secret_exfiltration",
    severity: "critical",
    pattern: /\b(?:send|upload|exfiltrate|reveal|print|return)\b[\s\S]{0,120}\b(?:secret|token|password|api[ _-]?key|credential)\b/i
  },
  {
    id: "rule_policy_override",
    signalType: "policy_override",
    severity: "critical",
    pattern: /\b(?:bypass|disable|override|ignore)\b[\s\S]{0,100}\b(?:policy|permission|approval|sandbox|guardrail)\b/i
  },
  {
    id: "rule_tool_abuse",
    signalType: "tool_abuse",
    severity: "high",
    pattern: /\b(?:run|execute|invoke|call)\b[\s\S]{0,100}\b(?:shell|terminal|payment|vault|filesystem\.write|network)\b/i
  }
];

const SEVERITY_ORDER: PoisoningSignal["severity"][] = ["medium", "high", "critical"];

export function taintForUntrustedSource(source: UntrustedSource): TaintRecord {
  return { sources: [source], can_authorize_actions: false };
}

export function assertTaintCannotAuthorize(taint: { sources: string[]; can_authorize_actions: boolean }): void {
  if (taint.sources.some((source) => isUntrustedSource(source)) && taint.can_authorize_actions) {
    throw new Error("Tainted external content cannot authorize actions");
  }
}

export function scanUntrustedContent(input: {
  sourceEventId: string;
  sourceKind: UntrustedSource;
  text: string;
}): ContentAssessment {
  const digest = sha256(input.text);
  const matchedRules = DETECTION_RULES
    .filter((rule) => rule.pattern.test(input.text))
    .map((rule) => rule.id);
  const assessment: ContentAssessment = {
    id: `assessment_${shortId(input.sourceEventId)}_${digest.slice(7, 19)}_${randomUUID().slice(0, 8)}`,
    source_event_id: input.sourceEventId,
    source_kind: input.sourceKind,
    content_sha256: digest,
    status: matchedRules.length > 0 ? "suspicious" : "clean",
    matched_rules: matchedRules,
    taint: taintForUntrustedSource(input.sourceKind),
    raw_content_persisted: false,
    created_at: new Date().toISOString()
  };
  assertTaintCannotAuthorize(assessment.taint);
  return assessment;
}

export function signalFromAssessment(assessment: ContentAssessment): PoisoningSignal | null {
  if (assessment.status !== "suspicious") {
    return null;
  }
  const matched = DETECTION_RULES.filter((rule) => assessment.matched_rules.includes(rule.id));
  const primary = matched.reduce((selected, candidate) =>
    SEVERITY_ORDER.indexOf(candidate.severity) > SEVERITY_ORDER.indexOf(selected.severity)
      ? candidate
      : selected
  );
  return {
    id: `poison_${shortId(assessment.source_event_id)}_${assessment.content_sha256.slice(7, 19)}_${randomUUID().slice(0, 8)}`,
    assessment_id: assessment.id,
    source_event_id: assessment.source_event_id,
    source_kind: assessment.source_kind,
    content_sha256: assessment.content_sha256,
    signal_type: primary.signalType,
    severity: primary.severity,
    matched_rules: assessment.matched_rules,
    status: "detected",
    quarantined: true,
    sandbox_required: true,
    can_authorize_actions: false,
    acknowledged_at: null,
    regression_fixture_id: null,
    created_at: new Date().toISOString()
  };
}

export function detectPoisoning(sourceEventId: string, text: string): PoisoningSignal | null {
  return signalFromAssessment(scanUntrustedContent({
    sourceEventId,
    sourceKind: "third_party_content",
    text
  }));
}

export function acknowledgePoisoning(signal: PoisoningSignal): PoisoningSignal {
  return {
    ...signal,
    status: "acknowledged",
    acknowledged_at: new Date().toISOString()
  };
}

export function runHoneypotTrial(signal: PoisoningSignal, capsuleId?: string): HoneypotTrial {
  return {
    id: `honeypot_${sanitize(signal.id)}_${randomUUID().slice(0, 8)}`,
    signal_id: signal.id,
    source_event_ids: [signal.source_event_id],
    subject: {
      kind: capsuleId ? "capsule" : "content",
      id: capsuleId ?? signal.assessment_id
    },
    mode: "deterministic_decoy_trial",
    decoy_secret_refs: [`decoy://honeypot/${sanitize(signal.id)}/credential`],
    real_secret_accessed: false,
    network_accessed: false,
    authorization_issued: false,
    observed_attempts: [signal.signal_type],
    outcome: "contained",
    quarantine_recommended: true,
    capsule_quarantined: Boolean(capsuleId),
    created_at: new Date().toISOString()
  };
}

export function createPoisoningRegressionFixture(signal: PoisoningSignal): {
  signal: PoisoningSignal;
  fixture: PoisoningRegressionFixture;
} {
  const fixtureId = `poison_fixture_${sanitize(signal.id)}`;
  return {
    signal: {
      ...signal,
      regression_fixture_id: fixtureId
    },
    fixture: {
      id: fixtureId,
      signal_id: signal.id,
      source_event_ids: [signal.source_event_id],
      input_sha256: signal.content_sha256,
      replay_mode: "detector_only",
      expected_signal_type: signal.signal_type,
      expected_matched_rules: [...signal.matched_rules],
      expected_authorization_blocked: true,
      raw_content_included: false,
      created_at: new Date().toISOString()
    }
  };
}

export function isPoisoningSignal(value: unknown): value is PoisoningSignal {
  return isObject(value)
    && typeof value.id === "string"
    && value.quarantined === true
    && value.sandbox_required === true
    && value.can_authorize_actions === false
    && typeof value.content_sha256 === "string"
    && Array.isArray(value.matched_rules);
}

export function isUntrustedSource(value: string): value is UntrustedSource {
  return [
    "public_web",
    "email",
    "pdf",
    "im",
    "github_issue",
    "mcp_description",
    "third_party_content"
  ].includes(value);
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 100);
}

function shortId(value: string): string {
  return sanitize(value).slice(0, 48);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
