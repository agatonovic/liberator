import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import type { BarcodeSymbology } from "./document";

const FORMAT: Record<BarcodeSymbology, string> = {
  code128: "CODE128",
  ean13: "EAN13",
  code39: "CODE39",
};

function fillError(canvas: HTMLCanvasElement, message: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#C23B3B";
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  ctx.fillStyle = "#C23B3B";
  ctx.font = `${Math.max(10, Math.round(canvas.height * 0.2))}px sans-serif`;
  ctx.fillText(message, 8, Math.round(canvas.height * 0.55));
}

function blit(source: HTMLCanvasElement, widthPx: number, heightPx: number) {
  if (source.width === widthPx && source.height === heightPx) return source;
  const out = document.createElement("canvas");
  out.width = widthPx;
  out.height = heightPx;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, widthPx, heightPx);
  return out;
}

export function renderBarcodeCanvas(
  value: string,
  symbology: BarcodeSymbology = "code128",
  displayValue = false,
  widthPx = 800,
  heightPx = 200,
): HTMLCanvasElement {
  const destW = Math.max(8, Math.round(widthPx));
  const destH = Math.max(8, Math.round(heightPx));
  const canvas = document.createElement("canvas");
  const text = value || "0";

  try {
    const probe = document.createElement("canvas");
    JsBarcode(probe, text, {
      format: FORMAT[symbology],
      displayValue: false,
      margin: 0,
      width: 1,
      height: 10,
    });
    const modules = Math.max(1, probe.width);
    const moduleWidth = Math.max(1, Math.round(destW / modules));
    const fontSize = displayValue ? Math.max(8, Math.round(destH * 0.16)) : 0;
    const textMargin = displayValue ? Math.max(1, Math.round(destH * 0.04)) : 0;
    const barHeight = Math.max(8, destH - fontSize - textMargin);

    JsBarcode(canvas, text, {
      format: FORMAT[symbology],
      displayValue,
      margin: 0,
      background: "#ffffff",
      lineColor: "#000000",
      width: moduleWidth,
      height: barHeight,
      fontSize,
      textMargin,
    });
    return blit(canvas, destW, destH);
  } catch {
    canvas.width = destW;
    canvas.height = destH;
    fillError(canvas, "Invalid barcode");
    return canvas;
  }
}

function ean13Checksum(digits: string) {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const n = Number(digits[i]);
    sum += i % 2 === 0 ? n : n * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/** Returns a short reason when the value cannot encode, otherwise null. */
export function barcodeValueIssue(value: string, symbology: BarcodeSymbology = "code128"): string | null {
  const text = value.trim();
  if (!text) return "Missing barcode value";
  if (symbology === "ean13") {
    const digits = text.replace(/\s+/g, "");
    if (!/^\d{12,13}$/.test(digits)) return "EAN-13 needs 12 or 13 digits";
    const body = digits.slice(0, 12);
    if (digits.length === 13 && Number(digits[12]) !== ean13Checksum(body)) return "Invalid EAN-13 checksum";
    return null;
  }
  if (symbology === "code39") {
    if (!/^[0-9A-Z .$/%+-]+$/i.test(text)) return "Invalid Code 39 characters";
    if (text.length > 43) return "Barcode value exceeds the supported format";
    return null;
  }
  if (text.length > 80) return "Barcode value exceeds the supported format";
  return null;
}

export function barcodeDataUrl(
  value: string,
  symbology: BarcodeSymbology = "code128",
  displayValue = false,
  widthPx = 800,
  heightPx = 200,
): string {
  return renderBarcodeCanvas(value, symbology, displayValue, widthPx, heightPx).toDataURL("image/png");
}

export async function qrDataUrl(
  value: string,
  sizePx = 512,
  options?: { dark?: string; light?: string; margin?: number },
): Promise<string> {
  const size = Math.max(64, Math.round(sizePx));
  return QRCode.toDataURL(value || " ", {
    margin: options?.margin ?? 0,
    width: size,
    errorCorrectionLevel: "M",
    color: {
      dark: options?.dark ?? "#000000",
      light: options?.light ?? "#00000000",
    },
  });
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  if (!base64) return new Uint8Array();
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
