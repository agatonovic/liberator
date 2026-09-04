import type { LabelDocument } from "../document";
import { documentBindings } from "../document";
import { parseWorkbook } from "../excel";
import { projectRowsOntoSchema } from "../grid";
import { autoMapBindings } from "../resolve";
import type { LabelDataProvider, LabelDataSet } from "./types";

export type ExcelProviderInput = {
  file: File;
  document?: LabelDocument | null;
};

export async function loadExcelLabelData(file: File, doc?: LabelDocument | null): Promise<LabelDataSet> {
  const parsed = await parseWorkbook(file);
  const bindings = doc ? documentBindings(doc) : [];
  const mapping = autoMapBindings(bindings, parsed.headers, doc?.dataColumns);
  const projected = doc
    ? projectRowsOntoSchema(doc, parsed.headers, parsed.rows, mapping)
    : { headers: parsed.headers, rows: parsed.rows, mapping };
  return {
    sourceKind: "excel",
    fileName: parsed.fileName,
    headers: projected.headers,
    rows: projected.rows,
    mapping: projected.mapping,
  };
}

export const excelLabelDataProvider: LabelDataProvider = {
  kind: "excel",
  async load(input: unknown) {
    const file = isExcelProviderInput(input) ? input.file : (input as File);
    const doc = isExcelProviderInput(input) ? input.document : undefined;
    if (!file || typeof (file as File).arrayBuffer !== "function") {
      throw new Error("Excel provider expects a File.");
    }
    return loadExcelLabelData(file, doc);
  },
};

function isExcelProviderInput(value: unknown): value is ExcelProviderInput {
  return Boolean(value && typeof value === "object" && "file" in value);
}
