# Phase 28 — File Edit Tool

Alignment: doc 17 #7 (tool execution). The agent has `local_file_write` (full file overwrite) but no surgical edit tool. OpenCode has `edit` (search-and-replace), Codex has `apply_patch`. This is the #1 missing tool for coding agents.

## Scope

1. Declare `file_edit` tool (verb=write, L3, approval required).
2. Parameters: `path`, `old_text`, `new_text` — finds `old_text` in the file and replaces with `new_text`.
3. If `old_text` not found → error result. If multiple matches → error (ambiguous).
4. Reuses the write pipeline (consent, lease, verification, VCS snapshot).
5. Result includes diff summary.

## Tests
1. `file_edit replaces exact match in file`
2. `file_edit returns error when old_text not found`
3. `file_edit returns error on multiple matches`
4. `file_edit creates file when file doesn't exist and old_text is empty`
5. `file_edit goes through approval pipeline`
