import { describe, expect, it } from "vitest";
import { summarizeForAgent } from "../../lib/parsers/auto";

describe("fidelity sample generation", () => {
  it("generates allowedKeys and fidelitySamples from CSV", () => {
    const csv = `department,score,headcount
Engineering,4.2,32
Design,4.7,12
Marketing,3.8,18`;

    const summary = summarizeForAgent(csv);
    expect(summary.format).toBe("csv");
    expect(summary.allowedKeys).toEqual(["rows[].department", "rows[].score", "rows[].headcount"]);
    expect(summary.fidelitySamples).toBeDefined();
    expect(summary.fidelitySamples!.length).toBeGreaterThan(0);
    expect(summary.fidelitySamples!.some((s) => s.value === "4.2")).toBe(true);
    expect(summary.fidelitySamples!.some((s) => s.value === "Engineering")).toBe(true);
  });

  it("generates allowedKeys and fidelitySamples from JSON array", () => {
    const json = JSON.stringify([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);

    const summary = summarizeForAgent(json);
    expect(summary.format).toBe("json");
    expect(summary.allowedKeys).toEqual(["rows[].name", "rows[].age"]);
    expect(summary.fidelitySamples).toBeDefined();
    expect(summary.fidelitySamples!.some((s) => s.value === "Alice")).toBe(true);
    expect(summary.fidelitySamples!.some((s) => s.value === "30")).toBe(true);
  });

  it("generates allowedKeys from JSON object", () => {
    const json = JSON.stringify({ title: "Report", count: 42, active: true });

    const summary = summarizeForAgent(json);
    expect(summary.format).toBe("json");
    expect(summary.allowedKeys).toContain("title");
    expect(summary.allowedKeys).toContain("count");
    expect(summary.fidelitySamples).toBeDefined();
    expect(summary.fidelitySamples!.some((s) => s.value === "Report")).toBe(true);
  });

  it("does NOT generate allowedKeys for plain text", () => {
    const summary = summarizeForAgent("Hello world, this is plain text.");
    expect(summary.format).toBe("text");
    expect(summary.allowedKeys).toBeUndefined();
    expect(summary.fidelitySamples).toBeUndefined();
  });

  it("does NOT generate allowedKeys for markdown", () => {
    const summary = summarizeForAgent("# Hello\n\nThis is markdown.");
    expect(summary.format).toBe("markdown");
    expect(summary.allowedKeys).toBeUndefined();
  });
});
