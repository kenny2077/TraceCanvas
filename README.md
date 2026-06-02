<p align="center">
  <img src="docs/assets/banner.png" alt="TraceCanvas Banner" width="800" />
</p>

<p align="center">
  <a href="https://github.com/kenny2077/TraceCanvas/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License" /></a>
  <a href="https://github.com/kenny2077/TraceCanvas"><img src="https://img.shields.io/badge/version-0.4.1-green.svg" alt="Version" /></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-61dafb" alt="React" /></a>
</p>

<p align="center">
  <b>The agentic HTML editor.</b><br/>
  Paste structured data → your local coding agent generates world-class HTML<br/>
  with source-grounding, verification, and one-click export.
</p>

---

## 📸 Demo

<p align="center">
  <img src="docs/screenshots/01-entry-view.png" alt="Entry View" width="400" />
  <img src="docs/screenshots/02-template-picker.png" alt="Template Picker" width="400" />
</p>

<p align="center">
  <img src="docs/screenshots/03-streaming.png" alt="Streaming Generation" width="400" />
  <img src="docs/screenshots/04-export.png" alt="Export Menu" width="400" />
</p>

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/kenny2077/TraceCanvas.git
cd TraceCanvas/html-anything-main

# 2. Install
pnpm install --frozen-lockfile

