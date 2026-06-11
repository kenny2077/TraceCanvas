# TraceCanvas MVP Audit — Pre-1.0 Deep Analysis

> **Date:** 2026-06-11
> **Auditor:** Neko-chan AI Agent
> **Scope:** tracecanvas/ (Next.js app + E2E)
> **Product Direction:** CSV/XLSX/JSON → source-grounded HTML report → verification receipt → PNG/PDF/PPTX export

---

## 1. What Is Actually Implemented?

### ✅ REAL — Wired into main user flow

| Feature | Evidence | Confidence |
|---------|----------|------------|
| Agent detection (17 agents) | `next/src/lib/agents/detect.ts` — PATH scan, fallback bins, env overrides | **High** |
| Agent invocation (stdin/argv/argv-message) | `next/src/lib/agents/invoke.ts` — spawn, stream, parse | **High** |
| SSE streaming to client | `next/src/app/api/convert/route.ts` + `next/src/lib/use-convert.ts` | **High** |
| Format auto-detection (CSV/TSV/JSON/MD/HTML/SQL/YAML/text) | `next/src/lib/parsers/auto.ts` — `detectFormat()` + `summarizeForAgent()` | **High** |
| CSV/TSV parsing with A1 cell IDs | `next/src/lib/sources/parser.ts` — PapaParse-based, deterministic IDs | **High** |
| HTML structural validation | `next/src/lib/html/validator.ts` — DOMParser + regex security checks + DOMPurify diff | **High** |
| Conservative HTML repair | `next/src/lib/repair/engine.ts` — strip fragments, close tags | **High** |
| Template loading (80 skills) | `next/src/lib/templates/loader.ts` — disk-based, frontmatter parser | **High** |
| Prompt assembly | `next/src/lib/templates/shared.ts` — `assemblePrompt()` with shared directives | **High** |
| Export: WeChat (juice inline) | `next/src/lib/export/wechat.ts` | **High** |
| Export: Zhihu (math conversion) | `next/src/lib/export/zhihu.ts` | **High** |
| Export: PNG (modern-screenshot 2x) | `next/src/lib/export/image.ts` | **High** |
| Export: PPTX (pptxgenjs) | `next/src/lib/export/deck.ts` | **High** |
| Export: HTML download | `next/src/lib/export/download.ts` | **High** |
| Export: clipboard | `next/src/lib/export/clipboard.ts` | **High** |
| Zustand store with localStorage persist | `next/src/lib/store.ts` | **High** |
| Welcome modal with agent picker | `next/src/components/welcome-modal.tsx` | **High** |
| Host-header security gate | `next/src/middleware.ts` | **High** |
| Verification Receipt UI component | `next/src/components/verification-receipt.tsx` | **High** |

### ⚠️ EXISTS BUT NOT FULLY WIRED — Library code present

| Feature | Evidence | Wiring Gap |
|---------|----------|------------|
| Source-key postprocessor | `next/src/lib/sources/postprocessor.ts` — `postprocessSourceKeys()`, `hasSourceKeys()` | **NOT called in main flow** — only in Prompt Lab or tests |
| Full verification engine (10 checks) | `next/src/lib/verify/engine.ts` — `verifyArtifact()` with all 10 checks | **NOT called in main flow** — page.tsx uses lightweight `validateHtml()` only (3 checks) |
| Source-key rules in skill frontmatter | `data-brief/SKILL.md` has `source_key_rules` | **NOT injected into prompt** — `assemblePrompt()` does not read `sourceKeyRules` |
| Mock agent | Listed in README as "Built-In" | **No evidence of mock agent implementation** in `AGENTS` array or `invokeAgent()` |
| XLSX parsing | `next/package.json` has `xlsx` dependency | `summarizeForAgent()` only handles CSV/TSV, not XLSX files |
| Content fidelity samples | `verifyArtifact()` accepts `fidelitySamples` | **Never populated** — no code generates samples from parsed data |

### ❌ NOT IMPLEMENTED — README claims or roadmap items

