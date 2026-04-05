"""WebAct CLI package.

This package provides a fast command-line interface for browser automation.
The CLI uses a daemon architecture for persistent browser sessions.

Usage:
    webact open https://example.com
    webact click 5
    webact type "Hello World"
    webact python "print(browser.url)"
    webact close
"""

__all__ = ['main']


def __getattr__(name: str):
	"""Lazy import to avoid runpy warnings when running as module."""
	if name == 'main':
		from webact.skill_cli.main import main

		return main
	raise AttributeError(f'module {__name__!r} has no attribute {name!r}')
