import type { LabelDocument } from "./document";
import type { Role, TemplateStatus } from "./domain";
import type { TemplateFolder } from "./library";
import { canSeeTemplate } from "./roles";
import { belongsToOrganization } from "./workspace-scope";

export type TemplateSort = "used" | "modified" | "name-asc" | "name-desc";

export const TEMPLATE_SORTS: { id: TemplateSort; label: string }[] = [
  { id: "used", label: "Recently used" },
  { id: "modified", label: "Last modified" },
  { id: "name-asc", label: "Name A–Z" },
  { id: "name-desc", label: "Name Z–A" },
];

export type TemplateStatusFilter = "all" | "published" | "draft" | "archived" | "recent";

export function templateStatusOf(doc: LabelDocument): TemplateStatus {
  return doc.status ?? "published";
}

export function visibleTemplates(docs: LabelDocument[], role: Role | null | undefined, organizationId?: string | null) {
  return docs.filter((doc) => {
    if (!belongsToOrganization(doc, organizationId)) return false;
    return canSeeTemplate(role ?? "admin", templateStatusOf(doc));
  });
}

export function filterTemplatesByStatus(docs: LabelDocument[], filter: TemplateStatusFilter) {
  if (filter === "all") return docs;
  if (filter === "recent") return recentTemplates(docs, docs.length);
  return docs.filter((doc) => templateStatusOf(doc) === filter);
}

export function versionCaption(doc: LabelDocument) {
  const n = doc.versionNumber ?? doc.versions?.[0]?.number ?? 1;
  return `v${n}`;
}

export function publishedVersionCaption(doc: LabelDocument) {
  if (!doc.publishedVersionId) return "";
  const published = doc.versions?.find((item) => item.id === doc.publishedVersionId);
  const n = published?.number ?? 1;
  return `Published v${n}`;
}

export function statusLabel(status: TemplateStatus) {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return "Draft";
}

export function recencyStamp(doc: LabelDocument) {
  return doc.lastGeneratedAt || doc.lastUsedAt || "";
}

export function folderNameFor(doc: LabelDocument, folders: TemplateFolder[]) {
  return folders.find((folder) => folder.id === doc.folderId)?.name ?? "";
}

export function matchesTemplateQuery(doc: LabelDocument, folderName: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [doc.name, doc.description ?? "", folderName, doc.catalogId ?? "", `${doc.page.widthMm}×${doc.page.heightMm}`]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function hasUsage(doc: LabelDocument) {
  return Boolean(doc.lastGeneratedAt || doc.lastUsedAt);
}

export function sortTemplates(docs: LabelDocument[], sort: TemplateSort) {
  const copy = [...docs];
  if (sort === "name-asc") return copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  if (sort === "name-desc") return copy.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" }));
  if (sort === "modified") return copy.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  if (!copy.some(hasUsage)) return docs;
  return copy.sort((a, b) => {
    const byUse = recencyStamp(b).localeCompare(recencyStamp(a));
    if (byUse) return byUse;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
}

export function recentTemplates(docs: LabelDocument[], limit = 6) {
  return [...docs]
    .filter(hasUsage)
    .sort((a, b) => recencyStamp(b).localeCompare(recencyStamp(a)))
    .slice(0, limit);
}

export function favoriteTemplates(docs: LabelDocument[], sort: TemplateSort) {
  return sortTemplates(
    docs.filter((doc) => doc.favorite),
    sort,
  );
}

export function relativeUsed(iso?: string) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const day = 24 * 60 * 60 * 1000;
  if (diff < 60 * 1000) return "Just now";
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 60000))} min ago`;
  if (diff < day) return `${Math.max(1, Math.round(diff / 3600000))}h ago`;
  if (diff < 2 * day) return "Yesterday";
  if (diff < 7 * day) return `${Math.round(diff / day)} days ago`;
  return new Date(iso).toLocaleDateString();
}
