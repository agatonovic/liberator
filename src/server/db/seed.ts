import { eq } from "drizzle-orm";
import {
  DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_ID,
  DEMO_MEMBERSHIP_ID,
  DEMO_OPERATOR_EMAIL,
  DEMO_OPERATOR_ID,
  DEMO_OPERATOR_MEMBERSHIP_ID,
  STELLANTIS_ORG_ID,
} from "@/lib/domain";
import {
  demoAdminMembership,
  demoAdminUser,
  demoOperatorMembership,
  demoOperatorUser,
  stellantisOrganization,
} from "@/lib/session";
import { getDb } from "./client";
import { memberships, organizations, users } from "./schema";

export async function hashPassword(password: string) {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(password, hash);
}

export async function seedCloudWorkspace() {
  const db = getDb();
  const org = stellantisOrganization();
  const user = demoAdminUser();
  const membership = demoAdminMembership();
  const password = process.env.LABELATOR_DEMO_PASSWORD || "demo";
  const passwordHash = await hashPassword(password);

  const existingOrg = db.select().from(organizations).where(eq(organizations.id, STELLANTIS_ORG_ID)).get();
  if (!existingOrg) {
    db.insert(organizations).values({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      subscriptionStatus: org.subscriptionStatus,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      labelsGenerated: org.labelsGenerated,
      jobCount: org.jobCount,
    }).run();
  }

  const existingUser = db.select().from(users).where(eq(users.id, DEMO_ADMIN_ID)).get();
  if (!existingUser) {
    db.insert(users).values({
      id: user.id,
      name: user.name,
      email: DEMO_ADMIN_EMAIL,
      passwordHash,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }).run();
  }

  const existingMembership = db.select().from(memberships).where(eq(memberships.id, DEMO_MEMBERSHIP_ID)).get();
  if (!existingMembership) {
    db.insert(memberships).values({
      id: membership.id,
      organizationId: membership.organizationId,
      userId: membership.userId,
      role: membership.role,
      createdAt: membership.createdAt,
    }).run();
  }

  const operator = demoOperatorUser();
  const operatorMembership = demoOperatorMembership();
  const existingOperator = db.select().from(users).where(eq(users.id, DEMO_OPERATOR_ID)).get();
  if (!existingOperator) {
    db.insert(users).values({
      id: operator.id,
      name: operator.name,
      email: DEMO_OPERATOR_EMAIL,
      createdAt: operator.createdAt,
      updatedAt: operator.updatedAt,
    }).run();
  }
  const existingOperatorMembership = db
    .select()
    .from(memberships)
    .where(eq(memberships.id, DEMO_OPERATOR_MEMBERSHIP_ID))
    .get();
  if (!existingOperatorMembership) {
    db.insert(memberships).values({
      id: operatorMembership.id,
      organizationId: operatorMembership.organizationId,
      userId: operatorMembership.userId,
      role: operatorMembership.role,
      createdAt: operatorMembership.createdAt,
    }).run();
  }

  return { organization: org, user: { ...user, email: DEMO_ADMIN_EMAIL }, membership };
}

export async function findUserByEmail(email: string) {
  const db = getDb();
  return db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get()
    ?? db.select().from(users).where(eq(users.email, email.trim())).get();
}

export async function membershipsForUser(userId: string) {
  const db = getDb();
  return db.select().from(memberships).where(eq(memberships.userId, userId)).all();
}
