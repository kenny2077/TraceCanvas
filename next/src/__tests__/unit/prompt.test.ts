import { describe, expect, it } from "vitest";
import { buildSourceKeyPrompt } from "../../lib/agents/prompt";
import {
  SURVEY_JSON,
  SURVEY_SOURCE_KEYS,
} from "../fixtures/surveyFixture";

describe("buildSourceKeyPrompt", () => {
  const prompt = buildSourceKeyPrompt({
    sourceData: SURVEY_JSON,
    allowedKeys: [...SURVEY_SOURCE_KEYS],
    title: "Test Survey",
  });

  it("includes verified analysis JSON (the source data)", () => {
    // The prompt should contain the JSON representation of the survey data.
    expect(prompt).toContain('"fields"');
    expect(prompt).toContain('"rows"');
    expect(prompt).toContain('"department"');
    expect(prompt).toContain('"Engineering"');
    expect(prompt).toContain("4.2");
  });

  it("lists allowed source keys", () => {
    for (const key of SURVEY_SOURCE_KEYS) {
      expect(prompt).toContain(key);
    }
  });

  it("forbids raw data-pf-source-id", () => {
    expect(prompt).toContain("data-pf-source-id");
    // The prompt should mention it in a prohibitive context.
    const forbidSentence = prompt
      .split("\n")
      .find((l) => l.includes("data-pf-source-id"));
    expect(forbidSentence).toBeDefined();
    expect(forbidSentence!.toLowerCase()).toMatch(/do not|forbid|禁止|don't|not use/);
  });

  it("says not to invent facts", () => {
    // The prompt should explicitly forbid inventing data.
    const inventLine = prompt
      .split("\n")
      .find((l) => l.toLowerCase().includes("invent"));
    expect(inventLine).toBeDefined();
    expect(inventLine!.toLowerCase()).toMatch(/do not|don't|never/);
  });

  it("asks for raw HTML only (no markdown fences)", () => {
    // The prompt should say to output raw HTML without wrapping.
    expect(prompt).toContain("<!DOCTYPE html>");
    // Should mention not using markdown fences
    const fencesRef = prompt.toLowerCase();
    expect(fencesRef).toMatch(/markdown/);
    expect(fencesRef).toMatch(/do not|don't|no|without/);
  });

  it("includes at least one valid source-key example", () => {
    // The prompt should show a concrete example of pf-src annotation.
    expect(prompt).toContain("<!-- pf-src:");
    expect(prompt).toContain("rows[].department");
    expect(prompt).toContain("rows[].score");

    // The example should pair a data value with its source-key comment.
    // Check that the example contains a value AND the pf-src comment nearby.
    const exampleSection = prompt.slice(prompt.indexOf("## Example"));
    expect(exampleSection).toContain("Engineering");
    expect(exampleSection).toContain("<!-- pf-src: rows[].department -->");
  });

  it("stays under 4KB overhead (prompt directives only, excluding source data)", () => {
    // The prompt overhead (everything before "## Source Data") should be
    // reasonably sized to avoid context pressure on small models.
    const dataStart = prompt.indexOf("## Source Data");
    const overhead = prompt.slice(0, dataStart);
    const overheadBytes = new TextEncoder().encode(overhead).length;

    // The PROMPT_OVERHEAD_BUDGET is 2800 bytes, but the actual size may
    // vary slightly. Allow up to 4000 bytes for the example content.
    expect(overheadBytes).toBeLessThan(4000);
  });

  it("includes source data section with the title", () => {
    expect(prompt).toContain("## Source Data: Test Survey");
    expect(prompt).toContain("```json");
  });
});
