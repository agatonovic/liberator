"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SHEET_PAGE_OPTIONS, type LabelDocument, type SheetLayout, type SheetPageSize } from "@/lib/document";
import {
  computeSlotOrigins,
  defaultSheetForLabel,
  fitLabelOnSheet,
  maxMarginForLabel,
  paperFitsLabel,
  sheetPageSizeMm,
} from "@/lib/pdf";
import { useEffect, useState } from "react";

export type PrintPaperMode = "label" | "sheet";

function SheetPreview({
  sheet,
  label,
  origins,
}: {
  sheet: SheetLayout;
  label: { widthMm: number; heightMm: number };
  origins: { xMm: number; yMm: number }[];
}) {
  const page = sheetPageSizeMm(sheet.pageSize);
  const scale = Math.min(320 / page.widthMm, 220 / page.heightMm);
  return (
    <div className="overflow-hidden rounded-lg border border-[#d0d7de] bg-[#e8eaed] p-3">
      <svg
        viewBox={`0 0 ${page.widthMm} ${page.heightMm}`}
        width={page.widthMm * scale}
        height={page.heightMm * scale}
        className="mx-auto block bg-white shadow-sm"
        role="img"
        aria-label="Paper preview"
      >
        <rect x={0} y={0} width={page.widthMm} height={page.heightMm} fill="#fff" stroke="#d0d7de" strokeWidth={0.4} />
        {origins.map((origin, index) => (
          <g key={`${origin.xMm}-${origin.yMm}-${index}`}>
            <rect
              x={origin.xMm}
              y={origin.yMm}
              width={label.widthMm}
              height={label.heightMm}
              fill="#e8f0fe"
              stroke="#1b4f9c"
              strokeWidth={0.35}
            />
            <text
              x={origin.xMm + label.widthMm / 2}
              y={origin.yMm + label.heightMm / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#174ea6"
              fontSize={Math.min(8, label.heightMm * 0.22)}
              fontFamily="IBM Plex Sans, sans-serif"
            >
              {index + 1}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function PaperSetupDialog({
  open,
  onOpenChange,
  doc,
  labelCount,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: LabelDocument;
  labelCount: number;
  busy: "print" | "download" | null;
  onConfirm: (action: "print" | "download", working: LabelDocument, sheet: SheetLayout | undefined) => void;
}) {
  const [mode, setMode] = useState<PrintPaperMode>(doc.sheet ? "sheet" : "label");
  const [autoFit, setAutoFit] = useState(true);
  const [sheet, setSheet] = useState<SheetLayout>(() => defaultSheetForLabel(doc.page, doc.sheet));

  useEffect(() => {
    if (!open) return;
    const next = defaultSheetForLabel(doc.page, doc.sheet);
    setSheet(next);
    const fits = fitLabelOnSheet(doc.page, next.pageSize, next.gapMm, next.marginMm).fits;
    setMode(fits && (Boolean(doc.sheet) || next.columns * next.rows >= 2) ? "sheet" : "label");
    setAutoFit(true);
  }, [open, doc.id, doc.page.widthMm, doc.page.heightMm, doc.sheet]);

  const fitted = fitLabelOnSheet(doc.page, sheet.pageSize, sheet.gapMm, sheet.marginMm);
  const origins = computeSlotOrigins(mode === "sheet" ? sheet : { ...sheet, columns: 1, rows: 1 }, doc.page);
  const slots = mode === "sheet" ? Math.max(0, origins.length) : 1;
  const pageCount = slots > 0 ? Math.max(1, Math.ceil(labelCount / slots)) : 0;
  const paper = sheetPageSizeMm(sheet.pageSize);
  const canPrint = mode === "label" || fitted.fits;
  const fittingPapers = SHEET_PAGE_OPTIONS.filter((option) => paperFitsLabel(doc.page, option.id));

  function updateSheet(patch: Partial<SheetLayout>) {
    const next = { ...sheet, ...patch };
    if (patch.pageSize != null) {
      next.marginMm = Math.min(next.marginMm, Math.max(0, maxMarginForLabel(doc.page, next.pageSize)));
    }
    if (autoFit && (patch.pageSize != null || patch.gapMm != null || patch.marginMm != null || patch.columns == null)) {
      const fit = fitLabelOnSheet(doc.page, next.pageSize, next.gapMm, next.marginMm);
      next.columns = Math.max(fit.columns, 1);
      next.rows = Math.max(fit.rows, 1);
    }
    setSheet(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>Print setup</DialogTitle>
          <DialogDescription>
            Sticker {doc.page.widthMm} × {doc.page.heightMm} mm · {labelCount} label{labelCount === 1 ? "" : "s"}.
            Choose sticker-sized pages for a label printer, or pack copies on office paper.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-left ${
                mode === "label" ? "border-[#1b4f9c] bg-[#e8f0fe]" : "border-[#d0d7de] bg-white hover:bg-[#f8f9fa]"
              }`}
              onClick={() => setMode("label")}
            >
              <div className="text-sm font-medium">Sticker size</div>
              <p className="mt-0.5 text-[11px] text-[#5f6368]">
                One PDF page per label at {doc.page.widthMm} × {doc.page.heightMm} mm.
              </p>
            </button>
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-left ${
                mode === "sheet" ? "border-[#1b4f9c] bg-[#e8f0fe]" : "border-[#d0d7de] bg-white hover:bg-[#f8f9fa]"
              }`}
              onClick={() => setMode("sheet")}
            >
              <div className="text-sm font-medium">Office paper</div>
              <p className="mt-0.5 text-[11px] text-[#5f6368]">Pack as many stickers as fit on A4 / A3 / Letter.</p>
            </button>
          </div>

          {mode === "sheet" ? (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
              <div className="grid grid-cols-2 gap-2 content-start text-sm">
                <label className="col-span-2 grid gap-1">
                  Paper
                  <select
                    className="h-8 rounded-lg border border-input bg-transparent px-2"
                    value={sheet.pageSize}
                    onChange={(event) => updateSheet({ pageSize: event.target.value as SheetPageSize })}
                  >
                    {SHEET_PAGE_OPTIONS.map((option) => {
                      const fits = paperFitsLabel(doc.page, option.id);
                      return (
                        <option key={option.id} value={option.id} disabled={!fits}>
                          {option.label}
                          {fits ? "" : " — too small"}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <p className="col-span-2 text-[11px] text-[#5f6368]">
                  {paper.widthMm} × {paper.heightMm} mm
                </p>
                {!fitted.fits ? (
                  <p className="col-span-2 rounded-md border border-[#f9dedc] bg-[#fce8e6] px-2 py-1.5 text-[12px] text-[#c5221f]">
                    This sticker is {doc.page.widthMm} × {doc.page.heightMm} mm and does not fit on{" "}
                    {SHEET_PAGE_OPTIONS.find((option) => option.id === sheet.pageSize)?.label ?? sheet.pageSize} (
                    {paper.widthMm} × {paper.heightMm} mm) with a {sheet.marginMm} mm margin.
                    {fittingPapers.length
                      ? ` It does fit on ${fittingPapers.map((option) => option.label).join(", ")}.`
                      : " No office paper size in the list is large enough — use sticker size instead."}
                  </p>
                ) : null}
                <label className="col-span-2 flex items-center justify-between gap-2 rounded-lg border border-[#d0d7de] px-3 py-2">
                  <span>
                    <span className="block text-sm">Auto-fit</span>
                    <span className="block text-[11px] text-[#5f6368]">Fill the sheet from sticker size, gap, and margin.</span>
                  </span>
                  <Switch
                    checked={autoFit}
                    onCheckedChange={(checked) => {
                      const enabled = Boolean(checked);
                      setAutoFit(enabled);
                      if (enabled) {
                        const fit = fitLabelOnSheet(doc.page, sheet.pageSize, sheet.gapMm, sheet.marginMm);
                        setSheet({ ...sheet, columns: fit.columns, rows: fit.rows });
                      }
                    }}
                  />
                </label>
                <label className="grid gap-1">
                  Columns
                  <Input
                    type="number"
                    min={1}
                    max={fitted.columns}
                    disabled={autoFit}
                    value={sheet.columns}
                    onChange={(event) => setSheet({ ...sheet, columns: Number(event.target.value) || 1 })}
                  />
                </label>
                <label className="grid gap-1">
                  Rows
                  <Input
                    type="number"
                    min={1}
                    max={fitted.rows}
                    disabled={autoFit}
                    value={sheet.rows}
                    onChange={(event) => setSheet({ ...sheet, rows: Number(event.target.value) || 1 })}
                  />
                </label>
                <label className="grid gap-1">
                  Gap (mm)
                  <Input
                    type="number"
                    min={0}
                    value={sheet.gapMm}
                    onChange={(event) => updateSheet({ gapMm: Number(event.target.value) || 0 })}
                  />
                </label>
                <label className="grid gap-1">
                  Margin (mm)
                  <Input
                    type="number"
                    min={0}
                    value={sheet.marginMm}
                    onChange={(event) => updateSheet({ marginMm: Number(event.target.value) || 0 })}
                  />
                </label>
              </div>
              <div>
                <SheetPreview sheet={sheet} label={doc.page} origins={origins} />
                <p className="mt-2 text-[11px] text-[#5f6368]">
                  {fitted.fits
                    ? `${slots} label${slots === 1 ? "" : "s"} per sheet · ${pageCount} PDF page${pageCount === 1 ? "" : "s"} · max ${fitted.columns} × ${fitted.rows}.`
                    : "Nothing will print until the whole sticker fits on this paper."}
                </p>
                <p className="mt-1 text-[11px] text-[#5f6368]">
                  Print at <span className="font-medium text-[#3c4043]">Actual size / 100%</span>. Fit to page shrinks
                  the sheet and shifts every label.
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-[#d0d7de] bg-[#f8f9fa] px-3 py-2 text-[13px] text-[#5f6368]">
              {labelCount} PDF page{labelCount === 1 ? "" : "s"}, each the same size as the sticker. Use this for a
              dedicated label printer. In the system print dialog, set paper to match {doc.page.widthMm} ×{" "}
              {doc.page.heightMm} mm if your driver allows custom sizes, and print at Actual size / 100% (not Fit to
              page).
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={Boolean(busy)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(busy) || !canPrint}
            onClick={() => onConfirm("download", doc, mode === "sheet" ? sheet : undefined)}
          >
            {busy === "download" ? "Preparing…" : "Download PDF"}
          </Button>
          <Button
            className="bg-[#1b4f9c] text-white hover:bg-[#163f7c]"
            disabled={Boolean(busy) || !canPrint}
            onClick={() => onConfirm("print", doc, mode === "sheet" ? sheet : undefined)}
          >
            {busy === "print" ? "Preparing…" : "Print"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
