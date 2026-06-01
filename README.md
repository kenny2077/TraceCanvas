# HTML Anything · TraceCanvas

**The agentic HTML editor.** Paste structured data (CSV, JSON, Markdown, SQL), pick a skill template, and your local coding agent generates a world-class HTML document — with source-grounding annotations, verification, and one-click export.

> Built on the TraceCanvas trust pipeline: source parsing → prompt assembly → agent generation → HTML extraction → verification → repair → export.

---

## Architecture

```
┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  User Input   │───▶│  Format Parser   │───▶│  Prompt Assembly  │
│  (textarea)   │    │  parsers/auto.ts │    │  templates/       │
└──────────────┘    └─────────────────┘    └────────┬─────────┘
                                                     │
                                              ┌──────▼─────────┐
                                              │  Agent Invoke   │
                                              │  agents/invoke  │
                                              │  (child_process) │
                                              └──────┬─────────┘
                                                     │ SSE stream
                                              ┌──────▼─────────┐
                                              │  HTML Extract   │
                                              │  extract-html   │
                                              └──────┬─────────┘
                                                     │
                                     ┌───────────────┼───────────────┐
                                     │               │               │
                              ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
                              │  Verify      │ │  Repair      │ │  Export     │
                              │  verify/     │ │  repair/     │ │  export/    │
                              └─────────────┘ └─────────────┘ └─────────────┘
```

### Pipeline stages

| Stage | Module | Description |
|-------|--------|-------------|
| **Source Parsing** | `lib/parsers/` | Format detection (8 types), CSV/TSV/JSON parsing with PapaParse, A1 cell ID generation |
| **Prompt Assembly** | `lib/templates/` | 85+ skill templates with SKILL.md frontmatter, shared design directives, diff-edit mode |
| **Agent Generation** | `lib/agents/` | 17 agent CLI adapters (Claude, Codex, Gemini, DeepSeek, Kimi, etc.), hardened with timeout/error categorization |
| **HTML Extraction** | `lib/extract-html.ts` | Regex-based HTML rescue from chatty agent output |
| **Verification** | `lib/verify/`, `lib/html/` | 10 checks: HTML structure, security (script/event/js:), DOMPurify sanitization, source-key coverage/validity, content fidelity |
| **Repair** | `lib/repair/` | Conservative auto-fix: strip attribute fragments, close unclosed tags |
| **Export** | `lib/export/` | 12 targets: WeChat, Zhihu, Bilibili, Notion, Mastodon, Bluesky, clipboard, download, PNG, PPTX, PDF, Remotion ZIP |

---

## Quick Start

```bash
# Prerequisites: Node.js 20+, pnpm, and at least one coding agent CLI
# (Claude Code, Codex CLI, Gemini CLI, etc.)

git clone https://github.com/kenny2077/TraceCanvas.git
cd TraceCanvas/html-anything-main

pnpm install --frozen-lockfile
pnpm -F @html-anything/next dev
```

Open `http://localhost:3000`. The welcome modal scans for installed agents. Pick one, paste data, select a template, and click Convert.

---

## Supported Agents

| Agent | Protocol | Streaming | API Key Needed |
|-------|----------|-----------|---------------|
| Claude Code | stdin (CLI) | ✅ | No (local session) |
| OpenAI Codex | stdin (CLI) | ✅ | No (local session) |
| Gemini CLI | stdin (CLI) | ✅ | No (local session) |
| Cursor Agent | stdin (CLI) | ✅ | No (local session) |
| GitHub Copilot CLI | stdin (CLI) | ✅ | No (local session) |
| OpenCode | stdin (CLI) | ✅ | No (local session) |
| Qwen Coder | stdin (CLI) | ✅ | No (local session) |
| Qoder CLI | stdin (CLI) | ✅ | No (local session) |
| Aider | stdin (CLI) | — | No (local session) |
| DeepSeek TUI | argv (CLI) | ✅ | No (local session) |
| OpenClaw | argv-message | ❌ (batch) | No (local session) |
| **DeepSeek API** | api | ✅ | `DEEPSEEK_API_KEY` |
| **Kimi API** | api | ✅ | `KIMI_API_KEY` |
| Mock | mock | ✅ | None |

ACP agents (Hermes, Kimi CLI, Devin, Kiro, Kilo, Vibe) and Pi are detection-only — not yet wired.

---

## Skill Templates

85+ skill templates organized by scenario. Templates are folders under `src/lib/templates/skills/<id>/` containing a `SKILL.md` with YAML frontmatter and a Chinese-language prompt body.

**Adding a template = adding a folder.** No TypeScript changes needed.

### New Report Skills (0.4.1)

| Skill | Profile | Description |
|-------|---------|-------------|
| 📊 Data Brief | `strict` | Structured data report with tables, charts, and source annotations |
| 📋 Survey Insight | `strict` | Employee/customer survey analysis with department breakdowns |
| 📝 Executive Summary | `strict-numbers` | One-page executive summary with key metrics |
| 🔬 Research Note | `medium` | Academic-style research note with methodology |
| 🃏 Social Card | `medium` | Shareable social media card with key stats |

