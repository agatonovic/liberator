"use client";

import { CanvasContextMenu } from "@/components/designer/canvas-context-menu";
import { Hint } from "@/components/hint";
import type { LabelElement } from "@/lib/document";
import { selectionGroupFlags } from "@/lib/document";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  ArrowRight,
  Barcode,
  ChevronDown,
  ChevronRight,
  Circle,
  Diamond,
  Eye,
  EyeOff,
  GripVertical,
  Group,
  Hexagon,
  ImageIcon,
  Lock,
  LockOpen,
  Minus,
  Plus,
  QrCode,
  Square,
  Star,
  Triangle,
  Type,
  Ungroup,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

const LABELS: Record<LabelElement["type"], string> = {
  rect: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  arrow: "Arrow",
  doubleArrow: "Double arrow",
  triangle: "Triangle",
  diamond: "Diamond",
  star: "Star",
  hexagon: "Hexagon",
  plus: "Plus",
  cross: "Cross",
  text: "Text",
  barcode: "Barcode",
  qr: "QR",
  image: "Image",
};

const ICONS: Record<LabelElement["type"], LucideIcon> = {
  rect: Square,
  ellipse: Circle,
  line: Minus,
  arrow: ArrowRight,
  doubleArrow: ArrowLeftRight,
  triangle: Triangle,
  diamond: Diamond,
  star: Star,
  hexagon: Hexagon,
  plus: Plus,
  cross: X,
  text: Type,
  barcode: Barcode,
  qr: QrCode,
  image: ImageIcon,
};

type TopRow =
  | { kind: "group"; groupId: string; members: LabelElement[] }
  | { kind: "layer"; element: LabelElement };

function layerCaption(element: LabelElement) {
  const text = element.content?.trim() || element.binding?.trim();
  return text || LABELS[element.type];
}

function idsBetween(ordered: LabelElement[], fromId: string, toId: string) {
  const start = ordered.findIndex((item) => item.id === fromId);
  const end = ordered.findIndex((item) => item.id === toId);
  if (start < 0 || end < 0) return [toId];
  const [lo, hi] = start < end ? [start, end] : [end, start];
  return ordered.slice(lo, hi + 1).map((item) => item.id);
}

function buildTopRows(frontToBack: LabelElement[]): TopRow[] {
  const seen = new Set<string>();
  const rows: TopRow[] = [];
  for (const el of frontToBack) {
    if (seen.has(el.id)) continue;
    if (el.groupId) {
      const members = frontToBack.filter((item) => item.groupId === el.groupId);
      members.forEach((item) => seen.add(item.id));
      rows.push({ kind: "group", groupId: el.groupId, members });
    } else {
      seen.add(el.id);
      rows.push({ kind: "layer", element: el });
    }
  }
  return rows;
}

function LayerToggle({
  title,
  active,
  onToggle,
  children,
}: {
  title: string;
  active: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Hint label={title}>
      <button
        type="button"
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded",
          active ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground",
        )}
        onPointerDown={(event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        {children}
      </button>
    </Hint>
  );
}

