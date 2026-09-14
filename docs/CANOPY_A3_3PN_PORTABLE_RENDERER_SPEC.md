# LABELATOR Phase C.4 — Canopy A3 3 PN Portable Renderer Specification

**Status:** Fourth-template golden proof. Same generic `render(template_package, data, output_pdf)`.

**Source of truth:** Live Industrial library document `6060f5ce-7572-44a4-b085-9845557f62df` (name `Canopy A3 — 3 PN`). Not the catalog seed. The live document was not modified.

**Why this template:** It is the only live CDC/Canopy candidate that combines `barcode_pct`, Inter Bold, a Code128 fallback, and three part-number lines plus three qty boxes that print-time repair binds. CDC A3 has `barcode_pct` but no Inter and no part numbers. Canopy 2 PN has `barcode_pct` but MAGACIN is Artifakt, not Inter. Canopy 1 PN has Inter and `barcode_pct` but only one part number and no qty split.

The template is the golden proof. The capabilities added to the renderer are generic: `barcode_pct` v1 and packaging whatever font files the export lists (Inter is not a renderer branch).

**Inspection date:** 2026-09-14

---

## 1. Candidate comparison

| | CDC A3 | Canopy A3 — 1 PN | Canopy A3 — 2 PN | Canopy A3 — 3 PN |
| --- | --- | --- | --- | --- |
| Id | `3085002f-b6ce-4feb-bfb5-62f111cd9645` | `14057388-ae40-4251-a03d-d9cb77a5d0e4` | `374ebcd7-87ef-4c98-b006-3cb9d38d659b` | `6060f5ce-7572-44a4-b085-9845557f62df` |
| Page | 420 × 297 | 420 × 297 | 420 × 297 | 420 × 297 |
| Sheet | none | none | none | none |
| Element types | rect, text, barcode | rect, text, barcode | rect, text, barcode | rect, text, barcode |
| Fonts | Artifakt Black, Open Sans bold | Open Sans, Inter bold | Open Sans, Artifakt Black | Open Sans, Inter bold, Artifakt Black |
| Barcode | Code128, `barcode_pct`, fallback `warehouse_code` | Code128, `barcode_pct`, fallback `position` | Code128, `barcode_pct`, fallback `position` | Code128, `barcode_pct`, fallback `position` |
| Part numbers | none | already bound `part_number` | already bound `part_number` | unbound grouped art; repair binds `ref1`–`ref3` |
| Qty | none | none | qty columns | three boxes stored on `qty1`; repair splits |
| Unsupported besides the gaps this phase closes | no | no | no | no |

Selected: **Canopy A3 — 3 PN**.

---

## 2. `barcode_pct` semantics

From `src/lib/resolve.ts`. Applied to the bound string after fallback lookup, before drawing.

| Input | Output |
| --- | --- |
| empty or whitespace | `""` (barcode is not drawn) |
| already ends with `%` | unchanged (`100%` stays `100%`, `%` stays `%`) |
| anything else | trim, then append one `%` (`WG1D.11.014` → `WG1D.11.014%`, `0` → `0%`) |

It does not change width, height, scale, position, module width, or JsBarcode options. The percentage is literal payload text, not a layout factor. Rounding does not apply. The encoded Code128 value includes the `%` character. Empty result skips the barcode (`pdf.ts` returns when `!value.trim()`).

---

## 3. Inter

Family `Inter`, weight 700, style normal. LABELATOR loads it through `fetchFontBytes` (Google CSS with the Firefox UA). The CSS endpoint returns WOFF, not TTF.

Pinned file: `vendor/fonts/Inter-Bold.woff`  
sha256: `52026705fdc61b964e77937b199b9888c8200281b81cffff648c54f8d9e98e79`  
Source URL recorded in the package font entry. The renderer loads the packaged bytes. It does not look up Inter by family name on the system.

Open Sans 400/700 and Artifakt Element Black 700 are packaged the same way. No font-family branch in Python.

`embedFamily` always fetches weight 400 before 700. This template does not draw Inter 400. The golden harness serves the pinned Bold bytes for that unused fetch so a missing Regular face cannot drop the family to Helvetica. That is harness-only; production `fetchFontBytes` is unchanged.

---

## 4. Export

Package `artifacts/packages/Canopy_A3_3_PN_v1.labelator`. `print.mode` omitted (1-up at label size). Export runs `repairTemplateDocument` on a clone so the package already has `ref1`/`ref2`/`ref3` + `part_number` and split qty bindings. Python does not re-run repair.

Does not write `data/library.json`.
