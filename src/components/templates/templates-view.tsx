"use client";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PAGE_PRESETS, type LabelDocument } from "@/lib/document";
import { MY_TEMPLATES_FOLDER_ID } from "@/lib/library";
import {
  TEMPLATE_SORTS,
  favoriteTemplates,
  folderNameFor,
  matchesTemplateQuery,
  recentTemplates,
  relativeUsed,
  sortTemplates,
  type TemplateSort,
} from "@/lib/template-library";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Copy,
  FileOutput,
  Folder,
  FolderPlus,
  MoreHorizontal,
  PenTool,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const TemplateThumbnail = dynamic(
  () => import("@/components/templates/template-thumbnail").then((mod) => mod.TemplateThumbnail),
  { ssr: false, loading: () => <div className="h-full w-full bg-[#ded8cc]" /> },
);

const DRAG_TYPE = "application/x-labelator-template";
const SORT_KEY = "labelator.templateSort";
const RECENT_COLLAPSED_KEY = "labelator.recentCollapsed";

function readSort(): TemplateSort {
  if (typeof window === "undefined") return "used";
  const value = window.localStorage.getItem(SORT_KEY);
  return TEMPLATE_SORTS.some((item) => item.id === value) ? (value as TemplateSort) : "used";
}

type TemplateCardProps = {
  doc: LabelDocument;
  folderId?: string;
  compact?: boolean;
  currentId: string | null;
  folders: { id: string; name: string }[];
  onGenerate: (id: string) => void;
  onEdit: (id: string) => void;
  onFavorite: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onMove: (id: string, folderId: string) => void;
  onDelete: (id: string) => void;
};

