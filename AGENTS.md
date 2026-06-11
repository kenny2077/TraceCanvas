# TraceCanvas Project - Agent Guidelines

## Project Overview

TraceCanvas is a UMN project. The main application lives in `html-anything-main/`.

**1.0 Product Direction (Locked):**
> TraceCanvas turns structured data into beautiful, source-audited HTML reports with export-ready artifacts.

**Killer Demo Path (Non-negotiable):**
CSV/XLSX/JSON upload → Data Brief template → generated HTML report → source-key coverage score → content-fidelity receipt → export PNG/PDF/PPTX

The core differentiator is **trust**: every number in the output can be checked against the input. This is NOT a general Canva/Gamma/Figma replacement. Do not expand surfaces — make the trust pipeline impossible to fake.

## 1.0 Implementation Status

Last updated: 2026-06-11

| Component | Status | Evidence |
|-----------|--------|----------|
| Mock Agent | ✅ Done | `next/src/lib/agents/mock.ts` |
| Source-key prompt injection | ✅ Done | `next/src/lib/templates/shared.ts` |
| allowedKeys / fidelitySamples | ✅ Done | `next/src/lib/parsers/auto.ts` |
| Full 10-check verification wired | ✅ Done | `next/src/lib/use-convert.ts` |
| Verification receipt as hero UI | ✅ Done | `next/src/app/page.tsx` |
| Unit tests for trust pipeline | ✅ Done | `next/src/__tests__/unit/*` |
| Killer-flow E2E test | ✅ Done | `e2e/ui/killer-flow.test.ts` |
| README rewrite | ✅ Done | `html-anything-main/README.md` |
| Template curation + example.html | ✅ Done | `docs/templates-1.0-curation.md` + 4 new example.html files |
| Release gate docs | ✅ Done | `docs/release/1.0-readiness.md` |
| TypeScript | ✅ Clean | `npx tsc --noEmit` — 0 errors |
| Runtime tests | ⏳ Pending | Requires `pnpm install` (user will run locally due to slow VPN) |

## Workspace Structure

- `/Users/kenny/Desktop/UMN/Projects/TraceCanvas/` - Project root
  - `html-anything-main/` - Next.js application (see its own AGENTS.md)
  - `docs/analysis/mvp-audit.md` - Pre-1.0 audit
  - `docs/templates-1.0-curation.md` - 1.0 template focus
  - `docs/release/1.0-readiness.md` - Release gate checklist
  - `docs/demo-script.md` - Killer demo steps
  - `AGENTS.md` - This file

## Commands

### Navigation
- `cd html-anything-main` to enter the app directory

### Inside html-anything-main/
- Install: `pnpm install --frozen-lockfile`
- Guard shape: `pnpm exec tsx scripts/guard.ts`
- App dev: `pnpm -F @html-anything/next dev`
- App typecheck: `pnpm -F @html-anything/next typecheck`
- App unit tests: `pnpm -F @html-anything/next test`
- App build: `pnpm -F @html-anything/next build`
- E2E typecheck: `pnpm -F @html-anything/e2e typecheck`
- E2E tests: `pnpm -F @html-anything/e2e test`

## RTK-Compressed Commands (Preferred)

Use RTK-prefixed commands for 60-90% token savings:

### File Operations
- `rtk ls .` - Compact directory listing
- `rtk read <file>` - Smart file reading
- `rtk grep "pattern" .` - Grouped search results
- `rtk find "*.ts" .` - Compact find results
- `rtk diff <file1> <file2>` - Condensed diff

### Git
- `rtk git status` - Compact status
- `rtk git log -n 10` - One-line commits
- `rtk git diff` - Condensed diff
- `rtk git add .` -> "ok"
- `rtk git commit -m "msg"` -> "ok abc1234"
- `rtk git push` -> "ok main"

### Tests & Build
- `rtk pnpm test` - Compact test output
- `rtk pnpm build` - Compact build output
- `rtk err <cmd>` - Filter errors only

### Analytics
- `rtk gain` - Show token savings
- `rtk discover` - Find missed savings opportunities

## Agent Behavior

1. Prefer RTK-compressed shell commands for git, search, tests, builds, and logs
2. Read html-anything-main/AGENTS.md for Next.js-specific rules
3. Use `pnpm -F` workspace filters from repository root
4. Do not add source outside designated directories
5. **1.0 Scope Lock**: Do NOT work on ACP/pi-rpc agents, marketplace auto-update, Cloudflare deploy, Remotion/video, Notion export, collaboration, or mobile UI unless explicitly directed
6. **Trust Pipeline First**: Any work must either (a) wire source-key verification into main flow, (b) strengthen export reliability for PNG/PDF/PPTX, or (c) improve the demo path
7. **Mock Agent is Critical**: The mock agent enables demos without paid CLI setup. It must be maintained and tested.
8. **Verification Receipt is the Hero**: The score badge must be prominent, not hidden. Failed verification must be obvious.
9. **Tests Are The Gate**: Do not claim 1.0 readiness until `pnpm -F @html-anything/next test` and `pnpm -F @html-anything/e2e test` both pass.
