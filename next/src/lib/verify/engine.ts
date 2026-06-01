/**
 * Verification engine.
 *
 * Runs a battery of checks against agent-generated HTML to assess:
 *   1. HTML well-formedness (DOM parse errors)
 *   2. Source-key coverage (% of expected keys found)
 *   3. Source-key validity (no references to non-existent fields)
 *   4. Content fidelity (do key data values appear in the HTML)
 *   5. Anti-pattern detection (raw data-pf-source-id, missing doctype, etc.)
 *
 * Each check produces a pass/warn/fail status and contributes to an
 * overall score (0–100). The engine is intentionally strict — the Prompt
 * Lab is for learning from failures, not gaming scores.
 */

import type { PostprocessResult } from "../sources/postprocessor";
import { hasSourceKeys } from "../sources/postprocessor";
import { validateHtml } from "../html/validator";
import type { HtmlValidationResult } from "../html/types";

// ─── Types ────────────────────────────────────────────────────────────

export type CheckStatus = "pass" | "warn" | "fail";

export type CheckResult = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Optional numeric metric (coverage %, count, etc.). */
  metric?: number;
};

export type VerificationReport = {
  /** Overall pass/fail: true iff no check has status "fail". */
  passed: boolean;
  /** Individual check results. */
  checks: CheckResult[];
  /** 0–100 composite score. */
  score: number;
  /** Summary for UI display. */
  summary: string;
};

export type VerifyInput = {
  /** Raw agent output (before extractHtml — may contain fences/preamble). */
  rawOutput: string;
  /** Cleaned HTML (after extractHtml). */
  cleanHtml: string;
  /** Postprocess result from source-key scanning. */
  postprocess: PostprocessResult;
  /** The source data the agent was given. */
  sourceData: { fields: string[]; rows: Record<string, unknown>[] };
  /** Expected source keys. */
  allowedKeys: string[];
  /** Optional fidelity samples to check for in the HTML. */
  fidelitySamples?: Array<{ key: string; value: string }>;
};

// ─── Engine ───────────────────────────────────────────────────────────

export function verifyArtifact(input: VerifyInput): VerificationReport {
  const checks: CheckResult[] = [];

  // Run the new parser-based validator once — reuse result across checks.
  const htmlValidation = input.cleanHtml
    ? validateHtml(input.cleanHtml)
    : null;

  // 1. HTML structure (parser-based)
  checks.push(checkHtmlStructure(htmlValidation, input.cleanHtml));

  // 2. HTML security (parser-based)
  checks.push(checkHtmlSecurity(htmlValidation));

  // 3. HTML sanitizer diff (DOMPurify)
  checks.push(checkHtmlSanitizer(htmlValidation));

  // 4. Has doctype
  checks.push(checkDoctype(input.rawOutput, input.cleanHtml));

  // 5. Source-key presence
  checks.push(checkSourceKeyPresence(input.rawOutput, input.postprocess));

  // 6. Source-key coverage
  checks.push(checkSourceKeyCoverage(input.postprocess, input.allowedKeys));

  // 7. Source-key validity
  checks.push(checkSourceKeyValidity(input.postprocess));

  // 8. Content fidelity (sampled)
  checks.push(
    checkContentFidelity(input.cleanHtml, input.fidelitySamples ?? []),
  );

  // 9. Anti-pattern: raw data-pf-source-id
  checks.push(checkNoRawSourceId(input.rawOutput));

  // 10. Anti-pattern: markdown fences in output
  checks.push(checkNoMarkdownFences(input.rawOutput));

  // Compute score
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const passCount = checks.filter((c) => c.status === "pass").length;
  const total = checks.length;
  // Each pass = full points, warn = half, fail = zero
  const score = Math.round(
    ((passCount + warnCount * 0.5) / total) * 100,
  );
  const passed = failCount === 0;

  let summary: string;
  if (passed && score >= 90) summary = "All checks passed. High confidence.";
  else if (passed) summary = `${warnCount} warning(s). Review recommended.`;
  else summary = `${failCount} failure(s). Agent output needs work.`;

  return { passed, checks, score, summary };
}

// ─── Individual Checks ────────────────────────────────────────────────

