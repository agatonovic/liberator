import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LabelDocument } from "../document";
import { repairTemplateDocument } from "../document";
import {
  buildLabelatorPackage,
  type ExportLabelatorPackageOptions,
  type PackageFontInput,
} from "./index";

/** Live Industrial library document for CDC A3. */
export const CDC_A3_TEMPLATE_ID = "3085002f-b6ce-4feb-bfb5-62f111cd9645";
export const CDC_A3_CATALOG_ID = "cdc_a3";

export const CDC_A3_PACKAGE_EXPORTED_AT = "2026-09-14T00:00:00.000Z";
export const CDC_A3_PACKAGE_VERSION = "1";
export const CDC_A3_PACKAGE_NAME = "CDC_A3_v1";

/** Repair is a no-op for bindings on this document. Export still uses the print-time clone. */
export function cdcA3DocumentForExport(doc: LabelDocument): LabelDocument {
  return repairTemplateDocument(structuredClone(doc));
}

export function loadCdcA3FontInputs(repoRoot: string): PackageFontInput[] {
  const black = readFileSync(join(repoRoot, "public/fonts/ArtifaktElement-Black.otf"));
  const openBold = readFileSync(join(repoRoot, "vendor/fonts/OpenSans-Bold.woff"));
  return [
    {
      family: "Artifakt Element Black",
      weight: 400,
      fileName: "ArtifaktElement-Black.otf",
      format: "otf",
      bytes: new Uint8Array(black),
      source: "public/fonts/ArtifaktElement-Black.otf (same file LABELATOR uses for weight 400 and 700)",
    },
    {
      family: "Artifakt Element Black",
      weight: 700,
      fileName: "ArtifaktElement-Black.otf",
      format: "otf",
      bytes: new Uint8Array(black),
      source: "public/fonts/ArtifaktElement-Black.otf",
    },
    {
      family: "Open Sans",
      weight: 700,
      fileName: "OpenSans-Bold.woff",
      format: "woff",
      bytes: new Uint8Array(openBold),
      source: "vendor/fonts/OpenSans-Bold.woff",
    },
  ];
}

export function cdcA3ExportOptions(repoRoot: string): ExportLabelatorPackageOptions {
  return {
    exportScope: "working",
    exportedAt: CDC_A3_PACKAGE_EXPORTED_AT,
    templateVersion: CDC_A3_PACKAGE_VERSION,
    packageName: CDC_A3_PACKAGE_NAME,
    fonts: loadCdcA3FontInputs(repoRoot),
    assets: [],
  };
}

export function buildCdcA3Package(doc: LabelDocument, repoRoot: string) {
  if (doc.id !== CDC_A3_TEMPLATE_ID && doc.catalogId !== CDC_A3_CATALOG_ID) {
    throw new Error(
      `Expected live CDC A3 document (${CDC_A3_TEMPLATE_ID} / ${CDC_A3_CATALOG_ID}), got id=${doc.id} catalogId=${doc.catalogId}`,
    );
  }
  return buildLabelatorPackage(cdcA3DocumentForExport(doc), cdcA3ExportOptions(repoRoot));
}
