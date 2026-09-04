import { describe, expect, it } from "vitest";
import { createDocument, createElement, isLabelDocument } from "@/lib/document";
import { parseGaAddress, parseArrow, arrowSymbol } from "@/lib/format";
import { resolveValue } from "@/lib/resolve";
import { evaluateGenerateRun } from "@/lib/run-status";
import { loadExcelLabelData } from "@/lib/data/excel-provider";
import { shopifyLabelDataProvider } from "@/shopify/adapter";
import * as XLSX from "xlsx";

describe("GA address transforms", () => {
  it("splits MAGACIN / REGAL / NIVO", () => {
    expect(parseGaAddress("HB9A.011.001")).toEqual({
      magacin: "HB9",
      regalLetter: "A",
      regalNumber: "011",
      nivo: "001",
    });
    expect(parseGaAddress("RHB7B.001.002")).toEqual({
      magacin: "RHB7",
      regalLetter: "B",
      regalNumber: "001",
      nivo: "002",
    });
  });

  it("resolves bound GA fields from a DataRow", () => {
    const row = { address: "HB9A.011.001" };
    const magacin = createElement("text", 0, 0, { binding: "address", transform: "ga_magacin" });
    const letter = createElement("text", 0, 0, { binding: "address", transform: "ga_regal_letter" });
    const number = createElement("text", 0, 0, { binding: "address", transform: "ga_regal_number" });
    const nivo = createElement("text", 0, 0, { binding: "address", transform: "ga_nivo" });
    expect(resolveValue(magacin, row, {}, [])).toBe("HB9");
    expect(resolveValue(letter, row, {}, [])).toBe("A");
    expect(resolveValue(number, row, {}, [])).toBe("011");
    expect(resolveValue(nivo, row, {}, [])).toBe("001");
  });

  it("normalizes UP/DOWN arrows", () => {
    expect(parseArrow("UP")).toBe("UP");
    expect(parseArrow("gore")).toBe("UP");
    expect(parseArrow("DOWN")).toBe("DOWN");
    expect(arrowSymbol("UP")).toBe("▲");
    expect(arrowSymbol("DOWN")).toBe("▼");
  });
});

describe("bindings and validation", () => {
  it("keeps designed content when no live row is passed", () => {
    const element = createElement("text", 0, 0, { content: "SAMPLE", binding: "sku" });
    expect(resolveValue(element, null, {}, [])).toBe("SAMPLE");
    expect(resolveValue(element, { sku: "ABC" }, {}, [])).toBe("ABC");
    expect(resolveValue(element, { sku: "" }, {}, [])).toBe("");
  });

  it("reports missing required generate columns", () => {
    const doc = createDocument("Test");
    doc.dataColumns = [
      { key: "sku", label: "SKU", headers: ["SKU"], example: "1", required: true },
    ];
    const status = evaluateGenerateRun(doc, [{ SKU: "" }], ["SKU"], {});
    expect(status.filled).toBe(0);
    const filled = evaluateGenerateRun(doc, [{ SKU: "X" }], ["SKU"], {});
    expect(filled.ready).toBe(1);
    expect(filled.attention).toBe(0);
  });
});

describe("persistence round-trip", () => {
  it("round-trips a LabelDocument through JSON", () => {
    const doc = createDocument("Round trip", { widthMm: 100, heightMm: 50 });
    doc.elements = [createElement("text", 4, 4, { content: "Hello", binding: "name" })];
    const copy = JSON.parse(JSON.stringify(doc));
    expect(isLabelDocument(copy)).toBe(true);
    expect(copy.id).toBe(doc.id);
    expect(copy.elements[0].binding).toBe("name");
    expect(copy.page).toEqual(doc.page);
  });
});

describe("data providers", () => {
  it("adapts Excel into DataRow[] without exposing a workbook to the engine", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["SKU", "Name"],
      ["ABC-1", "Widget"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Labels");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array;
    const file = new File([new Uint8Array(bytes)], "labels.xlsx");
    const doc = createDocument("Excel");
    doc.dataColumns = [
      { key: "sku", label: "SKU", headers: ["SKU"], example: "ABC-1" },
      { key: "name", label: "Name", headers: ["Name"], example: "Widget" },
    ];
    const data = await loadExcelLabelData(file, doc);
    expect(data.sourceKind).toBe("excel");
    expect(data.rows[0]?.SKU || data.rows[0]?.sku).toBeTruthy();
    const sku = data.rows[0]?.SKU ?? data.rows[0]?.sku;
    expect(sku).toBe("ABC-1");
  });

  it("loads demo Shopify products as LabelDataSet rows", async () => {
    const data = await shopifyLabelDataProvider.load({ productIds: ["prod_mug"] });
    expect(shopifyLabelDataProvider.kind).toBe("shopify");
    expect(data.sourceKind).toBe("shopify");
    expect(data.rows[0]?.title).toBe("Ceramic Coffee Mug");
    expect(data.rows[0]?.sku).toBe("MUG-001");
  });
});
