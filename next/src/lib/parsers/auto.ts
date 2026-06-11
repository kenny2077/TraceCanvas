import Papa from "papaparse";
import { parseCSV } from "../sources/parser";

export type DetectedFormat =
  | "markdown"
  | "html"
  | "json"
  | "csv"
  | "tsv"
  | "sql"
  | "yaml"
  | "text";

export function detectFormat(input: string): DetectedFormat {
  const t = input.trim();
  if (!t) return "text";

  // HTML
  if (/^<!DOCTYPE\s+html/i.test(t) || /^<html[\s>]/i.test(t)) return "html";

  // JSON
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      JSON.parse(t);
      return "json";
    } catch {}
  }

  // SQL
  if (/^\s*(select|insert|update|delete|create|drop|alter|with)\s+/i.test(t)) {
    return "sql";
  }

  // YAML — naive
  if (/^---\s*$/m.test(t.split("\n")[0]) || /^[a-zA-Z_][\w-]*\s*:\s*\S/m.test(t)) {
    if (!/^#{1,6}\s/m.test(t) && !/\|/.test(t.split("\n")[0])) {
      // could be yaml
      const firstLines = t.split("\n").slice(0, 5).join("\n");
      if (/^[a-zA-Z_][\w-]*\s*:/m.test(firstLines)) return "yaml";
    }
  }

  // Markdown — has headings, lists, fences, or links
  if (/^#{1,6}\s+\S/m.test(t)) return "markdown";
  if (/^[*-]\s+\S/m.test(t) && /^[*-]\s+\S/m.test(t.split("\n").slice(1).join("\n"))) return "markdown";
  if (/```[\s\S]*?```/.test(t)) return "markdown";
  if (/!\[[^\]]*\]\([^)]+\)/.test(t)) return "markdown";

  // CSV / TSV — use PapaParse preview to handle quoted commas/newlines correctly.
  // PapaParse's delimitersAndNewlines detector inspects the first few rows
  // and returns the likely delimiter ("," or "\t") if the input looks tabular.
  try {
    const preview = Papa.parse(t.slice(0, 4096), { preview: 5, header: false });
    const previewRows = (preview.data as string[][]).filter(
      (r) => r.length > 1 || (r.length === 1 && r[0] !== ""),
    );
    if (previewRows.length >= 2) {
      // Check delimiter: if most rows have tabs, it's TSV; otherwise CSV.
      const firstRow = previewRows[0];
      const tabDelimited = firstRow.length >= 2 && t.includes("\t");
      if (tabDelimited) return "tsv";
      // At least 2 columns and 2 rows = structured tabular data.
      if (firstRow.length >= 2) return "csv";
    }
  } catch {
    // PapaParse preview can throw on pathological input — fall through.
  }

  return "text";
}

export type ParsedSummary = {
  format: DetectedFormat;
  raw: string;
  /** Human-readable summary you can pass to the AI alongside raw, when raw is huge */
  preview: string;
  /** Optional structured data extracted */
  structured?: unknown;
  /** Source keys that the agent should annotate in output (structured data only) */
  allowedKeys?: string[];
  /** Sample values for content fidelity verification */
  fidelitySamples?: Array<{ key: string; value: string }>;
};

const MAX_RAW_FOR_AGENT = 40_000;

