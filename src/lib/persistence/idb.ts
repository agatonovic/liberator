import type { PersistedMeta } from "../db";
import { emptyWorkspace, type WorkspaceState } from "../workspace";

export function workspaceFromMeta(meta?: Pick<
  PersistedMeta,
  "organizations" | "users" | "memberships" | "jobs" | "workspaceMigrationRev"
> | null): WorkspaceState {
  if (!meta) return emptyWorkspace();
  return {
    organizations: meta.organizations ?? [],
    users: meta.users ?? [],
    memberships: meta.memberships ?? [],
    jobs: meta.jobs ?? [],
    workspaceMigrationRev: meta.workspaceMigrationRev ?? 0,
  };
}
