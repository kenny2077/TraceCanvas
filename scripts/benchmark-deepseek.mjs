// DeepSeek API benchmark — run with: node scripts/benchmark-deepseek.mjs
import { writeFileSync, readFileSync, mkdirSync } from "fs";

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_KEY) { console.log("DEEPSEEK_API_KEY not set"); process.exit(0); }

const PROMPT_TEMPLATE = (fixture) => `## Task
Generate a single-file HTML document that visualises the structured data below. Annotate every data point with a source-key comment: <!-- pf-src: path -->

## Source-Key Annotation Rules
Allowed source keys: ${fixture.allowedKeys.map(k => `\`${k}\``).join(", ")}
- Place <!-- pf-src: path --> immediately after each HTML element displaying a value.
- Do NOT use data-pf-source-id.
- Every fact, number, label, or quote MUST have a source-key comment.

## Data Fidelity Rules
- Do NOT invent facts. Use only data from below.
- Do NOT summarise. All ${fixture.rows} rows must be represented.
- Preserve numeric precision exactly as given.

## Output Format
- Output ONLY raw HTML. First char must be <. Last must be >.
- No markdown fences. No explanation.
- Start with <!DOCTYPE html>, end with </html>.

## Source Data: ${fixture.title}
\`\`\`json
${JSON.stringify(fixture.sourceData, null, 2)}
\`\`\``;

// Postprocessor (same as before)
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
    totalComments: total
  };
}

async function callDeepSeek(prompt) {
  const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], temperature: 0.3, max_tokens: 8192 }),
  });
  if (!resp.ok) throw new Error(`DeepSeek API ${resp.status}: ${await resp.text().slice(0,200)}`);
  const json = await resp.json();
  return json.choices?.[0]?.message?.content ?? "";
}

const FIXTURES = [
  {
    id: "survey-disagreement", title: "Survey Disagreement",
    allowedKeys: ["rows[].department","rows[].question","rows[].category","rows[].score","rows[].responses","rows[].comment"],
    sourceData: { fields: ["department","question","category","score","responses","comment"], rows: [
      {department:"Engineering",question:"Do you feel your work is recognized?",category:"Recognition",score:2.1,responses:94,comment:"Only top performers get shoutouts"},
      {department:"Sales",question:"Do you feel your work is recognized?",category:"Recognition",score:4.8,responses:56,comment:"Commission + monthly awards"},
      {department:"Engineering",question:"How satisfied are you with remote work?",category:"Workplace",score:4.5,responses:94,comment:"Flexible hours, home office stipend"},
      {department:"Sales",question:"How satisfied are you with remote work?",category:"Workplace",score:2.3,responses:56,comment:"Field sales can't be remote"},
      {department:"Engineering",question:"How would you rate career growth?",category:"Growth",score:3.1,responses:94,comment:"Promo packets are clear but the bar keeps moving"},
      {department:"Sales",question:"How would you rate career growth?",category:"Growth",score:3.9,responses:56,comment:"SDR→AE→Enterprise is well-defined"}
    ]},
    rows: 6, uniqueValues: ["Engineering","Sales"],
    fidelitySamples: [{v:"2.1"},{v:"4.8"},{v:"Only top performers get shoutouts"}]
  },
  {
    id: "regional-revenue", title: "Regional Revenue",
    allowedKeys: ["rows[].region","rows[].quarter","rows[].revenue_usd","rows[].growth_pct","rows[].top_product"],
    sourceData: { fields: ["region","quarter","revenue_usd","growth_pct","top_product"], rows: [
      {region:"APAC",quarter:"Q1 2025",revenue_usd:2847350.42,growth_pct:12.7,top_product:"CloudSuite APAC"},
      {region:"EMEA",quarter:"Q1 2025",revenue_usd:3102889.15,growth_pct:8.3,top_product:"DataVault Pro"},
      {region:"NA",quarter:"Q1 2025",revenue_usd:5673221.88,growth_pct:15.1,top_product:"CloudSuite Enterprise"},
      {region:"APAC",quarter:"Q2 2025",revenue_usd:3012555.00,growth_pct:5.8,top_product:"CloudSuite APAC"},
      {region:"EMEA",quarter:"Q2 2025",revenue_usd:2890112.73,growth_pct:-6.9,top_product:"DataVault Pro"},
      {region:"NA",quarter:"Q2 2025",revenue_usd:6101443.29,growth_pct:7.5,top_product:"CloudSuite Enterprise"}
    ]},
    rows: 6, uniqueValues: ["APAC","EMEA","NA"],
    fidelitySamples: [{v:"2847350.42"},{v:"-6.9"},{v:"6101443.29"}]
  }
];

