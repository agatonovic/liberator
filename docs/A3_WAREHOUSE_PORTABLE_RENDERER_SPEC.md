# LABELATOR Phase A — A3 Warehouse Portable Renderer Specification

**Status:** Inspection / specification only. No Python renderer, no `.labelator` exporter, no Industrial template mutations.

**Source of truth:** Live Industrial library document in `data/library.json` with `catalogId: "warehouse_a3"` (name `"Warehouse A3 Final "`).  
**Do not use** the simplified catalog seed builder `warehouse()` in `src/lib/catalog.ts` as geometry truth — that seed differs from the live Final template.

**Inspection date:** 2026-09-05  
**Related code:** `src/lib/document.ts`, `src/lib/resolve.ts`, `src/lib/format.ts`, `src/lib/pdf.ts`, `src/lib/codes.ts`, `src/lib/fonts.ts`, `src/lib/assets.ts`, `src/lib/shapes.ts`, `src/lib/text-color.ts`, `src/lib/template-json.ts`

---

## 1. A3 Warehouse Template Identity

| Field | Value |
| --- | --- |
| Template ID | `ee4837ef-c0f7-4ac9-8612-a689518ad7b0` |
| Name | `Warehouse A3 Final ` (trailing space in live library) |
| Catalog ID | `warehouse_a3` |
| Catalog revision | `null` on live doc (catalog seed entry exists; live Final is not stamped to a revision) |
| Folder ID | `655d6e1b-31bb-4d5e-ae3d-0ca99fbdead6` |
| Folder name | Stellantis Kragujevac |
| Document schema `version` | `1` (`DOCUMENT_VERSION`) |
| Description | A3 warehouse sticker. One row per label. |
| Page (label) | `420 × 297 mm` (full A3 landscape as the sticker itself) |
| Orientation | Landscape |
| Sheet | `pageSize: "A3-landscape"`, `columns: 1`, `rows: 1`, `gapMm: 4`, `marginMm: 8` |
| Elements | 24 |
| Organization on disk | unset (`null`); hydrate stamps Industrial org at runtime |

### Related but different templates (out of scope for this PoC)

| Name | Catalog ID | Notes |
| --- | --- | --- |
| GA Address | `ga_warehouse_a3` | Smaller multi-up address sticker (`408.98 × 80.72` mm), revision 3 |
| GA Warehouse Dual | `ga_warehouse_a3_dual` | Dual address sticker, revision 3 |

### Data columns (schema keys vs element bindings)

Live `dataColumns` keys: `reference`, `warehouse_code`, `ref4`, `depth`, `stackability`, `packaging`, `barcode`.

Live element bindings use Excel/header aliases: `REFERENCA`, `MAGACIN`, `REF4`, `DUBINA`, `SLOZIVOST`, `PAKOVANJE (MDR)`, `BARCODE`, `packaging`.

LABELATOR `resolveValue` / `lookupRowValue` resolves bindings through column keys, labels, and `headers[]` aliases (case-insensitive). A portable renderer must implement the same alias resolution (or require callers to pass already-normalized keys).

---

## 2. A3 Warehouse Element Inventory

Coordinates are millimetres, origin top-left, Y down (Designer / Konva convention).  
Z-order = array index (paint order). No `hidden` / `locked` flags are set on any element.

### Summary table

