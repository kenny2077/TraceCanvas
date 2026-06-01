/**
 * Conservative HTML repair engine.
 *
 * Applies minimal, deterministic fixes to agent-generated HTML that
 * fails structural validation. NEVER invents content — only strips
 * known-broken fragments, closes unclosed tags, and delegates
 * preamble/fence removal to the existing extractHtml function.
 *
 * Repair is opt-in and intentionally limited. The philosophy:
 *   - Browser auto-correction is NOT the same as export-safe.
 *   - If the agent produces broken HTML, we want to know — not silently fix.
 *   - Repair only handles the most common mechanical errors.
 */

import type { RepairResult, RepairAction } from "../html/types";

// ─── Public API ──────────────────────────────────────────────────────

export type RepairOptions = {
  /** Strip attribute-only fragments like `< class="...">`. Default: true. */
  stripAttributeFragments?: boolean;
  /** Close unclosed <body> and <html> tags. Default: true. */
  closeUnclosedTags?: boolean;
  /** Delegate preamble/fence removal to extractHtml. Default: false (caller handles). */
  extractFirst?: boolean;
};

/**
 * Apply conservative repairs to agent-generated HTML.
 *
 * @param html - Raw HTML (after agent generation, before extractHtml).
 * @param opts - Repair options.
 * @returns Repair result with fixed HTML and action log.
 */
export function repairHtml(
  html: string,
  opts: RepairOptions = {},
): RepairResult {
  const { stripAttributeFragments = true, closeUnclosedTags = true } = opts;
  let result = html;
  const actions: RepairAction[] = [];
  const log: string[] = [];

  // ── Strip attribute-only fragments ───────────────────────────────
  if (stripAttributeFragments) {
    const before = result.length;
    result = stripAttrFragments(result);
    if (result.length < before) {
      const removed = before - result.length;
      actions.push("strip-fragment");
      log.push(`Stripped attribute-only fragment(s) (${removed} chars removed).`);
    }
  }

  // ── Strip malformed closing tags ─────────────────────────────────
  {
    const before = result.length;
    result = stripMalformedClosing(result);
    if (result.length < before) {
      const removed = before - result.length;
      if (!actions.includes("strip-fragment")) actions.push("strip-fragment");
      log.push(`Stripped malformed closing tag(s) (${removed} chars removed).`);
    }
  }

  // ── Close unclosed body/html ─────────────────────────────────────
  if (closeUnclosedTags) {
    const before = result;
    result = closeCriticalTags(result);
    if (result !== before) {
      actions.push("close-tag");
      log.push("Added missing closing tag(s).");
    }
  }

  const changed = actions.length > 0 && actions[0] !== "none";

  return { html: result, actions, changed, log };
}

// ─── Repair Handlers ─────────────────────────────────────────────────

/**
 * Strip attribute-only fragments: `< class="..."`, `< style="..."`, etc.
 * These are always errors — the browser parser turns them into orphaned
 * text nodes. Removing them is safe; no content is invented.
 */
function stripAttrFragments(html: string): string {
  // Match: `<\s+(class|style|id|data-*|href|src|alt|title|type|name|value|placeholder|disabled|checked|selected|readonly|required)\s*=`
  // These are opening angle brackets followed by an attribute, missing the tag name.
  return html.replace(
    /<\s+(?:class|style|id|data-[a-z-]+|href|src|alt|title|type|name|value|placeholder|disabled|checked|selected|readonly|required)\s*=\s*["'][^"']*["']\s*\/?>/gi,
    "",
  );
}

/**
 * Strip malformed closing tags: `</section  <section>` or `</div class="x">`.
 * Closing tags cannot have attributes or extra whitespace-then-content.
 * Replace with a valid closing tag using just the tag name.
 */
function stripMalformedClosing(html: string): string {
  // `</tagname extra stuff>` → `</tagname>`
  return html.replace(/<\/\s*(\w+)\s+[^>]*>/g, (_full, tagName: string) => {
    return `</${tagName}>`;
  });
}

/**
 * Ensure the HTML has closing </body> and </html> tags.
 * Only adds tags that are actually missing — checks the source, not
 * the parsed DOM (to avoid false positives from browser auto-correction).
 */
function closeCriticalTags(html: string): string {
  let result = html.trimEnd();

  // Check for </body> — add before </html> or at end
  if (!/<\/body>/i.test(result)) {
    const htmlCloseIdx = result.lastIndexOf("</html>");
    if (htmlCloseIdx !== -1) {
      result =
        result.slice(0, htmlCloseIdx) +
        "\n</body>\n" +
        result.slice(htmlCloseIdx);
    } else {
      result += "\n</body>";
    }
  }

  // Check for </html>
  if (!/<\/html>/i.test(result)) {
    result += "\n</html>";
  }

  return result;
}
