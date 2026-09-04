import { repairTemplateDocument, type LabelDocument } from "./document";
import {
  collapseCatalogDuplicates,
  excludeDeletedDocuments,
  excludeDeletedFolders,
  inferDeletedDefaultFolders,
  mergeDocuments,
  mergeFolders,
  mergeIdLists,
  restoreOrphanedTemplates,
  seedTemplateLibrary,
  type TemplateFolder,
} from "./library";
import { workspaceFromMeta } from "./persistence/idb";
import { migrateWorkspace, type WorkspaceState } from "./workspace";
import type { PersistedMeta } from "./db";

export type LibraryHydrateRemote = {
  documents?: LabelDocument[];
  folders?: TemplateFolder[];
  librarySeeded?: boolean;
  deletedIds?: string[];
  deletedCatalogIds?: string[];
  deletedFolderIds?: string[];
};

export type LibraryHydrateResult = {
  documents: LabelDocument[];
  folders: TemplateFolder[];
  deletedIds: string[];
  deletedCatalogIds: string[];
  deletedFolderIds: string[];
  workspace: WorkspaceState;
};

const RESTORE_KEY = "labelator.stellantis-restore-v1";

/**
 * Pure document/folder assembly used by store.hydrate.
 * Tests use this so empty-IDB and customized-IDB cases cannot drift from runtime.
 */
export function assembleHydratedLibrary(input: {
  stored: LabelDocument[];
  remote?: LibraryHydrateRemote | null;
  meta?: Pick<
    PersistedMeta,
    | "folders"
    | "librarySeeded"
    | "deletedIds"
    | "deletedCatalogIds"
    | "deletedFolderIds"
    | "organizations"
    | "users"
    | "memberships"
    | "jobs"
    | "workspaceMigrationRev"
  > | null;
  restoreOrphans?: boolean;
}): LibraryHydrateResult {
  const remote = input.remote;
  const meta = input.meta;
  let deletedIds = mergeIdLists(meta?.deletedIds, remote?.deletedIds);
  const deletedCatalogIds = mergeIdLists(meta?.deletedCatalogIds, remote?.deletedCatalogIds);
  const mergedDocs = excludeDeletedDocuments(
    mergeDocuments(input.stored, remote?.documents ?? []),
    deletedIds,
    deletedCatalogIds,
  );
  const alreadySeeded = Boolean(meta?.librarySeeded || remote?.librarySeeded || mergedDocs.length);
  let deletedFolderIds = mergeIdLists(
    meta?.deletedFolderIds,
    remote?.deletedFolderIds,
    inferDeletedDefaultFolders(meta?.folders ?? remote?.folders, alreadySeeded),
  );
  const mergedFolders = excludeDeletedFolders(
    mergeFolders(meta?.folders ?? [], remote?.folders ?? []),
    deletedFolderIds,
  );
  const seeded = seedTemplateLibrary(mergedDocs, mergedFolders, alreadySeeded, deletedFolderIds);
  let documents = excludeDeletedDocuments(seeded.documents, deletedIds, deletedCatalogIds);
  if (input.restoreOrphans && typeof window !== "undefined") {
    const alreadyRestored = window.localStorage.getItem(RESTORE_KEY);
    if (!alreadyRestored) {
      const restored = restoreOrphanedTemplates(documents, seeded.folders);
      if (restored !== documents) documents = restored;
      window.localStorage.setItem(RESTORE_KEY, "1");
    }
  }
  const collapsed = collapseCatalogDuplicates(documents);
  documents = collapsed.documents.map((doc) => repairTemplateDocument(doc));
  if (collapsed.droppedIds.length) deletedIds = mergeIdLists(deletedIds, collapsed.droppedIds);
  const migrated = migrateWorkspace({
    documents,
    folders: seeded.folders,
    workspace: workspaceFromMeta({
      organizations: meta?.organizations,
      users: meta?.users,
      memberships: meta?.memberships,
      jobs: meta?.jobs,
      workspaceMigrationRev: meta?.workspaceMigrationRev,
    }),
  });
  return {
    documents: migrated.documents,
    folders: migrated.folders,
    deletedIds,
    deletedCatalogIds,
    deletedFolderIds,
    workspace: migrated.workspace,
  };
}
