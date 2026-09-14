# Portable renderer acceptance — `.labelator` v1

**Status:** frozen proof for the validated live set. Not an integration plan.

Contract: [LABELATOR_TEMPLATE_PACKAGE_FORMAT.md](./LABELATOR_TEMPLATE_PACKAGE_FORMAT.md).

The renderer was not changed in this freeze. Phase G already rendered CDC A3 and Canopy A3 — 1 PN with no renderer code.

Reference PDFs and Python PDFs are not byte-identical. Acceptance is geometry, payload, placement, 150 dpi raster comparison, and visual inspection of the side-by-side images. Residual difference is font rasterization / anti-aliasing, not a template-specific branch.

Metrics below are the recorded 150 dpi values. They are not pass/fail thresholds.

## Validated templates

| Template | Package | Golden | Visual | Regression | Status |
| --- | --- | --- | --- | --- | --- |
| Warehouse A3 | `artifacts/packages/Warehouse_A3_Final_v1.labelator` | `artifacts/golden/metrics.json` — SSIM 0.9332 / 0.9033 / 0.9345; mean abs 0.0272 / 0.0383 / 0.0268; changed 3.82% / 5.11% / 3.78%; 2481×1754 | Side-by-side inspected in Phase C.1. Difference is Open Sans / Code39 edge anti-aliasing | Unchanged at freeze | Accepted |
| GA Address | `artifacts/packages/GA_Address_v1.labelator` | `artifacts/golden/ga_address/metrics.json` — six pages SSIM 1.0, mean abs 0, changed 0; 2416×477 | Raster-identical | Unchanged at freeze | Accepted |
| FIXED GA A4 | `artifacts/packages/FIXED_GA_A4_v1.labelator` | `artifacts/golden/fixed_ga_a4/metrics.json` — SSIM 0.8819 / 0.9315 / 0.8908; mean abs 0.0258 / 0.0128 / 0.0140; changed 3.37% / 1.72% / 1.81%; 1754×1241 | Sheet slots, −90° and 270° pose match. Difference is Open Sans edges | Unchanged at freeze | Accepted |
| Canopy A3 — 3 PN | `artifacts/packages/Canopy_A3_3_PN_v1.labelator` | `artifacts/golden/canopy_a3_3pn/metrics.json` — SSIM 0.9537 / 0.9468 / 0.9918 / 0.9708 / 0.9555 / 0.9560 | `barcode_pct`, Inter, part-number spans, qty split match. Barcode regions under 1% changed | Unchanged at freeze | Accepted |
| CDC A3 | `artifacts/packages/CDC_A3_v1.labelator` | `artifacts/golden/cdc_a3/metrics.json` — SSIM 0.9807 / 0.9794 / 0.9798 / 1.0000 / 0.9810 / 0.9845 | Fallback and `%` match. Page 4 (empty barcode and warehouse) is raster-identical. Barcode regions ≤ 0.10% changed | Unchanged after Phase G (no renderer edit) | Accepted |
| Canopy A3 — 1 PN | `artifacts/packages/Canopy_A3_1_PN_v1.labelator` | `artifacts/golden/canopy_a3_1pn/metrics.json` — SSIM 0.9629 / 0.9603 / 0.9921 / 0.9104 / 0.9612 / 0.9663 | Inter, spans, letter spacing, fallback, long-value clip match. Page 4 SSIM is lower because the page is mostly empty and the remaining ink is large Open Sans edges | Unchanged after Phase G (no renderer edit) | Accepted |

Side-by-side images live under `artifacts/golden/<template>/comparison/page-N-side-by-side.png` (Warehouse A3 uses `artifacts/golden/comparison/`). Each pair is labeled `LABELATOR REFERENCE` and `PYTHON RENDERER` at the same pixel size. No independent resize.

## Self-contained render

Given `template.labelator` and row data, the Python renderer produced every golden PDF above with:

- no LABELATOR process
- no IndexedDB
- no `data/library.json`
- no public asset directory beyond bytes already inside the package
- no internet and no Google Fonts
- no template-id branch

ZIP and unpacked directory rasters match (Phase G socket-blocked test on CDC A3 and Canopy A3 — 1 PN). Fonts are loaded from `manifest.fonts` paths inside the package and checksum-checked. Inter is not resolved from the system.

## Genericity

The renderer entry point is `render(template_package, data, output_pdf)`.

A search of `tools/labelator_renderer/src/labelator_renderer/` finds no template ids, catalog ids, template names, or Stellantis strings. Template names appear only in exporters, fixtures, tests, comparison crop labels, and these docs. The earlier PoC tree was removed; the canonical renderer is that package.

`print.mode` absent stays 1-up even when `document.sheet` is present. Sheet packing runs only when the package asks for it.

## Tests at freeze

Recorded immediately after this document, in the repository state that contains no renderer capability change for this phase.

See the Phase H report for the command results. Expected: `npm test`, `tsc --noEmit`, `npm run build`, `npm run build:pages`, and the Python PoC tests.

## Remaining gap

The renderer is sufficient for the six validated live Stellantis templates.

Unsupported features are Designer capabilities no validated live template uses: QR, EAN-13, ellipse, triangle / diamond / star / hexagon / plus / cross, dashed or dotted strokes, non-zero corner radius, `part` / `partIndex`, image fit other than stretch, and a visible image that was not bundled into the package.

Those are not production blockers for this set. Do not implement them until a live template requires them.

Product export and the compatibility analyzer sit outside this proof. They do not change the package contract, the renderer, or these results.
