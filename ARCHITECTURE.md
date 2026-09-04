# LABELATOR Architecture

**Status:** Phase 1, Phase 1.5, Phase 2 (Shopify demo), and Phase 3 (Industrial integration foundation / template JSON export) implemented. Real Shopify OAuth/API is not started.  
**Date:** 2026-09-04  
**Scope:** documentation of the repository, two product editions sharing one label engine, Phase 1–3 status, and readiness notes for real Shopify and external template interchange.

This document was written after inspecting the current Labelator codebase (Next.js 16 App Router, React 19, Zustand, IndexedDB, catalog, Designer, Generate/Print, Assets, workspace/roles, Auth.js/SQLite cloud stubs, GitHub Pages static export). Phase 1 followed the approved product decisions in this file. Do not start Phase 2 from this document without a separate implementation task.

---

## 0. Document purpose

LABELATOR should become **one product with two editions**, not two independent applications:

```
                    LABELATOR
                        |
             +----------+----------+
             |                     |
      INDUSTRIAL EDITION     SHOPIFY EDITION
             |                     |
             +----------+----------+
                        |
                  SHARED CORE
                        |
       +----------------+----------------+
       |                |                |
    Designer        Templates        Generation
    Rendering       Bindings         Validation
    PDF/Print      Documents         Barcodes
    Assets         Versioning        QR
```

Industrial is the **current production product** (Stellantis Kragujevac warehouse labels). Shopify is a **future edition**. Both must consume the same `LabelDocument`, Designer, binding resolver, validation, and PDF/print pipeline.

---

## 1. Current system (as inspected)

### 1.1 Product identity

| Item | Current value |
| --- | --- |
| UI name | Labelator |
| Repo folder | `Laberator` |
| npm name | `labelator` (`package.json`) |
| Live Industrial demo | GitHub Pages at `/liberator` |
| Primary customer today | Stellantis Kragujevac warehouse / plant labels |
| Daily path | Templates → Designer → Generate (Excel/grid) → PDF/print |

The app is a **label studio**, not a general drawing tool. Coordinates are millimetres. One filled data row becomes one sticker.

### 1.2 Stack (actual)

| Layer | Implementation |
| --- | --- |
| App | Next.js **16.3.1**, App Router, React **19.2.8**, TypeScript, Tailwind 4 |
| Canvas | Konva / `react-konva`, mm geometry |
| State | Zustand: `useAppStore` (`src/lib/store.ts`), `useAssetStore` (`src/lib/asset-store.ts`) |
| Persistence | IndexedDB `labelator` (`src/lib/db.ts`) + best-effort `data/library.json` |
| Assets | Separate IndexedDB `labelator-assets` (`src/lib/asset-db.ts`) |
| Excel | `xlsx` via `src/lib/excel.ts` |
| PDF | `pdf-lib` + fontkit (`src/lib/pdf.ts`); browser path rasters via Konva |
| Codes | JsBarcode (Code 128 / EAN-13 / Code 39), `qrcode` |
| Cloud (pilot, incomplete) | Auth.js (`next-auth` 5 beta) + Drizzle + `better-sqlite3` |
| Tests | **None** (no Jest/Vitest/Playwright scripts) |

Next.js 16 notes from `node_modules/next/dist/docs/`:

- File-system App Router: `page`, `layout`, `route` under `src/app/`.
- Typed root layout uses `LayoutProps<"/">` (`src/app/layout.tsx`).
- **Proxy** (`proxy.ts`) replaced Middleware in Next.js 16. This repo has neither.
- **Static export** (`output: 'export'`) supports Client Components and static `GET` Route Handlers. It does **not** support cookies, dynamic Route Handlers that read the request, Server Actions, rewrites/redirects/headers config, or Proxy.
- Route Handlers in a static export only emit static `GET` files. `PUT`/`POST` that need a Node server cannot ship on GitHub Pages.

`next.config.ts` enables `output: "export"` **only** when `GITHUB_PAGES === "true"`. Local `next dev` / `next build` is a Node app. GitHub Pages also sets `basePath` / `assetPrefix` to `/liberator` and `images.unoptimized: true`.

### 1.3 App Router (actual)

```
src/app/
  layout.tsx                    root layout + fonts
  page.tsx                      redirect → /templates
  login/page.tsx                local demo notice or cloud credentials
  (studio)/layout.tsx           AppShell sidebar
    templates/page.tsx
    designer/page.tsx
    generate/page.tsx           PrintView (daily generate/print)
    print/page.tsx              redirect → /generate
    data/page.tsx               redirect → /generate
    assets/page.tsx
    history/page.tsx
    settings/page.tsx
  api/library/route.ts          GET only, force-static
  api/cloud/login/route.ts      POST credentials (stubbed on static)
  api/cloud/session/route.ts    GET session (stubbed on static)
```

There is **no** Shopify code, **no** `/industrial` prefix, **no** `app/api/auth/[...nextauth]`. Auth.js `handlers` are exported from `src/server/auth.ts` but not mounted as a catch-all Auth.js route. Cloud login calls `signIn("credentials")` from `/api/cloud/login`.

Sidebar (`src/components/app-shell.tsx`): Templates, Generate, Designer, Assets, History, Settings. Role gates hide Designer/Assets/Settings for operators.

Leftover UI still in the tree, unused by routes:

- `src/components/generate/generate-view.tsx` — older n-up sheet UI
- `src/components/data/data-view.tsx` — older Excel mapper UI

`/generate` is the current Industrial generate/print surface. It renders `PrintView`.

### 1.4 Document model (already shared-shaped)

`LabelDocument` (`src/lib/document.ts`, `DOCUMENT_VERSION = 1`):

- `page: { widthMm, heightMm }`
- optional `sheet` (n-up packing on A3/A4/Letter)
- `elements[]` (`LabelElement`: type, mm box, rotation, style, content, binding, transform, …)
- optional `dataColumns[]` (`DataColumn`: key, label, Excel header aliases, example, required, values)
- optional `catalogId` / `catalogRevision` / `folderId`
- workspace metadata: `organizationId`, `createdBy`, `updatedBy`, `status`, `versionNumber`, `publishedVersionId`, nested `versions[]`

Element types: rect, ellipse, line, polygons, text, barcode, QR, image.

This type is already edition-agnostic **except** for:

- `ElementTransform` union (mostly Stellantis/GA/part-number)
- hydrate-time **repair** functions that encode plant templates by name/`catalogId`

Normalized row data already exists:

```ts
type DataRow = Record<string, string>;
type ColumnMapping = Record<string, string>;
```

in `src/lib/resolve.ts`. Designer, Generate, validation, and PDF all consume `DataRow` + `ColumnMapping` + `DataColumn[]`. They do **not** consume Excel workbooks or Shopify API objects directly at render time. Excel is already an adapter (`parseWorkbook` → headers/rows → `autoMapBindings` → `DataRow`).

### 1.5 Generation pipeline (actual)

```
Template (LabelDocument)
    + DataRow[] (grid or Excel-mapped)
    + ColumnMapping
        ↓
resolveValue() / applyTransform()     src/lib/resolve.ts
        ↓
evaluateGenerateRun()                 src/lib/run-status.ts
        ↓
generatePdf()                         src/lib/pdf.ts
        ↓
completeLabelJob() + activity         src/lib/jobs.ts, src/lib/activity.ts
```

PDF in the browser rasters Konva at print DPI and embeds PNGs. A vector `pdf-lib` path exists for non-DOM environments. Fonts, barcodes, QR, bound images, and GA arrow pose all run through this shared path.

### 1.6 Persistence / hydration (actual)

**Source of truth in the browser:** IndexedDB database `labelator` (documents + one `meta` blob).

**Best-effort backup:** `data/library.json` via `GET /api/library`. The Zustand store also `PUT /api/library`, but **the Route Handler has no PUT**. `writeLibraryFile()` exists in `src/lib/library-file.ts` and is unused by the route. Disk backup is therefore incomplete on current Node hosts, and impossible on GitHub Pages (static GET only).

Hydrate (`useAppStore.hydrate`):

1. Load IndexedDB documents + meta.
2. Fetch remote library (`/api/library` or `/library.json` on Pages).
3. Merge, remember deleted template/catalog/folder IDs.
4. Seed catalog **only if the library is empty**.
5. `collapseCatalogDuplicates`, `repairTemplateDocument`, `migrateWorkspace`.
6. Stamp missing `organizationId` with Stellantis.
7. Debounced persist back to IndexedDB.

**Catalog revision overwrite:** `refreshStaleCatalogDocuments()` in `src/lib/library.ts` replaces a stored copy when `doc.catalogRevision < CATALOG_REVISION[catalogId]`. This **wipes customized geometry**. Current revisions:

```
ga_warehouse_a3: 3
ga_warehouse_a3_dual: 3
fixed_ga_a3: 3
fixed_ga_a4: 3
```

`data/library.json` holds customized copies of those templates (and others). They are production/reference assets, not disposable seeds.

Assets: IndexedDB `labelator-assets` (folders, records, blobs, thumbs). Packaging photos seed from `public/assets/packaging/manifest.json`. Blobs are **not** in `library.json`.

### 1.7 Workspace / roles / demo (actual)

Domain (`src/lib/domain.ts`):

- Single seeded org: `org_stellantis_kragujevac` / “Stellantis Kragujevac”
- Roles: `admin` | `designer` | `operator`
- Plans already on `Organization`: `free` | `professional` | `business` | `enterprise` (unused commercially)
- Jobs: `LabelJob` with `sourceType: "manual" | "excel"` only
- Demo users: Demo Admin, Demo Operator (`src/lib/session.ts`)
- `WORKSPACE_MIGRATION_REV = 1`