function TemplateCard({
  doc,
  folderId,
  compact = false,
  currentId,
  folders,
  onGenerate,
  onEdit,
  onFavorite,
  onDuplicate,
  onRename,
  onMove,
  onDelete,
}: TemplateCardProps) {
  const used = relativeUsed(doc.lastGeneratedAt || doc.lastUsedAt);
  return (
    <Card
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", doc.id);
        try {
          event.dataTransfer.setData(DRAG_TYPE, doc.id);
        } catch {
          /* some browsers only allow text/plain */
        }
      }}
      className={cn("pt-0", doc.id === currentId && "ring-2 ring-primary")}
    >
      <div className={cn("relative overflow-hidden rounded-t-xl bg-[#ded8cc]", compact ? "aspect-[16/9]" : "aspect-[16/10]")}>
        <TemplateThumbnail document={doc} />
        <Hint label={doc.favorite ? "Unfavorite" : "Favorite"} side="left">
          <button
            type="button"
            className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-full bg-white/90 text-muted-foreground shadow-sm hover:text-amber-500"
            onClick={() => onFavorite(doc.id)}
          >
            <Star className={cn("size-3.5", doc.favorite && "fill-amber-400 text-amber-500")} />
          </button>
        </Hint>
      </div>
      <CardHeader className={compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base">{doc.name}</CardTitle>
        <CardDescription>
          {compact
            ? used || `${doc.page.widthMm} × ${doc.page.heightMm} mm`
            : `${doc.page.widthMm} × ${doc.page.heightMm} mm${doc.description ? ` · ${doc.description}` : ""}${used ? ` · ${used}` : ""}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => onGenerate(doc.id)}>
          <FileOutput className="size-3.5" />
          Generate
        </Button>
        {compact ? null : (
          <Button size="sm" variant="outline" onClick={() => onEdit(doc.id)}>
            <PenTool className="size-3.5" />
            Edit
          </Button>
        )}
        <DropdownMenu>
          <Hint label="More">
            <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
          </Hint>
          <DropdownMenuContent align="end" className="w-auto min-w-40">
            <DropdownMenuItem onClick={() => onFavorite(doc.id)}>
              <Star className={cn("size-4", doc.favorite && "fill-amber-400 text-amber-500")} />
              {doc.favorite ? "Unfavorite" : "Favorite"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(doc.id)}>
              <Copy className="size-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(doc.id, doc.name)}>
              <Pencil className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Folder className="size-4" />
                Move
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {folders.map((item) => (
                  <DropdownMenuItem key={item.id} disabled={item.id === folderId} onClick={() => onMove(doc.id, item.id)}>
                    {item.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(doc.id)}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

export function TemplatesView() {
  const hydrated = useAppStore((s) => s.hydrated);
  const documents = useAppStore((s) => s.documents);
  const folders = useAppStore((s) => s.folders);
  const currentId = useAppStore((s) => s.currentId);
  const createBlank = useAppStore((s) => s.createBlank);
  const openDocument = useAppStore((s) => s.openDocument);
  const duplicateDocument = useAppStore((s) => s.duplicateDocument);
  const deleteDocument = useAppStore((s) => s.deleteDocument);
  const renameDocument = useAppStore((s) => s.renameDocument);
  const moveDocumentToFolder = useAppStore((s) => s.moveDocumentToFolder);
  const createFolder = useAppStore((s) => s.createFolder);
  const renameFolder = useAppStore((s) => s.renameFolder);
  const deleteFolder = useAppStore((s) => s.deleteFolder);
  const toggleFolderCollapsed = useAppStore((s) => s.toggleFolderCollapsed);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Untitled template");
  const [presetId, setPresetId] = useState("100x50");
  const [blankFolderId, setBlankFolderId] = useState<string>("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("New folder");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [renameDocId, setRenameDocId] = useState<string | null>(null);
  const [renameDocValue, setRenameDocValue] = useState("");
  const [dropFolderId, setDropFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [sort, setSort] = useState<TemplateSort>("used");
  const [recentCollapsed, setRecentCollapsed] = useState(false);

  useEffect(() => {
    setSort(readSort());
    setRecentCollapsed(window.localStorage.getItem(RECENT_COLLAPSED_KEY) === "1");
  }, []);

  const searching = Boolean(query.trim());
  const recent = useMemo(() => recentTemplates(documents), [documents]);
  const favorites = useMemo(() => favoriteTemplates(documents, sort), [documents, sort]);

  const docsByFolder = useMemo(() => {
    const map = new Map<string, LabelDocument[]>();
    for (const folder of folders) map.set(folder.id, []);
    for (const doc of documents) {
      const key = doc.folderId && map.has(doc.folderId) ? doc.folderId : folders[0]?.id;
      if (!key) continue;
      if (folderFilter !== "all" && key !== folderFilter) continue;
      if (!matchesTemplateQuery(doc, folderNameFor(doc, folders), query)) continue;
      map.get(key)?.push(doc);
    }
    for (const [id, items] of map) map.set(id, sortTemplates(items, sort));
    return map;
  }, [documents, folderFilter, folders, query, sort]);

  const searchHits = useMemo(
    () =>
      sortTemplates(
        documents.filter((doc) => matchesTemplateQuery(doc, folderNameFor(doc, folders), query)),
        sort,
      ),
    [documents, folders, query, sort],
  );

  const visibleFolders = folders.filter((folder) => {
    if (folderFilter !== "all" && folder.id !== folderFilter) return false;
    return (docsByFolder.get(folder.id) ?? []).length > 0 || !searching;
  });
  const deleteTarget = documents.find((doc) => doc.id === deleteId);
  const deleteFolderTarget = folders.find((folder) => folder.id === deleteFolderId) ?? null;
  const deleteFolderTemplates = deleteFolderId ? documents.filter((doc) => doc.folderId === deleteFolderId) : [];
  const deleteFolderFallback =
    folders.find((folder) => folder.id === MY_TEMPLATES_FOLDER_ID && folder.id !== deleteFolderId) ??
    folders.find((folder) => folder.id !== deleteFolderId) ??
    null;
  const renameDocTarget = documents.find((doc) => doc.id === renameDocId);

  function removeFolder(id: string) {
    deleteFolder(id);
    setDeleteFolderId(null);
    toast.success("Folder removed. Templates were kept.");
  }

  if (!hydrated) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  function goTo(id: string, path: "/designer" | "/generate") {
    openDocument(id);
    router.push(path);
  }

  const cardProps = {
    currentId,
    folders,
    onGenerate: (id: string) => goTo(id, "/generate"),
    onEdit: (id: string) => goTo(id, "/designer"),
    onFavorite: toggleFavorite,
    onDuplicate: (id: string) => {
      if (duplicateDocument(id)) toast.success("Duplicated");
    },
    onRename: (id: string, current: string) => {
      setRenameDocId(id);
      setRenameDocValue(current);
    },
    onMove: (id: string, folderId: string) => {
      moveDocumentToFolder(id, folderId);
      toast.success(`Moved to ${folders.find((folder) => folder.id === folderId)?.name ?? "folder"}`);
    },
    onDelete: (id: string) => setDeleteId(id),
  };

  function beginRename(id: string, current: string) {
    setRenamingId(id);
    setRenameValue(current);
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) renameFolder(renamingId, renameValue);
    setRenamingId(null);
  }


  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Templates</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Find a reusable label, then generate a batch from Excel or the sheet.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setNewFolderName("New folder");
              setNewFolderOpen(true);
            }}
          >
            <FolderPlus className="size-4" />
            New folder
          </Button>
          <Button
            onClick={() => {
              setBlankFolderId(folders.find((folder) => folder.name === "My templates")?.id ?? folders[0]?.id ?? "");
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
            New blank template
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates..."
              className="pl-8"
            />
          </div>
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            value={sort}
            onChange={(event) => {
              const next = event.target.value as TemplateSort;
              setSort(next);
              window.localStorage.setItem(SORT_KEY, next);
            }}
          >
            {TEMPLATE_SORTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        {folders.length > 1 && !searching ? (
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant={folderFilter === "all" ? "default" : "outline"} onClick={() => setFolderFilter("all")}>
              All
            </Button>
            {folders.map((folder) => (
              <Button
                key={folder.id}
                size="sm"
                variant={folderFilter === folder.id ? "default" : "outline"}
                onClick={() => setFolderFilter(folder.id)}
              >
                {folder.name}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {searching ? (
        <section className="mb-8">
          {searchHits.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {searchHits.map((doc) => (
                <TemplateCard key={doc.id} doc={doc} folderId={doc.folderId} {...cardProps} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No templates found for “{query.trim()}”.
            </p>
          )}
        </section>
      ) : (
        <>
          {recent.length ? (
            <section className="mb-8">
              <button
                type="button"
                className="mb-3 flex w-full min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-muted"
                onClick={() => {
                  const next = !recentCollapsed;
                  setRecentCollapsed(next);
                  window.localStorage.setItem(RECENT_COLLAPSED_KEY, next ? "1" : "0");
                }}
              >
                <ChevronDown
                  className={cn("size-4 shrink-0 text-muted-foreground transition-transform", recentCollapsed && "-rotate-90")}
                />
                <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Recent</h2>
                <span className="text-[11px] text-muted-foreground">{recent.length}</span>
              </button>
              {recentCollapsed ? null : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {recent.map((doc) => (
                    <TemplateCard key={doc.id} doc={doc} folderId={doc.folderId} compact {...cardProps} />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {favorites.length ? (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">Favorites</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {favorites.map((doc) => (
                  <TemplateCard key={doc.id} doc={doc} folderId={doc.folderId} {...cardProps} />
                ))}
              </div>
            </section>
          ) : null}

          {visibleFolders.map((folder) => {
            const items = docsByFolder.get(folder.id) ?? [];
            const collapsed = Boolean(folder.collapsed);
            const dropping = dropFolderId === folder.id;
            return (
              <section
                key={folder.id}
                className={cn("mb-6 rounded-xl border border-transparent p-1 -mx-1", dropping && "border-primary bg-primary/5")}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropFolderId(folder.id);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropFolderId(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDropFolderId(null);
                  const id = event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData("text/plain");
                  if (id) {
                    moveDocumentToFolder(id, folder.id);
                    toast.success(`Moved to ${folder.name}`);
                  }
                }}
              >
                <div className="mb-3 flex items-center gap-1">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-muted"
                    onClick={() => {
                      if (renamingId === folder.id) return;
                      toggleFolderCollapsed(folder.id);
                    }}
                  >
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", collapsed && "-rotate-90")} />
                    {renamingId === folder.id ? (
                      <Input
                        autoFocus
                        className="h-7 max-w-[240px]"
                        value={renameValue}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") commitRename();
                          if (event.key === "Escape") setRenamingId(null);
                        }}
                      />
                    ) : (
                      <>
                        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{folder.name}</h2>
                        <span className="text-[11px] text-muted-foreground">{items.length}</span>
                      </>
                    )}
                  </button>
                  <DropdownMenu>
                    <Hint label="Folder actions">
                      <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                    </Hint>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => beginRename(folder.id, folder.name)}>
                        <Pencil className="size-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={folders.length <= 1}
                        onClick={() => {
                          if (items.length) {
                            setDeleteFolderId(folder.id);
                            return;
                          }
                          removeFolder(folder.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                        Delete folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {collapsed ? null : items.length ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((doc) => (
                      <TemplateCard key={doc.id} doc={doc} folderId={folder.id} {...cardProps} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    Empty folder. Drag a template here, or create a blank template.
                  </p>
                )}
              </section>
            );
          })}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New blank template</DialogTitle>
            <DialogDescription>Starts empty in the folder you choose.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Name
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              Folder
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                value={blankFolderId}
                onChange={(event) => setBlankFolderId(event.target.value)}
              >
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Size
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                value={presetId}
                onChange={(event) => setPresetId(event.target.value)}
              >
                {PAGE_PRESETS.filter((preset) => preset.id !== "custom").map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const preset = PAGE_PRESETS.find((item) => item.id === presetId) ?? PAGE_PRESETS[1];
                const id = createBlank(
                  { widthMm: preset.widthMm, heightMm: preset.heightMm },
                  name.trim() || "Untitled template",
                  blankFolderId || undefined,
                );
                setOpen(false);
                goTo(id, "/designer");
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>Use folders to group warehouse, customer, or draft labels.</DialogDescription>
          </DialogHeader>
          <Input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                createFolder(newFolderName.trim() || "New folder");
                setNewFolderOpen(false);
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteFolderId)} onOpenChange={(next) => !next && setDeleteFolderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete folder</DialogTitle>
            <DialogDescription>
              {deleteFolderTarget
                ? `“${deleteFolderTarget.name}” has ${deleteFolderTemplates.length} template${
                    deleteFolderTemplates.length === 1 ? "" : "s"
                  }. The folder will be removed, and the templates will move to “${deleteFolderFallback?.name ?? "another folder"}”.`
                : "This folder will be removed. Templates inside it will be kept."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFolderId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteFolderId) removeFolder(deleteFolderId);
              }}
            >
              Delete folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameDocId)} onOpenChange={(next) => !next && setRenameDocId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename template</DialogTitle>
            <DialogDescription>
              {renameDocTarget ? `Current name: ${renameDocTarget.name}` : "Choose a name for this label."}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renameDocValue}
            onChange={(event) => setRenameDocValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && renameDocId && renameDocValue.trim()) {
                renameDocument(renameDocValue, renameDocId);
                setRenameDocId(null);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDocId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (renameDocId && renameDocValue.trim()) renameDocument(renameDocValue, renameDocId);
                setRenameDocId(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onOpenChange={(next) => !next && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” will be removed from this browser. This cannot be undone.`
                : "This template will be removed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteId) void deleteDocument(deleteId);
                setDeleteId(null);
                toast.success("Template deleted");
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
