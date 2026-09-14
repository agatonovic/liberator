import type { PackageFontInput } from "./types";

export type PortableFontSource = {
  family: string;
  weight: 400 | 700;
  fileName: string;
  format: PackageFontInput["format"];
  /** Same-origin path served with the app. No remote font fetch. */
  publicPath: string;
  /** Repo-relative file the public path must match (pinned bytes). */
  repoPath: string;
};

/**
 * Font files the product exporter packages. Bytes are the same files the
 * proven Node exporters already read. Inter 400 is intentionally absent.
 */
export const PORTABLE_FONT_SOURCES: PortableFontSource[] = [
  {
    family: "Artifakt Element",
    weight: 400,
    fileName: "ArtifaktElement.ttf",
    format: "ttf",
    publicPath: "/fonts/ArtifaktElement.ttf",
    repoPath: "public/fonts/ArtifaktElement.ttf",
  },
  {
    family: "Artifakt Element",
    weight: 700,
    fileName: "ArtifaktElement-Bold.ttf",
    format: "ttf",
    publicPath: "/fonts/ArtifaktElement-Bold.ttf",
    repoPath: "public/fonts/ArtifaktElement-Bold.ttf",
  },
  {
    family: "Artifakt Element Black",
    weight: 400,
    fileName: "ArtifaktElement-Black.otf",
    format: "otf",
    publicPath: "/fonts/ArtifaktElement-Black.otf",
    repoPath: "public/fonts/ArtifaktElement-Black.otf",
  },
  {
    family: "Artifakt Element Black",
    weight: 700,
    fileName: "ArtifaktElement-Black.otf",
    format: "otf",
    publicPath: "/fonts/ArtifaktElement-Black.otf",
    repoPath: "public/fonts/ArtifaktElement-Black.otf",
  },
  {
    family: "Open Sans",
    weight: 400,
    fileName: "OpenSans-Regular.woff",
    format: "woff",
    publicPath: "/fonts/portable/OpenSans-Regular.woff",
    repoPath: "vendor/fonts/OpenSans-Regular.woff",
  },
  {
    family: "Open Sans",
    weight: 700,
    fileName: "OpenSans-Bold.woff",
    format: "woff",
    publicPath: "/fonts/portable/OpenSans-Bold.woff",
    repoPath: "vendor/fonts/OpenSans-Bold.woff",
  },
  {
    family: "Inter",
    weight: 700,
    fileName: "Inter-Bold.woff",
    format: "woff",
    publicPath: "/fonts/portable/Inter-Bold.woff",
    repoPath: "vendor/fonts/Inter-Bold.woff",
  },
];

export function portableFontSource(family: string, weight: 400 | 700): PortableFontSource | undefined {
  return PORTABLE_FONT_SOURCES.find((font) => font.family === family && font.weight === weight);
}

export function packageFontInput(source: PortableFontSource, bytes: Uint8Array): PackageFontInput {
  return {
    family: source.family,
    weight: source.weight,
    fileName: source.fileName,
    format: source.format,
    bytes,
    source: source.repoPath,
  };
}
