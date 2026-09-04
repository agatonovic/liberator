import { STELLANTIS_ORG_ID } from "./domain";

/** Records with an explicit organizationId belong only to that workspace. Unscoped records belong to none until stamped. */
export function belongsToOrganization(
  record: { organizationId?: string | null },
  organizationId: string | null | undefined,
): boolean {
  if (!organizationId) return false;
  return record.organizationId === organizationId;
}

export function recordsForOrganization<T extends { organizationId?: string | null }>(
  records: T[],
  organizationId: string | null | undefined,
): T[] {
  if (!organizationId) return [];
  return records.filter((record) => record.organizationId === organizationId);
}

/**
 * Legacy Industrial data (library.json, older IndexedDB) has no organizationId.
 * Stamp those records onto Stellantis Kragujevac only. Never assign them to another workspace.
 */
export function stampLegacyOrganizationId<T extends { organizationId?: string | null }>(
  record: T,
  fallback = STELLANTIS_ORG_ID,
): T {
  if (record.organizationId) return record;
  return { ...record, organizationId: fallback };
}

export function stampLegacyOrganizationIds<T extends { organizationId?: string | null }>(
  records: T[],
  fallback = STELLANTIS_ORG_ID,
): T[] {
  let changed = false;
  const next = records.map((record) => {
    const stamped = stampLegacyOrganizationId(record, fallback);
    if (stamped !== record) changed = true;
    return stamped;
  });
  return changed ? next : records;
}
