# `.labelator` v1 package contract

**Status:** frozen. This is the authoritative v1 contract for a third-party renderer. It describes what the exporter emits and what the Python renderer consumes. It does not add capabilities.

**Format id:** `labelator.package`  
**Format version:** `1`  
**Template envelope:** `labelator.template` schemaVersion `1`

Independent of `CATALOG_REVISION` and of any template id.

Related proofs: [acceptance](./LABELATOR_PORTABLE_RENDERER_ACCEPTANCE.md), [coverage](./LABELATOR_PORTABLE_RENDERING_COVERAGE.md), [Python renderer](./LABELATOR_PYTHON_RENDERER.md), [developer integration](./LABELATOR_DEVELOPER_INTEGRATION.md).

Entry point:

```text
render(template_package, data, output_pdf)
```

The renderer must not branch on template id, catalog id, folder id, or template name.

---

## 1. Package

A `.labelator` file is a **store-only ZIP** (compression method 0, forward-slash paths). Deflate entries are rejected.

Required members:

| Path | Required | Role |
| --- | --- | --- |
| `manifest.json` | yes | Package identity, print job, font index, data contract, asset summary |
| `template.json` | yes | Canonical declarative `LabelDocument` |
| `assets/index.json` | yes | Asset lookup. Collections may be empty |
| `fonts/<file>` | yes for every `manifest.fonts[].path` | Font bytes |
| `assets/<file>` | yes for every `assets/index.json` entry | Image bytes |

`fonts/` and `assets/` exist even when a given package has no binaries in that directory. An unpacked directory with the same tree is an equivalent input. Production rendering must not read LABELATOR, IndexedDB, `data/library.json`, public runtime assets, or the network.

---

## 2. Manifest

Emitted fields only. Do not invent others.

| Field | Type | Required | Meaning | Authoritative for drawing? |
| --- | --- | --- | --- | --- |
| `format` | `"labelator.package"` | yes | Package kind | gate |
| `formatVersion` | `1` | yes | This contract | gate |
| `exportedAt` | ISO string | yes | Export clock | no — metadata |
| `packageName` | string | yes | Artifact label, not a renderer key | no — metadata |
| `template.name` | string | yes | Display name | no — metadata. Do not branch on it |
| `template.templateVersion` | string | yes | Package version string. Not `CATALOG_REVISION` | no — metadata |
| `template.page` | `{ widthMm, heightMm }` | yes | Label size summary. Must match `template.json` `document.page` | yes, as the summary of label size |
| `template.sheet` | sheet object | optional | Sheet geometry copy, present only if the document has `sheet` | geometry only. Does **not** turn packing on |
| `template.elementCount` | number | yes | `document.elements.length` | informational check |
| `fonts` | font entry[] | yes (may be empty only if the document has no text families) | Packaged faces | yes |
| `print` | `{ mode: "label" \| "sheet" }` | optional | Print job | **yes.** Absent means `label` (one sticker per page at `document.page`). `sheet` imposes slots from `document.sheet` |
| `requiredTransforms` | string[] | yes | Transform names used by elements, sorted | yes — renderer must implement each name or refuse the package |
| `dataContract` | `{ fields: field[] }` | yes | Portable input keys and aliases | yes for binding lookup |
| `assets` | `{ indexPath, collections[] }` | yes | Summary. `indexPath` is always `"assets/index.json"` | the index file is authoritative; this block is a summary |
| `labelator` | object | emitted today, ignore | Studio ids | **no. Third parties must ignore this block** |

`template.sheet`, when present:

| Field | Type | Meaning |
| --- | --- | --- |
| `pageSize` | `"A4" \| "A4-landscape" \| "A3" \| "A3-landscape" \| "letter"` | Paper |
| `columns` | number | Requested columns |
| `rows` | number | Requested rows |
| `gapMm` | number | Gap between stickers |
| `marginMm` | number | Minimum margin used when testing fit. Slot origins are centered on the paper |

Font entry:

| Field | Type | Required | Authoritative? |
| --- | --- | --- | --- |
| `family` | string | yes | yes |
| `weight` | `400` or `700` | yes | yes. `bold` → 700, otherwise 400 |
| `path` | package-relative, under `fonts/` | yes | yes |
| `format` | `"otf" \| "ttf" \| "woff"` | yes | yes |
| `sha256` | hex | yes | yes — reject a mismatch |
| `source` | string | optional | no — provenance only |

Data field:

| Field | Type | Required | Authoritative? |
| --- | --- | --- | --- |
| `key` | string | yes | yes — preferred input name |
| `label` | string | optional | lookup alias |
| `aliases` | string[] | yes | yes — case-insensitive equals |
| `required` | boolean | yes | contract flag. The renderer still paints a blank if a live cell is empty |
| `example` | string | optional | no — sample only |
| `elementBindings` | string[] | yes | binding strings on elements that resolve to this field |

