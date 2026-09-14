"""Code39 encoding and rasterization matching LABELATOR / JsBarcode.

LABELATOR (`src/lib/codes.ts`):
- probe JsBarcode at width=1, margin=0, displayValue=false
- modules = probe canvas width (binary length)
- moduleWidth = max(1, round(destW / modules))
- barHeight = destH when displayValue is false
- redraw, then nearest-neighbor blit to destW x destH
- margin 0, background white, bars black, no HRI
"""

from __future__ import annotations

import io

from PIL import Image, ImageDraw

# JsBarcode CODE39 character table (position = checksum value).
_CHARACTERS = list("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*")
_ENCODINGS = [
    20957, 29783, 23639, 30485,
    20951, 29813, 23669, 20855,
    29789, 23645, 29975, 23831,
    30533, 22295, 30149, 24005,
    21623, 29981, 23837, 22301,
    30023, 23879, 30545, 22343,
    30161, 24017, 21959, 30065,
    23921, 22385, 29015, 18263,
    29141, 17879, 29045, 18293,
    17783, 29021, 18269, 17477,
    17489, 17681, 20753, 35770,
]


def encode_code39(value: str) -> str:
    """Return the JsBarcode CODE39 binary string (1 = bar, 0 = space). No checksum."""
    data = (value or "0").upper()
    result = _binary("*")
    for char in data:
        if char not in _CHARACTERS[:-1]:
            raise ValueError(f"Invalid Code 39 character: {char!r}")
        result += _binary(char) + "0"
    result += _binary("*")
    return result


def _binary(character: str) -> str:
    index = _CHARACTERS.index(character)
    # Match JS Number#toString(2): no leading zeros.
    return format(_ENCODINGS[index], "b")


def module_width_px(dest_w: int, binary: str) -> int:
    modules = max(1, len(binary))
    return max(1, round(dest_w / modules))


def render_code39_png(value: str, width_px: int, height_px: int, *, display_value: bool = False) -> bytes:
    dest_w = max(8, int(round(width_px)))
    dest_h = max(8, int(round(height_px)))
    binary = encode_code39(value)
    module_w = module_width_px(dest_w, binary)
    font_size = max(8, round(dest_h * 0.16)) if display_value else 0
    text_margin = max(1, round(dest_h * 0.04)) if display_value else 0
    bar_height = max(8, dest_h - font_size - text_margin)
    src_w = len(binary) * module_w
    src_h = dest_h if display_value else bar_height

    img = Image.new("RGB", (src_w, max(src_h, bar_height)), "white")
    draw = ImageDraw.Draw(img)
    for index, bit in enumerate(binary):
        if bit != "1":
            continue
        x = index * module_w
        draw.rectangle([x, 0, x + module_w - 1, bar_height - 1], fill="black")

    if img.size != (dest_w, dest_h):
        img = img.resize((dest_w, dest_h), Image.Resampling.NEAREST)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def print_px(mm: float) -> int:
    """LABELATOR barcode raster size: Math.round(mm * 300 / 25.4)."""
    return int(round((mm * 300) / 25.4))
