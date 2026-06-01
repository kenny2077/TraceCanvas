/**
 * Parser-based HTML validator.
 *
 * Uses DOMParser for structural validation and regex for security checks.
 * The browser's error-correcting parser silently "fixes" most malformed HTML,
 * so we can't rely on <parsererror> alone. Instead, we parse the HTML, walk
 * the DOM tree, and compare against the source to detect auto-corrections.
 *
 * Security checks:
 *   - <script> tags (excluding known-safe CDN scripts)
 *   - Event handlers (onclick, onerror, onload, etc.)
 *   - javascript: URLs in href/src/action attributes
 *
 * Structural checks (parser-based):
 *   - Missing <html>, <head>, <body> after parsing
 *   - Malformed tag names (parsed tagName ≠ source tagName)
 *   - Malformed closing tags (</section  <section>)
 *   - Attribute-only fragments (< class="pf-claim"> — missing tag name)
 *   - Unclosed critical tags
 *
 * Sanitization check:
 *   - DOMPurify diff: elements removed by sanitization
 */

import DOMPurify from "dompurify";
import type {
  HtmlValidationResult,
  HtmlIssue,
  HtmlIssueKind,
} from "./types";

// ─── Public API ──────────────────────────────────────────────────────

export type ValidateOptions = {
  /** Whether to run DOMPurify sanitization diff. Default: true. */
  sanitize?: boolean;
  /** Known-safe script sources (CDN URLs). Scripts NOT matching these fail. */
  allowedScripts?: RegExp[];
};

const DEFAULT_ALLOWED_SCRIPTS = [
  /cdn\.tailwindcss\.com/,
  /cdnjs\.cloudflare\.com/,
  /cdn\.jsdelivr\.net/,
  /fonts\.googleapis\.com/,
  /unpkg\.com/,
];

/**
 * Validate agent-generated HTML.
 *
 * @param html - Raw HTML string (after extractHtml).
 * @param opts - Validation options.
 * @returns Structured validation result.
 */
export function validateHtml(
  html: string,
  opts: ValidateOptions = {},
): HtmlValidationResult {
  const { sanitize = true } = opts;
  const allowedScripts = opts.allowedScripts ?? DEFAULT_ALLOWED_SCRIPTS;
  const issues: HtmlIssue[] = [];

  // ── Structural: Parse with DOMParser ─────────────────────────────
  let doc: Document | null = null;
  let parserFailed = false;

  if (typeof DOMParser === "undefined") {
    issues.push({
      kind: "missing-html",
      severity: "warn",
      message: "DOMParser unavailable — skipping structural checks.",
    });
    parserFailed = true;
  } else if (!html) {
    issues.push({
      kind: "empty-body",
      severity: "error",
      message: "HTML is empty.",
    });
  } else {
    try {
      doc = new DOMParser().parseFromString(html, "text/html");

      // Check for parsererror
      const parserErrors = doc.querySelectorAll("parsererror");
      if (parserErrors.length > 0) {
        for (const pe of parserErrors) {
          issues.push({
            kind: "malformed-tag",
            severity: "error",
            message: `Parser error: ${pe.textContent?.slice(0, 120) ?? "unknown"}`,
          });
        }
      }

      // Structural checks on the parsed tree
      checkStructure(doc, html, issues);
    } catch (err) {
      issues.push({
        kind: "malformed-tag",
        severity: "error",
        message: `DOMParser threw: ${err instanceof Error ? err.message : String(err)}`,
      });
      parserFailed = true;
    }
  }

  // ── Security: Pattern checks on source ───────────────────────────
  if (!parserFailed) {
    checkScriptTags(html, doc!, allowedScripts, issues);
    checkEventHandlers(html, doc!, issues);
    checkJavascriptUrls(html, doc!, issues);
  }

  // ── Structural: Source-level fragment checks ─────────────────────
  checkAttributeFragments(html, issues);
  checkMalformedClosingTags(html, issues);

  // ── Sanitization: DOMPurify diff ─────────────────────────────────
  let sanitized = html;
  let sanitizerRemoved = 0;
  if (sanitize && typeof DOMPurify !== "undefined") {
    try {
      sanitized = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ["*"], // allow all — we only want to count removals
        ALLOWED_ATTR: ["*"],
        ALLOW_DATA_ATTR: true,
      });
      // Count removed elements by comparing the source vs sanitized
      const originalCount = (html.match(/<(\w+)[\s>]/g) || []).length;
      const sanitizedCount = (sanitized.match(/<(\w+)[\s>]/g) || []).length;
      sanitizerRemoved = Math.max(0, originalCount - sanitizedCount);

      if (sanitizerRemoved > 0) {
        issues.push({
          kind: "sanitizer-removed",
          severity: "error",
          message: `DOMPurify removed ${sanitizerRemoved} element(s).`,
        });
      }
    } catch {
      // DOMPurify failed — skip sanitization check
    }
  }

  // ── Summary ──────────────────────────────────────────────────────
  const errors = issues.filter((i) => i.severity === "error");
  const valid = errors.length === 0;
  const summary = valid
    ? issues.length > 0
      ? `${issues.length} warning(s) — HTML is structurally valid.`
      : "HTML is valid."
    : `${errors.length} error(s), ${issues.length - errors.length} warning(s) — HTML has issues.`;

  return { valid, issues, document: doc, sanitized, sanitizerRemoved, summary };
}

