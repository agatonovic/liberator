/**
 * Self-contained LABELATOR reference for Canopy A3 — 1 PN.
 * Writes the .labelator package itself, then generateVectorPdf (1-up; no sheet).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createCanvas } from "canvas";
import { describe, expect, it } from "vitest";
import library from "../data/library.json";
import type { LabelDocument } from "@/lib/document";
import { writeLabelatorPackage } from "@/lib/labelator-package";
import {
  CANOPY_A3_1PN_PACKAGE_NAME,
  CANOPY_A3_1PN_TEMPLATE_ID,
  buildCanopyA3OnePnPackage,
} from "@/lib/labelator-package/canopy-a3-1pn";
import { generateVectorPdf } from "@/lib/pdf";
import { autoMapBindings } from "@/lib/resolve";
import golden from "./fixtures/canopy_a3_1pn_golden.json";

const repoRoot = process.cwd();
const packageDir = join(repoRoot, "artifacts/packages", CANOPY_A3_1PN_PACKAGE_NAME);
const outPdf = join(repoRoot, "artifacts/golden/canopy_a3_1pn_labelator_reference.pdf");

function installCanvasPolyfill() {
  const g = globalThis as typeof globalThis & { document?: { createElement: (tag: string) => unknown } };
  g.document = {
    createElement(tag: string): unknown {
      if (tag.toLowerCase() !== "canvas") {
        throw new Error(`Harness document.createElement only supports canvas (got ${tag})`);
      }
      return createCanvas(1, 1);
    },
  } as Document;
}

function installFetchPolyfill() {
  const original = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    const files: Array<[RegExp, string, string]> = [
      [/OpenSans-Regular\.woff/i, "vendor/fonts/OpenSans-Regular.woff", "font/woff"],
      [/OpenSans-Bold\.woff/i, "vendor/fonts/OpenSans-Bold.woff", "font/woff"],
      [/Inter-Bold\.woff/i, "vendor/fonts/Inter-Bold.woff", "font/woff"],
    ];
    for (const [re, rel, type] of files) {
      if (re.test(url)) {
        return new Response(readFileSync(join(repoRoot, rel)), {
          status: 200,
          headers: { "content-type": type },
        });
      }
    }
    if (/fonts\.googleapis\.com\/css2/i.test(url)) {
      const inter = /family=Inter/i.test(url);
      const bold = /wght@700/.test(url) || inter;
      const fake = inter
        ? "https://fonts.gstatic.com/s/inter/v20/Inter-Bold.woff"
        : bold
          ? "https://fonts.gstatic.com/s/opensans/v44/OpenSans-Bold.woff"
          : "https://fonts.gstatic.com/s/opensans/v44/OpenSans-Regular.woff";
      const family = inter ? "Inter" : "Open Sans";
      const css = `@font-face{font-family:'${family}';src:url(${fake}) format('woff');font-weight:${bold ? 700 : 400};}`;
      return new Response(css, { status: 200, headers: { "content-type": "text/css" } });
    }
    return original(input, init);
  };
}

describe("Canopy A3 1 PN LABELATOR reference PDF", () => {
  it("writes the package and a vector reference PDF from golden rows", async () => {
    const stored = library.documents.find((item) => item.id === CANOPY_A3_1PN_TEMPLATE_ID);
    expect(stored).toBeTruthy();
    const before = JSON.stringify(library);
    const build = buildCanopyA3OnePnPackage(structuredClone(stored) as unknown as LabelDocument, repoRoot);
    expect(build.manifest.requiredTransforms).toEqual(["barcode_pct", "part_number"]);
    expect(build.manifest.print).toBeUndefined();
    expect(build.manifest.fonts.some((font) => font.family === "Inter" && font.weight === 700)).toBe(true);
    await writeLabelatorPackage(build, join(repoRoot, "artifacts/packages"), {
      mkdir: async (path, opts) => {
        await mkdir(path, { recursive: opts?.recursive ?? true });
      },
      writeFile: async (path, data) => {
        await writeFile(path, data);
      },
      join,
      dirname,
    });
    expect(JSON.stringify(library)).toBe(before);

    installCanvasPolyfill();
    installFetchPolyfill();
    const raw = JSON.parse(readFileSync(join(packageDir, "template.json"), "utf8"));
    const doc = raw.document as LabelDocument;
    const bound = doc.elements.filter((el) => el.transform === "part_number").map((el) => el.binding);
    expect(bound).toEqual(["ref1"]);
    const bindings = [
      ...new Set(
        doc.elements.flatMap((el) => [el.binding, el.fallbackBinding]).filter((v): v is string => Boolean(v?.trim())),
      ),
    ];
    const mapping = autoMapBindings(bindings, Object.keys(golden.rows[0]!), doc.dataColumns ?? []);
    const bytes = await generateVectorPdf({ ...doc, sheet: undefined }, golden.rows as Record<string, string>[], mapping);
    mkdirSync(join(repoRoot, "artifacts/golden"), { recursive: true });
    writeFileSync(outPdf, bytes);
    expect(bytes.byteLength).toBeGreaterThan(2000);
    expect(existsSync(outPdf)).toBe(true);
  }, 60_000);
});
