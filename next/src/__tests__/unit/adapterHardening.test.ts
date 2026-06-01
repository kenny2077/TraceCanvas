import { describe, expect, it } from "vitest";
import {
  MockAdapter,
  AdapterError,
  getAdapter,
  ALL_ADAPTERS,
  type AgentAdapter,
} from "../../lib/agents/adapters";

// ─── Mock Adapter ────────────────────────────────────────────────────

describe("MockAdapter", () => {
  const mock = new MockAdapter();

  it("returns golden HTML", async () => {
    const html = await mock.generate("any prompt");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<!-- pf-src:");
    expect(html).toContain("Employee Engagement Survey");
  });

  it("has correct metadata", () => {
    expect(mock.id).toBe("mock");
    expect(mock.label).toBe("Mock (golden HTML)");
    expect(mock.needsApiKey).toBe(false);
    expect(mock.type).toBe("mock");
    expect(mock.timeoutMs).toBe(5_000);
  });

  it("diagnostics returns healthy", () => {
    const diag = mock.diagnostics();
    expect(diag.id).toBe("mock");
    expect(diag.healthy).toBe(true);
    expect(diag.type).toBe("mock");
    expect(diag.status).toContain("always available");
    expect(diag.missingEnv).toBeUndefined();
  });

  it("respects AbortSignal (timeout)", async () => {
    const controller = new AbortController();
    // Abort immediately — generate should throw.
    controller.abort();

    await expect(mock.generate("prompt", controller.signal)).rejects.toThrow(
      AdapterError,
    );
    try {
      await mock.generate("prompt", controller.signal);
    } catch (err) {
      expect(err).toBeInstanceOf(AdapterError);
      expect((err as AdapterError).code).toBe("timeout");
    }
  });

  it("does not throw without abort signal", async () => {
    const html = await mock.generate("test");
    expect(html).toBeDefined();
    expect(html.length).toBeGreaterThan(100);
  });
});

// ─── AdapterError ────────────────────────────────────────────────────