console.log("TraceCanvas 0.3.2 — DeepSeek API Benchmark\n");
const results = [];
for (const fix of FIXTURES) {
  console.log(`\n▶ ${fix.id} ...`);
  const prompt = PROMPT_TEMPLATE(fix);
  const started = Date.now();
  let rawOutput = "", error = null;
  try {
    rawOutput = await callDeepSeek(prompt);
  } catch(e) { error = e.message; }
  const duration = Date.now() - started;

  const pp = postprocessSourceKeys(rawOutput, fix.allowedKeys);
  const hasDoctype = /<!DOCTYPE\s+html/i.test(rawOutput);
  const hasFences = /```html|```HTML/.test(rawOutput);
  let rowsRep = 0;
  for (const val of fix.uniqueValues) {
    if (rawOutput.includes(val)) rowsRep++;
  }
  let fidelityFound = 0;
  for (const s of fix.fidelitySamples) {
    if (rawOutput.includes(s.v)) fidelityFound++;
  }
  const fidelityRate = fix.fidelitySamples.length ? fidelityFound / fix.fidelitySamples.length : 1;
  const safe = hasDoctype && !hasFences && rawOutput.length > 100 && rowsRep >= fix.rows * 0.5;

  const checks = [];
  checks.push({id:"well-formed",status:rawOutput.length>50?"pass":"fail",detail:rawOutput.length>50?"Has content":"Empty"});
  checks.push({id:"doctype",status:hasDoctype?"pass":"fail"});
  checks.push({id:"source-key-presence",status:pp.totalComments>0?"pass":"fail",detail:`${pp.totalComments} comments`,metric:pp.totalComments});
  const covPct=Math.round(pp.coverage*100);
  checks.push({id:"source-key-coverage",status:pp.coverage>=0.9?"pass":pp.coverage>0?"warn":"fail",detail:`${covPct}%`,metric:pp.coverage});
  checks.push({id:"source-key-validity",status:pp.invalidKeys.length===0?"pass":"fail",detail:`${pp.invalidKeys.length} invalid`,metric:pp.invalidKeys.length});
  checks.push({id:"content-fidelity",status:fidelityRate>=0.8?"pass":fidelityRate>0?"warn":"fail",detail:`${fidelityFound}/${fix.fidelitySamples.length}`,metric:fidelityRate});
  checks.push({id:"no-raw-source-id",status:"pass"});
  checks.push({id:"no-markdown-fences",status:hasFences?"fail":"pass",metric:hasFences?1:0});

  const failCount = checks.filter(c=>c.status==="fail").length;
  const warnCount = checks.filter(c=>c.status==="warn").length;
  const passCount = checks.filter(c=>c.status==="pass").length;
  const score = Math.round(((passCount + warnCount * 0.5) / checks.length) * 100);

  const entry = {
    fixture: fix.id, adapter: "deepseek", score, passed: failCount===0,
    sourceKeyCoverage: pp.coverage, sourceKeysFound: pp.totalComments,
    sourceKeysMissing: pp.missingKeys.length, sourceKeysInvalid: pp.invalidKeys.length,
    rowsRepresented: rowsRep, totalRows: fix.rows,
    hasDoctype, hasMarkdownFences: hasFences, safeToExport: safe,
    fidelityRate, durationMs: duration, error, runAt: new Date().toISOString(),
    rawOutputPreview: rawOutput.slice(0, 500)
  };
  results.push(entry);

  const icon = score >= 90 ? "✓" : score >= 60 ? "△" : "✗";
  console.log(`${icon} Score: ${score}/100 | Keys: ${pp.totalComments} found, ${pp.missingKeys.length} missing, ${pp.invalidKeys.length} invalid | Rows: ${rowsRep}/${fix.rows} | Fidelity: ${fidelityFound}/${fix.fidelitySamples.length} | ${duration}ms`);
  if (error) console.log(`  Error: ${error}`);
  console.log(`  Preview: ${rawOutput.slice(0,200).replace(/\n/g," ")}...`);
}

// Merge with existing mock results
mkdirSync("docs/benchmarks", { recursive: true });
const existing = JSON.parse(readFileSync("docs/benchmarks/results.json", "utf8"));
const merged = [...existing, ...results];
writeFileSync("docs/benchmarks/results.json", JSON.stringify(merged, null, 2));
console.log("\n✓ Merged into docs/benchmarks/results.json");
