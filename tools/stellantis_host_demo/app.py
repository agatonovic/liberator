"""External host simulation.

This process owns production rows. It does not own label layout.
Rendering is delegated to labelator_renderer. LABELATOR is not imported.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from labelator_renderer import render, validate_package

HOST_ROOT = Path(__file__).resolve().parent
TEMPLATES = HOST_ROOT / "templates"
DATA = HOST_ROOT / "data" / "labels.json"
OUTPUT = HOST_ROOT / "output" / "labels.pdf"
INSTALLED = TEMPLATES / "Warehouse_A3_Final_v1.labelator"


def list_installed_templates(directory: Path = TEMPLATES) -> list[str]:
    """Local directory listing only. Not a catalog and not a sync client."""
    names: list[str] = []
    for path in sorted(directory.glob("*.labelator")):
        manifest = validate_package(path)
        names.append(str(manifest.get("packageName") or path.name))
    return names


def load_production_rows(path: Path = DATA) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload["rows"] if isinstance(payload, dict) and "rows" in payload else payload
    if not isinstance(rows, list):
        raise SystemExit(f"production data must be a list of rows: {path}")
    return rows


def print_labels(
    template: Path = INSTALLED,
    data: Path = DATA,
    output: Path = OUTPUT,
) -> Path:
    if not template.is_file():
        raise SystemExit(f"installed template not found: {template}")
    rows = load_production_rows(data)
    output.parent.mkdir(parents=True, exist_ok=True)
    return render(template_package=template, data=rows, output_pdf=output)


def main() -> int:
    installed = list_installed_templates()
    if not installed:
        print("no templates installed in templates/", file=sys.stderr)
        return 1
    pdf = print_labels()
    print(f"installed: {', '.join(installed)}")
    print(f"data: {DATA.name}")
    print(f"wrote {pdf}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
