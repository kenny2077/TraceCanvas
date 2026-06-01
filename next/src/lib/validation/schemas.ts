/**
 * Lightweight request validation — no zod dependency.
 *
 * Design:
 *   - Schema-driven: each route defines a FieldSchema[] array.
 *   - Type-safe: validateJsonRequest returns a typed object.
 *   - Consistent errors: all failures return { error, details }.
 *   - No runtime dependencies outside Node.js stdlib.
 *
 * Why not zod:
 *   - Only 6 POST routes need validation.
 *   - zod adds ~12 KB gzipped for features (transform, refine, union)
 *     that this project doesn't need.
 *   - A hand-rolled validator is ~100 lines and trivially auditable.
 */

import { NextRequest, NextResponse } from "next/server";

// ─── Schema Types ────────────────────────────────────────────────────

export type FieldType = "string" | "number" | "boolean" | "object" | "array";

export type FieldSchema = {
  /** JSON key in the request body. */
  name: string;
  /** Expected type. */
  type: FieldType;
  /** If true, the field must be present and non-empty (for strings). */
  required?: boolean;
  /** Default value if missing (only for non-required fields). */
  default?: unknown;
  /** Maximum string length (bytes). Ignored for non-string types. */
  maxLength?: number;
  /** For string fields: allowed values (enum). */
  allowed?: string[];
};

export type ValidationError = {
  field: string;
  message: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationError[] };

// ─── Validator ───────────────────────────────────────────────────────

/**
 * Parse and validate a JSON request body against a schema.
 *
 * Returns either `{ ok: true, value: T }` with a typed object,
 * or `{ ok: false, errors }` with per-field error messages.
 *
 * Usage in route:
 *   const result = await validateJsonRequest<MyBody>(req, MySchema);
 *   if (!result.ok) return badRequest(result.errors);
 *   const { agent, content } = result.value; // fully typed
 */
