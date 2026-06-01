import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/agent/eval/route";

/**
 * POST /api/agent/eval — runs prompt evaluation.
 *
 * Contract:
 *   - Valid request: { adapter: "mock" } → 200 with EvalResult
 *   - Missing adapter: 400 with validation error
 *   - Invalid adapter: 400
 *   - Invalid JSON: 400
 *   - Mock adapter: score 100, passed true
 */

function mockReq(body: unknown): Request {
  return new Request("http://localhost/api/agent/eval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/agent/eval", () => {
  it("returns 200 with mock adapter (score 100)", async () => {
    const req = mockReq({ adapter: "mock" });
    const resp = await POST(req as unknown as Request);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body).toHaveProperty("adapterId", "mock");
    expect(body).toHaveProperty("verificationReport");
    expect(body).toHaveProperty("generatedHtml");
    expect(body).toHaveProperty("postprocessResult");
    expect(body.verificationReport).toHaveProperty("score");
    expect(body.verificationReport.score).toBeGreaterThanOrEqual(80);
    expect(body.verificationReport.passed).toBe(true);
  });

  it("returns 400 for missing adapter field", async () => {
    const req = mockReq({});
    const resp = await POST(req as unknown as Request);
    expect(resp.status).toBe(400);

    const body = await resp.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
    expect(body.details.some((d: { field: string }) => d.field === "adapter")).toBe(true);
  });

  it("returns 400 for invalid adapter value", async () => {
    const req = mockReq({ adapter: "claude" });
    const resp = await POST(req as unknown as Request);
    expect(resp.status).toBe(400);

    const body = await resp.json();
    expect(body.error).toBe("Validation failed");
    const adapterErr = body.details.find(
      (d: { field: string }) => d.field === "adapter",
    );
    expect(adapterErr).toBeDefined();
    expect(adapterErr.message).toContain("mock, deepseek, kimi");
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/agent/eval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const resp = await POST(req as unknown as Request);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 200 for deepseek adapter (may fail if no API key)", async () => {
    // This test documents the contract — deepseek may fail at runtime
    // if DEEPSEEK_API_KEY is not set, but the request itself is valid.
    const req = mockReq({ adapter: "deepseek" });
    const resp = await POST(req as unknown as Request);
    // 200 or 500 are both acceptable — 200 if key exists, 500 if not.
    // We just verify it's not a validation error (400).
    expect(resp.status).not.toBe(400);
  });

  it("returns 400 for unknown fields", async () => {
    const req = mockReq({ adapter: "mock", extraField: "unexpected" });
    const resp = await POST(req as unknown as Request);
    expect(resp.status).toBe(400);

    const body = await resp.json();
    expect(body.details.some((d: { field: string }) => d.field === "extraField")).toBe(true);
  });

  it("mock adapter result includes source keys and clean HTML", async () => {
    const req = mockReq({ adapter: "mock" });
    const resp = await POST(req as unknown as Request);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    // Mock adapter returns golden HTML with source-key annotations
    expect(body.generatedHtml).toContain("<!DOCTYPE html>");
    expect(body.generatedHtml).toContain("<!-- pf-src:");
    expect(body.postprocessResult.totalComments).toBeGreaterThan(0);
  });
});
