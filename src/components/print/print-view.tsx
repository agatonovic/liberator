"use client";

import { Hint } from "@/components/hint";
import { PaperSetupDialog } from "@/components/print/paper-setup-dialog";
import { PrintTemplateSelect } from "@/components/print/template-select";
import { Spreadsheet } from "@/components/print/spreadsheet";
import { Button } from "@/components/ui/button";
import { schemaColumns } from "@/lib/excel";
import { columnHeader, filledRowIndexes, headerForColumn } from "@/lib/grid";
import { generatePdf, pdfFileName } from "@/lib/pdf";
import type { LabelDocument, SheetLayout } from "@/lib/document";
import { previewRow } from "@/lib/resolve";
import { evaluateGenerateRun, generateIssueCellKeys, runStatusLabel } from "@/lib/run-status";
import { useAssetStore } from "@/lib/asset-store";
import { useAppStore } from "@/lib/store";
import { Download, FileSpreadsheet, Printer, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";

const Preview = dynamic(() => import("@/components/print/label-preview").then((mod) => mod.LabelPreview), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#e8eaed]" />,
});

const LABELS_WIDTH_KEY = "labelator.printLabelsWidth";
const PREVIEW_WIDTH_KEY = "labelator.printPreviewWidth";
const LABELS_MIN = 140;
const LABELS_MAX = 420;
const PREVIEW_MIN = 280;
const PREVIEW_MAX = 960;
const DATA_MIN = 300;
const HANDLE = 6;

function readStoredSize(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function VerticalHandle({
  label,
  getStart,
  apply,
  persistKey,
}: {
  label: string;
  getStart: () => number;
  apply: (start: number, dx: number) => number;
  persistKey: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title="Drag to resize"
      className="hidden w-1.5 shrink-0 cursor-ew-resize hover:bg-[#1b4f9c]/40 lg:block"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const startX = event.clientX;
        const start = getStart();
        const handle = event.currentTarget;
        let latest = start;
        function onMove(moveEvent: PointerEvent) {
          latest = apply(start, moveEvent.clientX - startX);
        }
        function onUp(upEvent: PointerEvent) {
          handle.removeEventListener("pointermove", onMove);
          handle.removeEventListener("pointerup", onUp);
          if (handle.hasPointerCapture(upEvent.pointerId)) handle.releasePointerCapture(upEvent.pointerId);
          window.localStorage.setItem(persistKey, String(latest));
        }
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
      }}
    />
  );
}

async function printPdfBytes(bytes: Uint8Array) {
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new Error("Allow pop-ups to print");
  }
  window.setTimeout(() => {
    try {
      opened.focus();
      opened.print();
    } catch {
      /* user can print from the tab */
    }
  }, 600);
}

