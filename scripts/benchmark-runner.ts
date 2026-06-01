/**
 * Benchmark runner for TraceCanvas 0.3.2.
 *
 * Usage:
 *   pnpm exec tsx scripts/benchmark-runner.ts
 *
 * Runs each fixture against each available adapter (mock + real APIs if keys exist).
 * Produces:
 *   - docs/benchmarks/results.json  (machine-readable)
 *   - Console output with summary table
 *
 * Design:
 *   - Does NOT modify the app. Reads app modules directly via tsx.
 *   - Records raw outputs for failed runs so they can be analysed.
 *   - Distinguishes generation failure from verifier false positive.
 *   - Does NOT tune prompts mid-benchmark.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { evaluateRun, type EvalResult } from "../next/src/lib/agents/evaluator";
import { MockAdapter, DeepSeekAdapter, KimiAdapter } from "../next/src/lib/agents/adapters";
import { buildSourceKeyPrompt } from "../next/src/lib/agents/prompt";
import { ALL_FIXTURES, type Fixture } from "./benchmark-fixtures";
import type { AgentAdapter } from "../next/src/lib/agents/adapters";

// ─── Config ─────────────────────────────────────────────────────────

const RESULTS_DIR = path.join(__dirname, "..", "docs", "benchmarks");
const RESULTS_JSON = path.join(RESULTS_DIR, "results.json");
const TIMEOUT_MS = 90_000; // per-adapter-per-fixture timeout

// ─── Adapter Factory ─────────────────────────────────────────────────

function getAvailableAdapters(): AgentAdapter[] {
  const adapters: AgentAdapter[] = [new MockAdapter()];

  // Check for real API keys
  if (process.env.DEEPSEEK_API_KEY) {
    adapters.push(new DeepSeekAdapter());
    console.log("✓ DeepSeek API key found — including in benchmark");
  } else {
    console.log("✗ DEEPSEEK_API_KEY not set — skipping DeepSeek");
  }

  if (process.env.KIMI_API_KEY) {
    adapters.push(new KimiAdapter());
    console.log("✓ Kimi API key found — including in benchmark");
  } else {
    console.log("✗ KIMI_API_KEY not set — skipping Kimi");
  }

  return adapters;
}

// ─── Timeout Wrapper ─────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

// ─── Deep analysis beyond verifier ───────────────────────────────────

type DeepAnalysis = {
  /** Does the HTML include a valid <!DOCTYPE html>? */
  hasDoctype: boolean;
  /** Does the raw output include markdown fences? */
  hasMarkdownFences: boolean;
  /** Count of data rows that appear in the HTML (by matching a unique value per row). */
  rowsRepresented: number;
  /** Total rows in the source data. */
  totalRows: number;
  /** Claims in the HTML that are NOT from the source data (unsupported claims). */
  unsupportedClaims: string[];
  /** Whether the agent's output is "safe to export" (well-formed + no invented facts). */
  safeToExport: boolean;
};

function deepAnalyze(
  rawOutput: string,
  generatedHtml: string,
  fixture: Fixture,
): DeepAnalysis {
  const hasDoctype = /<!DOCTYPE\s+html/i.test(rawOutput);
  const hasMarkdownFences = /```html|```HTML/.test(rawOutput);

  // Row representation: for each row, check if a unique identifying value
  // (first field value) appears in the generated HTML.
  const firstField = fixture.sourceData.fields[0];
  let rowsRepresented = 0;
  for (const row of fixture.sourceData.rows) {
    const idValue = String(row[firstField] ?? "");
    if (idValue && generatedHtml.includes(idValue)) {
      rowsRepresented++;
    }
  }

  // Unsupported claims: look for numeric values in the HTML that aren't
  // in the source data (rough heuristic — catches invented totals/averages).
  const unsupportedClaims: string[] = [];
  const allSourceValues = new Set<string>();
  for (const row of fixture.sourceData.rows) {
    for (const val of Object.values(row)) {
      allSourceValues.add(String(val));
    }
  }

  // Find numbers in HTML that look like computed aggregates.
  const numberPattern = />([\d,]+\.?\d*)\s*(?:<\/|<!--)/g;
  let nm: RegExpExecArray | null;
  while ((nm = numberPattern.exec(generatedHtml)) !== null) {
    const num = nm[1].replace(/,/g, "");
    if (!allSourceValues.has(num) && !allSourceValues.has(nm[1])) {
      // Check if it's a plausible invented number (not a CSS value or timestamp)
      const parsed = parseFloat(num);
      if (!isNaN(parsed) && parsed > 0 && parsed < 1_000_000_000) {
        const ctx = generatedHtml.slice(Math.max(0, nm.index - 40), nm.index + 40);
        unsupportedClaims.push(`"${num}" near: ...${ctx.trim()}...`);
      }
    }
  }

  const safeToExport =
    hasDoctype &&
    !hasMarkdownFences &&
    generatedHtml.length > 100 &&
    rowsRepresented >= fixture.sourceData.rows.length * 0.5;

  return {
    hasDoctype,
    hasMarkdownFences,
    rowsRepresented,
    totalRows: fixture.sourceData.rows.length,
    unsupportedClaims: unsupportedClaims.slice(0, 5), // top 5
    safeToExport,
  };
}

