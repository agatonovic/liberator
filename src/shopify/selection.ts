const STORAGE_KEY = "labelator.shopify.selection.v1";

export type ShopifySelection = {
  productIds: string[];
  templateId: string | null;
};

const EMPTY: ShopifySelection = { productIds: [], templateId: null };

export function readShopifySelection(): ShopifySelection {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as ShopifySelection;
    return {
      productIds: Array.isArray(parsed.productIds) ? parsed.productIds.filter((id) => typeof id === "string") : [],
      templateId: typeof parsed.templateId === "string" ? parsed.templateId : null,
    };
  } catch {
    return EMPTY;
  }
}

export function writeShopifySelection(patch: Partial<ShopifySelection>): ShopifySelection {
  const next = { ...readShopifySelection(), ...patch };
  if (typeof window === "undefined") return next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}
