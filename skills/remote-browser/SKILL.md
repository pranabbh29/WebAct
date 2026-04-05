---
name: remote-browser
description: Controls a local browser from a sandboxed remote machine. Use when the agent is running in a sandbox (no GUI) and needs to navigate websites, interact with web pages, fill forms, take screenshots, or expose local dev servers via tunnels.
allowed-tools: Bash(webact:*)
---

# Browser Automation for Sandboxed Agents

This skill is for agents running on **sandboxed remote machines** (cloud VMs, CI, coding agents) that need to control a headless browser.

## Prerequisites

```bash
webact doctor    # Verify installation
```

For setup details, see https://github.com/browser-use/browser-use/blob/main/browser_use/skill_cli/README.md

## Core Workflow

1. **Navigate**: `webact open <url>` — starts headless browser if needed
2. **Inspect**: `webact state` — returns clickable elements with indices
3. **Interact**: use indices from state (`webact click 5`, `webact input 3 "text"`)
4. **Verify**: `webact state` or `webact screenshot` to confirm
5. **Repeat**: browser stays open between commands
6. **Cleanup**: `webact close` when done

## Browser Modes

```bash
webact open <url>                                    # Default: headless Chromium
webact cloud connect                                 # Provision cloud browser and connect
webact --connect open <url>                          # Auto-discover running Chrome via CDP
webact --cdp-url ws://localhost:9222/... open <url>  # Connect via CDP URL
```

## Commands

```bash
# Navigation
webact open <url>                    # Navigate to URL
webact back                          # Go back in history
webact scroll down                   # Scroll down (--amount N for pixels)
webact scroll up                     # Scroll up
webact tab list                      # List all tabs with lock status
webact tab new [url]                 # Open a new tab (blank or with URL)
webact tab switch <index>            # Switch to tab by index
webact tab close <index> [index...]  # Close one or more tabs

# Page State — always run state first to get element indices
webact state                         # URL, title, clickable elements with indices
webact screenshot [path.png]         # Screenshot (base64 if no path, --full for full page)

# Interactions — use indices from state
webact click <index>                 # Click element by index
webact click <x> <y>                 # Click at pixel coordinates
webact type "text"                   # Type into focused element
webact input <index> "text"          # Click element, then type
webact keys "Enter"                  # Send keyboard keys (also "Control+a", etc.)
webact select <index> "option"       # Select dropdown option
webact upload <index> <path>         # Upload file to file input
webact hover <index>                 # Hover over element
webact dblclick <index>              # Double-click element
webact rightclick <index>            # Right-click element

# Data Extraction
webact eval "js code"                # Execute JavaScript, return result
webact get title                     # Page title
webact get html [--selector "h1"]    # Page HTML (or scoped to selector)
webact get text <index>              # Element text content
webact get value <index>             # Input/textarea value
webact get attributes <index>        # Element attributes
webact get bbox <index>              # Bounding box (x, y, width, height)

# Wait
webact wait selector "css"           # Wait for element (--state visible|hidden|attached|detached, --timeout ms)
webact wait text "text"              # Wait for text to appear

# Cookies
webact cookies get [--url <url>]     # Get cookies (optionally filtered)
webact cookies set <name> <value>    # Set cookie (--domain, --secure, --http-only, --same-site, --expires)
webact cookies clear [--url <url>]   # Clear cookies
webact cookies export <file>         # Export to JSON
webact cookies import <file>         # Import from JSON

# Python — persistent session with browser access
webact python "code"                 # Execute Python (variables persist across calls)
webact python --file script.py       # Run file
webact python --vars                 # Show defined variables
webact python --reset                # Clear namespace

# Session
webact close                         # Close browser and stop daemon
webact sessions                      # List active sessions
webact close --all                   # Close all sessions
```

The Python `browser` object provides: `browser.url`, `browser.title`, `browser.html`, `browser.goto(url)`, `browser.back()`, `browser.click(index)`, `browser.type(text)`, `browser.input(index, text)`, `browser.keys(keys)`, `browser.upload(index, path)`, `browser.screenshot(path)`, `browser.scroll(direction, amount)`, `browser.wait(seconds)`.

## Tunnels

Expose local dev servers to the browser via Cloudflare tunnels.

```bash
webact tunnel <port>                 # Start tunnel (idempotent)
webact tunnel list                   # Show active tunnels
webact tunnel stop <port>            # Stop tunnel
webact tunnel stop --all             # Stop all tunnels
```

## Command Chaining

Commands can be chained with `&&`. The browser persists via the daemon, so chaining is safe and efficient.

```bash
webact open https://example.com && webact state
webact input 5 "user@example.com" && webact input 6 "password" && webact click 7
```

Chain when you don't need intermediate output. Run separately when you need to parse `state` to discover indices first.

## Common Workflows

### Exposing Local Dev Servers

```bash
python -m http.server 3000 &                      # Start dev server
webact tunnel 3000                            # → https://abc.trycloudflare.com
webact open https://abc.trycloudflare.com     # Browse the tunnel
```

Tunnels are independent of browser sessions and persist across `webact close`.

## Multi-Agent (--connect mode)

Multiple agents can share one browser via `--connect`. Each agent gets its own tab — other agents can't interfere.

**Setup**: Register once, then pass the index with every `--connect` command:

```bash
INDEX=$(webact register)                    # → prints "1"
webact --connect $INDEX open <url>          # Navigate in agent's own tab
webact --connect $INDEX state               # Get state from agent's tab
webact --connect $INDEX click <element>     # Click in agent's tab
```

- **Tab locking**: When an agent mutates a tab (click, type, navigate), that tab is locked to it. Other agents get an error if they try to mutate the same tab.
- **Read-only access**: `state`, `screenshot`, `get`, and `wait` commands work on any tab regardless of locks.
- **Agent sessions expire** after 5 minutes of inactivity. Run `webact register` again to get a new index.

## Global Options

| Option | Description |
|--------|-------------|
| `--headed` | Show browser window |
| `--connect` | Auto-discover running Chrome via CDP |
| `--cdp-url <url>` | Connect via CDP URL (`http://` or `ws://`) |
| `--session NAME` | Target a named session (default: "default") |
| `--json` | Output as JSON |

## Tips

1. **Always run `state` first** to see available elements and their indices
2. **Sessions persist** — browser stays open between commands until you close it
3. **Tunnels are independent** — they persist across `webact close`
4. **`tunnel` is idempotent** — calling again for the same port returns the existing URL

## Troubleshooting

- **Browser won't start?** `webact close` then retry. Run `webact doctor` to check.
- **Element not found?** `webact scroll down` then `webact state`
- **Tunnel not working?** `which cloudflared` to check, `webact tunnel list` to see active tunnels

## Cleanup

```bash
webact close                         # Close browser session
webact tunnel stop --all             # Stop tunnels (if any)
```
