# Laberator / Labelator — current-state briefing

This document is a handoff for another AI (or person) who has no prior chat context. It describes the product **as it exists today**, not a roadmap.

**Repo folder:** `Laberator`  
**UI name:** **Labelator** (“Print labels”)  
**Status:** local web app, actively used to design warehouse labels and print A3/A4 sheets.

---

## What it is

Labelator is a **label studio**: pick or draw a template, bind fields to columns, fill one row per sticker, print or download a PDF.

It is **not** a general graphic-design tool, a cloud SaaS, or a printer-driver. It is a browser app for **plant / warehouse labels** (MAGACIN / REGAL / NIVO addresses, part numbers, barcodes, packaging photos). The seeded library is oriented around **Stellantis Kragujevac** workflows and older Seagull-style layouts.

Daily path:

1. **Templates** — choose or organize a label.
2. **Designer** — draw and bind the layout.
3. **Print** — fill a spreadsheet (or load Excel), preview, print/download PDF.
4. **Assets** — photos used when a column value should pick an image by filename.

---

## Tech snapshot

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript, Tailwind |
| Canvas | Konva / react-konva, coordinates in **millimetres** |
| State | Zustand |
| Persistence | IndexedDB (`labelator`) + disk backup `data/library.json` via `PUT /api/library` |
| Assets | Separate IndexedDB (`labelator-assets`); seed files under `public/assets/` |
| Excel | `xlsx` |
| PDF | `pdf-lib` + fontkit (embedded Google/local fonts) |
| Codes | JsBarcode (Code 128 / EAN-13 / Code 39), `qrcode` |

There is **no login, no multi-user sync, no backend database**. IndexedDB is source of truth in the browser; `library.json` is a best-effort backup so templates survive browser wipes if the file is kept.

**Important for code changes:** this Next.js version differs from older training data. Read `node_modules/next/dist/docs/` before changing app/routing conventions. `AGENTS.md` is auto-maintained by `next dev`.

There are **no automated tests**.

---

## Surfaces (what the user actually sees)

Sidebar nav (only these four):

| Route | Role |
| --- | --- |
| `/templates` | Library of templates in folders |
| `/designer` | Visual editor for the current template |
| `/print` | Data grid + live preview + print/PDF |
| `/assets` | Image library (folders, upload, lookup) |

`/` redirects to `/templates`.

**Leftover routes (not in the sidebar, still in code):**

- `/data` — older Excel download/upload + column mapper
- `/generate` — older n-up sheet / PDF page

Print now covers the intended daily data + sheet + PDF flow. Treat `/data` and `/generate` as legacy unless asked to revive them.

JSON **import** still exists in the store (`importDocument`). Export PDF / Export JSON were **removed from the Templates card menu**. Designer still has a **PDF** button (one label, preview/example data — not the Print sheet).

---

## 1. Templates

- Seeded catalog copies live in folders named after catalog **groups** (Warehouse, OVS, HBC, Canopy, GA, Starter) plus **My templates**.
- User can create folders, rename/delete folders, drag templates between folders.
- Per card: thumbnail (designed content, not live Print data), **Print**, **Edit**, menu: Duplicate, Rename, Move, Delete.
- New blank label: size presets (50×30 mm, 100×50, A6, A4, A3 landscape, custom, …).
- Catalog templates carry `catalogId` + `catalogRevision`. Bumping `CATALOG_REVISION` in `src/lib/catalog.ts` can **replace** seeded copies that still have an older revision — do not bump casually or customized GA/warehouse layouts get wiped.

---

## 2. Designer

Konva canvas of one label. Tools:

- Select, rectangle, ellipse, line
- Text, barcode, QR, image
- Polygons: arrow, double arrow, triangle, diamond, star, hexagon, plus, cross

Editing:

- Drag, resize, rotate **around visual center** (object stays in place at 90/180/270)
- Align, snap/spacing guides
- Group / ungroup
- Layers (show/hide/lock, reorder)
- Undo/redo, copy/paste/duplicate, zoom, fit
- Autosave + explicit Save
- Fonts: local **Artifakt Element** / **Artifakt Element Black** (plant look), many Google fonts, system fallbacks
- Per-character color/size spans (e.g. red `R` prefix on magacin, red digit groups in part numbers)
- Inspector: geometry, fill/stroke, text style, **bind to column**, image folder lookup, arrow UP/DOWN, **Address part** (magacin / regal letter / number / nivo)

Designer preview uses the template’s **column example values**, **not** the Print spreadsheet. Thumbnails use designed `content` with no row. Those two views can differ (e.g. designed `HB1` vs example `HB9A.011.001` → `HB9`).

---

## 3. Print

Three panes: template list, **live label preview**, **spreadsheet**.

- Grid columns come from the template schema (`dataColumns` + element bindings). Header aliases are supported (Excel `PAKOVANJE (MDR)` maps to `packaging`, etc.).
- Type in cells, paste, undo/redo data, Load Excel.
- One filled row → one label on the sheet.
- **Paper setup** before print/download: print one label per page, or n-up on A4/A3/Letter (portrait/landscape), columns/rows/gap/margin. Catalog templates already know typical packing (e.g. GA Address ×3 on A3 landscape, Dual ×2).
- PDF matches the canvas (mm, fonts, barcodes, bound images, arrow flip).

Print grid is **isolated from Designer**: editing cells does not rewrite the template; Designer does not read the grid.

---

## 4. Assets

