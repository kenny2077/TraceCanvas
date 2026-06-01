/**
 * Source-key postprocessor.
 *
 * Scans generated HTML for `<!-- pf-src: path -->` comments, validates
 * each key against the expected source schema, and reports coverage.
 * This is the bridge between agent output and the verification engine —
 * it parses the agent's annotations into a structured form the verifier
 * can reason about.
 */

export type PostprocessResult = {
  /** Every `pf-src:` key found in the HTML, in document order. */
  foundKeys: string[];
  /** Keys from `allowedKeys` that were NOT found in the HTML. */
  missingKeys: string[];
  /** Keys found in the HTML that are NOT in `allowedKeys`. */
  invalidKeys: string[];
  /** `foundKeys.length / allowedKeys.length` — note: valid keys only. */
  coverage: number;
  /** Total `pf-src:` comments found (including invalid). */
  totalComments: number;
  /** Raw matches for debugging. */
  rawMatches: Array<{ key: string; index: number }>;
};

// Matches `<!-- pf-src: rows[].score -->` with optional whitespace.
const SRC_KEY_RE = /<!--\s*pf-src:\s*(\S+)\s*-->/g;

/**
 * Extract and validate source-key comments from agent-generated HTML.
 *
 * @param html - Raw agent output (before extractHtml — may contain fences).
 * @param allowedKeys - The only valid source-key paths.
 * @returns Structured postprocess result.
 */
export function postprocessSourceKeys(
  html: string,
  allowedKeys: string[],
): PostprocessResult {
  const allowedSet = new Set(allowedKeys);
  const rawMatches: Array<{ key: string; index: number }> = [];
  const foundSet = new Set<string>();
  const invalidSet = new Set<string>();

  let m: RegExpExecArray | null;
  SRC_KEY_RE.lastIndex = 0;
  while ((m = SRC_KEY_RE.exec(html)) !== null) {
    const key = m[1];
    rawMatches.push({ key, index: m.index });
    if (allowedSet.has(key)) {
      foundSet.add(key);
    } else {
      invalidSet.add(key);
    }
  }

  const foundKeys = Array.from(foundSet).sort();
  const invalidKeys = Array.from(invalidSet).sort();
  const missingKeys = allowedKeys.filter((k) => !foundSet.has(k)).sort();
  const coverage =
    allowedKeys.length > 0
      ? Math.round((foundKeys.length / allowedKeys.length) * 100) / 100
      : 0;

  return {
    foundKeys,
    missingKeys,
    invalidKeys,
    coverage,
    totalComments: rawMatches.length,
    rawMatches,
  };
}

/**
 * Quick check — does the HTML contain any source-key comments at all?
 * Used by the verification engine to short-circuit when the agent ignored
 * the annotation rules entirely.
 */
export function hasSourceKeys(html: string): boolean {
  SRC_KEY_RE.lastIndex = 0;
  return SRC_KEY_RE.test(html);
}