export function PrintView() {
  const hydrated = useAppStore((s) => s.hydrated);
  const documents = useAppStore((s) => s.documents);
  const currentId = useAppStore((s) => s.currentId);
  const data = useAppStore((s) => s.data);
  const ensurePrintGrid = useAppStore((s) => s.ensurePrintGrid);
  const ensureGridRows = useAppStore((s) => s.ensureGridRows);
  const setPreviewRow = useAppStore((s) => s.setPreviewRow);
  const setGridCell = useAppStore((s) => s.setGridCell);
  const setGridCells = useAppStore((s) => s.setGridCells);
  const undoData = useAppStore((s) => s.undoData);
  const redoData = useAppStore((s) => s.redoData);
  const pasteGrid = useAppStore((s) => s.pasteGrid);
  const loadWorkbook = useAppStore((s) => s.loadWorkbook);
  const setSheet = useAppStore((s) => s.setSheet);
  const markTemplateUsed = useAppStore((s) => s.markTemplateUsed);
  const setColumnRequired = useAppStore((s) => s.setColumnRequired);
  const assets = useAssetStore((s) => s.assets);
  const assetFolders = useAssetStore((s) => s.folders);
  const fileRef = useRef<HTMLInputElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState<"print" | "download" | null>(null);
  const [paperOpen, setPaperOpen] = useState(false);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [gridFocus, setGridFocus] = useState<{ row: number; header: string; n: number } | null>(null);
  const labelsListRef = useRef<HTMLDivElement>(null);
  const [labelsWidth, setLabelsWidth] = useState(() =>
    clamp(readStoredSize(LABELS_WIDTH_KEY, 196), LABELS_MIN, LABELS_MAX),
  );
  const [previewWidth, setPreviewWidth] = useState(() =>
    clamp(readStoredSize(PREVIEW_WIDTH_KEY, 460), PREVIEW_MIN, PREVIEW_MAX),
  );

  const doc = documents.find((item) => item.id === currentId) ?? null;
  const columns = doc ? schemaColumns(doc) : [];
  const filled = useMemo(() => filledRowIndexes(data.rows, data.headers), [data.headers, data.rows]);
  const sample = previewRow(data.rows, data.previewRowIndex);
  const printRows = filled.map((index) => data.rows[index]).filter(Boolean);
  const firstHeader = data.headers[0];
  const runStatus = useMemo(
    () => (doc ? evaluateGenerateRun(doc, data.rows, data.headers, data.mapping, assets, assetFolders) : null),
    [assetFolders, assets, data.headers, data.mapping, data.rows, doc],
  );

  useEffect(() => {
    if (hydrated && doc) ensurePrintGrid();
  }, [doc?.id, hydrated, ensurePrintGrid]);

  useEffect(() => {
    if (hydrated && doc) markTemplateUsed(doc.id, "open");
  }, [doc?.id, hydrated, markTemplateUsed]);

  useEffect(() => {
    if (!runStatus?.attention) setAttentionOnly(false);
  }, [runStatus?.attention]);

  useEffect(() => {
    function typing(target: EventTarget | null) {
      return (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      );
    }
    function onKey(event: KeyboardEvent) {
      const cmd = event.metaKey || event.ctrlKey;
      if (!cmd) return;
      const key = event.key.toLowerCase();
      if (key === "z" || event.code === "KeyZ") {
        if (typing(event.target) && !event.shiftKey) return;
        event.preventDefault();
        if (event.shiftKey) redoData();
        else undoData();
        return;
      }
      if (key === "y" || event.code === "KeyY") {
        if (typing(event.target)) return;
        event.preventDefault();
        redoData();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [redoData, undoData]);

  function splitBudget() {
    return (splitRef.current?.clientWidth ?? 1200) - DATA_MIN - HANDLE * 2;
  }

  useEffect(() => {
    function fit() {
      const budget = splitBudget();
      if (budget < LABELS_MIN + PREVIEW_MIN) return;
      setLabelsWidth((labels) => {
        const nextLabels = clamp(labels, LABELS_MIN, Math.min(LABELS_MAX, budget - PREVIEW_MIN));
        setPreviewWidth((preview) => clamp(preview, PREVIEW_MIN, Math.min(PREVIEW_MAX, budget - nextLabels)));
        return nextLabels;
      });
    }
    window.addEventListener("resize", fit);
    fit();
    return () => window.removeEventListener("resize", fit);
  }, []);

  async function withRows(kind: "print" | "download", run: (rows: typeof printRows) => Promise<void>) {
    if (!doc) return;
    if (!printRows.length) {
      toast.error("Fill at least one row first");
      return;
    }
    setBusy(kind);
    try {
      await run(printRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create PDF");
    } finally {
      setBusy(null);
    }
  }

  function openPaperSetup() {
    if (!printRows.length) {
      toast.error("Fill at least one row first");
      return;
    }
    setPaperOpen(true);
  }

  async function confirmPaper(action: "print" | "download", current: LabelDocument, sheet: SheetLayout | undefined) {
    if (sheet) setSheet(sheet);
    const working = { ...current, sheet };
    await withRows(action, async (rows) => {
      const bytes = await generatePdf(working, rows, data.mapping);
      if (action === "download") {
        const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = pdfFileName(current.name);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        toast.success("PDF downloaded");
      } else {
        await printPdfBytes(bytes);
        toast.success("Print dialog opened");
      }
      setPaperOpen(false);
      markTemplateUsed(current.id, "generate");
    });
  }

  if (!hydrated) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">Pick a template, then add data and generate labels.</p>
        <Button onClick={() => router.push("/templates")}>Go to templates</Button>
      </div>
    );
  }

  const filtering = Boolean(attentionOnly && runStatus?.attention);
  const allLabelIndexes = filled;
  const labelIndexes = filtering ? runStatus!.issues.map((issue) => issue.rowIndex) : allLabelIndexes;
  const issueCells = runStatus ? generateIssueCellKeys(runStatus) : undefined;
  const requiredHeaders = new Set(
    columns
      .filter((column) => column.required !== false)
      .map((column) => headerForColumn(column, data.mapping, data.headers))
      .filter((header): header is string => Boolean(header)),
  );

  function showAttentionRows() {
    if (!runStatus?.attention) return;
    if (attentionOnly) {
      setAttentionOnly(false);
      return;
    }
    const first = runStatus.issues[0];
    setAttentionOnly(true);
    setPreviewRow(first.rowIndex);
    setGridFocus({
      row: first.rowIndex,
      header: first.headers[0] ?? data.headers[0] ?? "",
      n: Date.now(),
    });
    requestAnimationFrame(() => {
      const node = labelsListRef.current?.querySelector(`[data-label-row="${first.rowIndex}"]`);
      if (node instanceof HTMLElement) node.scrollIntoView({ block: "nearest" });
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f4f6f8]">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#d0d7de] bg-white px-4 py-2.5">
        <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-2 text-sm">
          <span className="shrink-0 text-[#5f6368]">Template</span>
          <PrintTemplateSelect current={doc} />
          {runStatus ? (
            <Hint
              label={
                runStatus.attention
                  ? filtering
                    ? "Show all labels"
                    : "Show only labels that need attention"
                  : runStatus.filled
                    ? "Every required cell is filled"
                    : "No rows to generate yet"
              }
            >
              <button
                type="button"
                disabled={!runStatus.attention}
                aria-pressed={filtering}
                onClick={showAttentionRows}
                className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${
                  runStatus.attention
                    ? "bg-[#fef7e0] text-[#8a5a00] hover:bg-[#fdecc8]"
                    : runStatus.filled
                      ? "bg-[#e6f4ea] text-[#137333]"
                      : "bg-[#f1f3f4] text-[#5f6368]"
                } ${filtering ? "ring-1 ring-[#e37400]" : ""} disabled:cursor-default`}
              >
              {filtering
                ? `Showing ${runStatus.attention} that need attention`
                : runStatusLabel(runStatus)}
            </button>
            </Hint>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" />
            Load Excel
          </Button>
          <Button variant="outline" size="sm" disabled={Boolean(busy) || !printRows.length} onClick={openPaperSetup}>
            <Download className="size-3.5" />
            Download PDF
          </Button>
          <Button
            size="sm"
            className="bg-[#1b4f9c] text-white hover:bg-[#163f7c]"
            disabled={Boolean(busy) || !printRows.length}
            onClick={openPaperSetup}
          >
            <Printer className="size-3.5" />
            Print
          </Button>
        </div>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            await loadWorkbook(file);
            toast.success(`Loaded ${file.name}`);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not read file");
          }
        }}
      />

      <div ref={splitRef} className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex h-[42vh] min-h-0 min-w-0 border-b border-[#d0d7de] lg:h-auto lg:contents lg:border-b-0">
        <section
          className="flex min-h-0 w-[var(--pane-w)] shrink-0 flex-col border-r border-[#d0d7de] bg-white lg:h-auto"
          style={{ "--pane-w": `${labelsWidth}px` } as CSSProperties}
        >
          <div className="border-b border-[#d0d7de] px-3 py-2 text-[11px] font-semibold tracking-wide text-[#5f6368] uppercase">
            {filtering ? "Needs attention" : "Labels"}
          </div>
          <div ref={labelsListRef} className="min-h-0 flex-1 overflow-y-auto p-1">
            {labelIndexes.length ? (
              labelIndexes.map((index) => {
                const active = index === data.previewRowIndex;
                const value = String(firstHeader ? (data.rows[index]?.[firstHeader] ?? "") : "").trim();
                const issue = runStatus?.issues.find((item) => item.rowIndex === index);
                return (
                  <button
                    key={index}
                    type="button"
                    data-label-row={index}
                    title={issue ? issue.reasons.join(" · ") : undefined}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left ${
                      active ? "bg-[#1b4f9c] text-white" : "text-[#202124] hover:bg-[#e8f0fe]"
                    }`}
                    onClick={() => {
                      setPreviewRow(index);
                      if (issue?.headers[0]) {
                        setGridFocus({ row: index, header: issue.headers[0], n: Date.now() });
                      }
                    }}
                  >
                    <span
                      className={`w-5 shrink-0 font-mono text-[10px] tabular-nums ${
                        active ? "text-white/70" : issue ? "text-[#8a5a00]" : "text-[#80868b]"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {issue ? (
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${active ? "bg-white" : "bg-[#e37400]"}`}
                        aria-hidden
                      />
                    ) : null}
                    <span className="min-w-0 truncate text-[13px]">{value || "—"}</span>
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-6 text-[12px] leading-5 text-[#5f6368]">
                {filtering ? "No labels need attention." : "No labels yet. Fill a row or load Excel."}
              </p>
            )}
          </div>
        </section>

        <VerticalHandle
          label="Resize labels"
          persistKey={LABELS_WIDTH_KEY}
          getStart={() => labelsWidth}
          apply={(start, dx) => {
            const max = clamp(splitBudget() - previewWidth, LABELS_MIN, LABELS_MAX);
            const next = clamp(start + dx, LABELS_MIN, max);
            setLabelsWidth(next);
            return next;
          }}
        />

        <section
          className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-[#d0d7de] bg-white lg:w-[var(--pane-w)] lg:flex-none"
          style={{ "--pane-w": `${previewWidth}px` } as CSSProperties}
        >
          <div className="border-b border-[#d0d7de] px-3 py-2">
            <div className="text-[11px] font-semibold tracking-wide text-[#5f6368] uppercase">Review</div>
            <div className="text-sm font-medium">{doc.name}</div>
            <p className="text-[11px] text-[#5f6368]">
              {doc.page.widthMm} × {doc.page.heightMm} mm
              {printRows.length
                ? ` · ${printRows.length} label${printRows.length === 1 ? "" : "s"}`
                : " · template preview"}
            </p>
          </div>
          <div className="min-h-0 flex-1">
            <Preview document={doc} row={sample} mapping={data.mapping} />
          </div>
        </section>
        </div>

        <VerticalHandle
          label="Resize preview"
          persistKey={PREVIEW_WIDTH_KEY}
          getStart={() => previewWidth}
          apply={(start, dx) => {
            const max = clamp(splitBudget() - labelsWidth, PREVIEW_MIN, PREVIEW_MAX);
            const next = clamp(start + dx, PREVIEW_MIN, max);
            setPreviewWidth(next);
            return next;
          }}
        />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
          <div className="border-b border-[#d0d7de] px-3 py-2">
            <div className="text-sm font-medium">Add data</div>
            <p className="text-[11px] text-[#5f6368]">
              Load Excel or paste rows. One filled row becomes one label. * required — click a column name to allow
              empty cells.
            </p>
          </div>
          {data.headers.length ? (
            <div className="min-h-0 flex-1">
              <Spreadsheet
                headers={data.headers}
                columnHints={Object.fromEntries(
                  columns
                    .filter((column) => column.values?.length)
                    .map((column) => [columnHeader(column), column.values!.join(" or ")]),
                )}
                requiredHeaders={requiredHeaders}
                issueCells={issueCells}
                focusCell={gridFocus}
                rows={data.rows}
                activeRow={data.previewRowIndex}
                onActiveRow={setPreviewRow}
                onChangeCell={setGridCell}
                onChangeCells={setGridCells}
                onToggleRequired={(header) => setColumnRequired(header, !requiredHeaders.has(header))}
                onEnsureRows={ensureGridRows}
                onPasteMatrix={(row, col, text) => {
                  const result = pasteGrid(row, col, text);
                  if (result.rows) toast.success(`Pasted ${result.rows} × ${result.cols}`);
                }}
              />
            </div>
          ) : columns.length ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[#5f6368]">Preparing sheet…</div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-[#5f6368]">
              <FileSpreadsheet className="size-8 text-[#d0d7de]" />
              <p>This template has no bound columns yet.</p>
              <p>In Designer, select a field and set Bind to column.</p>
              <Button variant="outline" size="sm" onClick={() => router.push("/designer")}>
                Open designer
              </Button>
            </div>
          )}
        </section>
      </div>

      <PaperSetupDialog
        open={paperOpen}
        onOpenChange={setPaperOpen}
        doc={doc}
        labelCount={printRows.length}
        busy={busy}
        onConfirm={(action, current, sheet) => void confirmPaper(action, current, sheet)}
      />
    </div>
  );
}
