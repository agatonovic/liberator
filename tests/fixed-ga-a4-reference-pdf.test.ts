/**
 * LABELATOR reference PDF for FIXED GA A4 in the designed 2-up sheet job.
 * generateVectorPdf keeps `sheet` so rows pack onto A4 landscape.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import library from "../data/library.json";
import type { LabelDocument } from "@/lib/document";
import { writeLabelatorPackage } from "@/lib/labelator-package";
import {
  FIXED_GA_A4_PACKAGE_NAME,
  FIXED_GA_A4_TEMPLATE_ID,
  buildFixedGaA4Package,
} from "@/lib/labelator-package/fixed-ga-a4";
import { generateVectorPdf } from "@/lib/pdf";
import { autoMapBindings } from "@/lib/resolve";
import golden from "./fixtures/fixed_ga_a4_golden.json";

const repoRoot = process.cwd();
const packageDir = join(repoRoot, "artifacts/packages", FIXED_GA_A4_PACKAGE_NAME);
const outPdf = join(repoRoot, "artifacts/golden/fixed_ga_a4_labelator_reference.pdf");

function installFetchPolyfill() {
  const original = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    const files: Array<[RegExp, string, string]> = [
      [/ArtifaktElement-Black\.otf/i, "public/fonts/ArtifaktElement-Black.otf", "font/otf"],
      [/ArtifaktElement\.ttf/i, "public/fonts/ArtifaktElement.ttf", "font/ttf"],
      [/OpenSans-Bold\.woff/i, "vendor/fonts/OpenSans-Bold.woff", "font/woff"],
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
      const fontUrl = pathToFileURL(join(repoRoot, "vendor/fonts/OpenSans-Bold.woff")).href;
      const css = `@font-face{font-family:'Open Sans';src:url(${fontUrl}) format('woff');font-weight:700;}`;
      return new Response(css, { status: 200, headers: { "content-type": "text/css" } });
    }
    return original(input, init);
  };
}

describe("FIXED GA A4 LABELATOR reference PDF", () => {
  it("writes a 2-up sheet reference PDF from the package + golden rows", async () => {
    const stored = library.documents.find((item) => item.id === FIXED_GA_A4_TEMPLATE_ID);
    expect(stored).toBeTruthy();
    const before = JSON.stringify(library);
    const build = buildFixedGaA4Package(structuredClone(stored) as unknown as LabelDocument, repoRoot);
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

    installFetchPolyfill();
    const raw = JSON.parse(readFileSync(join(packageDir, "template.json"), "utf8"));
    const doc = raw.document as LabelDocument;
    expect(doc.sheet?.rows).toBe(2);
    const bindings = [
      ...new Set(
        doc.elements.flatMap((el) => [el.binding, el.fallbackBinding]).filter((v): v is string => Boolean(v?.trim())),
      ),
    ];
    const mapping = autoMapBindings(bindings, Object.keys(golden.rows[0]!), doc.dataColumns ?? []);
    const bytes = await generateVectorPdf(doc, golden.rows as Record<string, string>[], mapping);
    mkdirSync(join(repoRoot, "artifacts/golden"), { recursive: true });
    writeFileSync(outPdf, bytes);
    expect(bytes.byteLength).toBeGreaterThan(2000);
    expect(existsSync(outPdf)).toBe(true);
  }, 60_000);
});