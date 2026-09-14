"""Load a `.labelator` ZIP or unpacked directory."""

from __future__ import annotations

import hashlib
import json
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class LabelatorPackage:
    root: Path
    manifest: dict[str, Any]
    template: dict[str, Any]
    assets_index: dict[str, Any]
    # relative path -> absolute path on disk (extracted or unpacked)
    files: dict[str, Path]

    @property
    def document(self) -> dict[str, Any]:
        return self.template["document"]


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def load_package(path: str | Path) -> LabelatorPackage:
    path = Path(path)
    if path.is_dir():
        return _load_dir(path)
    if path.is_file() and path.suffix.lower() == ".labelator":
        extract_dir = path.with_suffix("")
        if not extract_dir.exists():
            extract_dir.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(path, "r") as zf:
                zf.extractall(extract_dir)
        return _load_dir(extract_dir)
    raise FileNotFoundError(f"Not a .labelator package: {path}")


def _load_dir(root: Path) -> LabelatorPackage:
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    template = json.loads((root / "template.json").read_text(encoding="utf-8"))
    assets_index = json.loads((root / "assets" / "index.json").read_text(encoding="utf-8"))
    files: dict[str, Path] = {}
    for p in root.rglob("*"):
        if p.is_file():
            rel = p.relative_to(root).as_posix()
            files[rel] = p
    return LabelatorPackage(
        root=root,
        manifest=manifest,
        template=template,
        assets_index=assets_index,
        files=files,
    )


def resolve_font_path(pkg: LabelatorPackage, family: str, weight: int) -> Path:
    for entry in pkg.manifest.get("fonts", []):
        if entry.get("family") == family and int(entry.get("weight", 400)) == weight:
            rel = entry["path"]
            path = pkg.files.get(rel) or (pkg.root / rel)
            if not path.exists():
                raise FileNotFoundError(f"Missing font {rel}")
            expected = entry.get("sha256")
            if expected and _sha256(path) != expected:
                raise ValueError(f"Font checksum mismatch for {rel}")
            return path
    raise KeyError(f"No packaged font for {family} weight {weight}")


def resolve_asset(pkg: LabelatorPackage, collection_id: str, value: str) -> Path | None:
    stem = value.strip().split("/")[-1]
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"):
        if stem.lower().endswith(ext):
            stem = stem[: -len(ext)]
            break
    stem = stem.strip().lower()
    if not stem:
        return None

    def lookup(collection: dict) -> Path | None:
        rel = collection.get("entries", {}).get(stem)
        if not rel:
            return None
        rel = rel if rel.startswith("assets/") else f"assets/{rel}"
        path = pkg.files.get(rel) or (pkg.root / rel)
        return path if path.exists() else None

    for collection in pkg.assets_index.get("collections", []):
        if collection.get("id") == collection_id or collection.get("labelatorAssetFolderId") == collection_id:
            hit = lookup(collection)
            if hit:
                return hit
    return None


def collection_for_folder(pkg: LabelatorPackage, asset_folder_id: str | None) -> str | None:
    if not asset_folder_id:
        return None
    for collection in pkg.assets_index.get("collections", []):
        if collection.get("labelatorAssetFolderId") == asset_folder_id:
            return collection.get("id")
        if collection.get("id") == asset_folder_id:
            return collection.get("id")
    return None
