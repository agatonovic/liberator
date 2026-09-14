# External host proof

This is a local simulation, not the Stellantis integration. No designer button, API, login, cloud, or callback was added.

## 1. What was simulated

An external Python application, `tools/stellantis_host_demo/`, installs one `.labelator` file and prints production rows through `labelator_renderer.render`.

## 2. What the host knows

- The path of an installed `.labelator` file
- Its own JSON rows
- The public call `render(template_package, data, output_pdf)`
- Optionally the package name from `validate_package`, used only to list `templates/*.labelator`

## 3. What it does not know

- LABELATOR source, Designer, IndexedDB, `data/library.json`
- Template ids as a rendering key
- How transforms, barcodes, fonts, or sheet placement are implemented
- How to launch a browser or synchronize templates

## 4. Where the package lives

`tools/stellantis_host_demo/templates/Warehouse_A3_Final_v1.labelator`

That is a byte copy of the validated Warehouse package (`sha256` `b071cd8b0c6892aa26d52ab91ad849604e7140eefa2f3a902a2b58b44291e260`). The host does not read `artifacts/` at runtime.

## 5. Where data comes from

`tools/stellantis_host_demo/data/labels.json`. The host owns these three rows. The package owns layout and bindings. The rows are the established Warehouse A3 golden values so the PDF can be compared.

## 6. How rendering is invoked

`app.py` calls `labelator_renderer.render`. It does not reimplement drawing.

## 7. Where the PDF is produced

`tools/stellantis_host_demo/output/labels.pdf`

Run: `python tools/stellantis_host_demo/app.py`

## 8. Golden comparison

Three pages. 150 dpi raster is identical to the pre-packaging Warehouse A3 Python golden (`artifacts/golden/phase_i_before/warehouse_a3.pdf`).

Compared with the existing comparison tool against the LABELATOR reference, the accepted figures are unchanged: SSIM 0.9332 / 0.9033 / 0.9345, mean abs 0.0272 / 0.0383 / 0.0268. That difference is still font rasterization, not a host-specific path.

PDF bytes are not identical (1464007 vs 1464008). Raster identity is the check.

## 9. Offline

The host was run with `socket.create_connection` blocked. It still wrote the PDF. The same command was repeated from `/tmp/stellantis-host-iMap/host`, which contained only `app.py`, `templates/`, `data/`, and a copy of the renderer package. No `data/library.json`, no `src/`, no npm. It produced a 3-page PDF.

## 10. Remaining integration questions

Not solved here:

- How does Stellantis launch LABELATOR Designer?
- How does a user select or create a template?
- How is a `.labelator` file transferred into the host?
- Where does the host store installed templates in production?
- How are template versions managed and updated?
- Does the host need to display template metadata?
- Does Stellantis eventually want API-based synchronization?
- How is template compatibility communicated?
- How does the host choose a template for a production job?

## Dependency boundary

The host needs Python, the `labelator_renderer` package (PyMuPDF, Pillow, fontTools), the installed `.labelator` file, and its own JSON. An editable install inside this repository still points at `tools/labelator_renderer/src`. That is a Python package path, not a LABELATOR runtime. The `/tmp` run used a copied package tree and did not import the application.

LABELATOR does not need to be running.