| # | ID (short) | Type | x | y | w | h | rot | Binding | Transform | Notes |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| 0 | `7fd823f1` | rect | 4.32 | 4.30 | 411.35 | 207.64 | 0 | — | — | Outer frame, stroke `#929292` 2 mm, fill transparent |
| 1 | `a24318b8` | line | 34.5 | **-26** | 40 | 0.5 | 0 | — | — | Off-page leftover |
| 2 | `ff091287` | line | 26 | **-29.5** | 40 | 0.5 | 0 | — | — | Off-page leftover |
| 3 | `b5d3cdc3` | line | 4.60 | 74.60 | 410.88 | 4 | 0 | — | — | Horizontal divider (bbox height 4; stroke 2) |
| 4 | `4bfb13ab` | image | 298.80 | 128.36 | 111.70 | 77.98 | 0 | `packaging` | — | `assetFolderId: asset-folder-packaging` |
| 5 | `cda8b4de` | barcode | 3.80 | 215.20 | 414.32 | 78.56 | 0 | `BARCODE` | — | Code39, no human-readable text |
| 6 | `3cc6764a` | line | 4.26 | 142.5 | 288.13 | 4 | 0 | — | — | Horizontal divider |
| 7 | `177c4fc6` | line | 291.40 | 76.51 | 4 | 134.44 | 0 | — | — | Vertical divider |
| 8 | `b78a3399` | line | 199.40 | 76.67 | 4 | 66.27 | 0 | — | — | Vertical divider |
| 9 | `6a3c8b2f` | line | 107.40 | 76.53 | 4 | 67.34 | 0 | — | — | Vertical divider |
| 10 | `abf83ad8` | text | 9 | 6 | 51.66 | 13.81 | 0 | — | — | Label `REFERENCA` |
| 11 | `4923f5a6` | text | 8.9 | 129 | 51.66 | 13.81 | 0 | — | — | Label `REF4` |
| 12 | `d4399eb2` | text | 115 | 128 | 51.66 | 13.81 | 0 | — | — | Label `DUBINA` |
| 13 | `e7052216` | text | 208 | 128 | 51.66 | 13.81 | 0 | — | — | Label `SLOŽIVOST` |
| 14 | `4853006e` | text | 298.8 | 79.1 | 111.70 | 13.81 | 0 | — | — | Label `PAKOVANJE (MDR)` centered |
| 15 | `67ab7451` | text | 9 | 195 | 51.66 | 13.81 | 0 | — | — | Label `MAGACIN` |
| 16 | `9a663fe8` | text | 3.8 | 99.0 | 105.68 | 17.85 | 0 | `REF4` | — | Value, Open Sans Bold 31 mm |
| 17 | `aced3986` | text | 117.0 | 98 | 31.33 | 17.85 | 0 | `DUBINA` | — | Value |
| 18 | `3d93e2c0` | text | 210 | 98 | 31.33 | 17.85 | 0 | `SLOZIVOST` | — | Value |
| 19 | `0cf208d4` | doubleArrow | 185.15 | 89.0 | 42.67 | 30.84 | **90** | — | — | `arrowKind: triangle`, white fill, navy stroke |
| 20 | `8ac2057b` | doubleArrow | 282.80 | 88.7 | 42.67 | 25.37 | **90** | — | — | `arrowKind: line`, navy fill |
| 21 | `65d73b3c` | text | 295.4 | 98 | 119.15 | 17.85 | 0 | `PAKOVANJE (MDR)` | — | Value |
| 22 | `41adf25d` | text | 3.7 | 35 | 411.55 | 13.81 | 0 | `REFERENCA` | **`part_number`** | Spans + letterSpacing −0.9 mm |
| 23 | `e1fd123a` | text | 3.7 | 167 | 289.63 | 17.85 | 0 | `MAGACIN` | — | Open Sans normal 41.5 mm |

### Element 22 — part number (critical)

Designed sample content: `98 456 445 94`

Style defaults: Open Sans bold, `fontSizeMm: 59.7`, fill `#12263A`, align center, verticalAlign middle, `letterSpacingMm: -0.9`.

Spans (designed indices into sample content):

| start | end | fill | fontSizeMm |
| ---: | ---: | --- | ---: |
| 0 | 2 | (default) | 45 |
| 3 | 7 | (default) | 66 |
| 7 | 10 | `#FF2600` | 66 |
| 11 | 13 | (default) | 45 |

LABELATOR transfers these spans onto live values via `transferSpans` (significant character mapping — digits/letters — not raw string indices). Empty bound cells render as blank (no designed sample) when a data row is present.

### Element 5 — barcode

- Symbology: `code39`
- `barcodeDisplayValue: false`
- Designed content sample: `WG1D.10.011`
- Binding: `BARCODE` (aliases via column `barcode` headers)
- **No** `transform: "barcode_pct"` on the live Final template (catalog seed had it; live does not)
- **No** `fallbackBinding` on the live barcode element

