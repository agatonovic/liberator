"use client";

import { LabelPreview } from "@/components/print/label-preview";
import { buttonVariants } from "@/components/ui/button";
import { SHOPIFY_ORG_ID } from "@/lib/domain";
import { defaultSheetForLabel, generatePdf, pdfFileName } from "@/lib/pdf";
import { evaluateGenerateRun, runStatusAttentionLabel, runStatusLabel, summarizeGenerateIssues } from "@/lib/run-status";
import { useAppStore } from "@/lib/store";
import { generationVersion } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { shopifyLabelDataProvider } from "@/shopify/adapter";
import { defaultShopifyCatalogId, SHOPIFY_CATALOG, shopifyCatalogDocument } from "@/shopify/catalog";
import { DEMO_SHOPIFY_PRODUCTS } from "@/shopify/demo-store";
import { readShopifySelection, writeShopifySelection } from "@/shopify/selection";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

async function downloadPdfBytes(bytes: Uint8Array, name: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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

export function ShopifyLabelsView() {
  const completeLabelJob = useAppStore((s) => s.completeLabelJob);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState(defaultShopifyCatalogId());
  const [previewIndex, setPreviewIndex] = useState(0);
  const [busy, setBusy] = useState<"pdf" | "sheet" | "print" | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const selection = readShopifySelection();
    setProductIds(selection.productIds);
    setTemplateId(selection.templateId ?? defaultShopifyCatalogId());
    setReady(true);
  }, []);

  const template = useMemo(() => shopifyCatalogDocument(templateId), [templateId]);
  const [dataset, setDataset] = useState<Awaited<ReturnType<typeof shopifyLabelDataProvider.load>> | null>(null);

  useEffect(() => {
    if (!ready) return;
    void shopifyLabelDataProvider.load({ productIds }).then(setDataset);
  }, [productIds, ready]);

  const rows = dataset?.rows ?? [];
  const mapping = dataset?.mapping ?? {};
  const runStatus = useMemo(
    () => (dataset ? evaluateGenerateRun(template, dataset.rows, dataset.headers, dataset.mapping) : null),
    [dataset, template],
  );
  const validRows = useMemo(() => {
    if (!runStatus) return rows;
    const bad = new Set(runStatus.issues.map((issue) => issue.rowIndex));
    return rows.filter((_, index) => !bad.has(index));
  }, [rows, runStatus]);
  const previewRow = rows[Math.min(previewIndex, Math.max(0, rows.length - 1))] ?? null;
  const summary = runStatus ? summarizeGenerateIssues(runStatus) : null;
  const productCount = productIds.length;
  const labelCount = rows.length;

  function chooseTemplate(id: string) {
    setTemplateId(id);
    writeShopifySelection({ templateId: id });
  }

  async function generate(kind: "pdf" | "sheet" | "print") {
    if (!dataset || !rows.length) {
      toast.error("Select products first");
      return;
    }
    const useValidOnly = Boolean(runStatus?.issues.length);
    const jobRows = useValidOnly ? validRows : rows;
    if (!jobRows.length) {
      toast.error("No valid rows to generate");
      return;
    }
    setBusy(kind);
    const version = generationVersion(template, "designer");
    try {
      const working =
        kind === "sheet" ? { ...template, sheet: defaultSheetForLabel(template.page, template.sheet) } : template;
      const bytes = await generatePdf(working, jobRows, mapping);
      if (kind === "print") await printPdfBytes(bytes);
      else await downloadPdfBytes(bytes, pdfFileName(template.name));
      completeLabelJob({
        templateId: template.id,
        templateName: template.name,
        templateVersionId: version.versionId,
        templateVersionNumber: version.versionNumber,
        quantity: jobRows.length,
        sourceType: "shopify",
        action: kind === "print" ? "print" : "download",
        fileName: `${productCount} products`,
        pageSize:
          kind === "sheet"
            ? working.sheet?.pageSize
            : `${template.page.widthMm}×${template.page.heightMm}mm`,
        rowCount: rows.length,
        successCount: jobRows.length,
        failedCount: Math.max(0, rows.length - jobRows.length),
        organizationId: SHOPIFY_ORG_ID,
      });
      toast.success(kind === "print" ? "Print dialog opened" : "PDF downloaded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create PDF";
      completeLabelJob({
        templateId: template.id,
        templateName: template.name,
        templateVersionId: version.versionId,
        templateVersionNumber: version.versionNumber,
        quantity: 0,
        sourceType: "shopify",
        action: kind === "print" ? "print" : "download",
        fileName: `${productCount} products`,
        rowCount: rows.length,
        successCount: 0,
        failedCount: rows.length,
        status: "failed",
        error: message,
        organizationId: SHOPIFY_ORG_ID,
      });
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  if (!ready) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!productIds.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="font-heading text-2xl font-semibold">Choose products first</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Select the products you want labels for, then come back to pick a template and generate.
        </p>
        <Link href="/shopify/products" className={buttonVariants()}>
          Select products
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-8 py-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Labels</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {productCount} product{productCount === 1 ? "" : "s"} selected · {labelCount} label
          {labelCount === 1 ? "" : "s"} to generate
        </p>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="overflow-y-auto border-b border-border p-4 lg:border-r lg:border-b-0">
          <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Templates</p>
          <div className="flex flex-col gap-1">
            {SHOPIFY_CATALOG.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => chooseTemplate(entry.id)}
                className={cn(
                  "rounded-lg px-3 py-2 text-left text-sm",
                  entry.id === templateId ? "bg-sidebar-accent font-medium" : "hover:bg-muted",
                )}
              >
                {entry.name}
                <span className="block text-[12px] font-normal text-muted-foreground">{entry.description}</span>
              </button>
            ))}
          </div>
        </aside>
        <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 bg-[#f4f1ea] p-4">
            {previewRow && dataset ? (
              <LabelPreview document={template} row={previewRow} mapping={mapping} className="h-full min-h-[280px]" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No preview</div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2">
            <label className="text-sm text-muted-foreground">
              Preview
              <select
                className="ml-2 h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                value={Math.min(previewIndex, Math.max(0, rows.length - 1))}
                onChange={(event) => setPreviewIndex(Number(event.target.value))}
              >
                {rows.map((row, index) => (
                  <option key={`${row.sku}-${index}`} value={index}>
                    {row.title}
                    {row.variant ? ` · ${row.variant}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-[12px] text-muted-foreground">
              {DEMO_SHOPIFY_PRODUCTS.filter((item) => productIds.includes(item.id)).length === productIds.length
                ? previewRow?.sku || "No SKU"
                : null}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-8 py-3">
        <div className="text-sm">
          {runStatus ? <p>{runStatusLabel(runStatus)}</p> : null}
          {runStatus?.attention ? (
            <p className="text-destructive">
              {runStatusAttentionLabel(runStatus)}
              {summary?.missing ? ` · missing fields on ${summary.missing} row${summary.missing === 1 ? "" : "s"}` : ""}
              {summary?.barcode ? ` · barcode issues on ${summary.barcode}` : ""}
            </p>
          ) : (
            <p className="text-muted-foreground">Ready to generate with the shared PDF engine.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/shopify/products" className={buttonVariants({ variant: "outline" })}>
            Change products
          </Link>
          <button
            type="button"
            className={buttonVariants({ variant: "outline" })}
            disabled={!rows.length || busy !== null}
            onClick={() => void generate("sheet")}
          >
            {busy === "sheet" ? "Generating…" : "Download A4 sheet"}
          </button>
          <button
            type="button"
            className={buttonVariants({ variant: "outline" })}
            disabled={!rows.length || busy !== null}
            onClick={() => void generate("print")}
          >
            {busy === "print" ? "Opening…" : "Print"}
          </button>
          <button
            type="button"
            className={buttonVariants()}
            disabled={!rows.length || busy !== null}
            onClick={() => void generate("pdf")}
          >
            {busy === "pdf" ? "Generating…" : "Generate labels"}
          </button>
        </div>
      </div>
    </div>
  );
}
