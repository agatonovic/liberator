import { describe, expect, it } from "vitest";
import { createDocument, createElement, repairTemplateDocument } from "@/lib/document";
import { isLibrarySnapshot, mergeLibrarySnapshotForWrite, type LibrarySnapshot } from "@/lib/library-file";
import { STELLANTIS_ORG_ID } from "@/lib/domain";
import { isStaticExportBuild } from "@/lib/session";
import { PUT } from "@/app/api/library/route";
import library from "../data/library.json";

function snapshot(partial: Partial<LibrarySnapshot> & Pick<LibrarySnapshot, "documents" | "folders">): LibrarySnapshot {
  return { currentId: null, ...partial };
}

describe("library PUT merge", () => {
  it("stamps organizationId without replacing live Stellantis geometry", () => {
    const ga = library.documents.find((doc) => doc.name === "GA Address");
    expect(ga).toBeTruthy();
    const mutated = {
      ...ga!,
      organizationId: STELLANTIS_ORG_ID,
      elements: ga!.elements.map((el, index) => (index === 0 ? { ...el, content: "MUTATED" } : el)),
    };
    const merged = mergeLibrarySnapshotForWrite(
      snapshot({ documents: [mutated as never], folders: library.folders as never }),
      library as never,
    );
    const next = merged.documents.find((doc) => doc.id === ga!.id);
    expect(next?.organizationId).toBe(STELLANTIS_ORG_ID);
    expect(next?.elements).toEqual(ga!.elements);
    expect(merged.documents).toHaveLength(library.documents.length);
  });

  it("does not append new runtime templates onto an existing Industrial seed", () => {
    const extra = createDocument("New");
    extra.elements = [createElement("text", 0, 0, { content: "Hello" })];
    extra.organizationId = STELLANTIS_ORG_ID;
    const drop = library.documents[0];
    const merged = mergeLibrarySnapshotForWrite(
      snapshot({
        documents: [...(library.documents as never[]), extra],
        folders: library.folders as never,
        deletedIds: [drop.id],
      }),
      library as never,
    );
    expect(merged.documents.some((doc) => doc.id === extra.id)).toBe(false);
    expect(merged.documents.some((doc) => doc.id === drop.id)).toBe(false);
    expect(merged.documents).toHaveLength(library.documents.length - 1);
  });

  it("honors tombstones without replacing live geometry", () => {
    const drop = library.documents[0];
    const mutated = library.documents.map((doc) =>
      doc.id === drop.id
        ? doc
        : {
            ...doc,
            organizationId: STELLANTIS_ORG_ID,
            elements: doc.elements.map((el, index) => (index === 0 ? { ...el, content: "MUTATED" } : el)),
          },
    );
    const merged = mergeLibrarySnapshotForWrite(
      snapshot({
        documents: mutated as never,
        folders: library.folders as never,
        deletedIds: [drop.id],
      }),
      library as never,
    );
    expect(merged.documents.some((doc) => doc.id === drop.id)).toBe(false);
    for (const next of merged.documents) {
      const disk = library.documents.find((doc) => doc.id === next.id);
      expect(next.elements).toEqual(disk?.elements);
      expect(next.organizationId).toBe(STELLANTIS_ORG_ID);
    }
  });

  it("prevents hydrate repairs of the Phase 1 templates from overwriting disk geometry", () => {
    const ids = [
      "0a9b4a95-985c-487d-a58e-057a5e45ba57",
      "6060f5ce-7572-44a4-b085-9845557f62df",
      "ac4c76e0-42b0-4233-94d9-946516d43d80",
    ];
    const repaired = library.documents.map((doc) =>
      ids.includes(doc.id) ? { ...repairTemplateDocument(doc as never), organizationId: STELLANTIS_ORG_ID } : doc,
    );
    const merged = mergeLibrarySnapshotForWrite(
      snapshot({ documents: repaired as never, folders: library.folders as never }),
      library as never,
    );
    for (const id of ids) {
      const disk = library.documents.find((doc) => doc.id === id);
      const next = merged.documents.find((doc) => doc.id === id);
      expect(next?.elements).toEqual(disk?.elements);
      expect(next?.organizationId).toBe(STELLANTIS_ORG_ID);
    }
  });

  it("stamps folder organizationId without dropping the Stellantis folder", () => {
    const folder = library.folders[0];
    const merged = mergeLibrarySnapshotForWrite(
      snapshot({
        documents: library.documents as never,
        folders: [{ ...folder, organizationId: STELLANTIS_ORG_ID, name: "MUTATED FOLDER" }],
      }),
      library as never,
    );
    expect(merged.folders).toHaveLength(1);
    expect(merged.folders[0]?.id).toBe(folder.id);
    expect(merged.folders[0]?.name).toBe(folder.name);
    expect(merged.folders[0]?.organizationId).toBe(STELLANTIS_ORG_ID);
  });
});

describe("library snapshot validation", () => {
  it("rejects malformed PUT bodies", () => {
    expect(isLibrarySnapshot({ nope: true })).toBe(false);
    expect(isLibrarySnapshot(null)).toBe(false);
    expect(isLibrarySnapshot({ documents: [], folders: "nope" })).toBe(false);
    expect(isLibrarySnapshot({ documents: [{ id: "x" }], folders: [] })).toBe(false);
    expect(isLibrarySnapshot(library)).toBe(true);
  });
});

describe("/api/library PUT handler", () => {
  it("returns 400 for malformed JSON snapshots and does not require a live write", async () => {
    const res = await PUT(new Request("http://localhost/api/library", { method: "PUT", body: JSON.stringify({ nope: true }) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid library snapshot." });
  });

  it("returns 404 when GITHUB_PAGES static export is active", async () => {
    const previous = process.env.GITHUB_PAGES;
    process.env.GITHUB_PAGES = "true";
    expect(isStaticExportBuild()).toBe(true);
    try {
      const res = await PUT(new Request("http://localhost/api/library", { method: "PUT", body: JSON.stringify({ nope: true }) }));
      expect(res.status).toBe(404);
    } finally {
      if (previous === undefined) delete process.env.GITHUB_PAGES;
      else process.env.GITHUB_PAGES = previous;
    }
  });
});
