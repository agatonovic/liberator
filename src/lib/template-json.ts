import {
  DOCUMENT_VERSION,
  isLabelDocument,
  normalizeImportedDocument,
  type LabelDocument,
} from "./document";
import { stripDocumentVersions } from "./versions";

/**
 * External interchange format for LABELATOR templates.
 * This is a declarative template definition — not a PDF renderer and not a store dump.
 * schemaVersion is independent of CATALOG_REVISION (Industrial catalog seed revisions).
 */
export const TEMPLATE_JSON_SCHEMA_VERSION = 1 as const;

export const TEMPLATE_JSON_KIND = "labelator.template" as const;

export type TemplateJsonExportScope = "working" | "published";

export type LabelatorTemplateJson = {
  schemaVersion: typeof TEMPLATE_JSON_SCHEMA_VERSION;
  kind: typeof TEMPLATE_JSON_KIND;
  exportedAt: string;
  /** Which template state was exported. Designer always exports the working canvas. */
  exportScope: TemplateJsonExportScope;
  document: LabelDocument;
};

export type BuildTemplateJsonOptions = {
  exportScope?: TemplateJsonExportScope;
  /** Include nested version history snapshots. Default false — interchange uses the selected layout only. */
  includeVersionHistory?: boolean;
  exportedAt?: string;
};

/**
 * Build a portable Labelator template JSON from a LabelDocument.
 * Does not mutate the source document. Does not write to disk or IndexedDB.
 */
export function buildTemplateJson(
  doc: LabelDocument,
  options: BuildTemplateJsonOptions = {},
): LabelatorTemplateJson {
  const exportScope = options.exportScope ?? "working";
  let document = structuredClone(doc);
  if (!options.includeVersionHistory) {
    document = stripDocumentVersions(document);
  }
  document.version = DOCUMENT_VERSION;
  return {
    schemaVersion: TEMPLATE_JSON_SCHEMA_VERSION,
    kind: TEMPLATE_JSON_KIND,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    exportScope,
    document,
  };
}

/** Resolve the published snapshot layout when available; otherwise the working document. */
export function documentForPublishedExport(doc: LabelDocument): LabelDocument {
  const published = doc.publishedVersionId
    ? doc.versions?.find((item) => item.id === doc.publishedVersionId)
    : undefined;
  if (!published?.snapshot) return doc;
  return {
    ...doc,
    page: structuredClone(published.snapshot.page),
    sheet: structuredClone(published.snapshot.sheet),
    elements: structuredClone(published.snapshot.elements),
    dataColumns: structuredClone(published.snapshot.dataColumns),
    description: published.snapshot.description,
    versionNumber: published.number ?? doc.versionNumber,
  };
}

export function templateJsonFileName(doc: LabelDocument): string {
  const slug = doc.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const rev =
    doc.catalogRevision != null
      ? `v${doc.catalogRevision}`
      : doc.versionNumber != null
        ? `v${doc.versionNumber}`
        : "v1";
  const base = slug || doc.catalogId || doc.id.slice(0, 8);
  return `labelator-${base}-${rev}.json`;
}

export function stringifyTemplateJson(payload: LabelatorTemplateJson): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/** Browser helper: download a template JSON file. Does not mutate the document. */
export function downloadTemplateJson(doc: LabelDocument, options: BuildTemplateJsonOptions = {}): void {
  const payload = buildTemplateJson(doc, options);
  const blob = new Blob([stringifyTemplateJson(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = templateJsonFileName(payload.document);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function isLabelatorTemplateJson(value: unknown): value is LabelatorTemplateJson {
  if (!value || typeof value !== "object") return false;
  const payload = value as LabelatorTemplateJson;
  return (
    payload.schemaVersion === TEMPLATE_JSON_SCHEMA_VERSION &&
    payload.kind === TEMPLATE_JSON_KIND &&
    isLabelDocument(payload.document)
  );
}

/**
 * Accept either a bare LabelDocument or a Phase 3 LabelatorTemplateJson envelope.
 * Reuses normalizeImportedDocument so imports get a fresh runtime id.
 */
export function normalizeImportedTemplateJson(raw: unknown): LabelDocument {
  if (isLabelatorTemplateJson(raw)) {
    return normalizeImportedDocument(raw.document);
  }
  return normalizeImportedDocument(raw);
}

/**
 * Asset / font notes for third-party renderers (not embedded in JSON):
 * - Bound images use `element.binding` + `assetFolderId` (Asset library lookup by stem/name).
 * - Designed images may include `imageDataUrl` (data: URLs) or public paths such as `/templates/...`.
 * - Fonts are named in `element.style.fontFamily`; the browser/PDF layer loads IBM Plex and faces.css.
 * A complete external render environment needs: Template JSON + referenced images + required fonts.
 */
export const TEMPLATE_JSON_RESOURCE_NOTES = [
  "Bound images resolve through assetFolderId + binding value (Asset library), not embedded binaries.",
  "Designed images may carry imageDataUrl or an app-relative path; large binaries should stay out of interchange when possible.",
  "Fonts are referenced by family name (for example IBM Plex Sans); package fonts separately for non-browser renderers.",
] as const;