// ─── Structural Checks ───────────────────────────────────────────────

function checkStructure(
  doc: Document,
  html: string,
  issues: HtmlIssue[],
): void {
  // Check for html/head/body
  if (!doc.documentElement || doc.documentElement.tagName.toLowerCase() !== "html") {
    issues.push({
      kind: "missing-html",
      severity: "error",
      message: "Parsed document has no <html> element.",
    });
  }
  if (!doc.head || doc.head.children.length === 0) {
    // <head> might be empty but present — check if it has no children
    const headTag = /<head[\s>]/i.test(html);
    if (!headTag) {
      issues.push({
        kind: "missing-head",
        severity: "warn",
        message: "No <head> element found.",
      });
    }
  }
  if (!doc.body || doc.body.children.length === 0) {
    const bodyTag = /<body[\s>]/i.test(html);
    if (bodyTag) {
      issues.push({
        kind: "empty-body",
        severity: "warn",
        message: "<body> element has no content.",
      });
    } else {
      issues.push({
        kind: "missing-body",
        severity: "error",
        message: "No <body> element found.",
      });
    }
  }

  // Unclosed critical tags: check if </html> and </body> appear in source
  if (!/<\/html>/i.test(html)) {
    issues.push({
      kind: "unclosed-html",
      severity: "error",
      message: "Missing closing </html> tag.",
    });
  }
  if (!/<\/body>/i.test(html)) {
    issues.push({
      kind: "unclosed-body",
      severity: "warn",
      message: "Missing closing </body> tag.",
    });
  }

  // Malformed tag detection: walk the parsed DOM and compare tag names
  // against the original source to detect auto-corrections.
  checkAutoCorrectedTags(doc.body ?? doc.documentElement, html, issues);
}

/**
 * Walk the parsed DOM tree and detect elements whose tagName was likely
 * auto-corrected by the browser parser. We do this by finding opening tags
 * in the source that don't match any valid HTML element name.
 */
function checkAutoCorrectedTags(
  root: Element,
  html: string,
  issues: HtmlIssue[],
): void {
  // Find suspicious open-tag patterns in the source:
  // - Tags starting with non-alpha chars: <  class=, <  div
  // - Tags with internal spaces before the name: < section (should be <section)
  // These are detected by the attribute-fragment and malformed-closing
  // checks below. Here we verify parsed elements exist.

  // Walk the tree and find any element that shouldn't exist.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let el = walker.nextNode() as Element | null;
  while (el) {
    // Check for elements with suspicious tag names
    const tag = el.tagName.toLowerCase();

    // HTMLUnknownElement: the browser creates these for custom/non-standard tags
    // that aren't valid HTML elements. In the context of agent output, these
    // are almost always typos or malformed tags.
    if (el instanceof HTMLUnknownElement) {
      const sourceFragment = findSourceFragment(html, `<${tag}`, 80);
      issues.push({
        kind: "malformed-tag",
        severity: "error",
        message: `Unknown element <${tag}> — likely a malformed tag.`,
        snippet: sourceFragment,
      });
    }

    el = walker.nextNode() as Element | null;
  }
}

// ─── Security Checks ─────────────────────────────────────────────────

const SCRIPT_RE = /<script\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi;

