/**
 * Deterministic LABELATOR reference PDF for GA Address.
 * Same path as the A3 Warehouse harness: generateVectorPdf, sheet cleared (1-up).
 * Fonts are local Artifakt files — no network.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createCanvas } from "canvas";
import { describe, expect, it } from "vitest";
import library from "../data/library.json";
import type { LabelDocument } from "@/lib/document";
import { autoMapBindings } from "@/lib/resolve";
import { generateVectorPdf } from "@/lib/pdf";
import { writeLabelatorPackage } from "@/lib/labelator-package";
import {
  GA_ADDRESS_PACKAGE_NAME,
  GA_ADDRESS_TEMPLATE_ID,
  buildGaAddressPackage,
} from "@/lib/labelator-package/ga-address";
import golden from "./fixtures/ga_address_golden.json";

const repoRoot = process.cwd();
const packageDir = join(repoRoot, "artifacts/packages", GA_ADDRESS_PACKAGE_NAME);
const outPdf = join(repoRoot, "artifacts/golden/ga_address_labelator_reference.pdf");

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
      [/ArtifaktElement-Black\.otf/i, "public/fonts/ArtifaktElement-Black.otf", "font/otf"],
      [/ArtifaktElement-Bold\.ttf/i, "public/fonts/ArtifaktElement-Bold.ttf", "font/ttf"],
      [/ArtifaktElement\.ttf/i, "public/fonts/ArtifaktElement.ttf", "font/ttf"],
    ];
    for (const [re, rel, type] of files) {
      if (re.test(url)) {
        return new Response(readFileSync(join(repoRoot, rel)), {
          status: 200,
          headers: { "content-type": type },
        });
      }
    }
    return original(input, init);
  };
}

describe("GA Address LABELATOR reference PDF", () => {
  it("writes vector reference PDF from package template + golden rows", async () => {
    const stored = library.documents.find((item) => item.id === GA_ADDRESS_TEMPLATE_ID);
    expect(stored).toBeTruthy();
    const before = JSON.stringify(library);
    const build = buildGaAddressPackage(structuredClone(stored) as unknown as LabelDocument, repoRoot);
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
    expect(raw.kind).toBe("labelator.template");
    const doc = raw.document as LabelDocument;
    const working = { ...doc, sheet: undefined };
    const bindings = [
      ...new Set(
        working.elements
          .flatMap((el) => [el.binding, el.fallbackBinding])
          .filter((v): v is string => Boolean(v?.trim())),
      ),
    ];
    const headers = Object.keys(golden.rows[0]!);
    const mapping = autoMapBindings(bindings, headers, working.dataColumns ?? []);
    const bytes = await generateVectorPdf(working, golden.rows as Record<string, string>[], mapping);
    mkdirSync(join(repoRoot, "artifacts/golden"), { recursive: true });
    writeFileSync(outPdf, bytes);
    expect(bytes.byteLength).toBeGreaterThan(2000);
    expect(existsSync(outPdf)).toBe(true);
  }, 60_000);
});