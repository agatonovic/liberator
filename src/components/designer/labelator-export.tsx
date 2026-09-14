"use client";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  analyzePortableExport,
  catalogPrintMode,
  defaultPortablePrintMode,
  publishedPackageFor,
  type RendererCompatibility,
} from "@/lib/labelator-package";
import { publicPath } from "@/lib/public-path";
import { exportPortableLabelatorFile, readAssetRecordBytes } from "@/lib/labelator-package/browser-export";
import { downloadBlob } from "@/lib/excel";
import type { LabelDocument } from "@/lib/document";
import { useAssetStore } from "@/lib/asset-store";
import { Download } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function CompatibilityList({ result }: { result: RendererCompatibility }) {
  const supported = result.items.filter((item) => item.supported);
  const unsupported = result.items.filter((item) => !item.supported);
  return (
    <div className="space-y-3 text-sm">
      <ul className="space-y-1">
        {supported.map((item) => (
          <li key={item.id} className="flex gap-2">
            <span className="text-emerald-700" aria-hidden>
              ✓
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      {unsupported.length ? (
        <div>
          <p className="mb-1 text-xs font-medium text-amber-800">Not supported</p>
          <ul className="space-y-1">
            {unsupported.map((item) => (
              <li key={item.id} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function LabelatorExportDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: LabelDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const assets = useAssetStore((state) => state.assets);
  const folders = useAssetStore((state) => state.folders);
  const multiUp = defaultPortablePrintMode(doc) === "sheet";
  const [packSheet, setPackSheet] = useState(multiUp);
  const printMode = multiUp && packSheet ? "sheet" : "label";
  const result = useMemo(
    () => analyzePortableExport(doc, { printMode }),
    [doc, printMode],
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setPackSheet(multiUp);
  }, [open, multiUp, doc.id]);

  async function download() {
    setBusy(true);
    try {
      const packaged = await exportPortableLabelatorFile(doc, {
        printMode,
        assets: { assets, folders, readBytes: readAssetRecordBytes },
      });
      downloadBlob(new Blob([packaged.bytes.slice()]), packaged.fileName);
      toast.success(result.compatible ? "Downloaded .labelator" : "Downloaded .labelator (renderer warning)");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build .labelator package");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download .labelator</DialogTitle>
          <DialogDescription>
            Portable production template. JSON stays the raw template definition.
          </DialogDescription>
        </DialogHeader>
        {result.compatible ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-emerald-800">Production compatible</p>
            <p className="text-muted-foreground">
              This template can be rendered by the current LABELATOR Python renderer.
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-amber-800">Not compatible with the current Python renderer</p>
            <p className="text-muted-foreground">
              This template uses {result.unsupported.join(", ")}, which is not currently supported. The package can
              still be downloaded.
            </p>
          </div>
        )}
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Renderer compatibility
          </p>
          <CompatibilityList result={result} />
        </div>
        {multiUp ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={packSheet}
              onChange={(event) => setPackSheet(event.target.checked)}
            />
            <span>
              Pack on the template sheet
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Off exports one label per page. The Python renderer supports both.
              </span>
            </span>
          </label>
        ) : null}
        <p className="text-xs text-muted-foreground">
          <Link href="/developers" className="underline underline-offset-2">
            Developer integration
          </Link>
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void download()}>
            {busy ? "Packaging…" : result.compatible ? "Download .labelator" : "Download anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LabelatorExportButton({ doc }: { doc: LabelDocument }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Hint label="Export the current working template as a portable package">
        <Button size="sm" variant="outline" className="px-2 text-xs" onClick={() => setOpen(true)}>
          <Download className="size-3.5" />
          Download .labelator
        </Button>
      </Hint>
      <LabelatorExportDialog doc={doc} open={open} onOpenChange={setOpen} />
    </>
  );
}

function downloadStaticPackage(href: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = publicPath(href);
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function CatalogLabelatorDownload({ doc }: { doc: LabelDocument }) {
  const published = publishedPackageFor(doc);
  const result = useMemo(
    () => analyzePortableExport(doc, { printMode: catalogPrintMode(doc) }),
    [doc],
  );
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenuItem
        onClick={() => {
          if (published && result.compatible) {
            downloadStaticPackage(published.href, published.fileName);
            toast.success("Downloaded published .labelator");
            return;
          }
          setOpen(true);
        }}
      >
        <Download className="size-4" />
        Download .labelator
      </DropdownMenuItem>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Published .labelator</DialogTitle>
            <DialogDescription>
              This downloads the published catalog package, not the current working copy. Export the working copy from
              Designer.
            </DialogDescription>
          </DialogHeader>
          {result.compatible ? (
            <p className="text-sm text-emerald-800">Production compatible with the current Python renderer.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-amber-800">Not compatible with the current Python renderer</p>
              <p className="text-muted-foreground">
                This template uses {result.unsupported.join(", ")}, which the current Python renderer cannot draw. A
                .labelator package can still be valid. It is not offered as a Python-ready published download.
              </p>
            </div>
          )}
          <CompatibilityList result={result} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            {published ? (
              <Button
                type="button"
                onClick={() => {
                  downloadStaticPackage(published.href, published.fileName);
                  toast.success("Downloaded published .labelator");
                  setOpen(false);
                }}
              >
                Download published package
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
