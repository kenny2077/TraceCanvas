import { describe, expect, it } from "vitest";
import {
  validateJsonRequest,
  ConvertRequestSchema,
  DraftRequestSchema,
  DeployRequestSchema,
  DeployConfigRequestSchema,
  EvalRequestSchema,
  MarketplaceInstallSchema,
  type FieldSchema,
  type ValidationResult,
} from "../../lib/validation/schemas";

// ─── Helper: create a mock NextRequest ───────────────────────────────

function mockReq(body: unknown): import("next/server").NextRequest {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

async function validate<T extends Record<string, unknown>>(
  body: unknown,
  schema: FieldSchema[],
): Promise<ValidationResult<T>> {
  return validateJsonRequest<T>(mockReq(body), schema);
}

// ─── JSON Parse Errors ───────────────────────────────────────────────

describe("validateJsonRequest — JSON errors", () => {
  it("rejects non-JSON body", async () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not json",
    }) as unknown as import("next/server").NextRequest;
    const result = await validateJsonRequest(req, ConvertRequestSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].message).toContain("JSON");
    }
  });

  it("rejects JSON array", async () => {
    const result = await validate([1, 2, 3], ConvertRequestSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].message).toContain("object");
    }
  });

  it("rejects null body", async () => {
    const result = await validate(null, ConvertRequestSchema);
    expect(result.ok).toBe(false);
  });
});

// ─── Required Fields ─────────────────────────────────────────────────

describe("validateJsonRequest — required fields", () => {
  it("rejects missing required field", async () => {
    const result = await validate({ templateId: "t1", content: "hello" }, ConvertRequestSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const agentErr = result.errors.find((e) => e.field === "agent");
      expect(agentErr).toBeDefined();
      expect(agentErr!.message).toContain("required");
    }
  });

  it("rejects empty required string", async () => {
    const result = await validate(
      { agent: "", templateId: "t1", content: "hello" },
      ConvertRequestSchema,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const agentErr = result.errors.find((e) => e.field === "agent");
      expect(agentErr).toBeDefined();
      expect(agentErr!.message).toContain("empty");
    }
  });

  it("accepts valid required fields", async () => {
    const result = await validate<{ agent: string }>(
      { agent: "claude", templateId: "article-magazine", content: "hello world" },
      ConvertRequestSchema,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.agent).toBe("claude");
      expect(result.value.templateId).toBe("article-magazine");
      expect(result.value.content).toBe("hello world");
    }
  });
});

// ─── Type Checking ───────────────────────────────────────────────────

describe("validateJsonRequest — type checking", () => {
  it("rejects number for string field", async () => {
    const result = await validate({ source: 123 }, MarketplaceInstallSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const err = result.errors.find((e) => e.field === "source");
      expect(err).toBeDefined();
      expect(err!.message).toContain("string");
    }
  });

  it("rejects string for boolean field", async () => {
    const schema: FieldSchema[] = [
      { name: "flag", type: "boolean", required: true },
    ];
    const result = await validate({ flag: "true" }, schema);
    expect(result.ok).toBe(false);
  });
});

// ─── String Length Limits ────────────────────────────────────────────

describe("validateJsonRequest — length limits", () => {
  it("rejects string over maxLength", async () => {
    const result = await validate(
      { agent: "x".repeat(200), templateId: "t1", content: "ok" },
      ConvertRequestSchema,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const err = result.errors.find((e) => e.field === "agent");
      expect(err).toBeDefined();
      expect(err!.message).toContain("at most 100");
    }
  });

  it("accepts string at maxLength boundary", async () => {
    const result = await validate(
      { agent: "x".repeat(100), templateId: "t1", content: "ok" },
      ConvertRequestSchema,
    );
    expect(result.ok).toBe(true);
  });
});

// ─── Enum Validation ─────────────────────────────────────────────────

