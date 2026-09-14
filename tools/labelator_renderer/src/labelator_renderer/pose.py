"""Render-time pose for direction-bound arrows.

Matches `displayPose` / `rotateAroundCenter` in src/lib/document.ts.
This is element semantics (binding + transform + rotation), not a template branch.
Does not write the adjusted rotation back into the package.
"""

from __future__ import annotations

import math
from typing import Any

from .resolve import parse_arrow

_UP = {"UP", "↑", "▲", "U", "GORE"}
_DOWN = {"DOWN", "↓", "▼", "D", "DOLJE"}


def _js_round(value: float) -> float:
    """Math.round: half towards +infinity."""
    return math.floor(value + 0.5)


def round_mm(value: float, step: float = 0.01) -> float:
    return _js_round(value / step) * step


def _explicit_direction(value: str) -> str | None:
    text = value.strip().upper()
    if not text:
        return None
    if text in _UP:
        return "UP"
    if text in _DOWN:
        return "DOWN"
    return None


def _direction_from_rotation(rotation: float) -> str:
    angle = ((rotation % 360) + 360) % 360
    if 45 <= angle < 135:
        return "DOWN"
    if 225 <= angle < 315:
        return "UP"
    if 135 <= angle < 225:
        return "DOWN"
    return "UP"


def designed_arrow_direction(element: dict[str, Any]) -> str:
    from_content = _explicit_direction(str(element.get("content") or ""))
    if from_content:
        return from_content
    src = str(element.get("imageDataUrl") or "")
    if "/arrows/DOWN" in src:
        return "DOWN"
    if "/arrows/UP" in src:
        return "UP"
    return _direction_from_rotation(float(element.get("rotation") or 0))


def is_swappable_arrow_image(element: dict[str, Any]) -> bool:
    src = str(element.get("imageDataUrl") or "")
    return "/arrows/UP" in src or "/arrows/DOWN" in src


def is_direction_bound(element: dict[str, Any]) -> bool:
    if not str(element.get("binding") or "").strip():
        return False
    etype = element.get("type")
    if etype in ("arrow", "doubleArrow"):
        return True
    if element.get("transform") == "arrow":
        return True
    return etype == "image" and is_swappable_arrow_image(element)


def element_center(element: dict[str, Any]) -> tuple[float, float]:
    rad = math.radians(float(element.get("rotation") or 0))
    cx = float(element.get("width") or 0) / 2
    cy = float(element.get("height") or 0) / 2
    x = float(element.get("x") or 0)
    y = float(element.get("y") or 0)
    return (
        x + cx * math.cos(rad) - cy * math.sin(rad),
        y + cx * math.sin(rad) + cy * math.cos(rad),
    )


def rotate_around_center(element: dict[str, Any], next_rotation: float) -> dict[str, float]:
    center_x, center_y = element_center(element)
    rad = math.radians(next_rotation)
    cx = float(element.get("width") or 0) / 2
    cy = float(element.get("height") or 0) / 2
    return {
        "rotation": next_rotation,
        "x": round_mm(center_x - (cx * math.cos(rad) - cy * math.sin(rad))),
        "y": round_mm(center_y - (cx * math.sin(rad) + cy * math.cos(rad))),
    }


def display_pose(element: dict[str, Any], live_value: str) -> dict[str, float]:
    x = float(element.get("x") or 0)
    y = float(element.get("y") or 0)
    rotation = float(element.get("rotation") or 0)
    if not is_direction_bound(element) or is_swappable_arrow_image(element):
        return {"x": x, "y": y, "rotation": rotation}
    live = parse_arrow(live_value)
    if not live or live == designed_arrow_direction(element):
        return {"x": x, "y": y, "rotation": rotation}
    return rotate_around_center(element, rotation + 180)
