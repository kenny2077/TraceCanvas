/**
 * Minimal inline benchmark for mock adapter.
 * Runs with plain Node.js — no tsx or pnpm needed.
 *
 * Usage: node scripts/benchmark-inline.mjs
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, "..", "docs", "benchmarks");

// ─── Inlined extractHtml ─────────────────────────────────────────
function extractHtml(streamed) {
  if (!streamed) return "";
  const fence = streamed.match(/```(?:html|HTML)?\s*([\s\S]*?)```/);
  if (fence && fence[1].trim().startsWith("<")) return fence[1].trim();
  const dt = streamed.search(/<!DOCTYPE\s+html/i);
  if (dt !== -1) {
    const ci = streamed.lastIndexOf("</html>");
    if (ci !== -1) return streamed.slice(dt, ci + "</html>".length);
    return streamed.slice(dt);
  }
  const hs = streamed.search(/<html[\s>]/i);
  if (hs !== -1) {
    const ci = streamed.lastIndexOf("</html>");
    if (ci !== -1) return streamed.slice(hs, ci + "</html>".length);
    return streamed.slice(hs);
  }
  if (streamed.trimStart().startsWith("<")) return streamed;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><pre>${streamed.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre></body></html>`;
}

// ─── Inlined postprocessSourceKeys ────────────────────────────────
function postprocessSourceKeys(html, allowedKeys) {
  const allowedSet = new Set(allowedKeys);
  const foundSet = new Set();
  const invalidSet = new Set();
  const raw = [];
  const re = /<!--\s*pf-src:\s*(\S+)\s*-->/g;
  let m;
  while ((m = re.exec(html))) {
    raw.push({ key: m[1], index: m.index });
    if (allowedSet.has(m[1])) foundSet.add(m[1]);
    else invalidSet.add(m[1]);
  }
  const foundKeys = [...foundSet].sort();
  const invalidKeys = [...invalidSet].sort();
  const missingKeys = allowedKeys.filter((k) => !foundSet.has(k)).sort();
  return {
    foundKeys, missingKeys, invalidKeys,
    coverage: allowedKeys.length ? Math.round((foundKeys.length / allowedKeys.length) * 100) / 100 : 0,
    totalComments: raw.length, rawMatches: raw,
  };
}

// ─── Inlined verifyArtifact ───────────────────────────────────────
function verifyArtifact({ rawOutput, cleanHtml, postprocess, allowedKeys, fidelitySamples }) {
  const checks = [];

  // well-formed
  if (!cleanHtml) checks.push({ id:"well-formed",label:"HTML well-formedness",status:"fail",detail:"Empty HTML" });
  else checks.push({ id:"well-formed",label:"HTML well-formedness",status:"pass",detail:"HTML present" });

  // doctype
  if (/<!DOCTYPE\s+html/i.test(rawOutput)) checks.push({ id:"doctype",label:"DOCTYPE",status:"pass",detail:"Found" });
  else if (cleanHtml.includes("<!DOCTYPE html>")) checks.push({ id:"doctype",label:"DOCTYPE",status:"warn",detail:"Scaffolded" });
  else checks.push({ id:"doctype",label:"DOCTYPE",status:"fail",detail:"Missing" });

  // source-key presence
  if (postprocess.totalComments > 0) checks.push({ id:"keys-presence",label:"Source keys present",status:"pass",detail:`${postprocess.totalComments} found`,metric:postprocess.totalComments });
  else checks.push({ id:"keys-presence",label:"Source keys present",status:"fail",detail:"No source keys",metric:0 });

  // coverage
  const pct = Math.round(postprocess.coverage * 100);
  if (postprocess.coverage >= 0.9) checks.push({ id:"keys-coverage",label:"Coverage",status:"pass",detail:`${pct}%`,metric:postprocess.coverage });
  else if (postprocess.coverage >= 0.5) checks.push({ id:"keys-coverage",label:"Coverage",status:"warn",detail:`${pct}%`,metric:postprocess.coverage });
  else checks.push({ id:"keys-coverage",label:"Coverage",status:"fail",detail:`${pct}%`,metric:postprocess.coverage });

  // validity
  if (postprocess.invalidKeys.length === 0) checks.push({ id:"keys-validity",label:"Key validity",status:"pass",detail:"All valid" });
  else checks.push({ id:"keys-validity",label:"Key validity",status:"fail",detail:`${postprocess.invalidKeys.length} invalid` });

  // content fidelity
  if (!fidelitySamples || fidelitySamples.length === 0) checks.push({ id:"fidelity",label:"Fidelity",status:"warn",detail:"No samples" });
  else {
    let found = 0;
    for (const s of fidelitySamples) { if (cleanHtml.includes(s.value)) found++; }
    const rate = found / fidelitySamples.length;
    if (rate >= 0.8) checks.push({ id:"fidelity",label:"Content fidelity",status:"pass",detail:`${found}/${fidelitySamples.length}`,metric:rate });
    else if (rate >= 0.5) checks.push({ id:"fidelity",label:"Content fidelity",status:"warn",detail:`${found}/${fidelitySamples.length}`,metric:rate });
    else checks.push({ id:"fidelity",label:"Content fidelity",status:"fail",detail:`${found}/${fidelitySamples.length}`,metric:rate });
  }

  // no-raw-source-id
  if (!/data-pf-source-id/gi.test(rawOutput)) checks.push({ id:"no-raw-id",label:"No raw data-pf-source-id",status:"pass",detail:"Clean" });
  else checks.push({ id:"no-raw-id",label:"No raw data-pf-source-id",status:"fail",detail:"Found" });

  // no-markdown-fences
  if (!/```html|```HTML/.test(rawOutput)) checks.push({ id:"no-fences",label:"No markdown fences",status:"pass",detail:"Clean" });
  else checks.push({ id:"no-fences",label:"No markdown fences",status:"fail",detail:"Found" });

  const failCount = checks.filter(c=>c.status==="fail").length;
  const warnCount = checks.filter(c=>c.status==="warn").length;
  const passCount = checks.filter(c=>c.status==="pass").length;
  const score = Math.round(((passCount + warnCount * 0.5) / checks.length) * 100);
  const passed = failCount === 0;
  let summary;
  if (passed && score >= 90) summary = "All passed. High confidence.";
  else if (passed) summary = `${warnCount} warning(s).`;
  else summary = `${failCount} failure(s).`;

  return { passed, checks, score, summary };
}

// ─── Fixture: employee engagement survey (the one mock HTML matches) ─
const SURVEY_FIXTURE = {
  id: "employee-survey",
  title: "Employee Engagement Survey",
  fields: ["department","question","category","score","responses","comment"],
  rows: [{department:"Engineering",question:"How satisfied are you with remote work flexibility?",category:"Workplace",score:4.2,responses:87,comment:"Most engineers prefer 3 days remote, 2 in-office"},{department:"Engineering",question:"Do you feel your work is recognized?",category:"Recognition",score:3.1,responses:87,comment:"Recognition is inconsistent across teams"},{department:"Engineering",question:"How would you rate career growth opportunities?",category:"Growth",score:2.8,responses:87,comment:"Junior engineers want clearer promotion criteria"},{department:"Design",question:"How satisfied are you with remote work flexibility?",category:"Workplace",score:4.5,responses:23,comment:"Design team is fully remote and happy"},{department:"Design",question:"Do you feel your work is recognized?",category:"Recognition",score:3.8,responses:23,comment:"Design reviews help but peer recognition is lacking"},{department:"Design",question:"How would you rate career growth opportunities?",category:"Growth",score:3.2,responses:23,comment:"Limited IC track beyond Senior Designer"},{department:"Marketing",question:"How satisfied are you with remote work flexibility?",category:"Workplace",score:4.0,responses:31,comment:"Hybrid schedule works well for events team"},{department:"Marketing",question:"Do you feel your work is recognized?",category:"Recognition",score:3.5,responses:31,comment:"Campaign wins are celebrated, day-to-day less so"},{department:"Marketing",question:"How would you rate career growth opportunities?",category:"Growth",score:3.0,responses:31,comment:"Want more cross-functional project opportunities"},{department:"Sales",question:"How satisfied are you with remote work flexibility?",category:"Workplace",score:3.8,responses:42,comment:"Field sales already remote; inside sales want more flexibility"},{department:"Sales",question:"Do you feel your work is recognized?",category:"Recognition",score:4.0,responses:42,comment:"Commission structure provides clear recognition"},{department:"Sales",question:"How would you rate career growth opportunities?",category:"Growth",score:3.5,responses:42,comment:"Clear path from SDR → AE → Enterprise AE"},{department:"HR",question:"How satisfied are you with remote work flexibility?",category:"Workplace",score:4.8,responses:12,comment:"HR team is fully distributed"},{department:"HR",question:"Do you feel your work is recognized?",category:"Recognition",score:3.2,responses:12,comment:"HR work is often invisible until something goes wrong"},{department:"HR",question:"How would you rate career growth opportunities?",category:"Growth",score:2.5,responses:12,comment:"Small team limits upward mobility"}],
  allowedKeys: ["rows[].department","rows[].question","rows[].category","rows[].score","rows[].responses","rows[].comment"],
  fidelitySamples: [{key:"rows[0].score",value:"4.2"},{key:"rows[3].department",value:"Design"},{key:"rows[14].comment",value:"Small team limits upward mobility"},{key:"rows[5].score",value:"3.2"}],
};

// ─── 5 benchmark fixtures (abbreviated for inline use) ───────────
const FIXTURES = [
  {
    id: "survey-disagreement",
    title: "Survey Disagreement",
    fields: ["department","question","category","score","responses","comment"],
    rows: [
      {department:"Engineering",question:"Do you feel your work is recognized?",category:"Recognition",score:2.1,responses:94,comment:"Only top performers get shoutouts; quiet contributors are invisible"},
      {department:"Sales",question:"Do you feel your work is recognized?",category:"Recognition",score:4.8,responses:56,comment:"Commission + monthly awards — we know exactly where we stand"},
      {department:"Engineering",question:"How satisfied are you with remote work?",category:"Workplace",score:4.5,responses:94,comment:"Flexible hours, home office stipend, no mandatory office days"},
      {department:"Sales",question:"How satisfied are you with remote work?",category:"Workplace",score:2.3,responses:56,comment:"Field sales can't be remote — inside sales wants hybrid but denied"},
      {department:"Engineering",question:"How would you rate career growth?",category:"Growth",score:3.1,responses:94,comment:"Promo packets are clear but the bar keeps moving"},
      {department:"Sales",question:"How would you rate career growth?",category:"Growth",score:3.9,responses:56,comment:"SDR→AE→Enterprise is well-defined; limited beyond that"},
    ],
    allowedKeys: ["rows[].department","rows[].question","rows[].category","rows[].score","rows[].responses","rows[].comment"],
    fidelitySamples: [{key:"rows[0].score",value:"2.1"},{key:"rows[1].score",value:"4.8"},{key:"rows[0].comment",value:"quiet contributors are invisible"}],
  },
  {
    id: "regional-revenue",
    title: "Regional Revenue",
    fields: ["region","quarter","revenue_usd","growth_pct","top_product"],
    rows: [
      {region:"APAC",quarter:"Q1 2025",revenue_usd:2847350.42,growth_pct:12.7,top_product:"CloudSuite APAC"},
      {region:"EMEA",quarter:"Q1 2025",revenue_usd:3102889.15,growth_pct:8.3,top_product:"DataVault Pro"},
      {region:"NA",quarter:"Q1 2025",revenue_usd:5673221.88,growth_pct:15.1,top_product:"CloudSuite Enterprise"},
      {region:"APAC",quarter:"Q2 2025",revenue_usd:3012555.00,growth_pct:5.8,top_product:"CloudSuite APAC"},
      {region:"EMEA",quarter:"Q2 2025",revenue_usd:2890112.73,growth_pct:-6.9,top_product:"DataVault Pro"},
      {region:"NA",quarter:"Q2 2025",revenue_usd:6101443.29,growth_pct:7.5,top_product:"CloudSuite Enterprise"},
    ],
    allowedKeys: ["rows[].region","rows[].quarter","rows[].revenue_usd","rows[].growth_pct","rows[].top_product"],
    fidelitySamples: [{key:"rows[0].revenue_usd",value:"2847350.42"},{key:"rows[4].growth_pct",value:"-6.9"}],
  },
  {
    id: "product-sales",
    title: "Product Sales",
    fields: ["sku","product_name","category","units_sold","unit_price_usd","revenue_usd"],
    rows: [
      {sku:"CLD-001",product_name:"CloudSuite Basic",category:"SaaS",units_sold:1420,unit_price_usd:29.99,revenue_usd:42585.80},
      {sku:"CLD-002",product_name:"CloudSuite Pro",category:"SaaS",units_sold:873,unit_price_usd:79.99,revenue_usd:69831.27},
      {sku:"DV-001",product_name:"DataVault Starter",category:"Data",units_sold:2105,unit_price_usd:14.99,revenue_usd:31553.95},
      {sku:"AI-001",product_name:"InsightAI Platform",category:"AI/ML",units_sold:524,unit_price_usd:249.99,revenue_usd:130994.76},
    ],
    allowedKeys: ["rows[].sku","rows[].product_name","rows[].category","rows[].units_sold","rows[].unit_price_usd","rows[].revenue_usd"],
    fidelitySamples: [{key:"rows[0].sku",value:"CLD-001"},{key:"rows[3].revenue_usd",value:"130994.76"}],
  },
  {
    id: "average-rating",
    title: "Average Rating",
    fields: ["course","instructor","avg_rating","enrollment","top_feedback"],
    rows: [
      {course:"CS 101: Intro to Programming",instructor:"Dr. Chen",avg_rating:4.7,enrollment:312,top_feedback:"Clear explanations, great office hours"},
      {course:"CS 201: Data Structures",instructor:"Prof. Alvarez",avg_rating:3.9,enrollment:248,top_feedback:"Assignments are too time-consuming"},
      {course:"MATH 150: Calculus I",instructor:"Dr. Park",avg_rating:2.8,enrollment:401,top_feedback:"Lectures are hard to follow; relies on textbook"},
      {course:"PHIL 101: Ethics",instructor:"Prof. Kim",avg_rating:4.5,enrollment:158,top_feedback:"Thought-provoking discussions, fair grading"},
    ],
    allowedKeys: ["rows[].course","rows[].instructor","rows[].avg_rating","rows[].enrollment","rows[].top_feedback"],
    fidelitySamples: [{key:"rows[2].avg_rating",value:"2.8"},{key:"rows[3].top_feedback",value:"Thought-provoking discussions"}],
  },
  {
    id: "ambiguous-query",
    title: "Ambiguous Query",
    fields: ["ticket_id","category","priority","resolution_time_h","notes"],
    rows: [
      {ticket_id:"TKT-1002",category:"Billing",priority:"P2",resolution_time_h:4.2,notes:"Customer says overcharged but invoice shows correct amount. Possibly a display caching issue — unclear."},
      {ticket_id:"TKT-1004",category:"UI",priority:"P3",resolution_time_h:12.0,notes:"Dropdown not appearing on Safari 17.4. Reproduced on 1 of 3 test devices. Might be a WebKit bug, might be our CSS — still investigating."},
      {ticket_id:"TKT-1005",category:"Data Export",priority:"P2",resolution_time_h:2.3,notes:"CSV export missing 3 columns for some users but not others. Same role, same permissions. Root cause unknown — workaround applied."},
      {ticket_id:"TKT-1008",category:"Performance",priority:"P2",resolution_time_h:24.5,notes:"Dashboard loads slow (8-12s) for accounts with >50 projects. Query optimisation reduced to 3s, but N+1 in the project-card component still accounts for 2s — partially resolved."},
    ],
    allowedKeys: ["rows[].ticket_id","rows[].category","rows[].priority","rows[].resolution_time_h","rows[].notes"],
    fidelitySamples: [{key:"rows[2].notes",value:"Root cause unknown"},{key:"rows[3].notes",value:"partially resolved"}],
  },
];

// ─── Mock adapter HTML (the golden HTML from adapters.ts) ─────────
const MOCK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Employee Engagement Survey — Q1 2025</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Sans+SC:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-gray-50 font-sans text-gray-900">
<div class="max-w-6xl mx-auto p-6">
<h1 class="text-3xl font-bold mb-2">Employee Engagement Survey</h1><!-- pf-src: rows[].question -->
<p class="text-gray-500 mb-8">Q1 2025 · 195 responses across 5 departments</p>
<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
  <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
    <div class="text-sm text-gray-500">Avg. Workplace Score</div>
    <div class="text-3xl font-bold text-blue-600">4.26</div>
  </div>
  <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
    <div class="text-sm text-gray-500">Avg. Recognition Score</div>
    <div class="text-3xl font-bold text-amber-600">3.52</div>
  </div>
  <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
    <div class="text-sm text-gray-500">Avg. Growth Score</div>
    <div class="text-3xl font-bold text-red-500">3.00</div>
  </div>
</div>
<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
<table class="w-full text-sm">
<thead class="bg-gray-50 text-left">
<tr>
  <th class="p-3 font-semibold">Department</th>
  <th class="p-3 font-semibold">Question</th>
  <th class="p-3 font-semibold">Category</th>
  <th class="p-3 font-semibold text-right">Score</th>
  <th class="p-3 font-semibold text-right">N</th>
  <th class="p-3 font-semibold">Comment</th>
</tr>
</thead>
<tbody>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Engineering</td><!-- pf-src: rows[].department -->
  <td class="p-3">How satisfied are you with remote work flexibility?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">Workplace</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">4.2</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">87</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Most engineers prefer 3 days remote, 2 in-office</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Engineering</td><!-- pf-src: rows[].department -->
  <td class="p-3">Do you feel your work is recognized?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">Recognition</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">3.1</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">87</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Recognition is inconsistent across teams</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Engineering</td><!-- pf-src: rows[].department -->
  <td class="p-3">How would you rate career growth opportunities?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">Growth</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">2.8</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">87</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Junior engineers want clearer promotion criteria</td><!-- pf-src: rows[].comment -->
</tr>
<tr class="border-t border-gray-100">
  <td class="p-3 font-medium">Design</td><!-- pf-src: rows[].department -->
  <td class="p-3">How satisfied are you with remote work flexibility?</td><!-- pf-src: rows[].question -->
  <td class="p-3"><span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">Workplace</span></td><!-- pf-src: rows[].category -->
  <td class="p-3 text-right font-mono">4.5</td><!-- pf-src: rows[].score -->
  <td class="p-3 text-right text-gray-500">23</td><!-- pf-src: rows[].responses -->
  <td class="p-3 text-gray-600">Design team is fully remote and happy</td><!-- pf-src: rows[].comment -->
</tr>
</tbody>
</table>
</div>
</div>
</body>
</html>`;

// ─── Deep analysis ───────────────────────────────────────────────
function deepAnalyze(rawOutput, generatedHtml, fixture) {
  const hasDoctype = /<!DOCTYPE\s+html/i.test(rawOutput);
  const hasMarkdownFences = /```html|```HTML/.test(rawOutput);
  const firstField = fixture.fields[0];
  let rowsRepresented = 0;
  for (const row of fixture.rows) {
    const idVal = String(row[firstField] ?? "");
    if (idVal && generatedHtml.includes(idVal)) rowsRepresented++;
  }
  const allSourceValues = new Set();
  for (const row of fixture.rows) for (const val of Object.values(row)) allSourceValues.add(String(val));
  const unsupportedClaims = [];
  const numRe = />([\d,]+\.?\d*)\s*(?:<\/|<!--)/g;
  let nm;
  while ((nm = numRe.exec(generatedHtml))) {
    const num = nm[1].replace(/,/g, "");
    if (!allSourceValues.has(num) && !allSourceValues.has(nm[1])) {
      const parsed = parseFloat(num);
      if (!isNaN(parsed) && parsed > 0 && parsed < 1e9) {
        const ctx = generatedHtml.slice(Math.max(0, nm.index - 40), nm.index + 40);
        unsupportedClaims.push(`"${num}" near: ...${ctx.trim()}...`);
      }
    }
  }
  const safeToExport = hasDoctype && !hasMarkdownFences && generatedHtml.length > 100 && rowsRepresented >= fixture.rows.length * 0.5;
  return { hasDoctype, hasMarkdownFences, rowsRepresented, totalRows: fixture.rows.length, unsupportedClaims: unsupportedClaims.slice(0, 5), safeToExport };
}

// ─── Run benchmarks ──────────────────────────────────────────────
console.log("TraceCanvas 0.3.2 — Mock Adapter Benchmark\n");
const allFixtures = [SURVEY_FIXTURE, ...FIXTURES];
const results = [];

for (const fixture of allFixtures) {
  console.log(`\n━━━ ${fixture.id}: ${fixture.title} ━━━`);
  const startedAt = Date.now();
  const rawOutput = MOCK_HTML;
  const generatedHtml = extractHtml(rawOutput);
  const postprocess = postprocessSourceKeys(rawOutput, fixture.allowedKeys);
  const verification = verifyArtifact({
    rawOutput, cleanHtml: generatedHtml, postprocess,
    allowedKeys: fixture.allowedKeys,
    fidelitySamples: fixture.fidelitySamples,
  });
  const deep = deepAnalyze(rawOutput, generatedHtml, fixture);
  const durationMs = Date.now() - startedAt;

  results.push({
    fixture: fixture.id,
    adapter: "mock",
    score: verification.score,
    passed: verification.passed,
    sourceKeyCoverage: postprocess.coverage,
    sourceKeysFound: postprocess.totalComments,
    sourceKeysMissing: postprocess.missingKeys.length,
    sourceKeysInvalid: postprocess.invalidKeys.length,
    rowsRepresented: deep.rowsRepresented,
    totalRows: deep.totalRows,
    hasDoctype: deep.hasDoctype,
    hasMarkdownFences: deep.hasMarkdownFences,
    safeToExport: deep.safeToExport,
    unsupportedClaimsCount: deep.unsupportedClaims.length,
    unsupportedClaimsPreview: deep.unsupportedClaims.slice(0, 3),
    durationMs,
    error: null,
    runAt: new Date().toISOString(),
    rawOutputPreview: rawOutput.slice(0, 500),
  });

  const icon = verification.score >= 90 ? "✓" : verification.score >= 60 ? "△" : "✗";
  console.log(`  ${icon} Score: ${verification.score}/100 (${verification.passed ? "PASS" : "FAIL"})`);
  console.log(`  Source keys: ${postprocess.totalComments} found, ${postprocess.missingKeys.length} missing, ${postprocess.invalidKeys.length} invalid`);
  console.log(`  Coverage: ${Math.round(postprocess.coverage * 100)}%`);
  console.log(`  Rows: ${deep.rowsRepresented}/${deep.totalRows} represented`);
  console.log(`  Safe to export: ${deep.safeToExport ? "YES" : "NO"}`);
  if (postprocess.missingKeys.length) console.log(`  Missing keys: ${postprocess.missingKeys.join(", ")}`);
  if (postprocess.invalidKeys.length) console.log(`  Invalid keys: ${postprocess.invalidKeys.join(", ")}`);
  if (deep.unsupportedClaims.length) console.log(`  Unsupported claims: ${deep.unsupportedClaims.length}`);
}

// ─── Write JSON ──────────────────────────────────────────────────
fs.mkdirSync(RESULTS_DIR, { recursive: true });
fs.writeFileSync(path.join(RESULTS_DIR, "results.json"), JSON.stringify(results, null, 2));
console.log(`\n✓ Results written to ${path.join(RESULTS_DIR, "results.json")}`);

// ─── Summary table ───────────────────────────────────────────────
console.log("\n╔══════════════════════════════════════════════════════════╗");
console.log("║              BENCHMARK SUMMARY TABLE                    ║");
console.log("╠══════════════════════════════════════════════════════════╣");
console.log("║ Fixture               Score  Keys   Rows     Safe       ║");
console.log("╠══════════════════════════════════════════════════════════╣");
for (const r of results) {
  const f = r.fixture.padEnd(22);
  const s = String(r.score).padStart(5);
  const k = String(r.sourceKeysFound).padStart(6);
  const rows = `${r.rowsRepresented}/${r.totalRows}`.padStart(7);
  const safe = r.safeToExport ? " ✓" : " ✗";
  console.log(`║ ${f} ${s} ${k} ${rows} ${safe.padStart(6)} ║`);
}
console.log("╚══════════════════════════════════════════════════════════╝");

// ─── Failure analysis ───────────────────────────────────────────
console.log("\n=== FAILURE ANALYSIS ===");
const failures = results.filter(r => !r.passed);
if (failures.length === 0) {
  console.log("  All passed.");
} else {
  console.log(`  ${failures.length}/${results.length} fixtures failed:`);
  for (const f of failures) {
    console.log(`  - ${f.fixture}: score ${f.score}/100`);
  }
  console.log("\n  Root cause: Mock adapter returns survey-specific golden HTML.");
  console.log("  Non-survey fixtures have different schemas → 0% source-key coverage.");
  console.log("  This is EXPECTED — the mock adapter is a baseline for the survey fixture only.");
}