export async function validateJsonRequest<T extends Record<string, unknown>>(
  req: NextRequest,
  schema: FieldSchema[],
): Promise<ValidationResult<T>> {
  // ── Parse JSON ──────────────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      errors: [{ field: "(body)", message: "Request body is not valid JSON." }],
    };
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ field: "(body)", message: "Request body must be a JSON object." }],
    };
  }

  const body = raw as Record<string, unknown>;
  const errors: ValidationError[] = [];
  const result: Record<string, unknown> = {};

  // ── Validate each field ─────────────────────────────────────────
  for (const field of schema) {
    const rawValue = body[field.name];

    // Required check
    if (field.required && (rawValue === undefined || rawValue === null)) {
      errors.push({
        field: field.name,
        message: `${field.name} is required.`,
      });
      continue;
    }

    // Use default if missing
    if (rawValue === undefined || rawValue === null) {
      if (field.default !== undefined) {
        result[field.name] = field.default;
      }
      continue;
    }

    // Type check
    const actualType = typeof rawValue;
    if (!checkType(rawValue, field.type)) {
      errors.push({
        field: field.name,
        message: `${field.name} must be a ${field.type}, got ${actualType}.`,
      });
      continue;
    }

    // String-specific checks
    if (field.type === "string" && typeof rawValue === "string") {
      // Length check
      if (field.maxLength !== undefined && rawValue.length > field.maxLength) {
        errors.push({
          field: field.name,
          message: `${field.name} must be at most ${field.maxLength} characters (got ${rawValue.length}).`,
        });
        continue;
      }

      // Empty check for required strings
      if (field.required && rawValue.trim() === "") {
        errors.push({
          field: field.name,
          message: `${field.name} must not be empty.`,
        });
        continue;
      }

      // Allowed values (enum)
      if (field.allowed && !field.allowed.includes(rawValue)) {
        errors.push({
          field: field.name,
          message: `${field.name} must be one of: ${field.allowed.join(", ")}. Got "${rawValue}".`,
        });
        continue;
      }
    }

    // Number-specific checks
    if (field.type === "number") {
      if (typeof rawValue !== "number" || isNaN(rawValue)) {
        errors.push({
          field: field.name,
          message: `${field.name} must be a valid number.`,
        });
        continue;
      }
    }

    result[field.name] = rawValue;
  }

  // ── Check for unknown fields ────────────────────────────────────
  const knownFields = new Set(schema.map((f) => f.name));
  for (const key of Object.keys(body)) {
    if (!knownFields.has(key)) {
      errors.push({
        field: key,
        message: `Unknown field: "${key}".`,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: result as T };
}

/**
 * Build a standard 400 response from validation errors.
 */
export function badRequest(errors: ValidationError[]): NextResponse {
  return NextResponse.json(
    {
      error: "Validation failed",
      details: errors,
    },
    { status: 400 },
  );
}

// ─── Type Checker ────────────────────────────────────────────────────

function checkType(value: unknown, expected: FieldType): boolean {
  const actual = typeof value;
  switch (expected) {
    case "string":
      return actual === "string";
    case "number":
      return actual === "number" && !isNaN(value as number);
    case "boolean":
      return actual === "boolean";
    case "object":
      return actual === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
  }
}

// ─── Schemas ─────────────────────────────────────────────────────────

// ── Convert ────────────────────────────────────────────────────

export const ConvertRequestSchema: FieldSchema[] = [
  { name: "agent", type: "string", required: true, maxLength: 100 },
  { name: "templateId", type: "string", required: true, maxLength: 200 },
  { name: "content", type: "string", required: true, maxLength: 1_000_000 },
  {
    name: "format",
    type: "string",
    default: "text",
    allowed: ["markdown", "html", "json", "csv", "tsv", "sql", "yaml", "text"],
  },
  { name: "model", type: "string", maxLength: 200 },
  { name: "cwd", type: "string", maxLength: 1000 },
  { name: "binOverride", type: "string", maxLength: 1000 },
  { name: "editFromHtml", type: "string", maxLength: 5_000_000 },
  { name: "editFromContent", type: "string", maxLength: 1_000_000 },
];

// ── Draft ──────────────────────────────────────────────────────

export const DraftRequestSchema: FieldSchema[] = [
  { name: "agent", type: "string", required: true, maxLength: 100 },
  { name: "instruction", type: "string", required: true, maxLength: 10_000 },
  { name: "context", type: "string", default: "", maxLength: 1_000_000 },
  { name: "model", type: "string", maxLength: 200 },
  { name: "binOverride", type: "string", maxLength: 1000 },
];

// ── Deploy ─────────────────────────────────────────────────────

export const DeployRequestSchema: FieldSchema[] = [
  { name: "taskId", type: "string", required: true, maxLength: 200 },
  {
    name: "provider",
    type: "string",
    required: true,
    allowed: ["vercel", "cloudflare-pages"],
  },
  { name: "html", type: "string", required: true, maxLength: 5_000_000 },
];

// ── Deploy Config ──────────────────────────────────────────────

export const DeployConfigRequestSchema: FieldSchema[] = [
  { name: "token", type: "string", maxLength: 500 },
  { name: "teamId", type: "string", maxLength: 200 },
  { name: "teamSlug", type: "string", maxLength: 200 },
  { name: "accountId", type: "string", maxLength: 200 },
];

// ── Agent Eval ─────────────────────────────────────────────────

export const EvalRequestSchema: FieldSchema[] = [
  {
    name: "adapter",
    type: "string",
    required: true,
    allowed: ["mock", "deepseek", "kimi"],
  },
  { name: "prompt", type: "string", maxLength: 100_000 },
];

// ── Marketplace Install ────────────────────────────────────────

// Note: the actual route uses `source` not `repo` — matches existing client.
export const MarketplaceInstallSchema: FieldSchema[] = [
  { name: "source", type: "string", required: true, maxLength: 200 },
];

// ── Future: Analyze ────────────────────────────────────────────

export const AnalyzeRequestSchema: FieldSchema[] = [
  { name: "html", type: "string", required: true, maxLength: 5_000_000 },
  { name: "sourceData", type: "object" },
];

// ── Future: Verify ─────────────────────────────────────────────

export const VerifyRequestSchema: FieldSchema[] = [
  { name: "html", type: "string", required: true, maxLength: 5_000_000 },
  { name: "rawOutput", type: "string", maxLength: 5_000_000 },
  { name: "sourceData", type: "object" },
  { name: "allowedKeys", type: "array" },
  { name: "fidelitySamples", type: "array" },
];

// ── Future: Repair ─────────────────────────────────────────────

export const RepairRequestSchema: FieldSchema[] = [
  { name: "html", type: "string", required: true, maxLength: 5_000_000 },
];

// ── Future: Export ─────────────────────────────────────────────

export const ExportRequestSchema: FieldSchema[] = [
  { name: "html", type: "string", required: true, maxLength: 5_000_000 },
  {
    name: "format",
    type: "string",
    required: true,
    allowed: ["wechat", "zhihu", "bilibili", "notion", "mastodon", "bluesky", "html", "png", "pdf", "pptx", "remotion"],
  },
];
