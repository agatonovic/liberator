import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import library from "../data/library.json";
import type { LabelDocument, LabelElement } from "@/lib/document";
import { PACKAGING_FOLDER_ID } from "@/lib/assets";
import {
  buildLabelatorPackage,
  buildStoreZip,
  collectRequiredTransforms,
  documentFromPackage,
  packageBuildToZipBytes,
  readLabelatorPackageFromZip,
  readStoreZip,
  validateLabelatorPackageZip,
  writeLabelatorPackage,
  LABELATOR_PACKAGE_FORMAT,
  LABELATOR_PACKAGE_FORMAT_VERSION,
} from "@/lib/labelator-package";
import {
  A3_WAREHOUSE_CATALOG_ID,
  A3_WAREHOUSE_PACKAGE_EXPORTED_AT,
  A3_WAREHOUSE_PACKAGE_NAME,
  A3_WAREHOUSE_TEMPLATE_ID,
  a3WarehouseExportOptions,
  buildA3WarehousePackage,
} from "@/lib/labelator-package/a3-warehouse";
import {
  GA_ADDRESS_CATALOG_ID,
  GA_ADDRESS_PACKAGE_EXPORTED_AT,
  GA_ADDRESS_PACKAGE_NAME,
  GA_ADDRESS_TEMPLATE_ID,
  buildGaAddressPackage,
} from "@/lib/labelator-package/ga-address";
import {
  FIXED_GA_A4_PACKAGE_NAME,
  FIXED_GA_A4_TEMPLATE_ID,
  buildFixedGaA4Package,
} from "@/lib/labelator-package/fixed-ga-a4";

const repoRoot = process.cwd();

function liveA3(): LabelDocument {
  const doc = library.documents.find((item) => item.id === A3_WAREHOUSE_TEMPLATE_ID);
  expect(doc, "live A3 Warehouse template").toBeTruthy();
  return structuredClone(doc) as unknown as LabelDocument;
}

function renderingRelevant(doc: LabelDocument) {
  return {
    page: doc.page,
    sheet: doc.sheet,
    dataColumns: doc.dataColumns,
    elements: doc.elements.map((element: LabelElement) => ({
      id: element.id,
      type: element.type,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation ?? 0,
      content: element.content ?? null,
      binding: element.binding ?? null,
      fallbackBinding: element.fallbackBinding ?? null,
      transform: element.transform ?? null,
      assetFolderId: element.assetFolderId ?? null,
      imageDataUrl: element.imageDataUrl ?? null,
      imageFit: element.imageFit ?? null,
      spans: element.spans ?? null,
      style: element.style,
      partIndex: element.partIndex ?? null,
      hidden: element.hidden ?? false,
    })),
  };
}

