#!/usr/bin/env python3
"""Engine tests. No LABELATOR runtime. Canonical package: tools/labelator_renderer."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools" / "labelator_renderer" / "src"))

from labelator_renderer import render  # noqa: E402
from labelator_renderer.code128 import encode_code128  # noqa: E402
from labelator_renderer.code39 import encode_code39, module_width_px, print_px  # noqa: E402
from labelator_renderer.fonts import load_fitz_font  # noqa: E402
from labelator_renderer.layout import layout_runs  # noqa: E402
from labelator_renderer.package import load_package, resolve_font_path  # noqa: E402
from labelator_renderer.pose import display_pose  # noqa: E402
from labelator_renderer.resolve import (  # noqa: E402
    apply_barcode_pct,
    format_part_number,
    ga_magacin_prefix_spans,
    parse_ga_address,
)
from labelator_renderer.sheet import compute_slot_origins  # noqa: E402
from labelator_renderer.text_spans import CharStyle, runs_from_content, transfer_spans  # noqa: E402


class PartNumberTests(unittest.TestCase):
    def test_groups(self):
        self.assertEqual(format_part_number("7358042350"), "73 580 423 50")
        self.assertEqual(format_part_number("73 580 423 50"), "73 580 423 50")


class Code39Tests(unittest.TestCase):
    def test_module_counts_match_jsbarcode_probe(self):
        # Frozen against JsBarcode CODE39 width=1, margin=0, displayValue=false.
        self.assertEqual(len(encode_code39("WG6.99.123")), 192)
        self.assertEqual(len(encode_code39("WG1D.01.001")), 208)
        self.assertEqual(len(encode_code39("HB9A.011.001")), 224)

    def test_module_width_and_print_px(self):
        binary = encode_code39("WG6.99.123")
        dest_w = print_px(414.3155331137425)
        self.assertEqual(module_width_px(dest_w, binary), max(1, round(dest_w / 192)))
        self.assertEqual(print_px(25.4), 300)


class LayoutTests(unittest.TestCase):
    def test_part_number_spans_are_independently_centered(self):
        designed = "98 456 445 94"
        spans = [
            {"start": 0, "end": 2, "fontSizeMm": 45},
            {"start": 3, "end": 7, "fontSizeMm": 66},
            {"start": 7, "end": 10, "fill": "#FF2600", "fontSizeMm": 66},
            {"start": 11, "end": 13, "fontSizeMm": 45},
        ]
        value = "73 580 423 50"
        defaults = CharStyle("#12263A", 59.7)
        transferred = transfer_spans(designed, spans, value, defaults)
        runs = runs_from_content(value, defaults, transferred)
        placed = layout_runs(
            [(run.text, run.fill, run.font_size_mm) for run in runs],
            box_w=400,
            box_h=13.8,
            letter_spacing=-0.9,
            line_height=1,
            align="center",
            vertical_align="middle",
            measure=lambda text, size: len(text) * size * 0.5,
        )
        by_text = {run.text: run for run in placed}
        self.assertEqual(by_text["423"].fill, "#FF2600")
        self.assertGreater(by_text["580"].font_size, by_text["73"].font_size)
        # Smaller run is vertically centered in the line, not forced onto the large baseline.
        self.assertNotAlmostEqual(by_text["50"].y + by_text["50"].font_size, by_text["580"].y + by_text["580"].font_size)


class FontTests(unittest.TestCase):
    def test_packaged_fonts_load_without_system_fallback(self):
        pkg = load_package(ROOT / "artifacts/packages/Warehouse_A3_Final_v1.labelator")
        for family, weight in (
            ("Artifakt Element Black", 700),
            ("Open Sans", 400),
            ("Open Sans", 700),
        ):
            path = resolve_font_path(pkg, family, weight)
            font = load_fitz_font(path)
            width = font.text_length("A3", fontsize=12)
            self.assertGreater(width, 0)


class RotationTests(unittest.TestCase):
    def test_clockwise_top_left_pivot_matches_konva_convention(self):
        # Konva rotation is clockwise around the element's top-left.
        # A point at local (w, 0) rotated 90° clockwise lands at local (0, -w)
        # in a y-up frame, which is (0, w) in y-down. This is the pivot the renderer uses.
        import math

        w = 40.0
        # clockwise 90° around origin in y-down: (x, y) -> (y, -x)
        x, y = w, 0.0
        rad = math.radians(90)
        xr = x * math.cos(rad) + y * math.sin(rad)
        yr = -x * math.sin(rad) + y * math.cos(rad)
        self.assertAlmostEqual(xr, 0.0, places=5)
        self.assertAlmostEqual(yr, -w, places=5)


class GaAddressTransformTests(unittest.TestCase):
    def test_parse_and_prefix(self):
        self.assertEqual(parse_ga_address("HB9A.011.001"), ("HB9", "A", "011", "001"))
        self.assertEqual(parse_ga_address("RHB9A.012.003"), ("RHB9", "A", "012", "003"))
        self.assertEqual(parse_ga_address("X.1.2"), ("", "X", "1", "2"))
        self.assertEqual(parse_ga_address("123456789.011.001"), ("123456789", "", "011", "001"))
        self.assertEqual(parse_ga_address("NOT-AN-ADDRESS"), ("NOT-AN-ADDRESS", "", "", ""))
        self.assertEqual(parse_ga_address("HB1A.011.001%"), ("HB1", "A", "011", "001"))
        spans = ga_magacin_prefix_spans("RHB9", [])
        self.assertEqual(spans, [{"start": 0, "end": 1, "fill": "#FF0000"}])
        self.assertEqual(ga_magacin_prefix_spans("HB9", []), [])
        self.assertEqual(ga_magacin_prefix_spans("R", []), [])

    def test_code128_module_counts_match_jsbarcode_probe(self):
        # Frozen against JsBarcode CODE128 width=1, margin=0, displayValue=false.
        self.assertEqual(len(encode_code128("HB9A.011.001")), 167)
        self.assertEqual(len(encode_code128("RHB9A.012.003")), 178)
        self.assertEqual(len(encode_code128("X.1.2")), 90)
        self.assertEqual(len(encode_code128("123456789.011.001")), 189)
        self.assertEqual(len(encode_code128("PLAIN-39")), 123)
        self.assertEqual(len(encode_code128("NOT-AN-ADDRESS")), 189)

    def test_up_arrow_rotates_around_center(self):
        element = {
            "type": "arrow",
            "x": 388.3,
            "y": 28.1,
            "width": 24.316,
            "height": 23.537,
            "rotation": 90,
            "binding": "arrow",
            "transform": "arrow",
            "content": "DOWN",
        }
        self.assertEqual(display_pose(element, "DOWN")["rotation"], 90)
        flipped = display_pose(element, "UP")
        self.assertEqual(flipped["rotation"], 270)
        self.assertAlmostEqual(flipped["x"], 364.76, places=2)
        self.assertAlmostEqual(flipped["y"], 52.42, places=2)


class BarcodePctTests(unittest.TestCase):
    def test_appends_percent_without_scaling(self):
        element = {"type": "barcode", "transform": "barcode_pct", "width": 412.84, "height": 85.64}
        self.assertEqual(apply_barcode_pct(element, "WG1D.11.014"), "WG1D.11.014%")
        self.assertEqual(apply_barcode_pct(element, "WG1D.11.014%"), "WG1D.11.014%")
        self.assertEqual(apply_barcode_pct(element, "100%"), "100%")
        self.assertEqual(apply_barcode_pct(element, "0"), "0%")
        self.assertEqual(apply_barcode_pct(element, "%"), "%")
        self.assertEqual(apply_barcode_pct(element, "  AB  "), "AB%")
        self.assertEqual(apply_barcode_pct(element, ""), "")
        self.assertEqual(apply_barcode_pct(element, "   "), "")
        self.assertEqual(element["width"], 412.84)
        self.assertEqual(element["height"], 85.64)


class SheetAndPoseTests(unittest.TestCase):
    def test_two_up_origins_are_centered(self):
        origins = compute_slot_origins(
            {"pageSize": "A4-landscape", "columns": 1, "rows": 2, "gapMm": 0, "marginMm": 4},
            254,
            68,
        )
        self.assertEqual(len(origins), 2)
        self.assertAlmostEqual(origins[0][0], 21.5)
        self.assertAlmostEqual(origins[0][1], 37)
        self.assertAlmostEqual(origins[1][1], 105)

    def test_negative_rotation_arrow_flips_around_center(self):
        element = {
            "type": "arrow",
            "x": 7.6,
            "y": 17,
            "width": 13.85,
            "height": 12.17,
            "rotation": -90,
            "binding": "arrow",
            "transform": "arrow",
            "content": "UP",
        }
        self.assertEqual(display_pose(element, "UP")["rotation"], -90)
        flipped = display_pose(element, "DOWN")
        self.assertEqual(flipped["rotation"], 90)


class PackageRenderTests(unittest.TestCase):
    def test_render_from_package_only(self):
        pkg = ROOT / "artifacts/packages/Warehouse_A3_Final_v1.labelator"
        data = ROOT / "tests/fixtures/warehouse_a3_golden.json"
        self.assertTrue(pkg.exists())
        loaded = load_package(pkg)
        self.assertEqual(loaded.manifest["format"], "labelator.package")
        self.assertEqual(loaded.document["page"]["widthMm"], 420)
        rows = json.loads(data.read_text())["rows"]
        out = ROOT / "artifacts/golden/warehouse_a3_python.pdf"
        out.parent.mkdir(parents=True, exist_ok=True)
        render(pkg, rows, out)
        self.assertGreater(out.stat().st_size, 10_000)

    def test_render_second_template_from_package_only(self):
        pkg = ROOT / "artifacts/packages/GA_Address_v1.labelator"
        data = ROOT / "tests/fixtures/ga_address_golden.json"
        self.assertTrue(pkg.exists(), "run the GA Address package export before the Python golden render")
        loaded = load_package(pkg)
        self.assertEqual(loaded.manifest["format"], "labelator.package")
        self.assertEqual(loaded.document["page"]["widthMm"], 408.98)
        self.assertNotIn("0a9b4a95", json.dumps(loaded.manifest.get("requiredTransforms")))
        rows = json.loads(data.read_text())["rows"]
        out = ROOT / "artifacts/golden/ga_address_python.pdf"
        out.parent.mkdir(parents=True, exist_ok=True)
        render(pkg, rows, out)
        self.assertGreater(out.stat().st_size, 2_000)

    def test_render_sheet_template_from_package_only(self):
        pkg = ROOT / "artifacts/packages/FIXED_GA_A4_v1.labelator"
        data = ROOT / "tests/fixtures/fixed_ga_a4_golden.json"
        self.assertTrue(pkg.exists(), "run the FIXED GA A4 package export before the Python golden render")
        loaded = load_package(pkg)
        self.assertEqual(loaded.manifest.get("print", {}).get("mode"), "sheet")
        self.assertEqual(loaded.document["page"]["widthMm"], 254)
        rows = json.loads(data.read_text())["rows"]
        out = ROOT / "artifacts/golden/fixed_ga_a4_python.pdf"
        out.parent.mkdir(parents=True, exist_ok=True)
        render(pkg, rows, out)
        self.assertGreater(out.stat().st_size, 2_000)

    def test_render_canopy_from_package_without_system_inter(self):
        pkg_path = ROOT / "artifacts/packages/Canopy_A3_3_PN_v1.labelator"
        data = ROOT / "tests/fixtures/canopy_a3_3pn_golden.json"
        self.assertTrue(pkg_path.exists(), "run the Canopy package export before the Python golden render")
        loaded = load_package(pkg_path)
        font = resolve_font_path(loaded, "Inter", 700)
        self.assertTrue(str(font).startswith(str(loaded.root)))
        self.assertGreater(load_fitz_font(font).text_length("MAGACIN", fontsize=12), 0)
        rows = json.loads(data.read_text())["rows"]
        out = ROOT / "artifacts/golden/canopy_a3_3pn_python.pdf"
        out.parent.mkdir(parents=True, exist_ok=True)
        render(pkg_path, rows, out)
        self.assertGreater(out.stat().st_size, 4_000)

    def test_render_cdc_and_canopy_1pn_from_package_only(self):
        import hashlib
        import socket
        import zipfile

        cases = [
            (
                ROOT / "artifacts/packages/CDC_A3_v1.labelator",
                ROOT / "tests/fixtures/cdc_a3_golden.json",
                ROOT / "artifacts/golden/cdc_a3_python.pdf",
                ["barcode_pct"],
            ),
            (
                ROOT / "artifacts/packages/Canopy_A3_1_PN_v1.labelator",
                ROOT / "tests/fixtures/canopy_a3_1pn_golden.json",
                ROOT / "artifacts/golden/canopy_a3_1pn_python.pdf",
                ["barcode_pct", "part_number"],
            ),
        ]

        def blocked(*_args, **_kwargs):
            raise AssertionError("renderer attempted a network connection")

        original = socket.create_connection
        socket.create_connection = blocked  # type: ignore[assignment]
        try:
            for pkg_path, data_path, out, transforms in cases:
                self.assertTrue(pkg_path.exists(), f"export {pkg_path.name} before the Python golden render")
                loaded = load_package(pkg_path)
                self.assertEqual(loaded.manifest.get("requiredTransforms"), transforms)
                self.assertNotIn("print", loaded.manifest)
                self.assertTrue((loaded.root / "manifest.json").is_file())
                self.assertTrue((loaded.root / "template.json").is_file())
                self.assertTrue((loaded.root / "assets" / "index.json").is_file())
                for font in loaded.manifest.get("fonts", []):
                    path = resolve_font_path(loaded, font["family"], int(font["weight"]))
                    digest = hashlib.sha256(path.read_bytes()).hexdigest()
                    self.assertEqual(digest, font["sha256"])
                    self.assertTrue(str(path).startswith(str(loaded.root)))
                rows = json.loads(data_path.read_text())["rows"]
                out.parent.mkdir(parents=True, exist_ok=True)
                render(pkg_path, rows, out)
                unpacked = out.with_name(out.stem + "_unpacked.pdf")
                render(loaded.root, rows, unpacked)
                self.assertGreater(out.stat().st_size, 2_000)
                self._assert_same_rasters(out, unpacked)
                with zipfile.ZipFile(pkg_path) as zf:
                    names = set(zf.namelist())
                self.assertIn("manifest.json", names)
                self.assertIn("template.json", names)
                self.assertIn("assets/index.json", names)
        finally:
            socket.create_connection = original

    def _assert_same_rasters(self, left, right) -> None:
        import fitz

        a = fitz.open(left)
        b = fitz.open(right)
        self.assertEqual(a.page_count, b.page_count)
        for i in range(a.page_count):
            pa = a[i].get_pixmap(matrix=fitz.Matrix(72 / 72, 72 / 72), alpha=False)
            pb = b[i].get_pixmap(matrix=fitz.Matrix(72 / 72, 72 / 72), alpha=False)
            self.assertEqual(pa.samples, pb.samples)
        a.close()
        b.close()


if __name__ == "__main__":
    unittest.main()
