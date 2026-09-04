import type { LabelDocument, TemplateVersion } from "./document";
import {
  STELLANTIS_ORG_ID,
  WORKSPACE_MIGRATION_REV,
  type LabelJob,
  type Organization,
  type OrganizationMembership,
  type Role,
  type User,
} from "./domain";
import { editionOf } from "./edition";
import type { TemplateFolder } from "./library";
import {
  demoAdminMembership,
  demoAdminUser,
  demoOperatorMembership,
  demoOperatorUser,
  demoShopifyMembership,
  shopifyDemoOrganization,
  stellantisOrganization,
} from "./session";
import { snapshotTemplate } from "./versions";
import { stampLegacyOrganizationIds } from "./workspace-scope";

export type WorkspaceState = {
  organizations: Organization[];
  users: User[];
  memberships: OrganizationMembership[];
  jobs: LabelJob[];
  workspaceMigrationRev: number;
};

export function emptyWorkspace(): WorkspaceState {
  return {
    organizations: [],
    users: [],
    memberships: [],
    jobs: [],
    workspaceMigrationRev: 0,
  };
}

function nextVersionNumber(versions: TemplateVersion[] | undefined) {
  const max = Math.max(0, ...(versions ?? []).map((item) => item.number ?? 0));
  return max + 1;
}

function ensurePublishedVersion(doc: LabelDocument, actorId: string, actorNameIgnored?: string): LabelDocument {
  void actorNameIgnored;
  if (doc.status && doc.publishedVersionId && doc.versions?.some((item) => item.id === doc.publishedVersionId)) {
    return {
      ...doc,
      organizationId: doc.organizationId ?? STELLANTIS_ORG_ID,
      createdBy: doc.createdBy ?? actorId,
      updatedBy: doc.updatedBy ?? actorId,
      versionNumber: doc.versionNumber ?? 1,
    };
  }
  const existing = doc.versions ?? [];
  const published = existing.find((item) => item.status === "published") ?? existing[0];
  if (published) {
    return {
      ...doc,
      organizationId: doc.organizationId ?? STELLANTIS_ORG_ID,
      createdBy: doc.createdBy ?? actorId,
      updatedBy: doc.updatedBy ?? actorId,
      status: doc.status ?? "published",
      versionNumber: published.number ?? 1,
      publishedVersionId: published.id,
      versions: existing.map((item) =>
        item.id === published.id
          ? { ...item, status: "published" as const, number: item.number ?? 1, createdBy: item.createdBy ?? actorId }
          : { ...item, number: item.number ?? 1, createdBy: item.createdBy ?? actorId },
      ),
    };
  }
  const version: TemplateVersion = {
    id: `ver_${doc.id}_1`,
    name: "v1",
    createdAt: doc.updatedAt || new Date().toISOString(),
    snapshot: snapshotTemplate(doc),
    number: 1,
    status: "published",
    createdBy: actorId,
  };
  return {
    ...doc,
    organizationId: doc.organizationId ?? STELLANTIS_ORG_ID,
    createdBy: doc.createdBy ?? actorId,
    updatedBy: doc.updatedBy ?? actorId,
    status: "published",
    versionNumber: 1,
    publishedVersionId: version.id,
    versions: [version, ...existing],
  };
}

export function migrateWorkspace(input: {
  documents: LabelDocument[];
  folders: TemplateFolder[];
  workspace?: Partial<WorkspaceState> | null;
}): { documents: LabelDocument[]; folders: TemplateFolder[]; workspace: WorkspaceState; didChange: boolean } {
  const existing = input.workspace;
  if ((existing?.workspaceMigrationRev ?? 0) >= WORKSPACE_MIGRATION_REV && existing?.organizations?.length) {
    const stampedDocs = stampLegacyOrganizationIds(input.documents);
    const stampedFolders = stampLegacyOrganizationIds(input.folders);
    const workspace = stampWorkspaceRecords(ensureDemoPeople(existing as WorkspaceState));
    const peopleChanged =
      workspace.users.length !== (existing.users?.length ?? 0) ||
      workspace.memberships.length !== (existing.memberships?.length ?? 0) ||
      workspace.organizations.some((org, index) => org !== existing.organizations?.[index]) ||
      workspace.jobs !== existing.jobs;
    const docsChanged = stampedDocs.some((doc, index) => doc !== input.documents[index]);
    const foldersChanged = stampedFolders.some((folder, index) => folder !== input.folders[index]);
    if (!docsChanged && !foldersChanged && !peopleChanged) {
      return { documents: input.documents, folders: input.folders, workspace: existing as WorkspaceState, didChange: false };
    }
    return {
      documents: stampedDocs,
      folders: stampedFolders,
      workspace,
      didChange: true,
    };
  }

  const org = existing?.organizations?.find((item) => item.id === STELLANTIS_ORG_ID) ?? stellantisOrganization();
  const user = existing?.users?.find((item) => item.id === demoAdminUser().id) ?? demoAdminUser();
  const membership =
    existing?.memberships?.find((item) => item.id === demoAdminMembership().id) ?? demoAdminMembership();
  const users = mergeById(existing?.users ?? [], [user, demoOperatorUser()]);
  const organizations = mergeById(existing?.organizations ?? [], [org]);
  const memberships = mergeById(existing?.memberships ?? [], [membership, demoOperatorMembership()]);

  const documents = stampLegacyOrganizationIds(input.documents.map((doc) => ensurePublishedVersion(doc, user.id)));
  const folders = stampLegacyOrganizationIds(
    input.folders.map((folder) =>
      folder.organizationId === org.id ? folder : { ...folder, organizationId: org.id },
    ),
  );

  const workspace: WorkspaceState = stampWorkspaceRecords({
    organizations: organizations.map((item) =>
      item.id === org.id
        ? {
            ...item,
            labelsGenerated: item.labelsGenerated ?? 0,
            jobCount: item.jobCount ?? existing?.jobs?.length ?? 0,
            templateCount: documents.filter((doc) => doc.organizationId === org.id).length,
          }
        : item,
    ),
    users,
    memberships,
    jobs: existing?.jobs ?? [],
    workspaceMigrationRev: WORKSPACE_MIGRATION_REV,
  });

  return { documents, folders, workspace, didChange: true };
}