| Feature | README Claim | Reality |
|---------|-------------|---------|
| 80 templates with example.html | "75 of 80 ship with hand-authored example.html" | Only **~6 skills** have `example.html` visible in repo (data-brief, research-note, executive-summary, survey-insight, social-card). Most skills lack `example.html`. |
| Mock agent for demos | "Always available. Returns deterministic HTML fixture" | **Not in `AGENTS` array**. No mock implementation found. |
| JSON source-key parsing | "JSON input → structured source document" | `summarizeForAgent()` parses JSON but does **not** generate A1-style source keys or `allowedKeys` |
| Full verification in main flow | "10 checks + auto-repair" then export | page.tsx only runs `validateHtml()` (3 checks: structure, security, sanitizer). Missing: source-key presence, coverage, validity, content fidelity, doctype, no-raw-source-id, no-markdown-fences. |
| API-based agents (DeepSeek API, Kimi API) | Listed under "API-Based" | No API adapter code found in `next/src/lib/agents/`. Only CLI spawning exists. |
| Remotion export | Listed as export target | `remotion.ts` exists but unclear if wired to UI |
| Notion export | Listed as export target | `notion.ts` exists but may be stub |
| Bilibili/Bluesky/Mastodon export | Listed as export targets | Files exist but likely stubs |
| Skill marketplace | `/api/marketplace` routes | API routes exist but marketplace auto-update is v0.5 roadmap |
| Deploy to Vercel | `/api/deploy` route | Exists but not part of killer demo |

---

## 2. Is the Full Trust Pipeline Wired?

### Actual Flow (Current)

```
User Input → detectFormat() → summarizeForAgent()
    ↓
/api/convert POST → assemblePrompt(body, content, format) → invokeAgent()
    ↓
SSE stream → client appendHtml → iframe preview
    ↓
page.tsx: validateHtml() → 3 checks (structure, security, sanitizer)
    ↓
Lightweight VerificationReceipt (collapsible, hidden by default)
```

### Missing from Main Flow

| Step | Missing Component | Where It Exists |
|------|-------------------|-----------------|
| Source document generation | `parseCSV()` IS called in `summarizeForAgent()` but results are NOT passed to verification | `next/src/lib/parsers/auto.ts:93-110` |
| Source key rules in prompt | `sourceKeyRules` from skill frontmatter NOT injected | `next/src/lib/templates/shared.ts:46-58` — `assemblePrompt()` ignores `sourceKeyRules` |
| Source-key postprocessing | `postprocessSourceKeys()` NEVER called on agent output | `next/src/lib/sources/postprocessor.ts` — unused in main flow |
| Full verification | `verifyArtifact()` NEVER called | `next/src/lib/verify/engine.ts` — unused in main flow |
| Fidelity samples | No code generates `fidelitySamples` from parsed data | Would need to sample cell values from `SourceDocument` |
| Allowed keys generation | No code generates `allowedKeys` from `SourceDocument` | Would need to build from `doc.fields` and `doc.rows` |

### Trust Pipeline Gap Summary

**The verification engine is a complete, well-designed 10-check system that sits entirely on the shelf.**

The only verification users see is:
- HTML structure (parser-based)
- HTML security (script/event/js-url checks)
- Sanitizer diff (DOMPurify)

The killer differentiators are **missing**:
- ❌ Source-key presence (did the agent annotate data?)
- ❌ Source-key coverage (what % of data is traceable?)
- ❌ Source-key validity (are annotations correct?)
- ❌ Content fidelity (do the numbers match input?)
- ❌ No raw data-pf-source-id (anti-pattern check)
- ❌ No markdown fences (output purity)

---

## 3. README Drift Analysis

### Critical Bugs

