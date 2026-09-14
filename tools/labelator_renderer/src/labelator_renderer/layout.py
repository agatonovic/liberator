"""Text layout matching LABELATOR `layoutRuns` and plain-text PDF placement.

Coordinates are Y-down, origin at the element box top-left, units in PDF points
once font sizes have been converted with mm→pt.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class PlacedRun:
    text: str
    fill: str
    font_size: float
    x: float
    y: float
    width: float


def spaced_width(text: str, size: float, letter_spacing: float, measure) -> float:
    if not text:
        return 0.0
    return measure(text, size) + letter_spacing * max(0, len(text) - 1)


def wrap_plain_lines(text: str, max_width: float, size: float, letter_spacing: float, measure) -> list[str]:
    def width_of(value: str) -> float:
        return spaced_width(value, size, letter_spacing, measure)

    lines: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph:
            lines.append("")
            continue
        current = ""
        for word in paragraph.split(" "):
            nxt = f"{current} {word}" if current else word
            if not current or width_of(nxt) <= max_width:
                current = nxt
            else:
                lines.append(current)
                current = word
        if current:
            lines.append(current)
    return lines or [""]


def fit_plain_font_size(
    text: str,
    designed: str,
    box_w: float,
    box_h: float,
    font_size: float,
    min_font_size: float,
    letter_spacing: float,
    line_height: float,
    measure,
) -> float:
    max_size = max(0.0, font_size)
    min_size = min(max_size, max(0.5, min_font_size))
    if not text.strip() or max_size <= min_size:
        return max_size
    if not _should_shrink(text, designed, box_w, max_size, letter_spacing, measure):
        return max_size
    width_at_max = 0.0
    for line in text.split("\n"):
        width_at_max = max(width_at_max, spaced_width(line, max_size, letter_spacing, measure))
    if width_at_max <= 0:
        return max_size
    return max(min_size, min(max_size, max_size * (max(1.0, box_w) / width_at_max)))


def _should_shrink(text: str, designed: str, box_w: float, font_size: float, letter_spacing: float, measure) -> bool:
    live = len(re.sub(r"\s", "", text))
    sample = len(re.sub(r"\s", "", designed))
    longer = live >= 8 if not sample else live > sample
    if not longer:
        return False
    for line in text.split("\n"):
        if spaced_width(line, font_size, letter_spacing, measure) > box_w:
            return True
    return False


def layout_runs(
    runs: list[tuple[str, str, float]],
    box_w: float,
    box_h: float,
    letter_spacing: float,
    line_height: float,
    align: str,
    vertical_align: str,
    measure,
) -> list[PlacedRun]:
    """Port of `layoutRuns` in src/lib/text-color.ts.

    `runs` is (text, fill, font_size_pt).
    """
    tokens: list[dict] = []
    for text, fill, font_size in runs:
        chunks = re.split(r"(\n)", text)
        for chunk in chunks:
            if chunk == "\n":
                tokens.append({"text": "\n", "fill": fill, "fontSize": font_size, "inkH": max(1.0, font_size), "width": 0.0, "break": True})
                continue
            for piece in re.split(r"(\s+)", chunk):
                if not piece:
                    continue
                tokens.append({
                    "text": piece,
                    "fill": fill,
                    "fontSize": font_size,
                    "inkH": max(1.0, font_size),
                    "width": measure(piece, font_size) + letter_spacing * max(0, len(piece) - 1),
                    "break": False,
                })

    lines: list[list[dict]] = [[]]
    for token in tokens:
        if token["break"]:
            lines.append([])
            continue
        lines[-1].append(token)
    while len(lines) > 1 and not lines[-1]:
        lines.pop()

    scaled: list[list[dict]] = []
    for line in lines:
        width = sum(token["width"] for token in line)
        if width <= box_w or box_w <= 0 or width <= 0:
            scaled.append(line)
            continue
        scale = box_w / width
        scaled.append([
            {
                **token,
                "fontSize": token["fontSize"] * scale,
                "inkH": token["inkH"] * scale,
                "width": token["width"] * scale,
            }
            for token in line
        ])

    line_heights = []
    for line in scaled:
        max_ink = max((token["inkH"] for token in line), default=0.0)
        line_heights.append(max(max_ink, 1.0) * line_height)

    placed: list[PlacedRun] = []
    line_y = 0.0
    for index, line in enumerate(scaled):
        max_size = max((token["fontSize"] for token in line), default=0.0)
        width = sum(token["width"] for token in line)
        x = 0.0
        if align == "center":
            x = (box_w - width) / 2
        elif align == "right":
            x = box_w - width
        for token in line:
            if token["text"] and not re.fullmatch(r"\s+", token["text"]):
                offset_y = 0.0
                if vertical_align == "middle":
                    offset_y = (max_size - token["fontSize"]) / 2
                elif vertical_align == "bottom":
                    offset_y = max_size - token["fontSize"]
                placed.append(PlacedRun(
                    text=token["text"],
                    fill=token["fill"],
                    font_size=token["fontSize"],
                    x=x,
                    y=line_y + offset_y,
                    width=token["width"],
                ))
            x += token["width"]
        line_y += line_heights[index]

    if not placed:
        return placed
    min_y = min(run.y for run in placed)
    max_y = max(run.y + run.font_size for run in placed)
    content_h = max_y - min_y
    dy = -min_y
    if vertical_align == "middle":
        dy = (box_h - content_h) / 2 - min_y
    elif vertical_align == "bottom":
        dy = box_h - max_y
    if abs(dy) < 0.01:
        return placed
    return [
        PlacedRun(run.text, run.fill, run.font_size, run.x, run.y + dy, run.width)
        for run in placed
    ]
