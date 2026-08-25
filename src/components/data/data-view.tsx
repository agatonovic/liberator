"use client";

import { Button } from "@/components/ui/button";
import { schemaColumns, downloadExcelTemplate } from "@/lib/excel";
import { missingBindings, previewRow } from "@/lib/resolve";
import { useAppStore } from "@/lib/store";
import { Download, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { toast } from "sonner";

export function DataView() {
  const hydrated = useAppStore((s) => s.hydrated);
  const documents = useAppStore((s) => s.documents);
  const currentId = useAppStore((s) => s.currentId);
  const data = useAppStore((s) => s.data);
  const loadWorkbook = useAppStore((s) => s.loadWorkbook);
  const setMapping = useAppStore((s) => s.setMapping);
  const autoMap = useAppStore((s) => s.autoMap);
  const setPreviewRow = useAppStore((s) => s.setPreviewRow);
  const clearData = useAppStore((s) => s.clearData);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const doc = documents.find((item) => item.id === currentId) ?? null;
  const columns = doc ? schemaColumns(doc) : [];
  const missing = doc && data.headers.length ? missingBindings(doc, data.mapping, data.headers) : [];
  const sample = previewRow(data.rows, data.previewRowIndex);
  const showMapper = Boolean(data.headers.length && missing.length);

  if (!hydrated) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">Pick a template first — then download its Excel file here.</p>
        <Button onClick={() => router.push("/templates")}>Go to templates</Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Data</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {doc.name} already knows its columns. Download the Excel file, fill one row per label, then upload it.
          </p>
        </div>
        <div className="flex gap-2">
          {data.fileName ? (
            <Button variant="outline" onClick={clearData}>
              Clear
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => {
              try {
                downloadExcelTemplate(doc);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not build Excel template");
              }
            }}
            disabled={!columns.length}
          >
            <Download className="size-4" />
            Download Excel
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Upload Excel
          </Button>
        </div>
      </div>
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

      {columns.length ? (
        <section className="mb-8 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Excel structure</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Use these headers (or the aliases). Mapping is automatic when names match.
          </p>
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-2 py-1">Column</th>
                  <th className="px-2 py-1">Also accepts</th>
                  <th className="px-2 py-1">Example</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((column) => (
                  <tr key={column.key} className="border-t border-border">
                    <td className="px-2 py-1.5 font-medium">
                      {column.headers[0] || column.label}
                      {column.required === false ? (
                        <span className="ml-2 text-[11px] font-normal text-muted-foreground">optional</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{column.headers.slice(1).join(", ") || "—"}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">{column.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="mb-8 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          This blank design has no Excel columns yet. In the designer, select text/barcode/QR and set{" "}
          <span className="font-medium text-foreground">Bind to column</span>, then come back here to download Excel.
        </p>
      )}

      {showMapper ? (
        <section className="mb-8 rounded-xl border border-destructive/30 bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Could not match some columns</h2>
            <Button size="sm" variant="outline" onClick={autoMap}>
              Auto-match again
            </Button>
          </div>
          <p className="mb-3 text-sm text-destructive">Unmapped: {missing.join(", ")}</p>
          <div className="grid gap-2">
            {columns.map((column) => (
              <label key={column.key} className="grid grid-cols-[180px_1fr] items-center gap-3 text-sm">
                <span className="font-medium">{column.label}</span>
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2"
                  value={data.mapping[column.key] ?? ""}
                  onChange={(event) => setMapping(column.key, event.target.value)}
                >
                  <option value="">Choose column…</option>
                  {data.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {data.rows.length ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">
              {data.fileName} · {data.rows.length} rows — go to{" "}
              <Link href="/generate" className="text-primary underline-offset-2 hover:underline">
                Generate
              </Link>
            </h2>
            <label className="flex items-center gap-2 text-sm">
              Preview row
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2"
                value={String(data.previewRowIndex)}
                onChange={(event) => setPreviewRow(Number(event.target.value))}
              >
                {data.rows.map((_, index) => (
                  <option key={index} value={index}>
                    {index + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="overflow-auto rounded-xl border border-border bg-card">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
                <tr>
                  {data.headers.map((header) => (
                    <th key={header} className="px-3 py-2 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.slice(0, 50).map((row, index) => (
                  <tr
                    key={index}
                    className={index === data.previewRowIndex ? "bg-accent" : "odd:bg-transparent even:bg-muted/30"}
                  >
                    {data.headers.map((header) => (
                      <td key={header} className="px-3 py-1.5 whitespace-nowrap">
                        {row[header]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sample ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Row {data.previewRowIndex + 1} is used for live preview in the designer.
            </p>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">No spreadsheet loaded yet.</p>
      )}
    </div>
  );
}
