"use client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolvePublicSrc } from "@/lib/public-path";
import { cn } from "@/lib/utils";
import {
  DEMO_SHOPIFY_PRODUCTS,
  demoShopifyInventory,
  demoShopifyPrimaryVariant,
  isDemoShopifyInStock,
} from "@/shopify/demo-store";
import { readShopifySelection, writeShopifySelection } from "@/shopify/selection";
import type { DemoShopifyProduct } from "@/shopify/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StockFilter = "all" | "in" | "out";

function matchesQuery(product: DemoShopifyProduct, query: string) {
  if (!query) return true;
  const variant = demoShopifyPrimaryVariant(product);
  const hay = [
    product.title,
    product.vendor,
    product.type,
    product.collection,
    variant?.sku,
    product.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(query);
}

export function ShopifyProductsView() {
  const [query, setQuery] = useState("");
  const [stock, setStock] = useState<StockFilter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(DEMO_SHOPIFY_PRODUCTS[0]?.id ?? null);

  useEffect(() => {
    setSelected(readShopifySelection().productIds);
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DEMO_SHOPIFY_PRODUCTS.filter((product) => {
      if (!matchesQuery(product, q)) return false;
      if (stock === "in") return isDemoShopifyInStock(product);
      if (stock === "out") return !isDemoShopifyInStock(product);
      return true;
    });
  }, [query, stock]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const visibleSelected = visible.filter((product) => selectedSet.has(product.id)).length;
  const labelCount = DEMO_SHOPIFY_PRODUCTS.filter((product) => selectedSet.has(product.id)).reduce(
    (sum, product) => sum + product.variants.length,
    0,
  );
  const focused = DEMO_SHOPIFY_PRODUCTS.find((product) => product.id === focusId) ?? visible[0] ?? null;

  function persist(ids: string[]) {
    setSelected(ids);
    writeShopifySelection({ productIds: ids });
  }

  function toggle(id: string) {
    persist(selectedSet.has(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  function toggleVisible() {
    const ids = visible.map((product) => product.id);
    const allOn = ids.length > 0 && ids.every((id) => selectedSet.has(id));
    persist(allOn ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-8 py-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select products from the demo store. Each variant becomes one label.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products..."
            className="max-w-sm"
            aria-label="Search products"
          />
          <div className="flex gap-1">
            {(
              [
                ["all", "All"],
                ["in", "In stock"],
                ["out", "Out of stock"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={stock === id ? "default" : "outline"}
                onClick={() => setStock(id)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-h-0 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#f8f9fa] text-[11px] tracking-wide text-[#5f6368] uppercase">
              <tr>
                <th className="w-10 px-4 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all visible products"
                    checked={visible.length > 0 && visibleSelected === visible.length}
                    onChange={toggleVisible}
                  />
                </th>
                <th className="px-2 py-2 font-medium">Product</th>
                <th className="px-2 py-2 font-medium">SKU</th>
                <th className="px-2 py-2 font-medium">Price</th>
                <th className="px-2 py-2 font-medium">Stock</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => {
                const variant = demoShopifyPrimaryVariant(product);
                const qty = demoShopifyInventory(product);
                const active = product.id === focused?.id;
                return (
                  <tr
                    key={product.id}
                    className={cn(
                      "cursor-pointer border-t border-[#e8eaed]",
                      selectedSet.has(product.id) ? "bg-[#e8f0fe]/70" : "hover:bg-[#f8f9fa]",
                      active && "bg-[#e8f0fe]",
                    )}
                    onClick={() => setFocusId(product.id)}
                  >
                    <td className="px-4 py-2" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${product.title}`}
                        checked={selectedSet.has(product.id)}
                        onChange={() => toggle(product.id)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolvePublicSrc(product.image)}
                          alt=""
                          className="size-10 rounded-md border border-border object-cover"
                        />
                        <div>
                          <p className="font-medium">{product.title}</p>
                          <p className="text-[12px] text-muted-foreground">
                            {product.vendor}
                            {product.variants.length > 1 ? ` · ${product.variants.length} variants` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 font-mono text-[12px]">{variant?.sku || "—"}</td>
                    <td className="px-2 py-2">{variant?.price}</td>
                    <td className="px-2 py-2">
                      {qty > 0 ? (
                        <span>{qty}</span>
                      ) : (
                        <Badge variant="outline">Out of stock</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visible.length ? (
            <p className="px-8 py-10 text-sm text-muted-foreground">No products match this search.</p>
          ) : null}
        </div>
        <aside className="hidden overflow-y-auto border-l border-border p-5 lg:block">
          {focused ? (
            <ProductPreview product={focused} />
          ) : (
            <p className="text-sm text-muted-foreground">Select a product to preview label data.</p>
          )}
        </aside>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-8 py-3">
        <p className="text-sm">
          <span className="font-medium">{selected.length}</span> product{selected.length === 1 ? "" : "s"} selected
          {selected.length ? ` · ${labelCount} label${labelCount === 1 ? "" : "s"}` : ""}
        </p>
        <Link
          href="/shopify/labels"
          className={buttonVariants({ className: !selected.length ? "pointer-events-none opacity-50" : undefined })}
          aria-disabled={!selected.length}
          onClick={() => writeShopifySelection({ productIds: selected })}
        >
          Create labels
        </Link>
      </div>
    </div>
  );
}

function ProductPreview({ product }: { product: DemoShopifyProduct }) {
  const variant = demoShopifyPrimaryVariant(product);
  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolvePublicSrc(product.image)}
        alt=""
        className="mb-4 aspect-square w-full rounded-xl border border-border object-cover"
      />
      <h2 className="text-lg font-semibold">{product.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
      <dl className="mt-4 grid grid-cols-[88px_1fr] gap-x-2 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">SKU</dt>
        <dd className="font-mono text-[12px]">{variant?.sku || "Missing"}</dd>
        <dt className="text-muted-foreground">Barcode</dt>
        <dd className="font-mono text-[12px]">{variant?.barcode || "Missing"}</dd>
        <dt className="text-muted-foreground">Price</dt>
        <dd>{variant?.price}</dd>
        <dt className="text-muted-foreground">Variant</dt>
        <dd>{product.variants.map((item) => item.title).join(", ")}</dd>
        <dt className="text-muted-foreground">Vendor</dt>
        <dd>{product.vendor}</dd>
        <dt className="text-muted-foreground">Type</dt>
        <dd>{product.type}</dd>
      </dl>
    </div>
  );
}
