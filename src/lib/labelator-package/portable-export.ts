import type { LabelDocument } from "../document";
import { buildLabelatorPackage, packageBuildToZipBytes } from "./export";
import type { ExportLabelatorPackageOptions, LabelatorPackageBuild } from "./types";

export type PortablePackageBuild = {
  document: LabelDocument;
  build: LabelatorPackageBuild;
  bytes: Uint8Array;
  fileName: string;
};

/**
 * Designer / product export. Wraps `buildLabelatorPackage` on a clone so the
 * working template is not mutated. Does not write IndexedDB or library.json.
 *
 * Pass the same document and options the existing exporter uses and the ZIP
 * matches, aside from `exportedAt` when the caller leaves that unset.
 *
 * `printMode: "label"` is omitted so the package stays 1-up, matching the v1
 * rule that an absent `print` field is one sticker per page.
 */
export function buildPortableLabelatorPackage(
  document: LabelDocument,
  options: ExportLabelatorPackageOptions,
): PortablePackageBuild {
  const clone = structuredClone(document);
  const printMode = options.printMode === "sheet" ? "sheet" : undefined;
  const build = buildLabelatorPackage(clone, {
    ...options,
    exportScope: options.exportScope ?? "working",
    templateVersion: options.templateVersion ?? String(clone.versionNumber ?? 1),
    printMode,
  });
  return {
    document: clone,
    build,
    bytes: packageBuildToZipBytes(build),
    fileName: build.fileName,
  };
}
