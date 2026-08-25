import type { TextAlign, TextSpan, VerticalAlign } from "./document";

export type TextRun = { text: string; fill: string; fontSizeMm: number };
export type PlacedRun = {
  text: string;
  fill: string;
  fontSize: number;
  x: number;
  y: number;
  width: number;
};

type CharStyle = { fill: string; fontSizeMm: number };

const DEFAULT_FILL = "#12263A";

export function parseCssColor(value: string, fallback = DEFAULT_FILL): string {
  const raw = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const rgb = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return fallback.startsWith("#") ? fallback.toUpperCase() : fallback;
  const hex = [rgb[1], rgb[2], rgb[3]]
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`.toUpperCase();
}

export function normalizeSpans(spans: TextSpan[] | undefined, length: number): TextSpan[] {
  if (!spans?.length || length <= 0) return [];
  return spans
    .map((span) => ({
      start: Math.max(0, Math.min(length, span.start)),
      end: Math.max(0, Math.min(length, span.end)),
      fill: span.fill ? parseCssColor(span.fill) : undefined,
      fontSizeMm: Number.isFinite(span.fontSizeMm) ? span.fontSizeMm : undefined,
    }))
    .filter((span) => span.end > span.start && (span.fill || span.fontSizeMm != null))
    .sort((a, b) => a.start - b.start);
}

/** Characters that participate in color transfer between part numbers (skip spaces / ZWSP). */
function isSignificantChar(ch: string) {
  return ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r" && ch !== "\u200B";
}

function significantIndices(content: string): number[] {
  const indices: number[] = [];
  for (let i = 0; i < content.length; i += 1) {
    if (isSignificantChar(content[i]!)) indices.push(i);
  }
  return indices;
}

function charStyles(
  content: string,
  defaults: CharStyle,
  spans?: TextSpan[],
): CharStyle[] {
  const fill = parseCssColor(defaults.fill);
  const fontSizeMm = defaults.fontSizeMm;
  // Use UTF-16 indices (same as DOM Selection offsets), not code-point iteration.
  const styles: CharStyle[] = Array.from({ length: content.length }, () => ({
    fill,
    fontSizeMm,
  }));
  for (const span of normalizeSpans(spans, content.length)) {
    for (let i = span.start; i < span.end; i += 1) {
      if (span.fill) styles[i]!.fill = span.fill;
      if (span.fontSizeMm != null) styles[i]!.fontSizeMm = span.fontSizeMm;
    }
  }
  return styles;
}

function sameStyle(a: CharStyle, b: CharStyle) {
  return a.fill === b.fill && a.fontSizeMm === b.fontSizeMm;
}

export function spansFromStyles(styles: CharStyle[], defaults: CharStyle): TextSpan[] {
  const base: CharStyle = { fill: parseCssColor(defaults.fill), fontSizeMm: defaults.fontSizeMm };
  const spans: TextSpan[] = [];
  let i = 0;
  while (i < styles.length) {
    const style = { fill: parseCssColor(styles[i].fill, base.fill), fontSizeMm: styles[i].fontSizeMm };
    let end = i + 1;
    while (end < styles.length && sameStyle(styles[end], style)) end += 1;
    if (!sameStyle(style, base)) {
      spans.push({
        start: i,
        end,
        fill: style.fill !== base.fill ? style.fill : undefined,
        fontSizeMm: style.fontSizeMm !== base.fontSizeMm ? style.fontSizeMm : undefined,
      });
    }
    i = end;
  }
  return spans;
}

export function runsFromContent(content: string, defaults: CharStyle, spans?: TextSpan[]): TextRun[] {
  if (!content) return [];
  const styles = charStyles(content, defaults, spans);
  const runs: TextRun[] = [];
  let i = 0;
  while (i < content.length) {
    let end = i + 1;
    while (end < content.length && sameStyle(styles[end], styles[i])) end += 1;
    runs.push({
      text: content.slice(i, end),
      fill: styles[i].fill,
      fontSizeMm: styles[i].fontSizeMm,
    });
    i = end;
  }
  return runs;
}

export function transferSpans(
  template: string,
  spans: TextSpan[] | undefined,
  value: string,
  defaults: CharStyle,
): TextSpan[] {
  if (!spans?.length || !value) return [];
  if (template === value) return normalizeSpans(spans, value.length);

  // Map by significant character position (digits/letters), not whole space-separated
  // tokens. Coloring 3 digits in the template must stay 3 digits on another part number,
  // even when group widths differ (e.g. "457" vs "58042").
  const tStyles = charStyles(template, defaults, spans);
  const tIdx = significantIndices(template);
  const vIdx = significantIndices(value);
  if (tIdx.length && vIdx.length) {
    const next: CharStyle[] = Array.from({ length: value.length }, () => ({
      fill: parseCssColor(defaults.fill),
      fontSizeMm: defaults.fontSizeMm,
    }));
    const n = Math.min(tIdx.length, vIdx.length);
    for (let k = 0; k < n; k += 1) {
      next[vIdx[k]!] = { ...tStyles[tIdx[k]!]! };
    }
    return spansFromStyles(next, defaults);
  }

  if (template.length === value.length) return normalizeSpans(spans, value.length);
  return [];
}

export function stripSpanKey(spans: TextSpan[] | undefined, key: "fill" | "fontSizeMm"): TextSpan[] {
  return (spans ?? [])
    .map((span) => {
      const next = { ...span, [key]: undefined };
      return next;
    })
    .filter((span) => span.fill || span.fontSizeMm != null);
}

export function applyCharStyle(
  content: string,
  spans: TextSpan[] | undefined,
  defaults: CharStyle,
  start: number,
  end: number,
  patch: { fill?: string; fontSizeMm?: number },
): { content: string; spans: TextSpan[] } {
  if (!content || end <= start) return { content, spans: normalizeSpans(spans, content.length) };
  const styles = charStyles(content, defaults, spans);
  const from = Math.max(0, Math.min(content.length, start));
  const to = Math.max(from, Math.min(content.length, end));
  const nextSize =
    patch.fontSizeMm != null && Number.isFinite(patch.fontSizeMm) && patch.fontSizeMm > 0
      ? Math.round(patch.fontSizeMm * 10) / 10
      : undefined;
  for (let i = from; i < to; i += 1) {
    if (patch.fill) styles[i].fill = parseCssColor(patch.fill, styles[i].fill);
    if (nextSize != null) styles[i].fontSizeMm = nextSize;
  }
  return { content, spans: spansFromStyles(styles, defaults) };
}

export function styleInRange(
  content: string,
  spans: TextSpan[] | undefined,
  defaults: CharStyle,
  start: number,
  end: number,
): CharStyle | null {
  if (!content || end <= start) return null;
  const styles = charStyles(content, defaults, spans);
  const from = Math.max(0, Math.min(content.length, start));
  const to = Math.max(from, Math.min(content.length, end));
  if (to <= from) return null;
  const slice = styles.slice(from, to);
  return {
    fill: majority(slice.map((item) => item.fill)) ?? parseCssColor(defaults.fill),
    fontSizeMm: majority(slice.map((item) => item.fontSizeMm)) ?? defaults.fontSizeMm,
  };
}

export function cssFontSizeToMm(
  value: string,
  inheritedMm: number,
  pxToMmFn: (px: number) => number,
): number | undefined {
  const raw = value.trim().toLowerCase();
  const num = Number.parseFloat(raw);
  if (!Number.isFinite(num)) return undefined;
  let mm: number;
  if (raw.endsWith("rem") || raw.endsWith("em")) mm = num * inheritedMm;
  else if (raw.endsWith("%")) mm = (num / 100) * inheritedMm;
  else if (raw.endsWith("pt")) mm = (num * 25.4) / 72;
  else if (raw.endsWith("mm")) mm = num;
  else if (raw.endsWith("cm")) mm = num * 10;
  else if (raw.endsWith("in")) mm = num * 25.4;
  else if (raw.endsWith("pc")) mm = (num * 12 * 25.4) / 72;
  else mm = pxToMmFn(num);
  if (!Number.isFinite(mm) || mm <= 0) return undefined;
  return Math.round(mm * 10) / 10;
}

function majority<T>(values: T[]): T | undefined {
  if (!values.length) return undefined;
  const counts = new Map<T, number>();
  let best = values[0];
  let bestCount = 0;
  for (const value of values) {
    const next = (counts.get(value) ?? 0) + 1;
    counts.set(value, next);
    if (next > bestCount) {
      best = value;
      bestCount = next;
    }
  }
  return best;
}

export function layoutRuns(
  runs: TextRun[],
  boxW: number,
  boxH: number,
  toLayoutSize: (fontSizeMm: number) => number,
  letterSpacing: number,
  lineHeight: number,
  align: TextAlign,
  verticalAlign: VerticalAlign,
  measure: (text: string, layoutSize: number) => number,
  measureInk: (layoutSize: number) => number = (size) => size,
): PlacedRun[] {
  type Token = { text: string; fill: string; fontSize: number; inkH: number; width: number; break: boolean };
  const tokens: Token[] = [];
  for (const run of runs) {
    const fontSize = toLayoutSize(run.fontSizeMm);
    const inkH = Math.max(1, measureInk(fontSize));
    const chunks = run.text.split(/(\n)/);
    for (const chunk of chunks) {
      if (chunk === "\n") {
        tokens.push({ text: "\n", fill: run.fill, fontSize, inkH, width: 0, break: true });
        continue;
      }
      for (const piece of chunk.split(/(\s+)/)) {
        if (!piece) continue;
        tokens.push({
          text: piece,
          fill: run.fill,
          fontSize,
          inkH,
          width: measure(piece, fontSize) + letterSpacing * Math.max(0, piece.length - 1),
          break: false,
        });
      }
    }
  }

  const lines: Token[][] = [[]];
  for (const token of tokens) {
    if (token.break) {
      lines.push([]);
      continue;
    }
    lines[lines.length - 1].push(token);
  }
  while (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop();

  const lineHeights = lines.map((line) => {
    const maxInk = line.reduce((max, token) => Math.max(max, token.inkH), 0);
    return Math.max(maxInk, 1) * lineHeight;
  });

  const placed: PlacedRun[] = [];
  let lineY = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const maxSize = line.reduce((max, token) => Math.max(max, token.fontSize), 0);
    const width = line.reduce((sum, token) => sum + token.width, 0);
    let x = 0;
    if (align === "center") x = (boxW - width) / 2;
    if (align === "right") x = boxW - width;
    for (const token of line) {
      if (token.text && !/^\s+$/.test(token.text)) {
        let offsetY = 0;
        if (verticalAlign === "middle") offsetY = (maxSize - token.fontSize) / 2;
        if (verticalAlign === "bottom") offsetY = maxSize - token.fontSize;
        placed.push({
          text: token.text,
          fill: token.fill,
          fontSize: token.fontSize,
          x,
          y: lineY + offsetY,
          width: token.width,
        });
      }
      x += token.width;
    }
    lineY += lineHeights[i];
  }

  if (!placed.length) return placed;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const run of placed) {
    minY = Math.min(minY, run.y);
    maxY = Math.max(maxY, run.y + run.fontSize);
  }
  const contentH = maxY - minY;
  let dy = -minY;
  if (verticalAlign === "middle") dy = (boxH - contentH) / 2 - minY;
  if (verticalAlign === "bottom") dy = boxH - maxY;
  if (Math.abs(dy) < 0.01) return placed;
  return placed.map((run) => ({ ...run, y: run.y + dy }));
}

export function serializeRichText(
  root: HTMLElement,
  defaults: CharStyle,
  pxToFontSizeMm: (px: number) => number,
): { content: string; spans: TextSpan[] } {
  let content = "";
  const styles: CharStyle[] = [];
  const base: CharStyle = { fill: parseCssColor(defaults.fill), fontSizeMm: defaults.fontSizeMm };

  function styleOf(node: HTMLElement, inherited: CharStyle): CharStyle {
    const next = { ...inherited };
    if (node.style.color) next.fill = parseCssColor(node.style.color, inherited.fill);
    else {
      const computed = getComputedStyle(node).color;
      if (computed) next.fill = parseCssColor(computed, inherited.fill);
    }
    const stored = node.getAttribute("data-font-size-mm");
    if (stored) {
      const mm = Number(stored);
      if (Number.isFinite(mm) && mm > 0) next.fontSizeMm = Math.round(mm * 10) / 10;
    } else if (node.style.fontSize) {
      const mm = cssFontSizeToMm(node.style.fontSize, inherited.fontSizeMm, pxToFontSizeMm);
      if (mm != null) next.fontSizeMm = mm;
    }
    return next;
  }

  function walk(node: Node, inherited: CharStyle) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      for (let i = 0; i < text.length; i += 1) {
        const char = text[i]!;
        // Zero-width placeholders from empty runs must not shift color indices.
        if (char === "\u200B") continue;
        content += char;
        styles.push(inherited);
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.tagName === "BR") {
      content += "\n";
      styles.push(inherited);
      return;
    }
    const next = styleOf(el, inherited);
    for (const child of el.childNodes) walk(child, next);
  }

  walk(root, base);
  if (content.endsWith("\n") && root.lastChild?.nodeName === "BR") {
    content = content.slice(0, -1);
    styles.pop();
  }
  return { content, spans: spansFromStyles(styles, base) };
}

export function runsToHtml(
  runs: TextRun[],
  toPx: (fontSizeMm: number) => number,
  verticalAlign: VerticalAlign = "middle",
): string {
  if (!runs.length) return "<span>&#8203;</span>";
  const vAlign = verticalAlign === "bottom" ? "baseline" : verticalAlign;
  return runs
    .map((run) => {
      const size = toPx(run.fontSizeMm);
      return `<span style="color:${run.fill};font-size:${size}px;vertical-align:${vAlign}" data-font-size-mm="${run.fontSizeMm}">${escapeHtml(run.text) || "&#8203;"}</span>`;
    })
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}
