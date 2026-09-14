# Basic render

Offline example. No LABELATOR process, no network, no credentials.

The `.labelator` file is an exported package. This directory does not embed one. Use a package you already have, for example the Warehouse A3 golden package.

From the Laberator repository, after `pip install -e tools/labelator_renderer`:

```bash
labelator-render \
  --template artifacts/packages/Warehouse_A3_Final_v1.labelator \
  --data tools/labelator_renderer/examples/basic_render/rows.json \
  --output /tmp/warehouse-one.pdf
```

`rows.json` is a list of row objects. Keys match the package data contract (`reference`, `warehouse_code`, `packaging`, `barcode`, and the other Warehouse fields). An object with a `rows` array is also accepted.

Expected result: a one-page PDF, sticker size 420×297 mm, part number `73 580 423 50`, warehouse `WG6.99.123`, packaging image stem `X4202`, Code39 barcode of that warehouse code. The file will not be byte-identical to a LABELATOR PDF. Geometry and payload should match.
