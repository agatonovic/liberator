import { looksLikeGroupedPartNumber, parseArrow } from "./format";
import { createId } from "./ids";
import { roundMm } from "./units";

export const DOCUMENT_VERSION = 1;

export type PolygonType =
  | "arrow"
  | "doubleArrow"
  | "triangle"
  | "diamond"
  | "star"
  | "hexagon"
  | "plus"
  | "cross";

export const POLYGON_TYPES: PolygonType[] = [
  "arrow",
  "doubleArrow",
  "triangle",
  "diamond",
  "star",
  "hexagon",
  "plus",
  "cross",
];

export type ElementType =
  | "rect"
  | "ellipse"
  | "line"
  | PolygonType
  | "text"
  | "barcode"
  | "qr"
  | "image";

export function isPolygonType(type: ElementType): type is PolygonType {
  return (POLYGON_TYPES as string[]).includes(type);
}

export function isPaintedShape(type: ElementType) {
  return type === "rect" || type === "ellipse" || type === "line" || isPolygonType(type);
}

export function isPaintColor(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== "transparent" && normalized !== "none";
}

export type BarcodeSymbology = "code128" | "ean13" | "code39";
export type TextAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";
export type SheetPageSize = "A4" | "A4-landscape" | "A3" | "A3-landscape" | "letter";

export const SHEET_PAGE_OPTIONS: { id: SheetPageSize; label: string }[] = [
  { id: "A4", label: "A4 portrait" },
  { id: "A4-landscape", label: "A4 landscape" },
  { id: "A3", label: "A3 portrait" },
  { id: "A3-landscape", label: "A3 landscape" },
  { id: "letter", label: "Letter" },
];
export type ShapeDirection = "right" | "down" | "left" | "up";
export type ArrowKind = "block" | "triangle" | "barbed" | "chevron" | "line" | "pentagon" | "open";
export type LineCap = "butt" | "round" | "square";
export type StrokeStyleKind = "solid" | "dashed" | "dotted";

export const ARROW_KINDS: { id: ArrowKind; label: string }[] = [
  { id: "block", label: "Block" },
  { id: "triangle", label: "Triangle" },
  { id: "barbed", label: "Barbed" },
  { id: "chevron", label: "Chevron" },
  { id: "line", label: "Line" },
  { id: "pentagon", label: "Sign" },
  { id: "open", label: "Open" },
];

export const LINE_CAPS: { id: LineCap; label: string }[] = [
  { id: "butt", label: "Flat" },
  { id: "round", label: "Round" },
  { id: "square", label: "Square" },
];

export const STROKE_STYLES: { id: StrokeStyleKind; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dash" },
  { id: "dotted", label: "Dot" },
];

export function strokeDashPattern(style: ElementStyle, toUnit: (mm: number) => number): number[] | undefined {
  const kind = style.strokeStyle ?? "solid";
  if (kind === "solid") return undefined;
  const stroke = Math.max(style.strokeWidth ?? 0.35, 0.05);
  if (kind === "dotted") {
    const gap = Math.max(style.gapMm ?? stroke * 2.2, 0.15);
    return [toUnit(0.01), toUnit(gap)];
  }
  const dash = Math.max(style.dashMm ?? stroke * 4, 0.15);
  const gap = Math.max(style.gapMm ?? stroke * 2, 0.15);
  return [toUnit(dash), toUnit(gap)];
}

export type ElementStyle = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fontFamily?: string;
  fontSizeMm?: number;
  fontWeight?: "normal" | "bold";
  align?: TextAlign;
  verticalAlign?: VerticalAlign;
  letterSpacingMm?: number;
  lineHeight?: number;
  barcodeSymbology?: BarcodeSymbology;
  barcodeDisplayValue?: boolean;
  cornerRadiusMm?: number;
  direction?: ShapeDirection;
  arrowKind?: ArrowKind;
  lineCap?: LineCap;
  strokeStyle?: StrokeStyleKind;
  dashMm?: number;
  gapMm?: number;
};

export type ElementTransform =
  | "part"
  | "part_number"
  | "ga_magacin"
  | "ga_regal_letter"
  | "ga_regal_number"
  | "ga_nivo"
  | "barcode_pct"
  | "arrow";

export type DataColumn = {
  key: string;
  label: string;
  headers: string[];
  example: string;
  required?: boolean;
  /** Allowed cell values, e.g. UP / DOWN for arrow columns. */
  values?: string[];
};

export function columnAliases(column: DataColumn): string[] {
  return [column.key, column.label, ...column.headers].map((value) => value.trim()).filter(Boolean);
}

export function findColumnByName(columns: DataColumn[], name: string): DataColumn | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return columns.find((column) => columnAliases(column).some((alias) => alias.toLowerCase() === needle));
}

export type TextSpan = { start: number; end: number; fill?: string; fontSizeMm?: number };

export type LabelElement = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  style: ElementStyle;
  content?: string;
  spans?: TextSpan[];
  binding?: string;
  /** Asset-library folder used to look up an image by the bound column value. */
  assetFolderId?: string;
  imageDataUrl?: string;
  partIndex?: number;
  transform?: ElementTransform;
  fallbackBinding?: string;
  hidden?: boolean;
  locked?: boolean;
  groupId?: string;
};

export type SheetLayout = {
  pageSize: SheetPageSize;
  columns: number;
  rows: number;
  gapMm: number;
  marginMm: number;
};

