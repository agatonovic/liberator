"use client";

import { qrDataUrl, renderBarcodeCanvas } from "@/lib/codes";
import {
  displayPose,
  isPaintColor,
  isPolygonType,
  lineLocalPoints,
  strokeDashPattern,
  type LabelElement,
} from "@/lib/document";
import { resolveBoundImageSrc, type AssetFolder, type AssetRecord } from "@/lib/assets";
import { useAssetStore } from "@/lib/asset-store";
import { gaMagacinPrefixSpans, normalizeArrow } from "@/lib/format";
import { isStrokeArrow, polygonPoints } from "@/lib/shapes";
import { layoutRuns, runsFromContent, transferSpans } from "@/lib/text-color";
import { fitPlainFontSize, wrapPlainLines } from "@/lib/text-fit";
import { canvasFontFamily } from "@/lib/fonts";
import { mmToPx, pxToMm } from "@/lib/units";
import Konva from "konva";
import { useEffect, useMemo, useState } from "react";
import { Ellipse, Group, Image as KonvaImage, Line, Rect, Text } from "react-konva";

Konva.legacyTextRendering = true;

function nodeBoxPx(node: Konva.Node) {
  const group = node as Konva.Group;
  const frame = typeof group.findOne === "function" ? group.findOne(".element-frame") : null;
  const w = node.width() || (frame as Konva.Rect | null)?.width() || 0;
  const h = node.height() || (frame as Konva.Rect | null)?.height() || 0;
  if (w > 0.5 && h > 0.5) return { w, h };
  const rect = node.getClientRect({ skipTransform: true, skipShadow: true, skipStroke: true });
  return { w: Math.max(rect.width, 1), h: Math.max(rect.height, 1) };
}

export function transformedBoxMm(node: Konva.Node, zoom: number) {
  const { w, h } = nodeBoxPx(node);
  return {
    x: pxToMm(node.x(), zoom),
    y: pxToMm(node.y(), zoom),
    w: Math.max(1, pxToMm(Math.abs(w * node.scaleX()), zoom)),
    h: Math.max(0.4, pxToMm(Math.abs(h * node.scaleY()), zoom)),
  };
}

/** Apply Transformer scale to the element's box instead of stretching glyphs. */
export function applyBoxScale(node: Konva.Node) {
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  if (Math.abs(scaleX - 1) < 1e-6 && Math.abs(scaleY - 1) < 1e-6) return;
  const { w, h } = nodeBoxPx(node);
  const nextW = Math.max(2, Math.abs(w * scaleX));
  const nextH = Math.max(2, Math.abs(h * scaleY));
  node.scaleX(1);
  node.scaleY(1);
  node.width(nextW);
  node.height(nextH);
  const group = node as Konva.Group;
  if (typeof group.findOne === "function") {
    group.findOne(".element-frame")?.setAttrs({ width: nextW, height: nextH });
    group.findOne(".label-text")?.setAttrs({ width: nextW, height: nextH });
  }
}

export function commitElementTransform(node: Konva.Node, zoom: number) {
  applyBoxScale(node);
  const { w, h } = nodeBoxPx(node);
  return {
    x: pxToMm(node.x(), zoom),
    y: pxToMm(node.y(), zoom),
    width: Math.max(1, pxToMm(w, zoom)),
    height: Math.max(0.4, pxToMm(h, zoom)),
    rotation: node.rotation(),
  };
}

function useHtmlImage(src: string | undefined) {
  const [loaded, setLoaded] = useState<{ src: string; image: HTMLImageElement } | null>(null);
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) setLoaded({ src, image: img });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  if (!src) return null;
  return loaded?.src === src ? loaded.image : null;
}

let measureCtx: CanvasRenderingContext2D | null = null;