Local mode (`NEXT_PUBLIC_LABELATOR_CLOUD` unset): no password. Settings can switch Demo Admin ↔ Demo Operator. Cloud mode: Auth.js credentials against SQLite (`data/labelator.db`). SQLite tables cover organizations, users, memberships, jobs, activity — **not templates, not assets, not grids**. Even “cloud” still hydrates templates from IndexedDB.

Isolation today is **filter-based** (`visibleTemplates`, `foldersInOrganization`, `jobsForOrganization`). Everything still lives in one IndexedDB. Filters treat missing `organizationId` as visible. Defaults stamp new records with `STELLANTIS_ORG_ID`. Hydrate sets `currentOrganizationId` to `organizations[0]` (Stellantis). **There is no second workspace yet.**

### 1.8 Industrial catalog (actual)

`src/lib/catalog.ts` is a **single global array**. Groups: Warehouse, OVS, HBC, Canopy, GA, Starter (`sample_shipping`). Starter already looks like a small product label (name + SKU + barcode + QR) but is seeded into the Industrial library.

Folders are derived from catalog **group names** plus “My templates” plus a recovered “Stellantis Kragujevac” folder for customized copies.

### 1.9 What is already shared vs already Industrial

**Already shared in practice** (Designer/PDF/store consume these without Excel or Stellantis APIs):

- `LabelDocument` / `LabelElement` / `TemplateVersion`
- mm units, Konva canvas, inspector (generic parts)
- `DataRow` + `DataColumn` + `binding` string keys
- `resolveValue` lookup/mapping
- barcode/QR/fonts/PDF/print raster
- folders, versions, jobs, activity **as generic records**
- asset folders + stem lookup
- IndexedDB persistence of documents

**Already Industrial-specific, mixed into shared files:**

- Entire `src/lib/catalog.ts`
- `ElementTransform` GA/part/`barcode_pct`/`arrow`
- `repairGaAddressFields`, `repairHbcDrawingNumbers`, `repairCanopySchema`, `repairFixedGaDualArrows`, `repairPartNumberFields`, `repairQtyFields` in `document.ts`
- `parseGaAddress`, grouped Stellantis part numbers in `format.ts`
- Excel as the only non-manual source (`excel.ts`, `loadWorkbook`, job `sourceType`)
- `STELLANTIS_ORG_ID` as default everywhere
- Packaging seed folder
- Generate validation of GA addresses (`run-status.ts`)
- Inspector “Address part” UI
- Artifakt plant fonts (usable by Shopify too, but seeded for plant look)

**Cloud/auth is Industrial-pilot, not a platform:** credentials + SQLite, hardcoded demo secret fallback, Stellantis seed only.

**Shopify:** zero files, zero routes, zero dependencies.

---

## 2. Protecting the current Industrial product

The Stellantis Kragujevac implementation is the **reference product**. Shopify work must not change its templates, catalog revision, or generate behavior.

Rules (normative):

1. Existing Stellantis templates in IndexedDB and `data/library.json` are **production/reference assets**.
2. Customized templates must **not** be recatalogued or replaced by seed builders.
3. **`CATALOG_REVISION` must not be bumped for Shopify work.** Do not add Shopify IDs to the existing `CATALOG_REVISION` map.
4. Stellantis templates stay in the Stellantis Kragujevac workspace / folders.
5. Existing template **IDs** (document `id` and `catalogId` such as `ga_warehouse_a3`, `fixed_ga_a4`, `warehouse_a3`, …) remain stable.
6. Existing template **geometry and content** must not be edited as a side effect of Shopify development.
7. Industrial Generate (Excel/grid → n-up PDF) must keep working with **no Shopify runtime dependency**.
8. Shopify data (products, OAuth, billing, metafields) must never be imported by Industrial generate/resolve/PDF paths.

Isolation mechanisms the architecture will rely on:

- Separate catalog registries (section 8).
- Workspace `organizationId` + future `edition` (section 9).
- Data adapters outside the shared engine (section 5).
- Route/deploy split so GitHub Pages never bundles a Shopify Node backend (sections 11, 16).
- Shared-core change discipline (section 19).

---

## 3. Target architecture

### 3.1 Principle

One engine. Two editions. Adapters at the edges.

```
DATA SOURCE
    ↓
edition data adapter
    ↓
NORMALIZED LABELATOR DATA (DataRow + DataColumn schema)
    ↓
LABEL TEMPLATE (LabelDocument)
    ↓
BINDINGS (element.binding → column key)
    ↓
VALIDATION (evaluateGenerateRun-style)
    ↓
GENERATION (resolveValue + Designer/PDF renderer)
    ↓
PDF / PRINT
    ↓
LABEL JOB / HISTORY
```

The shared generation engine must **not** import Shopify SDK types, Excel, or ERP clients.

### 3.2 Editions

**LABELATOR INDUSTRIAL**

- Current product.
- Stellantis Kragujevac workflows; future plants/ERP/WMS.
- Excel today; ERP/WMS/API later.
- Workspaces, roles (admin/designer/operator), publish/archive, versioning, audit/history.
- Warehouse templates: MAGACIN/REGAL/NIVO, part numbers, packaging photos, A3/A4 n-up.

**LABELATOR SHOPIFY**

- New edition.
- SMB / ecommerce merchants.
- Shopify products/variants as the primary source (plus a **demo provider** so local work does not need a store).
- Flow: product selection → template → design → generate → print/PDF.
- Later: brand kit, vector/illustration library, AI-assisted structured layout, Shopify Billing, Admin extensions.

### 3.3 Shared core (target)

Logical module (not a new package on day one):

| Responsibility | Current home | Target |
| --- | --- | --- |
| Document types | `src/lib/document.ts` (mixed) | Keep types here; move plant repairs out later |
| Binding resolve | `src/lib/resolve.ts` | Shared; transform registry becomes pluggable |
| Validation | `src/lib/run-status.ts` | Shared generic + edition plugins |
| PDF/print | `src/lib/pdf.ts`, `raster-label.tsx` | Shared |
| Designer | `src/components/designer/*` | Shared |
| Codes/fonts/units | `codes.ts`, `fonts.ts`, `units.ts` | Shared |
| Versions | `src/lib/versions.ts` | Shared |
| Jobs/activity (generic) | `jobs.ts`, `activity.ts` | Shared records; source types extend |
| Persistence abstractions | `db.ts`, `asset-db.ts` | Shared IDB; edition metadata in records |
| Asset lookup | `assets.ts` | Shared; libraries are data |

### 3.4 What not to extract yet

Do **not** move files merely because they could be shared. `store.ts` is a 2k-line Industrial client store. Extracting it in one pass is a big-bang risk. First add **boundaries and adapters**; then peel Industrial-only functions out of `document.ts` / `catalog.ts` / `format.ts` when tests exist.

---

## 4. Shared core vs product-specific code

### 4.1 Shared (must remain one copy)

- `LabelDocument`, `LabelElement`, `TemplateVersion`, `DOCUMENT_VERSION`
- Elements, mm geometry, styles, fonts, image fit
- Generic `binding: string` + `fallbackBinding`
- Generic transforms that are truly formatters (e.g. a future registry), **not** Shopify field names
- Designer (one canvas, one inspector shell)
- Konva rendering + print raster
- PDF generation
- Barcode + QR generation
- Validation engine **framework** (required fields, allowed values, barcode checksums)
- Generation engine (`resolveValue` over `DataRow`)
- Template versioning
- Generic job + activity records
- Asset record/folder abstractions
- Document persistence **mechanism** (IndexedDB / future server store)

### 4.2 Industrial-specific

| Concern | Current location | Future home (when extracted) |
| --- | --- | --- |
| Stellantis workspace seed | `session.ts`, `workspace.ts`, `server/db/seed.ts` | `src/industrial/workspace` |
| Warehouse/OVS/HBC/Canopy/GA catalog | `catalog.ts` | `src/industrial/catalog` |
| GA address parse + transforms | `format.ts`, `document.ts` | `src/industrial/transforms` |
| Plant repairs on hydrate | `repair*` in `document.ts` | `src/industrial/repairs` |
| Excel adapter | `excel.ts`, `store.loadWorkbook` | `src/industrial/data/excel` |
| Industrial roles UX | `roles.ts` (generic-ish) + Settings | keep roles generic; Industrial default set |
| Packaging photo seed | `asset-store.ts` | Industrial asset pack |
| Future ERP/WMS/API | none | `src/industrial/data/*` |
| Enterprise settings | `settings-view.tsx` | stay Industrial until Shopify settings exist |

### 4.3 Shopify-specific

All **new**. Do not put these in `src/lib/document.ts` or `src/lib/pdf.ts`.

| Concern | Proposed home |
| --- | --- |
| OAuth, session, webhooks | `src/shopify/auth`, `src/app/api/shopify/*` (Node-only) |
| Admin GraphQL client | `src/shopify/api` |
| Product/variant retrieval + sync | `src/shopify/products` |
| Demo data provider | `src/shopify/demo` |
| Product selector UI | `src/components/shopify/*` or `src/shopify/ui` |
| Shopify → `DataRow` adapter | `src/shopify/adapter` |
| Merchant workspace | `src/shopify/workspace` |
| Onboarding | Shopify routes only |
| Billing | `src/shopify/billing` |
| Embedded app / App Bridge / Admin extensions | Shopify host only |
| Shopify template catalog | `src/shopify/catalog` (separate from `CATALOG`) |
| Brand kit | `src/shopify/brand-kit` (later) |
| AI label generation | `src/shopify/ai` (later); emits `LabelDocument` |

### 4.4 Already shared vs would require refactoring

| Item | Status |
| --- | --- |
| `DataRow` + bindings | Already the right shared contract |
| Designer + PDF | Already shared; keep one copy |
| `catalog.ts` single array | **Must not** grow Shopify entries in place |
| `ElementTransform` closed union | Needs a registry **later**; do not break GA templates |
| `repairTemplateDocument()` | Industrial coupling; leave it, do not run it on Shopify docs |
| `STELLANTIS_ORG_ID` defaults | Contamination risk; stop using as global default before Shopify workspaces exist |
| `useAppStore` | God object; add edition/workspace fields carefully; do not split the store first |
| Job `sourceType` | Add `"shopify"` / `"demo"` later without changing Excel/manual |
| Cloud SQLite | Industrial pilot; do not reuse as Shopify session store without a dedicated design |

