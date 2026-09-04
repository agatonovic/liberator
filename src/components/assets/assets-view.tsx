"use client";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  PACKAGING_FOLDER_ID,
  assetSrc,
  assetsForOrganization,
  childFolders,
  folderDescendantIds,
  folderPath,
  foldersForOrganization,
  formatBytes,
  type AssetFolder,
  type AssetRecord,
} from "@/lib/assets";
import { isStaticHost } from "@/lib/public-path";
import { useAssetStore } from "@/lib/asset-store";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ChevronRight, Folder, FolderPlus, Images, Pencil, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

export function AssetsView() {
  const hydrated = useAssetStore((s) => s.hydrated);
  const foldersAll = useAssetStore((s) => s.folders);
  const assetsAll = useAssetStore((s) => s.assets);
  const orgId = useAppStore((s) => s.currentOrganizationId);
  const folders = useMemo(() => foldersForOrganization(foldersAll, orgId), [foldersAll, orgId]);
  const assets = useMemo(() => assetsForOrganization(assetsAll, orgId), [assetsAll, orgId]);
  const thumbUrls = useAssetStore((s) => s.thumbUrls);
  const createFolder = useAssetStore((s) => s.createFolder);
  const renameFolder = useAssetStore((s) => s.renameFolder);
  const deleteFolder = useAssetStore((s) => s.deleteFolder);
  const uploadFiles = useAssetStore((s) => s.uploadFiles);
  const renameAsset = useAssetStore((s) => s.renameAsset);
  const moveAsset = useAssetStore((s) => s.moveAsset);
  const deleteAssets = useAssetStore((s) => s.deleteAssets);
  const fileRef = useRef<HTMLInputElement>(null);
  const [folderId, setFolderId] = useState<string | "all" | "pending">("pending");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("New folder");
  const [newFolderParent, setNewFolderParent] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);
  const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null);
  const [renameAssetValue, setRenameAssetValue] = useState("");

  useEffect(() => {
    if (!hydrated || folderId !== "pending") return;
    setFolderId(folders.some((folder) => folder.id === PACKAGING_FOLDER_ID) ? PACKAGING_FOLDER_ID : "all");
  }, [hydrated, folders, folderId]);

  const resolvedFolder = folderId === "pending" ? "all" : folderId;
  const activeFolder = resolvedFolder === "all" ? null : folders.find((folder) => folder.id === resolvedFolder) ?? null;
  const nested = useMemo(() => childFolders(folders, activeFolder?.id), [folders, activeFolder?.id]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const folder of folders) {
      const scope = new Set(folderDescendantIds(folders, folder.id));
      map.set(folder.id, assets.filter((asset) => scope.has(asset.folderId)).length);
    }
    return map;
  }, [assets, folders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets
      .filter((asset) => (resolvedFolder === "all" ? true : asset.folderId === resolvedFolder))
      .filter((asset) => !q || asset.name.toLowerCase().includes(q) || asset.stem.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [assets, resolvedFolder, query]);

  const selected = assets.find((asset) => asset.id === selectedId) ?? null;
  const canUpload = !isStaticHost;
  const deleteFolderTarget = folders.find((folder) => folder.id === deleteFolderId) ?? null;
  const deleteFolderAssetCount = deleteFolderId ? (counts.get(deleteFolderId) ?? 0) : 0;
  const deleteFolderChildCount = deleteFolderId
    ? folderDescendantIds(folders, deleteFolderId).length - 1
    : 0;
  const deleteAsset = assets.find((asset) => asset.id === deleteAssetId) ?? null;
  const folderOptions = folders
    .map((folder) => ({ id: folder.id, label: folderPath(folders, folder.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

  function openNewFolder(parentId = "") {
    setNewFolderParent(parentId);
    setNewFolderName("New folder");
    setNewFolderOpen(true);
  }

  async function addFiles(fileList: FileList | File[] | null) {
    const files = fileList ? [...fileList] : [];
    if (!files.length) return;
    let target = resolvedFolder === "all" ? folders[0]?.id : resolvedFolder;
    if (!target) {
      target = createFolder("Uploads");
      setFolderId(target);
    }
    const added = await uploadFiles(target, files);
    if (added) toast.success(`Added ${added} image${added === 1 ? "" : "s"}`);
    else toast.error("No image files in that drop.");
  }

  if (!hydrated) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar/40">
        <div className="px-4 py-4">
          <h2 className="text-sm font-medium">Folders</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">Nest folders for seasons, plants, or customers.</p>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
          <FolderRow
            label="All assets"
            count={assets.length}
            active={resolvedFolder === "all"}
            onClick={() => setFolderId("all")}
          />
          {childFolders(folders).map((folder) => (
            <FolderTree
              key={folder.id}
              folder={folder}
              folders={folders}
              counts={counts}
              depth={0}
              activeId={resolvedFolder}
              renamingId={renamingFolderId}
              renameValue={renameFolderValue}
              collapsed={collapsed}
              onToggle={(id) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))}
              onOpen={setFolderId}
              onRenameStart={(id, name) => {
                setRenamingFolderId(id);
                setRenameFolderValue(name);
              }}
              onRenameChange={setRenameFolderValue}
              onRenameCommit={() => {
                if (renamingFolderId && renameFolderValue.trim()) renameFolder(renamingFolderId, renameFolderValue);
                setRenamingFolderId(null);
              }}
              onRenameCancel={() => setRenamingFolderId(null)}
              onAddChild={openNewFolder}
              onDelete={setDeleteFolderId}
            />
          ))}
        </nav>
        <div className="border-t border-border p-2">
          <Button variant="outline" className="w-full" onClick={() => openNewFolder(resolvedFolder === "all" ? "" : resolvedFolder)}>
            <FolderPlus className="size-4" />
            New folder
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-6 py-5">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">Assets</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {activeFolder
                ? `Images in ${folderPath(folders, activeFolder.id)}. Bind a label photo to this folder or a parent — Print also looks in subfolders.`
                : canUpload
                  ? "Upload once, reuse on every template. Bind a photo to a data column and a folder to swap images per row."
                  : "Packaging photos ship with this site. Bind a photo to a data column and a folder to swap images per row."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search by name…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-52"
            />
            <Button
              variant="outline"
              onClick={() => openNewFolder(resolvedFolder === "all" ? "" : resolvedFolder)}
            >
              <FolderPlus className="size-4" />
              {activeFolder ? "Subfolder" : "Folder"}
            </Button>
            {canUpload ? (
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" />
                Upload
              </Button>
            ) : null}
          </div>
        </header>

        {canUpload ? (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            void addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        ) : null}

        <div
          className={cn("min-h-0 flex-1 overflow-y-auto p-6", canUpload && dragging && "bg-primary/5")}
          onDragOver={
            canUpload
              ? (event) => {
                  event.preventDefault();
                  setDragging(true);
                }
              : undefined
          }
          onDragLeave={canUpload ? () => setDragging(false) : undefined}
          onDrop={
            canUpload
              ? (event) => {
                  event.preventDefault();
                  setDragging(false);
                  void addFiles(event.dataTransfer.files);
                }
              : undefined
          }
        >
          {nested.length || visible.length ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-3">
              {!query &&
                nested.map((folder) => (
                  <li key={folder.id}>
                    <button
                      type="button"
                      className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card shadow-sm hover:border-ring"
                      onClick={() => setFolderId(folder.id)}
                    >
                      <Folder className="size-8 text-muted-foreground" />
                      <span className="px-2 text-center text-xs font-medium">{folder.name}</span>
                      <span className="text-[11px] text-muted-foreground">{counts.get(folder.id) ?? 0} images</span>
                    </button>
                  </li>
                ))}
              {visible.map((asset) => (
                <li key={asset.id}>
                  <AssetCard
                    asset={asset}
                    src={thumbUrls[asset.id] ?? assetSrc(asset)}
                    selected={selectedId === asset.id}
                    renaming={renamingAssetId === asset.id}
                    renameValue={renameAssetValue}
                    folders={folderOptions}
                    onSelect={() => setSelectedId(asset.id)}
                    onRenameValue={setRenameAssetValue}
                    onBeginRename={() => {
                      setSelectedId(asset.id);
                      setRenamingAssetId(asset.id);
                      setRenameAssetValue(asset.name);
                    }}
                    onCommitRename={() => {
                      if (renameAssetValue.trim()) renameAsset(asset.id, renameAssetValue);
                      setRenamingAssetId(null);
                    }}
                    onCancelRename={() => setRenamingAssetId(null)}
                    onMove={(next) => moveAsset(asset.id, next)}
                    onDelete={() => setDeleteAssetId(asset.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <button
              type="button"
              onClick={canUpload ? () => fileRef.current?.click() : undefined}
              className="flex h-full min-h-[280px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-border text-center"
            >
              <Images className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">{canUpload ? "Drop images here" : "No images in this folder"}</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                {canUpload
                  ? "Or create a subfolder. Name files after the data value, e.g. X4202.jpg."
                  : "Packaging photos are included with this site. Uploading is only available in the local app."}
              </p>
            </button>
          )}
        </div>

        {selected ? (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3 text-xs text-muted-foreground">
            <div className="min-w-0 truncate">
              <span className="font-medium text-foreground">{selected.name}</span>
              <span className="px-2">·</span>
              {folderPath(folders, selected.folderId) || "Unfiled"}
              <span className="px-2">·</span>
              lookup key <span className="font-mono text-foreground">{selected.stem || "—"}</span>
              {selected.bytes ? (
                <>
                  <span className="px-2">·</span>
                  {formatBytes(selected.bytes)}
                </>
              ) : null}
            </div>
            <span>Match is case-insensitive and ignores the file extension.</span>
          </footer>
        ) : null}
      </div>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newFolderParent ? "New subfolder" : "New folder"}</DialogTitle>
            <DialogDescription>
              {newFolderParent
                ? `Created inside ${folderPath(folders, newFolderParent) || "the selected folder"}.`
                : "Leave parent empty for a top-level folder, or nest it under another folder."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Name
              <Input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              Inside
              <select
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
                value={newFolderParent}
                onChange={(event) => setNewFolderParent(event.target.value)}
              >
                <option value="">Top level</option>
                {folderOptions.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const id = createFolder(newFolderName, newFolderParent || undefined);
                setFolderId(id);
                setNewFolderOpen(false);
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteFolderId)} onOpenChange={(open) => !open && setDeleteFolderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete folder</DialogTitle>
            <DialogDescription>
              {deleteFolderTarget
                ? [
                    `“${deleteFolderTarget.name}” will be removed.`,
                    deleteFolderChildCount
                      ? `${deleteFolderChildCount} subfolder${deleteFolderChildCount === 1 ? "" : "s"} will be removed.`
                      : "",
                    deleteFolderAssetCount
                      ? `${deleteFolderAssetCount} image${deleteFolderAssetCount === 1 ? "" : "s"} will be deleted.`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                : "This folder will be removed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFolderId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteFolderId) {
                  void deleteFolder(deleteFolderId);
                  if (resolvedFolder === deleteFolderId || folderDescendantIds(folders, deleteFolderId).includes(resolvedFolder)) {
                    setFolderId("all");
                  }
                }
                setDeleteFolderId(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteAssetId)} onOpenChange={(open) => !open && setDeleteAssetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete image</DialogTitle>
            <DialogDescription>
              {deleteAsset
                ? `“${deleteAsset.name}” will be removed from Assets. Labels that look up this file will show an empty image until you replace it.`
                : "This image will be removed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAssetId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteAssetId) {
                  void deleteAssets([deleteAssetId]);
                  if (selectedId === deleteAssetId) setSelectedId(null);
                }
                setDeleteAssetId(null);
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

function FolderTree({
  folder,
  folders,
  counts,
  depth,
  activeId,
  renamingId,
  renameValue,
  collapsed,
  onToggle,
  onOpen,
  onRenameStart,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onAddChild,
  onDelete,
}: {
  folder: AssetFolder;
  folders: AssetFolder[];
  counts: Map<string, number>;
  depth: number;
  activeId: string;
  renamingId: string | null;
  renameValue: string;
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onRenameStart: (id: string, name: string) => void;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
}) {
  const children = childFolders(folders, folder.id);
  const open = !collapsed[folder.id];
  return (
    <div>
      <FolderRow
        label={renamingId === folder.id ? undefined : folder.name}
        count={counts.get(folder.id) ?? 0}
        active={activeId === folder.id}
        depth={depth}
        expandable={children.length > 0}
        expanded={open}
        onToggle={() => onToggle(folder.id)}
        onClick={() => onOpen(folder.id)}
        onAddChild={() => onAddChild(folder.id)}
        onRename={() => onRenameStart(folder.id, folder.name)}
        onDelete={() => onDelete(folder.id)}
      >
        {renamingId === folder.id ? (
          <Input
            autoFocus
            value={renameValue}
            className="h-7"
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onRenameChange(event.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(event) => {
              if (event.key === "Enter") (event.target as HTMLInputElement).blur();
              if (event.key === "Escape") onRenameCancel();
            }}
          />
        ) : null}
      </FolderRow>
      {open
        ? children.map((child) => (
            <FolderTree
              key={child.id}
              folder={child}
              folders={folders}
              counts={counts}
              depth={depth + 1}
              activeId={activeId}
              renamingId={renamingId}
              renameValue={renameValue}
              collapsed={collapsed}
              onToggle={onToggle}
              onOpen={onOpen}
              onRenameStart={onRenameStart}
              onRenameChange={onRenameChange}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))
        : null}
    </div>
  );
}

function FolderRow({
  label,
  count,
  active,
  depth = 0,
  expandable,
  expanded,
  onClick,
  onToggle,
  onRename,
  onAddChild,
  onDelete,
  children,
}: {
  label?: string;
  count: number;
  active: boolean;
  depth?: number;
  expandable?: boolean;
  expanded?: boolean;
  onClick: () => void;
  onToggle?: () => void;
  onRename?: () => void;
  onAddChild?: () => void;
  onDelete?: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-lg py-1.5 pr-2 text-sm",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
      )}
      style={{ paddingLeft: 8 + depth * 12 }}
    >
      {expandable ? (
        <Hint label={expanded ? "Collapse" : "Expand"}>
          <button type="button" className="rounded p-0.5 hover:bg-background" onClick={onToggle}>
            <ChevronRight className={cn("size-3 transition-transform", expanded && "rotate-90")} />
          </button>
        </Hint>
      ) : (
        <span className="w-4" />
      )}
      <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={onClick}>
        {children ?? label}
      </button>
      <span className="text-[11px] text-muted-foreground tabular-nums">{count}</span>
      {onRename || onDelete || onAddChild ? (
        <span className="flex opacity-0 group-hover:opacity-100">
          {onAddChild ? (
            <Hint label="New subfolder">
              <button type="button" className="rounded p-0.5 hover:bg-background" onClick={onAddChild}>
                <FolderPlus className="size-3" />
              </button>
            </Hint>
          ) : null}
          {onRename ? (
            <Hint label="Rename">
              <button type="button" className="rounded p-0.5 hover:bg-background" onClick={onRename}>
                <Pencil className="size-3" />
              </button>
            </Hint>
          ) : null}
          {onDelete ? (
            <Hint label="Delete">
              <button type="button" className="rounded p-0.5 hover:bg-background" onClick={onDelete}>
                <Trash2 className="size-3" />
              </button>
            </Hint>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

function AssetCard({
  asset,
  src,
  selected,
  renaming,
  renameValue,
  folders,
  onSelect,
  onBeginRename,
  onRenameValue,
  onCommitRename,
  onCancelRename,
  onMove,
  onDelete,
}: {
  asset: AssetRecord;
  src?: string;
  selected: boolean;
  renaming: boolean;
  renameValue: string;
  folders: { id: string; label: string }[];
  onSelect: () => void;
  onBeginRename: () => void;
  onRenameValue: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onMove: (folderId: string) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm",
        selected ? "border-ring ring-2 ring-ring/30" : "border-border",
      )}
    >
      <button type="button" className="block aspect-square w-full bg-[#f3efe6]" onClick={onSelect}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={asset.name} className="size-full object-contain" loading="lazy" />
        ) : (
          <span className="flex size-full items-center justify-center text-xs text-muted-foreground">Image</span>
        )}
      </button>
      <div className="space-y-1 p-2">
        {renaming ? (
          <Input
            autoFocus
            value={renameValue}
            className="h-7 text-xs"
            onChange={(event) => onRenameValue(event.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") (event.target as HTMLInputElement).blur();
              if (event.key === "Escape") onCancelRename();
            }}
          />
        ) : (
          <Hint label={asset.name} className="w-full">
            <button type="button" className="w-full truncate text-left text-xs font-medium" onClick={onBeginRename}>
              {asset.name}
            </button>
          </Hint>
        )}
        <div className="flex items-center gap-1">
          {folders.length > 1 ? (
            <select
              className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-[11px]"
              value={asset.folderId}
              onChange={(event) => onMove(event.target.value)}
            >
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.label}
                </option>
              ))}
            </select>
          ) : null}
          <Hint label="Delete">
            <Button size="icon-xs" variant="ghost" onClick={onDelete}>
              <Trash2 className="size-3" />
            </Button>
          </Hint>
        </div>
      </div>
    </div>
  );
}