# 3. Start
pnpm -F @html-anything/next dev
```

Open `http://localhost:3000`. The welcome modal scans for installed coding agents. Pick one, paste data, choose a template, click **⚡ Convert**.

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **At least one coding agent CLI** installed and logged in:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (recommended)
  - [OpenAI Codex CLI](https://github.com/openai/codex)
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli)
  - Or any of the [17 supported agents](#-supported-agents)

---

## ✨ What It Does

| 🧩 **Smart Parsing** | 🤖 **Agent-Powered** | ✅ **Verified Output** |
|---|---|---|
| Detects CSV, JSON, Markdown, SQL, YAML automatically | Calls your local agent CLI — no API keys needed | 10 verification checks on every generation |

| 🎨 **85+ Templates** | 📤 **12 Export Targets** | 🔧 **Auto-Repair** |
|---|---|---|
| Articles, decks, dashboards, posters, social cards, data reports | WeChat, Zhihu, Notion, Mastodon, Bluesky, PNG, PPTX, PDF, more | Fixes broken tags, unclosed elements, attribute fragments |

| 🔍 **Source-Grounding** | 📊 **Prompt Lab** | 🛡️ **Local-First Security** |
|---|---|---|
| Every data point annotated with traceable source keys | Dev harness for benchmarking real agent output | No server DB, host-header gate, secrets never logged |

---

## 🔄 How It Works

```
  📝 INPUT          🧠 PROMPT          🤖 AGENT           🔍 VERIFY         📤 EXPORT
  ─────────         ─────────          ───────           ────────         ────────
  CSV / JSON    →   Design rules   →   Claude Code   →   10 checks    →   WeChat
  Markdown          Source keys        Codex CLI          Structure        PNG
  SQL / YAML        Skill body         Gemini CLI         Security         PPTX
  Plain text        Examples           DeepSeek API       Fidelity         Notion
                                       ...17 agents       Sanitizer        PDF
```

1. **Parse** — Auto-detect format, convert to structured data with A1 cell IDs
2. **Assemble** — Combine skill template + source-key rules + your data into a prompt
3. **Generate** — Your local coding agent streams HTML via SSE
4. **Verify** — 10 checks: HTML well-formedness, script/event/js: safety, DOMPurify diff, source-key coverage, content fidelity
5. **Repair** — Auto-fix broken tags, close unclosed elements (conservative, never invents content)
6. **Export** — One-click to 12 platforms, or deploy to Vercel

---

## 🤖 Supported Agents

| Agent | Type | Streaming | Setup |
|-------|------|-----------|-------|
| **Claude Code** | CLI | ✅ | `npm i -g @anthropic-ai/claude-code` |
| **OpenAI Codex** | CLI | ✅ | `npm i -g @openai/codex` |
| **Gemini CLI** | CLI | ✅ | `npm i -g @google-gemini/gemini-cli` |
| **Cursor Agent** | CLI | ✅ | Built into Cursor IDE |
| **GitHub Copilot** | CLI | ✅ | `npm i -g @github/copilot-cli` |
| **OpenCode** | CLI | ✅ | `npm i -g opencode` |
| **Qwen Coder** | CLI | ✅ | `npm i -g @alibaba/qwen-coder` |
| **Qoder CLI** | CLI | ✅ | `npm i -g qodercli` |
| **Aider** | CLI | — | `pip install aider` |
| **DeepSeek TUI** | CLI | ✅ | `npm i -g deepseek` |
| **OpenClaw** | CLI | ❌ batch | Multi-agent gateway |
| **DeepSeek API** | API | ✅ | Set `DEEPSEEK_API_KEY` |
| **Kimi API** | API | ✅ | Set `KIMI_API_KEY` |
| **Mock** | Built-in | ✅ | Always available |

ACP agents (Hermes, Kimi CLI, Devin, Kiro, Kilo, Vibe) and Pi are detection-only — not yet wired.

---

## 📋 Skill Templates

85+ templates in `src/lib/templates/skills/`. Each is a folder with `SKILL.md` (YAML frontmatter + prompt body).

**Adding a template = adding a folder.** No code changes needed.

### Report Skills (0.4.1)

| Skill | Profile | Best For |
|-------|---------|----------|
| 📊 **Data Brief** | `strict` | Structured tables with KPIs and charts |
| 📋 **Survey Insight** | `strict` | Employee/customer survey analysis |
| 📝 **Executive Summary** | `strict-numbers` | One-page metric summaries |
| 🔬 **Research Note** | `medium` | Academic-style findings with methodology |
| 🃏 **Social Card** | `medium` | Shareable social media stat cards |

### Verification Profiles

| Profile | Source-Key Rules | When to Use |
|---------|-----------------|-------------|
| `strict` | Every value, label, quote needs `<!-- pf-src: ... -->` | Data reports, surveys |
| `strict-numbers` | Numbers require annotation; headings exempt | Executive summaries |
| `medium` | Key metrics annotated; interpretive text exempt | Research, social |
| `relaxed` | Minimal annotation | Creative outputs |

---

## 🔍 Source-Grounding

Every data point gets a traceable annotation:

```html
<td>Engineering</td><!-- pf-src: rows[].department -->
<td class="text-right">4.2</td><!-- pf-src: rows[].score -->
```

The verification engine checks:
- ✅ All expected source keys are present
- ✅ No invalid keys reference non-existent fields
- ✅ Sampled data values appear verbatim in the output
- ✅ No `data-pf-source-id` attributes (forbidden format)

---

## 🧪 Prompt Lab

A developer harness at `/dev/prompt-lab` for testing agent compliance:

- Choose adapter (Mock / DeepSeek / Kimi)
- Edit the system prompt inline
- Run generation against the survey fixture
- View raw HTML, source keys, verification report, and score side-by-side
- Save runs to localStorage history

---

## 📁 Project Structure

```
html-anything-main/
├── next/src/
│   ├── app/
│   │   ├── page.tsx              # Main editor shell
│   │   ├── dev/prompt-lab/       # Dev prompt testing UI
│   │   └── api/                  # 9 REST routes
│   ├── components/               # 20 React components
│   ├── lib/
│   │   ├── agents/               # 17 agent adapters, prompt composer
│   │   ├── parsers/              # CSV/TSV/JSON format detection
│   │   ├── templates/            # 85+ skill templates
│   │   ├── sources/              # A1-cell CSV parser, postprocessor
│   │   ├── verify/               # 10-check verification engine
│   │   ├── html/                 # DOMParser + DOMPurify validator
│   │   ├── repair/               # Conservative auto-repair
│   │   ├── export/               # 12 export targets
│   │   ├── deploy/               # Vercel one-click deploy
│   │   ├── history/              # IndexedDB version history
│   │   ├── validation/           # Request schema validation
│   │   └── security/             # Host-header DNS rebinding defense
│   └── middleware.ts             # API route security gate
├── e2e/                          # Playwright tests
├── docs/                         # Architecture docs + screenshots
│   ├── architecture.md
│   ├── trust-pipeline.md
│   ├── verification-model.md
│   ├── agent-adapters.md
│   ├── release-gate.md
│   └── benchmarks/
└── scripts/                      # Benchmark runners + fixtures
```

---

## 🌐 API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/agents` | `GET` | Detect installed agent CLIs |
| `/api/convert` | `POST` | Generate HTML via agent (SSE stream) |
| `/api/draft` | `POST` | AI-assisted markdown drafting |
| `/api/templates` | `GET` | List skill templates |
| `/api/deploy` | `POST` | Deploy HTML to Vercel preview |
| `/api/deploy/config` | `GET PUT DELETE` | Manage deploy tokens |
| `/api/marketplace` | `GET` | List installed skill packs |
| `/api/marketplace/install` | `POST` | Install skill pack from GitHub |
| `/api/agent/eval` | `POST` | Prompt evaluation (dev harness) |

All POST routes use validated request schemas. Invalid input returns:
```json
{ "error": "Validation failed", "details": [{ "field": "agent", "message": "agent is required." }] }
```

---

## 🔐 Security

- **Local-first** — No server database, no authentication, no multi-tenancy
- **Host-header gate** — Middleware rejects non-loopback `Host` headers to prevent DNS rebinding
- **Secrets never logged** — `sanitizeErrorBody()` strips `sk-` prefixes and `Bearer` tokens from error messages
- **Deploy tokens** — Stored at `~/.html-anything/vercel.json` with `chmod 600`
- **HTML validation** — DOMParser structural checks + DOMPurify sanitization diff. Script tags, event handlers, and `javascript:` URLs are rejected

---

## ⌨️ Commands

```bash
pnpm -F @html-anything/next dev          # Development server
pnpm -F @html-anything/next test         # Run tests (Vitest)
pnpm -F @html-anything/next typecheck    # TypeScript check
pnpm -F @html-anything/next build        # Production build
pnpm -F @html-anything/e2e test          # E2E tests (Playwright)
```

---

## 👥 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions, and the contributor guide (also available in [简体中文](CONTRIBUTING.zh-CN.md)).

---

## 📄 License

Apache 2.0 © 2025 TraceCanvas contributors. See [LICENSE](LICENSE) for full text.

---

<p align="center">
  <sub>Built with Next.js 16 · React 19 · Zustand 5 · PapaParse 5 · DOMPurify 3 · Tailwind CSS 4 · Vitest 4</sub>
</p>