---

## 5. Data flow

### 5.1 Generic

```
DATA SOURCE
    ↓
NORMALIZED DATA          DataRow[] + DataColumn[] + ColumnMapping
    ↓
LABEL TEMPLATE           LabelDocument
    ↓
BINDINGS                 element.binding / fallbackBinding
    ↓
VALIDATION               evaluateGenerateRun (plus edition rules)
    ↓
GENERATION               resolveValue → canvas/PDF
    ↓
PDF / PRINT
    ↓
LABEL JOB / HISTORY
```

### 5.2 Industrial

```
Excel / future ERP / WMS / API
        ↓
Industrial data adapter   (today: parseWorkbook + autoMapBindings + projectRowsOntoSchema)
        ↓
normalized LABELATOR data
        ↓
shared generation engine
```

Today’s adapter is `src/lib/excel.ts` + `src/lib/grid.ts` + `autoMapBindings`. The Generate spreadsheet **is** the normalized table. Designer does not read the Print grid; Print does not rewrite the template. Keep that isolation.

### 5.3 Shopify

```
Shopify products / variants   (or demo provider)
        ↓
Shopify data adapter          (GraphQL/REST objects → DataRow[] matching template dataColumns)
        ↓
normalized LABELATOR data
        ↓
shared generation engine
```

The engine never sees `Product` / `ProductVariant` GraphQL types. The adapter is the only place those exist.

### 5.4 Demo Shopify provider

First Shopify implementation should be a **fixture adapter** that returns the same `DataRow[]` shape as a real shop, so:

- GitHub Pages and `next dev` can demo Shopify UX without secrets.
- Industrial GitHub Pages build does not need Shopify API packages.
- Adapter tests can run offline.

---

## 6. Normalized data model

### 6.1 Keep the names the code already uses

Do **not** replace `DataRow` with a new `ProductRecord` inside Designer/PDF.

Recommended vocabulary:

| Name | Role |
| --- | --- |
| `DataColumn` | Template schema: key, label, aliases, example, required, allowed values |
| `DataRow` | One label’s field map (`Record<string, string>` today) |
| `ColumnMapping` | Source header/field → column key (Excel headers today; Shopify field paths later) |
| `LabelDocument` | Layout + schema |
| Edition record (optional later) | `ShopifyProductSnapshot` / `ExcelRow` — **adapter input only** |

If a richer typed record is needed later, it should **compile down to `DataRow`** before `resolveValue`. Images stay strings (URL, asset stem, or data URL). Prices stay formatted strings unless a shared numeric type is added with a formatter transform.

### 6.2 How sources map onto the same bindings

A template declares `dataColumns` such as `title`, `sku`, `barcode`.

| Source | Adapter output |
| --- | --- |
| Excel | Header aliases (`PAKOVANJE (MDR)` → `packaging`) already via `DataColumn.headers` |
| Shopify product | `title` ← `product.title`, `sku` ← `variant.sku`, `barcode` ← `variant.barcode`, `price` ← money formatted, `image` ← image URL or downloaded asset id, `vendor` ← `product.vendor`, … |
| Future ERP | Same keys the template already binds |

Shopify metafields should map to **column keys** (e.g. `meta.custom.material`) configured per template or brand kit, not to a Shopify object stuffed into `LabelElement`.

`sample_shipping` already binds `name` and `sku`. That pattern is the Shopify MVP schema, **not** GA address fields.

### 6.3 What stays out of `LabelDocument`

- Raw Shopify GraphQL nodes
- Excel `File` / workbook objects
- Billing entitlements
- AI prompts
- OAuth tokens

---

## 7. Bindings

### 7.1 Current mechanism

- `LabelElement.binding` is a string column key.
- `fallbackBinding` (e.g. barcode ← address).
- `dataColumns[].headers` are Excel aliases.
- `autoMapBindings` matches aliases to sheet headers.
- `applyTransform` interprets `ElementTransform`.

Inspector binds from `schemaColumns(doc)` (declared columns plus unbound element keys).

### 7.2 Industrial fields (keep as column keys + Industrial transforms)

Examples already in catalog: `packaging`, `warehouse_code` / magacin, `address`, `ga_magacin` / regal / nivo **as transforms of `address`**, part number `reference` / `ref1`, `barcode`, arrows `UP`/`DOWN`.

These transforms stay Industrial. Shopify templates must not set `transform: "ga_magacin"`.

### 7.3 Shopify fields (column keys, not document-type changes)

Typical merchant columns:

- product title, variant title, SKU, barcode
- price, compare-at price
- image
- vendor, product type, collections, tags
- selected metafields

Expose them as `DataColumn` entries on **Shopify catalog templates**. Optional Shopify-only formatters (money, compare-at strikethrough as two text elements) live in the Shopify adapter or a Shopify transform plugin — **not** in the generic `ElementTransform` union until a registry exists.

### 7.4 Adding providers without rewriting Designer

Designer already binds to **whatever keys `dataColumns` lists**. A new provider:

1. Implements `toLabelRows(source): { columns, rows, mapping }`.
2. Does not change Konva or PDF.
3. Optionally registers validation plugins (e.g. Shopify barcode empty).

Do **not** hard-code Shopify field names in `document.ts`.

### 7.5 Transform evolution (later, not Phase 1)

Today `ElementTransform` is a closed union. Long-term: a registry `{ id, apply(raw, element) }` so Industrial registers `ga_*` and Shopify registers `money` if needed. Until tests exist, **append nothing Shopify-specific to the union**. String column values are enough for MVP.

---

## 8. Template catalogs

### 8.1 Problem

`CATALOG` and `seedTemplateLibrary()` are global. Adding Shopify templates to `CATALOG` would seed them into empty Industrial libraries and pollute Stellantis folders.

### 8.2 Rule

**Shopify templates must never become part of the Stellantis / Industrial catalog array.**

Use **separate catalogs**:

| Catalog | IDs (examples) | Revision map |
| --- | --- | --- |
| Industrial | existing `warehouse_a3`, `ga_warehouse_a3`, … | existing `CATALOG_REVISION` — **do not bump for Shopify** |
| Shopify | new ids e.g. `shopify_product_50x30`, never colliding | `SHOPIFY_CATALOG_REVISION` in a **different module** |

`catalogId` remains a string on `LabelDocument`. Disambiguate by:

- `catalogId` prefix or namespace (`shopify:` optional later), **or**
- workspace `edition` + catalog registry lookup.

Prefer a **separate module** (`src/shopify/catalog.ts`) and a seed function that only runs for Shopify workspaces. Industrial `seedTemplateLibrary` continues to iterate **only** the current `CATALOG`.

### 8.3 Industrial groups (unchanged)

Warehouse, OVS, HBC, Canopy, GA, Starter. Starter (`sample_shipping`) stays Industrial unless a later decision copies a *new* Shopify starter with a **new** `catalogId`. Do not retarget `sample_shipping` at merchants by changing its seed.

### 8.4 Shopify groups (new, later)

Product, Packaging, Barcode, QR, Price, etc. Different `catalogId`s, different folders, different workspace.

### 8.5 `catalogRevision` for multiple editions

- Industrial: keep current per-id numbers. Refresh only those Industrial ids.
- Shopify: own map, own bumps, never read Industrial `CATALOG_REVISION`.
- `refreshStaleCatalogDocuments` must be catalog-registry-aware so a Shopify bump cannot refresh a Stellantis `catalogId`.

**Do not change the existing `CATALOG_REVISION` values in this architecture phase.**

---

## 9. Workspaces

### 9.1 Current

One org: Stellantis Kragujevac. Documents, folders, assets, jobs, members, settings are stamped with `organizationId` but stored in one IDB. UI filters by `currentOrganizationId`.

### 9.2 Target isolation

| Workspace | Example |
| --- | --- |
| Industrial | Stellantis Kragujevac (existing id `org_stellantis_kragujevac`) |
| Shopify | One workspace per merchant/shop (e.g. `org_shopify_<shopDomain>`) |

Scoped per workspace:

- templates (`LabelDocument.organizationId`)
- folders (`TemplateFolder.organizationId`)
- assets (`AssetRecord` / `AssetFolder.organizationId`)
- jobs (`LabelJob.organizationId`)
- history/activity (`ActivityEvent.organizationId`)
- members (memberships)
- settings (organization record)

**A Shopify merchant must never see Stellantis templates, packaging photos, jobs, or members. Industrial users must never see Shopify products or merchant templates.**

### 9.3 Gaps to close before a second workspace exists

1. Hydrate currently forces `currentOrganizationId` to `organizations[0]` (Stellantis).
2. Missing `organizationId` is treated as visible (`visibleTemplates`, `assetsForOrganization`).
3. New documents default to `STELLANTIS_ORG_ID`.
4. One IndexedDB for all editions on a shared browser profile — **logical isolation only**. Acceptable for local demo if filters are strict (`organizationId` required, no fallback to Stellantis). Production Shopify should use server-side stores keyed by shop, not a shared IDB with plant data.

### 9.4 Recommended workspace record extension (later)

On `Organization` (already has plan/subscription fields):

- `edition: "industrial" | "shopify"`
- Shopify: `shopDomain`, `myshopifyDomain` (Shopify module only)

Do not overload `slug: "stellantis-kragujevac"` for shops.

---

## 10. Shopify app architecture (not implemented)

Shopify integration lives **beside** the engine, never inside it.

