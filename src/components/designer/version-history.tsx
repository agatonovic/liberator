"use client";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { LabelDocument, TemplateVersion } from "@/lib/document";
import { relativeUsed } from "@/lib/template-library";
import { useAppStore } from "@/lib/store";
import { formatVersionDate, versionLabel } from "@/lib/versions";
import { downloadTemplateJson } from "@/lib/template-json";
import { LabelatorExportButton } from "@/components/designer/labelator-export";
import { Download, Eye, History, Pencil, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

function SaveStatus() {
  const saveState = useAppStore((s) => s.saveState);
  const saveNow = useAppStore((s) => s.saveNow);
  const label = saveState === "saving" ? "Saving…" : saveState === "pending" ? "Unsaved" : "All changes saved";
  return (
    <Hint label={saveState === "saved" ? "Autosave is on" : "Click to save now"}>
      <button
        type="button"
        className="px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        disabled={saveState === "saving"}
        onClick={() => {
          if (saveState === "saved") return;
          void saveNow();
        }}
      >
        {label}
      </button>
    </Hint>
  );
}

export function DesignerSaveControls({
  doc,
  canUndo,
  previewVersionId,
  onPreviewVersion,
}: {
  doc: LabelDocument;
  canUndo: boolean;
  previewVersionId: string | null;
  onPreviewVersion: (id: string | null) => void;
}) {
  const saveVersion = useAppStore((s) => s.saveVersion);
  const publishCurrent = useAppStore((s) => s.publishCurrent);
  const restoreVersion = useAppStore((s) => s.restoreVersion);
  const renameVersion = useAppStore((s) => s.renameVersion);
  const deleteVersion = useAppStore((s) => s.deleteVersion);
  const versions = doc.versions ?? [];
  const [open, setOpen] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function save() {
    if (!saveVersion()) return;
    toast.success("Version saved");
    setOpen(true);
  }

  function askRestore(id: string) {
    if (canUndo) setRestoreId(id);
    else {
      if (restoreVersion(id)) toast.success("Version restored");
      onPreviewVersion(null);
      setOpen(false);
    }
  }

  function confirmRestore() {
    if (!restoreId) return;
    if (restoreVersion(restoreId)) toast.success("Version restored. Undo to go back.");
    setRestoreId(null);
    onPreviewVersion(null);
    setOpen(false);
  }

  function commitRename(version: TemplateVersion) {
    renameVersion(version.id, editName);
    setEditingId(null);
  }

  const pending = versions.find((item) => item.id === restoreId);

  return (
    <div className="relative flex items-center gap-1" ref={panelRef}>
      <SaveStatus />
      <Hint label="Download Labelator template JSON">
        <Button
          size="sm"
          variant="outline"
          className="px-2 text-xs"
          onClick={() => {
            downloadTemplateJson(doc, { exportScope: "working" });
            toast.success("Downloaded template JSON");
          }}
        >
          <Download className="size-3.5" />
          Download JSON
        </Button>
      </Hint>
      <LabelatorExportButton doc={doc} />
      <Hint label="Save a named checkpoint" shortcut="⇧⌘S">
        <Button size="sm" variant="outline" className="px-2 text-xs" onClick={save}>
          <Save className="size-3.5" />
          Save version
        </Button>
      </Hint>
      <Hint label={doc.status === "published" ? "Edit first — operators keep using the published version" : "Publish this working copy"}>
        <Button
          size="sm"
          variant="outline"
          className="px-2 text-xs"
          disabled={doc.status === "published"}
          onClick={() => {
            if (publishCurrent()) toast.success("Published");
          }}
        >
          Publish{doc.versionNumber ? ` v${doc.versionNumber}` : ""}
        </Button>
      </Hint>
      <Hint label="Version history">
        <Button
          size="icon-sm"
          variant={open ? "secondary" : "ghost"}
          onClick={() => setOpen((value) => !value)}
        >
          <History className="size-4" />
          <span className="sr-only">Version history</span>
        </Button>
      </Hint>
      {open ? (
        <div className="absolute top-full right-0 z-30 mt-1 w-[360px] overflow-hidden rounded-xl border border-border bg-popover shadow-md">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-medium">Versions</p>
            <p className="text-[11px] text-muted-foreground">{versions.length || "None yet"}</p>
          </div>
          {versions.length ? (
            <ul className="max-h-72 overflow-y-auto py-1">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className={`flex items-start gap-2 px-2 py-1.5 hover:bg-muted/70 ${
                    previewVersionId === version.id ? "bg-[#e8f0fe]" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    {editingId === version.id ? (
                      <Input
                        autoFocus
                        className="h-7"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        onBlur={() => commitRename(version)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") commitRename(version);
                          if (event.key === "Escape") setEditingId(null);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => onPreviewVersion(previewVersionId === version.id ? null : version.id)}
                      >
                        <p className="truncate text-sm font-medium">{versionLabel(version)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {version.name.trim()
                            ? formatVersionDate(version.createdAt)
                            : relativeUsed(version.createdAt) || formatVersionDate(version.createdAt)}
                        </p>
                      </button>
                    )}
                  </div>
                  <Hint label={previewVersionId === version.id ? "Exit preview" : "Preview"}>
                    <Button
                      size="icon-xs"
                      variant={previewVersionId === version.id ? "secondary" : "ghost"}
                      onClick={() => onPreviewVersion(previewVersionId === version.id ? null : version.id)}
                    >
                      <Eye className="size-3.5" />
                    </Button>
                  </Hint>
                  <Hint label="Rename">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(version.id);
                        setEditName(version.name);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </Hint>
                  <Hint label="Restore">
                    <Button size="icon-xs" variant="ghost" onClick={() => askRestore(version.id)}>
                      <RotateCcw className="size-3.5" />
                    </Button>
                  </Hint>
                  <Hint label="Delete version">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => {
                        deleteVersion(version.id);
                        if (previewVersionId === version.id) onPreviewVersion(null);
                        toast.success("Version removed");
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </Hint>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Save a version when the layout is in a good state. You can preview a version on the canvas before restoring it.
            </p>
          )}
        </div>
      ) : null}

      <Dialog open={Boolean(restoreId)} onOpenChange={(next) => !next && setRestoreId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore this version?</DialogTitle>
            <DialogDescription>
              {pending
                ? `Replace the current layout with “${versionLabel(pending)}”. You can undo if it is not what you wanted.`
                : "Replace the current layout with this checkpoint."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreId(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRestore}>Restore</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
