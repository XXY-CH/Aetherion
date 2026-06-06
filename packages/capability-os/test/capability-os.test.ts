import assert from "node:assert/strict";
import { test } from "node:test";
import { createDraftCapsule, publishCapsule, recordCapsuleScore } from "../src/index.ts";

test("capsules cannot publish without replay tests or permission approval", () => {
  const draft = createDraftCapsule("cap_refactor", ["filesystem.write"]);
  assert.equal(draft.permissions_inherited, false);
  assert.throws(() => publishCapsule(draft), /Replay tests/);
  const tested = { ...draft, replay_tests_passed: true };
  assert.throws(() => publishCapsule(tested), /Permission expansion/);
  const approved = { ...tested, permission_diff: [] };
  assert.equal(publishCapsule(approved).lifecycle, "published");
  assert.equal(recordCapsuleScore(approved, "policy_denial").scoring.policy_denial, 1);
});
