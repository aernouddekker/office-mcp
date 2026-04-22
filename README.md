# office-mcp

MCP servers for office workflows — gives [Claude Desktop](https://claude.ai/download), [Claude Code](https://claude.ai/code), and any MCP client tools that need external APIs, file I/O, or services beyond what the sandboxed skill runtime allows.

Runs as host-side Node processes connected to the MCP client over stdio, so network calls (e.g. OpenAI's Images API) work even when the client's sandbox blocks egress.

## Servers

### Imagegen (`@aernoud/imagegenmcp`)

Generate PNG images from text prompts via OpenAI's Images API.

| Tool | Description |
|------|-------------|
| `generate-image` | Generate one or more images from a prompt. Saves to disk and returns them inline. Supports `gpt-image-1.5` / `gpt-image-2` (default), `gpt-image-1`, `gpt-image-1-mini`, `dall-e-3`, `dall-e-2`. |

**Auth:** reads `OPENAI_API_KEY` from env, falling back to `~/.config/openai/api_key` (single-line, `chmod 600`).

**Billing:** calls hit the OpenAI Platform wallet — *not* ChatGPT Plus/Pro.

## Install

```bash
npm install
npm run build
```

## Claude Desktop configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "imagegen": {
      "command": "node",
      "args": ["/Users/aernouddekker/Development/office-mcp/packages/imagegen/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. The `generate-image` tool will appear in the tool list.

## Claude Code configuration

```bash
claude mcp add imagegen node /Users/aernouddekker/Development/office-mcp/packages/imagegen/dist/index.js
```
