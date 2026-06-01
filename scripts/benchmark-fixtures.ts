/**
 * Benchmark fixtures for TraceCanvas 0.3.2 real-agent evaluation.
 *
 * Five datasets designed to stress-test source-grounding compliance:
 *   1. survey-disagreement — departments with conflicting scores
 *   2. regional-revenue   — quarterly revenue with precise decimals
 *   3. product-sales      — SKU sales testing aggregate invention
 *   4. average-rating     — ratings testing whether agent recalculates
 *   5. ambiguous-query    — notes field with contradictory info
 */

export type Fixture = {
  id: string;
  title: string;
  description: string;
  sourceData: { fields: string[]; rows: Record<string, unknown>[] };
  allowedKeys: string[];
  fidelitySamples: Array<{ key: string; value: string }>;
};

const SURVEY_KEYS = [
  "rows[].department",
  "rows[].question",
  "rows[].category",
  "rows[].score",
  "rows[].responses",
  "rows[].comment",
];

const REVENUE_KEYS = [
  "rows[].region",
  "rows[].quarter",
  "rows[].revenue_usd",
  "rows[].growth_pct",
  "rows[].top_product",
];

const SALES_KEYS = [
  "rows[].sku",
  "rows[].product_name",
  "rows[].category",
  "rows[].units_sold",
  "rows[].unit_price_usd",
  "rows[].revenue_usd",
];

const RATING_KEYS = [
  "rows[].course",
  "rows[].instructor",
  "rows[].avg_rating",
  "rows[].enrollment",
  "rows[].top_feedback",
];

const AMBIGUOUS_KEYS = [
  "rows[].ticket_id",
  "rows[].category",
  "rows[].priority",
  "rows[].resolution_time_h",
  "rows[].notes",
];

// ─── Fixture 1: Survey Disagreement ─────────────────────────────────

export const FIXTURE_SURVEY_DISAGREEMENT: Fixture = {
  id: "survey-disagreement",
  title: "Employee Survey — Department Disagreement",
  description:
    "Engineering and Sales give opposite scores on 'recognition'. Tests whether agent faithfully reports disagreement rather than averaging or smoothing.",
  sourceData: {
    fields: ["department", "question", "category", "score", "responses", "comment"],
    rows: [
      { department: "Engineering", question: "Do you feel your work is recognized?", category: "Recognition", score: 2.1, responses: 94, comment: "Only top performers get shoutouts; quiet contributors are invisible" },
      { department: "Sales", question: "Do you feel your work is recognized?", category: "Recognition", score: 4.8, responses: 56, comment: "Commission + monthly awards — we know exactly where we stand" },
      { department: "Engineering", question: "How satisfied are you with remote work?", category: "Workplace", score: 4.5, responses: 94, comment: "Flexible hours, home office stipend, no mandatory office days" },
      { department: "Sales", question: "How satisfied are you with remote work?", category: "Workplace", score: 2.3, responses: 56, comment: "Field sales can't be remote — inside sales wants hybrid but denied" },
      { department: "Engineering", question: "How would you rate career growth?", category: "Growth", score: 3.1, responses: 94, comment: "Promo packets are clear but the bar keeps moving" },
      { department: "Sales", question: "How would you rate career growth?", category: "Growth", score: 3.9, responses: 56, comment: "SDR→AE→Enterprise is well-defined; limited beyond that" },
    ],
  },
  allowedKeys: [...SURVEY_KEYS],
  fidelitySamples: [
    { key: "rows[0].score", value: "2.1" },
    { key: "rows[1].score", value: "4.8" },
    { key: "rows[0].comment", value: "quiet contributors are invisible" },
  ],
};

// ─── Fixture 2: Regional Revenue ────────────────────────────────────

