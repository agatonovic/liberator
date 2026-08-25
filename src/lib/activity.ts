import type { SheetPageSize } from "./document";
import { createId } from "./ids";

export type ActivityKind = "generate" | "print";

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
};

export const ACTIVITY_LIMIT = 50;
export const ACTIVITY_PREVIEW = 8;

export type ActivityDraft = Omit<ActivityEvent, "id" | "timestamp"> & {
  id?: string;
  timestamp?: string;
};

function isActivity(value: unknown): value is ActivityEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as ActivityEvent;
  return (
    typeof event.id === "string" &&
    (event.type === "generate" || event.type === "print") &&
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
  return event.type === "print" ? "Print dialog opened" : "PDF downloaded";
}
