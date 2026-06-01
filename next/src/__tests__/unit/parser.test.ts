import { describe, expect, it } from "vitest";
import { parseCSV } from "../../lib/sources/parser";
import {
  columnIndexToA1,
  cellCoordinate,
  cellSourceId,
  rowSourceId,
  rangeSourceId,
} from "../../lib/sources/types";

// ─── A1 Coordinate Helpers ──────────────────────────────────────────

describe("columnIndexToA1", () => {
  it("0 → A", () => expect(columnIndexToA1(0)).toBe("A"));
  it("25 → Z", () => expect(columnIndexToA1(25)).toBe("Z"));
  it("26 → AA", () => expect(columnIndexToA1(26)).toBe("AA"));
  it("27 → AB", () => expect(columnIndexToA1(27)).toBe("AB"));
  it("51 → AZ", () => expect(columnIndexToA1(51)).toBe("AZ"));
  it("52 → BA", () => expect(columnIndexToA1(52)).toBe("BA"));
  it("701 → ZZ", () => expect(columnIndexToA1(701)).toBe("ZZ"));
  it("702 → AAA", () => expect(columnIndexToA1(702)).toBe("AAA"));
});

describe("cellCoordinate", () => {
  it("column 0, row 1 → A1", () => expect(cellCoordinate(0, 1)).toBe("A1"));
  it("column 1, row 3 → B3", () => expect(cellCoordinate(1, 3)).toBe("B3"));
  it("column 26, row 12 → AA12", () => expect(cellCoordinate(26, 12)).toBe("AA12"));
});

describe("source ID builders", () => {
  it("cell source id", () => {
    expect(cellSourceId("doc_a1b2", { cellId: "B3" } as any)).toBe("doc_a1b2:cell:B3");
  });
  it("row source id", () => {
    expect(rowSourceId("doc_a1b2", 1)).toBe("doc_a1b2:row:2");
  });
  it("range source id", () => {
    expect(rangeSourceId("doc_a1b2", 0, 1, 5, 4)).toBe("doc_a1b2:cell:A1:F4");
  });
});

// ─── Basic CSV Parsing ──────────────────────────────────────────────

describe("parseCSV — basic", () => {
  const csv = "name,age,city\nAlice,30,NYC\nBob,25,LA";
  const { document: doc } = parseCSV(csv);

  it("parses correct number of rows", () => {
    expect(doc.rows).toHaveLength(2);
  });

  it("extracts headers", () => {
    expect(doc.fields).toEqual(["name", "age", "city"]);
  });

  it("creates stable document id", () => {
    expect(doc.id).toHaveLength(8);
    // Same input → same id
    const { document: doc2 } = parseCSV(csv);
    expect(doc2.id).toBe(doc.id);
  });

  it("generates A1 cell IDs", () => {
    expect(doc.rows[0].cells[0].cellId).toBe("A2"); // first data row, row 2
    expect(doc.rows[0].cells[1].cellId).toBe("B2");
    expect(doc.rows[1].cells[2].cellId).toBe("C3");
  });

  it("preserves field names per cell", () => {
    expect(doc.rows[0].cells[0].field).toBe("name");
    expect(doc.rows[0].cells[1].field).toBe("age");
    expect(doc.rows[0].cells[2].field).toBe("city");
  });

  it("parses numeric values as numbers", () => {
    expect(doc.rows[0].cells[1].value).toBe(30);
    expect(doc.rows[1].cells[1].value).toBe(25);
  });

  it("generates row-level source IDs", () => {
    expect(doc.rows[0].sourceId).toMatch(/^[a-f0-9]{8}:row:1$/);
    expect(doc.rows[1].sourceId).toMatch(/^[a-f0-9]{8}:row:2$/);
  });

  it("no warnings on clean CSV", () => {
    expect(doc.warnings).toHaveLength(0);
  });
});

// ─── Quoted Comma ────────────────────────────────────────────────────

