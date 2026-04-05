"""Backward-compatibility shim — browser_use has been renamed to webact."""

import warnings

warnings.warn(
	"The 'browser_use' package has been renamed to 'webact'. "
	"Please update your imports: 'from webact import ...' "
	"This compatibility shim will be removed in a future version.",
	DeprecationWarning,
	stacklevel=2,
)

# Re-export webact's public API lazily to avoid triggering eager imports
import webact as _webact  # noqa: E402

__all__ = _webact.__all__


def __getattr__(name: str):
	"""Delegate attribute access to webact module."""
	return getattr(_webact, name)