- Folders and **subfolders**; upload images; rename; move; delete with confirm.
- Seeded **packaging** folder: photos under `public/assets/packaging/` (binaries gitignored; `manifest.json` kept). Uploads go to IndexedDB blobs.
- An **image element** can bind:
  - a **column** (e.g. packaging code `X4202`)
  - an **Assets folder**
- At print time the cell value looks up a file by **stem**, case-insensitive, extension ignored (`X4202` → `X4202.jpg`). Folder bind also searches **descendants**.

---

## Document model (what a template is)

A `LabelDocument` is:

- `page` size in mm
- optional `sheet` (how many labels fit on A3/A4)
- `elements[]` (type, x/y/w/h/rotation, style, content, binding, transform, …)
- optional `dataColumns[]` (key, label, Excel header aliases, example, allowed values)
- optional `catalogId` / `catalogRevision` / `folderId`

**Bindings:** element `binding` is a column key. Optional `fallbackBinding` (barcode falls back to address).

**Transforms** (how one cell becomes several drawn parts):

| Transform | Meaning |
| --- | --- |
| `ga_magacin` / `ga_regal_letter` / `ga_regal_number` / `ga_nivo` | Split `HB9A.011.001` → HB9 / A / 011 / 001 |
| `arrow` | Cell UP/DOWN (also GORE/DOLJE, arrows). Vector arrows **rotate +180° in place** when live data differs from the designed direction. Image arrows swap `UP`/`DOWN` files. |
| `part` + `partIndex` | Slice a formatted part number into groups |
| `barcode_pct` | Ensure trailing `%` |

GA magacin: a leading **R** is painted red (`RHB1`).

**Do not duplicate MAGACIN and leave `transform: ga_magacin` on letter/number/nivo.** Live preview then shows the warehouse code in every column. Hydrate repairs that from designed content + x-order; inspector **Address part** is the manual control. Dual labels use `address_top` / `address_bot`.

---

## Seeded catalog (starter templates)

Defined in `src/lib/catalog.ts`:

| Group | Templates |
| --- | --- |
| Warehouse | Warehouse A3, CDC A3 |
| OVS | OVS A3, OVS A3 dual |
| HBC | HBC A4 shelf |
| Canopy | 1 / 2 / 3 part-number A3, Složivost A4 |
| GA | GA warehouse A3 (MAGACIN/REGAL/NIVO), Dual (UP over DOWN), FIXED GA A3/A4 |
| Starter | Sample shipping 100×50 mm |

Users have **customized** several copies (especially GA Address / Dual): headers redrawn as rects+text, vector arrows instead of PNGs, packaging photo binds. Customized copies in IndexedDB/`library.json` are the live templates; the catalog is the seed.

---

## Persistence rules (easy to get wrong)

1. Browser **IndexedDB** holds documents + print grid + folders.
2. On hydrate, merge IDB + `data/library.json`, seed catalog if empty, collapse duplicate catalog copies, run repairs (`bindFolderImages`, `repairGaAddressFields`).
3. Debounced persist writes IDB and `PUT /api/library`.
4. Deleted template/catalog/folder IDs are remembered so seed does not resurrect them.
5. Asset blobs are **not** inside `library.json`.

`data/library.json` may be gitignored for the live copy. Do not assume git is the user’s template store.

---

## What is already solid

- End-to-end: template → bind → Excel/grid → n-up PDF
- Warehouse-style layouts with barcodes, Artifakt, red prefixes
- GA address parsing and dual UP/DOWN arrows that flip in place
- Packaging photo lookup by SKU/code filename
- Template folders, duplicate/rename, local autosave
- Designer comparable to a small label DTP (shapes, type, layers, mm)

## What is not built (or only half-built)

- Accounts, sharing, server-side template library for a team
- Direct CUPS/Zebra/driver integration (browser print dialog on a PDF)
- Full JSON round-trip in the Templates UI (code remains, UI removed)
- `/data` and `/generate` as first-class UX
- Automated tests, CI product checks
- Multi-language UI (label *content* is often Serbian: MAGACIN, REGAL, NIVO, Složivost)

---

## How to give useful next inputs

Ask for **one job**, not a redesign. High-value directions that fit the current app:

- New plant templates (say paper size, how many per sheet, Excel column names, sample row)
- Print UX (grid, Excel mapping, missing columns, copies)
- Designer UX (tools, inspector, snap, text)
- Assets (more folders, naming rules, missing-image behavior)
- Reliability (save, backup, catalog vs user edits)
- Production (deploy, fonts, packaging images on a shared machine)

When requesting a template or print change, include:

1. Paper (A3 landscape / A4 / label size in mm)
2. How many stickers per sheet
3. Excel headers as they really appear
4. One example row
5. Which fields split (full address vs magacin/letter/number/nivo)
6. Whether arrows or photos must change per row

---

## Key source files

| Area | Path |
| --- | --- |
| Catalog seeds | `src/lib/catalog.ts` |
| Document + transforms + GA repair | `src/lib/document.ts` |
| Bindings / resolve | `src/lib/resolve.ts`, `src/lib/format.ts` |
| App state | `src/lib/store.ts` |
| Print grid | `src/lib/grid.ts`, `src/lib/excel.ts` |
| PDF | `src/lib/pdf.ts` |
| Templates UI | `src/components/templates/templates-view.tsx` |
| Designer | `src/components/designer/*` |
| Print UI | `src/components/print/*` |
| Assets | `src/lib/assets.ts`, `src/components/assets/assets-view.tsx` |
