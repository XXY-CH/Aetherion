# Phase 16 — Blob Store + Tree Snapshot

The foundation of the Git-like VCS: content-addressed storage for file blobs and tree snapshots.

## New files
- `packages/harness-core/src/vcs/blob-store.ts`
- `packages/harness-core/src/vcs/tree-snapshot.ts`
- `schemas/tree-snapshot.schema.json`

## Tests (8, TDD)
1. writeBlob stores content, returns sha256
2. readBlob retrieves content by hash
3. writeBlob is idempotent (dedup)
4. captureTreeSnapshot records all workspace files
5. captureTreeSnapshot excludes .aetherion/
6. restoreTree rewrites workspace to match snapshot
7. restoreTree creates missing + deletes extra files
8. diffTrees identifies added/modified/deleted
