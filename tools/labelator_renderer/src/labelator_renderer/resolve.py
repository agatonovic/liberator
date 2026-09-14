"""Binding lookup and named portable transforms (LABELATOR-compatible).

Transform names are a published contract. Unknown names raise; they are not
inferred from template id, catalog id, or template name.
"""

from __future__ import annotations

import re
from typing import Any


def format_part_number(value: str) -> str:
    text = value.strip()
    if not text:
        return ""
    spaced = [p for p in text.replace("-", " ").split() if p]
    if len(spaced) == 4:
        return " ".join(spaced)
    digits = re.sub(r"\D", "", text)
    if len(digits) == 9:
        digits = "0" + digits
    if len(digits) == 10:
        return f"{digits[0:2]} {digits[2:5]} {digits[5:8]} {digits[8:10]}"
    if len(digits) == 11:
        return f"{digits[0:2]} {digits[2:5]} {digits[5:8]} {digits[8:11]}"
    return text


GA_PREFIX_RED = "#FF0000"

_ARROW_UP = {"UP", "↑", "▲", "U", "GORE"}
_ARROW_DOWN = {"DOWN", "↓", "▼", "D", "DOLJE"}


def parse_ga_address(address: str) -> tuple[str, str, str, str]:
    """`parseGaAddress` — magacin, regal letter, regal number, nivo."""
    raw = re.sub(r"%+$", "", address.strip())
    if not raw:
        return "", "", "", ""
    parts = raw.split(".")
    if len(parts) != 3:
        return raw, "", "", ""
    head, shelf, level = (part.strip() for part in parts)
    if head and re.search(r"[A-Za-z]$", head):
        return head[:-1], head[-1].upper(), shelf, level
    return head, "", shelf, level


def parse_arrow(value: str) -> str | None:
    text = value.strip().upper()
    if not text:
        return None
    if text in _ARROW_UP:
        return "UP"
    if text in _ARROW_DOWN:
        return "DOWN"
    return "DOWN"


def normalize_arrow(value: str) -> str:
    return parse_arrow(value) or "DOWN"


def arrow_symbol(value: str) -> str:
    return "▲" if normalize_arrow(value) == "UP" else "▼"


def ga_magacin_prefix_spans(value: str, existing: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Leading R on a ga_magacin value is painted #FF0000. Transform side effect, not a template branch."""
    spans = list(existing or [])
    if len(value) > 1 and value[0].upper() == "R":
        spans.append({"start": 0, "end": 1, "fill": GA_PREFIX_RED})
    return spans


def _ga_field(index: int):
    def apply(_element: dict[str, Any], raw: str) -> str:
        return parse_ga_address(raw)[index]

    return apply


def _apply_part_number(_element: dict[str, Any], raw: str) -> str:
    return format_part_number(raw)


def _apply_arrow(element: dict[str, Any], raw: str) -> str:
    if element.get("type") == "text":
        return arrow_symbol(raw)
    return normalize_arrow(raw)


def apply_barcode_pct(_element: dict[str, Any], raw: str) -> str:
    """barcode_pct v1 — append a literal '%' to the encoded string.

    Matches src/lib/resolve.ts. Does not scale the barcode, change its box,
    or alter JsBarcode options. Empty input stays empty. A value that already
    ends with '%' is unchanged.
    """
    value = raw.strip()
    if not value:
        return ""
    if value.endswith("%"):
        return value
    return f"{value}%"


TRANSFORMS = {
    "part_number": _apply_part_number,
    "arrow": _apply_arrow,
    "barcode_pct": apply_barcode_pct,
    "ga_magacin": _ga_field(0),
    "ga_regal_letter": _ga_field(1),
    "ga_regal_number": _ga_field(2),
    "ga_nivo": _ga_field(3),
}


def column_aliases(column: dict[str, Any]) -> list[str]:
    names = [column.get("key"), column.get("label"), *(column.get("headers") or [])]
    return [str(n).strip() for n in names if n and str(n).strip()]


def find_column(columns: list[dict[str, Any]], name: str) -> dict[str, Any] | None:
    needle = name.strip().lower()
    if not needle:
        return None
    for column in columns:
        if any(alias.lower() == needle for alias in column_aliases(column)):
            return column
    return None


def lookup_row_value(
    row: dict[str, str] | None,
    key: str,
    columns: list[dict[str, Any]],
) -> str:
    if not row or not key.strip():
        return ""
    column = find_column(columns, key)
    names: list[str] = [key]
    if column:
        names.extend(column_aliases(column))
    for name in names:
        if name in row and str(row[name]):
            return str(row[name])
    wanted = {n.lower() for n in names}
    for name, value in row.items():
        if name.lower() in wanted and str(value):
            return str(value)
    return ""


def apply_transform(element: dict[str, Any], raw: str) -> str:
    name = (element.get("transform") or "").strip()
    if not name:
        return raw
    fn = TRANSFORMS.get(name)
    if not fn:
        raise KeyError(f"Unsupported transform '{name}' (required by template)")
    return fn(element, raw)


def resolve_value(
    element: dict[str, Any],
    row: dict[str, str] | None,
    columns: list[dict[str, Any]],
) -> str:
    binding = (element.get("binding") or "").strip()
    fallback = (element.get("fallbackBinding") or "").strip()
    live = row is not None
    raw = ""
    if binding and row is not None:
        raw = lookup_row_value(row, binding, columns)
    if not raw.strip() and fallback and row is not None:
        raw = lookup_row_value(row, fallback, columns)
    raw = raw.strip()
    if raw:
        next_val = apply_transform(element, raw)
        if next_val:
            return next_val
        return "" if live and (binding or fallback) else (element.get("content") or "")
    if live and (binding or fallback):
        return ""
    return element.get("content") or ""
