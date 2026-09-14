import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LabelDocument } from "../document";
import { repairTemplateDocument } from "../document";
import {
  buildLabelatorPackage,
  type ExportLabelatorPackageOptions,
  type PackageFontInput,
} from "./index";

/** Live Industrial library document id for FIXED GA A4. */
export const FIXED_GA_A4_TEMPLATE_ID = "ff9a7d76-b9a8-4b29-a861-612b6142c9a9";
export const FIXED_GA_A4_CATALOG_ID = "fixed_ga_a4";

export const FIXED_GA_A4_PACKAGE_EXPORTED_AT = "2026-09-14T00:00:00.000Z";
export const FIXED_GA_A4_PACKAGE_VERSION = "1";
export const FIXED_GA_A4_PACKAGE_NAME = "FIXED_GA_A4_v1";

/** Print-time repairs only. Does not write library.json. */
export function fixedGaA4DocumentForExport(doc: LabelDocument): LabelDocument {
  return repairTemplateDocument(structuredClone(doc));
}

export function loadFixedGaA4FontInputs(repoRoot: string): PackageFontInput[] {
  const black = readFileSync(join(repoRoot, "public/fonts/ArtifaktElement-Black.otf"));
  const regular = readFileSync(join(repoRoot, "public/fonts/ArtifaktElement.ttf"));
  const openBold = readFileSync(join(repoRoot, "vendor/fonts/OpenSans-Bold.woff"));
  return [
    {
      family: "Artifakt Element",
      weight: 400,
      fileName: "ArtifaktElement.ttf",
      format: "ttf",
      bytes: new Uint8Array(regular),
      source: "public/fonts/ArtifaktElement.ttf",
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
      source:
        "Pinned bytes from fonts.googleapis.com/css2 Open Sans wght@700 (Firefox UA), same endpoint as src/lib/fonts.ts",
    },
  ];
}

export function fixedGaA4ExportOptions(repoRoot: string): ExportLabelatorPackageOptions {
  return {
    exportScope: "working",
    exportedAt: FIXED_GA_A4_PACKAGE_EXPORTED_AT,
    templateVersion: FIXED_GA_A4_PACKAGE_VERSION,
    packageName: FIXED_GA_A4_PACKAGE_NAME,
    fonts: loadFixedGaA4FontInputs(repoRoot),
    assets: [],
    // Designed packing is 2-up on A4 landscape. Existing A3/GA packages omit this and stay 1-up.
    printMode: "sheet",
  };
}

export function buildFixedGaA4Package(doc: LabelDocument, repoRoot: string) {
  if (doc.id !== FIXED_GA_A4_TEMPLATE_ID && doc.catalogId !== FIXED_GA_A4_CATALOG_ID) {
    throw new Error(
      `Expected live FIXED GA A4 document (${FIXED_GA_A4_TEMPLATE_ID} / ${FIXED_GA_A4_CATALOG_ID}), got id=${doc.id} catalogId=${doc.catalogId}`,
    );
  }
  return buildLabelatorPackage(fixedGaA4DocumentForExport(doc), fixedGaA4ExportOptions(repoRoot));
}