```
src/shopify/                 adapter, demo provider, catalog, billing, brand kit
src/app/api/shopify/         OAuth callback, webhooks, GraphQL proxy (Node host only)
src/app/(shopify)/…          merchant UI (or feature-flagged routes)
```

Isolate:

| Piece | Notes |
| --- | --- |
| OAuth | Node only. Incompatible with GitHub Pages static export. |
| Session | Shopify session tokens / cookies — not Auth.js Stellantis credentials, not IndexedDB plant meta. |
| Admin GraphQL | Server-side. Client receives **normalized** product lists. |
| Webhooks | Optional later (catalog updates, app uninstall). Node only. |
| Product sync | Cache normalized rows; do not persist raw GraphQL blobs in `LabelDocument`. |
| Product selection | Shopify UI → selected variant ids → adapter → `DataRow[]` in Generate. |
| Admin extensions / embedded UI | App Bridge; separate from `AppShell`. |
| Billing | Shopify Billing API; see section 14. |
| Demo provider | In-process fixtures; no network. Used by `next dev` and optional static demo. |

Auth.js in this repo is **Industrial cloud pilot**. Do not extend `src/server/auth.ts` credentials to Shopify merchants. Shopify has its own OAuth.

Next.js 16: if request interception is needed on the Node host, use `src/proxy.ts` (not `middleware.ts`). Static export **cannot** use Proxy.

---

## 11. Deployment

### 11.1 Current

| Mode | How |
| --- | --- |
| Local Industrial | `next dev` — Node, IndexedDB, optional SQLite if cloud flag |
| GitHub Pages | `GITHUB_PAGES=true next build` → `out/` at basePath `/liberator`. Workflow: `.github/workflows/pages.yml` |
| Cloud pilot | Node + `better-sqlite3` + Auth.js; templates still client IDB |

Static export constraints (Next.js 16 docs): no cookies, no dynamic Route Handlers, no Server Actions, no Proxy. Existing `/api/cloud/*` and `/api/library` use `dynamic = "force-static"` so Pages builds. Cloud POST is a stub on static.

### 11.2 Coexistence

```
Industrial local / demo / Pages     Shopify development          Shopify production
        |                                    |                            |
  static or Node                     Node + demo provider          Node + OAuth
  no Shopify backend                 optional real shop            Shopify App URL
        |                                    |                            |
        +---------------- shared JS core (Designer, PDF, LabelDocument) --+
```

**GitHub Pages must not depend on a Node-only Shopify backend.** Practical rules:

- Do not import `@shopify/shopify-api` from `src/lib/pdf.ts`, `document.ts`, `store.ts`, or Designer.
- Shopify Route Handlers must live under paths that are **not required** for `output: 'export'`, or be split into a second Next app / zone later.
- Safest near-term: **feature-flag Shopify routes** so `GITHUB_PAGES=true` does not include OAuth routes. Demo Shopify UI may ship as client-only fixtures on Pages if it imports only the demo adapter.
- Industrial Pages keeps working exactly as today (`/templates`, `/generate`, …).

Future options (decision in section 25): one Node host serving both editions; or Next.js multi-zones (Industrial static vs Shopify Node). Multi-zones are optional later, not required for MVP.

---

## 12. AI future-proofing (do not implement)

AI must produce an **editable `LabelDocument`**, not a flattened PNG.

```
User request
    ↓
AI (Shopify module)
    ↓
structured LabelDocument  (elements, bindings, dataColumns, page mm)
    ↓
LABELATOR Designer
    ↓
human editing
    ↓
shared generation → PDF/print
```

Existing types that already support this:

- `LabelDocument` / `LabelElement` / `DataColumn`
- `DOCUMENT_VERSION` for future AI metadata (optional `createdBy: "ai"` later — do not add now)
- Designer as the editor of record
- `normalizeImportedDocument` as a pattern for ingesting structured JSON

Do **not** add AI providers, prompt stores, or image-only generation to the core. Brand kit + vector library (sections 13–14) can be **inputs** to the prompt later. Output remains `LabelDocument`.

---

## 13. Brand kit (future, Shopify)

Not present today. Closest pieces: `savedColors` in app meta, `LABEL_FONTS`, asset folders.

Proposed concept (Shopify workspace scoped, **not** in `LabelDocument` except by reference):

- logo, alternate logo
- colors
- fonts
- brand assets

Templates/AI would reference `brandKitId` or tokens (`{{brand.logo}}`) resolved by the Shopify adapter into image URLs / hex / font names **before** `resolveValue`, or as bound columns.

Do **not** implement now. Do **not** put BrandKit into Industrial hydrate.

---

## 14. Vector / design asset library (future)

Current Assets: folders, uploads, **stem lookup** for bound images (packaging code → file). Good for Industrial SKU photos. Weak as a tagged illustration library (botanical, food, cosmetics, luxury, geometric, seasonal, decorative, industrial).

Recommendation:

- **Do not build a second blob store.** Extend `AssetFolder` / `AssetRecord` later with optional `library: "packaging" | "design"`, tags, and edition.
- Shopify design packs are **seeded into Shopify workspaces only**, never into Stellantis packaging.
- Industrial packaging seed (`PACKAGING_FOLDER_ID`) stays plant-only.

Do not build the library now.

---

## 15. Billing (future, Shopify-only)

Do not implement. Do not read plan limits inside `generatePdf` / `resolveValue`.

`Organization.plan` already has `free | professional | business | enterprise`. Shopify pricing can use a **Shopify-specific** map (Free / Starter / Growth / Business) in `src/shopify/billing`, separate from Industrial `enterprise`.

Future capabilities: monthly label limits, usage-based generation, Shopify Billing API. Enforcement belongs in Shopify route handlers / job creation, **after** the user is identified as a merchant. Industrial Generate stays unlimited relative to Shopify entitlements.

---

## 16. Routing

### 16.1 Current URLs (Industrial production)

`/templates`, `/designer`, `/generate`, `/assets`, `/history`, `/settings`, `/login`.  
`/print` and `/data` redirect to `/generate`.  
GitHub Pages: `https://agatonovic.github.io/liberator/…`.

### 16.2 Options considered

| Approach | Pros | Cons |
| --- | --- | --- |
| Prefix everything `/industrial/…` and `/shopify/…` | Clear | **Breaks live Pages URLs and muscle memory** |
| Same routes, edition from workspace | Least URL churn | Easy to mix Excel vs product UI in one shell |
| Keep Industrial URLs; add `/shopify/…` | Protects production; clear merchant entry | Two shells to maintain |

### 16.3 Recommendation (least disruptive)

**Do not rename Industrial routes.** They **are** the Industrial edition.

Add Shopify as a **new route group** when UI diverges, for example:

```
src/app/(shopify)/shopify/page.tsx           onboarding / product home
src/app/(shopify)/shopify/products/page.tsx
src/app/(shopify)/shopify/templates/page.tsx
```

Reuse the same Designer/Generate **components** with different data adapters and nav. Optional later: `src/app/(shopify)/layout.tsx` with a merchant shell (App Bridge) instead of `AppShell`.

Until then, a feature flag + Shopify **workspace** can reuse `/templates` and `/generate` **only if** catalog seed and org filters are proven isolated. Default recommendation is still **separate `/shopify` URLs** so Industrial Generate cannot accidentally show a product picker.

Do not introduce Next.js multi-zones until deploy pain is real.

---

## 17. Repository / code organization

**Stay in this single Next.js repo.** Do not create a monorepo or a second app until Shopify production hosting requires it.

### 17.1 Current (keep)

```
src/app/(studio)/…          Industrial (and shared) UI routes
src/app/api/library/        static library GET
src/app/api/cloud/          Industrial cloud stubs
src/components/designer/    SHARED — remain
src/components/print/       Industrial Generate UI (shared PDF underneath)
src/components/templates/
src/components/assets/
src/lib/document.ts         SHARED types + Industrial repairs (split later)
src/lib/catalog.ts          INDUSTRIAL catalog — remain, do not add Shopify
src/lib/store.ts            client store — remain; extend carefully
src/lib/db.ts               IDB — remain
src/server/                 Industrial Auth.js/SQLite — remain
public/templates/ga/        INDUSTRIAL art — remain
public/assets/packaging/    INDUSTRIAL — remain
data/library.json           INDUSTRIAL reference library — remain
```

### 17.2 Proposed additions (new files only, when implementation starts)

```
src/shopify/                NEW — adapter, demo, catalog, billing, auth helpers
src/shopify/catalog.ts      NEW — Shopify CATALOG, own revision map
src/app/(shopify)/          NEW — merchant routes
src/app/api/shopify/        NEW — Node-only; exclude from Pages build
src/industrial/             OPTIONAL later — extracted repairs/catalog
src/core/                   OPTIONAL later — peeled shared modules
```

### 17.3 Classification of existing files

| File | Remain | Extract later | Shared | Industrial | Shopify |
| --- | --- | --- | --- | --- | --- |
| `src/lib/document.ts` types | ✓ | repairs → industrial | types | repairs/transforms | — |
| `src/lib/catalog.ts` | ✓ | — | — | ✓ | **never** |
| `src/lib/resolve.ts` | ✓ | transform registry | ✓ | — | — |
| `src/lib/format.ts` | ✓ | GA/PN → industrial | generic bits | GA/PN | — |
| `src/lib/excel.ts` | ✓ | — | — | ✓ | — |
| `src/lib/pdf.ts` | ✓ | — | ✓ | — | — |
| `src/lib/run-status.ts` | ✓ | GA rules plugin | framework | address rules | later plugins |
| `src/lib/store.ts` | ✓ | too early to split | engine actions | Excel/workbook | later actions |
| `src/lib/library.ts` | ✓ | seed by edition | merge/IDB helpers | catalog seed | own seeder |
| `src/lib/workspace.ts` | ✓ | — | publish/jobs | Stellantis migrate | new migrate |
| `src/lib/domain.ts` | ✓ | — | Role, Job, Org | Stellantis ids | shop fields later |
| `src/lib/session.ts` | ✓ | — | flags | demo Stellantis | — |
| `src/server/**` | ✓ | — | — | cloud pilot | not reused |
| `src/components/designer/**` | ✓ | — | ✓ | inspector GA UI | hide GA on Shopify templates |
| `src/components/print/**` | ✓ | — | PDF call | Excel grid | product picker sibling |
| `generate-view.tsx` / `data-view.tsx` | leftover | delete only when safe | — | dead Industrial | — |

