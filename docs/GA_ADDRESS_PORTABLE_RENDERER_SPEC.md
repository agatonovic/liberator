# LABELATOR Phase C.2 — GA Address Portable Renderer Specification

**Status:** Second-template golden proof. Same generic Python `render(template_package, data, output_pdf)`. No template-id branches.

**Source of truth:** Live Industrial library document in `data/library.json` with `id: "0a9b4a95-985c-487d-a58e-057a5e45ba57"` (name `"GA Address"`).  
**Do not use** the catalog seed `ga_warehouse_a3` in `src/lib/catalog.ts` as geometry truth.

**Print-time document:** Stored JSON is pre-repair. LABELATOR hydrate / `ensurePrintGrid` runs `repairTemplateDocument` before Generate. That repair binds the unbound arrow to the `arrow` column. The `.labelator` package is built from that repaired clone in memory. `data/library.json` is not written.

**Inspection date:** 2026-09-14  
**Related:** [A3 Warehouse spec](./A3_WAREHOUSE_PORTABLE_RENDERER_SPEC.md), [package format](./LABELATOR_TEMPLATE_PACKAGE_FORMAT.md)

---

## 1. Template identity

| Field | Value |
| --- | --- |
| Template ID | `0a9b4a95-985c-487d-a58e-057a5e45ba57` |
| Name | `GA Address` |
| Catalog ID | `ga_warehouse_a3` |
| Catalog revision | `3` (stamped on the live doc; not bumped) |
| Folder ID | `655d6e1b-31bb-4d5e-ae3d-0ca99fbdead6` |
| Folder name | Stellantis Kragujevac |
| Document schema `version` | `1` |
| Description | One MAGACIN / REGAL / NIVO sticker (409 × 81 mm). Generate packs 3 per A3 landscape. |
| Page (label) | `408.98 × 80.72 mm` |
| Sheet (stored) | `A3-landscape`, `columns: 1`, `rows: 3`, `gapMm: 0`, `marginMm: 2` |
| Elements | 18 (2 hidden text leftovers + 1 hidden background image) |
| Organization on disk | unset (`null`) |

Golden comparison follows the A3 harness: Generate 1-up clears `sheet`, so each row is one page at sticker size. The sheet is recorded in the package and is not used by this 1-up proof.

### Why this template

It is a live Stellantis template, not a seed clone and not a synthetic fixture. It is substantially different from A3 Warehouse: short landscape address sticker, Code128 (not Code39), named address-split transforms, a data-driven arrow, header spans, and no packaging photos.

### Data columns

| Key | Required | Aliases | Example |
| --- | --- | --- | --- |
| `address` | yes | address, Address, MAP SIMPLE, POSITION | `HB9A.011.001` |
| `arrow` | yes | arrow, Arrow, ARROW | `DOWN` |
| `barcode` | no | barcode, Barcode | `HB9A.011.001` |

The current spreadsheet attached to the library (`data.fileName: "GA Address"`, headers `reference` / `position` / `title` / `arrow`) is **not** this template's contract. Golden rows use the template columns only.

---

## 2. Element inventory

Coordinates are millimetres, origin top-left, Y down. Z-order = array index.

| # | ID (short) | Type | x | y | w | h | rot | Binding | Transform | Notes |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| 0 | `240acf7b` | image | 0 | 0 | 408.98 | 80.72 | 0 | — | — | **hidden** background `/templates/ga/ga_warehouse.png` |
| 1 | `68ecc003` | text | 0 | 23.8 | 130.5 | 34.06 | 0 | `address` | `ga_magacin` | Designed `HB1`. Artifakt Element Black 34.95 bold, centered |
| 2 | `7b42f430` | text | 198.3 | 26.74 | 55.46 | 25.82 | 0 | `address` | `ga_regal_number` | **hidden** leftover |
| 3 | `973845f6` | text | 288.29 | 26.74 | 60.5 | 25.82 | 0 | `address` | `ga_nivo` | **hidden** leftover |
| 4 | `4f394013` | barcode | 67.2 | 57.86 | 274.96 | 21.87 | 0 | `barcode` | — | Code128, `fallbackBinding: address`, no HRI |
| 5 | `cce9be8a` | rect | -1 | -1 | 409.9 | 24.7 | 0 | — | — | Header band `#2F5495` |
| 6 | `0415d95c` | text | -0.4 | 2 | 130.5 | 20.8 | 0 | — | — | `MAGACIN`. Span fill `#FFFFFF` size 21.6 mm |
| 7 | `0c99e4c5` | text | 130.09 | 2 | 145.79 | 20.8 | 0 | — | — | `REGAL`. Same white span |
| 8 | `bd11caf3` | text | 275.88 | 2 | 133.19 | 20.8 | 0 | — | — | `NIVO`. Same white span |
| 9 | `8476b91e` | line | 273.9 | 0 | 4 | 23.8 | 0 | — | — | White header divider, stroke 1 mm |
| 10 | `76ae118c` | line | 128.6 | 0 | 4 | 23.8 | 0 | — | — | White header divider, stroke 1 mm |
| 11 | `b52e58cc` | text | 130.1 | 26.39 | 45.69 | 28.63 | 0 | `address` | `ga_regal_letter` | Designed `A`. Black 34.95, span size 34.9 |
| 12 | `3a8da68e` | text | 196 | 26 | 57.76 | 28.63 | 0 | `address` | `ga_regal_number` | Designed `011` |
| 13 | `f5f9b482` | text | 289 | 26 | 57.76 | 28.63 | 0 | `address` | `ga_nivo` | Designed `001` |
| 14 | `b4f1e589` | arrow | 388.3 | 28.1 | 24.32 | 23.54 | **90** | *(see below)* | *(see below)* | `arrowKind: line`, black fill |
| 15 | `cedf9b20` | line | 128.6 | 23.87 | 4 | 31.15 | 0 | — | — | Black column rule, stroke 0.5 mm |
| 16 | `c474c74f` | line | 273.9 | 23.7 | 4 | 31.15 | 0 | — | — | Black column rule |
| 17 | `1b28cfb2` | line | 408.42 | 53.4 | 4 | 408.24 | **90** | — | — | Bottom rule drawn as a rotated bbox |