function checkHtmlStructure(
  validation: HtmlValidationResult | null,
  cleanHtml: string,
): CheckResult {
  if (!cleanHtml) {
    return {
      id: "html-structural",
      label: "HTML structure",
      status: "fail",
      detail: "HTML is empty — agent may not have produced HTML.",
    };
  }
  if (!validation) {
    return {
      id: "html-structural",
      label: "HTML structure",
      status: "warn",
      detail: "Validator unavailable — skipping structural checks.",
    };
  }

  const structuralKinds = new Set([
    "missing-html", "missing-head", "missing-body",
    "unclosed-html", "unclosed-body",
    "malformed-tag", "malformed-closing-tag",
    "attribute-fragment", "orphaned-text", "empty-body",
  ]);
  const structuralIssues = validation.issues.filter(
    (i) => structuralKinds.has(i.kind),
  );
  const errors = structuralIssues.filter((i) => i.severity === "error");
  const warns = structuralIssues.filter((i) => i.severity === "warn");

  if (errors.length > 0) {
    const kinds = [...new Set(errors.map((e) => e.kind))].join(", ");
    return {
      id: "html-structural",
      label: "HTML structure",
      status: "fail",
      detail: `${errors.length} structural error(s): ${kinds}.`,
      metric: errors.length,
    };
  }
  if (warns.length > 0) {
    return {
      id: "html-structural",
      label: "HTML structure",
      status: "warn",
      detail: `${warns.length} structural warning(s).`,
      metric: warns.length,
    };
  }
  return {
    id: "html-structural",
    label: "HTML structure",
    status: "pass",
    detail: "HTML structure is valid.",
  };
}

function checkHtmlSecurity(
  validation: HtmlValidationResult | null,
): CheckResult {
  if (!validation) {
    return {
      id: "html-security",
      label: "HTML security",
      status: "warn",
      detail: "Validator unavailable — skipping security checks.",
    };
  }

  const securityKinds = new Set(["script-tag", "event-handler", "javascript-url"]);
  const securityIssues = validation.issues.filter(
    (i) => securityKinds.has(i.kind),
  );

  if (securityIssues.length > 0) {
    const kinds = [...new Set(securityIssues.map((i) => i.kind))].join(", ");
    return {
      id: "html-security",
      label: "HTML security",
      status: "fail",
      detail: `${securityIssues.length} security issue(s): ${kinds}.`,
      metric: securityIssues.length,
    };
  }
  return {
    id: "html-security",
    label: "HTML security",
    status: "pass",
    detail: "No script tags, event handlers, or javascript: URLs found.",
  };
}

function checkHtmlSanitizer(
  validation: HtmlValidationResult | null,
): CheckResult {
  if (!validation) {
    return {
      id: "html-sanitizer",
      label: "HTML sanitizer",
      status: "warn",
      detail: "Validator unavailable — skipping sanitizer check.",
    };
  }

  if (validation.sanitizerRemoved > 0) {
    return {
      id: "html-sanitizer",
      label: "HTML sanitizer",
      status: "fail",
      detail: `DOMPurify removed ${validation.sanitizerRemoved} element(s).`,
      metric: validation.sanitizerRemoved,
    };
  }
  return {
    id: "html-sanitizer",
    label: "HTML sanitizer",
    status: "pass",
    detail: "DOMPurify found no elements to remove.",
  };
}

function checkDoctype(rawOutput: string, cleanHtml: string): CheckResult {
  const hasDoctype =
    /<!DOCTYPE\s+html/i.test(rawOutput) || /<!DOCTYPE\s+html/i.test(cleanHtml);
  if (hasDoctype) {
    return {
      id: "doctype",
      label: "DOCTYPE declaration",
      status: "pass",
      detail: "Document includes <!DOCTYPE html>.",
    };
  }
  // extractHtml scaffolds a doctype in step 5 — but that's a rescue,
  // not the agent doing the right thing. Flag as warn if we had to scaffold.
  const agentHadDoctype = /<!DOCTYPE\s+html/i.test(rawOutput);
  if (!agentHadDoctype && cleanHtml.includes("<!DOCTYPE html>")) {
    return {
      id: "doctype",
      label: "DOCTYPE declaration",
      status: "warn",
      detail: "DOCTYPE was scaffolded by extractHtml — agent did not emit one.",
    };
  }
  return {
    id: "doctype",
    label: "DOCTYPE declaration",
    status: "fail",
    detail: "No <!DOCTYPE html> found in output.",
  };
}