function measureCanvasText(font: string, text: string) {
  if (typeof document === "undefined") return text.length;
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

function measureCanvasInk(font: string, size: number) {
  if (typeof document === "undefined" || size <= 0) return size;
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return size;
  measureCtx.font = font;
  const metrics = measureCtx.measureText("Hg");
  const ascent = metrics.actualBoundingBoxAscent;
  const descent = metrics.actualBoundingBoxDescent;
  if (!Number.isFinite(ascent) || !Number.isFinite(descent)) return size;
  return Math.max(size * 0.5, ascent + descent);
}

function ColoredLabelText({
  element,
  value,
  width,
  height,
  zoom,
}: {
  element: LabelElement;
  value: string;
  width: number;
  height: number;
  zoom: number;
}) {
  const fontSize = mmToPx(element.style.fontSizeMm ?? 4, zoom);
  const letterSpacing = mmToPx(element.style.letterSpacingMm ?? 0, zoom);
  const lineHeight = element.style.lineHeight ?? 1;
  const align = element.style.align ?? "left";
  const verticalAlign = element.style.verticalAlign ?? "middle";
  const defaultFill = element.style.fill || "#12263A";
  const fontFamily = canvasFontFamily(element.style.fontFamily);
  const fontWeight = element.style.fontWeight === "bold" ? "bold" : "normal";
  const display = value || "Text";
  const defaults = { fill: defaultFill, fontSizeMm: element.style.fontSizeMm ?? 4 };
  const transferred = value ? transferSpans(element.content ?? value, element.spans, value, defaults) : (element.spans ?? []);
  const spans = element.transform === "ga_magacin" ? gaMagacinPrefixSpans(value, transferred) : transferred;
  const runs = runsFromContent(display, defaults, spans);
  const mixed = Boolean(spans?.length);

  const measure = (text: string, sizePx: number) =>
    measureCanvasText(`${fontWeight} ${sizePx}px ${fontFamily}`, text);
  const measureInk = (sizePx: number) => measureCanvasInk(`${fontWeight} ${sizePx}px ${fontFamily}`, sizePx);

  const fittedSize = useMemo(() => {
    if (mixed) return fontSize;
    return fitPlainFontSize({
      text: display,
      designed: element.content ?? "",
      boxW: width,
      boxH: height,
      fontSize,
      minFontSize: mmToPx(0.5, zoom),
      letterSpacing,
      lineHeight,
      measure,
    });
  }, [display, element.content, fontFamily, fontSize, fontWeight, height, letterSpacing, lineHeight, mixed, width, zoom]);

  const fittedText = useMemo(() => {
    if (mixed || fittedSize >= fontSize - 0.05) return display;
    return wrapPlainLines(display, width, fittedSize, letterSpacing, measure).join("\n");
  }, [display, fittedSize, fontFamily, fontSize, fontWeight, letterSpacing, mixed, width]);

  const placed = useMemo(() => {
    if (!mixed) return [];
    return layoutRuns(
      runs,
      width,
      height,
      (sizeMm) => mmToPx(sizeMm, zoom),
      letterSpacing,
      lineHeight,
      align,
      verticalAlign,
      measure,
      measureInk,
    );
  }, [align, fontFamily, fontWeight, height, letterSpacing, lineHeight, mixed, runs, verticalAlign, width, zoom]);

  const hitBox = useMemo(() => {
    if (!placed.length) return { x: 0, y: 0, width, height };
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const run of placed) {
      minX = Math.min(minX, run.x);
      minY = Math.min(minY, run.y);
      maxX = Math.max(maxX, run.x + Math.max(run.width, 1));
      maxY = Math.max(maxY, run.y + run.fontSize);
    }
    const pad = 2;
    return {
      x: minX - pad,
      y: minY - pad,
      width: Math.max(maxX - minX + pad * 2, 1),
      height: Math.max(maxY - minY + pad * 2, 1),
    };
  }, [height, placed, width]);

  if (!mixed) {
    return (
      <Text
        name="label-text"
        text={fittedText}
        width={width}
        height={height}
        fill={defaultFill}
        fontSize={fittedSize}
        fontStyle={fontWeight}
        fontFamily={fontFamily}
        align={align}
        verticalAlign={verticalAlign}
        letterSpacing={letterSpacing}
        lineHeight={lineHeight}
        wrap="none"
        padding={0}
        listening
      />
    );
  }

  return (
    <>
      <Text
        name="glyph-hit"
        text=" "
        x={hitBox.x}
        y={hitBox.y}
        width={hitBox.width}
        height={hitBox.height}
        fill="#000000"
        opacity={0}
        listening
      />
      {placed.map((run, index) => (
        <Text
          key={`${run.x}-${run.y}-${index}`}
          name="glyph-run"
          text={run.text}
          x={run.x}
          y={run.y}
          fill={run.fill}
          fontSize={run.fontSize}
          fontStyle={fontWeight}
          fontFamily={fontFamily}
          wrap="none"
          listening
        />
      ))}
    </>
  );
}

