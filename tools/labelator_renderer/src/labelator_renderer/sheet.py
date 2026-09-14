"""Sheet slot placement matching LABELATOR `computeSlotOrigins` (y-down mm).

Not a template branch. Used only when the package print job asks for sheet mode.
"""

from __future__ import annotations

from typing import Any

SHEET_MM = {
    "A4": (210.0, 297.0),
    "A4-landscape": (297.0, 210.0),
    "A3": (297.0, 420.0),
    "A3-landscape": (420.0, 297.0),
    "letter": (215.9, 279.4),
}


def fit_label_on_sheet(
    label_w: float,
    label_h: float,
    page_size: str,
    gap_mm: float,
    margin_mm: float,
) -> tuple[int, int, bool]:
    page = SHEET_MM.get(page_size)
    if not page:
        return 0, 0, False
    available_w = max(0.0, page[0] - margin_mm * 2)
    available_h = max(0.0, page[1] - margin_mm * 2)
    gap = max(0.0, gap_mm)
    fits = label_w <= available_w + 0.05 and label_h <= available_h + 0.05
    if not fits:
        return 0, 0, False
    columns = max(1, int((available_w + gap) // (label_w + gap)))
    rows = max(1, int((available_h + gap) // (label_h + gap)))
    return columns, rows, True


def compute_slot_origins(sheet: dict[str, Any], label_w: float, label_h: float) -> list[tuple[float, float]]:
    page_size = str(sheet.get("pageSize") or "")
    page = SHEET_MM.get(page_size)
    if not page:
        return []
    margin = float(sheet.get("marginMm") or 0)
    gap = float(sheet.get("gapMm") or 0)
    fitted_cols, fitted_rows, fits = fit_label_on_sheet(label_w, label_h, page_size, gap, margin)
    if not fits:
        return []
    columns = min(max(1, int(sheet.get("columns") or 1)), fitted_cols)
    rows = min(max(1, int(sheet.get("rows") or 1)), fitted_rows)
    used_w = columns * label_w + max(0, columns - 1) * gap
    used_h = rows * label_h + max(0, rows - 1) * gap
    x0 = max(0.0, (page[0] - used_w) / 2)
    y0 = max(0.0, (page[1] - used_h) / 2)
    origins: list[tuple[float, float]] = []
    for row in range(rows):
        for col in range(columns):
            origins.append((x0 + col * (label_w + gap), y0 + row * (label_h + gap)))
    return origins


def sheet_page_mm(page_size: str) -> tuple[float, float] | None:
    return SHEET_MM.get(page_size)