export type LabelDocument = {
  version: number;
  id: string;
  name: string;
  updatedAt: string;
  page: { widthMm: number; heightMm: number };
  sheet?: SheetLayout;
  elements: LabelElement[];
  catalogId?: string;
  catalogRevision?: number;
  folderId?: string;
  description?: string;
  dataColumns?: DataColumn[];
  favorite?: boolean;
  lastUsedAt?: string;
  lastGeneratedAt?: string;
  versions?: TemplateVersion[];
};

/** Point-in-time copy of a template layout. Nested versions are never stored. */
export type TemplateVersionSnapshot = Pick<
  LabelDocument,
  "page" | "sheet" | "elements" | "dataColumns" | "description"
>;

export type TemplateVersion = {
  id: string;
  name: string;
  createdAt: string;
  snapshot: TemplateVersionSnapshot;
};

export type PagePreset = {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
};

export const PAGE_PRESETS: PagePreset[] = [
  { id: "50x30", label: "50 × 30 mm", widthMm: 50, heightMm: 30 },
  { id: "100x50", label: "100 × 50 mm", widthMm: 100, heightMm: 50 },
  { id: "100x150", label: "100 × 150 mm", widthMm: 100, heightMm: 150 },
  { id: "4x6in", label: "4 × 6 in", widthMm: 101.6, heightMm: 152.4 },
  { id: "a6", label: "A6", widthMm: 105, heightMm: 148 },
  { id: "a4", label: "A4 portrait", widthMm: 210, heightMm: 297 },
  { id: "a3", label: "A3 landscape", widthMm: 420, heightMm: 297 },
  { id: "custom", label: "Custom", widthMm: 100, heightMm: 50 },
];

export const DEFAULT_STYLE: Required<
  Pick<
    ElementStyle,
    "fill" | "stroke" | "strokeWidth" | "opacity" | "fontFamily" | "fontSizeMm" | "fontWeight" | "align" | "verticalAlign"
  >
> = {
  fill: "#12263A",
  stroke: "#12263A",
  strokeWidth: 0.35,
  opacity: 1,
  fontFamily: "IBM Plex Sans",
  fontSizeMm: 4,
  fontWeight: "normal",
  align: "left",
  verticalAlign: "middle",
};

export function defaultSizeForType(type: ElementType): { width: number; height: number } {
  switch (type) {
    case "rect":
      return { width: 30, height: 18 };
    case "ellipse":
      return { width: 22, height: 22 };
    case "line":
      return { width: 50, height: 4 };
    case "arrow":
      return { width: 28, height: 14 };
    case "doubleArrow":
      return { width: 32, height: 12 };
    case "triangle":
      return { width: 18, height: 16 };
    case "diamond":
      return { width: 18, height: 18 };
    case "star":
      return { width: 18, height: 18 };
    case "hexagon":
      return { width: 20, height: 18 };
    case "plus":
      return { width: 16, height: 16 };
    case "cross":
      return { width: 16, height: 16 };
    case "text":
      return { width: 40, height: 8 };
    case "barcode":
      return { width: 50, height: 14 };
    case "qr":
      return { width: 20, height: 20 };
    case "image":
      return { width: 40, height: 28 };
  }
}

/** Smallest square that still scans on typical warehouse printers and phones. */
export const QR_MIN_SIDE_MM = 12;
export const BARCODE_MIN_WIDTH_MM = 18;
export const BARCODE_MIN_HEIGHT_MM = 8;

export function clampQrSideMm(side: number) {
  return Math.max(QR_MIN_SIDE_MM, roundMm(Number.isFinite(side) ? side : QR_MIN_SIDE_MM));
}

export function qrSideMm(width: number, height: number, prefer: "max" | "min" = "max") {
  const raw = prefer === "min" ? Math.min(width, height) : Math.max(width, height);
  return clampQrSideMm(raw);
}

export function constrainCodeElement(element: LabelElement, prefer: "max" | "min" = "max"): LabelElement {
  if (element.type === "qr") {
    const side = qrSideMm(element.width, element.height, prefer);
    if (element.width === side && element.height === side) return element;
    return { ...element, width: side, height: side };
  }
  if (element.type === "barcode") {
    const width = Math.max(BARCODE_MIN_WIDTH_MM, element.width);
    const height = Math.max(BARCODE_MIN_HEIGHT_MM, element.height);
    if (width === element.width && height === element.height) return element;
    return { ...element, width, height };
  }
  return element;
}

export function repairCodeElements(doc: LabelDocument): LabelDocument {
  let changed = false;
  const elements = doc.elements.map((el) => {
    const prefer = el.type === "qr" && Math.abs(el.width - el.height) > 0.5 ? "min" : "max";
    const next = constrainCodeElement(el, prefer);
    if (next !== el) changed = true;
    return next;
  });
  return changed ? { ...doc, elements } : doc;
}

