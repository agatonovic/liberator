/**
 * Missing photos on image elements.
 *
 * Designer and template cards keep the dashed Image box so the slot is obvious.
 * Generate, print, and PDF stay empty unless the live value resolves to a photo.
 * A missing photo is not a Generate error — the row can still print and download.
 *
 * This is per image element, not per template — new templates inherit it automatically.
 */
export type ImageSurface = "design" | "generated";

export function showMissingImagePlaceholder(surface: ImageSurface): boolean {
  return surface === "design";
}
