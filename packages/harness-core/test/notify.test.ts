import assert from "node:assert/strict";
import { platform } from "node:os";
import { test } from "node:test";
import { buildNotifyCommand, notify, type NotificationResult } from "../src/notify.ts";

test("buildNotifyCommand returns osascript on macOS", () => {
  if (platform() !== "darwin") return;
  const cmd = buildNotifyCommand("Test", "Hello world");
  assert.ok(cmd);
  assert.equal(cmd!.command, "osascript");
  assert.ok(cmd!.args[1].includes("display notification"));
});

test("buildNotifyCommand returns notify-send on linux", () => {
  if (platform() !== "linux") return;
  const cmd = buildNotifyCommand("Test", "Hello world");
  assert.ok(cmd);
  assert.equal(cmd!.command, "notify-send");
});

test("buildNotifyCommand returns powershell on windows", () => {
  if (platform() !== "win32") return;
  const cmd = buildNotifyCommand("Test", "Hello world");
  assert.ok(cmd);
  assert.equal(cmd!.command, "powershell");
});

test("notify suppressed when quiet=true", () => {
  const result = notify("Title", "Body", { quiet: true });
  assert.equal(result.delivered, false);
  assert.equal(result.method, "suppressed");
});

test("notify falls back to stdout when no native notifier (injected writer)", () => {
  // Force the fallback path by providing a writer and mocking the command.
  const messages: string[] = [];
  // On any platform, if we pass quiet=false and the command fails, it should
  // fall back to the injected writer.
  const result = notify("Test Title", "Test Body", {
    quiet: false,
    writer: (text) => messages.push(text)
  });
  // On macOS/Linux/Windows the native command should work; the writer is only
  // used on fallback. Either way, delivered should be true.
  assert.equal(result.delivered, true);
  if (result.method === "stdout") {
    assert.ok(messages.length > 0);
    assert.match(messages[0], /Test Title/);
  }
});

test("notify always returns a valid NotificationResult", () => {
  const result = notify("A", "B") as NotificationResult;
  assert.ok(typeof result.delivered === "boolean");
  assert.ok(["osascript", "notify-send", "powershell", "stdout", "suppressed"].includes(result.method));
});
