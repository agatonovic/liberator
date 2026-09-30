import { describe, expect, it } from "vitest";
import { CATALOG, CATALOG_REVISION } from "@/lib/catalog";
import { catalogRegistry } from "@/lib/catalog-registry";
import { createDocument, createElement } from "@/lib/document";
import { STELLANTIS_ORG_ID, SHOPIFY_ORG_ID } from "@/lib/domain";
import { mergeLibrarySnapshotForWrite, type LibrarySnapshot } from "@/lib/library-file";
import { seedTemplateLibrary } from "@/lib/library";
import {
  TEMPLATE_JSON_SCHEMA_VERSION,
  buildTemplateJson,
  documentForPublishedExport,
  isLabelatorTemplateJson,
  normalizeImportedTemplateJson,
  templateJsonFileName,
} from "@/lib/template-json";
import { visibleTemplates } from "@/lib/template-library";
import { shopifyCatalogDocument, SHOPIFY_CATALOG } from "@/shopify/catalog";
import library from "../data/library.json";

function snapshot(partial: Partial<LibrarySnapshot> & Pick<LibrarySnapshot, "documents" | "folders">): LibrarySnapshot {
  return { currentId: null, ...partial };
}

describe("edition catalog boundaries", () => {
  it("does not seed Shopify catalog into Industrial libraries", () => {
    const seeded = seedTemplateLibrary([], [], false, [], "industrial");
    expect(seeded.documents.some((doc) => String(doc.catalogId ?? "").startsWith("shopify_"))).toBe(false);
    expect(CATALOG.some((entry) => entry.id.startsWith("shopify_"))).toBe(false);
    expect(catalogRegistry("shopify").entries).toEqual([]);
  });

  it("does not seed Industrial catalog into Shopify libraries", () => {
    const seeded = seedTemplateLibrary([], [], false, [], "shopify");
    expect(seeded.documents).toEqual([]);
    expect(SHOPIFY_CATALOG.every((entry) => entry.id.startsWith("shopify_"))).toBe(true);
  });

  it("keeps Industrial and Shopify template visibility isolated", () => {
    const industrial = { ...createDocument("Plant"), organizationId: STELLANTIS_ORG_ID };
    const shopify = shopifyCatalogDocument("shopify_product_barcode");
    expect(visibleTemplates([industrial, shopify], "admin", STELLANTIS_ORG_ID).map((doc) => doc.id)).toEqual([
      industrial.id,
    ]);
    expect(visibleTemplates([industrial, shopify], "admin", SHOPIFY_ORG_ID).map((doc) => doc.id)).toEqual([shopify.id]);
  });
});

describe("template JSON export", () => {
  it("exports schemaVersion 1 without mutating the source document", () => {
    const ga = library.documents.find((doc) => doc.name === "GA Address")!;
    const before = structuredClone(ga);
    const payload = buildTemplateJson(ga as never, { exportScope: "working", exportedAt: "2026-09-04T00:00:00.000Z" });
    expect(payload.schemaVersion).toBe(TEMPLATE_JSON_SCHEMA_VERSION);
    expect(payload.kind).toBe("labelator.template");
    expect(payload.exportScope).toBe("working");
    expect(payload.document.id).toBe(ga.id);
    expect(payload.document.elements).toHaveLength(ga.elements.length);
    expect(payload.document.elements).toEqual(ga.elements);
    expect(ga).toEqual(before);
    expect(templateJsonFileName(payload.document)).toMatch(/^labelator-ga-address-v3\.json$/);
  });

  it("exports Canopy, OVS dual, barcode, and Warehouse A3 templates with their bindings", () => {
    const names = ["Canopy A3 — 3 PN", "OVS A3 dual", "GA Warehouse Dual", "Warehouse A3 Final "];
    for (const name of names) {
      const doc = library.documents.find((item) => item.name === name);
      expect(doc, name).toBeTruthy();
      const payload = buildTemplateJson(doc as never);
      expect(payload.document.elements.length).toBeGreaterThan(0);
      expect(payload.document.page.widthMm).toBeGreaterThan(0);
    }
    const dual = library.documents.find((doc) => doc.name === "GA Warehouse Dual")!;
    const payload = buildTemplateJson(dual as never);
    expect(payload.document.elements.some((el) => el.type === "barcode" || el.binding)).toBe(true);
  });

  it("round-trips through the import normalizer without writing library.json", () => {
    const ga = library.documents.find((doc) => doc.name === "GA Address")!;
    const payload = buildTemplateJson(ga as never);
    expect(isLabelatorTemplateJson(payload)).toBe(true);
    const imported = normalizeImportedTemplateJson(payload);
    expect(imported.id).not.toBe(ga.id);
    expect(imported.name).toBe(ga.name);
    expect(imported.elements).toHaveLength(ga.elements.length);
    expect(imported.page).toEqual(ga.page);
  });

  it("accepts bare LabelDocument imports for backward compatibility", () => {
    const bare = createDocument("Legacy");
    bare.elements = [createElement("text", 1, 1, { content: "Hi", binding: "sku" })];
    const imported = normalizeImportedTemplateJson(bare);
    expect(imported.name).toBe("Legacy");
    expect(imported.elements[0]?.binding).toBe("sku");
  });

  it("can export the published snapshot when present", () => {
    const doc = createDocument("Published export");
    doc.elements = [createElement("text", 0, 0, { content: "WORKING", binding: "title" })];
    doc.status = "published";
    doc.publishedVersionId = "ver_pub";
    doc.versions = [
      {
        id: "ver_pub",
        name: "v1",
        createdAt: "2026-01-01T00:00:00.000Z",
        number: 1,
        status: "published",
        snapshot: {
          page: doc.page,
          elements: [createElement("text", 0, 0, { content: "PUBLISHED", binding: "title" })],
          dataColumns: [],
        },
      },
    ];
    const published = documentForPublishedExport(doc);
    const payload = buildTemplateJson(published, { exportScope: "published" });
    expect(payload.exportScope).toBe("published");
    expect(payload.document.elements[0]?.content).toBe("PUBLISHED");
    expect(doc.elements[0]?.content).toBe("WORKING");
  });
});

describe("library seed write safety", () => {
  it("refuses to append Shopify or runtime templates onto the Industrial seed", () => {
    const shopify = shopifyCatalogDocument("shopify_shelf");
    const runtime = createDocument("Local only");
    runtime.organizationId = STELLANTIS_ORG_ID;
    const merged = mergeLibrarySnapshotForWrite(
      snapshot({
        documents: [...(library.documents as never[]), shopify, runtime],
        folders: library.folders as never,
      }),
      library as never,
    );
    expect(merged.documents).toHaveLength(library.documents.length);
    expect(merged.documents.some((doc) => doc.id === shopify.id || doc.id === runtime.id)).toBe(false);
    expect(CATALOG_REVISION).toEqual({
      ga_warehouse_a3: 3,
      ga_warehouse_a3_dual: 3,
      fixed_ga_a3: 3,
      fixed_ga_a4: 3,
    });
  });
});
