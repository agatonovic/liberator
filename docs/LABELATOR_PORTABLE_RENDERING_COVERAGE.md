# LABELATOR portable rendering coverage

v1 contract (frozen): [package format](./LABELATOR_TEMPLATE_PACKAGE_FORMAT.md). Acceptance: [LABELATOR_PORTABLE_RENDERER_ACCEPTANCE.md](./LABELATOR_PORTABLE_RENDERER_ACCEPTANCE.md).

What a live LabelDocument can express, versus what the `.labelator` package carries and what the Python PoC renderer draws.

Sources: `src/lib/document.ts`, `src/lib/resolve.ts`, `src/lib/format.ts`, `src/lib/pdf.ts`, `src/lib/codes.ts`, `src/lib/shapes.ts`.  
Golden proofs: A3 Warehouse, GA Address, FIXED GA A4, Canopy A3 — 3 PN, CDC A3, Canopy A3 — 1 PN.  
Date: 2026-09-14.

This is not a claim that every designed template already renders. It is the vocabulary that exists in LABELATOR today.

| Capability | LABELATOR | Package | Python | Golden tested | Notes |
| --- | --- | --- | --- | --- | --- |
| Text | yes | yes | yes | yes | Plain and bound |
| Rich text / spans | yes | yes | yes | yes | Size and fill. A3 and HBC-style grouped spans; FIXED GA color span |
| Fonts from package | yes | yes | yes | yes | Artifakt Element, Artifakt Element Black, Open Sans 400/700. No system fallback |
| Google font packaged with the template | yes | yes | yes | yes | Inter Bold 700 WOFF. Golden on Canopy A3 — 3 PN and Canopy A3 — 1 PN. Same font table as Open Sans; no family branch |
| Letter spacing | yes | yes | yes | yes | A3 negative spacing; Canopy position uses 1.2 |
| Vertical align / align | yes | yes | yes | yes | |
| Text fit / wrap | yes | yes | yes | partial | Used when a value is longer than the designed sample |
| Rect | yes | yes | yes | yes | Including negative coordinates |
| Corner radius | yes | yes | no | no | No live template sets `cornerRadiusMm` |
| Line | yes | yes | yes | yes | Axis-aligned local line, then rotation |
| Stroke dash / dot | yes | yes | no | no | No live template sets `strokeStyle` |
| Ellipse | yes | yes | no | no | No live template uses it |
| Arrow | yes | yes | yes | yes | `line` kind proven. Other kinds are ported, not golden-tested |
| Double arrow | yes | yes | yes | yes | A3 Warehouse `triangle` and `line` |
| Triangle, diamond, star, hexagon, plus, cross | yes | yes | no | no | No live template uses them |
| Image from asset collection | yes | yes | yes | yes | A3 packaging JPEG, stretch fit |
| Image fit fill / fit | yes | yes | no | no | Renderer always stretches. No live template sets another fit |
| `imageDataUrl` | yes | not auto-bundled | no | no | Hidden art on GA / FIXED GA is skipped. A visible data URL or public path is not collected |
| Code39 | yes | yes | yes | yes | JsBarcode module geometry |
| Code128 | yes | yes | yes | yes | GA Address, raster-identical at 150 dpi |
| EAN-13 | yes | yes (symbology field) | no | no | No live template uses it |
| QR | yes | yes (element type) | no | no | No live template uses it. Quiet zone, padding, background are in the style |
| Bindings + aliases | yes | yes | yes | yes | |
| Fallback binding | yes | yes | yes | yes | GA Address barcode → address; CDC barcode → `warehouse_code`; Canopy barcode → `position` |
| `part_number` | yes | name only | yes | yes | A3 and FIXED GA |
| `part` / `partIndex` | yes | yes | no | no | No live element uses the split transform |
| `ga_magacin` + leading red R | yes | name only | yes | yes | GA Address |
| `ga_regal_letter` / `ga_regal_number` / `ga_nivo` | yes | name only | yes | yes | GA Address |
| `arrow` transform + pose | yes | name only | yes | yes | Flip 180° around center. FIXED GA tests −90 and 270 together |
| `barcode_pct` | yes | name only | yes | yes | CDC A3, Canopy 3 PN, Canopy 1 PN. Trim, empty stays empty, append `%` unless the value already ends with `%`. Does not scale the barcode |
| Rotation | yes | yes | yes | yes | Clockwise around top-left. 90, −90, 270 |
| Hidden elements | yes | yes | yes | yes | Skipped |
| Page geometry | yes | yes | yes | yes | 420×297, 408.98×80.72, 254×68 |
| Sheet layout | yes | yes | yes, if `print.mode` is `sheet` | yes | FIXED GA A4, A4 landscape 1×2. Absent `print.mode` stays 1-up so earlier proofs do not change |
| Print-time repair | yes | applied at export | no | n/a | Renderer must not re-run LABELATOR repairs. Dual-arrow stripping is catalog-aware and stays in export |
| Opacity | yes | yes | yes | partial | Drawn, not isolated as a golden case |
| Barcode HRI (`displayValue`) | yes | yes | yes | no | Golden barcodes hide the text |

