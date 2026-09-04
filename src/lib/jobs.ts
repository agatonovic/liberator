import { createId } from "./ids";
import type { LabelJob, LabelJobOutput, LabelJobSource, LabelJobStatus } from "./domain";
import { recordsForOrganization } from "./workspace-scope";

export const JOB_LIMIT = 200;

export function makeLabelJob(input: {
  organizationId: string;
  templateId: string;
  templateName: string;
  templateVersionId: string;
  templateVersionNumber: number;
  createdBy: string;
  createdByName: string;
  quantity: number;
  sourceType: LabelJobSource;
  status?: LabelJobStatus;
  fileName?: string;
  pageSize?: string;
  error?: string;
  rowCount?: number;
  successCount?: number;
  failedCount?: number;
  outputType?: LabelJobOutput;
}): LabelJob {
  const successCount = Math.max(0, Math.round(Number(input.successCount ?? input.quantity) || 0));
  const failedCount = Math.max(0, Math.round(Number(input.failedCount) || 0));
  const rowCount = Math.max(successCount + failedCount, Math.round(Number(input.rowCount) || 0));
  return {
    id: createId(),
    organizationId: input.organizationId,
    templateId: input.templateId,
    templateName: input.templateName,
    templateVersionId: input.templateVersionId,
    templateVersionNumber: Math.max(1, input.templateVersionNumber),
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    createdAt: new Date().toISOString(),
    status: input.status ?? "completed",
    quantity: successCount,
    sourceType: input.sourceType,
    fileName: input.fileName,
    pageSize: input.pageSize,
    error: input.error,
    rowCount,
    successCount,
    failedCount,
    outputType: input.outputType,
  };
}

export function prependJob(existing: LabelJob[] | undefined, job: LabelJob): LabelJob[] {
  const next = [job, ...(existing ?? [])];
  const seen = new Set<string>();
  const unique: LabelJob[] = [];
  for (const item of next) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
    if (unique.length >= JOB_LIMIT) break;
  }
  return unique;
}

export function jobsForOrganization(jobs: LabelJob[], organizationId: string | null | undefined) {
  return recordsForOrganization(jobs, organizationId);
}

export function jobStatusLabel(status: LabelJobStatus) {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "generating") return "Generating";
  if (status === "validating") return "Validating";
  if (status === "ready") return "Ready";
  return "Draft";
}

export function jobOutputLabel(output?: LabelJob["outputType"]) {
  if (output === "print") return "Printed";
  if (output === "pdf") return "PDF";
  return "";
}

export function jobSourceLabel(source: LabelJobSource, fileName?: string) {
  if (source === "excel") return fileName ? `Excel import · ${fileName}` : "Excel import";
  if (source === "shopify") return fileName ? `Shopify products · ${fileName}` : "Shopify products";
  return "Manual grid";
}

export function jobShortId(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function formatJobTimestamp(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} · ${time}`;
}
