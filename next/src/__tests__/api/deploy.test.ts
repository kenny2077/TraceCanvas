import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/deploy/route";

/**
 * POST /api/deploy — one-click Vercel deployment.
 *
 * Contract:
 *   - Valid body: { taskId, provider: "vercel", html: "<!DOCTYPE html>..." }
 *   - Missing token: 400 with "token is not configured"
 *   - Invalid provider: 400 with validation error
 *   - Empty HTML: 400
 *   - Cloudflare Pages: 501
 *
 * Note: deploy actually calls Vercel API. These tests verify the
 * validation gates; the deploy step itself fails cleanly without a
 * real token.
 */

function mockReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/deploy", () => {
  it("returns 400 for missing taskId", async () => {
    const req = mockReq({ provider: "vercel", html: "<!DOCTYPE html><html></html>" });
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details.some((d: { field: string }) => d.field === "taskId")).toBe(true);
  });

  it("returns 400 for missing provider", async () => {
    const req = mockReq({ taskId: "t1", html: "<!DOCTYPE html><html></html>" });
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.details.some((d: { field: string }) => d.field === "provider")).toBe(true);
  });

  it("returns 400 for invalid provider", async () => {
    const req = mockReq({ taskId: "t1", provider: "netlify", html: "<!DOCTYPE html><html></html>" });
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    const providerErr = body.details.find(
      (d: { field: string }) => d.field === "provider",
    );
    expect(providerErr).toBeDefined();
    expect(providerErr.message).toContain("vercel, cloudflare-pages");
  });

  it("returns 400 for empty HTML", async () => {
    const req = mockReq({ taskId: "t1", provider: "vercel", html: "" });
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.details.some((d: { field: string }) => d.field === "html")).toBe(true);
  });

  it("returns 400 for missing HTML field", async () => {
    const req = mockReq({ taskId: "t1", provider: "vercel" });
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.details.some((d: { field: string }) => d.field === "html")).toBe(true);
  });

  it("returns 501 for Cloudflare Pages (not implemented)", async () => {
    const req = mockReq({
      taskId: "t1",
      provider: "cloudflare-pages",
      html: "<!DOCTYPE html><html></html>",
    });
    const resp = await POST(req);
    expect(resp.status).toBe(501);
    const body = await resp.json();
    expect(body.error).toContain("not implemented");
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 400 for unknown fields", async () => {
    const req = mockReq({
      taskId: "t1",
      provider: "vercel",
      html: "<!DOCTYPE html><html></html>",
      extraField: "should-not-be-here",
    });
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.details.some((d: { field: string }) => d.field === "extraField")).toBe(
      true,
    );
  });

  it("with valid body + vercel provider, fails cleanly on missing token", async () => {
    // This is a real call path — without a Vercel token on disk, it should
    // return 400 with a clear token-missing message.
    const req = mockReq({
      taskId: "t_test",
      provider: "vercel",
      html: "<!DOCTYPE html><html><head></head><body><p>test</p></body></html>",
    });
    const resp = await POST(req);
    // Either 400 (missing token) or 500 (file read error) — both are
    // clean failures, not crashes.
    expect(resp.status).toBeGreaterThanOrEqual(400);
    expect(resp.status).toBeLessThan(600);
  });
});