---

## Verification Profiles

| Profile | Source-key requirements | Use cases |
|---------|------------------------|-----------|
| `strict` | Every value, label, quote must have `pf-src` annotation | Data reports, surveys |
| `strict-numbers` | Numbers require `pf-src`, headings/descriptions exempt | Executive summaries |
| `medium` | Key metrics require `pf-src`, interpretive text exempt | Research notes, social cards |
| `relaxed` | Minimal annotation requirements | Creative outputs |

---

## Source-Grounding

Every data point in generated HTML is annotated with a source-key comment:

```html
<td>Engineering</td><!-- pf-src: rows[].department -->
<td>4.2</td><!-- pf-src: rows[].score -->
```

The verification engine checks that all expected source keys are present, no invalid keys exist, and sampled data values appear in the output. This provides a deterministic trust signal — you can trace every claim back to the source data.

---

## Project Structure

```
html-anything-main/
├── next/                          # Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Main page shell
│   │   │   ├── dev/prompt-lab/    # Dev-only prompt testing UI
│   │   │   └── api/               # 8 API routes
│   │   ├── components/            # 20 React components
│   │   ├── lib/
│   │   │   ├── agents/            # Agent detection, invocation, adapters, prompt composer
│   │   │   ├── parsers/           # Format detection, file parsing
│   │   │   ├── templates/         # Skill loader, 85+ templates
│   │   │   ├── sources/           # CSV parser, postprocessor
│   │   │   ├── verify/            # Verification engine
│   │   │   ├── html/              # HTML validator
│   │   │   ├── repair/            # Repair engine
│   │   │   ├── export/            # 12 export targets
│   │   │   ├── deploy/            # Vercel deployment
│   │   │   ├── history/           # IndexedDB version history
│   │   │   ├── validation/        # Request validation schemas
│   │   │   ├── security/          # Host-header validation
│   │   │   ├── skills/            # Marketplace skill registry
│   │   │   └── store.ts           # Zustand state (localStorage)
│   │   └── middleware.ts          # Host-header gate on /api/*
│   └── package.json
├── e2e/                           # Playwright E2E tests
├── docs/                          # Architecture documentation
│   ├── architecture.md
│   ├── trust-pipeline.md
│   ├── verification-model.md
│   ├── agent-adapters.md
│   ├── release-gate.md
│   └── benchmarks/
│       ├── real-agent-output.md
│       └── results.json
└── package.json                   # pnpm workspace root
```

---

## Commands

```bash
# Development
pnpm -F @html-anything/next dev          # Start dev server

# Testing
pnpm -F @html-anything/next test         # Run unit tests (Vitest)
pnpm -F @html-anything/next typecheck    # TypeScript check

# Build
pnpm -F @html-anything/next build        # Production build
```

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agents` | GET | Detect installed agent CLIs |
| `/api/convert` | POST | Stream HTML generation via agent SSE |
| `/api/draft` | POST | AI-assisted markdown drafting |
| `/api/templates` | GET | List skill templates |
| `/api/deploy` | POST | Deploy HTML to Vercel preview |
| `/api/deploy/config` | GET/PUT/DELETE | Manage deploy tokens |
| `/api/marketplace` | GET | List installed skill packages |
| `/api/marketplace/install` | POST | Install skill pack from GitHub |
| `/api/agent/eval` | POST | Prompt evaluation (dev harness) |

All POST routes use validated request schemas. Invalid requests return `{ error: "Validation failed", details: [...] }` with status 400.

---

## Security

- **Local-first:** No server-side database, no authentication, no multi-tenancy. Runs on `localhost`.
- **Host-header gate:** Middleware rejects non-loopback `Host` headers to prevent DNS rebinding attacks. Configurable via `HTML_ANYTHING_ALLOWED_HOSTS`.
- **API key safety:** Secrets never appear in error messages. Adapter diagnostics report only whether a key is present, not its value.
- **Deploy tokens:** Stored at `~/.html-anything/vercel.json` with `chmod 600`. Never leave the server.
- **HTML validation:** DOMParser structural checks + DOMPurify sanitization diff. Script tags, event handlers, and `javascript:` URLs are rejected unless in the CDN allowlist.

---

## Persistence

- **localStorage:** Active tasks, content, HTML, settings (Zustand persist)
- **IndexedDB:** Per-task version history with verification reports, repair results, and analysis summaries (capped at 20 versions/task)
- **File system:** Deploy tokens in `~/.html-anything/`

---

## License

Apache-2.0 — see `package.json`.

---

## Built With

- [Next.js](https://nextjs.org) 16
- [React](https://react.dev) 19
- [Zustand](https://zustand.docs.pmnd.rs) 5
- [PapaParse](https://www.papaparse.com) 5
- [DOMPurify](https://github.com/cure53/DOMPurify) 3
- [Tailwind CSS](https://tailwindcss.com) 4
- [Vitest](https://vitest.dev) 4
- [idb](https://github.com/jakearchibald/idb) 8
