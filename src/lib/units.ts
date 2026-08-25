export const CSS_DPI = 96;

export function mmToPx(mm: number, zoom = 1): number {
  return (mm * CSS_DPI) / 25.4 * zoom;
}

export function pxToMm(px: number, zoom = 1): number {
  return (px * 25.4) / (CSS_DPI * zoom);
}

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

export function inchToMm(inch: number): number {
  return inch * 25.4;
}

export function roundMm(value: number, step = 0.1): number {
  return Math.round(value / step) * step;
}

export function formatMm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function clampZoom(zoom: number) {
  return Math.min(4, Math.max(0.1, zoom));
}

export function panAfterZoom(
  oldZoom: number,
  nextZoom: number,
  panX: number,
  panY: number,
  originX: number,
  originY: number,
) {
  const zoom = clampZoom(nextZoom);
  return {
    zoom,
    panX: originX - mmToPx(pxToMm(originX - panX, oldZoom), zoom),
    panY: originY - mmToPx(pxToMm(originY - panY, oldZoom), zoom),
  };
}

export function fitZoom(
  pageWidthMm: number,
  pageHeightMm: number,
  viewportWidthPx: number,
  viewportHeightPx: number,
  paddingPx = 48,
) {
  const availW = Math.max(1, viewportWidthPx - paddingPx);
  const availH = Math.max(1, viewportHeightPx - paddingPx);
  const pageW = mmToPx(pageWidthMm, 1);
  const pageH = mmToPx(pageHeightMm, 1);
  return Math.min(4, Math.max(0.1, Math.min(availW / pageW, availH / pageH)));
}
