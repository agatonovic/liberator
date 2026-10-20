import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PACKAGING_FOLDER_ID } from "@/lib/assets";
import { createDocument, createElement } from "@/lib/document";
import { showMissingImagePlaceholder } from "@/lib/missing-image";
import { generateVectorPdf } from "@/lib/pdf";
import { evaluateGenerateRun } from "@/lib/run-status";

const srcRoot = join(process.cwd(), "src");

function walkTsx(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) found.push(...walkTsx(path));
    else if (name.name.endsWith(".tsx") || name.name.endsWith(".ts")) found.push(path);
  }
  return found;
}

describe("missing image placeholders", () => {
  it("keeps the Image box on design surfaces and hides it on generated output", () => {
    expect(showMissingImagePlaceholder("design")).toBe(true);
    expect(showMissingImagePlaceholder("generated")).toBe(false);
  });

  it("makes every CanvasElement call site declare design vs generated behavior", () => {
    const files = walkTsx(srcRoot).filter((path) => {
      if (path.endsWith("canvas-element.tsx")) return false;
      const source = readFileSync(path, "utf8");
      return /<CanvasElement\b/.test(source);
    });
    expect(files.length).toBeGreaterThan(0);
    for (const path of files) {
      const source = readFileSync(path, "utf8");
      expect(source, path).toContain("missingImagePlaceholder={showMissingImagePlaceholder(");
    }
    const joined = files.map((path) => readFileSync(path, "utf8")).join("\n");
    expect(joined).toContain('showMissingImagePlaceholder("design")');
    expect(joined).toContain('showMissingImagePlaceholder("generated")');
  });

  it("does not paint IMAGE in generated PDFs when a bound photo is missing", async () => {
    const doc = createDocument("Any template", { widthMm: 100, heightMm: 80 });
    doc.elements = [
      createElement("image", 10, 10, {
        width: 80,
        height: 60,
        binding: "packaging",
        assetFolderId: PACKAGING_FOLDER_ID,
      }),
    ];
    const bytes = await generateVectorPdf(
      doc,
      [{ packaging: "X4202" }, { packaging: "" }, { packaging: "NO-SUCH-CODE" }],
      { packaging: "packaging" },
    );
    const ascii = Buffer.from(bytes).toString("latin1");
    expect(ascii).not.toMatch(/\(IMAGE\)/);
    expect(ascii).not.toContain("IMAGE");
  });

  it("lets Generate download a PDF when a bound photo is missing", () => {
    const doc = createDocument("Any template", { widthMm: 100, heightMm: 80 });
    doc.dataColumns = [
      { key: "sku", label: "SKU", headers: ["SKU"], example: "1", required: true },
      { key: "packaging", label: "Pakovanje", headers: ["PAKOVANJE"], example: "X4202", required: true },
    ];
    doc.elements = [
      createElement("image", 10, 10, {
        width: 80,
        height: 60,
        binding: "packaging",
        assetFolderId: PACKAGING_FOLDER_ID,
      }),
    ];
    const status = evaluateGenerateRun(
      doc,
      [{ SKU: "ABC", PAKOVANJE: "NO-SUCH-CODE" }],
      ["SKU", "PAKOVANJE"],
      { sku: "SKU", packaging: "PAKOVANJE" },
    );
    expect(status.filled).toBe(1);
    expect(status.ready).toBe(1);
    expect(status.issues).toEqual([]);
  });

  it("does not reject a row for an empty optional barcode", () => {
    const doc = createDocument("Any template", { widthMm: 100, heightMm: 80 });
    doc.dataColumns = [
      { key: "sku", label: "SKU", headers: ["SKU"], example: "1", required: true },
      { key: "barcode", label: "Barcode", headers: ["BARCODE"], example: "", required: false },
    ];
    doc.elements = [
      createElement("barcode", 4, 40, {
        width: 90,
        height: 20,
        binding: "barcode",
        style: { barcodeSymbology: "code39", opacity: 1 },
      }),
    ];
    const status = evaluateGenerateRun(
      doc,
      [{ SKU: "ABC", BARCODE: "" }],
      ["SKU", "BARCODE"],
      { sku: "SKU", barcode: "BARCODE" },
    );
    expect(status.ready).toBe(1);
    expect(status.issues).toEqual([]);
  });
});
