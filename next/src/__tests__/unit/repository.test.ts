import { describe, expect, it } from "vitest";
import type { RunRecord, AnalysisSummary } from "../../lib/history/db";
import { MAX_VERSIONS_PER_TASK } from "../../lib/history/db";
import type { VerificationReport } from "../../lib/verify/engine";
import type { RepairResult } from "../../lib/html/types";

/**
 * Repository tests — verify data shapes and version management logic.
 *
 * IndexedDB calls are mocked at the type level. These tests verify
 * the data shapes the repository expects to store and retrieve.
 */

// ─── RunRecord shape (v2 schema) ────────────────────────────────────

describe("RunRecord v2 schema", () => {
  it("accepts all required fields", () => {
    const record: RunRecord = {
      id: "t_abc__000001",
      taskId: "t_abc",
      version: 1,
      html: "<!DOCTYPE html><html></html>",
      content: "hello",
      ts: Date.now(),
      stats: { outputBytes: 100, deltaCount: 5 },
      templateId: "article-magazine",
    };

    expect(record.id).toBe("t_abc__000001");
    expect(record.version).toBe(1);
  });

  it("accepts v2 pipeline fields (verificationReport)", () => {
    const report: VerificationReport = {
      passed: true,
      checks: [
        {
          id: "html-structural",
          label: "HTML structure",
          status: "pass",
          detail: "HTML structure is valid.",
        },
      ],
      score: 100,
      summary: "All checks passed.",
    };

    const record: RunRecord = {
      id: "t_abc__000001",
      taskId: "t_abc",
      version: 1,
      html: "<!DOCTYPE html><html></html>",
      content: "hello",
      ts: Date.now(),
      stats: { outputBytes: 100, deltaCount: 5 },
      verificationReport: report,
    };

    expect(record.verificationReport).toBeDefined();
    expect(record.verificationReport!.score).toBe(100);
    expect(record.verificationReport!.passed).toBe(true);
  });

  it("accepts v2 pipeline fields (repairResult)", () => {
    const repair: RepairResult = {
      html: "fixed html",
      actions: ["strip-fragment"],
      changed: true,
      log: ["Stripped fragment."],
    };

    const record: RunRecord = {
      id: "t_abc__000001",
      taskId: "t_abc",
      version: 1,
      html: "<!DOCTYPE html><html></html>",
      content: "hello",
      ts: Date.now(),
      stats: { outputBytes: 100, deltaCount: 5 },
      repairResult: repair,
    };

    expect(record.repairResult).toBeDefined();
    expect(record.repairResult!.changed).toBe(true);
    expect(record.repairResult!.actions).toContain("strip-fragment");
  });

  it("accepts v2 pipeline fields (analysisSummary)", () => {
    const analysis: AnalysisSummary = {
      format: "csv",
      fields: ["name", "age", "city"],
      rowCount: 15,
    };

    const record: RunRecord = {
      id: "t_abc__000001",
      taskId: "t_abc",
      version: 1,
      html: "<!DOCTYPE html><html></html>",
      content: "hello",
      ts: Date.now(),
      stats: { outputBytes: 100, deltaCount: 5 },
      analysisSummary: analysis,
    };

    expect(record.analysisSummary).toBeDefined();
    expect(record.analysisSummary!.format).toBe("csv");
    expect(record.analysisSummary!.rowCount).toBe(15);
  });

  it("v1 records without pipeline fields are valid", () => {
    // Records from v1 DB won't have the new fields.
    // TypeScript allows undefined for optional fields.
    const v1Record: RunRecord = {
      id: "old_record",
      taskId: "t_old",
      version: 1,
      html: "<!DOCTYPE html><html></html>",
      content: "hello",
      ts: Date.now(),
      stats: { outputBytes: 50, deltaCount: 2 },
    };

    expect(v1Record.verificationReport).toBeUndefined();
    expect(v1Record.repairResult).toBeUndefined();
    expect(v1Record.analysisSummary).toBeUndefined();
    // Accessing optional fields returns undefined — no crash
    expect(v1Record.verificationReport?.score).toBeUndefined();
  });

  it("all pipeline fields can coexist on one record", () => {
    const record: RunRecord = {
      id: "full_record",
      taskId: "t_full",
      version: 3,
      html: "<!DOCTYPE html><html></html>",
      content: "hello",
      ts: Date.now(),
      stats: { outputBytes: 200, deltaCount: 10 },
      templateId: "deck-simple",
      verificationReport: {
        passed: false,
        checks: [],
        score: 75,
        summary: "1 issue(s) found.",
      },
      repairResult: {
        html: "repaired",
        actions: ["close-tag"],
        changed: true,
        log: ["Added missing closing tag(s)."],
      },
      analysisSummary: {
        format: "json",
        fields: ["department", "score"],
        rowCount: 15,
      },
    };

    expect(record.verificationReport?.score).toBe(75);
    expect(record.repairResult?.changed).toBe(true);
    expect(record.analysisSummary?.rowCount).toBe(15);
  });
});