**Do not move these files in Phase 0–1.** New Shopify code goes in new directories.

---

## 18. Migration strategy

Avoid a big-bang refactor.

1. **Protect existing functionality.** Freeze `CATALOG_REVISION`. Do not edit Stellantis template JSON/geometry. Keep Pages build green.
2. **Introduce abstractions** that are additive: edition on workspace, catalog registry interface, `DataAdapter` type, job source union extension.
3. **Extract shared functionality gradually** (repairs out of `document.ts` only after unit tests for `parseGaAddress` / `resolveValue`).
4. **Add Shopify without changing Industrial behavior** (new modules, new routes, demo adapter). Industrial `seedTemplateLibrary` unchanged.
5. **Test Industrial after every architectural change** (Pages build, generate PDF smoke, template hydrate).
6. **Only then** expand Shopify (real OAuth, templates, billing).

If a change requires editing `catalog.ts` builders or bumping revisions, it is **out of scope** for Shopify work.

---

## 19. Parallel development

Industrial (Stellantis workflows, enterprise, templates, pilots) and Shopify (merchant UX, integration, templates) can proceed in parallel **if** shared-core edits are rare and reviewed.

### 19.1 Git (keep simple)

- Default branch: `main` (Pages deploy).
- Industrial work: `industrial/…` or issue branches as today.
- Shopify work: `shopify/…` branches. **No catalog revision bumps.**
- Shared-core changes (`document.ts` types, `resolve.ts`, `pdf.ts`, Designer canvas): small PRs, Industrial regression first, merge before large Shopify UI.

Avoid gitflow, submodules, or a second remote until needed.

### 19.2 Feature flags

- `NEXT_PUBLIC_SHOPIFY_EDITION=1` (or similar) to show `/shopify` routes in Node dev.
- Pages build leaves the flag off (or demo-only client fixtures).
- Existing `NEXT_PUBLIC_LABELATOR_CLOUD` stays Industrial cloud.

### 19.3 Deployment separation

- Pages: Industrial static, unchanged.
- Shopify dev: `next dev` Node.
- Shopify prod: Node host (decision needed).

### 19.4 Shared-core discipline

- No Shopify imports in `src/lib/pdf.ts`, `resolve.ts`, `codes.ts`, Konva canvas.
- Inspector GA controls: show only when the template uses GA transforms or Industrial edition.
- Do not run `repairCanopySchema` / `repairGaAddressFields` on documents without Industrial catalog ids / names.

### 19.5 Tests

See section 20. Industrial golden tests block Shopify merges that touch core.

---

## 20. Test strategy

There are currently **no automated tests**. Scripts: `dev`, `build`, `build:pages`, `start`, `lint`.

Add tests **before** Shopify becomes significant. Next.js 16 docs support Vitest, Jest, Playwright, Cypress.

### 20.1 Automate first (highest leverage)

1. **`tsc --noEmit` / existing `lint` / `npm run build` / `npm run build:pages`** in CI (Pages job already builds; add a non-Pages `next build` if cloud routes must compile).
2. **Unit tests (Vitest)** on pure functions — no DOM:
   - `parseGaAddress`, `formatPartNumber`, `resolveValue`, `autoMapBindings`
   - `evaluateGenerateRun` fixtures
   - `refreshStaleCatalogDocuments` does not rewrite current revision
   - workspace filter: Stellantis docs invisible to a Shopify org id
3. **Template loading:** `buildCatalogDocument` for each Industrial `CATALOG` id; snapshot `catalogId` + element count + bindings (not full geometry unless needed).
4. **Adapter tests:** demo Shopify provider → `DataRow` keys; Excel parse unchanged.

### 20.2 Next

- PDF smoke: one Industrial template + one row → PDF bytes length > 0 (jsdom/canvas constraints — may be Node-only).
- Designer regression: Playwright later (expensive); not blocking architecture.
- Role permissions: `canSeeTemplate` / operator published-only.
- Shopify adapter mocks (no live shop).

Do not start with E2E Shopify OAuth.

---

## 21. Architectural risks

| # | Risk | Impact | Mitigation | When |
| --- | --- | --- | --- | --- |
| 1 | Shopify entries added to `CATALOG` | Stellantis libraries seed merchant templates; folder pollution | Separate catalog module; Industrial seeder unchanged | Before any Shopify template |
| 2 | Bumping `CATALOG_REVISION` | Wipes customized GA/FIXED geometry | Freeze map; document in PRs | Always |
| 3 | `STELLANTIS_ORG_ID` default + missing org visible | Merchant sees plant labels or reverse | Require org id; no Stellantis fallback for Shopify | Before second workspace |
| 4 | Shared IndexedDB | Cross-edition data on one browser | Strict filters; Shopify prod on server | Before dual-edition local demo |
| 5 | Shopify types in `LabelDocument` | Engine coupled to Shopify; Industrial breaks on API changes | Adapter → `DataRow` only | Always |
| 6 | Shopify packages in Pages bundle | `output: 'export'` fails or leaks secrets | Dynamic import behind flag; no Shopify in `src/lib` | First Shopify API |
| 7 | Auth.js vs Shopify OAuth mixed | Broken sessions, static export cookies unsupported | Separate auth stacks | Shopify OAuth phase |
| 8 | `useAppStore` god object | One Industrial bugfix breaks Shopify generate | Additive APIs; don’t split store first | Ongoing |
| 9 | `repairTemplateDocument` on Shopify docs | Canopy/GA repairs mutate merchant layouts | Gate repairs on Industrial catalog ids/names | When Shopify docs exist |
| 10 | Job `sourceType` exhaustive unions | Compile errors or wrong History labels | Extend union in `domain.ts` + labels in `jobs.ts` | When Shopify generate lands |
| 11 | PUT `/api/library` missing | Disk backup already incomplete | Industrial-only fix; don’t block Shopify | When touching library API |
| 12 | Cloud SQLite has no templates | False sense of multi-user sync | Don’t use it as Shopify source of truth | Shopify production design |
| 13 | Hardcoded `AUTH_SECRET` fallback | Credential risk if cloud enabled | Env-only secret | Before any real cloud |
| 14 | AI as PNG | Uneditable labels; Designer bypassed | AI → `LabelDocument` only | AI phase |
| 15 | Billing in `generatePdf` | Industrial generate gated by Shopify plans | Billing in Shopify layer | Billing phase |
| 16 | Duplicate Designer | Divergent bugs, two PDF pipelines | One Designer | Always |
| 17 | Next.js 16 static + dynamic Shopify routes | Pages build break | Flag/split routes; force-static stubs | Shopify API routes |
| 18 | Document version / import | Old Industrial JSON vs new fields | Additive optional fields; `DOCUMENT_VERSION` bump only with migrator | When schema grows |

**Current technical debt (selected):** unused Generate/Data views; library PUT unused; Auth.js handlers unmounted; `persistence/idb.ts` is only a meta helper; Industrial repairs inside `document.ts`; no tests; catalog duplicate collapse can drop copies.

---

## 22. Architecture Rules / Do Not

- Do not duplicate the Designer.
- Do not duplicate PDF generation.
- Do not make shared code depend on Shopify.
- Do not put Shopify API objects into `LabelDocument`.
- Do not modify Stellantis `CATALOG_REVISION` for Shopify.
- Do not mix Shopify templates with the Stellantis catalog.
- Do not create two independently evolving copies of the core.
- Do not implement AI as image-only generation.
- Do not introduce billing into shared generation code.
- Do not perform a large refactor without regression testing.
- Do not recatalogue customized Industrial templates.
- Do not change existing template document IDs or `catalogId`s.
- Do not seed Shopify catalog into empty Industrial IndexedDB.
- Do not default new Shopify records to `org_stellantis_kragujevac`.
- Do not run GA/Canopy/HBC repair functions on unrelated documents.
- Do not require a real Shopify store for local Industrial or Shopify demo.
- Do not put OAuth, webhooks, or Billing API calls in `src/lib/pdf.ts` / `resolve.ts` / `store.ts` hydrate.
- Do not break GitHub Pages static export for Industrial.
- Do not use Next.js 16 Proxy on the Pages build.
- Do not extend Industrial Auth.js credentials to Shopify merchants.
- Do not treat `sample_shipping` as the Shopify catalog by renaming it.
- Do not delete `data/library.json` Industrial copies.
- Do not add Shopify image CDN assumptions to `resolveBoundImageSrc` globally.
- Do not bump `DOCUMENT_VERSION` without a migrator and Industrial tests.

---

## 23. Phased implementation plan

Implementation has **not** started. Phases are a proposal.

### PHASE 0 — Architecture / documentation

- **Objective:** This document reviewed; freeze Industrial catalog/templates.
- **Files:** `ARCHITECTURE.md` only.
- **Dependencies:** none.
- **Risk:** low.
- **Acceptance:** stakeholders agree on routing, deploy split, and catalog isolation; no code changes required.

### PHASE 1 — Safe shared-core preparation

- **Objective:** Additive types/flags; CI compile + Pages; unit tests on `resolve` / GA parse / catalog refresh.
- **Likely files:** `domain.ts` (optional `edition`), `library.ts` (seeder guard comments/hooks), Vitest config, CI. **Not** `catalog.ts` revisions.
- **Dependencies:** Phase 0 approval.
- **Risk:** medium if store/hydrate is touched — keep diffs small.
- **Acceptance:** Industrial generate + Pages build unchanged; tests cover `refreshStaleCatalogDocuments` no-op at current revisions; `visibleTemplates` hides other org ids when set.

