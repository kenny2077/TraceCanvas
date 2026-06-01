"use client";

import { useState } from "react";
import { useActiveTask } from "@/lib/store";
import { summarizeForAgent } from "@/lib/parsers/auto";

/**
 * AnalysisPanel — shows what the parser found in the active task's content.
 *
 * Displays:
 *   - Detected format badge
 *   - Field list and row count (for CSV/TSV/JSON)
 *   - Source-key coverage preview (if structured data exists)
 *   - Collapsible JSON debug view
 *
 * Only rendered when a task has been converted (status = "done").
 * For non-tabular formats (markdown, text), shows a simplified view.
 */
export function AnalysisPanel() {
  const task = useActiveTask();
  const [debugOpen, setDebugOpen] = useState(false);

  if (!task || task.status !== "done" || !task.content) return null;

  const summary = summarizeForAgent(task.content);
  const { format, structured } = summary;
  const rowCount =
    structured && typeof structured === "object" && "rows" in structured
      ? (structured as { rows: unknown[] }).rows.length
      : 0;
  const fieldCount =
    structured && typeof structured === "object" && "fields" in structured
      ? (structured as { fields: string[] }).fields.length
      : 0;

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium text-gray-700">Analysis</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-blue-50 text-blue-700 border border-blue-200">
          {format}
        </span>
        {rowCount > 0 && (
          <span className="text-gray-400">
            {rowCount} row{rowCount !== 1 ? "s" : ""}
            {fieldCount > 0 && ` × ${fieldCount} field${fieldCount !== 1 ? "s" : ""}`}
          </span>
        )}
        {task.stats.outputBytes > 0 && (
          <span className="text-gray-400 ml-auto">
            {formatBytes(task.stats.outputBytes)} HTML
          </span>
        )}
      </div>

      {/* Structured data preview */}
      {structured && fieldCount > 0 && (
        <div className="mb-2">
          <span className="text-gray-500">Fields: </span>
          <span className="text-gray-700">
            {(structured as { fields: string[] }).fields.join(", ")}
          </span>
        </div>
      )}

      {/* Debug toggle */}
      {structured && (
        <button
          onClick={() => setDebugOpen(!debugOpen)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          {debugOpen ? "▾ Hide" : "▸ Show"} debug JSON
        </button>
      )}

      {debugOpen && structured && (
        <pre className="mt-2 p-2 bg-gray-100 rounded text-[11px] font-mono overflow-auto max-h-48 whitespace-pre-wrap">
          {JSON.stringify(structured, null, 2)}
        </pre>
      )}

      {/* Non-structured format note */}
      {!structured && format !== "text" && (
        <p className="text-gray-400">{format.toUpperCase()} — {task.content.length.toLocaleString()} chars</p>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
