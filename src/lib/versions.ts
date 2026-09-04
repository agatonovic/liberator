import { createId } from "./ids";
import type { LabelDocument, TemplateVersion, TemplateVersionSnapshot } from "./document";

export const VERSION_LIMIT = 20;

export function snapshotTemplate(doc: LabelDocument): TemplateVersionSnapshot {
  return {
    page: structuredClone(doc.page),
    sheet: structuredClone(doc.sheet),
    elements: structuredClone(doc.elements),
    dataColumns: structuredClone(doc.dataColumns),
    description: doc.description,
  };
}

export function nextVersionNumber(versions: TemplateVersion[] | undefined) {
  return Math.max(0, ...(versions ?? []).map((item) => item.number ?? 0)) + 1;
}

export function makeTemplateVersion(
  doc: LabelDocument,
  name = "",
  extras?: { createdBy?: string; status?: TemplateVersion["status"] },
): TemplateVersion {
  const number = nextVersionNumber(doc.versions);
  return {
    id: createId(),
    name: name.trim() || `v${number}`,
    createdAt: new Date().toISOString(),
    snapshot: snapshotTemplate(doc),
    number,
    status: extras?.status ?? "draft",
    createdBy: extras?.createdBy,
  };
}

export function prependVersion(
  existing: TemplateVersion[] | undefined,
  version: TemplateVersion,
): TemplateVersion[] {
  return [version, ...(existing ?? [])].slice(0, VERSION_LIMIT);
}

export function applyVersionSnapshot(doc: LabelDocument, snapshot: TemplateVersionSnapshot): LabelDocument {
  return {
    ...doc,
    page: structuredClone(snapshot.page),
    sheet: structuredClone(snapshot.sheet),
    elements: structuredClone(snapshot.elements),
    dataColumns: structuredClone(snapshot.dataColumns),
    description: snapshot.description,
  };
}

export function keepDocumentVersions(live: LabelDocument, restored: LabelDocument): LabelDocument {
  if (live.versions === restored.versions) return restored;
  return { ...restored, versions: live.versions };
}

export function stripDocumentVersions(doc: LabelDocument): LabelDocument {
  if (!doc.versions?.length) return doc;
  const copy = structuredClone(doc);
  delete copy.versions;
  return copy;
}

export function versionLabel(version: TemplateVersion) {
  return version.name.trim() || defaultVersionName(version.createdAt);
}

export function formatVersionDate(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Version";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function defaultVersionName(iso: string) {
  return formatVersionDate(iso);
}
