"use client";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAssetStore } from "@/lib/asset-store";
import { useAppStore } from "@/lib/store";
import { useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrateAssets = useAssetStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
    void hydrateAssets();
  }, [hydrate, hydrateAssets]);

  return (
    <TooltipProvider delay={0} closeDelay={0}>
      {children}
      <Toaster theme="light" position="bottom-right" />
    </TooltipProvider>
  );
}
