"use client";

import { Hint } from "@/components/hint";
import { PaperSetupDialog } from "@/components/print/paper-setup-dialog";
import { PrintTemplateSelect } from "@/components/print/template-select";
import { Spreadsheet } from "@/components/print/spreadsheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyVersionSnapshot } from "@/lib/versions";
import { downloadExcelTemplate, schemaColumns } from "@/lib/excel";
import { columnHeader, headerForColumn, printDataRows, printLabelIndexes } from "@/lib/grid";
import { generatePdf, pdfFileName } from "@/lib/pdf";
import type { LabelDocument, SheetLayout } from "@/lib/document";
import { previewRow } from "@/lib/resolve";
import { evaluateGenerateRun, generateIssueCellKeys, runStatusAttentionLabel, runStatusLabel, summarizeGenerateIssues } from "@/lib/run-status";
import { generationVersion } from "@/lib/workspace";
import { assetsForOrganization, foldersForOrganization } from "@/lib/assets";
import { templateStatusOf } from "@/lib/template-library";
import { canGenerateTemplate } from "@/lib/roles";
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
  const completeLabelJob = useAppStore((s) => s.completeLabelJob);
  const role = useAppStore((s) => s.role());
  const orgId = useAppStore((s) => s.currentOrganizationId);
  const setColumnRequired = useAppStore((s) => s.setColumnRequired);
  const assetsAll = useAssetStore((s) => s.assets);
  const assetFoldersAll = useAssetStore((s) => s.folders);
  const assets = useMemo(() => assetsForOrganization(assetsAll, orgId), [assetsAll, orgId]);
  const assetFolders = useMemo(() => foldersForOrganization(assetFoldersAll, orgId), [assetFoldersAll, orgId]);
  const fileRef = useRef<HTMLInputElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState<"print" | "download" | null>(null);
  const [paperOpen, setPaperOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validOnly, setValidOnly] = useState(true);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [gridFocus, setGridFocus] = useState<{ row: number; header: string; n: number } | null>(null);
  const [draft, setDraft] = useState<{ row: number; header: string; value: string } | null>(null);
  const labelsListRef = useRef<HTMLDivElement>(null);
  const [labelsWidth, setLabelsWidth] = useState(() =>
    clamp(readStoredSize(LABELS_WIDTH_KEY, 196), LABELS_MIN, LABELS_MAX),
  );
  const [previewWidth, setPreviewWidth] = useState(() =>
    clamp(readStoredSize(PREVIEW_WIDTH_KEY, 460), PREVIEW_MIN, PREVIEW_MAX),
  );

  const doc = documents.find((item) => item.id === currentId) ?? null;
  const layoutDoc = useMemo(() => {
    if (!doc) return null;
    if (role === "operator") {
      const info = generationVersion(doc, "operator");
      return info.snapshot ? applyVersionSnapshot(doc, info.snapshot) : null;
    }
    return doc;
  }, [doc, role]);
  const template = role === "operator" ? layoutDoc : doc;
  const columns = template ? schemaColumns(template) : [];
  const liveRows = useMemo(() => {
    if (!draft || !data.headers.includes(draft.header)) return data.rows;
    if (draft.row < 0 || draft.row >= data.rows.length) return data.rows;
    return data.rows.map((row, index) =>
      index === draft.row ? { ...row, [draft.header]: draft.value } : row,
    );
  }, [data.headers, data.rows, draft]);
  const staticTemplate = columns.length === 0;
  const filled = useMemo(
    () => (template ? printLabelIndexes(template, liveRows, data.headers) : []),
    [template, data.headers, liveRows],
  );
  const sample = previewRow(liveRows, data.previewRowIndex);
  const firstHeader = data.headers[0];
  const runStatus = useMemo(
    () => (template ? evaluateGenerateRun(template, liveRows, data.headers, data.mapping, assets, assetFolders) : null),
    [assetFolders, assets, data.headers, data.mapping, liveRows, template],
  );
  const allPrintRows = template ? printDataRows(template, data.rows, data.headers) : [];
  const printIndexes = template ? printLabelIndexes(template, data.rows, data.headers) : [];
  const invalidIndexes = new Set(runStatus?.issues.map((issue) => issue.rowIndex) ?? []);
  const validPrintRows = allPrintRows.filter((_, index) => !invalidIndexes.has(printIndexes[index] ?? -1));
  const printRows = validOnly && runStatus?.issues.length ? validPrintRows : allPrintRows;

  useEffect(() => {
    if (hydrated && doc) ensurePrintGrid();
  }, [doc?.id, hydrated, ensurePrintGrid]);

  useEffect(() => {
    if (hydrated && doc) markTemplateUsed(doc.id, "open");
  }, [doc?.id, hydrated, markTemplateUsed]);

  useEffect(() => {
    setDraft(null);
  }, [doc?.id]);

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

  async function withRows(kind: "print" | "download", run: (rows: typeof allPrintRows) => Promise<void>) {
    if (!doc) return;
    const rows = validOnly && runStatus?.issues.length ? validPrintRows : allPrintRows;
    if (!rows.length) {
      toast.error(runStatus?.issues.length ? "No valid rows to generate" : "Fill at least one row first");
      return;
    }
    if (!canGenerateTemplate(role ?? "admin", templateStatusOf(doc))) {
      toast.error("This template is archived and cannot be generated");
      return;
    }
    if (role === "operator" && !layoutDoc) {
      toast.error("No published version is available for operators");
      return;
    }
    setBusy(kind);
    try {
      await run(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create PDF";
      const version = generationVersion(doc, role === "operator" ? "operator" : "designer");
      completeLabelJob({
        templateId: doc.id,
        templateName: doc.name,
        templateVersionId: version.versionId,
        templateVersionNumber: version.versionNumber,
        quantity: 0,
        sourceType: data.fileName ? "excel" : "manual",
        action: kind,
        fileName: data.fileName ?? undefined,
        rowCount: rows.length,
        successCount: 0,
        failedCount: rows.length,
        status: "failed",
        error: message,
      });
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  function openPaperSetup() {
    if (!printRows.length && !allPrintRows.length) {
      toast.error("Fill at least one row first");
      return;
    }
    if (runStatus?.issues.length) {
      setValidationOpen(true);
      return;
    }
    setValidOnly(false);
    setPaperOpen(true);
  }

  function downloadBlankExcel() {
    if (!doc) return;
    try {
      downloadExcelTemplate(doc, { blank: true });
      toast.success("Downloaded a blank Excel with this template’s columns");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build Excel");
    }
  }

  async function confirmPaper(action: "print" | "download", current: LabelDocument, sheet: SheetLayout | undefined) {
    if (sheet) setSheet(sheet);
    const source = template ?? current;
    const working = { ...source, sheet };
    const rowsForJob = validOnly && runStatus?.issues.length ? validPrintRows : allPrintRows;
    await withRows(action, async () => {
      if (!rowsForJob.length) throw new Error("No valid rows to generate");
      const bytes = await generatePdf(working, rowsForJob, data.mapping);
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
      const version = generationVersion(current, role === "operator" ? "operator" : "designer");
      completeLabelJob({
        templateId: current.id,
        templateName: current.name,
        templateVersionId: version.versionId,
        templateVersionNumber: version.versionNumber,
        quantity: rowsForJob.length,
        sourceType: data.fileName ? "excel" : "manual",
        action,
        fileName: data.fileName ?? undefined,
        pageSize: sheet?.pageSize ?? `${current.page.widthMm}×${current.page.heightMm}mm`,
        rowCount: allPrintRows.length,
        successCount: rowsForJob.length,
        failedCount: Math.max(0, allPrintRows.length - rowsForJob.length),
      });
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

  if (role === "operator" && !layoutDoc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">This template has no published version yet. Ask an admin to publish it.</p>
        <Button onClick={() => router.push("/templates")}>Back to templates</Button>
      </div>
    );
  }

  const archived = !canGenerateTemplate(role ?? "admin", templateStatusOf(doc));

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
          <Button variant="outline" size="sm" disabled={Boolean(busy) || !allPrintRows.length || archived} onClick={openPaperSetup}>
            <Download className="size-3.5" />
            Download PDF
          </Button>
          <Button
            size="sm"
            className="bg-[#1b4f9c] text-white hover:bg-[#163f7c]"
            disabled={Boolean(busy) || !allPrintRows.length || archived}
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
                const value = String(firstHeader ? (liveRows[index]?.[firstHeader] ?? "") : "").trim();
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
                    <span className="min-w-0 truncate text-[13px]">
                      {staticTemplate ? doc.name : value || "—"}
                    </span>
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
            <Preview document={layoutDoc ?? doc} row={sample} mapping={data.mapping} />
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
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">Add data</div>
                <p className="text-[11px] text-[#5f6368]">
                  {staticTemplate
                    ? "This sticker prints as designed. Bind fields in Designer if you later need a spreadsheet batch."
                    : "Download a blank Excel and fill it, or select column titles and copy them. One filled row becomes one label. Validate, then print or download. Results appear in History. * required — click the star to allow empty cells."}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto shrink-0 px-1.5 py-1 text-[#1b4f9c] hover:bg-transparent hover:text-[#153e7a]"
                disabled={!columns.length}
                onClick={downloadBlankExcel}
              >
                <Download className="size-3.5" />
                Download Excel
              </Button>
            </div>
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
                columnOptions={Object.fromEntries(
                  columns
                    .filter((column) => column.values?.length)
                    .map((column) => [columnHeader(column), column.values!]),
                )}
                requiredHeaders={requiredHeaders}
                issueCells={issueCells}
                focusCell={gridFocus}
                rows={data.rows}
                activeRow={data.previewRowIndex}
                onActiveRow={setPreviewRow}
                onChangeCell={setGridCell}
                onChangeCells={setGridCells}
                onDraftChange={setDraft}
                onToggleRequired={(header) => setColumnRequired(header, !requiredHeaders.has(header))}
                onEnsureRows={ensureGridRows}
                onPasteMatrix={(row, col, text, dest) => {
                  const result = pasteGrid(row, col, text, dest);
                  if (result.rows) toast.success(`Pasted ${result.rows} × ${result.cols}`);
                }}
              />
            </div>
          ) : columns.length ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[#5f6368]">Preparing sheet…</div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-[#5f6368]">
              <FileSpreadsheet className="size-8 text-[#d0d7de]" />
              <p>No spreadsheet columns — this template is a single sticker.</p>
              <p>Print or download the PDF as designed, or bind fields in Designer for a batch.</p>
              <Button variant="outline" size="sm" onClick={() => router.push("/designer")}>
                Open designer
              </Button>
            </div>
          )}
        </section>
      </div>

      <Dialog open={validationOpen} onOpenChange={setValidationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Validate data before generating</DialogTitle>
            <DialogDescription>
              {runStatus
                ? `${runStatus.ready} of ${runStatus.filled} rows are ready. ${runStatusAttentionLabel(runStatus)} Invalid rows are not printed until they are fixed.`
                : "Invalid rows are not printed until they are fixed."}
            </DialogDescription>
          </DialogHeader>
          {runStatus ? (
            <div className="space-y-2 text-sm text-[#3c4043]">
              <p>
                {runStatus.ready} of {runStatus.filled} rows are ready
              </p>
              {runStatus.issues.length ? (
                <p>
                  {runStatus.issues.length} row{runStatus.issues.length === 1 ? "" : "s"} need
                  {runStatus.issues.length === 1 ? "s" : ""} attention
                </p>
              ) : null}
              {(() => {
                const summary = summarizeGenerateIssues(runStatus);
                return (
                  <>
                    {summary.image ? <p>⚠ {summary.image} missing packaging images</p> : null}
                    {summary.address ? <p>⚠ {summary.address} invalid warehouse addresses</p> : null}
                    {summary.barcode ? <p>⚠ {summary.barcode} invalid barcodes</p> : null}
                    {summary.missing ? <p>✕ {summary.missing} missing required values</p> : null}
                    {summary.invalid ? <p>✕ {summary.invalid} invalid values</p> : null}
                    {summary.bindings ? (
                      <p>✕ {summary.bindings} missing column binding{summary.bindings === 1 ? "" : "s"}</p>
                    ) : null}
                  </>
                );
              })()}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setValidationOpen(false);
                showAttentionRows();
              }}
            >
              Review rejected rows
            </Button>
            <Button
              disabled={!validPrintRows.length}
              onClick={() => {
                setValidOnly(true);
                setValidationOpen(false);
                setPaperOpen(true);
              }}
            >
              Generate valid rows
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PaperSetupDialog
        open={paperOpen}
        onOpenChange={setPaperOpen}
        doc={layoutDoc ?? doc}
        labelCount={printRows.length}
        busy={busy}
        onConfirm={(action, current, sheet) => void confirmPaper(action, current, sheet)}
      />
    </div>
  );
}
