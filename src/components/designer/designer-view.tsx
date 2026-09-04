"use client";

import { Inspector } from "@/components/designer/inspector";
import { LayersPanel } from "@/components/designer/layers-panel";
import { TemplateNavigator } from "@/components/designer/template-navigator";
import { DesignerToolbar } from "@/components/designer/toolbar";
import { DesignerSaveControls } from "@/components/designer/version-history";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { orientLine, rotateAroundCenter, type ElementType } from "@/lib/document";
import { applyVersionSnapshot, versionLabel } from "@/lib/versions";
import { schemaColumns } from "@/lib/excel";
import { designerPreviewRow, identityMapping } from "@/lib/grid";
import { clipboardImageFiles, fileToImageDataUrl, placedImageBox } from "@/lib/image";
import { useAppStore } from "@/lib/store";
import { canEditTemplates } from "@/lib/roles";
import { toolFromShortcut } from "@/lib/tool-shortcuts";
import { pxToMm } from "@/lib/units";
import { Maximize2, Redo2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const Canvas = dynamic(
  () => import("@/components/designer/designer-canvas").then((mod) => mod.DesignerCanvas),
  { ssr: false, loading: () => <div className="flex-1 bg-[#ded8cc]" /> },
);

const SIDEBAR_WIDTH_KEY = "labelator.designerSidebarWidth";
const LAYERS_HEIGHT_KEY = "labelator.designerLayersHeight";
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 480;
const LAYERS_MIN = 120;
const INSPECTOR_MIN = 140;

function readStoredSize(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function DesignerView() {
  const hydrated = useAppStore((s) => s.hydrated);
  const documents = useAppStore((s) => s.documents);
  const currentId = useAppStore((s) => s.currentId);
  const role = useAppStore((s) => s.role());
  const router = useRouter();
  const selectedIds = useAppStore((s) => s.selectedIds);
  const tool = useAppStore((s) => s.tool);
  const zoom = useAppStore((s) => s.zoom);
  const past = useAppStore((s) => s.past);
  const future = useAppStore((s) => s.future);
  const doc = useMemo(
    () => documents.find((item) => item.id === currentId) ?? null,
    [documents, currentId],
  );
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const previewingRef = useRef(false);
  const selected = doc?.elements.find((el) => el.id === selectedIds[0]) ?? null;
  const selection = useMemo(
    () => (doc ? doc.elements.filter((el) => selectedIds.includes(el.id)) : []),
    [doc, selectedIds],
  );
  const previewVersion = doc?.versions?.find((item) => item.id === previewVersionId) ?? null;
  const previewing = Boolean(previewVersion);
  previewingRef.current = previewing;
  const viewDoc = useMemo(() => {
    if (!doc) return null;
    return previewVersion ? applyVersionSnapshot(doc, previewVersion.snapshot) : doc;
  }, [doc, previewVersion]);
  const sample = useMemo(() => (viewDoc ? designerPreviewRow(viewDoc) : null), [viewDoc]);
  const mapping = useMemo(() => (viewDoc ? identityMapping(schemaColumns(viewDoc)) : {}), [viewDoc]);
  const imageInput = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clamp(readStoredSize(SIDEBAR_WIDTH_KEY, 280), SIDEBAR_MIN, SIDEBAR_MAX),
  );
  const [layersHeight, setLayersHeight] = useState(() =>
    clamp(readStoredSize(LAYERS_HEIGHT_KEY, 220), LAYERS_MIN, 560),
  );

  const setTool = useAppStore((s) => s.setTool);
  const zoomAt = useAppStore((s) => s.zoomAt);
  const fitViewport = useAppStore((s) => s.fitViewport);
  const select = useAppStore((s) => s.select);
  const addElementAt = useAppStore((s) => s.addElementAt);
  const updateElement = useAppStore((s) => s.updateElement);
  const updateElements = useAppStore((s) => s.updateElements);
  const deleteSelected = useAppStore((s) => s.deleteSelected);
  const reorderElements = useAppStore((s) => s.reorderElements);
  const alignSelected = useAppStore((s) => s.alignSelected);
  const distributeSelected = useAppStore((s) => s.distributeSelected);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const nudgeSelected = useAppStore((s) => s.nudgeSelected);
  const saveNow = useAppStore((s) => s.saveNow);
  const saveVersion = useAppStore((s) => s.saveVersion);

  function viewportCenter() {
    const node = viewportRef.current;
    if (!node) return { x: 0, y: 0 };
    return { x: node.clientWidth / 2, y: node.clientHeight / 2 };
  }

  function paperPointAt(clientX?: number, clientY?: number) {
    const node = viewportRef.current;
    const state = useAppStore.getState();
    const current = state.current();
    if (!node || !current) return { x: 10, y: 10 };
    const bounds = node.getBoundingClientRect();
    const fallback = lastPointerRef.current;
    const px = (clientX ?? fallback?.x ?? bounds.left + bounds.width / 2) - bounds.left;
    const py = (clientY ?? fallback?.y ?? bounds.top + bounds.height / 2) - bounds.top;
    return {
      x: pxToMm(px - state.panX, state.zoom),
      y: pxToMm(py - state.panY, state.zoom),
    };
  }

  async function placeClipboardImages(files: File[], clientX?: number, clientY?: number) {
    const state = useAppStore.getState();
    const current = state.current();
    if (!current || previewingRef.current) return;
    const decoded: { dataUrl: string; width: number; height: number }[] = [];
    for (const file of files) {
      try {
        decoded.push(await fileToImageDataUrl(file));
      } catch {
        /* skip unreadable files */
      }
    }
    if (!decoded.length) {
      toast.error("Could not read that image");
      return;
    }
    const selectedImageIds = state.selectedIds.filter(
      (id) => current.elements.find((el) => el.id === id)?.type === "image",
    );
    if (decoded.length === 1 && selectedImageIds.length) {
      const { dataUrl } = decoded[0];
      const patches = selectedImageIds.map((id) => {
        const el = current.elements.find((item) => item.id === id);
        return { id, patch: { imageDataUrl: dataUrl, imageFit: el?.imageFit ?? "fit" } };
      });
      if (patches.length === 1) state.updateElement(patches[0].id, patches[0].patch);
      else state.updateElements(patches);
      toast.success(selectedImageIds.length === 1 ? "Image placed" : `Image applied to ${selectedImageIds.length} placeholders`);
      return;
    }
    const at = paperPointAt(clientX, clientY);
    const ids: string[] = [];
    decoded.forEach((item, index) => {
      const box = placedImageBox(
        { width: item.width || 400, height: item.height || 280 },
        current.page,
        { x: at.x + index * 4, y: at.y + index * 4 },
      );
      const id = state.addElementAt("image", box.x, box.y, {
        width: box.width,
        height: box.height,
        imageDataUrl: item.dataUrl,
        imageFit: "fit",
      });
      if (id) ids.push(id);
    });
    if (ids.length) state.select(ids);
    toast.success(ids.length === 1 ? "Pasted image" : `Pasted ${ids.length} images`);
  }

  const placeImagesRef = useRef(placeClipboardImages);
  placeImagesRef.current = placeClipboardImages;

  function fitToScreen() {
    const node = viewportRef.current;
    if (!node || !doc) return false;
    if (node.clientWidth < 32 || node.clientHeight < 32) return false;
    fitViewport(doc.page.widthMm, doc.page.heightMm, node.clientWidth, node.clientHeight);
    return true;
  }

  useEffect(() => {
    if (!doc) return;
    if (fitToScreen()) return;
    const node = viewportRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      if (fitToScreen()) observer.disconnect();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [doc?.id, doc?.page.widthMm, doc?.page.heightMm, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void useAppStore.getState().hydrate();
  }, [hydrated, doc?.id]);

  useEffect(() => {
    if (!hydrated || !doc) return;
    useAppStore.getState().markTemplateUsed(doc.id, "open");
  }, [hydrated, doc?.id]);

  useEffect(() => {
    setPreviewVersionId(null);
  }, [doc?.id]);

  useEffect(() => {
    if (!previewVersionId) return;
    if (!doc?.versions?.some((item) => item.id === previewVersionId)) setPreviewVersionId(null);
  }, [doc?.versions, previewVersionId]);

  useEffect(() => {
    const mods = { meta: false, ctrl: false, shift: false };
    let ignorePaste = false;
    let ignoreCopy = false;

    function typingInField(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    }

    function editingCanvasText() {
      if (useAppStore.getState().editingTextId) return true;
      const el = document.activeElement;
      return el instanceof HTMLElement && el.closest("[data-text-editor]") != null;
    }

    function textEditing(target: EventTarget | null) {
      return typingInField(target) || editingCanvasText();
    }

    function copyLayers() {
      const payload = useAppStore.getState().copySelected();
      const count = useAppStore.getState().clipboard.length;
      if (payload) toast.success(`Copied ${count} layer${count === 1 ? "" : "s"}`);
      return Boolean(payload);
    }

    function pasteLayers(inPlace = false) {
      if (useAppStore.getState().pasteClipboard(undefined, inPlace ? { inPlace: true } : undefined)) {
        toast.success(inPlace ? "Pasted in place" : "Pasted");
        return true;
      }
      toast.error("Nothing to paste — copy layers first");
      return false;
    }

    function suppressNativePaste() {
      ignorePaste = true;
      window.setTimeout(() => {
        ignorePaste = false;
      }, 200);
    }

    function rememberMods(event: KeyboardEvent) {
      mods.meta = event.metaKey;
      mods.ctrl = event.ctrlKey;
      mods.shift = event.shiftKey;
      if (event.code === "ShiftLeft" || event.code === "ShiftRight" || event.key === "Shift") {
        mods.shift = event.type === "keydown";
      }
    }

    function pasteInPlaceShortcut(event: KeyboardEvent) {
      const cmd = event.metaKey || event.ctrlKey;
      const v = event.code === "KeyV" || event.key.toLowerCase() === "v";
      return cmd && (mods.shift || event.shiftKey) && v && !event.altKey;
    }

    function onKey(event: KeyboardEvent) {
      rememberMods(event);
      const typing = typingInField(event.target);
      const cmd = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const code = event.code;

      if (previewingRef.current) {
        if (event.key === "Escape") {
          event.preventDefault();
          setPreviewVersionId(null);
          return;
        }
        if (!typing && cmd && (key === "z" || code === "KeyZ")) {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
          return;
        }
        if (!typing && !["Meta", "Control", "Alt", "Shift"].includes(event.key)) {
          event.preventDefault();
        }
        return;
      }

      if (!textEditing(event.target) && pasteInPlaceShortcut(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressNativePaste();
        pasteLayers(true);
        return;
      }
      if (!textEditing(event.target) && cmd && (key === "c" || code === "KeyC") && !event.shiftKey) {
        event.preventDefault();
        ignoreCopy = true;
        copyLayers();
        window.setTimeout(() => {
          ignoreCopy = false;
        }, 0);
        return;
      }
      if (!textEditing(event.target) && cmd && (key === "x" || code === "KeyX")) {
        event.preventDefault();
        useAppStore.getState().cutSelected();
        return;
      }
      if (!typing && cmd && (key === "z" || code === "KeyZ")) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (!typing && cmd && (key === "d" || code === "KeyD")) {
        event.preventDefault();
        useAppStore.getState().duplicateSelected();
        return;
      }
      if (!textEditing(event.target) && cmd && (key === "g" || code === "KeyG")) {
        event.preventDefault();
        if (event.shiftKey) useAppStore.getState().ungroupSelected();
        else useAppStore.getState().groupSelected();
        return;
      }
      if (!typing && cmd && (key === "s" || code === "KeyS")) {
        event.preventDefault();
        if (event.shiftKey) {
          if (useAppStore.getState().saveVersion()) toast.success("Version saved");
          return;
        }
        void saveNow();
        return;
      }
      if (!typing && event.ctrlKey && event.altKey && (key === "h" || code === "KeyH")) {
        event.preventDefault();
        useAppStore.getState().distributeSelected("horizontal");
        return;
      }
      if (!typing && event.ctrlKey && event.altKey && (key === "v" || code === "KeyV")) {
        event.preventDefault();
        useAppStore.getState().distributeSelected("vertical");
        return;
      }
      if (typing) return;
      const nextTool = toolFromShortcut(event);
      if (nextTool) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setTool(nextTool);
        return;
      }
      if (event.key === "Escape") {
        useAppStore.getState().cancelColorSample();
        setTool("select");
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      }
      const step = event.shiftKey ? 1 : 0.1;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeSelected(-step, 0);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nudgeSelected(step, 0);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        nudgeSelected(0, -step);
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        nudgeSelected(0, step);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      rememberMods(event);
    }

    function onCopy(event: ClipboardEvent) {
      if (textEditing(event.target)) return;
      if (ignoreCopy) {
        event.preventDefault();
        ignoreCopy = false;
        return;
      }
      const payload = useAppStore.getState().copySelected();
      if (!payload) return;
      event.preventDefault();
      event.clipboardData?.setData("text/plain", payload);
      const count = useAppStore.getState().clipboard.length;
      toast.success(`Copied ${count} layer${count === 1 ? "" : "s"}`);
    }

    function onPaste(event: ClipboardEvent) {
      if (textEditing(event.target)) return;
      if (ignorePaste) {
        event.preventDefault();
        return;
      }
      const images = clipboardImageFiles(event.clipboardData);
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const hasLayers = text.includes("labelator.elements");
      if (images.length && !hasLayers) {
        event.preventDefault();
        void placeImagesRef.current(images);
        return;
      }
      const inPlace = mods.shift && (mods.meta || mods.ctrl);
      if (!useAppStore.getState().pasteClipboard(text, { inPlace })) return;
      event.preventDefault();
      toast.success(inPlace ? "Pasted in place" : "Pasted");
    }

    function onCut(event: ClipboardEvent) {
      if (textEditing(event.target)) return;
      const payload = useAppStore.getState().copySelected();
      if (!payload) return;
      event.preventDefault();
      event.clipboardData?.setData("text/plain", payload);
      useAppStore.getState().deleteSelected();
    }

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("cut", onCut, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("cut", onCut, true);
    };
  }, [deleteSelected, nudgeSelected, redo, saveNow, saveVersion, setTool, undo]);

  if (!hydrated) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (role && !canEditTemplates(role)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">Operators can generate published labels, not edit templates.</p>
        <Button onClick={() => router.push("/generate")}>Go to Generate</Button>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Create a template to start designing.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2">
        <TemplateNavigator document={doc} />
        <div className="ml-auto flex items-center gap-1">
          <DesignerSaveControls
            doc={doc}
            canUndo={Boolean(past.length)}
            previewVersionId={previewVersionId}
            onPreviewVersion={setPreviewVersionId}
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <Hint label="Undo" shortcut="⌘Z">
            <Button variant="ghost" size="icon-sm" disabled={!past.length} onClick={undo}>
              <Undo2 className="size-4" />
            </Button>
          </Hint>
          <Hint label="Redo" shortcut="⇧⌘Z">
            <Button variant="ghost" size="icon-sm" disabled={!future.length} onClick={redo}>
              <Redo2 className="size-4" />
            </Button>
          </Hint>
          <Hint label="Zoom out">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                const { x, y } = viewportCenter();
                zoomAt(zoom / 1.15, x, y);
              }}
            >
              <ZoomOut className="size-4" />
            </Button>
          </Hint>
          <span className="w-12 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Hint label="Zoom in">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                const { x, y } = viewportCenter();
                zoomAt(zoom * 1.15, x, y);
              }}
            >
              <ZoomIn className="size-4" />
            </Button>
          </Hint>
          <Hint label="Fit to screen">
            <Button variant="ghost" size="icon-sm" onClick={fitToScreen}>
              <Maximize2 className="size-4" />
            </Button>
          </Hint>
          <Hint label="Actual size">
            <Button
              variant="ghost"
              size="sm"
              className="px-2 text-xs"
              onClick={() => {
                const { x, y } = viewportCenter();
                zoomAt(1, x, y);
              }}
            >
              100%
            </Button>
          </Hint>
        </div>
      </header>
      {previewVersion ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-[#c5d4ef] bg-[#e8f0fe] px-4 py-2">
          <p className="min-w-0 flex-1 text-sm text-[#1b4f9c]">
            Previewing {versionLabel(previewVersion)} — the live layout is unchanged until you restore.
          </p>
          <Button size="sm" variant="outline" onClick={() => setPreviewVersionId(null)}>
            Back to editing
          </Button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <DesignerToolbar tool={tool} onTool={setTool} />
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const state = useAppStore.getState();
            const current = state.current();
            const ids = state.selectedIds.filter((id) => current?.elements.find((el) => el.id === id)?.type === "image");
            if (!ids.length) return;
            void fileToImageDataUrl(file).then(({ dataUrl }) => {
              const latest = useAppStore.getState().current();
              const patches = ids.map((id) => {
                const el = latest?.elements.find((item) => item.id === id);
                return { id, patch: { imageDataUrl: dataUrl, imageFit: el?.imageFit ?? "fit" } };
              });
              if (patches.length === 1) updateElement(patches[0].id, patches[0].patch);
              else updateElements(patches);
            });
          }}
        />
        <div
          ref={viewportRef}
          className="relative flex min-h-0 min-w-0 flex-1 touch-none overscroll-none"
          onPointerMove={(event) => {
            lastPointerRef.current = { x: event.clientX, y: event.clientY };
          }}
          onDragOver={(event) => {
            if (![...event.dataTransfer.types].includes("Files")) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => {
            const files = clipboardImageFiles(event.dataTransfer);
            if (!files.length) return;
            event.preventDefault();
            void placeImagesRef.current(files, event.clientX, event.clientY);
          }}
        >
          <Canvas
            document={viewDoc ?? doc}
            zoom={zoom}
            selectedIds={previewing ? [] : selectedIds}
            tool={previewing ? "select" : tool}
            previewRow={sample}
            mapping={mapping}
            readOnly={previewing}
            onSelect={previewing ? () => {} : select}
            onAdd={(type: ElementType, x, y, extras) => (previewing ? null : addElementAt(type, x, y, extras))}
            onUpdate={(id, patch) => {
              if (!previewing) updateElement(id, patch);
            }}
            onPlaced={() => setTool("select")}
          />
        </div>
        <div
          ref={sidebarRef}
          className="relative flex min-h-0 shrink-0 flex-col border-l border-border bg-card"
          style={{ width: sidebarWidth }}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize inspector"
            title="Drag to resize"
            className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-ew-resize hover:bg-[#0d99ff]/40"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              const startX = event.clientX;
              const startWidth = sidebarWidth;
              const handle = event.currentTarget;
              let latest = startWidth;
              function onMove(moveEvent: PointerEvent) {
                latest = clamp(startWidth - (moveEvent.clientX - startX), SIDEBAR_MIN, SIDEBAR_MAX);
                setSidebarWidth(latest);
              }
              function onUp(upEvent: PointerEvent) {
                handle.removeEventListener("pointermove", onMove);
                handle.removeEventListener("pointerup", onUp);
                if (handle.hasPointerCapture(upEvent.pointerId)) handle.releasePointerCapture(upEvent.pointerId);
                window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(latest));
              }
              handle.addEventListener("pointermove", onMove);
              handle.addEventListener("pointerup", onUp);
            }}
          />
          {tool !== "select" ? (
            <p className="shrink-0 border-b border-border px-4 py-2 text-xs text-muted-foreground">
              Drag to draw, or click once for a default size. After placing, select is restored. Esc cancels.
              {tool === "line" ? " Drag horizontally or vertically." : ""}
              {tool === "image"
                ? " Places a placeholder — paste or drop a photo, or choose a file. Fit keeps proportions."
                : ""}
            </p>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <Inspector
                element={previewing ? null : selected}
                selection={previewing ? [] : selection}
                selectedCount={previewing ? 0 : selectedIds.length}
                onChange={(patch) => {
                  if (previewing) return;
                  if (selectedIds.length > 1) {
                    const current = useAppStore.getState().current();
                    if (current && patch.rotation != null && patch.x === undefined && patch.y === undefined) {
                      updateElements(
                        selectedIds.flatMap((id) => {
                          const el = current.elements.find((item) => item.id === id);
                          return el ? [{ id, patch: rotateAroundCenter(el, patch.rotation as number) }] : [];
                        }),
                      );
                      return;
                    }
                    updateElements(selectedIds.map((id) => ({ id, patch })));
                    return;
                  }
                  if (selected) updateElement(selected.id, patch);
                }}
                onDelete={deleteSelected}
                onAlign={alignSelected}
                onDistribute={distributeSelected}
                onPickImage={() => imageInput.current?.click()}
                onOrientLine={(orientation) => {
                  const current = useAppStore.getState().current();
                  if (!current) return;
                  const ids = selectedIds.length ? selectedIds : [];
                  updateElements(
                    ids.flatMap((id) => {
                      const el = current.elements.find((item) => item.id === id);
                      return el?.type === "line" ? [{ id, patch: orientLine(el, orientation) }] : [];
                    }),
                  );
                }}
              />
            </div>
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize layers"
              title="Drag to resize layers"
              className="flex h-2 shrink-0 cursor-ns-resize items-center justify-center border-y border-border hover:bg-[#0d99ff]/15"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                const sidebar = sidebarRef.current;
                const startY = event.clientY;
                const startHeight = layersHeight;
                const handle = event.currentTarget;
                let latest = startHeight;
                function onMove(moveEvent: PointerEvent) {
                  const max = Math.max(LAYERS_MIN, (sidebar?.clientHeight ?? 400) - INSPECTOR_MIN);
                  latest = clamp(startHeight - (moveEvent.clientY - startY), LAYERS_MIN, max);
                  setLayersHeight(latest);
                }
                function onUp(upEvent: PointerEvent) {
                  handle.removeEventListener("pointermove", onMove);
                  handle.removeEventListener("pointerup", onUp);
                  if (handle.hasPointerCapture(upEvent.pointerId)) handle.releasePointerCapture(upEvent.pointerId);
                  window.localStorage.setItem(LAYERS_HEIGHT_KEY, String(latest));
                }
                handle.addEventListener("pointermove", onMove);
                handle.addEventListener("pointerup", onUp);
              }}
            >
              <span className="h-0.5 w-8 rounded-full bg-border" />
            </div>
            <div className="flex min-h-0 shrink-0 flex-col overflow-hidden" style={{ height: layersHeight }}>
              <LayersPanel
                elements={(viewDoc ?? doc).elements}
                selectedIds={previewing ? [] : selectedIds}
                onSelect={(ids, mode) => {
                  if (!previewing) select(ids, mode);
                }}
                onReorder={(ids) => {
                  if (!previewing) reorderElements(ids);
                }}
                onChange={(id, patch) => {
                  if (!previewing) updateElement(id, patch);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
