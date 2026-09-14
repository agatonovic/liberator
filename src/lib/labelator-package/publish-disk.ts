/**
 * Node-only catalog publisher. Not imported by the browser bundle.
 * Package bytes still come from buildLabelatorPackage.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assetLookupKey, mimeFromName } from "../assets";
import { findColumnByName, type LabelDocument } from "../document";
import { resolveFontFamily } from "../fonts";
import { isShopifyLibraryDocument } from "../library-guard";
import { analyzePortableExport } from "./compatibility";
import { collectFontWeights, portableCollectionIdForFolder } from "./collect";
import {
  buildCatalogLabelatorPackage,
  catalogDocumentForExport,
  catalogPackageFileName,
  catalogPrintMode,
  publishedHref,
  type PublishedPackageRecord,
} from "./catalog-export";
import { packageBuildToZipBytes } from "./export";
import { sha256Hex } from "./hash";
import { packageFontInput, portableFontSource } from "./portable-fonts";
import type { PackageAssetInput, PackageFontInput } from "./types";

function walkFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...walkFiles(path));
    else found.push(path);
  }
  return found;
}

function assetIndex(repoRoot: string): Map<string, { fileName: string; bytes: Uint8Array; mime: string }> {
  const byStem = new Map<string, { fileName: string; bytes: Uint8Array; mime: string }>();
  for (const path of walkFiles(join(repoRoot, "public/assets"))) {
    const fileName = path.split("/").pop() ?? "";
    const stem = assetLookupKey(fileName);
    if (!stem) continue;
    const entry = { fileName, bytes: new Uint8Array(readFileSync(path)), mime: mimeFromName(fileName) };
    const existing = byStem.get(stem);
    if (!existing || path.includes("/packaging/")) byStem.set(stem, entry);
  }
  return byStem;
}

function exampleValues(document: LabelDocument, binding: string | undefined): string[] {
  const key = binding?.trim();
  if (!key) return [];
  const column = findColumnByName(document.dataColumns ?? [], key);
  return [column?.example, ...(column?.values ?? [])].filter((value): value is string => Boolean(value?.trim()));
}

function assetsFor(
  document: LabelDocument,
  files: Map<string, { fileName: string; bytes: Uint8Array; mime: string }>,
): PackageAssetInput[] {
  const columns = document.dataColumns ?? [];
  const packaged: PackageAssetInput[] = [];
  const seen = new Set<string>();
  for (const element of document.elements) {
    if (element.type !== "image" || !element.assetFolderId) continue;
    const collection = portableCollectionIdForFolder(document, element.assetFolderId, columns);
    const candidates = [...exampleValues(document, element.binding), element.content?.trim() ?? ""].filter(Boolean);
    for (const value of candidates) {
      const stem = assetLookupKey(value);
      const file = stem ? files.get(stem) : undefined;
      if (!file || seen.has(`${collection}:${stem}`)) continue;
      seen.add(`${collection}:${stem}`);
      packaged.push({
        collection,
        labelatorAssetFolderId: element.assetFolderId,
        stem,
        relativePath: `${collection}/${file.fileName}`,
        bytes: file.bytes,
        mime: file.mime,
      });
    }
  }
  return packaged;
}

function fontsFor(document: LabelDocument, repoRoot: string): PackageFontInput[] {
  const inputs: PackageFontInput[] = [];
  const families = [
    ...new Set(
      document.elements
        .filter((element) => element.type === "text")
        .map((element) => resolveFontFamily(element.style.fontFamily)),
    ),
  ];
  for (const family of families) {
    for (const weight of collectFontWeights(document, family)) {
      const source = portableFontSource(family, weight);
      if (!source) throw new Error(`No pinned font for ${family} ${weight}`);
      inputs.push(packageFontInput(source, new Uint8Array(readFileSync(join(repoRoot, source.repoPath)))));
    }
  }
  return inputs;
}

export function catalogPackageBytes(document: LabelDocument, repoRoot = process.cwd()): Uint8Array {
  const working = catalogDocumentForExport(document);
  return packageBuildToZipBytes(
    buildCatalogLabelatorPackage(document, {
      fonts: fontsFor(working, repoRoot),
      assets: assetsFor(working, assetIndex(repoRoot)),
      printMode: catalogPrintMode(working),
    }),
  );
}

export function publishLabelatorPackages(repoRoot = process.cwd()): PublishedPackageRecord[] {
  const library = JSON.parse(readFileSync(join(repoRoot, "data/library.json"), "utf8")) as {
    documents: LabelDocument[];
  };
  const files = assetIndex(repoRoot);
  const publicDir = join(repoRoot, "public/downloads/labelator");
  const records: PublishedPackageRecord[] = [];
  mkdirSync(publicDir, { recursive: true });

  for (const document of library.documents) {
    if (isShopifyLibraryDocument(document)) continue;
    const working = catalogDocumentForExport(document);
    const printMode = catalogPrintMode(working);
    const analyzed = analyzePortableExport(working, { printMode });
    if (!analyzed.compatible) continue;
    const build = buildCatalogLabelatorPackage(document, {
      fonts: fontsFor(working, repoRoot),
      assets: assetsFor(working, files),
      printMode,
    });
    const bytes = packageBuildToZipBytes(build);
    const fileName = catalogPackageFileName(working.name);
    if (build.fileName !== fileName) {
      throw new Error(`Package name mismatch for ${document.name}: ${build.fileName} != ${fileName}`);
    }
    writeFileSync(join(publicDir, fileName), bytes);
    rmSync(join(publicDir, fileName.replace(/\.labelator$/, "")), { recursive: true, force: true });
    records.push({
      name: working.name.trim(),
      fileName,
      href: publishedHref(fileName),
      sha256: sha256Hex(bytes),
      pageMm: `${working.page.widthMm} × ${working.page.heightMm} mm`,
      printMode: printMode === "sheet" ? "sheet" : "1-up",
      templateId: working.id,
      catalogId: working.catalogId ?? null,
    });
  }

  records.sort((a, b) => a.name.localeCompare(b.name));
  const json = `${JSON.stringify({ generatedBy: "scripts/publish-labelator-packages.mts", hrefPrefix: "/downloads/labelator", packages: records }, null, 2)}\n`;
  writeFileSync(join(publicDir, "index.json"), json);
  writeFileSync(join(repoRoot, "src/lib/labelator-package/published-index.json"), json);
  return records;
}
