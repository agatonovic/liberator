import publishedIndex from "./published-index.json";
import type { LabelDocument } from "../document";
import { repairTemplateDocument } from "../document";
import { buildLabelatorPackage } from "./export";
import { defaultPortablePrintMode } from "./compatibility";
import type { ExportLabelatorPackageOptions, LabelatorPackageBuild, PackageAssetInput, PackageFontInput } from "./types";

/** Stable clock so a regenerated catalog package does not change because of wall time. */
export const CATALOG_PACKAGE_EXPORTED_AT = "2026-09-14T00:00:00.000Z";

export const PUBLISHED_LABELATOR_HREF_PREFIX = "/downloads/labelator";

/**
 * Validated catalog jobs whose published file must stay 1-up so it matches the
 * frozen proof. A sheet in the document is not a print job. New templates are
 * not in this set; they use the generic multi-up default.
 */
const VALIDATED_ONE_UP_CATALOG_IDS = new Set(["ga_warehouse_a3"]);

export function catalogPackageStem(name: string): string {
  const ascii = name.normalize("NFD").replace(/\p{M}/gu, "");
  const words = ascii.trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  const tokens = words.map((word) => {
    if (word === word.toUpperCase()) return word;
    if (word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase()) return word;
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
  });
  return `${tokens.join("_") || "template"}_v1`;
}

export function catalogPackageFileName(name: string): string {
  return `${catalogPackageStem(name)}.labelator`;
}

export function catalogPrintMode(document: LabelDocument): "label" | "sheet" {
  if (document.catalogId && VALIDATED_ONE_UP_CATALOG_IDS.has(document.catalogId)) return "label";
  return defaultPortablePrintMode(document);
}

export function catalogDocumentForExport(document: LabelDocument): LabelDocument {
  return repairTemplateDocument(structuredClone(document));
}

/**
 * Published catalog package. Content comes from `buildLabelatorPackage` only.
 * Does not mutate the source document.
 */
export function buildCatalogLabelatorPackage(
  document: LabelDocument,
  options: {
    fonts: PackageFontInput[];
    assets?: PackageAssetInput[];
    printMode?: "label" | "sheet";
    exportedAt?: string;
  },
): LabelatorPackageBuild {
  const working = catalogDocumentForExport(document);
  const printMode = options.printMode ?? catalogPrintMode(working);
  const exportOptions: ExportLabelatorPackageOptions = {
    exportScope: "working",
    exportedAt: options.exportedAt ?? CATALOG_PACKAGE_EXPORTED_AT,
    templateVersion: "1",
    packageName: catalogPackageStem(working.name),
    fonts: options.fonts,
    assets: options.assets ?? [],
    printMode: printMode === "sheet" ? "sheet" : undefined,
  };
  return buildLabelatorPackage(working, exportOptions);
}

export type PublishedPackageRecord = {
  name: string;
  fileName: string;
  href: string;
  sha256: string;
  pageMm: string;
  printMode: "1-up" | "sheet";
  templateId: string;
  catalogId: string | null;
};

export function publishedHref(fileName: string): string {
  return `${PUBLISHED_LABELATOR_HREF_PREFIX}/${fileName}`;
}

export function publishedPackages(): PublishedPackageRecord[] {
  return publishedIndex.packages as PublishedPackageRecord[];
}

export function publishedPackageFor(document: { id: string; catalogId?: string | null }): PublishedPackageRecord | undefined {
  const packages = publishedPackages();
  return (
    packages.find((item) => item.templateId === document.id) ??
    (document.catalogId ? packages.find((item) => item.catalogId === document.catalogId) : undefined)
  );
}
