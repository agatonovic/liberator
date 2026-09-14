import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LabelDocument } from "../document";
import { repairTemplateDocument } from "../document";
import {
  buildLabelatorPackage,
  type ExportLabelatorPackageOptions,
  type PackageFontInput,
} from "./index";

/** Live Industrial library document for Canopy A3 — 1 PN. catalogId is null on the live record. */
export const CANOPY_A3_1PN_TEMPLATE_ID = "14057388-ae40-4251-a03d-d9cb77a5d0e4";

export const CANOPY_A3_1PN_PACKAGE_EXPORTED_AT = "2026-09-14T00:00:00.000Z";
export const CANOPY_A3_1PN_PACKAGE_VERSION = "1";
export const CANOPY_A3_1PN_PACKAGE_NAME = "Canopy_A3_1_PN_v1";

/** Schema and part_number are already applied on the live record. Export still uses the print-time clone. */
export function canopyA3OnePnDocumentForExport(doc: LabelDocument): LabelDocument {
  return repairTemplateDocument(structuredClone(doc));
}

export function loadCanopyA3OnePnFontInputs(repoRoot: string): PackageFontInput[] {
  const openRegular = readFileSync(join(repoRoot, "vendor/fonts/OpenSans-Regular.woff"));
  const openBold = readFileSync(join(repoRoot, "vendor/fonts/OpenSans-Bold.woff"));
  const interBold = readFileSync(join(repoRoot, "vendor/fonts/Inter-Bold.woff"));
  return [
    {
      family: "Open Sans",
      weight: 400,
      fileName: "OpenSans-Regular.woff",
      format: "woff",
      bytes: new Uint8Array(openRegular),
      source: "vendor/fonts/OpenSans-Regular.woff",
    },
    {
      family: "Open Sans",
      weight: 700,
      fileName: "OpenSans-Bold.woff",
      format: "woff",
      bytes: new Uint8Array(openBold),
      source: "vendor/fonts/OpenSans-Bold.woff",
    },
    {
      family: "Inter",
      weight: 700,
      fileName: "Inter-Bold.woff",
      format: "woff",
      bytes: new Uint8Array(interBold),
      source: "vendor/fonts/Inter-Bold.woff",
    },
  ];
}

export function canopyA3OnePnExportOptions(repoRoot: string): ExportLabelatorPackageOptions {
  return {
    exportScope: "working",
    exportedAt: CANOPY_A3_1PN_PACKAGE_EXPORTED_AT,
    templateVersion: CANOPY_A3_1PN_PACKAGE_VERSION,
    packageName: CANOPY_A3_1PN_PACKAGE_NAME,
    fonts: loadCanopyA3OnePnFontInputs(repoRoot),
    assets: [],
  };
}

export function buildCanopyA3OnePnPackage(doc: LabelDocument, repoRoot: string) {
  if (doc.id !== CANOPY_A3_1PN_TEMPLATE_ID) {
    throw new Error(`Expected live Canopy A3 1 PN document (${CANOPY_A3_1PN_TEMPLATE_ID}), got id=${doc.id}`);
  }
  return buildLabelatorPackage(canopyA3OnePnDocumentForExport(doc), canopyA3OnePnExportOptions(repoRoot));
}
