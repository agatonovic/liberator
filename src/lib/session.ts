import {
  DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_ID,
  DEMO_ADMIN_NAME,
  DEMO_MEMBERSHIP_ID,
  DEMO_OPERATOR_EMAIL,
  DEMO_OPERATOR_ID,
  DEMO_OPERATOR_MEMBERSHIP_ID,
  DEMO_OPERATOR_NAME,
  DEMO_SHOPIFY_MEMBERSHIP_ID,
  SHOPIFY_ORG_ID,
  SHOPIFY_ORG_NAME,
  SHOPIFY_ORG_SLUG,
  STELLANTIS_ORG_ID,
  STELLANTIS_ORG_NAME,
  STELLANTIS_ORG_SLUG,
  type Organization,
  type OrganizationMembership,
  type SessionSnapshot,
  type User,
} from "./domain";

const now = "2026-01-01T00:00:00.000Z";

export function demoAdminUser(): User {
  return {
    id: DEMO_ADMIN_ID,
    name: DEMO_ADMIN_NAME,
    email: DEMO_ADMIN_EMAIL,
    createdAt: now,
    updatedAt: now,
  };
}

export function stellantisOrganization(): Organization {
  return {
    id: STELLANTIS_ORG_ID,
    name: STELLANTIS_ORG_NAME,
    slug: STELLANTIS_ORG_SLUG,
    plan: "enterprise",
    subscriptionStatus: "active",
    edition: "industrial",
    createdAt: now,
    updatedAt: now,
    labelsGenerated: 0,
    jobCount: 0,
  };
}

export function shopifyDemoOrganization(): Organization {
  return {
    id: SHOPIFY_ORG_ID,
    name: SHOPIFY_ORG_NAME,
    slug: SHOPIFY_ORG_SLUG,
    plan: "professional",
    subscriptionStatus: "active",
    edition: "shopify",
    createdAt: now,
    updatedAt: now,
    labelsGenerated: 0,
    jobCount: 0,
    description: "Local demo merchant. No Shopify API or OAuth.",
  };
}

export function demoShopifyMembership(): OrganizationMembership {
  return {
    id: DEMO_SHOPIFY_MEMBERSHIP_ID,
    organizationId: SHOPIFY_ORG_ID,
    userId: DEMO_ADMIN_ID,
    role: "admin",
    createdAt: now,
  };
}

export function demoAdminMembership(): OrganizationMembership {
  return {
    id: DEMO_MEMBERSHIP_ID,
    organizationId: STELLANTIS_ORG_ID,
    userId: DEMO_ADMIN_ID,
    role: "admin",
    createdAt: now,
  };
}

export function demoOperatorUser(): User {
  return {
    id: DEMO_OPERATOR_ID,
    name: DEMO_OPERATOR_NAME,
    email: DEMO_OPERATOR_EMAIL,
    createdAt: now,
    updatedAt: now,
  };
}

export function demoOperatorMembership(): OrganizationMembership {
  return {
    id: DEMO_OPERATOR_MEMBERSHIP_ID,
    organizationId: STELLANTIS_ORG_ID,
    userId: DEMO_OPERATOR_ID,
    role: "operator",
    createdAt: now,
  };
}

export const DEMO_SESSION: SessionSnapshot = {
  user: demoAdminUser(),
  organization: stellantisOrganization(),
  membership: demoAdminMembership(),
};

export function demoSession(): SessionSnapshot {
  return DEMO_SESSION;
}

export function isCloudMode() {
  return process.env.NEXT_PUBLIC_LABELATOR_CLOUD === "1";
}

export function isStaticExportBuild() {
  return process.env.GITHUB_PAGES === "true";
}
