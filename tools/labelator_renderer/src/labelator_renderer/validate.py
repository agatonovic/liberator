"""Check a .labelator ZIP or directory against the frozen v1 contract.

This does not draw and does not change how `render` loads a package.
"""

from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path
from typing import Any

from .errors import PackageValidationError, UnsupportedCapabilityError
from .resolve import TRANSFORMS

FORMAT_ID = "labelator.package"
FORMAT_VERSION = 1
REQUIRED_MEMBERS = ("manifest.json", "template.json", "assets/index.json")


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _fail(message: str) -> None:
    raise PackageValidationError(message)


def _read_member(root: Path | None, zf: zipfile.ZipFile | None, name: str) -> bytes:
    if zf is not None:
        try:
            return zf.read(name)
        except KeyError as exc:
            _fail(f"required file '{name}' is missing from the .labelator ZIP")
            raise exc
    assert root is not None
    path = root / name
    if not path.is_file():
        _fail(f"required file '{name}' is missing from {root}")
    return path.read_bytes()


def _names(root: Path | None, zf: zipfile.ZipFile | None) -> set[str]:
    if zf is not None:
        return {name.replace("\\", "/") for name in zf.namelist() if not name.endswith("/")}
    assert root is not None
    return {path.relative_to(root).as_posix() for path in root.rglob("*") if path.is_file()}


def validate_package(template_package: str | Path) -> dict[str, Any]:
    """Return the parsed manifest if the package can be rendered offline.

    Raises PackageValidationError or UnsupportedCapabilityError.
    """
    path = Path(template_package)
    if not path.exists():
        _fail(f"package not found: {path}")

    zf: zipfile.ZipFile | None = None
    root: Path | None = None
    try:
        if path.is_dir():
            root = path
        elif path.is_file() and path.suffix.lower() == ".labelator":
            if not zipfile.is_zipfile(path):
                _fail(f"not a ZIP archive: {path}")
            zf = zipfile.ZipFile(path, "r")
            bad = zf.testzip()
            if bad:
                _fail(f"corrupt ZIP entry '{bad}' in {path}")
        else:
            _fail(f"expected a .labelator ZIP or an unpacked directory, got {path}")

        present = _names(root, zf)
        for name in REQUIRED_MEMBERS:
            if name not in present:
                where = path
                _fail(f"required file '{name}' is missing from {where}")

        try:
            manifest = json.loads(_read_member(root, zf, "manifest.json").decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            _fail(f"manifest.json is not valid JSON ({exc})")
        if not isinstance(manifest, dict):
            _fail("manifest.json must be a JSON object")
        if manifest.get("format") != FORMAT_ID:
            _fail(f"unsupported package format {manifest.get('format')!r}; expected {FORMAT_ID!r}")
        if manifest.get("formatVersion") != FORMAT_VERSION:
            _fail(
                f"unsupported package formatVersion {manifest.get('formatVersion')!r}; "
                f"this renderer reads .labelator v{FORMAT_VERSION}"
            )

        try:
            template = json.loads(_read_member(root, zf, "template.json").decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            _fail(f"template.json is not valid JSON ({exc})")
        if not isinstance(template, dict) or not isinstance(template.get("document"), dict):
            _fail("template.json must contain a document object")
        page = template["document"].get("page") or {}
        if not isinstance(page.get("widthMm"), (int, float)) or not isinstance(page.get("heightMm"), (int, float)):
            _fail("template.json document.page.widthMm and heightMm are required")

        try:
            assets_index = json.loads(_read_member(root, zf, "assets/index.json").decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            _fail(f"assets/index.json is not valid JSON ({exc})")
        if not isinstance(assets_index, dict):
            _fail("assets/index.json must be a JSON object")

        for font in manifest.get("fonts") or []:
            rel = str(font.get("path") or "")
            family = font.get("family")
            weight = font.get("weight")
            if not rel or rel.startswith("/") or ".." in rel.split("/"):
                _fail(f"font path is not package-relative: {rel or family}")
            if rel not in present:
                _fail(f"required font '{rel}' is missing from the package (family {family} weight {weight})")
            data = _read_member(root, zf, rel)
            expected = font.get("sha256")
            if expected and _sha256(data) != expected:
                _fail(f"font checksum mismatch for '{rel}'")

        for collection in assets_index.get("collections") or []:
            cid = collection.get("id")
            for stem, rel in (collection.get("entries") or {}).items():
                asset_rel = rel if str(rel).startswith("assets/") else f"assets/{rel}"
                if asset_rel not in present and str(rel) not in present:
                    _fail(f"required asset '{asset_rel}' is missing (collection {cid}, key {stem})")

        missing = sorted(
            name
            for name in (manifest.get("requiredTransforms") or [])
            if str(name).strip() and str(name).strip() not in TRANSFORMS
        )
        if missing:
            raise UnsupportedCapabilityError(
                "unsupported transform "
                + ", ".join(repr(name) for name in missing)
                + "; this renderer does not implement it"
            )
        return manifest
    finally:
        if zf is not None:
            zf.close()