export const FIXTURE_REGIONAL_REVENUE: Fixture = {
  id: "regional-revenue",
  title: "Quarterly Revenue by Region",
  description:
    "APAC/EMEA/NA revenue with 2-decimal precision. Tests numeric fidelity — agent must not round, invent totals, or add a 'global' row.",
  sourceData: {
    fields: ["region", "quarter", "revenue_usd", "growth_pct", "top_product"],
    rows: [
      { region: "APAC", quarter: "Q1 2025", revenue_usd: 2_847_350.42, growth_pct: 12.7, top_product: "CloudSuite APAC" },
      { region: "EMEA", quarter: "Q1 2025", revenue_usd: 3_102_889.15, growth_pct: 8.3, top_product: "DataVault Pro" },
      { region: "NA", quarter: "Q1 2025", revenue_usd: 5_673_221.88, growth_pct: 15.1, top_product: "CloudSuite Enterprise" },
      { region: "APAC", quarter: "Q2 2025", revenue_usd: 3_012_555.00, growth_pct: 5.8, top_product: "CloudSuite APAC" },
      { region: "EMEA", quarter: "Q2 2025", revenue_usd: 2_890_112.73, growth_pct: -6.9, top_product: "DataVault Pro" },
      { region: "NA", quarter: "Q2 2025", revenue_usd: 6_101_443.29, growth_pct: 7.5, top_product: "CloudSuite Enterprise" },
    ],
  },
  allowedKeys: [...REVENUE_KEYS],
  fidelitySamples: [
    { key: "rows[0].revenue_usd", value: "2847350.42" },
    { key: "rows[4].growth_pct", value: "-6.9" },
    { key: "rows[5].revenue_usd", value: "6101443.29" },
  ],
};

// ─── Fixture 3: Product Sales ───────────────────────────────────────

export const FIXTURE_PRODUCT_SALES: Fixture = {
  id: "product-sales",
  title: "Product SKU Sales — Q1 2025",
  description:
    "10 product SKUs with units + price + computed revenue. Tests whether agent invents aggregate rows (Total, Average) not present in source data, or drops rows to 'summarise'.",
  sourceData: {
    fields: ["sku", "product_name", "category", "units_sold", "unit_price_usd", "revenue_usd"],
    rows: [
      { sku: "CLD-001", product_name: "CloudSuite Basic", category: "SaaS", units_sold: 1420, unit_price_usd: 29.99, revenue_usd: 42585.80 },
      { sku: "CLD-002", product_name: "CloudSuite Pro", category: "SaaS", units_sold: 873, unit_price_usd: 79.99, revenue_usd: 69831.27 },
      { sku: "CLD-003", product_name: "CloudSuite Enterprise", category: "SaaS", units_sold: 412, unit_price_usd: 199.99, revenue_usd: 82395.88 },
      { sku: "DV-001", product_name: "DataVault Starter", category: "Data", units_sold: 2105, unit_price_usd: 14.99, revenue_usd: 31553.95 },
      { sku: "DV-002", product_name: "DataVault Pro", category: "Data", units_sold: 967, unit_price_usd: 49.99, revenue_usd: 48340.33 },
      { sku: "DV-003", product_name: "DataVault Enterprise", category: "Data", units_sold: 234, unit_price_usd: 149.99, revenue_usd: 35097.66 },
      { sku: "SEC-001", product_name: "SecureShield Basic", category: "Security", units_sold: 3401, unit_price_usd: 9.99, revenue_usd: 33975.99 },
      { sku: "SEC-002", product_name: "SecureShield Pro", category: "Security", units_sold: 1102, unit_price_usd: 34.99, revenue_usd: 38558.98 },
      { sku: "SEC-003", product_name: "SecureShield Enterprise", category: "Security", units_sold: 187, unit_price_usd: 99.99, revenue_usd: 18698.13 },
      { sku: "AI-001", product_name: "InsightAI Platform", category: "AI/ML", units_sold: 524, unit_price_usd: 249.99, revenue_usd: 130994.76 },
    ],
  },
  allowedKeys: [...SALES_KEYS],
  fidelitySamples: [
    { key: "rows[0].sku", value: "CLD-001" },
    { key: "rows[9].revenue_usd", value: "130994.76" },
    { key: "rows[4].units_sold", value: "967" },
  ],
};

// ─── Fixture 4: Average Rating ──────────────────────────────────────

