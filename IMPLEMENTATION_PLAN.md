# TraceCanvas 1.0 Implementation Plan

> **Status:** PLANNING STAGE COMPLETE — Implementation Stage Ready
> **Date:** 2026-06-11
> **Auditor:** Neko-chan AI Agent
> **Product Direction:** CSV/XLSX/JSON → source-grounded HTML report → verification receipt → PNG/PDF/PPTX export

---

## Stage 1: Planning ✅ COMPLETE

### Deliverables
- [x] Deep MVP audit (`docs/analysis/mvp-audit.md`)
- [x] Updated AGENTS.md with 1.0 scope lock
- [x] This implementation plan

### Key Findings from Audit
1. **Mock agent not implemented** — Breaks demo-without-CLI promise
2. **Full verification engine exists but is unwired** — `verifyArtifact()` (10 checks) never called in main flow; only `validateHtml()` (3 checks) runs
3. **Source-key rules not injected into prompt** — `sourceKeyRules` from skill frontmatter ignored by `assemblePrompt()`
4. **No fidelity samples generation** — Cannot prove numbers are not hallucinated
5. **Verification UI hidden by default** — Collapsible panel, not hero
6. **XLSX/JSON not parsed for source keys** — Only CSV/TSV generates structured source documents
7. **E2E missing killer-flow test** — Only 3 specs, none cover convert → preview → verification
8. **README drift** — Template counts, agent counts, mock agent claims are wrong

---

## Stage 2: Implementation (This Session)

### Phase 2A: Mock Agent + Source-Key Wiring

**Goal:** Make the trust pipeline real in the main user flow.

#### 2A.1 Implement Mock Agent
**Files to modify:**
- `next/src/lib/agents/detect.ts` — Add mock agent to `AGENTS` array
- `next/src/lib/agents/invoke.ts` — Add mock path in `invokeAgent()`
- `next/src/lib/agents/argv.ts` — Add mock argv (empty, returns fixture)

**Mock agent behavior:**
- Always "available" (no PATH check needed)
- Returns deterministic HTML fixture based on templateId
- For "data-brief" template: returns HTML with tables, KPI cards, and `<!-- pf-src: ... -->` comments
- Streams via SSE (start → delta chunks → done)
- No actual CLI spawn

**Test:** `pnpm -F @html-anything/next test` — add mock agent unit test

#### 2A.2 Wire Source-Key Rules into Prompt
**Files to modify:**
- `next/src/lib/templates/shared.ts` — `assemblePrompt()` must read `sourceKeyRules` from skill
- `next/src/lib/templates/loader.ts` — Ensure `sourceKeyRules` is loaded from frontmatter

**Behavior:**
- If skill has `source_key_rules` in frontmatter, append to prompt body
- Include generic source-key instruction for ALL structured data inputs:
  ```
  【Source-Key Annotation Rules】
  Every data-backed value MUST be annotated with a <!-- pf-src: ... --> comment.
  For CSV/TSV data, use: <!-- pf-src: rows[].fieldname -->
  For JSON data, use: <!-- pf-src: path.to.value -->
  Do NOT use data-pf-source-id attributes. Only HTML comments.
  ```

#### 2A.3 Generate allowedKeys and fidelitySamples
**Files to modify:**
- `next/src/lib/parsers/auto.ts` — `summarizeForAgent()` must return `allowedKeys` and `fidelitySamples`
- `next/src/lib/sources/parser.ts` — Add helper to generate allowedKeys from SourceDocument

**Behavior:**
- For CSV/TSV: generate `allowedKeys` like `["rows[].department", "rows[].score", "rows[].headcount"]`
- For JSON: generate keys from object paths
- Sample ~10 cell values for fidelity checking
- Pass these through the convert API to the verification stage

#### 2A.4 Wire Full Verification into Main Flow
**Files to modify:**
- `next/src/app/api/convert/route.ts` — After stream completes, run postprocess + verify
- `next/src/app/page.tsx` — Replace lightweight verification with full verification
- `next/src/components/verification-receipt.tsx` — Enhance to show all 10 checks