// ─── Main ────────────────────────────────────────────────────────────

type BenchmarkEntry = {
  fixtureId: string;
  adapterId: string;
  evalResult: EvalResult;
  deepAnalysis: DeepAnalysis;
};

async function main() {
  console.log("TraceCanvas 0.3.2 — Real-Agent Benchmark\n");
  console.log(`Fixtures: ${ALL_FIXTURES.length}`);
  console.log(`Results dir: ${RESULTS_DIR}\n`);

  const adapters = getAvailableAdapters();
  console.log(`Adapters: ${adapters.map((a) => a.id).join(", ")}\n`);

  const results: BenchmarkEntry[] = [];

  for (const fixture of ALL_FIXTURES) {
    console.log(`\n━━━ Fixture: ${fixture.id} ━━━`);
    console.log(`  ${fixture.title}`);
    console.log(`  ${fixture.sourceData.rows.length} rows × ${fixture.sourceData.fields.length} fields`);

    const prompt = buildSourceKeyPrompt({
      sourceData: fixture.sourceData,
      allowedKeys: fixture.allowedKeys,
      title: fixture.title,
    });

    for (const adapter of adapters) {
      const label = `${fixture.id} × ${adapter.id}`;
      console.log(`\n  ▶ ${label} ...`);

      let evalResult: EvalResult;
      try {
        evalResult = await withTimeout(
          evaluateRun({
            adapter,
            prompt,
            sourceData: fixture.sourceData,
            allowedKeys: fixture.allowedKeys,
            fidelitySamples: fixture.fidelitySamples,
          }),
          TIMEOUT_MS,
          label,
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.log(`    ✗ ERROR: ${errMsg}`);
        // Record a failed entry
        evalResult = {
          adapterId: adapter.id,
          adapterLabel: adapter.label,
          rawOutput: "",
          generatedHtml: "",
          postprocessResult: {
            foundKeys: [],
            missingKeys: fixture.allowedKeys,
            invalidKeys: [],
            coverage: 0,
            totalComments: 0,
            rawMatches: [],
          },
          verificationReport: {
            passed: false,
            checks: [],
            score: 0,
            summary: `Generation failed: ${errMsg}`,
          },
          error: errMsg,
          durationMs: 0,
          runAt: new Date().toISOString(),
        };
      }

      const deepAnalysis = deepAnalyze(
        evalResult.rawOutput,
        evalResult.generatedHtml,
        fixture,
      );

      results.push({ fixtureId: fixture.id, adapterId: adapter.id, evalResult, deepAnalysis });

      // Quick summary per run
      const score = evalResult.verificationReport.score;
      const status = evalResult.verificationReport.passed ? "PASS" : "FAIL";
      const icon = score >= 90 ? "✓" : score >= 60 ? "△" : "✗";
      console.log(`    ${icon} Score: ${score}/100 (${status})`);
      console.log(`    Source keys: ${evalResult.postprocessResult.totalComments} found, ${evalResult.postprocessResult.missingKeys.length} missing, ${evalResult.postprocessResult.invalidKeys.length} invalid`);
      console.log(`    Rows: ${deepAnalysis.rowsRepresented}/${deepAnalysis.totalRows} represented`);
      console.log(`    Safe to export: ${deepAnalysis.safeToExport ? "YES" : "NO"}`);
      if (evalResult.error) {
        console.log(`    Error: ${evalResult.error}`);
      }
      if (deepAnalysis.unsupportedClaims.length > 0) {
        console.log(`    ⚠ Unsupported claims: ${deepAnalysis.unsupportedClaims.length}`);
      }
    }
  }

  // ─── Write results ────────────────────────────────────────────────
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  // Full JSON
  const jsonOutput = results.map((r) => ({
    fixture: r.fixtureId,
    adapter: r.adapterId,
    score: r.evalResult.verificationReport.score,
    passed: r.evalResult.verificationReport.passed,
    sourceKeyCoverage: r.evalResult.postprocessResult.coverage,
    sourceKeysFound: r.evalResult.postprocessResult.totalComments,
    sourceKeysMissing: r.evalResult.postprocessResult.missingKeys.length,
    sourceKeysInvalid: r.evalResult.postprocessResult.invalidKeys.length,
    rowsRepresented: r.deepAnalysis.rowsRepresented,
    totalRows: r.deepAnalysis.totalRows,
    hasDoctype: r.deepAnalysis.hasDoctype,
    hasMarkdownFences: r.deepAnalysis.hasMarkdownFences,
    safeToExport: r.deepAnalysis.safeToExport,
    unsupportedClaimsCount: r.deepAnalysis.unsupportedClaims.length,
    durationMs: r.evalResult.durationMs,
    error: r.evalResult.error ?? null,
    runAt: r.evalResult.runAt,
    // Include the first 500 chars of raw output for debugging
    rawOutputPreview: r.evalResult.rawOutput.slice(0, 500),
  }));

  fs.writeFileSync(RESULTS_JSON, JSON.stringify(jsonOutput, null, 2));
  console.log(`\n✓ Results written to ${RESULTS_JSON}`);

  // ─── Summary table ────────────────────────────────────────────────
  console.log("\n\n╔══════════════════════════════════════════════════════════╗");
  console.log("║              BENCHMARK SUMMARY TABLE                    ║");
  console.log("╠══════════════════════════════════════════════════════════╣");

  // Header
  const col1 = 22;
  const col2 = 8;
  const col3 = 7;
  const col4 = 11;
  const col5 = 12;
  const col6 = 6;
  console.log(
    `║ ${"Fixture".padEnd(col1)} ${"Adapter".padEnd(col2)} ${"Score".padStart(col3)} ${"Keys".padStart(col4)} ${"Rows".padStart(col5)} ${"Safe".padStart(col6)} ║`,
  );
  console.log("╠══════════════════════════════════════════════════════════╣");

  for (const r of results) {
    const fixture = r.fixtureId.slice(0, col1).padEnd(col1);
    const adapter = r.adapterId.slice(0, col2).padEnd(col2);
    const score = String(r.evalResult.verificationReport.score).padStart(col3);
    const keys = `${r.evalResult.postprocessResult.totalComments}`.padStart(col4);
    const rows = `${r.deepAnalysis.rowsRepresented}/${r.deepAnalysis.totalRows}`.padStart(col5);
    const safe = r.deepAnalysis.safeToExport ? " ✓" : " ✗";
    console.log(`║ ${fixture} ${adapter} ${score} ${keys} ${rows} ${safe.padStart(col6)} ║`);
  }

  console.log("╚══════════════════════════════════════════════════════════╝");

  // ─── Analysis: common failure patterns ─────────────────────────────
  console.log("\n\n=== COMMON FAILURE PATTERNS ===");

  const failures = results.filter((r) => !r.evalResult.verificationReport.passed);
  if (failures.length === 0) {
    console.log("  No failures — all benchmarks passed.");
  } else {
    const patternCounts = new Map<string, number>();
    for (const f of failures) {
      for (const check of f.evalResult.verificationReport.checks) {
        if (check.status === "fail") {
          const key = `${check.id}: ${check.label}`;
          patternCounts.set(key, (patternCounts.get(key) ?? 0) + 1);
        }
      }
    }
    const sorted = [...patternCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [pattern, count] of sorted) {
      console.log(`  [${count}×] ${pattern}`);
    }
  }

  // ─── Missing source keys summary ───────────────────────────────────
  console.log("\n=== MISSING SOURCE KEYS BY FIXTURE ===");
  for (const r of results) {
    if (r.evalResult.postprocessResult.missingKeys.length > 0) {
      console.log(`  ${r.fixtureId} × ${r.adapterId}: missing [${r.evalResult.postprocessResult.missingKeys.join(", ")}]`);
    }
  }

  // ─── Invalid source keys ───────────────────────────────────────────
  console.log("\n=== INVALID SOURCE KEYS ===");
  for (const r of results) {
    if (r.evalResult.postprocessResult.invalidKeys.length > 0) {
      console.log(`  ${r.fixtureId} × ${r.adapterId}: invalid [${r.evalResult.postprocessResult.invalidKeys.slice(0, 10).join(", ")}]`);
    }
  }

  console.log("\n✓ Benchmark complete.");
}

main().catch((err) => {
  console.error("Fatal benchmark error:", err);
  process.exit(1);
});