export function createElement(
  type: ElementType,
  x: number,
  y: number,
  extras: Partial<LabelElement> = {},
): LabelElement {
  const size = defaultSizeForType(type);
  const style: ElementStyle =
    type === "rect" || type === "ellipse"
      ? { fill: "#ffffff", stroke: "#12263A", strokeWidth: 0.4, opacity: 1 }
      : type === "line"
        ? { fill: "transparent", stroke: "#12263A", strokeWidth: 0.5, opacity: 1, lineCap: "butt" }
        : isPolygonType(type)
          ? {
              fill: "#12263A",
              stroke: "transparent",
              strokeWidth: 0,
              opacity: 1,
              arrowKind: type === "arrow" || type === "doubleArrow" ? "block" : undefined,
            }
        : type === "text"
          ? {
              fill: "#12263A",
              stroke: "transparent",
              strokeWidth: 0,
              fontFamily: "IBM Plex Sans",
              fontSizeMm: 4,
              fontWeight: "normal",
              align: "left",
              verticalAlign: "middle",
              letterSpacingMm: 0,
              lineHeight: 1,
              opacity: 1,
            }
          : type === "barcode"
            ? {
                fill: "#000000",
                barcodeSymbology: "code128",
                barcodeDisplayValue: false,
                opacity: 1,
              }
            : { fill: "#000000", opacity: 1 };

  const content =
    type === "text"
      ? "Text"
      : type === "barcode" || type === "qr"
        ? "12345678"
        : undefined;

  const extrasWithoutType = { ...extras };
  delete extrasWithoutType.type;
  const extraStyle = extrasWithoutType.style;
  delete extrasWithoutType.style;

  const element = {
    id: createId(),
    type,
    x,
    y,
    width: size.width,
    height: size.height,
    rotation: 0,
    style: { ...style, ...extraStyle },
    content,
    ...extrasWithoutType,
  } as LabelElement;
  return constrainCodeElement(element);
}

export const LINE_HIT_MM = 4;

export function isHorizontalLine(width: number, height: number) {
  return width >= height;
}

export function lineLocalPoints(width: number, height: number): number[] {
  if (isHorizontalLine(width, height)) {
    return [0, height / 2, width, height / 2];
  }
  return [width / 2, 0, width / 2, height];
}

export function orientLine(
  element: Pick<LabelElement, "x" | "y" | "width" | "height">,
  orientation: "horizontal" | "vertical",
): Pick<LabelElement, "x" | "y" | "width" | "height" | "rotation"> {
  const length = Math.max(element.width, element.height, 8);
  const thickness = LINE_HIT_MM;
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  if (orientation === "horizontal") {
    return {
      x: cx - length / 2,
      y: cy - thickness / 2,
      width: length,
      height: thickness,
      rotation: 0,
    };
  }
  return {
    x: cx - thickness / 2,
    y: cy - length / 2,
    width: thickness,
    height: length,
    rotation: 0,
  };
}

export function elementCenter(
  element: Pick<LabelElement, "x" | "y" | "width" | "height" | "rotation">,
) {
  const rad = ((element.rotation ?? 0) * Math.PI) / 180;
  const cx = element.width / 2;
  const cy = element.height / 2;
  return {
    x: element.x + cx * Math.cos(rad) - cy * Math.sin(rad),
    y: element.y + cx * Math.sin(rad) + cy * Math.cos(rad),
  };
}

/** New top-left so the visual center stays put when `rotation` changes. */
export function rotateAroundCenter(
  element: Pick<LabelElement, "x" | "y" | "width" | "height" | "rotation">,
  nextRotation: number,
): Pick<LabelElement, "x" | "y" | "rotation"> {
  const center = elementCenter(element);
  const rad = (nextRotation * Math.PI) / 180;
  const cx = element.width / 2;
  const cy = element.height / 2;
  return {
    rotation: nextRotation,
    x: roundMm(center.x - (cx * Math.cos(rad) - cy * Math.sin(rad)), 0.01),
    y: roundMm(center.y - (cx * Math.sin(rad) + cy * Math.cos(rad)), 0.01),
  };
}

export function isSwappableArrowImage(element: Pick<LabelElement, "imageDataUrl">) {
  return Boolean(element.imageDataUrl && /\/arrows\/(?:UP|DOWN)/.test(element.imageDataUrl));
}

export function isDirectionBound(
  element: Pick<LabelElement, "type" | "binding" | "transform" | "imageDataUrl">,
) {
  if (!element.binding?.trim()) return false;
  if (element.type === "arrow" || element.type === "doubleArrow") return true;
  if (element.transform === "arrow") return true;
  return element.type === "image" && isSwappableArrowImage(element);
}

function explicitArrowDirection(value: string): "UP" | "DOWN" | null {
  const text = value.trim().toUpperCase();
  if (!text) return null;
  if (["UP", "↑", "▲", "U", "GORE"].includes(text)) return "UP";
  if (["DOWN", "↓", "▼", "D", "DOLJE"].includes(text)) return "DOWN";
  return null;
}

/** Default arrow polygon points right; Konva rotation is clockwise. */
function directionFromRotation(rotation: number): "UP" | "DOWN" {
  const angle = ((rotation % 360) + 360) % 360;
  if (angle >= 45 && angle < 135) return "DOWN";
  if (angle >= 225 && angle < 315) return "UP";
  return angle >= 135 && angle < 225 ? "DOWN" : "UP";
}

export function designedArrowDirection(
  element: Pick<LabelElement, "content" | "imageDataUrl" | "rotation">,
): "UP" | "DOWN" {
  const fromContent = explicitArrowDirection(element.content ?? "");
  if (fromContent) return fromContent;
  const match = element.imageDataUrl?.match(/\/arrows\/(UP|DOWN)/);
  if (match?.[1] === "DOWN" || match?.[1] === "UP") return match[1];
  return directionFromRotation(element.rotation ?? 0);
}

