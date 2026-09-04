import { CATALOG_REVISION, buildCatalogDocument } from "./catalog";
import { catalogEntriesForEdition } from "./catalog-registry";
import type { LabelDocument } from "./document";
import type { ProductEdition } from "./edition";
import { createId } from "./ids";
import { recordsForOrganization } from "./workspace-scope";

export type TemplateFolder = {
  id: string;
  name: string;
  collapsed?: boolean;
  organizationId?: string;
};

export const MY_TEMPLATES_FOLDER_ID = "folder_my_templates";
export const STELLANTIS_KRAGUJEVAC_FOLDER = "Stellantis Kragujevac";

export function foldersInOrganization(folders: TemplateFolder[], organizationId?: string | null) {
  return recordsForOrganization(folders, organizationId);
}

export function folderIdFromName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return slug ? `folder_${slug}` : `folder_${createId()}`;
}

export function defaultFolders(edition: ProductEdition = "industrial"): TemplateFolder[] {
  const seen = new Set<string>();
  const folders: TemplateFolder[] = [];
  for (const entry of catalogEntriesForEdition(edition)) {
    const id = folderIdFromName(entry.group);
    if (seen.has(id)) continue;
    seen.add(id);
    folders.push({ id, name: entry.group });
  }
  folders.push({ id: MY_TEMPLATES_FOLDER_ID, name: "My templates" });
  return folders;
}

function newerDoc(a: LabelDocument, b: LabelDocument) {
  return (b.updatedAt || "").localeCompare(a.updatedAt || "") > 0 ? b : a;
}

export function mergeFolders(primary: TemplateFolder[] = [], secondary: TemplateFolder[] = []): TemplateFolder[] {
  const byId = new Map<string, TemplateFolder>();
  for (const folder of [...primary, ...secondary]) {
    if (!folder?.id || !folder.name) continue;
    if (!byId.has(folder.id)) byId.set(folder.id, folder);
  }
  return [...byId.values()];
}

