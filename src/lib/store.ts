import { create } from "zustand";
import { CATALOG, buildCatalogDocument } from "./catalog";
import {
  cloneDocument,
  cloneElement,
  constrainCodeElement,
  createDocument,
  createElement,
  documentBindings,
  expandGroupSelection,
  isPaintColor,
  repairTemplateDocument,
  packGroupedElements,
  remapPastedGroups,
  selectionGroupFlags,
  type ElementType,
  type LabelDocument,
  type LabelElement,
  type SheetLayout,
} from "./document";
import { normalizeImportedTemplateJson } from "./template-json";
import {
  deleteStoredDocument,
  EMPTY_DATA,
  loadAllDocuments,
  loadMeta,
  saveAllDocuments,
  saveMeta,
  type PersistedData,
} from "./db";
import {
  makeActivityEvent,
  mergeActivity,
  prependActivity,
  type ActivityDraft,
  type ActivityEvent,
} from "./activity";
import { STELLANTIS_ORG_ID, DEMO_ADMIN_ID, type LabelJob, type LabelJobOutput, type LabelJobSource, type Organization, type OrganizationMembership, type Role, type SessionSnapshot, type User } from "./domain";
import { makeLabelJob } from "./jobs";
import { canArchiveTemplates, canEditTemplates, canManageUsers, canPublishTemplates } from "./roles";
import { demoSession } from "./session";
import { MAX_SAVED_COLORS, mergeSavedColors, normalizeHex } from "./color";
import { elementAabb } from "./guides";
import { schemaColumns } from "./excel";
import { loadExcelLabelData } from "./data/excel-provider";
import {
  filledRowIndexes,
  gridForTemplate,
  headerForColumn,
  looksLikeHeaderRow,
  parseSpreadsheetPaste,
  sameTemplateGrid,
  templateGrid,
  tileClipboard,
} from "./grid";
import { createId } from "./ids";
import { publicPath } from "./public-path";
import {
  MY_TEMPLATES_FOLDER_ID,
  folderIdFromName,
  mergeIdLists,
  consumePublishedLibraryStamp,
  publishedLibraryStamp,
  type TemplateFolder,
} from "./library";
import { assembleHydratedLibrary } from "./library-hydrate";
import { autoMapBindings, type ColumnMapping } from "./resolve";
import { clampZoom, fitZoom, mmToPx, panAfterZoom, roundMm } from "./units";
import {
  applyVersionSnapshot,
  keepDocumentVersions,
  makeTemplateVersion,
  prependVersion,
  stripDocumentVersions,
} from "./versions";
import { stampLegacyOrganizationIds } from "./workspace-scope";
import {
  archiveDocument as archiveWorkspaceDocument,
  migrateWorkspace,
  publishDocument as publishWorkspaceDocument,
  recordCompletedJob,
  workingCopyOnEdit,
  adminCount,
} from "./workspace";

export type Tool = "select" | ElementType;
export type ColorSampleProperty = "fill" | "stroke" | "background";

type AppState = {
  hydrated: boolean;
  documents: LabelDocument[];
  folders: TemplateFolder[];
  deletedIds: string[];
  deletedCatalogIds: string[];
  deletedFolderIds: string[];
  currentId: string | null;
  selectedIds: string[];
  clipboard: LabelElement[];
  clipboardSourceId: string | null;
  pasteCount: number;
  tool: Tool;
  zoom: number;
  panX: number;
  panY: number;
  past: LabelDocument[];
  future: LabelDocument[];
  editCheckpoint: LabelDocument | null;
  dataPast: PersistedData[];
  dataFuture: PersistedData[];
  data: PersistedData;
  templateGrids: Record<string, PersistedData>;
  savedColors: string[];
  activity: ActivityEvent[];
  organizations: Organization[];
  users: User[];
  memberships: OrganizationMembership[];
  jobs: LabelJob[];
  workspaceMigrationRev: number;
  currentOrganizationId: string | null;
  currentUserId: string | null;
  hydrate: () => Promise<void>;
  current: () => LabelDocument | null;
  session: () => SessionSnapshot | null;
  role: () => SessionSnapshot["membership"]["role"] | null;
  createBlank: (page?: { widthMm: number; heightMm: number }, name?: string, folderId?: string) => string;
  createFromCatalog: (catalogId: string) => string;
  openDocument: (id: string) => void;
  duplicateDocument: (id: string) => string | null;
  toggleFavorite: (id: string) => void;
  markTemplateUsed: (id: string, kind?: "open" | "generate") => void;
  recordActivity: (draft: ActivityDraft) => void;
  setColumnRequired: (header: string, required: boolean) => void;
  saveVersion: (name?: string) => string | null;
  restoreVersion: (versionId: string) => boolean;
  renameVersion: (versionId: string, name: string) => void;
  deleteVersion: (versionId: string) => void;
  deleteDocument: (id: string) => Promise<void>;
  moveDocumentToFolder: (id: string, folderId: string) => void;
  createFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  toggleFolderCollapsed: (id: string) => void;
  renameDocument: (name: string, id?: string) => void;
  setPageSize: (widthMm: number, heightMm: number) => void;
  setSheet: (sheet: SheetLayout | undefined) => void;
  setTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;
  zoomAt: (zoom: number, originX: number, originY: number) => void;
  setCamera: (zoom: number, panX: number, panY: number) => void;
  fitViewport: (widthMm: number, heightMm: number, viewW: number, viewH: number) => void;
  select: (ids: string[], mode?: "replace" | "toggle") => void;
  addElementAt: (type: ElementType, x: number, y: number, extras?: Partial<LabelElement>) => string | null;
  updateElement: (id: string, patch: Partial<LabelElement>, recordHistory?: boolean) => void;
  updateElements: (updates: { id: string; patch: Partial<LabelElement> }[]) => void;
  deleteSelected: () => void;
  copySelected: () => string | null;
  pasteClipboard: (text?: string, options?: { inPlace?: boolean }) => boolean;
  cutSelected: () => boolean;
  duplicateSelected: () => boolean;
  groupSelected: () => boolean;
  ungroupSelected: () => boolean;
  nudgeSelected: (dx: number, dy: number) => void;
  moveLayer: (id: string, to: "front" | "forward" | "backward" | "back") => void;
  reorderElements: (ids: string[]) => void;
  bringForward: () => void;
  sendBackward: () => void;
  alignSelected: (align: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom" | "center") => void;
  distributeSelected: (axis: "horizontal" | "vertical") => void;
  beginPropertyEdit: () => void;
  endPropertyEdit: () => void;
  colorSample: { targetIds: string[]; property: ColorSampleProperty } | null;
  beginColorSample: (property: ColorSampleProperty) => void;
  applySampledColor: (color: string) => void;
  cancelColorSample: () => void;
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;
  textHasSelection: boolean;
  textSelectionRange: { start: number; end: number } | null;
  setTextHasSelection: (value: boolean) => void;
  setTextSelectionRange: (range: { start: number; end: number } | null) => void;
  textSelectionFontSizeMm: number | null;
  textStyleRequest: { fill?: string; fontSizeMm?: number; n: number } | null;
  requestTextStyle: (patch: { fill?: string; fontSizeMm?: number }) => void;
  saveColor: (hex: string) => void;
  removeSavedColor: (hex: string) => void;
  undo: () => void;
  redo: () => void;
  undoData: () => boolean;
  redoData: () => boolean;
  loadWorkbook: (file: File) => Promise<void>;
  setMapping: (binding: string, header: string) => void;
  autoMap: () => void;
  setPreviewRow: (index: number) => void;
  setGridCell: (rowIndex: number, header: string, value: string) => void;
  setGridCells: (updates: { rowIndex: number; header: string; value: string }[]) => void;
  pasteGrid: (
    rowIndex: number,
    colIndex: number,
    text: string,
    dest?: { rows: number; cols: number },
  ) => { rows: number; cols: number };
  ensurePrintGrid: () => void;
  ensureGridRows: (minLength: number) => void;
  addGridRows: (count?: number) => void;
  clearData: () => void;
  importDocument: (raw: unknown) => void;
  publishCurrent: () => boolean;
  archiveDocument: (id: string) => boolean;
  completeLabelJob: (input: {
    templateId: string;
    templateName: string;
    templateVersionId: string;
    templateVersionNumber: number;
    quantity: number;
    sourceType: LabelJobSource;
    action: "print" | "download";
    fileName?: string;
    pageSize?: string;
    rowCount?: number;
    successCount?: number;
    failedCount?: number;
    error?: string;
    status?: "completed" | "failed";
    organizationId?: string;
  }) => void;
  setCurrentUser: (userId: string) => boolean;
  updateOrganization: (patch: { name?: string; description?: string; companyName?: string }) => boolean;
  addMember: (input: { name: string; email: string; role: Role }) => string | null;
  updateMemberRole: (membershipId: string, role: Role) => boolean;
  removeMember: (membershipId: string) => boolean;
  saveState: "saved" | "pending" | "saving";
  saveNow: () => Promise<void>;
};

const HISTORY_LIMIT = 60;
const CLIPBOARD_KIND = "labelator.elements";
const CLIPBOARD_STORAGE_KEY = "labelator.element-clipboard";

type ClipboardPayload = {
  kind: string;
  sourceId?: string | null;
  elements: LabelElement[];
};

function parseClipboard(text: string): ClipboardPayload | null {
  try {
    const parsed = JSON.parse(text) as ClipboardPayload;
    if (parsed?.kind !== CLIPBOARD_KIND || !Array.isArray(parsed.elements)) return null;
    const elements = parsed.elements.filter(
      (el) => el && typeof el === "object" && typeof el.type === "string" && typeof el.x === "number",
    );
    if (!elements.length) return null;
    return { kind: CLIPBOARD_KIND, sourceId: parsed.sourceId ?? null, elements };
  } catch {
    return null;
  }
}

function readStoredClipboard(): ClipboardPayload | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      parseClipboard(sessionStorage.getItem(CLIPBOARD_STORAGE_KEY) ?? "") ??
      parseClipboard(localStorage.getItem(CLIPBOARD_STORAGE_KEY) ?? "")
    );
  } catch {
    return null;
  }
}