/** Render-time pose. Does not write data-driven rotation back to the template. */
export function displayPose(
  element: LabelElement,
  liveValue: string,
): Pick<LabelElement, "x" | "y" | "rotation"> {
  if (!isDirectionBound(element) || isSwappableArrowImage(element)) {
    return { x: element.x, y: element.y, rotation: element.rotation };
  }
  const live = parseArrow(liveValue);
  if (!live || live === designedArrowDirection(element)) {
    return { x: element.x, y: element.y, rotation: element.rotation };
  }
  return rotateAroundCenter(element, element.rotation + 180);
}

export function arrowBindingPatch(
  binding: string | undefined,
  element: LabelElement,
): Partial<LabelElement> {
  const key = binding?.trim();
  if (!key) {
    return {
      binding: undefined,
      transform: element.transform === "arrow" ? undefined : element.transform,
    };
  }
  return {
    binding: key,
    transform: "arrow",
    content: element.content?.trim() ? element.content : designedArrowDirection(element),
  };
}

export function createDocument(
  name = "Untitled label",
  page: { widthMm: number; heightMm: number } = { widthMm: 100, heightMm: 50 },
): LabelDocument {
  return {
    version: DOCUMENT_VERSION,
    id: createId(),
    name,
    updatedAt: new Date().toISOString(),
    page,
    elements: [],
  };
}

export function createSampleShipping(): LabelDocument {
  const doc = createDocument("Sample shipping", { widthMm: 100, heightMm: 50 });
  const border = createElement("rect", 0, 0, {
    width: 100,
    height: 50,
    style: { fill: "#ffffff", stroke: "#12263A", strokeWidth: 0.45, opacity: 1 },
  });
  const heading = createElement("text", 4, 3, {
    width: 68,
    height: 6,
    content: "SHIP TO",
    style: {
      fill: "#0F8A80",
      fontSizeMm: 3,
      fontWeight: "bold",
      align: "left",
      verticalAlign: "middle",
      opacity: 1,
    },
  });
  const name = createElement("text", 4, 10, {
    width: 68,
    height: 9,
    content: "Acme Co.",
    binding: "name",
    style: {
      fill: "#12263A",
      fontSizeMm: 5.2,
      fontWeight: "bold",
      align: "left",
      verticalAlign: "middle",
      opacity: 1,
    },
  });
  const sku = createElement("text", 4, 20, {
    width: 68,
    height: 7,
    content: "SKU-0000",
    binding: "sku",
    style: {
      fill: "#5C6B7A",
      fontSizeMm: 3.4,
      fontWeight: "normal",
      align: "left",
      verticalAlign: "middle",
      opacity: 1,
    },
  });
  const barcode = createElement("barcode", 4, 30, {
    width: 62,
    height: 16,
    content: "SKU-0000",
    binding: "sku",
    style: {
      fill: "#000000",
      barcodeSymbology: "code128",
      barcodeDisplayValue: false,
      opacity: 1,
    },
  });
  const qr = createElement("qr", 76, 8, {
    width: 20,
    height: 20,
    content: "SKU-0000",
    binding: "sku",
  });
  doc.elements = [border, heading, name, sku, barcode, qr];
  doc.catalogId = "sample_shipping";
  doc.description = "Small shipping label with name, SKU, barcode, and QR.";
  doc.dataColumns = [
    {
      key: "name",
      label: "Name",
      headers: ["name", "Name", "SHIP TO"],
      example: "Acme Co.",
      required: true,
    },
    {
      key: "sku",
      label: "SKU",
      headers: ["sku", "SKU", "Barcode"],
      example: "SKU-0000",
      required: true,
    },
  ];
  return doc;
}

export function cloneDocument(doc: LabelDocument): LabelDocument {
  return structuredClone(doc);
}

export function cloneElement(element: LabelElement): LabelElement {
  const copy = structuredClone(element);
  copy.id = createId();
  return constrainCodeElement(copy);
}

export function expandGroupSelection(elements: LabelElement[], ids: string[]): string[] {
  const seed = new Set(ids);
  const groups = new Set(
    elements.filter((el) => seed.has(el.id) && el.groupId).map((el) => el.groupId as string),
  );
  if (!groups.size) return ids;
  return elements.filter((el) => seed.has(el.id) || (el.groupId && groups.has(el.groupId))).map((el) => el.id);
}

export function remapPastedGroups(elements: LabelElement[]): LabelElement[] {
  const map = new Map<string, string>();
  const remapped = elements.map((el) => {
    if (!el.groupId) return el;
    let next = map.get(el.groupId);
    if (!next) {
      next = createId();
      map.set(el.groupId, next);
    }
    return { ...el, groupId: next };
  });
  const counts = new Map<string, number>();
  for (const el of remapped) {
    if (!el.groupId) continue;
    counts.set(el.groupId, (counts.get(el.groupId) ?? 0) + 1);
  }
  return remapped.map((el) =>
    el.groupId && (counts.get(el.groupId) ?? 0) < 2 ? { ...el, groupId: undefined } : el,
  );
}

export function packGroupedElements(
  elements: LabelElement[],
  memberIds: Set<string>,
  groupId: string,
): LabelElement[] {
  const members = elements.filter((el) => memberIds.has(el.id)).map((el) => ({ ...el, groupId }));
  if (!members.length) return elements;
  const result: LabelElement[] = [];
  let seen = 0;
  for (const el of elements) {
    if (!memberIds.has(el.id)) {
      result.push(el);
      continue;
    }
    seen += 1;
    if (seen === members.length) result.push(...members);
  }
  return result;
}

