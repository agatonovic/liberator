"""Operator CLI. Calls the existing render() path. Does not draw by itself."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .errors import (
    InputDataError,
    LabelatorRendererError,
    OutputError,
    PackageValidationError,
    UnsupportedCapabilityError,
)
from .renderer import render
from .validate import validate_package

EXIT_UNEXPECTED = 1
EXIT_USAGE = 2
EXIT_PACKAGE = 3
EXIT_DATA = 4
EXIT_UNSUPPORTED = 5
EXIT_OUTPUT = 6


def load_rows(path: Path) -> list:
    if not path.is_file():
        raise InputDataError(f"input data not found: {path}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise InputDataError(f"input data is not valid JSON: {path} ({exc})") from exc
    if isinstance(payload, dict) and "rows" in payload:
        rows = payload["rows"]
    else:
        rows = payload
    if not isinstance(rows, list):
        raise InputDataError(f"input data must be a list of row objects, or an object with a 'rows' list: {path}")
    for index, row in enumerate(rows):
        if row is not None and not isinstance(row, dict):
            raise InputDataError(f"row {index} in {path} must be an object")
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="labelator-render",
        description="Render a .labelator v1 package and local row JSON to PDF. No network.",
    )
    parser.add_argument("--template", required=True, help="Path to a .labelator ZIP or unpacked directory")
    parser.add_argument("--data", required=True, help="JSON file: a list of rows, or {\"rows\": [...]}")
    parser.add_argument("--output", required=True, help="Output PDF path")
    parser.add_argument("--verbose", action="store_true", help="Print a traceback for unexpected failures")
    args = parser.parse_args(argv)

    template = Path(args.template)
    data = Path(args.data)
    output = Path(args.output)
    try:
        if output.exists() and output.is_dir():
            raise OutputError(f"output path is a directory: {output}")
        validate_package(template)
        load_rows(data)
        # Same data loader as the proven engine: pass the JSON path through.
        render(template, data, output)
    except PackageValidationError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return EXIT_PACKAGE
    except InputDataError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return EXIT_DATA
    except UnsupportedCapabilityError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return EXIT_UNSUPPORTED
    except OutputError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return EXIT_OUTPUT
    except NotImplementedError as exc:
        print(f"error: unsupported rendering capability ({exc})", file=sys.stderr)
        return EXIT_UNSUPPORTED
    except OSError as exc:
        print(f"error: cannot write output {output} ({exc})", file=sys.stderr)
        return EXIT_OUTPUT
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        if args.verbose:
            raise
        return EXIT_UNEXPECTED
    print(output)
    return 0


def cli_main() -> None:
    raise SystemExit(main())


if __name__ == "__main__":
    cli_main()