function writeStoredClipboard(payload: ClipboardPayload) {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(payload);
    try {
      sessionStorage.setItem(CLIPBOARD_STORAGE_KEY, raw);
    } catch {
      /* quota */
    }
    try {
      localStorage.setItem(CLIPBOARD_STORAGE_KEY, raw);
    } catch {
      /* quota — in-memory clipboard still works */
    }
  } catch {
    /* stringify failed (huge images) — in-memory clipboard still works */
  }
}

function keepOnPage(
  element: LabelElement,
  page: { widthMm: number; heightMm: number },
): LabelElement {
  return {
    ...element,
    x: Math.min(Math.max(0, element.x), Math.max(0, page.widthMm - element.width)),
    y: Math.min(Math.max(0, element.y), Math.max(0, page.heightMm - element.height)),
  };
}

function fromThisDocument(current: LabelDocument, elements: LabelElement[]) {
  const ids = new Set(current.elements.map((el) => el.id));
  return elements.some((el) => ids.has(el.id));
}

function fitGroupOnPage(
  elements: LabelElement[],
  page: { widthMm: number; heightMm: number },
): LabelElement[] {
  if (!elements.length) return elements;
  const minX = Math.min(...elements.map((el) => el.x));
  const minY = Math.min(...elements.map((el) => el.y));
  const maxX = Math.max(...elements.map((el) => el.x + el.width));
  const maxY = Math.max(...elements.map((el) => el.y + el.height));
  let dx = 0;
  let dy = 0;
  if (maxX > page.widthMm) dx = page.widthMm - maxX;
  if (maxY > page.heightMm) dy = page.heightMm - maxY;
  if (minX + dx < 0) dx = -minX;
  if (minY + dy < 0) dy = -minY;
  if (dx === 0 && dy === 0) return elements;
  return elements.map((el) => ({
    ...el,
    x: roundMm(el.x + dx, 0.01),
    y: roundMm(el.y + dy, 0.01),
  }));
}
let persistTimer: ReturnType<typeof setTimeout> | null = null;

type RemoteLibrary = {
  documents?: LabelDocument[];
  folders?: TemplateFolder[];
  currentId?: string | null;
  data?: PersistedData;
  templateGrids?: Record<string, PersistedData>;
  librarySeeded?: boolean;
  deletedIds?: string[];
  deletedCatalogIds?: string[];
  deletedFolderIds?: string[];
  savedColors?: string[];
  activity?: ActivityEvent[];
};

async function fetchRemoteLibrary(): Promise<RemoteLibrary | null> {
  const paths = process.env.NEXT_PUBLIC_BASE_PATH
    ? ["/library.json", "/api/library"]
    : ["/api/library", "/library.json"];
  for (const path of paths) {
    try {
      const res = await fetch(publicPath(path), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const json = (await res.json()) as RemoteLibrary | null;
      if (json && Array.isArray(json.documents) && Array.isArray(json.folders)) return json;
    } catch {
      /* try the next location */
    }
  }
  return null;
}

function applyElementPatch(el: LabelElement, patch: Partial<LabelElement>): LabelElement {
  return constrainCodeElement({
    ...el,
    ...patch,
    style: { ...el.style, ...patch.style },
  });
}

function persistMeta(state: AppState) {
  return {
    currentId: state.currentId,
    data: state.data,
    templateGrids: state.templateGrids,
    folders: state.folders,
    librarySeeded: true,
    deletedIds: state.deletedIds,
    deletedCatalogIds: state.deletedCatalogIds,
    deletedFolderIds: state.deletedFolderIds,
    savedColors: state.savedColors,
    activity: state.activity,
    organizations: state.organizations,
    users: state.users,
    memberships: state.memberships,
    jobs: state.jobs,
    workspaceMigrationRev: state.workspaceMigrationRev,
    currentUserId: state.currentUserId,
    currentOrganizationId: state.currentOrganizationId,
  };
}

/**
 * Phase 3: do not autosave the working IndexedDB library onto `data/library.json`.
 * That file is the committed Industrial seed/recovery snapshot. Designer edits stay in IDB.
 * `/api/library` PUT remains available for explicit tooling and uses a geometry-preserving merge.
 */
async function writeLibraryBackup() {
  return;
}

function persist(_state?: unknown) {
  if (!useAppStore.getState().hydrated) return;
  if (persistTimer) clearTimeout(persistTimer);
  queueMicrotask(() => {
    if (useAppStore.getState().saveState === "saved") useAppStore.setState({ saveState: "pending" });
  });
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const latest = useAppStore.getState();
    if (!latest.hydrated) return;
    useAppStore.setState({ saveState: "saving" });
    void Promise.all([
      saveAllDocuments(latest.documents),
      saveMeta(persistMeta(latest)),
      writeLibraryBackup(),
    ])
      .then(() => {
        if (persistTimer) return;
        useAppStore.setState({ saveState: "saved" });
      })
      .catch(() => {
        if (persistTimer) return;
        useAppStore.setState({ saveState: "pending" });
      });
  }, 250);
}

function moveBlock(
  elements: LabelElement[],
  memberIds: Set<string>,
  to: "front" | "forward" | "backward" | "back",
): LabelElement[] {
  const members = elements.filter((el) => memberIds.has(el.id));
  if (!members.length) return elements;
  const start = elements.findIndex((el) => memberIds.has(el.id));
  const end = start + members.length - 1;
  if (to === "front") return [...elements.filter((el) => !memberIds.has(el.id)), ...members];
  if (to === "back") return [...members, ...elements.filter((el) => !memberIds.has(el.id))];
  if (to === "forward") {
    if (end >= elements.length - 1) return elements;
    const next = elements[end + 1];
    const swapIds = next.groupId
      ? new Set(elements.filter((el) => el.groupId === next.groupId).map((el) => el.id))
      : new Set([next.id]);
    const swap = elements.filter((el) => swapIds.has(el.id));
    return [...elements.slice(0, start), ...swap, ...members, ...elements.slice(end + 1 + swap.length)];
  }
  if (start <= 0) return elements;
  const prev = elements[start - 1];
  const swapIds = prev.groupId
    ? new Set(elements.filter((el) => el.groupId === prev.groupId).map((el) => el.id))
    : new Set([prev.id]);
  const swap = elements.filter((el) => swapIds.has(el.id));
  return [...elements.slice(0, start - swap.length), ...members, ...swap, ...elements.slice(end + 1)];
}

function selectionUnits(elements: LabelElement[], selectedIds: string[]) {
  const selected = new Set(selectedIds);
  const seen = new Set<string>();
  const units: LabelElement[][] = [];
  for (const el of elements) {
    if (!selected.has(el.id) || seen.has(el.id)) continue;
    if (el.groupId) {
      const members = elements.filter((item) => item.groupId === el.groupId && selected.has(item.id));
      members.forEach((item) => seen.add(item.id));
      units.push(members);
    } else {
      seen.add(el.id);
      units.push([el]);
    }
  }
  return units.filter((members) => members.some((el) => !el.locked));
}

function unionAabb(elements: LabelElement[]) {
  const boxes = elements.map(elementAabb);
  return {
    x1: Math.min(...boxes.map((box) => box.x1)),
    y1: Math.min(...boxes.map((box) => box.y1)),
    x2: Math.max(...boxes.map((box) => box.x2)),
    y2: Math.max(...boxes.map((box) => box.y2)),
  };
}

