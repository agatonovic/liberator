import type { SheetPageSize } from "./document";
import { createId } from "./ids";
import { recordsForOrganization } from "./workspace-scope";

export type ActivityKind =
  | "generate"
  | "print"
  | "generate_failed"
  | "template_created"
  | "template_edited"
  | "version_created"
  | "published"
  | "archived"
  | "asset_uploaded"
  | "asset_deleted"
  | "member_added"
  | "member_updated"
  | "member_removed"
  | "workspace_updated";

export type ActivityEvent = {
  id: string;
  type: ActivityKind;
  templateId: string;
  templateName: string;
  timestamp: string;
  labelCount: number;
  fileName?: string;
  pageSize?: SheetPageSize | string;
  columns?: number;
  rows?: number;
  organizationId?: string;
  userId?: string;
  userName?: string;
  versionNumber?: number;
};

export const ACTIVITY_LIMIT = 200;
export const ACTIVITY_PREVIEW = 8;

export type ActivityDraft = Omit<ActivityEvent, "id" | "timestamp" | "labelCount"> & {
  id?: string;
  timestamp?: string;
  labelCount?: number;
};

const ACTIVITY_KINDS = new Set<ActivityKind>([
  "generate",
  "print",
  "generate_failed",
  "template_created",
  "template_edited",
  "version_created",
  "published",
  "archived",
  "asset_uploaded",
  "asset_deleted",
  "member_added",
  "member_updated",
  "member_removed",
  "workspace_updated",
]);

function isActivity(value: unknown): value is ActivityEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as ActivityEvent;
  return (
    typeof event.id === "string" &&
    ACTIVITY_KINDS.has(event.type) &&
    typeof event.templateId === "string" &&
    typeof event.templateName === "string" &&
    typeof event.timestamp === "string"
  );
}

export function mergeActivity(...lists: (unknown[] | undefined | null)[]): ActivityEvent[] {
  const seen = new Set<string>();
  const events: ActivityEvent[] = [];
  const all = lists.flatMap((list) => list ?? []).filter(isActivity);
  all.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  for (const event of all) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    events.push(event);
    if (events.length >= ACTIVITY_LIMIT) break;
  }
  return events;
}

export function makeActivityEvent(draft: ActivityDraft): ActivityEvent {
  return {
    ...draft,
    id: draft.id || createId(),
    timestamp: draft.timestamp || new Date().toISOString(),
    labelCount: Math.max(0, Math.round(Number(draft.labelCount) || 0)),
  };
}

export function prependActivity(existing: ActivityEvent[], event: ActivityEvent): ActivityEvent[] {
  return mergeActivity([event], existing);
}

export function activityPreview(events: ActivityEvent[], limit = ACTIVITY_PREVIEW) {
  return events.slice(0, limit);
}

export function activityActionLabel(event: ActivityEvent) {
  if (event.type === "print") return "Print dialog opened";
  if (event.type === "generate") return "PDF downloaded";
  if (event.type === "generate_failed") return "Generation failed";
  if (event.type === "template_created") return "Created template";
  if (event.type === "template_edited") return "Edited template";
  if (event.type === "version_created") return "Saved version";
  if (event.type === "published") return "Published template";
  if (event.type === "archived") return "Archived template";
  if (event.type === "asset_uploaded") return "Uploaded asset";
  if (event.type === "asset_deleted") return "Deleted asset";
  if (event.type === "member_added") return "Added member";
  if (event.type === "member_updated") return "Updated member";
  if (event.type === "member_removed") return "Removed member";
  if (event.type === "workspace_updated") return "Updated workspace";
  return "Activity";
}

export function activityForOrganization(events: ActivityEvent[], organizationId: string | null | undefined) {
  return recordsForOrganization(events, organizationId);
}

export function activityVisibleToRole(events: ActivityEvent[], role: "admin" | "designer" | "operator" | null) {
  if (role !== "operator") return events;
  return events.filter((event) => event.type === "generate" || event.type === "print" || event.type === "generate_failed");
}
