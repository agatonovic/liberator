import {
  LineCapStyle,
  PDFDocument,
  PDFFont,
  PDFPage,
  PrintScaling,
  RGB,
  StandardFonts,
  degrees,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  rotateRadians,
  toRadians,
  translate,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { barcodeDataUrl, dataUrlToBytes, qrDataUrl } from "./codes";
import {
  displayPose,
  isPaintColor,
  isPolygonType,
  lineLocalPoints,
  strokeDashPattern,
  type LabelDocument,
  type LabelElement,
  type SheetLayout,
  type SheetPageSize,
} from "./document";
import { fetchFontBytes, isEmbeddableFont, resolveFontFamily } from "./fonts";
import { resolveValue, useDesignedMedia, type ColumnMapping, type DataRow } from "./resolve";
import { isStrokeArrow, pointsToSvgPath, polygonPoints } from "./shapes";
import { layoutRuns, runsFromContent, transferSpans } from "./text-color";
import { fitPlainFontSize, wrapPlainLines } from "./text-fit";
import { resolveBoundImageSrc } from "./assets";
import { useAssetStore } from "./asset-store";
import { gaMagacinPrefixSpans, normalizeArrow } from "./format";
import { resolvePublicSrc } from "./public-path";
import { mmToPt } from "./units";

const SHEET_MM: Record<SheetPageSize, { widthMm: number; heightMm: number }> = {
  A4: { widthMm: 210, heightMm: 297 },
  "A4-landscape": { widthMm: 297, heightMm: 210 },
  A3: { widthMm: 297, heightMm: 420 },
  "A3-landscape": { widthMm: 420, heightMm: 297 },
  letter: { widthMm: 215.9, heightMm: 279.4 },
};

function parseColor(hex: string | undefined, fallback: RGB): RGB {
  if (!isPaintColor(hex)) return fallback;
  const value = hex.replace("#", "");
  if (value.length !== 6) return fallback;
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  if ([r, g, b].some((n) => Number.isNaN(n))) return fallback;
  return rgb(r, g, b);
}

function roundedRectPath(width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (r <= 0) {
    return `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
  }
  return [
    `M ${r} 0`,
    `L ${width - r} 0`,
    `Q ${width} 0 ${width} ${r}`,
    `L ${width} ${height - r}`,
    `Q ${width} ${height} ${width - r} ${height}`,
    `L ${r} ${height}`,
    `Q 0 ${height} 0 ${height - r}`,
    `L 0 ${r}`,
    `Q 0 0 ${r} 0`,
    "Z",
  ].join(" ");
}

/** PDF y-up coordinate of a Konva top-left (y-down) point. */
function pdfTopLeft(pageHeightPt: number, xMm: number, yMm: number): { x: number; y: number } {
  return { x: mmToPt(xMm), y: pageHeightPt - mmToPt(yMm) };
}

/**
 * pdf-lib `drawSvgPath` translates to (x,y), rotates, then `scale(1,-1)` so the
 * path is SVG/Konva y-down. Origin must be the element's top-left, and path
 * points must stay in Konva space — do not pre-flip Y or pass the bottom-left.
 */
function konvaSvgRotate(rotation: number) {
  return rotation ? degrees(-rotation) : undefined;
}

/**
 * Native PDF operators (rect, image, text) are y-up with origin at the
 * bottom-left. Konva rotates clockwise around the top-left, so rotated
 * natives get a matching CTM and then draw at (0, -height).
 */
function withKonvaPivot(
  page: PDFPage,
  topLeft: { x: number; y: number },
  boxHeightPt: number,
  rotation: number,
  draw: (origin: { x: number; y: number }) => void,
) {
  if (!rotation) {
    draw({ x: topLeft.x, y: topLeft.y - boxHeightPt });
    return;
  }
  page.pushOperators(
    pushGraphicsState(),
    translate(topLeft.x, topLeft.y),
    rotateRadians(toRadians(degrees(-rotation))),
  );
  draw({ x: 0, y: -boxHeightPt });
  page.pushOperators(popGraphicsState());
}

export function sheetPageSizeMm(pageSize: SheetPageSize) {
  return SHEET_MM[pageSize];
}

export function defaultSheetForLabel(
  label: { widthMm: number; heightMm: number },
  existing?: SheetLayout,
): SheetLayout {
  if (existing) {
    const margin = Math.min(existing.marginMm, maxMarginForLabel(label, existing.pageSize));
    const fit = fitLabelOnSheet(label, existing.pageSize, existing.gapMm, margin);
    if (fit.fits) {
      return {
        ...existing,
        marginMm: margin,
        columns: Math.min(Math.max(1, existing.columns), fit.columns),
        rows: Math.min(Math.max(1, existing.rows), fit.rows),
      };
    }
  }
  const candidates: { pageSize: SheetPageSize; gapMm: number; marginMm: number }[] = [
    { pageSize: "A3-landscape", gapMm: 0, marginMm: 2 },
    { pageSize: "A4-landscape", gapMm: 2, marginMm: 4 },
    { pageSize: "A3", gapMm: 0, marginMm: 2 },
    { pageSize: "A4", gapMm: 2, marginMm: 4 },
    { pageSize: "letter", gapMm: 2, marginMm: 4 },
  ];
  for (const option of candidates) {
    const margin = Math.min(option.marginMm, maxMarginForLabel(label, option.pageSize));
    const fit = fitLabelOnSheet(label, option.pageSize, option.gapMm, margin);
    if (fit.fits) {
      return {
        pageSize: option.pageSize,
        columns: fit.columns,
        rows: fit.rows,
        gapMm: option.gapMm,
        marginMm: margin,
      };
    }
  }
  return { pageSize: "A4", columns: 1, rows: 1, gapMm: 2, marginMm: 4 };
}

export function fitLabelOnSheet(
  label: { widthMm: number; heightMm: number },
  pageSize: SheetPageSize,
  gapMm: number,
  marginMm: number,
): { columns: number; rows: number; slots: number; fits: boolean } {
  const page = SHEET_MM[pageSize];
  const availableW = Math.max(0, page.widthMm - marginMm * 2);
  const availableH = Math.max(0, page.heightMm - marginMm * 2);
  const gap = Math.max(0, gapMm);
  const fits = label.widthMm <= availableW + 0.05 && label.heightMm <= availableH + 0.05;
  if (!fits) return { columns: 0, rows: 0, slots: 0, fits: false };
  const columns = Math.max(1, Math.floor((availableW + gap) / (label.widthMm + gap)));
  const rows = Math.max(1, Math.floor((availableH + gap) / (label.heightMm + gap)));
  return { columns, rows, slots: columns * rows, fits: true };
}

export function maxMarginForLabel(label: { widthMm: number; heightMm: number }, pageSize: SheetPageSize) {
  const page = SHEET_MM[pageSize];
  return Math.max(0, Math.min((page.widthMm - label.widthMm) / 2, (page.heightMm - label.heightMm) / 2));
}

export function paperFitsLabel(
  label: { widthMm: number; heightMm: number },
  pageSize: SheetPageSize,
  gapMm = 0,
  marginMm = 0,
) {
  return fitLabelOnSheet(label, pageSize, gapMm, Math.min(marginMm, maxMarginForLabel(label, pageSize))).fits;
}

/** Top-left of each sticker in y-down millimetres, same as the designer and paper preview. */
export function computeSlotOrigins(
  sheet: SheetLayout,
  label: { widthMm: number; heightMm: number },
): { xMm: number; yMm: number }[] {
  const page = SHEET_MM[sheet.pageSize];
  const margin = sheet.marginMm ?? 0;
  const gap = sheet.gapMm ?? 0;
  const fitted = fitLabelOnSheet(label, sheet.pageSize, gap, margin);
  if (!fitted.fits) return [];
  const columns = Math.min(Math.max(1, sheet.columns), fitted.columns);
  const rows = Math.min(Math.max(1, sheet.rows), fitted.rows);
  const usedW = columns * label.widthMm + Math.max(0, columns - 1) * gap;
  const usedH = rows * label.heightMm + Math.max(0, rows - 1) * gap;
  const x0 = Math.max(0, (page.widthMm - usedW) / 2);
  const y0 = Math.max(0, (page.heightMm - usedH) / 2);
  const origins: { xMm: number; yMm: number }[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      origins.push({
        xMm: x0 + col * (label.widthMm + gap),
        yMm: y0 + row * (label.heightMm + gap),
      });
    }
  }
  return origins;
}

function textWidthWithSpacing(font: PDFFont, text: string, size: number, spacing: number) {
  if (!text) return 0;
  return font.widthOfTextAtSize(text, size) + spacing * Math.max(0, text.length - 1);
}

function wrapTextLines(font: PDFFont, text: string, size: number, spacing: number, maxWidth: number) {
  return wrapPlainLines(text, maxWidth, size, spacing, (line, nextSize) => font.widthOfTextAtSize(line, nextSize));
}

function drawSpacedLine(
  page: PDFPage,
  line: string,
  opts: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color: RGB;
    opacity: number;
    spacing: number;
  },
) {
  if (!line) return;
  if (Math.abs(opts.spacing) < 0.001) {
    page.drawText(line, {
      x: opts.x,
      y: opts.y,
      size: opts.size,
      font: opts.font,
      color: opts.color,
      opacity: opts.opacity,
    });
    return;
  }
  let cursor = opts.x;
  for (const char of line) {
    page.drawText(char, {
      x: cursor,
      y: opts.y,
      size: opts.size,
      font: opts.font,
      color: opts.color,
      opacity: opts.opacity,
    });
    cursor += opts.font.widthOfTextAtSize(char, opts.size) + opts.spacing;
  }
}

async function embedImage(pdf: PDFDocument, src: string) {
  let bytes: Uint8Array = new Uint8Array();
  let jpeg = src.startsWith("data:image/jpeg") || src.startsWith("data:image/jpg") || /\.jpe?g(\?|$)/i.test(src);
  if (src.startsWith("data:")) {
    bytes = dataUrlToBytes(src);
  } else if (src.startsWith("blob:") || src.startsWith("/") || /^https?:\/\//i.test(src)) {
    const res = await fetch(src);
    if (!res.ok) return null;
    bytes = new Uint8Array(await res.arrayBuffer());
    const type = res.headers.get("content-type") || "";
    jpeg = jpeg || type.includes("jpeg") || type.includes("jpg");
  }
  if (!bytes.length) return null;
  return jpeg ? pdf.embedJpg(bytes) : pdf.embedPng(bytes);
}

type FontPair = { regular: PDFFont; bold: PDFFont };

async function standardPair(pdf: PDFDocument, family: string): Promise<FontPair> {
  const lower = family.toLowerCase();
  if (lower.includes("times") || lower.includes("georgia") || lower.includes("serif")) {
    return {
      regular: await pdf.embedFont(StandardFonts.TimesRoman),
      bold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    };
  }
  if (lower.includes("courier") || lower.includes("mono")) {
    return {
      regular: await pdf.embedFont(StandardFonts.Courier),
      bold: await pdf.embedFont(StandardFonts.CourierBold),
    };
  }
  return {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
}

async function embedFamily(pdf: PDFDocument, family: string): Promise<FontPair> {
  const name = resolveFontFamily(family);
  if (!isEmbeddableFont(name)) return standardPair(pdf, name);
  try {
    const regularBytes = await fetchFontBytes(name, 400);
    let boldBytes = regularBytes;
    try {
      boldBytes = await fetchFontBytes(name, 700);
    } catch {
      boldBytes = regularBytes;
    }
    return {
      regular: await pdf.embedFont(regularBytes),
      bold: await pdf.embedFont(boldBytes),
    };
  } catch {
    return standardPair(pdf, "Helvetica");
  }
}

async function embedDocumentFonts(pdf: PDFDocument, doc: LabelDocument) {
  const families = [
    ...new Set(
      doc.elements
        .filter((element) => element.type === "text")
        .map((element) => resolveFontFamily(element.style.fontFamily)),
    ),
  ];
  if (!families.length) families.push(resolveFontFamily(undefined));
  const map = new Map<string, FontPair>();
  for (const family of families) {
    map.set(family, await embedFamily(pdf, family));
  }
  if (!map.has("IBM Plex Sans")) {
    map.set("IBM Plex Sans", await embedFamily(pdf, "IBM Plex Sans"));
  }
  return map;
}

async function drawElement(
  pdf: PDFDocument,
  page: PDFPage,
  element: LabelElement,
  origin: { xMm: number; yMm: number },
  pageHeightPt: number,
  fonts: Map<string, FontPair>,
  value: string,
): Promise<void> {
  const pose = displayPose(element, value);
  const xMm = origin.xMm + pose.x;
  const yMm = origin.yMm + pose.y;
  const tl = pdfTopLeft(pageHeightPt, xMm, yMm);
  const width = mmToPt(element.width);
  const height = mmToPt(Math.max(element.height, 0.2));
  const opacity = element.style.opacity ?? 1;
  const fill = parseColor(element.style.fill, rgb(0.07, 0.15, 0.23));
  const stroke = parseColor(element.style.stroke, rgb(0.07, 0.15, 0.23));
  const strokeWidth = mmToPt(element.style.strokeWidth ?? 0);
  const rotation = pose.rotation || 0;
  const hasFill = isPaintColor(element.style.fill);
  const hasStroke = isPaintColor(element.style.stroke) && strokeWidth > 0;
  const dashArray = hasStroke ? strokeDashPattern(element.style, mmToPt) : undefined;
  const dashCap =
    element.style.strokeStyle === "dotted"
      ? LineCapStyle.Round
      : element.style.lineCap === "round"
        ? LineCapStyle.Round
        : element.style.lineCap === "square"
          ? LineCapStyle.Projecting
          : LineCapStyle.Butt;
  const paintNative = (draw: (box: { x: number; y: number }) => void) =>
    withKonvaPivot(page, tl, height, rotation, draw);

  if (element.type === "rect") {
    const radius = mmToPt(element.style.cornerRadiusMm ?? 0);
    if (radius > 0) {
      page.drawSvgPath(roundedRectPath(width, height, radius), {
        x: tl.x,
        y: tl.y,
        color: hasFill ? fill : undefined,
        borderColor: hasStroke ? stroke : undefined,
        borderWidth: hasStroke ? strokeWidth : 0,
        borderDashArray: dashArray,
        borderLineCap: dashCap,
        opacity,
        rotate: konvaSvgRotate(rotation),
      });
      return;
    }
    paintNative((box) => {
      page.drawRectangle({
        x: box.x,
        y: box.y,
        width,
        height,
        color: hasFill ? fill : undefined,
        borderColor: hasStroke ? stroke : undefined,
        borderWidth: hasStroke ? strokeWidth : undefined,
        borderDashArray: dashArray,
        borderLineCap: dashCap,
        opacity,
      });
    });
    return;
  }

  if (element.type === "ellipse") {
    paintNative((box) => {
      page.drawEllipse({
        x: box.x + width / 2,
        y: box.y + height / 2,
        xScale: width / 2,
        yScale: height / 2,
        color: hasFill ? fill : undefined,
        borderColor: hasStroke ? stroke : undefined,
        borderWidth: hasStroke ? strokeWidth : undefined,
        borderDashArray: dashArray,
        borderLineCap: dashCap,
        opacity,
      });
    });
    return;
  }

  if (element.type === "line") {
    if (!hasStroke) return;
    const pts = lineLocalPoints(width, height);
    page.drawSvgPath(`M ${pts[0]} ${pts[1]} L ${pts[2]} ${pts[3]}`, {
      x: tl.x,
      y: tl.y,
      borderColor: stroke,
      borderWidth: strokeWidth || mmToPt(0.4),
      borderLineCap: dashCap,
      borderDashArray: dashArray,
      opacity,
      rotate: konvaSvgRotate(rotation),
    });
    return;
  }

  if (isPolygonType(element.type)) {
    const arrowKind = element.style.arrowKind ?? "block";
    const open = (element.type === "arrow" || element.type === "doubleArrow") && isStrokeArrow(arrowKind);
    const path = pointsToSvgPath(polygonPoints(element.type, width, height, arrowKind), !open);
    if (!path) return;
    const ink = hasFill ? fill : hasStroke ? stroke : rgb(0.07, 0.15, 0.23);
    if (open) {
      page.drawSvgPath(path, {
        x: tl.x,
        y: tl.y,
        borderColor: ink,
        borderWidth: Math.max(strokeWidth, mmToPt(0.45)),
        borderLineCap: LineCapStyle.Round,
        opacity,
        rotate: konvaSvgRotate(rotation),
      });
      return;
    }
    if (hasFill || hasStroke) {
      page.drawSvgPath(path, {
        x: tl.x,
        y: tl.y,
        color: hasFill ? fill : undefined,
        borderColor: hasStroke ? stroke : undefined,
        borderWidth: hasStroke ? strokeWidth : 0,
        borderDashArray: dashArray,
        borderLineCap: dashCap,
        opacity,
        rotate: konvaSvgRotate(rotation),
      });
    }
    return;
  }

  if (element.type === "text") {
    if (!value.trim()) return;
    const pair =
      fonts.get(resolveFontFamily(element.style.fontFamily)) ?? fonts.get("IBM Plex Sans") ?? [...fonts.values()][0];
    if (!pair) return;
    const designedSize = mmToPt(element.style.fontSizeMm ?? 4);
    const font = element.style.fontWeight === "bold" ? pair.bold : pair.regular;
    const text = value;
    const spacing = mmToPt(element.style.letterSpacingMm ?? 0);
    const defaultFill = element.style.fill || "#12263A";
    const defaults = { fill: defaultFill, fontSizeMm: element.style.fontSizeMm ?? 4 };
    const transferred = element.content
      ? transferSpans(element.content, element.spans, text, defaults)
      : element.spans;
    const spans = element.transform === "ga_magacin" ? gaMagacinPrefixSpans(text, transferred) : transferred;
    const measure = (line: string, size: number) => font.widthOfTextAtSize(line, size);
    paintNative((box) => {
      if (spans?.length) {
        const runs = runsFromContent(text, defaults, spans);
        const placed = layoutRuns(
          runs,
          width,
          height,
          mmToPt,
          spacing,
          element.style.lineHeight ?? 1,
          element.style.align ?? "left",
          element.style.verticalAlign ?? "middle",
          measure,
        );
        for (const run of placed) {
          drawSpacedLine(page, run.text, {
            x: box.x + run.x,
            y: box.y + height - run.y - run.fontSize,
            size: run.fontSize,
            font,
            color: parseColor(run.fill, fill),
            opacity,
            spacing,
          });
        }
        return;
      }
      const fontSize = fitPlainFontSize({
        text,
        designed: element.content ?? "",
        boxW: width,
        boxH: height,
        fontSize: designedSize,
        minFontSize: mmToPt(0.5),
        letterSpacing: spacing,
        lineHeight: element.style.lineHeight ?? 1,
        measure,
      });
      const lineHeightPt = fontSize * (element.style.lineHeight ?? 1);
      const lines = wrapTextLines(font, text, fontSize, spacing, width);
      const blockHeight = lines.length * lineHeightPt;
      let blockTop = box.y + (height + blockHeight) / 2;
      if (element.style.verticalAlign === "top") blockTop = box.y + height;
      if (element.style.verticalAlign === "bottom") blockTop = box.y + blockHeight;
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const lineWidth = textWidthWithSpacing(font, line, fontSize, spacing);
        let lineX = box.x;
        if (element.style.align === "center") lineX = box.x + (width - lineWidth) / 2;
        if (element.style.align === "right") lineX = box.x + width - lineWidth;
        drawSpacedLine(page, line, {
          x: Math.max(box.x, lineX),
          y: blockTop - fontSize - i * lineHeightPt,
          size: fontSize,
          font,
          color: fill,
          opacity,
          spacing,
        });
      }
    });
    return;
  }

  if (element.type === "barcode") {
    if (!value.trim()) return;
    const printPx = (mm: number) => Math.round((mm * 300) / 25.4);
    const dataUrl = barcodeDataUrl(
      value,
      element.style.barcodeSymbology ?? "code128",
      element.style.barcodeDisplayValue ?? false,
      printPx(element.width),
      printPx(Math.max(element.height, 0.2)),
    );
    const image = await embedImage(pdf, dataUrl);
    if (image) {
      paintNative((box) => {
        page.drawImage(image, { x: box.x, y: box.y, width, height, opacity });
      });
    }
    return;
  }

  if (element.type === "qr") {
    if (!value.trim()) return;
    const side = Math.min(width, height);
    const sizePx = Math.round((Math.min(element.width, element.height) * 300) / 25.4);
    const dataUrl = await qrDataUrl(value, sizePx);
    const image = await embedImage(pdf, dataUrl);
    if (image) {
      paintNative((box) => {
        page.drawImage(image, {
          x: box.x + (width - side) / 2,
          y: box.y + (height - side) / 2,
          width: side,
          height: side,
          opacity,
        });
      });
    }
    return;
  }

  if (element.type === "image") {
    let src =
      resolveBoundImageSrc(element, value, useAssetStore.getState().assets, useAssetStore.getState().folders) ??
      (useDesignedMedia(element, value) ? resolvePublicSrc(element.imageDataUrl) : undefined);
    if (src && /\/arrows\/(?:UP|DOWN)/.test(src) && value.trim()) {
      src = src.replace(/UP|DOWN/, normalizeArrow(value));
    }
    if (src) {
      const image = await embedImage(pdf, src);
      if (image) {
        paintNative((box) => {
          page.drawImage(image, { x: box.x, y: box.y, width, height, opacity });
        });
        return;
      }
    }
    if (!useDesignedMedia(element, value)) return;
    paintNative((box) => {
      page.drawRectangle({
        x: box.x,
        y: box.y,
        width,
        height,
        color: rgb(0.96, 0.95, 0.93),
        borderColor: rgb(0.85, 0.83, 0.78),
        borderWidth: 0.75,
        borderDashArray: [4, 3],
        opacity,
      });
      const label = "IMAGE";
      const fallback = fonts.get("IBM Plex Sans") ?? [...fonts.values()][0];
      if (!fallback) return;
      const fontSize = Math.min(11, Math.max(6, height * 0.18));
      const textWidth = fallback.regular.widthOfTextAtSize(label, fontSize);
      page.drawText(label, {
        x: box.x + Math.max(0, (width - textWidth) / 2),
        y: box.y + (height - fontSize) / 2,
        size: fontSize,
        font: fallback.regular,
        color: rgb(0.54, 0.51, 0.46),
        opacity,
      });
    });
  }
}

async function drawLabel(
  pdf: PDFDocument,
  page: PDFPage,
  doc: LabelDocument,
  origin: { xMm: number; yMm: number },
  row: DataRow | null,
  mapping: ColumnMapping,
  fonts: Map<string, FontPair>,
): Promise<void> {
  const pageHeightPt = page.getHeight();
  for (const element of doc.elements) {
    if (element.hidden) continue;
    const value = resolveValue(element, row, mapping, doc.dataColumns);
    await drawElement(pdf, page, element, origin, pageHeightPt, fonts, value);
  }
}

function rowCacheKey(row: DataRow | null) {
  return row ? JSON.stringify(row) : "__sample__";
}

async function stampCanvasLabel(
  pdf: PDFDocument,
  page: PDFPage,
  doc: LabelDocument,
  origin: { xMm: number; yMm: number },
  png: Uint8Array,
): Promise<void> {
  const image = await pdf.embedPng(png);
  const width = mmToPt(doc.page.widthMm);
  const height = mmToPt(doc.page.heightMm);
  page.drawImage(image, {
    x: mmToPt(origin.xMm),
    y: page.getHeight() - mmToPt(origin.yMm) - height,
    width,
    height,
  });
}

async function generateCanvasPdf(
  doc: LabelDocument,
  dataRows: Array<DataRow | null>,
  mapping: ColumnMapping,
): Promise<Uint8Array> {
  const { rasterizeLabelPng, composeSheetPng } = await import("@/components/print/raster-label");
  const pdf = await PDFDocument.create();
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const cache = new Map<string, Uint8Array>();

  async function pngFor(row: DataRow | null) {
    const key = rowCacheKey(row);
    const hit = cache.get(key);
    if (hit) return hit;
    const bytes = await rasterizeLabelPng(doc, row, mapping);
    cache.set(key, bytes);
    return bytes;
  }

  const labelSize = { widthPt: mmToPt(doc.page.widthMm), heightPt: mmToPt(doc.page.heightMm) };

  if (!doc.sheet) {
    for (const row of dataRows) {
      const page = pdf.addPage([labelSize.widthPt, labelSize.heightPt]);
      await stampCanvasLabel(pdf, page, doc, { xMm: 0, yMm: 0 }, await pngFor(row));
    }
    return pdf.save();
  }

  const sheet = SHEET_MM[doc.sheet.pageSize];
  const origins = computeSlotOrigins(doc.sheet, doc.page);
  if (!origins.length) {
    const page = sheetPageSizeMm(doc.sheet.pageSize);
    throw new Error(
      `This sticker (${doc.page.widthMm} × ${doc.page.heightMm} mm) does not fit on ${doc.sheet.pageSize.replace("-", " ")} (${page.widthMm} × ${page.heightMm} mm). Choose a larger paper size, reduce the margin, or print at sticker size.`,
    );
  }
  const slotsPerPage = Math.max(1, origins.length);
  for (let i = 0; i < dataRows.length; i += slotsPerPage) {
    const page = pdf.addPage([mmToPt(sheet.widthMm), mmToPt(sheet.heightMm)]);
    const chunk = dataRows.slice(i, i + slotsPerPage);
    const pngs: Uint8Array[] = [];
    for (const row of chunk) pngs.push(await pngFor(row));
    const sheetPng = await composeSheetPng(sheet, doc.page, origins, pngs);
    const image = await pdf.embedPng(sheetPng);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: page.getWidth(),
      height: page.getHeight(),
    });
  }
  return pdf.save();
}

async function generateVectorPdf(
  doc: LabelDocument,
  dataRows: Array<DataRow | null>,
  mapping: ColumnMapping,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const fonts = await embedDocumentFonts(pdf, doc);
  const labelSize = { widthPt: mmToPt(doc.page.widthMm), heightPt: mmToPt(doc.page.heightMm) };

  if (!doc.sheet) {
    for (const row of dataRows) {
      const page = pdf.addPage([labelSize.widthPt, labelSize.heightPt]);
      await drawLabel(pdf, page, doc, { xMm: 0, yMm: 0 }, row, mapping, fonts);
    }
    return pdf.save();
  }

  const sheet = SHEET_MM[doc.sheet.pageSize];
  const origins = computeSlotOrigins(doc.sheet, doc.page);
  if (!origins.length) {
    const page = sheetPageSizeMm(doc.sheet.pageSize);
    throw new Error(
      `This sticker (${doc.page.widthMm} × ${doc.page.heightMm} mm) does not fit on ${doc.sheet.pageSize.replace("-", " ")} (${page.widthMm} × ${page.heightMm} mm). Choose a larger paper size, reduce the margin, or print at sticker size.`,
    );
  }
  const slotsPerPage = Math.max(1, origins.length);
  for (let i = 0; i < dataRows.length; i += slotsPerPage) {
    const page = pdf.addPage([mmToPt(sheet.widthMm), mmToPt(sheet.heightMm)]);
    const chunk = dataRows.slice(i, i + slotsPerPage);
    for (let s = 0; s < chunk.length; s += 1) {
      await drawLabel(pdf, page, doc, origins[s], chunk[s], mapping, fonts);
    }
  }
  return pdf.save();
}

export async function generatePdf(
  doc: LabelDocument,
  rows: DataRow[],
  mapping: ColumnMapping,
): Promise<Uint8Array> {
  await useAssetStore.getState().hydrate();
  const dataRows = rows.length ? rows : [null];
  if (typeof document !== "undefined") {
    return generateCanvasPdf(doc, dataRows, mapping);
  }
  return generateVectorPdf(doc, dataRows, mapping);
}

export function pdfFileName(name: string) {
  const slug = name.trim().replace(/\s+/g, "-").toLowerCase() || "label";
  return `${slug}.pdf`;
}

/** One PDF page at the template size, using sample content or a single data row. */
export async function generateLabelPdf(
  doc: LabelDocument,
  row: DataRow | null,
  mapping: ColumnMapping,
): Promise<Uint8Array> {
  return generatePdf({ ...doc, sheet: undefined }, row ? [row] : [], mapping);
}

export async function downloadLabelPdf(
  doc: LabelDocument,
  row: DataRow | null,
  mapping: ColumnMapping,
): Promise<void> {
  const bytes = await generateLabelPdf(doc, row, mapping);
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = pdfFileName(doc.name);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
