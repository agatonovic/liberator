"""Generic LabelDocument → PDF renderer for packaged .labelator templates."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import fitz

from .code128 import render_code128_png
from .code39 import print_px, render_code39_png
from .fonts import load_fitz_font
from .layout import fit_plain_font_size, layout_runs, wrap_plain_lines
from .package import LabelatorPackage, collection_for_folder, load_package, resolve_asset, resolve_font_path
from .pose import display_pose
from .resolve import ga_magacin_prefix_spans, resolve_value
from .shapes import arrow_polygon, double_arrow_polygon, is_stroke_arrow, line_local_points, pairs
from .sheet import compute_slot_origins, sheet_page_mm
from .text_spans import CharStyle, runs_from_content, transfer_spans


MM_TO_PT = 72.0 / 25.4


def mm(value: float) -> float:
    return value * MM_TO_PT


def parse_color(value: str | None, default=(0.07, 0.15, 0.23)) -> tuple[float, float, float]:
    if not value or value in ("transparent", "none"):
        return default
    text = value.strip()
    if text.startswith("#") and len(text) >= 7:
        return (int(text[1:3], 16) / 255.0, int(text[3:5], 16) / 255.0, int(text[5:7], 16) / 255.0)
    return default


def is_paint(value: str | None) -> bool:
    return bool(value) and value.strip().lower() not in ("transparent", "none", "")


class Renderer:
    """
    PyMuPDF page coordinates: origin top-left, Y increases downward — same as LABELATOR/Konva mm space.
    Only scale mm → points; do not flip Y.
    """

    def __init__(self, pkg: LabelatorPackage):
        self.pkg = pkg
        self.doc = pkg.document
        self.columns = list(self.doc.get("dataColumns") or [])
        self._fonts: dict[tuple[str, int], fitz.Font] = {}

    def font(self, family: str | None, weight: str | None) -> fitz.Font:
        fam = (family or "Open Sans").strip()
        w = 700 if weight == "bold" else 400
        key = (fam, w)
        if key not in self._fonts:
            self._fonts[key] = load_fitz_font(resolve_font_path(self.pkg, fam, w))
        return self._fonts[key]

    def _print_mode(self) -> str:
        job = self.pkg.manifest.get("print") or {}
        return str(job.get("mode") or "label")

    def render(self, rows: list[dict[str, str]], output: str | Path) -> Path:
        output = Path(output)
        output.parent.mkdir(parents=True, exist_ok=True)
        pdf = fitz.open()
        label_w = float(self.doc["page"]["widthMm"])
        label_h = float(self.doc["page"]["heightMm"])
        data_rows: list[dict[str, str] | None] = list(rows) if rows else [None]
        sheet = self.doc.get("sheet") if self._print_mode() == "sheet" else None
        origins = compute_slot_origins(sheet, label_w, label_h) if isinstance(sheet, dict) else []
        paper = sheet_page_mm(str(sheet.get("pageSize"))) if isinstance(sheet, dict) and origins else None
        if paper and origins:
            slots = len(origins)
            for start in range(0, len(data_rows), slots):
                page = pdf.new_page(width=mm(paper[0]), height=mm(paper[1]))
                for index, row in enumerate(data_rows[start : start + slots]):
                    self._draw_label(page, row, origins[index])
        else:
            for row in data_rows:
                page = pdf.new_page(width=mm(label_w), height=mm(label_h))
                self._draw_label(page, row, (0.0, 0.0))
        pdf.save(str(output), deflate=True)
        pdf.close()
        return output

    def _draw_label(self, page: fitz.Page, row: dict[str, str] | None, origin: tuple[float, float] = (0.0, 0.0)) -> None:
        for element in self.doc.get("elements") or []:
            if element.get("hidden"):
                continue
            value = resolve_value(element, row, self.columns)
            self._draw_element(page, element, value, origin)

    def _box(self, el: dict[str, Any]) -> fitz.Rect:
        x = mm(float(el.get("x") or 0))
        y = mm(float(el.get("y") or 0))
        w = mm(float(el.get("width") or 0))
        h = mm(max(float(el.get("height") or 0), 0.2))
        return fitz.Rect(x, y, x + w, y + h)

    def _morph(self, box: fitz.Rect, rot: float):
        if not rot:
            return None
        # Konva rotation is clockwise around top-left; PyMuPDF Matrix is CCW.
        return (fitz.Point(box.x0, box.y0), fitz.Matrix(-rot))

    def _draw_element(self, page: fitz.Page, el: dict[str, Any], value: str, origin: tuple[float, float] = (0.0, 0.0)) -> None:
        pose = display_pose(el, value)
        box = self._box({**el, "x": pose["x"] + origin[0], "y": pose["y"] + origin[1]})
        rot = float(pose["rotation"] or 0)
        style = el.get("style") or {}
        opacity = float(style.get("opacity") if style.get("opacity") is not None else 1)
        etype = el.get("type")
        if etype == "rect":
            self._draw_rect(page, box, style, rot, opacity)
        elif etype == "line":
            self._draw_line(page, box, style, rot, opacity)
        elif etype == "arrow":
            self._draw_arrow(page, box, style, rot, opacity)
        elif etype == "doubleArrow":
            self._draw_double_arrow(page, box, style, rot, opacity)
        elif etype == "text":
            if value.strip():
                self._draw_text(page, box, el, value, rot, opacity)
        elif etype == "barcode":
            if value.strip():
                self._draw_barcode(page, box, el, value)
        elif etype == "image":
            self._draw_image(page, box, el, value)

    def _draw_rect(self, page, box, style, rot, opacity) -> None:
        fill = parse_color(style.get("fill")) if is_paint(style.get("fill")) else None
        stroke = parse_color(style.get("stroke")) if is_paint(style.get("stroke")) else None
        sw = mm(float(style.get("strokeWidth") or 0)) if stroke else 0
        shape = page.new_shape()
        shape.draw_rect(box)
        shape.finish(
            color=stroke,
            fill=fill,
            width=sw,
            stroke_opacity=opacity,
            fill_opacity=opacity,
            morph=self._morph(box, rot),
        )
        shape.commit()

    def _draw_line(self, page, box, style, rot, opacity) -> None:
        if not is_paint(style.get("stroke")):
            return
        stroke = parse_color(style.get("stroke"))
        sw = mm(float(style.get("strokeWidth") or 0.4))
        x0, y0, x1, y1 = line_local_points(box.width / MM_TO_PT, box.height / MM_TO_PT)
        p0 = fitz.Point(box.x0 + mm(x0), box.y0 + mm(y0))
        p1 = fitz.Point(box.x0 + mm(x1), box.y0 + mm(y1))
        shape = page.new_shape()
        shape.draw_line(p0, p1)
        shape.finish(color=stroke, width=sw, stroke_opacity=opacity, morph=self._morph(box, rot))
        shape.commit()

    def _draw_polygon(self, page, box, style, rot, opacity, points: list[float], *, close: bool) -> None:
        pts = pairs(points)
        pdf_pts = [fitz.Point(box.x0 + mm(px), box.y0 + mm(py)) for px, py in pts]
        fill = parse_color(style.get("fill")) if is_paint(style.get("fill")) and close else None
        stroke = parse_color(style.get("stroke")) if is_paint(style.get("stroke")) else None
        sw = mm(float(style.get("strokeWidth") or 0)) if stroke else 0
        shape = page.new_shape()
        shape.draw_polyline(pdf_pts)
        shape.finish(
            color=stroke,
            fill=fill,
            width=sw,
            closePath=close,
            stroke_opacity=opacity,
            fill_opacity=opacity,
            morph=self._morph(box, rot),
        )
        shape.commit()

    def _draw_arrow(self, page, box, style, rot, opacity) -> None:
        kind = style.get("arrowKind") or "block"
        points = arrow_polygon(kind, box.width / MM_TO_PT, box.height / MM_TO_PT)
        self._draw_polygon(page, box, style, rot, opacity, points, close=not is_stroke_arrow(kind))

    def _draw_double_arrow(self, page, box, style, rot, opacity) -> None:
        kind = style.get("arrowKind") or "block"
        points = double_arrow_polygon(kind, box.width / MM_TO_PT, box.height / MM_TO_PT)
        self._draw_polygon(page, box, style, rot, opacity, points, close=not is_stroke_arrow(kind))

    def _draw_text(self, page, box, el, value: str, rot, opacity) -> None:
        style = el.get("style") or {}
        font = self.font(style.get("fontFamily"), style.get("fontWeight"))
        designed = el.get("content") or ""
        defaults = CharStyle(fill=style.get("fill") or "#12263A", font_size_mm=float(style.get("fontSizeMm") or 4))
        spans = el.get("spans")
        transferred = transfer_spans(designed, spans, value, defaults) if designed else (spans or [])
        if (el.get("transform") or "") == "ga_magacin":
            transferred = ga_magacin_prefix_spans(value, transferred)
        letter_spacing = mm(float(style.get("letterSpacingMm") or 0))
        align = style.get("align") or "left"
        valign = style.get("verticalAlign") or "middle"
        line_height = float(style.get("lineHeight") or 1)

        def measure(text: str, size: float) -> float:
            if not text:
                return 0.0
            return font.text_length(text, fontsize=size)

        if transferred:
            runs = runs_from_content(value, defaults, transferred)
            layout_input = [(run.text, run.fill, mm(run.font_size_mm)) for run in runs]
            placed = layout_runs(
                layout_input,
                box.width,
                box.height,
                letter_spacing,
                line_height,
                align,
                valign,
                measure,
            )
            for run in placed:
                # pdf.ts: y = box.y + height - run.y - fontSize (PDF y-up baseline)
                # PyMuPDF y-down baseline:
                baseline = box.y0 + run.y + run.font_size
                self._draw_spaced(page, font, run.text, box.x0 + run.x, baseline, run.font_size, letter_spacing, parse_color(run.fill), box, rot, opacity)
            return

        designed_size = mm(float(style.get("fontSizeMm") or 4))
        size = fit_plain_font_size(
            value,
            designed,
            box.width,
            box.height,
            designed_size,
            mm(0.5),
            letter_spacing,
            line_height,
            measure,
        )
        lines = wrap_plain_lines(value, box.width, size, letter_spacing, measure)
        line_height_pt = size * line_height
        block_height = len(lines) * line_height_pt
        color = parse_color(style.get("fill"))
        for index, line in enumerate(lines):
            line_width = measure(line, size) + letter_spacing * max(0, len(line) - 1)
            if align == "center":
                line_x = box.x0 + (box.width - line_width) / 2
            elif align == "right":
                line_x = box.x0 + box.width - line_width
            else:
                line_x = box.x0
            line_x = max(box.x0, line_x)
            if valign == "top":
                baseline = box.y0 + size + index * line_height_pt
            elif valign == "bottom":
                baseline = box.y0 + box.height - block_height + size + index * line_height_pt
            else:
                baseline = box.y0 + box.height / 2 - block_height / 2 + size + index * line_height_pt
            self._draw_spaced(page, font, line, line_x, baseline, size, letter_spacing, color, box, rot, opacity)

    def _draw_spaced(self, page, font, text, x, baseline, size, letter_spacing, color, box, rot, opacity) -> None:
        tw = fitz.TextWriter(page.rect, color=color)
        pos = fitz.Point(x, baseline)
        if abs(letter_spacing) >= 0.001 and len(text) > 1:
            for char in text:
                tw.append(pos, char, font=font, fontsize=size)
                pos = fitz.Point(pos.x + font.text_length(char, fontsize=size) + letter_spacing, pos.y)
        else:
            tw.append(pos, text, font=font, fontsize=size)
        tw.write_text(page, morph=self._morph(box, rot), opacity=opacity)

    def _draw_barcode(self, page, box, el, value: str) -> None:
        style = el.get("style") or {}
        symbology = (style.get("barcodeSymbology") or "code128").strip().lower()
        width_px = print_px(box.width / MM_TO_PT)
        height_px = print_px(box.height / MM_TO_PT)
        display = bool(style.get("barcodeDisplayValue"))
        if symbology == "code39":
            png = render_code39_png(value, width_px, height_px, display_value=display)
        elif symbology == "code128":
            png = render_code128_png(value, width_px, height_px, display_value=display)
        else:
            raise NotImplementedError(f"Unsupported barcode symbology '{symbology}'")
        page.insert_image(box, stream=png, keep_proportion=False, overlay=True)

    def _draw_image(self, page, box, el, value: str) -> None:
        if not value.strip():
            return
        folder = el.get("assetFolderId")
        collection = collection_for_folder(self.pkg, folder) or "packaging"
        binding = (el.get("binding") or "").strip().lower()
        if binding == "packaging":
            collection = "packaging"
        path = resolve_asset(self.pkg, collection, value)
        if not path:
            return
        page.insert_image(box, filename=str(path), keep_proportion=False, overlay=True)


def render(template_package: str | Path, data: list[dict[str, str]] | str | Path, output_pdf: str | Path) -> Path:
    pkg = load_package(template_package)
    if isinstance(data, (str, Path)):
        payload = json.loads(Path(data).read_text(encoding="utf-8"))
        rows = payload["rows"] if isinstance(payload, dict) and "rows" in payload else payload
    else:
        rows = data
    return Renderer(pkg).render(rows, output_pdf)
