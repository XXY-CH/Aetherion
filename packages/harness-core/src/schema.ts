import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type JsonSchema = Record<string, unknown>;

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export async function loadSchema(repoRoot: string, name: string): Promise<JsonSchema> {
  const raw = await readFile(join(repoRoot, "schemas", name), "utf8");
  return JSON.parse(raw) as JsonSchema;
}

export async function validateAgainstSchema(repoRoot: string, schemaName: string, value: unknown): Promise<ValidationResult> {
  const schema = await loadSchema(repoRoot, schemaName);
  return validateValue(value, schema, "$", { repoRoot, rootSchema: schema });
}

type ValidateContext = {
  repoRoot: string;
  rootSchema: JsonSchema;
};

function validateValue(value: unknown, schema: JsonSchema, path: string, context: ValidateContext): ValidationResult {
  const errors: string[] = [];

  if (typeof schema.$ref === "string") {
    if (schema.$ref.startsWith("#/")) {
      const resolved = resolveLocalRef(context.rootSchema, schema.$ref);
      if (!isObject(resolved)) {
        errors.push(`${path}: unresolved schema ref ${schema.$ref}`);
        return { valid: false, errors };
      }
      return validateValue(value, resolved, path, context);
    }
    if (schema.$ref === "memory-card.schema.json") {
      // The lightweight validator only resolves the one local ref currently used by seed schemas.
      // Runtime code can replace this with a full JSON Schema implementation later.
      const memoryCardSchema = cachedSchemas.get("memory-card.schema.json");
      if (!memoryCardSchema) {
        errors.push(`${path}: unresolved schema ref ${schema.$ref}`);
        return { valid: false, errors };
      }
      return validateValue(value, memoryCardSchema, path, context);
    }
    errors.push(`${path}: unsupported schema ref ${schema.$ref}`);
    return { valid: false, errors };
  }

  const type = schema.type;
  if (type !== undefined && !matchesType(value, type)) {
    errors.push(`${path}: expected type ${JSON.stringify(type)}, got ${Array.isArray(value) ? "array" : typeof value}`);
    return { valid: false, errors };
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${path}: expected one of ${schema.enum.join(", ")}`);
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push(`${path}: expected minLength ${schema.minLength}`);
    }
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: does not match pattern ${schema.pattern}`);
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push(`${path}: below minimum ${schema.minimum}`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push(`${path}: above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push(`${path}: expected at least ${schema.minItems} items`);
    }
    if (isObject(schema.items)) {
      for (const [index, item] of value.entries()) {
        errors.push(...validateValue(item, schema.items, `${path}[${index}]`, context).errors);
      }
    }
  }

  if (isPlainObject(value)) {
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (typeof key === "string" && !(key in value)) {
        errors.push(`${path}.${key}: missing required property`);
      }
    }

    const properties = isObject(schema.properties) ? schema.properties : {};
    for (const [key, childValue] of Object.entries(value)) {
      const childSchema = properties[key];
      if (isObject(childSchema)) {
        errors.push(...validateValue(childValue, childSchema, `${path}.${key}`, context).errors);
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}.${key}: additional property not allowed`);
      } else if (isObject(schema.additionalProperties)) {
        errors.push(...validateValue(childValue, schema.additionalProperties, `${path}.${key}`, context).errors);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export const cachedSchemas = new Map<string, JsonSchema>();

export async function primeSchemaCache(repoRoot: string): Promise<void> {
  cachedSchemas.set("memory-card.schema.json", await loadSchema(repoRoot, "memory-card.schema.json"));
}

function matchesType(value: unknown, type: unknown): boolean {
  if (Array.isArray(type)) {
    return type.some((entry) => matchesType(value, entry));
  }
  switch (type) {
    case "object":
      return isPlainObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return true;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isObject(value: unknown): value is JsonSchema {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolveLocalRef(rootSchema: JsonSchema, ref: string): unknown {
  const parts = ref
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  let current: unknown = rootSchema;
  for (const part of parts) {
    if (!isPlainObject(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}
