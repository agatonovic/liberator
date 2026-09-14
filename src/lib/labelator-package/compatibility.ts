import type { LabelDocument, LabelElement } from "../document";
import { resolveFontFamily } from "../fonts";
import { collectFontWeights, collectRequiredTransforms } from "./collect";
import { PYTHON_RENDERER_PROFILE, type RendererCapabilityProfile } from "./renderer-profile";

export type CompatibilityItem = {
  id: string;
  label: string;
  supported: boolean;
};

export type RendererCompatibility = {
  status: "compatible" | "incompatible";
  compatible: boolean;
  rendererId: string;
  rendererVersion: string;
  items: CompatibilityItem[];
  requirements: string[];
  unsupported: string[];
};

export type AnalyzeCompatibilityOptions = {
  /**
   * Job setting written to `manifest.print`. Omitted or `label` is 1-up.
   * Does not invent a template-specific rule.
   */
  printMode?: "label" | "sheet";
};

const ELEMENT_LABELS: Record<string, string> = {
  text: "Text",
  rect: "Rectangle",
  line: "Line",
  image: "Image",
  barcode: "Barcode",
  arrow: "Arrow",
  doubleArrow: "Double arrow",
  qr: "QR",
  ellipse: "Ellipse",
  triangle: "Triangle",
  diamond: "Diamond",
  star: "Star",
  hexagon: "Hexagon",
  plus: "Plus",
  cross: "Cross",
};

function drawn(element: LabelElement): boolean {
  return element.hidden !== true;
}

function barcodeLabel(symbology: string): string {
  if (symbology === "code128") return "Code128";
  if (symbology === "code39") return "Code39";
  if (symbology === "ean13") return "EAN-13";
  return symbology;
}

function fontLabel(family: string, weight: 400 | 700): string {
  return `${family} ${weight}`;
}

/**
 * Compare a document's actual requirements to a renderer profile.
 * No template id, catalog id, template name, or customer-specific branch.
 */
export function analyzeRendererCompatibility(
  document: LabelDocument,
  rendererProfile: RendererCapabilityProfile = PYTHON_RENDERER_PROFILE,
  options: AnalyzeCompatibilityOptions = {},
): RendererCompatibility {
  const items: CompatibilityItem[] = [];
  const seen = new Set<string>();

  const add = (id: string, label: string, supported: boolean) => {
    if (seen.has(id)) return;
    seen.add(id);
    items.push({ id, label, supported });
  };

  const visible = document.elements.filter(drawn);
  const printMode = options.printMode === "sheet" ? "sheet" : "label";

  for (const element of visible) {
    const type = element.type;
    add(
      `element:${type}`,
      ELEMENT_LABELS[type] ?? type,
      rendererProfile.elements.includes(type),
    );

    if (type === "barcode") {
      const symbology = (element.style.barcodeSymbology ?? "code128").toLowerCase();
      add(
        `barcode:${symbology}`,
        barcodeLabel(symbology),
        rendererProfile.barcodes.includes(symbology),
      );
    }

    if (type === "arrow" || type === "doubleArrow") {
      const kind = element.style.arrowKind ?? "block";
      const allowed = type === "arrow" ? rendererProfile.arrowKinds : rendererProfile.doubleArrowKinds;
      add(`arrowKind:${type}:${kind}`, `${ELEMENT_LABELS[type] ?? type} (${kind})`, allowed.includes(kind));
    }

    if (type === "rect" || type === "image") {
      const radius = element.style.cornerRadiusMm ?? 0;
      if (radius > 0) add("style:cornerRadius", "Corner radius", false);
    }

    const stroke = element.style.strokeStyle ?? "solid";
    if (stroke !== "solid") {
      add(
        `stroke:${stroke}`,
        stroke === "dashed" ? "Dashed stroke" : stroke === "dotted" ? "Dotted stroke" : stroke,
        rendererProfile.strokes.includes(stroke),
      );
    }

    if (type === "image") {
      const fit = element.imageFit ?? "stretch";
      if (fit !== "stretch") add(`imageFit:${fit}`, `Image fit (${fit})`, rendererProfile.imageFits.includes(fit));
    }

    if (element.partIndex != null) add("field:partIndex", "partIndex", false);
  }

  for (const family of [...new Set(document.elements.filter((element) => element.type === "text").map((element) => resolveFontFamily(element.style.fontFamily)))].sort()) {
    const allowed = rendererProfile.fonts.find((font) => font.family === family);
    for (const weight of collectFontWeights(document, family)) {
      add(
        `font:${family}:${weight}`,
        fontLabel(family, weight),
        Boolean(allowed?.weights.includes(weight)),
      );
    }
  }

  for (const transform of collectRequiredTransforms(document)) {
    add(`transform:${transform}`, transform, rendererProfile.transforms.includes(transform));
  }

  add(
    `print:${printMode}`,
    printMode === "sheet" ? "Sheet packing" : "1-up",
    rendererProfile.printModes.includes(printMode),
  );

  const unsupported = items.filter((item) => !item.supported).map((item) => item.label);
  return {
    status: unsupported.length ? "incompatible" : "compatible",
    compatible: unsupported.length === 0,
    rendererId: rendererProfile.id,
    rendererVersion: rendererProfile.version,
    items,
    requirements: items.map((item) => item.label),
    unsupported,
  };
}

/** Analyze a clone of the document the portable exporter packages. Does not write the source. */
export function analyzePortableExport(
  document: LabelDocument,
  options: AnalyzeCompatibilityOptions = {},
  rendererProfile: RendererCapabilityProfile = PYTHON_RENDERER_PROFILE,
): RendererCompatibility {
  return analyzeRendererCompatibility(structuredClone(document), rendererProfile, options);
}

export function defaultPortablePrintMode(document: LabelDocument): "label" | "sheet" {
  const sheet = document.sheet;
  if (!sheet) return "label";
  const slots = Math.max(1, sheet.columns) * Math.max(1, sheet.rows);
  return slots > 1 ? "sheet" : "label";
}
