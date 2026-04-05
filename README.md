
# 🤖 LLM Quickstart

1. Direct your favorite coding agent (Cursor, Claude Code, etc) to [Agents.md](AGENTS.md)
2. Prompt away!

<br/>

# 👋 Human Quickstart

**1. Create environment and install WebAct with [uv](https://docs.astral.sh/uv/) (Python>=3.11):**
```bash
uv init && uv add webact && uv sync
# uvx webact install  # Run if you don't have Chromium installed
```

**2. [Optional] Set up your API key:**
```
# .env
WEBACT_API_KEY=your-key
# GOOGLE_API_KEY=your-key
# ANTHROPIC_API_KEY=your-key
```

**3. Run your first agent:**
```python
from webact import Agent, Browser, ChatGoogle
import asyncio

async def main():
    browser = Browser()

    agent = Agent(
        task="Find the latest news about AI agents",
        llm=ChatGoogle(model='gemini-3-flash-preview'),
        # llm=ChatAnthropic(model='claude-sonnet-4-6'),
        browser=browser,
    )
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())
```



# Demos


### 📋 Form-Filling
#### Task = "Fill in this job application with my resume and information."
![Job Application Demo](https://github.com/user-attachments/assets/57865ee6-6004-49d5-b2c2-6dff39ec2ba9)



### 🍎 Grocery-Shopping
#### Task = "Put this list of items into my instacart."

https://github.com/user-attachments/assets/a6813fa7-4a7c-40a6-b4aa-382bf88b1850




### 💻 Personal-Assistant.
#### Task = "Help me find parts for a custom PC."

https://github.com/user-attachments/assets/ac34f75c-057a-43ef-ad06-5b2c9d42bf06



### 💡See more examples in the `examples/` directory!

<br/>

# 🚀 Template Quickstart

**Want to get started even faster?** Generate a ready-to-run template:

```bash
uvx webact init --template default
```

This creates a `webact_default.py` file with a working example. Available templates:
- `default` - Minimal setup to get started quickly
- `advanced` - All configuration options with detailed comments
- `tools` - Examples of custom tools and extending the agent

You can also specify a custom output path:
```bash
uvx webact init --template default --output my_agent.py
```

<br/>

# 💻 CLI

Fast, persistent browser automation from the command line:

```bash
webact open https://example.com    # Navigate to URL
webact state                       # See clickable elements
webact click 5                     # Click element by index
webact type "Hello"                # Type text
webact screenshot page.png         # Take screenshot
webact close                       # Close browser
```

The CLI keeps the browser running between commands for fast iteration. See [CLI docs](webact/skill_cli/README.md) for all commands.

### Claude Code Skill

For [Claude Code](https://claude.ai/code), install the skill to enable AI-assisted browser automation:

```bash
mkdir -p ~/.claude/skills/webact
curl -o ~/.claude/skills/webact/SKILL.md \
  https://raw.githubusercontent.com/pranabbh29/WebAct/main/skills/webact/SKILL.md
```

<br/>

# FAQ

<details>
<summary><b>What's the best model to use?</b></summary>

We recommend **ChatGoogle(model='gemini-3-flash-preview')** or **ChatAnthropic(model='claude-sonnet-4-6')** for browser automation tasks.

For other LLM providers, see the supported models in `webact/llm/`.
</details>

<details>
<summary><b>Can I use custom tools with the agent?</b></summary>

Yes! You can add custom tools to extend the agent's capabilities:

```python
from webact import Tools

tools = Tools()

@tools.action(description='Description of what this tool does.')
def custom_tool(param: str) -> str:
    return f"Result: {param}"

agent = Agent(
    task="Your task",
    llm=llm,
    browser=browser,
    tools=tools,
)
```

</details>

<details>
<summary><b>Can I use this for free?</b></summary>

Yes! WebAct is open source and free to use. You only need to choose an LLM provider (like OpenAI, Google, Anthropic, or run local models with Ollama).
</details>

<details>
<summary><b>Terms of Service</b></summary>

This open-source library is licensed under the MIT License.
</details>

<details>
<summary><b>How do I handle authentication?</b></summary>

Check out our authentication examples:
- [Using real browser profiles](examples/browser/real_browser.py) - Reuse your existing Chrome profile with saved logins
- If you want to use temporary accounts with inbox, choose AgentMail

These examples show how to maintain sessions and handle authentication seamlessly.
</details>

<details>
<summary><b>How do I solve CAPTCHAs?</b></summary>

For CAPTCHA handling, you need better browser fingerprinting and proxies. Run in headful mode with a real browser profile for best results.
</details>

<details>
<summary><b>How do I go into production?</b></summary>

Chrome can consume a lot of memory, and running many agents in parallel can be tricky to manage.

For production use cases, consider:
- Scalable browser infrastructure (Docker + orchestration)
- Memory management
- Proxy rotation
- Headless mode with proper browser profiles
- Horizontal scaling with job queues
</details>

<br/>

<div align="center">

**Tell your computer what to do, and it gets it done.**

</div>
