"use client";

import type { LabelElement, TextSpan } from "@/lib/document";
import { applyCharStyle, runsFromContent, runsToHtml, serializeRichText } from "@/lib/text-color";
import { canvasFontFamily } from "@/lib/fonts";
import { useAppStore } from "@/lib/store";
import { mmToPx, pxToMm } from "@/lib/units";
import { useEffect, useLayoutEffect, useRef } from "react";

type CharRange = { start: number; end: number };

function visibleTextLength(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== "\u200B") count += 1;
  }
  return count;
}

/** Offset within a text node, ignoring zero-width placeholders. */
function visibleOffsetInText(text: string, rawOffset: number): number {
  let visible = 0;
  const limit = Math.max(0, Math.min(text.length, rawOffset));
  for (let i = 0; i < limit; i += 1) {
    if (text[i] !== "\u200B") visible += 1;
  }
  return visible;
}

function nodeCharOffset(root: Node, target: Node, offset: number): number | null {
  if (!root.contains(target) && target !== root) return null;
  if (target.nodeType === Node.TEXT_NODE) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let count = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent ?? "";
      if (node === target) return count + visibleOffsetInText(text, offset);
      count += visibleTextLength(text);
    }
    return null;
  }
  if (target.nodeType === Node.ELEMENT_NODE) {
    let count = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (target.contains(node)) break;
      count += visibleTextLength(node.textContent ?? "");
    }
    const children = target.childNodes;
    for (let i = 0; i < Math.min(offset, children.length); i += 1) {
      count += textLength(children[i]!);
    }
    return count;
  }
  return null;
}

function textLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return visibleTextLength(node.textContent ?? "");
  if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "BR") return 1;
  let count = 0;
  for (const child of node.childNodes) count += textLength(child);
  return count;
}

function rangeToOffsets(root: HTMLElement, range: Range): CharRange | null {
  if (!root.contains(range.commonAncestorContainer) && range.commonAncestorContainer !== root) return null;
  const start = nodeCharOffset(root, range.startContainer, range.startOffset);
  const end = nodeCharOffset(root, range.endContainer, range.endOffset);
  if (start == null || end == null || end <= start) return null;
  return { start, end };
}

function offsetsToRange(root: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let visible = 0;
  let startNode: Text | null = null;
  let startOff = 0;
  let endNode: Text | null = null;
  let endOff = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    const raw = text.data;
    for (let i = 0; i < raw.length; i += 1) {
      if (raw[i] === "\u200B") continue;
      if (!startNode && visible === start) {
        startNode = text;
        startOff = i;
      }
      if (visible === end) {
        endNode = text;
        endOff = i;
        break;
      }
      visible += 1;
    }
    if (endNode) break;
    // Selection end can land exactly after the last visible char of this node.
    if (!endNode && visible === end) {
      endNode = text;
      endOff = raw.length;
      break;
    }
    if (!startNode && visible === start) {
      startNode = text;
      startOff = raw.length;
    }
  }
  if (!startNode) return null;
  if (!endNode) {
    endNode = startNode;
    endOff = startNode.length;
  }
  const range = document.createRange();
  range.setStart(startNode, Math.min(startOff, startNode.length));
  range.setEnd(endNode, Math.min(endOff, endNode.length));
  if (range.collapsed) return null;
  return range;
}