### Arrow: stored vs printed

Stored library element 14 has **no binding and no transform**. Rotation 90 means the designed polygon (points right) paints down.

`repairDirectionArrows` sees one unbound arrow and one arrow column and patches:

- `binding: "arrow"`
- `transform: "arrow"`
- `content: "DOWN"` (from rotation, because stored content is empty)

At draw time `displayPose` keeps that pose when the resolved value is `DOWN` (or empty). `UP` rotates 180° around the visual center and does **not** write the new rotation back into the template.

That pose rule is generic element semantics. It must not become `if template == GA Address`.

---

## 3. Transforms

Named, deterministic, version 1 of the LABELATOR functions in `src/lib/format.ts` and `src/lib/resolve.ts`. No JavaScript is executed from the package.

### `parseGaAddress` (shared)

1. Trim, then strip trailing `%`.
2. Empty → all fields empty.
3. If the value does not contain exactly two dots, the whole string is magacin.
4. If the first segment ends with a letter, magacin is the stem, regal letter is that letter uppercased, then shelf and level.
5. Otherwise magacin is the first segment, regal letter is empty, then shelf and level.

| Name | Result | Extra render rule |
| --- | --- | --- |
| `ga_magacin` | field 1 | If length > 1 and the first character is `R`/`r`, paint that character `#FF0000` (`gaMagacinPrefixSpans`) |
| `ga_regal_letter` | field 2 | — |
| `ga_regal_number` | field 3 | — |
| `ga_nivo` | field 4 | — |
| `arrow` | `UP` or `DOWN` (`parseArrow`; empty stays empty at resolve time, so pose stays designed) | `displayPose` may rotate a bound vector arrow 180° |

`part_number` is not used on this template. It stays in the shared registry because A3 Warehouse uses it.

---

## 4. Already supported before this proof

- Package load (`manifest.json`, `template.json`, fonts, empty asset index)
- Binding lookup, aliases, `fallbackBinding` (barcode → address)
- Hidden elements skipped
- Rect, line, text, rotation around top-left, negative coordinates
- Span transfer and per-run layout (header white 21.6 mm type)
- `part_number` (unused here)
- Code39 (unused here)
- Font checksums and WOFF/TTF embed from the package

## 5. Missing generic capabilities found by this template

| Capability | Why it is generic |
| --- | --- |
| Code128 encoder + same probe/blit path as Code39 | symbology field, not a template id |
| `ga_magacin` / `ga_regal_letter` / `ga_regal_number` / `ga_nivo` | named transforms already in `requiredTransforms` |
| Leading-R span on `ga_magacin` | side effect of that transform name |
| Single `arrow` polygon (`arrowKind`, including `line`) | element type |
| `arrow` transform + `displayPose` | binding + transform + rotation |

## 6. What belongs in the package (not in renderer branches)

- Page, sheet, elements, bindings, transforms, spans, barcode symbology
- Font binaries: Artifakt Element 400, Artifakt Element 700, Artifakt Element Black 700
- `requiredTransforms`: `arrow`, `ga_magacin`, `ga_nivo`, `ga_regal_letter`, `ga_regal_number`
- Data contract for `address`, `arrow`, `barcode`
- Empty asset index (no visible asset-folder images)

Template id, catalog id, and folder id may appear under optional `manifest.labelator`. The renderer must ignore them.

## 7. Must not become renderer branches

- Template id `0a9b4a95-…`
- Catalog id `ga_warehouse_a3`
- Folder id `655d6e1b-…`
- Template name `GA Address`
- Hard-coded coordinates, labels (`MAGACIN` / `REGAL` / `NIVO`), or sample values (`HB1`, `011`)
- A function named `render_ga_address`

Those strings may appear in golden fixtures, the export helper, and this spec.

## 8. Package format

No new format field was required. The existing contract already carries transforms by name, fonts by family/weight, and barcode symbology on the element.

Limitations discovered, not fixed with a one-off field:

- Transform *implementations* are not embedded (by design: no JavaScript). `requiredTransforms` names them. Version 1 of those names is this spec plus `src/lib/format.ts`.
- Visible `imageDataUrl` paths are not auto-bundled. This template's only `imageDataUrl` is hidden, so standalone rendering does not need that PNG.
- Load-time repairs are not re-run by the renderer. The exporter applies `repairTemplateDocument` so the package matches print. A renderer must not guess repairs from a template name.

## 9. Golden rows

See `tests/fixtures/ga_address_golden.json`.

| Row | address | arrow | barcode | Exercises |
| --- | --- | --- | --- | --- |
| 1 | `HB9A.011.001` | DOWN | same | catalog example, designed pose |
| 2 | `RHB9A.012.003` | UP | empty | red R, fallback barcode, flipped arrow |
| 3 | `X.1.2` | empty | empty | short, empty magacin, empty arrow stays designed |
| 4 | `123456789.011.001` | DOWN | same | long magacin, empty letter |
| 5 | `NOT-AN-ADDRESS` | UP | `PLAIN-39` | non-address string, independent barcode |
| 6 | `HB1A.011.001%` | DOWN | empty | trailing `%` stripped; magacin matches designed `HB1` |