### Element 4 — packaging image

- Binding value looked up in asset folder `asset-folder-packaging`
- Match rule: stem or exact filename (`assetLookupKey` strips extension, lowercases)
- Example: packaging code `X4202` → `public/assets/packaging/X4202.jpg`
- No embedded `imageDataUrl` on the element

### Static labels (elements 10–15)

Artifakt Element Black, bold, 8 mm, fill `#929292`.

### Off-page lines (1–2)

Present in JSON; outside the 297 mm page. Harmless if clipped; portable renderer may skip or clip.

---

## 3. Features Used

### Generic renderer primitives

| Feature | Used? |
| --- | --- |
| text | yes |
| rect | yes |
| line | yes |
| image (JPEG lookup) | yes |
| barcode (Code39) | yes |
| doubleArrow polygon | yes |
| qr | **no** |
| ellipse / triangle / diamond / single arrow | **no** |

### Generic renderer behaviors

| Behavior | Used? |
| --- | --- |
| mm coordinates, Y-down → PDF Y-up | yes |
| paint order = element array order | yes |
| rotation around Konva top-left pivot | yes (90° on two doubleArrows) |
| text alignment H/V | yes |
| font family + weight | yes |
| letter spacing (negative) | yes (part number) |
| opacity | present (always 1) |
| stroke / fill / strokeWidth | yes |
| binding substitution + empty-bound-cell blanking | yes |
| column alias resolution | yes |
| image fit + clip | no explicit `imageFit` ⇒ LABELATOR default **`stretch`** |
| sheet layout (1 label / A3 page, centered) | yes |
| mixed text spans (size + color runs) | **yes (critical)** |
| auto font-size fit into box | yes (`fitPlainFontSize` when no usable transferred spans path details matter) |

### LABELATOR transforms used by this template

| Transform | Used on A3 Warehouse Final? |
| --- | --- |
| `part_number` | **yes** (REFERENCA) |
| `part` / `partIndex` | no |
| `arrow` | no |
| `barcode_pct` | **no** (on live Final) |
| `ga_magacin` / `ga_regal_*` / `ga_nivo` | **no** |

### Industrial-specific behavior

Minimize this bucket. For A3 Warehouse Final only:

1. **`part_number` formatting** — Stellantis part-number grouping (`formatPartNumber`). Prefer shipping this as a named portable transform, not hard-coding “Warehouse A3”.
2. **Packaging asset folder convention** — `asset-folder-packaging` + stem match. Portable package should ship an `assets/` index rather than requiring LABELATOR’s IndexedDB.
3. **Span transfer semantics** for styled part numbers — generic capability, but the designed span pattern is Stellantis visual language.

Not required for this template: GA address parsing, red leading-R spans, UP/DOWN arrow rotation swapping.

---

## 4. Required Generic Renderer Capabilities

Required for A3 Warehouse
-------------------------

1. **Load portable template + row data** — Parse `LabelDocument` (or envelope), iterate elements in order, resolve bindings per row.
2. **mm → PDF points** — `pt = mm * 72 / 25.4`; page size 420×297 mm → ≈ 1190.55 × 841.89 pt.
3. **Coordinate system** — Element `x,y` is top-left of bbox in Y-down mm; PDF draws Y-up. Match LABELATOR `pdfTopLeft` / Konva pivot rotation.
4. **Rectangle** — Optional fill, stroke, stroke width, corner radius (0 here), opacity.
5. **Line** — Drawn as SVG/path from local line points inside width×height bbox (LABELATOR `lineLocalPoints`); stroke only.
6. **Text** — Embed real font binaries; bold vs regular; size in mm; align left/center/right; verticalAlign top/middle/bottom; letterSpacing; Unicode (e.g. `SLOŽIVOST`).
7. **Text spans / runs** — Per-character fill and fontSize overrides; transfer designed spans onto live `part_number` output.
8. **Text measurement / layout** — Width-of-text, wrapping, vertical centering; LABELATOR also shrinks plain text to fit (`fitPlainFontSize`) when spans are absent.
9. **`part_number` transform** — Digit grouping to `NN NNN NNN NN(N)` (see `formatPartNumber`).
10. **Code39 barcode** — Raster or vector bars into the element box; no human-readable line; margin 0; scale modules to fill width (LABELATOR uses JsBarcode then blit to 300 dpi px box).
11. **Bound image** — Resolve packaging code → image file; draw into box (contain/cover/stretch — match `imageFitOf` default); JPEG support.
12. **doubleArrow polygons** — Generate vertices for `arrowKind` `triangle` and `line`; fill and/or stroke; rotate 90° around top-left.
13. **Sheet composition** — One label centered on A3 landscape with sheet margin/gap rules (`computeSlotOrigins`).
14. **Empty data policy** — With a live row, empty bound fields render blank (do not fall back to designed sample content).

