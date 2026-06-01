/**
 * Agent adapter abstraction — hardened.
 *
 * Adapters:
 *   - MockAdapter: returns pre-canned HTML. Always works, no API key.
 *   - DeepSeekAdapter: calls api.deepseek.com. Requires DEEPSEEK_API_KEY.
 *   - KimiAdapter: calls api.moonshot.cn. Requires KIMI_API_KEY.
 *
 * Hardening (0.3.8):
 *   - AdapterError with categorized codes (missing_key, timeout, api_error, …)
 *   - Timeout via AbortController (default 90s per adapter)
 *   - ApiAdapter base class for shared fetch/env logic
 *   - Diagnostics method for health checks
 *   - Secrets never appear in error messages
 */

// ─── Types ────────────────────────────────────────────────────────────

export type AdapterType = "api" | "cli" | "mock";

export type AdapterDiagnostics = {
  /** Adapter id. */
  id: string;
  /** Whether the adapter is ready to generate. */
  healthy: boolean;
  /** Human-readable status. */
  status: string;
  /** Missing env vars (if any). */
  missingEnv?: string[];
  /** Adapter type. */
  type: AdapterType;
  /** Timeout in ms. */
  timeoutMs: number;
};

// ─── Adapter Error ────────────────────────────────────────────────────

export type AdapterErrorCode =
  | "missing_key"
  | "timeout"
  | "api_error"
  | "empty_response"
  | "unknown";

export class AdapterError extends Error {
  public readonly code: AdapterErrorCode;
  /** Debug detail — never contains secrets. */
  public readonly detail: string;

  constructor(code: AdapterErrorCode, message: string, detail = "") {
    super(message);
    this.name = "AdapterError";
    this.code = code;
    this.detail = detail;
  }
}

// ─── Interface ────────────────────────────────────────────────────────

export interface AgentAdapter {
  /** Human-readable label. */
  readonly label: string;
  /** Unique id. */
  readonly id: string;
  /** Whether this adapter needs an API key. */
  readonly needsApiKey: boolean;
  /** Adapter category. */
  readonly type: AdapterType;
  /** Generation timeout in ms. */
  readonly timeoutMs: number;

  /**
   * Send a prompt and return the raw agent output.
   * @param signal — optional AbortSignal for cancellation/timeout.
   */
  generate(prompt: string, signal?: AbortSignal): Promise<string>;

  /**
   * Health check — returns diagnostics without calling generate().
   */
  diagnostics(): AdapterDiagnostics;
}

// ─── Timeout Helper ───────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Wrap a promise with an AbortController timeout.
 * Rejects with AdapterError("timeout", …) if the promise doesn't resolve
 * within `ms` milliseconds.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  adapterId: string,
): Promise<T> {
  if (ms <= 0) return promise;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(
          new AdapterError(
            "timeout",
            `${adapterId}: generation timed out after ${ms / 1000}s.`,
            `timeout=${ms}ms`,
          ),
        );
      });
    }),
  ]).finally(() => clearTimeout(timer));
}

// ─── API Adapter Base Class ───────────────────────────────────────────

const SECRET_PREFIX_RE = /^sk-/i;

/**
 * Base class for HTTP API adapters (DeepSeek, Kimi, etc.).
 * Provides shared env-var reading, fetch, and error handling.
 */
export abstract class ApiAdapter implements AgentAdapter {
  abstract readonly label: string;
  abstract readonly id: string;
  abstract readonly needsApiKey: boolean;
  abstract readonly type: AdapterType;
  abstract readonly timeoutMs: number;

  /** API endpoint URL. */
  protected abstract endpoint(): string;
  /** Model name sent to the API. */
  protected abstract modelName(): string;
  /** Environment variable name for the API key. */
  protected abstract envKeyName(): string;
  /** Max tokens in the API request. */
  protected maxTokens(): number {
    return 8192;
  }

  async generate(prompt: string, signal?: AbortSignal): Promise<string> {
    const key = this.readKey();

    const mergedSignal = signal ?? new AbortController().signal;

    const text = await withTimeout(
      this.callApi(key, prompt, mergedSignal),
      this.timeoutMs,
      this.id,
    );

    return text;
  }

  diagnostics(): AdapterDiagnostics {
    const hasKey = !!process.env[this.envKeyName()];
    return {
      id: this.id,
      healthy: hasKey,
      status: hasKey ? "API key configured." : "API key not set.",
      missingEnv: hasKey ? undefined : [this.envKeyName()],
      type: this.type,
      timeoutMs: this.timeoutMs,
    };
  }

  /**
   * Read the API key from the environment.
   * Throws AdapterError("missing_key", …) with no secret in the message.
   */
  protected readKey(): string {
    const envName = this.envKeyName();
    const key = process.env[envName];
    if (!key || !key.trim()) {
      throw new AdapterError(
        "missing_key",
        `${this.label}: ${envName} is not set. Add it to next/.env.local or export it in your shell.`,
        `env=${envName}`,
      );
    }
    return key.trim();
  }

