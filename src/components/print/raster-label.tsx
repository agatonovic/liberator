"use client";

import { CanvasElement } from "@/components/designer/canvas-element";
import { resolveBoundImageSrc } from "@/lib/assets";
import { useAssetStore } from "@/lib/asset-store";
import { dataUrlToBytes } from "@/lib/codes";
import type { LabelDocument } from "@/lib/document";
import { ensurePrintFonts } from "@/lib/fonts";
import { resolveValue, useDesignedMedia, type ColumnMapping, type DataRow } from "@/lib/resolve";
import { CSS_DPI, mmToPx } from "@/lib/units";
import Konva from "konva";
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Layer, Rect, Stage } from "react-konva";

const PRINT_DPI = 300;
const MAX_RASTER_EDGE = 8192;

function rasterMetrics(widthMm: number, heightMm: number) {
  const naturalW = (widthMm * PRINT_DPI) / 25.4;
  const naturalH = (heightMm * PRINT_DPI) / 25.4;
  const fit = Math.min(1, MAX_RASTER_EDGE / naturalW, MAX_RASTER_EDGE / naturalH);
  const dpi = PRINT_DPI * fit;
  return {
    width: Math.max(1, Math.round((widthMm * dpi) / 25.4)),
    height: Math.max(1, Math.round((heightMm * dpi) / 25.4)),
    zoom: dpi / CSS_DPI,
  };
}

function fontFamilies(doc: LabelDocument) {
  return [
    ...new Set(
      doc.elements.filter((element) => element.type === "text").map((element) => element.style.fontFamily ?? "IBM Plex Sans"),
    ),
  ];
}

function printFontSizesPx(doc: LabelDocument, zoom: number) {
  const sizes = [64];
  for (const element of doc.elements) {
    if (element.hidden || element.type !== "text") continue;
    const base = element.style.fontSizeMm ?? 4;
    sizes.push(mmToPx(base, zoom));
    for (const span of element.spans ?? []) {
      if (span.fontSizeMm != null) sizes.push(mmToPx(span.fontSizeMm, zoom));
    }
  }
  return sizes;
}

function needsBitmap(
  doc: LabelDocument,
  element: LabelDocument["elements"][number],
  row: DataRow | null,
  mapping: ColumnMapping,
) {
  if (element.hidden) return false;
  if (element.type === "qr" || element.type === "barcode") return true;
  if (element.type !== "image") return false;
  const value = resolveValue(element, row, mapping, doc.dataColumns);
  const assets = useAssetStore.getState();
  const bound = resolveBoundImageSrc(element, value, assets.assets, assets.folders);
  if (bound) return true;
  if (!useDesignedMedia(element, value)) return false;
  return Boolean(element.imageDataUrl || /^(data:image|blob:|https?:|\/)/i.test(value.trim()));
}

function bitmapsSettled(stage: Konva.Stage) {
  const nodes = stage.find("Image") as Konva.Image[];
  for (const node of nodes) {
    const image = node.image();
    if (!image) return false;
    if (image instanceof HTMLImageElement && (!image.complete || image.naturalWidth === 0)) return false;
  }
  return true;
}

function OffscreenLabel({
  doc,
  row,
  mapping,
  width,
  height,
  zoom,
  onStage,
}: {
  doc: LabelDocument;
  row: DataRow | null;
  mapping: ColumnMapping;
  width: number;
  height: number;
  zoom: number;
  onStage: (stage: Konva.Stage) => void;
}) {
  const stageRef = useRef<Konva.Stage>(null);
  const onStageRef = useRef(onStage);
  onStageRef.current = onStage;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (stageRef.current) onStageRef.current(stageRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [doc, row, mapping, width, height, zoom]);

  return (
    <Stage ref={stageRef} width={width} height={height} listening={false} pixelRatio={1}>
      <Layer listening={false}>
        <Rect width={width} height={height} fill="#ffffff" />
      </Layer>
      <Layer listening={false} clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
        {doc.elements
          .filter((element) => !element.hidden)
          .map((element) => (
            <CanvasElement
              key={element.id}
              element={element}
              zoom={zoom}
              value={resolveValue(element, row, mapping, doc.dataColumns)}
              interactive={false}
              missingImagePlaceholder={false}
              onSelect={() => {}}
              onDragEnd={() => {}}
            />
          ))}
      </Layer>
    </Stage>
  );
}

let rasterQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = rasterQueue.then(work, work);
  rasterQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function rasterizeLabelPng(
  doc: LabelDocument,
  row: DataRow | null,
  mapping: ColumnMapping,
): Promise<Uint8Array> {
  return enqueue(() => rasterizeLabelPngNow(doc, row, mapping));
}

function pngImage(bytes: Uint8Array) {
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Sheet raster failed to read a label"));
    };
    image.src = url;
  });
}

function slotPixels(
  origin: { xMm: number; yMm: number },
  label: { widthMm: number; heightMm: number },
  page: { widthMm: number; heightMm: number },
  pageWidthPx: number,
  pageHeightPx: number,
) {
  const x0 = Math.round((origin.xMm / page.widthMm) * pageWidthPx);
  const y0 = Math.round((origin.yMm / page.heightMm) * pageHeightPx);
  const x1 = Math.round(((origin.xMm + label.widthMm) / page.widthMm) * pageWidthPx);
  const y1 = Math.round(((origin.yMm + label.heightMm) / page.heightMm) * pageHeightPx);
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

/** Place label bitmaps on a y-down sheet so PDF packing matches the paper preview. */
export async function composeSheetPng(
  page: { widthMm: number; heightMm: number },
  label: { widthMm: number; heightMm: number },
  origins: { xMm: number; yMm: number }[],
  labelPngs: Uint8Array[],
): Promise<Uint8Array> {
  const { width, height } = rasterMetrics(page.widthMm, page.heightMm);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Sheet raster failed");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const count = Math.min(origins.length, labelPngs.length);
  for (let i = 0; i < count; i += 1) {
    const image = await pngImage(labelPngs[i]!);
    const slot = slotPixels(origins[i]!, label, page, width, height);
    ctx.imageSmoothingEnabled = image.width !== slot.width || image.height !== slot.height;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, slot.x, slot.y, slot.width, slot.height);
  }
  const bytes = dataUrlToBytes(canvas.toDataURL("image/png"));
  if (!bytes.length) throw new Error("Sheet raster produced an empty image");
  return bytes;
}

async function rasterizeLabelPngNow(
  doc: LabelDocument,
  row: DataRow | null,
  mapping: ColumnMapping,
): Promise<Uint8Array> {
  await useAssetStore.getState().hydrate();
  const { width, height, zoom } = rasterMetrics(doc.page.widthMm, doc.page.heightMm);
  await ensurePrintFonts(fontFamilies(doc), printFontSizesPx(doc, zoom));

  const expected = doc.elements.filter((element) => needsBitmap(doc, element, row, mapping)).length;
  const previousRatio = Konva.pixelRatio;
  Konva.pixelRatio = 1;

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${width}px`,
    `height:${height}px`,
    "opacity:0.01",
    "pointer-events:none",
    "z-index:-1",
  ].join(";");
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    const mounted: { stage: Konva.Stage | null } = { stage: null };
    root.render(
      <OffscreenLabel
        doc={doc}
        row={row}
        mapping={mapping}
        width={width}
        height={height}
        zoom={zoom}
        onStage={(next) => {
          mounted.stage = next;
        }}
      />,
    );

    const started = Date.now();
    while (Date.now() - started < 8000) {
      const current = mounted.stage;
      if (current && bitmapsSettled(current) && current.find("Image").length >= expected) break;
      await new Promise((resolve) => window.setTimeout(resolve, 40));
    }
    const stage = mounted.stage;
    if (!stage) throw new Error("Label raster failed to mount");
    stage.draw();
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const dataUrl = stage.toDataURL({ pixelRatio: 1, mimeType: "image/png" });
    const bytes = dataUrlToBytes(dataUrl);
    if (!bytes.length) throw new Error("Label raster produced an empty image");
    return bytes;
  } finally {
    Konva.pixelRatio = previousRatio;
    root.unmount();
    host.remove();
  }
}
