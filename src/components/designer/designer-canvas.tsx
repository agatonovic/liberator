"use client";

import { CanvasElement, commitElementTransform, transformedBoxMm } from "@/components/designer/canvas-element";
import { CanvasContextMenu } from "@/components/designer/canvas-context-menu";
import { SpacingGuides } from "@/components/designer/spacing-guides";
import { TextEditorOverlay } from "@/components/designer/text-editor";
import { useLabelFonts } from "@/components/designer/use-label-fonts";
import {
  defaultSizeForType,
  isHorizontalLine,
  LINE_HIT_MM,
  QR_MIN_SIDE_MM,
  BARCODE_MIN_WIDTH_MM,
  BARCODE_MIN_HEIGHT_MM,
  qrSideMm,
  selectionGroupFlags,
  type ElementType,
  type LabelDocument,
  type LabelElement,
} from "@/lib/document";
import { computeDragGuides, computeResizeGuides, elementAabb, elementGuideBox, boxesIntersect, measureSelection, spacingMarks, type GuideMark } from "@/lib/guides";
import { releasePartSplit } from "@/lib/format";
import { designerResolveValue, type ColumnMapping, type DataRow } from "@/lib/resolve";
import { useAppStore } from "@/lib/store";
import { toolFromShortcut } from "@/lib/tool-shortcuts";
import { mmToPx, panAfterZoom, pxToMm, roundMm } from "@/lib/units";
import Konva from "konva";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Layer, Rect, Stage, Transformer } from "react-konva";

const SHAPE_ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-right",
  "bottom-right",
  "bottom-center",
  "bottom-left",
  "middle-left",
];
const TRANSFORMER_HANDLE_NAMES = new Set([...SHAPE_ANCHORS, "rotater"]);