export function mergeDocuments(primary: LabelDocument[] = [], secondary: LabelDocument[] = []): LabelDocument[] {
  const byId = new Map<string, LabelDocument>();
  for (const doc of [...secondary, ...primary]) {
    if (!doc?.id) continue;
    const prev = byId.get(doc.id);
    byId.set(doc.id, prev ? newerDoc(prev, doc) : doc);
  }
  return [...byId.values()].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function mergeIdLists(...lists: (string[] | undefined)[]): string[] {
  return [...new Set(lists.flatMap((list) => list ?? []))];
}

const PUBLISHED_LIBRARY_KEY = "labelator.published-library";

export function publishedLibraryStamp(remote: {
  documents?: { id: string; updatedAt?: string }[];
  folders?: { id: string; name: string }[];
  deletedFolderIds?: string[];
} | null): string {
  if (!remote?.documents?.length) return "";
  const folders = (remote.folders ?? []).map((folder) => `${folder.id}:${folder.name}`).sort().join(",");
  const docs = remote.documents.map((doc) => `${doc.id}:${doc.updatedAt ?? ""}`).sort().join(",");
  const deleted = [...(remote.deletedFolderIds ?? [])].sort().join(",");
  return `${folders}|${docs}|${deleted}`;
}

export function consumePublishedLibraryStamp(stamp: string): boolean {
  if (!stamp || typeof window === "undefined") return false;
  if (window.localStorage.getItem(PUBLISHED_LIBRARY_KEY) === stamp) return false;
  window.localStorage.setItem(PUBLISHED_LIBRARY_KEY, stamp);
  return true;
}

function preferCatalogCopy(a: LabelDocument, b: LabelDocument, defaultFolderIds: Set<string>): LabelDocument {
  const aCustom = Boolean(a.folderId && !defaultFolderIds.has(a.folderId));
  const bCustom = Boolean(b.folderId && !defaultFolderIds.has(b.folderId));
  if (aCustom !== bCustom) return aCustom ? a : b;
  return newerDoc(a, b);
}

export function collapseCatalogDuplicates(documents: LabelDocument[]): {
  documents: LabelDocument[];
  droppedIds: string[];
} {
  const defaultFolderIds = new Set(defaultFolders().map((folder) => folder.id));
  const byCatalog = new Map<string, LabelDocument[]>();
  const unique: LabelDocument[] = [];
  for (const doc of documents) {
    if (!doc.catalogId) {
      unique.push(doc);
      continue;
    }
    const list = byCatalog.get(doc.catalogId) ?? [];
    list.push(doc);
    byCatalog.set(doc.catalogId, list);
  }
  const droppedIds: string[] = [];
  for (const group of byCatalog.values()) {
    const winner = group.reduce((best, doc) => preferCatalogCopy(best, doc, defaultFolderIds));
    unique.push(winner);
    for (const doc of group) {
      if (doc.id !== winner.id) droppedIds.push(doc.id);
    }
  }
  return {
    documents: unique.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")),
    droppedIds,
  };
}

export function excludeDeletedDocuments(
  documents: LabelDocument[],
  deletedIds: string[] | undefined,
  deletedCatalogIds: string[] | undefined,
): LabelDocument[] {
  const ids = new Set(deletedIds);
  const catalogs = new Set(deletedCatalogIds);
  return documents.filter((doc) => !ids.has(doc.id) && !(doc.catalogId && catalogs.has(doc.catalogId)));
}

export function ensureNamedFolder(folders: TemplateFolder[], name: string): TemplateFolder[] {
  if (folders.some((folder) => folder.name.trim().toLowerCase() === name.trim().toLowerCase())) return folders;
  return [...folders, { id: createId(), name }];
}

export function excludeDeletedFolders(folders: TemplateFolder[], deletedIds?: string[]): TemplateFolder[] {
  if (!deletedIds?.length) return folders;
  const gone = new Set(deletedIds);
  return folders.filter((folder) => !gone.has(folder.id));
}

export function inferDeletedDefaultFolders(saved: TemplateFolder[] | undefined, alreadySeeded: boolean): string[] {
  if (!alreadySeeded || !saved?.length) return [];
  const keptIds = new Set(saved.map((folder) => folder.id));
  const keptNames = new Set(saved.map((folder) => folder.name.trim().toLowerCase()));
  return defaultFolders()
    .filter(
      (folder) => !keptIds.has(folder.id) && !keptNames.has(folder.name.trim().toLowerCase()),
    )
    .map((folder) => folder.id);
}

export function recoverFoldersFromDocuments(
  folders: TemplateFolder[],
  documents: LabelDocument[],
  deletedFolderIds?: string[],
): TemplateFolder[] {
  const deleted = new Set(deletedFolderIds);
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  let extra = 1;
  for (const doc of documents) {
    if (!doc.folderId || byId.has(doc.folderId) || deleted.has(doc.folderId)) continue;
    byId.set(doc.folderId, {
      id: doc.folderId,
      name: extra === 1 ? STELLANTIS_KRAGUJEVAC_FOLDER : `Recovered folder ${extra}`,
    });
    extra += 1;
  }
  return [...byId.values()];
}

export function collapseDuplicateFolders(
  folders: TemplateFolder[],
  documents: LabelDocument[],
): { folders: TemplateFolder[]; documents: LabelDocument[] } {
  const groups = new Map<string, TemplateFolder[]>();
  for (const folder of folders) {
    const key = folder.name.trim().toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(folder);
    groups.set(key, list);
  }
  const remap = new Map<string, string>();
  const kept: TemplateFolder[] = [];
  for (const group of groups.values()) {
    const canonical = group.find((folder) => documents.some((doc) => doc.folderId === folder.id)) ?? group[0];
    kept.push(canonical);
    for (const folder of group) {
      if (folder.id !== canonical.id) remap.set(folder.id, canonical.id);
    }
  }
  if (!remap.size) return { folders: kept, documents };
  return {
    folders: kept,
    documents: documents.map((doc) =>
      doc.folderId && remap.has(doc.folderId) ? { ...doc, folderId: remap.get(doc.folderId) } : doc,
    ),
  };
}

export function restoreOrphanedTemplates(documents: LabelDocument[], folders: TemplateFolder[]): LabelDocument[] {
  const stellantis = folders.find(
    (folder) => folder.name.trim().toLowerCase() === STELLANTIS_KRAGUJEVAC_FOLDER.toLowerCase(),
  );
  if (!stellantis) return documents;
  if (documents.some((doc) => doc.folderId === stellantis.id)) return documents;
  return documents.map((doc) =>
    doc.folderId === MY_TEMPLATES_FOLDER_ID ? { ...doc, folderId: stellantis.id } : doc,
  );
}

export function refreshStaleCatalogDocuments(documents: LabelDocument[]): {
  documents: LabelDocument[];
  didChange: boolean;
} {
  let didChange = false;
  const next = documents.map((doc) => {
    const catalogId = doc.catalogId;
    if (!catalogId || CATALOG_REVISION[catalogId] == null) return doc;
    if ((doc.catalogRevision ?? 0) >= CATALOG_REVISION[catalogId]) return doc;
    const fresh = buildCatalogDocument(catalogId);
    didChange = true;
    return {
      ...fresh,
      id: doc.id,
      folderId: doc.folderId,
      name: doc.name,
      updatedAt: new Date().toISOString(),
    };
  });
  return { documents: next, didChange };
}

export function seedTemplateLibrary(
  documents: LabelDocument[],
  folders: TemplateFolder[] | undefined,
  alreadySeeded: boolean | undefined,
  deletedFolderIds?: string[],
  edition: ProductEdition = "industrial",
): { documents: LabelDocument[]; folders: TemplateFolder[]; didChange: boolean } {
  let foldersNext =
    alreadySeeded && folders?.length ? [...folders] : mergeFolders(defaultFolders(edition), folders);
  foldersNext = excludeDeletedFolders(foldersNext, deletedFolderIds);
  foldersNext = recoverFoldersFromDocuments(foldersNext, documents, deletedFolderIds);
  foldersNext = excludeDeletedFolders(foldersNext, deletedFolderIds);
  if (edition === "industrial") {
    foldersNext = ensureNamedFolder(foldersNext, STELLANTIS_KRAGUJEVAC_FOLDER);
  }

  let nextDocs = documents;
  let didChange = !folders?.length || folders.length !== foldersNext.length;

  const shouldSeedCatalog = !alreadySeeded && documents.length === 0;
  if (shouldSeedCatalog) {
    const haveCatalog = new Set(documents.map((doc) => doc.catalogId).filter(Boolean));
    const seeded: LabelDocument[] = [];
    for (const entry of catalogEntriesForEdition(edition)) {
      if (haveCatalog.has(entry.id)) continue;
      const doc = buildCatalogDocument(entry.id);
      doc.folderId = folderIdFromName(entry.group);
      seeded.push(doc);
    }
    nextDocs = [...seeded, ...documents];
    didChange = true;
  }

  const collapsed = collapseDuplicateFolders(foldersNext, nextDocs);
  foldersNext = collapsed.folders;
  nextDocs = collapsed.documents;

  const refreshed = refreshStaleCatalogDocuments(nextDocs);
  nextDocs = refreshed.documents;
  didChange = didChange || refreshed.didChange;

  const known = new Set(foldersNext.map((folder) => folder.id));
  const fallback =
    foldersNext.find((folder) => folder.id === MY_TEMPLATES_FOLDER_ID)?.id ?? foldersNext[0]?.id;

  nextDocs = nextDocs.map((doc) => {
    if (doc.folderId && known.has(doc.folderId)) return doc;
    didChange = true;
    return { ...doc, folderId: fallback };
  });

  return { documents: nextDocs, folders: foldersNext, didChange };
}
