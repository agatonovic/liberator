/**
 * Capability profile for the current Python renderer (`labelator_renderer` 0.1.0).
 *
 * This is metadata about what that renderer already draws. It is not new
 * renderer functionality, and it is not stored in a `.labelator` v1 package.
 * Phase H coverage is the source of truth. Do not list a capability the
 * drawing engine does not implement.
 */
export type RendererFontCapability = {
  family: string;
  weights: Array<400 | 700>;
};

export type RendererCapabilityProfile = {
  id: string;
  version: string;
  elements: readonly string[];
  arrowKinds: readonly string[];
  doubleArrowKinds: readonly string[];
  barcodes: readonly string[];
  transforms: readonly string[];
  fonts: readonly RendererFontCapability[];
  /** `label` is 1-up (manifest `print` omitted or `mode: "label"`). */
  printModes: readonly ("label" | "sheet")[];
  imageFits: readonly string[];
  strokes: readonly string[];
};

export const PYTHON_RENDERER_PROFILE: RendererCapabilityProfile = {
  id: "labelator_renderer",
  version: "0.1.0",
  elements: ["text", "rect", "line", "image", "barcode", "arrow", "doubleArrow"],
  arrowKinds: ["block", "triangle", "pentagon", "barbed", "chevron", "line", "open"],
  doubleArrowKinds: ["block", "triangle", "line"],
  barcodes: ["code39", "code128"],
  transforms: [
    "ga_magacin",
    "ga_regal_letter",
    "ga_regal_number",
    "ga_nivo",
    "arrow",
    "part_number",
    "barcode_pct",
  ],
  fonts: [
    { family: "Artifakt Element", weights: [400, 700] },
    { family: "Artifakt Element Black", weights: [400, 700] },
    { family: "Open Sans", weights: [400, 700] },
    { family: "Inter", weights: [700] },
  ],
  printModes: ["label", "sheet"],
  imageFits: ["stretch"],
  strokes: ["solid"],
};