export function selectionGroupFlags(elements: LabelElement[], selectedIds: string[]) {
  const selected = elements.filter((el) => selectedIds.includes(el.id));
  const canUngroup = selected.some((el) => Boolean(el.groupId));
  if (selected.length < 2) return { canGroup: false, canUngroup };
  const groupIds = [...new Set(selected.map((el) => el.groupId).filter(Boolean) as string[])];
  if (groupIds.length === 1) {
    const gid = groupIds[0];
    const whole = selected.every((el) => el.groupId === gid);
    const size = elements.filter((el) => el.groupId === gid).length;
    if (whole && size === selected.length) return { canGroup: false, canUngroup: true };
  }
  return { canGroup: true, canUngroup };
}

export function documentBindings(doc: LabelDocument): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const aliases = new Set<string>();
  const rememberAlias = (value?: string) => {
    const trimmed = value?.trim().toLowerCase();
    if (trimmed) aliases.add(trimmed);
  };
  const add = (key?: string) => {
    const trimmed = key?.trim();
    if (!trimmed || seen.has(trimmed) || aliases.has(trimmed.toLowerCase())) return;
    seen.add(trimmed);
    keys.push(trimmed);
  };
  for (const column of doc.dataColumns ?? []) {
    add(column.key);
    for (const alias of columnAliases(column)) rememberAlias(alias);
  }
  for (const el of doc.elements) add(el.binding);
  return keys;
}

const GA_TRANSFORMS = new Set<ElementTransform>([
  "ga_magacin",
  "ga_regal_letter",
  "ga_regal_number",
  "ga_nivo",
]);
const GA_ROW_Y_MM = 28;

export function isGaAddressTransform(value: unknown): value is ElementTransform {
  return typeof value === "string" && GA_TRANSFORMS.has(value as ElementTransform);
}

function classifyGaContent(content: string): "letter" | "digits" | "magacin" {
  const text = content.trim();
  if (/^[A-Za-z]$/.test(text)) return "letter";
  if (/^\d{1,4}$/.test(text)) return "digits";
  return "magacin";
}

function inferredGaTransform(elements: LabelElement[]): Map<string, ElementTransform> {
  const sorted = [...elements].sort((a, b) => a.x - b.x || a.y - b.y);
  const kinds = sorted.map((el) => classifyGaContent(el.content ?? ""));
  const digitIndexes = kinds.flatMap((kind, index) => (kind === "digits" ? [index] : []));
  const lastDigit = digitIndexes[digitIndexes.length - 1];
  const next = new Map<string, ElementTransform>();
  sorted.forEach((el, index) => {
    if (kinds[index] === "letter") next.set(el.id, "ga_regal_letter");
    else if (kinds[index] === "magacin") next.set(el.id, "ga_magacin");
    else next.set(el.id, index === lastDigit ? "ga_nivo" : "ga_regal_number");
  });
  return next;
}

function clusterGaRows(elements: LabelElement[]): LabelElement[][] {
  const sorted = [...elements].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: LabelElement[][] = [];
  for (const el of sorted) {
    const row = rows[rows.length - 1];
    if (!row) {
      rows.push([el]);
      continue;
    }
    const rowY = row.reduce((sum, item) => sum + item.y, 0) / row.length;
    if (Math.abs(el.y - rowY) <= GA_ROW_Y_MM) row.push(el);
    else rows.push([el]);
  }
  return rows;
}

function splitAddressColumns(columns: DataColumn[]): DataColumn[] {
  return columns
    .filter((column) => /^address_(top|bot|bottom)$/i.test(column.key))
    .sort((a, b) => {
      const rank = (key: string) => (/top/i.test(key) ? 0 : 1);
      return rank(a.key) - rank(b.key);
    });
}

/**
 * Duplicating MAGACIN copies `ga_magacin` onto letter / number / nivo fields.
 * Live preview and Print then show the warehouse code in every column.
 */
export function repairGaAddressFields(doc: LabelDocument): LabelDocument {
  const fields = doc.elements.filter(
    (el) => el.type === "text" && !el.hidden && isGaAddressTransform(el.transform),
  );
  if (fields.length < 2) return doc;
  const rows = clusterGaRows(fields).filter((row) => row.length >= 2);
  if (!rows.length) return doc;
  const split = splitAddressColumns(doc.dataColumns ?? []);
  const transformById = new Map<string, ElementTransform>();
  const bindingById = new Map<string, string>();
  for (const [rowIndex, row] of rows.entries()) {
    for (const [id, transform] of inferredGaTransform(row)) transformById.set(id, transform);
    const column = split.length === rows.length ? split[rowIndex] : undefined;
    if (column) {
      for (const el of row) {
        if (el.binding?.trim().toLowerCase() === "address") bindingById.set(el.id, column.key);
      }
    }
  }
  let changed = false;
  const elements = doc.elements.map((el) => {
    const transform = transformById.get(el.id);
    const binding = bindingById.get(el.id);
    if ((!transform || transform === el.transform) && !binding) return el;
    changed = true;
    return {
      ...el,
      ...(transform && transform !== el.transform ? { transform } : {}),
      ...(binding ? { binding } : {}),
    };
  });
  return changed ? { ...doc, elements } : doc;
}

function isArrowDataColumn(column: DataColumn) {
  return /arrow/i.test(columnAliases(column).join(" "));
}

function compareArrowColumns(a: DataColumn, b: DataColumn) {
  const rank = (column: DataColumn) => {
    const text = columnAliases(column).join(" ").toLowerCase();
    if (/\btop\b/.test(text)) return 0;
    if (/\bbot(tom)?\b/.test(text)) return 1;
    return 2;
  };
  return rank(a) - rank(b) || a.key.localeCompare(b.key);
}