**New flow:**
```
User Input → detectFormat() → summarizeForAgent() → [generates allowedKeys + fidelitySamples]
    ↓
/api/convert POST → assemblePrompt(with sourceKeyRules) → invokeAgent()
    ↓
SSE stream → client appendHtml → extractHtml → [clean HTML]
    ↓
postprocessSourceKeys(html, allowedKeys) → [found/missing/invalid keys, coverage]
    ↓
verifyArtifact({rawOutput, cleanHtml, postprocess, sourceData, allowedKeys, fidelitySamples})
    ↓
Full VerificationReport → store in task → render VerificationReceipt (hero, not hidden)
```

**API change:** Convert route needs to:
1. Accept `allowedKeys` and `fidelitySamples` in request (or generate server-side)
2. After SSE stream, run postprocess + verify
3. Return verification report as final SSE event or separate API call

**Client change:** `use-convert.ts` handles verification event, stores in task

#### 2A.5 Make Verification Receipt the Hero
**Files to modify:**
- `next/src/app/page.tsx` — Move VerificationReceipt above fold, always visible when HTML exists
- `next/src/components/verification-receipt.tsx` — Larger score badge, summary stats

**Design:**
- Score badge: 48px circle, prominent color (green ≥90, amber ≥60, red <60)
- Always expanded (no "Show/Hide" toggle)
- Show: score, pass/fail, source-key coverage %, fidelity rate, issue count
- If failed: red banner "Export disabled until issues resolved" (or warning)

### Phase 2B: XLSX + JSON Source-Key Support

#### 2B.1 XLSX Parsing
**Files to modify:**
- `next/src/lib/parsers/auto.ts` — Add XLSX branch in `summarizeForAgent()`
- `next/src/lib/parsers/file.ts` — May already have XLSX parsing

**Behavior:**
- Use `xlsx` library to parse .xlsx upload
- Convert to same SourceDocument shape as CSV
- Generate allowedKeys and fidelitySamples

#### 2B.2 JSON Source-Key Generation
**Files to modify:**
- `next/src/lib/parsers/auto.ts` — JSON branch generates allowedKeys from object paths

**Behavior:**
- Flatten JSON object to dot-path keys: `data.users[0].name` → `users[].name`
- Generate fidelity samples from leaf values

### Phase 2C: Export Reliability

#### 2C.1 PNG Export Smoke Test
**Files:**
- `next/src/lib/export/image.ts` — Ensure modern-screenshot works with verified HTML
- Add error handling for iframe not ready

#### 2C.2 PDF Export
**Files:**
- `next/src/lib/export/download.ts` or new `pdf.ts` — Browser print-to-PDF helper

#### 2C.3 PPTX Export for Decks
**Files:**
- `next/src/lib/export/deck.ts` — Ensure pptxgenjs integration works

### Phase 2D: Tests

#### Unit Tests
- `next/src/__tests__/unit/mockAgent.test.ts` — Mock agent output, SSE events
- `next/src/__tests__/unit/sourceKeyWiring.test.ts` — Prompt injection, allowedKeys generation
- `next/src/__tests__/unit/verificationPipeline.test.ts` — Full pipeline with mock output
- `next/src/__tests__/unit/fidelitySamples.test.ts` — Sample generation from CSV/JSON

#### Integration Tests
- `next/src/__tests__/api/convertVerification.test.ts` — Mock agent → full verification response

#### E2E Tests
- `e2e/ui/killer-flow.test.ts` — CSV fixture → mock convert → preview → verification receipt visible → export PNG

---

## Stage 3: Rethink and Reevaluate

After Phase 2 implementation, pause and audit:

### Checklist
- [ ] Mock agent demo passes without any real CLI installed
- [ ] Verification receipt shows 10 checks, not 3
- [ ] Source-key coverage is visible and accurate
- [ ] Content fidelity shows sampled values found/missing
- [ ] Failed verification is obvious (red, not hidden)
- [ ] XLSX upload generates source keys
- [ ] JSON input generates source keys
- [ ] PNG export works from verified HTML
- [ ] All new tests pass
- [ ] Typecheck passes
- [ ] Guard passes

