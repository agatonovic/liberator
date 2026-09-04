import { SHOPIFY_ORG_ID } from "@/lib/domain";
import { createDocument, createElement, type ElementStyle, type LabelDocument } from "@/lib/document";
import { snapshotTemplate } from "@/lib/versions";
import { shopifyDataColumns, type ShopifyFieldKey } from "./fields";

export const SHOPIFY_CATALOG_REVISION: Readonly<Record<string, number>> = {
  shopify_product_barcode: 1,
  shopify_product_price: 1,
  shopify_shelf: 1,
  shopify_packaging: 1,
};

const INK = "#12263A";
const MUTED = "#5C6B7A";
const ACCENT = "#0F8A80";

function published(doc: LabelDocument, catalogId: string, required: ShopifyFieldKey[]): LabelDocument {
  const revision = SHOPIFY_CATALOG_REVISION[catalogId] ?? 1;
  const versionId = `ver_${doc.id}_1`;
  const withColumns = { ...doc, dataColumns: shopifyDataColumns(required) };
  return {
    ...withColumns,
    catalogId,
    catalogRevision: revision,
    organizationId: SHOPIFY_ORG_ID,
    status: "published",
    versionNumber: revision,
    publishedVersionId: versionId,
    versions: [
      {
        id: versionId,
        name: "v1",
        createdAt: doc.updatedAt,
        number: revision,
        status: "published",
        createdBy: "user_demo_admin",
        snapshot: snapshotTemplate(withColumns),
      },
    ],
  };
}

function text(
  x: number,
  y: number,
  width: number,
  height: number,
  content: string,
  binding: string | undefined,
  style: Partial<ElementStyle>,
) {
  return createElement("text", x, y, {
    width,
    height,
    content,
    binding,
    style: {
      fill: INK,
      fontFamily: "IBM Plex Sans",
      fontWeight: "normal",
      align: "left",
      verticalAlign: "middle",
      opacity: 1,
      fontSizeMm: 4,
      ...style,
    },
  });
}

function buildProductBarcode(): LabelDocument {
  const doc = createDocument("Product Barcode", { widthMm: 70, heightMm: 40 });
  doc.id = "tpl_shopify_product_barcode";
  doc.elements = [
    createElement("rect", 0, 0, {
      width: 70,
      height: 40,
      style: { fill: "#ffffff", stroke: INK, strokeWidth: 0.35, opacity: 1 },
    }),
    text(4, 3, 62, 8, "PRODUCT TITLE", "title", {
      fontSizeMm: 4.2,
      fontWeight: "bold",
      align: "center",
    }),
    text(4, 12, 62, 5, "SKU-0000", "sku", {
      fill: MUTED,
      fontSizeMm: 3,
      align: "center",
    }),
    createElement("barcode", 6, 18, {
      width: 58,
      height: 16,
      content: "8601234560014",
      binding: "barcode",
      style: {
        fill: "#000000",
        barcodeSymbology: "code128",
        barcodeDisplayValue: true,
        opacity: 1,
      },
    }),
  ];
  return published(doc, "shopify_product_barcode", ["title", "sku", "barcode"]);
}

function buildProductPrice(): LabelDocument {
  const doc = createDocument("Product + Price", { widthMm: 80, heightMm: 50 });
  doc.id = "tpl_shopify_product_price";
  doc.elements = [
    createElement("rect", 0, 0, {
      width: 80,
      height: 50,
      style: { fill: "#ffffff", stroke: INK, strokeWidth: 0.35, opacity: 1 },
    }),
    createElement("image", 3, 3, {
      width: 20,
      height: 20,
      binding: "image",
    }),
    text(26, 3, 51, 8, "PRODUCT TITLE", "title", {
      fontSizeMm: 3.8,
      fontWeight: "bold",
    }),
    text(26, 12, 51, 8, "€0.00", "price", {
      fill: ACCENT,
      fontSizeMm: 5.2,
      fontWeight: "bold",
    }),
    text(3, 25, 74, 4, "SKU-0000", "sku", {
      fill: MUTED,
      fontSizeMm: 2.8,
    }),
    createElement("barcode", 3, 30, {
      width: 74,
      height: 16,
      content: "8601234560014",
      binding: "barcode",
      style: {
        fill: "#000000",
        barcodeSymbology: "code128",
        barcodeDisplayValue: true,
        opacity: 1,
      },
    }),
  ];
  return published(doc, "shopify_product_price", ["title", "sku", "barcode", "price", "image"]);
}