function mergeById<T extends { id: string }>(primary: T[], extras: T[]) {
  const map = new Map(primary.map((item) => [item.id, item]));
  for (const extra of extras) {
    if (!map.has(extra.id)) map.set(extra.id, extra);
  }
  return [...map.values()];
}

export function ensureDemoPeople(workspace: WorkspaceState): WorkspaceState {
  return {
    ...workspace,
    users: mergeById(workspace.users, [demoAdminUser(), demoOperatorUser()]),
    memberships: mergeById(workspace.memberships, [
      demoAdminMembership(),
      demoOperatorMembership(),
      demoShopifyMembership(),
    ]),
    organizations: mergeById(workspace.organizations, [stellantisOrganization(), shopifyDemoOrganization()]).map(
      stampOrganizationEdition,
    ),
  };
}

function stampWorkspaceRecords(workspace: WorkspaceState): WorkspaceState {
  return {
    ...workspace,
    organizations: workspace.organizations.map(stampOrganizationEdition),
    jobs: stampLegacyOrganizationIds(workspace.jobs),
  };
}

function stampOrganizationEdition(org: Organization): Organization {
  const edition = org.edition ?? (org.id === STELLANTIS_ORG_ID ? "industrial" : editionOf(org));
  if (org.edition === edition) return org;
  return { ...org, edition };
}

export function bumpOrganizationUsage(
  organizations: Organization[],
  organizationId: string,
  labels: number,
): Organization[] {
  const now = new Date().toISOString();
  return organizations.map((org) =>
    org.id === organizationId
      ? {
          ...org,
          labelsGenerated: (org.labelsGenerated ?? 0) + Math.max(0, labels),
          jobCount: (org.jobCount ?? 0) + 1,
          updatedAt: now,
        }
      : org,
  );
}

export function workingCopyOnEdit(doc: LabelDocument, actorId: string): LabelDocument {
  const next: LabelDocument = {
    ...doc,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  };
  if (doc.status === "published") {
    return {
      ...next,
      status: "draft",
      versionNumber: nextVersionNumber(doc.versions),
    };
  }
  return next;
}

export function publishDocument(doc: LabelDocument, actorId: string): LabelDocument {
  const number = nextVersionNumber(doc.versions);
  const version: TemplateVersion = {
    id: `ver_${createStableVersionId(doc.id, number)}`,
    name: `v${number}`,
    createdAt: new Date().toISOString(),
    snapshot: snapshotTemplate(doc),
    number,
    status: "published",
    createdBy: actorId,
  };
  return {
    ...doc,
    status: "published",
    versionNumber: number,
    publishedVersionId: version.id,
    updatedAt: version.createdAt,
    updatedBy: actorId,
    versions: [version, ...(doc.versions ?? [])],
  };
}

function createStableVersionId(docId: string, number: number) {
  return `${docId}_${number}_${Date.now().toString(36)}`;
}

export function archiveDocument(doc: LabelDocument, actorId: string): LabelDocument {
  return {
    ...doc,
    status: "archived",
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  };
}

export function generationVersion(doc: LabelDocument, role: Role) {
  const published = doc.publishedVersionId
    ? doc.versions?.find((item) => item.id === doc.publishedVersionId)
    : undefined;
  if (role === "operator") {
    if (published) {
      return {
        versionId: published.id,
        versionNumber: published.number ?? doc.versionNumber ?? 1,
        snapshot: published.snapshot,
        source: "published" as const,
      };
    }
    return {
      versionId: `unpublished:${doc.id}`,
      versionNumber: doc.versionNumber ?? 1,
      snapshot: undefined,
      source: "none" as const,
    };
  }
  if (doc.status === "published" && published) {
    return {
      versionId: published.id,
      versionNumber: published.number ?? doc.versionNumber ?? 1,
      snapshot: published.snapshot,
      source: "published" as const,
    };
  }
  return {
    versionId: `working:${doc.id}:${doc.versionNumber ?? 1}`,
    versionNumber: doc.versionNumber ?? 1,
    snapshot: undefined,
    source: "working" as const,
  };
}

export function recordCompletedJob(workspace: WorkspaceState, job: LabelJob): WorkspaceState {
  const countLabels = job.status === "completed" ? job.quantity : 0;
  return {
    ...workspace,
    jobs: [job, ...workspace.jobs].slice(0, 200),
    organizations: countLabels
      ? bumpOrganizationUsage(workspace.organizations, job.organizationId, countLabels)
      : workspace.organizations.map((org) =>
          org.id === job.organizationId ? { ...org, jobCount: (org.jobCount ?? 0) + 1, updatedAt: new Date().toISOString() } : org,
        ),
  };
}

export function adminCount(memberships: OrganizationMembership[], organizationId: string) {
  return memberships.filter((item) => item.organizationId === organizationId && item.role === "admin").length;
}
