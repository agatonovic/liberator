import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LabelDocument } from "../document";
import { repairTemplateDocument } from "../document";
import {
  buildLabelatorPackage,
  type ExportLabelatorPackageOptions,
  type PackageFontInput,
} from "./index";

/** Live Industrial library document id for GA Address. */
export const GA_ADDRESS_TEMPLATE_ID = "0a9b4a95-985c-487d-a58e-057a5e45ba57";
export const GA_ADDRESS_CATALOG_ID = "ga_warehouse_a3";

export const GA_ADDRESS_PACKAGE_EXPORTED_AT = "2026-09-14T00:00:00.000Z";
export const GA_ADDRESS_PACKAGE_VERSION = "1";
export const GA_ADDRESS_PACKAGE_NAME = "GA_Address_v1";

/**
 * Package the document LABELATOR actually prints.
 * Stored library.json is pre-repair: the arrow has no binding.
 * `repairTemplateDocument` (hydrate / ensurePrintGrid) binds that arrow to the
 * `arrow` column. Exporting the repaired clone does not write library.json.
 */
export function gaAddressDocumentForExport(doc: LabelDocument): LabelDocument {
  return repairTemplateDocument(structuredClone(doc));
}

export function loadGaAddressFontInputs(repoRoot: string): PackageFontInput[] {
  const black = readFileSync(join(repoRoot, "public/fonts/ArtifaktElement-Black.otf"));
  const regular = readFileSync(join(repoRoot, "public/fonts/ArtifaktElement.ttf"));
  const bold = readFileSync(join(repoRoot, "public/fonts/ArtifaktElement-Bold.ttf"));
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
      family: "Artifakt Element",
      weight: 700,
      fileName: "ArtifaktElement-Bold.ttf",
      format: "ttf",
      bytes: new Uint8Array(bold),
      source: "public/fonts/ArtifaktElement-Bold.ttf",
    },
    {
      family: "Artifakt Element Black",
      weight: 700,
      fileName: "ArtifaktElement-Black.otf",
      format: "otf",
      bytes: new Uint8Array(black),
      source: "public/fonts/ArtifaktElement-Black.otf",
    },
  ];
}

export function gaAddressExportOptions(repoRoot: string): ExportLabelatorPackageOptions {
  return {
    exportScope: "working",
    exportedAt: GA_ADDRESS_PACKAGE_EXPORTED_AT,
    templateVersion: GA_ADDRESS_PACKAGE_VERSION,
    packageName: GA_ADDRESS_PACKAGE_NAME,
    fonts: loadGaAddressFontInputs(repoRoot),
    assets: [],
  };
}

/** Build the portable GA Address package from an already-loaded LabelDocument (read-only). */
export function buildGaAddressPackage(doc: LabelDocument, repoRoot: string) {
  if (doc.id !== GA_ADDRESS_TEMPLATE_ID && doc.catalogId !== GA_ADDRESS_CATALOG_ID) {
    throw new Error(
      `Expected live GA Address document (${GA_ADDRESS_TEMPLATE_ID} / ${GA_ADDRESS_CATALOG_ID}), got id=${doc.id} catalogId=${doc.catalogId}`,
    );
  }
  return buildLabelatorPackage(gaAddressDocumentForExport(doc), gaAddressExportOptions(repoRoot));
}