### PHASE 2 — Shopify demo data provider

- **Objective:** Fixture products → `DataRow[]` without Shopify API.
- **Likely files:** `src/shopify/demo.ts`, `src/shopify/adapter.ts`, adapter tests.
- **Dependencies:** Phase 1 filters/tests.
- **Risk:** low if no UI yet.
- **Acceptance:** adapter tests pass; `src/lib/pdf.ts` still has zero Shopify imports; Industrial seed path unchanged.

### PHASE 3 — Shopify product integration (behind flag)

- **Objective:** Node-only GraphQL fetch → same adapter. Optional stub routes.
- **Likely files:** `src/shopify/api/*`, `src/app/api/shopify/*` excluded from Pages.
- **Dependencies:** Phase 2; hosting decision for secrets.
- **Risk:** high for Pages if imported from client store — mitigate with server-only modules.
- **Acceptance:** `GITHUB_PAGES=true` build still succeeds; live shop optional for tests.

### PHASE 4 — Shopify merchant UX

- **Objective:** `/shopify` product picker + template list; Industrial `AppShell` unchanged.
- **Likely files:** `src/app/(shopify)/*`, Shopify components, feature flag.
- **Dependencies:** Phase 2 (demo is enough).
- **Risk:** medium (nav/routing).
- **Acceptance:** Industrial `/generate` still Excel/grid; merchant flow does not list Stellantis templates.

### PHASE 5 — Shopify templates

- **Objective:** Separate Shopify catalog module; own ids/revisions; seed **Shopify workspaces only**.
- **Likely files:** `src/shopify/catalog.ts` **new**; **do not edit** Industrial `CATALOG_REVISION`.
- **Dependencies:** Phase 1 workspace isolation.
- **Risk:** high if seeder is wrong.
- **Acceptance:** empty Industrial library still seeds only current `CATALOG`; Shopify templates absent from `data/library.json` unless explicitly out of scope.

### PHASE 6 — Designer + generation for Shopify rows

- **Objective:** Bind Shopify columns; Generate from selected products; reuse `PrintView` or a thin wrapper; `completeLabelJob` with new `sourceType`.
- **Likely files:** `print-view` fork or props, `domain.ts` job source, `jobs.ts` labels.
- **Dependencies:** Phases 2, 4, 5.
- **Risk:** medium (validation plugins).
- **Acceptance:** same PDF engine; Industrial Excel path unchanged; operator rules still apply if used.

### PHASE 7 — Pilot testing

- **Objective:** Merchant demo + Industrial regression on real Stellantis templates.
- **Likely files:** tests, not catalog geometry.
- **Dependencies:** Phase 6.
- **Risk:** product, not architecture.
- **Acceptance:** Stellantis PDF/visual check; Shopify demo labels from fixtures.

### PHASE 8 — Brand kit / advanced templates

- **Objective:** Workspace brand tokens; richer Shopify catalog.
- **Dependencies:** Phase 7.
- **Risk:** low if referenced not inlined.
- **Acceptance:** Industrial assets/packaging untouched.

### PHASE 9 — AI label generation

- **Objective:** Prompt → `LabelDocument` → Designer.
- **Dependencies:** Brand kit optional; document schema stable.
- **Risk:** high if PNG shortcut is taken.
- **Acceptance:** output opens in Designer; generation still via shared PDF.

### PHASE 10 — Billing / production launch

- **Objective:** Shopify Billing; production Node host; OAuth; uninstall webhook.
- **Dependencies:** Phases 3, 7; legal/app listing.
- **Risk:** high (auth, export, quotas).
- **Acceptance:** Industrial Pages and Stellantis workflows independent of Shopify billing; engine has no plan checks.

---

## 24. Time estimate

Assumption: **one developer** using Cursor/AI, reviewing and testing every change. AI does not make the work instantaneous. Estimates are ranges.

| Workstream | Developer-days | Calendar (elapsed) |
| --- | --- | --- |
| Architecture preparation (review this doc, decisions, freeze rules) | 2–4 | ~1 week |
| Shared-core preparation (tests, org filters, flags, CI) | 5–8 | 1.5–2 weeks |
| Shopify MVP (demo adapter + `/shopify` UX + 1–2 templates + generate via shared engine) | 15–25 | 4–6 weeks |
| Testing (unit + Pages + Industrial smoke, overlapping) | 5–8 | throughout MVP |
| Merchant pilot (real shop optional, feedback, fixes) | 8–12 | 2–3 weeks after MVP |

**Order-of-magnitude to a Shopify MVP that does not harm Industrial:** about **8–12 calendar weeks**. OAuth + billing + AI are **after** that (Phases 8–10: additional 4–8+ weeks depending on App Store and billing complexity).

Industrial customer pilots can continue on `main` / Industrial branches in parallel if Shopify stays behind a flag and off Pages.

---

## 25. Decisions we need to make

Only items that need human/product judgment (not derivable from the current code):

1. **Confirm routing:** keep Industrial at current URLs and add `/shopify/…` (recommended) vs same-shell edition switch vs renaming to `/industrial/…` (not recommended).
2. **Shopify production host:** Vercel, Fly, existing Node, or other. GitHub Pages cannot host OAuth.
3. **Embedded Shopify app vs standalone web vs both** for MVP.
4. **Brand kit in MVP?** Recommended **no**.
5. **Shopify local persistence:** IndexedDB for demo (like Industrial) vs server-only from day one. Recommended: IDB/demo locally; server for production shops.
6. **Billing model:** Free / Starter / Growth / Business mapping, label caps, whether billing is required for first merchant pilots.
7. **AI provider and timing** (Phase 9 only).
8. **Whether Shopify ships any client demo on GitHub Pages** (fixtures only) or Pages stays 100% Industrial.
9. **App listing / shop scopes** (products, files, billing) when OAuth starts.
10. **Single repo remains** (recommended) vs split Shopify to a second Next app later — only if Pages vs Node coupling becomes painful.

**Not asked:** whether to keep one Designer/PDF (yes, from the code); whether Excel stays Industrial (yes); whether to bump `CATALOG_REVISION` for Shopify (no); whether `DataRow` is the normalized row (yes).

---

## Appendix A — Industrial catalog IDs (do not recycle)

From `src/lib/catalog.ts`: `warehouse_a3`, `cdc_a3`, `simple_ovs_a3`, `simple_ovs_a3_dual`, `hbc_a4`, `canopy_a3_1pn`, `canopy_a3_2pn`, `canopy_a3_3pn`, `slozivost_a4`, `ga_warehouse_a3`, `ga_warehouse_a3_dual`, `fixed_ga_a3`, `fixed_ga_a4`, `sample_shipping`.

`data/library.json` currently includes customized copies including `fixed_ga_a4`, `ga_warehouse_a3`, `warehouse_a3`, `cdc_a3`, `hbc_a4`, `slozivost_a4`, `canopy_a3_3pn`, `simple_ovs_a3_dual`, `ga_warehouse_a3_dual`. Treat these as live Industrial assets.

---

## Appendix B — Next.js 16 constraints used in this proposal

Inspected `node_modules/next/dist/docs/`:

- App Router file conventions; Route Handlers in `route.ts`.
- Static exports: `GET`-only static handlers; no cookies, Server Actions, Proxy, request-dynamic handlers.
- Proxy (`proxy.ts`) replaces Middleware; unsupported on static export.
- Root typed layouts (`LayoutProps`).
- Testing via Vitest/Jest/Playwright guides.

Current repo already matches a hybrid: Node by default, static export when `GITHUB_PAGES=true`. Shopify’s Node features must follow that split.

---

The proposal above remains the product plan. Phase 1 implementation status is recorded in the following sections. Do not treat later phases as done.

---

# Phase 1 Implementation Status

Phase 1 established regression protection and edition/workspace/provider boundaries. It did **not** build Shopify UI, OAuth, Admin API, templates, billing, AI, or Brand Kit.

## What was implemented

### A. Regression test foundation

Vitest (`vitest run`, Node environment, `vite-tsconfig-paths`) was added because Next.js 16 documents Vitest and the Phase 1 tests are pure library tests. No jsdom, Playwright, or Shopify network.

Tests:

| File | Covers |
| --- | --- |
| `tests/catalog-safety.test.ts` | Frozen `CATALOG_REVISION`, Industrial catalog ids, live `data/library.json` template ids/element counts, no recatalogue on seed/refresh, empty Shopify registry |
| `tests/workspace-isolation.test.ts` | Unscoped records are hidden; legacy stamp → `org_stellantis_kragujevac` only; Shopify org cannot see Stellantis; migration idempotent; operator published-only |
| `tests/engine.test.ts` | GA MAGACIN/REGAL/NIVO, bindings, generate validation, JSON document round-trip, Excel → `DataRow[]`, Shopify provider throws |
| `tests/dependency-direction.test.ts` | Shared core (`document`, `resolve`, `pdf`, `catalog`, Designer, store, …) must not import `@/shopify` |
| `tests/library-put.test.ts` | PUT merge stamps `organizationId` without replacing live geometry; tombstones and new templates |

### B. Organization / workspace isolation

Missing `organizationId` is no longer treated as globally visible.

- `src/lib/workspace-scope.ts`: exact-match `belongsToOrganization` / `recordsForOrganization`; `stampLegacyOrganizationIds()` always stamps **missing** ids onto `org_stellantis_kragujevac`.
- Filters: `visibleTemplates`, `foldersInOrganization`, `assetsForOrganization`, `foldersForOrganization`, `activityForOrganization`, `jobsForOrganization`.
- `migrateWorkspace()` stamps unscoped documents, folders, jobs, and activity. It does **not** bump `WORKSPACE_MIGRATION_REV` (still `1`) and does **not** rewrite element geometry.
- Hydrate restores `currentOrganizationId` from meta when valid, otherwise Stellantis — never “whatever is `organizations[0]`” when Stellantis exists.

