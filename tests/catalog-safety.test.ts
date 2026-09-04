import { describe, expect, it } from "vitest";
import { CATALOG, CATALOG_REVISION, buildCatalogDocument } from "@/lib/catalog";
import { catalogEntriesForEdition, catalogRegistry, catalogRevisionForEdition } from "@/lib/catalog-registry";
import { refreshStaleCatalogDocuments, seedTemplateLibrary } from "@/lib/library";
import library from "../data/library.json";

const LIBRARY_TEMPLATE_IDS = [
  "0a9b4a95-985c-487d-a58e-057a5e45ba57",
  "0bc3bdcb-e913-4015-bb02-d95a0d17c39e",
  "14057388-ae40-4251-a03d-d9cb77a5d0e4",
  "3085002f-b6ce-4feb-bfb5-62f111cd9645",
  "374ebcd7-87ef-4c98-b006-3cb9d38d659b",
  "5289784a-bd04-47ed-99da-e936c3618691",
  "6060f5ce-7572-44a4-b085-9845557f62df",
  "ac4c76e0-42b0-4233-94d9-946516d43d80",
  "d74d79b4-d004-47d5-b9f2-373d06a3abcc",
  "ee4837ef-c0f7-4ac9-8612-a689518ad7b0",
  "ff9a7d76-b9a8-4b29-a861-612b6142c9a9",
] as const;

describe("Industrial catalog freeze", () => {
  it("does not change CATALOG_REVISION values", () => {
    expect(CATALOG_REVISION).toEqual({
      ga_warehouse_a3: 3,
      ga_warehouse_a3_dual: 3,
      fixed_ga_a3: 3,
      fixed_ga_a4: 3,
    });
  });

  it("keeps the Industrial catalog ids", () => {
    expect(CATALOG.map((entry) => entry.id)).toEqual([
      "warehouse_a3",
      "cdc_a3",
      "simple_ovs_a3",
      "simple_ovs_a3_dual",
      "hbc_a4",
      "canopy_a3_1pn",
      "canopy_a3_2pn",
      "canopy_a3_3pn",
      "slozivost_a4",
      "ga_warehouse_a3",
      "ga_warehouse_a3_dual",
      "fixed_ga_a3",
      "fixed_ga_a4",
      "sample_shipping",
    ]);
  });

  it("builds each Industrial catalog entry with a stable catalogId", () => {
    for (const entry of CATALOG) {
      const doc = buildCatalogDocument(entry.id);
      expect(doc.catalogId).toBe(entry.id);
      expect(doc.elements.length).toBeGreaterThan(0);
      if (CATALOG_REVISION[entry.id] != null) {
        expect(doc.catalogRevision).toBe(CATALOG_REVISION[entry.id]);
      }
    }
  });

  it("does not expose Shopify templates through the Industrial registry", () => {
    expect(catalogEntriesForEdition("industrial")).toBe(CATALOG);
    expect(catalogRevisionForEdition("industrial")).toBe(CATALOG_REVISION);
    expect(catalogRegistry("shopify").entries).toEqual([]);
    expect(catalogRegistry("shopify").revision).toEqual({});
  });
});

describe("Stellantis library.json regression", () => {
  const documents = library.documents;

  it("keeps the live template ids, catalog ids, revisions, and element counts", () => {
    expect(documents.map((doc) => doc.id).sort()).toEqual([...LIBRARY_TEMPLATE_IDS].sort());
    const byId = Object.fromEntries(
      documents.map((doc) => [
        doc.id,
        {
          name: doc.name,
          catalogId: doc.catalogId ?? null,
          catalogRevision: doc.catalogRevision ?? null,
          elements: doc.elements.length,
        },
      ]),
    );
    expect(byId["ff9a7d76-b9a8-4b29-a861-612b6142c9a9"]).toEqual({
      name: "FIXED GA A4",
      catalogId: "fixed_ga_a4",
      catalogRevision: 3,
      elements: 8,
    });
    expect(byId["0a9b4a95-985c-487d-a58e-057a5e45ba57"]).toEqual({
      name: "GA Address",
      catalogId: "ga_warehouse_a3",
      catalogRevision: 3,
      elements: 18,
    });
    expect(byId["5289784a-bd04-47ed-99da-e936c3618691"]).toEqual({
      name: "GA Warehouse Dual",
      catalogId: "ga_warehouse_a3_dual",
      catalogRevision: 3,
      elements: 25,
    });
    expect(byId["ee4837ef-c0f7-4ac9-8612-a689518ad7b0"].catalogId).toBe("warehouse_a3");
    expect(byId["14057388-ae40-4251-a03d-d9cb77a5d0e4"].catalogId).toBeNull();
    expect(byId["374ebcd7-87ef-4c98-b006-3cb9d38d659b"].catalogId).toBeNull();
    expect(documents.some((doc) => String(doc.catalogId ?? "").startsWith("shopify"))).toBe(false);
    expect(documents.some((doc) => /shopify/i.test(doc.name))).toBe(false);
  });

  it("does not recatalogue customized copies on seed/refresh", () => {
    const snapshot = documents.map((doc) => ({
      id: doc.id,
      catalogId: doc.catalogId,
      catalogRevision: doc.catalogRevision,
      elements: doc.elements.length,
      updatedAt: doc.updatedAt,
    }));
    const seeded = seedTemplateLibrary(documents as never, library.folders as never, true, library.deletedFolderIds);
    const refreshed = refreshStaleCatalogDocuments(seeded.documents);
    expect(refreshed.didChange).toBe(false);
    expect(
      seeded.documents.map((doc) => ({
        id: doc.id,
        catalogId: doc.catalogId,
        catalogRevision: doc.catalogRevision,
        elements: doc.elements.length,
        updatedAt: doc.updatedAt,
      })),
    ).toEqual(snapshot);
  });

  it("does not seed Industrial templates into an empty Shopify edition library", () => {
    const seeded = seedTemplateLibrary([], [], false, [], "shopify");
    expect(seeded.documents).toEqual([]);
    expect(seeded.folders.some((folder) => folder.name === "Stellantis Kragujevac")).toBe(false);
  });
});
