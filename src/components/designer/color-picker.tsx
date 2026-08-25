"use client";

import { documentColors, hexToHsv, hsvToHex, normalizeHex, type Hsv } from "@/lib/color";
import type { LabelElement } from "@/lib/document";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/hint";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function hueBackground(h: number) {
  return `hsl(${h}, 100%, 50%)`;
}

export function ColorSwatchGrid({
  colors,
  current,
  onPick,
  onRemove,
}: {
  colors: string[];
  current: string;
  onPick: (hex: string) => void;
  onRemove?: (hex: string) => void;
}) {
  if (!colors.length) return null;
  return (
    <div className="grid grid-cols-8 gap-1">
      {colors.map((hex) => {
        const active = hex === current;
        return (
          <div key={hex} className="relative">
            <button
              type="button"
              title={hex}
              className={cn(
                "block size-5 rounded-[4px] border border-black/20",
                active && "ring-1 ring-primary ring-offset-1 ring-offset-popover",
              )}
              style={{ backgroundColor: hex }}
              onClick={() => onPick(hex)}
            />
            {onRemove ? (
              <button
                type="button"
                title="Remove saved color"
                className="absolute -top-1 -right-1 hidden size-3 items-center justify-center rounded-full bg-foreground text-background group-hover:flex hover:flex"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRemove(hex);
                }}
              >
                <X className="size-2" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function ColorPickerPopover({
  value,
  onChange,
  elements,
  onClose,
  style,
}: {
  value: string;
  onChange: (hex: string) => void;
  elements: LabelElement[];
  onClose: () => void;
  style: { top: number; left: number; width: number };
}) {
  const savedColors = useAppStore((s) => s.savedColors);
  const saveColor = useAppStore((s) => s.saveColor);
  const removeSavedColor = useAppStore((s) => s.removeSavedColor);
  const panelRef = useRef<HTMLDivElement>(null);
  const hsv = hexToHsv(value);
  const [local, setLocal] = useState<Hsv>(hsv);
  const squareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocal(hexToHsv(value));
  }, [value]);

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function commit(next: Hsv) {
    setLocal(next);
    onChange(hsvToHex(next));
  }

  function pickFromSquare(event: React.PointerEvent) {
    const node = squareRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const v = Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height));
    commit({ ...local, s, v });
  }

  const current = normalizeHex(value) ?? hsvToHex(local);
  const documentSwatches = documentColors(elements).filter((hex) => !savedColors.includes(hex));
  const saved = current && !savedColors.includes(current);

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-[220px] rounded-lg border border-border bg-popover p-2.5 shadow-lg"
      style={{ top: style.top, left: style.left, width: style.width }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        ref={squareRef}
        className="relative h-28 w-full cursor-crosshair overflow-hidden rounded-md"
        style={{ backgroundColor: hueBackground(local.h) }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pickFromSquare(event);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          pickFromSquare(event);
        }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to right, #fff, transparent)" }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to top, #000, transparent)" }} />
        <div
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${local.s * 100}%`, top: `${(1 - local.v) * 100}%`, backgroundColor: current }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={360}
        value={Math.round(local.h)}
        aria-label="Hue"
        className="mt-2 h-3 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background:
            "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
        }}
        onChange={(event) => commit({ ...local, h: Number(event.target.value) })}
      />
      {documentSwatches.length ? (
        <div className="mt-2.5">
          <p className="mb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Document</p>
          <ColorSwatchGrid colors={documentSwatches} current={current} onPick={onChange} />
        </div>
      ) : null}
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Saved</p>
          <Hint label="Save current color">
            <button
              type="button"
              className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              disabled={!saved}
              onClick={() => saveColor(current)}
            >
              <Plus className="size-3.5" />
            </button>
          </Hint>
        </div>
        {savedColors.length ? (
          <div className="flex flex-wrap gap-1">
            {savedColors.map((hex) => {
              const active = hex === current;
              return (
                <div key={hex} className="group relative">
                  <button
                    type="button"
                    title={hex}
                    className={cn(
                      "block size-5 rounded-[4px] border border-black/20",
                      active && "ring-1 ring-primary ring-offset-1 ring-offset-popover",
                    )}
                    style={{ backgroundColor: hex }}
                    onClick={() => onChange(hex)}
                  />
                  <button
                    type="button"
                    title="Remove saved color"
                    className="absolute -top-1 -right-1 flex size-3 items-center justify-center rounded-full bg-foreground text-background opacity-0 group-hover:opacity-100"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      removeSavedColor(hex);
                    }}
                  >
                    <X className="size-2" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">Save colors you reuse across templates.</p>
        )}
      </div>
    </div>
  );
}

export function ColorSwatchButton({
  color,
  label,
  onOpen,
}: {
  color: string;
  label: string;
  onOpen: (rect: DOMRect) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <Hint label="Open color picker">
      <button
        ref={ref}
        type="button"
        className="relative block h-6 min-h-6 w-6 min-w-6 shrink-0 overflow-hidden rounded-[5px] border border-black/20"
        style={{ backgroundColor: color }}
        aria-label={`${label} color`}
        onClick={() => {
          const rect = ref.current?.getBoundingClientRect();
          if (rect) onOpen(rect);
        }}
      />
    </Hint>
  );
}
