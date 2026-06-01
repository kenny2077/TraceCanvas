/**
 * HTML validation types for TraceCanvas.
 *
 * Defines the result shape for parser-based HTML validation.
 * Compatible with verify/engine.ts CheckResult for easy integration
 * into the verification report.
 */

// ─── Issue Types ─────────────────────────────────────────────────────

export type HtmlIssueSeverity = "error" | "warn";

export type HtmlIssueKind =
  // Structural (parser-detected)
  | "missing-html"
  | "missing-head"
  | "missing-body"
  | "missing-doctype"
  | "unclosed-html"
  | "unclosed-body"
  | "malformed-tag"
  | "malformed-closing-tag"
  | "attribute-fragment" // e.g. `< class="pf-claim">` — missing tag name
  | "orphaned-text"      // text outside expected containers
  // Security (pattern-detected, parser-confirmed)
  | "script-tag"
  | "event-handler"
  | "javascript-url"
  // Sanitization
  | "sanitizer-removed"  // DOMPurify removed elements
  // Content
  | "empty-body"
  | "markdown-fence";

export type HtmlIssue = {
  kind: HtmlIssueKind;
  severity: HtmlIssueSeverity;
  message: string;
  /** Approximate position in the source HTML (character offset). */
  offset?: number;
  /** The offending source fragment (truncated to 80 chars). */
  snippet?: string;
};

// ─── Validation Result ───────────────────────────────────────────────

export type HtmlValidationResult = {
  /** true if no "error"-severity issues. */
  valid: boolean;
  /** All issues found, ordered by offset. */
  issues: HtmlIssue[];
  /** Parsed document (null if parsing failed entirely). */
  document: Document | null;
  /** DOMPurify-sanitized HTML for diff comparison. */
  sanitized: string;
  /** Elements removed by DOMPurify (count). */
  sanitizerRemoved: number;
  /** Summary for display. */
  summary: string;
};

// ─── Repair Types ────────────────────────────────────────────────────

export type RepairAction =
  | "strip-fragment"       // Remove a broken fragment
  | "close-tag"            // Add missing closing tag
  | "strip-preamble"       // Remove non-HTML preamble
  | "strip-fences"         // Remove markdown fences
  | "none";                // No repair needed/applied

export type RepairResult = {
  /** The repaired HTML (or original if no repair needed). */
  html: string;
  /** Actions taken. */
  actions: RepairAction[];
  /** Whether any changes were made. */
  changed: boolean;
  /** Human-readable log of what was done. */
  log: string[];
};
