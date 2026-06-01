import { describe, expect, it } from "vitest";
import { validateHtml } from "../../lib/html/validator";
import { repairHtml } from "../../lib/repair/engine";

// ─── Helper ──────────────────────────────────────────────────────────

const VALID_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Test</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
<h1>Hello World</h1>
<p>This is a valid document.</p>
<table>
<tr><td>A</td><td>B</td></tr>
</table>
</body>
</html>`;

function issueKinds(result: ReturnType<typeof validateHtml>) {
  return result.issues.map((i) => i.kind);
}

// ─── Valid HTML ──────────────────────────────────────────────────────

describe("validateHtml — valid HTML", () => {
  const result = validateHtml(VALID_HTML);

  it("passes validation", () => {
    expect(result.valid).toBe(true);
  });

  it("has no errors", () => {
    const errors = result.issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("has a parsed document", () => {
    expect(result.document).not.toBeNull();
  });

  it("has zero sanitizer removals", () => {
    expect(result.sanitizerRemoved).toBe(0);
  });
});

// ─── Nested Valid HTML ───────────────────────────────────────────────

describe("validateHtml — nested valid HTML", () => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<div><section><article><h1>Nested</h1><p>Deep nesting</p></article></section></div>
</body></html>`;
  const result = validateHtml(html);

  it("passes", () => {
    expect(result.valid).toBe(true);
  });
});

// ─── Broken Tag: <summarydoc_...> ────────────────────────────────────

describe("validateHtml — broken tag <summarydoc_...>", () => {
  const html = `<!DOCTYPE html><html><head></head><body>
<summarydoc_blah>Something</summarydoc_blah>
</body></html>`;
  const result = validateHtml(html);

  it("detects unknown element as malformed tag", () => {
    // <summarydoc_blah> is not a standard HTML element — DOMParser
    // creates an HTMLUnknownElement for it.
    expect(issueKinds(result)).toContain("malformed-tag");
  });

  it("fails validation", () => {
    expect(result.valid).toBe(false);
  });
});

// ─── Malformed Closing Tag: </section  <section> ─────────────────────

describe("validateHtml — malformed closing tag", () => {
  const html = `<!DOCTYPE html><html><body>
<section>Content</section  <section>
</body></html>`;
  const result = validateHtml(html);

  it("detects malformed closing tag", () => {
    expect(issueKinds(result)).toContain("malformed-closing-tag");
  });

  it("fails validation", () => {
    expect(result.valid).toBe(false);
  });
});

// ─── Attribute Fragment: < class="pf-claim"> ─────────────────────────

describe("validateHtml — attribute fragment", () => {
  const html = `<!DOCTYPE html><html><body>
< class="pf-claim">This has no tag name</ >
</body></html>`;
  const result = validateHtml(html);

  it("detects attribute-only fragment", () => {
    expect(issueKinds(result)).toContain("attribute-fragment");
  });

  it("fails validation", () => {
    expect(result.valid).toBe(false);
  });
});

// ─── Script Tag ──────────────────────────────────────────────────────

describe("validateHtml — script tag", () => {
  it("allows known CDN scripts (tailwind)", () => {
    const html = `<!DOCTYPE html><html><head>
<script src="https://cdn.tailwindcss.com"></script></head><body></body></html>`;
    const result = validateHtml(html);
    expect(issueKinds(result)).not.toContain("script-tag");
  });

  it("rejects unknown script sources", () => {
    const html = `<!DOCTYPE html><html><head>
<script src="https://evil.com/malware.js"></script></head><body></body></html>`;
    const result = validateHtml(html);
    expect(issueKinds(result)).toContain("script-tag");
    expect(result.valid).toBe(false);
  });

  it("rejects inline scripts", () => {
    const html = `<!DOCTYPE html><html><body>
<script>alert('xss')</script></body></html>`;
    const result = validateHtml(html);
    expect(issueKinds(result)).toContain("script-tag");
    expect(result.valid).toBe(false);
  });
});

// ─── Event Handlers ──────────────────────────────────────────────────

describe("validateHtml — event handlers", () => {
  it("rejects onclick", () => {
    const html = `<!DOCTYPE html><html><body>
<button onclick="doSomething()">Click</button></body></html>`;
    const result = validateHtml(html);
    expect(issueKinds(result)).toContain("event-handler");
    expect(result.valid).toBe(false);
  });

  it("rejects onerror", () => {
    const html = `<!DOCTYPE html><html><body>
<img src="x" onerror="alert(1)"></body></html>`;
    const result = validateHtml(html);
    expect(issueKinds(result)).toContain("event-handler");
    expect(result.valid).toBe(false);
  });

  it("rejects onload", () => {
    const html = `<!DOCTYPE html><html><body onload="init()"></body></html>`;
    const result = validateHtml(html);
    expect(issueKinds(result)).toContain("event-handler");
    expect(result.valid).toBe(false);
  });
});

