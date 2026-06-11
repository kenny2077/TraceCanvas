# TraceCanvas 1.0 Demo Script

> **Goal:** Run the killer demo path end-to-end in under 5 minutes.

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (or npm / yarn)
- Git

## Install & Run

```bash
# Clone
git clone https://github.com/kenny2077/TraceCanvas.git
cd TraceCanvas/tracecanvas

# Install dependencies
pnpm install --frozen-lockfile

# Start dev server
pnpm -F @html-anything/next dev
```

Open http://localhost:3000

## Demo Steps

### 1. Welcome Modal
- The welcome modal auto-opens on first visit
- Select **"Mock Agent"** (no CLI installation needed)
- Click **"Enter Editor"**

### 2. Paste Data
In the left editor, paste this CSV:

```csv
department,score,headcount
Engineering,4.2,32
Design,4.7,12
Marketing,3.8,18
Product,4.5,8
```

### 3. Select Template
- Click the template picker
- Choose **"Data Brief"** (📊)

### 4. Convert
- Click **"⚡ Convert"** (or press ⌘+Enter)
- Watch the HTML stream into the preview pane

### 5. Inspect Verification Receipt
Below the preview, the **Verification Receipt** shows:
- **Score badge** (e.g., 85/100)
- **10 check results:**
  - HTML structure ✅
  - HTML security ✅
  - Sanitizer ✅
  - DOCTYPE ✅
  - Source-key presence ✅
  - Source-key coverage ✅ (e.g., 18/18 keys)
  - Source-key validity ✅
  - Content fidelity ✅ (e.g., 9/9 samples found)
  - No raw data-pf-source-id ✅
  - No markdown fences ✅

### 6. Export
- Click **Export → PNG** → download
- Click **Export → PDF** → download
- Click **Export → HTML** → download self-contained .html

## Intentional Failure Demo (Optional)

To show the verification catches problems:

1. Edit the generated HTML in the code tab
2. Remove a `<!-- pf-src: ... -->` comment
3. Click **Convert** again (or wait for auto-refresh)
4. The verification receipt should show:
   - **Source-key coverage:** FAIL
   - **Score drops**
   - Red warning: "Not export-safe"

## Expected Result

A new user can go from `git clone` to verified HTML report in **< 5 minutes** without installing any AI CLI.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "pnpm not found" | `npm install -g pnpm` |
| Port 3000 in use | `PORT=3001 pnpm -F @html-anything/next dev` |
| Mock agent not in list | Check `next/src/lib/agents/detect.ts` has mock entry |
| Verification receipt empty | Ensure CSV has header row + data rows |