### What LABELATOR does today (PDF)

- **Browser Generate path:** rasterize via Konva canvas → PNG → embed in PDF (`generateCanvasPdf`). This is the interactive production path when `document` exists.
- **Non-DOM / vector path:** `pdf-lib` + fontkit (`generateVectorPdf`) with the same resolve/draw semantics.
- Golden tests should pick **one** reference path and stick to it (recommend vector for reproducibility in CI without browser; or canvas if matching warehouse printers’ current files).

### Likely Python approach

| Area | Approach | 1:1 difficulty | Deps |
| --- | --- | --- | --- |
| PDF | ReportLab or PyMuPDF | medium | reportlab / pymupdf |
| Fonts | embed TTF/OTF bytes from package | **high** metrics | fontTools optional |
| Barcode | python-barcode or treepoem/BWIPP | medium–high quiet zones | python-barcode |
| Images | Pillow | medium | Pillow |
| Polygons | path drawing | medium | — |
| Text metrics | PDF font stringWidth + manual layout | **high** | — |
| Transforms | pure Python port of `format.py` | low | — |

---

## 5. Template-Specific Transforms

Only one transform appears on this template:

### `part_number`

LABELATOR (`src/lib/format.ts`):

- Trim; if already 4 whitespace-separated groups → join with spaces.
- Else strip non-digits; pad 9→10 with leading `0`.
- 10 digits → `AA BBB CCC DD`
- 11 digits → `AA BBB CCC DDD`
- Else return original text.

Portable renderer: implement as a **named transform registry** entry (`transforms/part_number.py`), selected by `element.transform`, not by template id.

Other transforms in the engine (`ga_*`, `arrow`, `barcode_pct`, `part`) are **not required** for A3 Warehouse Final, but a generic renderer should keep the registry open.

---

## 6. Fonts

| Family | Weights used | Style | Source in LABELATOR | Bundled file |
| --- | --- | --- | --- | --- |
| **Artifakt Element Black** | bold (mapped to same Black face for 400/700) | normal | Local (`isLocalFont`) | `public/fonts/ArtifaktElement-Black.otf` (also `.ttf` present; CSS/PDF prefer `.otf`) |
| **Open Sans** | bold (31, 59.7 mm) and normal (41.5 mm) | normal | Google Fonts at runtime (`fetchFontBytes` → gstatic TTF) | **Not vendored in repo** |

### LABELATOR loading behavior

- Designer: `faces.css` for Artifakt; Google CSS for Open Sans.
- PDF embed: `fetchFontBytes(family, 400|700)` then `pdf.embedFont` / canvas `FontFace`.
- Unknown families fall back to IBM Plex / Helvetica.

### Portable package requirement

**Font family names alone are insufficient.**

The `.labelator` package **must** include:

1. `ArtifaktElement-Black.otf` (or the exact TTF used if locking to that).
2. Open Sans Regular (400) and Bold (700) TTF binaries (pin specific Google/static files used by LABELATOR at export time).

Manifest should record: family name, weight, file path, checksum.

---

## 7. Assets

| Resource | Used? | In template JSON? | Portable need |
| --- | --- | --- | --- |
| Packaging JPEGs under `public/assets/packaging/` | yes | Only `assetFolderId` + binding | Package referenced images (or full packaging set) + lookup index |
| SVG | no | — | — |
| Embedded `imageDataUrl` | no on this template | — | — |
| `/templates/...` public paths | no | — | — |
| Arrow image swap `/arrows/UP|DOWN` | no | — | — |

