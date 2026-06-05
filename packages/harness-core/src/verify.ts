import { readFile } from "node:fs/promises";

export type ObservationRecord = {
  id: string;
  run_id: string;
  action_id: string;
  timestamp: string;
  observer: string;
  summary: string;
  artifact_ref?: string;
  sensitivity: "public" | "internal" | "private" | "confidential" | "secret" | "regulated" | "credential-like";
  taint: {
    sources: string[];
    can_authorize_actions: boolean;
  };
};

export type VerificationRecord = {
  id: string;
  run_id: string;
  action_id: string;
  observation_id: string;
  expected_effect: string;
  status: "passed" | "failed" | "partial";
  summary: string;
  unexpected_side_effects?: string[];
};

export async function verifyFileContains(input: {
  runId: string;
  actionId: string;
  path: string;
  expectedText: string;
}): Promise<{ observation: ObservationRecord; verification: VerificationRecord }> {
  const contents = await readFile(input.path, "utf8");
  const passed = contents.includes(input.expectedText);
  const observation: ObservationRecord = {
    id: `obs_${input.runId}_file`,
    run_id: input.runId,
    action_id: input.actionId,
    timestamp: new Date().toISOString(),
    observer: "filesystem.read",
    summary: passed ? "Expected text found in workspace file." : "Expected text missing from workspace file.",
    artifact_ref: `artifact://${input.runId}/file_verification`,
    sensitivity: "private",
    taint: { sources: ["trusted_system"], can_authorize_actions: false }
  };
  const verification: VerificationRecord = {
    id: `verify_${input.runId}_file`,
    run_id: input.runId,
    action_id: input.actionId,
    observation_id: observation.id,
    expected_effect: `File should contain ${JSON.stringify(input.expectedText)}.`,
    status: passed ? "passed" : "failed",
    summary: passed ? "Verifier matched expected file content." : "Verifier did not match expected file content.",
    unexpected_side_effects: []
  };
  return { observation, verification };
}
