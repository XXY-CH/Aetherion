# Phase 11 — Desktop Notifications + Outbound Delivery

Alignment: doc 17 P2-7 + P2-9. The daemon can run in the background, but when something important happens (approval request, wakeup trigger, task completion), the user has no way to know unless they're watching stdout. OS-native notifications bridge this.

## Scope (minimum viable)

1. **`notify()` function**: cross-platform desktop notification. macOS → `osascript display notification`, Linux → `notify-send`, Windows → PowerShell toast. Falls back to stdout if no notifier available.
2. **Wire into daemon**: call `notify()` on three event types:
   - `tool_proposal` (L3+ approval needed)
   - wakeup trigger eligible
   - `loop_complete` with tool calls > 0 (task finished)
3. **`--quiet` flag**: suppress notifications (for piped/headless usage).
4. **Local outbound delivery**: daemon emits a `notification` JSON-lines event that consumers (TUI, future IM adapters) can subscribe to.

## Tests

1. `notify returns the platform-appropriate command`
2. `notify falls back to stdout when no notifier`
3. `daemon emits notification event on tool_proposal`
4. `daemon emits notification event on wakeup trigger`
5. `--quiet suppresses notifications`

## Out of scope
- Real IM delivery (Telegram/Slack).
- APNs/web push.
- Notification center integration.
- Notification history persistence.
