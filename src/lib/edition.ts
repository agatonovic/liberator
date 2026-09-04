/** Product editions that share one label engine. The running app is Industrial by default. */

export type ProductEdition = "industrial" | "shopify";

export const DEFAULT_EDITION: ProductEdition = "industrial";

export function isProductEdition(value: unknown): value is ProductEdition {
  return value === "industrial" || value === "shopify";
}

export function editionOf(value?: { edition?: ProductEdition | null } | ProductEdition | null): ProductEdition {
  if (value === "industrial" || value === "shopify") return value;
  if (value && typeof value === "object" && isProductEdition(value.edition)) return value.edition;
  return DEFAULT_EDITION;
}
