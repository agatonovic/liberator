"use client";

import { Input } from "@/components/ui/input";
import { LABEL_FONTS, ensureGoogleFontsLoaded, resolveFontFamily } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function FontPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (family: string) => void;
}) {
  const family = resolveFontFamily(value);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240 });

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LABEL_FONTS;
    return LABEL_FONTS.filter((font) => font.name.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    void ensureGoogleFontsLoaded(matches.map((font) => font.name));
  }, [open, matches]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.max(rect.width, 240);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      const below = rect.bottom + 4;
      const height = 280;
      const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 4) : below;
      setPos({ top, left, width });
    }
    setQuery("");
    setOpen(true);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm"
      >
        <span className="min-w-0 truncate" style={{ fontFamily: `"${family}", sans-serif` }}>
          {family}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-50 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              <div className="border-b border-border p-1.5">
                <Input
                  autoFocus
                  value={query}
                  placeholder="Search fonts"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                />
              </div>
              <ul className="max-h-56 overflow-y-auto p-1">
                {matches.length ? (
                  matches.map((font) => {
                    const active = font.name === family;
                    return (
                      <li key={font.name}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                            active && "bg-accent",
                          )}
                          style={{
                            fontFamily: `"${font.name}", sans-serif`,
                            fontWeight: font.name.includes("Black") ? 800 : 400,
                          }}
                          onClick={() => {
                            onChange(font.name);
                            setOpen(false);
                          }}
                        >
                          <span className="truncate">{font.name}</span>
                          {active ? <Check className="size-3.5 shrink-0" /> : null}
                        </button>
                      </li>
                    );
                  })
                ) : (
                  <li className="px-2 py-3 text-center text-xs text-muted-foreground">No matching fonts</li>
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
