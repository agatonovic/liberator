import * as XLSX from "xlsx";
import { columnAliases, isDirectionBound, type DataColumn, type LabelDocument } from "./document";
import type { DataRow } from "./resolve";

export type WorkbookParseResult = {
  fileName: string;
  headers: string[];
  rows: DataRow[];
};

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export async function parseWorkbook(file: File): Promise<WorkbookParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The workbook has no sheets.");
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  const headerRow = (matrix[0] ?? []).map((cell) => cellToString(cell));
  const uniqueHeaders: string[] = [];
  const seen = new Map<string, number>();
  for (const header of headerRow) {
    const base = header || "Column";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    uniqueHeaders.push(count === 0 ? base : `${base} ${count + 1}`);
  }

  const rows: DataRow[] = [];
  for (const raw of matrix.slice(1)) {
    const row: DataRow = {};
    let empty = true;
    uniqueHeaders.forEach((header, index) => {
      const value = cellToString(raw[index]);
      row[header] = value;
      if (value) empty = false;
    });
    if (!empty) rows.push(row);
  }

  if (!uniqueHeaders.length) {
    throw new Error("Could not find a header row in this file.");
  }

  return { fileName: file.name, headers: uniqueHeaders, rows };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, filename);
}

export function schemaColumns(doc: LabelDocument): DataColumn[] {
  const columns = [...(doc.dataColumns ?? [])];
  const seen = new Set<string>();
  const remember = (column: DataColumn) => {
    for (const alias of columnAliases(column)) seen.add(alias.toLowerCase());
  };
  for (const column of columns) remember(column);
  for (const el of doc.elements) {
    const key = el.binding?.trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    const extra: DataColumn = {
      key,
      label: key,
      headers: [key],
      example: el.content ?? "",
      required: false,
      values: isDirectionBound(el) ? ["UP", "DOWN"] : undefined,
    };
    columns.push(extra);
    remember(extra);
  }
  return columns;
}

export function downloadExcelTemplate(doc: LabelDocument): void {
  const columns = schemaColumns(doc);
  if (!columns.length) {
    throw new Error("This template has no data columns yet.");
  }
  const headers = columns.map((column) => column.headers[0] || column.label);
  const examples = columns.map((column) => column.example);
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, examples]);
  sheet["!cols"] = headers.map((header) => ({ wch: Math.max(14, header.length + 2) }));
  XLSX.utils.book_append_sheet(workbook, sheet, "Labels");
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array;
  downloadBlob(
    new Blob([new Uint8Array(bytes)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${doc.name.replace(/\s+/g, "-").toLowerCase()}-template.xlsx`,
  );
}
