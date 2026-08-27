"use client";

import { Input } from "@/components/ui/input";
import { pageSizeCaption, type LabelDocument } from "@/lib/document";
import { schemaColumns } from "@/lib/excel";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

const Thumb = dynamic(() => import("@/components/templates/template-thumbnail").then((mod) => mod.TemplateThumbnail), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#e8eaed]" />,
});

function matchesQuery(doc: LabelDocument, folderName: string | undefined, query: string) {
  if (!query) return true;
  const cols = schemaColumns(doc)
    .map((column) => `${column.label} ${column.key}`)
    .join(" ");
  const hay = [doc.name, doc.description ?? "", folderName ?? "", `${doc.page.widthMm} ${doc.page.heightMm}`, cols]
    .join(" ")
    .toLowerCase();
  return hay.includes(query);
}

export function PrintTemplateSelect({ current }: { current: LabelDocument }) {
  const documents = useAppStore((s) => s.documents);
  const folders = useAppStore((s) => s.folders);
  const openDocument = useAppStore((s) => s.openDocument);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [box, setBox] = useState({ top: 0, left: 0, width: 440, maxHeight: 420 });

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const folderName = (id?: string) => folders.find((folder) => folder.id === id)?.name;
    const known = new Set(folders.map((folder) => folder.id));
    const groups = folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      docs: documents.filter((item) => item.folderId === folder.id && matchesQuery(item, folder.name, q)),
    }));
    const unfiled = documents.filter(
      (item) => (!item.folderId || !known.has(item.folderId)) && matchesQuery(item, undefined, q),
    );
    if (unfiled.length) groups.push({ id: "unfiled", name: "Other", docs: unfiled });
    return groups.filter((group) => group.docs.length);
  }, [documents, folders, query]);

  const flat = useMemo(() => grouped.flatMap((group) => group.docs), [grouped]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const node = panelRef.current?.querySelector("[data-active='true']");
    if (node instanceof HTMLElement) node.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  useEffect(() => {
    if (!open) return;
    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 440), window.innerWidth - 16);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const top = rect.bottom + 6;
      const maxHeight = Math.max(220, window.innerHeight - top - 12);
      setBox({ top, left, width, maxHeight });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(id: string) {
    if (id !== current.id) openDocument(id);
    setOpen(false);
    setQuery("");
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((index) => Math.min(index + 1, Math.max(0, flat.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flat[highlight];
      if (item) pick(item.id);
    }
  }

  const currentFolder = folders.find((folder) => folder.id === current.folderId)?.name;
  const currentColumns = schemaColumns(current).length;

  return (
    <div className="relative min-w-0 flex-1">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-[#d0d7de] bg-white py-1 pr-8 pl-1.5 text-left text-sm outline-none hover:bg-[#f8f9fa] focus:border-[#1b4f9c] focus:ring-2 focus:ring-[#1b4f9c]/20"
        onClick={() => {
          setQuery("");
          setOpen((value) => !value);
        }}
      >
        <span className="h-6 w-9 shrink-0 overflow-hidden rounded-[3px] border border-[#d0d7de] bg-[#e8eaed]">
          <Thumb document={current} pad={2} background="#e8eaed" />
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{current.name}</span>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-[#5f6368]" />
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              className="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-[#d0d7de] bg-white shadow-lg"
              style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
            >
              <div className="shrink-0 border-b border-[#d0d7de] p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#80868b]" />
                  <Input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={onSearchKey}
                    placeholder="Search templates…"
                    className="h-8 bg-[#f8f9fa] pl-8"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
                {grouped.length ? (
                  grouped.map((group) => (
                    <div key={group.id} className="mb-1">
                      <div className="px-2 py-1 text-[10px] font-semibold tracking-wide text-[#80868b] uppercase">
                        {group.name}
                      </div>
                      {group.docs.map((item) => {
                        const index = flat.findIndex((doc) => doc.id === item.id);
                        const selected = item.id === current.id;
                        const active = index === highlight;
                        const columns = schemaColumns(item).length;
                        const folder = folders.find((entry) => entry.id === item.folderId)?.name;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            data-active={active || undefined}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left",
                              selected ? "bg-[#e8f0fe]" : active ? "bg-[#f1f3f4]" : "hover:bg-[#f8f9fa]",
                            )}
                            onMouseEnter={() => setHighlight(index)}
                            onClick={() => pick(item.id)}
                          >
                            <span className="h-[52px] w-[78px] shrink-0 overflow-hidden rounded border border-[#d0d7de] bg-[#e8eaed]">
                              <Thumb document={item} pad={5} background="#e8eaed" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-[13px] font-medium text-[#202124]">{item.name}</span>
                                {selected ? <Check className="size-3.5 shrink-0 text-[#1b4f9c]" /> : null}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-[#5f6368]">
                                {pageSizeCaption(item.page.widthMm, item.page.heightMm)}
                              </span>
                              <span className="block truncate text-[11px] text-[#80868b]">
                                {[
                                  folder,
                                  columns ? `${columns} column${columns === 1 ? "" : "s"}` : "No columns",
                                  item.description,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  <p className="px-3 py-6 text-center text-sm text-[#5f6368]">No matching templates.</p>
                )}
              </div>
              <div className="shrink-0 border-t border-[#d0d7de] px-3 py-1.5 text-[11px] text-[#80868b]">
                {current.name}
                {" · "}
                {pageSizeCaption(current.page.widthMm, current.page.heightMm)}
                {currentFolder ? ` · ${currentFolder}` : ""}
                {currentColumns ? ` · ${currentColumns} columns` : ""}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