/** Designed GA dual arrows are UP over DOWN in the art — not Generate columns. */
function isGaWarehouseDual(doc: LabelDocument) {
  if (doc.catalogId === "ga_warehouse_a3_dual") return true;
  const name = doc.name.trim();
  return /^GA Warehouse Dual$/i.test(name) || /^GA warehouse A3 dual$/i.test(name);
}

function isFixedDualArrow(element: LabelElement) {
  if (element.hidden) return false;
  const key = element.binding?.trim() ?? "";
  if (/^arrow_(top|bot)$/i.test(key)) return true;
  return (
    element.type === "arrow" ||
    element.type === "doubleArrow" ||
    element.transform === "arrow" ||
    isSwappableArrowImage(element)
  );
}

export function repairFixedGaDualArrows(doc: LabelDocument): LabelDocument {
  if (!isGaWarehouseDual(doc)) return doc;
  const columns = doc.dataColumns ?? [];
  const dataColumns = columns.filter((column) => !isArrowDataColumn(column));
  const columnsChanged = dataColumns.length !== columns.length;
  let elementsChanged = false;
  const elements = doc.elements.map((el) => {
    if (!isFixedDualArrow(el)) return el;
    if (!el.binding?.trim() && el.transform !== "arrow") return el;
    elementsChanged = true;
    return {
      ...el,
      binding: undefined,
      transform: el.transform === "arrow" ? undefined : el.transform,
    };
  });
  if (!columnsChanged && !elementsChanged) return doc;
  return {
    ...doc,
    dataColumns: columnsChanged ? dataColumns : doc.dataColumns,
    elements: elementsChanged ? elements : doc.elements,
  };
}

/** Bind vector arrows to UP/DOWN columns and restore allowed values. */
export function repairDirectionArrows(doc: LabelDocument): LabelDocument {
  if (isGaWarehouseDual(doc)) return doc;
  const columns = [...(doc.dataColumns ?? [])];
  let columnsChanged = false;
  const dataColumns = columns.map((column) => {
    if (!isArrowDataColumn(column) || column.values?.length) return column;
    columnsChanged = true;
    return { ...column, values: ["UP", "DOWN"] };
  });
  const arrowColumns = dataColumns.filter(isArrowDataColumn);
  const unbound = doc.elements.filter(
    (el) =>
      !el.hidden &&
      !el.binding?.trim() &&
      (el.type === "arrow" || el.type === "doubleArrow" || isSwappableArrowImage(el)),
  );
  if (!arrowColumns.length || !unbound.length) {
    return columnsChanged ? { ...doc, dataColumns } : doc;
  }
  const cols = [...arrowColumns].sort(compareArrowColumns);
  const els = [...unbound].sort((a, b) => a.y - b.y || a.x - b.x);
  const assign = new Map<string, string>();
  for (let i = 0; i < Math.min(cols.length, els.length); i += 1) {
    assign.set(els[i].id, cols[i].key);
  }
  const elements = doc.elements.map((el) => {
    const key = assign.get(el.id);
    if (!key) return el;
    return { ...el, ...arrowBindingPatch(key, el) };
  });
  return {
    ...doc,
    dataColumns: columnsChanged ? dataColumns : doc.dataColumns,
    elements,
  };
}

const HBC_LEVEL_KEYS = ["lvl5", "lvl4", "lvl3", "lvl2", "lvl1"] as const;

/**
 * The designed FIXED GA label is one Open Sans field, not the catalog's four
 * part-number boxes. Bind grouped part-number art to `reference` / `ref1`…
 * without bumping catalog revision (that would wipe the designed layout).
 */
function isPartNumberColumn(column: DataColumn) {
  const key = column.key.trim();
  if (/^lvl[1-5]$/i.test(key)) return true;
  if (/^(ref|pn)\d*$/i.test(key)) return true;
  if (/^reference$/i.test(key)) return true;
  const blob = [column.key, column.label, ...(column.headers ?? [])].join(" ").toLowerCase();
  return /part number|broj crte|produit/.test(blob);
}

function partNumberColumnRank(column: DataColumn) {
  if (/^reference$/i.test(column.key)) return 0;
  const numbered = /^(?:ref|pn)(\d+)$/i.exec(column.key);
  if (numbered) return Number(numbered[1]);
  return 100;
}

function partNumberColumnKeys(doc: LabelDocument): string[] {
  const columns = doc.dataColumns ?? [];
  const keys: string[] = [];
  const add = (key?: string) => {
    const trimmed = key?.trim();
    if (trimmed && !keys.includes(trimmed)) keys.push(trimmed);
  };
  for (const key of HBC_LEVEL_KEYS) add(findColumnByName(columns, key)?.key);
  const ranked = columns
    .filter((column) => isPartNumberColumn(column) && !HBC_LEVEL_KEYS.includes(column.key as (typeof HBC_LEVEL_KEYS)[number]))
    .sort((a, b) => partNumberColumnRank(a) - partNumberColumnRank(b));
  for (const column of ranked) add(column.key);
  if (!keys.length && doc.catalogId?.startsWith("fixed_ga")) add("reference");
  return keys;
}