### Packaging lookup (LABELATOR)

`findAssetByValue`: folder `asset-folder-packaging`, key = lowercase stem of value (extension stripped). Example `X4202` → `X4202.jpg`.

Manifest today: `public/assets/packaging/manifest.json` (list of filenames, ~71 entries). Full folder is larger on disk.

**Gap:** Canonical Template JSON does **not** embed packaging binaries or a portable asset index — only the folder id string.

---

## 8. Current JSON Portability

Analyzed against `src/lib/template-json.ts` (`schemaVersion: 1`, `kind: "labelator.template"`).

### A. Already portable (in exported `document`)

- Page size, sheet layout
- Full element geometry, styles, rotations
- Bindings, transforms, designed content, spans
- Barcode symbology flags
- `dataColumns` schema
- doubleArrow `arrowKind`
- `assetFolderId` string (as a reference, not payload)

### B. Internal LABELATOR references

- `id`, `folderId`, `catalogId`, `catalogRevision`, `organizationId`, `publishedVersionId`, versions history (stripped by default)
- `assetFolderId: "asset-folder-packaging"` (runtime Asset library id)
- Runtime IndexedDB asset blobs / object URLs

### C. External resources to package

- Font binaries (Artifakt Black + Open Sans 400/700)
- Packaging images needed for test/production rows (at least `X4202.jpg` for demo; production may need the full set)

### D. Missing for a future Python renderer

- Embedded font files / checksums
- Asset catalog mapping `stem → relative path` + binaries
- Explicit document of transform semantics (or a transforms version field)
- Pin of LABELATOR render profile (canvas vs vector) for golden baselines
- Optional: normalize element bindings to `dataColumns.key` for simpler external consumers
- Optional: `barcode_pct` / fallbackBinding if Stellantis Excel expects `%` suffix (live Final does not encode this)

### E. LABELATOR-specific vs portable spec

| Keep LABELATOR-only | Promote to portable |
| --- | --- |
| Studio folder / org / versions / activity | `page`, `sheet`, `elements`, `dataColumns` |
| Designer-only flags (`locked`) if unused | `transform` names + published transform semantics |
| Catalog revision bookkeeping | Font + asset package entries |
| Shopify / edition routing | `schemaVersion` / package `manifest` |

---

## 9. Proposed `.labelator` Package

Smallest useful package for A3 Warehouse Final:

```text
Warehouse_A3_Final_v1.labelator/   # zip or directory
├── manifest.json
├── template.json                  # LabelatorTemplateJson envelope
├── fonts/
│   ├── ArtifaktElement-Black.otf
│   ├── OpenSans-Regular.ttf
│   └── OpenSans-Bold.ttf
└── assets/
    ├── index.json                 # [{ "stem": "x4202", "path": "packaging/X4202.jpg", ...}]
    └── packaging/
        └── X4202.jpg              # plus others as needed
```

### `manifest.json` (proposed)

- `packageVersion`, `createdAt`, `sourceApp: "labelator"`, `sourceTemplateId`, `catalogId`, `name`
- `renderProfile`: e.g. `"labelator-vector-v1"` or `"labelator-canvas-v1"`
- `fonts[]`: `{ family, weight, file, sha256 }`
- `assetsFolderIdMap`: `{ "asset-folder-packaging": "assets/packaging" }`
- `requiredTransforms`: `["part_number"]`
- `pageMm`, `sheet` summary (denormalized for validators)

### `template.json`

Full `buildTemplateJson(doc)` output: envelope + `document` with geometry, styles, spans, bindings, transforms, `dataColumns`. Strip version history (default).

### `assets/`

At minimum every packaging image referenced by golden/production datasets. Prefer shipping the industrial packaging set Stellantis already uses under `public/assets/packaging/`.

### `fonts/`

Mandatory binaries listed above.

### External vs embedded

- Do **not** rely on Google Fonts network at print time.
- Do **not** require LABELATOR Asset IndexedDB.
- Large packaging libraries may stay external with a configured search path **only if** the Python host guarantees identical files; for the PoC, embed.

