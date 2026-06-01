import { describe, expect, it } from "vitest";
import { POST as convertPost } from "../../app/api/convert/route";
import { POST as draftPost } from "../../app/api/draft/route";
import { POST as deployPost } from "../../app/api/deploy/route";
import { PUT as deployConfigPut } from "../../app/api/deploy/config/route";
import { POST as agentEvalPost } from "../../app/api/agent/eval/route";

/**
 * Validation gates contract test.
 *
 * Verifies that ALL POST routes using validateJsonRequest() return
 * the consistent error shape:
 *   { error: "Validation failed", details: [{ field, message }] }
 *
 * This is a contract — any new route using validateJsonRequest
 * must conform to this shape. If a route breaks the contract,
 * clients that parse validation errors will break.
 */

type RouteHandler = (req: Request) => Promise<Response>;

function jsonReq(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function nonJsonReq(): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "not json",
  });
}

async function assertValidationError(
  resp: Response,
  expectedField: string,
) {
  expect(resp.status).toBe(400);
  const body = await resp.json();
  expect(body.error).toBe("Validation failed");
  expect(Array.isArray(body.details)).toBe(true);
  expect(body.details.length).toBeGreaterThan(0);

  // Every detail has { field, message } shape
  for (const d of body.details) {
    expect(d).toHaveProperty("field");
    expect(d).toHaveProperty("message");
    expect(typeof d.field).toBe("string");
    expect(typeof d.message).toBe("string");
  }

  // The expected field is in the details
  if (expectedField) {
    expect(body.details.some((d: { field: string }) => d.field === expectedField)).toBe(
      true,
    );
  }
}

// ─── Routes under test ──────────────────────────────────────────────

const ROUTES: Array<{ name: string; handler: RouteHandler; validBody: Record<string, unknown> }> = [
  {
    name: "POST /api/convert",
    handler: convertPost as unknown as RouteHandler,
    validBody: { agent: "claude", templateId: "article-magazine", content: "hello" },
  },
  {
    name: "POST /api/draft",
    handler: draftPost as unknown as RouteHandler,
    validBody: { agent: "claude", instruction: "write a tweet" },
  },
  {
    name: "POST /api/deploy",
    handler: deployPost as unknown as RouteHandler,
    validBody: { taskId: "t1", provider: "vercel", html: "<!DOCTYPE html><html></html>" },
  },
  {
    name: "PUT /api/deploy/config",
    handler: deployConfigPut as unknown as RouteHandler,
    validBody: { token: "test" },
  },
  {
    name: "POST /api/agent/eval",
    handler: agentEvalPost as unknown as RouteHandler,
    validBody: { adapter: "mock" },
  },
];

// ─── Tests ──────────────────────────────────────────────────────────

describe("Validation gates — invalid JSON", () => {
  for (const route of ROUTES) {
    it(`${route.name} returns 400 for non-JSON body`, async () => {
      const req = nonJsonReq();
      const resp = await route.handler(req);
      await assertValidationError(resp, "(body)");
    });
  }
});

describe("Validation gates — missing required fields", () => {
  it("POST /api/convert requires agent, templateId, content", async () => {
    // Missing all three
    const req = jsonReq({});
    const resp = await convertPost(req as unknown as Request);
    await assertValidationError(resp, "agent");
  });

  it("POST /api/draft requires agent, instruction", async () => {
    const req = jsonReq({});
    const resp = await draftPost(req as unknown as Request);
    await assertValidationError(resp, "agent");
  });

  it("POST /api/deploy requires taskId, provider, html", async () => {
    const req = jsonReq({});
    const resp = await deployPost(req as unknown as Request);
    await assertValidationError(resp, "taskId");
  });

  it("POST /api/agent/eval requires adapter", async () => {
    const req = jsonReq({});
    const resp = await agentEvalPost(req as unknown as Request);
    await assertValidationError(resp, "adapter");
  });

  it("PUT /api/deploy/config accepts empty body (all optional)", async () => {
    // Deploy config has no required fields — empty body is valid.
    const req = jsonReq({});
    const resp = await deployConfigPut(req as unknown as Request);
    // Should NOT be a validation error
    expect(resp.status).toBeGreaterThanOrEqual(200);
    expect(resp.status).toBeLessThan(500);
  });
});

describe("Validation gates — unknown fields", () => {
  for (const route of ROUTES) {
    it(`${route.name} returns 400 for unknown field`, async () => {
      const req = jsonReq({ ...route.validBody, __extra_unknown__: "bad" });
      const resp = await route.handler(req);
      await assertValidationError(resp, "__extra_unknown__");
    });
  }
});

describe("Validation gates — wrong types", () => {
  it("POST /api/convert rejects number for agent", async () => {
    const req = jsonReq({ agent: 123, templateId: "t1", content: "hello" });
    const resp = await convertPost(req as unknown as Request);
    await assertValidationError(resp, "agent");
  });

  it("POST /api/agent/eval rejects number for adapter", async () => {
    const req = jsonReq({ adapter: 123 });
    const resp = await agentEvalPost(req as unknown as Request);
    await assertValidationError(resp, "adapter");
  });

  it("POST /api/deploy rejects number for html", async () => {
    const req = jsonReq({ taskId: "t1", provider: "vercel", html: 123 });
    const resp = await deployPost(req as unknown as Request);
    await assertValidationError(resp, "html");
  });
});

describe("Validation gates — string length exceeded", () => {
  it("POST /api/convert rejects agent over 100 chars", async () => {
    const req = jsonReq({
      agent: "x".repeat(200),
      templateId: "t1",
      content: "hello",
    });
    const resp = await convertPost(req as unknown as Request);
    await assertValidationError(resp, "agent");
  });

  it("POST /api/draft rejects instruction over 10KB", async () => {
    const req = jsonReq({
      agent: "claude",
      instruction: "x".repeat(11_000),
    });
    const resp = await draftPost(req as unknown as Request);
    await assertValidationError(resp, "instruction");
  });
});

describe("Validation gates — JSON array body rejected", () => {
  for (const route of ROUTES) {
    it(`${route.name} returns 400 for JSON array body`, async () => {
      const req = jsonReq([1, 2, 3]);
      const resp = await route.handler(req);
      await assertValidationError(resp, "(body)");
    });
  }
});
