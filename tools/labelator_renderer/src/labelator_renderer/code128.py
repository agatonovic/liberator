"""Code128 encoding matching LABELATOR / JsBarcode CODE128AUTO.

LABELATOR probes JsBarcode at width=1, margin=0, displayValue=false, then
nearest-blits. Module geometry uses the same probe → moduleWidth → blit path
as Code39 (`src/lib/codes.ts`). This is a symbology encoder, not a template branch.
"""

from __future__ import annotations

import io
import re

from PIL import Image, ImageDraw

from .code39 import module_width_px, print_px

SET_A, SET_B, SET_C = 0, 1, 2
SHIFT = 98
START_A, START_B, START_C = 103, 104, 105
MODULO = 103
STOP = 106

SET_BY_CODE = {START_A: SET_A, START_B: SET_B, START_C: SET_C}
SWAP = {101: SET_A, 100: SET_B, 99: SET_C}

A_START = chr(208)
B_START = chr(209)
C_START = chr(210)

A_CHARS = r"[\x00-\x5F\xC8-\xCF]"
B_CHARS = r"[\x20-\x7F\xC8-\xCF]"
C_CHARS = r"(?:\xCF*[0-9]{2}\xCF*)"

# JsBarcode BARS. STOP (index 106) is 13 modules; the rest are 11.
_BARS = [
    11011001100, 11001101100, 11001100110, 10010011000, 10010001100,
    10001001100, 10011001000, 10011000100, 10001100100, 11001001000,
    11001000100, 11000100100, 10110011100, 10011011100, 10011001110,
    10111001100, 10011101100, 10011100110, 11001110010, 11001011100,
    11001001110, 11011100100, 11001110100, 11101101110, 11101001100,
    11100101100, 11100100110, 11101100100, 11100110100, 11100110010,
    11011011000, 11011000110, 11000110110, 10100011000, 10001011000,
    10001000110, 10110001000, 10001101000, 10001100010, 11010001000,
    11000101000, 11000100010, 10110111000, 10110001110, 10001101110,
    10111011000, 10111000110, 10001110110, 11101110110, 11010001110,
    11000101110, 11011101000, 11011100010, 11011101110, 11101011000,
    11101000110, 11100010110, 11101101000, 11101100010, 11100011010,
    11101111010, 11001000010, 11110001010, 10100110000, 10100001100,
    10010110000, 10010000110, 10000101100, 10000100110, 10110010000,
    10110000100, 10011010000, 10011000010, 10000110100, 10000110010,
    11000010010, 11001010000, 11110111010, 11000010100, 10001111010,
    10100111100, 10010111100, 10010011110, 10111100100, 10011110100,
    10011110010, 11110100100, 11110010100, 11110010010, 11011011110,
    11011110110, 11110110110, 10101111000, 10100011110, 10001011110,
    10111101000, 10111100010, 11110101000, 11110100010, 10111011110,
    10111101110, 11101011110, 11110101110, 11010000100, 11010010000,
    11010011100, 1100011101011,
]


def _bar(index: int) -> str:
    if index < 0 or index >= len(_BARS):
        return ""
    return str(_BARS[index])


def _match_len(pattern: str, text: str) -> int:
    hit = re.match(pattern, text)
    return len(hit.group(0)) if hit else 0


def _match_set_c(text: str) -> str:
    hit = re.match(rf"^{C_CHARS}*", text)
    return hit.group(0) if hit else ""


def _auto_from_ab(text: str, is_a: bool) -> str:
    ranges = A_CHARS if is_a else B_CHARS
    until_c = re.match(rf"^({ranges}+?)((?:[0-9]{{2}}){{2,}})([^0-9]|$)", text)
    if until_c:
        prefix = until_c.group(1)
        return prefix + chr(204) + _auto_from_c(text[len(prefix) :])
    chars_m = re.match(rf"^{ranges}+", text)
    if not chars_m:
        raise ValueError("CODE128 auto-select could not match a character set")
    chars = chars_m.group(0)
    if len(chars) == len(text):
        return text
    switch = chr(205 if is_a else 206)
    return chars + switch + _auto_from_ab(text[len(chars) :], not is_a)


