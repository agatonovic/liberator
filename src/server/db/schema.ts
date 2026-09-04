import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  subscriptionStatus: text("subscription_status").notNull().default("none"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  labelsGenerated: integer("labels_generated").notNull().default(0),
  jobCount: integer("job_count").notNull().default(0),
  description: text("description"),
  companyName: text("company_name"),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const memberships = sqliteTable("memberships", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  createdAt: text("created_at").notNull(),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  templateId: text("template_id").notNull(),
  templateName: text("template_name").notNull(),
  templateVersionId: text("template_version_id").notNull(),
  templateVersionNumber: integer("template_version_number").notNull().default(1),
  createdBy: text("created_by").notNull(),
  createdByName: text("created_by_name").notNull(),
  createdAt: text("created_at").notNull(),
  status: text("status").notNull(),
  quantity: integer("quantity").notNull().default(0),
  sourceType: text("source_type").notNull(),
  fileName: text("file_name"),
  pageSize: text("page_size"),
  error: text("error"),
  rowCount: integer("row_count"),
  successCount: integer("success_count"),
  failedCount: integer("failed_count"),
  outputType: text("output_type"),
});

export const activityEvents = sqliteTable("activity_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  userId: text("user_id"),
  userName: text("user_name"),
  type: text("type").notNull(),
  templateId: text("template_id").notNull(),
  templateName: text("template_name").notNull(),
  timestamp: text("timestamp").notNull(),
  labelCount: integer("label_count").notNull().default(0),
  versionNumber: integer("version_number"),
});