## What LABELATOR can express that package + Python cannot yet reproduce

- Ellipse, non-arrow polygons, QR, EAN-13
- `part` / `partIndex`
- Rounded rectangles, dashed or dotted strokes
- Image fit other than stretch
- Visible `imageDataUrl` / public image paths (not auto-packaged)
- A font that the export did not embed (other Inter weights, or a family never packaged)
- Sheet packing unless the package sets `print.mode` to `sheet`
- Load-time repairs that depend on template name or catalog id (`isGaWarehouseDual`). Those must be applied before export, not inside Python

## Honest coverage

Countable vocabulary from `ElementType` (15 types): Python draws 7 (`rect`, `line`, `arrow`, `doubleArrow`, `text`, `barcode`, `image`). That is about **47% of element types**, and it is the set every current live template actually uses except nothing else — live templates do not use the missing 8 types.

Barcode symbologies: **2 of 3**. Transforms: **7 of 8** named transforms (`part` is still missing). Sheet jobs: implemented and golden-tested for one paper size.

So: **every element type that appears on a current live Industrial template can be drawn**, once the package includes fonts, assets, and the print job. The statement “any template designed in LABELATOR” is still false, because Designer can place ellipse, QR, EAN-13, other polygons, and transforms the renderer does not implement.

## Classification

Unsupported but unused is not the same as missing for current Stellantis production labels.

### A. Required by current live Stellantis templates

Text, rich-text spans, rectangle, line, image, barcode (Code39 and Code128), arrow, double arrow, bindings, fallback bindings, `part_number`, `barcode_pct`, GA address transforms, arrow pose, rotation, hidden elements, letter spacing, 1-up pages, one sheet job (FIXED GA A4). Fonts actually drawn: Artifakt Element, Artifakt Element Black, Open Sans 400/700, Inter 700.

### B. Implemented generically

The Python renderer has no template-id, catalog-id, or template-name branch. Behavior comes from the package document, manifest fonts/assets, and row data. `render(template_package, data, output_pdf)`.

### C. Validated by golden rendering

A3 Warehouse, GA Address (150 dpi identical), FIXED GA A4, Canopy A3 — 3 PN, CDC A3, Canopy A3 — 1 PN. CDC A3 and Canopy A3 — 1 PN were rendered with no renderer change. CDC empty-barcode page is raster-identical. Barcode regions on both new goldens are within 0.1% changed pixels.

### D. Implemented, not isolated as its own golden

Barcode human-readable text (`displayValue`). Opacity other than 1. Arrow kinds other than the kinds already on A3 / FIXED GA / GA Address. Text shrink-to-fit is exercised by long CDC and Canopy values and matches those pages; it is not a separate fixture.

### E. Intentionally not implemented

No current live Industrial template uses these. Do not treat them as production gaps:

- QR, EAN-13, ellipse
- Triangle, diamond, star, hexagon, plus, cross
- `part` / `partIndex`
- Rounded rectangles (`cornerRadiusMm` greater than 0). Canopy 1 PN sets `cornerRadiusMm: 0`, which is a square
- Dashed or dotted strokes
- Image fit other than stretch
- Visible `imageDataUrl` / public image paths not bundled into the package

## MuPDF `unknown file format`

Seen only when PyMuPDF rasterizes a LABELATOR reference PDF whose fonts were embedded by pdf-lib from WOFF. The Python PDFs, which embed the fontTools TTF conversion, do not emit it. Glyphs still paint on the reference raster. CDC page 4 is pixel-identical, and barcode regions stay under 0.1% changed pixels, so this is a subset-inspection diagnostic, not a renderer defect. No typography change.
