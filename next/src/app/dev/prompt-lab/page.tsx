"use client";

import { useState, useCallback, useEffect } from "react";
import type { EvalResult } from "@/lib/agents/evaluator";

// Inline default prompt — avoids an RSC boundary for a dev page.
const DEFAULT_PROMPT = `## Task

Generate a single-file HTML document that visualises the structured survey data below. The document must be self-contained (no external images, fonts via CDN only) and must annotate every data point with a source-key comment.

---

## Source-Key Annotation Rules

Place a source-key comment IMMEDIATELY after each HTML element that displays a value from the source data:

\`\`\`
<!-- pf-src: path.to.field -->
\`\`\`

**Allowed source keys** (only these paths are valid):
- \`rows[].department\`
- \`rows[].question\`
- \`rows[].category\`
- \`rows[].score\`
- \`rows[].responses\`
- \`rows[].comment\`

**Rules:**
- Use EXACTLY the comment format shown above. No variations.
- Do NOT use \`data-pf-source-id\` or any other HTML attribute for source tracing.
- Every displayed fact, number, label, or quote from the source data MUST have a source-key comment.
- A single HTML element can have at most one source-key comment.
- Place the comment on the same line as the closing tag, or on the next line.

---

## Data Fidelity Rules

- **Do NOT invent facts.** Every number, label, and quote in the HTML must come from the source data.
- **Do NOT summarise or compress.** If the source data has 15 rows, the HTML must represent all 15 rows.
- **Do NOT use placeholder text.** No "Lorem ipsum", no "Your text here", no "Sample data".
- **Preserve precision.** Numeric scores (e.g. 4.2, 3.1) must appear exactly as given — do not round.
- **Quote exactly.** Comment strings from the source data must appear verbatim in the HTML.

---

## Output Format

- Output ONLY raw HTML. The first character must be \`<\`. The last character must be \`>\`.
- Do NOT wrap the HTML in markdown fences.
- Do NOT include any explanatory text before or after the HTML.
- The document must start with \`<!DOCTYPE html>\` and end with \`</html>\`.

---

## Source Data: Employee Engagement Survey — Q1 2025

\`\`\`json
(15 rows of survey data — injected by the server)
\`\`\``;

const ADAPTERS = [
  { id: "mock", label: "Mock (golden HTML)", needsKey: false },
  { id: "deepseek", label: "DeepSeek API", needsKey: true },
  { id: "kimi", label: "Kimi API (Moonshot)", needsKey: true },
];

type TabId = "raw" | "html" | "keys" | "verify" | "score";

const TABS: { id: TabId; label: string }[] = [
  { id: "raw", label: "Raw Output" },
  { id: "html", label: "Clean HTML" },
  { id: "keys", label: "Source Keys" },
  { id: "verify", label: "Verification" },
  { id: "score", label: "Score" },
];

const HISTORY_KEY = "prompt-lab-history";
const MAX_HISTORY = 10;

function loadHistory(): EvalResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as EvalResult[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(results: EvalResult[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(results.slice(0, MAX_HISTORY)));
  } catch {
    // quota exceeded — silently drop
  }
}

