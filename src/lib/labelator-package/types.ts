import type { LabelatorTemplateJson } from "../template-json";

/** Portable package format id (ZIP or directory). Independent of CATALOG_REVISION. */
export const LABELATOR_PACKAGE_FORMAT = "labelator.package" as const;
export const LABELATOR_PACKAGE_FORMAT_VERSION = 1 as const;

export type LabelatorFontFormat = "otf" | "ttf" | "woff";

export type LabelatorPackageFontEntry = {
  family: string;
  weight: 400 | 700;
  /** Path relative to package root, e.g. fonts/OpenSans-Bold.woff */
  path: string;
  format: LabelatorFontFormat;
  sha256: string;
  /** Provenance note (optional; not required for rendering). */
  source?: string;
};

export type LabelatorPackageDataField = {
  /** Stable portable key — prefer LabelDocument dataColumns.key when present. */
  key: string;
  label?: string;
  aliases: string[];
  required: boolean;
  example?: string;
  /** Element binding strings that resolve to this field (LABELATOR aliases). */
  elementBindings: string[];
};

/**
 * Portable asset collection. External renderers resolve:
 *   data[collection] → stem → entries[stem] → file under assets/
 * LABELATOR assetFolderId is optional metadata only.
 */
export type LabelatorPackageAssetCollection = {
  id: string;
  /** Optional LABELATOR runtime folder id (traceability only). */
  labelatorAssetFolderId?: string;
  /** stem (lowercase) → path relative to assets/ */
  entries: Record<string, string>;
};

export type LabelatorPackageAssetsIndex = {
  schemaVersion: 1;
  collections: LabelatorPackageAssetCollection[];
};

export type LabelatorPackageManifest = {
  format: typeof LABELATOR_PACKAGE_FORMAT;
  formatVersion: typeof LABELATOR_PACKAGE_FORMAT_VERSION;
  exportedAt: string;
  /** Human / CI package label, e.g. Warehouse_A3_Final_v1 */
  packageName: string;
  template: {
    /** Portable display name (trimmed). */
    name: string;
    /** Package-facing template version (not CATALOG_REVISION). */
    templateVersion: string;
    page: { widthMm: number; heightMm: number };
    sheet?: {
      pageSize: string;
      columns: number;
      rows: number;
      gapMm: number;
      marginMm: number;
    };
    elementCount: number;
  };
  fonts: LabelatorPackageFontEntry[];
  /**
   * Print job. Absent means one page per row at sticker size (existing packages).
   * `sheet` imposes `template.sheet` using LABELATOR slot placement.
   * This is a job mode, not a template identity.
   */
  print?: {
    mode: "label" | "sheet";
  };
  /** Named transform capabilities required to render this package. */
  requiredTransforms: string[];
  dataContract: {
    fields: LabelatorPackageDataField[];
  };
  assets: {
    indexPath: "assets/index.json";
    collections: Array<{
      id: string;
      entryCount: number;
      labelatorAssetFolderId?: string;
    }>;
  };
  /**
   * Optional LABELATOR studio metadata — not required for rendering.
   * External renderers MUST ignore this block.
   */
  labelator?: {
    templateId?: string;
    catalogId?: string | null;
    catalogRevision?: number | null;
    folderId?: string | null;
    documentVersion?: number;
    exportScope?: string;
  };
};

export type PackageFontInput = {
  family: string;
  weight: 400 | 700;
  bytes: Uint8Array;
  /** File name inside fonts/ (no directory prefix). */
  fileName: string;
  format: LabelatorFontFormat;
  source?: string;
};

export type PackageAssetInput = {
  collection: string;
  labelatorAssetFolderId?: string;
  /** Lookup key (usually packaging code). Stored lowercased. */
  stem: string;
  /** Path relative to assets/, e.g. packaging/X4202.jpg */
  relativePath: string;
  bytes: Uint8Array;
  mime?: string;
};

export type ExportLabelatorPackageOptions = {
  exportScope?: "working" | "published";
  exportedAt?: string;
  templateVersion?: string;
  packageName?: string;
  fonts: PackageFontInput[];
  assets?: PackageAssetInput[];
  /** Absent keeps one sticker per page. `sheet` uses the document sheet layout. */
  printMode?: "label" | "sheet";
};

export type LabelatorPackageFiles = {
  "manifest.json": string;
  "template.json": string;
  "assets/index.json": string;
  /** Relative path → binary */
  binaries: Record<string, Uint8Array>;
};

export type LabelatorPackageBuild = {
  manifest: LabelatorPackageManifest;
  template: LabelatorTemplateJson;
  assetsIndex: LabelatorPackageAssetsIndex;
  files: LabelatorPackageFiles;
  /** Suggested download / artifact file name including .labelator */
  fileName: string;
};

export type LabelatorPackageValidationIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
};

export type LabelatorPackageValidationResult = {
  ok: boolean;
  issues: LabelatorPackageValidationIssue[];
  manifest?: LabelatorPackageManifest;
};
