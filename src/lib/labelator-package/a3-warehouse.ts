import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LabelDocument } from "../document";
import { PACKAGING_FOLDER_ID } from "../assets";
import {
  buildLabelatorPackage,
  type ExportLabelatorPackageOptions,
  type PackageAssetInput,
  type PackageFontInput,
} from "./index";

/** Live Industrial library document id for Warehouse A3 Final. */
export const A3_WAREHOUSE_TEMPLATE_ID = "ee4837ef-c0f7-4ac9-8612-a689518ad7b0";
export const A3_WAREHOUSE_CATALOG_ID = "warehouse_a3";

/** Fixed timestamp so functional package contents stay stable across exports. */
export const A3_WAREHOUSE_PACKAGE_EXPORTED_AT = "2026-09-05T00:00:00.000Z";
export const A3_WAREHOUSE_PACKAGE_VERSION = "1";
export const A3_WAREHOUSE_PACKAGE_NAME = "Warehouse_A3_Final_v1";

/**
 * Deterministic golden-test packaging codes (Phase A).
 * Only these real files are bundled — not the entire packaging library.
 */
export const A3_WAREHOUSE_TEST_PACKAGING_STEMS = ["X4202"] as const;

export function loadA3WarehouseFontInputs(repoRoot: string): PackageFontInput[] {
  const artifakt = readFileSync(join(repoRoot, "public/fonts/ArtifaktElement-Black.otf"));
  const openRegular = readFileSync(join(repoRoot, "vendor/fonts/OpenSans-Regular.woff"));
  const openBold = readFileSync(join(repoRoot, "vendor/fonts/OpenSans-Bold.woff"));
  return [
    {
      family: "Artifakt Element Black",
      weight: 400,
      fileName: "ArtifaktElement-Black.otf",
      format: "otf",
      bytes: new Uint8Array(artifakt),
      source: "public/fonts/ArtifaktElement-Black.otf",
    },
    {
      family: "Artifakt Element Black",
      weight: 700,
      fileName: "ArtifaktElement-Black.otf",
      format: "otf",
      bytes: new Uint8Array(artifakt),
      source: "public/fonts/ArtifaktElement-Black.otf",
    },
    {
      family: "Open Sans",
      weight: 400,
      fileName: "OpenSans-Regular.woff",
      format: "woff",
      bytes: new Uint8Array(openRegular),
      source:
        "Pinned bytes from fonts.googleapis.com/css2 Open Sans wght@400 (Firefox UA), same endpoint as src/lib/fonts.ts fetchFontBytes — gstatic currently serves WOFF",
    },
    {
      family: "Open Sans",
      weight: 700,
      fileName: "OpenSans-Bold.woff",
      format: "woff",
      bytes: new Uint8Array(openBold),
      source:
        "Pinned bytes from fonts.googleapis.com/css2 Open Sans wght@700 (Firefox UA), same endpoint as src/lib/fonts.ts fetchFontBytes — gstatic currently serves WOFF",
    },
  ];
}

export function loadA3WarehouseAssetInputs(repoRoot: string): PackageAssetInput[] {
  return A3_WAREHOUSE_TEST_PACKAGING_STEMS.map((stem) => {
    const fileName = `${stem}.jpg`;
    const bytes = new Uint8Array(readFileSync(join(repoRoot, "public/assets/packaging", fileName)));
    return {
      collection: "packaging",
      labelatorAssetFolderId: PACKAGING_FOLDER_ID,
      stem,
      relativePath: `packaging/${fileName}`,
      bytes,
      mime: "image/jpeg",
    };
  });
}

export function a3WarehouseExportOptions(repoRoot: string): ExportLabelatorPackageOptions {
  return {
    exportScope: "working",
    exportedAt: A3_WAREHOUSE_PACKAGE_EXPORTED_AT,
    templateVersion: A3_WAREHOUSE_PACKAGE_VERSION,
    packageName: A3_WAREHOUSE_PACKAGE_NAME,
    fonts: loadA3WarehouseFontInputs(repoRoot),
    assets: loadA3WarehouseAssetInputs(repoRoot),
  };
}

/** Build the portable A3 Warehouse package from an already-loaded LabelDocument (read-only). */
export function buildA3WarehousePackage(doc: LabelDocument, repoRoot: string) {
  if (doc.id !== A3_WAREHOUSE_TEMPLATE_ID && doc.catalogId !== A3_WAREHOUSE_CATALOG_ID) {
    throw new Error(
      `Expected live Warehouse A3 document (${A3_WAREHOUSE_TEMPLATE_ID} / ${A3_WAREHOUSE_CATALOG_ID}), got id=${doc.id} catalogId=${doc.catalogId}`,
    );
  }
  return buildLabelatorPackage(doc, a3WarehouseExportOptions(repoRoot));
}
