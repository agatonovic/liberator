"use client";

import { Hint } from "@/components/hint";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { navPath } from "@/lib/public-path";
import { FileOutput, Images, LayoutTemplate, PanelLeftClose, PanelLeftOpen, PenTool } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const NAV = [
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/generate", label: "Generate", icon: FileOutput },
  { href: "/designer", label: "Designer", icon: PenTool },
  { href: "/assets", label: "Assets", icon: Images },
];

const NAV_OPEN_KEY = "labelator.navOpen";

function readNavOpen() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(NAV_OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

const NavSidebarContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: true, setOpen: () => {} });

export function useNavSidebar() {
  return useContext(NavSidebarContext);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = navPath(pathname);
  const [open, setOpenState] = useState(true);

  useEffect(() => {
    setOpenState(readNavOpen());
  }, []);

  const value = useMemo(
    () => ({
      open,
      setOpen: (next: boolean) => {
        setOpenState(next);
        try {
          window.localStorage.setItem(NAV_OPEN_KEY, next ? "1" : "0");
        } catch {
          /* ignore */
        }
      },
    }),
    [open],
  );

  return (
    <NavSidebarContext.Provider value={value}>
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
                  href="/templates"
                  aria-label="Labelator, go to Templates"
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
                    onClick={() => value.setOpen(false)}
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
                  onClick={() => value.setOpen(true)}
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
              const active = current === item.href || (item.href === "/generate" && current === "/print");
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
            <p className="px-5 py-4 text-[11px] leading-relaxed text-muted-foreground">
              Find a template, add data, generate labels.
            </p>
          ) : null}
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </NavSidebarContext.Provider>
  );
}
