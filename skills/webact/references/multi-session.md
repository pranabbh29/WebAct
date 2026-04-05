# Multiple Browser Sessions

## Why use multiple sessions

When you need more than one browser at a time:
- Cloud browser for scraping + local Chrome for authenticated tasks
- Two different Chrome profiles simultaneously
- Isolated browser for testing that won't affect the user's browsing
- Running a headed browser for debugging while headless runs in background

## How sessions are isolated

Each `--session NAME` gets:
- Its own daemon process
- Its own Unix socket (`~/.webact/{name}.sock`)
- Its own PID file and state file
- Its own browser instance (completely independent)
- Its own tab ownership state (multi-agent locks don't cross sessions)

## The `--session` flag

Must be passed on every command targeting that session:

```bash
webact --session work open <url>      # goes to 'work' daemon
webact --session work state           # reads from 'work' daemon
webact state                          # goes to 'default' daemon (different browser)
```

If you forget `--session`, the command goes to the `default` session. This is the most common mistake — you'll interact with the wrong browser.

## Combining sessions with browser modes

```bash
# Session 1: cloud browser
webact --session cloud cloud connect

# Session 2: connect to user's Chrome
webact --session chrome connect

# Session 3: headed Chromium for debugging
webact --session debug --headed open <url>
```

Each session is fully independent. The cloud session talks to a remote browser, the chrome session talks to the user's Chrome, and the debug session manages its own Chromium — all running simultaneously.

## Listing and managing sessions

```bash
webact sessions
```

Output:
```
SESSION          PHASE          PID      CONFIG
cloud            running        12345    cloud
chrome           running        12346    cdp
debug            ready          12347    headed
```

PHASE shows the daemon lifecycle state: `initializing`, `ready`, `starting`, `running`, `shutting_down`, `stopped`, `failed`.

```bash
webact --session cloud close           # close one session
webact close --all                     # close every session
```

## Common patterns

**Cloud + local authenticated:**
```bash
webact --session scraper cloud connect
webact --session scraper open https://example.com
# ... scrape data ...

webact --session auth --profile "Default" open https://github.com
webact --session auth state
# ... interact with authenticated site ...
```

**Throwaway test browser:**
```bash
webact --session test --headed open https://localhost:3000
# ... test, debug, inspect ...
webact --session test close    # done, clean up
```

**Environment variable:**
```bash
export BROWSER_USE_SESSION=work
webact open <url>              # uses 'work' session without --session flag
```
