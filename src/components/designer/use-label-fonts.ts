"use client";

import { ensureGoogleFontsLoaded, ensurePrintFonts } from "@/lib/fonts";
import { useEffect, useState } from "react";

function withTimeout(work: Promise<unknown>, ms: number) {
  return Promise.race([
    work.catch(() => undefined),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    }),
  ]);
}

export function useLabelFonts(families: string[]) {
  const [tick, setTick] = useState(0);
  const key = [...new Set(families.filter(Boolean))].sort().join("|");
  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split("|") : [];
    void withTimeout(
      Promise.all([ensurePrintFonts(list), ensureGoogleFontsLoaded(list)]).then(async () => {
        if (document.fonts.ready) await document.fonts.ready.catch(() => undefined);
      }),
      3000,
    ).then(() => {
      if (!cancelled) setTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return tick;
}
