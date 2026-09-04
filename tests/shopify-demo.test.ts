import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOG, CATALOG_REVISION } from "@/lib/catalog";
import { catalogRegistry } from "@/lib/catalog-registry";
import { STELLANTIS_ORG_ID, SHOPIFY_ORG_ID } from "@/lib/domain";
import { createDocument } from "@/lib/document";
import { omitShopifyFromLibrarySnapshot } from "@/lib/library-guard";
import { evaluateGenerateRun } from "@/lib/run-status";
import { resolveValue } from "@/lib/resolve";
import { jobsForOrganization } from "@/lib/jobs";
import { visibleTemplates } from "@/lib/template-library";
import { migrateWorkspace } from "@/lib/workspace";
import { shopifyDemoOrganization, stellantisOrganization } from "@/lib/session";
import { shopifyLabelDataProvider, loadDemoShopifyLabelData } from "@/shopify/adapter";
import { SHOPIFY_CATALOG, SHOPIFY_CATALOG_REVISION, shopifyCatalogDocument } from "@/shopify/catalog";
import { DEMO_SHOPIFY_PRODUCTS } from "@/shopify/demo-store";
import { SHOPIFY_FIELD_KEYS } from "@/shopify/fields";
import library from "../data/library.json";

describe("Shopify demo provider", () => {
  it("returns a valid LabelDataSet of DataRows", async () => {
    const data = await shopifyLabelDataProvider.load({});
    expect(shopifyLabelDataProvider.kind).toBe("shopify");
    expect(data.sourceKind).toBe("shopify");
    expect(data.rows.length).toBeGreaterThan(20);
    expect(data.headers).toEqual([...SHOPIFY_FIELD_KEYS]);
    expect(data.mapping.title).toBe("title");
    expect(data.mapping.sku).toBe("sku");
  });

  it("maps demo products onto normalized label fields", () => {
    const data = loadDemoShopifyLabelData({ productIds: ["prod_mug"] });
    expect(data.rows).toHaveLength(2);
    const row = data.rows[0];
    expect(row?.title).toBe("Ceramic Coffee Mug");
    expect(row?.vendor).toBe("Harbor Home");
    expect(row?.sku).toBe("MUG-001");
    expect(row?.barcode).toBe("8601234560014");
    expect(row?.price).toBe("€12.00");
    expect(row?.variant).toBe("11 oz");
    expect(row?.image).toMatch(/\/shopify-demo\/mug\.svg$/);
    expect(row?.quantity).toBe("48");
    for (const key of ["title", "sku", "barcode", "price", "variant", "image"] as const) {
      expect(row?.[key]).toBeTruthy();
    }
  });

  it("has no remote image or network dependency", () => {
    const adapter = readFileSync("src/shopify/adapter.ts", "utf8");
    const store = readFileSync("src/shopify/demo-store.ts", "utf8");
    expect(adapter).not.toMatch(/https?:\/\//);
    expect(adapter).not.toMatch(/fetch\(/);
    expect(store).not.toMatch(/https?:\/\//);
    for (const product of DEMO_SHOPIFY_PRODUCTS) {
      expect(product.image.startsWith("/shopify-demo/")).toBe(true);
      expect(existsSync(`public${product.image}`)).toBe(true);
    }
    expect(DEMO_SHOPIFY_PRODUCTS.length).toBeGreaterThanOrEqual(20);
    expect(DEMO_SHOPIFY_PRODUCTS.length).toBeLessThanOrEqual(30);
  });
});

describe("Shopify catalog boundary", () => {
  it("keeps Shopify templates out of the Industrial catalog", () => {
    expect(CATALOG.some((entry) => entry.id.startsWith("shopify_"))).toBe(false);
    expect(catalogRegistry("shopify").entries).toEqual([]);
    expect(catalogRegistry("industrial").revision).toBe(CATALOG_REVISION);
    expect(CATALOG_REVISION).toEqual({
      ga_warehouse_a3: 3,
      ga_warehouse_a3_dual: 3,
      fixed_ga_a3: 3,
      fixed_ga_a4: 3,
    });
    expect(library.documents.some((doc) => String(doc.catalogId ?? "").startsWith("shopify"))).toBe(false);
    for (const entry of SHOPIFY_CATALOG) {
      const doc = shopifyCatalogDocument(entry.id);
      expect(doc.catalogId).toBe(entry.id);
      expect(doc.organizationId).toBe(SHOPIFY_ORG_ID);
      expect(doc.catalogRevision).toBe(SHOPIFY_CATALOG_REVISION[entry.id]);
    }
  });
});

describe("Shopify workspace isolation", () => {
  it("keeps Shopify jobs and templates out of Stellantis views", () => {
    const industrial = { ...createDocument("Plant"), organizationId: STELLANTIS_ORG_ID };
    const merchant = shopifyCatalogDocument("shopify_product_barcode");
    expect(visibleTemplates([industrial, merchant], "admin", STELLANTIS_ORG_ID).map((doc) => doc.id)).toEqual([
      industrial.id,
    ]);
    expect(visibleTemplates([industrial, merchant], "admin", SHOPIFY_ORG_ID).map((doc) => doc.id)).toEqual([
      merchant.id,
    ]);
    const jobs = [
      {
        id: "j-ind",
        organizationId: STELLANTIS_ORG_ID,
        templateId: industrial.id,
        templateName: "Plant",
        templateVersionId: "v",
        templateVersionNumber: 1,
        createdBy: "u",
        createdByName: "U",
        createdAt: "",
        status: "completed" as const,
        quantity: 1,
        sourceType: "excel" as const,
      },
      {
        id: "j-shop",
        organizationId: SHOPIFY_ORG_ID,
        templateId: merchant.id,
        templateName: merchant.name,
        templateVersionId: "v",
        templateVersionNumber: 1,
        createdBy: "u",
        createdByName: "U",
        createdAt: "",
        status: "completed" as const,
        quantity: 4,
        sourceType: "shopify" as const,
        fileName: "4 products",
      },
    ];
    expect(jobsForOrganization(jobs, STELLANTIS_ORG_ID).map((job) => job.id)).toEqual(["j-ind"]);
    expect(jobsForOrganization(jobs, SHOPIFY_ORG_ID).map((job) => job.id)).toEqual(["j-shop"]);
  });

  it("does not write Shopify documents into Industrial library.json snapshots", () => {
    const shopifyDoc = shopifyCatalogDocument("shopify_shelf");
    const snapshot = omitShopifyFromLibrarySnapshot({
      documents: [...(library.documents as never[]), shopifyDoc],
      folders: library.folders as never,
      currentId: null,
      activity: [{ id: "a1", type: "generate", templateId: shopifyDoc.id, templateName: shopifyDoc.name, timestamp: "", labelCount: 1, organizationId: SHOPIFY_ORG_ID }],
    });
    expect(snapshot.documents.some((doc) => doc.id === shopifyDoc.id)).toBe(false);
    expect(snapshot.activity ?? []).toEqual([]);
  });

  it("adds the Shopify demo organization without sharing Stellantis templates", () => {
    const migrated = migrateWorkspace({
      documents: library.documents as never,
      folders: library.folders as never,
      workspace: {
        organizations: [stellantisOrganization(), shopifyDemoOrganization()],
        users: [],
        memberships: [],
        jobs: [],
        workspaceMigrationRev: 1,
      },
    });
    expect(migrated.workspace.organizations.some((org) => org.id === SHOPIFY_ORG_ID)).toBe(true);
    expect(visibleTemplates(migrated.documents, "admin", SHOPIFY_ORG_ID)).toEqual([]);
    expect(visibleTemplates(migrated.documents, "admin", STELLANTIS_ORG_ID).length).toBeGreaterThan(0);
  });
});

describe("Shopify data in the shared generation pipeline", () => {
  it("binds demo product fields onto an existing-engine template", async () => {
    const data = await shopifyLabelDataProvider.load({ productIds: ["prod_mug"] });
    const doc = shopifyCatalogDocument("shopify_product_barcode");
    const title = doc.elements.find((el) => el.binding === "title");
    const sku = doc.elements.find((el) => el.binding === "sku");
    const barcode = doc.elements.find((el) => el.binding === "barcode");
    expect(title && sku && barcode).toBeTruthy();
    expect(resolveValue(title!, data.rows[0]!, data.mapping, doc.dataColumns)).toBe("Ceramic Coffee Mug");
    expect(resolveValue(sku!, data.rows[0]!, data.mapping, doc.dataColumns)).toBe("MUG-001");
    expect(resolveValue(barcode!, data.rows[0]!, data.mapping, doc.dataColumns)).toBe("8601234560014");
    const ready = evaluateGenerateRun(doc, data.rows, data.headers, data.mapping);
    expect(ready.filled).toBe(2);
    expect(ready.ready).toBe(2);
    expect(ready.issues).toEqual([]);
  });

  it("flags missing SKU and barcode with the shared validator", async () => {
    const data = await shopifyLabelDataProvider.load({ productIds: ["prod_gift"] });
    const doc = shopifyCatalogDocument("shopify_product_barcode");
    const status = evaluateGenerateRun(doc, data.rows, data.headers, data.mapping);
    expect(status.issues.length).toBeGreaterThan(0);
    expect(status.issues[0]?.reasons.join(" ")).toMatch(/Missing|Barcode/i);
  });
});
