import { isImageFile } from "./assets";
import type { ImageFit } from "./document";
import { roundMm } from "./units";

export function imageDestination(
  boxW: number,
  boxH: number,
  imageW: number,
  imageH: number,
  fit: ImageFit,
): { x: number; y: number; width: number; height: number } {
  if (fit === "stretch" || imageW < 1 || imageH < 1 || boxW < 0.01 || boxH < 0.01) {
    return { x: 0, y: 0, width: boxW, height: boxH };
  }
  const scale = fit === "fill" ? Math.max(boxW / imageW, boxH / imageH) : Math.min(boxW / imageW, boxH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  return { x: (boxW - width) / 2, y: (boxH - height) / 2, width, height };
}

export function boxMatchingAspect(
  box: { width: number; height: number },
  natural: { width: number; height: number },
): { width: number; height: number } {
  const aspect = natural.width / Math.max(1, natural.height);
  return {
    width: roundMm(Math.max(4, box.width)),
    height: roundMm(Math.max(4, box.width / aspect)),
  };
}

export function placedImageBox(
  natural: { width: number; height: number },
  page: { widthMm: number; heightMm: number },
  at: { x: number; y: number },
): { x: number; y: number; width: number; height: number } {
  const widthMm = (natural.width * 25.4) / 96;
  const heightMm = (natural.height * 25.4) / 96;
  const scale = Math.min(1, (page.widthMm * 0.7) / Math.max(widthMm, 1), (page.heightMm * 0.7) / Math.max(heightMm, 1));
  const width = roundMm(Math.max(8, widthMm * scale));
  const height = roundMm(Math.max(8, heightMm * scale));
  return {
    x: roundMm(Math.min(Math.max(0, at.x - width / 2), Math.max(0, page.widthMm - width))),
    y: roundMm(Math.min(Math.max(0, at.y - height / 2), Math.max(0, page.heightMm - height))),
    width,
    height,
  };
}

export function clipboardImageFiles(data: DataTransfer | null | undefined): File[] {
  if (!data) return [];
  const seen = new Set<string>();
  const files: File[] = [];
  function add(file: File | null) {
    if (!file || !isImageFile(file)) return;
    const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(file);
  }
  for (const file of [...data.files]) add(file);
  if (data.items) {
    for (const item of [...data.items]) {
      if (item.kind === "file") add(item.getAsFile());
    }
  }
  return files;
}

export function probeImageSrc(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

export async function fileToImageDataUrl(
  blob: Blob,
  maxEdge = 2048,
): Promise<{ dataUrl: string; width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (scale === 1 && blob.size < 1_200_000) {
      bitmap.close();
      return { dataUrl: await readAsDataUrl(blob), width, height };
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { dataUrl: await readAsDataUrl(blob), width: bitmap.width, height: bitmap.height };
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const keepAlpha = blob.type === "image/png" || blob.type === "image/webp" || blob.type === "image/gif";
    const dataUrl = canvas.toDataURL(keepAlpha ? "image/png" : "image/jpeg", 0.88);
    return { dataUrl, width, height };
  } catch {
    const dataUrl = await readAsDataUrl(blob);
    const size = await probeImageSrc(dataUrl);
    return { dataUrl, width: size?.width ?? 0, height: size?.height ?? 0 };
  }
}