export default function PromptLabPage() {
  const [adapterId, setAdapterId] = useState("mock");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("raw");
  const [history, setHistory] = useState<EvalResult[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const runEval = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const started = Date.now();
    try {
      const resp = await fetch("/api/agent/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adapter: adapterId, prompt }),
      });
      const data = (await resp.json()) as EvalResult & { error?: string };
      if (!resp.ok) {
        setError(data.error ?? `HTTP ${resp.status}`);
        return;
      }
      setResult(data);
      setActiveTab("raw");
      // Save to history
      const next = [data, ...history].slice(0, MAX_HISTORY);
      setHistory(next);
      saveHistory(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [adapterId, prompt, history]);

  const selectedAdapter = ADAPTERS.find((a) => a.id === adapterId);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Prompt Lab</h1>
            <p className="text-sm text-gray-500">
              Developer harness for testing agent prompt compliance
            </p>
          </div>
          <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded border border-amber-200">
            dev only
          </span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            {/* Adapter picker */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Adapter
              </label>
              <select
                value={adapterId}
                onChange={(e) => setAdapterId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono bg-white"
              >
                {ADAPTERS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} {a.needsKey ? "(needs API key)" : ""}
                  </option>
                ))}
              </select>
              {selectedAdapter?.needsKey && (
                <p className="text-xs text-amber-600 mt-1">
                  Requires{" "}
                  <code className="bg-amber-50 px-1">
                    {adapterId === "deepseek" ? "DEEPSEEK_API_KEY" : "KIMI_API_KEY"}
                  </code>{" "}
                  in <code>next/.env.local</code>
                </p>
              )}
            </div>

            {/* Run button */}
            <button
              onClick={runEval}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? "Running…" : "⚡ Run Evaluation"}
            </button>
          </div>

          {/* Prompt editor */}
          <details className="mt-4">
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
              Edit prompt ↓ (click to expand)
            </summary>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-64 mt-2 border border-gray-300 rounded-lg p-3 font-mono text-xs
                         bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
              spellCheck={false}
            />
          </details>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700 font-medium text-sm">Error</p>
            <pre className="text-red-600 text-xs mt-1 whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 mb-6 text-center">
            <div className="animate-pulse text-gray-400 text-sm">Waiting for agent response…</div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Meta bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <span>
                Adapter: <strong className="text-gray-700">{result.adapterLabel}</strong>
              </span>
              <span>
                Duration: <strong className="text-gray-700">{result.durationMs}ms</strong>
              </span>
              <span>
                Score:{" "}
                <strong
                  className={
                    result.verificationReport.score >= 90
                      ? "text-green-600"
                      : result.verificationReport.score >= 60
                        ? "text-amber-600"
                        : "text-red-600"
                  }
                >
                  {result.verificationReport.score}/100
                </strong>
              </span>
              <span>
                Status:{" "}
                <strong
                  className={
                    result.verificationReport.passed ? "text-green-600" : "text-red-600"
                  }
                >
                  {result.verificationReport.passed ? "PASS" : "FAIL"}
                </strong>
              </span>
              {result.error && (
                <span className="text-red-500">⚠ {result.error}</span>
              )}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <nav className="flex border-b border-gray-200 bg-gray-50">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium transition-colors
                      ${activeTab === tab.id
                        ? "bg-white text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
                        : "text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="p-4">
                {/* Raw Output */}
                {activeTab === "raw" && (
                  <div>
                    {result.rawOutput ? (
                      <pre className="text-xs font-mono bg-gray-50 rounded-lg p-4 overflow-auto max-h-[600px] whitespace-pre-wrap break-all">
                        {result.rawOutput}
                      </pre>
                    ) : (
                      <p className="text-gray-400 text-sm italic">No raw output (generation may have failed).</p>
                    )}
                  </div>
                )}

                {/* Clean HTML */}
                {activeTab === "html" && (
                  <div>
                    {result.generatedHtml ? (
                      <>
                        <div className="mb-4">
                          <iframe
                            srcDoc={result.generatedHtml}
                            className="w-full h-[400px] border border-gray-200 rounded-lg"
                            title="Generated HTML preview"
                            sandbox="allow-scripts allow-same-origin"
                          />
                        </div>
                        <details>
                          <summary className="text-sm text-gray-500 cursor-pointer">
                            View source ↓
                          </summary>
                          <pre className="text-xs font-mono bg-gray-50 rounded-lg p-4 mt-2 overflow-auto max-h-[400px] whitespace-pre-wrap break-all">
                            {result.generatedHtml}
                          </pre>
                        </details>
                      </>
                    ) : (
                      <p className="text-gray-400 text-sm italic">
                        No clean HTML extracted. The agent may not have produced valid HTML.
                      </p>
                    )}
                  </div>
                )}

                {/* Source Keys */}
                {activeTab === "keys" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="text-green-700 font-medium">
                          {result.postprocessResult.foundKeys.length}
                        </div>
                        <div className="text-green-600 text-xs">found keys</div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="text-red-700 font-medium">
                          {result.postprocessResult.missingKeys.length}
                        </div>
                        <div className="text-red-600 text-xs">missing keys</div>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="text-amber-700 font-medium">
                          {result.postprocessResult.invalidKeys.length}
                        </div>
                        <div className="text-amber-600 text-xs">invalid keys</div>
                      </div>
                    </div>

                    <div className="text-sm">
                      <span className="font-medium">Coverage: </span>
                      <span
                        className={
                          result.postprocessResult.coverage >= 0.9
                            ? "text-green-600"
                            : result.postprocessResult.coverage >= 0.5
                              ? "text-amber-600"
                              : "text-red-600"
                        }
                      >
                        {Math.round(result.postprocessResult.coverage * 100)}%
                      </span>
                      <span className="text-gray-400 ml-1">
                        ({result.postprocessResult.totalComments} total comments)
                      </span>
                    </div>

                    {result.postprocessResult.foundKeys.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Found keys:</p>
                        <div className="flex flex-wrap gap-1">
                          {result.postprocessResult.foundKeys.map((k) => (
                            <code key={k} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">
                              {k}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.postprocessResult.missingKeys.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Missing keys:</p>
                        <div className="flex flex-wrap gap-1">
                          {result.postprocessResult.missingKeys.map((k) => (
                            <code key={k} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">
                              {k}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.postprocessResult.invalidKeys.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Invalid keys:</p>
                        <div className="flex flex-wrap gap-1">
                          {result.postprocessResult.invalidKeys.map((k) => (
                            <code key={k} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                              {k}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Verification Report */}
                {activeTab === "verify" && (
                  <div className="space-y-2">
                    {result.verificationReport.checks.map((check) => (
                      <div
                        key={check.id}
                        className={`rounded-lg p-3 border text-sm
                          ${check.status === "pass"
                            ? "bg-green-50 border-green-200"
                            : check.status === "warn"
                              ? "bg-amber-50 border-amber-200"
                              : "bg-red-50 border-red-200"
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold uppercase
                              ${check.status === "pass"
                                ? "text-green-600"
                                : check.status === "warn"
                                  ? "text-amber-600"
                                  : "text-red-600"
                              }`}
                          >
                            {check.status}
                          </span>
                          <span className="font-medium text-gray-800">{check.label}</span>
                          {check.metric !== undefined && (
                            <span className="text-xs text-gray-400 ml-auto">
                              {typeof check.metric === "number" && check.metric < 1
                                ? `${Math.round(check.metric * 100)}%`
                                : check.metric}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{check.detail}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Score */}
                {activeTab === "score" && (
                  <div className="text-center py-8">
                    <div
                      className={`text-6xl font-bold mb-2
                        ${result.verificationReport.score >= 90
                          ? "text-green-600"
                          : result.verificationReport.score >= 60
                            ? "text-amber-600"
                            : "text-red-600"
                        }`}
                    >
                      {result.verificationReport.score}
                    </div>
                    <div className="text-gray-400 text-sm">/ 100</div>
                    <div
                      className={`mt-4 text-lg font-medium
                        ${result.verificationReport.passed ? "text-green-700" : "text-red-700"}`}
                    >
                      {result.verificationReport.summary}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* History */}
        {history.length > 0 && !result && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mt-6">
            <h2 className="text-sm font-medium text-gray-600 mb-3">
              Recent Runs
            </h2>
            <div className="space-y-2">
              {history.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setResult(r);
                    setActiveTab("raw");
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg border border-gray-100
                             hover:bg-gray-50 transition-colors text-sm flex items-center gap-3"
                >
                  <span className="font-mono text-xs text-gray-400 w-16">
                    {r.adapterId}
                  </span>
                  <span
                    className={`font-bold ${
                      r.verificationReport.score >= 90
                        ? "text-green-600"
                        : r.verificationReport.score >= 60
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {r.verificationReport.score}/100
                  </span>
                  <span className="text-gray-400 text-xs ml-auto">
                    {new Date(r.runAt).toLocaleTimeString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && history.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">
              Select an adapter and click &ldquo;Run Evaluation&rdquo; to generate and verify HTML.
            </p>
            <p className="text-gray-300 text-xs mt-2">
              Mock adapter works without API keys. DeepSeek and Kimi need keys in next/.env.local.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
