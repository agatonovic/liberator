"""Offline .labelator v1 renderer.

Public contract is `render`. Engine modules are an implementation detail.
Renderer package version is independent of the .labelator format version.
"""

from .package import load_package
from .renderer import render
from .validate import FORMAT_VERSION, validate_package

__version__ = "0.1.0"
LABELATOR_FORMAT_VERSION = FORMAT_VERSION

__all__ = [
    "LABELATOR_FORMAT_VERSION",
    "__version__",
    "load_package",
    "render",
    "validate_package",
]