---

## 10. Proposed Generic Python Renderer Architecture

```text
labelator_renderer/
  __init__.py
  api.py                 # render(template, data, output)
  package.py             # open .labelator zip/dir, read manifest
  document.py            # LabelDocument models
  resolve.py             # binding lookup, aliases, empty-cell policy
  transforms/
    __init__.py          # registry
    part_number.py
    # (later) ga_*.py, arrow.py, barcode_pct.py
  units.py               # mm↔pt
  layout_sheet.py        # computeSlotOrigins equivalent
  fonts.py               # register embedded faces
  text.py                # measure, wrap, spans, letterSpacing, align
  shapes.py              # rect, line, doubleArrow polygons
  images.py              # asset resolve + draw/fit
  barcode.py             # Code39 → image/path
  pdf_backend.py         # ReportLab/PyMuPDF page ops + Konva-like rotation
  renderer.py            # walk elements → draw
```

### Conceptual API

```python
render(
    template="Warehouse_A3_Final_v1.labelator",
    data=rows,            # list[dict[str, str]]
    output="labels.pdf",
    mapping=None,         # optional column mapping
)
```

### Template + data vs business logic

- **Template** owns geometry, styles, which fields bind where, which transforms apply.
- **Data** owns per-label values (`REFERENCA`, `MAGACIN`, … or normalized keys).
- **Renderer** owns only generic primitives + registered transforms.
- There is **no** `render_a3_warehouse()`. Warehouse-specific look comes entirely from the packaged `LabelDocument`.

---

## 11. First Golden Test

### Goal

Produce LABELATOR reference PDF and Python PDF for the same template + data; compare.

### Template

Live Industrial `warehouse_a3` / `ee4837ef-…` exported via `buildTemplateJson` (working scope, no version history), packaged with fonts + packaging asset for the test row.

### Deterministic dataset (3 labels → 3 pages)

Because sheet is 1×1 on A3, **3 rows ⇒ 3 pages**, one label centered per page.

| # | REFERENCA | REF4 | DUBINA | SLOZIVOST / SLOŽIVOST | PAKOVANJE (MDR) | MAGACIN | BARCODE |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `7358042350` | `QULY` | `1` | `4` | `X4202` | `WG6.99.123` | `WG6.99.123` |
| 2 | `73 580 423 50` | `REVI` | `6` | `6` | `X4202` | `WG1D.01.001` | `WG1D.01.001` |
| 3 | `9845644594` | `ABCD` | `2` | `3` | `X4202` | `HB9A.011.001` | `HB9A.011.001` |

Expected after `part_number`: row1/row3 → `73 580 423 50` / `98 456 445 94` style grouping; row2 already grouped.

### Expected geometry

- Page size: A3 landscape **420 × 297 mm**
- Labels: **3**
- Pages: **3**
- One label origin roughly centered (sheet margin 8, gap 4, 1×1 → centered on page)

### Comparison strategy

1. **Primary:** rasterize both PDFs at 150–300 dpi; per-page SSIM / mean abs diff with tolerance (fonts/barcode will not be byte-identical).
2. **Secondary:** assert page count, media box size (pt), and optional PDF text extraction for MAGACIN / REF4 strings.
3. **Do not** require identical PDF bytes or identical object streams.

### Important visual checks

- Part number grouping, mixed span sizes, red mid-run digits
- Code39 fills bottom band; scannable
- Packaging photo `X4202` present and framed
- Cell grid lines and rotated doubleArrows between columns
- Artifakt gray field labels vs Open Sans values
- Negative letter spacing on part number
- No designed-sample leakage when a bound field is intentionally empty (add a 4th negative-check row in a follow-up)

### Tolerance (suggested starting point)

- Full-page mean pixel abs diff ≤ 2–4% after alignment
- Or SSIM ≥ 0.97 excluding barcode quiet-zone edges if needed
- Tighten after first Python pass

### Reference generator

Pin either:

- Node harness calling `generateVectorPdf` (reproducible), **or**
- Headless browser canvas path matching warehouse Generate UI

