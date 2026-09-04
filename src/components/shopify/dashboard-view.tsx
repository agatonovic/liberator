"use client";

import { buttonVariants } from "@/components/ui/button";
import { SHOPIFY_ORG_ID } from "@/lib/domain";
import { formatJobTimestamp, jobStatusLabel, jobsForOrganization } from "@/lib/jobs";
import { useAppStore } from "@/lib/store";
import { DEMO_SHOPIFY_PRODUCTS } from "@/shopify/demo-store";
import { SHOPIFY_CATALOG } from "@/shopify/catalog";
import { writeShopifySelection } from "@/shopify/selection";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

export function ShopifyDashboardView() {
  const router = useRouter();
  const allJobs = useAppStore((s) => s.jobs);
  const jobs = useMemo(() => jobsForOrganization(allJobs, SHOPIFY_ORG_ID).slice(0, 5), [allJobs]);
  const hydrated = useAppStore((s) => s.hydrated);

  function startWithAll() {
    writeShopifySelection({ productIds: DEMO_SHOPIFY_PRODUCTS.map((item) => item.id) });
    router.push("/shopify/products");
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Shopify Demo Store</p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">LABELATOR for Shopify</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Create production-ready labels from your Shopify products. This is a local demo — no Shopify login, API, or
        billing.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/shopify/products" className={buttonVariants()}>
          Select products
        </Link>
        <button type="button" className={buttonVariants({ variant: "outline" })} onClick={startWithAll}>
          Browse the catalog
        </button>
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-white p-5">
          <h2 className="text-base font-semibold">How it works</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Pick products from the demo store.</li>
            <li>Choose a label template.</li>
            <li>Preview real product data on the label.</li>
            <li>Generate a PDF with the shared Labelator engine.</li>
          </ol>
          <p className="mt-4 text-sm">
            {DEMO_SHOPIFY_PRODUCTS.length} demo products · {SHOPIFY_CATALOG.length} label templates
          </p>
        </section>
        <section className="rounded-xl border border-border bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Recent label jobs</h2>
            <Link href="/shopify/history" className="text-sm text-primary hover:underline">
              History
            </Link>
          </div>
          {!hydrated ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
          ) : jobs.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {jobs.map((job) => (
                <li key={job.id} className="flex justify-between gap-3 border-b border-border/70 py-2 last:border-0">
                  <span>
                    {job.templateName}
                    <span className="block text-[12px] text-muted-foreground">
                      {formatJobTimestamp(job.createdAt)} · {job.successCount ?? job.quantity} labels
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">{jobStatusLabel(job.status)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No Shopify jobs yet. Generate labels to record one.</p>
          )}
        </section>
      </div>
    </div>
  );
}
