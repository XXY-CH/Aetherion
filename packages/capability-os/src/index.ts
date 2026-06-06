export type Capsule = {
  id: string;
  lifecycle: "draft" | "tested" | "published" | "deprecated" | "quarantined";
  sandbox_required: boolean;
  permission_diff: string[];
  replay_tests_passed: boolean;
  permissions_inherited: false;
  scoring: {
    success: number;
    correction: number;
    tool_error: number;
    policy_denial: number;
  };
};

export function createDraftCapsule(id: string, permissionDiff: string[] = []): Capsule {
  return {
    id,
    lifecycle: "draft",
    sandbox_required: true,
    permission_diff: permissionDiff,
    replay_tests_passed: false,
    permissions_inherited: false,
    scoring: { success: 0, correction: 0, tool_error: 0, policy_denial: 0 }
  };
}

export function publishCapsule(capsule: Capsule): Capsule {
  if (!capsule.sandbox_required) {
    throw new Error("Capsules with executable code require sandbox trials");
  }
  if (!capsule.replay_tests_passed) {
    throw new Error("Replay tests must pass before publish");
  }
  if (capsule.permission_diff.length > 0) {
    throw new Error("Permission expansion requires approval card before publish");
  }
  return { ...capsule, lifecycle: "published" };
}

export function recordCapsuleScore(capsule: Capsule, key: keyof Capsule["scoring"]): Capsule {
  return { ...capsule, scoring: { ...capsule.scoring, [key]: capsule.scoring[key] + 1 } };
}

export function findCapsule(capsules: Capsule[], id: string): Capsule | undefined {
  return capsules.find((capsule) => capsule.id === id);
}

export function requireCapsule(capsules: Capsule[], id: string): Capsule {
  const capsule = findCapsule(capsules, id);
  if (!capsule) {
    throw new Error(`Capsule ${id} not found`);
  }
  return capsule;
}

export function isCapsule(value: unknown): value is Capsule {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && "id" in value
    && typeof value.id === "string"
    && "lifecycle" in value
    && typeof value.lifecycle === "string";
}
