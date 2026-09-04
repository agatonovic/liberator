"use client";

import { Hint } from "@/components/hint";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { SHOPIFY_ORG_NAME } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { navPath } from "@/lib/public-path";
import { FileOutput, History, LayoutGrid, PanelLeftClose, PanelLeftOpen, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const NAV = [
  { href: "/shopify", label: "Home", icon: LayoutGrid, exact: true },
  { href: "/shopify/products", label: "Products", icon: ShoppingBag },
  { href: "/shopify/labels", label: "Labels", icon: FileOutput },
  { href: "/shopify/history", label: "History", icon: History },
];

const NAV_OPEN_KEY = "labelator.shopify.navOpen";

function readNavOpen() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(NAV_OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

export function ShopifyShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = navPath(pathname);
  const [open, setOpenState] = useState(true);

  useEffect(() => {
    setOpenState(readNavOpen());
  }, []);

  const setOpen = useMemo(
    () => (next: boolean) => {
      setOpenState(next);
      try {
        window.localStorage.setItem(NAV_OPEN_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return (
    <div className="flex h-full min-h-0 bg-background">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
          open ? "w-[220px]" : "w-14",
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-sidebar-border",
            open ? "justify-between gap-2 px-5" : "justify-center px-1",
          )}
        >
          {open ? (
            <>
              <Link
                href="/shopify"
                aria-label="Labelator Shopify, go to home"
                className="block min-w-0 cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <Logo />
              </Link>
              <Hint label="Close sidebar">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close sidebar"
                  className="-mr-1.5 shrink-0 text-muted-foreground"
                  onClick={() => setOpen(false)}
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </Hint>
            </>
          ) : (
            <Hint label="Open sidebar" side="right">
              <button
                type="button"
                aria-label="Open sidebar"
                className="group/mark relative flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                onClick={() => setOpen(true)}
              >
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-75 group-hover/mark:opacity-0 group-focus-visible/mark:opacity-0">
                  <Logo compact />
                </span>
                <PanelLeftOpen className="size-4 opacity-0 transition-opacity duration-75 group-hover/mark:opacity-100 group-focus-visible/mark:opacity-100" />
              </button>
            </Hint>
          )}
        </div>
        <nav className={cn("flex flex-1 flex-col gap-0.5 pt-2", open ? "px-2" : "items-center px-1")}>
          {NAV.map((item) => {
            const active = item.exact ? current === item.href : current === item.href || current.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const link = (
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  open ? "gap-2.5 px-3 py-2" : "size-9 justify-center",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {open ? item.label : <span className="sr-only">{item.label}</span>}
              </Link>
            );
            return open ? (
              <div key={item.href}>{link}</div>
            ) : (
              <Hint key={item.href} label={item.label} side="right">
                {link}
              </Hint>
            );
          })}
        </nav>
        {open ? (
          <div className="border-t border-sidebar-border px-4 py-3">
            <p className="truncate text-[12px] font-medium text-sidebar-foreground">{SHOPIFY_ORG_NAME}</p>
            <p className="truncate text-[11px] text-muted-foreground">Local demo · no Shopify login</p>
          </div>
        ) : null}
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
