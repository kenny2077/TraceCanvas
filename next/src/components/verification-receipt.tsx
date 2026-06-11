"use client";

import { useState } from "react";
import type { VerificationReport, CheckResult } from "@/lib/verify/engine";

export type VerificationReceiptProps = {
  report: VerificationReport;
  /** Optional: HTML byte size for context. */
  htmlBytes?: number;
  /** Optional: whether the export is safe. */
  safeToExport?: boolean;
  /** Called when the user dismisses the receipt. */
  onDismiss?: () => void;
};

/**
 * VerificationReceipt — visual summary of verifyArtifact() results.
 *
 * Renders:
 *   - Score badge (0-100) with color coding (green ≥ 90, amber ≥ 60, red < 60)
 *   - Pass/fail indicator
 *   - Individual check results with status icons and detail messages
 *   - Safe-to-export warning when applicable
 *
 * Dismissible via the × button or onDismiss callback.
 */
export function VerificationReceipt({
  report,
  htmlBytes,
  safeToExport,
  onDismiss,
}: VerificationReceiptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const { checks, score, passed, summary } = report;

  return (
    <div data-testid="verification-receipt" className="border-b border-gray-200 bg-white px-4 py-3 text-xs">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        {/* Score badge */}
        <div
          data-testid="score-badge"
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
            ${score >= 90 ? "bg-green-100 text-green-700" : score >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}
          title={`Score: ${score}/100`}
        >
          {score}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`font-medium ${passed ? "text-green-700" : "text-red-700"}`}
            >
              {passed ? "✓ Verified" : "✗ Issues found"}
            </span>
            {htmlBytes !== undefined && (
              <span className="text-gray-400">
                {formatBytes(htmlBytes)}
              </span>
            )}
          </div>
          <p className="text-gray-500 truncate">{summary}</p>
        </div>

        {/* Safe-to-export indicator */}
        {safeToExport !== undefined && (
          <div
            className={`flex-shrink-0 px-2 py-1 rounded text-[10px] font-medium
              ${safeToExport ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
          >
            {safeToExport ? "Safe to export" : "Not export-safe"}
          </div>
        )}

        {/* Dismiss */}
        {onDismiss && (
          <button
            onClick={() => {
              setDismissed(true);
              onDismiss();
            }}
            className="flex-shrink-0 text-gray-300 hover:text-gray-500 text-sm leading-none px-1"
            aria-label="Dismiss verification receipt"
          >
            ×
          </button>
        )}
      </div>

      {/* Check list */}
      <div className="space-y-1">
        {checks.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
      </div>
    </div>
  );
}

// ─── Check Row ──────────────────────────────────────────────────────

function CheckRow({ check }: { check: CheckResult }) {
  const { status, label, detail, metric } = check;

  const colors = {
    pass: "text-green-600 bg-green-50 border-green-200",
    warn: "text-amber-600 bg-amber-50 border-amber-200",
    fail: "text-red-600 bg-red-50 border-red-200",
  };

  const icons = {
    pass: "✓",
    warn: "△",
    fail: "✗",
  };

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded border ${colors[status]}`}
    >
      <span className="font-mono text-[10px] w-4 text-center flex-shrink-0">
        {icons[status]}
      </span>
      <span className="font-medium text-gray-800 flex-shrink-0">{label}</span>
      <span className="text-gray-500 truncate flex-1 min-w-0">{detail}</span>
      {metric !== undefined && (
        <span className="text-gray-400 flex-shrink-0 font-mono text-[10px]">
          {typeof metric === "number" && metric < 1
            ? `${Math.round(metric * 100)}%`
            : metric}
        </span>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