Document the choice in the test README.

---

## 12. 1:1 Rendering Risks

| Risk | Rank | Notes |
| --- | --- | --- |
| Font metrics (Open Sans / Artifakt vs substitutes) | **CRITICAL** | Wrong binary ⇒ width/baseline drift on huge part number |
| Text baseline / verticalAlign middle | **HIGH** | Especially oversized fonts in short boxes (13.8 mm box vs 59.7 mm design size) |
| Span transfer + mixed font sizes + red run | **CRITICAL** | Core Stellantis look |
| Letter spacing −0.9 mm | **HIGH** | Easy to ignore |
| Font weight bold mapping for Artifakt Black | **MEDIUM** | Same file for 400/700 in LABELATOR |
| Code39 module scaling / quiet zones | **HIGH** | JsBarcode blit vs python-barcode defaults |
| Barcode raster interpolation | **MEDIUM** | LABELATOR disables smoothing on blit |
| Image fit / JPEG decode / DPI | **MEDIUM** | Large packaging photos downscaled into ~112×78 mm |
| doubleArrow polygon geometry | **MEDIUM** | Must port `doubleArrowPolygon` kinds |
| Rotation origin (Konva top-left vs PDF center) | **HIGH** | 90° arrows will misplace if wrong |
| mm→pt floating point | **LOW** | Use same formula |
| PDF page dimensions | **LOW** | Standard A3 landscape |
| Stroke widths on hairline dividers | **MEDIUM** | Line bbox vs stroke semantics |
| Clipping off-page lines | **LOW** | Elements 1–2 |
| Transparency | **LOW** | opacity 1; transparent fills |
| Unicode `SLOŽIVOST` | **MEDIUM** | Needs font glyph coverage (labels use Artifakt) |
| Coordinate rounding | **MEDIUM** | Live JSON has float noise |
| Canvas vs vector LABELATOR paths | **HIGH** | Reference ambiguity for golden tests |
| Binding alias mismatch | **MEDIUM** | Headers vs keys |
| Missing `barcode_pct` vs Excel `%` values | **MEDIUM** | Data contract, not geometry |

---

## 13. Recommended Next Implementation Step

1. **Export-only tooling (no Industrial mutation):** CLI/script that reads `data/library.json` document `warehouse_a3`, writes a `.labelator` package (template.json + fonts + packaging subset) to `artifacts/` (gitignored).
2. **Port transforms + resolve** in Python with unit tests against `formatPartNumber` / `transferSpans` fixtures.
3. **Minimal PDF renderer** for rect/line/text/barcode/image/doubleArrow only.
4. **Golden test harness** comparing vector LABELATOR PDF vs Python PDF for the 3-row dataset.
5. Defer GA transforms, QR, Shopify, and full asset library sync.

Do **not** yet change Designer, `library.json`, catalog revision, or production PDF behavior.

---

## 14. Files Changed

| File | Change |
| --- | --- |
| `docs/A3_WAREHOUSE_PORTABLE_RENDERER_SPEC.md` | **Added** — this specification |

No application code, templates, catalogs, or `package.json` changes in Phase A.

---

## 15. Verification Results

Run after writing this doc:

```bash
git status --short
git diff -- data/library.json
```

Expected:

- `data/library.json` unchanged (empty diff)
- No Industrial template geometry/bindings modified
- Only documentation addition under `docs/`

---

## Appendix A — Catalog seed vs live Final

`src/lib/catalog.ts` `warehouse()` builds a **different**, simpler layout (fewer decorative lines, no doubleArrows, different bindings/`barcode_pct`, catalog finish metadata).  
**Portable PoC must use the live library document**, not re-seed from catalog.

## Appendix B — Answer in one sentence

A Stellantis Python developer needs a generic `LabelDocument` renderer that draws mm-based rect/line/text/image/Code39/doubleArrow with Konva-compatible rotation, embeds Artifakt Black + Open Sans binaries, resolves packaging images by stem, applies `part_number` + span transfer, and composes one centered label per A3 page — all driven by packaged template JSON + row data, with no LABELATOR server online.