describe("validateJsonRequest — enum validation", () => {
  it("rejects invalid enum value", async () => {
    const result = await validate(
      { adapter: "claude" },
      EvalRequestSchema,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const err = result.errors.find((e) => e.field === "adapter");
      expect(err).toBeDefined();
      expect(err!.message).toContain("mock, deepseek, kimi");
    }
  });

  it("accepts valid enum value", async () => {
    const result = await validate(
      { adapter: "mock" },
      EvalRequestSchema,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.adapter).toBe("mock");
    }
  });

  it("rejects invalid format in convert", async () => {
    const result = await validate(
      { agent: "claude", templateId: "t1", content: "ok", format: "xml" },
      ConvertRequestSchema,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const err = result.errors.find((e) => e.field === "format");
      expect(err).toBeDefined();
    }
  });

  it("rejects invalid provider in deploy", async () => {
    const result = await validate(
      { taskId: "t1", provider: "netlify", html: "<p>hi</p>" },
      DeployRequestSchema,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const err = result.errors.find((e) => e.field === "provider");
      expect(err).toBeDefined();
    }
  });
});

// ─── Default Values ──────────────────────────────────────────────────

describe("validateJsonRequest — default values", () => {
  it("applies default when field is missing", async () => {
    const result = await validate<{ format: string }>(
      { agent: "claude", templateId: "t1", content: "ok" },
      ConvertRequestSchema,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.format).toBe("text");
    }
  });

  it("does not override provided value with default", async () => {
    const result = await validate<{ format: string }>(
      { agent: "claude", templateId: "t1", content: "ok", format: "csv" },
      ConvertRequestSchema,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.format).toBe("csv");
    }
  });
});

// ─── Unknown Fields ──────────────────────────────────────────────────

describe("validateJsonRequest — unknown fields", () => {
  it("rejects unknown fields", async () => {
    const result = await validate(
      { adapter: "mock", extraField: "should not be here" },
      EvalRequestSchema,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const err = result.errors.find((e) => e.field === "extraField");
      expect(err).toBeDefined();
      expect(err!.message).toContain("Unknown");
    }
  });
});

// ─── Per-Schema Smoke Tests ──────────────────────────────────────────

describe("validateJsonRequest — per-schema smoke tests", () => {
  it("ConvertRequestSchema accepts valid payload", async () => {
    const result = await validate(
      { agent: "claude", templateId: "deck-simple", content: "# Hello" },
      ConvertRequestSchema,
    );
    expect(result.ok).toBe(true);
  });

  it("DraftRequestSchema accepts valid payload", async () => {
    const result = await validate(
      { agent: "claude", instruction: "write a tweet about AI" },
      DraftRequestSchema,
    );
    expect(result.ok).toBe(true);
  });

  it("DeployRequestSchema accepts valid payload", async () => {
    const result = await validate(
      { taskId: "t_abc123", provider: "vercel", html: "<!DOCTYPE html><html></html>" },
      DeployRequestSchema,
    );
    expect(result.ok).toBe(true);
  });

  it("DeployConfigRequestSchema accepts empty body (all optional)", async () => {
    const result = await validate({}, DeployConfigRequestSchema);
    expect(result.ok).toBe(true);
  });

  it("DeployConfigRequestSchema accepts token only", async () => {
    const result = await validate(
      { token: "vercel_xxx" },
      DeployConfigRequestSchema,
    );
    expect(result.ok).toBe(true);
  });

  it("EvalRequestSchema accepts valid adapter", async () => {
    const result = await validate({ adapter: "deepseek" }, EvalRequestSchema);
    expect(result.ok).toBe(true);
  });

  it("MarketplaceInstallSchema accepts valid source", async () => {
    const result = await validate(
      { source: "some-owner/some-repo" },
      MarketplaceInstallSchema,
    );
    expect(result.ok).toBe(true);
  });

  it("DraftRequestSchema rejects missing instruction", async () => {
    const result = await validate({ agent: "claude" }, DraftRequestSchema);
    expect(result.ok).toBe(false);
  });
});

// ─── Multiple Errors ─────────────────────────────────────────────────

describe("validateJsonRequest — multiple errors", () => {
  it("reports all errors at once", async () => {
    const result = await validate(
      { provider: "netlify", html: 123 },
      DeployRequestSchema,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Should have errors for: missing taskId, invalid provider, wrong html type
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
      const fields = result.errors.map((e) => e.field);
      expect(fields).toContain("taskId");
      expect(fields).toContain("provider");
      expect(fields).toContain("html");
    }
  });
});