Asset summary collection: `id`, `entryCount`, optional `labelatorAssetFolderId`. The folder id is traceability. Do not require it to render.

### Safe to ignore

`labelator` (`templateId`, `catalogId`, `catalogRevision`, `folderId`, `documentVersion`, `exportScope`), `exportedAt`, `packageName`, `template.name`, `template.templateVersion`, `fonts[].source`, `assets.collections[].labelatorAssetFolderId`.

A renderer that keys behavior off those fields is outside this contract.

---

## 3. `template.json`

Declarative interchange. Not executable code. Not a Konva dump. Version history is stripped.

```json
{
  "schemaVersion": 1,
  "kind": "labelator.template",
  "exportedAt": "...",
  "exportScope": "working",
  "document": { }
}
```

`document` is the canonical `LabelDocument`. Draw from it. `schemaVersion` and `kind` are gates. `exportedAt` and `exportScope` are metadata.

### Document fields used for drawing

| Field | Role |
| --- | --- |
| `page.widthMm`, `page.heightMm` | Label size. Authoritative geometry |
| `sheet` | Sheet geometry. Used only when `manifest.print.mode` is `"sheet"` |
| `elements` | Paint order (array order). Hidden elements stay in the array and are not painted |
| `dataColumns` | Column keys, labels, header aliases used during lookup |

Informational, not renderer keys: `id`, `name`, `catalogId`, `catalogRevision`, `folderId`, `description`, `favorite`, timestamps, `version`, `locked`, `groupId`.

### Element

| Field | Role |
| --- | --- |
| `type` | `rect`, `line`, `arrow`, `doubleArrow`, `text`, `barcode`, `image`, or an unsupported type the renderer must refuse |
| `x`, `y`, `width`, `height` | Millimetres. Origin top-left. Y down |
| `rotation` | Degrees, clockwise, around the element's top-left before an arrow pose adjustment |
| `style` | See below |
| `content` | Designed sample. Painted only when the element is unbound, or there is no live row |
| `spans` | `{ start, end, fill?, fontSizeMm? }` ranges on the designed sample, remapped onto the live string |
| `binding` | Primary data field |
| `fallbackBinding` | Used only if the primary value is empty |
| `transform` | Named transform. Must appear in `requiredTransforms` |
| `assetFolderId` | LABELATOR folder id. Portable lookup uses `assets/index.json`, not this string |
| `imageFit` | Omitted means stretch. Non-stretch fit is not in the v1 renderer |
| `hidden` | Skip if true |
| `partIndex` | Not implemented. A package that needs it is outside v1 |

Style fields the v1 renderer reads when present: `fill`, `stroke`, `strokeWidth`, `opacity`, `fontFamily`, `fontSizeMm`, `fontWeight`, `align`, `verticalAlign`, `letterSpacingMm`, `lineHeight`, `barcodeSymbology`, `barcodeDisplayValue`, `arrowKind`, `direction`.

`cornerRadiusMm`, `strokeStyle`, `dashMm`, `gapMm`, QR `background` / `paddingMm` may appear on a document. v1 does not implement non-zero corner radius, dashed or dotted strokes, or QR. A value of `cornerRadiusMm: 0` is a square and is in use.

Barcode definition is an element of type `barcode` plus `style.barcodeSymbology` (`code128` or `code39`) and `style.barcodeDisplayValue` (golden packages set this false). Size is the element box. Symbology options other than those two are outside v1.

---

## 4. Assets

```text
row value
    ↓
stem = lowercase, strip a trailing image extension
    ↓
collection id (image binding's data-column key; packaging bindings use "packaging")
    ↓
assets/index.json collections[].entries[stem]
    ↓
file under assets/
```

Validated convention (Warehouse A3): collection `packaging`, entry `"x4202"` → `packaging/X4202.jpg`. Other validated packages have an empty collection list. `labelatorAssetFolderId` is optional metadata.

Default fit when `imageFit` is omitted: **stretch**.

---

## 5. Fonts

Resolve `style.fontFamily` + weight from `manifest.fonts` and load that package path. Verify `sha256`. Do not load system fonts. Do not call Google Fonts.

WOFF bytes may be converted to TTF for the PDF library. Conversion must not re-hint or substitute a different family. The current Python path uses fontTools flavor stripping.

Faces packaged by the frozen templates:

