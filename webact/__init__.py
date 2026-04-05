import os
from typing import TYPE_CHECKING

from webact.logging_config import setup_logging

# Only set up logging if not in MCP mode or if explicitly requested
if os.environ.get('BROWSER_USE_SETUP_LOGGING', 'true').lower() != 'false':
	from webact.config import CONFIG

	# Get log file paths from config/environment
	debug_log_file = getattr(CONFIG, 'BROWSER_USE_DEBUG_LOG_FILE', None)
	info_log_file = getattr(CONFIG, 'BROWSER_USE_INFO_LOG_FILE', None)

	# Set up logging with file handlers if specified
	logger = setup_logging(debug_log_file=debug_log_file, info_log_file=info_log_file)
else:
	import logging

	logger = logging.getLogger('webact')

# Monkeypatch BaseSubprocessTransport.__del__ to handle closed event loops gracefully
from asyncio import base_subprocess

_original_del = base_subprocess.BaseSubprocessTransport.__del__


def _patched_del(self):
	"""Patched __del__ that handles closed event loops without throwing noisy red-herring errors like RuntimeError: Event loop is closed"""
	try:
		# Check if the event loop is closed before calling the original
		if hasattr(self, '_loop') and self._loop and self._loop.is_closed():
			# Event loop is closed, skip cleanup that requires the loop
			return
		_original_del(self)
	except RuntimeError as e:
		if 'Event loop is closed' in str(e):
			# Silently ignore this specific error
			pass
		else:
			raise


base_subprocess.BaseSubprocessTransport.__del__ = _patched_del


# Type stubs for lazy imports - fixes linter warnings
if TYPE_CHECKING:
	from webact.agent.prompts import SystemPrompt
	from webact.agent.service import Agent

	# from webact.agent.service import Agent
	from webact.agent.views import ActionModel, ActionResult, AgentHistoryList
	from webact.browser import BrowserProfile, BrowserSession
	from webact.browser import BrowserSession as Browser
	from webact.dom.service import DomService
	from webact.llm import models
	from webact.llm.anthropic.chat import ChatAnthropic
	from webact.llm.azure.chat import ChatAzureOpenAI
	from webact.llm.browser_use.chat import ChatBrowserUse
	from webact.llm.google.chat import ChatGoogle
	from webact.llm.groq.chat import ChatGroq
	from webact.llm.litellm.chat import ChatLiteLLM
	from webact.llm.mistral.chat import ChatMistral
	from webact.llm.oci_raw.chat import ChatOCIRaw
	from webact.llm.ollama.chat import ChatOllama
	from webact.llm.openai.chat import ChatOpenAI
	from webact.llm.vercel.chat import ChatVercel
	from webact.sandbox import sandbox
	from webact.tools.service import Controller, Tools

	# Lazy imports mapping - only import when actually accessed
_LAZY_IMPORTS = {
	# Agent service (heavy due to dependencies)
	# 'Agent': ('webact.agent.service', 'Agent'),
	'Agent': ('webact.agent.service', 'Agent'),
	# System prompt (moderate weight due to agent.views imports)
	'SystemPrompt': ('webact.agent.prompts', 'SystemPrompt'),
	# Agent views (very heavy - over 1 second!)
	'ActionModel': ('webact.agent.views', 'ActionModel'),
	'ActionResult': ('webact.agent.views', 'ActionResult'),
	'AgentHistoryList': ('webact.agent.views', 'AgentHistoryList'),
	'BrowserSession': ('webact.browser', 'BrowserSession'),
	'Browser': ('webact.browser', 'BrowserSession'),  # Alias for BrowserSession
	'BrowserProfile': ('webact.browser', 'BrowserProfile'),
	# Tools (moderate weight)
	'Tools': ('webact.tools.service', 'Tools'),
	'Controller': ('webact.tools.service', 'Controller'),  # alias
	# DOM service (moderate weight)
	'DomService': ('webact.dom.service', 'DomService'),
	# Chat models (very heavy imports)
	'ChatOpenAI': ('webact.llm.openai.chat', 'ChatOpenAI'),
	'ChatGoogle': ('webact.llm.google.chat', 'ChatGoogle'),
	'ChatAnthropic': ('webact.llm.anthropic.chat', 'ChatAnthropic'),
	'ChatBrowserUse': ('webact.llm.browser_use.chat', 'ChatBrowserUse'),
	'ChatGroq': ('webact.llm.groq.chat', 'ChatGroq'),
	'ChatLiteLLM': ('webact.llm.litellm.chat', 'ChatLiteLLM'),
	'ChatMistral': ('webact.llm.mistral.chat', 'ChatMistral'),
	'ChatAzureOpenAI': ('webact.llm.azure.chat', 'ChatAzureOpenAI'),
	'ChatOCIRaw': ('webact.llm.oci_raw.chat', 'ChatOCIRaw'),
	'ChatOllama': ('webact.llm.ollama.chat', 'ChatOllama'),
	'ChatVercel': ('webact.llm.vercel.chat', 'ChatVercel'),
	# LLM models module
	'models': ('webact.llm.models', None),
	# Sandbox execution
	'sandbox': ('webact.sandbox', 'sandbox'),
}


def __getattr__(name: str):
	"""Lazy import mechanism - only import modules when they're actually accessed."""
	if name in _LAZY_IMPORTS:
		module_path, attr_name = _LAZY_IMPORTS[name]
		try:
			from importlib import import_module

			module = import_module(module_path)
			if attr_name is None:
				# For modules like 'models', return the module itself
				attr = module
			else:
				attr = getattr(module, attr_name)
			# Cache the imported attribute in the module's globals
			globals()[name] = attr
			return attr
		except ImportError as e:
			raise ImportError(f'Failed to import {name} from {module_path}: {e}') from e

	raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


__all__ = [
	'Agent',
	'BrowserSession',
	'Browser',  # Alias for BrowserSession
	'BrowserProfile',
	'Controller',
	'DomService',
	'SystemPrompt',
	'ActionResult',
	'ActionModel',
	'AgentHistoryList',
	# Chat models
	'ChatOpenAI',
	'ChatGoogle',
	'ChatAnthropic',
	'ChatBrowserUse',
	'ChatGroq',
	'ChatLiteLLM',
	'ChatMistral',
	'ChatAzureOpenAI',
	'ChatOCIRaw',
	'ChatOllama',
	'ChatVercel',
	'Tools',
	'Controller',
	# LLM models module
	'models',
	# Sandbox execution
	'sandbox',
]
