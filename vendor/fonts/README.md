# Vendored fonts for portable `.labelator` packages

## Artifakt Element Black

Shipped with the app at `public/fonts/ArtifaktElement-Black.otf` (not duplicated here).
The A3 Warehouse exporter copies that file into each package.

## Open Sans

LABELATOR loads Open Sans at runtime via `src/lib/fonts.ts` `fetchFontBytes`:

1. Request `https://fonts.googleapis.com/css2?family=Open+Sans:wght@{400|700}`
2. Use the Firefox User-Agent that historically preferred TTF
3. Download the first `fonts.gstatic.com` URL from the CSS

As of 2026-09-05 that endpoint returns **WOFF** (TrueType-flavored), not raw `.ttf`.
These files are the **exact bytes** LABELATOR embeds today — not a substitute face.

| File | Weight | Notes |
| --- | ---: | --- |
| `OpenSans-Regular.woff` | 400 | gstatic Open Sans v44 |
| `OpenSans-Bold.woff` | 700 | gstatic Open Sans v44 |

## Inter

Same `fetchFontBytes` path as Open Sans (`Firefox/27.0` UA). The CSS endpoint currently serves WOFF, not TTF.

| File | Weight | Source |
| --- | ---: | --- |
| `Inter-Bold.woff` | 700 | `fonts.gstatic.com` Inter v20, `UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZs.woff` |

sha256: `52026705fdc61b964e77937b199b9888c8200281b81cffff648c54f8d9e98e79`

License: Inter — SIL Open Font License 1.1.

Packages must embed these binaries. Portable renderers must **not** call Google Fonts at print time.

License: Open Sans — Apache License 2.0.
