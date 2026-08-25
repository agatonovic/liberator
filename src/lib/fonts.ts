import { publicPath } from "./public-path";

export type LabelFont = {
  name: string;
  google?: boolean;
  local?: boolean;
  category: "sans" | "serif" | "display" | "mono" | "system";
};

export const LABEL_FONTS: LabelFont[] = [
  { name: "Artifakt Element Black", local: true, category: "sans" },
  { name: "Artifakt Element", local: true, category: "sans" },
  { name: "IBM Plex Sans", google: true, category: "sans" },
  { name: "Inter", google: true, category: "sans" },
  { name: "Roboto", google: true, category: "sans" },
  { name: "Open Sans", google: true, category: "sans" },
  { name: "Source Sans 3", google: true, category: "sans" },
  { name: "Noto Sans", google: true, category: "sans" },
  { name: "Work Sans", google: true, category: "sans" },
  { name: "Lato", google: true, category: "sans" },
  { name: "Montserrat", google: true, category: "sans" },
  { name: "Poppins", google: true, category: "sans" },
  { name: "Nunito Sans", google: true, category: "sans" },
  { name: "Rubik", google: true, category: "sans" },
  { name: "DM Sans", google: true, category: "sans" },
  { name: "Outfit", google: true, category: "sans" },
  { name: "Fira Sans", google: true, category: "sans" },
  { name: "PT Sans", google: true, category: "sans" },
  { name: "Archivo", google: true, category: "sans" },
  { name: "Barlow Condensed", google: true, category: "sans" },
  { name: "Oswald", google: true, category: "display" },
  { name: "Bebas Neue", google: true, category: "display" },
  { name: "Anton", google: true, category: "display" },
  { name: "Teko", google: true, category: "display" },
  { name: "Kanit", google: true, category: "display" },
  { name: "Russo One", google: true, category: "display" },
  { name: "Merriweather", google: true, category: "serif" },
  { name: "Playfair Display", google: true, category: "serif" },
  { name: "Source Serif 4", google: true, category: "serif" },
  { name: "IBM Plex Mono", google: true, category: "mono" },
  { name: "Roboto Mono", google: true, category: "mono" },
  { name: "Helvetica", category: "system" },
  { name: "Arial", category: "system" },
  { name: "Times New Roman", category: "system" },
  { name: "Georgia", category: "system" },
  { name: "Courier New", category: "system" },
  { name: "Verdana", category: "system" },
];

export const DEFAULT_FONT = "IBM Plex Sans";

const FONTS_BY_NAME = new Map(LABEL_FONTS.map((font) => [font.name, font]));

export function resolveFontFamily(family?: string) {
  const name = family?.trim() || DEFAULT_FONT;
  return FONTS_BY_NAME.has(name) ? name : DEFAULT_FONT;
}

export function canvasFontFamily(family?: string) {
  const name = resolveFontFamily(family);
  return `"${name}", Helvetica, sans-serif`;
}

export function isGoogleFont(family?: string) {
  return Boolean(FONTS_BY_NAME.get(resolveFontFamily(family))?.google);
}

export function isLocalFont(family?: string) {
  return Boolean(FONTS_BY_NAME.get(resolveFontFamily(family))?.local);
}

export function isEmbeddableFont(family?: string) {
  return isGoogleFont(family) || isLocalFont(family);
}

const LOCAL_FONT_FILES: Record<string, { "400": string; "700": string }> = {
  "Artifakt Element": {
    "400": "/fonts/ArtifaktElement.ttf",
    "700": "/fonts/ArtifaktElement-Bold.ttf",
  },
  "Artifakt Element Black": {
    "400": "/fonts/ArtifaktElement-Black.otf",
    "700": "/fonts/ArtifaktElement-Black.otf",
  },
};

const FIREFOX_TTF_UA =
  "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0";

export function googleFontsCssUrl(families: string[]) {
  const unique = [...new Set(families.map(resolveFontFamily).filter(isGoogleFont))];
  if (!unique.length) return null;
  const params = unique
    .map((name) => `family=${encodeURIComponent(name)}:wght@400;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

export async function fetchFontBytes(family: string, weight: 400 | 700) {
  const resolved = resolveFontFamily(family);
  const local = LOCAL_FONT_FILES[resolved]?.[String(weight) as "400" | "700"];
  if (local) {
    const res = await fetch(publicPath(local));
    if (!res.ok) throw new Error(`Could not load ${resolved} ${weight}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(resolved)}:wght@${weight}&display=swap`;
  const cssRes = await fetch(cssUrl, { headers: { "User-Agent": FIREFOX_TTF_UA } });
  if (!cssRes.ok) throw new Error(`Could not load ${resolved} ${weight}`);
  const css = await cssRes.text();
  const fileUrl = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];
  if (!fileUrl) throw new Error(`Could not load ${resolved} ${weight}`);
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error(`Could not load ${resolved} ${weight}`);
  return new Uint8Array(await fileRes.arrayBuffer());
}

const LINK_ID = "labelator-google-fonts";

export function ensureGoogleFontsLoaded(families: string[]) {
  if (typeof document === "undefined") return Promise.resolve();
  const href = googleFontsCssUrl(families);
  let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (!href) {
    link?.remove();
  } else {
    if (!link) {
      link = document.createElement("link");
      link.id = LINK_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }
  const google = [...new Set(families.map(resolveFontFamily).filter(isGoogleFont))];
  const local = [...new Set(families.map(resolveFontFamily).filter(isLocalFont))];
  if (!google.length && !local.length) return Promise.resolve();
  return Promise.all([
    ...google.flatMap((name) => [
      document.fonts.load(`400 64px "${name}"`),
      document.fonts.load(`700 64px "${name}"`),
    ]),
    ...local.flatMap((name) => [
      document.fonts.load(`400 64px "${name}"`),
      document.fonts.load(`700 64px "${name}"`),
    ]),
  ]).then(() => undefined);
}

const printFaces = new Map<string, Promise<FontFace>>();

function fontBinary(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function registerPrintFace(family: string, weight: 400 | 700) {
  const key = `${family}:${weight}`;
  const hit = printFaces.get(key);
  if (hit) return hit;
  const work = (async () => {
    const bytes = await fetchFontBytes(family, weight);
    const face = new FontFace(family, fontBinary(bytes), {
      weight: String(weight),
      style: "normal",
      display: "block",
    });
    const loaded = await face.load();
    document.fonts.add(loaded);
    return loaded;
  })();
  printFaces.set(key, work);
  return work;
}

/** Full outline files at the sizes Konva will paint — CSS 16px WOFF caches blob when scaled to print. */
export async function ensurePrintFonts(families: string[], sizesPx: number[] = [64]) {
  if (typeof document === "undefined") return;
  const unique = [...new Set(families.map(resolveFontFamily).filter(isEmbeddableFont))];
  if (!unique.length) return;
  await Promise.all(unique.flatMap((name) => [registerPrintFace(name, 400), registerPrintFace(name, 700)]));
  const sizes = [...new Set(sizesPx.map((n) => Math.max(12, Math.round(n))))];
  await Promise.all(
    unique.flatMap((name) =>
      sizes.flatMap((size) => [
        document.fonts.load(`400 ${size}px "${name}"`),
        document.fonts.load(`700 ${size}px "${name}"`),
        document.fonts.load(`normal ${size}px "${name}"`),
        document.fonts.load(`bold ${size}px "${name}"`),
      ]),
    ),
  );
  if (document.fonts.ready) await document.fonts.ready;
}