| Family | Weight | File | Format | sha256 |
| --- | ---: | --- | --- | --- |
| Artifakt Element | 400 | `fonts/ArtifaktElement.ttf` | ttf | `d5401345e81f7bc5ae84069fb672e3b748aca6fcf960b038ab69239dd999c3e0` |
| Artifakt Element | 700 | `fonts/ArtifaktElement-Bold.ttf` | ttf | `387da516614a6aa2377fc490a17ca5a1b39a433229a51953b88a6827f0aced9e` |
| Artifakt Element Black | 400 and 700 | `fonts/ArtifaktElement-Black.otf` | otf | `7dfc3190a75f7d45baee0ee4d12b584260c10fc680c60a0c72cb1b7f5e1ab12d` |
| Open Sans | 400 | `fonts/OpenSans-Regular.woff` | woff | `bb0f7ed88b00741288cfa77ef7e38f5750e9bbe43fda8e37871ad4f281b8d28c` |
| Open Sans | 700 | `fonts/OpenSans-Bold.woff` | woff | `a5e0231dc766d482a977e9cdd931bf26eb1cc1d19617bfe33600fdda94602437` |
| Inter | 700 | `fonts/Inter-Bold.woff` | woff | `52026705fdc61b964e77937b199b9888c8200281b81cffff648c54f8d9e98e79` |

Artifakt Element Black uses the same file for 400 and 700. Not every package includes every row. A package includes the weights its text elements declare, including a hidden element.

---

## 6. Rendering capability

Only what the Python renderer draws. A TypeScript type is not support.

| Capability | Class |
| --- | --- |
| Text, including spans, alignment, letter spacing | SUPPORTED + GOLDEN VALIDATED |
| Rectangle, including a 0 corner radius | SUPPORTED + GOLDEN VALIDATED |
| Line | SUPPORTED + GOLDEN VALIDATED |
| Image, stretch fit, asset-index lookup | SUPPORTED + GOLDEN VALIDATED |
| Arrow and double arrow (`triangle` and `line` kinds used live) | SUPPORTED + GOLDEN VALIDATED |
| Other arrow kinds (`block`, `barbed`, `chevron`, `pentagon`, `open`) | SUPPORTED + NOT YET GOLDEN VALIDATED |
| Triangle, diamond, star, hexagon, plus, cross | UNSUPPORTED + CURRENTLY UNUSED |
| Ellipse | UNSUPPORTED + CURRENTLY UNUSED |
| QR | UNSUPPORTED + CURRENTLY UNUSED |
| Barcode Code39 | SUPPORTED + GOLDEN VALIDATED |
| Barcode Code128 | SUPPORTED + GOLDEN VALIDATED |
| Barcode EAN-13 | UNSUPPORTED + CURRENTLY UNUSED |
| Barcode human-readable text (`barcodeDisplayValue: true`) | SUPPORTED + NOT YET GOLDEN VALIDATED |
| `part_number` | SUPPORTED + GOLDEN VALIDATED |
| `barcode_pct` | SUPPORTED + GOLDEN VALIDATED |
| `ga_magacin`, `ga_regal_letter`, `ga_regal_number`, `ga_nivo` | SUPPORTED + GOLDEN VALIDATED |
| `arrow` transform and 180° pose | SUPPORTED + GOLDEN VALIDATED |
| `part` / `partIndex` | UNSUPPORTED + CURRENTLY UNUSED |
| Artifakt Element, Artifakt Element Black, Open Sans, Inter | SUPPORTED + GOLDEN VALIDATED |
| 1-up (`print` absent) | SUPPORTED + GOLDEN VALIDATED |
| Sheet packing (`print.mode` = `sheet`) | SUPPORTED + GOLDEN VALIDATED |
| Non-zero corner radius, dashed/dotted stroke, image fit other than stretch, visible `imageDataUrl` not bundled in the package | UNSUPPORTED + CURRENTLY UNUSED |

---

## 7. Data

`data` is a list of row objects. Keys are external. They are not template ids.

Lookup, in order, case-insensitive:

1. The element `binding`, matched to a row key, a `dataContract` key, a column label, or an alias.
2. If that value is empty, the same lookup on `fallbackBinding`.
3. Apply `transform` to the chosen string.
4. If the row is live and the element is bound, an empty result paints nothing. Designed `content` is not a fallback for an empty live cell.
5. If there is no live row, or the element has no binding, paint `content`.

`barcode_pct` changes the barcode payload only. Asset lookup uses the resolved string as a stem. An empty stem draws no image.

Example rows from the golden fixtures (shape only; any package uses its own keys):

```json
{ "reference": "7358042350", "warehouse_code": "WG6.99.123", "packaging": "X4202", "barcode": "WG6.99.123" }
```

```json
{ "address": "RHB9A.012.003", "barcode": "", "arrow": "DOWN" }
```

```json
{ "barcode": "", "warehouse_code": "CDCNN.99.007" }
```

An empty `barcode` with a fallback uses the fallback, then the transform. `"0"` becomes `"0%"`. `"100%"` stays `"100%"`. `""` with an empty fallback draws no barcode.

---

## 8. Transforms

Named. Versioned by presence in `requiredTransforms` and by this contract (v1). Unknown names are an error. None of them read a template id.

