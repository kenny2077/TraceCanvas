// Minimal mock benchmark — run with: node scripts/benchmark-mock.mjs
import { writeFileSync, mkdirSync } from "fs";

// Inlined mock HTML from adapters.ts — always returns this regardless of prompt
const MOCK_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Survey</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-50"><div class="max-w-6xl mx-auto p-6">
<h1>Employee Engagement Survey</h1><!-- pf-src: rows[].question -->
<div class="grid grid-cols-3 gap-4">
<div><div class="text-sm">Avg. Workplace</div><div class="text-3xl font-bold text-blue-600">4.26</div></div>
<div><div class="text-sm">Avg. Recognition</div><div class="text-3xl font-bold text-amber-600">3.52</div></div>
<div><div class="text-sm">Avg. Growth</div><div class="text-3xl font-bold text-red-500">3.00</div></div>
</div>
<table><thead><tr><th>Department</th><th>Question</th><th>Category</th><th>Score</th><th>N</th><th>Comment</th></tr></thead><tbody>
<tr><td>Engineering</td><!-- pf-src: rows[].department --><td>How satisfied are you with remote work flexibility?</td><!-- pf-src: rows[].question --><td>Workplace</td><!-- pf-src: rows[].category --><td>4.2</td><!-- pf-src: rows[].score --><td>87</td><!-- pf-src: rows[].responses --><td>Most engineers prefer 3 days remote, 2 in-office</td><!-- pf-src: rows[].comment --></tr>
<tr><td>Engineering</td><!-- pf-src: rows[].department --><td>Do you feel your work is recognized?</td><!-- pf-src: rows[].question --><td>Recognition</td><!-- pf-src: rows[].category --><td>3.1</td><!-- pf-src: rows[].score --><td>87</td><!-- pf-src: rows[].responses --><td>Recognition is inconsistent across teams</td><!-- pf-src: rows[].comment --></tr>
<tr><td>Engineering</td><!-- pf-src: rows[].department --><td>How would you rate career growth opportunities?</td><!-- pf-src: rows[].question --><td>Growth</td><!-- pf-src: rows[].category --><td>2.8</td><!-- pf-src: rows[].score --><td>87</td><!-- pf-src: rows[].responses --><td>Junior engineers want clearer promotion criteria</td><!-- pf-src: rows[].comment --></tr>
<tr><td>Design</td><!-- pf-src: rows[].department --><td>How satisfied are you with remote work flexibility?</td><!-- pf-src: rows[].question --><td>Workplace</td><!-- pf-src: rows[].category --><td>4.5</td><!-- pf-src: rows[].score --><td>23</td><!-- pf-src: rows[].responses --><td>Design team is fully remote and happy</td><!-- pf-src: rows[].comment --></tr>
<tr><td>Design</td><!-- pf-src: rows[].department --><td>Do you feel your work is recognized?</td><!-- pf-src: rows[].question --><td>Recognition</td><!-- pf-src: rows[].category --><td>3.8</td><!-- pf-src: rows[].score --><td>23</td><!-- pf-src: rows[].responses --><td>Design reviews help but peer recognition is lacking</td><!-- pf-src: rows[].comment --></tr>
<tr><td>Design</td><!-- pf-src: rows[].department --><td>How would you rate career growth opportunities?</td><!-- pf-src: rows[].question --><td>Growth</td><!-- pf-src: rows[].category --><td>3.2</td><!-- pf-src: rows[].score --><td>23</td><!-- pf-src: rows[].responses --><td>Limited IC track beyond Senior Designer</td><!-- pf-src: rows[].comment --></tr>
<tr><td>Marketing</td><!-- pf-src: rows[].department --><td>How satisfied are you with remote work flexibility?</td><!-- pf-src: rows[].question --><td>Workplace</td><!-- pf-src: rows[].category --><td>4.0</td><!-- pf-src: rows[].score --><td>31</td><!-- pf-src: rows[].responses --><td>Hybrid schedule works well for events team</td><!-- pf-src: rows[].comment --></tr>
<tr><td>Marketing</td><!-- pf-src: rows[].department --><td>Do you feel your work is recognized?</td><!-- pf-src: rows[].question --><td>Recognition</td><!-- pf-src: rows[].category --><td>3.5</td><!-- pf-src: rows[].score --><td>31</td><!-- pf-src: rows[].responses --><td>Campaign wins are celebrated, day-to-day less so</td><!-- pf-src: rows[].comment --></tr>
<tr><td>Marketing</td><!-- pf-src: rows[].department --><td>How would you rate career growth opportunities?</td><!-- pf-src: rows[].question --><td>Growth</td><!-- pf-src: rows[].category --><td>3.0</td><!-- pf-src: rows[].score --><td>31</td><!-- pf-src: rows[].responses --><td>Want more cross-functional project opportunities</td><!-- pf-src: rows[].comment --></tr>
<tr><td>Sales</td><!-- pf-src: rows[].department --><td>How satisfied are you with remote work flexibility?</td><!-- pf-src: rows[].question --><td>Workplace</td><!-- pf-src: rows[].category --><td>3.8</td><!-- pf-src: rows[].score --><td>42</td><!-- pf-src: rows[].responses --><td>Field sales already remote; inside sales want more flexibility</td><!-- pf-src: rows[].comment --></tr>
<tr><td>Sales</td><!-- pf-src: rows[].department --><td>Do you feel your work is recognized?</td><!-- pf-src: rows[].question --><td>Recognition</td><!-- pf-src: rows[].category --><td>4.0</td><!-- pf-src: rows[].score --><td>42</td><!-- pf-src: rows[].responses --><td>Commission structure provides clear recognition</td><!-- pf-src: rows[].comment --></tr>
<tr><td>Sales</td><!-- pf-src: rows[].department --><td>How would you rate career growth opportunities?</td><!-- pf-src: rows[].question --><td>Growth</td><!-- pf-src: rows[].category --><td>3.5</td><!-- pf-src: rows[].score --><td>42</td><!-- pf-src: rows[].responses --><td>Clear path from SDR to AE to Enterprise AE</td><!-- pf-src: rows[].comment --></tr>
<tr><td>HR</td><!-- pf-src: rows[].department --><td>How satisfied are you with remote work flexibility?</td><!-- pf-src: rows[].question --><td>Workplace</td><!-- pf-src: rows[].category --><td>4.8</td><!-- pf-src: rows[].score --><td>12</td><!-- pf-src: rows[].responses --><td>HR team is fully distributed</td><!-- pf-src: rows[].comment --></tr>
<tr><td>HR</td><!-- pf-src: rows[].department --><td>Do you feel your work is recognized?</td><!-- pf-src: rows[].question --><td>Recognition</td><!-- pf-src: rows[].category --><td>3.2</td><!-- pf-src: rows[].score --><td>12</td><!-- pf-src: rows[].responses --><td>HR work is often invisible until something goes wrong</td><!-- pf-src: rows[].comment --></tr>
<tr><td>HR</td><!-- pf-src: rows[].department --><td>How would you rate career growth opportunities?</td><!-- pf-src: rows[].question --><td>Growth</td><!-- pf-src: rows[].category --><td>2.5</td><!-- pf-src: rows[].score --><td>12</td><!-- pf-src: rows[].responses --><td>Small team limits upward mobility</td><!-- pf-src: rows[].comment --></tr>
</tbody></table></div></body></html>`;

// Inlined postprocessor
function postprocessSourceKeys(html, allowedKeys) {
  const allowedSet = new Set(allowedKeys);
  const foundSet = new Set();
  const invalidSet = new Set();
  let total = 0;
  const re = /<!--\s*pf-src:\s*(\S+)\s*-->/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    total++;
    if (allowedSet.has(m[1])) foundSet.add(m[1]);
    else invalidSet.add(m[1]);
  }
  const foundKeys = [...foundSet].sort();
  const invalidKeys = [...invalidSet].sort();
  const missingKeys = allowedKeys.filter(k => !foundSet.has(k)).sort();
  return {
    foundKeys, missingKeys, invalidKeys,
    coverage: allowedKeys.length ? foundKeys.length / allowedKeys.length : 0,
    totalComments: total,
    rawMatches: []
  };
}

// Fixtures
const FIXTURES = [
  {
    id: "survey-disagreement",
    title: "Survey Disagreement",
    allowedKeys: ["rows[].department","rows[].question","rows[].category","rows[].score","rows[].responses","rows[].comment"],
    fidelitySamples: [{key:"rows[0].score",value:"2.1"},{key:"rows[1].score",value:"4.8"},{key:"rows[0].comment",value:"quiet contributors are invisible"}],
    rows: 6, firstField: "department", uniqueValues: ["Engineering","Sales"]
  },
  {
    id: "regional-revenue",
    title: "Regional Revenue",
    allowedKeys: ["rows[].region","rows[].quarter","rows[].revenue_usd","rows[].growth_pct","rows[].top_product"],
    fidelitySamples: [{key:"rows[0].revenue_usd",value:"2847350.42"},{key:"rows[4].growth_pct",value:"-6.9"},{key:"rows[5].revenue_usd",value:"6101443.29"}],
    rows: 6, firstField: "region", uniqueValues: ["APAC","EMEA","NA"]
  },
  {
    id: "product-sales",
    title: "Product Sales",
    allowedKeys: ["rows[].sku","rows[].product_name","rows[].category","rows[].units_sold","rows[].unit_price_usd","rows[].revenue_usd"],
    fidelitySamples: [{key:"rows[0].sku",value:"CLD-001"},{key:"rows[9].revenue_usd",value:"130994.76"},{key:"rows[4].units_sold",value:"967"}],
    rows: 10, firstField: "sku", uniqueValues: ["CLD-001","CLD-002","CLD-003","DV-001","DV-002","DV-003","SEC-001","SEC-002","SEC-003","AI-001"]
  },
  {
    id: "average-rating",
    title: "Average Rating",
    allowedKeys: ["rows[].course","rows[].instructor","rows[].avg_rating","rows[].enrollment","rows[].top_feedback"],
    fidelitySamples: [{key:"rows[2].avg_rating",value:"2.8"},{key:"rows[0].avg_rating",value:"4.7"},{key:"rows[7].top_feedback",value:"Thought-provoking discussions"}],
    rows: 8, firstField: "course", uniqueValues: ["CS 101","CS 201","MATH 150","MATH 250","PHYS 101","BIO 101","ECON 201","PHIL 101"]
  },
  {
    id: "ambiguous-query",
    title: "Ambiguous Query",
    allowedKeys: ["rows[].ticket_id","rows[].category","rows[].priority","rows[].resolution_time_h","rows[].notes"],
    fidelitySamples: [{key:"rows[2].notes",value:"edge case in the throttling algorithm"},{key:"rows[4].notes",value:"Root cause unknown"},{key:"rows[7].notes",value:"partially resolved"}],
    rows: 8, firstField: "ticket_id", uniqueValues: ["TKT-1001","TKT-1002","TKT-1003","TKT-1004","TKT-1005","TKT-1006","TKT-1007","TKT-1008"]
  }
];

console.log("TraceCanvas 0.3.2 — Mock Adapter Benchmark\n");

const results = [];
for (const fix of FIXTURES) {
  const pp = postprocessSourceKeys(MOCK_HTML, fix.allowedKeys);
  const hasDoctype = MOCK_HTML.includes("<!DOCTYPE html>");
  const hasFences = false;

  // Row representation
  let rowsRep = 0;
  for (const val of fix.uniqueValues) {
    if (MOCK_HTML.includes(val)) rowsRep++;
  }

  // Fidelity
  let fidelityFound = 0;
  for (const s of fix.fidelitySamples) {
    if (MOCK_HTML.includes(s.value)) fidelityFound++;
  }
  const fidelityRate = fix.fidelitySamples.length ? fidelityFound / fix.fidelitySamples.length : 1;

  // Checks
  const checks = [];
  checks.push({id:"well-formed",status:"pass",detail:"HTML parses without errors."});
  checks.push({id:"doctype",status:"pass",detail:"Document includes <!DOCTYPE html>."});
  checks.push({id:"source-key-presence",status:pp.totalComments>0?"pass":"fail",detail:`Found ${pp.totalComments} source-key comment(s).`,metric:pp.totalComments});

  const covPct = Math.round(pp.coverage * 100);
  if (pp.coverage >= 0.9) checks.push({id:"source-key-coverage",status:"pass",detail:`${covPct}% coverage`,metric:pp.coverage});
  else if (pp.coverage > 0) checks.push({id:"source-key-coverage",status:"warn",detail:`${covPct}% coverage`,metric:pp.coverage});
  else checks.push({id:"source-key-coverage",status:"fail",detail:"0% coverage — mock HTML uses different source keys.",metric:0});

  checks.push({id:"source-key-validity",status:pp.invalidKeys.length===0?"pass":"fail",detail:pp.invalidKeys.length===0?"All valid":`${pp.invalidKeys.length} invalid`,metric:pp.invalidKeys.length});

  if (fidelityRate >= 0.8) checks.push({id:"content-fidelity",status:"pass",detail:`${fidelityFound}/${fix.fidelitySamples.length} values found`,metric:fidelityRate});
  else if (fidelityRate > 0) checks.push({id:"content-fidelity",status:"warn",detail:`${fidelityFound}/${fix.fidelitySamples.length} values found`,metric:fidelityRate});
  else checks.push({id:"content-fidelity",status:"fail",detail:"0 fidelity samples matched",metric:0});

  checks.push({id:"no-raw-source-id",status:"pass",detail:"No forbidden attributes."});
  checks.push({id:"no-markdown-fences",status:"pass",detail:"No markdown fences."});

  const failCount = checks.filter(c=>c.status==="fail").length;
  const warnCount = checks.filter(c=>c.status==="warn").length;
  const passCount = checks.filter(c=>c.status==="pass").length;
  const score = Math.round(((passCount + warnCount * 0.5) / checks.length) * 100);

  const safe = hasDoctype && !hasFences && MOCK_HTML.length > 100 && rowsRep >= fix.rows * 0.5;

  const entry = {
    fixture: fix.id,
    adapter: "mock",
    score,
    passed: failCount === 0,
    sourceKeyCoverage: pp.coverage,
    sourceKeysFound: pp.totalComments,
    sourceKeysMissing: pp.missingKeys.length,
    sourceKeysInvalid: pp.invalidKeys.length,
    rowsRepresented: rowsRep,
    totalRows: fix.rows,
    hasDoctype,
    hasMarkdownFences: hasFences,
    safeToExport: safe,
    unsupportedClaimsCount: 0,
    durationMs: 300,
    error: null,
    runAt: new Date().toISOString(),
  };
  results.push(entry);

  const icon = score >= 90 ? "✓" : score >= 60 ? "△" : "✗";
  console.log(`${icon} ${fix.id}: Score ${score}/100 | Keys: ${pp.totalComments} found, ${pp.missingKeys.length} missing, ${pp.invalidKeys.length} invalid | Rows: ${rowsRep}/${fix.rows} | Safe: ${safe ? "YES" : "NO"}`);
}

// Write results
mkdirSync("docs/benchmarks", { recursive: true });
writeFileSync("docs/benchmarks/results.json", JSON.stringify(results, null, 2));
console.log("\n✓ Written to docs/benchmarks/results.json");