### Questions to Answer
1. Does the verification receipt feel like the hero of the product?
2. Can a new user run the mock demo in < 2 minutes?
3. Are the source-key annotations actually in the generated HTML?
4. Does the coverage score accurately reflect data traceability?
5. Is the product now defensibly different from "Canva + AI"?

### Decision Gates
- **GO:** All checklist items pass → proceed to Stage 4
- **NO-GO:** Any P0 blocker remains → fix before polish

---

## Stage 4: Implement Again + Final Wrap Up

### Phase 4A: README/Docs Polish
- Fix README drift (template counts, agent counts, mock agent, paths)
- Rewrite top story around "auditable reports"
- Create `docs/demo-script.md`
- Create `docs/release/1.0-readiness.md`

### Phase 4B: Demo Fixture
- Add `next/src/__tests__/fixtures/kpi-data.csv` — realistic department scores
- Add `next/src/__tests__/fixtures/kpi-data.xlsx` — same data in Excel
- Ensure fixture demonstrates source-key coverage

### Phase 4C: Template Curation
- Identify 6-8 best report/data templates
- Ensure they have `source_key_rules` in frontmatter
- Ensure they have `example.html` for picker preview
- De-emphasize non-report templates in UI (don't delete, just filter)

### Phase 4D: Release Gate
- Run full test suite
- Verify README quickstart from clean clone
- Verify mock agent demo
- Tag v1.0

---

## File Change Summary (Expected)

### New Files
- `next/src/lib/agents/mock.ts` — Mock agent fixture generator
- `next/src/__tests__/unit/mockAgent.test.ts`
- `next/src/__tests__/unit/sourceKeyWiring.test.ts`
- `next/src/__tests__/unit/verificationPipeline.test.ts`
- `next/src/__tests__/unit/fidelitySamples.test.ts`
- `next/src/__tests__/api/convertVerification.test.ts`
- `next/src/__tests__/fixtures/kpi-data.csv`
- `next/src/__tests__/fixtures/kpi-data.xlsx`
- `e2e/ui/killer-flow.test.ts`
- `docs/demo-script.md`
- `docs/release/1.0-readiness.md`

### Modified Files
- `next/src/lib/agents/detect.ts` — Add mock agent
- `next/src/lib/agents/invoke.ts` — Add mock path
- `next/src/lib/agents/argv.ts` — Add mock argv
- `next/src/lib/templates/shared.ts` — Inject sourceKeyRules
- `next/src/lib/templates/loader.ts` — Ensure sourceKeyRules loaded
- `next/src/lib/parsers/auto.ts` — Generate allowedKeys + fidelitySamples
- `next/src/lib/sources/parser.ts` — Add allowedKeys helper
- `next/src/app/api/convert/route.ts` — Run postprocess + verify
- `next/src/app/page.tsx` — Full verification, hero receipt
- `next/src/components/verification-receipt.tsx` — Enhanced UI
- `next/src/lib/use-convert.ts` — Handle verification events
- `next/src/lib/store.ts` — Add verificationReport to Task type
- `html-anything-main/README.md` — Fix drift, rewrite story

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Mock agent HTML doesn't match real agent output | Make mock output realistic with proper pf-src comments; document it's for demo only |
| Source-key rules make prompt too long | Keep rules concise (~5 lines); only inject for structured data |
| Verification slows conversion | Run verify AFTER stream completes, not blocking; show "Verifying..." spinner |
| XLSX parsing adds dependency | `xlsx` already in package.json |
| Breaking existing tests | Run tests after each sub-phase; fix immediately |
| User's agent ignores source-key rules | Verification will catch missing keys (fail state, not silent) |

---

## Success Criteria

- [ ] Mock agent demo passes without Claude/Codex installed
- [ ] Verification receipt is the most prominent UI element below the preview
- [ ] Source-key coverage score is accurate and visible
- [ ] Failed verification shows clear red state
- [ ] PNG/PDF/PPTX exports work
- [ ] E2E killer-flow test passes
- [ ] README no longer overclaims
- [ ] A new user can follow quickstart and see verification in < 5 minutes

---

*Plan locked. Proceed to Stage 2: Implementation.*