function paint(value: string | undefined): string | undefined {
  return isPaintColor(value) ? value : undefined;
}

function imageSource(
  element: LabelElement,
  value: string,
  assets: AssetRecord[],
  folders: AssetFolder[] = [],
): string | undefined {
  const bound = resolveBoundImageSrc(element, value, assets, folders);
  if (bound) return bound;
  const src = element.imageDataUrl;
  if (src) {
    if (/\/arrows\/(?:UP|DOWN)/.test(src) && value.trim()) {
      return src.replace(/UP|DOWN/, normalizeArrow(value));
    }
    return src;
  }
  const trimmed = value.trim();
  if (trimmed.startsWith("data:image") || /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed;
  }
  return undefined;
}

function ImagePlaceholder({ width, height, label }: { width: number; height: number; label: string }) {
  return (
    <>
      <Rect width={width} height={height} fill="#f6f3ec" stroke="#d9d4c8" dash={[6, 4]} />
      <Text
        text={label}
        width={width}
        height={height}
        align="center"
        verticalAlign="middle"
        fontSize={Math.max(10, Math.min(width, height) * 0.16)}
        fill="#8a8376"
        fontFamily="IBM Plex Sans, Helvetica, sans-serif"
      />
    </>
  );
}

function CodeImage({
  src,
  canvas,
  width,
  height,
  emptyLabel,
  crisp,
}: {
  src?: string;
  canvas?: HTMLCanvasElement | null;
  width: number;
  height: number;
  emptyLabel?: string;
  crisp?: boolean;
}) {
  const image = useHtmlImage(src);
  const source = canvas ?? image;
  if (!source) {
    if (emptyLabel && !src) return <ImagePlaceholder width={width} height={height} label={emptyLabel} />;
    return <Rect width={width} height={height} fill="#f6f3ec" stroke="#d9d4c8" dash={[4, 3]} />;
  }
  return (
    <KonvaImage
      image={source}
      width={width}
      height={height}
      imageSmoothingEnabled={!crisp}
      perfectDrawEnabled={!crisp}
    />
  );
}

