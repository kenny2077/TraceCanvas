import { describe, expect, it } from "vitest";
import { parseCSV } from "../../lib/sources/parser";
import { postprocessSourceKeys } from "../../lib/sources/postprocessor";
import { verifyArtifact } from "../../lib/verify/engine";

describe("verification pipeline", () => {
  const csv = `department,score,headcount
Engineering,4.2,32
Design,4.7,12
Marketing,3.8,18
Product,4.5,8`;

  it("parseCSV → allowedKeys → postprocess → verifyArtifact", () => {
    const { document: doc } = parseCSV(csv);
    const allowedKeys = doc.fields.map((f) => `rows[].${f}`);

    // Mock agent output with proper pf-src annotations
    const html = `<!DOCTYPE html>
<html><body>
<table>
<tr><td>Engineering</td><!-- pf-src: rows[].department --></tr>
<tr><td>4.2</td><!-- pf-src: rows[].score --></tr>
<tr><td>32</td><!-- pf-src: rows[].headcount --></tr>
</table>
</body></html>`;

    const postprocess = postprocessSourceKeys(html, allowedKeys);
    expect(postprocess.foundKeys.length).toBeGreaterThan(0);
    expect(postprocess.coverage).toBeGreaterThan(0);

    const fidelitySamples = [
      { key: "score_0", value: "4.2" },
      { key: "headcount_0", value: "32" },
    ];

    const report = verifyArtifact({
      rawOutput: html,
      cleanHtml: html,
      postprocess,
      sourceData: { fields: doc.fields, rows: [] },
      allowedKeys,
      fidelitySamples,
    });

    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.checks.length).toBe(10);

    // Check specific checks exist
    const checkIds = report.checks.map((c) => c.id);
    expect(checkIds).toContain("html-structural");
    expect(checkIds).toContain("html-security");
    expect(checkIds).toContain("html-sanitizer");
    expect(checkIds).toContain("source-key-presence");
    expect(checkIds).toContain("source-key-coverage");
    expect(checkIds).toContain("source-key-validity");
    expect(checkIds).toContain("content-fidelity");
    expect(checkIds).toContain("no-raw-source-id");
    expect(checkIds).toContain("no-markdown-fences");
  });

  it("detects missing source keys", () => {
    const { document: doc } = parseCSV(csv);
    const allowedKeys = doc.fields.map((f) => `rows[].${f}`);

    // HTML missing some pf-src annotations
    const html = `<!DOCTYPE html>
<html><body>
<table>
<tr><td>Engineering</td><!-- pf-src: rows[].department --></tr>
<tr><td>4.2</td></tr>
</table>
</body></html>`;

    const postprocess = postprocessSourceKeys(html, allowedKeys);
    expect(postprocess.missingKeys.length).toBeGreaterThan(0);

    const report = verifyArtifact({
      rawOutput: html,
      cleanHtml: html,
      postprocess,
      sourceData: { fields: doc.fields, rows: [] },
      allowedKeys,
      fidelitySamples: [],
    });

    const coverageCheck = report.checks.find((c) => c.id === "source-key-coverage");
    expect(coverageCheck?.status).toBe("fail");
  });

  it("detects invalid source keys", () => {
    const { document: doc } = parseCSV(csv);
    const allowedKeys = doc.fields.map((f) => `rows[].${f}`);

    const html = `<!DOCTYPE html>
<html><body>
<div>4.2</div><!-- pf-src: rows[].nonexistent -->
</body></html>`;

    const postprocess = postprocessSourceKeys(html, allowedKeys);
    expect(postprocess.invalidKeys.length).toBeGreaterThan(0);

    const report = verifyArtifact({
      rawOutput: html,
      cleanHtml: html,
      postprocess,
      sourceData: { fields: doc.fields, rows: [] },
      allowedKeys,
      fidelitySamples: [],
    });

    const validityCheck = report.checks.find((c) => c.id === "source-key-validity");
    expect(validityCheck?.status).toBe("fail");
  });

  it("detects forbidden data-pf-source-id attributes", () => {
    const html = `<!DOCTYPE html>
<html><body>
<div data-pf-source-id="x">test</div>
</body></html>`;

    const report = verifyArtifact({
      rawOutput: html,
      cleanHtml: html,
      postprocess: { foundKeys: [], missingKeys: [], invalidKeys: [], coverage: 0, totalComments: 0, rawMatches: [] },
      sourceData: { fields: [], rows: [] },
      allowedKeys: [],
      fidelitySamples: [],
    });

    const rawIdCheck = report.checks.find((c) => c.id === "no-raw-source-id");
    expect(rawIdCheck?.status).toBe("fail");
  });

  it("detects markdown fences", () => {
    const html = "```html\n<!DOCTYPE html>\n```";

    const report = verifyArtifact({
      rawOutput: html,
      cleanHtml: html,
      postprocess: { foundKeys: [], missingKeys: [], invalidKeys: [], coverage: 0, totalComments: 0, rawMatches: [] },
      sourceData: { fields: [], rows: [] },
      allowedKeys: [],
      fidelitySamples: [],
    });

    const fenceCheck = report.checks.find((c) => c.id === "no-markdown-fences");
    expect(fenceCheck?.status).toBe("fail");
  });
});
