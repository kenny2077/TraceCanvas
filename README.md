<div align="center">
  <a href="https://github.com/kenny2077/TraceCanvas">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/assets/banner.png" />
      <img src="docs/assets/banner.png" alt="TraceCanvas" width="800" />
    </picture>
  </a>

  <h1>TraceCanvas</h1>
  <p><b>Auditable HTML reports from structured data.</b></p>
  <p>Paste a CSV. Pick a template. Your local agent generates a verified HTML report —<br/>every number traceable, every claim checkable.</p>

  <p>
    <a href="https://github.com/kenny2077/TraceCanvas/actions/workflows/ci.yml"><img src="https://github.com/kenny2077/TraceCanvas/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="https://github.com/kenny2077/TraceCanvas/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat-square" alt="License" /></a>
    <a href="#quick-start"><img src="https://img.shields.io/badge/version-1.0.0-2563eb?style=flat-square" alt="Version" /></a>
    <img src="https://img.shields.io/badge/node-%E2%89%A520-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/next.js-16-black?style=flat-square&logo=next.js&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/react-19-61dafb?style=flat-square&logo=react&logoColor=white" alt="React" />
  </p>

  <p>
    <a href="#quick-start"><b>🚀 Quick Start</b></a> ·
    <a href="docs/trust-pipeline.md"><b>📖 How Verification Works</b></a> ·
    <a href="docs/demo-script.md"><b>🎬 Demo Script</b></a> ·
    <a href="https://github.com/kenny2077/TraceCanvas/stargazers"><b>⭐ Star on GitHub</b></a>
  </p>
</div>

---

## What is TraceCanvas

AI-generated reports look great — until someone asks **"where did this number come from?"** Most tools can't answer. The output is a black box of prompts, hallucinations, and formatting mixed together.

**TraceCanvas is different.** It treats trust as a first-class feature:

- Every data point in the output is annotated with a source key: `<!-- pf-src: rows[].score -->`
- A **verification receipt** runs 10 automated checks after generation
- The report is scored 0–100 on structure, security, source-key coverage, and content fidelity
- Everything runs locally through your own coding-agent CLI — or the built-in Mock Agent for instant demos

> **The core idea:** TraceCanvas doesn't just make reports that look good. It makes reports where **every number can be checked against the input.**

<!-- TODO: add a 15–20s demo GIF (docs/assets/demo.gif) showing CSV paste → Data Brief → verification receipt → PNG export -->

---

## Quick Start

Get a verified HTML report running locally in 60 seconds. No coding-agent CLI required.

```bash
# 1. Clone
git clone https://github.com/kenny2077/TraceCanvas.git
cd TraceCanvas/html-anything-main

# 2. Install
pnpm install --frozen-lockfile

# 3. Run
pnpm -F @html-anything/next dev
```

