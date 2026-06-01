/**
 * Repository layer for versioned project history.
 *
 * Thin wrappers around the existing IndexedDB store (history/db.ts).
 * Adds pipeline data (verification reports, repair results, analysis
 * summaries) to each saved version.
 *
 * All functions are client-only — IndexedDB is a browser API.
 */

import {
  putRun,
  getRun,
  listRuns,
  deleteRun,
  deleteTaskRuns,
  MAX_VERSIONS_PER_TASK,
  type RunRecord,
  type AnalysisSummary,
} from "./db";
import type { VerificationReport } from "../verify/engine";
import type { RepairResult } from "../html/types";
import type { RunStats } from "../store";

// ─── Types ────────────────────────────────────────────────────────────

export type SaveVersionInput = {
  taskId: string;
  html: string;
  content: string;
  stats: RunStats;
  templateId?: string;
  /** Pipeline data (0.4.0). */
  verificationReport?: VerificationReport;
  repairResult?: RepairResult;
  analysisSummary?: AnalysisSummary;
};

export type VersionSummary = {
  taskId: string;
  version: number;
  ts: number;
  htmlBytes: number;
  contentBytes: number;
  score?: number;
  passed?: boolean;
  repairChanged?: boolean;
  templateId?: string;
};

// ─── Repository ──────────────────────────────────────────────────────

/**
 * Save a new version with full pipeline metadata.
 * Returns the saved record or null if IndexedDB is unavailable.
 */
export async function saveVersion(
  input: SaveVersionInput,
): Promise<RunRecord | null> {
  const {
    taskId,
    html,
    content,
    stats,
    templateId,
    verificationReport,
    repairResult,
    analysisSummary,
  } = input;

  return putRun({
    taskId,
    html,
    content,
    stats,
    templateId,
    ts: Date.now(),
    verificationReport,
    repairResult,
    analysisSummary,
  });
}

/**
 * Get a specific version by taskId + version number.
 */
export async function getVersion(
  taskId: string,
  version: number,
): Promise<RunRecord | undefined> {
  return getRun(taskId, version);
}

/**
 * Get the latest version for a task.
 */
export async function getLatestVersion(
  taskId: string,
): Promise<RunRecord | undefined> {
  const runs = await listRuns(taskId);
  return runs[0]; // sorted newest first
}

/**
 * List all versions for a task, newest first.
 * Returns lightweight summaries for the UI.
 */
export async function listVersionSummaries(
  taskId: string,
): Promise<VersionSummary[]> {
  const runs = await listRuns(taskId);
  return runs.map((r) => ({
    taskId: r.taskId,
    version: r.version,
    ts: r.ts,
    htmlBytes: r.html.length,
    contentBytes: r.content.length,
    score: r.verificationReport?.score,
    passed: r.verificationReport?.passed,
    repairChanged: r.repairResult?.changed,
    templateId: r.templateId,
  }));
}

/**
 * List all versions for a task (full records).
 */
export { listRuns as listVersions };

/**
 * Delete a specific version.
 */
export { deleteRun as deleteVersion };

/**
 * Delete all versions for a task.
 */
export { deleteTaskRuns };

/**
 * Maximum versions stored per task before pruning.
 */
export { MAX_VERSIONS_PER_TASK };