export function CanvasElement({
  element,
  zoom,
  value,
  interactive,
  sampling = false,
  onSelect,
  onContextMenu,
  onDragMove,
  onDragEnd,
  onDragStart,
  onClick,
  onEditText,
  editing = false,
  groupTransform = false,
}: {
  element: LabelElement;
  zoom: number;
  value: string;
  interactive: boolean;
  sampling?: boolean;
  onSelect: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onContextMenu?: (event: Konva.KonvaEventObject<PointerEvent>) => void;
  onDragMove?: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragStart?: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onClick?: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onEditText?: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  editing?: boolean;
  groupTransform?: boolean;
}) {
  const assets = useAssetStore((s) => s.assets);
  const folders = useAssetStore((s) => s.folders);
  const [qrSrc, setQrSrc] = useState<string>();

  const pose = displayPose(element, value);
  const x = mmToPx(pose.x, zoom);
  const y = mmToPx(pose.y, zoom);
  const width = Math.max(mmToPx(element.width, zoom), 2);
  const height = Math.max(mmToPx(element.height, zoom), 2);
  const pixelRatio = Konva.pixelRatio || (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1;

  const barcodeCanvas = useMemo(() => {
    if (element.type !== "barcode") return null;
    return renderBarcodeCanvas(
      value,
      element.style.barcodeSymbology ?? "code128",
      element.style.barcodeDisplayValue ?? false,
      width * pixelRatio,
      height * pixelRatio,
    );
  }, [
    element.type,
    element.style.barcodeDisplayValue,
    element.style.barcodeSymbology,
    height,
    pixelRatio,
    value,
    width,
  ]);

  useEffect(() => {
    if (element.type !== "qr") return;
    let cancelled = false;
    const size = Math.round(Math.max(width, height) * pixelRatio);
    void qrDataUrl(value, size).then((url) => {
      if (!cancelled) setQrSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [element.type, height, pixelRatio, value, width]);

  const fill = paint(element.style.fill);
  const stroke = paint(element.style.stroke);
  const strokeWidthPx = mmToPx(element.style.strokeWidth ?? 0, zoom);
  const showStroke = Boolean(stroke && strokeWidthPx > 0);
  const dash = showStroke ? strokeDashPattern(element.style, (mm) => mmToPx(mm, zoom)) : undefined;
  const strokeLineCap = (element.style.strokeStyle ?? "solid") === "dotted" ? "round" : (element.style.lineCap ?? "butt");
  const opacity = element.style.opacity ?? 1;
  const cornerRadius = mmToPx(element.style.cornerRadiusMm ?? 0, zoom);
  const arrowKind = element.style.arrowKind ?? "block";
  const openArrow =
    (element.type === "arrow" || element.type === "doubleArrow") && isStrokeArrow(arrowKind);

  return (
    <Group
      id={`el-${element.id}`}
      name="element"
      x={x}
      y={y}
      width={width}
      height={height}
      rotation={pose.rotation}
      opacity={opacity}
      listening={interactive}
      draggable={interactive && !sampling && !editing && !element.locked}
      onMouseDown={interactive ? onSelect : undefined}
      onTap={interactive ? onSelect : undefined}
      onDblClick={
        interactive
          ? (event) => {
              event.cancelBubble = true;
              onEditText?.(event);
            }
          : undefined
      }
      onDblTap={
        interactive
          ? (event) => {
              event.cancelBubble = true;
              onEditText?.(event);
            }
          : undefined
      }
      onContextMenu={interactive ? onContextMenu : undefined}
      onClick={interactive ? onClick : undefined}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onTransform={(event) => {
        if (groupTransform) return;
        applyBoxScale(event.target);
      }}
      onTransformEnd={(event) => {
        if (groupTransform) return;
        applyBoxScale(event.target);
      }}
    >
      <Rect
        name="element-frame"
        width={width}
        height={height}
        fill="rgba(0,0,0,0.001)"
        listening={element.type !== "text" || !editing}
      />
      {element.type === "rect" ? (
        <Rect
          width={width}
          height={height}
          fill={fill}
          stroke={showStroke ? stroke : undefined}
          strokeWidth={showStroke ? strokeWidthPx : 0}
          cornerRadius={cornerRadius}
          dash={dash}
          lineCap={strokeLineCap}
        />
      ) : null}
      {element.type === "ellipse" ? (
        <Ellipse
          x={width / 2}
          y={height / 2}
          radiusX={width / 2}
          radiusY={height / 2}
          fill={fill}
          stroke={showStroke ? stroke : undefined}
          strokeWidth={showStroke ? strokeWidthPx : 0}
          dash={dash}
          lineCap={strokeLineCap}
        />
      ) : null}
      {element.type === "line" ? (
        <Line
          points={lineLocalPoints(width, height)}
          stroke={showStroke ? stroke : undefined}
          strokeWidth={showStroke ? Math.max(strokeWidthPx, 1) : 0}
          hitStrokeWidth={16}
          lineCap={strokeLineCap}
          lineJoin="miter"
          dash={dash}
        />
      ) : null}
      {isPolygonType(element.type) ? (
        <Line
          points={polygonPoints(element.type, width, height, arrowKind)}
          closed={!openArrow}
          fill={openArrow ? undefined : fill}
          stroke={openArrow ? (fill ?? stroke ?? "#12263A") : showStroke ? stroke : undefined}
          strokeWidth={openArrow ? Math.max(strokeWidthPx, mmToPx(0.45, zoom)) : showStroke ? strokeWidthPx : 0}
          hitStrokeWidth={openArrow ? 16 : undefined}
          lineCap={openArrow ? "round" : strokeLineCap}
          lineJoin="round"
          dash={showStroke || openArrow ? dash : undefined}
        />
      ) : null}
      {element.type === "text" && !editing ? (
        <ColoredLabelText element={element} value={value} width={width} height={height} zoom={zoom} />
      ) : null}
      {element.type === "barcode" ? (
        <CodeImage canvas={barcodeCanvas} width={width} height={height} crisp />
      ) : null}
      {element.type === "qr" ? <CodeImage src={qrSrc} width={width} height={height} crisp /> : null}
      {element.type === "image" ? (
        <CodeImage src={imageSource(element, value, assets, folders)} width={width} height={height} emptyLabel="Image" />
      ) : null}
    </Group>
  );
}