| Name | Input | Output | Empty | Affects |
| --- | --- | --- | --- | --- |
| `part_number` | string | Trim. Four whitespace groups (hyphens count as spaces) stay four groups. Else digits only; 9 digits gain a leading `0`; 10 digits → `AA BBB CCC DD`; 11 → `AA BBB CCC DDD`; otherwise the trimmed original | `""` | payload, then designed spans remap onto it. Not geometry |
| `barcode_pct` | string | Trim. If it already ends with `%`, unchanged. Else append one `%` | `""` — barcode not drawn | payload only. Not width, height, scale, or symbology options |
| `ga_magacin` | address | See address split | `""` | payload. A value whose first character is `R` and that has more than one character also gets a leading span fill `#FF0000` |
| `ga_regal_letter` | address | letter, uppercased | `""` | payload |
| `ga_regal_number` | address | shelf token | `""` | payload |
| `ga_nivo` | address | level token | `""` | payload |
| `arrow` | string | Text elements become `▲` or `▼`. Other elements become `UP` or `DOWN`. If the live direction disagrees with the designed direction, the element rotates 180° around its center | no direction → treat as `DOWN` for a non-empty token; a blank live value does not flip | payload, and geometry when the direction disagrees |

Address split (`HB9A.011.001`, optional trailing `%` stripped first):

- Three dot-separated parts required. Otherwise the whole string is magacin and the other fields are empty.
- If the first part ends in a letter, that letter is the regal letter and the rest is magacin.
- Second part is the regal number. Third is nivo.

Arrow tokens, case-insensitive: up is `UP`, `↑`, `▲`, `U`, `GORE`. Down is `DOWN`, `↓`, `▼`, `D`, `DOLJE`. Any other non-empty token is down.

`part` and `partIndex` are not in v1.

---

## 9. Print and sheet

Coordinates are millimetres. Origin is the top-left of the page or of the slot. Y increases downward. Rotation is clockwise around the element's top-left, in the same space. A PDF library that is Y-up must convert. The frozen Python renderer uses PyMuPDF, which is Y-down, and does not flip the page.

Label size is `document.page`. Paper size, when sheet mode is on, comes from `sheet.pageSize`:

| `pageSize` | mm |
| --- | --- |
| `A4` | 210 × 297 |
| `A4-landscape` | 297 × 210 |
| `A3` | 297 × 420 |
| `A3-landscape` | 420 × 297 |
| `letter` | 215.9 × 279.4 |

Sheet packing runs only when `manifest.print.mode` is `"sheet"`. `document.sheet` without that flag does not pack. Warehouse A3 and GA Address carry a sheet object and still print 1-up because `print` is omitted. FIXED GA A4 sets `print.mode` to `sheet`.

Slot origins: fit the label inside the paper after `marginMm`, honor `gapMm`, clamp requested columns and rows to what fits, then center the used block on the paper. Fill slots row-major, left to right, top to bottom. A label that does not fit is an error, not a scaled page.

Overflow: a live string longer than the designed sample shrinks to the box width, then may still clip at the element box. Golden pages that clip do so on both the reference and the Python PDF. That clip is accepted behavior, not a template exception.

---

## 10. Reference comparison

The LABELATOR reference PDF and the Python PDF are not required to be byte-identical.

Accept when physical geometry, payload, bindings, transforms, and placement match, confirmed by 150 dpi raster comparison and visual inspection of side-by-side images.

Residual difference on the frozen set is font rasterization and anti-aliasing between pdf-lib and PyMuPDF. It is not a per-template renderer failure. GA Address and the empty CDC page are raster-identical, which is the check that geometry can match exactly when the fonts already agree.

A PyMuPDF `FT_New_Memory_Face … unknown file format` line while rasterizing a pdf-lib WOFF subset is a diagnostic. It does not appear on the Python PDF and does not blank glyphs. It is not a reason to change v1 typography.

---

## 11. Acceptance test

Given only `template.labelator` and row data, `render` produces the PDF with no LABELATOR process, no IndexedDB, no `data/library.json`, no public asset directory, no internet, no Google Fonts, and no knowledge of which template id produced the package.

ZIP and unpacked directory must raster-match. A blocked network socket must not change the result.

Proof: [LABELATOR_PORTABLE_RENDERER_ACCEPTANCE.md](./LABELATOR_PORTABLE_RENDERER_ACCEPTANCE.md).

---

## 12. Compatibility is derived

v1 does not add a compatibility field. A caller inspects `template.json`, `manifest.print`, `manifest.fonts`, `assets/index.json`, and the document requirements, then compares them with a renderer profile. A future format version can formalize that metadata. Product UI and `npm run audit:renderer-compatibility` do this outside the package. See [developer integration](./LABELATOR_DEVELOPER_INTEGRATION.md).
