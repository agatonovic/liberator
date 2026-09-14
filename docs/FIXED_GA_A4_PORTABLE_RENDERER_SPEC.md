# LABELATOR Phase C.3 — FIXED GA A4 Portable Renderer Specification

**Status:** Third-template golden proof. Same generic `render(template_package, data, output_pdf)`.

**Source of truth:** Live Industrial library document `ff9a7d76-b9a8-4b29-a861-612b6142c9a9` (name `FIXED GA A4`). Not the catalog seed.

**Why this template:** No live Industrial template contains QR, EAN-13, ellipse, or a non-arrow polygon. Among live templates, FIXED GA A4 stacks the largest set of still-unproven generic capabilities: a real multi-up sheet (A4 landscape, 2-up), negative rotation (`-90`), a second rotation (`270`), two arrows sharing one binding, `part_number` with a colored span, and a page size that is neither A3 nor the GA Address sticker.

**Inspection date:** 2026-09-14

---

## 1. Identity

| Field | Value |
| --- | --- |
| Template ID | `ff9a7d76-b9a8-4b29-a861-612b6142c9a9` |
| Name | `FIXED GA A4` |
| Catalog ID | `fixed_ga_a4` |
| Catalog revision | `3` |
| Folder ID | `655d6e1b-31bb-4d5e-ae3d-0ca99fbdead6` (Stellantis Kragujevac) |
| Page | `254 × 68 mm` |
| Sheet | `A4-landscape`, 1 column × 2 rows, gap 0, margin 4 |
| Elements | 8 (1 hidden image) |
| Print job in the package | `print.mode = "sheet"` |

`print.mode` is a generic job setting. Packages that omit it (A3 Warehouse, GA Address) stay one sticker per page, which is how those proofs were defined. This package asks for the designed 2-up sheet.

### Data columns

| Key | Required | Example |
| --- | --- | --- |
| `reference` | yes | `7357986330` |
| `position` | yes | `RHB1A.001.003` |
| `title` | no | `FIXED` |
| `arrow` | no | `UP` |

## 2. Elements

| # | Type | Binding | Transform | Rotation | Notes |
| --- | --- | --- | --- | --- | --- |
| 0 | rect | — | — | 0 | White plate, height 71.61 (taller than the 68 mm page) |
| 1 | rect | — | — | 0 | Header `#305496`, height 20.46 |
| 2 | text | `title` | — | 0 | Designed `FIXED TEST`. Artifakt Element Black bold. Span size 14.8 |
| 3 | image | `arrow` | — | 0 | **hidden** `/templates/ga/arrows/UP-white.png` |
| 4 | text | `position` | — | 0 | Artifakt Element 4.94 mm, fill `#595959` |
| 5 | text | `reference` | `part_number` | 0 | Open Sans bold 35.4. Span indices 7–10 fill `#E43434` |
| 6 | arrow | `arrow` | `arrow` | **270** | `arrowKind: line`, white fill, content `UP` |
| 7 | arrow | `arrow` | `arrow` | **-90** | Same kind and binding, opposite side |

Both visible arrows already carry `binding: arrow` and `transform: arrow` in the stored document. `repairTemplateDocument` does not rebind them. `displayPose` keeps the designed pose when the value is `UP` or empty, and rotates 180° around each arrow's center when the value is `DOWN`.

The hidden arrow PNG is not drawn and is not required in the package.

## 3. Capability split

### A. Already supported

Text, spans, `part_number`, rect, line-kind arrow, rotation morph, arrow transform, `displayPose`, bindings, hidden skip, packaged fonts.

### B. Missing before this proof

- Sheet slot placement (`computeSlotOrigins`) when the print job is `sheet`
- Proof that negative rotation and 270° compose with pose on two elements that share one binding

### C. Belongs in the package

- Template geometry, bindings, transforms, spans
- Fonts: Artifakt Element 400, Artifakt Element Black 700, Open Sans 700
- `requiredTransforms`: `arrow`, `part_number`
- `print.mode: sheet` plus the sheet block
- Empty asset index

### D. Stays outside the Python renderer

- `repairTemplateDocument` (no-op for geometry on this template; still applied at export)
- Designer-only hidden arrow image swap
- Template id, catalog id, folder id
- Generate's UI toggle. The package records the chosen job so the renderer does not guess from the template name.

## 4. Must not become renderer branches

Do not branch on `fixed_ga_a4`, the template id, or the coordinates `254 × 68`. Sheet placement uses page size, label size, columns, rows, gap, and margin only.
