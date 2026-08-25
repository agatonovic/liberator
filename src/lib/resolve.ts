import type { DataColumn, LabelDocument, LabelElement } from "./document";
import { columnAliases, findColumnByName } from "./document";
import { arrowSymbol, formatPartNumber, normalizeArrow, parseGaAddress, partNumberGroups } from "./format";

export type DataRow = Record<string, string>;
export type ColumnMapping = Record<string, string>;

export function lookupRowValue(row: DataRow, key: string, mapping: ColumnMapping, columns: DataColumn[] = []): string {
  const column = findColumnByName(columns, key);
  const names = [
    mapping[key],
    key,
    column ? mapping[column.key] : undefined,
    column?.key,
    column?.label,
    ...(column ? columnAliases(column) : []),
  ].filter((name): name is string => Boolean(name));
  for (const name of names) {
    const value = row[name];
    if (value != null && String(value).length > 0) return String(value);
  }
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const match = Object.entries(row).find(([name]) => wanted.has(name.toLowerCase()));
  return match?.[1] ? String(match[1]) : "";
}

function applyTransform(element: LabelElement, raw: string): string {
  if (element.partIndex != null || element.transform === "part") {
    return partNumberGroups(raw)[element.partIndex ?? 0] ?? "";
  }
  if (element.transform === "part_number") {
    return formatPartNumber(raw);
  }
  if (element.transform === "arrow") {
    if (element.type === "text") return arrowSymbol(raw);
    return normalizeArrow(raw);
  }
  if (element.transform === "barcode_pct") {
    const value = raw.trim();
    if (!value) return "";
    return value.endsWith("%") ? value : `${value}%`;
  }
  if (
    element.transform === "ga_magacin" ||
    element.transform === "ga_regal_letter" ||
    element.transform === "ga_regal_number" ||
    element.transform === "ga_nivo"
  ) {
    const parsed = parseGaAddress(raw);
    if (element.transform === "ga_magacin") return parsed.magacin;
    if (element.transform === "ga_regal_letter") return parsed.regalLetter;
    if (element.transform === "ga_regal_number") return parsed.regalNumber;
    return parsed.nivo;
  }
  return raw;
}

export function isBoundToData(element: Pick<LabelElement, "binding" | "fallbackBinding">) {
  return Boolean(element.binding?.trim() || element.fallbackBinding?.trim());
}

/** Designed sample art only when the field is unbound, or the live cell has a value. */
export function useDesignedMedia(
  element: Pick<LabelElement, "binding" | "fallbackBinding">,
  value: string,
) {
  return !isBoundToData(element) || Boolean(value.trim());
}

export function resolveValue(
  element: LabelElement,
  row: DataRow | null | undefined,
  mapping: ColumnMapping,
  columns: DataColumn[] = [],
): string {
  const binding = element.binding?.trim();
  const fallbackKey = element.fallbackBinding?.trim();
  const live = row != null;
  let raw = "";
  if (binding && row) {
    raw = lookupRowValue(row, binding, mapping, columns);
  }
  if (!raw.trim() && fallbackKey && row) {
    raw = lookupRowValue(row, fallbackKey, mapping, columns);
  }
  raw = raw.trim();
  if (raw) {
    const next = applyTransform(element, raw);
    if (next) return next;
    return live && (binding || fallbackKey) ? "" : (element.content ?? "");
  }
  // Generate / PDF pass a data row: empty bound cells stay empty instead of
  // painting the designed sample (e.g. catalog part numbers).
  if (live && (binding || fallbackKey)) return "";
  if (element.transform === "arrow" && element.content) {
    return applyTransform(element, element.content);
  }
  return element.content ?? "";
}

export function autoMapBindings(
  bindings: string[],
  headers: string[],
  columns: DataColumn[] = [],
): ColumnMapping {
  const mapping: ColumnMapping = {};
  const unused = [...headers];
  const byKey = new Map(columns.map((column) => [column.key, column]));

  for (const binding of bindings) {
    const column = byKey.get(binding) ?? findColumnByName(columns, binding);
    const aliases = [binding, ...(column ? columnAliases(column) : [])]
      .map((alias) => alias.toLowerCase());
    const index = unused.findIndex((header) => aliases.includes(header.toLowerCase()));
    if (index >= 0) {
      const header = unused[index];
      mapping[binding] = header;
      if (column) {
        for (const alias of columnAliases(column)) mapping[alias] = header;
      }
      unused.splice(index, 1);
    }
  }
  return mapping;
}

/** Designer shows the designed text first. Catalog examples only fill empty fields. */
export function designerResolveValue(
  element: LabelElement,
  previewRow: DataRow | null | undefined,
  mapping: ColumnMapping,
  columns: DataColumn[] = [],
) {
  const designed = resolveValue(element, null, mapping, columns);
  if (designed.trim()) return designed;
  return resolveValue(element, previewRow, mapping, columns);
}

export function previewRow(rows: DataRow[], index: number): DataRow | null {
  if (!rows.length) return null;
  const clamped = Math.min(Math.max(index, 0), rows.length - 1);
  return rows[clamped] ?? null;
}

export function missingBindings(
  doc: LabelDocument,
  mapping: ColumnMapping,
  headers: string[],
): string[] {
  const headerSet = new Set(headers.map((header) => header.toLowerCase()));
  const columns = doc.dataColumns ?? [];
  const required = columns.length
    ? columns.filter((column) => column.required !== false).map((column) => column.key)
    : [...new Set(doc.elements.map((el) => el.binding?.trim()).filter((key): key is string => Boolean(key)))];

  return required.filter((key) => {
    const column = columns.find((item) => item.key === key);
    const aliases = [key, column?.label, ...(column?.headers ?? [])]
      .filter((alias): alias is string => Boolean(alias))
      .map((alias) => alias.toLowerCase());
    const mapped = mapping[key];
    if (mapped && headerSet.has(mapped.toLowerCase())) return false;
    return !aliases.some((alias) => headerSet.has(alias));
  });
}
