"""Stable errors for the public API and CLI. The renderer engine is not changed by these types."""

from __future__ import annotations


class LabelatorRendererError(Exception):
    """Base error. Message is safe to show to an operator."""


class PackageValidationError(LabelatorRendererError):
    """The .labelator package is missing, unreadable, or does not match v1."""


class InputDataError(LabelatorRendererError):
    """Row JSON is missing or not the accepted shape."""


class UnsupportedCapabilityError(LabelatorRendererError):
    """The package asks for a transform or symbology this renderer does not draw."""


class OutputError(LabelatorRendererError):
    """The output PDF path cannot be written."""
