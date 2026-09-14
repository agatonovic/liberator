import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import library from "../data/library.json";
import { createDocument, createElement, type LabelDocument } from "@/lib/document";
import {
  analyzePortableExport,
  analyzeRendererCompatibility,
  buildLabelatorPackage,
  buildPortableLabelatorPackage,
  packageBuildToZipBytes,
  validateLabelatorPackageZip,
} from "@/lib/labelator-package";
import { buildTemplateJson } from "@/lib/template-json";
import {
  A3_WAREHOUSE_TEMPLATE_ID,
  a3WarehouseExportOptions,
  buildA3WarehousePackage,
} from "@/lib/labelator-package/a3-warehouse";
import { portableFontSource } from "@/lib/labelator-package/portable-fonts";

const root = process.cwd();

function live(id: string): LabelDocument {
  const doc = library.documents.find((item) => item.id === id);
  if (!doc) throw new Error(`missing template ${id}`);
  return doc as LabelDocument;
}

function openSansLabel(name: string, extra: Partial<LabelDocument> = {}): LabelDocument {
  const doc = createDocument(name, { widthMm: 100, heightMm: 50 });
  doc.elements = [
    createElement("rect", 0, 0, { width: 100, height: 50 }),
    createElement("text", 4, 4, {
      width: 80,
      height: 8,
      content: "LINE",
      style: { fontFamily: "Open Sans", fontWeight: "normal", fontSizeMm: 4, opacity: 1 },
    }),
  ];
  return { ...doc, ...extra, elements: extra.elements ?? doc.elements };
}

describe("portable .labelator product export", () => {
  it("uses the existing exporter and validates as v1 without mutating the template or library.json", () => {
    const doc = live(A3_WAREHOUSE_TEMPLATE_ID);
    const before = JSON.stringify(doc);
    const libraryBefore = createHash("sha256").update(readFileSync(join(root, "data/library.json"))).digest("hex");
    const options = a3WarehouseExportOptions(root);
    const viaDesigner = buildPortableLabelatorPackage(doc, options);
    const viaExporter = buildLabelatorPackage(doc, options);
    expect(viaDesigner.bytes).toEqual(packageBuildToZipBytes(viaExporter));
    expect(viaDesigner.bytes).toEqual(packageBuildToZipBytes(buildA3WarehousePackage(doc, root)));
    expect(viaDesigner.build.manifest.format).toBe("labelator.package");
    expect(viaDesigner.build.manifest.formatVersion).toBe(1);
    expect(validateLabelatorPackageZip(viaDesigner.bytes).ok).toBe(true);
    expect(JSON.stringify(doc)).toBe(before);
    expect(createHash("sha256").update(readFileSync(join(root, "data/library.json"))).digest("hex")).toBe(libraryBefore);
    expect(buildLabelatorPackage).toBeTypeOf("function");
  });

  it("keeps JSON export as the raw template envelope", () => {
    const doc = live(A3_WAREHOUSE_TEMPLATE_ID);
    const json = buildTemplateJson(doc, { exportScope: "working", exportedAt: "2026-09-14T00:00:00.000Z" });
    expect(json.kind).toBe("labelator.template");
    expect(json.document.id).toBe(doc.id);
    expect(json.document.elements).toEqual(doc.elements);
    const source = readFileSync(join(root, "src/components/designer/version-history.tsx"), "utf8");
    expect(source).toContain("downloadTemplateJson");
    expect(source).toContain("Download JSON");
  });

  it("recognizes a new compatible document and warns on unsupported capabilities", () => {
    const compatible = openSansLabel("New compatible label");
    const yes = analyzeRendererCompatibility(compatible);
    expect(yes.compatible).toBe(true);
    expect(yes.unsupported).toEqual([]);

    const qr = openSansLabel("New QR label", {
      elements: [
        ...openSansLabel("New QR label").elements,
        createElement("qr", 10, 10, { width: 20, height: 20 }),
      ],
    });
    const qrResult = analyzeRendererCompatibility(qr);
    expect(qrResult.compatible).toBe(false);
    expect(qrResult.unsupported).toContain("QR");

    const ean = openSansLabel("New EAN label", {
      elements: [
        createElement("barcode", 4, 16, {
          width: 60,
          height: 16,
          content: "1234567890128",
          style: { barcodeSymbology: "ean13", opacity: 1 },
        }),
      ],
    });
    expect(analyzeRendererCompatibility(ean).unsupported).toContain("EAN-13");

    const renamed = { ...compatible, id: "not-a-catalog-id", name: "Renamed copy", catalogId: undefined };
    expect(analyzeRendererCompatibility(renamed).compatible).toBe(true);
  });

  it("does not branch on template identity", () => {
    const files = [
      "src/lib/labelator-package/compatibility.ts",
      "src/lib/labelator-package/renderer-profile.ts",
      "src/lib/labelator-package/portable-export.ts",
      "src/lib/labelator-package/audit.ts",
      "src/lib/labelator-package/browser-export.ts",
      "src/components/designer/labelator-export.tsx",
      "src/components/developers/integration-view.tsx",
    ];
    const forbidden = [
      "warehouse_a3",
      "ga_warehouse",
      "fixed_ga",
      "canopy_a3",
      "cdc_a3",
      "Stellantis",
      "stellantis",
      "ee4837ef-c0f7-4ac9-8612-a689518ad7b0",
      "0a9b4a95-985c-487d-a58e-057a5e45ba57",
      "ff9a7d76-b9a8-4b29-a861-612b6142c9a9",
      "6060f5ce-7572-44a4-b085-9845557f62df",
      "3085002f-b6ce-4feb-bfb5-62f111cd9645",
      "14057388-ae40-4251-a03d-d9cb77a5d0e4",
    ];
    for (const file of files) {
      const source = readFileSync(join(root, file), "utf8");
      for (const token of forbidden) {
        expect(source, `${file} contains ${token}`).not.toContain(token);
      }
    }
  });

  it("serves the same pinned font bytes the proven exporter reads", () => {
    for (const relative of [
      "vendor/fonts/OpenSans-Regular.woff",
      "vendor/fonts/OpenSans-Bold.woff",
      "vendor/fonts/Inter-Bold.woff",
    ]) {
      const source = portableFontSource(
        relative.includes("Inter") ? "Inter" : "Open Sans",
        relative.includes("Regular") ? 400 : 700,
      );
      expect(source?.repoPath).toBe(relative);
      const pinned = readFileSync(join(root, relative));
      const served = readFileSync(join(root, "public", source!.publicPath));
      expect(createHash("sha256").update(served).digest("hex")).toBe(createHash("sha256").update(pinned).digest("hex"));
    }
  });
});

describe("compatibility is independent of the JSON envelope", () => {
  it("does not rewrite a document while analyzing it", () => {
    const doc = openSansLabel("Untouched");
    const before = JSON.stringify(doc);
    analyzePortableExport(doc, { printMode: "label" });
    expect(JSON.stringify(doc)).toBe(before);
    expect(buildTemplateJson(doc, { exportedAt: "2026-09-14T00:00:00.000Z" }).document.name).toBe("Untouched");
  });
});
