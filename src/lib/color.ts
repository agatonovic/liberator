import { isPaintColor, type LabelElement } from "./document";

export const MAX_SAVED_COLORS = 24;

export function normalizeHex(value: string | undefined): string | null {
  if (!isPaintColor(value)) return null;
  let raw = value.trim().replace(/^#/, "").toUpperCase();
  if (/^[0-9A-F]{3}$/.test(raw)) raw = raw.split("").map((c) => c + c).join("");
  if (/^[0-9A-F]{8}$/.test(raw)) raw = raw.slice(0, 6);
  if (!/^[0-9A-F]{6}$/.test(raw)) return null;
  return `#${raw}`;
}

export function hexDigits(value: string | undefined, fallback: string) {
  return (normalizeHex(value) ?? normalizeHex(fallback) ?? "#12263A").slice(1);
}

export type Hsv = { h: number; s: number; v: number };

export function hexToHsv(hex: string): Hsv {
  const normalized = normalizeHex(hex) ?? "#12263A";
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function channel(n: number) {
  return Math.round(Math.min(1, Math.max(0, n)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return `#${channel(r + m)}${channel(g + m)}${channel(b + m)}`;
}

export function documentColors(elements: LabelElement[]): string[] {
  const seen = new Set<string>();
  const colors: string[] = [];
  function add(value: string | undefined) {
    const hex = normalizeHex(value);
    if (!hex || seen.has(hex)) return;
    seen.add(hex);
    colors.push(hex);
  }
  for (const el of elements) {
    add(el.style.fill);
    add(el.style.stroke);
    add(el.style.background);
    for (const span of el.spans ?? []) add(span.fill);
  }
  return colors;
}

export async function pickScreenColor(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const Ctor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
  if (!Ctor) return null;
  try {
    const result = await new Ctor().open();
    return normalizeHex(result.sRGBHex);
  } catch {
    return null;
  }
}

export function canPickScreenColor() {
  return typeof window !== "undefined" && "EyeDropper" in window;
}

export function mergeSavedColors(...lists: (string[] | undefined)[]) {
  const seen = new Set<string>();
  const colors: string[] = [];
  for (const list of lists) {
    for (const value of list ?? []) {
      const hex = normalizeHex(value);
      if (!hex || seen.has(hex)) continue;
      seen.add(hex);
      colors.push(hex);
      if (colors.length >= MAX_SAVED_COLORS) return colors;
    }
  }
  return colors;
}