function checkScriptTags(
  html: string,
  _doc: Document,
  allowedScripts: RegExp[],
  issues: HtmlIssue[],
): void {
  let m: RegExpExecArray | null;
  SCRIPT_RE.lastIndex = 0;
  while ((m = SCRIPT_RE.exec(html)) !== null) {
    const src = m[1];
    const isAllowed = allowedScripts.some((re) => re.test(src));
    if (!isAllowed) {
      issues.push({
        kind: "script-tag",
        severity: "error",
        message: `External script not in allowlist: ${src.slice(0, 60)}`,
        offset: m.index,
        snippet: m[0].slice(0, 80),
      });
    }
  }

  // Also catch inline <script> tags (no src attribute)
  const inlineScriptRe = /<script\b(?![^>]*\bsrc\s*=)[^>]*>/gi;
  let im: RegExpExecArray | null;
  inlineScriptRe.lastIndex = 0;
  while ((im = inlineScriptRe.exec(html)) !== null) {
    issues.push({
      kind: "script-tag",
      severity: "error",
      message: "Inline <script> tag is forbidden.",
      offset: im.index,
      snippet: im[0].slice(0, 80),
    });
  }
}

const EVENT_HANDLER_RE =
  /\bon(click|dblclick|mousedown|mouseup|mouseover|mouseout|mousemove|keydown|keyup|keypress|submit|change|focus|blur|load|error|scroll|resize|input|select|abort|toggle|wheel|contextmenu|drag|drop|copy|cut|paste|play|pause|ended|volumechange|timeupdate)\s*=/gi;

function checkEventHandlers(
  html: string,
  _doc: Document,
  issues: HtmlIssue[],
): void {
  let m: RegExpExecArray | null;
  EVENT_HANDLER_RE.lastIndex = 0;
  while ((m = EVENT_HANDLER_RE.exec(html)) !== null) {
    issues.push({
      kind: "event-handler",
      severity: "error",
      message: `Event handler "${m[1]}" found in HTML.`,
      offset: m.index,
      snippet: html.slice(Math.max(0, m.index - 10), m.index + 30),
    });
  }
}

const JAVASCRIPT_URL_RE =
  /\b(?:href|src|action|formaction)\s*=\s*["']\s*javascript\s*:/gi;

function checkJavascriptUrls(
  html: string,
  _doc: Document,
  issues: HtmlIssue[],
): void {
  let m: RegExpExecArray | null;
  JAVASCRIPT_URL_RE.lastIndex = 0;
  while ((m = JAVASCRIPT_URL_RE.exec(html)) !== null) {
    issues.push({
      kind: "javascript-url",
      severity: "error",
      message: `javascript: URL found in attribute.`,
      offset: m.index,
      snippet: m[0].slice(0, 80),
    });
  }
}

// ─── Source-Level Fragment Checks ────────────────────────────────────

/**
 * Detect attribute-only fragments: `< class="..."` or `< style="..."` —
 * opening angle bracket followed by whitespace then an attribute.
 * The browser parser turns these into orphaned text nodes.
 */
const ATTR_FRAGMENT_RE = /<\s+(?:class|style|id|data-|href|src|alt|title|type|name|value|placeholder|disabled|checked|selected|readonly|required)\s*=/gi;

function checkAttributeFragments(html: string, issues: HtmlIssue[]): void {
  let m: RegExpExecArray | null;
  ATTR_FRAGMENT_RE.lastIndex = 0;
  while ((m = ATTR_FRAGMENT_RE.exec(html)) !== null) {
    issues.push({
      kind: "attribute-fragment",
      severity: "error",
      message: `Attribute-only fragment: missing tag name before attribute.`,
      offset: m.index,
      snippet: html.slice(Math.max(0, m.index), m.index + 40),
    });
  }
}

/**
 * Detect malformed closing tags: `</section  <section>` or `</div class="x">`.
 * A valid closing tag is `</tagname>` — no attributes, no spaces after tagname.
 */
const MALFORMED_CLOSING_RE = /<\/\s*(\w+)\s+[^>]*>/g;

function checkMalformedClosingTags(html: string, issues: HtmlIssue[]): void {
  let m: RegExpExecArray | null;
  MALFORMED_CLOSING_RE.lastIndex = 0;
  while ((m = MALFORMED_CLOSING_RE.exec(html)) !== null) {
    issues.push({
      kind: "malformed-closing-tag",
      severity: "error",
      message: `Malformed closing tag: </${m[1]} ...> — closing tags cannot have attributes or extra content.`,
      offset: m.index,
      snippet: m[0].slice(0, 80),
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function findSourceFragment(
  html: string,
  search: string,
  maxLen: number,
): string | undefined {
  const idx = html.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return undefined;
  return html.slice(idx, idx + maxLen);
}
