import type { LabelDocument } from "../document";
import { repairTemplateDocument } from "../document";
import { isShopifyLibraryDocument } from "../library-guard";
import { catalogPrintMode } from "./catalog-export";
import { analyzePortableExport, type RendererCompatibility } from "./compatibility";

export type TemplateCompatibilityAudit = {
  name: string;
  id: string;
  catalog: string;
  status: "compatible" | "incompatible" | "unexportable";
  detected: string[];
  unsupported: string[];
  reason?: string;
};

function classify(document: LabelDocument): TemplateCompatibilityAudit {
  const catalog = document.catalogId?.trim() || "—";
  try {
    const working = repairTemplateDocument(structuredClone(document));
    const printMode = catalogPrintMode(working);
    const result: RendererCompatibility = analyzePortableExport(working, { printMode });
    return {
      name: document.name,
      id: document.id,
      catalog,
      status: result.status,
      detected: result.requirements,
      unsupported: result.unsupported,
    };
  } catch (error) {
    return {
      name: document.name,
      id: document.id,
      catalog,
      status: "unexportable",
      detected: [],
      unsupported: [],
      reason: error instanceof Error ? error.message : "Package analysis failed",
    };
  }
}

/** Diagnostic only. Does not modify documents. */
export function auditIndustrialTemplates(documents: LabelDocument[]): TemplateCompatibilityAudit[] {
  return documents
    .filter((document) => !isShopifyLibraryDocument(document))
    .map(classify)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function formatCompatibilityAudit(rows: TemplateCompatibilityAudit[]): string {
  const lines = [
    "Industrial template compatibility — current Python renderer",
    "",
  ];
  for (const row of rows) {
    lines.push(`${row.status === "compatible" ? "YES" : "NO"}  ${row.name}`);
    lines.push(`    id: ${row.id}`);
    lines.push(`    catalog: ${row.catalog}`);
    lines.push(`    status: ${row.status}`);
    lines.push(`    detected: ${row.detected.join(", ") || "—"}`);
    lines.push(`    unsupported: ${row.unsupported.join(", ") || "—"}`);
    if (row.reason) lines.push(`    reason: ${row.reason}`);
    lines.push("");
  }
  const compatible = rows.filter((row) => row.status === "compatible").length;
  const incompatible = rows.filter((row) => row.status === "incompatible").length;
  const unexportable = rows.filter((row) => row.status === "unexportable").length;
  lines.push(
    `Total ${rows.length}. Compatible ${compatible}. Incompatible ${incompatible}. Unexportable ${unexportable}.`,
  );
  return lines.join("\n");
}
