"use client";

import { HistoryView } from "@/components/history/history-view";
import { SHOPIFY_ORG_ID } from "@/lib/domain";

export default function ShopifyHistoryPage() {
  return <HistoryView organizationId={SHOPIFY_ORG_ID} />;
}