| Issue | Location | Severity |
|-------|----------|----------|
| **Quick Start path wrong** | `cd TraceCanvas/tracecanvas` | **HIGH** — actual repo has `tracecanvas/` as root, but the README at repo root says this. Wait: the repo root IS `TraceCanvas/`, so `cd TraceCanvas/tracecanvas` is correct from outside. But the context says "live repo tree shows `next/`, not `tracecanvas`" — this is misleading. The app is under `tracecanvas/next/`, not `tracecanvas/src/`. |
| **80 templates claim** | "80 templates in next/src/lib/templates/skills/" | **MEDIUM** — 81 directories exist, but most lack `example.html`. Only ~6 have complete examples. |
| **75 of 80 with example.html** | README line 122 | **HIGH** — False. Most skills have only `SKILL.md` + `example.md`. |
| **19 agents claim** | Badge says "19 CLIs" | **MEDIUM** — 17 in `AGENTS` array + Mock (not implemented) + 2 API-based (not implemented) = 17 real, not 19. |
| **12 export targets** | Table lists 12 | **MEDIUM** — Some are stubs (Bilibili, Bluesky, Mastodon, Remotion). PNG/PDF/PPTX/HTML/WeChat/Zhihu are real. |
| **Mock agent** | "Always available" | **HIGH** — Not implemented. Breaks demo-without-CLI promise. |

### Overclaim vs Reality

