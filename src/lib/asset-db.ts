import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AssetFolder, AssetRecord } from "./assets";

interface AssetDB extends DBSchema {
  folders: { key: string; value: AssetFolder };
  assets: { key: string; value: AssetRecord };
  blobs: { key: string; value: Blob };
  thumbs: { key: string; value: Blob };
  kv: { key: string; value: unknown };
}

const DB_NAME = "labelator-assets";

let dbPromise: Promise<IDBPDatabase<AssetDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<AssetDB>(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains("folders")) database.createObjectStore("folders", { keyPath: "id" });
        if (!database.objectStoreNames.contains("assets")) database.createObjectStore("assets", { keyPath: "id" });
        if (!database.objectStoreNames.contains("blobs")) database.createObjectStore("blobs");
        if (!database.objectStoreNames.contains("thumbs")) database.createObjectStore("thumbs");
        if (!database.objectStoreNames.contains("kv")) database.createObjectStore("kv");
      },
    });
  }
  return dbPromise;
}

export async function loadAssetLibrary(): Promise<{
  folders: AssetFolder[];
  assets: AssetRecord[];
  blobs: { id: string; blob: Blob }[];
  thumbs: { id: string; blob: Blob }[];
  packagingSeeded: boolean;
  workspaceMigrationRev: number;
}> {
  const database = await db();
  const [folders, assets, blobKeys, thumbKeys, packagingSeeded, workspaceMigrationRev] = await Promise.all([
    database.getAll("folders"),
    database.getAll("assets"),
    database.getAllKeys("blobs"),
    database.getAllKeys("thumbs"),
    database.get("kv", "packagingSeeded"),
    database.get("kv", "workspaceMigrationRev"),
  ]);
  const blobs: { id: string; blob: Blob }[] = [];
  for (const key of blobKeys) {
    const blob = await database.get("blobs", key);
    if (blob) blobs.push({ id: String(key), blob });
  }
  const thumbs: { id: string; blob: Blob }[] = [];
  for (const key of thumbKeys) {
    const blob = await database.get("thumbs", key);
    if (blob) thumbs.push({ id: String(key), blob });
  }
  return {
    folders,
    assets,
    blobs,
    thumbs,
    packagingSeeded: Boolean(packagingSeeded),
    workspaceMigrationRev: Number(workspaceMigrationRev) || 0,
  };
}

export async function saveAssetFolders(folders: AssetFolder[]) {
  const database = await db();
  const existing = await database.getAllKeys("folders");
  const keep = new Set(folders.map((folder) => folder.id));
  const tx = database.transaction("folders", "readwrite");
  for (const key of existing) {
    if (!keep.has(String(key))) await tx.store.delete(key);
  }
  for (const folder of folders) await tx.store.put(folder);
  await tx.done;
}

export async function saveAssetRecords(assets: AssetRecord[]) {
  const database = await db();
  const existing = await database.getAllKeys("assets");
  const keep = new Set(assets.map((asset) => asset.id));
  const tx = database.transaction("assets", "readwrite");
  for (const key of existing) {
    if (!keep.has(String(key))) await tx.store.delete(key);
  }
  for (const asset of assets) await tx.store.put(asset);
  await tx.done;
}

export async function putAssetBlob(id: string, blob: Blob) {
  const database = await db();
  await database.put("blobs", blob, id);
}

export async function putAssetThumb(id: string, blob: Blob) {
  const database = await db();
  await database.put("thumbs", blob, id);
}

export async function deleteAssetMedia(id: string) {
  const database = await db();
  const tx = database.transaction(["blobs", "thumbs"], "readwrite");
  await tx.objectStore("blobs").delete(id);
  await tx.objectStore("thumbs").delete(id);
  await tx.done;
}

export async function markPackagingSeeded() {
  const database = await db();
  await database.put("kv", true, "packagingSeeded");
}

export async function markAssetWorkspaceMigrated(rev: number) {
  const database = await db();
  await database.put("kv", rev, "workspaceMigrationRev");
}
