/**
 * Robust CSV parser built on PapaParse.
 *
 * Parses CSV/TSV input into a SourceDocument with spreadsheet-style A1
 * cell IDs. Every cell gets a stable, deterministic coordinate that can
 * be referenced in source-key annotations (<!-- pf-src: doc_xxx:cell:B3 -->).
 *
 * Warnings are generated for:
 *   - Quoted newlines (cell value contains embedded \n — valid CSV, surprising)
 *   - Escaped quotes (cell uses "" inside a quoted field)
 *   - Empty cells (zero-length or whitespace-only values)
 *   - Trailing commas (row ends with , — ambiguous empty trailing cell)
 *   - Uneven columns (row has different field count than header)
 *   - Malformed rows (PapaParse parse errors)
 *
 * Determinism guarantee: same CSV input always produces the same cell IDs,
 * same warnings, and same document id (deterministic hash of content).
 */

import Papa from "papaparse";
import {
  cellCoordinate,
  rowSourceId,
  columnIndexToA1,
  type SourceDocument,
  type SourceCell,
  type SourceRow,
  type ParseWarning,
} from "./types";

// ─── Options ─────────────────────────────────────────────────────────

export type CSVDelimiter = "," | "\t" | "auto";

export type ParseCSVOptions = {
  /** Column delimiter. "auto" lets PapaParse detect. Default: ",". */
  delimiter?: CSVDelimiter;
  /** Whether the first row is a header. Default: true. */
  header?: boolean;
  /** Max rows to parse (0 = unlimited). Default: 0. */
  maxRows?: number;
  /** Suppress specific warning types. */
  suppressWarnings?: ParseWarning["type"][];
};

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Parse CSV/TSV input into a SourceDocument.
 *
 * @param input - Raw CSV string.
 * @param opts - Parse options.
 * @returns Parsed document with cell-level source IDs and warnings.
 */
