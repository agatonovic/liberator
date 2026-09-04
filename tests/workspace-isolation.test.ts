import { describe, expect, it } from "vitest";
import { STELLANTIS_ORG_ID } from "@/lib/domain";
import { foldersInOrganization, seedTemplateLibrary } from "@/lib/library";
import { visibleTemplates } from "@/lib/template-library";
import { assetsForOrganization, foldersForOrganization } from "@/lib/assets";
import { activityForOrganization } from "@/lib/activity";
import { jobsForOrganization } from "@/lib/jobs";
import { migrateWorkspace } from "@/lib/workspace";
import { belongsToOrganization, stampLegacyOrganizationIds } from "@/lib/workspace-scope";
import { createDocument } from "@/lib/document";
import { stellantisOrganization } from "@/lib/session";
import library from "../data/library.json";

const SHOPIFY_ORG = "org_shopify_demo";

describe("workspace isolation", () => {
  it("hides every template when no workspace is selected", () => {
    const doc = { ...createDocument("Plant"), organizationId: STELLANTIS_ORG_ID };
    expect(visibleTemplates([doc], "admin", null)).toEqual([]);
    expect(visibleTemplates([doc], "admin", undefined)).toEqual([]);
  });

  it("hides unscoped records from a workspace until they are stamped", () => {
    const doc = createDocument("Legacy");
    expect(doc.organizationId).toBeUndefined();
    expect(belongsToOrganization(doc, STELLANTIS_ORG_ID)).toBe(false);
    expect(visibleTemplates([doc], "admin", STELLANTIS_ORG_ID)).toEqual([]);
    expect(visibleTemplates([doc], "admin", SHOPIFY_ORG)).toEqual([]);
  });

  it("stamps legacy records onto Stellantis Kragujevac only", () => {
    const doc = createDocument("Legacy");
    const [stamped] = stampLegacyOrganizationIds([doc]);
    expect(stamped.organizationId).toBe(STELLANTIS_ORG_ID);
    expect(visibleTemplates([stamped], "admin", STELLANTIS_ORG_ID)).toHaveLength(1);
    expect(visibleTemplates([stamped], "admin", SHOPIFY_ORG)).toEqual([]);
  });

  it("lets operators see only published templates in the current workspace", () => {
    const published = { ...createDocument("Published"), organizationId: STELLANTIS_ORG_ID, status: "published" as const };
    const draft = { ...createDocument("Draft"), organizationId: STELLANTIS_ORG_ID, status: "draft" as const };
    expect(visibleTemplates([published, draft], "operator", STELLANTIS_ORG_ID).map((doc) => doc.id)).toEqual([published.id]);
    expect(visibleTemplates([published, draft], "admin", STELLANTIS_ORG_ID)).toHaveLength(2);
  });

  it("keeps explicitly scoped Shopify records out of Stellantis views", () => {
    const industrial = { ...createDocument("Plant"), organizationId: STELLANTIS_ORG_ID };
    const merchant = { ...createDocument("Merchant"), organizationId: SHOPIFY_ORG };
    expect(visibleTemplates([industrial, merchant], "admin", STELLANTIS_ORG_ID).map((doc) => doc.id)).toEqual([
      industrial.id,
    ]);
    expect(visibleTemplates([industrial, merchant], "admin", SHOPIFY_ORG).map((doc) => doc.id)).toEqual([merchant.id]);
    expect(foldersInOrganization([{ id: "f1", name: "A", organizationId: STELLANTIS_ORG_ID }], SHOPIFY_ORG)).toEqual([]);
    expect(assetsForOrganization([{ id: "a1", folderId: "f", name: "x", stem: "x", mime: "image/png", bytes: 1, kind: "blob", createdAt: "", organizationId: STELLANTIS_ORG_ID }], SHOPIFY_ORG)).toEqual([]);
    expect(foldersForOrganization([{ id: "f1", name: "packaging", createdAt: "", organizationId: STELLANTIS_ORG_ID }], SHOPIFY_ORG)).toEqual([]);
    expect(activityForOrganization([{ id: "e1", type: "print", templateId: "t", templateName: "T", timestamp: "", labelCount: 1, organizationId: STELLANTIS_ORG_ID }], SHOPIFY_ORG)).toEqual([]);
    expect(
      jobsForOrganization(
        [
          {
            id: "j1",
            organizationId: STELLANTIS_ORG_ID,
            templateId: "t",
            templateName: "T",
            templateVersionId: "v",
            templateVersionNumber: 1,
            createdBy: "u",
            createdByName: "U",
            createdAt: "",
            status: "completed",
            quantity: 1,
            sourceType: "excel",
          },
        ],
        SHOPIFY_ORG,
      ),
    ).toEqual([]);
  });

  it("migrates library.json templates onto Stellantis without changing geometry", () => {
    const before = library.documents.map((doc) => ({
      id: doc.id,
      elements: doc.elements.length,
      catalogId: doc.catalogId,
      catalogRevision: doc.catalogRevision,
    }));
    const migrated = migrateWorkspace({
      documents: library.documents as never,
      folders: library.folders as never,
      workspace: {
        organizations: [stellantisOrganization()],
        users: [],
        memberships: [],
        jobs: [],
        workspaceMigrationRev: 1,
      },
    });
    expect(migrated.documents.every((doc) => doc.organizationId === STELLANTIS_ORG_ID)).toBe(true);
    expect(migrated.folders.every((folder) => folder.organizationId === STELLANTIS_ORG_ID)).toBe(true);
    expect(
      migrated.documents.map((doc) => ({
        id: doc.id,
        elements: doc.elements.length,
        catalogId: doc.catalogId,
        catalogRevision: doc.catalogRevision,
      })),
    ).toEqual(before);
    expect(visibleTemplates(migrated.documents, "admin", SHOPIFY_ORG)).toEqual([]);
    expect(visibleTemplates(migrated.documents, "admin", STELLANTIS_ORG_ID)).toHaveLength(before.length);
  });

  it("is idempotent when run twice", () => {
    const first = migrateWorkspace({
      documents: library.documents as never,
      folders: library.folders as never,
      workspace: {
        organizations: [stellantisOrganization()],
        users: [],
        memberships: [],
        jobs: [],
        workspaceMigrationRev: 1,
      },
    });
    const second = migrateWorkspace({
      documents: first.documents,
      folders: first.folders,
      workspace: first.workspace,
    });
    expect(second.didChange).toBe(false);
    expect(second.documents.map((doc) => doc.id)).toEqual(first.documents.map((doc) => doc.id));
  });
});

describe("Industrial catalog seed", () => {
  it("seeds Industrial catalog ids into an empty Industrial library", () => {
    const seeded = seedTemplateLibrary([], [], false, [], "industrial");
    expect(seeded.documents.some((doc) => doc.catalogId === "ga_warehouse_a3")).toBe(true);
    expect(seeded.documents.some((doc) => doc.catalogId === "warehouse_a3")).toBe(true);
    expect(seeded.folders.some((folder) => folder.name === "Stellantis Kragujevac")).toBe(true);
  });
});
