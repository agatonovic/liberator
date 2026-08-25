import { findAssetByValue, type AssetFolder, type AssetRecord } from "./assets";
import { isGaAddressTransform, type DataColumn, type LabelDocument } from "./document";
import { schemaColumns } from "./excel";
import { parseGaAddress } from "./format";
import { filledRowIndexes, headerForColumn } from "./grid";
import { lookupRowValue, type ColumnMapping, type DataRow } from "./resolve";

export type GenerateIssueKind = "missing" | "invalid" | "address" | "image";

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
  const columns = schemaColumns(doc);
  const filledIndexes = filledRowIndexes(rows, headers);
  const addressKeys = new Set(
    doc.elements.filter((el) => isGaAddressTransform(el.transform) && el.binding).map((el) => el.binding as string),
  );
  const imageBinds = doc.elements
    .filter((el) => el.type === "image" && el.assetFolderId && el.binding?.trim())
    .map((el) => ({ key: el.binding!.trim(), folderId: el.assetFolderId! }));
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
    for (const bind of imageBinds) {
      const value = cellValue(row, bind.key, mapping, doc);
      if (!value) continue;
      if (!findAssetByValue(assets, bind.folderId, value, folders)) {
        const column = columns.find((item) => item.key === bind.key);
        const header = column ? headerForColumn(column, mapping, headers) : undefined;
        pushCell(cells, reasons, header, "image", "Missing image");
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
  const attention = issues.length;
  return { filled, ready: Math.max(0, filled - attention), attention, issues };
}

export function runStatusLabel(status: GenerateRunStatus) {
  if (!status.filled) return "No labels yet";
  if (!status.attention) return `${status.filled} label${status.filled === 1 ? "" : "s"} ready`;
  return `${status.ready} ready · ${status.attention} need attention`;
}

export function issueCellKey(rowIndex: number, header: string) {
  return `${rowIndex}:${header}`;
}

export function generateIssueCellKeys(status: GenerateRunStatus) {
  const keys = new Set<string>();
  for (const issue of status.issues) {
    for (const header of issue.headers) keys.add(issueCellKey(issue.rowIndex, header));
  }
  return keys;
}
