"use client";

import { useMemo } from "react";
import { useActiveTask } from "@/lib/store";
import { repairHtml } from "@/lib/repair/engine";

/**
 * RepairPanel — shows what the repair engine did to the generated HTML.
 *
 * Runs repairHtml() on the active task's HTML output. Displays:
 *   - Repair actions taken (strip-fragment, close-tag, etc.)
 *   - Before/after byte counts
 *   - Whether the HTML was modified
 *
 * Only rendered when a task has HTML output and repair actually changed
 * something. Conservative repair means most valid HTML shows no panel.
 */
export function RepairPanel() {
  const task = useActiveTask();

  const repairResult = useMemo(() => {
    if (!task?.html) return null;
    return repairHtml(task.html);
  }, [task?.html]);

  if (!task || !task.html || !repairResult || !repairResult.changed) return null;

  const { actions, log, html: repaired } = repairResult;
  const beforeBytes = task.html.length;
  const afterBytes = repaired.length;
  const delta = beforeBytes - afterBytes;

  return (
    <div className="border-t border-gray-200 bg-amber-50 px-4 py-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium text-amber-800">Repair</span>
        <span className="text-amber-600">
          {actions.length} action{actions.length !== 1 ? "s" : ""} applied
        </span>
        {delta !== 0 && (
          <span className="text-amber-500 ml-auto">
            {delta > 0 ? `−${delta}` : `+${Math.abs(delta)}`} chars
          </span>
        )}
      </div>

      {/* Action log */}
      <ul className="space-y-1">
        {log.map((entry, i) => (
          <li key={i} className="text-amber-700 flex items-start gap-1">
            <span className="text-amber-400">•</span>
            <span>{entry}</span>
          </li>
        ))}
      </ul>

      {/* Action badges */}
      <div className="flex flex-wrap gap-1 mt-2">
        {actions.map((action) => (
          <span
            key={action}
            className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 border border-amber-200"
          >
            {actionLabel(action)}
          </span>
        ))}
      </div>
    </div>
  );
}

function actionLabel(action: string): string {
  switch (action) {
    case "strip-fragment":
      return "stripped fragment";
    case "close-tag":
      return "closed tags";
    case "strip-preamble":
      return "stripped preamble";
    case "strip-fences":
      return "stripped fences";
    default:
      return action;
  }
}