describe("parseCSV — quoted comma", () => {
  const csv = `name,age\n"Guo, Kenny",42\n"Smith, Jane",28`;
  const { document: doc, warnings } = parseCSV(csv);

  it("does not split on quoted comma", () => {
    expect(doc.rows).toHaveLength(2);
    expect(doc.fields).toEqual(["name", "age"]);
  });

  it("preserves value with comma", () => {
    expect(doc.rows[0].cells[0].value).toBe("Guo, Kenny");
    expect(doc.rows[1].cells[0].value).toBe("Smith, Jane");
  });

  it("no uneven-columns warning", () => {
    const uneven = warnings.filter((w) => w.type === "uneven-columns");
    expect(uneven).toHaveLength(0);
  });
});

// ─── Quoted Newline ──────────────────────────────────────────────────

describe("parseCSV — quoted newline", () => {
  const csv = `desc,count\n"line one\nline two",5\nplain,3`;
  const { document: doc, warnings } = parseCSV(csv);

  it("preserves embedded newline in cell", () => {
    expect(doc.rows[0].cells[0].value).toBe("line one\nline two");
  });

  it("emits quoted-newline warning", () => {
    const qn = warnings.filter((w) => w.type === "quoted-newline");
    expect(qn.length).toBeGreaterThanOrEqual(1);
    expect(qn[0].message).toContain("embedded newline");
  });

  it("parses correct number of rows", () => {
    expect(doc.rows).toHaveLength(2);
  });
});

// ─── Escaped Quotes ──────────────────────────────────────────────────

describe("parseCSV — escaped quotes", () => {
  const csv = `name,quote\nAlice,"He said ""hello"" to me"\nBob,no quotes`;
  const { document: doc, warnings } = parseCSV(csv);

  it("preserves literal quotes", () => {
    expect(doc.rows[0].cells[1].value).toBe('He said "hello" to me');
  });

  it("emits escaped-quote warning", () => {
    const eq = warnings.filter((w) => w.type === "escaped-quote");
    expect(eq.length).toBeGreaterThanOrEqual(1);
  });

  it("parses unquoted cells normally", () => {
    expect(doc.rows[1].cells[1].value).toBe("no quotes");
  });
});

// ─── Empty Cells ─────────────────────────────────────────────────────

describe("parseCSV — empty cells", () => {
  const csv = `a,b,c\n1,,3\n,2,\n4,5,6`;
  const { document: doc, warnings } = parseCSV(csv);

  it("null for empty cells", () => {
    expect(doc.rows[0].cells[1].value).toBeNull();
    expect(doc.rows[1].cells[0].value).toBeNull();
    expect(doc.rows[1].cells[2].value).toBeNull();
  });

  it("emits empty-cell warnings", () => {
    const ec = warnings.filter((w) => w.type === "empty-cell");
    expect(ec.length).toBeGreaterThanOrEqual(3);
  });

  it("non-empty cells parse normally", () => {
    expect(doc.rows[0].cells[0].value).toBe(1);
    expect(doc.rows[0].cells[2].value).toBe(3);
    expect(doc.rows[2].cells[0].value).toBe(4);
  });
});

// ─── Survey Fixture Compatibility ────────────────────────────────────

