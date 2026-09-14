"""Shape helpers matching LABELATOR document/shapes polygon semantics."""

from __future__ import annotations


def line_local_points(width: float, height: float) -> tuple[float, float, float, float]:
    if width >= height:
        return (0.0, height / 2.0, width, height / 2.0)
    return (width / 2.0, 0.0, width / 2.0, height)


def arrow_polygon(kind: str, width: float, height: float) -> list[float]:
    """Single arrow pointing right. Matches `arrowPolygon` in src/lib/shapes.ts."""
    w = max(width, 1.0)
    h = max(height, 1.0)
    if kind == "triangle":
        return [0, 0, w, h / 2, 0, h]
    if kind == "pentagon":
        return [0, 0, w * 0.62, 0, w, h / 2, w * 0.62, h, 0, h]
    if kind == "barbed":
        neck = w * 0.58
        return [0, 0, neck, 0, w, h / 2, neck, h, 0, h, w * 0.2, h / 2]
    if kind == "chevron":
        t = min(w * 0.38, h * 0.55)
        return [0, 0, t, 0, w, h / 2, t, h, 0, h, w - t, h / 2]
    if kind == "line":
        stem = max(h * 0.18, 1.0)
        head = min(w * 0.42, h)
        return [
            0, h / 2 - stem,
            w - head, h / 2 - stem,
            w - head, 0,
            w, h / 2,
            w - head, h,
            w - head, h / 2 + stem,
            0, h / 2 + stem,
        ]
    if kind == "open":
        head = min(w * 0.42, h)
        return [0, h / 2, w, h / 2, w - head, 0, w, h / 2, w - head, h]
    neck = w * 0.55
    return [0, h * 0.28, neck, h * 0.28, neck, 0, w, h / 2, neck, h, neck, h * 0.72, 0, h * 0.72]


def is_stroke_arrow(kind: str) -> bool:
    return kind == "open"


def double_arrow_polygon(kind: str, width: float, height: float) -> list[float]:
    w = max(width, 1.0)
    h = max(height, 1.0)
    cy = h / 2.0

    if kind == "line":
        head = min(w * 0.24, h)
        stem = max(h * 0.12, 1.0)
        return [
            0, cy,
            head, 0,
            head, cy - stem,
            w - head, cy - stem,
            w - head, 0,
            w, cy,
            w - head, h,
            w - head, cy + stem,
            head, cy + stem,
            head, h,
        ]

    # triangle (default for A3 Warehouse filled doubleArrow)
    head = min(w * 0.34, h)
    stem = h * 0.2
    return [
        0, cy,
        head, 0,
        head, cy - stem,
        w - head, cy - stem,
        w - head, 0,
        w, cy,
        w - head, h,
        w - head, cy + stem,
        head, cy + stem,
        head, h,
    ]


def pairs(points: list[float]) -> list[tuple[float, float]]:
    return [(points[i], points[i + 1]) for i in range(0, len(points), 2)]