  /**
   * Call the API endpoint with the given prompt.
   * Returns the assistant's text content.
   * Error messages never include the API key.
   */
  protected async callApi(
    key: string,
    prompt: string,
    signal: AbortSignal,
  ): Promise<string> {
    let resp: Response;
    try {
      resp = await fetch(this.endpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: this.modelName(),
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: this.maxTokens(),
        }),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new AdapterError(
          "timeout",
          `${this.label}: request aborted (timeout or cancelled).`,
        );
      }
      throw new AdapterError(
        "api_error",
        `${this.label}: network error — ${err instanceof Error ? err.message : String(err)}`,
        `fetch failed`,
      );
    }

    if (!resp.ok) {
      // Read a truncated body for debugging — never include the full response
      // which might reflect the API key in error messages.
      const statusCode = resp.status;
      let detail = `http=${statusCode}`;
      try {
        const text = await resp.text();
        // Only include a safe prefix of the error body
        const safePreview = sanitizeErrorBody(text, 120);
        detail += ` body=${safePreview}`;
      } catch {
        detail += " body=(unreadable)";
      }
      throw new AdapterError(
        "api_error",
        `${this.label}: API returned HTTP ${statusCode}.`,
        detail,
      );
    }

    let json: unknown;
    try {
      json = await resp.json();
    } catch {
      throw new AdapterError(
        "api_error",
        `${this.label}: API returned non-JSON response.`,
      );
    }

    const content = extractContent(json);
    if (!content) {
      throw new AdapterError(
        "empty_response",
        `${this.label}: API returned an empty response. The model may not have produced output.`,
      );
    }

    return content;
  }
}

// ─── DeepSeek Adapter ─────────────────────────────────────────────────

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

export class DeepSeekAdapter extends ApiAdapter {
  readonly label = "DeepSeek API";
  readonly id = "deepseek";
  readonly needsApiKey = true;
  readonly type: AdapterType = "api";
  readonly timeoutMs = 90_000;

  protected endpoint(): string {
    return DEEPSEEK_API;
  }
  protected modelName(): string {
    return DEEPSEEK_MODEL;
  }
  protected envKeyName(): string {
    return "DEEPSEEK_API_KEY";
  }
  protected maxTokens(): number {
    return 8192;
  }
}

// ─── Kimi Adapter ─────────────────────────────────────────────────────

const KIMI_API = "https://api.moonshot.cn/v1/chat/completions";
const KIMI_MODEL = "moonshot-v1-8k";

export class KimiAdapter extends ApiAdapter {
  readonly label = "Kimi API (Moonshot)";
  readonly id = "kimi";
  readonly needsApiKey = true;
  readonly type: AdapterType = "api";
  readonly timeoutMs = 90_000;

  protected endpoint(): string {
    return KIMI_API;
  }
  protected modelName(): string {
    return KIMI_MODEL;
  }
  protected envKeyName(): string {
    return "KIMI_API_KEY";
  }
  protected maxTokens(): number {
    return 4096;
  }
}

// ─── Mock Adapter ─────────────────────────────────────────────────────

export class MockAdapter implements AgentAdapter {
  readonly label = "Mock (golden HTML)";
  readonly id = "mock";
  readonly needsApiKey = false;
  readonly type: AdapterType = "mock";
  readonly timeoutMs = 5_000;

  async generate(_prompt: string, signal?: AbortSignal): Promise<string> {
    // Simulate a short delay so the UI shows a loading state.
    await delayOrAbort(300, signal);
    return MOCK_HTML;
  }

  diagnostics(): AdapterDiagnostics {
    return {
      id: this.id,
      healthy: true,
      status: "Mock adapter is always available.",
      type: this.type,
      timeoutMs: this.timeoutMs,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Extract the assistant's text content from API response JSON.
 * Handles the common `choices[0].message.content` shape.
 */
function extractContent(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const obj = json as Record<string, unknown>;
  const choices = obj.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message;
  if (!message || typeof message !== "object") return "";
  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content : "";
}

/**
 * Sanitize an API error body for safe inclusion in error messages.
 * Strips potential secrets (lines containing "sk-", "Bearer", etc.)
 * and truncates to maxLen.
 */
function sanitizeErrorBody(body: string, maxLen: number): string {
  const lines = body
    .split("\n")
    .filter(
      (line) =>
        !SECRET_PREFIX_RE.test(line) &&
        !/bearer\s+/i.test(line) &&
        !/authorization/i.test(line),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return lines.length > maxLen
    ? lines.slice(0, maxLen) + "…"
    : lines;
}

/**
 * Promise-based delay that respects an AbortSignal.
 * Throws AdapterError("timeout", …) if the signal fires.
 */
async function delayOrAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new AdapterError("timeout", "Mock: generation aborted.");
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new AdapterError("timeout", "Mock: generation aborted."));
    }, { once: true });
  });
}