function checkSourceKeyPresence(
  rawOutput: string,
  pp: PostprocessResult,
): CheckResult {
  if (hasSourceKeys(rawOutput)) {
    return {
      id: "source-key-presence",
      label: "Source-key annotations present",
      status: "pass",
      detail: `Found ${pp.totalComments} source-key comment(s).`,
      metric: pp.totalComments,
    };
  }
  return {
    id: "source-key-presence",
    label: "Source-key annotations present",
    status: "fail",
    detail:
      "No <!-- pf-src: ... --> comments found. Agent ignored the annotation rules.",
    metric: 0,
  };
}

function checkSourceKeyCoverage(
  pp: PostprocessResult,
  allowedKeys: string[],
): CheckResult {
  const pct = Math.round(pp.coverage * 100);
  if (pp.coverage >= 0.9) {
    return {
      id: "source-key-coverage",
      label: "Source-key coverage",
      status: "pass",
      detail: `${pct}% of expected keys found (${pp.foundKeys.length}/${allowedKeys.length}).`,
      metric: pp.coverage,
    };
  }
  if (pp.coverage >= 0.5) {
    return {
      id: "source-key-coverage",
      label: "Source-key coverage",
      status: "warn",
      detail: `Only ${pct}% coverage. Missing: ${pp.missingKeys.join(", ") || "none"}.`,
      metric: pp.coverage,
    };
  }
  return {
    id: "source-key-coverage",
    label: "Source-key coverage",
    status: "fail",
    detail: `Only ${pct}% coverage. Missing: ${pp.missingKeys.join(", ") || "none"}.`,
    metric: pp.coverage,
  };
}

function checkSourceKeyValidity(pp: PostprocessResult): CheckResult {
  if (pp.invalidKeys.length === 0) {
    return {
      id: "source-key-validity",
      label: "Source-key validity",
      status: "pass",
      detail: "All source keys reference valid paths.",
    };
  }
  return {
    id: "source-key-validity",
    label: "Source-key validity",
    status: "fail",
    detail: `Invalid keys found: ${pp.invalidKeys.join(", ")}.`,
    metric: pp.invalidKeys.length,
  };
}

function checkContentFidelity(
  cleanHtml: string,
  samples: Array<{ key: string; value: string }>,
): CheckResult {
  if (samples.length === 0) {
    return {
      id: "content-fidelity",
      label: "Content fidelity (sampled)",
      status: "warn",
      detail: "No fidelity samples provided — skipping check.",
    };
  }
  const found: string[] = [];
  const missing: string[] = [];
  for (const { key, value } of samples) {
    if (cleanHtml.includes(value)) {
      found.push(key);
    } else {
      missing.push(key);
    }
  }
  const rate = found.length / samples.length;
  if (rate >= 0.8) {
    return {
      id: "content-fidelity",
      label: "Content fidelity (sampled)",
      status: "pass",
      detail: `${found.length}/${samples.length} sampled values found in HTML.`,
      metric: rate,
    };
  }
  if (rate >= 0.5) {
    return {
      id: "content-fidelity",
      label: "Content fidelity (sampled)",
      status: "warn",
      detail: `Only ${found.length}/${samples.length} sampled values found. Missing: ${missing.join(", ")}.`,
      metric: rate,
    };
  }
  return {
    id: "content-fidelity",
    label: "Content fidelity (sampled)",
    status: "fail",
    detail: `Only ${found.length}/${samples.length} sampled values found. Missing: ${missing.join(", ")}.`,
    metric: rate,
  };
}

function checkNoRawSourceId(rawOutput: string): CheckResult {
  const matches = rawOutput.match(/data-pf-source-id/gi);
  if (!matches) {
    return {
      id: "no-raw-source-id",
      label: "No raw data-pf-source-id",
      status: "pass",
      detail: "No forbidden data-pf-source-id attributes found.",
    };
  }
  return {
    id: "no-raw-source-id",
    label: "No raw data-pf-source-id",
    status: "fail",
    detail: `Found ${matches.length} instance(s) of forbidden data-pf-source-id. Use <!-- pf-src: ... --> comments instead.`,
    metric: matches.length,
  };
}

function checkNoMarkdownFences(rawOutput: string): CheckResult {
  const fenceMatch = rawOutput.match(/```html|```HTML/g);
  if (!fenceMatch) {
    return {
      id: "no-markdown-fences",
      label: "No markdown fences",
      status: "pass",
      detail: "Output is not wrapped in markdown code fences.",
    };
  }
  return {
    id: "no-markdown-fences",
    label: "No markdown fences",
    status: "fail",
    detail: `Output contains ${fenceMatch.length} markdown fence(s). Agent should output raw HTML.`,
    metric: fenceMatch.length,
  };
}
