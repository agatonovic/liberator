import { ShopifyShell } from "@/components/shopify/shopify-shell";

export default function ShopifyLayout({ children }: LayoutProps<"/shopify">) {
  return <ShopifyShell>{children}</ShopifyShell>;
}