// ─── Registry ─────────────────────────────────────────────────────────

export const ALL_ADAPTERS: AgentAdapter[] = [
  new MockAdapter(),
  new DeepSeekAdapter(),
  new KimiAdapter(),
];

export function getAdapter(id: string): AgentAdapter | undefined {
  return ALL_ADAPTERS.find((a) => a.id === id);
}

// ─── Mock Golden HTML ─────────────────────────────────────────────────

const MOCK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Employee Engagement Survey — Q1 2025</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Sans+SC:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-gray-50 font-sans text-gray-900">
<div class="max-w-6xl mx-auto p-6">
<h1 class="text-3xl font-bold mb-2">Employee Engagement Survey</h1><!-- pf-src: rows[].question -->
<p class="text-gray-500 mb-8">Q1 2025 · 195 responses across 5 departments</p>

<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
  <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
    <div class="text-sm text-gray-500">Avg. Workplace Score</div>
    <div class="text-3xl font-bold text-blue-600">4.26</div>
  </div>
  <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
    <div class="text-sm text-gray-500">Avg. Recognition Score</div>
    <div class="text-3xl font-bold text-amber-600">3.52</div>
  </div>
  <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
    <div class="text-sm text-gray-500">Avg. Growth Score</div>
    <div class="text-3xl font-bold text-red-500">3.00</div>
  </div>
</div>

<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
<table class="w-full text-sm">
<thead class="bg-gray-50 text-left">
<tr>
  <th class="p-3 font-semibold">Department</th>
  <th class="p-3 font-semibold">Question</th>
  <th class="p-3 font-semibold">Category</th>
  <th class="p-3 font-semibold text-right">Score</th>
  <th class="p-3 font-semibold text-right">N</th>
  <th class="p-3 font-semibold">Comment</th>
</tr>
</thead>
<tbody>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Engineering</td><!-- pf-src: rows[].department -->
  <td class="p-3">How satisfied are you with remote work flexibility?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">Workplace</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">4.2</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">87</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Most engineers prefer 3 days remote, 2 in-office</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Engineering</td><!-- pf-src: rows[].department -->
  <td class="p-3">Do you feel your work is recognized?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">Recognition</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">3.1</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">87</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Recognition is inconsistent across teams</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Engineering</td><!-- pf-src: rows[].department -->
  <td class="p-3">How would you rate career growth opportunities?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">Growth</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">2.8</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">87</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Junior engineers want clearer promotion criteria</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Design</td><!-- pf-src: rows[].department -->
  <td class="p-3">How satisfied are you with remote work flexibility?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">Workplace</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">4.5</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">23</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Design team is fully remote and happy</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Design</td><!-- pf-src: rows[].department -->
  <td class="p-3">Do you feel your work is recognized?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">Recognition</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">3.8</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">23</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Design reviews help but peer recognition is lacking</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Design</td><!-- pf-src: rows[].department -->
  <td class="p-3">How would you rate career growth opportunities?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">Growth</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">3.2</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">23</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Limited IC track beyond Senior Designer</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Marketing</td><!-- pf-src: rows[].department -->
  <td class="p-3">How satisfied are you with remote work flexibility?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">Workplace</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">4.0</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">31</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Hybrid schedule works well for events team</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Marketing</td><!-- pf-src: rows[].department -->
  <td class="p-3">Do you feel your work is recognized?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">Recognition</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">3.5</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">31</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Campaign wins are celebrated, day-to-day less so</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Marketing</td><!-- pf-src: rows[].department -->
  <td class="p-3">How would you rate career growth opportunities?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">Growth</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">3.0</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">31</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Want more cross-functional project opportunities</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Sales</td><!-- pf-src: rows[].department -->
  <td class="p-3">How satisfied are you with remote work flexibility?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">Workplace</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">3.8</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">42</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Field sales already remote; inside sales want more flexibility</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Sales</td><!-- pf-src: rows[].department -->
  <td class="p-3">Do you feel your work is recognized?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">Recognition</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">4.0</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">42</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Commission structure provides clear recognition</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Sales</td><!-- pf-src: rows[].department -->
  <td class="p-3">How would you rate career growth opportunities?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">Growth</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">3.5</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">42</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Clear path from SDR → AE → Enterprise AE</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">HR</td><!-- pf-src: rows[].department -->
  <td class="p-3">How satisfied are you with remote work flexibility?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">Workplace</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">4.8</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">12</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">HR team is fully distributed</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">HR</td><!-- pf-src: rows[].department -->
  <td class="p-3">Do you feel your work is recognized?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">Recognition</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">3.2</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">12</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">HR work is often invisible until something goes wrong</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">HR</td><!-- pf-src: rows[].department -->
  <td class="p-3">How would you rate career growth opportunities?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">Growth</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">2.5</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">12</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Small team limits upward mobility</td><!-- pf-src: rows[].comment -->
</tr>
</tbody>
</table>
</div>
</div>
</body>
</html>`;
