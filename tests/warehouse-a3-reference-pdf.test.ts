/**
 * Deterministic LABELATOR reference PDF for A3 Warehouse golden comparison.
 *
 * Path selected: generatePdf in Node → generateVectorPdf (pdf-lib + fontkit).
 * Why: Production Generate UI uses canvas when `document` exists, but for CI /
 * headless golden we need a reproducible Node path. Generate also clears `sheet`
 * for 1-up jobs (one page per label at sticker size). This harness mirrors that.
 *
 * Barcodes still go through JsBarcode canvas APIs inside the existing codes.ts —
 * we polyfill `document.createElement('canvas')` with node-canvas for the harness only.
 * Does not modify the PDF renderer.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createCanvas } from "canvas";
import { describe, expect, it } from "vitest";
import { PACKAGING_FOLDER_ID } from "@/lib/assets";
import { useAssetStore } from "@/lib/asset-store";
import type { LabelDocument } from "@/lib/document";
import { autoMapBindings } from "@/lib/resolve";
import { generateVectorPdf } from "@/lib/pdf";
import golden from "./fixtures/warehouse_a3_golden.json";

const repoRoot = process.cwd();
const packageDir = join(repoRoot, "artifacts/packages/Warehouse_A3_Final_v1");
const outPdf = join(repoRoot, "artifacts/golden/warehouse_a3_labelator_reference.pdf");

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

function loadTemplateFromPackage(): LabelDocument {
  const raw = JSON.parse(readFileSync(join(packageDir, "template.json"), "utf8"));
  expect(raw.kind).toBe("labelator.template");
  return raw.document as LabelDocument;
}

function installFetchPolyfill() {
  const original = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    const mapPath = (rel: string) => join(repoRoot, rel);

    const fileResponses: Array<[RegExp, string, string]> = [
      [/ArtifaktElement-Black\.otf/i, "public/fonts/ArtifaktElement-Black.otf", "font/otf"],
      [/OpenSans-Regular\.woff/i, "vendor/fonts/OpenSans-Regular.woff", "font/woff"],
      [/OpenSans-Bold\.woff/i, "vendor/fonts/OpenSans-Bold.woff", "font/woff"],
      [/X4202\.jpg/i, "public/assets/packaging/X4202.jpg", "image/jpeg"],
      [/packaging\/manifest\.json/i, "public/assets/packaging/manifest.json", "application/json"],
    ];
    for (const [re, rel, type] of fileResponses) {
      if (re.test(url)) {
        const bytes = readFileSync(mapPath(rel));
        return new Response(bytes, { status: 200, headers: { "content-type": type } });
      }
    }

    if (/fonts\.googleapis\.com\/css2/i.test(url)) {
      const bold = /wght@700/.test(url);
      const fontUrl = pathToFileURL(
        mapPath(bold ? "vendor/fonts/OpenSans-Bold.woff" : "vendor/fonts/OpenSans-Regular.woff"),
      ).href;
      const css = `@font-face{font-family:'Open Sans';src:url(${fontUrl}) format('woff');font-weight:${bold ? 700 : 400};}`;
      return new Response(css, { status: 200, headers: { "content-type": "text/css" } });
    }

    if (url.startsWith("file:")) {
      const path = decodeURIComponent(url.replace(/^file:\/\//, ""));
      const bytes = readFileSync(path);
      return new Response(bytes, { status: 200 });
    }

    return original(input, init);
  };
}

function seedPackagingAssets() {
  const jpg = readFileSync(join(repoRoot, "public/assets/packaging/X4202.jpg"));
  const dataUrl = `data:image/jpeg;base64,${jpg.toString("base64")}`;
  useAssetStore.setState({
    hydrated: true,
    folders: [
      {
        id: PACKAGING_FOLDER_ID,
        name: "packaging",
        createdAt: "2026-09-05T00:00:00.000Z",
      },
    ],
    assets: [
      {
        id: "asset-packaging-x4202",
        folderId: PACKAGING_FOLDER_ID,
        name: "X4202.jpg",
        stem: "x4202",
        mime: "image/jpeg",
        bytes: jpg.byteLength,
        kind: "static",
        url: dataUrl,
        createdAt: "2026-09-05T00:00:00.000Z",
      },
    ],
    thumbUrls: {},
  });
}

describe("A3 Warehouse LABELATOR reference PDF", () => {
  it("writes vector reference PDF from package template + golden rows", async () => {
    expect(existsSync(join(packageDir, "template.json"))).toBe(true);
    installCanvasPolyfill();
    installFetchPolyfill();
    seedPackagingAssets();

    const doc = loadTemplateFromPackage();
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

    // Call vector path explicitly: installing a canvas `document` polyfill for JsBarcode
    // would otherwise make generatePdf choose the browser canvas-PDF path.
    const bytes = await generateVectorPdf(working, golden.rows as Record<string, string>[], mapping);
    mkdirSync(join(repoRoot, "artifacts/golden"), { recursive: true });
    writeFileSync(outPdf, bytes);
    expect(bytes.byteLength).toBeGreaterThan(5000);
    expect(existsSync(outPdf)).toBe(true);
  }, 60_000);
});
