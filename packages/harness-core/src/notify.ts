// Cross-platform desktop notification helper.
//
// Used by the daemon to surface important events (approval requests, wakeup
// triggers, task completions) to the user via the OS notification system.
// Falls back to stdout when no native notifier is available.

import { execSync } from "node:child_process";
import { platform } from "node:os";

export type NotificationResult = {
  delivered: boolean;
  method: "osascript" | "notify-send" | "powershell" | "stdout" | "suppressed";
  error?: string;
};

// Build the platform-appropriate command for a desktop notification.
// Returns null if the platform has no supported notifier.
export function buildNotifyCommand(title: string, body: string): { command: string; args: string[] } | null {
  const os = platform();
  if (os === "darwin") {
    // macOS: osascript display notification
    const escapedTitle = title.replace(/"/g, '\\"');
    const escapedBody = body.replace(/"/g, '\\"');
    return {
      command: "osascript",
      args: ["-e", `display notification "${escapedBody}" with title "${escapedTitle}"`]
    };
  }
  if (os === "linux") {
    return {
      command: "notify-send",
      args: [title, body]
    };
  }
  if (os === "win32") {
    const escapedTitle = title.replace(/'/g, "''");
    const escapedBody = body.replace(/'/g, "''");
    return {
      command: "powershell",
      args: ["-NoProfile", "-Command", `[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; $balloon = New-Object System.Windows.Forms.NotifyIcon; $balloon.Icon = [System.Drawing.SystemIcons]::Information; $balloon.BalloonTipTitle = '${escapedTitle}'; $balloon.BalloonTipText = '${escapedBody}'; $balloon.Visible = $true; $balloon.ShowBalloonTip(5000)`]
    };
  }
  return null;
}

// Deliver a desktop notification. If --quiet mode or no notifier, writes to
// stdout instead. Never throws — notifications are best-effort.
export function notify(title: string, body: string, opts?: { quiet?: boolean; writer?: (text: string) => void }): NotificationResult {
  if (opts?.quiet) {
    return { delivered: false, method: "suppressed" };
  }
  const cmd = buildNotifyCommand(title, body);
  if (!cmd) {
    // No native notifier — fall back to stdout.
    const writer = opts?.writer ?? ((text: string) => process.stdout.write(text));
    writer(`🔔 ${title}: ${body}\n`);
    return { delivered: true, method: "stdout" };
  }
  try {
    execSync(cmd.command, [...cmd.args], { stdio: "ignore", timeout: 5000 });
    const method = cmd.command === "osascript" ? "osascript" : cmd.command === "notify-send" ? "notify-send" : "powershell";
    return { delivered: true, method };
  } catch (error) {
    // Notification failed — fall back to stdout.
    const writer = opts?.writer ?? ((text: string) => process.stdout.write(text));
    writer(`🔔 ${title}: ${body}\n`);
    return { delivered: true, method: "stdout", error: error instanceof Error ? error.message : String(error) };
  }
}
