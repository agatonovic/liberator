import type { ProductEdition } from "./edition";

export const STELLANTIS_ORG_ID = "org_stellantis_kragujevac";
export const STELLANTIS_ORG_SLUG = "stellantis-kragujevac";
export const STELLANTIS_ORG_NAME = "Stellantis Kragujevac";

export const SHOPIFY_ORG_ID = "org_shopify_demo";
export const SHOPIFY_ORG_SLUG = "shopify-demo";
export const SHOPIFY_ORG_NAME = "Shopify Demo Store";
export const DEMO_SHOPIFY_MEMBERSHIP_ID = "mem_demo_shopify";

export const DEMO_ADMIN_ID = "user_demo_admin";
export const DEMO_ADMIN_EMAIL = "demo@labelator.local";
export const DEMO_ADMIN_NAME = "Demo Admin";
export const DEMO_MEMBERSHIP_ID = "mem_demo_stellantis";

export const DEMO_OPERATOR_ID = "user_demo_operator";
export const DEMO_OPERATOR_EMAIL = "operator@labelator.local";
export const DEMO_OPERATOR_NAME = "Demo Operator";
export const DEMO_OPERATOR_MEMBERSHIP_ID = "mem_demo_operator_stellantis";

export const WORKSPACE_MIGRATION_REV = 1;

export type Role = "admin" | "designer" | "operator";

export type OrganizationPlan = "free" | "professional" | "business" | "enterprise";
export type SubscriptionStatus = "none" | "active" | "trialing" | "past_due" | "canceled";

export type TemplateStatus = "draft" | "published" | "archived";
export type TemplateVersionStatus = "draft" | "published";

export type LabelJobStatus = "draft" | "validating" | "ready" | "generating" | "completed" | "failed";
export type LabelJobSource = "manual" | "excel" | "shopify";

export function isShopifyWorkspaceId(organizationId?: string | null) {
  return organizationId === SHOPIFY_ORG_ID;
}

export function isShopifyCatalogId(catalogId?: string | null) {
  return Boolean(catalogId && catalogId.startsWith("shopify_"));
}

export type LabelJobOutput = "pdf" | "print";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: OrganizationPlan;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
  labelsGenerated: number;
  jobCount: number;
  templateCount?: number;
  assetCount?: number;
  description?: string;
  companyName?: string;
  /** Industrial by default. Shopify workspaces set this at creation (Phase 2+). */
  edition?: ProductEdition;
};

export type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationMembership = {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  createdAt: string;
};

export type LabelJob = {
  id: string;
  organizationId: string;
  templateId: string;
  templateName: string;
  templateVersionId: string;
  templateVersionNumber: number;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  status: LabelJobStatus;
  quantity: number;
  sourceType: LabelJobSource;
  fileName?: string;
  pageSize?: string;
  error?: string;
  rowCount?: number;
  successCount?: number;
  failedCount?: number;
  outputType?: LabelJobOutput;
};

export type SessionSnapshot = {
  user: User;
  organization: Organization;
  membership: OrganizationMembership;
};