export function summarizeForAgent(input: string): ParsedSummary {
  const format = detectFormat(input);
  const raw = input;
  let preview = "";
  let structured: unknown;
  let allowedKeys: string[] | undefined;
  let fidelitySamples: Array<{ key: string; value: string }> | undefined;

  switch (format) {
    case "csv":
    case "tsv": {
      try {
        const { document: doc } = parseCSV(input, {
          delimiter: format === "tsv" ? "\t" : ",",
          header: true,
          suppressWarnings: [
            "empty-cell",
            "trailing-comma",
            "uneven-columns",
          ],
        });
        // Build backward-compatible structured shape for agent prompts.
        const rows = doc.rows.map((r) => {
          const obj: Record<string, unknown> = {};
          for (const cell of r.cells) {
            obj[cell.field] = cell.value;
          }
          return obj;
        });
        structured = { fields: doc.fields, rows, _sourceDocId: doc.id };

        // Generate allowedKeys for source-key verification
        allowedKeys = doc.fields.map((f) => `rows[].${f}`);

        // Generate fidelity samples (up to 10 cell values)
        const samples: Array<{ key: string; value: string }> = [];
        for (const row of doc.rows.slice(0, 5)) {
          for (const cell of row.cells.slice(0, 2)) {
            if (cell.value != null && cell.value !== "") {
              samples.push({
                key: `${cell.field}_${row.rowIndex}`,
                value: String(cell.value),
              });
            }
          }
        }
        fidelitySamples = samples.slice(0, 10);

        const sampleRows = rows.slice(0, 20);
        const warnNote =
          doc.warnings.length > 0
            ? ` (${doc.warnings.length} 个解析警告)`
            : "";
        preview = [
          `[${format.toUpperCase()}] ${rows.length} 行 × ${doc.fields.length} 列${warnNote}`,
          `字段: ${doc.fields.join(", ")}`,
          `前 ${sampleRows.length} 行 (JSON):`,
          JSON.stringify(sampleRows, null, 2),
        ].join("\n");
      } catch (err) {
        preview = `[${format}] (解析失败: ${err instanceof Error ? err.message : err})`;
      }
      break;
    }
    case "json": {
      try {
        const parsed = JSON.parse(input);
        structured = parsed;
        const pretty = JSON.stringify(parsed, null, 2);
        preview =
          pretty.length > 4000
            ? `[JSON] 截断预览 (完整 ${pretty.length} 字节):\n${pretty.slice(0, 4000)}\n…`
            : `[JSON]\n${pretty}`;

        // Generate allowedKeys from JSON shape (flatten first level)
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
          const firstRow = parsed[0] as Record<string, unknown>;
          allowedKeys = Object.keys(firstRow).map((k) => `rows[].${k}`);
          // Sample values
          const samples: Array<{ key: string; value: string }> = [];
          for (let i = 0; i < Math.min(parsed.length, 5); i++) {
            const row = parsed[i] as Record<string, unknown>;
            for (const key of Object.keys(row).slice(0, 2)) {
              const val = row[key];
              if (val != null && val !== "") {
                samples.push({ key: `${key}_${i}`, value: String(val) });
              }
            }
          }
          fidelitySamples = samples.slice(0, 10);
        } else if (typeof parsed === "object" && parsed !== null) {
          allowedKeys = Object.keys(parsed).map((k) => k);
          const samples: Array<{ key: string; value: string }> = [];
          for (const key of Object.keys(parsed).slice(0, 10)) {
            const val = (parsed as Record<string, unknown>)[key];
            if (val != null && typeof val !== "object") {
              samples.push({ key, value: String(val) });
            }
          }
          fidelitySamples = samples;
        }
      } catch (err) {
        preview = `[JSON 但解析失败]\n${input.slice(0, 1000)}`;
      }
      break;
    }
    case "markdown":
      preview = `[Markdown 文档, ${input.length} 字符]`;
      break;
    case "html":
      preview = `[HTML 文档, ${input.length} 字符]`;
      break;
    case "sql":
      preview = `[SQL 查询/脚本]`;
      break;
    case "yaml":
      preview = `[YAML 配置]`;
      break;
    default:
      preview = `[纯文本, ${input.length} 字符]`;
  }

  // Truncate raw for agent if huge
  let agentRaw = raw;
  if (raw.length > MAX_RAW_FOR_AGENT) {
    agentRaw =
      raw.slice(0, MAX_RAW_FOR_AGENT) +
      `\n\n[...内容过长, 已截断 (${raw.length - MAX_RAW_FOR_AGENT} 字符省略)]`;
  }

  return { format, raw: agentRaw, preview, structured, allowedKeys, fidelitySamples };
}