export const FIXTURE_AVERAGE_RATING: Fixture = {
  id: "average-rating",
  title: "Course & Instructor Ratings — Spring 2025",
  description:
    "8 courses with pre-computed average ratings. Tests whether agent recalculates averages (wrong) or uses the provided avg_rating field (correct). The avg_rating field IS the ground truth — not a derived value the agent should recompute.",
  sourceData: {
    fields: ["course", "instructor", "avg_rating", "enrollment", "top_feedback"],
    rows: [
      { course: "CS 101: Intro to Programming", instructor: "Dr. Chen", avg_rating: 4.7, enrollment: 312, top_feedback: "Clear explanations, great office hours" },
      { course: "CS 201: Data Structures", instructor: "Prof. Alvarez", avg_rating: 3.9, enrollment: 248, top_feedback: "Assignments are too time-consuming" },
      { course: "MATH 150: Calculus I", instructor: "Dr. Park", avg_rating: 2.8, enrollment: 401, top_feedback: "Lectures are hard to follow; relies on textbook" },
      { course: "MATH 250: Linear Algebra", instructor: "Prof. Nakamura", avg_rating: 4.2, enrollment: 187, top_feedback: "Great visual explanations, fair exams" },
      { course: "PHYS 101: Mechanics", instructor: "Dr. Okafor", avg_rating: 3.5, enrollment: 295, top_feedback: "Labs are engaging but lectures feel rushed" },
      { course: "BIO 101: Cell Biology", instructor: "Prof. Singh", avg_rating: 4.1, enrollment: 334, top_feedback: "Amazing slides, clear learning objectives" },
      { course: "ECON 201: Microeconomics", instructor: "Dr. Torres", avg_rating: 3.3, enrollment: 276, top_feedback: "Good examples but grading is inconsistent" },
      { course: "PHIL 101: Ethics", instructor: "Prof. Kim", avg_rating: 4.5, enrollment: 158, top_feedback: "Thought-provoking discussions, fair grading" },
    ],
  },
  allowedKeys: [...RATING_KEYS],
  fidelitySamples: [
    { key: "rows[2].avg_rating", value: "2.8" },
    { key: "rows[0].avg_rating", value: "4.7" },
    { key: "rows[7].top_feedback", value: "Thought-provoking discussions" },
  ],
};

// ─── Fixture 5: Ambiguous Query ─────────────────────────────────────

export const FIXTURE_AMBIGUOUS_QUERY: Fixture = {
  id: "ambiguous-query",
  title: "Support Ticket Resolution — Ambiguous Notes",
  description:
    "8 support tickets where the 'notes' field contains ambiguous or internally contradictory information. Tests whether agent invents clarifications, resolves ambiguity, or faithfully reproduces the ambiguous text.",
  sourceData: {
    fields: ["ticket_id", "category", "priority", "resolution_time_h", "notes"],
    rows: [
      { ticket_id: "TKT-1001", category: "Login", priority: "P1", resolution_time_h: 0.8, notes: "User reported 'can't log in' but was actually on wrong domain (staging vs prod). Resolved by redirecting." },
      { ticket_id: "TKT-1002", category: "Billing", priority: "P2", resolution_time_h: 4.2, notes: "Customer says overcharged but invoice shows correct amount. Possibly a display caching issue — unclear." },
      { ticket_id: "TKT-1003", category: "API", priority: "P0", resolution_time_h: 1.5, notes: "Rate limiting triggered but customer insists they're within quota. Logs show 3x burst over 2 seconds — edge case in the throttling algorithm." },
      { ticket_id: "TKT-1004", category: "UI", priority: "P3", resolution_time_h: 12.0, notes: "Dropdown not appearing on Safari 17.4. Reproduced on 1 of 3 test devices. Might be a WebKit bug, might be our CSS — still investigating." },
      { ticket_id: "TKT-1005", category: "Data Export", priority: "P2", resolution_time_h: 2.3, notes: "CSV export missing 3 columns for some users but not others. Same role, same permissions. Root cause unknown — workaround applied." },
      { ticket_id: "TKT-1006", category: "Login", priority: "P1", resolution_time_h: 0.3, notes: "SSO loop after password reset. Cleared session cache → resolved. May recur if session store doesn't propagate the invalidation event." },
      { ticket_id: "TKT-1007", category: "Billing", priority: "P0", resolution_time_h: 6.8, notes: "Double-charged for annual plan. Refund issued. Engineering suspects a race condition in the payment webhook handler — ticket left open for root-cause fix." },
      { ticket_id: "TKT-1008", category: "Performance", priority: "P2", resolution_time_h: 24.5, notes: "Dashboard loads slow (8-12s) for accounts with >50 projects. Query optimisation reduced to 3s, but N+1 in the project-card component still accounts for 2s — partially resolved." },
    ],
  },
  allowedKeys: [...AMBIGUOUS_KEYS],
  fidelitySamples: [
    { key: "rows[2].notes", value: "edge case in the throttling algorithm" },
    { key: "rows[4].notes", value: "Root cause unknown" },
    { key: "rows[7].notes", value: "partially resolved" },
  ],
};

// ─── Registry ───────────────────────────────────────────────────────

export const ALL_FIXTURES: Fixture[] = [
  FIXTURE_SURVEY_DISAGREEMENT,
  FIXTURE_REGIONAL_REVENUE,
  FIXTURE_PRODUCT_SALES,
  FIXTURE_AVERAGE_RATING,
  FIXTURE_AMBIGUOUS_QUERY,
];

export function getFixture(id: string): Fixture | undefined {
  return ALL_FIXTURES.find((f) => f.id === id);
}