export function repairPartNumberFields(doc: LabelDocument): LabelDocument {
  const pnKeys = partNumberColumnKeys(doc);
  if (!pnKeys.length) return doc;
  const boundKeys = new Set(
    doc.elements
      .map((el) => el.binding?.trim())
      .filter((key): key is string => Boolean(key) && pnKeys.includes(key)),
  );
  const unusedKeys = pnKeys.filter((key) => !boundKeys.has(key));
  const unbound = doc.elements
    .filter(
      (el) =>
        el.type === "text" &&
        !el.hidden &&
        !el.binding?.trim() &&
        looksLikeGroupedPartNumber(el.content ?? ""),
    )
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const assign = new Map<string, string>();
  for (let i = 0; i < Math.min(unbound.length, unusedKeys.length); i += 1) {
    assign.set(unbound[i]!.id, unusedKeys[i]!);
  }

  let changed = false;
  const elements = doc.elements.map((el) => {
    const key = assign.get(el.id);
    if (key) {
      changed = true;
      return { ...el, binding: key, transform: "part_number" as const };
    }
    if (el.type !== "text" || el.hidden) return el;
    if (el.transform === "part" || el.partIndex != null) return el;
    const bound = el.binding?.trim();
    if (
      bound &&
      pnKeys.includes(bound) &&
      looksLikeGroupedPartNumber(el.content ?? "") &&
      el.transform !== "part_number"
    ) {
      changed = true;
      return { ...el, transform: "part_number" as const };
    }
    return el;
  });
  return changed ? { ...doc, elements } : doc;
}

/**
 * Designed HBC shelf labels keep one grouped drawing-number field per level
 * instead of the catalog's four part boxes. Bind those fields to lvl5→lvl1 by
 * top-to-bottom order so Generate can fill Broj Crteža without a catalog bump.
 */
export function repairHbcDrawingNumbers(doc: LabelDocument): LabelDocument {
  const columns = doc.dataColumns ?? [];
  const levelKeys = HBC_LEVEL_KEYS.filter((key) => findColumnByName(columns, key));
  if (!levelKeys.length) return doc;

  const boundKeys = new Set(
    doc.elements
      .map((el) => el.binding?.trim())
      .filter((key): key is string => Boolean(key) && levelKeys.includes(key as (typeof HBC_LEVEL_KEYS)[number])),
  );
  const unusedKeys = levelKeys.filter((key) => !boundKeys.has(key));
  const unbound = doc.elements
    .filter(
      (el) =>
        el.type === "text" &&
        !el.hidden &&
        !el.binding?.trim() &&
        looksLikeGroupedPartNumber(el.content ?? ""),
    )
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const assign = new Map<string, string>();
  for (let i = 0; i < Math.min(unbound.length, unusedKeys.length); i += 1) {
    assign.set(unbound[i]!.id, unusedKeys[i]!);
  }

  let changed = false;
  const elements = doc.elements.map((el) => {
    const key = assign.get(el.id);
    if (key) {
      changed = true;
      return { ...el, binding: key, transform: "part_number" as const };
    }
    if (
      el.type === "text" &&
      el.binding &&
      levelKeys.includes(el.binding as (typeof HBC_LEVEL_KEYS)[number]) &&
      looksLikeGroupedPartNumber(el.content ?? "") &&
      el.partIndex == null &&
      el.transform !== "part_number"
    ) {
      changed = true;
      return { ...el, transform: "part_number" as const };
    }
    return el;
  });
  return changed ? { ...doc, elements } : doc;
}

function qtyColumnKeys(columns: DataColumn[]) {
  return columns
    .filter((column) => /^qty\d*$/i.test(column.key.trim()))
    .sort((a, b) => {
      const na = Number(/(\d+)$/.exec(a.key)?.[1] ?? 1);
      const nb = Number(/(\d+)$/.exec(b.key)?.[1] ?? 1);
      return na - nb;
    })
    .map((column) => column.key);
}

/** Designed Canopy qty boxes were all bound to qty1; split them top-to-bottom. */
export function repairQtyFields(doc: LabelDocument): LabelDocument {
  const qtyKeys = qtyColumnKeys(doc.dataColumns ?? []);
  if (qtyKeys.length < 2) return doc;
  const els = doc.elements
    .filter((el) => el.type === "text" && !el.hidden && qtyKeys.includes(el.binding?.trim() ?? ""))
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (els.length < 2) return doc;
  const unique = new Set(els.map((el) => el.binding?.trim()));
  if (unique.size === els.length) return doc;
  let changed = false;
  const elements = doc.elements.map((el) => {
    const index = els.findIndex((item) => item.id === el.id);
    if (index < 0 || index >= qtyKeys.length) return el;
    const key = qtyKeys[index]!;
    if (el.binding === key) return el;
    changed = true;
    return { ...el, binding: key };
  });
  return changed ? { ...doc, elements } : doc;
}

function col(
  key: string,
  label: string,
  headers: string[],
  example: string,
  required = true,
): DataColumn {
  return { key, label, headers, example, required };
}

