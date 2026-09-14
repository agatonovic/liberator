# labelator-renderer

Offline PDF renderer for a frozen `.labelator` v1 package.

This package does not import or run LABELATOR. Package version `0.1.0` is independent of format version `1`.

```bash
pip install -e tools/labelator_renderer
labelator-render --template template.labelator --data rows.json --output labels.pdf
```

See `docs/LABELATOR_PYTHON_RENDERER.md`.

Engine tests live in `tests/`. Visual comparison is `compare.py` in this directory. There is one renderer.
