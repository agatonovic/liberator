import type { ColumnMapping } from "@/lib/resolve";
import type { DataColumn } from "@/lib/document";

/**
 * Flat Labelator keys produced by the Shopify adapter.
 *
 * Future nested Shopify fields can map into these without changing LabelDocument:
 *
 *   product.title       → title
 *   product.description → description
 *   product.type        → type
 *   product.vendor      → vendor
 *   product.handle      → handle
 *   product.tags        → tags
 *   product.collection  → collection
 *   variant.title       → variant
 *   variant.sku         → sku
 *   variant.barcode     → barcode
 *   variant.price       → price
 *   variant.inventory   → quantity
 *   variant.weight      → weight
 *   image.primary       → image
 *
 * Bindings on Shopify demo templates use the flat keys. Nested paths are not
 * parsed by the current resolver; the adapter is the mapping layer.
 */
export const SHOPIFY_FIELD_KEYS = [
  "title",
  "description",
  "type",
  "vendor",
  "sku",
  "barcode",
  "price",
  "variant",
  "image",
  "quantity",
  "collection",
  "tags",
  "handle",
  "weight",
] as const;

export type ShopifyFieldKey = (typeof SHOPIFY_FIELD_KEYS)[number];

export const SHOPIFY_FIELD_LABELS: Record<ShopifyFieldKey, string> = {
  title: "Product title",
  description: "Description",
  type: "Product type",
  vendor: "Vendor",
  sku: "SKU",
  barcode: "Barcode",
  price: "Price",
  variant: "Variant",
  image: "Product image",
  quantity: "Inventory",
  collection: "Collection",
  tags: "Tags",
  handle: "Handle",
  weight: "Weight",
};

export function shopifyIdentityMapping(): ColumnMapping {
  return Object.fromEntries(SHOPIFY_FIELD_KEYS.map((key) => [key, key]));
}

export function shopifyDataColumns(required: ShopifyFieldKey[] = []): DataColumn[] {
  const need = new Set(required);
  return SHOPIFY_FIELD_KEYS.map((key) => ({
    key,
    label: SHOPIFY_FIELD_LABELS[key],
    headers: [key, SHOPIFY_FIELD_LABELS[key]],
    example: key === "price" ? "€12.00" : key === "sku" ? "MUG-001" : "",
    required: need.has(key),
  }));
}