def _auto_from_c(text: str) -> str:
    chunk = _match_set_c(text)
    if len(chunk) == len(text):
        return text
    rest = text[len(chunk) :]
    is_a = _match_len(rf"^{A_CHARS}*", rest) >= _match_len(rf"^{B_CHARS}*", rest)
    switch = chr(206 if is_a else 205)
    return chunk + switch + _auto_from_ab(rest, is_a)


def auto_select_modes(text: str) -> str:
    """JsBarcode CODE128AUTO string, including the start character."""
    c_length = len(_match_set_c(text))
    if c_length >= 2:
        selected = C_START + _auto_from_c(text)
    else:
        is_a = _match_len(rf"^{A_CHARS}*", text) > _match_len(rf"^{B_CHARS}*", text)
        selected = (A_START if is_a else B_START) + _auto_from_ab(text, is_a)
    return re.sub(
        r"[\xCD\xCE]([^\xCD\xCE])[\xCD\xCE]",
        lambda match: chr(203) + match.group(1),
        selected,
        count=1,
    )


def _correct_index(codes: list[int], charset: int) -> int:
    if charset == SET_A:
        char_code = codes.pop(0)
        return char_code + 64 if char_code < 32 else char_code - 32
    if charset == SET_B:
        return codes.pop(0) - 32
    return (codes.pop(0) - 48) * 10 + codes.pop(0) - 48


def _next(codes: list[int], pos: int, charset: int) -> tuple[str, int]:
    if not codes:
        return "", 0
    if codes[0] >= 200:
        index = codes.pop(0) - 105
        next_set = SWAP.get(index)
        if next_set is not None:
            nxt, checksum = _next(codes, pos + 1, next_set)
        else:
            if charset in (SET_A, SET_B) and index == SHIFT and codes:
                if charset == SET_A:
                    codes[0] = codes[0] - 96 if codes[0] > 95 else codes[0]
                else:
                    codes[0] = codes[0] + 96 if codes[0] < 32 else codes[0]
            nxt, checksum = _next(codes, pos + 1, charset)
    else:
        index = _correct_index(codes, charset)
        nxt, checksum = _next(codes, pos + 1, charset)
    return _bar(index) + nxt, index * pos + checksum


def encode_code128(value: str) -> str:
    """Return the JsBarcode CODE128 binary string (1 = bar, 0 = space)."""
    text = value or "0"
    if re.fullmatch(r"[\x00-\x7F\xC8-\xD3]+", text):
        prepared = auto_select_modes(text)
    else:
        prepared = text
    codes = [ord(char) for char in prepared]
    start_index = codes.pop(0) - 105
    if start_index not in SET_BY_CODE:
        raise ValueError("CODE128 encoding does not start with a start character")
    body, checksum = _next(codes, 1, SET_BY_CODE[start_index])
    return _bar(start_index) + body + _bar((checksum + start_index) % MODULO) + _bar(STOP)


def render_code128_png(value: str, width_px: int, height_px: int, *, display_value: bool = False) -> bytes:
    dest_w = max(8, int(round(width_px)))
    dest_h = max(8, int(round(height_px)))
    binary = encode_code128(value)
    module_w = module_width_px(dest_w, binary)
    font_size = max(8, round(dest_h * 0.16)) if display_value else 0
    text_margin = max(1, round(dest_h * 0.04)) if display_value else 0
    bar_height = max(8, dest_h - font_size - text_margin)
    src_w = len(binary) * module_w

    img = Image.new("RGB", (src_w, max(dest_h if display_value else bar_height, bar_height)), "white")
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


__all__ = ["encode_code128", "print_px", "render_code128_png"]
