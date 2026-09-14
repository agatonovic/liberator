# External host demo

This is not Stellantis and not LABELATOR. It is a local stand-in for an application that already has production rows and an installed `.labelator` file.

## Design time vs production

```text
DESIGN TIME
    LABELATOR
        ↓
    .labelator file

PRODUCTION
    external Python application
        +
    installed .labelator file
        +
    production data
        ↓
    labelator_renderer
        ↓
    PDF
```

LABELATOR does not need to be running during production rendering.

The template owns layout, bindings, fonts, and assets. The host owns the rows. This demo does not duplicate transforms, barcodes, or fonts.

## What is installed

`templates/Warehouse_A3_Final_v1.labelator` is a copy of a validated package. The host reads only that file. It does not open LABELATOR's `artifacts/` directory, `data/library.json`, or the TypeScript tree.

`data/labels.json` is host-owned production data: three Warehouse A3 rows, the same values as the established golden so the PDF can be compared.

## Run

```bash
pip install -e tools/labelator_renderer
python tools/stellantis_host_demo/app.py
```

Writes `output/labels.pdf`. The command can be run from any working directory. Paths are next to `app.py`.

The only LABELATOR-related dependency is the `labelator_renderer` package plus the installed `.labelator` file. The package needs Python, PyMuPDF, Pillow, and fontTools. It does not need npm, Next.js, a browser, or a network.
