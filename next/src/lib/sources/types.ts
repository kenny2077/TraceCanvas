/**
 * Source document types for TraceCanvas CSV parsing.
 *
 * Defines the SourceDocument / SourceCell model with spreadsheet-style
 * A1 cell IDs. Every cell in a parsed CSV gets a stable, deterministic
 * cell ID that can be referenced in source-key annotations and
 * verification reports.
 *
 * A1 coordinate scheme (1-based rows, A-ZZ columns):
 *   - Cell:  {docId}:cell:B3
 *   - Row:   {docId}:row:2
 *   - Range: {docId}:cell:A1:F6
 */

// ─── A1 Coordinate Helpers ──────────────────────────────────────────

const A_CHAR_CODE = "A".charCodeAt(0);

/**
 * Convert a 0-based column index to an A1-style column label.
 *   0 → "A", 25 → "Z", 26 → "AA", 701 → "ZZ".
 */
export function columnIndexToA1(index: number): string {
  if (index < 0) return "";
  let n = index;
  let result = "";
  do {
    result = String.fromCharCode(A_CHAR_CODE + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

/**
 * Build a cell coordinate string: "B3", "AA12".
 */
export function cellCoordinate(columnIndex: number, row: number): string {
  return `${columnIndexToA1(columnIndex)}${row}`;
}

// ─── Source Document Types ──────────────────────────────────────────

export type ParseWarning = {
  /** Warning category for filtering / reporting. */
  type:
    | "quoted-newline"   // cell value contains embedded newline (valid CSV, surprising)
    | "escaped-quote"    // cell uses "" to escape a literal quote
    | "empty-cell"       // cell has zero-length value
    | "trailing-comma"   // row ends with a comma (ambiguous trailing empty cell)
    | "uneven-columns"   // row has different number of fields than header
    | "malformed-row";   // PapaParse reported a parse error on this row
  /** Human-readable description. */
  message: string;
  /** 0-based row index where the warning applies (undefined if global). */
  row?: number;
  /** 0-based column index (undefined if row-level). */
  col?: number;
};

export type SourceCell = {
  /** Stable cell coordinate: "B3", "AA12". */
  cellId: string;
  /** A1 column label: "B", "AA". */
  column: string;
  /** 0-based column index. */
  colIndex: number;
  /** 1-based row number. */
  row: number;
  /** Column header name for this cell's column (from the first row). */
  field: string;
  /** The parsed cell value (string, number, boolean, or null for empty). */
  value: unknown;
};

export type SourceRow = {
  /** Cells in column order. */
  cells: SourceCell[];
  /** 0-based row index (0 = header, data rows start at 1). */
  rowIndex: number;
  /** Source ID for the entire row: `doc_xxx:row:2`. */
  sourceId: string;
};

export type SourceDocument = {
  /** Unique document id — deterministic hash of content. */
  id: string;
  /** Column headers from the first row. */
  fields: string[];
  /** Data rows (excluding the header row). */
  rows: SourceRow[];
  /** Total byte length of the input. */
  byteLength: number;
  /** All parser warnings. */
  warnings: ParseWarning[];
  /** PapaParse-reported errors (rows that couldn't be parsed). */
  errors: ParseWarning[];
};

// ─── Source ID Builders ─────────────────────────────────────────────

/**
 * Build a cell-level source ID: `{docId}:cell:B3`.
 */
export function cellSourceId(docId: string, cell: SourceCell): string {
  return `${docId}:cell:${cell.cellId}`;
}

/**
 * Build a row-level source ID: `{docId}:row:2`.
 */
export function rowSourceId(docId: string, rowIndex: number): string {
  return `${docId}:row:${rowIndex + 1}`;
}

/**
 * Build a range source ID: `{docId}:cell:A1:F6`.
 */
export function rangeSourceId(
  docId: string,
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
): string {
  return `${docId}:cell:${cellCoordinate(startCol, startRow)}:${cellCoordinate(endCol, endRow)}`;
}