export function LayersPanel({
  elements,
  selectedIds,
  onSelect,
  onReorder,
  onChange,
}: {
  elements: LabelElement[];
  selectedIds: string[];
  onSelect: (ids: string[], mode?: "replace" | "toggle") => void;
  onReorder: (idsBackToFront: string[]) => void;
  onChange: (id: string, patch: Partial<LabelElement>) => void;
}) {
  const clipboard = useAppStore((s) => s.clipboard);
  const ordered = [...elements].reverse();
  const rows = useMemo(() => buildTopRows(ordered), [ordered]);
  const flags = selectionGroupFlags(elements, selectedIds);
  const listRef = useRef<HTMLUListElement>(null);
  const dragRef = useRef<{
    from: number;
    pointerId: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const rangeAnchorRef = useRef<string | null>(null);
  const [draggingFrom, setDraggingFrom] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  function insertIndexAt(clientY: number) {
    const list = listRef.current;
    if (!list) return rows.length;
    const targets = [...list.querySelectorAll<HTMLElement>("[data-row-index]")];
    for (let i = 0; i < targets.length; i += 1) {
      const rect = targets[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return rows.length;
  }

  function beginDrag(event: React.PointerEvent, from: number) {
    if (event.button !== 0) return;
    event.preventDefault();
    dragRef.current = {
      from,
      pointerId: event.pointerId,
      startY: event.clientY,
      active: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function finishDrag(event: React.PointerEvent) {
    const drag = dragRef.current;
    const over = dropIndexRef.current;
    dragRef.current = null;
    dropIndexRef.current = null;
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(drag.pointerId)) {
      event.currentTarget.releasePointerCapture(drag.pointerId);
    }
    setDraggingFrom(null);
    setDropIndex(null);
    if (!drag.active || over == null) return;
    if (over === drag.from || over === drag.from + 1) return;
    const next = [...rows];
    const [row] = next.splice(drag.from, 1);
    next.splice(over > drag.from ? over - 1 : over, 0, row);
    const frontToBack = next.flatMap((item) => (item.kind === "group" ? item.members.map((el) => el.id) : [item.element.id]));
    onReorder([...frontToBack].reverse());
  }

  function openMenu(event: React.MouseEvent, ids: string[]) {
    event.preventDefault();
    if (!ids.some((id) => selectedIds.includes(id))) {
      rangeAnchorRef.current = ids[0] ?? null;
      onSelect(ids);
    }
    setMenu({
      x: Math.min(event.clientX, window.innerWidth - 180),
      y: Math.min(event.clientY, window.innerHeight - 220),
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Layers</h3>
        <div className="flex items-center gap-0.5">
          <Hint label="Group">
            <button
              type="button"
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              disabled={!flags.canGroup}
              aria-label="Group"
              onClick={() => useAppStore.getState().groupSelected()}
            >
              <Group className="size-3.5" />
            </button>
          </Hint>
          <Hint label="Ungroup">
            <button
              type="button"
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              disabled={!flags.canUngroup}
              aria-label="Ungroup"
              onClick={() => useAppStore.getState().ungroupSelected()}
            >
              <Ungroup className="size-3.5" />
            </button>
          </Hint>
        </div>
      </div>
      {ordered.length ? (
        <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 select-none">
          {rows.map((row, index) => {
            const dragging = draggingFrom === index;
            if (row.kind === "group") {
              const memberIds = row.members.map((item) => item.id);
              const active = memberIds.every((id) => selectedIds.includes(id));
              const allHidden = row.members.every((item) => item.hidden);
              const allLocked = row.members.every((item) => item.locked);
              const isCollapsed = collapsed.has(row.groupId);
              return (
                <li key={row.groupId} className="relative">
                  {dropIndex === index && draggingFrom != null ? (
                    <div className="pointer-events-none absolute inset-x-2 top-0 z-10 h-0.5 rounded-full bg-[#0d99ff]" />
                  ) : null}
                  <div
                    data-row-index={index}
                    className={cn(
                      "flex w-full touch-none items-center gap-0.5 rounded-md px-1 py-1 text-xs",
                      active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                      dragging && "opacity-40",
                      allHidden && "opacity-50",
                    )}
                    onPointerDown={(event) => beginDrag(event, index)}
                    onPointerMove={(event) => {
                      const drag = dragRef.current;
                      if (!drag || drag.from !== index) return;
                      if (!drag.active && Math.abs(event.clientY - drag.startY) < 5) return;
                      drag.active = true;
                      const next = insertIndexAt(event.clientY);
                      dropIndexRef.current = next;
                      setDraggingFrom(drag.from);
                      setDropIndex(next);
                    }}
                    onPointerUp={(event) => {
                      const drag = dragRef.current;
                      const wasDrag = Boolean(drag?.active);
                      finishDrag(event);
                      if (!wasDrag) {
                        rangeAnchorRef.current = memberIds[0] ?? null;
                        onSelect(memberIds);
                      }
                    }}
                    onPointerCancel={finishDrag}
                    onContextMenu={(event) => openMenu(event, memberIds)}
                  >
                    <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/70 active:cursor-grabbing" />
                    <Hint label={isCollapsed ? "Expand group" : "Collapse group"}>
                      <button
                        type="button"
                        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setCollapsed((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.groupId)) next.delete(row.groupId);
                            else next.add(row.groupId);
                            return next;
                          });
                        }}
                      >
                        {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                    </Hint>
                    <Group className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate" title={`Group · ${row.members.length} layers`}>
                      Group · {row.members.length}
                    </span>
                    <LayerToggle
                      title={allHidden ? "Show group" : "Hide group"}
                      active={allHidden}
                      onToggle={() =>
                        useAppStore.getState().updateElements(
                          row.members.map((item) => ({ id: item.id, patch: { hidden: !allHidden } })),
                        )
                      }
                    >
                      {allHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </LayerToggle>
                    <LayerToggle
                      title={allLocked ? "Unlock group" : "Lock group"}
                      active={allLocked}
                      onToggle={() =>
                        useAppStore.getState().updateElements(
                          row.members.map((item) => ({ id: item.id, patch: { locked: !allLocked } })),
                        )
                      }
                    >
                      {allLocked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                    </LayerToggle>
                  </div>
                  {!isCollapsed
                    ? row.members.map((element) => {
                        const Icon = ICONS[element.type];
                        const childActive = selectedIds.includes(element.id);
                        return (
                          <div
                            key={element.id}
                            className={cn(
                              "ml-4 flex w-[calc(100%-1rem)] touch-none items-center gap-0.5 rounded-md px-1 py-1 text-xs",
                              childActive ? "bg-accent/70 text-accent-foreground" : "hover:bg-muted",
                              dragging && "opacity-40",
                              element.hidden && "opacity-50",
                            )}
                            onPointerDown={(event) => beginDrag(event, index)}
                            onPointerMove={(event) => {
                              const drag = dragRef.current;
                              if (!drag || drag.from !== index) return;
                              if (!drag.active && Math.abs(event.clientY - drag.startY) < 5) return;
                              drag.active = true;
                              const next = insertIndexAt(event.clientY);
                              dropIndexRef.current = next;
                              setDraggingFrom(drag.from);
                              setDropIndex(next);
                            }}
                            onPointerUp={(event) => {
                              const drag = dragRef.current;
                              const wasDrag = Boolean(drag?.active);
                              finishDrag(event);
                              if (!wasDrag) {
                                if (event.shiftKey) {
                                  const anchor =
                                    (rangeAnchorRef.current && ordered.some((item) => item.id === rangeAnchorRef.current)
                                      ? rangeAnchorRef.current
                                      : selectedIds[0]) ?? element.id;
                                  onSelect(idsBetween(ordered, anchor, element.id), "replace");
                                  return;
                                }
                                rangeAnchorRef.current = element.id;
                                onSelect([element.id], event.metaKey || event.ctrlKey ? "toggle" : "replace");
                              }
                            }}
                            onPointerCancel={finishDrag}
                            onContextMenu={(event) => openMenu(event, [element.id])}
                          >
                            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                            <span
                              className="min-w-0 flex-1 truncate"
                              title={`${LABELS[element.type]} · ${layerCaption(element)}`}
                            >
                              {layerCaption(element)}
                            </span>
                            <LayerToggle
                              title={element.hidden ? "Show layer" : "Hide layer"}
                              active={Boolean(element.hidden)}
                              onToggle={() => onChange(element.id, { hidden: !element.hidden })}
                            >
                              {element.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </LayerToggle>
                            <LayerToggle
                              title={element.locked ? "Unlock layer" : "Lock layer"}
                              active={Boolean(element.locked)}
                              onToggle={() => onChange(element.id, { locked: !element.locked })}
                            >
                              {element.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                            </LayerToggle>
                          </div>
                        );
                      })
                    : null}
                </li>
              );
            }

            const element = row.element;
            const active = selectedIds.includes(element.id);
            const Icon = ICONS[element.type];
            return (
              <li key={element.id} className="relative">
                {dropIndex === index && draggingFrom != null ? (
                  <div className="pointer-events-none absolute inset-x-2 top-0 z-10 h-0.5 rounded-full bg-[#0d99ff]" />
                ) : null}
                <div
                  data-row-index={index}
                  data-layer-id={element.id}
                  className={cn(
                    "flex w-full touch-none items-center gap-0.5 rounded-md px-1 py-1 text-xs",
                    active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                    dragging && "opacity-40",
                    element.hidden && "opacity-50",
                  )}
                  onPointerDown={(event) => beginDrag(event, index)}
                  onPointerMove={(event) => {
                    const drag = dragRef.current;
                    if (!drag || drag.from !== index) return;
                    if (!drag.active && Math.abs(event.clientY - drag.startY) < 5) return;
                    drag.active = true;
                    const next = insertIndexAt(event.clientY);
                    dropIndexRef.current = next;
                    setDraggingFrom(drag.from);
                    setDropIndex(next);
                  }}
                  onPointerUp={(event) => {
                    const drag = dragRef.current;
                    const wasDrag = Boolean(drag?.active);
                    finishDrag(event);
                    if (!wasDrag) {
                      if (event.shiftKey) {
                        const anchor =
                          (rangeAnchorRef.current && ordered.some((item) => item.id === rangeAnchorRef.current)
                            ? rangeAnchorRef.current
                            : selectedIds[0]) ?? element.id;
                        onSelect(idsBetween(ordered, anchor, element.id), "replace");
                        return;
                      }
                      rangeAnchorRef.current = element.id;
                      onSelect([element.id], event.metaKey || event.ctrlKey ? "toggle" : "replace");
                    }
                  }}
                  onPointerCancel={finishDrag}
                  onContextMenu={(event) => openMenu(event, [element.id])}
                >
                  <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/70 active:cursor-grabbing" />
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate" title={`${LABELS[element.type]} · ${layerCaption(element)}`}>
                    {layerCaption(element)}
                  </span>
                  <LayerToggle
                    title={element.hidden ? "Show layer" : "Hide layer"}
                    active={Boolean(element.hidden)}
                    onToggle={() => onChange(element.id, { hidden: !element.hidden })}
                  >
                    {element.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </LayerToggle>
                  <LayerToggle
                    title={element.locked ? "Unlock layer" : "Lock layer"}
                    active={Boolean(element.locked)}
                    onToggle={() => onChange(element.id, { locked: !element.locked })}
                  >
                    {element.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                  </LayerToggle>
                </div>
              </li>
            );
          })}
          {dropIndex === rows.length && draggingFrom != null ? (
            <li className="relative h-0">
              <div className="pointer-events-none absolute inset-x-2 top-0 z-10 h-0.5 rounded-full bg-[#0d99ff]" />
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="px-4 pb-3 text-xs text-muted-foreground">No objects yet.</p>
      )}
      {menu
        ? createPortal(
            <CanvasContextMenu
              x={menu.x}
              y={menu.y}
              canCopy={selectedIds.length > 0 || Boolean(menu)}
              canPaste={clipboard.length > 0}
              canGroup={flags.canGroup}
              canUngroup={flags.canUngroup}
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