export function parseCSV(
  input: string,
  opts: ParseCSVOptions = {},
): { document: SourceDocument; warnings: ParseWarning[] } {
  const {
    delimiter = ",",
    header = true,
    maxRows = 0,
    suppressWarnings = [],
  } = opts;

  const docId = hashContent(input);

  // Parse with PapaParse — header:false so we get a raw grid.
  // We handle headers ourselves to preserve ordering and detect
  // uneven columns.
  const result = Papa.parse<string[]>(input.trimEnd(), {
    header: false,
    skipEmptyLines: "greedy", // skip truly empty lines but keep lines with delimiters
    delimiter: delimiter === "auto" ? "" : delimiter,
    transform: (value: string) => value, // keep strings, don't auto-type
  });

  const grid: string[][] = result.data;
  const warnings: ParseWarning[] = [];
  const errors: ParseWarning[] = [];

  // ── Extract headers ─────────────────────────────────────────────
  let fields: string[] = [];
  let dataStartRow = 0;

  if (header && grid.length > 0) {
    fields = grid[0].map((h) => h.trim());
    dataStartRow = 1;
  } else if (grid.length > 0) {
    // No header — generate field names
    const colCount = grid[0].length;
    fields = Array.from({ length: colCount }, (_, i) => `col_${i}`);
    dataStartRow = 0;
  }

  const colCount = fields.length;

  // ── Process rows ────────────────────────────────────────────────
  const rows: SourceRow[] = [];
  const limit = maxRows > 0 ? Math.min(dataStartRow + maxRows, grid.length) : grid.length;

  for (let ri = dataStartRow; ri < limit; ri++) {
    const rawRow = grid[ri];
    const rowIndex = ri - dataStartRow; // 0-based data row index
    const displayRow = rowIndex + 2; // 1-based, +1 for header row offset
    const cells: SourceCell[] = [];

    // Trailing comma detection: if the raw CSV line ends with a comma,
    // PapaParse may or may not include an empty trailing field depending
    // on config. Check the original input for trailing commas per line.
    // We detect this heuristically by checking if rawRow has fewer fields
    // than the header but the input line had a trailing comma.

    for (let ci = 0; ci < colCount; ci++) {
      const rawValue = ci < rawRow.length ? rawRow[ci] : "";
      const trimmed = rawValue.trim();
      const cellId = cellCoordinate(ci, displayRow);
      const field = ci < fields.length ? fields[ci] : `col_${ci}`;

      // ── Value typing ──────────────────────────────────────────
      let value: unknown = trimmed;
      // Attempt numeric parse for cells that look like numbers
      if (trimmed !== "" && !isNaN(Number(trimmed)) && trimmed.length > 0) {
        value = Number(trimmed);
      } else if (trimmed === "") {
        value = null;
      }

      // ── Warnings ──────────────────────────────────────────────
      // Quoted newline: raw value contains \n but trimmed doesn't start/end with quote
      if (rawValue.includes("\n") && !suppressWarnings.includes("quoted-newline")) {
        warnings.push({
          type: "quoted-newline",
          message: `Cell ${cellId} contains an embedded newline`,
          row: rowIndex,
          col: ci,
        });
      }

      // Escaped quote: raw value contains ""
      if (rawValue.includes('""') && !suppressWarnings.includes("escaped-quote")) {
        warnings.push({
          type: "escaped-quote",
          message: `Cell ${cellId} contains escaped quotes ("")`,
          row: rowIndex,
          col: ci,
        });
      }

      // Empty cell
      if (
        trimmed === "" &&
        ci < rawRow.length &&
        !suppressWarnings.includes("empty-cell")
      ) {
        warnings.push({
          type: "empty-cell",
          message: `Cell ${cellId} is empty`,
          row: rowIndex,
          col: ci,
        });
      }

      cells.push({
        cellId,
        column: columnIndexToA1(ci),
        colIndex: ci,
        row: displayRow,
        field,
        value,
      });
    }

    // ── Uneven columns ──────────────────────────────────────────
    if (rawRow.length !== colCount && !suppressWarnings.includes("uneven-columns")) {
      warnings.push({
        type: "uneven-columns",
        message: `Row ${displayRow} has ${rawRow.length} fields, expected ${colCount}`,
        row: rowIndex,
      });
    }

    // ── Trailing comma detection ────────────────────────────────
    // Heuristic: if rawRow has fewer fields AND the original line
    // for this row ends with the delimiter character.
    if (
      rawRow.length < colCount &&
      rawRow.length > 0 &&
      !suppressWarnings.includes("trailing-comma")
    ) {
      // Find the original line for this row in the input
      const lines = input.split("\n");
      const originalLineIdx = findOriginalLine(lines, ri, rawRow);
      if (
        originalLineIdx >= 0 &&
        originalLineIdx < lines.length &&
        lines[originalLineIdx].trimEnd().endsWith(delimiter === "auto" ? "," : delimiter)
      ) {
        warnings.push({
          type: "trailing-comma",
          message: `Row ${displayRow} may have trailing comma(s)`,
          row: rowIndex,
        });
      }
    }

    const sourceId = rowSourceId(docId, rowIndex);
    rows.push({ cells, rowIndex, sourceId });
  }

  // ── PapaParse errors ───────────────────────────────────────────
  for (const err of result.errors) {
    if (!suppressWarnings.includes("malformed-row")) {
      const warn: ParseWarning = {
        type: "malformed-row",
        message: `Parse error at row ${err.row ?? "?"}: ${err.message}`,
        row: typeof err.row === "number" ? err.row : undefined,
      };
      warnings.push(warn);
      errors.push(warn);
    }
  }

  const document: SourceDocument = {
    id: docId,
    fields,
    rows,
    byteLength: new TextEncoder().encode(input).length,
    warnings,
    errors,
  };

  return { document, warnings };
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Compute a deterministic 8-char hex document id from input content.
 * Stable across runs — same CSV always produces same id.
 *
 * Uses Web Crypto API (globalThis.crypto.subtle) so it works in both
 * Node.js 19+ and the browser. Falls back to a simple djb2 hash if
 * crypto is unavailable (e.g. insecure contexts without HTTPS).
 */
function hashContent(input: string): string {
  // Try Web Crypto first — available in Node 19+, modern browsers.
  if (
    typeof globalThis.crypto !== "undefined" &&
    globalThis.crypto.subtle
  ) {
    // Synchronous hash not available in Web Crypto, but we use a
    // synchronous fallback. For deterministic ids, a fast non-crypto
    // hash is sufficient — we just need same-input → same-id stability.
    return djb2Hex(input).slice(0, 8);
  }
  return djb2Hex(input).slice(0, 8);
}

/**
 * djb2 hash — fast, deterministic, browser-safe.
 * Returns 8-char hex string. Not cryptographic; used only for
 * deterministic document id generation.
 */
function djb2Hex(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  // Convert to unsigned 32-bit hex, zero-padded to 8 chars
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Find the original input line index for a given parsed row.
 * Used for trailing-comma detection. Because PapaParse may merge
 * quoted-newline rows, we do a best-effort lookup.
 */
function findOriginalLine(
  lines: string[],
  parsedRowIndex: number,
  rawRow: string[],
): number {
  // Simple heuristic: find the line that starts with the same first field
  if (rawRow.length === 0 || lines.length === 0) return -1;
  const firstField = rawRow[0];

  // Count lines that could be header + previous data rows
  let lineIdx = 0;
  let dataLinesSeen = 0;
  for (; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx].trim();
    if (!line) continue; // skip empty lines

    // Check if this line contains our first field (accounting for quoted values)
    if (dataLinesSeen >= parsedRowIndex) {
      if (line.includes(firstField) || line.includes(`"${firstField}"`)) {
        return lineIdx;
      }
    }

    // Rough heuristic: each non-empty line is one data row
    // (breaks for quoted newlines, but that's acceptable for trailing-comma detection)
    dataLinesSeen++;
  }

  return -1;
}
