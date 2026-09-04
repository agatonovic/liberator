import { promises as fs } from "fs";
import path from "path";
import type { ActivityEvent } from "./activity";
import type { LabelDocument } from "./document";
import { isLabelDocument } from "./document";
import { isShopifyWorkspaceId } from "./domain";
import { isShopifyLibraryDocument, omitShopifyFromLibrarySnapshot } from "./library-guard";
import type { TemplateFolder } from "./library";
import type { PersistedData } from "./db";

export type LibrarySnapshot = {
  documents: LabelDocument[];
  folders: TemplateFolder[];
  currentId: string | null;
  data?: PersistedData;
  templateGrids?: Record<string, PersistedData>;
  librarySeeded?: boolean;
  deletedIds?: string[];
  deletedCatalogIds?: string[];
  deletedFolderIds?: string[];
  savedColors?: string[];
  activity?: ActivityEvent[];
};

const FILE = path.join(process.cwd(), "data", "library.json");

export function isLibrarySnapshot(value: unknown): value is LibrarySnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as LibrarySnapshot;
  if (!Array.isArray(snapshot.documents) || !Array.isArray(snapshot.folders)) return false;
  return snapshot.documents.every((doc) => isLabelDocument(doc));
}

export async function readLibraryFile(): Promise<LibrarySnapshot | null> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as LibrarySnapshot;
    if (!parsed || !Array.isArray(parsed.documents) || !Array.isArray(parsed.folders)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeLibraryFile(snapshot: LibrarySnapshot): Promise<void> {
  const existing = await readLibraryFile();
  if (!snapshot.documents.length && !snapshot.deletedIds?.length) {
    if (existing?.documents.length) return;
  }
  const next = omitShopifyFromLibrarySnapshot(mergeLibrarySnapshotForWrite(snapshot, existing));
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(next, null, 2));
}

/**
 * Protect committed Industrial seed (`data/library.json`).
 *
 * When a seed already exists on disk:
 * - keep disk geometry/bindings for existing template IDs
 * - allow organizationId stamping from the incoming snapshot
 * - honor tombstones (deletedIds / deletedFolderIds)
 * - do NOT append new templates or folders from IndexedDB / client state
 *
 * `data/library.json` is a seed/backup/recovery artifact, not a live database.
 * Runtime Designer edits stay in IndexedDB.
 */
export function mergeLibrarySnapshotForWrite(
  snapshot: LibrarySnapshot,
  existing: LibrarySnapshot | null,
): LibrarySnapshot {
  if (!existing?.documents.length && !existing?.folders.length) return omitShopifyFromLibrarySnapshot(snapshot);
  const deleted = new Set(snapshot.deletedIds ?? []);
  const deletedFolders = new Set(snapshot.deletedFolderIds ?? []);
  const incomingDocs = new Map(snapshot.documents.map((doc) => [doc.id, doc]));
  const incomingFolders = new Map(snapshot.folders.map((folder) => [folder.id, folder]));

  const documents: LabelDocument[] = [];
  for (const disk of existing.documents ?? []) {
    if (deleted.has(disk.id)) continue;
    if (isShopifyLibraryDocument(disk)) continue;
    const incoming = incomingDocs.get(disk.id);
    documents.push(stampWorkspaceMetadata(disk, incoming));
  }

  const folders: TemplateFolder[] = [];
  for (const disk of existing.folders ?? []) {
    if (deletedFolders.has(disk.id)) continue;
    if (isShopifyWorkspaceId(disk.organizationId)) continue;
    const incoming = incomingFolders.get(disk.id);
    folders.push(stampFolderMetadata(disk, incoming));
  }

  return { ...snapshot, documents, folders };
}

function stampWorkspaceMetadata(disk: LabelDocument, incoming?: LabelDocument): LabelDocument {
  if (!incoming) return disk;
  const organizationId = disk.organizationId || incoming.organizationId;
  if (!organizationId || disk.organizationId === organizationId) return disk;
  return { ...disk, organizationId };
}

function stampFolderMetadata(disk: TemplateFolder, incoming?: TemplateFolder): TemplateFolder {
  if (!incoming) return disk;
  const organizationId = disk.organizationId || incoming.organizationId;
  if (!organizationId || disk.organizationId === organizationId) return disk;
  return { ...disk, organizationId };
}