function alignDelta(
  align: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom" | "center",
  box: { x1: number; y1: number; x2: number; y2: number },
  target: { x1: number; y1: number; x2: number; y2: number },
) {
  let dx = 0;
  let dy = 0;
  if (align === "left") dx = target.x1 - box.x1;
  if (align === "hcenter" || align === "center") dx = (target.x1 + target.x2) / 2 - (box.x1 + box.x2) / 2;
  if (align === "right") dx = target.x2 - box.x2;
  if (align === "top") dy = target.y1 - box.y1;
  if (align === "vcenter" || align === "center") dy = (target.y1 + target.y2) / 2 - (box.y1 + box.y2) / 2;
  if (align === "bottom") dy = target.y2 - box.y2;
  return { dx, dy };
}

function cloneData(data: PersistedData): PersistedData {
  return {
    fileName: data.fileName,
    headers: [...data.headers],
    rows: data.rows.map((row) => ({ ...row })),
    mapping: { ...data.mapping },
    previewRowIndex: data.previewRowIndex,
  };
}

function withGrid(state: AppState, data: PersistedData): Pick<AppState, "data" | "templateGrids"> {
  return {
    data,
    templateGrids: state.currentId
      ? { ...state.templateGrids, [state.currentId]: data }
      : state.templateGrids,
  };
}

function withDataHistory(state: AppState, data: PersistedData): Partial<AppState> {
  return {
    dataPast: [...(state.dataPast ?? []), cloneData(state.data)].slice(-HISTORY_LIMIT),
    dataFuture: [],
    ...withGrid(state, data),
  };
}

function actorOf(state: { currentUserId: string | null }) {
  return state.currentUserId || DEMO_ADMIN_ID;
}

let sessionCache: SessionSnapshot | null = null;

function sessionOf(state: {
  users: User[];
  organizations: Organization[];
  memberships: OrganizationMembership[];
  currentUserId: string | null;
  currentOrganizationId: string | null;
}): SessionSnapshot | null {
  const user = state.users.find((item) => item.id === state.currentUserId) ?? state.users[0];
  const organization =
    state.organizations.find((item) => item.id === state.currentOrganizationId) ?? state.organizations[0];
  const next: SessionSnapshot = (() => {
    if (!user || !organization) return demoSession();
    const membership =
      state.memberships.find((item) => item.userId === user.id && item.organizationId === organization.id) ??
      state.memberships.find((item) => item.userId === user.id);
    if (!membership) return { ...demoSession(), user, organization };
    return { user, organization, membership };
  })();
  if (
    sessionCache &&
    sessionCache.user === next.user &&
    sessionCache.organization === next.organization &&
    sessionCache.membership === next.membership
  ) {
    return sessionCache;
  }
  sessionCache = next;
  return next;
}

