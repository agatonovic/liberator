import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ActivityEvent } from "./activity";
import type { LabelDocument } from "./document";
import type { TemplateFolder } from "./library";
import type { ColumnMapping, DataRow } from "./resolve";

export type PersistedData = {
  fileName: string | null;
  headers: string[];
  rows: DataRow[];
  mapping: ColumnMapping;
  previewRowIndex: number;
};

export type PersistedMeta = {
  currentId: string | null;
  data: PersistedData;
  folders?: TemplateFolder[];
  librarySeeded?: boolean;
  deletedIds?: string[];
  deletedCatalogIds?: string[];
  deletedFolderIds?: string[];
  savedColors?: string[];
  activity?: ActivityEvent[];
};

interface LabelatorDB extends DBSchema {
  documents: {
    key: string;
    value: LabelDocument;
  };
  kv: {
    key: string;
    value: PersistedMeta;
  };
}

const DB_NAME = "labelator";
const META_KEY = "meta";

let dbPromise: Promise<IDBPDatabase<LabelatorDB>> | null = null;

function db(): Promise<IDBPDatabase<LabelatorDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LabelatorDB>(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains("documents")) {
          database.createObjectStore("documents", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("kv")) {
          database.createObjectStore("kv");
        }
      },
    });
  }
  return dbPromise;
}

export async function loadAllDocuments(): Promise<LabelDocument[]> {
  const database = await db();
  const docs = await database.getAll("documents");
  return docs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveDocument(doc: LabelDocument): Promise<void> {
  const database = await db();
  await database.put("documents", doc);
}

export async function saveAllDocuments(docs: LabelDocument[]): Promise<void> {
  const database = await db();
  const existing = await database.getAllKeys("documents");
  if (docs.length === 0 && existing.length > 0) return;
  const keep = new Set(docs.map((doc) => doc.id));
  const tx = database.transaction("documents", "readwrite");
  for (const key of existing) {
    if (!keep.has(String(key))) await tx.store.delete(key);
  }
  for (const doc of docs) {
    await tx.store.put(doc);
  }
  await tx.done;
}

export async function deleteStoredDocument(id: string): Promise<void> {
  const database = await db();
  await database.delete("documents", id);
}

export async function loadMeta(): Promise<PersistedMeta | undefined> {
  const database = await db();
  return database.get("kv", META_KEY);
}

export async function saveMeta(meta: PersistedMeta): Promise<void> {
  const database = await db();
  await database.put("kv", meta, META_KEY);
}

export const EMPTY_DATA: PersistedData = {
  fileName: null,
  headers: [],
  rows: [],
  mapping: {},
  previewRowIndex: 0,
};
