---
name: webact
description: Automates browser interactions for web testing, form filling, screenshots, and data extraction. Use when the user needs to navigate websites, interact with web pages, fill forms, take screenshots, or extract information from web pages.
allowed-tools: Bash(webact:*)
---

# Browser Automation with webact CLI

The `webact` command provides fast, persistent browser automation. A background daemon keeps the browser open across commands, giving ~50ms latency per call.

## Prerequisites

```bash
webact doctor    # Verify installation
```

For setup details, see https://github.com/browser-use/browser-use/blob/main/browser_use/skill_cli/README.md

## Core Workflow

1. **Navigate**: `webact open <url>` — launches headless browser and opens page
2. **Inspect**: `webact state` — returns clickable elements with indices
3. **Interact**: use indices from state (`webact click 5`, `webact input 3 "text"`)
4. **Verify**: `webact state` or `webact screenshot` to confirm
5. **Repeat**: browser stays open between commands

If a command fails, run `webact close` first to clear any broken session, then retry.

To use the user's existing Chrome (preserves logins/cookies): run `webact connect` first.
To use a cloud browser instead: run `webact cloud connect` first.
After either, commands work the same way.

## Browser Modes

```bash
webact open <url>                         # Default: headless Chromium (no setup needed)
webact --headed open <url>                # Visible window (for debugging)
webact connect                            # Connect to user's Chrome (preserves logins/cookies)
webact cloud connect                      # Cloud browser (zero-config, requires API key)
webact --profile "Default" open <url>     # Real Chrome with specific profile
```

After `connect` or `cloud connect`, all subsequent commands go to that browser — no extra flags needed.

## Commands

```bash
# Navigation
webact open <url>                    # Navigate to URL
webact back                          # Go back in history
webact scroll down                   # Scroll down (--amount N for pixels)
webact scroll up                     # Scroll up
webact tab list                      # List all tabs
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

# Session
webact close                         # Close browser and stop daemon
webact sessions                      # List active sessions
webact close --all                   # Close all sessions
```

For advanced browser control (CDP, device emulation, tab activation), see `references/cdp-python.md`.

## Cloud API

```bash
webact cloud connect                 # Provision cloud browser and connect (zero-config)
webact cloud login <api-key>         # Save API key (or set BROWSER_USE_API_KEY)
webact cloud logout                  # Remove API key
webact cloud v2 GET /browsers        # REST passthrough (v2 or v3)
webact cloud v2 POST /tasks '{"task":"...","url":"..."}'
webact cloud v2 poll <task-id>       # Poll task until done
webact cloud v2 --help               # Show API endpoints
```

`cloud connect` provisions a cloud browser with a persistent profile (auto-created on first use), connects via CDP, and prints a live URL. `webact close` disconnects AND stops the cloud browser. For custom browser settings (proxy, timeout, specific profile), use `cloud v2 POST /browsers` directly with the desired parameters.

### Agent Self-Registration

Only use this if you don't already have an API key (check `webact doctor` to see if api_key is set). If already logged in, skip this entirely.

1. `webact cloud signup` — get a challenge
2. Solve the challenge
3. `webact cloud signup --verify <challenge-id> <answer>` — verify and save API key
4. `webact cloud signup --claim` — generate URL for a human to claim the account

## Tunnels

```bash
webact tunnel <port>                 # Start Cloudflare tunnel (idempotent)
webact tunnel list                   # Show active tunnels
webact tunnel stop <port>            # Stop tunnel
webact tunnel stop --all             # Stop all tunnels
```

## Profile Management

```bash
webact profile list                  # List detected browsers and profiles
webact profile sync --all            # Sync profiles to cloud
webact profile update                # Download/update profile-use binary
```

## Command Chaining

Commands can be chained with `&&`. The browser persists via the daemon, so chaining is safe and efficient.

```bash
webact open https://example.com && webact state
webact input 5 "user@example.com" && webact input 6 "password" && webact click 7
```

Chain when you don't need intermediate output. Run separately when you need to parse `state` to discover indices first.

## Common Workflows

### Authenticated Browsing

When a task requires an authenticated site (Gmail, GitHub, internal tools), use Chrome profiles:

```bash
webact profile list                           # Check available profiles
# Ask the user which profile to use, then:
webact --profile "Default" open https://github.com  # Already logged in
```

### Exposing Local Dev Servers

```bash
webact tunnel 3000                            # → https://abc.trycloudflare.com
webact open https://abc.trycloudflare.com     # Browse the tunnel
```

## Multiple Browsers

For subagent workflows or running multiple browsers in parallel, use `--session NAME`. Each session gets its own browser. See `references/multi-session.md`.

## Configuration

```bash
webact config list                            # Show all config values
webact config set cloud_connect_proxy jp      # Set a value
webact config get cloud_connect_proxy         # Get a value
webact config unset cloud_connect_timeout     # Remove a value
webact doctor                                 # Shows config + diagnostics
webact setup                                  # Interactive post-install setup
```

Config stored in `~/.webact/config.json`.

## Global Options

| Option | Description |
|--------|-------------|
| `--headed` | Show browser window |
| `--profile [NAME]` | Use real Chrome (bare `--profile` uses "Default") |
| `--cdp-url <url>` | Connect via CDP URL (`http://` or `ws://`) |
| `--session NAME` | Target a named session (default: "default") |
| `--json` | Output as JSON |
| `--mcp` | Run as MCP server via stdin/stdout |

## Tips

1. **Always run `state` first** to see available elements and their indices
2. **Use `--headed` for debugging** to see what the browser is doing
3. **Sessions persist** — browser stays open between commands
4. **CLI aliases**: `bu`, `browser`, and `browseruse` all work
5. **If commands fail**, run `webact close` first, then retry

## Troubleshooting

- **Browser won't start?** `webact close` then `webact --headed open <url>`
- **Element not found?** `webact scroll down` then `webact state`
- **Run diagnostics:** `webact doctor`

## Cleanup

```bash
webact close                         # Close browser session
webact tunnel stop --all             # Stop tunnels (if any)
```