### C. Edition boundary

`src/lib/edition.ts`: `ProductEdition = "industrial" | "shopify"`, default industrial. Organization records may carry `edition`. The running app stays Industrial. No `if (edition === "shopify")` in UI.

### D. Catalog isolation

`src/lib/catalog-registry.ts` is the edition-aware lookup. Industrial still uses `src/lib/catalog.ts`. Shopify registry is **empty**. `seedTemplateLibrary(..., edition)` seeds only that edition. Comment on `catalog.ts`: do not append Shopify templates there.

`CATALOG_REVISION` unchanged:

```
ga_warehouse_a3: 3
ga_warehouse_a3_dual: 3
fixed_ga_a3: 3
fixed_ga_a4: 3
```

### E. Data-provider boundary

`src/lib/data/types.ts`: `LabelDataProvider` / `LabelDataSet` wrapping existing `DataRow[]` + `ColumnMapping`.  
`src/lib/data/excel-provider.ts`: `loadExcelLabelData` — same parse → map → `projectRowsOntoSchema` path. `store.loadWorkbook` uses it.

`DataRow` was already generic enough. Bindings remain string keys (`element.binding`). Shopify field paths are **not** implemented.

### F. Future Shopify adapter (contract only)

`src/shopify/types.ts` and `src/shopify/adapter.ts`. `load()` throws. Shared core, Designer, PDF, and resolve must not import these modules.

### G. `/api/library` PUT/GET

**Finding:** the client already `PUT /api/library` as an IndexedDB disk backup. The Route Handler was GET-only, so Node `next dev` returned **405** and GitHub Pages never had PUT. PUT was required, not dead code.

**Fix:** `PUT` writes `data/library.json` on Node. Static export / Pages: client skips PUT (`isStaticHost`); handler returns 404 if somehow invoked. Invalid bodies return 400.

**Safety:** a first local PUT merged IndexedDB `repairTemplateDocument` patches into three live templates (GA Address arrow binding, Canopy A3 — 3 PN bindings, OVS A3 dual binding). That write was **reverted**. `mergeLibrarySnapshotForWrite()` now keeps on-disk geometry for existing ids. PUT may only:

- stamp `organizationId` onto existing disk records
- append new templates/folders
- honor `deletedIds` / `deletedFolderIds`

Committed `data/library.json` geometry is unchanged. Documents in that file still have **no** `organizationId`; stamping happens in memory/IDB on hydrate.

`export const dynamic = "force-static"` remains a static string so Pages can emit GET JSON. Next.js 16 rejects computed `dynamic` values. Non-GET methods are not cached (Route Handlers guide).

### H. GitHub Pages

`npm run build:pages` must remain the Industrial/static path. No Shopify packages in shared modules. `writeLibraryBackup` is skipped when `NEXT_PUBLIC_BASE_PATH` is set.

## Files / modules changed (Phase 1)

**New:** `src/lib/edition.ts`, `src/lib/workspace-scope.ts`, `src/lib/catalog-registry.ts`, `src/lib/data/types.ts`, `src/lib/data/excel-provider.ts`, `src/shopify/types.ts`, `src/shopify/adapter.ts`, `vitest.config.mts`, `tests/*.test.ts`.

**Touched for isolation / seed / Excel / library:** `src/lib/library.ts`, `src/lib/library-file.ts`, `src/lib/template-library.ts`, `src/lib/workspace.ts`, `src/lib/store.ts`, `src/lib/assets.ts`, `src/lib/activity.ts`, `src/lib/jobs.ts`, `src/lib/session.ts`, `src/lib/catalog.ts` (comment only), `src/app/api/library/route.ts`, `package.json` (test scripts + vitest).

The git working tree also contains **pre-Phase-1 uncommitted Industrial work** (History, Settings, cloud login stubs, print/templates view updates). Phase 1 did not redesign those screens.

## Intentionally left untouched

- Designer, Konva, pdf-lib, barcode/QR engines, `LabelDocument` shape (aside from existing workspace fields)
- Industrial routes (`/templates`, `/designer`, `/generate`, …)
- Sidebar / Shopify UI / `/shopify/*`
- `CATALOG` builders and `CATALOG_REVISION` values
- IndexedDB engine (still `idb`; scoping is via `organizationId` fields)
- Zustand store architecture
- Brand Kit, AI, billing, Shopify OAuth/API/webhooks
- `WORKSPACE_MIGRATION_REV` (still `1`)

## What remains coupled

- One IndexedDB database for all workspaces; isolation is a filter, not separate databases.
- `useAppStore` still owns hydrate/seed/persist/Excel.
- Excel `xlsx` is still a shared dependency; only the load path is wrapped.
- Cloud Auth.js + SQLite remains an Industrial pilot; templates still live in IndexedDB.
- `repairTemplateDocument` can still mutate in-memory bindings; those repairs stay in IDB and are no longer written over committed `library.json` geometry.

## Migration details

- **Idempotent.** Running `migrateWorkspace` twice with stamped records sets `didChange: false`.
- **Deterministic.** Unscoped records always receive `org_stellantis_kragujevac`, never `organizations[0]`.
- **Geometry.** Element arrays are not rewritten by the org stamp.
- **Disk.** Committed `data/library.json` is still the unscoped snapshot (11 templates, folder `655d6e1b-31bb-4d5e-ae3d-0ca99fbdead6`). Runtime hydrate stamps org ids into IDB.

## Catalog safety confirmation

Live template ids, catalog ids, revisions, and element counts are asserted in `tests/catalog-safety.test.ts` against `data/library.json`. Customized Canopy 1 PN / 2 PN copies still have **no** `catalogId`. Seed/refresh does not recatalogue them.

## Persistence safety confirmation

Existing `deletedIds` / `deletedCatalogIds` / `deletedFolderIds` merge unchanged. Hydrate still merges IDB + `GET /api/library`. Stellantis remains default workspace.

## GitHub Pages / build

Verified in this Phase 1 pass:

- `npx tsc --noEmit`
- `npm test` — 26 tests, 5 files
- `npm run build` — `/api/library` is dynamic (`ƒ`) on Node because PUT reads the body
- `npm run build:pages` — `out/templates`, `out/generate`, `out/designer`, `out/history`, `out/assets`, `out/settings` emitted; `public/library.json` copied to `out/library.json`

Embedded-browser click-through of Designer save / Excel / PDF could not be completed in this agent session (browser MCP dropped; headless screenshots captured the shell before IndexedDB hydrate). Automated tests plus `GET /api/library` (11 documents) cover catalog and isolation. Restart local `next dev` so it is not the older process that still returned PUT 405.

## Remaining technical debt

- No end-to-end / Playwright coverage of Designer save, PDF download, or operator click-through.
- Local `PUT /api/library` is now a geometry-preserving backup, not a full IDB dump. Legitimate Designer edits still need a deliberate export if they should land in git `library.json`.
- Binding keys are flat strings; nested Shopify paths (`variant.sku`) are future work.
- `LabelJobSource` does not yet include `shopify`.
- Default catalog folders are created unscoped and stamped on migrate.
- Cloud SQLite is not the template store.

---

# Phase 1.5 — Stabilization

Phase 1.5 did not add Shopify functionality, Designer UI, routes, or catalog revision changes.

## What was verified

- Fresh `next dev` on port 3001 after stopping the previous listener, so the running process matches current source.
- `npm test` — 38 tests, 7 files.
- `npx tsc --noEmit`
- `npm run build`
- `npm run build:pages`
- `data/library.json` still has **11** unscoped Stellantis templates (no `organizationId` on disk). `CATALOG_REVISION` is unchanged (`ga_warehouse_a3`, `ga_warehouse_a3_dual`, `fixed_ga_a3`, `fixed_ga_a4` all `3`). No Shopify templates. Disk geometry of the three Phase 1 incident templates was not rewritten.

## Tests added

| File | Covers |
| --- | --- |
| `tests/stellantis-live-templates.test.ts` | GA Address, Canopy A3 — 3 PN, OVS A3 dual: bindings, page size, element counts, 0.1mm layout of the designed arrow / part-number text |
| `tests/hydrate.test.ts` | Empty IDB + `library.json` hydrates 11 Stellantis templates onto `org_stellantis_kragujevac`; empty everything seeds Industrial catalog; newer customized IDB copy wins over disk; IDB-only drafts are kept |
| `tests/library-put.test.ts` (expanded) | Geometry-preserving PUT merge; org-id stamp; new templates; tombstones; malformed 400; `GITHUB_PAGES` PUT 404; hydrate `repairTemplateDocument` patches cannot replace disk elements |

`assembleHydratedLibrary()` in `src/lib/library-hydrate.ts` is the hydrate merge used by `store.hydrate`, so those tests cannot drift from runtime.

## Remaining risks

- `repairTemplateDocument` still runs after hydrate and can patch **IndexedDB** copies (for example it binds the GA Address designed arrow). **Disk** `library.json` cannot be overwritten by those patches because PUT keeps existing element arrays.
- `mergeDocuments` prefers the newer `updatedAt`. A customized IDB template with an **older** timestamp than disk would lose. Designer saves bump `updatedAt`, so the usual customized path is preserved (covered by test).
- GitHub Pages `takePublished` still replaces local IDB when the published library stamp changes. That is the static-demo path, not local `next dev`.
- No Playwright click-through of Designer save / Excel / PDF.

No Phase 2 blocker for Shopify demo work: committed Stellantis geometry is frozen by tests, PUT cannot rewrite it, and isolation still hides unscoped and cross-workspace records.

---

# Phase 2 — Shopify Demo Provider & Product Workflow

