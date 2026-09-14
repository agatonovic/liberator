"""Distribution checks. Does not change the drawing engine."""

from __future__ import annotations

import socket
import tempfile
import unittest
import zipfile
from pathlib import Path

import fitz

from labelator_renderer import __version__, render, validate_package
from labelator_renderer.cli import EXIT_DATA, EXIT_PACKAGE, main
from labelator_renderer.errors import PackageValidationError

ROOT = Path(__file__).resolve().parents[3]
BEFORE = ROOT / "artifacts/golden/phase_i_before"
PACKAGES = [
    ("warehouse_a3", "artifacts/packages/Warehouse_A3_Final_v1.labelator", "tests/fixtures/warehouse_a3_golden.json", 3),
    ("ga_address", "artifacts/packages/GA_Address_v1.labelator", "tests/fixtures/ga_address_golden.json", 6),
    ("fixed_ga_a4", "artifacts/packages/FIXED_GA_A4_v1.labelator", "tests/fixtures/fixed_ga_a4_golden.json", 3),
    ("canopy_a3_3pn", "artifacts/packages/Canopy_A3_3_PN_v1.labelator", "tests/fixtures/canopy_a3_3pn_golden.json", 6),
    ("cdc_a3", "artifacts/packages/CDC_A3_v1.labelator", "tests/fixtures/cdc_a3_golden.json", 6),
    ("canopy_a3_1pn", "artifacts/packages/Canopy_A3_1_PN_v1.labelator", "tests/fixtures/canopy_a3_1pn_golden.json", 6),
]


def _rasters_equal(left: Path, right: Path) -> None:
    a = fitz.open(left)
    b = fitz.open(right)
    if a.page_count != b.page_count:
        raise AssertionError(f"page count {a.page_count} != {b.page_count}")
    zoom = 150 / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    for i in range(a.page_count):
        pa = a[i].get_pixmap(matrix=matrix, alpha=False)
        pb = b[i].get_pixmap(matrix=matrix, alpha=False)
        if pa.samples != pb.samples or pa.width != pb.width or pa.height != pb.height:
            raise AssertionError(f"page {i + 1} raster differs")
    a.close()
    b.close()


class DistributionTests(unittest.TestCase):
    def test_version_is_not_the_package_format(self):
        self.assertEqual(__version__, "0.1.0")
        manifest = validate_package(ROOT / "artifacts/packages/CDC_A3_v1.labelator")
        self.assertEqual(manifest["formatVersion"], 1)
        self.assertNotEqual(__version__, str(manifest["formatVersion"]))

    def test_six_templates_match_pre_package_rasters(self):
        for name, pkg, data, pages in PACKAGES:
            before = BEFORE / f"{name}.pdf"
            self.assertTrue(before.exists(), "phase_i_before snapshot missing")
            with tempfile.TemporaryDirectory() as tmp:
                out = Path(tmp) / f"{name}.pdf"
                render(ROOT / pkg, ROOT / data, out)
                doc = fitz.open(out)
                self.assertEqual(doc.page_count, pages)
                doc.close()
                _rasters_equal(before, out)
                unpacked = (ROOT / pkg).with_suffix("")
                out2 = Path(tmp) / f"{name}-dir.pdf"
                render(unpacked, ROOT / data, out2)
                _rasters_equal(out, out2)
                again = Path(tmp) / f"{name}-again.pdf"
                render(ROOT / pkg, ROOT / data, again)
                _rasters_equal(out, again)

    def test_cli_matches_engine_on_warehouse(self):
        pkg = ROOT / "artifacts/packages/Warehouse_A3_Final_v1.labelator"
        data = ROOT / "tests/fixtures/warehouse_a3_golden.json"
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "cli.pdf"
            code = main(["--template", str(pkg), "--data", str(data), "--output", str(out)])
            self.assertEqual(code, 0)
            self.assertTrue(out.is_file())
            doc = fitz.open(out)
            self.assertEqual(doc.page_count, 3)
            doc.close()
            _rasters_equal(BEFORE / "warehouse_a3.pdf", out)

    def test_cli_errors_are_not_tracebacks(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / "nope.labelator"
            code = main(["--template", str(missing), "--data", str(ROOT / "tests/fixtures/cdc_a3_golden.json"), "--output", str(Path(tmp) / "x.pdf")])
            self.assertEqual(code, EXIT_PACKAGE)
            bad = Path(tmp) / "bad.json"
            bad.write_text("{", encoding="utf-8")
            code = main(["--template", str(ROOT / "artifacts/packages/CDC_A3_v1.labelator"), "--data", str(bad), "--output", str(Path(tmp) / "x.pdf")])
            self.assertEqual(code, EXIT_DATA)

    def test_missing_font_is_named(self):
        src = ROOT / "artifacts/packages/CDC_A3_v1.labelator"
        with tempfile.TemporaryDirectory() as tmp:
            broken = Path(tmp) / "broken.labelator"
            with zipfile.ZipFile(src) as zin, zipfile.ZipFile(broken, "w") as zout:
                for info in zin.infolist():
                    if info.filename.endswith("OpenSans-Bold.woff"):
                        continue
                    zout.writestr(info, zin.read(info.filename))
            with self.assertRaises(PackageValidationError) as ctx:
                validate_package(broken)
            self.assertIn("OpenSans-Bold.woff", str(ctx.exception))

    def test_render_with_network_blocked(self):
        def blocked(*_args, **_kwargs):
            raise AssertionError("network connect")

        original = socket.create_connection
        socket.create_connection = blocked  # type: ignore[assignment]
        try:
            with tempfile.TemporaryDirectory() as tmp:
                out = Path(tmp) / "off.pdf"
                render(
                    ROOT / "artifacts/packages/Canopy_A3_1_PN_v1.labelator",
                    ROOT / "tests/fixtures/canopy_a3_1pn_golden.json",
                    out,
                )
                self.assertGreater(out.stat().st_size, 1000)
        finally:
            socket.create_connection = original


if __name__ == "__main__":
    unittest.main()
