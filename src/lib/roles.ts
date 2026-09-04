import type { Role, TemplateStatus } from "./domain";

export function canManageOrganization(role: Role) {
  return role === "admin";
}

export function canManageUsers(role: Role) {
  return role === "admin";
}

export function canEditTemplates(role: Role) {
  return role === "admin" || role === "designer";
}

export function canPublishTemplates(role: Role) {
  return role === "admin" || role === "designer";
}

export function canArchiveTemplates(role: Role) {
  return role === "admin";
}

export function canManageAssets(role: Role) {
  return role === "admin" || role === "designer";
}

export function canGenerateLabels(role: Role) {
  return role === "admin" || role === "designer" || role === "operator";
}

export function canViewHistory(role: Role) {
  return role === "admin" || role === "designer" || role === "operator";
}

export function canSeeTemplate(role: Role, status: TemplateStatus | undefined) {
  if (role === "operator") return (status ?? "published") === "published";
  return true;
}

export function canGenerateTemplate(role: Role, status: TemplateStatus | undefined) {
  if (status === "archived") return false;
  if (role === "operator") return (status ?? "published") === "published";
  return true;
}

export function canAccessSettings(role: Role) {
  return role === "admin" || role === "designer";
}

export function roleLabel(role: Role) {
  if (role === "admin") return "Admin";
  if (role === "designer") return "Designer";
  return "Operator";
}