export function TextEditorOverlay({
  element,
  zoom,
  paperX,
  paperY,
  selectAll,
  onChange,
  onClose,
}: {
  element: LabelElement;
  zoom: number;
  paperX: number;
  paperY: number;
  selectAll: boolean;
  onChange: (patch: { content: string; spans: TextSpan[] }) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closed = useRef(false);
  const savedOffsets = useRef<CharRange | null>(null);
  const fromEditor = useRef(false);
  const textStyleRequest = useAppStore((s) => s.textStyleRequest);
  const setTextHasSelection = useAppStore((s) => s.setTextHasSelection);
  const setTextSelectionRange = useAppStore((s) => s.setTextSelectionRange);

  const width = Math.max(mmToPx(element.width, zoom), 8);
  const height = Math.max(mmToPx(element.height, zoom), 8);
  const fontSize = mmToPx(element.style.fontSizeMm ?? 4, zoom);
  const align = element.style.align ?? "left";
  const valign = element.style.verticalAlign ?? "middle";
  const letterSpacing = mmToPx(element.style.letterSpacingMm ?? 0, zoom);
  const lineHeight = element.style.lineHeight ?? 1;
  const fill = element.style.fill || "#12263A";
  const fontSizeMm = element.style.fontSizeMm ?? 4;
  const defaults = { fill, fontSizeMm };

  function inspectorFieldFocused() {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || el === ref.current) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function commitFromDom() {
    const node = ref.current;
    if (!node) return;
    fromEditor.current = true;
    onChange(serializeRichText(node, defaults, (px) => pxToMm(px, zoom)));
  }

  function captureSelection() {
    const node = ref.current;
    const sel = window.getSelection();
    if (!node || !sel || sel.rangeCount === 0 || !node.contains(sel.anchorNode) || sel.isCollapsed) return;
    const offsets = rangeToOffsets(node, sel.getRangeAt(0));
    if (!offsets) return;
    savedOffsets.current = offsets;
    setTextSelectionRange(offsets);
  }

  function clearSelectionIfCaret() {
    const node = ref.current;
    const sel = window.getSelection();
    if (!node || !sel || sel.rangeCount === 0) return;
    if (!node.contains(sel.anchorNode) || !sel.isCollapsed) return;
    savedOffsets.current = null;
    setTextSelectionRange(null);
  }

  function rangeForStyle() {
    const node = ref.current;
    if (!node) return null;
    if (savedOffsets.current) {
      const restored = offsetsToRange(node, savedOffsets.current.start, savedOffsets.current.end);
      if (restored) return restored;
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed && node.contains(sel.anchorNode)) {
      return sel.getRangeAt(0);
    }
    return null;
  }

  function applySelectionStyle(patch: { fill?: string; fontSizeMm?: number }) {
    const node = ref.current;
    if (!node) return;
    const range = rangeForStyle();
    const offsets = savedOffsets.current ?? (range ? rangeToOffsets(node, range) : null);
    if (!offsets) return;
    const live = serializeRichText(node, defaults, (px) => pxToMm(px, zoom));
    const next = applyCharStyle(live.content, live.spans, defaults, offsets.start, offsets.end, patch);
    fromEditor.current = true;
    onChange(next);
    node.innerHTML = runsToHtml(
      runsFromContent(next.content, defaults, next.spans),
      (sizeMm) => mmToPx(sizeMm, zoom),
      valign,
    );
    savedOffsets.current = offsets;
    setTextSelectionRange(offsets);
    const restored = offsetsToRange(node, offsets.start, offsets.end);
    if (!inspectorFieldFocused() && restored) {
      node.focus();
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(restored);
    }
  }

  function seedHtml() {
    const node = ref.current;
    if (!node) return;
    const runs = runsFromContent(element.content ?? "", defaults, element.spans);
    node.innerHTML = runsToHtml(runs, (sizeMm) => mmToPx(sizeMm, zoom), valign);
  }

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    seedHtml();
    node.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    if (!selectAll) range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
    captureSelection();
    // Only seed HTML when opening this layer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.id]);

  useLayoutEffect(() => {
    if (fromEditor.current) {
      fromEditor.current = false;
      return;
    }
    seedHtml();
    const node = ref.current;
    const saved = savedOffsets.current;
    if (node && saved && !inspectorFieldFocused()) {
      const range = offsetsToRange(node, saved.start, saved.end);
      if (range) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.content, element.spans, element.style.fontSizeMm, element.style.fill, element.style.verticalAlign]);

  useEffect(() => {
    function onSelectionChange() {
      captureSelection();
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  useEffect(() => {
    return () => {
      setTextHasSelection(false);
      setTextSelectionRange(null);
    };
  }, [setTextHasSelection, setTextSelectionRange]);

  useLayoutEffect(() => {
    if (!textStyleRequest) return;
    applySelectionStyle({
      fill: textStyleRequest.fill,
      fontSizeMm: textStyleRequest.fontSizeMm,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textStyleRequest]);

  function close() {
    if (closed.current) return;
    closed.current = true;
    commitFromDom();
    setTextHasSelection(false);
    setTextSelectionRange(null);
    onClose();
  }

  return (
    <div
      data-text-editor=""
      className="absolute z-20"
      style={{
        left: paperX + mmToPx(element.x, zoom),
        top: paperY + mmToPx(element.y, zoom),
        width,
        height,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
        transformOrigin: "top left",
        display: "flex",
        alignItems: valign === "top" ? "flex-start" : valign === "bottom" ? "flex-end" : "center",
        boxSizing: "border-box",
        outline: "1px solid #0d99ff",
        overflow: "visible",
        paddingTop: 0,
        paddingBottom: 0,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        spellCheck={false}
        onInput={commitFromDom}
        onPointerUp={() => {
          captureSelection();
          clearSelectionIfCaret();
        }}
        onKeyUp={() => {
          captureSelection();
          clearSelectionIfCaret();
        }}
        onBeforeInput={(event) => {
          if (inspectorFieldFocused()) event.preventDefault();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (inspectorFieldFocused()) {
            event.preventDefault();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            close();
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
        style={{
          width: "100%",
          height: "auto",
          maxHeight: "100%",
          margin: 0,
          padding: 0,
          color: fill,
          caretColor: fill,
          fontFamily: canvasFontFamily(element.style.fontFamily),
          fontSize,
          fontWeight: element.style.fontWeight === "bold" ? 700 : 400,
          lineHeight,
          letterSpacing,
          textAlign: align,
          outline: "none",
          overflow: "visible",
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
          wordBreak: "normal",
        }}
      />
    </div>
  );
}
