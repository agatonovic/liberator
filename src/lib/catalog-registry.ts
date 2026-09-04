import { CATALOG, CATALOG_REVISION, type CatalogEntry } from "./catalog";
import type { ProductEdition } from "./edition";

/**
 * Edition-aware catalog lookup. Industrial templates stay in `catalog.ts`.
 * Shopify templates live in `src/shopify/catalog.ts` and are never imported here,
 * so shared core cannot depend on the Shopify edition. Do not append Shopify
 * entries to `CATALOG` or this Industrial registry.
 */
export type CatalogRegistry = {
  edition: ProductEdition;
  entries: readonly CatalogEntry[];
  revision: Readonly<Record<string, number>>;
};

const SHOPIFY_CATALOG: readonly CatalogEntry[] = [];
const SHOPIFY_CATALOG_REVISION: Readonly<Record<string, number>> = {};

export function catalogRegistry(edition: ProductEdition = "industrial"): CatalogRegistry {
  if (edition === "shopify") {
    return { edition, entries: SHOPIFY_CATALOG, revision: SHOPIFY_CATALOG_REVISION };
  }
  return { edition: "industrial", entries: CATALOG, revision: CATALOG_REVISION };
}

export function catalogEntriesForEdition(edition: ProductEdition = "industrial"): readonly CatalogEntry[] {
  return catalogRegistry(edition).entries;
}

export function catalogRevisionForEdition(edition: ProductEdition = "industrial"): Readonly<Record<string, number>> {
  return catalogRegistry(edition).revision;
}
