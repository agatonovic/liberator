import { assetLookupKey, findAssetByValue, type AssetFolder, type AssetRecord } from "../assets";
import type { LabelDocument } from "../document";
import { findColumnByName } from "../document";
import { resolveFontFamily } from "../fonts";
import { publicPath } from "../public-path";
import { collectFontWeights, portableCollectionIdForFolder } from "./collect";
import { packageFontInput, portableFontSource } from "./portable-fonts";
import { buildPortableLabelatorPackage } from "./portable-export";
import type { PackageAssetInput, PackageFontInput } from "./types";

export type PortableAssetLibrary = {
  assets: AssetRecord[];
  folders: AssetFolder[];
  /** Resolve an asset record to bytes. Blob URLs and public paths both work in the browser. */
  readBytes: (asset: AssetRecord) => Promise<Uint8Array | null>;
};

function exampleValues(document: LabelDocument, binding: string | undefined): string[] {
  const key = binding?.trim();
  if (!key) return [];
  const column = findColumnByName(document.dataColumns ?? [], key);
  const values = [column?.example, ...(column?.values ?? [])].filter((value): value is string => Boolean(value?.trim()));
  return [...new Set(values)];
}

/**
 * Package image files the template already points at by example or static content.
 * Production row values that are not in the template are not guessed.
 */
export async function collectExampleAssets(
  document: LabelDocument,
  library: PortableAssetLibrary,
): Promise<PackageAssetInput[]> {
  const columns = document.dataColumns ?? [];
  const packaged: PackageAssetInput[] = [];
  const seen = new Set<string>();

  for (const element of document.elements) {
    if (element.type !== "image" || !element.assetFolderId) continue;
    const collection = portableCollectionIdForFolder(document, element.assetFolderId, columns);
    const candidates = [
      ...exampleValues(document, element.binding),
      element.content?.trim() ?? "",
    ].filter(Boolean);
    for (const value of candidates) {
      const record = findAssetByValue(library.assets, element.assetFolderId, value, library.folders);
      if (!record) continue;
      const stem = assetLookupKey(record.stem || record.name || value);
      const key = `${collection}:${stem}`;
      if (!stem || seen.has(key)) continue;
      const bytes = await library.readBytes(record);
      if (!bytes?.byteLength) continue;
      seen.add(key);
      const fileName = record.name?.trim() || `${stem}.bin`;
      packaged.push({
        collection,
        labelatorAssetFolderId: element.assetFolderId,
        stem,
        relativePath: `${collection}/${fileName}`,
        bytes,
        mime: record.mime || "application/octet-stream",
      });
    }
  }

  return packaged;
}

export async function loadPinnedFontInputs(
  document: LabelDocument,
  readPublic: (path: string) => Promise<Uint8Array>,
): Promise<PackageFontInput[]> {
  const inputs: PackageFontInput[] = [];
  const families = [
    ...new Set(
      document.elements
        .filter((element) => element.type === "text")
        .map((element) => resolveFontFamily(element.style.fontFamily)),
    ),
  ];
  for (const family of families) {
    for (const weight of collectFontWeights(document, family)) {
      const source = portableFontSource(family, weight);
      if (!source) continue;
      const bytes = await readPublic(source.publicPath);
      inputs.push(packageFontInput(source, bytes));
    }
  }
  return inputs;
}

async function fetchPublicBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(publicPath(path));
  if (!response.ok) throw new Error(`Could not read packaged font ${path} (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function readAssetRecordBytes(asset: AssetRecord): Promise<Uint8Array | null> {
  if (!asset.url) return null;
  const response = await fetch(asset.url);
  if (!response.ok) return null;
  return new Uint8Array(await response.arrayBuffer());
}

/** Browser download. Uses the existing exporter. Does not save the template. */
export async function exportPortableLabelatorFile(
  document: LabelDocument,
  options: {
    printMode?: "label" | "sheet";
    assets?: PortableAssetLibrary;
    exportedAt?: string;
  } = {},
) {
  const fonts = await loadPinnedFontInputs(document, fetchPublicBytes);
  const assets = options.assets ? await collectExampleAssets(document, options.assets) : [];
  return buildPortableLabelatorPackage(document, {
    exportScope: "working",
    exportedAt: options.exportedAt,
    printMode: options.printMode,
    fonts,
    assets,
  });
}
