import { barcodeValueIssue } from "./codes";
import type { AssetFolder, AssetRecord } from "./assets";
import { isGaAddressTransform, type DataColumn, type LabelDocument } from "./document";
import { schemaColumns } from "./excel";
import { parseGaAddress } from "./format";
import { filledRowIndexes, headerForColumn } from "./grid";
import { lookupRowValue, missingBindings, type ColumnMapping, type DataRow } from "./resolve";

export type GenerateIssueKind = "missing" | "invalid" | "address" | "image" | "barcode" | "binding";

export type GenerateIssue = {
  row: number;
  rowIndex: number;
  reasons: string[];
  headers: string[];
  cells: { header: string; kind: GenerateIssueKind }[];
};

export type GenerateRunStatus = {
  filled: number;
  ready: number;
  attention: number;
  issues: GenerateIssue[];
  bindingIssues: string[];
};

const ARROW_TOKENS = new Set(["UP", "DOWN", "↑", "▲", "U", "GORE", "↓", "▼", "D", "DOLJE"]);

function cellValue(row: DataRow, key: string, mapping: ColumnMapping, doc: LabelDocument) {
  return lookupRowValue(row, key, mapping, doc.dataColumns ?? []).trim();
}

function knownOption(value: string, allowed: string[]) {
  const upper = value.toUpperCase();
  if (allowed.some((item) => item.trim().toUpperCase() === upper)) return true;
  if (allowed.some((item) => /^(UP|DOWN)$/i.test(item)) && ARROW_TOKENS.has(upper)) return true;
  return false;
}

function isRequired(column: DataColumn) {
  return column.required !== false;
}

function pushCell(
  cells: GenerateIssue["cells"],
  reasons: string[],
  header: string | undefined,
  kind: GenerateIssueKind,
  reason: string,
) {
  reasons.push(reason);
  if (header) cells.push({ header, kind });
}

export function evaluateGenerateRun(
  doc: LabelDocument,
  rows: DataRow[],
  headers: string[],
  mapping: ColumnMapping,
  assets: AssetRecord[] = [],
  folders: AssetFolder[] = [],
): GenerateRunStatus {
  void assets;
  void folders;
  const columns = schemaColumns(doc);
  const bindingIssues = missingBindings(doc, mapping, headers);
  if (!columns.length) {
    return { filled: 1, ready: 1, attention: 0, issues: [], bindingIssues };
  }
  const filledIndexes = filledRowIndexes(rows, headers);
  const addressKeys = new Set(
    doc.elements.filter((el) => isGaAddressTransform(el.transform) && el.binding).map((el) => el.binding as string),
  );
  const barcodeBinds = doc.elements
    .filter((el) => el.type === "barcode" && el.binding?.trim())
    .map((el) => ({ key: el.binding!.trim(), symbology: el.style.barcodeSymbology ?? "code128" }));
  const issues: GenerateIssue[] = [];

  for (const index of filledIndexes) {
    const row = rows[index];
    if (!row) continue;
    const reasons: string[] = [];
    const cells: GenerateIssue["cells"] = [];
    for (const column of columns) {
      const value = cellValue(row, column.key, mapping, doc);
      const header = headerForColumn(column, mapping, headers);
      const label = column.label || column.key;
      if (!value && isRequired(column)) pushCell(cells, reasons, header, "missing", `Missing ${label}`);
      if (value && column.values?.length && !knownOption(value, column.values)) {
        pushCell(cells, reasons, header, "invalid", `Invalid ${label}`);
      }
    }
    for (const key of addressKeys) {
      const value = cellValue(row, key, mapping, doc);
      if (!value) continue;
      const parsed = parseGaAddress(value);
      if (!parsed.regalNumber && !parsed.nivo && parsed.magacin === value.trim().replace(/%+$/, "")) {
        const column = columns.find((item) => item.key === key);
        const header = column ? headerForColumn(column, mapping, headers) : undefined;
        pushCell(cells, reasons, header, "address", "Invalid address");
      }
    }
    for (const bind of barcodeBinds) {
      const value = cellValue(row, bind.key, mapping, doc);
      const column = columns.find((item) => item.key === bind.key);
      const header = column ? headerForColumn(column, mapping, headers) : undefined;
      if (!value) continue;
      const issue = barcodeValueIssue(value, bind.symbology);
      if (issue) {
        pushCell(cells, reasons, header, "barcode", issue);
      }
    }
    if (reasons.length) {
      const uniqueReasons = [...new Set(reasons)];
      const uniqueHeaders = [...new Set(cells.map((cell) => cell.header))];
      issues.push({
        row: index + 1,
        rowIndex: index,
        reasons: uniqueReasons,
        headers: uniqueHeaders,
        cells,
      });
    }
  }

  const filled = filledIndexes.length;
  const attention = issues.length + (bindingIssues.length ? 1 : 0);
  return { filled, ready: Math.max(0, filled - issues.length), attention, issues, bindingIssues };
}

export function runStatusLabel(status: GenerateRunStatus) {
  if (!status.filled) return "No labels yet";
  if (!status.attention) return `${status.filled} of ${status.filled} rows are ready`;
  return `${status.ready} of ${status.filled} rows are ready`;
}

export function runStatusAttentionLabel(status: GenerateRunStatus) {
  if (!status.attention) return "";
  const n = status.issues.length || status.attention;
  return `${n} row${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} attention`;
}

export function issueCellKey(rowIndex: number, header: string) {
  return `${rowIndex}:${header}`;
}

export function summarizeGenerateIssues(status: GenerateRunStatus) {
  const rows = {
    missing: 0,
    invalid: 0,
    address: 0,
    image: 0,
    barcode: 0,
  };
  for (const issue of status.issues) {
    const kinds = new Set(issue.cells.map((cell) => cell.kind));
    if (kinds.has("missing")) rows.missing += 1;
    if (kinds.has("invalid")) rows.invalid += 1;
    if (kinds.has("address")) rows.address += 1;
    if (kinds.has("image")) rows.image += 1;
    if (kinds.has("barcode")) rows.barcode += 1;
  }
  return { ...rows, bindings: status.bindingIssues.length, invalidRows: status.issues.length };
}

export function generateIssueCellKeys(status: GenerateRunStatus) {
  const keys = new Set<string>();
  for (const issue of status.issues) {
    for (const header of issue.headers) keys.add(issueCellKey(issue.rowIndex, header));
  }
  return keys;
}
