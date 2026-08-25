import { promises as fs } from "fs";
import path from "path";
import type { ActivityEvent } from "./activity";
import type { LabelDocument } from "./document";
import type { TemplateFolder } from "./library";
import type { PersistedData } from "./db";

export type LibrarySnapshot = {
  documents: LabelDocument[];
  folders: TemplateFolder[];
  currentId: string | null;
  data?: PersistedData;
  librarySeeded?: boolean;
  deletedIds?: string[];
  deletedCatalogIds?: string[];
  deletedFolderIds?: string[];
  savedColors?: string[];
  activity?: ActivityEvent[];
};

const FILE = path.join(process.cwd(), "data", "library.json");

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
  if (!snapshot.documents.length && !snapshot.deletedIds?.length) {
    const existing = await readLibraryFile();
    if (existing?.documents.length) return;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(snapshot, null, 2));
}
