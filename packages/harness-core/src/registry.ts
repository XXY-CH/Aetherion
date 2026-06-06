import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type RegistryItem = Record<string, unknown> & {
  id: string;
};

export function registryPath(workspaceRoot: string, name: string): string {
  return join(workspaceRoot, ".aetherion", "registries", `${name}.json`);
}

export function readRegistry(workspaceRoot: string, name: string): RegistryItem[] {
  const path = registryPath(workspaceRoot, name);
  if (!existsSync(path)) {
    return [];
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Registry ${name} is not an array`);
  }
  return parsed.filter(isRegistryItem);
}

export function upsertRegistryItem(workspaceRoot: string, name: string, item: RegistryItem): RegistryItem[] {
  const items = readRegistry(workspaceRoot, name);
  const existingIndex = items.findIndex((entry) => entry.id === item.id);
  const next = existingIndex >= 0
    ? items.toSpliced(existingIndex, 1, item)
    : [...items, item];
  const path = registryPath(workspaceRoot, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export function upsertRegistryItems(workspaceRoot: string, name: string, items: RegistryItem[]): RegistryItem[] {
  let latest = readRegistry(workspaceRoot, name);
  for (const item of items) {
    const existingIndex = latest.findIndex((entry) => entry.id === item.id);
    latest = existingIndex >= 0
      ? latest.toSpliced(existingIndex, 1, item)
      : [...latest, item];
  }
  const path = registryPath(workspaceRoot, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(latest, null, 2)}\n`);
  return latest;
}

export function isRegistryItem(value: unknown): value is RegistryItem {
  return value !== null && typeof value === "object" && !Array.isArray(value) && "id" in value && typeof value.id === "string";
}
