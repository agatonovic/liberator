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
import { PageSizeFields } from "@/components/page-size-fields";
import { Input } from "@/components/ui/input";
import { clampPageMm, pageSizeCaption, type LabelDocument } from "@/lib/document";
import { foldersInOrganization } from "@/lib/library";
import { visibleTemplates } from "@/lib/template-library";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Pencil, Ratio } from "lucide-react";
import { useMemo, useState } from "react";

export function TemplateNavigator({ document: doc }: { document: LabelDocument }) {
  const documentsAll = useAppStore((s) => s.documents);
  const foldersAll = useAppStore((s) => s.folders);
  const orgId = useAppStore((s) => s.currentOrganizationId);
  const role = useAppStore((s) => s.role());
  const openDocument = useAppStore((s) => s.openDocument);
  const renameDocument = useAppStore((s) => s.renameDocument);
  const setPageSize = useAppStore((s) => s.setPageSize);
  const [query, setQuery] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(doc.name);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [widthMm, setWidthMm] = useState(doc.page.widthMm);
  const [heightMm, setHeightMm] = useState(doc.page.heightMm);
  const documents = useMemo(() => visibleTemplates(documentsAll, role, orgId), [documentsAll, orgId, role]);
  const folders = useMemo(() => foldersInOrganization(foldersAll, orgId), [foldersAll, orgId]);

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
    setWidthMm(doc.page.widthMm);
    setHeightMm(doc.page.heightMm);
    setSizeOpen(true);
  }

  function applySize() {
    const w = clampPageMm(widthMm);
    const h = clampPageMm(heightMm);
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
            <span className="ml-auto text-[11px] text-muted-foreground">{pageSizeCaption(doc.page.widthMm, doc.page.heightMm)}</span>
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
            <DialogDescription>Choose a label or paper size, or type the exact millimetres.</DialogDescription>
          </DialogHeader>
          <PageSizeFields
            widthMm={widthMm}
            heightMm={heightMm}
            onChange={(nextWidth, nextHeight) => {
              setWidthMm(nextWidth);
              setHeightMm(nextHeight);
            }}
          />
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
