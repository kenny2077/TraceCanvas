/**
 * Source-key-aware prompt composer.
 *
 * Builds a prompt that instructs an agent to generate HTML with inline
 * `<!-- pf-src: path -->` annotations tracing each data point back to
 * the structured source input. The annotations enable the verification
 * engine to check content fidelity without trusting the agent.
 *
 * Design constraints:
 *   - Prompt stays under ~3 KB (directives + data + example) to avoid
 *     context pressure on smaller models (Kimi moonshot-v1-8k).
 *   - Rules are explicit and ordered: format → annotations → data fidelity
 *     → output constraints. This matches the instruction-following
 *     prioritisation observed in Claude / DeepSeek / Kimi.
 *   - The example uses the survey fixture's schema so it transfers
 *     directly to real runs.
 */

/** Shape of parsed structured data — fields + rows (CSV/JSON survey format). */
export type SourceData = {
  fields: string[];
  rows: Record<string, unknown>[];
};

export type SourceKeyPromptInput = {
  /** Parsed structured data with fields + rows. */
  sourceData: SourceData;
  /** Allowed source-key paths derived from the schema. */
  allowedKeys: string[];
  /** Optional extra context (e.g. "Employee Engagement Survey Q1 2025"). */
  title?: string;
};

/** Maximum prompt size before data inlining, in bytes. */
export const PROMPT_OVERHEAD_BUDGET = 2_800;

/**
 * Build a source-key-aware prompt.
 *
 * The prompt has 5 sections:
 *   1. Task description
 *   2. Source-key annotation rules
 *   3. Data fidelity rules
 *   4. Output format rules
 *   5. Worked example (using the survey schema)
 *   6. Actual source data
 */
export function buildSourceKeyPrompt(opts: SourceKeyPromptInput): string {
  const { sourceData, allowedKeys, title } = opts;
  const dataJson = JSON.stringify(sourceData, null, 2);

  const prompt = [
    SECTION_TASK,
    SECTION_SOURCE_KEYS(allowedKeys),
    SECTION_DATA_FIDELITY,
    SECTION_OUTPUT_FORMAT,
    SECTION_EXAMPLE,
    `## Source Data${title ? `: ${title}` : ""}\n\n\`\`\`json\n${dataJson}\n\`\`\``,
  ].join("\n\n---\n\n");

  return prompt;
}

const SECTION_TASK = `## Task

Generate a single-file HTML document that visualises the structured survey data below. The document must be self-contained (no external images, fonts via CDN only) and must annotate every data point with a source-key comment.`;

function SECTION_SOURCE_KEYS(keys: readonly string[]): string {
  return `## Source-Key Annotation Rules

Place a source-key comment IMMEDIATELY after each HTML element that displays a value from the source data:

\`\`\`
<!-- pf-src: path.to.field -->
\`\`\`

**Allowed source keys** (only these paths are valid):
${keys.map((k) => `- \`${k}\``).join("\n")}

**Rules:**
- Use EXACTLY the comment format shown above. No variations.
- Do NOT use \`data-pf-source-id\` or any other HTML attribute for source tracing.
- Every displayed fact, number, label, or quote from the source data MUST have a source-key comment.
- A single HTML element can have at most one source-key comment.
- Place the comment on the same line as the closing tag, or on the next line.`;
}

const SECTION_DATA_FIDELITY = `## Data Fidelity Rules

- **Do NOT invent facts.** Every number, label, and quote in the HTML must come from the source data.
- **Do NOT summarise or compress.** If the source data has 15 rows, the HTML must represent all 15 rows.
- **Do NOT use placeholder text.** No "Lorem ipsum", no "Your text here", no "Sample data".
- **Preserve precision.** Numeric scores (e.g. 4.2, 3.1) must appear exactly as given — do not round.
- **Quote exactly.** Comment strings from the source data must appear verbatim in the HTML.`;

const SECTION_OUTPUT_FORMAT = `## Output Format

- Output ONLY raw HTML. The first character must be \`<\`. The last character must be \`>\`.
- Do NOT wrap the HTML in markdown fences (\`\`\`html ... \`\`\`).
- Do NOT include any explanatory text before or after the HTML.
- Do NOT use file-system tools (Write, Edit, Bash, etc.) — stream the HTML directly.
- The document must start with \`<!DOCTYPE html>\` and end with \`</html>\`.
- Include Tailwind CSS via CDN: \`<script src="https://cdn.tailwindcss.com"></script>\`
- Use \`Noto Sans SC\` from Google Fonts for Chinese text, \`Inter\` for English.`;

const SECTION_EXAMPLE = `## Example

Source data:
\`\`\`json
{
  "fields": ["department", "score"],
  "rows": [
    { "department": "Engineering", "score": 4.2 },
    { "department": "Design", "score": 4.5 }
  ]
}
\`\`\`

Correct HTML output (excerpt):
\`\`\`html
<tr>
  <td>Engineering</td><!-- pf-src: rows[].department -->
  <td>4.2</td><!-- pf-src: rows[].score -->
</tr>
<tr>
  <td>Design</td><!-- pf-src: rows[].department -->
  <td>4.5</td><!-- pf-src: rows[].score -->
</tr>
\`\`\`

Note: each \`<td>\` is immediately followed by its source-key comment on the same line. Every row is present. No data is invented or omitted.`;
