import { create } from "zustand";
import {
  deleteAssetMedia,
  loadAssetLibrary,
  markAssetWorkspaceMigrated,
  markPackagingSeeded,
  putAssetBlob,
  putAssetThumb,
  saveAssetFolders,
  saveAssetRecords,
} from "./asset-db";
import {
  PACKAGING_FOLDER_ID,
  assetLookupKey,
  folderDescendantIds,
  forgetObjectUrl,
  isImageFile,
  mimeFromName,
  rememberObjectUrl,
  type AssetFolder,
  type AssetRecord,
} from "./assets";
import { createId } from "./ids";
import { publicPath } from "./public-path";
import { STELLANTIS_ORG_ID, WORKSPACE_MIGRATION_REV } from "./domain";
import { useAppStore } from "./store";

export type AssetStore = {
  hydrated: boolean;
  folders: AssetFolder[];
  assets: AssetRecord[];
  thumbUrls: Record<string, string>;
  hydrate: () => Promise<void>;
  createFolder: (name: string, parentId?: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => Promise<void>;
  uploadFiles: (folderId: string, files: File[]) => Promise<number>;
  renameAsset: (id: string, name: string) => void;
  moveAsset: (id: string, folderId: string) => void;
  deleteAssets: (ids: string[]) => Promise<void>;
};

function currentOrgId() {
  return useAppStore.getState().currentOrganizationId ?? STELLANTIS_ORG_ID;
}

function recordAssetActivity(
  type: "asset_uploaded" | "asset_deleted",
  name: string,
  count = 1,
) {
  useAppStore.getState().recordActivity({
    type,
    templateId: currentOrgId(),
    templateName: name,
    labelCount: count,
  });
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persistMeta() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const { folders, assets, hydrated } = useAssetStore.getState();
    if (!hydrated) return;
    void Promise.all([saveAssetFolders(folders), saveAssetRecords(assets)]);
  }, 200);
}

async function imageSize(blob: Blob): Promise<{ width: number; height: number } | undefined> {
  try {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return undefined;
  }
}

async function makeThumb(blob: Blob, max = 320): Promise<Blob | undefined> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return undefined;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return await new Promise((resolve) => {
      canvas.toBlob((next) => resolve(next ?? undefined), "image/jpeg", 0.82);
    });
  } catch {
    return undefined;
  }
}

async function seedPackaging(existing: AssetRecord[], folders: AssetFolder[]) {
  try {
    const res = await fetch(publicPath("/assets/packaging/manifest.json"));
    if (!res.ok) return { folders, assets: existing };
    const files = (await res.json()) as string[];
    if (!Array.isArray(files) || !files.length) return { folders, assets: existing };
    const now = new Date().toISOString();
    const nextFolders = folders.some((folder) => folder.id === PACKAGING_FOLDER_ID)
      ? folders
      : [...folders, { id: PACKAGING_FOLDER_ID, name: "packaging", createdAt: now, organizationId: STELLANTIS_ORG_ID }];
    const have = new Map(existing.map((asset) => [asset.id, asset]));
    const seeded = files.map((name) => {
      const stem = assetLookupKey(name);
      return {
        id: `asset-packaging-${stem || name.toLowerCase()}`,
        folderId: PACKAGING_FOLDER_ID,
        name,
        stem,
        mime: mimeFromName(name),
        bytes: 0,
        kind: "static" as const,
        url: publicPath(`/assets/packaging/${encodeURIComponent(name)}`),
        createdAt: now,
        organizationId: STELLANTIS_ORG_ID,
      };
    });
    const byId = new Map(seeded.map((asset) => [asset.id, asset]));
    let changed = nextFolders !== folders;
    const merged = existing.map((asset) => {
      const fresh = byId.get(asset.id);
      if (!fresh || asset.kind !== "static" || asset.url === fresh.url) return asset;
      changed = true;
      return { ...asset, url: fresh.url };
    });
    const extras = seeded.filter((asset) => !have.has(asset.id));
    if (extras.length) changed = true;
    return {
      folders: nextFolders,
      assets: changed ? [...merged, ...extras] : existing,
    };
  } catch {
    return { folders, assets: existing };
  }
}

