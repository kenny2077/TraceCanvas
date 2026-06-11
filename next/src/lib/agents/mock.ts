/**
 * Mock agent for TraceCanvas demos.
 *
 * Returns deterministic HTML fixtures without requiring any CLI installation.
 * This enables the killer demo path for users who don't have Claude/Codex/etc.
 *
 * The mock agent:
 *   - Is always "available" (no PATH check)
 *   - Returns HTML with proper pf-src source-key annotations
 *   - Streams via SSE (start → delta chunks → done)
 *   - Supports template-specific fixtures
 */

export type MockFixture = {
  /** HTML output with pf-src annotations */
  html: string;
  /** Simulated TTFB delay in ms */
  ttfb: number;
  /** Simulated total duration in ms */
  duration: number;
  /** Chunk sizes for streaming simulation */
  chunkSizes: number[];
};

/**
 * Generate a data-brief fixture with proper source-key annotations.
 * This matches what a real agent would produce for the CSV:
 *   department,score,headcount
 *   Engineering,4.2,32
 *   Design,4.7,12
 *   Marketing,3.8,18
 *   Product,4.5,8
 */
function dataBriefFixture(): MockFixture {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
<style>body{font-family:'Inter','Noto Sans SC',sans-serif;}</style>
</head>
<body class="bg-gray-50 min-h-screen p-8">
<div class="max-w-4xl mx-auto">
  <h1 class="text-3xl font-bold text-gray-900 mb-2">部门绩效简报</h1>
  <p class="text-gray-500 mb-8">4 个部门 · 综合评分与人员规模</p>

  <!-- KPI Cards -->
  <div class="grid grid-cols-4 gap-4 mb-8">
    <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <p class="text-xs text-gray-400 uppercase tracking-wide">平均评分</p>
      <p class="text-2xl font-bold text-blue-600">4.30</p><!-- pf-derived -->
    </div>
    <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <p class="text-xs text-gray-400 uppercase tracking-wide">总人员</p>
      <p class="text-2xl font-bold text-gray-900">70</p><!-- pf-derived -->
    </div>
    <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <p class="text-xs text-gray-400 uppercase tracking-wide">最高评分</p>
      <p class="text-2xl font-bold text-green-600">4.7</p><!-- pf-derived -->
    </div>
    <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <p class="text-xs text-gray-400 uppercase tracking-wide">最低评分</p>
      <p class="text-2xl font-bold text-red-500">3.8</p><!-- pf-derived -->
    </div>
  </div>

  <!-- Data Table -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    <table class="w-full text-sm">
      <thead class="bg-gray-50 border-b border-gray-100">
        <tr>
          <th class="px-6 py-3 text-left font-semibold text-gray-700">部门</th>
          <th class="px-6 py-3 text-right font-semibold text-gray-700">评分</th>
          <th class="px-6 py-3 text-right font-semibold text-gray-700">人员</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-3 text-gray-900">Engineering</td><!-- pf-src: rows[].department -->
          <td class="px-6 py-3 text-right font-medium text-gray-900">4.2</td><!-- pf-src: rows[].score -->
          <td class="px-6 py-3 text-right text-gray-500">32</td><!-- pf-src: rows[].headcount -->
        </tr>
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-3 text-gray-900">Design</td><!-- pf-src: rows[].department -->
          <td class="px-6 py-3 text-right font-medium text-gray-900">4.7</td><!-- pf-src: rows[].score -->
          <td class="px-6 py-3 text-right text-gray-500">12</td><!-- pf-src: rows[].headcount -->
        </tr>
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-3 text-gray-900">Marketing</td><!-- pf-src: rows[].department -->
          <td class="px-6 py-3 text-right font-medium text-gray-900">3.8</td><!-- pf-src: rows[].score -->
          <td class="px-6 py-3 text-right text-gray-500">18</td><!-- pf-src: rows[].headcount -->
        </tr>
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-3 text-gray-900">Product</td><!-- pf-src: rows[].department -->
          <td class="px-6 py-3 text-right font-medium text-gray-900">4.5</td><!-- pf-src: rows[].score -->
          <td class="px-6 py-3 text-right text-gray-500">8</td><!-- pf-src: rows[].headcount -->
        </tr>
      </tbody>
    </table>
  </div>

  <p class="text-xs text-gray-400 mt-4">数据来源：部门季度评估 · 生成时间：2026-06</p>
</div>
</body>
</html>`;

  return {
    html,
    ttfb: 300,
    duration: 1200,
    chunkSizes: [0, 800, 1600, 2400, html.length],
  };
}

/**
 * Generate a generic fallback fixture for any template.
 */
function genericFixture(): MockFixture {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-white min-h-screen p-8">
<div class="max-w-2xl mx-auto">
  <h1 class="text-2xl font-bold text-gray-900 mb-4">Mock Agent Output</h1>
  <p class="text-gray-600">This is a deterministic fixture from the Mock agent. No real AI was invoked.</p>
  <p class="text-gray-600 mt-2">Install a coding agent CLI (Claude, Codex, etc.) for live generation.</p>
</div>
</body>
</html>`;

  return {
    html,
    ttfb: 200,
    duration: 800,
    chunkSizes: [0, html.length],
  };
}

const FIXTURES: Record<string, () => MockFixture> = {
  "data-brief": dataBriefFixture,
  default: genericFixture,
};

export function getMockFixture(templateId?: string): MockFixture {
  const fn = FIXTURES[templateId ?? ""];
  if (fn) return fn();
  return FIXTURES.default();
}

/**
 * Stream a mock fixture as SSE events.
 */
export async function* mockAgentStream(
  templateId?: string,
): AsyncGenerator<
  | { type: "start"; bin: string; argv: string[]; promptBytes: number }
  | { type: "delta"; text: string }
  | { type: "done"; code: number | null }
> {
  const fixture = getMockFixture(templateId);

  yield {
    type: "start",
    bin: "mock-agent",
    argv: ["--template", templateId ?? "default"],
    promptBytes: 0,
  };

  // Simulate TTFB
  await delay(fixture.ttfb);

  // Stream chunks
  let lastEnd = 0;
  for (const end of fixture.chunkSizes.slice(1)) {
    const chunk = fixture.html.slice(lastEnd, end);
    if (chunk) {
      yield { type: "delta", text: chunk };
    }
    lastEnd = end;
    await delay(80);
  }

  yield { type: "done", code: 0 };
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
