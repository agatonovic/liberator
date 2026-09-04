import type { ColumnMapping, DataRow } from "../resolve";

/**
 * How a batch of label rows was produced. The shared engine only consumes DataRow[] / ColumnMapping.
 * New sources (Shopify, ERP, …) must adapt into this shape before Designer/PDF/validation.
 */
export type LabelDataSourceKind = "manual" | "excel" | "shopify" | "csv" | "erp" | "wms" | "api";

export type LabelDataSet = {
  sourceKind: LabelDataSourceKind;
  fileName?: string | null;
  headers: string[];
  rows: DataRow[];
  mapping: ColumnMapping;
};

export type LabelDataProvider = {
  kind: LabelDataSourceKind;
  load: (input: unknown) => Promise<LabelDataSet>;
};
