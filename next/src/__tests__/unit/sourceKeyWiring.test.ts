import { describe, expect, it } from "vitest";
import { assemblePrompt, SOURCE_KEY_DIRECTIVES } from "../../lib/templates/shared";

describe("assemblePrompt source-key wiring", () => {
  it("injects SOURCE_KEY_DIRECTIVES for structured data", () => {
    const prompt = assemblePrompt({
      body: "Test template body",
      content: "department,score\nA,1",
      format: "csv",
      structuredData: true,
    });
    expect(prompt).toContain(SOURCE_KEY_DIRECTIVES.trim().slice(0, 30));
    expect(prompt).toContain("pf-src");
  });

  it("does NOT inject source-key rules for plain text", () => {
    const prompt = assemblePrompt({
      body: "Test template body",
      content: "Hello world",
      format: "text",
      structuredData: false,
    });
    expect(prompt).not.toContain("Source-Key Annotation Rules");
  });

  it("injects skill-specific sourceKeyRules when provided", () => {
    const prompt = assemblePrompt({
      body: "Test template body",
      content: "A,1",
      format: "csv",
      structuredData: true,
      sourceKeyRules: "Every KPI MUST have a pf-src comment.",
    });
    expect(prompt).toContain("Every KPI MUST have a pf-src comment.");
  });

  it("preserves body and content in prompt", () => {
    const prompt = assemblePrompt({
      body: "Template: make a table",
      content: "x,y\n1,2",
      format: "csv",
      structuredData: true,
    });
    expect(prompt).toContain("Template: make a table");
    expect(prompt).toContain("x,y");
    expect(prompt).toContain("【输入格式】: csv");
  });
});
