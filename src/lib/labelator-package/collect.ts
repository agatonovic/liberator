import type { DataColumn, LabelDocument, LabelElement } from "../document";
import { columnAliases, findColumnByName } from "../document";
import { assetLookupKey } from "../assets";
import { resolveFontFamily } from "../fonts";
import type {
  LabelatorPackageAssetCollection,
  LabelatorPackageAssetsIndex,
  LabelatorPackageDataField,
  PackageAssetInput,
  PackageFontInput,
} from "./types";

export function collectRequiredTransforms(doc: LabelDocument): string[] {
  const set = new Set<string>();
  for (const element of doc.elements) {
    const transform = element.transform?.trim();
    if (transform) set.add(transform);
  }
  return [...set].sort();
}

export function collectFontFamilies(doc: LabelDocument): string[] {
  const set = new Set<string>();
  for (const element of doc.elements) {
    if (element.type !== "text") continue;
    set.add(resolveFontFamily(element.style.fontFamily));
  }
  return [...set].sort();
}

/** Weights actually used by text elements for a family (defaults to both if family appears). */
export function collectFontWeights(doc: LabelDocument, family: string): Array<400 | 700> {
  const resolved = resolveFontFamily(family);
  const weights = new Set<400 | 700>();
  for (const element of doc.elements) {
    if (element.type !== "text") continue;
    if (resolveFontFamily(element.style.fontFamily) !== resolved) continue;
    weights.add(element.style.fontWeight === "bold" ? 700 : 400);
  }
  return weights.size ? ([...weights].sort() as Array<400 | 700>) : [400, 700];
}

function bindingStrings(element: LabelElement): string[] {
  return [element.binding, element.fallbackBinding]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

export function buildDataContract(doc: LabelDocument): LabelatorPackageDataField[] {
  const columns = doc.dataColumns ?? [];
  const fields: LabelatorPackageDataField[] = [];
  const coveredBindings = new Set<string>();

  for (const column of columns) {
    const aliases = columnAliases(column);
    const elementBindings = [
      ...new Set(
        doc.elements.flatMap((element) =>
          bindingStrings(element).filter((binding) => {
            const match = findColumnByName(columns, binding);
            return match?.key === column.key || aliases.some((alias) => alias.toLowerCase() === binding.toLowerCase());
          }),
        ),
      ),
    ].sort();
    for (const binding of elementBindings) coveredBindings.add(binding.toLowerCase());
    fields.push({
      key: column.key,
      label: column.label,
      aliases: [...new Set(aliases)],
      required: column.required !== false,
      example: column.example,
      elementBindings,
    });
  }

  // Bindings that do not map to a declared dataColumn (still part of the contract).
  const orphan = new Map<string, string[]>();
  for (const element of doc.elements) {
    for (const binding of bindingStrings(element)) {
      if (coveredBindings.has(binding.toLowerCase())) continue;
      if (findColumnByName(columns, binding)) continue;
      const list = orphan.get(binding) ?? [];
      list.push(element.id);
      orphan.set(binding, list);
    }
  }
  for (const [binding, elementIds] of [...orphan.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    fields.push({
      key: binding,
      aliases: [binding],
      required: false,
      elementBindings: [binding],
      label: binding,
      example: undefined,
    });
    void elementIds;
  }

  return fields;
}

export function portableCollectionIdForFolder(
  doc: LabelDocument,
  assetFolderId: string,
  columns: DataColumn[],
): string {
  const image = doc.elements.find(
    (element) => element.type === "image" && element.assetFolderId === assetFolderId,
  );
  if (image?.binding?.trim()) {
    const column = findColumnByName(columns, image.binding);
    if (column) return column.key;
    if (image.binding === "packaging" || /packag|pakov/i.test(image.binding)) return "packaging";
    return assetLookupKey(image.binding) || image.binding.trim().toLowerCase();
  }
  if (assetFolderId === "asset-folder-packaging") return "packaging";
  return assetFolderId.replace(/^asset-folder-/, "") || "assets";
}

export function collectAssetFolderIds(doc: LabelDocument): string[] {
  const set = new Set<string>();
  for (const element of doc.elements) {
    if (element.type === "image" && element.assetFolderId?.trim()) {
      set.add(element.assetFolderId.trim());
    }
  }
  return [...set].sort();
}

export function buildAssetsIndex(
  doc: LabelDocument,
  assets: PackageAssetInput[],
): LabelatorPackageAssetsIndex {
  const columns = doc.dataColumns ?? [];
  const byCollection = new Map<string, LabelatorPackageAssetCollection>();

  for (const folderId of collectAssetFolderIds(doc)) {
    const id = portableCollectionIdForFolder(doc, folderId, columns);
    byCollection.set(id, {
      id,
      labelatorAssetFolderId: folderId,
      entries: {},
    });
  }

  for (const asset of assets) {
    const id = asset.collection.trim();
    if (!id) continue;
    const existing = byCollection.get(id) ?? {
      id,
      labelatorAssetFolderId: asset.labelatorAssetFolderId,
      entries: {},
    };
    if (asset.labelatorAssetFolderId && !existing.labelatorAssetFolderId) {
      existing.labelatorAssetFolderId = asset.labelatorAssetFolderId;
    }
    const stem = assetLookupKey(asset.stem) || asset.stem.trim().toLowerCase();
    existing.entries[stem] = asset.relativePath.replace(/\\/g, "/").replace(/^assets\//, "");
    byCollection.set(id, existing);
  }

  return {
    schemaVersion: 1,
    collections: [...byCollection.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function assertFontsCoverDocument(doc: LabelDocument, fonts: PackageFontInput[]): string[] {
  const missing: string[] = [];
  for (const family of collectFontFamilies(doc)) {
    for (const weight of collectFontWeights(doc, family)) {
      const hit = fonts.find(
        (font) => resolveFontFamily(font.family) === family && font.weight === weight,
      );
      if (!hit) missing.push(`${family} weight ${weight}`);
    }
  }
  return missing;
}

export function packageSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "template"
  );
}
