import type { LabelDataSet } from "@/lib/data/types";

/**
 * Shopify-facing types for the demo adapter. Shared Designer/PDF/resolve must not import this module.
 * Raw Admin API / GraphQL objects belong only behind the adapter.
 */
export type ShopifyShopRef = {
  shopDomain: string;
};

export type ShopifyProductRef = {
  productId: string;
  variantId?: string;
};

/** Normalized output of the Shopify adapter — never a GraphQL Product node. */
export type ShopifyLabelData = LabelDataSet & {
  sourceKind: "shopify";
};

export type DemoShopifyVariant = {
  id: string;
  title: string;
  sku: string;
  barcode: string;
  price: string;
  inventory: number;
  weight: string;
};

export type DemoShopifyProduct = {
  id: string;
  title: string;
  description: string;
  type: string;
  vendor: string;
  handle: string;
  tags: string[];
  collection: string;
  image: string;
  variants: DemoShopifyVariant[];
};

export type ShopifyProviderInput = {
  productIds?: string[];
  variantIds?: string[];
};