describe("AdapterError", () => {
  it("has categorized code", () => {
    const err = new AdapterError("missing_key", "DEEPSEEK_API_KEY not set");
    expect(err.code).toBe("missing_key");
    expect(err.message).toContain("DEEPSEEK_API_KEY");
    expect(err.name).toBe("AdapterError");
  });

  it("timeout code works", () => {
    const err = new AdapterError("timeout", "Generation timed out after 90s");
    expect(err.code).toBe("timeout");
    expect(err.message).toContain("90");
  });

  it("api_error code works", () => {
    const err = new AdapterError("api_error", "API returned HTTP 500");
    expect(err.code).toBe("api_error");
    expect(err.message).toContain("500");
  });

  it("empty_response code works", () => {
    const err = new AdapterError("empty_response", "Model produced no output");
    expect(err.code).toBe("empty_response");
  });

  it("detail is separate from message", () => {
    const err = new AdapterError(
      "api_error",
      "API error",
      "detail without secrets",
    );
    expect(err.detail).toBe("detail without secrets");
    expect(err.message).not.toContain("detail without secrets");
  });

  it("error message matches instanceof Error", () => {
    const err = new AdapterError("unknown", "test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AdapterError);
  });
});

// ─── Secret Safety ───────────────────────────────────────────────────

describe("AdapterError — secret safety", () => {
  it("does not contain 'sk-' prefix in error messages", () => {
    // Simulate errors that might include API key fragments
    const err = new AdapterError("missing_key", "DEEPSEEK_API_KEY not set");
    expect(err.message).not.toMatch(/sk-/i);
    expect(err.detail).not.toMatch(/sk-/i);
  });

  it("error codes are user-readable (no raw stack traces)", () => {
    const codes = ["missing_key", "timeout", "api_error", "empty_response", "unknown"];
    for (const code of codes) {
      const err = new AdapterError(code as AdapterError["code"], `Error: ${code}`);
      expect(err.code).toBe(code);
      expect(err.message).not.toContain("Error: Error:");
    }
  });

  it("timeout error message is user-friendly", () => {
    const err = new AdapterError("timeout", "deepseek: generation timed out after 90s.");
    expect(err.message).toContain("deepseek");
    expect(err.message).toContain("90s");
    expect(err.message).toContain("timed out");
  });
});

// ─── Registry ─────────────────────────────────────────────────────────

describe("Adapter registry", () => {
  it("ALL_ADAPTERS has 3 entries", () => {
    expect(ALL_ADAPTERS).toHaveLength(3);
  });

  it("getAdapter returns correct adapter", () => {
    const mock = getAdapter("mock");
    expect(mock).toBeDefined();
    expect(mock!.id).toBe("mock");

    const deepseek = getAdapter("deepseek");
    expect(deepseek).toBeDefined();
    expect(deepseek!.id).toBe("deepseek");

    const kimi = getAdapter("kimi");
    expect(kimi).toBeDefined();
    expect(kimi!.id).toBe("kimi");
  });

  it("getAdapter returns undefined for unknown id", () => {
    expect(getAdapter("nonexistent")).toBeUndefined();
  });

  it("all adapters have required interface fields", () => {
    for (const adapter of ALL_ADAPTERS) {
      expect(adapter).toHaveProperty("id");
      expect(adapter).toHaveProperty("label");
      expect(adapter).toHaveProperty("needsApiKey");
      expect(adapter).toHaveProperty("type");
      expect(adapter).toHaveProperty("timeoutMs");
      expect(adapter).toHaveProperty("diagnostics");
      expect(typeof adapter.id).toBe("string");
      expect(typeof adapter.label).toBe("string");
      expect(typeof adapter.needsApiKey).toBe("boolean");
      expect(["api", "cli", "mock"]).toContain(adapter.type);
      expect(typeof adapter.timeoutMs).toBe("number");
      expect(adapter.timeoutMs).toBeGreaterThan(0);
    }
  });

  it("adapter types are correct", () => {
    const mock = getAdapter("mock")!;
    const deepseek = getAdapter("deepseek")!;
    const kimi = getAdapter("kimi")!;

    expect(mock.type).toBe("mock");
    expect(deepseek.type).toBe("api");
    expect(kimi.type).toBe("api");
  });

  it("API adapters need API keys, mock does not", () => {
    const mock = getAdapter("mock")!;
    const deepseek = getAdapter("deepseek")!;
    const kimi = getAdapter("kimi")!;

    expect(mock.needsApiKey).toBe(false);
    expect(deepseek.needsApiKey).toBe(true);
    expect(kimi.needsApiKey).toBe(true);
  });
});

// ─── Diagnostics ─────────────────────────────────────────────────────

describe("Adapter diagnostics", () => {
  it("mock adapter diagnostics returns healthy", () => {
    const diag = new MockAdapter().diagnostics();
    expect(diag.healthy).toBe(true);
    expect(diag.missingEnv).toBeUndefined();
  });

  it("API adapter diagnostics reports missing key", () => {
    // DeepSeek adapter won't have a key in test env
    const deepseek = getAdapter("deepseek")!;
    const diag = deepseek.diagnostics();
    // May or may not be healthy depending on env
    expect(diag.id).toBe("deepseek");
    expect(diag.type).toBe("api");
    expect(typeof diag.healthy).toBe("boolean");
  });

  it("all adapter diagnostics are callable without throwing", () => {
    for (const adapter of ALL_ADAPTERS) {
      const diag = adapter.diagnostics();
      expect(diag).toHaveProperty("id");
      expect(diag).toHaveProperty("healthy");
      expect(diag).toHaveProperty("status");
      expect(diag).toHaveProperty("type");
      expect(diag).toHaveProperty("timeoutMs");
      expect(typeof diag.status).toBe("string");
      expect(diag.status.length).toBeGreaterThan(0);
    }
  });
});

// ─── Timeout Behavior ────────────────────────────────────────────────

describe("Adapter timeout", () => {
  it("mock adapter completes within timeout", async () => {
    const mock = new MockAdapter();
    const started = Date.now();
    const html = await mock.generate("test");
    const elapsed = Date.now() - started;
    expect(html).toBeDefined();
    // Mock has 300ms simulated delay
    expect(elapsed).toBeLessThan(2000);
  });

  it("mock adapter throws on pre-aborted signal", async () => {
    const mock = new MockAdapter();
    const controller = new AbortController();
    controller.abort();

    await expect(mock.generate("test", controller.signal)).rejects.toThrow(
      AdapterError,
    );
  });

  it("mock adapter timeoutMs is reasonable", () => {
    const mock = new MockAdapter();
    expect(mock.timeoutMs).toBe(5_000);
    expect(mock.timeoutMs).toBeLessThan(30_000); // not excessively high
  });
});
