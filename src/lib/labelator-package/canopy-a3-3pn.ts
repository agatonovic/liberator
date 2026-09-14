import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LabelDocument } from "../document";
import { repairTemplateDocument } from "../document";
import {
  buildLabelatorPackage,
  type ExportLabelatorPackageOptions,
  type PackageFontInput,
} from "./index";

/** Live Industrial library document for Canopy A3 — 3 PN. */
export const CANOPY_A3_3PN_TEMPLATE_ID = "6060f5ce-7572-44a4-b085-9845557f62df";
export const CANOPY_A3_3PN_CATALOG_ID = "canopy_a3_3pn";

export const CANOPY_A3_3PN_PACKAGE_EXPORTED_AT = "2026-09-14T00:00:00.000Z";
export const CANOPY_A3_3PN_PACKAGE_VERSION = "1";
export const CANOPY_A3_3PN_PACKAGE_NAME = "Canopy_A3_3_PN_v1";

/**
 * Print-time repairs bind the three designed part-number lines to ref1–ref3
 * and split qty boxes that were all on qty1. Does not write library.json.
 */
export function canopyA3ThreePnDocumentForExport(doc: LabelDocument): LabelDocument {
  return repairTemplateDocument(structuredClone(doc));
}

export function loadCanopyA3ThreePnFontInputs(repoRoot: string): PackageFontInput[] {
  const black = readFileSync(join(repoRoot, "public/fonts/ArtifaktElement-Black.otf"));
  const openRegular = readFileSync(join(repoRoot, "vendor/fonts/OpenSans-Regular.woff"));
  const openBold = readFileSync(join(repoRoot, "vendor/fonts/OpenSans-Bold.woff"));
  const interBold = readFileSync(join(repoRoot, "vendor/fonts/Inter-Bold.woff"));
  return [
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
      source:
        "Pinned bytes from fonts.googleapis.com/css2 Inter wght@700 (Firefox UA), same endpoint as src/lib/fonts.ts fetchFontBytes — gstatic serves WOFF",
    },
  ];
}

export function canopyA3ThreePnExportOptions(repoRoot: string): ExportLabelatorPackageOptions {
  return {
    exportScope: "working",
    exportedAt: CANOPY_A3_3PN_PACKAGE_EXPORTED_AT,
    templateVersion: CANOPY_A3_3PN_PACKAGE_VERSION,
    packageName: CANOPY_A3_3PN_PACKAGE_NAME,
    fonts: loadCanopyA3ThreePnFontInputs(repoRoot),
    assets: [],
  };
}

export function buildCanopyA3ThreePnPackage(doc: LabelDocument, repoRoot: string) {
  if (doc.id !== CANOPY_A3_3PN_TEMPLATE_ID && doc.catalogId !== CANOPY_A3_3PN_CATALOG_ID) {
    throw new Error(
      `Expected live Canopy A3 3 PN document (${CANOPY_A3_3PN_TEMPLATE_ID} / ${CANOPY_A3_3PN_CATALOG_ID}), got id=${doc.id} catalogId=${doc.catalogId}`,
    );
  }
  return buildLabelatorPackage(canopyA3ThreePnDocumentForExport(doc), canopyA3ThreePnExportOptions(repoRoot));
}
