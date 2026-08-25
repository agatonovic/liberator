"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { documentBindings, SHEET_PAGE_OPTIONS, type SheetLayout, type SheetPageSize } from "@/lib/document";
import { downloadBlob } from "@/lib/excel";
import { computeSlotOrigins, fitLabelOnSheet, generatePdf, sheetPageSizeMm } from "@/lib/pdf";
import { missingBindings } from "@/lib/resolve";
import { useAppStore } from "@/lib/store";
import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
  const maxSide = 420;
  const scale = Math.min(maxSide / page.widthMm, 280 / page.heightMm);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[#ece8df] p-3">
      <svg
        viewBox={`0 0 ${page.widthMm} ${page.heightMm}`}
        width={page.widthMm * scale}
        height={page.heightMm * scale}
        className="mx-auto block bg-white shadow-sm"
        role="img"
        aria-label="Sheet preview"
      >
        <rect x={0} y={0} width={page.widthMm} height={page.heightMm} fill="#fff" stroke="#d0cbc0" strokeWidth={0.4} />
        {origins.map((origin, index) => (
          <g key={`${origin.xMm}-${origin.yMm}-${index}`}>
            <rect
              x={origin.xMm}
              y={origin.yMm}
              width={label.widthMm}
              height={label.heightMm}
              fill="#e4f3f1"
              stroke="#0f8a80"
              strokeWidth={0.35}
            />
            <text
              x={origin.xMm + label.widthMm / 2}
              y={origin.yMm + label.heightMm / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#0b5f58"
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

export function GenerateView() {
  const hydrated = useAppStore((s) => s.hydrated);
  const documents = useAppStore((s) => s.documents);
  const currentId = useAppStore((s) => s.currentId);
  const data = useAppStore((s) => s.data);
  const setSheet = useAppStore((s) => s.setSheet);
  const doc = documents.find((item) => item.id === currentId) ?? null;
  const [busy, setBusy] = useState(false);
  const [nUp, setNUp] = useState(Boolean(doc?.sheet));
  const [autoFit, setAutoFit] = useState(true);
  const bindings = useMemo(() => (doc ? documentBindings(doc) : []), [doc]);
  const missing = doc ? missingBindings(doc, data.mapping, data.headers) : [];
  const rowCount = data.rows.length || 1;
  const sheet = doc?.sheet ?? {
    pageSize: "A3-landscape" as SheetPageSize,
    columns: 1,
    rows: 1,
    gapMm: 2,
    marginMm: 4,
  };

  useEffect(() => {
    setNUp(Boolean(doc?.sheet));
  }, [doc?.id]);

  const fitted = doc ? fitLabelOnSheet(doc.page, sheet.pageSize, sheet.gapMm, sheet.marginMm) : null;
  const origins = doc ? computeSlotOrigins(nUp ? sheet : { ...sheet, columns: 1, rows: 1 }, doc.page) : [];
  const slots = Math.max(1, origins.length);
  const pageCount = nUp ? Math.ceil(rowCount / slots) : rowCount;
  const sheetMm = sheetPageSizeMm(sheet.pageSize);

  function updateSheet(patch: Partial<SheetLayout>) {
    if (!doc) return;
    const next = { ...sheet, ...patch };
    if (autoFit && (patch.pageSize != null || patch.gapMm != null || patch.marginMm != null || patch.columns == null)) {
      const fit = fitLabelOnSheet(doc.page, next.pageSize, next.gapMm, next.marginMm);
      next.columns = fit.columns;
      next.rows = fit.rows;
    }
    setSheet(next);
  }

  if (!hydrated) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Create a template first.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Generate</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-muted-foreground">
        Design each sticker at its own size, then pack copies onto A4, A3, or Letter. Labelator
        counts how many fit and shows a sheet preview before you download the PDF.
      </p>

      <div className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="grid gap-4 content-start">
          <section className="rounded-xl border border-border bg-card p-4 text-sm">
            <div className="font-medium">{doc.name}</div>
            <p className="mt-1 text-muted-foreground">
              Sticker {doc.page.widthMm} × {doc.page.heightMm} mm · {bindings.length} bound fields ·{" "}
              {data.rows.length ? `${data.rows.length} data rows` : "one sample label (no spreadsheet)"}
            </p>
            {missing.length && data.headers.length ? (
              <p className="mt-2 text-destructive">Unmapped columns: {missing.join(", ")}</p>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Pack on a sheet</div>
                <p className="text-xs text-muted-foreground">Repeat this sticker on A4 / A3 / Letter.</p>
              </div>
              <Switch
                checked={nUp}
                onCheckedChange={(checked) => {
                  const enabled = Boolean(checked);
                  setNUp(enabled);
                  if (enabled) {
                    const fit = fitLabelOnSheet(doc.page, sheet.pageSize, sheet.gapMm, sheet.marginMm);
                    setSheet({ ...sheet, columns: autoFit ? fit.columns : sheet.columns, rows: autoFit ? fit.rows : sheet.rows });
                  }
                }}
              />
            </div>
            {nUp ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="grid gap-1 col-span-2">
                  Sheet
                  <select
                    className="h-8 rounded-lg border border-input bg-transparent px-2"
                    value={sheet.pageSize}
                    onChange={(event) => updateSheet({ pageSize: event.target.value as SheetPageSize })}
                  >
                    {SHEET_PAGE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {sheetMm.widthMm} × {sheetMm.heightMm} mm
                  {fitted && !fitted.fits ? " · sticker is larger than this sheet minus margins" : null}
                </div>
                <label className="flex items-center justify-between gap-2 col-span-2 rounded-lg border border-border px-3 py-2">
                  <span>
                    <span className="block text-sm">Auto-fit</span>
                    <span className="block text-xs text-muted-foreground">Fill the sheet from sticker size, gap, and margin.</span>
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
                    max={fitted?.columns ?? 20}
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
                    max={fitted?.rows ?? 20}
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
                <p className="col-span-2 text-xs text-muted-foreground">
                  {slots} label{slots === 1 ? "" : "s"} per sheet · {pageCount} PDF page
                  {pageCount === 1 ? "" : "s"}
                  {fitted ? ` · max ${fitted.columns} × ${fitted.rows}` : null}.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                One PDF page per label, sized to {doc.page.widthMm} × {doc.page.heightMm} mm.
              </p>
            )}
          </section>

          <Button
            size="lg"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const working = nUp ? { ...doc, sheet } : { ...doc, sheet: undefined };
                const bytes = await generatePdf(working, data.rows, data.mapping);
                const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
                downloadBlob(blob, `${doc.name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
                toast.success("PDF downloaded");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not generate PDF");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download className="size-4" />
            {busy ? "Generating…" : "Download PDF"}
          </Button>
        </div>

        {nUp ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 text-sm font-medium">Sheet preview</div>
            <SheetPreview sheet={sheet} label={doc.page} origins={origins} />
            <p className="mt-3 text-xs text-muted-foreground">
              Stickers are centered on the sheet. Extra columns or rows that do not fit are ignored.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
