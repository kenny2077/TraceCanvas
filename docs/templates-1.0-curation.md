# TraceCanvas 1.0 Template Curation

> Goal: Focus the killer demo on 6–8 templates that best showcase auditable HTML reports from structured data.

---

## 1.0 Hero Templates (Recommended for Demo)

These templates are optimized for the CSV/XLSX/JSON → verified HTML report flow.

| # | ID | Name | Category | Why It Works for 1.0 | Has example.html |
|---|----|------|----------|----------------------|------------------|
| 1 | `data-brief` | Data Brief | `report` | Purpose-built for structured data; strict source-key rules | ❌ |
| 2 | `survey-insight` | Survey Insight Report | `report` | Department breakdowns, scores, quotes — great for verification | ❌ |
| 3 | `executive-summary` | Executive Summary | `report` | One-page metric-focused; perfect for KPI data | ❌ |
| 4 | `research-note` | Research Note | `report` | Academic-style with citations; shows source-grounding | ❌ |
| 5 | `live-dashboard` | Live Team Dashboard | `dashboard` | Has example.html; great visual impact | ✅ |
| 6 | `finance-report` | Finance Report | `finance` | Has example.html; numbers-heavy, ideal for trust demo | ✅ |
| 7 | `deck-swiss-international` | Swiss International Deck | `slides` | Has example.html; classic deck export to PPTX | ✅ |
| 8 | `deck-guizang-editorial` | Guizang Editorial Deck | `slides` | Has example.html; visually distinctive | ✅ |

---

## Templates to De-Emphasize in 1.0

These exist and work, but they don't reinforce the "auditable data report" story. Keep them available but don't feature them in README screenshots or demo script.

| Category | Examples | Reason |
|----------|----------|--------|
| `video` | hyperframes, glitch title, cinematic light leak | Not part of 1.0 scope |
| `prototype` | SaaS landing, dashboard, brutalist | Not data-driven |
| `card` | X post card, Spotify card | Single-card output, hard to verify source keys |
| `mobile` | Mobile app, onboarding | Not data-driven |
| `resume` | Modern resume | Single-person data, limited verification surface |
| `email` | Email marketing | Plain text/markdown output preferred |
| `social` | Social media matrix | Multi-card, harder to verify |

---

## Missing example.html Files

The four report templates (`data-brief`, `survey-insight`, `executive-summary`, `research-note`) are missing `example.html`. For 1.0, we need to add them so the agent has a concrete target to replicate.

### Added for 1.0

- `next/src/lib/templates/skills/data-brief/example.html`
- `next/src/lib/templates/skills/survey-insight/example.html`
- `next/src/lib/templates/skills/executive-summary/example.html`
- `next/src/lib/templates/skills/research-note/example.html`

---

## Template Picker Recommendations

In the UI, consider:

1. **Featured tab** should show only the 8 hero templates above.
2. **Report tab** should show the 4 report templates first.
3. **All templates** remains available but sorted by category.

---

## Verification Profile Mapping

| Template | verify_profile | Source-Key Strictness |
|----------|---------------|----------------------|
| data-brief | `strict` | Every value must be annotated |
| survey-insight | `strict` | Departments, scores, quotes |
| executive-summary | `strict-numbers` | Numeric metrics only |
| research-note | `medium` | Factual claims |
| live-dashboard | (none) | Best-effort |
| finance-report | (none) | Best-effort |

---

*This curation locks 1.0 template focus. Post-1.0 work can expand to all 80 templates.*
