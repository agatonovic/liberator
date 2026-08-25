"use client";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PAGE_PRESETS, type LabelDocument } from "@/lib/document";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Pencil, Ratio } from "lucide-react";
import { useMemo, useState } from "react";

function pageLabel(widthMm: number, heightMm: number) {
  const preset = PAGE_PRESETS.find(
    (item) =>
      item.id !== "custom" &&
      Math.abs(item.widthMm - widthMm) < 0.05 &&
      Math.abs(item.heightMm - heightMm) < 0.05,
  );
  return preset ? preset.label : `${widthMm} × ${heightMm} mm`;
}

export function TemplateNavigator({ document: doc }: { document: LabelDocument }) {
  const documents = useAppStore((s) => s.documents);
  const folders = useAppStore((s) => s.folders);
  const openDocument = useAppStore((s) => s.openDocument);
  const renameDocument = useAppStore((s) => s.renameDocument);
  const setPageSize = useAppStore((s) => s.setPageSize);
  const [query, setQuery] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(doc.name);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [presetId, setPresetId] = useState("custom");
  const [widthMm, setWidthMm] = useState(doc.page.widthMm);
  const [heightMm, setHeightMm] = useState(doc.page.heightMm);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (item: LabelDocument) => !q || item.name.toLowerCase().includes(q);
    const byFolder = folders.map((folder) => ({
      folder,
      docs: documents.filter((item) => item.folderId === folder.id && matches(item)),
    }));
    const known = new Set(folders.map((folder) => folder.id));
    const unfiled = documents.filter((item) => (!item.folderId || !known.has(item.folderId)) && matches(item));
    if (unfiled.length) {
      return [...byFolder, { folder: { id: "unfiled", name: "Other" }, docs: unfiled }];
    }
    return byFolder;
  }, [documents, folders, query]);

  function openRename() {
    setRenameValue(doc.name);
    setRenameOpen(true);
  }

  function openSize() {
    const match = PAGE_PRESETS.find(
      (preset) =>
        preset.id !== "custom" &&
        Math.abs(preset.widthMm - doc.page.widthMm) < 0.05 &&
        Math.abs(preset.heightMm - doc.page.heightMm) < 0.05,
    );
    setPresetId(match?.id ?? "custom");
    setWidthMm(doc.page.widthMm);
    setHeightMm(doc.page.heightMm);
    setSizeOpen(true);
  }

  function applySize() {
    const w = presetId === "custom" ? widthMm : (PAGE_PRESETS.find((item) => item.id === presetId)?.widthMm ?? widthMm);
    const h = presetId === "custom" ? heightMm : (PAGE_PRESETS.find((item) => item.id === presetId)?.heightMm ?? heightMm);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
    setPageSize(w, h);
    setSizeOpen(false);
  }

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) setQuery("");
        }}
      >
        <Hint label="Switch template">
          <DropdownMenuTrigger className="flex max-w-[280px] min-w-0 items-center gap-1 rounded-lg px-2 py-1 text-left hover:bg-muted">
            <span className="min-w-0 truncate text-sm font-medium">{doc.name}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent
          align="start"
          className="flex w-72 max-h-[min(28rem,var(--available-height,24rem))] flex-col overflow-hidden p-1"
        >
          <DropdownMenuItem onClick={openRename}>
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openSize}>
            <Ratio className="size-4" />
            Page size
            <span className="ml-auto text-[11px] text-muted-foreground">{pageLabel(doc.page.widthMm, doc.page.heightMm)}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-1.5 pb-1">
            <Input
              className="h-7"
              placeholder="Search templates…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            onWheel={(event) => event.stopPropagation()}
          >
            {grouped.some((group) => group.docs.length) ? (
              grouped.map(({ folder, docs }) =>
                docs.length ? (
                  <DropdownMenuGroup key={folder.id}>
                    <DropdownMenuLabel>{folder.name}</DropdownMenuLabel>
                    {docs.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        className="gap-2"
                        onClick={() => {
                          if (item.id !== doc.id) openDocument(item.id);
                        }}
                      >
                        <Check className={cn("size-4", item.id === doc.id ? "opacity-100" : "opacity-0")} />
                        <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                ) : null,
              )
            ) : (
              <p className="px-2 py-3 text-xs text-muted-foreground">No matching templates.</p>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename template</DialogTitle>
            <DialogDescription>This name appears in the template library and in this navigator.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                renameDocument(renameValue.trim() || doc.name);
                setRenameOpen(false);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                renameDocument(renameValue.trim() || doc.name);
                setRenameOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sizeOpen} onOpenChange={setSizeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Page size</DialogTitle>
            <DialogDescription>Choose a preset or enter a custom size in millimetres.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Preset
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                value={presetId}
                onChange={(event) => {
                  const id = event.target.value;
                  setPresetId(id);
                  const preset = PAGE_PRESETS.find((item) => item.id === id);
                  if (preset && preset.id !== "custom") {
                    setWidthMm(preset.widthMm);
                    setHeightMm(preset.heightMm);
                  }
                }}
              >
                {PAGE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-sm">
                Width (mm)
                <Input
                  type="number"
                  min={1}
                  step={0.1}
                  value={widthMm}
                  onChange={(event) => {
                    setPresetId("custom");
                    setWidthMm(Number(event.target.value));
                  }}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Height (mm)
                <Input
                  type="number"
                  min={1}
                  step={0.1}
                  value={heightMm}
                  onChange={(event) => {
                    setPresetId("custom");
                    setHeightMm(Number(event.target.value));
                  }}
                />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSizeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applySize}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
