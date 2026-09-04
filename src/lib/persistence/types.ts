import type { ActivityEvent } from "../activity";
import type { LabelDocument } from "../document";
import type { LabelJob, Organization, OrganizationMembership, User } from "../domain";
import type { TemplateFolder } from "../library";

export type WorkspaceRecords = {
  organizations: Organization[];
  users: User[];
  memberships: OrganizationMembership[];
  jobs: LabelJob[];
  activity: ActivityEvent[];
  workspaceMigrationRev: number;
};

export type LibraryRecords = {
  documents: LabelDocument[];
  folders: TemplateFolder[];
};

export type PersistenceSnapshot = LibraryRecords & WorkspaceRecords;