function buildShelf(): LabelDocument {
  const doc = createDocument("Product Shelf Label", { widthMm: 90, heightMm: 36 });
  doc.id = "tpl_shopify_shelf";
  doc.elements = [
    createElement("rect", 0, 0, {
      width: 90,
      height: 36,
      style: { fill: "#ffffff", stroke: INK, strokeWidth: 0.35, opacity: 1 },
    }),
    text(4, 3, 54, 10, "PRODUCT TITLE", "title", {
      fontSizeMm: 4.4,
      fontWeight: "bold",
    }),
    text(58, 3, 28, 10, "€0.00", "price", {
      fill: ACCENT,
      fontSizeMm: 5.6,
      fontWeight: "bold",
      align: "right",
    }),
    text(4, 14, 82, 4, "SKU-0000", "sku", {
      fill: MUTED,
      fontSizeMm: 2.6,
    }),
    createElement("barcode", 4, 19, {
      width: 82,
      height: 13,
      content: "8601234560014",
      binding: "barcode",
      style: {
        fill: "#000000",
        barcodeSymbology: "code128",
        barcodeDisplayValue: false,
        opacity: 1,
      },
    }),
  ];
  return published(doc, "shopify_shelf", ["title", "sku", "price", "barcode"]);
}

function buildPackaging(): LabelDocument {
  const doc = createDocument("Simple Packaging Label", { widthMm: 80, heightMm: 60 });
  doc.id = "tpl_shopify_packaging";
  doc.elements = [
    createElement("rect", 0, 0, {
      width: 80,
      height: 60,
      style: { fill: "#ffffff", stroke: INK, strokeWidth: 0.35, opacity: 1 },
    }),
    createElement("image", 24, 4, {
      width: 32,
      height: 24,
      binding: "image",
    }),
    text(4, 30, 72, 8, "PRODUCT TITLE", "title", {
      fontSizeMm: 4,
      fontWeight: "bold",
      align: "center",
    }),
    text(4, 39, 72, 6, "Variant", "variant", {
      fill: MUTED,
      fontSizeMm: 3.2,
      align: "center",
    }),
    text(4, 47, 72, 8, "SKU-0000", "sku", {
      fontSizeMm: 3.4,
      align: "center",
    }),
  ];
  return published(doc, "shopify_packaging", ["title", "variant", "sku", "image"]);
}

export type ShopifyCatalogEntry = {
  id: string;
  name: string;
  description: string;
  build: () => LabelDocument;
};

export const SHOPIFY_CATALOG: readonly ShopifyCatalogEntry[] = [
  {
    id: "shopify_product_barcode",
    name: "Product Barcode",
    description: "Title, SKU, and barcode.",
    build: buildProductBarcode,
  },
  {
    id: "shopify_product_price",
    name: "Product + Price",
    description: "Image, title, price, SKU, and barcode.",
    build: buildProductPrice,
  },
  {
    id: "shopify_shelf",
    name: "Product Shelf Label",
    description: "Shelf-edge title, price, SKU, and barcode.",
    build: buildShelf,
  },
  {
    id: "shopify_packaging",
    name: "Simple Packaging Label",
    description: "Image, title, variant, and SKU.",
    build: buildPackaging,
  },
];

export function shopifyCatalogDocument(id: string): LabelDocument {
  const entry = SHOPIFY_CATALOG.find((item) => item.id === id);
  if (!entry) throw new Error(`Unknown Shopify template: ${id}`);
  return entry.build();
}

export function defaultShopifyCatalogId() {
  return SHOPIFY_CATALOG[0]?.id ?? "shopify_product_barcode";
}