Phase 2 adds a **local demo Shopify edition** under `/shopify`. It does not call Shopify, does not add OAuth, and does not change Industrial routes, `src/lib/catalog.ts`, or `CATALOG_REVISION`.

Industrial URLs remain `/templates`, `/designer`, `/generate`, `/assets`, `/history`, `/settings`. Visiting `/shopify` does **not** switch `currentOrganizationId`; Industrial stays on Stellantis.

## Demo provider

```
Demo Shopify products (src/shopify/demo-store.ts)
    ↓
DemoShopifyProvider (src/shopify/adapter.ts)
    ↓
LabelDataSet { sourceKind: "shopify", rows: DataRow[], mapping }
    ↓
existing bindings / validation / generatePdf / jobs
```

`shopifyLabelDataProvider` implements `LabelDataProvider`. Designer, `resolveValue`, `evaluateGenerateRun`, and `pdf.ts` never import `@/shopify`. Raw demo product objects stay inside `src/shopify/`.

There is no network: images are SVG files in `public/shopify-demo/`. The adapter rejects `http(s)` image URLs.

## Normalized data mapping

Flat `DataRow` keys (sufficient for this phase):

`title`, `description`, `type`, `vendor`, `sku`, `barcode`, `price`, `variant`, `image`, `quantity`, `collection`, `tags`, `handle`, `weight`

Future nested Shopify fields can map in the adapter without changing `LabelDocument`:

| Future nested path | Flat key |
| --- | --- |
| `product.title` | `title` |
| `product.vendor` | `vendor` |
| `product.type` | `type` |
| `variant.title` | `variant` |
| `variant.sku` | `sku` |
| `variant.barcode` | `barcode` |
| `variant.price` | `price` |
| `image.primary` | `image` |

Documented in `src/shopify/fields.ts`. The current resolver still uses flat `element.binding` strings.

## Shopify workspace

- Organization: `org_shopify_demo` / **Shopify Demo Store** (`edition: "shopify"`)
- Demo Admin is a member of both Stellantis and the Shopify demo org
- Industrial session (`DEMO_SESSION`) remains Stellantis so `/templates` does not show Shopify templates
- Shopify jobs/activity are written with `organizationId: org_shopify_demo` via `completeLabelJob({ organizationId })`
- Exact-match isolation already hid cross-workspace records; Shopify UI always queries `SHOPIFY_ORG_ID`

Shopify **templates are not stored** in the Industrial document list / `data/library.json`. They are built from `src/shopify/catalog.ts` at runtime. PUT/`writeLibraryBackup` also strips any Shopify-org documents, folders, and activity (`omitShopifyFromLibrarySnapshot` in `src/lib/library-guard.ts`, used from the client store without importing Node `fs`).

## Shopify catalog

- Module: `src/shopify/catalog.ts`
- Independent revision map `SHOPIFY_CATALOG_REVISION` (all `1`)
- **Not** registered in `src/lib/catalog-registry.ts` (registry Shopify entries stay empty) so shared core never imports `src/shopify`
- `seedTemplateLibrary(..., "shopify")` still seeds nothing
- Industrial `CATALOG` / `CATALOG_REVISION` untouched

Templates:

1. Product Barcode — title, SKU, barcode
2. Product + Price — image, title, price, SKU, barcode
3. Product Shelf Label — title, price, SKU, barcode
4. Simple Packaging Label — image, title, variant, SKU

## Routes

| Route | Surface |
| --- | --- |
| `/shopify` | Dashboard / workflow explanation |
| `/shopify/products` | Search, stock filter, multi-select, preview |
| `/shopify/labels` | Template pick, live preview, generate/print |
| `/shopify/history` | Existing `HistoryView` scoped to `org_shopify_demo` |

Shell: `src/components/shopify/shopify-shell.tsx` (Products, Labels, History). No Industrial Settings/Assets in this nav. No edition switch in the Industrial sidebar.

## Product workflow

1. Open `/shopify` (deterministic demo identity, no login)
2. Select products (sessionStorage selection; product selection expands to all variants → one `DataRow` / label each)
3. Create labels → `/shopify/labels`
4. Choose a Shopify catalog template
5. Preview uses `LabelPreview` + actual product `DataRow`
6. Generate uses `evaluateGenerateRun` then `generatePdf` (label-size PDF, optional A4 n-up sheet, print)

## Generation / PDF / history

- Same `generatePdf` / validation / job model as Industrial
- `LabelJobSource` includes `"shopify"`
- Jobs record template, version, user, product count (`fileName`), label counts, success/failure, PDF/print
- History is the existing job list filtered by Shopify org — not a second history system

## Static build

Demo data, catalog, and images are client/static. `/shopify` works with `GITHUB_PAGES=true` / `npm run build:pages`. No Shopify server routes. Real Admin API later will need a Node host.

## Tests

`tests/shopify-demo.test.ts` plus updates to `tests/engine.test.ts` and `tests/dependency-direction.test.ts`: provider → `LabelDataSet`, field mapping, local images, catalog isolation, workspace isolation, PUT filter, shared validation, no `@/shopify` in shared core.

## Intentionally not implemented

OAuth, Admin API, App Bridge, webhooks, billing, Shopify login, AI, Brand Kit, product editing, inventory/order/customer management, subscription plans, production app install.

---

# Phase 3 — Industrial Integration Foundation

Phase 3 strengthens edition isolation, protects the committed Industrial seed, and introduces a canonical **Labelator Template JSON** export for Stellantis / external integration testing.

This phase does **not** implement real Shopify OAuth, Admin API, billing, a Python renderer, or a production render API.

## Edition boundaries

```
SHARED CORE
  LabelDocument, DataRow, LabelDataProvider, Designer, resolve, validation, PDF, jobs

INDUSTRIAL
  Stellantis workspace, Excel provider, src/lib/catalog.ts, industrial transforms/assets

SHOPIFY
  /shopify routes, src/shopify/* demo provider + catalog, org_shopify_demo
```

Rules enforced by tests:

- Shared core must not import `@/shopify`
- Shopify catalog must not import Industrial `catalog.ts` / `CATALOG_REVISION`
- Shopify templates are not seeded into Industrial libraries
- Industrial catalog is not seeded into Shopify libraries
- Exact-match workspace filters keep templates/jobs isolated

## library.json safety

`data/library.json` is a **committed seed / recovery artifact**, not a live database.

Changes in this phase:

1. Client autosave **no longer PUTs** the working IndexedDB library onto disk (`writeLibraryBackup` is a no-op). Designer edits stay in IndexedDB.
2. `/api/library` PUT remains available for explicit tooling.
3. `mergeLibrarySnapshotForWrite` still preserves disk geometry/bindings and may stamp `organizationId`, and honors tombstones, but **does not append** new runtime templates/folders onto an existing seed.

Do not treat PUT as a way to commit new Stellantis catalog content during local development.

## Canonical Template JSON

Module: `src/lib/template-json.ts`

Envelope:

```json
{
  "schemaVersion": 1,
  "kind": "labelator.template",
  "exportedAt": "ISO-8601",
  "exportScope": "working",
  "document": { /* LabelDocument without nested version history by default */ }
}
```

- `schemaVersion` is the **external interchange** version. It is **not** `CATALOG_REVISION`.
- Export is based on `LabelDocument` (declarative template), not Konva/Zustand/IDB dumps.
- Nested version history snapshots are omitted by default (`stripDocumentVersions`).
- Export does not mutate the source document and does not write `library.json`.

### Export UI

| Location | Action | Scope |
| --- | --- | --- |
| Designer header | **Download JSON** | Current working canvas document |
| Templates card menu | **Download current JSON** | That template’s current library document |

Example filename: `labelator-ga-address-v3.json`

### Import compatibility

`normalizeImportedTemplateJson()` accepts:

1. Phase 3 envelope (`schemaVersion` + `document`)
2. Bare `LabelDocument` (existing import behavior)

`store.importDocument` uses this normalizer. Imported templates still receive a fresh runtime id.

### Asset / font references

Template JSON is not a self-contained binary pack:

- Bound images: `assetFolderId` + binding value (Asset library lookup)
- Designed images: optional `imageDataUrl` or app-relative paths
- Fonts: `style.fontFamily` names (for example IBM Plex Sans); package fonts separately outside the browser

Complete external render environment = Template JSON + referenced images + required fonts.

## Python / Stellantis integration interpretation

**Template JSON is an interchange definition, not a renderer.**

A Python developer cannot generate labels from JSON alone. They need either:

1. An external renderer that interprets the JSON, **or**
2. A future LABELATOR rendering API that accepts template + data and returns PDF.

Do not claim JSON alone prints labels.

## Future rendering API (not implemented)

Conceptual only:

```
POST /api/render
{ "template": { ...LabelDocument... }, "data": [ { "partNumber": "...", "address": "..." } ] }
→ PDF bytes
```

Future template APIs (not implemented):

- `GET /api/templates/:id`
- `GET /api/templates/:id/versions/:version`
- `POST /api/templates/:id/publish`

## Future embedded Designer (not implemented)

```
Stellantis Python app
  → open LABELATOR Designer (browser / webview)
  → edit / save / publish
  → consume Labelator template versions
```

No OAuth, callbacks, or production credentials in this phase.

## Current recommended integration for external apps

1. Consume the exported JSON with an external renderer, **or**
2. Use a future LABELATOR rendering API.

## Regression

Industrial routes and Shopify demo routes must both keep working. Shopify templates must not appear in Industrial templates and vice versa. `CATALOG_REVISION` and live Stellantis geometry remain unchanged.

---

# Phase 4 Readiness — Real Shopify Integration

Do not start without a separate task. Still needed later:

- Shopify app configuration, OAuth, embedded app, Admin API
- Real product sync behind the existing `LabelDataProvider` contract
- Webhooks, server persistence, Node hosting, merchant identity, billing

Shared core must still not import Shopify SDKs.

