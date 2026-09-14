"""Text span transfer + simple run building (LABELATOR text-color semantics)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


SIGNIFICANT = re.compile(r"[0-9A-Za-z]")


@dataclass
class CharStyle:
    fill: str
    font_size_mm: float


@dataclass
class TextRun:
    text: str
    fill: str
    font_size_mm: float


def significant_indices(text: str) -> list[int]:
    return [i for i, ch in enumerate(text) if SIGNIFICANT.match(ch)]


def char_styles(content: str, defaults: CharStyle, spans: list[dict[str, Any]] | None) -> list[CharStyle]:
    styles = [CharStyle(defaults.fill, defaults.font_size_mm) for _ in content]
    for span in spans or []:
        start = max(0, int(span.get("start", 0)))
        end = min(len(content), int(span.get("end", 0)))
        for i in range(start, end):
            fill = span.get("fill") or styles[i].fill
            size = span.get("fontSizeMm")
            styles[i] = CharStyle(
                fill=fill,
                font_size_mm=float(size) if size is not None else styles[i].font_size_mm,
            )
    return styles


def spans_from_styles(styles: list[CharStyle], defaults: CharStyle) -> list[dict[str, Any]]:
    if not styles:
        return []
    out: list[dict[str, Any]] = []
    i = 0
    while i < len(styles):
        j = i + 1
        while j < len(styles) and styles[j] == styles[i]:
            j += 1
        span: dict[str, Any] = {"start": i, "end": j}
        if styles[i].fill != defaults.fill:
            span["fill"] = styles[i].fill
        if styles[i].font_size_mm != defaults.font_size_mm:
            span["fontSizeMm"] = styles[i].font_size_mm
        if "fill" in span or "fontSizeMm" in span:
            out.append(span)
        i = j
    return out


def transfer_spans(
    template: str,
    spans: list[dict[str, Any]] | None,
    value: str,
    defaults: CharStyle,
) -> list[dict[str, Any]]:
    if not spans or not value:
        return []
    if template == value:
        return spans
    t_styles = char_styles(template, defaults, spans)
    t_idx = significant_indices(template)
    v_idx = significant_indices(value)
    if t_idx and v_idx:
        next_styles = [CharStyle(defaults.fill, defaults.font_size_mm) for _ in value]
        n = min(len(t_idx), len(v_idx))
        for k in range(n):
            next_styles[v_idx[k]] = CharStyle(t_styles[t_idx[k]].fill, t_styles[t_idx[k]].font_size_mm)
        return spans_from_styles(next_styles, defaults)
    if len(template) == len(value):
        return spans
    return []


def runs_from_content(content: str, defaults: CharStyle, spans: list[dict[str, Any]] | None) -> list[TextRun]:
    if not content:
        return []
    styles = char_styles(content, defaults, spans)
    runs: list[TextRun] = []
    i = 0
    while i < len(content):
        j = i + 1
        while j < len(content) and styles[j] == styles[i]:
            j += 1
        runs.append(TextRun(content[i:j], styles[i].fill, styles[i].font_size_mm))
        i = j
    return runs