describe("labelator package format", () => {
  it("builds manifest with portable identity and declares part_number", () => {
    const doc = liveA3();
    const build = buildA3WarehousePackage(doc, repoRoot);
    expect(build.manifest.format).toBe(LABELATOR_PACKAGE_FORMAT);
    expect(build.manifest.formatVersion).toBe(LABELATOR_PACKAGE_FORMAT_VERSION);
    expect(build.manifest.packageName).toBe(A3_WAREHOUSE_PACKAGE_NAME);
    expect(build.manifest.exportedAt).toBe(A3_WAREHOUSE_PACKAGE_EXPORTED_AT);
    expect(build.manifest.template.name).toBe("Warehouse A3 Final");
    expect(build.manifest.template.page).toEqual({ widthMm: 420, heightMm: 297 });
    expect(build.manifest.template.elementCount).toBe(24);
    expect(build.manifest.requiredTransforms).toEqual(["part_number"]);
    expect(collectRequiredTransforms(doc)).toEqual(["part_number"]);
    expect(build.manifest.labelator?.templateId).toBe(A3_WAREHOUSE_TEMPLATE_ID);
    expect(build.manifest.labelator?.catalogId).toBe(A3_WAREHOUSE_CATALOG_ID);
    expect(build.manifest.dataContract.fields.some((field) => field.key === "reference")).toBe(true);
    expect(build.manifest.dataContract.fields.find((field) => field.key === "reference")?.aliases).toEqual(
      expect.arrayContaining(["REFERENCA", "reference"]),
    );
  });

  it("indexes packaging assets without requiring LABELATOR folder ids at resolve time", () => {
    const doc = liveA3();
    const build = buildA3WarehousePackage(doc, repoRoot);
    const packaging = build.assetsIndex.collections.find((collection) => collection.id === "packaging");
    expect(packaging).toBeTruthy();
    expect(packaging?.labelatorAssetFolderId).toBe(PACKAGING_FOLDER_ID);
    expect(packaging?.entries.x4202).toBe("packaging/X4202.jpg");
    expect(build.files.binaries["assets/packaging/X4202.jpg"]?.byteLength).toBeGreaterThan(1000);
  });

  it("embeds Artifakt and pinned Open Sans binaries with checksums", () => {
    const doc = liveA3();
    const build = buildA3WarehousePackage(doc, repoRoot);
    const families = new Set(build.manifest.fonts.map((font) => font.family));
    expect(families.has("Artifakt Element Black")).toBe(true);
    expect(families.has("Open Sans")).toBe(true);
    for (const font of build.manifest.fonts) {
      const bytes = build.files.binaries[font.path];
      expect(bytes, font.path).toBeTruthy();
      expect(createHash("sha256").update(bytes!).digest("hex")).toBe(font.sha256);
      expect(font.path.startsWith("fonts/")).toBe(true);
      expect(font.path.includes("://")).toBe(false);
    }
    expect(build.files.binaries["fonts/OpenSans-Regular.woff"]?.[0]).toBe(0x77); // 'w'
    expect(build.files.binaries["fonts/ArtifaktElement-Black.otf"]?.byteLength).toBeGreaterThan(1000);
  });

  it("includes canonical template.json with spans, barcode, and part_number", () => {
    const doc = liveA3();
    const build = buildA3WarehousePackage(doc, repoRoot);
    expect(build.template.kind).toBe("labelator.template");
    expect(build.template.document.elements).toHaveLength(24);
    const part = build.template.document.elements.find((el) => el.transform === "part_number");
    expect(part?.binding).toBe("REFERENCA");
    expect(part?.spans?.some((span) => span.fill === "#FF2600")).toBe(true);
    const barcode = build.template.document.elements.find((el) => el.type === "barcode");
    expect(barcode?.style.barcodeSymbology).toBe("code39");
    const image = build.template.document.elements.find((el) => el.type === "image");
    expect(image?.assetFolderId).toBe(PACKAGING_FOLDER_ID);
    expect(image?.binding).toBe("packaging");
  });

  it("validates a built package and rejects missing fonts", () => {
    const doc = liveA3();
    const build = buildA3WarehousePackage(doc, repoRoot);
    const zip = packageBuildToZipBytes(build);
    const ok = validateLabelatorPackageZip(zip);
    expect(ok.ok).toBe(true);
    expect(ok.issues.filter((issue) => issue.level === "error")).toEqual([]);

    expect(() =>
      buildLabelatorPackage(doc, {
        ...a3WarehouseExportOptions(repoRoot),
        fonts: a3WarehouseExportOptions(repoRoot).fonts.filter((font) => font.family !== "Open Sans"),
      }),
    ).toThrow(/Missing font binaries/);
  });

  it("round-trips ZIP unpack while preserving rendering-relevant document fields", () => {
    const doc = liveA3();
    const beforeLibrary = JSON.stringify(library);
    const build = buildA3WarehousePackage(doc, repoRoot);
    const zip = packageBuildToZipBytes(build);
    const contents = readLabelatorPackageFromZip(zip);
    const restored = documentFromPackage(contents);
    expect(renderingRelevant(restored)).toEqual(renderingRelevant(doc));
    expect(restored.elements).toHaveLength(24);
    expect(JSON.stringify(library)).toBe(beforeLibrary);
  });

  it("store ZIP read matches written entries", () => {
    const payload = new TextEncoder().encode('{"ok":true}\n');
    const zip = buildStoreZip([
      { path: "manifest.json", data: payload },
      { path: "fonts/a.otf", data: new Uint8Array([1, 2, 3]) },
    ]);
    const map = readStoreZip(zip);
    expect(new TextDecoder().decode(map.get("manifest.json"))).toBe('{"ok":true}\n');
    expect([...map.get("fonts/a.otf")!]).toEqual([1, 2, 3]);
  });

  it("writes deterministic A3 Warehouse .labelator artifact without touching library.json", async () => {
    const before = JSON.stringify(library);
    const doc = liveA3();
    const build = buildA3WarehousePackage(doc, repoRoot);
    const outDir = join(repoRoot, "artifacts", "packages");
    await mkdir(outDir, { recursive: true });
    const written = await writeLabelatorPackage(build, outDir, {
      mkdir: async (path, opts) => {
        await mkdir(path, { recursive: opts?.recursive ?? true });
      },
      writeFile: async (path, data) => {
        await writeFile(path, data);
      },
      join,
      dirname,
    });
    const zipBytes = new Uint8Array(await readFile(written.zipPath));
    const validation = validateLabelatorPackageZip(zipBytes);
    expect(validation.ok, JSON.stringify(validation.issues, null, 2)).toBe(true);

    const unpackedManifest = JSON.parse(await readFile(join(written.directory, "manifest.json"), "utf8"));
    expect(unpackedManifest.packageName).toBe(A3_WAREHOUSE_PACKAGE_NAME);
    expect(unpackedManifest.requiredTransforms).toEqual(["part_number"]);
    expect(unpackedManifest.exportedAt).toBe(A3_WAREHOUSE_PACKAGE_EXPORTED_AT);

    // Functional determinism: same inputs → same binary checksums / template body
    const again = packageBuildToZipBytes(buildA3WarehousePackage(liveA3(), repoRoot));
    expect(createHash("sha256").update(zipBytes).digest("hex")).toBe(
      createHash("sha256").update(again).digest("hex"),
    );

    expect(JSON.stringify(library)).toBe(before);
    expect(written.fileName).toBe("Warehouse_A3_Final_v1.labelator");
  });

  it("writes deterministic GA Address .labelator from the repaired print document", async () => {
    const before = JSON.stringify(library);
    const stored = library.documents.find((item) => item.id === GA_ADDRESS_TEMPLATE_ID);
    expect(stored, "live GA Address template").toBeTruthy();
    const doc = structuredClone(stored) as unknown as LabelDocument;
    const storedArrow = doc.elements.find((el) => el.type === "arrow");
    expect(storedArrow?.binding).toBeFalsy();

    const build = buildGaAddressPackage(doc, repoRoot);
    const packagedArrow = build.template.document.elements.find((el) => el.type === "arrow");
    expect(packagedArrow?.binding).toBe("arrow");
    expect(packagedArrow?.transform).toBe("arrow");
    expect(build.manifest.requiredTransforms).toEqual([
      "arrow",
      "ga_magacin",
      "ga_nivo",
      "ga_regal_letter",
      "ga_regal_number",
    ]);
    expect(build.manifest.template.page).toEqual({ widthMm: 408.98, heightMm: 80.72 });
    expect(build.manifest.labelator?.templateId).toBe(GA_ADDRESS_TEMPLATE_ID);
    expect(build.manifest.labelator?.catalogId).toBe(GA_ADDRESS_CATALOG_ID);
    expect(build.manifest.fonts.map((font) => `${font.family} ${font.weight}`).sort()).toEqual([
      "Artifakt Element 400",
      "Artifakt Element 700",
      "Artifakt Element Black 700",
    ]);
    expect(build.manifest.assets.collections).toEqual([]);

    const outDir = join(repoRoot, "artifacts", "packages");
    await mkdir(outDir, { recursive: true });
    const written = await writeLabelatorPackage(build, outDir, {
      mkdir: async (path, opts) => {
        await mkdir(path, { recursive: opts?.recursive ?? true });
      },
      writeFile: async (path, data) => {
        await writeFile(path, data);
      },
      join,
      dirname,
    });
    const zipBytes = new Uint8Array(await readFile(written.zipPath));
    const validation = validateLabelatorPackageZip(zipBytes);
    expect(validation.ok, JSON.stringify(validation.issues, null, 2)).toBe(true);
    expect(written.fileName).toBe(GA_ADDRESS_PACKAGE_NAME + ".labelator");
    expect(build.manifest.exportedAt).toBe(GA_ADDRESS_PACKAGE_EXPORTED_AT);
    expect(JSON.stringify(library)).toBe(before);
  });

  it("writes deterministic FIXED GA A4 .labelator in sheet print mode", async () => {
    const before = JSON.stringify(library);
    const stored = library.documents.find((item) => item.id === FIXED_GA_A4_TEMPLATE_ID);
    expect(stored, "live FIXED GA A4 template").toBeTruthy();
    const doc = structuredClone(stored) as unknown as LabelDocument;
    const build = buildFixedGaA4Package(doc, repoRoot);
    expect(build.manifest.print?.mode).toBe("sheet");
    expect(build.manifest.template.sheet).toEqual({
      pageSize: "A4-landscape",
      columns: 1,
      rows: 2,
      gapMm: 0,
      marginMm: 4,
    });
    expect(build.manifest.requiredTransforms).toEqual(["arrow", "part_number"]);
    expect(build.manifest.template.page).toEqual({ widthMm: 254, heightMm: 68 });
    const arrows = build.template.document.elements.filter((el) => el.type === "arrow" && !el.hidden);
    expect(arrows.map((el) => el.rotation)).toEqual([270, -90]);
    expect(arrows.every((el) => el.binding === "arrow" && el.transform === "arrow")).toBe(true);

    const outDir = join(repoRoot, "artifacts", "packages");
    await mkdir(outDir, { recursive: true });
    const written = await writeLabelatorPackage(build, outDir, {
      mkdir: async (path, opts) => {
        await mkdir(path, { recursive: opts?.recursive ?? true });
      },
      writeFile: async (path, data) => {
        await writeFile(path, data);
      },
      join,
      dirname,
    });
    const zipBytes = new Uint8Array(await readFile(written.zipPath));
    const validation = validateLabelatorPackageZip(zipBytes);
    expect(validation.ok, JSON.stringify(validation.issues, null, 2)).toBe(true);
    expect(written.fileName).toBe(`${FIXED_GA_A4_PACKAGE_NAME}.labelator`);
    expect(JSON.stringify(library)).toBe(before);
  });
});