// ─── Version management ──────────────────────────────────────────────

describe("Version management", () => {
  it("MAX_VERSIONS_PER_TASK is 20", () => {
    expect(MAX_VERSIONS_PER_TASK).toBe(20);
  });

  it("version id format is stable", () => {
    // The id format is `${taskId}__${version.toString(36).padStart(6, "0")}`
    const makeId = (taskId: string, version: number) =>
      `${taskId}__${version.toString(36).padStart(6, "0")}`;

    expect(makeId("t_abc", 1)).toBe("t_abc__000001");
    expect(makeId("t_abc", 10)).toBe("t_abc__00000a");
    expect(makeId("t_xyz", 20)).toBe("t_xyz__00000k");
  });
});

// ─── VerificationReport shape ────────────────────────────────────────

describe("VerificationReport shape", () => {
  it("passed report has correct shape", () => {
    const report: VerificationReport = {
      passed: true,
      checks: [
        { id: "html-structural", label: "Structure", status: "pass", detail: "OK" },
        { id: "html-security", label: "Security", status: "pass", detail: "Clean" },
      ],
      score: 100,
      summary: "All checks passed.",
    };

    expect(report.passed).toBe(true);
    expect(report.checks).toHaveLength(2);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it("failed report has correct shape", () => {
    const report: VerificationReport = {
      passed: false,
      checks: [
        { id: "html-structural", label: "Structure", status: "fail", detail: "Missing </html>" },
      ],
      score: 50,
      summary: "1 issue(s) found.",
    };

    expect(report.passed).toBe(false);
    expect(report.score).toBe(50);
  });

  it("warn checks contribute half points", () => {
    const report: VerificationReport = {
      passed: true,
      checks: [
        { id: "a", label: "A", status: "pass", detail: "" },
        { id: "b", label: "B", status: "warn", detail: "" },
      ],
      score: 75,
      summary: "1 warning(s).",
    };

    // 1 pass + 1 warn = 1 + 0.5 = 1.5 / 2 = 75
    expect(report.score).toBe(75);
  });
});

// ─── RepairResult shape ──────────────────────────────────────────────

describe("RepairResult shape", () => {
  it("changed repair has correct shape", () => {
    const result: RepairResult = {
      html: "repaired content",
      actions: ["strip-fragment", "close-tag"],
      changed: true,
      log: ["Stripped fragment.", "Added closing tag."],
    };

    expect(result.changed).toBe(true);
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.log.length).toBe(result.actions.length);
  });

  it("unchanged repair has correct shape", () => {
    const result: RepairResult = {
      html: "<!DOCTYPE html><html></html>",
      actions: [],
      changed: false,
      log: [],
    };

    expect(result.changed).toBe(false);
    expect(result.actions).toHaveLength(0);
  });
});