function withHistory(state: AppState, nextDoc: LabelDocument): Partial<AppState> {
  const current = state.documents.find((d) => d.id === state.currentId);
  const past = current
    ? [...state.past, stripDocumentVersions(cloneDocument(current))].slice(-HISTORY_LIMIT)
    : state.past;
  const updated = workingCopyOnEdit(nextDoc, actorOf(state));
  return {
    past,
    future: [],
    documents: state.documents.map((d) => (d.id === updated.id ? updated : d)),
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  documents: [],
  folders: [],
  deletedIds: [],
  deletedCatalogIds: [],
  deletedFolderIds: [],
  currentId: null,
  selectedIds: [],
  clipboard: [],
  clipboardSourceId: null,
  pasteCount: 1,
  tool: "select",
  zoom: 0.5,
  panX: 24,
  panY: 24,
  past: [],
  future: [],
  editCheckpoint: null,
  dataPast: [],
  dataFuture: [],
  colorSample: null,
  editingTextId: null,
  textHasSelection: false,
  textSelectionRange: null,
  textSelectionFontSizeMm: null,
  textStyleRequest: null,
  data: EMPTY_DATA,
  templateGrids: {},
  savedColors: [],
  activity: [],
  organizations: [],
  users: [],
  memberships: [],
  jobs: [],
  workspaceMigrationRev: 0,
  currentOrganizationId: null,
  currentUserId: null,
  saveState: "saved",

  current: () => {
    const { documents, currentId } = get();
    return documents.find((d) => d.id === currentId) ?? null;
  },

  session: () => sessionOf(get()),

  role: () => sessionOf(get())?.membership.role ?? null,

  hydrate: async () => {
    if (get().hydrated) {
      const documents = get().documents.map((doc) =>
        repairTemplateDocument(doc),
      );
      if (documents.some((doc, i) => doc !== get().documents[i])) {
        set({ documents });
        persist();
      }
      return;
    }
    let stored = await loadAllDocuments();
    let meta = await loadMeta();
    let remote: RemoteLibrary | null = await fetchRemoteLibrary();
    const takePublished =
      Boolean(process.env.NEXT_PUBLIC_BASE_PATH) &&
      consumePublishedLibraryStamp(publishedLibraryStamp(remote));
    if (takePublished && remote) {
      stored = [];
      meta = {
        currentId: remote.currentId ?? null,
        data: remote.data ?? EMPTY_DATA,
        templateGrids: remote.templateGrids,
        folders: remote.folders,
        librarySeeded: true,
        deletedIds: remote.deletedIds,
        deletedCatalogIds: remote.deletedCatalogIds,
        deletedFolderIds: remote.deletedFolderIds,
        savedColors: remote.savedColors,
        activity: remote.activity,
      };
    }
    const assembled = assembleHydratedLibrary({
      stored,
      remote,
      meta,
      restoreOrphans: typeof window !== "undefined",
    });
    const documents = assembled.documents;
    const folders = assembled.folders;
    const deletedIds = assembled.deletedIds;
    const deletedCatalogIds = assembled.deletedCatalogIds;
    const deletedFolderIds = assembled.deletedFolderIds;
    const workspace = assembled.workspace;
    const currentId =
      (meta?.currentId && documents.some((d) => d.id === meta.currentId) && meta.currentId) ||
      (remote?.currentId && documents.some((d) => d.id === remote.currentId) && remote.currentId) ||
      documents[0]?.id ||
      null;
    const templateGrids: Record<string, PersistedData> = {
      ...(remote?.templateGrids ?? {}),
      ...(meta?.templateGrids ?? {}),
    };
    let data = meta?.data ?? remote?.data ?? EMPTY_DATA;
    const currentDoc = documents.find((doc) => doc.id === currentId);
    if (currentDoc) {
      const storedGrid = templateGrids[currentDoc.id];
      const source = storedGrid ?? (data.headers.length ? data : null);
      data = gridForTemplate(currentDoc, source);
      templateGrids[currentDoc.id] = data;
    }
    const clipped = readStoredClipboard();
    const activity = stampLegacyOrganizationIds(
      mergeActivity(meta?.activity, remote?.activity).map((event) =>
        event.organizationId ? event : { ...event, organizationId: STELLANTIS_ORG_ID },
      ),
    );
    const restoredOrgId = meta?.currentOrganizationId;
    const orgId =
      (restoredOrgId && workspace.organizations.some((item) => item.id === restoredOrgId)
        ? restoredOrgId
        : undefined) ??
      workspace.organizations.find((item) => item.id === STELLANTIS_ORG_ID)?.id ??
      workspace.organizations[0]?.id ??
      STELLANTIS_ORG_ID;
    const restoredUserId = meta?.currentUserId;
    const currentUserId =
      (restoredUserId && workspace.users.some((user) => user.id === restoredUserId)
        ? restoredUserId
        : workspace.users[0]?.id) ?? DEMO_ADMIN_ID;
    set({
      hydrated: true,
      documents,
      folders,
      deletedIds,
      deletedCatalogIds,
      deletedFolderIds,
      currentId,
      data,
      templateGrids,
      clipboard: clipped?.elements ?? [],
      clipboardSourceId: clipped?.sourceId ?? null,
      savedColors: mergeSavedColors(meta?.savedColors, remote?.savedColors),
      activity,
      organizations: workspace.organizations,
      users: workspace.users,
      memberships: workspace.memberships,
      jobs: workspace.jobs,
      workspaceMigrationRev: workspace.workspaceMigrationRev,
      currentOrganizationId: orgId,
      currentUserId,
    });
    persist();
  },

  createBlank: (page, name, folderId) => {
    const session = get().session();
    const doc = createDocument(name, page);
    doc.folderId = folderId || get().folders.find((folder) => folder.id === MY_TEMPLATES_FOLDER_ID)?.id || get().folders[0]?.id;
    doc.organizationId = session?.organization.id ?? get().currentOrganizationId ?? STELLANTIS_ORG_ID;
    doc.createdBy = session?.user.id ?? get().currentUserId ?? DEMO_ADMIN_ID;
    doc.updatedBy = doc.createdBy;
    doc.status = "draft";
    doc.versionNumber = 1;
    set((state) => {
      const activity = prependActivity(
        state.activity,
        makeActivityEvent({
          type: "template_created",
          templateId: doc.id,
          templateName: doc.name,
          organizationId: doc.organizationId,
          userId: doc.createdBy,
          userName: session?.user.name,
        }),
      );
      const next = {
        documents: [doc, ...state.documents],
        currentId: doc.id,
        selectedIds: [],
        past: [],
        future: [],
        activity,
      };
      persist({ ...state, ...next });
      return next;
    });
    return doc.id;
  },

  createFromCatalog: (catalogId) => {
    const doc = buildCatalogDocument(catalogId);
    const entry = CATALOG.find((item) => item.id === catalogId);
    const fromGroup = entry ? folderIdFromName(entry.group) : undefined;
    doc.folderId =
      (fromGroup && get().folders.some((folder) => folder.id === fromGroup) ? fromGroup : undefined) ||
      get().folders.find((folder) => folder.id === MY_TEMPLATES_FOLDER_ID)?.id ||
      get().folders[0]?.id;
    doc.organizationId = get().currentOrganizationId ?? STELLANTIS_ORG_ID;
    doc.createdBy = get().currentUserId ?? DEMO_ADMIN_ID;
    doc.status = "draft";
    doc.versionNumber = 1;
    set((state) => {
      const next = {
        documents: [doc, ...state.documents],
        currentId: doc.id,
        selectedIds: [],
        past: [],
        future: [],
        deletedCatalogIds: state.deletedCatalogIds.filter((id) => id !== catalogId),
      };
      persist({ ...state, ...next });
      return next;
    });
    return doc.id;
  },

  openDocument: (id) => {
    set((state) => {
      if (id === state.currentId) return state;
      const templateGrids = { ...state.templateGrids };
      if (state.currentId && state.data.headers.length) templateGrids[state.currentId] = state.data;
      const doc = state.documents.find((item) => item.id === id);
      const data = doc ? gridForTemplate(doc, templateGrids[id]) : EMPTY_DATA;
      if (doc) templateGrids[id] = data;
      const next = {
        currentId: id,
        data,
        templateGrids,
        selectedIds: [],
        past: [],
        future: [],
        dataPast: [],
        dataFuture: [],
        pasteCount: 1,
      };
      persist({ ...state, ...next });
      return next;
    });
  },

  duplicateDocument: (id) => {
    const source = get().documents.find((d) => d.id === id);
    if (!source) return null;
    const copy = cloneDocument(source);
    copy.id = crypto.randomUUID();
    copy.name = `${source.name} copy`;
    copy.updatedAt = new Date().toISOString();
    copy.catalogId = undefined;
    copy.favorite = false;
    copy.lastUsedAt = undefined;
    copy.lastGeneratedAt = undefined;
    copy.versions = undefined;
    copy.status = "draft";
    copy.versionNumber = 1;
    copy.publishedVersionId = undefined;
    copy.organizationId = source.organizationId ?? get().currentOrganizationId ?? STELLANTIS_ORG_ID;
    copy.createdBy = get().currentUserId ?? DEMO_ADMIN_ID;
    copy.updatedBy = copy.createdBy;
    set((state) => {
      const next = { documents: [copy, ...state.documents], currentId: copy.id, selectedIds: [], past: [], future: [] };
      persist({ ...state, ...next });
      return next;
    });
    return copy.id;
  },

  toggleFavorite: (id) => {
    set((state) => {
      const documents = state.documents.map((doc) =>
        doc.id === id ? { ...doc, favorite: !doc.favorite } : doc,
      );
      persist({ ...state, documents, currentId: state.currentId, data: state.data });
      return { documents };
    });
  },

  markTemplateUsed: (id, kind = "open") => {
    const now = new Date().toISOString();
    set((state) => {
      let changed = false;
      const documents = state.documents.map((doc) => {
        if (doc.id !== id) return doc;
        if (
          kind === "open" &&
          doc.lastUsedAt &&
          Number.isFinite(Date.parse(doc.lastUsedAt)) &&
          Date.now() - Date.parse(doc.lastUsedAt) < 20_000
        ) {
          return doc;
        }
        changed = true;
        return {
          ...doc,
          lastUsedAt: now,
          ...(kind === "generate" ? { lastGeneratedAt: now } : {}),
        };
      });
      if (!changed) return state;
      persist({ ...state, documents, currentId: state.currentId, data: state.data });
      return { documents };
    });
  },

  recordActivity: (draft) => {
    const session = get().session();
    const event = makeActivityEvent({
      ...draft,
      organizationId: draft.organizationId ?? session?.organization.id,
      userId: draft.userId ?? session?.user.id,
      userName: draft.userName ?? session?.user.name,
    });
    set((state) => {
      const activity = prependActivity(state.activity, event);
      persist();
      return { activity };
    });
  },

  setColumnRequired: (header, required) => {
    const needle = header.trim().toLowerCase();
    if (!needle) return;
    set((state) => {
      const current = state.current();
      if (!current) return state;
      const columns = schemaColumns(current);
      const column = columns.find((item) => headerForColumn(item, state.data.mapping, state.data.headers) === header) ??
        columns.find((item) =>
          [item.key, item.label, ...(item.headers ?? [])].some((alias) => alias.trim().toLowerCase() === needle),
        );
      if (!column || (column.required !== false) === required) return state;
      const base = current.dataColumns?.length ? current.dataColumns : columns;
      const dataColumns = base.some((item) => item.key === column.key)
        ? base.map((item) => (item.key === column.key ? { ...item, required } : item))
        : [...base, { ...column, required }];
      const documents = state.documents.map((doc) =>
        doc.id === current.id ? { ...doc, dataColumns, updatedAt: new Date().toISOString() } : doc,
      );
      persist({ ...state, documents, currentId: state.currentId, data: state.data });
      return { documents };
    });
  },

  saveVersion: (name) => {
    const current = get().current();
    if (!current) return null;
    const role = get().role();
    if (role && !canEditTemplates(role)) return null;
    const version = makeTemplateVersion(current, name, { createdBy: actorOf(get()) });
    set((state) => {
      const documents = state.documents.map((doc) =>
        doc.id === current.id ? { ...doc, versions: prependVersion(doc.versions, version) } : doc,
      );
      const activity = prependActivity(
        state.activity,
        makeActivityEvent({
          type: "version_created",
          templateId: current.id,
          templateName: current.name,
          versionNumber: version.number,
          organizationId: current.organizationId,
          userId: actorOf(state),
          userName: sessionOf(state)?.user.name,
        }),
      );
      persist();
      return { documents, activity };
    });
    return version.id;
  },

  restoreVersion: (versionId) => {
    let restored = false;
    set((state) => {
      const current = state.current();
      const version = current?.versions?.find((item) => item.id === versionId);
      if (!current || !version) return state;
      restored = true;
      const next = withHistory(state, applyVersionSnapshot(current, version.snapshot));
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return { ...next, selectedIds: [] };
    });
    return restored;
  },

  renameVersion: (versionId, name) => {
    set((state) => {
      const current = state.current();
      if (!current?.versions?.some((item) => item.id === versionId)) return state;
      const documents = state.documents.map((doc) =>
        doc.id !== current.id
          ? doc
          : {
              ...doc,
              versions: doc.versions?.map((item) =>
                item.id === versionId ? { ...item, name: name.trim() } : item,
              ),
            },
      );
      persist();
      return { documents };
    });
  },

  deleteVersion: (versionId) => {
    set((state) => {
      const current = state.current();
      if (!current?.versions?.some((item) => item.id === versionId)) return state;
      const documents = state.documents.map((doc) =>
        doc.id !== current.id
          ? doc
          : { ...doc, versions: doc.versions?.filter((item) => item.id !== versionId) },
      );
      persist();
      return { documents };
    });
  },

  deleteDocument: async (id) => {
    await deleteStoredDocument(id);
    set((state) => {
      const removed = state.documents.find((d) => d.id === id);
      const documents = state.documents.filter((d) => d.id !== id);
      const currentId = state.currentId === id ? documents[0]?.id ?? null : state.currentId;
      const deletedIds = mergeIdLists(state.deletedIds, [id]);
      const lastOfCatalog =
        Boolean(removed?.catalogId) && !documents.some((doc) => doc.catalogId === removed?.catalogId);
      const deletedCatalogIds = lastOfCatalog
        ? mergeIdLists(state.deletedCatalogIds, [removed!.catalogId!])
        : state.deletedCatalogIds;
      const templateGrids = { ...state.templateGrids };
      delete templateGrids[id];
      let data = state.data;
      if (state.currentId === id) {
        const nextDoc = documents.find((item) => item.id === currentId) ?? null;
        data = nextDoc ? gridForTemplate(nextDoc, templateGrids[nextDoc.id]) : EMPTY_DATA;
        if (nextDoc) templateGrids[nextDoc.id] = data;
      }
      const next = { documents, currentId, data, templateGrids, selectedIds: [], past: [], future: [], deletedIds, deletedCatalogIds };
      persist({ ...state, ...next });
      return next;
    });
  },

  moveDocumentToFolder: (id, folderId) => {
    set((state) => {
      if (!state.folders.some((folder) => folder.id === folderId)) return state;
      const documents = state.documents.map((doc) =>
        doc.id === id ? { ...doc, folderId, updatedAt: new Date().toISOString() } : doc,
      );
      persist({ ...state, documents });
      return { documents };
    });
  },

  createFolder: (name) => {
    const folder: TemplateFolder = {
      id: createId(),
      name: name.trim() || "Untitled folder",
      organizationId: get().currentOrganizationId ?? STELLANTIS_ORG_ID,
    };
    set((state) => {
      const folders = [...state.folders, folder];
      persist({ ...state, folders });
      return { folders };
    });
    return folder.id;
  },

  renameFolder: (id, name) => {
    const nextName = name.trim();
    if (!nextName) return;
    set((state) => {
      const folders = state.folders.map((folder) => (folder.id === id ? { ...folder, name: nextName } : folder));
      persist({ ...state, folders });
      return { folders };
    });
  },

  deleteFolder: (id) => {
    set((state) => {
      if (state.folders.length <= 1) return state;
      const fallback =
        state.folders.find((folder) => folder.id === MY_TEMPLATES_FOLDER_ID && folder.id !== id)?.id ??
        state.folders.find((folder) => folder.id !== id)?.id;
      if (!fallback) return state;
      const folders = state.folders.filter((folder) => folder.id !== id);
      const documents = state.documents.map((doc) =>
        doc.folderId === id ? { ...doc, folderId: fallback } : doc,
      );
      const deletedFolderIds = mergeIdLists(state.deletedFolderIds, [id]);
      persist({ ...state, folders, documents, deletedFolderIds });
      return { folders, documents, deletedFolderIds };
    });
  },

  toggleFolderCollapsed: (id) => {
    set((state) => {
      const folders = state.folders.map((folder) =>
        folder.id === id ? { ...folder, collapsed: !folder.collapsed } : folder,
      );
      persist({ ...state, folders });
      return { folders };
    });
  },

  renameDocument: (name, id) => {
    const nextName = name.trim();
    if (!nextName) return;
    set((state) => {
      const targetId = id ?? state.currentId;
      const current = state.documents.find((doc) => doc.id === targetId);
      if (!current || current.name === nextName) return state;
      const updated = { ...current, name: nextName, updatedAt: new Date().toISOString() };
      const next =
        targetId === state.currentId
          ? withHistory(state, updated)
          : { documents: state.documents.map((doc) => (doc.id === targetId ? updated : doc)) };
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return next;
    });
  },

  setPageSize: (widthMm, heightMm) => {
    set((state) => {
      const current = state.current();
      if (!current) return state;
      const next = withHistory(state, { ...current, page: { widthMm, heightMm } });
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return next;
    });
  },

  setSheet: (sheet) => {
    set((state) => {
      const current = state.current();
      if (!current) return state;
      const next = withHistory(state, { ...current, sheet });
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return next;
    });
  },

  setTool: (tool) => set({ tool, colorSample: tool === "select" ? get().colorSample : null }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  setPan: (panX, panY) => set({ panX, panY }),
  zoomAt: (zoom, originX, originY) => {
    const state = get();
    set(panAfterZoom(state.zoom, zoom, state.panX, state.panY, originX, originY));
  },
  setCamera: (zoom, panX, panY) => set({ zoom: clampZoom(zoom), panX, panY }),
  fitViewport: (widthMm, heightMm, viewW, viewH) => {
    const zoom = fitZoom(widthMm, heightMm, viewW, viewH);
    set({
      zoom,
      panX: (viewW - mmToPx(widthMm, zoom)) / 2,
      panY: (viewH - mmToPx(heightMm, zoom)) / 2,
    });
  },
  select: (ids, mode = "replace") => {
    if (get().colorSample) return;
    const doc = get().current();
    const expanded = doc ? expandGroupSelection(doc.elements, ids) : ids;
    if (mode === "toggle" && ids.length === 1) {
      const selected = get().selectedIds;
      const allIn = expanded.every((id) => selected.includes(id));
      set({
        selectedIds: allIn
          ? selected.filter((id) => !expanded.includes(id))
          : [...new Set([...selected, ...expanded])],
      });
      return;
    }
    set({ selectedIds: expanded });
  },

  addElementAt: (type, x, y, extras) => {
    let created: string | null = null;
    set((state) => {
      const current = state.current();
      if (!current) return state;
      const element = createElement(
        type,
        x,
        y,
        type === "image" && extras?.imageFit === undefined ? { imageFit: "fit", ...extras } : extras,
      );
      created = element.id;
      const next = withHistory(state, { ...current, elements: [...current.elements, element] });
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return { ...next, selectedIds: [element.id] };
    });
    return created;
  },

  updateElement: (id, patch, recordHistory = true) => {
    set((state) => {
      const current = state.current();
      if (!current) return state;
      const updated: LabelDocument = {
        ...current,
        updatedAt: new Date().toISOString(),
        elements: current.elements.map((el) => (el.id === id ? applyElementPatch(el, patch) : el)),
      };
      if (!recordHistory || state.editCheckpoint) {
        const next = { documents: state.documents.map((d) => (d.id === updated.id ? updated : d)) };
        persist({ ...state, ...next, currentId: state.currentId, data: state.data });
        return next;
      }
      const next = withHistory(state, updated);
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return next;
    });
  },

  updateElements: (updates) => {
    set((state) => {
      const current = state.current();
      if (!current) return state;
      const map = new Map(updates.map((u) => [u.id, u.patch]));
      const updated: LabelDocument = {
        ...current,
        updatedAt: new Date().toISOString(),
        elements: current.elements.map((el) => {
          const patch = map.get(el.id);
          return patch ? applyElementPatch(el, patch) : el;
        }),
      };
      const next = state.editCheckpoint
        ? { documents: state.documents.map((d) => (d.id === updated.id ? updated : d)) }
        : withHistory(state, updated);
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return next;
    });
  },

  deleteSelected: () => {
    set((state) => {
      const current = state.current();
      if (!current || !state.selectedIds.length) return state;
      const next = withHistory(state, {
        ...current,
        elements: current.elements.filter((el) => !state.selectedIds.includes(el.id)),
      });
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return { ...next, selectedIds: [] };
    });
  },

  copySelected: () => {
    const state = get();
    const current = state.current();
    if (!current || !state.selectedIds.length) return null;
    const selected = new Set(state.selectedIds);
    const items = current.elements.filter((el) => selected.has(el.id)).map((el) => structuredClone(el));
    if (!items.length) return null;
    const payload: ClipboardPayload = { kind: CLIPBOARD_KIND, sourceId: current.id, elements: items };
    let serialized: string | null = null;
    try {
      serialized = JSON.stringify(payload);
    } catch {
      serialized = null;
    }
    writeStoredClipboard(payload);
    set({ clipboard: items, clipboardSourceId: current.id, pasteCount: 1 });
    if (serialized) void navigator.clipboard?.writeText(serialized).catch(() => undefined);
    return serialized ?? CLIPBOARD_KIND;
  },

  pasteClipboard: (text, options) => {
    const raw = text?.trim() ?? "";
    const payload = raw
      ? parseClipboard(raw)
      : get().clipboard.length > 0
        ? { kind: CLIPBOARD_KIND, sourceId: get().clipboardSourceId, elements: get().clipboard }
        : readStoredClipboard();
    if (!payload?.elements.length) return false;
    if (!get().current()) return false;
    set((state) => {
      const current = state.current();
      if (!current) return state;
      const sameDoc = fromThisDocument(current, payload.elements);
      const explicitInPlace = Boolean(options?.inPlace);
      const inPlace = explicitInPlace || !sameDoc;
      const offset = inPlace ? 0 : 4 * state.pasteCount;
      let pasted = remapPastedGroups(
        payload.elements.map((el) => {
          const copy = cloneElement(el);
          copy.x = el.x + offset;
          copy.y = el.y + offset;
          return sameDoc && !inPlace ? keepOnPage(copy, current.page) : copy;
        }),
      );
      if (!explicitInPlace) pasted = fitGroupOnPage(pasted, current.page);
      const next = withHistory(state, { ...current, elements: [...current.elements, ...pasted] });
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return {
        ...next,
        clipboard: payload.elements,
        clipboardSourceId: payload.sourceId ?? state.clipboardSourceId,
        selectedIds: pasted.map((el) => el.id),
        pasteCount: inPlace ? 1 : state.pasteCount + 1,
      };
    });
    return true;
  },

  cutSelected: () => {
    if (!get().copySelected()) return false;
    get().deleteSelected();
    return true;
  },

  duplicateSelected: () => {
    if (!get().copySelected()) return false;
    return get().pasteClipboard();
  },

  groupSelected: () => {
    let grouped = false;
    set((state) => {
      const current = state.current();
      if (!current || state.selectedIds.length < 2) return state;
      const memberIds = new Set(expandGroupSelection(current.elements, state.selectedIds));
      if (!selectionGroupFlags(current.elements, [...memberIds]).canGroup) return state;
      grouped = true;
      const elements = packGroupedElements(current.elements, memberIds, createId());
      const next = withHistory(state, { ...current, elements });
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return { ...next, selectedIds: [...memberIds] };
    });
    return grouped;
  },

  ungroupSelected: () => {
    let ungrouped = false;
    set((state) => {
      const current = state.current();
      if (!current) return state;
      const groups = new Set(
        current.elements.filter((el) => state.selectedIds.includes(el.id) && el.groupId).map((el) => el.groupId as string),
      );
      if (!groups.size) return state;
      ungrouped = true;
      const elements = current.elements.map((el) =>
        el.groupId && groups.has(el.groupId) ? { ...el, groupId: undefined } : el,
      );
      const next = withHistory(state, { ...current, elements });
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return next;
    });
    return ungrouped;
  },

  nudgeSelected: (dx, dy) => {
    set((state) => {
      const current = state.current();
      if (!current || !state.selectedIds.length) return state;
      const next = withHistory(state, {
        ...current,
        elements: current.elements.map((el) => {
          if (!state.selectedIds.includes(el.id) || el.locked) return el;
          return {
            ...el,
            x: dx === 0 ? el.x : roundMm(el.x + dx, Math.abs(dx) >= 1 ? 1 : 0.1),
            y: dy === 0 ? el.y : roundMm(el.y + dy, Math.abs(dy) >= 1 ? 1 : 0.1),
          };
        }),
      });
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return next;
    });
  },

  moveLayer: (id, to) => {
    set((state) => {
      const current = state.current();
      if (!current) return state;
      const target = current.elements.find((el) => el.id === id);
      if (!target) return state;
      const memberIds = target.groupId
        ? new Set(current.elements.filter((el) => el.groupId === target.groupId).map((el) => el.id))
        : new Set([id]);
      const elements = moveBlock(current.elements, memberIds, to);
      if (elements === current.elements) return state;
      const next = withHistory(state, { ...current, elements });
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return next;
    });
  },

  reorderElements: (ids) => {
    set((state) => {
      const current = state.current();
      if (!current) return state;
      const byId = new Map(current.elements.map((el) => [el.id, el]));
      if (ids.length !== current.elements.length || ids.some((id) => !byId.has(id))) return state;
      if (ids.every((id, index) => current.elements[index]?.id === id)) return state;
      const elements = ids.map((id) => byId.get(id)!);
      const next = withHistory(state, { ...current, elements });
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return next;
    });
  },

  bringForward: () => {
    const id = get().selectedIds[0];
    if (id) get().moveLayer(id, "forward");
  },

  sendBackward: () => {
    const id = get().selectedIds[0];
    if (id) get().moveLayer(id, "backward");
  },

  alignSelected: (align) => {
    set((state) => {
      const current = state.current();
      if (!current || !state.selectedIds.length) return state;
      const units = selectionUnits(current.elements, state.selectedIds);
      if (!units.length) return state;
      const pageTarget = { x1: 0, y1: 0, x2: current.page.widthMm, y2: current.page.heightMm };
      // One object (or one group moved as a block) snaps to the page.
      // Several objects align to each other, keeping the selection where it is.
      const target = units.length === 1 ? pageTarget : unionAabb(units.flat());
      const byId = new Map<string, { dx: number; dy: number }>();
      for (const members of units) {
        const { dx, dy } = alignDelta(align, unionAabb(members), target);
        if (dx === 0 && dy === 0) continue;
        for (const el of members) {
          byId.set(el.id, { dx, dy });
        }
      }
      if (!byId.size) return state;
      const next = withHistory(state, {
        ...current,
        elements: current.elements.map((el) => {
          const delta = byId.get(el.id);
          if (!delta) return el;
          return { ...el, x: roundMm(el.x + delta.dx, 0.1), y: roundMm(el.y + delta.dy, 0.1) };
        }),
      });
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return next;
    });
  },

  distributeSelected: (axis) => {
    set((state) => {
      const current = state.current();
      if (!current) return state;
      const units = selectionUnits(current.elements, state.selectedIds);
      if (units.length < 3) return state;
      const items = units.map((members) => {
        const box = unionAabb(members);
        return { members, box, w: box.x2 - box.x1, h: box.y2 - box.y1 };
      });
      if (axis === "horizontal") items.sort((a, b) => a.box.x1 - b.box.x1 || a.w - b.w);
      else items.sort((a, b) => a.box.y1 - b.box.y1 || a.h - b.h);
      const first = items[0];
      const last = items[items.length - 1];
      const start = axis === "horizontal" ? first.box.x2 : first.box.y2;
      const end = axis === "horizontal" ? last.box.x1 : last.box.y1;
      const middle = items.slice(1, -1);
      const middleSize = middle.reduce((sum, item) => sum + (axis === "horizontal" ? item.w : item.h), 0);
      const spacing = (end - start - middleSize) / (items.length - 1);
      let cursor = start + spacing;
      const nextPos = new Map<string, { x: number; y: number }>();
      for (const item of middle) {
        const dx = axis === "horizontal" ? cursor - item.box.x1 : 0;
        const dy = axis === "vertical" ? cursor - item.box.y1 : 0;
        for (const el of item.members) {
          nextPos.set(el.id, { x: roundMm(el.x + dx, 0.1), y: roundMm(el.y + dy, 0.1) });
        }
        cursor += (axis === "horizontal" ? item.w : item.h) + spacing;
      }
      const next = withHistory(state, {
        ...current,
        elements: current.elements.map((el) => {
          const pos = nextPos.get(el.id);
          return pos ? { ...el, ...pos } : el;
        }),
      });
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return next;
    });
  },

  beginPropertyEdit: () => {
    set((state) => {
      if (state.editCheckpoint) return state;
      const current = state.current();
      if (!current) return state;
      return { editCheckpoint: cloneDocument(current) };
    });
  },

  endPropertyEdit: () => {
    set((state) => {
      const checkpoint = state.editCheckpoint;
      const current = state.current();
      if (!checkpoint || !current) return { editCheckpoint: null };
      const changed = JSON.stringify(checkpoint.elements) !== JSON.stringify(current.elements);
      if (!changed) return { editCheckpoint: null };
      return {
        editCheckpoint: null,
        past: [...state.past, checkpoint].slice(-HISTORY_LIMIT),
        future: [],
      };
    });
  },

  beginColorSample: (property) => {
    const ids = get().selectedIds;
    if (!ids.length) return;
    set({ colorSample: { targetIds: ids, property }, tool: "select" });
  },

  applySampledColor: (color) => {
    const sample = get().colorSample;
    const hex = color.trim();
    if (!sample || !isPaintColor(hex)) return;
    const current = get().current();
    if (!current) {
      set({ colorSample: null });
      return;
    }
    get().updateElements(
      sample.targetIds.map((id) => {
        const target = current.elements.find((el) => el.id === id);
        const style =
          sample.property === "stroke"
            ? { stroke: hex, strokeWidth: Math.max(target?.style.strokeWidth ?? 0, 0.35) }
            : sample.property === "background"
              ? { background: hex }
              : { fill: hex };
        return { id, patch: { style } };
      }),
    );
    set({ colorSample: null, selectedIds: sample.targetIds });
  },

  cancelColorSample: () => set({ colorSample: null }),

  setEditingTextId: (id) =>
    set({
      editingTextId: id,
      textStyleRequest: null,
      textHasSelection: false,
      textSelectionRange: null,
      textSelectionFontSizeMm: null,
    }),

  setTextHasSelection: (value) =>
    set({
      textHasSelection: value,
      textSelectionRange: value ? get().textSelectionRange : null,
      textSelectionFontSizeMm: value ? get().textSelectionFontSizeMm : null,
    }),

  setTextSelectionRange: (range) =>
    set({
      textSelectionRange: range,
      textHasSelection: range != null && range.end > range.start,
    }),

  requestTextStyle: (patch) => {
    if (!get().editingTextId) return;
    set({
      textStyleRequest: { ...patch, n: Date.now() },
      textSelectionFontSizeMm: patch.fontSizeMm ?? get().textSelectionFontSizeMm,
    });
  },

  saveColor: (hex) => {
    const color = normalizeHex(hex);
    if (!color) return;
    set((state) => {
      const savedColors = mergeSavedColors([color, ...state.savedColors]).slice(0, MAX_SAVED_COLORS);
      persist({ ...state, savedColors });
      return { savedColors };
    });
  },

  removeSavedColor: (hex) => {
    const color = normalizeHex(hex);
    if (!color) return;
    set((state) => {
      const savedColors = state.savedColors.filter((item) => item !== color);
      persist({ ...state, savedColors });
      return { savedColors };
    });
  },

  undo: () => {
    set((state) => {
      const current = state.current();
      if (!current) return state;
      if (state.editCheckpoint) {
        const next = {
          editCheckpoint: null,
          documents: state.documents.map((d) =>
            d.id === current.id ? keepDocumentVersions(current, state.editCheckpoint!) : d,
          ),
          future: [...state.future, stripDocumentVersions(cloneDocument(current))],
        };
        persist({ ...state, ...next, currentId: state.currentId, data: state.data });
        return next;
      }
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      const next = {
        past: state.past.slice(0, -1),
        future: [...state.future, stripDocumentVersions(cloneDocument(current))],
        documents: state.documents.map((d) =>
          d.id === current.id ? keepDocumentVersions(current, previous) : d,
        ),
      };
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return next;
    });
  },

  redo: () => {
    set((state) => {
      const current = state.current();
      const nextDoc = state.future[state.future.length - 1];
      if (!current || !nextDoc) return state;
      const next = {
        future: state.future.slice(0, -1),
        past: [...state.past, stripDocumentVersions(cloneDocument(current))],
        documents: state.documents.map((d) =>
          d.id === current.id ? keepDocumentVersions(current, nextDoc) : d,
        ),
      };
      persist({ ...state, ...next, currentId: state.currentId, data: state.data });
      return next;
    });
  },

  undoData: () => {
    let changed = false;
    set((state) => {
      const past = state.dataPast ?? [];
      const previous = past[past.length - 1];
      if (!previous) return state;
      changed = true;
      const next = {
        dataPast: past.slice(0, -1),
        dataFuture: [...(state.dataFuture ?? []), cloneData(state.data)],
        ...withGrid(state, previous),
      };
      persist({ ...state, ...next });
      return next;
    });
    return changed;
  },

  redoData: () => {
    let changed = false;
    set((state) => {
      const future = state.dataFuture ?? [];
      const nextData = future[future.length - 1];
      if (!nextData) return state;
      changed = true;
      const next = {
        dataFuture: future.slice(0, -1),
        dataPast: [...(state.dataPast ?? []), cloneData(state.data)],
        ...withGrid(state, nextData),
      };
      persist({ ...state, ...next });
      return next;
    });
    return changed;
  },

  loadWorkbook: async (file) => {
    const doc = get().current();
    const loaded = await loadExcelLabelData(file, doc);
    set((state) => {
      const data: PersistedData = {
        fileName: loaded.fileName ?? file.name,
        headers: loaded.headers,
        rows: loaded.rows,
        mapping: loaded.mapping,
        previewRowIndex: 0,
      };
      const next = withDataHistory(state, data);
      persist({ ...state, ...next });
      return next;
    });
  },

  setMapping: (binding, header) => {
    set((state) => {
      const mapping: ColumnMapping = { ...state.data.mapping, [binding]: header };
      const data = { ...state.data, mapping };
      persist({ ...state, ...withGrid(state, data) });
      return withGrid(state, data);
    });
  },

  autoMap: () => {
    const doc = get().current();
    if (!doc) return;
    set((state) => {
      const data = {
        ...state.data,
        mapping: autoMapBindings(documentBindings(doc), state.data.headers, doc.dataColumns),
      };
      persist({ ...state, ...withGrid(state, data) });
      return withGrid(state, data);
    });
  },

  setPreviewRow: (index) => {
    set((state) => {
      const last = Math.max(0, state.data.rows.length - 1);
      const previewRowIndex = Math.min(Math.max(0, index), last);
      if (state.data.previewRowIndex === previewRowIndex) return state;
      const data = { ...state.data, previewRowIndex };
      persist({ ...state, ...withGrid(state, data) });
      return withGrid(state, data);
    });
  },

  setGridCell: (rowIndex, header, value) => {
    get().setGridCells([{ rowIndex, header, value }]);
  },

  setGridCells: (updates) => {
    set((state) => {
      if (!updates.length) return state;
      let changed = false;
      const rows = state.data.rows.map((row) => ({ ...row }));
      for (const update of updates) {
        if (!state.data.headers.includes(update.header)) continue;
        while (rows.length <= update.rowIndex) {
          rows.push(Object.fromEntries(state.data.headers.map((header) => [header, ""])));
        }
        if (String(rows[update.rowIndex]?.[update.header] ?? "") === update.value) continue;
        rows[update.rowIndex] = { ...rows[update.rowIndex], [update.header]: update.value };
        changed = true;
      }
      if (!changed) return state;
      const next = withDataHistory(state, { ...state.data, rows });
      persist({ ...state, ...next });
      return next;
    });
  },

  pasteGrid: (rowIndex, colIndex, text, dest) => {
    let applied = { rows: 0, cols: 0 };
    set((state) => {
      const headers = state.data.headers;
      if (!headers.length) return state;
      let matrix = parseSpreadsheetPaste(text);
      if (!matrix.length) return state;
      if (rowIndex === 0 && colIndex === 0 && looksLikeHeaderRow(matrix[0], headers)) {
        matrix = matrix.slice(1);
      }
      if (!matrix.length) return state;
      if (dest) matrix = tileClipboard(matrix, dest.rows, dest.cols);
      const rows = state.data.rows.map((row) => ({ ...row }));
      const need = rowIndex + matrix.length;
      while (rows.length < need) rows.push(Object.fromEntries(headers.map((header) => [header, ""])));
      let maxCols = 0;
      for (let r = 0; r < matrix.length; r += 1) {
        const line = matrix[r];
        maxCols = Math.max(maxCols, line.length);
        for (let c = 0; c < line.length; c += 1) {
          const header = headers[colIndex + c];
          if (!header) break;
          rows[rowIndex + r][header] = line[c] ?? "";
        }
      }
      applied = { rows: matrix.length, cols: Math.min(maxCols, headers.length - colIndex) };
      const filled = filledRowIndexes(rows, headers);
      const previewRowIndex = filled.includes(state.data.previewRowIndex)
        ? state.data.previewRowIndex
        : (filled[0] ?? rowIndex);
      const data = { ...state.data, rows, previewRowIndex };
      const next = withDataHistory(state, data);
      persist({ ...state, ...next });
      return next;
    });
    return applied;
  },

  ensurePrintGrid: () => {
    const raw = get().current();
    if (!raw) return;
    const doc = repairTemplateDocument(raw);
    set((state) => {
      const documents = doc === raw ? state.documents : state.documents.map((item) => (item.id === doc.id ? doc : item));
      const stored = sameTemplateGrid(doc, state.data) ? state.data : state.templateGrids[doc.id];
      const data = gridForTemplate(doc, stored);
      if (documents === state.documents && data === state.data) return state;
      const next = { ...withGrid(state, data), documents };
      persist({ ...state, ...next });
      return next;
    });
  },

  ensureGridRows: (minLength) => {
    set((state) => {
      if (!state.data.headers.length) return state;
      const need = Math.max(0, Math.ceil(minLength) - state.data.rows.length);
      if (need <= 0) return state;
      const extra = Array.from({ length: need }, () =>
        Object.fromEntries(state.data.headers.map((header) => [header, ""])),
      );
      const data = { ...state.data, rows: [...state.data.rows, ...extra] };
      persist({ ...state, ...withGrid(state, data) });
      return withGrid(state, data);
    });
  },

  addGridRows: (count = 10) => {
    get().ensureGridRows(get().data.rows.length + Math.max(1, count));
  },

  clearData: () => {
    set((state) => {
      const current = state.current();
      const data = current ? templateGrid(current) : EMPTY_DATA;
      const next = withDataHistory(state, data);
      persist({ ...state, ...next });
      return next;
    });
  },

  importDocument: (raw) => {
    const doc = normalizeImportedTemplateJson(raw);
    doc.folderId =
      get().folders.find((folder) => folder.id === MY_TEMPLATES_FOLDER_ID)?.id || get().folders[0]?.id;
    doc.organizationId = get().currentOrganizationId ?? STELLANTIS_ORG_ID;
    doc.createdBy = get().currentUserId ?? DEMO_ADMIN_ID;
    doc.status = doc.status ?? "draft";
    set((state) => {
      const next = { documents: [doc, ...state.documents], currentId: doc.id, selectedIds: [], past: [], future: [] };
      persist({ ...state, ...next });
      return next;
    });
  },

  publishCurrent: () => {
    const current = get().current();
    const role = get().role();
    if (!current || (role && !canPublishTemplates(role))) return false;
    const actor = actorOf(get());
    const published = publishWorkspaceDocument(current, actor);
    set((state) => {
      const documents = state.documents.map((doc) => (doc.id === current.id ? published : doc));
      const activity = prependActivity(
        state.activity,
        makeActivityEvent({
          type: "published",
          templateId: current.id,
          templateName: current.name,
          versionNumber: published.versionNumber,
          organizationId: published.organizationId,
          userId: actor,
          userName: sessionOf(state)?.user.name,
        }),
      );
      persist();
      return { documents, activity };
    });
    return true;
  },

  archiveDocument: (id) => {
    const role = get().role();
    if (role && !canArchiveTemplates(role)) return false;
    const actor = actorOf(get());
    let archivedName = "";
    set((state) => {
      const target = state.documents.find((doc) => doc.id === id);
      if (!target) return state;
      archivedName = target.name;
      const documents = state.documents.map((doc) =>
        doc.id === id ? archiveWorkspaceDocument(doc, actor) : doc,
      );
      const activity = prependActivity(
        state.activity,
        makeActivityEvent({
          type: "archived",
          templateId: id,
          templateName: archivedName,
          organizationId: target.organizationId,
          userId: actor,
          userName: sessionOf(state)?.user.name,
        }),
      );
      persist();
      return { documents, activity };
    });
    return Boolean(archivedName);
  },

  completeLabelJob: (input) => {
    const session = get().session();
    if (!session) return;
    const failed = input.status === "failed";
    const successCount = failed ? 0 : Math.max(0, input.successCount ?? input.quantity);
    const failedCount = Math.max(0, input.failedCount ?? (failed ? input.quantity : 0));
    const outputType: LabelJobOutput = input.action === "print" ? "print" : "pdf";
    const organizationId = input.organizationId ?? session.organization.id;
    const job = makeLabelJob({
      organizationId,
      templateId: input.templateId,
      templateName: input.templateName,
      templateVersionId: input.templateVersionId,
      templateVersionNumber: input.templateVersionNumber,
      createdBy: session.user.id,
      createdByName: session.user.name,
      quantity: successCount,
      sourceType: input.sourceType,
      status: failed ? "failed" : "completed",
      fileName: input.fileName,
      pageSize: input.pageSize,
      error: input.error,
      rowCount: input.rowCount,
      successCount,
      failedCount,
      outputType,
    });
    set((state) => {
      const nextWorkspace = recordCompletedJob(
        {
          organizations: state.organizations,
          users: state.users,
          memberships: state.memberships,
          jobs: state.jobs,
          workspaceMigrationRev: state.workspaceMigrationRev,
        },
        job,
      );
      const activity = prependActivity(
        state.activity,
        makeActivityEvent({
          type: failed ? "generate_failed" : input.action === "print" ? "print" : "generate",
          templateId: input.templateId,
          templateName: input.templateName,
          labelCount: successCount,
          fileName: input.fileName,
          pageSize: input.pageSize,
          organizationId,
          userId: session.user.id,
          userName: session.user.name,
          versionNumber: input.templateVersionNumber,
        }),
      );
      persist();
      return {
        jobs: nextWorkspace.jobs,
        organizations: nextWorkspace.organizations,
        activity,
      };
    });
  },

  setCurrentUser: (userId) => {
    const state = get();
    const orgId = state.currentOrganizationId;
    const user = state.users.find((item) => item.id === userId);
    const membership = state.memberships.find(
      (item) => item.userId === userId && (!orgId || item.organizationId === orgId),
    );
    if (!user || !membership) return false;
    set({ currentUserId: userId });
    persist();
    return true;
  },

  updateOrganization: (patch) => {
    const role = get().role();
    if (role && !canManageUsers(role)) return false;
    const orgId = get().currentOrganizationId;
    if (!orgId) return false;
    let changed = false;
    set((state) => {
      const organizations = state.organizations.map((org) => {
        if (org.id !== orgId) return org;
        const name = patch.name?.trim();
        const next = {
          ...org,
          ...(name ? { name } : {}),
          ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
          ...(patch.companyName !== undefined ? { companyName: patch.companyName.trim() } : {}),
          updatedAt: new Date().toISOString(),
        };
        changed = true;
        return next;
      });
      if (!changed) return state;
      const org = organizations.find((item) => item.id === orgId);
      const activity = prependActivity(
        state.activity,
        makeActivityEvent({
          type: "workspace_updated",
          templateId: orgId,
          templateName: org?.name || "Workspace",
          organizationId: orgId,
          userId: actorOf(state),
          userName: sessionOf(state)?.user.name,
        }),
      );
      persist();
      return { organizations, activity };
    });
    return changed;
  },

  addMember: (input) => {
    const role = get().role();
    if (role && !canManageUsers(role)) return null;
    const orgId = get().currentOrganizationId;
    if (!orgId) return null;
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    if (!email || !name) return null;
    const existing = get().users.find((user) => user.email.toLowerCase() === email);
    if (existing && get().memberships.some((item) => item.userId === existing.id && item.organizationId === orgId)) {
      return null;
    }
    const now = new Date().toISOString();
    const user: User = existing ?? {
      id: createId(),
      name,
      email,
      createdAt: now,
      updatedAt: now,
    };
    const membership: OrganizationMembership = {
      id: createId(),
      organizationId: orgId,
      userId: user.id,
      role: input.role,
      createdAt: now,
    };
    set((state) => {
      const users = existing ? state.users.map((item) => (item.id === user.id ? { ...item, name, updatedAt: now } : item)) : [...state.users, user];
      const memberships = [...state.memberships, membership];
      const activity = prependActivity(
        state.activity,
        makeActivityEvent({
          type: "member_added",
          templateId: membership.id,
          templateName: name,
          organizationId: orgId,
          userId: actorOf(state),
          userName: sessionOf(state)?.user.name,
        }),
      );
      persist();
      return { users, memberships, activity };
    });
    return membership.id;
  },

  updateMemberRole: (membershipId, nextRole) => {
    const role = get().role();
    if (role && !canManageUsers(role)) return false;
    const orgId = get().currentOrganizationId;
    if (!orgId) return false;
    const membership = get().memberships.find((item) => item.id === membershipId);
    if (!membership || membership.organizationId !== orgId) return false;
    if (membership.role === "admin" && nextRole !== "admin" && adminCount(get().memberships, orgId) <= 1) {
      return false;
    }
    set((state) => {
      const memberships = state.memberships.map((item) =>
        item.id === membershipId ? { ...item, role: nextRole } : item,
      );
      const user = state.users.find((item) => item.id === membership.userId);
      const activity = prependActivity(
        state.activity,
        makeActivityEvent({
          type: "member_updated",
          templateId: membershipId,
          templateName: user?.name || "Member",
          organizationId: orgId,
          userId: actorOf(state),
          userName: sessionOf(state)?.user.name,
        }),
      );
      persist();
      return { memberships, activity };
    });
    return true;
  },

  removeMember: (membershipId) => {
    const role = get().role();
    if (role && !canManageUsers(role)) return false;
    const orgId = get().currentOrganizationId;
    if (!orgId) return false;
    const membership = get().memberships.find((item) => item.id === membershipId);
    if (!membership || membership.organizationId !== orgId) return false;
    if (membership.userId === get().currentUserId) return false;
    if (membership.role === "admin" && adminCount(get().memberships, orgId) <= 1) return false;
    set((state) => {
      const memberships = state.memberships.filter((item) => item.id !== membershipId);
      const user = state.users.find((item) => item.id === membership.userId);
      const activity = prependActivity(
        state.activity,
        makeActivityEvent({
          type: "member_removed",
          templateId: membershipId,
          templateName: user?.name || "Member",
          organizationId: orgId,
          userId: actorOf(state),
          userName: sessionOf(state)?.user.name,
        }),
      );
      persist();
      return { memberships, activity };
    });
    return true;
  },

  saveNow: async () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    const state = get();
    set({ saveState: "saving" });
    await saveAllDocuments(state.documents);
    await saveMeta(persistMeta(state));
    await writeLibraryBackup();
    if (!persistTimer) set({ saveState: "saved" });
  },
}));