function nodeHasName(node: Konva.Node, names: Set<string>) {
  return node.name().split(/\s+/).some((part) => names.has(part) || part === "_anchor");
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function sampleBitmap(source: CanvasImageSource, u: number, v: number) {
  const width =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : "naturalWidth" in source && source.naturalWidth
        ? source.naturalWidth
        : Number((source as { width?: number }).width) || 0;
  const height =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : "naturalHeight" in source && source.naturalHeight
        ? source.naturalHeight
        : Number((source as { height?: number }).height) || 0;
  if (width < 1 || height < 1) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  try {
    ctx.drawImage(source, 0, 0, width, height);
    const x = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
    const y = Math.min(height - 1, Math.max(0, Math.floor(v * height)));
    const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
    if (a < 8) return null;
    return rgbToHex(r, g, b);
  } catch {
    return null;
  }
}

function sampleNativeCanvases(root: HTMLElement, clientX: number, clientY: number) {
  const canvases = [...root.querySelectorAll("canvas")];
  for (let i = canvases.length - 1; i >= 0; i -= 1) {
    const canvas = canvases[i];
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    const x = Math.floor((clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((clientY - rect.top) * (canvas.height / rect.height));
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
      if (a < 8) continue;
      return rgbToHex(r, g, b);
    } catch {
      continue;
    }
  }
  return null;
}

export function DesignerCanvas({
  document: doc,
  zoom,
  selectedIds,
  tool,
  previewRow,
  mapping,
  readOnly = false,
  onSelect,
  onAdd,
  onUpdate,
  onPlaced,
}: {
  document: LabelDocument;
  zoom: number;
  selectedIds: string[];
  tool: string;
  previewRow: DataRow | null;
  mapping: ColumnMapping;
  readOnly?: boolean;
  onSelect: (ids: string[], mode?: "replace" | "toggle") => void;
  onAdd: (type: ElementType, x: number, y: number, extras?: Partial<LabelElement>) => string | null | void;
  onUpdate: (id: string, patch: Partial<LabelElement>) => void;
  onPlaced: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const dragRef = useRef<{ x0: number; y0: number; shift: boolean } | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [draft, setDraft] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    kind: "box" | "line";
  } | null>(null);
  const [liveGuides, setLiveGuides] = useState<GuideMark[] | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [altMeasuring, setAltMeasuring] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [selectAllOnEdit, setSelectAllOnEdit] = useState(true);
  const draggingRef = useRef(false);
  const pendingSingleRef = useRef<string | null>(null);
  const dragGroupRef = useRef<{ id: string; x0: number; y0: number }[] | null>(null);
  const ignoreDragEndRef = useRef<string | null>(null);
  const pickHoverRef = useRef<() => void>(() => {});
  const lastClientRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeRef = useRef<{ x0: number; y0: number; additive: boolean; pointerId: number } | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const panX = useAppStore((s) => s.panX);
  const panY = useAppStore((s) => s.panY);
  const applySampledColor = useAppStore((s) => s.applySampledColor);
  const fontTick = useLabelFonts(
    doc.elements.filter((element) => element.type === "text").map((element) => element.style.fontFamily ?? "IBM Plex Sans"),
  );

  const paper = useMemo(() => {
    return {
      width: mmToPx(doc.page.widthMm, zoom),
      height: mmToPx(doc.page.heightMm, zoom),
    };
  }, [doc.page.heightMm, doc.page.widthMm, zoom]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => setStageSize({ width: node.clientWidth, height: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    const nodes = selectedIds
      .filter((id) => {
        const el = doc.elements.find((item) => item.id === id);
        return Boolean(el) && !el?.hidden;
      })
      .map((id) => stage.findOne(`#el-${id}`))
      .filter((node): node is Konva.Node => Boolean(node));
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, doc.elements, zoom]);

  const paperX = panX;
  const paperY = panY;
  const placing = tool !== "select";
  const clipboard = useAppStore((s) => s.clipboard);
  const groupFlags = selectionGroupFlags(doc.elements, selectedIds);

  function focusCanvas() {
    containerRef.current?.focus({ preventScroll: true });
  }

  function openMenu(clientX: number, clientY: number) {
    const pad = 8;
    setMenu({
      x: Math.min(clientX, window.innerWidth - 180),
      y: Math.min(clientY, window.innerHeight - 180 - pad),
    });
  }
  const sampling = useAppStore((s) => Boolean(s.colorSample));
  const selectedElement = doc.elements.find((element) => element.id === selectedIds[0]);
  const selectedLocked = selectedIds.some((id) => doc.elements.find((el) => el.id === id)?.locked);
  const editingElement =
    editingTextId ? doc.elements.find((element) => element.id === editingTextId && element.type === "text") : undefined;
  const selectedLineHorizontal =
    selectedElement?.type === "line" ? isHorizontalLine(selectedElement.width, selectedElement.height) : false;

  function startTextEdit(id: string, selectAll = true) {
    if (readOnly) return;
    useAppStore.getState().beginPropertyEdit();
    useAppStore.getState().setEditingTextId(id);
    setSelectAllOnEdit(selectAll);
    setEditingTextId(id);
    onSelect([id]);
  }

  function stopTextEdit() {
    if (!editingTextId) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      const tag = active.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") active.blur();
    }
    useAppStore.getState().setEditingTextId(null);
    useAppStore.getState().endPropertyEdit();
    setEditingTextId(null);
  }

  function neighborBoxes(id: string, skipIds: string[] = []) {
    const skip = new Set([id, ...skipIds]);
    return doc.elements
      .filter((item) => !skip.has(item.id) && !item.hidden)
      .map((item) => ({ id: item.id, x: item.x, y: item.y, w: item.width, h: item.height }));
  }

  function guidesFor(element: LabelElement, x: number, y: number, threshold: number, skipIds: string[] = []) {
    return computeDragGuides(
      { id: element.id, x, y, w: element.width, h: element.height },
      neighborBoxes(element.id, skipIds),
      { width: doc.page.widthMm, height: doc.page.heightMm },
      threshold,
    );
  }

  function pointerOnPaper(clientX: number, clientY: number) {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      xMm: pxToMm(clientX - bounds.left - paperX, zoom),
      yMm: pxToMm(clientY - bounds.top - paperY, zoom),
      xPx: clientX - bounds.left,
      yPx: clientY - bounds.top,
    };
  }

  function samplePixelAt(clientX: number, clientY: number) {
    const stage = stageRef.current;
    const native = sampleNativeCanvases(stage?.container() ?? containerRef.current ?? document.body, clientX, clientY);
    if (native) return native;

    const point = pointerOnPaper(clientX, clientY);
    if (point && stage) {
      for (let i = doc.elements.length - 1; i >= 0; i -= 1) {
        const el = doc.elements[i];
        if (el.hidden || el.type !== "image") continue;
        const local = localPointInElement(el, point.xMm, point.yMm);
        if (!local || el.width <= 0 || el.height <= 0) continue;
        const group = stage.findOne(`#el-${el.id}`) as Konva.Group | null;
        const imageNode = group?.findOne("Image") as Konva.Image | undefined;
        const source = imageNode?.image();
        if (!source) continue;
        const color = sampleBitmap(source, local.x / el.width, local.y / el.height);
        if (color) return color;
      }
    }

    try {
      if (!stage) return null;
      const bounds = stage.container().getBoundingClientRect();
      const x = Math.floor(clientX - bounds.left);
      const y = Math.floor(clientY - bounds.top);
      if (x < 0 || y < 0 || x >= stage.width() || y >= stage.height()) return null;
      const canvas = stage.toCanvas({ pixelRatio: 1 });
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
      if (a < 8) return null;
      return rgbToHex(r, g, b);
    } catch {
      return null;
    }
  }

  function localPointInElement(el: LabelElement, xMm: number, yMm: number) {
    const rot = ((el.rotation ?? 0) * Math.PI) / 180;
    const dx = xMm - el.x;
    const dy = yMm - el.y;
    const localX = dx * Math.cos(-rot) - dy * Math.sin(-rot);
    const localY = dx * Math.sin(-rot) + dy * Math.cos(-rot);
    const pad = el.type === "line" ? LINE_HIT_MM : 0;
    if (localX < -pad || localY < -pad || localX > el.width + pad || localY > el.height + pad) return null;
    return { x: localX, y: localY };
  }

  function pointInElement(el: LabelElement, xMm: number, yMm: number) {
    return localPointInElement(el, xMm, yMm) != null;
  }

  function pointInClientRect(rect: { x: number; y: number; width: number; height: number }, xPx: number, yPx: number) {
    return xPx >= rect.x && xPx <= rect.x + rect.width && yPx >= rect.y && yPx <= rect.y + rect.height;
  }

  function hitsAt(clientX: number, clientY: number) {
    const point = pointerOnPaper(clientX, clientY);
    if (!point) return [];
    const stage = stageRef.current;
    return doc.elements
      .map((el, index) => {
        if (el.hidden || el.locked) return null;
        const node = stage?.findOne(`#el-${el.id}`);
        const visual = node?.getClientRect({ skipShadow: true, skipStroke: true });
        const inVisual = visual ? pointInClientRect(visual, point.xPx, point.yPx) : false;
        const inBox = pointInElement(el, point.xMm, point.yMm);
        if (!inVisual && !inBox) return null;
        const area = visual && visual.width > 0 && visual.height > 0 ? visual.width * visual.height : el.width * el.height;
        return { el, index, area };
      })
      .filter((item): item is { el: LabelElement; index: number; area: number } => Boolean(item))
      .sort((a, b) => {
        if (Math.abs(a.area - b.area) > 1) return a.area - b.area;
        if (a.el.type === "text" && b.el.type !== "text") return -1;
        if (b.el.type === "text" && a.el.type !== "text") return 1;
        return b.index - a.index;
      })
      .map(({ el }) => el);
  }

  function hoverIdAt(clientX: number, clientY: number) {
    return hitsAt(clientX, clientY)[0]?.id ?? null;
  }

  function pointerOnTransformerHandle(clientX: number, clientY: number) {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage || !transformer.visible() || !transformer.listening()) return false;
    const container = stage.container().getBoundingClientRect();
    const x = clientX - container.left;
    const y = clientY - container.top;
    const pad = 16;
    for (const node of transformer.getChildren()) {
      if (!nodeHasName(node, TRANSFORMER_HANDLE_NAMES)) continue;
      const box = node.getClientRect({ skipShadow: true });
      if (x >= box.x - pad && x <= box.x + box.width + pad && y >= box.y - pad && y <= box.y + box.height + pad) {
        return true;
      }
    }
    return false;
  }

  function pointerLocal(clientX: number, clientY: number) {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return { x: clientX - bounds.left, y: clientY - bounds.top };
  }

  function finishMarquee(clientX: number, clientY: number) {
    const start = marqueeRef.current;
    marqueeRef.current = null;
    setMarqueeBox(null);
    if (!start) return;
    const end = pointerLocal(clientX, clientY);
    if (!end) return;
    const width = Math.abs(end.x - start.x0);
    const height = Math.abs(end.y - start.y0);
    if (width < 4 && height < 4) {
      if (!start.additive) onSelect([]);
      return;
    }
    const x1px = Math.min(start.x0, end.x);
    const y1px = Math.min(start.y0, end.y);
    const rect = {
      x1: pxToMm(x1px - paperX, zoom),
      y1: pxToMm(y1px - paperY, zoom),
      x2: pxToMm(x1px + width - paperX, zoom),
      y2: pxToMm(y1px + height - paperY, zoom),
    };
    const ids = doc.elements
      .filter((el) => !el.hidden && !el.locked)
      .filter((el) => boxesIntersect(rect, elementAabb(el)))
      .map((el) => el.id);
    if (start.additive) onSelect([...new Set([...selectedIds, ...ids])]);
    else onSelect(ids);
  }

  function selectAt(clientX: number, clientY: number, event: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) {
    const id = hoverIdAt(clientX, clientY);
    const additive = Boolean(event.shiftKey || event.metaKey || event.ctrlKey);
    if (sampling) {
      const color = samplePixelAt(clientX, clientY);
      if (color) applySampledColor(color);
      return;
    }
    if (!id) {
      if (!additive) onSelect([]);
      return;
    }
    if (additive) {
      pendingSingleRef.current = null;
      onSelect([id], "toggle");
      return;
    }
    if (selectedIds.includes(id) && selectedIds.length > 1) {
      pendingSingleRef.current = id;
      return;
    }
    pendingSingleRef.current = null;
    onSelect([id]);
  }

  function syncHover(clientX: number, clientY: number) {
    lastClientRef.current = { x: clientX, y: clientY };
    if (placing || sampling) return;
    const id = hoverIdAt(clientX, clientY);
    setHoveredId((prev) => (prev === id ? prev : id));
  }

  pickHoverRef.current = () => {
    const point = lastClientRef.current;
    if (!point) return;
    setHoveredId(hoverIdAt(point.x, point.y));
  };

  useEffect(() => {
    function isAltKey(event: KeyboardEvent) {
      return event.key === "Alt" || event.code === "AltLeft" || event.code === "AltRight";
    }
    function onKeyDown(event: KeyboardEvent) {
      if (isAltKey(event) || event.altKey || event.getModifierState("Alt")) {
        setAltMeasuring(true);
        pickHoverRef.current();
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (!isAltKey(event)) return;
      if (event.getModifierState("Alt")) return;
      setAltMeasuring(false);
    }
    function onBlur() {
      setAltMeasuring(false);
    }
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    if (editingTextId && !doc.elements.some((element) => element.id === editingTextId)) {
      useAppStore.getState().setEditingTextId(null);
      useAppStore.getState().endPropertyEdit();
      setEditingTextId(null);
    }
  }, [doc.elements, editingTextId]);

  useEffect(() => {
    if (editingTextId && !selectedIds.includes(editingTextId)) stopTextEdit();
  }, [editingTextId, selectedIds]);

  useEffect(() => {
    function typingInField(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (editingTextId) return;
      if (typingInField(event.target)) return;
      if (placing || sampling || event.metaKey || event.ctrlKey || event.altKey) return;
      if (toolFromShortcut(event)) return;
      if (selectedElement?.locked) return;
      if (selectedElement?.type !== "text") return;
      if (event.key === "Enter") {
        event.preventDefault();
        startTextEdit(selectedElement.id, false);
        return;
      }
      if (event.key.length === 1 && !event.repeat) {
        event.preventDefault();
        startTextEdit(selectedElement.id, false);
        onUpdate(selectedElement.id, { content: event.key, spans: [] });
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [editingTextId, placing, sampling, selectedElement, onUpdate]);

  const hoveredElement = hoveredId ? doc.elements.find((element) => element.id === hoveredId) : undefined;
  const altGuides = useMemo(() => {
    if (!altMeasuring || placing || sampling) return [] as GuideMark[];
    const page = { width: doc.page.widthMm, height: doc.page.heightMm };
    const target = selectedElement ?? hoveredElement;
    if (!target) return [] as GuideMark[];
    const hovered =
      hoveredElement && hoveredElement.id !== target.id ? elementGuideBox(hoveredElement) : null;
    return measureSelection(
      elementGuideBox(target),
      hovered,
      doc.elements
        .filter((item) => item.id !== target.id && !item.hidden)
        .map(elementGuideBox),
      page,
    );
  }, [
    altMeasuring,
    placing,
    sampling,
    hoveredElement,
    selectedElement,
    doc.elements,
    doc.page.heightMm,
    doc.page.widthMm,
  ]);
  const guides = liveGuides ?? altGuides;

  function commitDraw(endX: number, endY: number, shift: boolean) {
    const start = dragRef.current;
    dragRef.current = null;
    setDraft(null);
    if (!start || tool === "select") return;
    const type = tool as ElementType;
    const dx = endX - start.x0;
    const dy = endY - start.y0;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const click = absX < 2 && absY < 2;
    const defaults = defaultSizeForType(type);

    function place(nextType: ElementType, x: number, y: number, extras?: Partial<LabelElement>) {
      const id = onAdd(nextType, x, y, extras) ?? null;
      onPlaced();
      if (nextType === "text" && id) startTextEdit(id, true);
    }

    if (click) {
      if (type === "line" && shift) {
        const size = { width: LINE_HIT_MM, height: defaults.width };
        place("line", roundMm(start.x0 - size.width / 2), roundMm(start.y0 - size.height / 2), size);
      } else {
        place(type, roundMm(start.x0 - defaults.width / 2), roundMm(start.y0 - defaults.height / 2));
      }
      return;
    }

    let width = Math.max(absX, 2);
    let height = Math.max(absY, 2);
    let x = Math.min(start.x0, endX);
    let y = Math.min(start.y0, endY);
    if ((shift || type === "qr") && type !== "line") {
      const side = type === "qr" ? qrSideMm(width, height) : Math.max(width, height);
      width = side;
      height = side;
      x = dx < 0 ? start.x0 - side : start.x0;
      y = dy < 0 ? start.y0 - side : start.y0;
    }

    if (type === "line") {
      if (absX >= absY) {
        place("line", roundMm(x), roundMm(start.y0 - LINE_HIT_MM / 2), {
          width: roundMm(Math.max(width, 8)),
          height: LINE_HIT_MM,
        });
      } else {
        place("line", roundMm(start.x0 - LINE_HIT_MM / 2), roundMm(y), {
          width: LINE_HIT_MM,
          height: roundMm(Math.max(height, 8)),
        });
      }
      return;
    }

    if (type === "barcode") {
      width = Math.max(BARCODE_MIN_WIDTH_MM, width);
      height = Math.max(BARCODE_MIN_HEIGHT_MM, height);
    }

    place(type, roundMm(x), roundMm(y), {
      width: roundMm(width),
      height: roundMm(height),
    });
  }

  useEffect(() => {
    if (!placing) return;
    function onUp(event: MouseEvent) {
      if (!dragRef.current) return;
      const point = pointerOnPaper(event.clientX, event.clientY);
      if (!point) {
        dragRef.current = null;
        setDraft(null);
        return;
      }
      commitDraw(point.xMm, point.yMm, event.shiftKey || dragRef.current.shift);
    }
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [placing, zoom, paperX, paperY, tool]);

  useEffect(() => {
    if (!menu) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const canvas = node;

    let safariStartZoom = 1;
    let safariPinch = false;
    let pinchOnCanvas = false;
    let touches: {
      dist: number;
      zoom: number;
      panX: number;
      panY: number;
      midX: number;
      midY: number;
    } | null = null;

    function overCanvas(x: number, y: number) {
      const rect = canvas.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    function viewCenter() {
      return { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
    }

    function onWheel(event: WheelEvent) {
      const target = event.target;
      const onCanvas = target instanceof Node && canvas.contains(target);
      const over = onCanvas && overCanvas(event.clientX, event.clientY);
      if (safariPinch) {
        event.preventDefault();
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        if (!over) return;
        const { x, y } = viewCenter();
        const current = useAppStore.getState().zoom;
        useAppStore.getState().zoomAt(current * Math.exp(-event.deltaY * 0.01), x, y);
        return;
      }
      if (!over) return;
      event.preventDefault();
      const { panX: x, panY: y } = useAppStore.getState();
      useAppStore.getState().setPan(x - event.deltaX, y - event.deltaY);
    }

    function onGestureStart(event: Event) {
      const ge = event as Event & { clientX?: number; clientY?: number };
      const x = ge.clientX ?? -1;
      const y = ge.clientY ?? -1;
      pinchOnCanvas = x < 0 || y < 0 ? true : overCanvas(x, y);
      event.preventDefault();
      safariPinch = true;
      safariStartZoom = useAppStore.getState().zoom;
    }

    function onGestureChange(event: Event) {
      event.preventDefault();
      if (!pinchOnCanvas) return;
      const scale = (event as Event & { scale?: number }).scale ?? 1;
      const { x, y } = viewCenter();
      useAppStore.getState().zoomAt(safariStartZoom * scale, x, y);
    }

    function onGestureEnd(event: Event) {
      event.preventDefault();
      safariPinch = false;
      pinchOnCanvas = false;
    }

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 2) {
        touches = null;
        return;
      }
      const a = event.touches[0];
      const b = event.touches[1];
      const state = useAppStore.getState();
      touches = {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        zoom: state.zoom,
        panX: state.panX,
        panY: state.panY,
        midX: (a.clientX + b.clientX) / 2,
        midY: (a.clientY + b.clientY) / 2,
      };
    }

    function onTouchMove(event: TouchEvent) {
      if (event.touches.length !== 2 || !touches) return;
      event.preventDefault();
      const a = event.touches[0];
      const b = event.touches[1];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const scale = touches.dist > 1 ? dist / touches.dist : 1;
      const midX = (a.clientX + b.clientX) / 2;
      const midY = (a.clientY + b.clientY) / 2;
      const { x, y } = viewCenter();
      const next = panAfterZoom(touches.zoom, touches.zoom * scale, touches.panX, touches.panY, x, y);
      useAppStore.getState().setCamera(next.zoom, next.panX + (midX - touches.midX), next.panY + (midY - touches.midY));
    }

    function onTouchEnd(event: TouchEvent) {
      if (event.touches.length < 2) touches = null;
    }

    const wheelOpts: AddEventListenerOptions = { capture: true, passive: false };
    const gestureOpts: AddEventListenerOptions = { capture: true, passive: false };
    window.addEventListener("wheel", onWheel, wheelOpts);
    window.addEventListener("gesturestart", onGestureStart, gestureOpts);
    window.addEventListener("gesturechange", onGestureChange, gestureOpts);
    window.addEventListener("gestureend", onGestureEnd, gestureOpts);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("wheel", onWheel, wheelOpts);
      window.removeEventListener("gesturestart", onGestureStart, gestureOpts);
      window.removeEventListener("gesturechange", onGestureChange, gestureOpts);
      window.removeEventListener("gestureend", onGestureEnd, gestureOpts);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-0 w-full flex-1 overflow-hidden bg-[#ded8cc] touch-none overscroll-none outline-none"
      tabIndex={0}
      onPointerDownCapture={(event) => {
        if (event.button !== 0) return;
        syncHover(event.clientX, event.clientY);
        const onEditor = event.target instanceof HTMLElement && event.target.closest("[data-text-editor]") != null;
        if (onEditor) return;
        focusCanvas();
        if (editingTextId) stopTextEdit();
        if (placing) return;
        if (!sampling && pointerOnTransformerHandle(event.clientX, event.clientY)) return;
        if (!sampling && tool === "select" && !hoverIdAt(event.clientX, event.clientY)) {
          const local = pointerLocal(event.clientX, event.clientY);
          if (!local) return;
          marqueeRef.current = {
            x0: local.x,
            y0: local.y,
            additive: Boolean(event.shiftKey || event.metaKey || event.ctrlKey),
            pointerId: event.pointerId,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
          return;
        }
        selectAt(event.clientX, event.clientY, event);
      }}
      onPointerDown={(event) => {
        focusCanvas();
        syncHover(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        const start = marqueeRef.current;
        if (start) {
          const local = pointerLocal(event.clientX, event.clientY);
          if (!local) return;
          const x = Math.min(start.x0, local.x);
          const y = Math.min(start.y0, local.y);
          setMarqueeBox({
            x,
            y,
            width: Math.abs(local.x - start.x0),
            height: Math.abs(local.y - start.y0),
          });
          return;
        }
        syncHover(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (marqueeRef.current) finishMarquee(event.clientX, event.clientY);
      }}
      onPointerCancel={() => {
        marqueeRef.current = null;
        setMarqueeBox(null);
      }}
      onPointerLeave={() => {
        if (!marqueeRef.current) setHoveredId(null);
      }}
      onContextMenu={(event) => event.preventDefault()}
      style={{
        cursor: placing || marqueeBox ? "crosshair" : sampling ? "copy" : "default",
      }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={(event) => {
          if (placing) return;
          focusCanvas();
        }}
        onContextMenu={(event) => {
          event.evt.preventDefault();
          if (placing || sampling) return;
          focusCanvas();
          openMenu(event.evt.clientX, event.evt.clientY);
        }}
      >
        <Layer>
          <Rect name="backdrop" width={stageSize.width} height={stageSize.height} fill="#ded8cc" />
          <Rect
            name="paper"
            x={paperX}
            y={paperY}
            width={paper.width}
            height={paper.height}
            fill="#ffffff"
            shadowColor="rgba(18,38,58,0.18)"
            shadowBlur={18}
            shadowOffsetY={6}
          />
        </Layer>
        <Layer
          x={paperX}
          y={paperY}
          clipX={0}
          clipY={0}
          clipWidth={paper.width}
          clipHeight={paper.height}
          listening={!placing}
        >
          <Rect
            name="paper-hit"
            width={paper.width}
            height={paper.height}
            fill="rgba(255,255,255,0.001)"
          />
          {fontTick > 0 &&
            doc.elements.filter((element) => !element.hidden).map((element) => (
              <CanvasElement
              key={`${element.id}-${fontTick}`}
              element={element}
              zoom={zoom}
              value={designerResolveValue(element, previewRow, mapping, doc.dataColumns)}
              interactive={!readOnly && !placing && !element.locked}
              sampling={sampling}
              onSelect={(event) => {
                event.cancelBubble = true;
                focusCanvas();
              }}
              onClick={(event) => {
                const pt = lastClientRef.current;
                const id = pt ? hoverIdAt(pt.x, pt.y) : null;
                if (!id || pendingSingleRef.current !== id) return;
                pendingSingleRef.current = null;
                onSelect([id]);
              }}
              onContextMenu={(event) => {
                event.cancelBubble = true;
                event.evt.preventDefault();
                focusCanvas();
                const pt = lastClientRef.current;
                const id = (pt ? hoverIdAt(pt.x, pt.y) : null) ?? hoverIdAt(event.evt.clientX, event.evt.clientY);
                if (id && !selectedIds.includes(id)) onSelect([id]);
                openMenu(event.evt.clientX, event.evt.clientY);
              }}
              editing={editingTextId === element.id}
              groupTransform={selectedIds.length > 1}
              onEditText={(event) => {
                const pt = lastClientRef.current;
                const evt = event.evt;
                const fallbackX = "clientX" in evt ? evt.clientX : evt.changedTouches[0]?.clientX;
                const fallbackY = "clientY" in evt ? evt.clientY : evt.changedTouches[0]?.clientY;
                const id =
                  (pt ? hoverIdAt(pt.x, pt.y) : null) ??
                  (fallbackX != null && fallbackY != null ? hoverIdAt(fallbackX, fallbackY) : null);
                const target = doc.elements.find((item) => item.id === id);
                if (target?.type === "text" && !target.locked) startTextEdit(target.id, true);
              }}
              onDragStart={(event) => {
                const pt = lastClientRef.current;
                const picked = pt ? hoverIdAt(pt.x, pt.y) : hoverIdAt(event.evt.clientX, event.evt.clientY);
                if (picked && picked !== element.id) {
                  ignoreDragEndRef.current = element.id;
                  event.target.stopDrag();
                  event.target.position({ x: mmToPx(element.x, zoom), y: mmToPx(element.y, zoom) });
                  onSelect([picked]);
                  stageRef.current?.findOne(`#el-${picked}`)?.startDrag(event);
                  return;
                }
                pendingSingleRef.current = null;
                const node = event.target;
                const ids = selectedIds.includes(element.id) ? selectedIds : [element.id];
                dragGroupRef.current = ids.map((id) => {
                  const item = id === element.id ? node : stageRef.current?.findOne(`#el-${id}`);
                  return { id, x0: item?.x() ?? 0, y0: item?.y() ?? 0 };
                });
              }}
              onDragMove={(event) => {
                draggingRef.current = true;
                const node = event.target;
                const group = dragGroupRef.current;
                const skip = group && group.length > 1 ? group.map((item) => item.id) : [];
                const step = event.evt.shiftKey ? 1 : 0.1;
                let x = pxToMm(node.x(), zoom);
                let y = pxToMm(node.y(), zoom);
                let marks: GuideMark[] | null = null;
                if (!event.evt.shiftKey) {
                  const result = guidesFor(element, x, y, Math.max(0.8, pxToMm(8, zoom)), skip);
                  x = result.x;
                  y = result.y;
                  marks = result.marks;
                }
                x = roundMm(x, step);
                y = roundMm(y, step);
                node.position({ x: mmToPx(x, zoom), y: mmToPx(y, zoom) });
                const primary = group?.find((item) => item.id === element.id);
                if (primary && group && group.length > 1) {
                  const dx = node.x() - primary.x0;
                  const dy = node.y() - primary.y0;
                  for (const item of group) {
                    if (item.id === element.id) continue;
                    stageRef.current?.findOne(`#el-${item.id}`)?.position({ x: item.x0 + dx, y: item.y0 + dy });
                  }
                }
                setLiveGuides(marks);
              }}
              onDragEnd={(event) => {
                draggingRef.current = false;
                setLiveGuides(null);
                if (ignoreDragEndRef.current === element.id) {
                  ignoreDragEndRef.current = null;
                  event.target.position({ x: mmToPx(element.x, zoom), y: mmToPx(element.y, zoom) });
                  return;
                }
                const group = dragGroupRef.current;
                dragGroupRef.current = null;
                const step = event.evt.shiftKey ? 1 : 0.1;
                if (group && group.length > 1) {
                  useAppStore.getState().updateElements(
                    group.map((item) => {
                      const node = item.id === element.id ? event.target : stageRef.current?.findOne(`#el-${item.id}`);
                      return {
                        id: item.id,
                        patch: {
                          x: roundMm(pxToMm(node?.x() ?? item.x0, zoom), step),
                          y: roundMm(pxToMm(node?.y() ?? item.y0, zoom), step),
                        },
                      };
                    }),
                  );
                  return;
                }
                onUpdate(element.id, {
                  x: roundMm(pxToMm(event.target.x(), zoom), step),
                  y: roundMm(pxToMm(event.target.y(), zoom), step),
                });
              }}
            />
          ))}
        </Layer>
        {placing || sampling ? null : (
          <Layer listening={!altMeasuring}>
            <Transformer
              ref={transformerRef}
              visible={!editingTextId}
              listening={!altMeasuring && !editingTextId && !selectedLocked}
              resizeEnabled={!selectedLocked}
              anchorSize={10}
              anchorStrokeWidth={1}
              rotateEnabled={!selectedLocked && selectedIds.length === 1}
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              rotationSnapTolerance={8}
              keepRatio={selectedIds.length === 1 && selectedElement?.type === "qr"}
              enabledAnchors={
                selectedLocked
                  ? []
                  : selectedIds.length > 1
                  ? SHAPE_ANCHORS
                  : selectedElement?.type === "line"
                  ? selectedLineHorizontal
                    ? ["middle-left", "middle-right"]
                    : ["top-center", "bottom-center"]
                  : selectedElement?.type === "qr"
                  ? ["top-left", "top-right", "bottom-right", "bottom-left"]
                  : SHAPE_ANCHORS
              }
              boundBoxFunc={(oldBox, newBox) => {
                if (selectedIds.length > 1) {
                  if (newBox.width < 8 || newBox.height < 8) return oldBox;
                  return newBox;
                }
                if (selectedElement?.type === "qr") {
                  const minPx = mmToPx(QR_MIN_SIDE_MM, zoom);
                  if (newBox.width < minPx || newBox.height < minPx) return oldBox;
                  return newBox;
                }
                if (selectedElement?.type === "barcode") {
                  if (
                    newBox.width < mmToPx(BARCODE_MIN_WIDTH_MM, zoom) ||
                    newBox.height < mmToPx(BARCODE_MIN_HEIGHT_MM, zoom)
                  ) {
                    return oldBox;
                  }
                }
                if (selectedElement?.type === "line" && Math.abs(selectedElement.rotation) < 0.5) {
                  if (selectedLineHorizontal) {
                    newBox.height = oldBox.height;
                    newBox.y = oldBox.y;
                    if (newBox.width < 8) return oldBox;
                  } else {
                    newBox.width = oldBox.width;
                    newBox.x = oldBox.x;
                    if (newBox.height < 8) return oldBox;
                  }
                } else if (newBox.width < 8 || newBox.height < 8) {
                  return oldBox;
                }
                if (!selectedElement || Math.abs(selectedElement.rotation) > 0.5) return newBox;
                const threshold = Math.max(0.8, pxToMm(8, zoom));
                const box = {
                  id: selectedElement.id,
                  x: pxToMm(newBox.x - paperX, zoom),
                  y: pxToMm(newBox.y - paperY, zoom),
                  w: pxToMm(newBox.width, zoom),
                  h: pxToMm(newBox.height, zoom),
                };
                const snapped = computeResizeGuides(
                  box,
                  neighborBoxes(selectedElement.id),
                  { width: doc.page.widthMm, height: doc.page.heightMm },
                  threshold,
                  {
                    left: Math.abs(newBox.x - oldBox.x) > 0.5,
                    right: Math.abs(newBox.x + newBox.width - (oldBox.x + oldBox.width)) > 0.5,
                    top: Math.abs(newBox.y - oldBox.y) > 0.5,
                    bottom: Math.abs(newBox.y + newBox.height - (oldBox.y + oldBox.height)) > 0.5,
                  },
                );
                return {
                  ...newBox,
                  x: mmToPx(snapped.box.x, zoom) + paperX,
                  y: mmToPx(snapped.box.y, zoom) + paperY,
                  width: mmToPx(snapped.box.w, zoom),
                  height: mmToPx(snapped.box.h, zoom),
                };
              }}
              onTransform={() => {
                if (selectedIds.length > 1) return;
                const node = transformerRef.current?.nodes()[0];
                if (!node || !selectedElement) return;
                draggingRef.current = true;
                const box = transformedBoxMm(node, zoom);
                setLiveGuides(
                  spacingMarks(
                    { id: selectedElement.id, x: box.x, y: box.y, w: box.w, h: box.h },
                    neighborBoxes(selectedElement.id),
                    { width: doc.page.widthMm, height: doc.page.heightMm },
                  ),
                );
              }}
              onTransformEnd={() => {
                draggingRef.current = false;
                setLiveGuides(null);
                const nodes = transformerRef.current?.nodes() ?? [];
                if (!nodes.length) return;
                const updates = nodes.flatMap((node) => {
                  const id = node.id().startsWith("el-") ? node.id().slice(3) : node.id();
                  const item = doc.elements.find((el) => el.id === id);
                  if (!item) return [];
                  const next = commitElementTransform(node, zoom);
                  const patch =
                    item.type === "line"
                      ? isHorizontalLine(next.width, next.height)
                        ? { ...next, height: LINE_HIT_MM }
                        : { ...next, width: LINE_HIT_MM }
                      : next;
                  return [{ id, patch }];
                });
                if (updates.length) useAppStore.getState().updateElements(updates);
              }}
            />
          </Layer>
        )}
        {guides.length && !sampling ? (
          <Layer x={paperX} y={paperY} listening={false}>
            <SpacingGuides marks={guides} zoom={zoom} />
          </Layer>
        ) : null}
      </Stage>
      {marqueeBox && (marqueeBox.width > 2 || marqueeBox.height > 2) ? (
        <div
          className="pointer-events-none absolute z-10 border border-[#0d99ff] bg-[#0d99ff]/15"
          style={{
            left: marqueeBox.x,
            top: marqueeBox.y,
            width: Math.max(marqueeBox.width, 1),
            height: Math.max(marqueeBox.height, 1),
          }}
        />
      ) : null}
      {sampling ? (
        <div
          className="absolute inset-0 z-20 cursor-copy"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            const color = samplePixelAt(event.clientX, event.clientY);
            if (color) applySampledColor(color);
          }}
        />
      ) : null}
      {placing ? (
        <div
          className="absolute inset-0 z-10 cursor-crosshair"
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            const point = pointerOnPaper(event.clientX, event.clientY);
            if (!point) return;
            const onPaper =
              point.xMm >= -2 &&
              point.yMm >= -2 &&
              point.xMm <= doc.page.widthMm + 2 &&
              point.yMm <= doc.page.heightMm + 2;
            if (!onPaper) return;
            event.preventDefault();
            dragRef.current = { x0: point.xMm, y0: point.yMm, shift: event.shiftKey };
            setDraft({
              x: point.xPx,
              y: point.yPx,
              width: tool === "line" ? 1 : 0,
              height: tool === "line" ? 2 : 0,
              kind: tool === "line" ? "line" : "box",
            });
          }}
          onMouseMove={(event) => {
            const start = dragRef.current;
            const point = pointerOnPaper(event.clientX, event.clientY);
            const bounds = containerRef.current?.getBoundingClientRect();
            if (!point || !bounds) return;
            if (!start) {
              if (tool !== "line") {
                setDraft(null);
                return;
              }
              const length = mmToPx(defaultSizeForType("line").width, zoom);
              const thick = 2;
              const vertical = event.shiftKey;
              setDraft({
                x: vertical ? point.xPx - thick / 2 : point.xPx - length / 2,
                y: vertical ? point.yPx - length / 2 : point.yPx - thick / 2,
                width: vertical ? thick : length,
                height: vertical ? length : thick,
                kind: "line",
              });
              return;
            }
            const x0 = mmToPx(start.x0, zoom) + paperX;
            const y0 = mmToPx(start.y0, zoom) + paperY;
            let width = point.xPx - x0;
            let height = point.yPx - y0;
            if (tool === "line") {
              const thick = 2;
              const horizontal = Math.abs(width) >= Math.abs(height);
              setDraft(
                horizontal
                  ? {
                      x: width < 0 ? x0 + width : x0,
                      y: y0 - thick / 2,
                      width: Math.max(Math.abs(width), 1),
                      height: thick,
                      kind: "line",
                    }
                  : {
                      x: x0 - thick / 2,
                      y: height < 0 ? y0 + height : y0,
                      width: thick,
                      height: Math.max(Math.abs(height), 1),
                      kind: "line",
                    },
              );
              return;
            }
            if (tool === "qr" || (event.shiftKey && tool !== "line")) {
              const side = Math.max(Math.abs(width), Math.abs(height));
              width = Math.sign(width || 1) * side;
              height = Math.sign(height || 1) * side;
            }
            setDraft({
              x: width < 0 ? x0 + width : x0,
              y: height < 0 ? y0 + height : y0,
              width: Math.abs(width),
              height: Math.abs(height),
              kind: "box",
            });
          }}
          onMouseUp={(event) => {
            if (!dragRef.current) return;
            const point = pointerOnPaper(event.clientX, event.clientY);
            if (!point) {
              dragRef.current = null;
              setDraft(null);
              return;
            }
            commitDraw(point.xMm, point.yMm, event.shiftKey || dragRef.current.shift);
          }}
          onMouseLeave={(event) => {
            if (!dragRef.current) {
              setDraft(null);
              return;
            }
            if (event.buttons === 0) {
              const point = pointerOnPaper(event.clientX, event.clientY);
              if (point) commitDraw(point.xMm, point.yMm, event.shiftKey || dragRef.current.shift);
              else {
                dragRef.current = null;
                setDraft(null);
              }
            }
          }}
        >
          {draft ? (
            <div
              className={
                draft.kind === "line"
                  ? "pointer-events-none absolute rounded-full bg-[#0d99ff]"
                  : "pointer-events-none absolute border border-[#0d99ff] bg-[#0d99ff]/15"
              }
              style={{
                left: draft.x,
                top: draft.y,
                width: Math.max(draft.width, 1),
                height: Math.max(draft.height, 1),
              }}
            />
          ) : null}
        </div>
      ) : null}
      {editingElement ? (
        <TextEditorOverlay
          element={editingElement}
          zoom={zoom}
          paperX={paperX}
          paperY={paperY}
          selectAll={selectAllOnEdit}
          onChange={(patch) => {
            const next: Partial<typeof editingElement> = { ...patch };
            if (releasePartSplit(patch.content)) {
              if (editingElement.partIndex != null) next.partIndex = undefined;
              if (editingElement.transform === "part") next.transform = undefined;
            }
            onUpdate(editingElement.id, next);
          }}
          onClose={stopTextEdit}
        />
      ) : null}
      {menu
        ? createPortal(
            <CanvasContextMenu
              x={menu.x}
              y={menu.y}
              canCopy={selectedIds.length > 0}
              canPaste={clipboard.length > 0}
              canGroup={groupFlags.canGroup}
              canUngroup={groupFlags.canUngroup}
              onCopy={() => {
                const payload = useAppStore.getState().copySelected();
                const count = useAppStore.getState().clipboard.length;
                if (payload) toast.success(`Copied ${count} layer${count === 1 ? "" : "s"}`);
                setMenu(null);
              }}
              onPaste={() => {
                if (useAppStore.getState().pasteClipboard()) toast.success("Pasted");
                setMenu(null);
              }}
              onPasteInPlace={() => {
                if (useAppStore.getState().pasteClipboard(undefined, { inPlace: true })) {
                  toast.success("Pasted in place");
                }
                setMenu(null);
              }}
              onDuplicate={() => {
                useAppStore.getState().duplicateSelected();
                setMenu(null);
              }}
              onGroup={() => {
                useAppStore.getState().groupSelected();
                setMenu(null);
              }}
              onUngroup={() => {
                useAppStore.getState().ungroupSelected();
                setMenu(null);
              }}
              onDelete={() => {
                useAppStore.getState().deleteSelected();
                setMenu(null);
              }}
              onClose={() => setMenu(null)}
            />,
            document.body,
          )
        : null}
    </div>
  );
}