/** Designed 1 PN / 2 PN copies inherited the 3 PN Excel schema. */
const CANOPY_NAME_SCHEMAS: Record<string, { description: string; columns: DataColumn[] }> = {
  "Canopy A3 — 1 PN": {
    description: "Canopy A3 for positions with one part number.",
    columns: [
      col("position", "Position", ["MAP SIMPLE", "Position", "position"], "WG1D.02.001"),
      col("ref1", "Part number 1", ["PN", "Produit", "REFERENCE", "ref1"], "9845605680"),
      col("barcode", "Barcode", ["BARCODE", "Map", "MAP"], "WG1D.02.001%", false),
    ],
  },
  "Canopy A3 — 2 PN": {
    description: "Canopy A3 for positions with two part numbers.",
    columns: [
      col("position", "Position", ["MAP SIMPLE", "Position", "position"], "WG1D.13.006"),
      col("ref1", "Part number 1", ["ref1", "PN", "Produit"], "9846755980"),
      col("qty1", "Qty 1", ["qty1", "QTY1"], "2"),
      col("ref2", "Part number 2", ["ref2"], "7357993320"),
      col("qty2", "Qty 2", ["qty2", "QTY2"], "3"),
      col("barcode", "Barcode", ["BARCODE", "Map", "MAP"], "WG1D.13.006%", false),
    ],
  },
  "Canopy A3 — 3 PN": {
    description: "Canopy A3 for positions with three part numbers.",
    columns: [
      col("position", "Position", ["MAP SIMPLE", "Position", "position"], "WG1D.11.014"),
      col("ref1", "Part number 1", ["ref1"], "9855936580"),
      col("qty1", "Qty 1", ["qty1"], "3"),
      col("ref2", "Part number 2", ["ref2"], "9855936180"),
      col("qty2", "Qty 2", ["qty2"], "1"),
      col("ref3", "Part number 3", ["ref3"], "9860692580"),
      col("qty3", "Qty 3", ["qty3"], "1"),
      col("barcode", "Barcode", ["BARCODE", "Map", "MAP"], "WG1D.11.014%", false),
    ],
  },
};

function canopySchemaName(name: string) {
  return name.trim().replace(/\u2013/g, "\u2014");
}

function sameColumnKeys(a: DataColumn[] | undefined, b: DataColumn[]) {
  return Boolean(a?.length === b.length && a?.every((column, index) => column.key === b[index]?.key));
}

/**
 * Match Generate columns to the Canopy art (1 PN has no qty / extra refs).
 * Do not set catalogId: the designed copies replaced deleted catalog seeds.
 */
export function repairCanopySchema(doc: LabelDocument): LabelDocument {
  const spec = CANOPY_NAME_SCHEMAS[canopySchemaName(doc.name)];
  if (!spec) return doc;
  const sameCols = sameColumnKeys(doc.dataColumns, spec.columns);
  const sameDesc = doc.description === spec.description;
  if (sameCols && sameDesc) return doc;
  return {
    ...doc,
    dataColumns: sameCols ? doc.dataColumns : spec.columns,
    description: spec.description,
  };
}

function isRefOrQtyKey(key: string) {
  return /^(?:ref|pn|qty)\d*$/i.test(key.trim());
}

/** Drop leftover refN / qtyN columns that nothing on the label reads. */
export function repairUnusedRefQtyColumns(doc: LabelDocument): LabelDocument {
  const columns = doc.dataColumns ?? [];
  if (!columns.some((column) => isRefOrQtyKey(column.key))) return doc;
  const used = new Set<string>();
  for (const el of doc.elements) {
    const binding = el.binding?.trim();
    const fallback = el.fallbackBinding?.trim();
    if (binding) used.add(binding);
    if (fallback) used.add(fallback);
  }
  const next = columns.filter((column) => !isRefOrQtyKey(column.key) || used.has(column.key));
  if (next.length === columns.length || !next.length) return doc;
  return { ...doc, dataColumns: next };
}

export function repairTemplateDocument(doc: LabelDocument): LabelDocument {
  return repairUnusedRefQtyColumns(
    repairCodeElements(
      repairQtyFields(
        repairHbcDrawingNumbers(
          repairPartNumberFields(
            repairGaAddressFields(
              bindFolderImages(repairFixedGaDualArrows(repairDirectionArrows(repairCanopySchema(doc)))),
            ),
          ),
        ),
      ),
    ),
  );
}

/** If a photo has a lookup folder but no column, reuse the packaging binding already on the template. */
export function bindFolderImages(doc: LabelDocument): LabelDocument {
  const columns = doc.dataColumns ?? [];
  const packaging =
    columns.find((column) => /packag|pakov/i.test(columnAliases(column).join(" "))) ??
    doc.elements.find((el) => /packag|pakov/i.test(el.binding ?? ""));
  const fallback = packaging && "key" in packaging ? packaging.key : packaging?.binding;
  if (!fallback) return doc;
  let changed = false;
  const elements = doc.elements.map((el) => {
    if (el.type !== "image" || !el.assetFolderId || el.binding?.trim()) return el;
    changed = true;
    return { ...el, binding: fallback };
  });
  return changed ? { ...doc, elements } : doc;
}

export function isLabelDocument(value: unknown): value is LabelDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as LabelDocument;
  return (
    typeof doc.id === "string" &&
    typeof doc.name === "string" &&
    Array.isArray(doc.elements) &&
    typeof doc.page?.widthMm === "number" &&
    typeof doc.page?.heightMm === "number"
  );
}

export function normalizeImportedDocument(raw: unknown): LabelDocument {
  if (!isLabelDocument(raw)) {
    throw new Error("This file is not a Labelator template.");
  }
  return repairCodeElements({
    ...raw,
    version: DOCUMENT_VERSION,
    id: createId(),
    updatedAt: new Date().toISOString(),
    elements: raw.elements.map((el) => ({
      ...el,
      id: el.id || createId(),
      rotation: el.rotation ?? 0,
      style: el.style ?? {},
    })),
  });
}
