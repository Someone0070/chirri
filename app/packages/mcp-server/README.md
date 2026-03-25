# @chirri/mcp-server

MCP (Model Context Protocol) server for [Chirri](https://chirri.io) — the API change monitoring platform. Use it with Claude Desktop, Cursor, Windsurf, or any MCP-compatible AI assistant.

## What It Does

Gives your AI assistant 11 tools to interact with your Chirri account:

| Tool | Description |
|---|---|
| `chirri_list_monitors` | List monitored API endpoints |
| `chirri_add_monitor` | Add a new URL to monitor |
| `chirri_remove_monitor` | Remove a monitored URL |
| `chirri_get_changes` | Get detected API changes (filter by severity, date, etc.) |
| `chirri_get_diff` | Get detailed diff for a specific change |
| `chirri_check_now` | Trigger an immediate check |
| `chirri_get_forecasts` | Get early warning signals (deprecations, sunsets) |
| `chirri_acknowledge` | Track/ignore/resolve changes, acknowledge forecasts |
| `chirri_get_impact_analysis` | AI-generated impact analysis with migration steps |
| `chirri_get_dependency_graph` | Full source dependency tree for a monitored URL |
| `chirri_search` | Search across changes, forecasts, and monitors |

## Installation

```bash
npm install -g @chirri/mcp-server
```

Or run directly with npx:

```bash
npx @chirri/mcp-server
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CHIRRI_API_KEY` | **Yes** | Your Chirri API key (`ck_live_...`). Get one at [chirri.io/settings/api-keys](https://chirri.io/settings/api-keys) |
| `CHIRRI_API_URL` | No | Override API base URL (default: `https://api.chirri.io/v1`) |

## Configuration

### Claude Desktop

Edit your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "chirri": {
      "command": "npx",
      "args": ["-y", "@chirri/mcp-server"],
      "env": {
        "CHIRRI_API_KEY": "ck_live_your_api_key_here"
      }
    }
  }
}
```

### Cursor

In Cursor Settings → MCP:

```json
{
  "mcpServers": {
    "chirri": {
      "command": "npx",
      "args": ["-y", "@chirri/mcp-server"],
      "env": {
        "CHIRRI_API_KEY": "ck_live_your_api_key_here"
      }
    }
  }
}
```

### Windsurf

Same JSON format as Cursor, in Windsurf's MCP configuration.

### With a Global Install

If you installed globally:

```json
{
  "mcpServers": {
    "chirri": {
      "command": "chirri-mcp",
      "env": {
        "CHIRRI_API_KEY": "ck_live_your_api_key_here"
      }
    }
  }
}
```

## Example Conversations

Once configured, you can ask your AI assistant things like:

- *"What APIs am I monitoring?"*
- *"Show me recent critical changes"*
- *"Add https://api.openai.com/v1/models to my monitors"*
- *"What's the impact of that Stripe schema change?"*
- *"Are there any upcoming deprecations I should know about?"*
- *"Check the Twilio API right now"*
- *"Search for anything related to authentication changes"*

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
CHIRRI_API_KEY=ck_live_... pnpm dev

# Build
pnpm build

# Run built version
CHIRRI_API_KEY=ck_live_... pnpm start
```

## License

MIT