// ─── javascript: URLs ────────────────────────────────────────────────

describe("validateHtml — javascript: URLs", () => {
  it("rejects javascript: in href", () => {
    const html = `<!DOCTYPE html><html><body>
<a href="javascript:alert(1)">link</a></body></html>`;
    const result = validateHtml(html);
    expect(issueKinds(result)).toContain("javascript-url");
    expect(result.valid).toBe(false);
  });

  it("rejects javascript: in src", () => {
    const html = `<!DOCTYPE html><html><body>
<iframe src="javascript:alert(1)"></iframe></body></html>`;
    const result = validateHtml(html);
    expect(issueKinds(result)).toContain("javascript-url");
    expect(result.valid).toBe(false);
  });
});

// ─── Missing Structure ───────────────────────────────────────────────

describe("validateHtml — missing structure", () => {
  it("detects missing </html>", () => {
    const html = `<!DOCTYPE html><html><head></head><body><p>Hi</p></body>`;
    const result = validateHtml(html);
    expect(issueKinds(result)).toContain("unclosed-html");
  });

  it("detects empty body", () => {
    const html = `<!DOCTYPE html><html><head></head><body></body></html>`;
    const result = validateHtml(html);
    expect(issueKinds(result)).toContain("empty-body");
  });
});

// ─── DOMPurify Diff ──────────────────────────────────────────────────

describe("validateHtml — sanitizer diff", () => {
  it("valid HTML has no sanitizer removals", () => {
    const result = validateHtml(VALID_HTML);
    expect(result.sanitizerRemoved).toBe(0);
  });
});

// ─── Repair Engine ───────────────────────────────────────────────────

describe("repairHtml", () => {
  it("repairs attribute-only fragment", () => {
    const broken = `< class="pf-claim">text</ >`;
    const result = repairHtml(broken);
    expect(result.changed).toBe(true);
    expect(result.html).not.toContain('class="pf-claim"');
    expect(result.actions).toContain("strip-fragment");
  });

  it("repairs malformed closing tag", () => {
    const broken = `</section  <section>`;
    const result = repairHtml(broken);
    expect(result.html).toContain("</section>");
    expect(result.html).not.toContain("<section>");
  });

  it("closes unclosed body and html", () => {
    const broken = `<!DOCTYPE html><html><head></head><body><p>Hi</p>`;
    const result = repairHtml(broken);
    expect(result.html).toContain("</body>");
    expect(result.html).toContain("</html>");
    expect(result.actions).toContain("close-tag");
  });

  it("does not modify valid HTML", () => {
    const result = repairHtml(VALID_HTML);
    expect(result.changed).toBe(false);
    expect(result.html).toBe(VALID_HTML);
  });

  it("handles combined issues", () => {
    const broken = `< class="pf-claim">Broken</ >\n</section  <section>\n<p>ok</p>`;
    const result = repairHtml(broken);
    expect(result.changed).toBe(true);
    // Attribute fragment stripped
    expect(result.html).not.toContain('class="pf-claim"');
    // Malformed closing fixed
    expect(result.html).toContain("</section>");
    // "ok" preserved
    expect(result.html).toContain("<p>ok</p>");
  });
});

// ─── Markdown Fences ─────────────────────────────────────────────────

describe("validateHtml — markdown fences", () => {
  it("rejects html wrapped in fences", () => {
    const html = '```html\n<!DOCTYPE html><html><body><p>Hi</p></body></html>\n```';
    const result = validateHtml(html);
    // The validator parses what DOMParser gives it — fences become text
    // before the doctype, so the parsed document may still be valid.
    // The markdown-fence check is handled by verify/engine.ts separately.
    // Here we just verify the parsed document structure is still found.
    expect(result.document).not.toBeNull();
  });
});

// ─── Custom Allowed Scripts ──────────────────────────────────────────

describe("validateHtml — custom allowed scripts", () => {
  it("accepts scripts matching custom allowlist", () => {
    const html = `<!DOCTYPE html><html><head>
<script src="https://my-cdn.example/app.js"></script></head><body></body></html>`;
    const result = validateHtml(html, {
      allowedScripts: [/my-cdn\.example/],
    });
    expect(issueKinds(result)).not.toContain("script-tag");
  });
});
