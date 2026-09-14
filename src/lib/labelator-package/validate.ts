import type { LabelDocument } from "../document";
import { resolveFontFamily } from "../fonts";
import { isLabelatorTemplateJson, type LabelatorTemplateJson } from "../template-json";
import { collectAssetFolderIds, collectFontFamilies, collectFontWeights, collectRequiredTransforms } from "./collect";
import { sha256Hex } from "./hash";
import {
  LABELATOR_PACKAGE_FORMAT,
  LABELATOR_PACKAGE_FORMAT_VERSION,
  type LabelatorPackageAssetsIndex,
  type LabelatorPackageManifest,
  type LabelatorPackageValidationIssue,
  type LabelatorPackageValidationResult,
} from "./types";
import { readStoreZip } from "./zip";

function isAbsoluteOrRemote(path: string): boolean {
  return (
    path.startsWith("/") ||
    path.startsWith("\\") ||
    /^[a-zA-Z]:[\\/]/.test(path) ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)
  );
}

function push(
  issues: LabelatorPackageValidationIssue[],
  level: "error" | "warning",
  code: string,
  message: string,
) {
  issues.push({ level, code, message });
}

function parseJson<T>(text: string, label: string, issues: LabelatorPackageValidationIssue[]): T | null {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    push(issues, "error", "json_parse", `${label}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export type LabelatorPackageContents = {
  manifest: LabelatorPackageManifest;
  template: LabelatorTemplateJson;
  assetsIndex: LabelatorPackageAssetsIndex;
  files: Map<string, Uint8Array>;
};

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function readLabelatorPackageFromFiles(files: Map<string, Uint8Array>): LabelatorPackageContents {
  const issues: LabelatorPackageValidationIssue[] = [];
  const manifestBytes = files.get("manifest.json");
  const templateBytes = files.get("template.json");
  const assetsBytes = files.get("assets/index.json");
  if (!manifestBytes) throw new Error("Package missing manifest.json");
  if (!templateBytes) throw new Error("Package missing template.json");
  if (!assetsBytes) throw new Error("Package missing assets/index.json");

  const manifest = parseJson<LabelatorPackageManifest>(decodeText(manifestBytes), "manifest.json", issues);
  const template = parseJson<LabelatorTemplateJson>(decodeText(templateBytes), "template.json", issues);
  const assetsIndex = parseJson<LabelatorPackageAssetsIndex>(decodeText(assetsBytes), "assets/index.json", issues);
  if (!manifest || !template || !assetsIndex) {
    throw new Error(issues.map((issue) => issue.message).join("; ") || "Invalid package JSON");
  }
  return { manifest, template, assetsIndex, files };
}

export function readLabelatorPackageFromZip(bytes: Uint8Array): LabelatorPackageContents {
  return readLabelatorPackageFromFiles(readStoreZip(bytes));
}

/** Preserve document identity for round-trip checks (does not mint a new runtime id). */
export function documentFromPackage(contents: LabelatorPackageContents): LabelDocument {
  if (!isLabelatorTemplateJson(contents.template)) {
    throw new Error("Package template.json is not a Labelator template envelope");
  }
  return structuredClone(contents.template.document);
}

export function validateLabelatorPackageContents(contents: LabelatorPackageContents): LabelatorPackageValidationResult {
  const issues: LabelatorPackageValidationIssue[] = [];
  const { manifest, template, assetsIndex, files } = contents;

  if (manifest.format !== LABELATOR_PACKAGE_FORMAT) {
    push(issues, "error", "format", `Unsupported format "${String(manifest.format)}"`);
  }
  if (manifest.formatVersion !== LABELATOR_PACKAGE_FORMAT_VERSION) {
    push(
      issues,
      "error",
      "format_version",
      `Unsupported formatVersion ${String(manifest.formatVersion)} (expected ${LABELATOR_PACKAGE_FORMAT_VERSION})`,
    );
  }

  if (!isLabelatorTemplateJson(template)) {
    push(issues, "error", "template", "template.json is not a valid labelator.template envelope with LabelDocument");
  }

  const doc = template?.document;
  if (doc) {
    if (!(doc.page?.widthMm > 0) || !(doc.page?.heightMm > 0)) {
      push(issues, "error", "page", "template page dimensions must be positive millimetres");
    }
    if (
      manifest.template.page.widthMm !== doc.page.widthMm ||
      manifest.template.page.heightMm !== doc.page.heightMm
    ) {
      push(issues, "error", "page_mismatch", "manifest.template.page does not match template.json page");
    }
    if (manifest.template.elementCount !== doc.elements.length) {
      push(issues, "error", "element_count", "manifest elementCount does not match template elements");
    }

    const declared = new Set(manifest.requiredTransforms);
    for (const transform of collectRequiredTransforms(doc)) {
      if (!declared.has(transform)) {
        push(
          issues,
          "error",
          "transform_undeclared",
          `Element transform "${transform}" is not listed in manifest.requiredTransforms`,
        );
      }
    }

    for (const family of collectFontFamilies(doc)) {
      for (const weight of collectFontWeights(doc, family)) {
        const entry = manifest.fonts.find(
          (font) => resolveFontFamily(font.family) === family && font.weight === weight,
        );
        if (!entry) {
          push(issues, "error", "font_missing_manifest", `No manifest font for ${family} weight ${weight}`);
          continue;
        }
        if (isAbsoluteOrRemote(entry.path)) {
          push(issues, "error", "font_path", `Font path must be package-relative: ${entry.path}`);
        }
        const bytes = files.get(entry.path);
        if (!bytes) {
          push(issues, "error", "font_file", `Missing font file ${entry.path}`);
        } else if (sha256Hex(bytes) !== entry.sha256) {
          push(issues, "error", "font_checksum", `Checksum mismatch for ${entry.path}`);
        }
      }
    }

    for (const folderId of collectAssetFolderIds(doc)) {
      const collection = assetsIndex.collections.find((item) => item.labelatorAssetFolderId === folderId);
      if (!collection) {
        push(
          issues,
          "error",
          "asset_folder_unmapped",
          `Image assetFolderId "${folderId}" has no portable collection mapping in assets/index.json`,
        );
      }
    }
  }

  for (const font of manifest.fonts ?? []) {
    if (/googleapis|gstatic|http:|https:/i.test(font.source ?? "") && !files.get(font.path)) {
      push(issues, "error", "font_network", `Font ${font.family} still depends on network source without packaged file`);
    }
    if (isAbsoluteOrRemote(font.path)) {
      push(issues, "error", "font_path", `Font path must be package-relative: ${font.path}`);
    }
  }

  for (const collection of assetsIndex.collections ?? []) {
    for (const [stem, rel] of Object.entries(collection.entries)) {
      if (isAbsoluteOrRemote(rel) || rel.includes("..")) {
        push(issues, "error", "asset_path", `Asset path for ${collection.id}/${stem} is not portable: ${rel}`);
        continue;
      }
      const path = rel.startsWith("assets/") ? rel : `assets/${rel}`;
      if (!files.get(path)) {
        push(issues, "error", "asset_file", `Missing asset file ${path} (collection ${collection.id}, stem ${stem})`);
      }
    }
  }

  // Reject network / absolute imageDataUrl references inside the template for portable use.
  if (doc) {
    for (const element of doc.elements) {
      const src = element.imageDataUrl?.trim();
      if (!src) continue;
      if (src.startsWith("data:")) continue;
      if (isAbsoluteOrRemote(src) || src.startsWith("/")) {
        push(
          issues,
          "warning",
          "image_external",
          `Element ${element.id} imageDataUrl is not embedded in the package (${src.slice(0, 80)})`,
        );
      }
    }
  }

  const ok = !issues.some((issue) => issue.level === "error");
  return { ok, issues, manifest };
}

export function validateLabelatorPackageZip(bytes: Uint8Array): LabelatorPackageValidationResult {
  try {
    return validateLabelatorPackageContents(readLabelatorPackageFromZip(bytes));
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          level: "error",
          code: "package_read",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}
