import type { LabelDocument } from "../document";
import { buildTemplateJson, stringifyTemplateJson } from "../template-json";
import { resolveFontFamily } from "../fonts";
import {
  assertFontsCoverDocument,
  buildAssetsIndex,
  buildDataContract,
  collectRequiredTransforms,
  packageSlug,
} from "./collect";
import { sha256Hex } from "./hash";
import type {
  ExportLabelatorPackageOptions,
  LabelatorPackageBuild,
  LabelatorPackageFontEntry,
  LabelatorPackageManifest,
  PackageAssetInput,
} from "./types";
import { LABELATOR_PACKAGE_FORMAT, LABELATOR_PACKAGE_FORMAT_VERSION } from "./types";
import { buildStoreZip } from "./zip";

function jsonString(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function defaultPackageName(doc: LabelDocument, templateVersion: string): string {
  return `${packageSlug(doc.name)}_v${templateVersion.replace(/^v/i, "")}`;
}

function buildFontEntries(fonts: ExportLabelatorPackageOptions["fonts"]): LabelatorPackageFontEntry[] {
  return fonts
    .map((font) => {
      const path = `fonts/${font.fileName.replace(/^fonts\//, "")}`;
      return {
        family: resolveFontFamily(font.family),
        weight: font.weight,
        path,
        format: font.format,
        sha256: sha256Hex(font.bytes),
        source: font.source,
      } satisfies LabelatorPackageFontEntry;
    })
    .sort((a, b) => a.family.localeCompare(b.family) || a.weight - b.weight);
}

function validateAssetPaths(assets: PackageAssetInput[]): void {
  for (const asset of assets) {
    const rel = asset.relativePath.replace(/\\/g, "/");
    if (rel.startsWith("/") || rel.includes("://") || rel.includes("..")) {
      throw new Error(`Asset path must be package-relative without .. or URL: ${asset.relativePath}`);
    }
  }
}

/**
 * Build a portable `.labelator` package from an explicit LabelDocument + binaries.
 * Read-only: does not mutate `doc`, IndexedDB, or library.json.
 */
export function buildLabelatorPackage(
  doc: LabelDocument,
  options: ExportLabelatorPackageOptions,
): LabelatorPackageBuild {
  const missingFonts = assertFontsCoverDocument(doc, options.fonts);
  if (missingFonts.length) {
    throw new Error(`Missing font binaries for: ${missingFonts.join(", ")}`);
  }
  const assets = options.assets ?? [];
  validateAssetPaths(assets);

  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const templateVersion = options.templateVersion ?? "1";
  const packageName = options.packageName ?? defaultPackageName(doc, templateVersion);
  const template = buildTemplateJson(doc, {
    exportScope: options.exportScope ?? "working",
    includeVersionHistory: false,
    exportedAt,
  });
  const assetsIndex = buildAssetsIndex(doc, assets);
  const requiredTransforms = collectRequiredTransforms(doc);
  const fonts = buildFontEntries(options.fonts);

  const manifest: LabelatorPackageManifest = {
    format: LABELATOR_PACKAGE_FORMAT,
    formatVersion: LABELATOR_PACKAGE_FORMAT_VERSION,
    exportedAt,
    packageName,
    template: {
      name: doc.name.trim(),
      templateVersion,
      page: { ...doc.page },
      sheet: doc.sheet
        ? {
            pageSize: doc.sheet.pageSize,
            columns: doc.sheet.columns,
            rows: doc.sheet.rows,
            gapMm: doc.sheet.gapMm,
            marginMm: doc.sheet.marginMm,
          }
        : undefined,
      elementCount: doc.elements.length,
    },
    fonts,
    requiredTransforms,
    dataContract: { fields: buildDataContract(doc) },
    ...(options.printMode ? { print: { mode: options.printMode } } : {}),
    assets: {
      indexPath: "assets/index.json",
      collections: assetsIndex.collections.map((collection) => ({
        id: collection.id,
        entryCount: Object.keys(collection.entries).length,
        labelatorAssetFolderId: collection.labelatorAssetFolderId,
      })),
    },
    labelator: {
      templateId: doc.id,
      catalogId: doc.catalogId ?? null,
      catalogRevision: doc.catalogRevision ?? null,
      folderId: doc.folderId ?? null,
      documentVersion: doc.version,
      exportScope: template.exportScope,
    },
  };

  const binaries: Record<string, Uint8Array> = {};
  for (const font of options.fonts) {
    const path = `fonts/${font.fileName.replace(/^fonts\//, "")}`;
    binaries[path] = font.bytes;
  }
  for (const asset of assets) {
    const path = `assets/${asset.relativePath.replace(/^assets\//, "").replace(/\\/g, "/")}`;
    binaries[path] = asset.bytes;
  }

  const files = {
    "manifest.json": jsonString(manifest),
    "template.json": stringifyTemplateJson(template),
    "assets/index.json": jsonString(assetsIndex),
    binaries,
  };

  return {
    manifest,
    template,
    assetsIndex,
    files,
    fileName: `${packageName}.labelator`,
  };
}

/** Flatten package build into ZIP path → bytes map (deterministic key order via zip builder). */
export function packageBuildToZipEntries(build: LabelatorPackageBuild): { path: string; data: Uint8Array }[] {
  const entries: { path: string; data: Uint8Array }[] = [
    { path: "manifest.json", data: encode(build.files["manifest.json"]) },
    { path: "template.json", data: encode(build.files["template.json"]) },
    { path: "assets/index.json", data: encode(build.files["assets/index.json"]) },
  ];
  for (const [path, data] of Object.entries(build.files.binaries)) {
    entries.push({ path, data });
  }
  return entries;
}

export function packageBuildToZipBytes(build: LabelatorPackageBuild): Uint8Array {
  return buildStoreZip(packageBuildToZipEntries(build));
}

export type WritePackageResult = {
  directory: string;
  zipPath: string;
  fileName: string;
};

/**
 * Write package as an unpacked directory and a `.labelator` ZIP beside it.
 * Caller supplies filesystem primitives so this stays free of Next.js / IndexedDB.
 */
export async function writeLabelatorPackage(
  build: LabelatorPackageBuild,
  outputDir: string,
  io: {
    mkdir: (path: string, opts?: { recursive?: boolean }) => Promise<void>;
    writeFile: (path: string, data: Uint8Array | string) => Promise<void>;
    join: (...parts: string[]) => string;
    dirname: (path: string) => string;
  },
): Promise<WritePackageResult> {
  const root = io.join(outputDir, build.fileName.replace(/\.labelator$/i, ""));
  await io.mkdir(root, { recursive: true });
  await io.mkdir(io.join(root, "fonts"), { recursive: true });
  await io.mkdir(io.join(root, "assets"), { recursive: true });

  await io.writeFile(io.join(root, "manifest.json"), build.files["manifest.json"]);
  await io.writeFile(io.join(root, "template.json"), build.files["template.json"]);
  await io.writeFile(io.join(root, "assets", "index.json"), build.files["assets/index.json"]);

  for (const [rel, data] of Object.entries(build.files.binaries)) {
    const full = io.join(root, ...rel.split("/"));
    await io.mkdir(io.dirname(full), { recursive: true });
    await io.writeFile(full, data);
  }

  const zipPath = io.join(outputDir, build.fileName);
  await io.writeFile(zipPath, packageBuildToZipBytes(build));
  return { directory: root, zipPath, fileName: build.fileName };
}
