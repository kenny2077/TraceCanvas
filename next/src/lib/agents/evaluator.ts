/**
 * Prompt evaluator — orchestrates a full evaluation run.
 *
 * Pipeline:
 *   adapter.generate(prompt) → extractHtml → postprocessSourceKeys → verifyArtifact
 *
 * Returns a structured result suitable for the Prompt Lab UI and for
 * programmatic comparison across adapters.
 */

import type { AgentAdapter } from "./adapters";
import { extractHtml } from "../extract-html";
import { postprocessSourceKeys, type PostprocessResult } from "../sources/postprocessor";
import {
  verifyArtifact,
  type VerificationReport,
} from "../verify/engine";

export type EvalResult = {
  /** Adapter id (e.g. "mock", "deepseek", "kimi"). */
  adapterId: string;
  /** Adapter label for display. */
  adapterLabel: string;
  /** Raw agent output (may include markdown fences, preamble, etc.). */
  rawOutput: string;
  /** Cleaned HTML after extractHtml(). */
  generatedHtml: string;
  /** Source-key postprocess result. */
  postprocessResult: PostprocessResult;
  /** Verification report with all checks. */
  verificationReport: VerificationReport;
  /** True if an error occurred during generation. */
  error?: string;
  /** Wall-clock duration in ms. */
  durationMs: number;
  /** ISO-8601 timestamp of the run. */
  runAt: string;
};

export type EvalInput = {
  adapter: AgentAdapter;
  prompt: string;
  sourceData: { fields: string[]; rows: Record<string, unknown>[] };
  allowedKeys: string[];
  fidelitySamples?: Array<{ key: string; value: string }>;
};

/**
 * Run a full evaluation: prompt → agent → extract → postprocess → verify.
 * Errors during generation are caught and reflected in the result —
 * verification still runs on whatever output we got (if any).
 */
export async function evaluateRun(input: EvalInput): Promise<EvalResult> {
  const { adapter, prompt, sourceData, allowedKeys, fidelitySamples } = input;
  const startedAt = Date.now();
  let rawOutput = "";
  let error: string | undefined;

  // ── Generate ──────────────────────────────────────────────
  try {
    rawOutput = await adapter.generate(prompt);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    rawOutput = "";
  }

  // ── Extract HTML ──────────────────────────────────────────
  const generatedHtml = rawOutput ? extractHtml(rawOutput) : "";

  // ── Postprocess source keys ───────────────────────────────
  const postprocessResult = postprocessSourceKeys(
    error ? generatedHtml : rawOutput,
    allowedKeys,
  );

  // ── Verify ────────────────────────────────────────────────
  const verificationReport = verifyArtifact({
    rawOutput: error ? "" : rawOutput,
    cleanHtml: generatedHtml,
    postprocess: postprocessResult,
    sourceData,
    allowedKeys,
    fidelitySamples: fidelitySamples ?? [],
  });

  const durationMs = Date.now() - startedAt;

  return {
    adapterId: adapter.id,
    adapterLabel: adapter.label,
    rawOutput,
    generatedHtml,
    postprocessResult,
    verificationReport,
    error,
    durationMs,
    runAt: new Date().toISOString(),
  };
}
