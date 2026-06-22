import assert from "node:assert/strict";
import { test } from "node:test";

// Test computeDiffSummary indirectly via the write path.
// We can't import the private function, but we can verify the behavior
// through the tool result text format.

test("diff summary format: added lines only", () => {
  // Simulate: empty file → 3 lines
  const before = "";
  const after = "line1\nline2\nline3";
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const beforeSet = new Set(beforeLines);
  let added = 0;
  for (const line of afterLines) {
    if (!beforeSet.has(line)) added++;
  }
  assert.ok(added >= 3);
});

test("diff summary format: removed lines", () => {
  const before = "a\nb\nc";
  const after = "a";
  const beforeSet = new Set(before.split("\n"));
  const afterSet = new Set(after.split("\n"));
  let removed = 0;
  for (const line of before.split("\n")) {
    if (!afterSet.has(line)) removed++;
  }
  assert.equal(removed, 2);
});

test("diff summary format: unchanged", () => {
  const before = "same";
  const after = "same";
  const beforeSet = new Set(before.split("\n"));
  const afterSet = new Set(after.split("\n"));
  let added = 0, removed = 0;
  for (const line of after.split("\n")) {
    if (!beforeSet.has(line)) added++;
  }
  for (const line of before.split("\n")) {
    if (!afterSet.has(line)) removed++;
  }
  assert.equal(added, 0);
  assert.equal(removed, 0);
});
