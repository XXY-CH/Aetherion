// Content-addressed blob store for the VCS layer.
//
// Blobs are stored as raw file content under .aetherion/objects/sha256_<hex>.
// Deduplication is automatic: identical content produces the same hash, so
// writing the same content twice is a no-op.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

function objectsDir(workspaceRoot: string): string {
  return join(workspaceRoot, ".aetherion", "objects");
}

function blobPath(workspaceRoot: string, hash: string): string {
  return join(objectsDir(workspaceRoot), hash.replace("sha256:", "sha256_"));
}

// Compute sha256 hash of content, prefixed with "sha256:".
export function hashContent(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

// Write content to the blob store. Returns the sha256 hash.
// Idempotent: if the blob already exists, it is not rewritten.
export function writeBlob(workspaceRoot: string, content: string): string {
  const hash = hashContent(content);
  const path = blobPath(workspaceRoot, hash);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  }
  return hash;
}

// Read blob content by hash. Throws if not found.
export function readBlob(workspaceRoot: string, hash: string): string {
  const path = blobPath(workspaceRoot, hash);
  return readFileSync(path, "utf8");
}

// Check if a blob exists in the store.
export function blobExists(workspaceRoot: string, hash: string): boolean {
  return existsSync(blobPath(workspaceRoot, hash));
}