describe("parseCSV — survey fixture", () => {
  const csv = `department,question,category,score,responses,comment
Engineering,"How satisfied are you with remote work flexibility?",Workplace,4.2,87,"Most engineers prefer 3 days remote, 2 in-office"
Design,"How satisfied are you with remote work flexibility?",Workplace,4.5,23,"Design team is fully remote and happy"`;
  const { document: doc } = parseCSV(csv);

  it("parses 2 rows", () => {
    expect(doc.rows).toHaveLength(2);
  });

  it("extracts 6 fields", () => {
    expect(doc.fields).toEqual([
      "department",
      "question",
      "category",
      "score",
      "responses",
      "comment",
    ]);
  });

  it("parses numeric score", () => {
    expect(doc.rows[0].cells[3].value).toBe(4.2);
  });

  it("parses numeric responses", () => {
    expect(doc.rows[0].cells[4].value).toBe(87);
  });

  it("preserves quoted comment with commas", () => {
    expect(doc.rows[0].cells[5].value).toBe(
      "Most engineers prefer 3 days remote, 2 in-office",
    );
  });

  it("generates stable cell IDs for all cells", () => {
    const ids = doc.rows.flatMap((r) => r.cells.map((c) => c.cellId));
    expect(ids).toEqual(["A2", "B2", "C2", "D2", "E2", "F2", "A3", "B3", "C3", "D3", "E3", "F3"]);
  });
});

// ─── TSV Parsing ─────────────────────────────────────────────────────

describe("parseCSV — TSV", () => {
  const tsv = `name\tage\tcity\nAlice\t30\tNYC\nBob\t25\tLA`;
  const { document: doc } = parseCSV(tsv, { delimiter: "\t" });

  it("parses tab-delimited data", () => {
    expect(doc.fields).toEqual(["name", "age", "city"]);
    expect(doc.rows).toHaveLength(2);
    expect(doc.rows[0].cells[0].value).toBe("Alice");
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────────

describe("parseCSV — edge cases", () => {
  it("handles empty input gracefully", () => {
    const { document: doc, warnings } = parseCSV("");
    expect(doc.fields).toHaveLength(0);
    expect(doc.rows).toHaveLength(0);
  });

  it("handles single-row CSV (header only, no data)", () => {
    const { document: doc } = parseCSV("name,age,city");
    expect(doc.fields).toEqual(["name", "age", "city"]);
    expect(doc.rows).toHaveLength(0);
  });

  it("handles single data row (header + 1 row)", () => {
    const { document: doc } = parseCSV("name,age\nAlice,30");
    expect(doc.rows).toHaveLength(1);
    expect(doc.rows[0].cells[0].value).toBe("Alice");
  });

  it("detects uneven columns", () => {
    const { document: doc, warnings } = parseCSV("a,b,c\n1,2\n3,4,5,6");
    const uneven = warnings.filter((w) => w.type === "uneven-columns");
    expect(uneven.length).toBeGreaterThanOrEqual(1);
    // Row with fewer columns should still parse
    expect(doc.rows[0].cells).toHaveLength(3); // padded to 3
    expect(doc.rows[1].cells).toHaveLength(3); // truncated to column count
  });

  it("no-header mode generates synthetic field names", () => {
    const { document: doc } = parseCSV("Alice,30,NYC\nBob,25,LA", { header: false });
    expect(doc.fields).toEqual(["col_0", "col_1", "col_2"]);
    expect(doc.rows).toHaveLength(2);
    expect(doc.rows[0].cells[0].value).toBe("Alice");
  });

  it("limit rows with maxRows", () => {
    const csv = "name,age\nAlice,30\nBob,25\nCarol,28";
    const { document: doc } = parseCSV(csv, { maxRows: 2 });
    expect(doc.rows).toHaveLength(2);
    expect(doc.rows[0].cells[0].value).toBe("Alice");
    expect(doc.rows[1].cells[0].value).toBe("Bob");
  });
});

// ─── Determinism ─────────────────────────────────────────────────────

describe("parseCSV — determinism", () => {
  it("same input produces identical cell IDs on repeated runs", () => {
    const csv = "x,y\n1,2\n3,4";
    const a = parseCSV(csv);
    const b = parseCSV(csv);
    expect(a.document.id).toBe(b.document.id);
    expect(a.document.rows[0].cells[0].cellId).toBe(b.document.rows[0].cellId);
  });

  it("different input produces different document ids", () => {
    const a = parseCSV("x,y\n1,2");
    const b = parseCSV("x,y\n3,4");
    expect(a.document.id).not.toBe(b.document.id);
  });
});
