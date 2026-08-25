"use client";

import { ensureGoogleFontsLoaded } from "@/lib/fonts";
import { useEffect, useState } from "react";

export function useLabelFonts(families: string[]) {
  const [tick, setTick] = useState(0);
  const key = [...new Set(families.filter(Boolean))].sort().join("|");
  useEffect(() => {
    let cancelled = false;
    void ensureGoogleFontsLoaded(key ? key.split("|") : []).then(() => {
      if (!cancelled) setTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return tick;
}
