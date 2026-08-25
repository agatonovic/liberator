export const PACKAGING_FOLDER_ID = "asset-folder-packaging";

export type AssetKind = "static" | "blob";

export type AssetFolder = {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
};

export type AssetRecord = {
  id: string;
  folderId: string;
  name: string;
  stem: string;
  mime: string;
  bytes: number;
  kind: AssetKind;
  url?: string;
  width?: number;
  height?: number;
  createdAt: string;
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|svg)$/i;

export function assetLookupKey(value: string): string {
  const base = value.trim().split(/[/\\]/).pop() ?? "";
  return base.replace(IMAGE_EXT, "").trim().toLowerCase();
}

export function mimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return "image/jpeg";
}

export function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT.test(file.name);
}

export function formatBytes(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function childFolders(folders: AssetFolder[], parentId?: string) {
  return folders
    .filter((folder) => (parentId ? folder.parentId === parentId : !folder.parentId || !folders.some((item) => item.id === folder.parentId)))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function folderAncestors(folders: AssetFolder[], id: string): AssetFolder[] {
  const chain: AssetFolder[] = [];
  const seen = new Set<string>();
  let current = folders.find((folder) => folder.id === id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? folders.find((folder) => folder.id === current?.parentId) : undefined;
  }
  return chain;
}

export function folderPath(folders: AssetFolder[], id: string): string {
  return folderAncestors(folders, id)
    .map((folder) => folder.name)
    .join(" / ");
}

export function folderDescendantIds(folders: AssetFolder[], id: string): string[] {
  const ids = [id];
  for (const child of folders.filter((folder) => folder.parentId === id)) {
    ids.push(...folderDescendantIds(folders, child.id));
  }
  return ids;
}

export function folderDepth(folders: AssetFolder[], id?: string): number {
  if (!id) return 0;
  return folderAncestors(folders, id).length;
}

export function findAssetByValue(
  assets: AssetRecord[],
  folderId: string | undefined,
  value: string,
  folders: AssetFolder[] = [],
): AssetRecord | undefined {
  if (!folderId || !value.trim()) return undefined;
  const key = assetLookupKey(value);
  if (!key) return undefined;
  const exact = value.trim().toLowerCase();
  const scope = folders.length ? folderDescendantIds(folders, folderId) : [folderId];
  const matches = (asset: AssetRecord) => asset.stem === key || asset.name.toLowerCase() === exact;
  const inFolder = assets.find((asset) => asset.folderId === folderId && matches(asset));
  if (inFolder) return inFolder;
  return assets.find((asset) => scope.includes(asset.folderId) && matches(asset));
}

const objectUrls = new Map<string, string>();

export function rememberObjectUrl(id: string, blob: Blob): string {
  const previous = objectUrls.get(id);
  if (previous) URL.revokeObjectURL(previous);
  const url = URL.createObjectURL(blob);
  objectUrls.set(id, url);
  return url;
}

export function forgetObjectUrl(id: string) {
  const previous = objectUrls.get(id);
  if (previous) URL.revokeObjectURL(previous);
  objectUrls.delete(id);
}

export function assetSrc(asset: AssetRecord | undefined): string | undefined {
  if (!asset) return undefined;
  if (asset.kind === "static" && asset.url) return asset.url;
  return objectUrls.get(asset.id);
}

export function resolveBoundImageSrc(
  element: { assetFolderId?: string; imageDataUrl?: string },
  value: string,
  assets: AssetRecord[],
  folders: AssetFolder[] = [],
): string | undefined {
  const bound = findAssetByValue(assets, element.assetFolderId, value, folders);
  return assetSrc(bound);
}