Open [http://localhost:3000](http://localhost:3000), then:

1. Select **Mock Agent** in the welcome modal
2. Paste this CSV into the editor:

```csv
department,score,headcount
Engineering,4.2,32
Design,4.7,12
Marketing,3.8,18
Product,4.5,8
```

3. Pick **Data Brief** from the template picker
4. Click **Convert**
5. Inspect the **Verification Receipt** — score, 10 checks, source-key coverage
6. Click **Export → PNG** to download

If you have Claude Code, Codex, or another supported agent installed, select it instead of Mock Agent for live generation.

---

## How It Works

```
┌─────────────┐   ┌─────────────────┐   ┌──────────────┐   ┌─────────────────┐   ┌─────────────┐
│ CSV/XLSX/   │ → │ Prompt Assembly │ → │ Agent Stream │ → │ 10-Check Verify │ → │ PNG/PDF/    │
│ JSON input  │   │ + source keys   │   │ via SSE      │   │ + auto-repair   │   │ PPTX export │
└─────────────┘   └─────────────────┘   └──────────────┘   └─────────────────┘   └─────────────┘
```

1. **Parse** — Auto-detect format. CSV/TSV/JSON become structured documents with deterministic source keys.
2. **Assemble** — Combine skill template constraints + source-key annotation rules + your data into one prompt.
3. **Generate** — Your local agent CLI streams HTML back via SSE. Watch it write in real time.
4. **Verify** — 10 automated checks run after generation: HTML structure, security, sanitizer diff, source-key presence/coverage/validity, content fidelity, anti-patterns.
5. **Repair** — Conservative auto-fix for broken tags. Never invents content.
6. **Export** — One click to PNG, PDF, PPTX, or self-contained HTML.

---

## Features

### 🔍 Source-Grounding

Every data-backed value is annotated with a traceable source key:

```html
<td>Engineering</td><!-- pf-src: rows[].department -->
<td class="text-right">4.2</td><!-- pf-src: rows[].score -->
```

The verification engine checks that expected keys are present, invalid keys are flagged, sampled values match the input verbatim, and no forbidden attributes exist.

### ✅ Verification Receipt

After generation, a score badge and full report are displayed front-and-center:

| Check | What it validates |
|---|---|
| HTML structure | Well-formed tags, closed elements |
| HTML security | No scripts, event handlers, or `javascript:` URLs |
| Sanitizer diff | DOMPurify did not strip meaningful content |
| Source-key presence | Annotations exist in the output |
| Source-key coverage | % of expected keys found |
| Source-key validity | All keys reference real input fields |
| Content fidelity | Sampled input values appear verbatim |
| Forbidden attributes | No raw `data-pf-source-id` attributes |
| Markdown fences | No accidental ``` fences in HTML |
| Anti-patterns | No lorem ipsum, no purple gradients |

### 🤖 Agent-Native + Mock Agent

TraceCanvas spawns the coding-agent CLI already on your machine — Claude Code, Codex, Gemini CLI, Cursor Agent, and others.

**Don't have one installed?** The built-in **Mock Agent** returns deterministic HTML fixtures. No CLI, no API key, no setup.

### 🎨 Design Templates

80 skill templates spanning reports, dashboards, decks, docs, cards, and more. The 1.0 heroes are the data/report templates:

- **Data Brief** — structured data report with tables and KPI cards
- **Survey Insight Report** — department breakdowns and key findings
- **Executive Summary** — one-page metric-focused summary
- **Research Note** — academic-style with citations
- **Live Team Dashboard** — Notion-style KPI dashboard
- **Finance Report** — quarterly financial report
- **Swiss International Deck** — classic slide deck
- **Guizang Editorial Deck** — editorial presentation

Adding a template = dropping a folder. No registration step.

### 📤 Export Targets

| Target | Status | Method |
|--------|--------|--------|
| **PNG** | Ready | `modern-screenshot` 2× DPI render |
| **PDF** | Ready | Browser print-to-PDF |
| **PPTX** | Ready | `pptxgenjs` for slide decks |
| **HTML** | Ready | Self-contained `.html` download |
| **WeChat** | Ready | `juice` inline CSS + ClipboardItem |
| **Zhihu** | Ready | Math formula conversion |
| Notion / Bluesky / Mastodon / Bilibili / Remotion / Markdown | Planned | Stubs exist; full export coming post-1.0 |

### 🛡️ Local-First Security

- No server database, no authentication, no cloud dependency
- Host-header gate prevents DNS rebinding
- Previews render in `iframe[sandbox]`
- DOMPurify rejects scripts and event handlers
- Secrets stripped from error logs

---

## Why TraceCanvas

| | Canva / Gamma | Generic AI HTML generators | **TraceCanvas** |
|---|---|---|---|
| Source traceability | Manual | None | **Every number annotated** |
| Local execution | Cloud | Cloud | **Your machine, your agent** |
| Works without API key | No | No | **Yes — Mock Agent included** |
| Structured data reports | Manual | Vibe-based | **Purpose-built** |
| Verifiable output | No | No | **10-check receipt + score** |

---

## Screenshots

<div align="center">
  <img src="docs/screenshots/01-entry-view.png" alt="Main editor" width="380" />
  <img src="docs/screenshots/02-template-picker.png" alt="Template picker" width="380" />
  <br/>
  <img src="docs/screenshots/03-streaming.png" alt="Streaming generation" width="380" />
  <img src="docs/screenshots/04-export.png" alt="Export menu" width="380" />
</div>

<!-- TODO: replace with a unified demo GIF once recorded -->

---

## Supported Agents

### Fully Wired

| Agent | CLI | Streaming | Setup |
|-------|-----|-----------|-------|
| Claude Code | `claude` | stream-json | `npm i -g @anthropic-ai/claude-code` |
| OpenAI Codex | `codex` | json | `npm i -g @openai/codex` |
| Cursor Agent | `cursor-agent` | stream-json | Built into Cursor IDE |
| Gemini CLI | `gemini` | stream-json | `npm i -g @google-gemini/gemini-cli` |
| GitHub Copilot | `copilot` | json | `npm i -g @github/copilot-cli` |
| OpenCode | `opencode` | json | `npm i -g opencode` |
| Qwen Coder | `qwen` | plain | `npm i -g @alibaba/qwen-coder` |
| Qoder CLI | `qodercli` | stream-json | `npm i -g qodercli` |
| Aider | `aider` | batch | `pip install aider` |
| DeepSeek TUI | `deepseek` | plain | `npm i -g deepseek` |
| OpenClaw | `openclaw` | batch | Multi-agent gateway |

### Built-In

| Agent | Description |
|-------|-------------|
| **Mock** | Always available. Deterministic fixture for demos and tests. |

### Detection-Only

Hermes, Kimi CLI, Devin, Kiro, Kilo, Vibe, and Pi are detected in the picker but show "protocol not yet supported" if selected.

---

## Commands

```bash
# Development
pnpm -F @html-anything/next dev          # Start dev server (localhost:3000)

# Quality
pnpm -F @html-anything/next typecheck    # TypeScript check
pnpm -F @html-anything/next test         # Unit tests (Vitest)
pnpm -F @html-anything/e2e typecheck     # E2E TypeScript check
pnpm -F @html-anything/e2e test          # E2E tests (Playwright)

# Production
pnpm -F @html-anything/next build        # Production build
pnpm -F @html-anything/next start        # Start production server

# Guard (run before pushing)
pnpm exec tsx scripts/guard.ts           # Validate project shape
```

---

## Project Structure

```
TraceCanvas/
├── html-anything-main/          # ← Application
│   ├── next/                    # Next.js app
│   │   ├── src/
│   │   │   ├── app/             # Routes + API
│   │   │   ├── components/      # React components
│   │   │   └── lib/             # Agents, parsers, templates, verify, export
│   │   └── src/__tests__/       # Unit tests
│   ├── e2e/                     # Playwright tests
│   └── docs/                    # Screenshots + assets
├── docs/                        # Architecture + release docs
│   ├── analysis/mvp-audit.md
│   ├── demo-script.md
│   ├── release/1.0-readiness.md
│   ├── templates-1.0-curation.md
│   ├── trust-pipeline.md
│   └── verification-model.md
└── AGENTS.md                    # Project guidelines
```

---

## Roadmap

### v1.0 (Current)

- [x] Mock agent for demo-without-CLI
- [x] Source-key rules injected into prompts
- [x] Full 10-check verification wired into main flow
- [x] Verification receipt as hero UI
- [x] Fidelity sample generation
- [x] Killer-flow E2E test
- [ ] API route integration tests
- [ ] DOM-parser-based HTML validation
- [ ] Windows native path testing
- [ ] Demo GIF refresh

### v1.1+

- [ ] ACP JSON-RPC protocol support
- [ ] Skill marketplace auto-update
- [ ] Cloudflare Pages deploy target
- [ ] Deck speaker notes export

### Later

- [ ] Image input support
- [ ] Collaborative skill editing
- [ ] Agent output diff viewer
- [ ] Scheduled regeneration

---

## Limitations

- **No hosted inference.** TraceCanvas spawns your local CLI. The Mock agent is available for instant demos.
- **Regex-based HTML extraction.** The current `extractHtml()` uses regex. A DOM-parser-based extraction is on the roadmap.
- **No mobile UI.** Designed for desktop use (≥1024px viewport).
- **Single-user, localhost-only.** Don't expose to the public internet.
- **Agent CLI fragility.** Adapters hardcode CLI flags that can break on upstream upgrades. Each adapter is lightweight (~10 lines) so fixes are quick.

---

## Contributing

The highest-leverage contributions are **files, not framework code** — a skill folder, a prompt fragment, or a ten-line agent adapter.

See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- How to add a new skill template
- How to hook up a new coding-agent CLI
- How to add a new export target
- PR bars and code style

Also available in [简体中文](CONTRIBUTING.zh-CN.md).

---

## Acknowledgements

- **[nexu-io/open-design](https://github.com/nexu-io/open-design)** — Agent detection architecture and Skills protocol
- **[mdnice/markdown-nice](https://github.com/mdnice/markdown-nice)** — `juice` CSS inlining for WeChat/Zhihu
- **[gcui-art/markdown-to-image](https://github.com/gcui-art/markdown-to-image)** — iframe → high-DPI PNG export
- **[alchaincyf/huashu-design](https://github.com/alchaincyf/huashu-design)** — Anti-AI-slop design philosophy
- **[op7418/guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill)** — `deck-guizang-editorial` skill

---

## License

Apache 2.0 © 2025 TraceCanvas contributors. See [LICENSE](LICENSE) for full text.

Vendored works in `next/src/lib/templates/skills/` retain their original licenses.

---

<div align="center">
  <sub>Built with Next.js 16 · React 19 · Zustand 5 · PapaParse 5 · DOMPurify 3 · Tailwind CSS 4 · Vitest 4 · Playwright</sub>
</div>
