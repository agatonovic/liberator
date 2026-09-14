# LABELATOR Python renderer

LABELATOR is the design-time system. This renderer is the production drawing component. It does not run LABELATOR, does not open IndexedDB, and does not fetch fonts or assets.

It reads a frozen `.labelator` v1 package plus local row data and writes a PDF.

Contract: [LABELATOR_TEMPLATE_PACKAGE_FORMAT.md](./LABELATOR_TEMPLATE_PACKAGE_FORMAT.md).  
Proof: [LABELATOR_PORTABLE_RENDERER_ACCEPTANCE.md](./LABELATOR_PORTABLE_RENDERER_ACCEPTANCE.md).

There is no API, login, or cloud render path in this package.

## Versions

These are different numbers.

| Name | Value | Meaning |
| --- | --- | --- |
| Renderer package | `0.1.0` (`labelator_renderer.__version__`) | This Python component |
| `.labelator` format | `1` (`format` `labelator.package`, `formatVersion` 1) | The frozen package contract |

A renderer release can change packaging or CLI without changing the package format. A format change would be a new `formatVersion`, which this renderer would refuse.

## What it consumes

- A `.labelator` ZIP, or the same tree unpacked as a directory
- Row JSON: a list of objects, or `{"rows": [ ... ]}`

## What it produces

A PDF. It is not required to be byte-identical to a LABELATOR PDF or to a previous PDF from this renderer. Raster appearance of the same package and data is the comparison used here. PyMuPDF may stamp nondeterministic metadata; that is not a semantic change.

## Install

From the Laberator repository, using the existing renderer virtualenv or a new one:

```bash
python3 -m venv .venv
.venv/bin/pip install -e tools/labelator_renderer
```

Runtime dependencies, verified from imports: PyMuPDF, Pillow, fontTools. numpy is optional and used only by the raster comparison tool, not by `render`. `python-barcode` is not used. There is no Node.js or network dependency.

## CLI

```bash
labelator-render \
  --template Warehouse_A3_Final_v1.labelator \
  --data labels.json \
  --output labels.pdf
```

| Flag | Meaning |
| --- | --- |
| `--template` | `.labelator` ZIP or unpacked directory |
| `--data` | Local JSON file |
| `--output` | PDF path |
| `--verbose` | On an unexpected failure, allow the traceback. Ordinary failures stay one line |

Exit codes: `0` ok, `2` bad usage, `3` package, `4` input data, `5` unsupported capability, `6` output path, `1` unexpected.

Ordinary failures do not print a traceback. Example:

```text
error: required font 'fonts/Inter-Bold.woff' is missing from the package (family Inter weight 700)
```

## Python API

```python
from labelator_renderer import render

render(
    template_package="Warehouse_A3_Final_v1.labelator",
    data=rows,
    output_pdf="labels.pdf",
)
```

`template_package` is a ZIP path or an unpacked directory. `data` is a list of row dicts, or a path to JSON in the CLI shape. `output_pdf` is the PDF path. The function returns that path.

`validate_package(path)` checks the frozen v1 files, checksums, and known transforms. It does not draw. `render` is the proven engine function and does not go through a second drawing implementation.

## Input data

Accepted:

```json
[
  { "warehouse_code": "WG6.99.123", "barcode": "WG6.99.123" }
]
```

Also accepted, because the golden fixtures use it:

```json
{ "rows": [ { "warehouse_code": "WG6.99.123", "barcode": "WG6.99.123" } ] }
```

Keys are matched case-insensitively to the package data contract. Empty bound fields paint blank. Fallback bindings and transforms such as `barcode_pct` are applied by the package, not by the caller. See the contract document.

Example file: `tools/labelator_renderer/examples/basic_render/`.

## Offline and trust

The renderer does not fetch fonts, assets, or remote URLs. Fonts and images come from the package. A package is data. Template JSON is not executed. Transforms are a fixed interpreter table in the renderer. Package metadata cannot install plugins or change that table. There is no plugin loader.

## Supported and not supported

Supported and golden-validated on six live templates: text and spans, rectangle, line, stretch image, arrow and double arrow used live, Code39, Code128, `part_number`, `barcode_pct`, GA address transforms, arrow pose, packaged Artifakt Element, Open Sans, and Inter 700, 1-up, and sheet packing when `print.mode` is `sheet`.

Not implemented, and unused by those templates: QR, EAN-13, ellipse, other polygons, dashed strokes, non-zero corner radius, `part` / `partIndex`.

Residual visual difference versus LABELATOR is font rasterization and anti-aliasing. This package does not try to close that gap.

A local stand-in for an external application is documented in [STELLANTIS_EXTERNAL_HOST_PROOF.md](./STELLANTIS_EXTERNAL_HOST_PROOF.md). That demo is not the Stellantis integration.

The product capability profile for this renderer is `PYTHON_RENDERER_PROFILE` in LABELATOR. It describes this runtime. It is not a package field and it does not change drawing. Designer and `npm run audit:renderer-compatibility` compare a document with that profile. See [LABELATOR_DEVELOPER_INTEGRATION.md](./LABELATOR_DEVELOPER_INTEGRATION.md).

## Distribution

```text
LABELATOR
    ↓
.labelator export
    ↓
download / install
    ↓
external application
    ↓
Python renderer
```

Designer export packages the current working document. Templates and `/developers` download a published catalog file from `/downloads/labelator/`. Those files are static assets generated by `npm run publish:labelator` from `buildLabelatorPackage`. Production rendering does not read them from this repository. It reads the downloaded file.