export const useAssetStore = create<AssetStore>((set, get) => ({
  hydrated: false,
  folders: [],
  assets: [],
  thumbUrls: {},

  hydrate: async () => {
    if (get().hydrated) return;
    const stored = await loadAssetLibrary();
    const thumbs: Record<string, string> = {};
    for (const item of stored.thumbs) thumbs[item.id] = rememberObjectUrl(`thumb:${item.id}`, item.blob);
    for (const item of stored.blobs) rememberObjectUrl(item.id, item.blob);
    const seeded = await seedPackaging(stored.assets, stored.folders);
    let folders = seeded.folders;
    let assets = seeded.assets;
    if (stored.workspaceMigrationRev < WORKSPACE_MIGRATION_REV) {
      folders = folders.map((folder) =>
        folder.organizationId ? folder : { ...folder, organizationId: STELLANTIS_ORG_ID },
      );
      assets = assets.map((asset) =>
        asset.organizationId ? asset : { ...asset, organizationId: STELLANTIS_ORG_ID },
      );
      await markAssetWorkspaceMigrated(WORKSPACE_MIGRATION_REV);
    }
    const seededPackaging = folders.some((folder) => folder.id === PACKAGING_FOLDER_ID);
    if (seededPackaging) {
      await markPackagingSeeded();
      if (seeded.assets !== stored.assets || seeded.folders !== stored.folders || stored.workspaceMigrationRev < WORKSPACE_MIGRATION_REV) {
        await Promise.all([saveAssetFolders(folders), saveAssetRecords(assets)]);
      }
    }
    set({
      hydrated: true,
      folders,
      assets,
      thumbUrls: thumbs,
    });
  },

  createFolder: (name, parentId) => {
    const id = createId();
    const parent = parentId?.trim();
    const folder: AssetFolder = {
      id,
      name: name.trim() || "Untitled folder",
      parentId: parent && get().folders.some((item) => item.id === parent) ? parent : undefined,
      createdAt: new Date().toISOString(),
      organizationId: currentOrgId(),
    };
    set((state) => ({ folders: [...state.folders, folder] }));
    persistMeta();
    return id;
  },

  renameFolder: (id, name) => {
    const next = name.trim();
    if (!next) return;
    set((state) => ({
      folders: state.folders.map((folder) => (folder.id === id ? { ...folder, name: next } : folder)),
    }));
    persistMeta();
  },

  deleteFolder: async (id) => {
    const drop = new Set(folderDescendantIds(get().folders, id));
    const removed = get().assets.filter((asset) => drop.has(asset.folderId));
    for (const asset of removed) {
      forgetObjectUrl(asset.id);
      forgetObjectUrl(`thumb:${asset.id}`);
      if (asset.kind === "blob") await deleteAssetMedia(asset.id);
    }
    set((state) => ({
      folders: state.folders.filter((folder) => !drop.has(folder.id)),
      assets: state.assets.filter((asset) => !drop.has(asset.folderId)),
      thumbUrls: Object.fromEntries(Object.entries(state.thumbUrls).filter(([key]) => !removed.some((asset) => asset.id === key))),
    }));
    persistMeta();
    if (removed.length) {
      recordAssetActivity("asset_deleted", removed.length === 1 ? removed[0].name : `${removed.length} assets`, removed.length);
    }
  },

  uploadFiles: async (folderId, files) => {
    const images = files.filter(isImageFile);
    if (!images.length) return 0;
    const added: AssetRecord[] = [];
    const thumbs: Record<string, string> = {};
    for (const file of images) {
      const size = await imageSize(file);
      const id = createId();
      const asset: AssetRecord = {
        id,
        folderId,
        name: file.name,
        stem: assetLookupKey(file.name),
        mime: file.type || mimeFromName(file.name),
        bytes: file.size,
        kind: "blob",
        width: size?.width,
        height: size?.height,
        createdAt: new Date().toISOString(),
        organizationId: currentOrgId(),
      };
      rememberObjectUrl(id, file);
      await putAssetBlob(id, file);
      const thumb = await makeThumb(file);
      if (thumb) {
        await putAssetThumb(id, thumb);
        thumbs[id] = rememberObjectUrl(`thumb:${id}`, thumb);
      }
      added.push(asset);
    }
    set((state) => ({
      assets: [...state.assets, ...added],
      thumbUrls: { ...state.thumbUrls, ...thumbs },
    }));
    persistMeta();
    if (added.length) {
      recordAssetActivity(
        "asset_uploaded",
        added.length === 1 ? added[0].name : `${added.length} assets`,
        added.length,
      );
    }
    return added.length;
  },

  renameAsset: (id, name) => {
    const next = name.trim();
    if (!next) return;
    set((state) => ({
      assets: state.assets.map((asset) =>
        asset.id === id ? { ...asset, name: next, stem: assetLookupKey(next) } : asset,
      ),
    }));
    persistMeta();
  },

  moveAsset: (id, folderId) => {
    set((state) => ({
      assets: state.assets.map((asset) => (asset.id === id ? { ...asset, folderId } : asset)),
    }));
    persistMeta();
  },

  deleteAssets: async (ids) => {
    const remove = new Set(ids);
    const gone = get().assets.filter((asset) => remove.has(asset.id));
    for (const asset of gone) {
      forgetObjectUrl(asset.id);
      forgetObjectUrl(`thumb:${asset.id}`);
      if (asset.kind === "blob") await deleteAssetMedia(asset.id);
    }
    set((state) => ({
      assets: state.assets.filter((asset) => !remove.has(asset.id)),
      thumbUrls: Object.fromEntries(Object.entries(state.thumbUrls).filter(([key]) => !remove.has(key))),
    }));
    persistMeta();
    if (gone.length) {
      recordAssetActivity("asset_deleted", gone.length === 1 ? gone[0].name : `${gone.length} assets`, gone.length);
    }
  },
}));
