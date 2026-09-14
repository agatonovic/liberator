"""Font loading: use packaged binaries; convert WOFF→TTF without re-hinting glyphs when needed."""

from __future__ import annotations

import tempfile
from pathlib import Path

import fitz


_CACHE: dict[str, Path] = {}


def ensure_embeddable_font(path: Path) -> Path:
    """Return a path PyMuPDF can embed. WOFF is converted to TTF via fontTools (same outlines)."""
    key = str(path.resolve())
    if key in _CACHE:
        return _CACHE[key]
    magic = path.read_bytes()[:4]
    if magic == b"wOFF" or path.suffix.lower() == ".woff":
        try:
            from fontTools.ttLib import TTFont
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("fonttools required to embed packaged WOFF fonts") from exc
        out = Path(tempfile.gettempdir()) / f"labelator_{path.stem}_{path.stat().st_size}.ttf"
        if not out.exists() or out.stat().st_mtime < path.stat().st_mtime:
            font = TTFont(str(path))
            font.flavor = None
            font.save(str(out))
        _CACHE[key] = out
        return out
    _CACHE[key] = path
    return path


def load_fitz_font(path: Path) -> fitz.Font:
    embed = ensure_embeddable_font(path)
    try:
        return fitz.Font(fontfile=str(embed))
    except Exception as exc:
        raise RuntimeError(
            f"Could not load packaged font {path} (embed path {embed}). "
            "Do not fall back to system fonts."
        ) from exc
