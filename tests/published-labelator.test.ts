import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import library from "../data/library.json";
import type { LabelDocument } from "@/lib/document";
import { catalogPackageFileName, publishedPackages } from "@/lib/labelator-package";
import { readLabelatorPackageFromZip, validateLabelatorPackageZip } from "@/lib/labelator-package";
import { catalogPackageBytes } from "@/lib/labelator-package/publish-disk";
import { A3_WAREHOUSE_PACKAGE_NAME } from "@/lib/labelator-package/a3-warehouse";
import { GA_ADDRESS_PACKAGE_NAME } from "@/lib/labelator-package/ga-address";
import { FIXED_GA_A4_PACKAGE_NAME } from "@/lib/labelator-package/fixed-ga-a4";
import { CANOPY_A3_3PN_PACKAGE_NAME } from "@/lib/labelator-package/canopy-a3-3pn";
import { CDC_A3_PACKAGE_NAME } from "@/lib/labelator-package/cdc-a3";
import { CANOPY_A3_1PN_PACKAGE_NAME } from "@/lib/labelator-package/canopy-a3-1pn";

const root = process.cwd();
const python = join(root, "tools/labelator_renderer_poc/.venv/bin/python");

const GOLDEN = [
  ["Warehouse_A3_Final_v1.labelator", "warehouse_a3", "tests/fixtures/warehouse_a3_golden.json", 3],
  ["GA_Address_v1.labelator", "ga_address", "tests/fixtures/ga_address_golden.json", 6],
  ["FIXED_GA_A4_v1.labelator", "fixed_ga_a4", "tests/fixtures/fixed_ga_a4_golden.json", 3],
  ["Canopy_A3_3_PN_v1.labelator", "canopy_a3_3pn", "tests/fixtures/canopy_a3_3pn_golden.json", 6],
  ["CDC_A3_v1.labelator", "cdc_a3", "tests/fixtures/cdc_a3_golden.json", 6],
  ["Canopy_A3_1_PN_v1.labelator", "canopy_a3_1pn", "tests/fixtures/canopy_a3_1pn_golden.json", 6],
] as const;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("published .labelator downloads", () => {
  it("names catalog files from the template, matching existing proven names", () => {
    const byName = new Map(
      (library.documents as LabelDocument[]).map((doc) => [catalogPackageFileName(doc.name), doc.name.trim()]),
    );
    expect(byName.get(`${A3_WAREHOUSE_PACKAGE_NAME}.labelator`)).toBeTruthy();
    expect(byName.get(`${GA_ADDRESS_PACKAGE_NAME}.labelator`)).toBeTruthy();
    expect(byName.get(`${FIXED_GA_A4_PACKAGE_NAME}.labelator`)).toBeTruthy();
    expect(byName.get(`${CANOPY_A3_3PN_PACKAGE_NAME}.labelator`)).toBeTruthy();
    expect(byName.get(`${CDC_A3_PACKAGE_NAME}.labelator`)).toBeTruthy();
    expect(byName.get(`${CANOPY_A3_1PN_PACKAGE_NAME}.labelator`)).toBeTruthy();
    expect(byName.get("Canopy_A3_2_PN_v1.labelator")).toBe("Canopy A3 — 2 PN");
    expect(byName.get("Slozivost_A4_v1.labelator")).toBe("Složivost A4");
  });

  it("matches the static file to the exporter and validates every package", () => {
    const published = publishedPackages();
    expect(published).toHaveLength(11);
    for (const record of published) {
      const doc = (library.documents as LabelDocument[]).find((item) => item.id === record.templateId);
      expect(doc, record.fileName).toBeTruthy();
      const rebuilt = catalogPackageBytes(doc!);
      const deployed = new Uint8Array(readFileSync(join(root, "public", record.href)));
      expect(sha256(deployed), record.fileName).toBe(record.sha256);
      expect(sha256(deployed), record.fileName).toBe(sha256(rebuilt));
      const valid = validateLabelatorPackageZip(deployed);
      expect(valid.ok, valid.issues.map((issue) => issue.message).join("; ")).toBe(true);
      const unpacked = readLabelatorPackageFromZip(deployed);
      expect(unpacked.manifest.format).toBe("labelator.package");
      expect(unpacked.manifest.formatVersion).toBe(1);
      expect(unpacked.files.get("template.json")).toBeTruthy();
      expect(unpacked.files.get("assets/index.json")).toBeTruthy();
      for (const font of unpacked.manifest.fonts) {
        expect(unpacked.files.get(font.path), font.path).toBeTruthy();
      }
      for (const collection of unpacked.assetsIndex.collections) {
        for (const rel of Object.values(collection.entries)) {
          const path = rel.startsWith("assets/") ? rel : `assets/${rel}`;
          expect(unpacked.files.get(path), path).toBeTruthy();
        }
      }
    }
  });

  it("renders every published package, and the six golden templates do not regress", () => {
    const dir = mkdtempSync(join(tmpdir(), "labelator-publish-"));
    const script = join(dir, "render.py");
    writeFileSync(
      script,
      `
import json, sys
from pathlib import Path
import fitz
sys.path.insert(0, ${JSON.stringify(join(root, "tools/labelator_renderer/src"))})
from labelator_renderer import render

root = Path(${JSON.stringify(root)})
jobs = json.loads(Path(sys.argv[1]).read_text())
for job in jobs:
    out = Path(job["out"])
    render(job["package"], job["data"], out)
    doc = fitz.open(out)
    if doc.page_count < 1:
        raise SystemExit(f"no pages: {job['package']}")
    doc.close()
    before = job.get("before")
    if not before:
        continue
    a = fitz.open(before)
    b = fitz.open(out)
    if a.page_count != b.page_count:
        raise SystemExit(f"page count {b.page_count} != {a.page_count} for {job['package']}")
    zoom = 150 / 72
    matrix = fitz.Matrix(zoom, zoom)
    for i in range(a.page_count):
        pa = a[i].get_pixmap(matrix=matrix, alpha=False)
        pb = b[i].get_pixmap(matrix=matrix, alpha=False)
        if pa.samples != pb.samples or pa.width != pb.width or pa.height != pb.height:
            raise SystemExit(f"raster differs page {i+1} {job['package']}")
    a.close(); b.close()
print("ok", len(jobs))
`,
    );
    const jobs = publishedPackages().map((record) => {
      const golden = GOLDEN.find((item) => item[0] === record.fileName);
      const data = golden
        ? join(root, golden[2])
        : join(dir, `${record.fileName}.json`);
      if (!golden) writeFileSync(data, "[{}]\n");
      copyFileSync(join(root, "public", record.href), join(dir, record.fileName));
      return {
        package: join(dir, record.fileName),
        data,
        out: join(dir, record.fileName.replace(/\.labelator$/, ".pdf")),
        before: golden ? join(root, "artifacts/golden/phase_i_before", `${golden[1]}.pdf`) : undefined,
      };
    });
    const jobsPath = join(dir, "jobs.json");
    writeFileSync(jobsPath, JSON.stringify(jobs));
    const output = execFileSync(python, [script, jobsPath], { encoding: "utf8" });
    expect(output).toContain("ok 11");
  }, 120_000);
});
