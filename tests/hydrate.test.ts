import { describe, expect, it } from "vitest";
import { createDocument, createElement } from "@/lib/document";
import { STELLANTIS_ORG_ID } from "@/lib/domain";
import { assembleHydratedLibrary } from "@/lib/library-hydrate";
import { seedTemplateLibrary } from "@/lib/library";
import { visibleTemplates } from "@/lib/template-library";
import library from "../data/library.json";

const LIVE_IDS = library.documents.map((doc) => doc.id).sort();
const SHOPIFY_ORG = "org_shopify_demo";
const GA_ADDRESS_ID = "0a9b4a95-985c-487d-a58e-057a5e45ba57";

describe("empty IndexedDB hydrate", () => {
  it("loads the committed Stellantis library onto org_stellantis_kragujevac", () => {
    const hydrated = assembleHydratedLibrary({
      stored: [],
      remote: library as never,
      meta: null,
    });
    expect(hydrated.documents.map((doc) => doc.id).sort()).toEqual(LIVE_IDS);
    expect(hydrated.documents).toHaveLength(11);
    expect(hydrated.documents.every((doc) => doc.organizationId === STELLANTIS_ORG_ID)).toBe(true);
    expect(hydrated.folders.every((folder) => folder.organizationId === STELLANTIS_ORG_ID)).toBe(true);
    expect(visibleTemplates(hydrated.documents, "admin", STELLANTIS_ORG_ID)).toHaveLength(11);
    expect(visibleTemplates(hydrated.documents, "admin", SHOPIFY_ORG)).toEqual([]);
    const ga = hydrated.documents.find((doc) => doc.id === GA_ADDRESS_ID);
    expect(ga?.catalogId).toBe("ga_warehouse_a3");
    expect(ga?.elements).toHaveLength(18);
  });

  it("seeds the Industrial catalog when there is no stored library at all", () => {
    const hydrated = assembleHydratedLibrary({ stored: [], remote: null, meta: null });
    expect(hydrated.documents.some((doc) => doc.catalogId === "ga_warehouse_a3")).toBe(true);
    expect(hydrated.documents.some((doc) => doc.catalogId === "warehouse_a3")).toBe(true);
    expect(hydrated.folders.some((folder) => folder.name === "Stellantis Kragujevac")).toBe(true);
    const emptyShopify = seedTemplateLibrary([], [], false, [], "shopify");
    expect(emptyShopify.documents).toEqual([]);
  });
});

describe("populated IndexedDB hydrate", () => {
  it("keeps a customized live template instead of replacing it with the disk snapshot", () => {
    const disk = library.documents.find((doc) => doc.id === GA_ADDRESS_ID)!;
    const customized = {
      ...disk,
      updatedAt: "2099-01-01T00:00:00.000Z",
      elements: disk.elements.map((el) =>
        el.id === "b4f1e589-f6a6-4513-ae27-fc9e1d47bc33" ? { ...el, content: "CUSTOM-ARROW" } : el,
      ),
    };
    const hydrated = assembleHydratedLibrary({
      stored: [customized as never],
      remote: library as never,
      meta: { librarySeeded: true, folders: library.folders as never },
    });
    const next = hydrated.documents.find((doc) => doc.id === GA_ADDRESS_ID);
    expect(next?.elements.find((el) => el.id === "b4f1e589-f6a6-4513-ae27-fc9e1d47bc33")?.content).toBe("CUSTOM-ARROW");
    expect(hydrated.documents.map((doc) => doc.id).sort()).toEqual(LIVE_IDS);
  });

  it("does not drop customized templates that only exist in IndexedDB", () => {
    const extra = createDocument("Local draft");
    extra.elements = [createElement("text", 4, 4, { content: "Only in IDB" })];
    extra.organizationId = STELLANTIS_ORG_ID;
    extra.updatedAt = "2099-01-01T00:00:00.000Z";
    extra.folderId = library.folders[0]?.id;
    const hydrated = assembleHydratedLibrary({
      stored: [...(library.documents as never[]), extra],
      remote: library as never,
      meta: { librarySeeded: true, folders: library.folders as never },
    });
    expect(hydrated.documents.some((doc) => doc.id === extra.id)).toBe(true);
    expect(hydrated.documents.find((doc) => doc.id === extra.id)?.elements[0]?.content).toBe("Only in IDB");
  });
});