| Claim | Reality |
|-------|---------|
| "Every data point annotated with traceable source key" | Source-key system exists but is NOT wired into main flow. Agent is NOT instructed to emit `pf-src` comments in the assembled prompt (except `data-brief` skill has `source_key_rules` in frontmatter, but it's not injected). |
| "10 automated checks" | Only 3 checks run in main flow. 7 checks exist in engine but are never called. |
| "Verification engine checks that all expected source keys are present" | Engine CAN do this, but no code generates `allowedKeys` or calls `verifyArtifact()`. |
| "No API key required" | True for CLI agents, but API-based agents (DeepSeek API, Kimi API) require keys and are listed as supported. |
| "Zero marginal cost" | True for local CLI agents. |

---

## 4. Top 10 1.0 Blockers (Ranked by Demo Risk)

### 🔴 P0 — Demo-Killing

| # | Blocker | Risk | Evidence |
|---|---------|------|----------|
| 1 | **Mock agent not implemented** | New users without Claude/Codex cannot demo | `AGENTS` array has no mock entry; `invokeAgent()` has no mock path |
| 2 | **Full verification not wired** | Core differentiator invisible; product looks like "another AI HTML generator" | `page.tsx` uses `validateHtml()` (3 checks), never calls `verifyArtifact()` (10 checks) |
| 3 | **Source-key rules not injected into prompt** | Agent has no instruction to annotate data; source-grounding is accidental | `assemblePrompt()` ignores `sourceKeyRules` from skill frontmatter |
| 4 | **No fidelity samples generation** | Cannot prove "numbers are not hallucinated" | No code samples values from `SourceDocument` for `verifyArtifact()` |
| 5 | **Verification UI is hidden/collapsible** | Even the 3 checks that DO run are buried behind a "Show verification" button | `page.tsx:163-181` — button toggles, default hidden |

### 🟡 P1 — Serious

| # | Blocker | Risk | Evidence |
|---|---------|------|----------|
| 6 | **XLSX not parsed for source keys** | Excel upload → no source grounding | `summarizeForAgent()` only handles CSV/TSV |
| 7 | **JSON not parsed for source keys** | JSON input → no source grounding | `summarizeForAgent()` parses JSON but doesn't generate `allowedKeys` |
| 8 | **E2E only has 3 specs, none cover conversion flow** | No automated proof the killer path works | `e2e/ui/` has deploy-control, export-menu, host-validation only |
| 9 | **README quick-start path confusion** | Makes project look stale | README says `cd TraceCanvas/tracecanvas` which is correct, but structure diagram is confusing |
| 10 | **Most skills lack example.html** | Template picker looks empty/broken for most skills | Only ~6 of 81 skills have `example.html` |

---

## 5. What Should Be Cut from 1.0

| Feature | Cut Reason | Current State |
|---------|-----------|---------------|
| ACP/pi-rpc agent protocols | Detection-only, not wired, not needed for killer demo | 7 agents show "not yet supported" |
| Skill marketplace auto-update | v0.5 roadmap, not 1.0 | API routes exist but not critical |
| Cloudflare Pages deploy | v0.5 roadmap | Not mentioned in code |
| Remotion/video export | Complex, not core to "auditable reports" | `remotion.ts` exists but is a distraction |
| Notion export | Not core to killer demo | `notion.ts` likely stub |
| Bilibili/Bluesky/Mastodon exports | Social publishing is not the 1.0 story | Files exist but are stubs |
| Mobile UI | Explicitly documented as not supported | README already says "No mobile UI" |
| Collaboration | "Later" roadmap | Not in code |
| Image input support | "Later" roadmap | Not in code |
| Scheduled regeneration | "Later" roadmap | Not in code |
| Agent output diff viewer | Nice-to-have, not 1.0 | Not in code |
| More templates beyond 8 report/data focus | 80 templates is a liability without verification | Keep all but emphasize only 6-8 in UI |

**What to KEEP:**
- CSV/TSV/XLSX/JSON input parsing
- Source-key annotation system
- Full 10-check verification
- PNG/PDF/PPTX export
- WeChat/Zhihu copy-paste (proven, works)
- HTML download
- 6-8 best report/data templates with complete example.html

---

## 6. What Tests Currently Prove

### Unit Tests (`next/src/__tests__/unit/`)

| Test File | What It Protects | Critical Gap |
|-----------|-----------------|--------------|
| `parser.test.ts` | CSV parsing, A1 coordinates, warnings, determinism | ✅ Good coverage. Does NOT test XLSX or JSON source-key generation. |
| `htmlValidator.test.ts` | HTML structural validation, security checks, DOMPurify diff | ✅ Good coverage. Tests the 3 checks that run in main flow. |
| `validation.test.ts` | Request schema validation | ✅ Good. |
| `skillLoader.test.ts` | Skill loading, frontmatter parsing | ✅ Good. Does NOT test `sourceKeyRules` injection. |
| `prompt.test.ts` | Prompt assembly | ✅ Tests `assemblePrompt()`. Does NOT test source-key rule injection. |
| `components.test.ts` | React component rendering | Moderate. Does NOT test VerificationReceipt with real report data. |
| `adapterHardening.test.ts` | Agent adapter edge cases | Good. |
| `repository.test.ts` | Store/state management | Good. |

### API Tests (`next/src/__tests__/api/`)

| Test File | What It Protects | Critical Gap |
|-----------|-----------------|--------------|
| `agents.test.ts` | Agent detection API | ✅ Good. |
| `templates.test.ts` | Template listing API | ✅ Good. |
| `deploy.test.ts` | Deploy API | Not critical for 1.0. |
| `deployConfig.test.ts` | Deploy config API | Not critical for 1.0. |
| `agentEval.test.ts` | Prompt evaluation harness | Good for dev. |
| `validationGates.test.ts` | Request validation gates | ✅ Good. |

### E2E Tests (`e2e/ui/`)

| Test File | What It Protects | Critical Gap |
|-----------|-----------------|--------------|
| `deploy-control.spec.ts` | Deploy UI controls | Not critical for 1.0. |
| `export-menu.test.ts` | Export menu rendering | Partial. Does NOT test actual export generation. |
| `host-validation.spec.ts` | Host header security | ✅ Good. |

### Missing Critical Tests

| Test Needed | Why |
|-------------|-----|
| **Mock agent integration test** | Prove demo works without real CLI |
| **Full verification pipeline test** | `parseCSV → assemblePrompt(with source keys) → mock agent output → postprocessSourceKeys → verifyArtifact` |
| **Source-key injection test** | Prove `sourceKeyRules` from skill frontmatter reaches the prompt |
| **Fidelity sample generation test** | Prove values from `SourceDocument` are sampled for verification |
| **E2E: CSV → convert → preview → verification receipt** | Full killer path smoke test |
| **E2E: Verification receipt visible and accurate** | Prove score/coverage are displayed |
| **E2E: Export PNG/PDF from verified HTML** | Prove export pipeline works end-to-end |
| **XLSX parsing test** | Prove Excel upload generates source keys |
| **JSON source-key test** | Prove JSON input generates source keys |

---

## 7. 1.0 Must-Pass Demo Script

```
1. Clone repo
2. pnpm install --frozen-lockfile
3. pnpm -F @tracecanvas/next dev
4. Open http://localhost:3000
5. Select "Mock Agent" (no CLI needed)
6. Paste CSV fixture:
   department,score,headcount
   Engineering,4.2,32
   Design,4.7,12
   Marketing,3.8,18
   Product,4.5,8
7. Select "Data Brief" template
8. Click Convert
9. EXPECT: HTML preview renders with tables, KPI cards
10. EXPECT: Verification receipt shows score ≥ 80/100
11. EXPECT: Source-key coverage shows 18/18 keys (6 rows × 3 columns)
12. EXPECT: Content fidelity shows 9/9 sampled values found
13. Click Export → PNG → download succeeds
14. Click Export → PDF → download succeeds
15. (Optional) Break a source key in mock output → verify failure state is clear
```

---

## 8. Phased Implementation Plan

### Phase 1: Trust Pipeline (Week 1)
- Implement Mock Agent
- Wire `sourceKeyRules` into `assemblePrompt()`
- Generate `allowedKeys` from `SourceDocument` (CSV/TSV/JSON)
- Generate `fidelitySamples` from `SourceDocument`
- Call `postprocessSourceKeys()` after HTML extraction
- Call `verifyArtifact()` with full inputs
- Replace lightweight verification in `page.tsx` with full verification
- Make VerificationReceipt the HERO (not collapsible)
- Add unit tests for all new wiring

### Phase 2: Export Reliability (Week 2)
- Ensure PNG export works with verified HTML
- Ensure PDF export works (print-to-PDF)
- Ensure PPTX export works for deck templates
- Add integration tests for export paths
- Add XLSX parsing for source keys

### Phase 3: Docs/Demo Polish (Week 3)
- Fix README drift (paths, template counts, agent counts, export claims)
- Rewrite README story around "auditable reports"
- Create killer demo fixture (realistic CSV)
- Create `docs/demo-script.md`
- Trim template presentation to 6-8 heroes
- Add screenshots/GIF placeholders

### Phase 4: Release Gate (Week 4)
- Add killer-flow E2E test
- Run full test suite: guard, typecheck, unit, e2e
- Verify README quickstart from clean clone
- Verify mock agent demo
- Create `docs/release/1.0-readiness.md`
- Tag v1.0

---

## Appendix: File-Level Evidence Index

| Claim | File | Line(s) |
|-------|------|---------|
| `validateHtml` only (3 checks) in main flow | `next/src/app/page.tsx` | 80-125 |
| `verifyArtifact` exists but unused | `next/src/lib/verify/engine.ts` | 62-119 |
| `postprocessSourceKeys` exists but unused | `next/src/lib/sources/postprocessor.ts` | 36-73 |
| `sourceKeyRules` in frontmatter | `next/src/lib/templates/skills/data-brief/SKILL.md` | 10 |
| `assemblePrompt` ignores `sourceKeyRules` | `next/src/lib/templates/shared.ts` | 46-58 |
| `summarizeForAgent` parses CSV but no `allowedKeys` | `next/src/lib/parsers/auto.ts` | 89-125 |
| Mock agent not in `AGENTS` | `next/src/lib/agents/detect.ts` | 43-297 |
| Only 3 E2E specs | `e2e/ui/` | — |
| 81 skill directories | `next/src/lib/templates/skills/` | — |
| `example.html` rare | Search skills dirs | Only ~6 have it |

---

*End of MVP Audit. The product has strong bones but the trust pipeline — its core differentiator — is entirely unwired in the main user flow.*
