import type { LabelDataProvider, LabelDataSet } from "@/lib/data/types";
import type { DataRow } from "@/lib/resolve";
import { publicPath } from "@/lib/public-path";
import { DEMO_SHOPIFY_PRODUCTS } from "./demo-store";
import { SHOPIFY_FIELD_KEYS, shopifyIdentityMapping } from "./fields";
import type { DemoShopifyProduct, DemoShopifyVariant, ShopifyProviderInput } from "./types";

function localImageSrc(src: string) {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return src;
  if (/^https?:\/\//i.test(src)) {
    throw new Error("Shopify demo images must be local. Remote URLs are not allowed.");
  }
  return publicPath(src);
}

function rowFromVariant(product: DemoShopifyProduct, variant: DemoShopifyVariant): DataRow {
  return {
    title: product.title,
    description: product.description,
    type: product.type,
    vendor: product.vendor,
    sku: variant.sku,
    barcode: variant.barcode,
    price: variant.price,
    variant: variant.title,
    image: localImageSrc(product.image),
    quantity: String(variant.inventory),
    collection: product.collection,
    tags: product.tags.join(", "),
    handle: product.handle,
    weight: variant.weight,
  };
}

function selectedVariants(input: ShopifyProviderInput | undefined) {
  const productIds = new Set(input?.productIds ?? []);
  const variantIds = new Set(input?.variantIds ?? []);
  const rows: DataRow[] = [];
  for (const product of DEMO_SHOPIFY_PRODUCTS) {
    for (const variant of product.variants) {
      const matchProduct = productIds.size ? productIds.has(product.id) : false;
      const matchVariant = variantIds.size ? variantIds.has(variant.id) : false;
      const includeAll = !productIds.size && !variantIds.size;
      if (includeAll || matchProduct || matchVariant) {
        rows.push(rowFromVariant(product, variant));
      }
    }
  }
  return rows;
}

export function loadDemoShopifyLabelData(input?: ShopifyProviderInput): LabelDataSet {
  const rows = selectedVariants(input);
  return {
    sourceKind: "shopify",
    fileName: "Shopify Demo Store",
    headers: [...SHOPIFY_FIELD_KEYS],
    rows,
    mapping: shopifyIdentityMapping(),
  };
}

/**
 * Demo Shopify → DataRow adapter. No network, OAuth, or Admin API.
 * Do not import this from src/lib.
 */
export const shopifyLabelDataProvider: LabelDataProvider = {
  kind: "shopify",
  async load(input: unknown): Promise<LabelDataSet> {
    return loadDemoShopifyLabelData(isShopifyProviderInput(input) ? input : undefined);
  },
};

function isShopifyProviderInput(value: unknown): value is ShopifyProviderInput {
  return Boolean(value && typeof value === "object");
}
