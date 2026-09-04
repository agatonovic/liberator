import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CORE_FILES = [
  "src/lib/document.ts",
  "src/lib/resolve.ts",
  "src/lib/pdf.ts",
  "src/lib/catalog.ts",
  "src/lib/run-status.ts",
  "src/lib/codes.ts",
  "src/lib/store.ts",
  "src/lib/library-hydrate.ts",
  "src/lib/library-guard.ts",
  "src/lib/template-json.ts",
  "src/lib/jobs.ts",
  "src/lib/workspace.ts",
  "src/lib/domain.ts",
  "src/components/designer/designer-view.tsx",
];

describe("dependency direction", () => {
  it("keeps shared core free of Shopify imports", () => {
    for (const file of CORE_FILES) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/from ["']@\/shopify/);
      expect(source, file).not.toMatch(/from ["']\.\.\/shopify/);
      expect(source, file).not.toMatch(/shopify-api/);
      expect(source, file).not.toMatch(/@shopify\//);
      expect(source, file).not.toMatch(/shopify-app-js/);
    }
  });

  it("keeps Shopify catalog free of Industrial catalog imports", () => {
    const source = readFileSync("src/shopify/catalog.ts", "utf8");
    expect(source).not.toMatch(/from ["']@\/lib\/catalog["']/);
    expect(source).not.toMatch(/\bCATALOG_REVISION\b/);
    expect(source).not.toMatch(/from ["']@\/lib\/catalog-registry["']/);
  });
});
