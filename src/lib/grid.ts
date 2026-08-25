import type { DataColumn, LabelDocument } from "./document";
import { columnAliases } from "./document";
import type { PersistedData } from "./db";
import { schemaColumns } from "./excel";
import type { ColumnMapping, DataRow } from "./resolve";

export const MIN_GRID_ROWS = 32;

export function columnHeader(column: DataColumn) {
  return column.headers[0] || column.label || column.key;
}

export function headerForColumn(column: DataColumn, mapping: ColumnMapping, headers: string[]): string | undefined {
  const wanted = [mapping[column.key], columnHeader(column), ...columnAliases(column)]
    .filter((name): name is string => Boolean(name))
    .map((name) => name.toLowerCase());
  return headers.find((header) => wanted.includes(header.toLowerCase()));
}

export function identityMapping(columns: DataColumn[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const column of columns) {
    const header = columnHeader(column);
    for (const alias of columnAliases(column)) mapping[alias] = header;
  }
  return mapping;
}

export function designerPreviewRow(doc: LabelDocument): DataRow {
  const columns = schemaColumns(doc);
  const row: DataRow = {};
  for (const column of columns) {
    const value = column.example ?? "";
    row[columnHeader(column)] = value;
    row[column.key] = value;
    if (column.label) row[column.label] = value;
  }
  return row;
}

export function blankRow(headers: string[]): DataRow {
  return Object.fromEntries(headers.map((header) => [header, ""]));
}

export function rowHasValue(row: DataRow, headers: string[]) {
  return headers.some((header) => String(row[header] ?? "").trim().length > 0);
}

export function filledRowIndexes(rows: DataRow[], headers: string[]) {
  return rows.map((row, index) => (rowHasValue(row, headers) ? index : -1)).filter((index) => index >= 0);
}

export function padRows(rows: DataRow[], headers: string[], min = MIN_GRID_ROWS) {
  const next = rows.map((row) => {
    const copy = blankRow(headers);
    for (const header of headers) copy[header] = row[header] ?? "";
    return copy;
  });
  while (next.length < min) next.push(blankRow(headers));
  return next;
}

export function templateGrid(doc: LabelDocument, minRows = MIN_GRID_ROWS): PersistedData {
  const columns = schemaColumns(doc);
  const headers = columns.map(columnHeader);
  return {
    fileName: doc.name,
    headers,
    rows: padRows([], headers, minRows),
    mapping: identityMapping(columns),
    previewRowIndex: 0,
  };
}

export function sameTemplateGrid(doc: LabelDocument, data: PersistedData) {
  const expected = schemaColumns(doc).map(columnHeader);
  return (
    expected.length === data.headers.length &&
    expected.every((header, index) => header === data.headers[index])
  );
}

export function projectRowsOntoSchema(
  doc: LabelDocument,
  sourceHeaders: string[],
  sourceRows: DataRow[],
  mapping: ColumnMapping,
): { headers: string[]; rows: DataRow[]; mapping: ColumnMapping } {
  const columns = schemaColumns(doc);
  const headers = columns.map(columnHeader);
  const identity = identityMapping(columns);
  const rows = sourceRows.map((row) => {
    const next = blankRow(headers);
    for (const column of columns) {
      const header = columnHeader(column);
      const sourceKey = mapping[column.key] || header;
      next[header] =
        row[sourceKey] ??
        row[header] ??
        row[column.key] ??
        row[column.label] ??
        column.headers.map((alias) => row[alias]).find((value) => String(value ?? "").trim()) ??
        "";
    }
    return next;
  });
  return { headers, rows: padRows(rows, headers), mapping: identity };
}

export function parseDelimited(text: string, delimiter = "\t"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
        continue;
      }
      cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function parseSpreadsheetPaste(text: string): string[][] {
  const trimmed = text.replace(/^\uFEFF/, "");
  if (!trimmed.trim()) return [];
  if (trimmed.includes("\t")) return parseDelimited(trimmed, "\t");
  if (trimmed.includes(";")) return parseDelimited(trimmed, ";");
  return parseDelimited(trimmed, ",");
}

export function looksLikeHeaderRow(row: string[], headers: string[]) {
  if (!row.length || !headers.length) return false;
  const norm = (value: string) => value.trim().toLowerCase();
  const wanted = new Set(headers.map(norm));
  const hits = row.filter((cell) => wanted.has(norm(cell))).length;
  return hits >= Math.min(2, headers.length);
}

function escapeCell(value: string) {
  if (/[\t\n\r"]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function serializeTsv(grid: string[][]) {
  return grid.map((row) => row.map((cell) => escapeCell(cell ?? "")).join("\t")).join("\n");
}
